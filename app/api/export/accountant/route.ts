import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase-server';
import { generateXLSX, generateCSV, type ExportOptions } from '@/lib/excel';
import type { ExportFaktura } from '@/lib/accounting';

interface RequestBody {
  period:       string;   // 'YYYY-MM' | 'custom'
  from?:        string;   // YYYY-MM-DD (when period === 'custom')
  to?:          string;   // YYYY-MM-DD (when period === 'custom')
  format:       'xlsx' | 'csv';
  options:      ExportOptions;
  bedriftsnavn: string;
}

function buildRange(period: string, from?: string, to?: string) {
  if (period === 'custom' && from && to) {
    return { startDate: from, endDate: to };
  }
  if (/^\d{4}-\d{2}$/.test(period)) {
    const [y, mo] = period.split('-').map(Number);
    const startDate  = `${period}-01`;
    const nextYear   = mo === 12 ? y + 1 : y;
    const nextMonth  = mo === 12 ? 1     : mo + 1;
    const endDate    = `${nextYear}-${String(nextMonth).padStart(2, '0')}-01`;
    return { startDate, endDate };
  }
  return null;
}

function prevMonthRange(period: string) {
  if (!/^\d{4}-\d{2}$/.test(period)) return null;
  const [y, mo] = period.split('-').map(Number);
  const prevY  = mo === 1 ? y - 1 : y;
  const prevM  = mo === 1 ? 12    : mo - 1;
  const ym     = `${prevY}-${String(prevM).padStart(2, '0')}`;
  return buildRange(ym);
}

async function fetchFakturaer(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId:    string,
  startDate: string,
  endDate:   string,
  options:   ExportOptions,
): Promise<ExportFaktura[]> {
  let query = supabase
    .from('fakturaer')
    .select('id,leverandor,belop,dato,mva,kategori,status,betalt_dato')
    .eq('user_id', userId)
    .gte('dato', startDate)
    .lt('dato', endDate)
    .order('dato', { ascending: true });

  if (options.filterBetalt && !options.filterUbetalt) {
    query = query.eq('status', 'betalt');
  } else if (!options.filterBetalt && options.filterUbetalt) {
    query = query.neq('status', 'betalt');
  }

  const { data, error } = await query;
  if (error) throw error;

  return (data ?? []).map(r => ({
    id:          String(r.id),
    leverandor:  String(r.leverandor ?? ''),
    belop:       Number(r.belop)      || 0,
    dato:        String(r.dato        ?? ''),
    mva:         Number(r.mva)        || 0,
    kategori:    String(r.kategori    ?? 'Annet'),
    status:      String(r.status      ?? 'ubetalt'),
    betalt_dato: r.betalt_dato ? String(r.betalt_dato) : null,
  }));
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

  const { period, from, to, format, options, bedriftsnavn } = body;

  const range = buildRange(period, from, to);
  if (!range) return NextResponse.json({ error: 'Ugyldig periode' }, { status: 400 });

  // Fetch current + previous period in parallel
  const prevRange = prevMonthRange(period);

  let fakturaer:     ExportFaktura[];
  let prevFakturaer: ExportFaktura[];

  try {
    [fakturaer, prevFakturaer] = await Promise.all([
      fetchFakturaer(supabase, user.id, range.startDate, range.endDate, options),
      prevRange
        ? fetchFakturaer(supabase, user.id, prevRange.startDate, prevRange.endDate, options)
        : Promise.resolve([]),
    ]);
  } catch (e) {
    console.error('export fetch error:', e);
    return NextResponse.json({ error: 'Klarte ikke hente fakturaer' }, { status: 500 });
  }

  if (fakturaer.length === 0) {
    return NextResponse.json({ error: 'Ingen fakturaer funnet for valgt periode' }, { status: 404 });
  }

  const slug        = period === 'custom' ? `${from}_${to}` : period;
  const periodLabel = period === 'custom' ? `${from} – ${to}` : period;

  if (format === 'xlsx') {
    const buffer = await generateXLSX(
      fakturaer, prevFakturaer, options, periodLabel,
      bedriftsnavn || 'Bedrift',
    );
    return new Response(new Uint8Array(buffer), {
      headers: {
        'Content-Type':        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="regnskap_${slug}.xlsx"`,
      },
    });
  }

  const csv = generateCSV(fakturaer, options);
  return new Response(csv, {
    headers: {
      'Content-Type':        'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="regnskap_${slug}.csv"`,
    },
  });
}
