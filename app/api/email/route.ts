/**
 * Inbound email webhook — receives forwarded invoices and auto-parses them.
 *
 * Compatible with: Postmark Inbound (default), adaptable to SendGrid/Mailgun.
 *
 * Required environment variables:
 *   ANTHROPIC_API_KEY          — already set
 *   NEXT_PUBLIC_SUPABASE_URL   — already set
 *   SUPABASE_SERVICE_ROLE_KEY  — add in Vercel dashboard (Settings → Environment Variables)
 *   EMAIL_WEBHOOK_SECRET       — optional shared secret for request validation
 *
 * Postmark setup:
 *   1. Create an Inbound stream in Postmark
 *   2. Set webhook URL to: https://<your-domain>/api/email
 *   3. Add X-Webhook-Secret header matching EMAIL_WEBHOOK_SECRET
 *   4. Point your MX record (or address alias) at the Postmark inbound address
 */

import Anthropic from '@anthropic-ai/sdk';
import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

// ── Clients ───────────────────────────────────────────────────────────────────
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// Service-role client bypasses RLS — safe for server-only webhook code
const supabaseAdmin = () => {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Supabase service role credentials not configured');
  return createClient(url, key, { auth: { persistSession: false } });
};

// ── Types ─────────────────────────────────────────────────────────────────────

/** Postmark inbound email attachment */
interface PostmarkAttachment {
  Name:          string;
  Content:       string;   // base64
  ContentType:   string;
  ContentLength: number;
}

/** Postmark inbound email payload (subset of fields we care about) */
interface PostmarkPayload {
  From:        string;
  FromFull?:   { Email: string; Name?: string };
  To:          string;
  Subject?:    string;
  Attachments: PostmarkAttachment[];
}

/** Claude-parsed invoice fields */
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

const senderEmail = (payload: PostmarkPayload): string => {
  // FromFull.Email is the canonical address; From may include a display name
  if (payload.FromFull?.Email) return payload.FromFull.Email.toLowerCase().trim();
  const match = payload.From.match(/<(.+)>/);
  return (match ? match[1] : payload.From).toLowerCase().trim();
};

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
  // ── 1. Validate webhook secret (optional but recommended) ──────────────────
  const secret = process.env.EMAIL_WEBHOOK_SECRET;
  if (secret) {
    const provided = req.headers.get('x-webhook-secret') ?? req.headers.get('x-postmark-secret');
    if (provided !== secret) {
      log('Rejected: invalid webhook secret');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
  }

  // ── 2. Parse request body ──────────────────────────────────────────────────
  let payload: PostmarkPayload;
  try {
    payload = await req.json() as PostmarkPayload;
  } catch {
    log('Failed to parse JSON body');
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const from = senderEmail(payload);
  log('Received email', { from, subject: payload.Subject, attachments: payload.Attachments?.length ?? 0 });

  // ── 3. Find PDF attachment ─────────────────────────────────────────────────
  const pdfAttachment = payload.Attachments?.find(
    a => a.ContentType === 'application/pdf' || a.Name?.toLowerCase().endsWith('.pdf')
  );

  if (!pdfAttachment) {
    log('No PDF attachment found');
    return NextResponse.json({ error: 'No PDF attachment found in email' }, { status: 400 });
  }
  log('Found PDF attachment', { name: pdfAttachment.Name, bytes: pdfAttachment.ContentLength });

  // ── 4. Look up user by sender email ───────────────────────────────────────
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
    log('Unknown sender', { from, error: emailErr?.message });
    return NextResponse.json(
      { error: `Sender ${from} not registered in user_emails table` },
      { status: 404 }
    );
  }

  const userId: string = emailRow.user_id;
  log('Identified user', { userId });

  // ── 5. Parse PDF with Anthropic ────────────────────────────────────────────
  let parsed: ParsedInvoice;
  try {
    parsed = await parsePdf(pdfAttachment.Content);
    log('Parsed invoice', parsed);
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Unknown error';
    log('PDF parsing failed', msg);
    return NextResponse.json({ error: `PDF parsing failed: ${msg}` }, { status: 500 });
  }

  // ── 6. Upload PDF to Supabase Storage ─────────────────────────────────────
  const dato       = parsed.dato ?? new Date().toISOString().slice(0, 10);
  const leverandor = parsed.leverandor ?? 'ukjent';
  const safeName   = slugify(leverandor);
  const pdfPath    = `${userId}/${dato}_${safeName}.pdf`;

  const pdfBytes = Buffer.from(pdfAttachment.Content, 'base64');

  const { error: uploadErr } = await supabase.storage
    .from('fakturaer-pdfs')
    .upload(pdfPath, pdfBytes, { contentType: 'application/pdf', upsert: true });

  if (uploadErr) {
    log('Storage upload failed', uploadErr.message);
    return NextResponse.json({ error: `Storage upload failed: ${uploadErr.message}` }, { status: 500 });
  }
  log('PDF uploaded', { path: pdfPath });

  // ── 7. Insert into fakturaer table ─────────────────────────────────────────
  const month = dato.slice(0, 7);  // YYYY-MM

  const { data: inserted, error: insertErr } = await supabase
    .from('fakturaer')
    .insert({
      user_id:   userId,
      leverandor: leverandor,
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
    // Clean up orphaned storage file
    await supabase.storage.from('fakturaer-pdfs').remove([pdfPath]);
    return NextResponse.json({ error: `Database insert failed: ${insertErr?.message}` }, { status: 500 });
  }

  log('Invoice saved', { invoiceId: inserted.id, userId, month, leverandor, belop: parsed.belop });

  return NextResponse.json({ success: true, invoiceId: inserted.id });
}
