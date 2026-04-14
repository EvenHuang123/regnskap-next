import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase-server';

export async function DELETE() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Ikke autentisert' }, { status: 401 });

  const { error } = await supabase
    .from('user_bank_connections')
    .delete()
    .eq('user_id', user.id);

  if (error) {
    console.error('Tink disconnect error:', error);
    return NextResponse.json({ error: 'Kunne ikke koble fra banken' }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
