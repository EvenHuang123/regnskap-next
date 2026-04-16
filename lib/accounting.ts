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

// ── NS 4102 account mapping ───────────────────────────────────────────────────

/** Map FinanceIQ category → primary NS 4102 expense account */
export const NORWEGIAN_ACCOUNTS: Record<string, string> = {
  Husleie:        '6300',
  Strøm:          '6340',
  Internett:      '6900',
  Telefon:        '6900',
  Lønn:           '5000',
  Varekjøp:       '4000',
  Transport:      '6800',
  Markedsføring:  '7500',
  Forsikring:     '6860',
  Utstyr:         '6500',
  Annet:          '7900',
  // Balance accounts
  Bank:           '1920',
  Leverandørgjeld:'2400',
  InngåendeMVA:   '2740',
};

/** Full account name lookup (code → name) */
export const ACCOUNT_NAMES: Record<string, string> = {
  '1920': 'Bankinnskudd',
  '2400': 'Leverandørgjeld',
  '2740': 'Inngående MVA',
  '4000': 'Varekjøp',
  '4300': 'Innkjøp handelsvarer',
  '5000': 'Lønn og honorarer',
  '6300': 'Leie lokaler',
  '6340': 'Energi / strøm',
  '6360': 'Renhold og vedlikehold',
  '6500': 'Verktøy og driftsmateriell',
  '6540': 'IT-kostnader / programvare',
  '6700': 'Regnskapstjenester',
  '6800': 'Reise og transport',
  '6860': 'Forsikring',
  '6900': 'Telefon og internett',
  '7140': 'Kontorkostnader',
  '7500': 'Markedsføring og reklame',
  '7900': 'Andre driftskostnader',
};

// ── Journal entry types ───────────────────────────────────────────────────────

export interface JournalLine {
  account_code:  string;
  account_name:  string;
  debit_amount:  number;
  credit_amount: number;
  description:   string;
}

export interface JournalEntry {
  entry_date:  string;   // YYYY-MM-DD
  description: string;
  lines:       JournalLine[];
}

/**
 * Build a proper double-entry journal entry for an invoice.
 *
 * Standard Norwegian posting for a purchase invoice:
 *   D: Expense account  (netto beløp)
 *   D: 2740 Inng. MVA   (mva beløp — 0 if no VAT)
 *   K: 2400 Leverandørgjeld (total beløp)
 *
 * When betalt (paid):
 *   D: 2400 Leverandørgjeld (total beløp)
 *   K: 1920 Bank            (total beløp)
 */
export function buildJournalEntry(f: ExportFaktura): JournalEntry {
  const expenseCode = NORWEGIAN_ACCOUNTS[f.kategori] ?? '7900';
  const expenseName = ACCOUNT_NAMES[expenseCode] ?? f.kategori;
  const netAmount   = Math.round((f.belop - f.mva) * 100) / 100;
  const mvaAmount   = f.mva;
  const totalAmount = f.belop;

  const lines: JournalLine[] = [];

  // Debit expense account (net)
  lines.push({
    account_code:  expenseCode,
    account_name:  expenseName,
    debit_amount:  netAmount,
    credit_amount: 0,
    description:   f.leverandor,
  });

  // Debit VAT account (only if VAT > 0)
  if (mvaAmount > 0) {
    lines.push({
      account_code:  '2740',
      account_name:  'Inngående MVA',
      debit_amount:  mvaAmount,
      credit_amount: 0,
      description:   `MVA ${f.leverandor}`,
    });
  }

  // Credit accounts payable or bank
  if (f.status === 'betalt') {
    // Direct bank payment — credit bank
    lines.push({
      account_code:  '1920',
      account_name:  'Bankinnskudd',
      debit_amount:  0,
      credit_amount: totalAmount,
      description:   f.leverandor,
    });
  } else {
    // Unpaid — credit accounts payable
    lines.push({
      account_code:  '2400',
      account_name:  'Leverandørgjeld',
      debit_amount:  0,
      credit_amount: totalAmount,
      description:   f.leverandor,
    });
  }

  return {
    entry_date:  f.dato,
    description: `Faktura — ${f.leverandor}`,
    lines,
  };
}

/** Validate that debit total = credit total (balance check) */
export function isBalanced(entry: JournalEntry): boolean {
  const debit  = entry.lines.reduce((s, l) => s + l.debit_amount,  0);
  const credit = entry.lines.reduce((s, l) => s + l.credit_amount, 0);
  return Math.abs(debit - credit) < 0.01;
}

// ── Legacy export for Excel sheet ────────────────────────────────────────────

export interface BookkeepingEntry {
  Dato:      string;
  Bilagsnr:  number;
  Konto:     string;
  Debet:     string;
  Kredit:    string;
  Tekst:     string;
}

export function generateBookkeepingEntries(fakturaer: ExportFaktura[]): BookkeepingEntry[] {
  const rows: BookkeepingEntry[] = [];
  let bilag = 1;

  for (const f of fakturaer) {
    const entry = buildJournalEntry(f);
    for (const line of entry.lines) {
      rows.push({
        Dato:     fmtDateNO(f.dato),
        Bilagsnr: bilag,
        Konto:    line.account_code,
        Debet:    line.debit_amount  > 0 ? fmtNOK(line.debit_amount)  : '',
        Kredit:   line.credit_amount > 0 ? fmtNOK(line.credit_amount) : '',
        Tekst:    line.description,
      });
    }
    bilag++;
  }

  return rows;
}

// ── Summary stats ─────────────────────────────────────────────────────────────

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
  const totalMva    = fakturaer.reduce((s, f) => s + f.mva,   0);
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

// ── Formatting helpers ────────────────────────────────────────────────────────

export function fmtDateNO(d: string): string {
  if (!d) return '';
  const [y, m, day] = d.split('-');
  return `${day}.${m}.${y.slice(2)}`;
}

export function fmtDateNOFull(d: string): string {
  if (!d) return '';
  const [y, m, day] = d.split('-');
  return `${day}.${m}.${y}`;
}

export function fmtNOK(n: number): string {
  return n.toLocaleString('nb-NO', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
