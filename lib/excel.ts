// ─── Professional Excel / CSV generation ─────────────────────────────────────
// Runs server-side only. Uses the 'xlsx' package (SheetJS CE).
// Cells are styled via the `s` property; write with { cellStyles: true }.

import * as XLSX from 'xlsx';
import {
  type ExportFaktura,
  fmtDateNO,
  fmtDateNOFull,
  fmtNOK,
  generateBookkeepingEntries,
  computeSummary,
  NORWEGIAN_ACCOUNTS,
} from './accounting';

export interface ExportOptions {
  includeBookkeeping: boolean;
  includeSummary:     boolean;
  includeMva:         boolean;
  filterBetalt:       boolean;
  filterUbetalt:      boolean;
}

// ── Style primitives ──────────────────────────────────────────────────────────

const thinB = {
  top:    { style: 'thin' as const, color: { rgb: 'C8C8C8' } },
  bottom: { style: 'thin' as const, color: { rgb: 'C8C8C8' } },
  left:   { style: 'thin' as const, color: { rgb: 'C8C8C8' } },
  right:  { style: 'thin' as const, color: { rgb: 'C8C8C8' } },
};

const medB = {
  top:    { style: 'medium' as const, color: { rgb: '888888' } },
  bottom: { style: 'medium' as const, color: { rgb: '888888' } },
  left:   { style: 'medium' as const, color: { rgb: '888888' } },
  right:  { style: 'medium' as const, color: { rgb: '888888' } },
};

// Pre-built style objects
const S = {
  titleDark: {
    font:  { bold: true, sz: 13, color: { rgb: 'FFFFFF' } },
    fill:  { patternType: 'solid' as const, fgColor: { rgb: '2C3E50' } },
    alignment: { horizontal: 'left' as const, vertical: 'center' as const },
  },
  sectionHead: {
    font:  { bold: true, sz: 11, color: { rgb: 'FFFFFF' } },
    fill:  { patternType: 'solid' as const, fgColor: { rgb: '34495E' } },
    alignment: { horizontal: 'left' as const, vertical: 'center' as const },
    border: medB,
  },
  colHeadL: {
    font:  { bold: true, sz: 10, color: { rgb: 'FFFFFF' } },
    fill:  { patternType: 'solid' as const, fgColor: { rgb: '5D6D7E' } },
    alignment: { horizontal: 'left' as const, vertical: 'center' as const },
    border: thinB,
  },
  colHeadC: {
    font:  { bold: true, sz: 10, color: { rgb: 'FFFFFF' } },
    fill:  { patternType: 'solid' as const, fgColor: { rgb: '5D6D7E' } },
    alignment: { horizontal: 'center' as const, vertical: 'center' as const },
    border: thinB,
  },
  colHeadR: {
    font:  { bold: true, sz: 10, color: { rgb: 'FFFFFF' } },
    fill:  { patternType: 'solid' as const, fgColor: { rgb: '5D6D7E' } },
    alignment: { horizontal: 'right' as const, vertical: 'center' as const },
    border: thinB,
  },
  metaLabel: {
    font:  { sz: 11, color: { rgb: '7F8C8D' } },
    alignment: { horizontal: 'left' as const },
  },
  metaVal: {
    font:  { bold: true, sz: 11, color: { rgb: '2C3E50' } },
    alignment: { horizontal: 'left' as const },
  },
  dataL: {
    font:  { sz: 10, color: { rgb: '2C3E50' } },
    alignment: { horizontal: 'left' as const },
    border: thinB,
  },
  dataR: {
    font:  { sz: 10, color: { rgb: '2C3E50' } },
    alignment: { horizontal: 'right' as const },
    border: thinB,
    numFmt: '#,##0.00',
  },
  dataC: {
    font:  { sz: 10, color: { rgb: '2C3E50' } },
    alignment: { horizontal: 'center' as const },
    border: thinB,
  },
  dataAltL: {
    font:  { sz: 10, color: { rgb: '2C3E50' } },
    fill:  { patternType: 'solid' as const, fgColor: { rgb: 'F8F9FA' } },
    alignment: { horizontal: 'left' as const },
    border: thinB,
  },
  dataAltR: {
    font:  { sz: 10, color: { rgb: '2C3E50' } },
    fill:  { patternType: 'solid' as const, fgColor: { rgb: 'F8F9FA' } },
    alignment: { horizontal: 'right' as const },
    border: thinB,
    numFmt: '#,##0.00',
  },
  dataAltC: {
    font:  { sz: 10, color: { rgb: '2C3E50' } },
    fill:  { patternType: 'solid' as const, fgColor: { rgb: 'F8F9FA' } },
    alignment: { horizontal: 'center' as const },
    border: thinB,
  },
  subTotalL: {
    font:  { bold: true, sz: 10, color: { rgb: '2C3E50' } },
    fill:  { patternType: 'solid' as const, fgColor: { rgb: 'ECF0F1' } },
    alignment: { horizontal: 'left' as const },
    border: medB,
  },
  subTotalR: {
    font:  { bold: true, sz: 10, color: { rgb: '2C3E50' } },
    fill:  { patternType: 'solid' as const, fgColor: { rgb: 'ECF0F1' } },
    alignment: { horizontal: 'right' as const },
    border: medB,
    numFmt: '#,##0.00',
  },
  subTotalC: {
    font:  { bold: true, sz: 10, color: { rgb: '2C3E50' } },
    fill:  { patternType: 'solid' as const, fgColor: { rgb: 'ECF0F1' } },
    alignment: { horizontal: 'center' as const },
    border: medB,
  },
  totalL: {
    font:  { bold: true, sz: 10, color: { rgb: 'FFFFFF' } },
    fill:  { patternType: 'solid' as const, fgColor: { rgb: '2C3E50' } },
    alignment: { horizontal: 'left' as const },
    border: medB,
  },
  totalR: {
    font:  { bold: true, sz: 10, color: { rgb: 'FFFFFF' } },
    fill:  { patternType: 'solid' as const, fgColor: { rgb: '2C3E50' } },
    alignment: { horizontal: 'right' as const },
    border: medB,
    numFmt: '#,##0.00',
  },
  totalC: {
    font:  { bold: true, sz: 10, color: { rgb: 'FFFFFF' } },
    fill:  { patternType: 'solid' as const, fgColor: { rgb: '2C3E50' } },
    alignment: { horizontal: 'center' as const },
    border: medB,
  },
  changePos: {
    font:  { bold: true, sz: 10, color: { rgb: '27AE60' } },
    alignment: { horizontal: 'right' as const },
    border: thinB,
    numFmt: '+#,##0.00;-#,##0.00',
  },
  changeNeg: {
    font:  { bold: true, sz: 10, color: { rgb: 'E74C3C' } },
    alignment: { horizontal: 'right' as const },
    border: thinB,
    numFmt: '+#,##0.00;-#,##0.00',
  },
  pctData: {
    font:  { sz: 10, color: { rgb: '2C3E50' } },
    alignment: { horizontal: 'center' as const },
    border: thinB,
    numFmt: '0.0%',
  },
  pctAlt: {
    font:  { sz: 10, color: { rgb: '2C3E50' } },
    fill:  { patternType: 'solid' as const, fgColor: { rgb: 'F8F9FA' } },
    alignment: { horizontal: 'center' as const },
    border: thinB,
    numFmt: '0.0%',
  },
  pctTotal: {
    font:  { bold: true, sz: 10, color: { rgb: 'FFFFFF' } },
    fill:  { patternType: 'solid' as const, fgColor: { rgb: '2C3E50' } },
    alignment: { horizontal: 'center' as const },
    border: medB,
    numFmt: '0.0%',
  },
  empty: {} as Record<string, unknown>,
  greenBadge: {
    font:  { bold: true, sz: 10, color: { rgb: '27AE60' } },
    alignment: { horizontal: 'left' as const },
    border: thinB,
  },
  balanceOk: {
    font:  { bold: true, sz: 10, color: { rgb: '27AE60' } },
    fill:  { patternType: 'solid' as const, fgColor: { rgb: 'EAFAF1' } },
    alignment: { horizontal: 'center' as const },
    border: medB,
  },
};

// ── Cell builder ──────────────────────────────────────────────────────────────

type StyleKey = keyof typeof S;

function cell(
  value: string | number | null | undefined,
  styleKey: StyleKey,
): XLSX.CellObject {
  const s = S[styleKey];
  if (value === null || value === undefined || value === '') {
    return { v: '', t: 's', s };
  }
  if (typeof value === 'number') {
    return { v: value, t: 'n', s };
  }
  return { v: String(value), t: 's', s };
}

// ── Sheet builder helpers ─────────────────────────────────────────────────────

class SheetBuilder {
  private ws: XLSX.WorkSheet = {};
  private row = 0;
  private maxCol = 0;

  write(r: number, c: number, cl: XLSX.CellObject) {
    this.ws[XLSX.utils.encode_cell({ r, c })] = cl;
    if (c > this.maxCol) this.maxCol = c;
    if (r > this.row)    this.row    = r;
  }

  addRow(cells: XLSX.CellObject[]) {
    cells.forEach((cl, c) => this.write(this.row, c, cl));
    const r = this.row;
    this.row++;
    return r;
  }

  addBlank() {
    this.row++;
    return this.row - 1;
  }

  mergeCols(r: number, c0: number, c1: number) {
    if (!this.ws['!merges']) this.ws['!merges'] = [];
    this.ws['!merges'].push({ s: { r, c: c0 }, e: { r, c: c1 } });
  }

  setCols(cols: { wch: number }[]) {
    this.ws['!cols'] = cols;
  }

  setRowHeight(r: number, hpx: number) {
    if (!this.ws['!rows']) this.ws['!rows'] = [];
    this.ws['!rows'][r] = { hpx };
  }

  build(): XLSX.WorkSheet {
    this.ws['!ref'] = XLSX.utils.encode_range({
      s: { r: 0, c: 0 },
      e: { r: this.row, c: this.maxCol },
    });
    return this.ws;
  }
}

// ── Period formatting ─────────────────────────────────────────────────────────

const MONTHS_NO = ['Januar','Februar','Mars','April','Mai','Juni',
                   'Juli','August','September','Oktober','November','Desember'];

function fmtPeriodLabel(period: string): string {
  const [y, m] = period.split('-');
  if (!y || !m) return period;
  return `${MONTHS_NO[+m - 1]} ${y}`;
}

function prevMonthLabel(period: string): string {
  const [y, m] = period.split('-').map(Number);
  if (!y || !m) return 'Forrige periode';
  if (m === 1) return `${MONTHS_NO[11]} ${y - 1}`;
  return `${MONTHS_NO[m - 2]} ${y}`;
}

// ── Account name lookup ───────────────────────────────────────────────────────

const ACCOUNT_NAMES: Record<string, string> = {
  '4300': 'Varekjøp',
  '5000': 'Lønn',
  '6000': 'Driftsutgifter',
  '6100': 'Markedsf./Drikke',
  '6300': 'Husleie',
  '6340': 'Strøm',
  '6360': 'Renhold/Vedlikehold',
  '6500': 'Utstyr',
  '6800': 'Transport',
  '6860': 'Forsikring',
  '6900': 'Internett/Telefon/Annet',
  '1920': 'Bank (innskudd)',
  '2400': 'Leverandørgjeld',
};

// ── SHEET 1: SAMMENDRAG ───────────────────────────────────────────────────────

function buildSummarySheet(
  fakturaer:     ExportFaktura[],
  prevFakturaer: ExportFaktura[],
  period:        string,
  bedriftsnavn:  string,
): XLSX.WorkSheet {
  const sb   = new SheetBuilder();
  const curr = computeSummary(fakturaer);
  const prev = computeSummary(prevFakturaer);
  const ts   = new Date().toLocaleString('nb-NO');
  const NC   = 4; // number of columns

  // ── Title row ──────────────────────────────────────────────────────────────
  const r0 = sb.addRow([
    cell(`FAKTURASAMMENDRAG — ${bedriftsnavn.toUpperCase()}`, 'titleDark'),
    cell('', 'titleDark'), cell('', 'titleDark'), cell('', 'titleDark'),
  ]);
  sb.mergeCols(r0, 0, NC - 1);
  sb.setRowHeight(r0, 28);

  sb.addBlank();

  // ── Metadata ───────────────────────────────────────────────────────────────
  sb.addRow([cell('Bedrift:',   'metaLabel'), cell(bedriftsnavn,          'metaVal'), cell('', 'empty'), cell('', 'empty')]);
  sb.addRow([cell('Periode:',   'metaLabel'), cell(fmtPeriodLabel(period),'metaVal'), cell('', 'empty'), cell('', 'empty')]);
  sb.addRow([cell('Generert:',  'metaLabel'), cell(ts,                    'metaVal'), cell('', 'empty'), cell('', 'empty')]);

  sb.addBlank();

  // ── Period comparison ──────────────────────────────────────────────────────
  const rSec1 = sb.addRow([
    cell('PERIODESAMMENLIGNING', 'sectionHead'),
    cell('', 'sectionHead'), cell('', 'sectionHead'), cell('', 'sectionHead'),
  ]);
  sb.mergeCols(rSec1, 0, NC - 1);

  sb.addRow([
    cell('',                        'colHeadL'),
    cell(fmtPeriodLabel(period),    'colHeadC'),
    cell(prevMonthLabel(period),    'colHeadC'),
    cell('ENDRING',                 'colHeadR'),
  ]);

  const compRows: [string, number, number][] = [
    ['Totalt beløp (inkl. MVA)', curr.totalBelop, prev.totalBelop],
    ['Herav MVA',                curr.totalMva,   prev.totalMva],
  ];
  compRows.forEach(([label, c, p], i) => {
    const diff   = c - p;
    const isAlt  = i % 2 === 1;
    const lStyle: StyleKey = isAlt ? 'dataAltL' : 'dataL';
    const rStyle: StyleKey = isAlt ? 'dataAltR' : 'dataR';
    const chStyle: StyleKey = diff >= 0 ? 'changePos' : 'changeNeg';
    sb.addRow([
      cell(label, lStyle),
      cell(c,     rStyle),
      cell(p,     rStyle),
      cell(diff,  chStyle),
    ]);
  });

  // Count row (no currency format)
  const countDiff = curr.count - prev.count;
  sb.addRow([
    cell('Antall fakturaer',         'dataAltL'),
    cell(curr.count,                 'dataAltC'),
    cell(prev.count,                 'dataAltC'),
    cell(countDiff >= 0 ? `+${countDiff}` : String(countDiff), 'dataAltC'),
  ]);

  sb.addBlank();

  // ── Status breakdown ───────────────────────────────────────────────────────
  const rSec2 = sb.addRow([
    cell('STATUS FAKTURAER', 'sectionHead'),
    cell('', 'sectionHead'), cell('', 'sectionHead'), cell('', 'sectionHead'),
  ]);
  sb.mergeCols(rSec2, 0, NC - 1);

  sb.addRow([
    cell('STATUS',       'colHeadL'),
    cell('ANTALL',       'colHeadC'),
    cell('BELØP',        'colHeadR'),
    cell('% AV TOTALT',  'colHeadC'),
  ]);

  const today    = new Date();
  const forfalt  = fakturaer.filter(f =>
    f.status !== 'betalt' &&
    new Date(f.dato) < new Date(today.getTime() - 45 * 86_400_000)
  );
  const ubetaltNormal = fakturaer.filter(f =>
    f.status !== 'betalt' &&
    new Date(f.dato) >= new Date(today.getTime() - 45 * 86_400_000)
  );
  const betalt = fakturaer.filter(f => f.status === 'betalt');

  const forfaltBelop = forfalt.reduce((s, f) => s + f.belop, 0);
  const ubetaltBelop = ubetaltNormal.reduce((s, f) => s + f.belop, 0);
  const betaltBelop  = betalt.reduce((s, f) => s + f.belop, 0);
  const total        = curr.totalBelop;

  const statusRows: [string, number, number, number][] = [
    ['✓  Betalte fakturaer',    betalt.length,       betaltBelop,  total > 0 ? betaltBelop  / total : 0],
    ['⏳  Ubetalte fakturaer',  ubetaltNormal.length, ubetaltBelop, total > 0 ? ubetaltBelop / total : 0],
    ['⚠️  Forfalte fakturaer',  forfalt.length,       forfaltBelop, total > 0 ? forfaltBelop / total : 0],
  ];

  statusRows.forEach(([label, count, belop, pct], i) => {
    const isAlt: boolean = i % 2 === 1;
    sb.addRow([
      cell(label,  isAlt ? 'dataAltL' : 'dataL'),
      cell(count,  isAlt ? 'dataAltC' : 'dataC'),
      cell(belop,  isAlt ? 'dataAltR' : 'dataR'),
      cell(pct,    isAlt ? 'pctAlt'   : 'pctData'),
    ]);
  });

  sb.addRow([
    cell('TOTALT',        'totalL'),
    cell(curr.count,      'totalC'),
    cell(curr.totalBelop, 'totalR'),
    cell(1,               'pctTotal'),
  ]);

  sb.addBlank();

  // ── Per kategori ───────────────────────────────────────────────────────────
  const rSec3 = sb.addRow([
    cell('UTGIFTER PER KATEGORI', 'sectionHead'),
    cell('', 'sectionHead'), cell('', 'sectionHead'), cell('', 'sectionHead'),
  ]);
  sb.mergeCols(rSec3, 0, NC - 1);

  sb.addRow([
    cell('KATEGORI',    'colHeadL'),
    cell('ANTALL',      'colHeadC'),
    cell('BELØP',       'colHeadR'),
    cell('% AV TOTALT', 'colHeadC'),
  ]);

  curr.perKategori.forEach(({ kategori, count, belop }, i) => {
    const isAlt = i % 2 === 1;
    const pct   = total > 0 ? belop / total : 0;
    sb.addRow([
      cell(kategori, isAlt ? 'dataAltL' : 'dataL'),
      cell(count,    isAlt ? 'dataAltC' : 'dataC'),
      cell(belop,    isAlt ? 'dataAltR' : 'dataR'),
      cell(pct,      isAlt ? 'pctAlt'   : 'pctData'),
    ]);
  });

  sb.addRow([
    cell('TOTALT',        'totalL'),
    cell(curr.count,      'totalC'),
    cell(curr.totalBelop, 'totalR'),
    cell(1,               'pctTotal'),
  ]);

  sb.addBlank();

  // ── Top leverandører ───────────────────────────────────────────────────────
  const rSec4 = sb.addRow([
    cell('TOPP 10 LEVERANDØRER', 'sectionHead'),
    cell('', 'sectionHead'), cell('', 'sectionHead'), cell('', 'sectionHead'),
  ]);
  sb.mergeCols(rSec4, 0, NC - 1);

  sb.addRow([
    cell('LEVERANDØR',   'colHeadL'),
    cell('ANTALL',       'colHeadC'),
    cell('BELØP',        'colHeadR'),
    cell('GJENNOMSNITT', 'colHeadR'),
  ]);

  curr.topLeverandorer.slice(0, 10).forEach(({ leverandor, count, belop }, i) => {
    const isAlt = i % 2 === 1;
    const avg   = count > 0 ? belop / count : 0;
    sb.addRow([
      cell(leverandor, isAlt ? 'dataAltL' : 'dataL'),
      cell(count,      isAlt ? 'dataAltC' : 'dataC'),
      cell(belop,      isAlt ? 'dataAltR' : 'dataR'),
      cell(avg,        isAlt ? 'dataAltR' : 'dataR'),
    ]);
  });

  sb.setCols([{ wch: 34 }, { wch: 14 }, { wch: 18 }, { wch: 18 }]);
  return sb.build();
}

// ── SHEET 2: FAKTURAER ────────────────────────────────────────────────────────

function buildInvoiceSheet(
  fakturaer:  ExportFaktura[],
  includeMva: boolean,
): XLSX.WorkSheet {
  const sb = new SheetBuilder();

  // Header row
  const hdrs: XLSX.CellObject[] = [
    cell('DATO',       'colHeadL'),
    cell('LEVERANDØR', 'colHeadL'),
    cell('BESKRIVELSE','colHeadL'),
    cell('BELØP',      'colHeadR'),
    ...(includeMva ? [cell('MVA', 'colHeadR')] : []),
    cell('KATEGORI',   'colHeadL'),
    cell('STATUS',     'colHeadC'),
    cell('BETALT DATO','colHeadC'),
  ];
  sb.addRow(hdrs);

  fakturaer.forEach((f, i) => {
    const isAlt = i % 2 === 1;
    const paid  = f.status === 'betalt';
    const statusStyle: StyleKey = paid
      ? (isAlt ? 'dataAltL' : 'greenBadge')
      : (isAlt ? 'dataAltL' : 'dataL');

    sb.addRow([
      cell(fmtDateNO(f.dato),                    isAlt ? 'dataAltL' : 'dataL'),
      cell(f.leverandor,                          isAlt ? 'dataAltL' : 'dataL'),
      cell(f.leverandor,                          isAlt ? 'dataAltL' : 'dataL'),
      cell(f.belop,                               isAlt ? 'dataAltR' : 'dataR'),
      ...(includeMva ? [cell(f.mva, isAlt ? 'dataAltR' : 'dataR')] : []),
      cell(f.kategori,                            isAlt ? 'dataAltL' : 'dataL'),
      cell(paid ? '✓ Betalt' : '⏳ Ubetalt',    statusStyle),
      cell(f.betalt_dato ? fmtDateNO(f.betalt_dato) : '', isAlt ? 'dataAltC' : 'dataC'),
    ]);
  });

  // Totals row
  const totalBelop = fakturaer.reduce((s, f) => s + f.belop, 0);
  const totalMva   = fakturaer.reduce((s, f) => s + f.mva,   0);
  sb.addRow([
    cell('TOTALT',   'totalL'),
    cell('',         'totalL'),
    cell('',         'totalL'),
    cell(totalBelop, 'totalR'),
    ...(includeMva ? [cell(totalMva, 'totalR')] : []),
    cell('',         'totalL'),
    cell(`${fakturaer.filter(f=>f.status==='betalt').length}/${fakturaer.length} betalt`, 'totalC'),
    cell('',         'totalL'),
  ]);

  const baseCols = [
    { wch: 12 }, { wch: 26 }, { wch: 28 }, { wch: 15 },
    { wch: 20 }, { wch: 14 }, { wch: 14 },
  ];
  if (includeMva) baseCols.splice(4, 0, { wch: 12 });
  sb.setCols(baseCols);

  return sb.build();
}

// ── SHEET 3: BOKFØRING ────────────────────────────────────────────────────────

function buildBookkeepingSheet(fakturaer: ExportFaktura[], period: string): XLSX.WorkSheet {
  const sb      = new SheetBuilder();
  const entries = generateBookkeepingEntries(fakturaer);
  const NC      = 7;

  // Title block
  const r0 = sb.addRow([
    cell('BOKFØRINGSDATA — KLAR FOR IMPORT', 'titleDark'),
    ...Array(NC - 1).fill(cell('', 'titleDark')),
  ]);
  sb.mergeCols(r0, 0, NC - 1);

  const r1 = sb.addRow([
    cell('Format: Norsk Regnskap Standard (NRS)', 'metaLabel'),
    ...Array(NC - 1).fill(cell('', 'empty')),
  ]);
  sb.mergeCols(r1, 0, NC - 1);

  const r2 = sb.addRow([
    cell('Kan importeres direkte til Tripletex, Fiken og Visma.', 'metaLabel'),
    ...Array(NC - 1).fill(cell('', 'empty')),
  ]);
  sb.mergeCols(r2, 0, NC - 1);

  const r3 = sb.addRow([
    cell(`Periode: ${fmtPeriodLabel(period)}`, 'metaLabel'),
    ...Array(NC - 1).fill(cell('', 'empty')),
  ]);
  sb.mergeCols(r3, 0, NC - 1);

  sb.addBlank();

  // Column headers
  sb.addRow([
    cell('DATO',        'colHeadL'),
    cell('BILAG',       'colHeadC'),
    cell('KONTO',       'colHeadC'),
    cell('KONTONAVN',   'colHeadL'),
    cell('DEBET',       'colHeadR'),
    cell('KREDIT',      'colHeadR'),
    cell('BESKRIVELSE', 'colHeadL'),
  ]);

  let totalDebet  = 0;
  let totalKredit = 0;

  entries.forEach((e, i) => {
    const isAlt  = i % 2 === 1;
    const dStyle: StyleKey = isAlt ? 'dataAltR' : 'dataR';
    const lStyle: StyleKey = isAlt ? 'dataAltL' : 'dataL';
    const cStyle: StyleKey = isAlt ? 'dataAltC' : 'dataC';

    const debet  = e.Debet  ? parseFloat(e.Debet.replace(/\s/g,'').replace(',','.'))  : 0;
    const kredit = e.Kredit ? parseFloat(e.Kredit.replace(/\s/g,'').replace(',','.')) : 0;
    totalDebet  += debet;
    totalKredit += kredit;

    sb.addRow([
      cell(e.Dato,      lStyle),
      cell(e.Bilagsnr,  cStyle),
      cell(e.Konto,     cStyle),
      cell(ACCOUNT_NAMES[e.Konto] ?? e.Konto, lStyle),
      cell(debet  || '', dStyle),
      cell(kredit || '', dStyle),
      cell(e.Tekst,     lStyle),
    ]);
  });

  // Totals + balance verification
  const balanced = Math.abs(totalDebet - totalKredit) < 0.01;
  sb.addRow([
    cell('',         'subTotalL'),
    cell('',         'subTotalL'),
    cell('',         'subTotalL'),
    cell('TOTALT:',  'subTotalL'),
    cell(totalDebet,  'subTotalR'),
    cell(totalKredit, 'subTotalR'),
    cell(balanced ? '✓ Balanserer' : '⚠️ Sjekk differanse', balanced ? 'balanceOk' : 'subTotalL'),
  ]);

  sb.setCols([
    { wch: 12 }, { wch: 8 }, { wch: 8 }, { wch: 24 },
    { wch: 14 }, { wch: 14 }, { wch: 28 },
  ]);

  return sb.build();
}

// ── Public: generate XLSX buffer ──────────────────────────────────────────────

export function generateXLSX(
  fakturaer:     ExportFaktura[],
  prevFakturaer: ExportFaktura[],
  options:       ExportOptions,
  period:        string,
  bedriftsnavn:  string,
): Buffer {
  const wb = XLSX.utils.book_new();

  if (options.includeSummary) {
    XLSX.utils.book_append_sheet(
      wb,
      buildSummarySheet(fakturaer, prevFakturaer, period, bedriftsnavn),
      'Sammendrag',
    );
  }

  XLSX.utils.book_append_sheet(
    wb,
    buildInvoiceSheet(fakturaer, options.includeMva),
    'Fakturaer',
  );

  if (options.includeBookkeeping) {
    XLSX.utils.book_append_sheet(
      wb,
      buildBookkeepingSheet(fakturaer, period),
      'Bokføring',
    );
  }

  return Buffer.from(XLSX.write(wb, { type: 'buffer', bookType: 'xlsx', cellStyles: true }));
}

// ── Public: generate CSV string ───────────────────────────────────────────────

export function generateCSV(
  fakturaer: ExportFaktura[],
  options:   ExportOptions,
): string {
  const headers = [
    'Dato', 'Leverandør', 'Beløp',
    ...(options.includeMva ? ['MVA'] : []),
    'Kategori', 'Status', 'Betalt dato',
  ];

  const esc = (v: string | number) => {
    const s = String(v);
    return s.includes(';') || s.includes('"') || s.includes('\n')
      ? `"${s.replace(/"/g, '""')}"` : s;
  };

  const rows = fakturaer.map(f => [
    fmtDateNOFull(f.dato),
    esc(f.leverandor),
    fmtNOK(f.belop),
    ...(options.includeMva ? [fmtNOK(f.mva)] : []),
    esc(f.kategori),
    f.status === 'betalt' ? 'Betalt' : 'Ubetalt',
    f.betalt_dato ? fmtDateNOFull(f.betalt_dato) : '',
  ]);

  const bom = '\uFEFF';
  return bom + [headers.join(';'), ...rows.map(r => r.join(';'))].join('\n');
}
