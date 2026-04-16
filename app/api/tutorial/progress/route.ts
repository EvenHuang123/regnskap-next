import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase-server';

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Ikke autentisert' }, { status: 401 });

  const { data } = await supabase
    .from('user_tutorial_progress')
    .select('current_step, completed, skipped')
    .eq('user_id', user.id)
    .maybeSingle();

  return NextResponse.json(data ?? { current_step: 0, completed: false, skipped: false });
}

export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Ikke autentisert' }, { status: 401 });

  const body = await req.json() as { step?: number; completed?: boolean };
  const { step = 0, completed = false } = body;

  await supabase.from('user_tutorial_progress').upsert({
    user_id:      user.id,
    current_step: step,
    completed,
    skipped:      false,
    completed_at: completed ? new Date().toISOString() : null,
    updated_at:   new Date().toISOString(),
  }, { onConflict: 'user_id' });

  return NextResponse.json({ ok: true });
}
