import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase-server';
import AppShell from '@/components/AppShell';
import { getCurrentMonth } from '@/lib/calculations';

export default async function AppPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const [
    { data: profil },
    { data: maaneder },
    { data: faste },
    { data: ansatte },
  ] = await Promise.all([
    supabase.from('profiler').select('*').eq('id', user.id).single(),
    supabase.from('maaneder').select('*').eq('user_id', user.id).order('month'),
    supabase.from('faste_kostnader').select('*').eq('user_id', user.id).single(),
    supabase.from('ansatte').select('*').eq('user_id', user.id),
  ]);

  return (
    <AppShell
      user={user}
      currentMonth={getCurrentMonth()}
      initialProfil={profil || null}
      initialMaaneder={maaneder || []}
      initialFaste={faste || null}
      initialAnsatte={ansatte || []}
    />
  );
}
