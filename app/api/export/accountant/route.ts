import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase-server';
import { generateXLSX, generateCSV, type ExportOptions } from '@/lib/excel';
import type { ExportFaktura } from '@/lib/accounting';

interface RequestBody {
  period:  string;   // 'YYYY-MM' | 'custom'
  from?:   string;   // YYYY-MM-DD (when period === 'custom')
  to?:     string;   // YYYY-MM-DD (when period === 'custom')
  format:  'xlsx' | 'csv';
  options: ExportOptions;
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

  const { period, from, to, format, options } = body;

  // ── Build date range ──────────────────────────────────────────────────────
  let startDate: string;
  let endDate:   string;

  if (period === 'custom' && from && to) {
    startDate = from;
    endDate   = to;
  } else if (/^\d{4}-\d{2}$/.test(period)) {
    const [y, mo] = period.split('-').map(Number);
    startDate = `${period}-01`;
    const nextYear  = mo === 12 ? y + 1 : y;
    const nextMonth = mo === 12 ? 1     : mo + 1;
    endDate = `${nextYear}-${String(nextMonth).padStart(2, '0')}-01`;
  } else {
    return NextResponse.json({ error: 'Ugyldig periode' }, { status: 400 });
  }

  // ── Fetch fakturaer ───────────────────────────────────────────────────────
  let query = supabase
    .from('fakturaer')
    .select('id,leverandor,belop,dato,mva,kategori,status,betalt_dato')
    .eq('user_id', user.id)
    .gte('dato', startDate)
    .lt('dato', endDate)
    .order('dato', { ascending: true });

  // Status filter
  if (options.filterBetalt && !options.filterUbetalt) {
    query = query.eq('status', 'betalt');
  } else if (!options.filterBetalt && options.filterUbetalt) {
    query = query.neq('status', 'betalt');
  }

  const { data: rows, error } = await query;
  if (error) {
    console.error('export fetch error:', error);
    return NextResponse.json({ error: 'Klarte ikke hente fakturaer' }, { status: 500 });
  }

  const fakturaer: ExportFaktura[] = (rows ?? []).map(r => ({
    id:          String(r.id),
    leverandor:  String(r.leverandor ?? ''),
    belop:       Number(r.belop)      || 0,
    dato:        String(r.dato        ?? ''),
    mva:         Number(r.mva)        || 0,
    kategori:    String(r.kategori    ?? 'Annet'),
    status:      String(r.status      ?? 'ubetalt'),
    betalt_dato: r.betalt_dato ? String(r.betalt_dato) : null,
  }));

  if (fakturaer.length === 0) {
    return NextResponse.json({ error: 'Ingen fakturaer funnet for valgt periode' }, { status: 404 });
  }

  // ── Generate file ─────────────────────────────────────────────────────────
  const slug = period === 'custom' ? `${from}_${to}` : period;

  if (format === 'xlsx') {
    const buffer      = generateXLSX(fakturaer, options, period === 'custom' ? `${from} – ${to}` : period);
    const filename    = `regnskap_${slug}.xlsx`;
    const contentType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

    return new Response(new Uint8Array(buffer), {
      headers: {
        'Content-Type':        contentType,
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });
  }

  // CSV
  const csv      = generateCSV(fakturaer, options);
  const filename = `regnskap_${slug}.csv`;

  return new Response(csv, {
    headers: {
      'Content-Type':        'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  });
}
