import { NextResponse }  from 'next/server';
import { createClient }  from '@/lib/supabase-server';
import {
  BEDRIFTSTYPE_TO_INDUSTRY,
  ANSATTE_TO_SIZE,
  INDUSTRY_LABELS,
} from '@/lib/benchmark-seeds';

const VALID_INDUSTRIES = Object.keys(INDUSTRY_LABELS);
const VALID_SIZES      = ['solo', 'micro', 'small', 'medium'];

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Ikke autentisert' }, { status: 401 });

  // Try existing benchmark profile
  const { data: bp } = await supabase
    .from('user_benchmark_profile')
    .select('industry, company_size, share_anonymous_data')
    .eq('user_id', user.id)
    .maybeSingle();

  if (bp) return NextResponse.json(bp);

  // Auto-derive from profiler
  const { data: profil } = await supabase
    .from('profiler')
    .select('bedriftstype, antall_ansatte')
    .eq('id', user.id)
    .maybeSingle();

  const derived = profil ? {
    industry:    BEDRIFTSTYPE_TO_INDUSTRY[profil.bedriftstype as string] ?? 'other',
    company_size: ANSATTE_TO_SIZE[profil.antall_ansatte as string] ?? 'solo',
    share_anonymous_data: true,
    auto_derived: true,
  } : null;

  return NextResponse.json(derived ?? {});
}

export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Ikke autentisert' }, { status: 401 });

  let body: { industry?: string; company_size?: string; share_anonymous_data?: boolean };
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'Ugyldig JSON' }, { status: 400 }); }

  const { industry, company_size, share_anonymous_data = true } = body;

  if (!industry || !VALID_INDUSTRIES.includes(industry)) {
    return NextResponse.json({ error: `Ugyldig bransje: ${industry}` }, { status: 400 });
  }
  if (!company_size || !VALID_SIZES.includes(company_size)) {
    return NextResponse.json({ error: `Ugyldig størrelse: ${company_size}` }, { status: 400 });
  }

  const { error } = await supabase.from('user_benchmark_profile').upsert({
    user_id: user.id,
    industry,
    company_size,
    share_anonymous_data,
    updated_at: new Date().toISOString(),
  }, { onConflict: 'user_id' });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
