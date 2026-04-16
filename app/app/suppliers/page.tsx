'use client';
import { useState, useEffect, useCallback } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell,
} from 'recharts';
import type { AnalyticsResponse, SupplierStat, Period } from '@/app/api/suppliers/analytics/route';

// ── Colour palette (matches AppShell) ────────────────────────────────────────
const C = {
  navy:    '#141414',
  navyL:   '#1E1E1E',
  navyM:   '#252525',
  navyB:   '#2E2E2E',
  navyHL:  '#383838',
  white:   '#F5F5F5',
  gray:    '#9CA3AF',
  grayD:   '#6B7280',
  green:   '#22C55E',
  amber:   '#F59E0B',
  red:     '#E8445A',
  border:  '#2A2A2A',
  indigo:  '#818CF8',
};

const PERIOD_LABELS: Record<Period, string> = {
  '3months': 'Siste 3 mnd',
  '6months': 'Siste 6 mnd',
  '1year':   'Siste 12 mnd',
  'all':     'Alle tider',
};

const BAR_COLORS = [C.green, C.amber, C.indigo, '#34D399', '#FB923C', '#A78BFA', '#60A5FA', '#F472B6', '#4ADE80', '#FACC15'];

const fmtNOK = (n: number) => n.toLocaleString('nb-NO', { minimumFractionDigits: 0, maximumFractionDigits: 0 }) + ' kr';
const fmtNOKd = (n: number) => n.toLocaleString('nb-NO', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' kr';

// ── Spinner ───────────────────────────────────────────────────────────────────
const Spinner = () => (
  <span style={{ width: 14, height: 14, border: '2px solid currentColor', borderTopColor: 'transparent', borderRadius: '50%', display: 'inline-block', animation: 'spin 0.7s linear infinite' }}/>
);

// ── Section card ──────────────────────────────────────────────────────────────
const Card = ({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) => (
  <div style={{ background: C.navyL, border: `1px solid ${C.border}`, borderRadius: 14, padding: '20px 24px', ...style }}>
    {children}
  </div>
);

// ── Period picker ─────────────────────────────────────────────────────────────
const PeriodPicker = ({ value, onChange }: { value: Period; onChange: (p: Period) => void }) => (
  <div style={{ display: 'flex', gap: 6 }}>
    {(Object.keys(PERIOD_LABELS) as Period[]).map(p => (
      <button key={p} onClick={() => onChange(p)}
        style={{
          padding: '6px 13px', borderRadius: 7, fontSize: 12, fontWeight: 600, cursor: 'pointer', transition: 'all 0.15s',
          background: value === p ? C.amber : 'transparent',
          border: `1px solid ${value === p ? C.amber : C.border}`,
          color: value === p ? C.navy : C.gray,
        }}>
        {PERIOD_LABELS[p]}
      </button>
    ))}
  </div>
);

// ── Rank badge ────────────────────────────────────────────────────────────────
const Rank = ({ n }: { n: number }) => (
  <div style={{
    width: 28, height: 28, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center',
    background: n <= 3 ? `${C.amber}22` : C.navyM,
    border: `1px solid ${n <= 3 ? C.amber : C.border}`,
    fontSize: 12, fontWeight: 700,
    color: n <= 3 ? C.amber : C.grayD,
    flexShrink: 0,
  }}>
    {n}
  </div>
);

// ── Custom tooltip for chart ──────────────────────────────────────────────────
const ChartTooltip = ({ active, payload, label }: { active?: boolean; payload?: { value: number }[]; label?: string }) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: C.navyB, border: `1px solid ${C.border}`, borderRadius: 8, padding: '10px 14px', fontSize: 13 }}>
      <div style={{ color: C.gray, marginBottom: 4, fontSize: 11 }}>{label}</div>
      <div style={{ color: C.white, fontWeight: 700 }}>{fmtNOK(payload[0].value)}</div>
    </div>
  );
};

// ── Main page ─────────────────────────────────────────────────────────────────
export default function SuppliersPage() {
  const [data,           setData]           = useState<AnalyticsResponse | null>(null);
  const [period,         setPeriod]         = useState<Period>('3months');
  const [loading,        setLoading]        = useState(true);
  const [insights,       setInsights]       = useState('');
  const [insightsLoading,setInsightsLoading] = useState(false);
  const [insightsError,  setInsightsError]  = useState('');
  const [expanded,       setExpanded]       = useState<string | null>(null);

  const loadData = useCallback(async (p: Period) => {
    setLoading(true);
    try {
      const res  = await fetch(`/api/suppliers/analytics?limit=20&period=${p}`);
      const json = await res.json() as AnalyticsResponse;
      setData(json);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(period); }, [period, loadData]);

  const handlePeriodChange = (p: Period) => {
    setPeriod(p);
    setInsights('');
  };

  const generateInsights = async () => {
    if (!data?.suppliers.length) return;
    setInsightsLoading(true);
    setInsightsError('');
    setInsights('');
    try {
      const res  = await fetch('/api/suppliers/insights', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ suppliers: data.suppliers.slice(0, 10), period }),
      });
      const json = await res.json() as { insights?: string; error?: string };
      if (!res.ok) throw new Error(json.error ?? `HTTP ${res.status}`);
      setInsights(json.insights ?? '');
    } catch (e) {
      setInsightsError(e instanceof Error ? e.message : 'Ukjent feil');
    } finally {
      setInsightsLoading(false);
    }
  };

  const top10 = data?.suppliers.slice(0, 10) ?? [];

  return (
    <>
      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes fadeIn { from { opacity:0; transform:translateY(6px); } to { opacity:1; transform:translateY(0); } }
        .sup-row:hover { background: ${C.navyM} !important; }
      `}</style>

      <div style={{ minHeight: '100vh', background: C.navy, padding: '40px 24px', fontFamily: "'Cabinet Grotesk', system-ui, sans-serif" }}>
        <div style={{ maxWidth: 900, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 24 }}>

          {/* Back + Header */}
          <div>
            <a href="/app" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: C.grayD, fontSize: 13, textDecoration: 'none', marginBottom: 20 }}>
              ← Tilbake til dashboard
            </a>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 14 }}>
              <div>
                <div style={{ fontSize: 11, color: C.grayD, letterSpacing: '0.14em', textTransform: 'uppercase', marginBottom: 6 }}>Analyse</div>
                <h1 style={{ fontSize: 28, fontWeight: 800, color: C.white, letterSpacing: '-0.02em', margin: 0 }}>Leverandøranalyse</h1>
                {data && !loading && (
                  <p style={{ color: C.gray, fontSize: 14, marginTop: 6 }}>
                    {data.total_suppliers} leverandør{data.total_suppliers !== 1 ? 'er' : ''} · totalt {fmtNOK(data.total_amount)} · {PERIOD_LABELS[period].toLowerCase()}
                  </p>
                )}
              </div>
              <PeriodPicker value={period} onChange={handlePeriodChange}/>
            </div>
          </div>

          {/* Summary KPIs */}
          {data && !loading && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14 }}>
              {[
                { label: 'Totalt utgifter', value: fmtNOK(data.total_amount), color: C.white },
                { label: 'Antall leverandører', value: String(data.total_suppliers), color: C.amber },
                { label: 'Største leverandør',  value: data.suppliers[0] ? `${Math.round(data.suppliers[0].total_amount / data.total_amount * 100)}%` : '—', color: C.indigo },
              ].map(kpi => (
                <Card key={kpi.label} style={{ padding: '16px 20px' }}>
                  <div style={{ fontSize: 10, color: C.grayD, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 6 }}>{kpi.label}</div>
                  <div style={{ fontSize: 22, fontWeight: 800, color: kpi.color }}>{kpi.value}</div>
                </Card>
              ))}
            </div>
          )}

          {/* Bar chart */}
          <Card>
            <div style={{ fontSize: 13, fontWeight: 700, color: C.white, marginBottom: 18 }}>
              Top 10 leverandører — {PERIOD_LABELS[period].toLowerCase()}
            </div>
            {loading ? (
              <div style={{ height: 260, display: 'flex', alignItems: 'center', justifyContent: 'center', color: C.gray, gap: 10 }}>
                <Spinner/> Laster…
              </div>
            ) : top10.length === 0 ? (
              <div style={{ height: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', color: C.grayD, fontSize: 13 }}>
                Ingen fakturaer for valgt periode
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={top10} margin={{ top: 4, right: 0, left: 10, bottom: 60 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={C.border} vertical={false}/>
                  <XAxis
                    dataKey="supplier"
                    tick={{ fill: C.gray, fontSize: 11 }}
                    angle={-40}
                    textAnchor="end"
                    interval={0}
                    tickLine={false}
                    axisLine={{ stroke: C.border }}
                  />
                  <YAxis
                    tick={{ fill: C.grayD, fontSize: 11 }}
                    tickFormatter={v => `${(v / 1000).toFixed(0)}k`}
                    tickLine={false}
                    axisLine={false}
                  />
                  <Tooltip content={<ChartTooltip/>}/>
                  <Bar dataKey="total_amount" radius={[5, 5, 0, 0]}>
                    {top10.map((_, i) => (
                      <Cell key={i} fill={BAR_COLORS[i % BAR_COLORS.length]}/>
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </Card>

          {/* AI Insights */}
          <Card style={{ border: `1px solid ${C.indigo}40` }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: insights || insightsLoading ? 16 : 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 32, height: 32, borderRadius: 8, background: `${C.indigo}22`, border: `1px solid ${C.indigo}40`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16 }}>✨</div>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: C.white }}>AI-innsikt</div>
                  <div style={{ fontSize: 11, color: C.grayD }}>Drevet av Claude</div>
                </div>
              </div>
              <button onClick={generateInsights} disabled={insightsLoading || loading || !data?.suppliers.length}
                style={{
                  padding: '8px 16px', borderRadius: 8, border: 'none', fontSize: 12, fontWeight: 700, cursor: insightsLoading || loading ? 'not-allowed' : 'pointer', transition: 'all 0.15s',
                  background: insightsLoading || loading ? C.navyM : C.indigo,
                  color: insightsLoading || loading ? C.grayD : C.navy,
                  display: 'flex', alignItems: 'center', gap: 7,
                }}>
                {insightsLoading ? <><Spinner/> Analyserer…</> : '✨ Generer innsikt'}
              </button>
            </div>

            {insightsLoading && (
              <div style={{ padding: '20px 0', display: 'flex', flexDirection: 'column', gap: 10 }}>
                {[100, 85, 70].map((w, i) => (
                  <div key={i} style={{ height: 14, borderRadius: 6, background: C.navyB, width: `${w}%`, animation: 'pulse 1.5s infinite' }}/>
                ))}
              </div>
            )}

            {insights && !insightsLoading && (
              <div style={{ animation: 'fadeIn 0.3s ease', lineHeight: 1.8 }}>
                {insights.split('\n').map((line, i) => {
                  const isNumbered = /^\d+\./.test(line.trim());
                  return line.trim() ? (
                    <p key={i} style={{
                      margin: '0 0 10px 0',
                      fontSize: 13,
                      color: isNumbered ? C.white : C.gray,
                      paddingLeft: isNumbered ? 0 : 12,
                    }}>
                      {line}
                    </p>
                  ) : null;
                })}
              </div>
            )}

            {insightsError && (
              <div style={{ color: C.red, fontSize: 13, marginTop: 8 }}>{insightsError}</div>
            )}

            {!insights && !insightsLoading && !insightsError && (
              <p style={{ color: C.grayD, fontSize: 13, margin: '8px 0 0 0' }}>
                Klikk «Generer innsikt» for AI-drevne anbefalinger basert på dine leverandørdata.
              </p>
            )}
          </Card>

          {/* Supplier list */}
          <Card>
            <div style={{ fontSize: 13, fontWeight: 700, color: C.white, marginBottom: 16 }}>
              Alle leverandører
            </div>

            {loading ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {[1,2,3,4,5].map(i => (
                  <div key={i} style={{ height: 64, borderRadius: 10, background: C.navyM, animation: 'pulse 1.5s infinite' }}/>
                ))}
              </div>
            ) : (data?.suppliers ?? []).length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px 0', color: C.grayD, fontSize: 13 }}>
                Ingen leverandørdata for valgt periode
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {(data?.suppliers ?? []).map((s, i) => {
                  const isOpen    = expanded === s.supplier;
                  const pctOfTotal = data ? s.total_amount / data.total_amount : 0;
                  const barColor  = BAR_COLORS[i % BAR_COLORS.length];
                  return (
                    <div key={s.supplier}>
                      <div className="sup-row"
                        onClick={() => setExpanded(isOpen ? null : s.supplier)}
                        style={{
                          display: 'flex', alignItems: 'center', gap: 14, padding: '14px 16px',
                          borderRadius: 10, cursor: 'pointer', transition: 'background 0.12s',
                          background: isOpen ? C.navyM : 'transparent',
                          border: `1px solid ${isOpen ? C.border : 'transparent'}`,
                        }}>
                        <Rank n={i + 1}/>

                        {/* Name + bar */}
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 14, fontWeight: 600, color: C.white, marginBottom: 5, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {s.supplier}
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <div style={{ flex: 1, height: 4, borderRadius: 2, background: C.navyB, overflow: 'hidden' }}>
                              <div style={{ height: '100%', width: `${pctOfTotal * 100}%`, background: barColor, borderRadius: 2, transition: 'width 0.5s ease' }}/>
                            </div>
                            <span style={{ fontSize: 11, color: C.grayD, flexShrink: 0 }}>
                              {(pctOfTotal * 100).toFixed(1)}%
                            </span>
                          </div>
                        </div>

                        {/* Stats */}
                        <div style={{ textAlign: 'right', flexShrink: 0 }}>
                          <div style={{ fontSize: 15, fontWeight: 800, color: C.white }}>{fmtNOK(s.total_amount)}</div>
                          <div style={{ fontSize: 11, color: C.grayD, marginTop: 2 }}>
                            {s.invoice_count} faktura{s.invoice_count !== 1 ? 'er' : ''} · ⌀ {fmtNOK(s.avg_amount)}
                          </div>
                        </div>

                        <span style={{ color: C.grayD, fontSize: 13, flexShrink: 0, transition: 'transform 0.2s', transform: isOpen ? 'rotate(180deg)' : 'none' }}>▾</span>
                      </div>

                      {/* Expanded detail */}
                      {isOpen && (
                        <div style={{ margin: '0 4px 8px 4px', background: C.navyM, border: `1px solid ${C.border}`, borderRadius: '0 0 10px 10px', padding: '14px 18px', animation: 'fadeIn 0.2s ease' }}>
                          <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap', marginBottom: 14 }}>
                            {[
                              { label: 'Primær konto', value: `${s.primary_account_code} — ${s.primary_account_name}`, color: C.indigo },
                              { label: 'Totalt beløp',  value: fmtNOKd(s.total_amount),                                 color: C.white },
                              { label: 'Gjennomsnitt',  value: fmtNOKd(s.avg_amount),                                   color: C.white },
                              { label: 'Fakturaer',     value: String(s.invoice_count),                                  color: C.amber },
                            ].map(d => (
                              <div key={d.label}>
                                <div style={{ fontSize: 10, color: C.grayD, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 3 }}>{d.label}</div>
                                <div style={{ fontSize: 14, color: d.color, fontWeight: 600 }}>{d.value}</div>
                              </div>
                            ))}
                          </div>

                          {/* Monthly mini-chart */}
                          {s.monthly.length > 1 && (
                            <div>
                              <div style={{ fontSize: 10, color: C.grayD, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 8 }}>Månedlig trend</div>
                              <ResponsiveContainer width="100%" height={80}>
                                <BarChart data={s.monthly} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
                                  <XAxis dataKey="month" tick={{ fill: C.grayD, fontSize: 9 }} tickLine={false} axisLine={false}/>
                                  <Tooltip content={<ChartTooltip/>}/>
                                  <Bar dataKey="amount" fill={barColor} radius={[3, 3, 0, 0]}/>
                                </BarChart>
                              </ResponsiveContainer>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </Card>

        </div>
      </div>
    </>
  );
}
