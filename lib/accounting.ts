// ─── Norwegian account plan + bookkeeping helpers ────────────────────────────

export interface ExportFaktura {
  id: string;
  leverandor: string;
  belop: number;
  dato: string;        // YYYY-MM-DD
  mva: number;
  kategori: string;
  status: string;      // 'betalt' | 'ubetalt'
  betalt_dato: string | null;
}

/** Norwegian Standard Account Plan (NRS) — expense + balance accounts */
export const NORWEGIAN_ACCOUNTS: Record<string, string> = {
  Husleie:        '6300',
  Strøm:          '6340',
  Internett:      '6900',
  Telefon:        '6900',
  Matvarer:       '6000',
  Varekjøp:       '4300',
  Drikke:         '6100',
  Renhold:        '6360',
  Vedlikehold:    '6360',
  Forsikring:     '6860',
  Markedsføring:  '6100',
  Transport:      '6800',
  Utstyr:         '6500',
  Lønn:           '5000',
  Annet:          '6900',
  // Balance
  Bank:           '1920',
  Leverandørgjeld:'2400',
};

export interface BookkeepingEntry {
  Dato:      string;
  Bilagsnr:  number;
  Konto:     string;
  Debet:     string;
  Kredit:    string;
  Tekst:     string;
}

/** Format YYYY-MM-DD → DD.MM.YY */
export function fmtDateNO(d: string): string {
  if (!d) return '';
  const [y, m, day] = d.split('-');
  return `${day}.${m}.${y.slice(2)}`;
}

/** Format YYYY-MM-DD → DD.MM.YYYY */
export function fmtDateNOFull(d: string): string {
  if (!d) return '';
  const [y, m, day] = d.split('-');
  return `${day}.${m}.${y}`;
}

/** Format number as Norwegian NOK string */
export function fmtNOK(n: number): string {
  return n.toLocaleString('nb-NO', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/**
 * Generate double-entry bookkeeping rows for each faktura.
 * Each invoice produces two rows (debit expense, credit bank/payable).
 */
export function generateBookkeepingEntries(fakturaer: ExportFaktura[]): BookkeepingEntry[] {
  const rows: BookkeepingEntry[] = [];
  let bilag = 1;

  for (const f of fakturaer) {
    const expenseAccount = NORWEGIAN_ACCOUNTS[f.kategori] ?? '6900';
    const balanceAccount = f.status === 'betalt' ? '1920' : '2400';
    const entryDate      = fmtDateNO(f.dato);
    const payDate        = f.betalt_dato ? fmtDateNO(f.betalt_dato) : entryDate;
    const belopStr       = fmtNOK(f.belop);

    // Row 1: debit expense account
    rows.push({
      Dato:     entryDate,
      Bilagsnr: bilag,
      Konto:    expenseAccount,
      Debet:    belopStr,
      Kredit:   '',
      Tekst:    f.leverandor,
    });

    // Row 2: credit bank (1920) or accounts payable (2400)
    rows.push({
      Dato:     payDate,
      Bilagsnr: bilag,
      Konto:    balanceAccount,
      Debet:    '',
      Kredit:   belopStr,
      Tekst:    f.leverandor,
    });

    bilag++;
  }

  return rows;
}

export interface SummaryStats {
  totalBelop:      number;
  totalMva:        number;
  count:           number;
  betaltCount:     number;
  betaltBelop:     number;
  ubetaltCount:    number;
  ubetaltBelop:    number;
  perKategori:     { kategori: string; belop: number; count: number }[];
  topLeverandorer: { leverandor: string; belop: number; count: number }[];
}

export function computeSummary(fakturaer: ExportFaktura[]): SummaryStats {
  const totalBelop  = fakturaer.reduce((s, f) => s + f.belop, 0);
  const totalMva    = fakturaer.reduce((s, f) => s + f.mva, 0);
  const betalt      = fakturaer.filter(f => f.status === 'betalt');
  const ubetalt     = fakturaer.filter(f => f.status !== 'betalt');

  const katMap = new Map<string, { belop: number; count: number }>();
  for (const f of fakturaer) {
    const k = katMap.get(f.kategori) ?? { belop: 0, count: 0 };
    katMap.set(f.kategori, { belop: k.belop + f.belop, count: k.count + 1 });
  }
  const perKategori = [...katMap.entries()]
    .map(([kategori, v]) => ({ kategori, ...v }))
    .sort((a, b) => b.belop - a.belop);

  const levMap = new Map<string, { belop: number; count: number }>();
  for (const f of fakturaer) {
    const l = levMap.get(f.leverandor) ?? { belop: 0, count: 0 };
    levMap.set(f.leverandor, { belop: l.belop + f.belop, count: l.count + 1 });
  }
  const topLeverandorer = [...levMap.entries()]
    .map(([leverandor, v]) => ({ leverandor, ...v }))
    .sort((a, b) => b.belop - a.belop)
    .slice(0, 5);

  return {
    totalBelop,
    totalMva,
    count:         fakturaer.length,
    betaltCount:   betalt.length,
    betaltBelop:   betalt.reduce((s, f) => s + f.belop, 0),
    ubetaltCount:  ubetalt.length,
    ubetaltBelop:  ubetalt.reduce((s, f) => s + f.belop, 0),
    perKategori,
    topLeverandorer,
  };
}
