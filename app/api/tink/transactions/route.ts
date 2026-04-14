import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase-server';
import { fetchTransactions } from '@/lib/tink';

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Ikke autentisert' }, { status: 401 });

  const { data: conn } = await supabase
    .from('user_bank_connections')
    .select('tink_access_token')
    .eq('user_id', user.id)
    .eq('is_active', true)
    .single();

  if (!conn) {
    return NextResponse.json({ error: 'Ingen aktiv bankforbindelse' }, { status: 404 });
  }

  try {
    const transactions = await fetchTransactions(conn.tink_access_token, 30);
    return NextResponse.json({ transactions });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Ukjent feil';
    console.error('Tink transactions error:', msg);
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}
