'use client';
import { useState, useEffect, useCallback } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell, ReferenceLine,
} from 'recharts';
import type { BenchmarkResponse, CategoryComp } from '@/app/api/benchmark/compare/route';
import { INDUSTRY_LABELS, SIZE_LABELS } from '@/lib/benchmark-seeds';

// ── Colour palette (matches AppShell) ────────────────────────────────────────
const C = {
  navy:    '#141414',
  navyL:   '#1E1E1E',
  navyM:   '#252525',
  navyB:   '#2E2E2E',
  white:   '#F5F5F5',
  gray:    '#9CA3AF',
  grayD:   '#6B7280',
  green:   '#22C55E',
  amber:   '#F59E0B',
  red:     '#E8445A',
  indigo:  '#818CF8',
  border:  '#2A2A2A',
};

const fmtNOK = (n: number) => n.toLocaleString('nb-NO', { maximumFractionDigits: 0 }) + ' kr';

// ── Skeleton ──────────────────────────────────────────────────────────────────
const Skel = ({ w = '100%', h = 18 }: { w?: string | number; h?: number }) => (
  <div style={{
    width: w, height: h, borderRadius: 6,
    background: `linear-gradient(90deg, ${C.navyM} 25%, ${C.navyB} 50%, ${C.navyM} 75%)`,
    backgroundSize: '200% 100%', animation: 'skeleton-shimmer 1.5s infinite',
  }} />
);

// ── Card ──────────────────────────────────────────────────────────────────────
const Card = ({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) => (
  <div style={{ background: C.navyL, border: `1px solid ${C.border}`, borderRadius: 14, padding: '20px 24px', ...style }}>
    {children}
  </div>
);

// ── Status badge ──────────────────────────────────────────────────────────────
const StatusDot = ({ status, higherLabel = 'Over snitt', lowerLabel = 'Under snitt' }: {
  status: 'above' | 'at' | 'below';
  higherLabel?: string;
  lowerLabel?: string;
}) => {
  const map = {
    above: { color: C.green,  bg: `${C.green}18`,  label: higherLabel },
    at:    { color: C.amber,  bg: `${C.amber}15`,  label: 'På snitt' },
    below: { color: C.red,    bg: `${C.red}18`,    label: lowerLabel  },
  };
  const { color, bg, label } = map[status];
  return (
    <span style={{ fontSize: 10, fontWeight: 700, padding: '3px 8px', borderRadius: 5, color, background: bg, letterSpacing: '0.06em' }}>
      {status === 'above' ? '▲ ' : status === 'below' ? '▼ ' : '● '}{label}
    </span>
  );
};

// ── Progress bar ──────────────────────────────────────────────────────────────
const PBar = ({ pct, color }: { pct: number; color: string }) => (
  <div style={{ height: 5, background: C.navyB, borderRadius: 3, overflow: 'hidden', marginTop: 6 }}>
    <div style={{ height: '100%', width: `${Math.min(Math.max(pct, 0), 100)}%`, background: color, borderRadius: 3, transition: 'width 0.6s ease' }} />
  </div>
);

// ── Deviation bar (show how far from benchmark) ───────────────────────────────
const DeviationBar = ({ deviation, max = 30 }: { deviation: number; max?: number }) => {
  const absD  = Math.min(Math.abs(deviation), max);
  const pct   = (absD / max) * 50; // 50% = max of one side
  const color = deviation > 2 ? C.red : deviation < -2 ? C.green : C.amber;
  return (
    <div style={{ height: 4, background: C.navyB, borderRadius: 2, position: 'relative', overflow: 'hidden', marginTop: 5 }}>
      {/* Center line */}
      <div style={{ position: 'absolute', left: '50%', top: 0, width: 1, height: '100%', background: C.grayD }} />
      {/* Deviation */}
      <div style={{
        position: 'absolute', top: 0, height: '100%', width: `${pct}%`,
        background: color,
        [deviation > 0 ? 'left' : 'right']: '50%',
        borderRadius: 2,
        transition: 'width 0.5s ease',
      }} />
    </div>
  );
};

// ── Category row ──────────────────────────────────────────────────────────────
const CatRow = ({ label, data, lowerIsBetter = true }: { label: string; data: CategoryComp; lowerIsBetter?: boolean }) => {
  const isAboveIndustry = data.your_pct > data.industry_pct;
  const color = lowerIsBetter
    ? (isAboveIndustry ? C.red : C.green)
    : (isAboveIndustry ? C.green : C.red);

  return (
    <div style={{ padding: '12px 0', borderBottom: `1px solid ${C.border}` }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 3 }}>
        <span style={{ fontSize: 13, color: C.white }}>{label}</span>
        <div style={{ textAlign: 'right' }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: C.white }}>{fmtNOK(data.yours)}</span>
          <span style={{ fontSize: 11, color: C.grayD, marginLeft: 6 }}>({data.your_pct}%)</span>
        </div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontSize: 11, color: C.grayD }}>Bransje: {data.industry_pct}% av inntekt</span>
        <span style={{ fontSize: 11, fontWeight: 700, color }}>
          {data.deviation_pp > 0 ? '+' : ''}{data.deviation_pp} pp
        </span>
      </div>
      <DeviationBar deviation={data.deviation_pp} />
    </div>
  );
};

// ── Setup form ────────────────────────────────────────────────────────────────
const ALL_INDUSTRIES = Object.entries(INDUSTRY_LABELS);
const ALL_SIZES = Object.entries(SIZE_LABELS);

const SetupForm = ({ initial, onSave }: {
  initial: { industry?: string; company_size?: string; share_anonymous_data?: boolean };
  onSave: () => void;
}) => {
  const [industry,  setIndustry]  = useState(initial.industry    ?? '');
  const [size,      setSize]      = useState(initial.company_size ?? '');
  const [shareData, setShareData] = useState(initial.share_anonymous_data ?? true);
  const [saving,    setSaving]    = useState(false);
  const [err,       setErr]       = useState('');

  const handleSave = async () => {
    if (!industry || !size) { setErr('Velg bransje og størrelse.'); return; }
    setSaving(true);
    const res = await fetch('/api/benchmark/profile', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ industry, company_size: size, share_anonymous_data: shareData }),
    });
    setSaving(false);
    if (res.ok) onSave();
    else setErr('Kunne ikke lagre. Prøv igjen.');
  };

  const btn = (val: string, cur: string, set: (v: string) => void, label: string) => (
    <button key={val} onClick={() => set(val)}
      style={{
        padding: '9px 14px', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer',
        border: `1px solid ${cur === val ? C.amber : C.border}`,
        background: cur === val ? `${C.amber}18` : 'transparent',
        color: cur === val ? C.amber : C.gray,
        transition: 'all 0.15s',
      }}>
      {label}
    </button>
  );

  return (
    <div style={{ minHeight: '60vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <Card style={{ maxWidth: 540, width: '100%' }}>
        <h2 style={{ fontSize: 20, fontWeight: 800, marginBottom: 6 }}>Sett opp bransje-profil</h2>
        <p style={{ fontSize: 13, color: C.grayD, marginBottom: 24 }}>
          For å sammenligne deg med bransjen trenger vi å vite hvilken sektor du er i.
        </p>

        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: C.grayD, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 8 }}>Bransje</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {ALL_INDUSTRIES.map(([val, label]) => btn(val, industry, setIndustry, label))}
          </div>
        </div>

        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: C.grayD, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 8 }}>Bedriftsstørrelse</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {ALL_SIZES.map(([val, label]) => btn(val, size, setSize, label))}
          </div>
        </div>

        <div style={{ marginBottom: 24, padding: '12px 14px', background: C.navyM, borderRadius: 10, display: 'flex', gap: 12, alignItems: 'flex-start' }}>
          <input type="checkbox" id="share" checked={shareData} onChange={e => setShareData(e.target.checked)}
            style={{ marginTop: 2, flexShrink: 0, accentColor: C.amber }} />
          <label htmlFor="share" style={{ fontSize: 12, color: C.grayD, lineHeight: 1.6, cursor: 'pointer' }}>
            <span style={{ display: 'block', fontWeight: 700, color: C.gray, marginBottom: 2 }}>Del anonyme data med bransjen</span>
            Dine tall aggregeres anonymt med andre bedrifter. Ingen kan se individuelle data.
            Dette gjør benchmark-tallene bedre for alle. Minimum 5 bedrifter per gruppe.
          </label>
        </div>

        {err && <p style={{ fontSize: 12, color: C.red, marginBottom: 12 }}>{err}</p>}

        <button onClick={handleSave} disabled={saving}
          style={{ width: '100%', padding: '12px', background: C.amber, border: 'none', borderRadius: 9, color: C.navy, fontSize: 14, fontWeight: 800, cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.7 : 1, transition: 'opacity 0.15s' }}>
          {saving ? 'Lagrer…' : 'Se min benchmarking →'}
        </button>
      </Card>
    </div>
  );
};

// ── Main page ─────────────────────────────────────────────────────────────────
export default function BenchmarkPage() {
  const [data,     setData]     = useState<BenchmarkResponse | null>(null);
  const [loading,  setLoading]  = useState(true);
  const [noProfile, setNoProfile] = useState(false);
  const [initProfile, setInitProfile] = useState<Record<string, unknown>>({});
  const [insights, setInsights] = useState('');
  const [insLoading, setInsLoading] = useState(false);
  const [insError, setInsError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch('/api/benchmark/compare');
    if (!res.ok) {
      // Check if it's a missing profile
      const body = await res.json() as { error?: string };
      if (res.status === 400) {
        // Load auto-derived profile for pre-fill
        const pRes = await fetch('/api/benchmark/profile');
        if (pRes.ok) setInitProfile(await pRes.json());
        setNoProfile(true);
      } else {
        console.error('Benchmark error:', body.error);
      }
    } else {
      setData(await res.json() as BenchmarkResponse);
      setNoProfile(false);
    }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const generateInsights = async () => {
    if (!data) return;
    setInsLoading(true);
    setInsError('');
    const res = await fetch('/api/benchmark/insights', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ comparison: data }),
    });
    if (res.ok) {
      const j = await res.json() as { insights?: string };
      setInsights(j.insights ?? '');
    } else {
      setInsError('Kunne ikke generere analyse. Prøv igjen.');
    }
    setInsLoading(false);
  };

  // ── Loading state ────────────────────────────────────────────────────────
  if (loading) return (
    <div style={{ minHeight: '100vh', background: C.navy, padding: '32px 24px' }}>
      <div style={{ maxWidth: 900, margin: '0 auto' }}>
        <Skel h={36} w={300} />
        <div style={{ height: 24 }} />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 16, marginBottom: 24 }}>
          {[1,2,3].map(i => <div key={i} style={{ background: C.navyL, border: `1px solid ${C.border}`, borderRadius: 14, padding: 24 }}><Skel h={80} /></div>)}
        </div>
        <Skel h={300} />
      </div>
    </div>
  );

  // ── Setup needed ─────────────────────────────────────────────────────────
  if (noProfile) return (
    <div style={{ minHeight: '100vh', background: C.navy, color: C.white }}>
      <div style={{ maxWidth: 900, margin: '0 auto' }}>
        <div style={{ padding: '24px 24px 0', display: 'flex', alignItems: 'center', gap: 12 }}>
          <a href="/app" style={{ color: C.grayD, fontSize: 13, textDecoration: 'none' }}>← Tilbake</a>
        </div>
        <SetupForm initial={initProfile as { industry?: string; company_size?: string }} onSave={load} />
      </div>
    </div>
  );

  if (!data) return null;

  // ── Chart data ────────────────────────────────────────────────────────────
  const barData = [
    { name: 'Varekostnad', yours: data.categories.cogs.your_pct,      industry: data.categories.cogs.industry_pct },
    { name: 'Lønnskostnad', yours: data.categories.payroll.your_pct,  industry: data.categories.payroll.industry_pct },
    { name: 'Drift',       yours: data.categories.operating.your_pct, industry: data.categories.operating.industry_pct },
  ];

  const marginColor = data.profit_margin.yours_pct > data.profit_margin.industry_pct ? C.green
    : data.profit_margin.yours_pct < data.profit_margin.industry_pct * 0.85 ? C.red
    : C.amber;

  return (
    <div style={{ minHeight: '100vh', background: C.navy, color: C.white, fontFamily: 'inherit' }}>
      <div style={{ maxWidth: 900, margin: '0 auto', padding: '24px 24px 80px' }}>

        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 28 }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
              <a href="/app" style={{ color: C.grayD, fontSize: 12, textDecoration: 'none' }}>← Tilbake</a>
              <span style={{ fontSize: 10, fontWeight: 700, padding: '3px 8px', borderRadius: 5, letterSpacing: '0.08em',
                background: data.data_source === 'community' ? `${C.green}18` : `${C.amber}18`,
                color: data.data_source === 'community' ? C.green : C.amber,
              }}>
                {data.data_source === 'community' ? `👥 ${data.peer_count} bedrifter` : '📊 Bransjestatistikk'}
              </span>
            </div>
            <h1 style={{ fontSize: 26, fontWeight: 800, lineHeight: 1.2 }}>Bransje-Benchmarking</h1>
            <p style={{ fontSize: 13, color: C.grayD, marginTop: 4 }}>
              {data.industry_label} · {data.size_label} · {data.period}
            </p>
          </div>
          <button onClick={() => setNoProfile(true)}
            style={{ padding: '7px 14px', background: 'transparent', border: `1px solid ${C.border}`, borderRadius: 8, color: C.grayD, fontSize: 11, cursor: 'pointer' }}>
            ⚙ Endre profil
          </button>
        </div>

        {/* KPI cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))', gap: 14, marginBottom: 24 }}>
          {/* Revenue */}
          <Card>
            <div style={{ fontSize: 11, color: C.grayD, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 8 }}>💰 Inntekter</div>
            <div style={{ fontSize: 24, fontWeight: 800 }}>{fmtNOK(data.revenue.yours)}</div>
            <div style={{ fontSize: 11, color: C.grayD, margin: '4px 0 10px' }}>Bransje: {fmtNOK(data.revenue.industry_avg)}</div>
            <PBar pct={data.revenue.percentile} color={C.green} />
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6, fontSize: 11, color: C.grayD }}>
              <span>{data.revenue.percentile}. persentil</span>
              <StatusDot status={data.revenue.status} />
            </div>
          </Card>

          {/* Profit margin */}
          <Card>
            <div style={{ fontSize: 11, color: C.grayD, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 8 }}>📈 Profittmargin</div>
            <div style={{ fontSize: 24, fontWeight: 800, color: marginColor }}>{data.profit_margin.yours_pct}%</div>
            <div style={{ fontSize: 11, color: C.grayD, margin: '4px 0 10px' }}>Bransje: {data.profit_margin.industry_pct}%</div>
            <PBar pct={Math.max(0, data.profit_margin.yours_pct)} color={marginColor} />
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6, fontSize: 11, color: C.grayD }}>
              <span>{data.profit_margin.deviation_pp > 0 ? '+' : ''}{data.profit_margin.deviation_pp} pp fra bransje</span>
              <StatusDot status={data.profit_margin.status} />
            </div>
          </Card>

          {/* Cost structure */}
          <Card>
            <div style={{ fontSize: 11, color: C.grayD, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 8 }}>💸 Kostnadsstruktur</div>
            <div style={{ fontSize: 24, fontWeight: 800 }}>
              {(data.categories.cogs.your_pct + data.categories.payroll.your_pct + data.categories.operating.your_pct).toFixed(1)}%
            </div>
            <div style={{ fontSize: 11, color: C.grayD, margin: '4px 0 10px' }}>
              Bransje: {(data.categories.cogs.industry_pct + data.categories.payroll.industry_pct + data.categories.operating.industry_pct).toFixed(1)}%
            </div>
            <div style={{ fontSize: 11, color: C.gray, marginTop: 4 }}>av inntekt brukt på utgifter</div>
          </Card>
        </div>

        {/* Chart */}
        <Card style={{ marginBottom: 24 }}>
          <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 4 }}>Utgiftsfordeling (% av inntekt)</h2>
          <p style={{ fontSize: 12, color: C.grayD, marginBottom: 20 }}>Deg vs bransjegjennomsnittet</p>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={barData} barGap={4}>
              <CartesianGrid strokeDasharray="3 3" stroke={C.navyB} />
              <XAxis dataKey="name" tick={{ fill: C.gray, fontSize: 12 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: C.gray, fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={(v: number) => `${v}%`} />
              <Tooltip
                contentStyle={{ background: C.navyM, border: `1px solid ${C.border}`, borderRadius: 8, fontSize: 12 }}
                formatter={(v: unknown) => [`${(v as number).toFixed(1)}%`]}
                labelStyle={{ color: C.white, fontWeight: 700 }}
              />
              <Bar dataKey="industry" name="Bransje" fill={C.navyB} radius={[4,4,0,0]}>
                {barData.map((_, i) => <Cell key={i} fill={C.navyB} />)}
              </Bar>
              <Bar dataKey="yours" name="Deg" radius={[4,4,0,0]}>
                {barData.map((entry, i) => (
                  <Cell key={i} fill={entry.yours > entry.industry ? C.red : C.green} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
          <div style={{ display: 'flex', gap: 16, justifyContent: 'center', marginTop: 8 }}>
            <span style={{ fontSize: 11, color: C.grayD, display: 'flex', alignItems: 'center', gap: 5 }}>
              <span style={{ width: 10, height: 10, borderRadius: 2, background: C.navyB, display: 'inline-block' }}/> Bransje
            </span>
            <span style={{ fontSize: 11, color: C.grayD, display: 'flex', alignItems: 'center', gap: 5 }}>
              <span style={{ width: 10, height: 10, borderRadius: 2, background: C.green, display: 'inline-block' }}/> Deg (under snitt)
            </span>
            <span style={{ fontSize: 11, color: C.grayD, display: 'flex', alignItems: 'center', gap: 5 }}>
              <span style={{ width: 10, height: 10, borderRadius: 2, background: C.red, display: 'inline-block' }}/> Deg (over snitt)
            </span>
          </div>
        </Card>

        {/* Specific expense breakdown */}
        <Card style={{ marginBottom: 24 }}>
          <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 4 }}>Detaljerte utgifter</h2>
          <p style={{ fontSize: 12, color: C.grayD, marginBottom: 8 }}>
            Avvik i prosentpoeng (pp) vs bransjegjennomsnitt. Grønt = under bransje (bra). Rødt = over bransje.
          </p>
          <CatRow label="Varekostnad"   data={data.categories.cogs} />
          <CatRow label="Lønnskostnad"  data={data.categories.payroll} />
          <CatRow label="Driftskostnad" data={data.categories.operating} />
          <div style={{ height: 12 }} />
          <div style={{ fontSize: 11, color: C.grayD, marginBottom: 8, paddingTop: 8, borderTop: `1px solid ${C.border}` }}>
            Fra fakturaer:
          </div>
          {(data.expenses.husleie.yours > 0 || data.expenses.husleie.industry_pct > 0) &&
            <CatRow label="Husleie"       data={data.expenses.husleie} />}
          {(data.expenses.it.yours > 0 || data.expenses.it.industry_pct > 0) &&
            <CatRow label="IT / Internett" data={data.expenses.it} />}
          {(data.expenses.marketing.yours > 0 || data.expenses.marketing.industry_pct > 0) &&
            <CatRow label="Markedsføring" data={data.expenses.marketing} />}
          {(data.expenses.transport.yours > 0 || data.expenses.transport.industry_pct > 0) &&
            <CatRow label="Transport"     data={data.expenses.transport} />}
          {(data.expenses.forsikring.yours > 0 || data.expenses.forsikring.industry_pct > 0) &&
            <CatRow label="Forsikring"    data={data.expenses.forsikring} />}
        </Card>

        {/* AI Insights */}
        <Card style={{ border: `1px solid ${C.indigo}30`, background: `${C.indigo}06` }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
            <div>
              <h2 style={{ fontSize: 16, fontWeight: 700 }}>🤖 AI-Analyse</h2>
              <p style={{ fontSize: 12, color: C.grayD, marginTop: 2 }}>Handlingsrettede innsikter basert på dine tall</p>
            </div>
            <button onClick={generateInsights} disabled={insLoading}
              style={{ padding: '9px 18px', background: C.indigo, border: 'none', borderRadius: 8, color: '#fff', fontSize: 12, fontWeight: 700, cursor: insLoading ? 'not-allowed' : 'pointer', opacity: insLoading ? 0.7 : 1, display: 'inline-flex', alignItems: 'center', gap: 6, transition: 'opacity 0.15s' }}>
              {insLoading && <span style={{ width: 10, height: 10, borderRadius: '50%', border: '2px solid #fff', borderTopColor: 'transparent', animation: 'spin 0.7s linear infinite', display: 'inline-block' }} />}
              {insLoading ? 'Analyserer…' : insights ? '↺ Oppdater' : '✦ Generer innsikt'}
            </button>
          </div>

          {insError && <p style={{ fontSize: 12, color: C.red, marginBottom: 10 }}>{insError}</p>}

          {insLoading ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {[100, 85, 90, 70, 80].map((w, i) => <Skel key={i} w={`${w}%`} h={14} />)}
            </div>
          ) : insights ? (
            <div style={{ fontSize: 13, color: C.gray, lineHeight: 1.8, whiteSpace: 'pre-wrap' }}>
              {insights
                .replace(/\*\*(.+?)\*\*/g, '##BOLD##$1##/BOLD##')
                .split('\n')
                .map((line, i) => {
                  const isBold = line.includes('##BOLD##');
                  const text   = line.replace(/##BOLD##(.+?)##\/BOLD##/g, '$1');
                  return (
                    <span key={i} style={{ display: 'block', ...(isBold ? { fontWeight: 700, color: C.white, marginTop: 14, marginBottom: 2 } : {}) }}>
                      {text}
                    </span>
                  );
                })}
            </div>
          ) : (
            <p style={{ fontSize: 13, color: C.grayD }}>
              Klikk «Generer innsikt» for AI-drevne anbefalinger basert på dine bransjettall.
            </p>
          )}
        </Card>

        {/* Data source note */}
        <p style={{ fontSize: 11, color: C.grayD, textAlign: 'center', marginTop: 20 }}>
          {data.data_source === 'community'
            ? `Benchmark basert på ${data.peer_count} bedrifter i din bransje/størrelse (anonymisert).`
            : 'Benchmark basert på norsk bransjestatistikk (SSB/Virke). Tallene forbedres når flere brukere i din bransje registrerer seg.'}
        </p>
      </div>
    </div>
  );
}
