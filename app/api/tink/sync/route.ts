import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase-server';
import { fetchTransactions, matchTransactions, type Faktura } from '@/lib/tink';

export async function POST() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Ikke autentisert' }, { status: 401 });

  // 1. Get access token
  const { data: conn } = await supabase
    .from('user_bank_connections')
    .select('tink_access_token')
    .eq('user_id', user.id)
    .eq('is_active', true)
    .single();

  if (!conn) {
    return NextResponse.json({ error: 'Ingen aktiv bankforbindelse' }, { status: 404 });
  }

  // 2. Fetch bank transactions (last 30 days)
  let transactions;
  try {
    transactions = await fetchTransactions(conn.tink_access_token, 30);
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Tink API-feil';
    return NextResponse.json({ error: msg }, { status: 502 });
  }

  // 3. Get unpaid fakturaer
  const { data: rows } = await supabase
    .from('fakturaer')
    .select('id, leverandor, belop, mva, dato')
    .eq('user_id', user.id)
    .eq('status', 'ubetalt');

  const fakturaer: Faktura[] = (rows ?? []).map(r => ({
    id:        r.id as string,
    leverandor: r.leverandor as string,
    belop:     Number(r.belop) || 0,
    mva:       Number(r.mva)  || 0,
    dato:      r.dato as string,
  }));

  // 4. Match
  const matches = matchTransactions(fakturaer, transactions);

  // 5. Mark matched fakturaer as paid
  let matchedCount = 0;
  for (const m of matches) {
    const { error } = await supabase
      .from('fakturaer')
      .update({
        status:     'betalt',
        betalt_dato: m.transactionDate,
        updated_at: new Date().toISOString(),
      })
      .eq('id', m.fakturaId)
      .eq('user_id', user.id);   // double-check ownership

    if (!error) matchedCount++;
  }

  // 6. Update last_synced timestamp
  await supabase
    .from('user_bank_connections')
    .update({ last_synced: new Date().toISOString() })
    .eq('user_id', user.id);

  return NextResponse.json({
    matched: matchedCount,
    total:   fakturaer.length,
    checked: transactions.length,
  });
}
