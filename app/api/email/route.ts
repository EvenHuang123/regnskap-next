/**
 * Inbound email webhook — receives forwarded invoices via Resend inbound.
 *
 * Resend delivers inbound messages as POST JSON to this route.
 * Attachments are NOT included inline — content must be fetched via
 * GET https://api.resend.com/emails/{email_id}/attachments/{attachment_id}
 *
 * Required environment variables:
 *   ANTHROPIC_API_KEY          — already set
 *   NEXT_PUBLIC_SUPABASE_URL   — already set
 *   SUPABASE_SERVICE_ROLE_KEY  — add in Vercel dashboard (Settings → Environment Variables)
 *   RESEND_API_KEY             — add in Vercel dashboard (Settings → Environment Variables)
 */

import Anthropic from '@anthropic-ai/sdk';
import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

// Allow up to 60 seconds — Claude PDF parsing can be slow.
export const maxDuration = 60;
export const dynamic = 'force-dynamic';

// Resend does a GET before POSTing to verify the endpoint.
export function GET() {
  return NextResponse.json({ ok: true });
}

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
  type?:       string;   // "email.received"
  created_at?: string;
  data:        ResendEmailData;
}

/** Email data nested under webhook.data */
interface ResendEmailData {
  email_id?:    string;
  from?:        string;
  sender?:      string;
  to?:          string | string[];
  subject?:     string;
  attachments?: ResendAttachment[];
}

/**
 * Resend inbound attachment metadata.
 * Content is NOT included inline — must be fetched separately.
 */
interface ResendAttachment {
  id:                  string;   // attachment UUID — use to fetch content
  filename:            string;
  content_type:        string;
  content_disposition: string;
  content_id?:         string;
  // Inline content (present if Resend ever sends it):
  content?:            string;
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

// ── Fetch attachment content from Resend API ──────────────────────────────────

async function fetchAttachmentBase64(emailId: string, attachmentId: string): Promise<string> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) throw new Error('RESEND_API_KEY not configured');

  // Resend inbound uses a separate /receiving/ namespace — not /emails/
  const listUrl = `https://api.resend.com/emails/receiving/${emailId}/attachments`;
  log('Listing attachments from Resend inbound API', { url: listUrl });

  const listRes = await fetch(listUrl, {
    headers: { Authorization: `Bearer ${apiKey}` },
  });

  if (!listRes.ok) {
    throw new Error(`Resend attachments list failed: ${listRes.status} ${await listRes.text()}`);
  }

  const listJson = await listRes.json() as { data?: Record<string, unknown>[] } | Record<string, unknown>[];
  const attachments: Record<string, unknown>[] = Array.isArray(listJson)
    ? listJson
    : (listJson as { data?: Record<string, unknown>[] }).data ?? [];

  log('Resend attachments list', attachments.map(a => ({ id: a.id, filename: a.filename, size: a.size })));

  const match = attachments.find(a => a.id === attachmentId);
  if (!match) {
    throw new Error(`Attachment ${attachmentId} not found in received email ${emailId}`);
  }

  const downloadUrl = match.download_url as string | undefined;
  if (!downloadUrl) {
    throw new Error(`No download_url on attachment ${attachmentId} — keys: ${Object.keys(match).join(', ')}`);
  }

  log('Downloading attachment from CDN', { url: downloadUrl.slice(0, 80) });

  const dlRes = await fetch(downloadUrl);
  if (!dlRes.ok) {
    throw new Error(`Attachment download failed: ${dlRes.status}`);
  }

  // Convert binary response to base64
  const arrayBuffer = await dlRes.arrayBuffer();
  const base64 = Buffer.from(arrayBuffer).toString('base64');
  log('Attachment downloaded', { bytes: arrayBuffer.byteLength, base64Len: base64.length });
  return base64;
}

// ── PDF parsing via Anthropic ─────────────────────────────────────────────────

async function parsePdf(base64: string): Promise<ParsedInvoice> {
  const message = await anthropic.messages.create({
    model:      'claude-sonnet-4-6',
    max_tokens: 1024,
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
  try {
    return await handleWebhook(req);
  } catch (err) {
    console.error('[email-webhook] Unhandled exception', err);
    return NextResponse.json({ skipped: 'Internal error', detail: String(err) }, { status: 200 });
  }
}

async function handleWebhook(req: Request) {
  // ── 1. Parse request body ──────────────────────────────────────────────────
  const rawText = await req.text();
  log('Raw body (first 2000 chars)', rawText.slice(0, 2000));

  let webhook: ResendWebhook;
  try {
    webhook = JSON.parse(rawText) as ResendWebhook;
  } catch {
    log('Failed to parse JSON body');
    return NextResponse.json({ skipped: 'Invalid JSON body' }, { status: 200 });
  }

  const email: ResendEmailData = webhook.data ?? (webhook as unknown as ResendEmailData);

  log('Parsed email fields', {
    email_id: email.email_id,
    from:     email.from,
    subject:  email.subject,
    attachments: (email.attachments ?? []).map(a => ({
      id:           a.id,
      filename:     a.filename,
      content_type: a.content_type,
      hasInline:    !!a.content,
    })),
  });

  // ── 2. Extract sender address ──────────────────────────────────────────────
  const rawFrom   = email.from ?? '';
  const addrMatch = rawFrom.match(/<([^>]+)>/);
  const from      = (addrMatch ? addrMatch[1] : rawFrom).toLowerCase().trim();

  if (!from) {
    log('Missing sender address — skipping');
    return NextResponse.json({ skipped: 'Missing sender address' }, { status: 200 });
  }

  // ── 3. Find PDF attachment ─────────────────────────────────────────────────
  const pdfAttachment = (email.attachments ?? []).find(
    a => a.content_type?.toLowerCase().includes('pdf')
      || a.filename?.toLowerCase().endsWith('.pdf')
  );

  if (!pdfAttachment) {
    log('No PDF attachment — skipping');
    return NextResponse.json({ skipped: 'No PDF attachment' }, { status: 200 });
  }

  log('Found PDF attachment', { filename: pdfAttachment.filename, id: pdfAttachment.id });

  // ── 4. Get attachment base64 content ──────────────────────────────────────
  // Resend does not include content inline — fetch via API.
  let pdfContent: string = pdfAttachment.content ?? '';

  if (!pdfContent) {
    const emailId = email.email_id;
    if (!emailId) {
      log('No email_id in payload — cannot fetch attachment content');
      return NextResponse.json({ skipped: 'Missing email_id for attachment fetch' }, { status: 200 });
    }
    try {
      pdfContent = await fetchAttachmentBase64(emailId, pdfAttachment.id);
      log('Fetched attachment content', { len: pdfContent.length });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      log('Failed to fetch attachment from Resend', msg);
      return NextResponse.json({ error: `Attachment fetch failed: ${msg}` }, { status: 500 });
    }
  }

  if (!pdfContent) {
    log('PDF content still empty after fetch attempt');
    return NextResponse.json({ skipped: 'PDF content empty' }, { status: 200 });
  }

  // ── 5. Look up user by sender email ───────────────────────────────────────
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
    return NextResponse.json({ skipped: `Sender ${from} not in user_emails` }, { status: 200 });
  }

  const userId: string = emailRow.user_id;
  log('Identified user', { userId });

  // ── 6. Parse PDF with Anthropic ────────────────────────────────────────────
  let parsed: ParsedInvoice;
  try {
    parsed = await parsePdf(pdfContent);
    log('Parsed invoice', parsed);
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Unknown error';
    log('PDF parsing failed', msg);
    return NextResponse.json({ error: `PDF parsing failed: ${msg}` }, { status: 500 });
  }

  // ── 7. Upload PDF to Supabase Storage ─────────────────────────────────────
  const dato       = parsed.dato ?? new Date().toISOString().slice(0, 10);
  const leverandor = parsed.leverandor ?? 'ukjent';
  const pdfPath    = `${userId}/${dato}_${slugify(leverandor)}.pdf`;
  const pdfBytes   = Buffer.from(pdfContent, 'base64');

  const { error: uploadErr } = await supabase.storage
    .from('fakturaer-pdfs')
    .upload(pdfPath, pdfBytes, { contentType: 'application/pdf', upsert: true });

  if (uploadErr) {
    log('Storage upload failed', uploadErr.message);
    return NextResponse.json({ error: `Storage upload failed: ${uploadErr.message}` }, { status: 500 });
  }
  log('PDF uploaded', { path: pdfPath });

  // ── 8. Insert into fakturaer table ─────────────────────────────────────────
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
