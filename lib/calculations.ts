import type { MonthData, FasteKostnader, DerivedData, Ansatt } from './types';

export const calcDerived = (d: Partial<MonthData>, fasteSum = 0): DerivedData => {
  const bruttofortjeneste = (d.inntekter||0) - (d.varekostnader||0);
  const totaleKostnader   = (d.varekostnader||0) + (d.lønnskostnader||0) + (d.andreKostnader||0) + fasteSum;
  const driftsresultat    = (d.inntekter||0) - totaleKostnader;
  const mvaMottatt        = (d.inntekter||0) * 0.25;
  const netteMva          = mvaMottatt - (d.mvaInnbetalt||0);
  const lønnsandel        = (d.inntekter||0) > 0 ? ((d.lønnskostnader||0) / d.inntekter!) * 100 : 0;
  const bruttomargin      = (d.inntekter||0) > 0 ? (bruttofortjeneste / d.inntekter!) * 100 : 0;
  return { bruttofortjeneste, totaleKostnader, driftsresultat, netteMva, lønnsandel, bruttomargin };
};

export const getFasteSum = (f: Partial<FasteKostnader>): number =>
  (f.husleie||0)+(f.strøm||0)+(f.internett||0)+(f.betalingsterminal||0)+(f.forsikring||0)+(f.andreFasteBeløp||0);

export const ansattMndKostnad = (a: Partial<Ansatt>): number => {
  const brutto  = a.lønnstype === 'time'
    ? (a.timelønn||0) * (a.estimerteTimer||160)
    : (a.månedslønn||0);
  const effLønn = brutto * (a.stillingsprosent||100) / 100;
  return Math.round(effLønn + effLønn * 0.141 + (effLønn * 0.102) / 12);
};

export const ansatteTotalKostnad = (ansatte: Partial<Ansatt>[]): number =>
  ansatte.reduce((s, a) => s + ansattMndKostnad(a), 0);

export const formatNOK = (v: number | null | undefined): string => {
  if (v === null || v === undefined || isNaN(v as number)) return '—';
  const abs = Math.round(Math.abs(v as number)).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '\u00A0');
  return `${(v as number) < 0 ? '−' : ''}${abs}\u00A0kr`;
};

export const formatPct = (v: number | null | undefined): string => {
  if (v === null || v === undefined || isNaN(v as number)) return '—';
  return `${Number(v).toFixed(1)}\u00A0%`;
};

export const getCurrentMonth = (): string => {
  const n = new Date();
  return `${n.getFullYear()}-${String(n.getMonth()+1).padStart(2,'0')}`;
};

export const fmtMonthFull = (m: string): string => {
  const [y, mo] = m.split('-');
  const months = ['Januar','Februar','Mars','April','Mai','Juni','Juli','August','September','Oktober','November','Desember'];
  return `${months[+mo-1]} ${y}`;
};

export const fmtMonthShort = (m: string): string => {
  const [y, mo] = m.split('-');
  const months = ['Jan','Feb','Mar','Apr','Mai','Jun','Jul','Aug','Sep','Okt','Nov','Des'];
  return `${months[+mo-1]} '${y.slice(2)}`;
};
