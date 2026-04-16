import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase-server';
import { buildJournalEntry, isBalanced, type ExportFaktura } from '@/lib/accounting';

interface RequestBody {
  invoice_id: string;
  faktura: ExportFaktura;
}

export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Ikke autentisert' }, { status: 401 });

  let body: RequestBody;
  try {
    body = await req.json() as RequestBody;
  } catch {
    return NextResponse.json({ error: 'Ugyldig JSON' }, { status: 400 });
  }

  const { invoice_id, faktura } = body;
  if (!invoice_id || !faktura) {
    return NextResponse.json({ error: 'invoice_id og faktura er påkrevd' }, { status: 400 });
  }

  // Build and validate the journal entry
  const entry = buildJournalEntry(faktura);

  if (!isBalanced(entry)) {
    const debit  = entry.lines.reduce((s, l) => s + l.debit_amount,  0);
    const credit = entry.lines.reduce((s, l) => s + l.credit_amount, 0);
    return NextResponse.json({
      error: `Postering ikke i balanse: debet ${debit} ≠ kredit ${credit}`,
    }, { status: 422 });
  }

  // Check if an entry already exists for this invoice
  const { data: existing } = await supabase
    .from('journal_entries')
    .select('id')
    .eq('invoice_id', invoice_id)
    .eq('user_id', user.id)
    .maybeSingle();

  if (existing) {
    return NextResponse.json({ journalEntryId: existing.id, alreadyExists: true });
  }

  // Insert journal_entry header
  const { data: je, error: jeErr } = await supabase
    .from('journal_entries')
    .insert({
      invoice_id,
      user_id:    user.id,
      entry_date: entry.entry_date,
      description: entry.description,
    })
    .select('id')
    .single();

  if (jeErr || !je) {
    return NextResponse.json({ error: jeErr?.message ?? 'Kunne ikke opprette journalpost' }, { status: 500 });
  }

  // Insert lines
  const lines = entry.lines.map(l => ({
    journal_entry_id: je.id,
    account_code:     l.account_code,
    debit_amount:     l.debit_amount,
    credit_amount:    l.credit_amount,
    description:      l.description,
  }));

  const { error: linesErr } = await supabase
    .from('journal_entry_lines')
    .insert(lines);

  if (linesErr) {
    // Roll back the header
    await supabase.from('journal_entries').delete().eq('id', je.id);
    return NextResponse.json({ error: linesErr.message }, { status: 500 });
  }

  return NextResponse.json({
    journalEntryId: je.id,
    lines: entry.lines.length,
    balanced: true,
  });
}

export async function GET(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Ikke autentisert' }, { status: 401 });

  const url        = new URL(req.url);
  const invoiceId  = url.searchParams.get('invoice_id');

  if (!invoiceId) {
    return NextResponse.json({ error: 'invoice_id påkrevd' }, { status: 400 });
  }

  const { data, error } = await supabase
    .from('journal_entries')
    .select(`
      id, entry_date, description, created_at,
      journal_entry_lines (
        id, account_code, debit_amount, credit_amount, description
      )
    `)
    .eq('invoice_id', invoiceId)
    .eq('user_id', user.id)
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ entry: data });
}
