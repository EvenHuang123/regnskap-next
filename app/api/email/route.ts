/**
 * Inbound email webhook — receives forwarded invoices via Vercel Email.
 *
 * Vercel Email delivers inbound messages as POST JSON to this route.
 * No external email service needed.
 *
 * Required environment variables:
 *   ANTHROPIC_API_KEY          — already set
 *   NEXT_PUBLIC_SUPABASE_URL   — already set
 *   SUPABASE_SERVICE_ROLE_KEY  — add in Vercel dashboard (Settings → Environment Variables)
 *
 * Vercel Email setup:
 *   1. Add your domain in Vercel dashboard → Storage → Email
 *   2. Set inbound route to: /api/email
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

/** Vercel Email inbound payload */
interface VercelEmailPayload {
  from:        { address: string; name?: string };
  to:          { address: string; name?: string }[];
  subject?:    string;
  text?:       string;
  html?:       string;
  attachments: {
    filename:    string;
    contentType: string;
    content:     string;   // base64-encoded
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
  let payload: VercelEmailPayload;
  try {
    payload = await req.json() as VercelEmailPayload;
  } catch {
    log('Failed to parse JSON body');
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const from = payload.from?.address?.toLowerCase().trim();
  log('Received email', { from, subject: payload.subject, attachments: payload.attachments?.length ?? 0 });

  if (!from) {
    log('Missing sender address');
    return NextResponse.json({ error: 'Missing sender address' }, { status: 400 });
  }

  // ── 2. Find PDF attachment ─────────────────────────────────────────────────
  const pdfAttachment = payload.attachments?.find(
    a => a.contentType === 'application/pdf' || a.filename?.toLowerCase().endsWith('.pdf')
  );

  if (!pdfAttachment) {
    log('No PDF attachment found');
    return NextResponse.json({ error: 'No PDF attachment found in email' }, { status: 400 });
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
    log('Unknown sender', { from, error: emailErr?.message });
    return NextResponse.json(
      { error: `Sender ${from} not registered in user_emails table` },
      { status: 404 }
    );
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
