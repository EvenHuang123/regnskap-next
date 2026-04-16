import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase-server';

export async function POST() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Ikke autentisert' }, { status: 401 });

  await supabase.from('user_tutorial_progress').upsert({
    user_id:      user.id,
    current_step: 0,
    completed:    false,
    skipped:      false,
    completed_at: null,
    updated_at:   new Date().toISOString(),
  }, { onConflict: 'user_id' });

  return NextResponse.json({ ok: true });
}
