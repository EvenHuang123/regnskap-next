/**
 * Inbound email webhook — receives forwarded invoices via Resend inbound.
 *
 * Resend delivers inbound messages as POST JSON to this route.
 *
 * Required environment variables:
 *   ANTHROPIC_API_KEY          — already set
 *   NEXT_PUBLIC_SUPABASE_URL   — already set
 *   SUPABASE_SERVICE_ROLE_KEY  — add in Vercel dashboard (Settings → Environment Variables)
 *   RESEND_API_KEY             — add in Vercel dashboard (Settings → Environment Variables)
 *
 * Resend setup:
 *   1. Add your domain in Resend dashboard → Domains
 *   2. Create an Inbound route pointing to: https://<your-domain>/api/email
 *   3. Users register their sender address in the user_emails table
 */

import Anthropic from '@anthropic-ai/sdk';
import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

// ── Clients ───────────────────────────────────────────────────────────────────

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const supabaseAdmin = () => {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Supabase service role credentials not configured');
  return createClient(url, key, { auth: { persistSession: false } });
};

// ── Types ─────────────────────────────────────────────────────────────────────

/** Resend inbound webhook — top-level envelope */
interface ResendWebhook {
  type?:       string;   // e.g. "email.received"
  created_at?: string;
  data:        ResendEmailData;
}

/** Email data nested under webhook.data */
interface ResendEmailData {
  from?:        string;   // "Name <email>" or "email"
  sender?:      string;   // alternative sender field
  to?:          string | string[];
  subject?:     string;
  html?:        string;
  text?:        string;
  attachments?: {
    filename:     string;
    content:      string;   // base64-encoded
    content_type: string;   // Resend uses snake_case
    contentType?: string;   // fallback camelCase
  }[];
}

interface ParsedInvoice {
  leverandor: string | null;
  belop:      number | null;
  dato:       string | null;
  mva:        number | null;
  kategori:   string | null;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const log = (step: string, data?: unknown) =>
  console.log(`[email-webhook] ${step}`, data !== undefined ? JSON.stringify(data) : '');

const slugify = (s: string) =>
  s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

// ── PDF parsing via Anthropic ─────────────────────────────────────────────────

async function parsePdf(base64: string): Promise<ParsedInvoice> {
  const message = await anthropic.beta.messages.create({
    model:      'claude-sonnet-4-20250514',
    max_tokens: 1024,
    betas:      ['pdfs-2024-09-25'],
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'document',
            source: { type: 'base64', media_type: 'application/pdf', data: base64 },
          },
          {
            type: 'text',
            text: `Du er en regnskapsassistent. Les denne fakturaen og trekk ut følgende felt som JSON.

Returner KUN gyldig JSON — ingen forklaringer, ingen markdown, ingen kodeblokker.

Format:
{
  "leverandor": "leverandørens navn",
  "belop": 1234.56,
  "dato": "YYYY-MM-DD",
  "mva": 308.64,
  "kategori": "en av: Husleie, Strøm, Internett, Lønn, Varekjøp, Transport, Markedsføring, Forsikring, Utstyr, Annet"
}

Regler:
- belop er totalbeløp INKLUDERT MVA (det brukeren betaler)
- mva er MVA-beløpet alene (0 hvis ikke oppgitt)
- dato er fakturadatoen (ikke forfallsdato) i YYYY-MM-DD format
- Hvis et felt ikke finnes i dokumentet, bruk null
- kategori: velg den som passer best basert på leverandør og beskrivelse`,
          },
        ],
      },
    ],
  });

  const raw = (message.content[0] as { text: string }).text.trim();
  return JSON.parse(raw) as ParsedInvoice;
}

// ── Webhook handler ───────────────────────────────────────────────────────────

export async function POST(req: Request) {
  // ── 1. Parse request body ──────────────────────────────────────────────────
  // Clone so we can read the raw text for debugging AND parse as JSON.
  const rawText = await req.text();
  log('Raw body (first 2000 chars)', rawText.slice(0, 2000));

  let webhook: ResendWebhook;
  try {
    webhook = JSON.parse(rawText) as ResendWebhook;
  } catch {
    log('Failed to parse JSON body');
    // Return 200 so Resend does not retry — this is a permanent parse failure.
    return NextResponse.json({ skipped: 'Invalid JSON body' }, { status: 200 });
  }

  // Resend wraps all email fields under webhook.data; fall back to root for
  // flat payloads (e.g. local testing).
  const email: ResendEmailData = webhook.data ?? (webhook as unknown as ResendEmailData);

  // Log the parsed structure so we can confirm field names in Vercel logs.
  log('Parsed email fields', {
    keys:        Object.keys(email),
    from:        email.from,
    sender:      email.sender,
    subject:     email.subject,
    attachments: (email.attachments ?? []).map(a => ({
      filename:     a.filename,
      content_type: a.content_type,
      contentType:  a.contentType,
      hasContent:   !!a.content,
    })),
  });

  // Sender may be "Name <email@example.com>" — extract just the address.
  const rawFrom   = email.from ?? email.sender ?? '';
  const addrMatch = rawFrom.match(/<([^>]+)>/);
  const from      = (addrMatch ? addrMatch[1] : rawFrom).toLowerCase().trim();

  if (!from) {
    log('Missing sender address — skipping');
    // 200 so Resend marks delivery as done; check logs to fix payload mapping.
    return NextResponse.json({ skipped: 'Missing sender address' }, { status: 200 });
  }

  // ── 2. Find PDF attachment ─────────────────────────────────────────────────
  const pdfAttachment = (email.attachments ?? []).find(
    a => (a.content_type ?? a.contentType ?? '').toLowerCase().includes('pdf')
      || a.filename?.toLowerCase().endsWith('.pdf')
  );

  if (!pdfAttachment) {
    log('No PDF attachment — skipping');
    // 200: email without a PDF is valid, just not actionable.
    return NextResponse.json({ skipped: 'No PDF attachment' }, { status: 200 });
  }
  log('Found PDF attachment', { filename: pdfAttachment.filename });

  // ── 3. Look up user by sender email ───────────────────────────────────────
  let supabase: ReturnType<typeof supabaseAdmin>;
  try {
    supabase = supabaseAdmin();
  } catch (e) {
    log('Supabase admin client error', e instanceof Error ? e.message : e);
    return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
  }

  const { data: emailRow, error: emailErr } = await supabase
    .from('user_emails')
    .select('user_id')
    .eq('email', from)
    .eq('aktiv', true)
    .single();

  if (emailErr || !emailRow) {
    log('Unknown sender — skipping', { from, error: emailErr?.message });
    // 200: unknown sender is not a server error; just not registered yet.
    return NextResponse.json({ skipped: `Sender ${from} not in user_emails` }, { status: 200 });
  }

  const userId: string = emailRow.user_id;
  log('Identified user', { userId });

  // ── 4. Parse PDF with Anthropic ────────────────────────────────────────────
  let parsed: ParsedInvoice;
  try {
    parsed = await parsePdf(pdfAttachment.content);
    log('Parsed invoice', parsed);
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Unknown error';
    log('PDF parsing failed', msg);
    return NextResponse.json({ error: `PDF parsing failed: ${msg}` }, { status: 500 });
  }

  // ── 5. Upload PDF to Supabase Storage ─────────────────────────────────────
  const dato      = parsed.dato ?? new Date().toISOString().slice(0, 10);
  const leverandor = parsed.leverandor ?? 'ukjent';
  const pdfPath   = `${userId}/${dato}_${slugify(leverandor)}.pdf`;
  const pdfBytes  = Buffer.from(pdfAttachment.content, 'base64');

  const { error: uploadErr } = await supabase.storage
    .from('fakturaer-pdfs')
    .upload(pdfPath, pdfBytes, { contentType: 'application/pdf', upsert: true });

  if (uploadErr) {
    log('Storage upload failed', uploadErr.message);
    return NextResponse.json({ error: `Storage upload failed: ${uploadErr.message}` }, { status: 500 });
  }
  log('PDF uploaded', { path: pdfPath });

  // ── 6. Insert into fakturaer table ─────────────────────────────────────────
  const { data: inserted, error: insertErr } = await supabase
    .from('fakturaer')
    .insert({
      user_id:   userId,
      leverandor,
      belop:     parsed.belop    ?? 0,
      dato,
      mva:       parsed.mva      ?? 0,
      kategori:  parsed.kategori ?? 'Annet',
      pdf_url:   pdfPath,
      status:    'ubetalt',
    })
    .select('id')
    .single();

  if (insertErr || !inserted) {
    log('DB insert failed', insertErr?.message);
    await supabase.storage.from('fakturaer-pdfs').remove([pdfPath]);
    return NextResponse.json({ error: `Database insert failed: ${insertErr?.message}` }, { status: 500 });
  }

  log('Invoice saved', { invoiceId: inserted.id, userId, dato, leverandor, belop: parsed.belop });

  return NextResponse.json({ success: true, invoiceId: inserted.id });
}
