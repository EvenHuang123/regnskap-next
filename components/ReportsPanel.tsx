'use client';
import { useState, useEffect, useCallback } from 'react';
import type { IncomeStatementResponse } from '@/app/api/reports/income-statement/route';
import { C } from '@/lib/constants';

const fmtNOK = (n: number) => n.toLocaleString('nb-NO', { maximumFractionDigits: 0 }) + ' kr';
const fmtPct = (n: number) => `${n.toFixed(1)}%`;

const MONTHS_NO = ['Januar','Februar','Mars','April','Mai','Juni','Juli','August','September','Oktober','November','Desember'];

const Skel = ({ w = '100%', h = 18 }: { w?: string | number; h?: number }) => (
  <div style={{
    width: w, height: h, borderRadius: 6,
    background: `linear-gradient(90deg,${C.navyM} 25%,${C.navyB} 50%,${C.navyM} 75%)`,
    backgroundSize: '200% 100%', animation: 'skeleton-shimmer 1.5s infinite',
  }} />
);

const Row = ({ label, amount, bold, indent, color, borderTop }: {
  label: string; amount: number; bold?: boolean; indent?: boolean;
  color?: string; borderTop?: boolean;
}) => (
  <div style={{
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    padding: '9px 0',
    paddingLeft: indent ? 16 : 0,
    borderTop: borderTop ? `1px solid ${C.border}` : undefined,
    marginTop: borderTop ? 4 : 0,
  }}>
    <span style={{ fontSize: 13, fontWeight: bold ? 700 : 400, color: bold ? C.white : C.gray }}>
      {label}
    </span>
    <span style={{ fontSize: 13, fontWeight: bold ? 700 : 400, color: color ?? (bold ? C.white : C.gray) }}>
      {fmtNOK(amount)}
    </span>
  </div>
);

const SectionHead = ({ label }: { label: string }) => (
  <div style={{ fontSize: 10, fontWeight: 700, color: C.grayD, letterSpacing: '0.1em', textTransform: 'uppercase', padding: '14px 0 4px' }}>
    {label}
  </div>
);

const ResultBox = ({ label, amount, pct }: { label: string; amount: number; pct: number }) => {
  const color = amount >= 0 ? C.green : C.red;
  return (
    <div style={{
      marginTop: 12, padding: '16px 18px',
      background: amount >= 0 ? `${C.green}10` : `${C.red}10`,
      border: `1px solid ${amount >= 0 ? C.green : C.red}30`,
      borderRadius: 10,
      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    }}>
      <span style={{ fontSize: 14, fontWeight: 700, color: C.white }}>{label}</span>
      <div style={{ textAlign: 'right' }}>
        <div style={{ fontSize: 20, fontWeight: 800, color }}>{amount >= 0 ? '+' : ''}{fmtNOK(amount)}</div>
        <div style={{ fontSize: 11, color: C.grayD, marginTop: 2 }}>{fmtPct(pct)} margin</div>
      </div>
    </div>
  );
};

export default function ReportsPanel() {
  const thisYear  = new Date().getFullYear();
  const thisMonth = new Date().getMonth() + 1; // 1-based

  const [year,    setYear]    = useState(thisYear);
  const [month,   setMonth]   = useState<number | null>(null); // null = full year
  const [data,    setData]    = useState<IncomeStatementResponse | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    setData(null);
    try {
      const params = new URLSearchParams({ year: String(year) });
      if (month) params.set('month', String(month));
      const res = await fetch(`/api/reports/income-statement?${params}`);
      if (res.ok) setData(await res.json() as IncomeStatementResponse);
    } catch { /* noop */ } finally {
      setLoading(false);
    }
  }, [year, month]);

  useEffect(() => { load(); }, [load]);

  const years = Array.from({ length: 3 }, (_, i) => thisYear - i);

  const tabBtn = (label: string, active: boolean, onClick: () => void) => (
    <button onClick={onClick}
      style={{
        padding: '6px 14px', borderRadius: 7, fontSize: 12, fontWeight: 600, cursor: 'pointer', transition: 'all 0.15s',
        background: active ? C.amber : 'transparent',
        border: `1px solid ${active ? C.amber : C.border}`,
        color: active ? C.navy : C.gray,
      }}>
      {label}
    </button>
  );

  return (
    <div className="fade-in" style={{ maxWidth: 680 }}>
      {/* Header + filters */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h2 style={{ fontSize: 20, fontWeight: 800, marginBottom: 4 }}>📊 Resultatregnskap</h2>
          <p style={{ fontSize: 12, color: C.grayD }}>Inntekter og kostnader fra din regnskapsdata</p>
        </div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {/* Year selector */}
          {years.map(y => tabBtn(String(y), year === y, () => setYear(y)))}
        </div>
      </div>

      {/* Month selector */}
      <div style={{ display: 'flex', gap: 5, marginBottom: 20, flexWrap: 'wrap' }}>
        {tabBtn('Hele året', month === null, () => setMonth(null))}
        {MONTHS_NO.map((m, i) => {
          const mNum = i + 1;
          // Disable future months for current year
          if (year === thisYear && mNum > thisMonth) return null;
          return tabBtn(m.slice(0, 3), month === mNum, () => setMonth(mNum));
        })}
      </div>

      {/* Content */}
      {loading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {[200, 160, 160, 200, 120].map((h, i) => <Skel key={i} h={h} />)}
        </div>
      ) : !data || data.months_with_data === 0 ? (
        <div style={{ padding: '32px 24px', textAlign: 'center', background: `${C.navyL}`, border: `1px solid ${C.border}`, borderRadius: 14 }}>
          <div style={{ fontSize: 32, marginBottom: 12 }}>📋</div>
          <p style={{ fontSize: 14, color: C.gray, marginBottom: 6 }}>Ingen regnskapsdata for {data?.period ?? String(year)}</p>
          <p style={{ fontSize: 12, color: C.grayD }}>Gå til «Datainntasting» og legg inn tall for månedene du vil analysere.</p>
        </div>
      ) : (
        <div style={{ background: C.navyL, border: `1px solid ${C.border}`, borderRadius: 14, padding: '20px 24px' }}>
          {/* Period badge */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
            <span style={{ fontSize: 11, color: C.grayD }}>
              {data.months_with_data} måned{data.months_with_data !== 1 ? 'er' : ''} med data
            </span>
            {data.has_journal_data && (
              <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 4, background: `${C.indigo}18`, color: C.indigo, letterSpacing: '0.06em' }}>
                📒 Journalposteringer inkludert
              </span>
            )}
          </div>

          {/* INNTEKTER */}
          <SectionHead label="Inntekter" />
          <Row label="Salgsinntekter" amount={data.revenue} bold />

          {/* VAREKOSTNAD */}
          <SectionHead label="Varekostnad" />
          <Row label="Varekjøp og råvarer" amount={data.cogs} indent />
          <ResultBox
            label="Bruttofortjeneste"
            amount={data.gross_profit}
            pct={data.gross_margin_pct}
          />

          {/* LØNNSKOSTNADER */}
          <SectionHead label="Lønnskostnader" />
          <Row label="Lønninger og honorarer" amount={data.payroll} indent />

          {/* DRIFTSKOSTNADER */}
          <SectionHead label="Driftskostnader" />
          {data.has_journal_data && data.opex_breakdown.length > 0
            ? data.opex_breakdown.map(line => (
                <Row key={line.account_code}
                  label={`${line.account_code} ${line.account_name}`}
                  amount={line.amount}
                  indent />
              ))
            : <Row label="Andre driftskostnader" amount={data.opex} indent />
          }

          {/* Net result */}
          <ResultBox
            label="Resultat før skatt"
            amount={data.net_profit}
            pct={data.net_margin_pct}
          />

          {/* Summary table */}
          <div style={{ marginTop: 20, paddingTop: 16, borderTop: `1px solid ${C.border}` }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
              {[
                { label: 'Inntekter',  val: data.revenue,  color: C.green },
                { label: 'Kostnader',  val: data.cogs + data.payroll + data.opex, color: C.red },
                { label: 'Resultat',   val: data.net_profit, color: data.net_profit >= 0 ? C.green : C.red },
              ].map(({ label, val, color }) => (
                <div key={label} style={{ textAlign: 'center', padding: '12px 8px', background: C.navyM, borderRadius: 10 }}>
                  <div style={{ fontSize: 10, color: C.grayD, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 4 }}>{label}</div>
                  <div style={{ fontSize: 15, fontWeight: 800, color }}>{fmtNOK(Math.abs(val))}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Journal data notice */}
          {!data.has_journal_data && (
            <p style={{ fontSize: 11, color: C.grayD, marginTop: 14, textAlign: 'center' }}>
              💡 Driftskostnader vises som sum. Klikk «Postering» på fakturaer for detaljert konto-breakdown.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
