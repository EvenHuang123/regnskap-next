// ─── CSV bank statement parser ────────────────────────────────────────────────
// Handles DNB, Nordea, and generic semicolon/comma separated formats.
// Pure JS — runs on both client and server.

export interface CsvTransaction {
  date: string;         // YYYY-MM-DD
  amount: number;       // negative = debit/payment, positive = credit
  description: string;
}

// ── Low-level helpers ──────────────────────────────────────────────────────────

/** Strip surrounding quotes and trim whitespace. */
function unquote(s: string): string {
  return s.trim().replace(/^["']|["']$/g, '').trim();
}

/**
 * Parse a Norwegian/European amount string.
 * Handles: "4 500,00"  "4.500,00"  "-4500.00"  "4500,00"  "4 500"
 */
function parseAmount(raw: string): number | null {
  const s = unquote(raw).replace(/\s/g, '').replace(/^NOK\s*/i, '');
  if (!s || s === '-' || s.toLowerCase() === 'n/a') return null;
  // Norwegian: thousands dot, decimal comma  → "4.500,00"
  // International: thousands comma, decimal dot → "4,500.00"
  // We detect by checking which separator comes last
  const lastComma = s.lastIndexOf(',');
  const lastDot   = s.lastIndexOf('.');
  let normalized: string;
  if (lastComma > lastDot) {
    // Comma is decimal → Norwegian format
    normalized = s.replace(/\./g, '').replace(',', '.');
  } else {
    // Dot is decimal (or no decimal at all)
    normalized = s.replace(/,/g, '');
  }
  const n = parseFloat(normalized);
  return isNaN(n) ? null : n;
}

/**
 * Parse a date string to YYYY-MM-DD.
 * Handles: DD.MM.YYYY  DD-MM-YYYY  DD/MM/YYYY  YYYY-MM-DD
 */
function parseDate(raw: string): string | null {
  const s = unquote(raw);
  // DD.MM.YYYY or DD-MM-YYYY or DD/MM/YYYY
  const dmyMatch = s.match(/^(\d{1,2})[.\-/](\d{1,2})[.\-/](\d{4})$/);
  if (dmyMatch) {
    const [, d, m, y] = dmyMatch;
    return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
  }
  // YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  // YYYY.MM.DD
  const ymdMatch = s.match(/^(\d{4})[.\-/](\d{2})[.\-/](\d{2})$/);
  if (ymdMatch) {
    const [, y, m, d] = ymdMatch;
    return `${y}-${m}-${d}`;
  }
  return null;
}

// ── CSV tokenizer (handles quoted fields with embedded delimiters) ──────────────

function splitRow(line: string, sep: string): string[] {
  const fields: string[] = [];
  let cur = '';
  let inQuote = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      // doubled quote inside quoted field → literal quote
      if (inQuote && line[i + 1] === '"') { cur += '"'; i++; }
      else inQuote = !inQuote;
    } else if (ch === sep && !inQuote) {
      fields.push(cur);
      cur = '';
    } else {
      cur += ch;
    }
  }
  fields.push(cur);
  return fields;
}

function detectSeparator(lines: string[]): string {
  // Count semicolons vs commas in first few lines
  const sample = lines.slice(0, 5).join('\n');
  return (sample.match(/;/g) ?? []).length >= (sample.match(/,/g) ?? []).length
    ? ';'
    : ',';
}

// ── Format-specific column detectors ──────────────────────────────────────────

interface ColMap { date: number; description: number; amount?: number; debit?: number; credit?: number }

const DNB_HEADERS    = ['dato', 'forklaring', 'rentedato', 'ut fra konto', 'inn på konto'];
const NORDEA_HEADERS = ['bokføringsdato', 'beløp', 'navn'];
const SR_HEADERS     = ['dato', 'beskrivelse', 'beløp'];

function detectColumns(headers: string[]): ColMap | null {
  const h = headers.map(s => unquote(s).toLowerCase());

  // DNB: "Dato", "Forklaring", "Rentedato", "Ut fra konto", "Inn på konto"
  if (h.includes('ut fra konto') || h.includes('inn på konto')) {
    return {
      date:        h.indexOf('dato'),
      description: h.indexOf('forklaring') !== -1 ? h.indexOf('forklaring') : h.indexOf('tekst'),
      debit:       h.indexOf('ut fra konto'),
      credit:      h.indexOf('inn på konto'),
    };
  }

  // Nordea: "Bokføringsdato", "Beløp", "Navn"
  if (h.some(x => x.includes('bokføringsdato'))) {
    const dateCol = h.findIndex(x => x.includes('bokføringsdato'));
    const nameCol = h.indexOf('navn');
    const amtCol  = h.indexOf('beløp');
    return {
      date:        dateCol,
      description: nameCol !== -1 ? nameCol : h.indexOf('tittel'),
      amount:      amtCol,
    };
  }

  // SpareBank1 / SR-Bank / generic: "Dato", "Beskrivelse"/"Tekst", "Beløp"/"Beløp inkl. mva"
  const dateCol = h.findIndex(x => x === 'dato' || x === 'date' || x.includes('dato'));
  const descCol = h.findIndex(x =>
    x.includes('beskrivelse') || x.includes('tekst') || x.includes('description') || x === 'forklaring'
  );
  const amtCol  = h.findIndex(x =>
    x === 'beløp' || x === 'amount' || x.includes('beløp') || x === 'sum'
  );

  if (dateCol !== -1 && descCol !== -1 && amtCol !== -1) {
    return { date: dateCol, description: descCol, amount: amtCol };
  }

  return null;
}

// ── Main export ───────────────────────────────────────────────────────────────

export interface ParseResult {
  transactions: CsvTransaction[];
  skipped: number;
  format: string;
}

export function parseCsv(content: string): ParseResult {
  // Normalise line endings, drop empty lines
  const lines = content
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .split('\n')
    .filter(l => l.trim().length > 0);

  if (lines.length < 2) throw new Error('Filen har for få rader');

  const sep     = detectSeparator(lines);
  const headers = splitRow(lines[0], sep);
  const cols    = detectColumns(headers);

  if (!cols) {
    throw new Error(
      'Ukjent format. Støttede banker: DNB, Nordea, SpareBank 1, SR-Bank. ' +
      'Kontroller at filen er en kontoutskrift i CSV-format.'
    );
  }

  const formatName =
    headers.map(h => unquote(h).toLowerCase()).includes('ut fra konto') ? 'DNB'
    : headers.map(h => unquote(h).toLowerCase()).some(x => x.includes('bokføringsdato')) ? 'Nordea'
    : 'Generisk';

  const transactions: CsvTransaction[] = [];
  let skipped = 0;

  for (let i = 1; i < lines.length; i++) {
    const fields = splitRow(lines[i], sep);
    if (fields.length < 2) { skipped++; continue; }

    // Date
    const date = parseDate(fields[cols.date] ?? '');
    if (!date) { skipped++; continue; }

    // Description
    const description = unquote(fields[cols.description] ?? '').replace(/\s+/g, ' ');
    if (!description) { skipped++; continue; }

    // Amount
    let amount: number | null = null;
    if (cols.amount !== undefined) {
      amount = parseAmount(fields[cols.amount] ?? '');
    } else if (cols.debit !== undefined && cols.credit !== undefined) {
      const debit  = parseAmount(fields[cols.debit]  ?? '');
      const credit = parseAmount(fields[cols.credit] ?? '');
      if (debit  !== null && debit  !== 0) amount = -Math.abs(debit);
      if (credit !== null && credit !== 0) amount =  Math.abs(credit);
    }
    if (amount === null) { skipped++; continue; }

    transactions.push({ date, amount, description });
  }

  return { transactions, skipped, format: formatName };
}
