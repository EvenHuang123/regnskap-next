import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase-server';
import { matchTransactions, type Faktura, type TinkTransaction } from '@/lib/tink';
import type { CsvTransaction } from '@/lib/csv-parser';

interface UploadBody {
  transactions: CsvTransaction[];
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Ikke autentisert' }, { status: 401 });

  let body: UploadBody;
  try {
    body = await request.json() as UploadBody;
  } catch {
    return NextResponse.json({ error: 'Ugyldig JSON' }, { status: 400 });
  }

  const { transactions } = body;
  if (!Array.isArray(transactions) || transactions.length === 0) {
    return NextResponse.json({ error: 'Ingen transaksjoner i forespørselen' }, { status: 400 });
  }

  // 1. Store CSV transactions in bank_transactions
  const rows = transactions.map(tx => ({
    user_id:     user.id,
    date:        tx.date,
    amount:      tx.amount,
    description: tx.description,
    source:      'csv' as const,
  }));

  const { data: inserted, error: insertError } = await supabase
    .from('bank_transactions')
    .insert(rows)
    .select('id, date, amount, description');

  if (insertError) {
    console.error('bank_transactions insert error:', insertError);
    return NextResponse.json({ error: 'Kunne ikke lagre transaksjoner' }, { status: 500 });
  }

  // 2. Load unpaid fakturaer
  const { data: fakturaRows } = await supabase
    .from('fakturaer')
    .select('id, leverandor, belop, mva, dato')
    .eq('user_id', user.id)
    .eq('status', 'ubetalt');

  const fakturaer: Faktura[] = (fakturaRows ?? []).map(r => ({
    id:        r.id as string,
    leverandor: r.leverandor as string,
    belop:     Number(r.belop) || 0,
    mva:       Number(r.mva)  || 0,
    dato:      r.dato as string,
  }));

  // 3. Map stored rows to TinkTransaction shape for matchTransactions()
  const storedTx: TinkTransaction[] = (inserted ?? []).map(row => ({
    id:          String(row.id),
    date:        String(row.date),
    amount:      Number(row.amount),
    description: String(row.description),
    merchant:    '',
  }));

  const matches = matchTransactions(fakturaer, storedTx);

  // 4. Apply matches: update fakturaer + bank_transactions
  let matchedCount = 0;
  const matchedFakturaIds: string[] = [];

  for (const m of matches) {
    const [fRes, txRes] = await Promise.all([
      supabase
        .from('fakturaer')
        .update({ status: 'betalt', betalt_dato: m.transactionDate, updated_at: new Date().toISOString() })
        .eq('id', m.fakturaId)
        .eq('user_id', user.id),
      supabase
        .from('bank_transactions')
        .update({ matched_faktura_id: m.fakturaId })
        .eq('id', m.transactionId)
        .eq('user_id', user.id),
    ]);

    if (!fRes.error && !txRes.error) {
      matchedCount++;
      matchedFakturaIds.push(m.fakturaId);
    }
  }

  return NextResponse.json({
    stored:          (inserted ?? []).length,
    matched:         matchedCount,
    total_fakturaer: fakturaer.length,
    matched_ids:     matchedFakturaIds,
  });
}
