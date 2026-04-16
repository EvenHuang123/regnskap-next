import { NextResponse }  from 'next/server';
import { createClient }  from '@/lib/supabase-server';
import {
  SEED_BENCHMARKS,
  BEDRIFTSTYPE_TO_INDUSTRY,
  ANSATTE_TO_SIZE,
  INDUSTRY_LABELS,
  SIZE_LABELS,
  type BenchmarkRatios,
} from '@/lib/benchmark-seeds';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface CategoryComp {
  yours:               number;
  industry_avg:        number;
  your_pct:            number;   // % of revenue
  industry_pct:        number;   // % of revenue
  deviation_pp:        number;   // percentage-point difference
  status:              'above' | 'at' | 'below';
}

export interface BenchmarkResponse {
  data_source:    'community' | 'industry_average';
  peer_count:     number;
  industry:       string;
  industry_label: string;
  size:           string;
  size_label:     string;
  period:         string;

  revenue: {
    yours:           number;
    industry_avg:    number;
    industry_median: number;
    percentile:      number;
    status:          'above' | 'at' | 'below';
  };

  profit_margin: {
    yours_pct:    number;
    industry_pct: number;
    deviation_pp: number;
    status:       'above' | 'at' | 'below';
  };

  categories: {
    cogs:      CategoryComp;
    payroll:   CategoryComp;
    operating: CategoryComp;
  };

  expenses: {
    husleie:     CategoryComp;
    it:          CategoryComp;
    marketing:   CategoryComp;
    transport:   CategoryComp;
    forsikring:  CategoryComp;
  };
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const status = (yours: number, benchmark: number, higherIsBetter = true): 'above' | 'at' | 'below' => {
  const ratio = benchmark > 0 ? yours / benchmark : 1;
  if (ratio > 1.15) return higherIsBetter ? 'above' : 'below';
  if (ratio < 0.85) return higherIsBetter ? 'below' : 'above';
  return 'at';
};

const toPercentile = (yours: number, p25: number, p50: number, p75: number, p90: number): number => {
  if (yours >= p90) return 90;
  if (yours >= p75) return 75;
  if (yours >= p50) return 50;
  if (yours >= p25) return 25;
  return 10;
};

const makeCategoryComp = (
  yours: number,
  revenue: number,
  industryAvg: number,
  industryRevAvg: number,
  benchRatio: number,
  higherIsBetter = false,
): CategoryComp => {
  const yourPct    = revenue > 0 ? (yours / revenue) * 100 : 0;
  const industPct  = benchRatio * 100;
  const iAvg       = industryRevAvg > 0 ? industryAvg : benchRatio * (revenue || 1);
  return {
    yours,
    industry_avg:  Math.round(iAvg),
    your_pct:      Math.round(yourPct * 10) / 10,
    industry_pct:  Math.round(industPct * 10) / 10,
    deviation_pp:  Math.round((yourPct - industPct) * 10) / 10,
    status:        status(yourPct, industPct, higherIsBetter),
  };
};

// ── Route ─────────────────────────────────────────────────────────────────────

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Ikke autentisert' }, { status: 401 });

  // ── 1. Resolve benchmark profile ──────────────────────────────────────────
  const { data: bp } = await supabase
    .from('user_benchmark_profile')
    .select('industry, company_size')
    .eq('user_id', user.id)
    .maybeSingle();

  let industry    = bp?.industry    ?? '';
  let companySize = bp?.company_size ?? '';

  if (!industry || !companySize) {
    // Auto-derive from profiler
    const { data: profil } = await supabase
      .from('profiler')
      .select('bedriftstype, antall_ansatte')
      .eq('id', user.id)
      .maybeSingle();

    if (!profil) {
      return NextResponse.json({ error: 'Fullfør firmaprofilen din først.' }, { status: 400 });
    }
    industry    = BEDRIFTSTYPE_TO_INDUSTRY[profil.bedriftstype as string] ?? 'other';
    companySize = ANSATTE_TO_SIZE[profil.antall_ansatte as string] ?? 'solo';
  }

  // ── 2. User metrics from maaneder (last 12 months) ────────────────────────
  const twelveMonthsAgo = new Date();
  twelveMonthsAgo.setFullYear(twelveMonthsAgo.getFullYear() - 1);
  const cutoffMonth = twelveMonthsAgo.toISOString().slice(0, 7); // YYYY-MM

  const { data: maaneder } = await supabase
    .from('maaneder')
    .select('inntekter, varekostnader, lonnskostnader, andre_kostnader')
    .eq('user_id', user.id)
    .gte('month', cutoffMonth);

  const revenue  = (maaneder ?? []).reduce((s, r) => s + (Number(r.inntekter)       || 0), 0);
  const cogs     = (maaneder ?? []).reduce((s, r) => s + (Number(r.varekostnader)   || 0), 0);
  const payroll  = (maaneder ?? []).reduce((s, r) => s + (Number(r.lonnskostnader)  || 0), 0);
  const opex     = (maaneder ?? []).reduce((s, r) => s + (Number(r.andre_kostnader) || 0), 0);
  const totalExp = cogs + payroll + opex;
  const margin   = revenue > 0 ? ((revenue - totalExp) / revenue) * 100 : 0;

  // Specific from fakturaer
  const { data: fakt } = await supabase
    .from('fakturaer')
    .select('belop, kategori')
    .eq('user_id', user.id)
    .gte('dato', twelveMonthsAgo.toISOString().slice(0, 10));

  const sumKat = (kat: string | string[]) =>
    (fakt ?? []).filter(f => Array.isArray(kat) ? kat.includes(f.kategori) : f.kategori === kat)
      .reduce((s, f) => s + (Number(f.belop) || 0), 0);

  const husleie    = sumKat('Husleie');
  const itCosts    = sumKat(['Internett', 'Telefon', 'Utstyr']);
  const marketing  = sumKat('Markedsføring');
  const transport  = sumKat('Transport');
  const forsikring = sumKat('Forsikring');

  // ── 3. Try community benchmark, fall back to seeds ────────────────────────
  let dataSource: 'community' | 'industry_average' = 'industry_average';
  let peerCount = 0;

  // Community data fields (optional)
  let avgRevenue = 0, medianRevenue = 0, p25Revenue = 0, p75Revenue = 0, p90Revenue = 0;
  let avgCogs = 0, avgPayroll = 0, avgOpex = 0, avgHusleie = 0, avgIt = 0, avgMarketing = 0, avgTransport = 0, avgForsikring = 0;

  const { data: community } = await supabase
    .from('benchmark_aggregates')
    .select('*')
    .eq('industry', industry)
    .eq('company_size', companySize)
    .maybeSingle();

  const seed: BenchmarkRatios = SEED_BENCHMARKS[industry] ?? SEED_BENCHMARKS.other;

  if (community && Number(community.peer_count) >= 5) {
    dataSource   = 'community';
    peerCount    = Number(community.peer_count);
    avgRevenue   = Number(community.avg_revenue);
    medianRevenue = Number(community.median_revenue);
    p25Revenue   = Number(community.p25_revenue);
    p75Revenue   = Number(community.p75_revenue);
    p90Revenue   = Number(community.p90_revenue);
    avgCogs      = Number(community.avg_cogs);
    avgPayroll   = Number(community.avg_payroll);
    avgOpex      = Number(community.avg_opex);
    avgHusleie   = Number(community.avg_husleie);
    avgIt        = Number(community.avg_it);
    avgMarketing = Number(community.avg_marketing);
    avgTransport = Number(community.avg_transport);
    avgForsikring = Number(community.avg_forsikring);
  } else {
    // Fall back to seed ratios; approximate absolute from user's own revenue
    const ref = revenue > 0 ? revenue : 1_000_000; // placeholder for ratio display
    avgCogs      = seed.avg_cogs_ratio      * ref;
    avgPayroll   = seed.avg_payroll_ratio   * ref;
    avgOpex      = seed.avg_opex_ratio      * ref;
    avgHusleie   = seed.avg_husleie_ratio   * ref;
    avgIt        = seed.avg_it_ratio        * ref;
    avgMarketing = seed.avg_marketing_ratio * ref;
    avgTransport = seed.avg_transport_ratio * ref;
    avgForsikring = seed.avg_forsikring_ratio * ref;
    avgRevenue   = ref;
    medianRevenue = ref;
    p25Revenue   = ref * 0.5;
    p75Revenue   = ref * 1.5;
    p90Revenue   = ref * 2;
  }

  // ── 4. Percentile (community only; seed shows neutral 50th) ──────────────
  const revPercentile = dataSource === 'community'
    ? toPercentile(revenue, p25Revenue, medianRevenue, p75Revenue, p90Revenue)
    : 50;

  // ── 5. Build response ─────────────────────────────────────────────────────
  const seedMargin    = seed.avg_profit_margin * 100;
  const industryMargin = dataSource === 'community'
    ? (community ? Number(community.avg_profit_margin) * 100 : seedMargin)
    : seedMargin;

  const result: BenchmarkResponse = {
    data_source:    dataSource,
    peer_count:     peerCount,
    industry,
    industry_label: INDUSTRY_LABELS[industry] ?? industry,
    size:           companySize,
    size_label:     SIZE_LABELS[companySize] ?? companySize,
    period:         'Siste 12 måneder',

    revenue: {
      yours:           Math.round(revenue),
      industry_avg:    Math.round(avgRevenue),
      industry_median: Math.round(medianRevenue),
      percentile:      revPercentile,
      status:          status(revenue, avgRevenue, true),
    },

    profit_margin: {
      yours_pct:    Math.round(margin * 10) / 10,
      industry_pct: Math.round(industryMargin * 10) / 10,
      deviation_pp: Math.round((margin - industryMargin) * 10) / 10,
      status:       status(margin, industryMargin, true),
    },

    categories: {
      cogs:      makeCategoryComp(cogs,    revenue, avgCogs,    avgRevenue, seed.avg_cogs_ratio),
      payroll:   makeCategoryComp(payroll, revenue, avgPayroll, avgRevenue, seed.avg_payroll_ratio),
      operating: makeCategoryComp(opex,    revenue, avgOpex,    avgRevenue, seed.avg_opex_ratio),
    },

    expenses: {
      husleie:    makeCategoryComp(husleie,    revenue, avgHusleie,    avgRevenue, seed.avg_husleie_ratio),
      it:         makeCategoryComp(itCosts,    revenue, avgIt,         avgRevenue, seed.avg_it_ratio),
      marketing:  makeCategoryComp(marketing,  revenue, avgMarketing,  avgRevenue, seed.avg_marketing_ratio),
      transport:  makeCategoryComp(transport,  revenue, avgTransport,  avgRevenue, seed.avg_transport_ratio),
      forsikring: makeCategoryComp(forsikring, revenue, avgForsikring, avgRevenue, seed.avg_forsikring_ratio),
    },
  };

  return NextResponse.json(result);
}
