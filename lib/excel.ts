// ─── Professional Excel / CSV generation ─────────────────────────────────────
// Runs server-side only. Uses ExcelJS for full styling support.

import ExcelJS from 'exceljs';
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

// ── Colour palette ────────────────────────────────────────────────────────────

const C = {
  headerDark:  'FF1F3864',   // #1f3864 — dark navy header
  headerMid:   'FF2E4A7A',   // slightly lighter navy for section heads
  subHeader:   'FFD9D9D9',   // #d9d9d9 — light grey sub-header
  white:       'FFFFFFFF',
  black:       'FF000000',
  darkText:    'FF1F2937',
  grayText:    'FF6B7280',
  altRow:      'FFF5F7FA',   // very light blue-grey zebra row
  totalRow:    'FF1F3864',   // same as header for totals
  green:       'FF90EE90',   // #90EE90 — paid status
  greenText:   'FF166534',
  yellow:      'FFFFD700',   // #FFD700 — unpaid status
  yellowText:  'FF92400E',
  red:         'FFFEE2E2',
  redText:     'FF991B1B',
  changePos:   'FF166534',
  changeNeg:   'FF991B1B',
  border:      'FFB0B8C4',
  borderDark:  'FF6B7280',
} as const;

// ── Style helpers ─────────────────────────────────────────────────────────────

type Alignment = Partial<ExcelJS.Alignment>;
type Border    = Partial<ExcelJS.Borders>;

const thinBorder: Border = {
  top:    { style: 'thin',   color: { argb: C.border } },
  bottom: { style: 'thin',   color: { argb: C.border } },
  left:   { style: 'thin',   color: { argb: C.border } },
  right:  { style: 'thin',   color: { argb: C.border } },
};

const medBorder: Border = {
  top:    { style: 'medium', color: { argb: C.borderDark } },
  bottom: { style: 'medium', color: { argb: C.borderDark } },
  left:   { style: 'medium', color: { argb: C.borderDark } },
  right:  { style: 'medium', color: { argb: C.borderDark } },
};

function solidFill(argb: string): ExcelJS.Fill {
  return { type: 'pattern', pattern: 'solid', fgColor: { argb } };
}

function applyStyle(
  cell:       ExcelJS.Cell,
  opts: {
    bold?:       boolean;
    italic?:     boolean;
    sz?:         number;
    color?:      string;
    bg?:         string;
    align?:      ExcelJS.Alignment['horizontal'];
    valign?:     ExcelJS.Alignment['vertical'];
    border?:     Border;
    numFmt?:     string;
    wrapText?:   boolean;
  }
) {
  cell.font = {
    name:  'Calibri',
    size:  opts.sz    ?? 11,
    bold:  opts.bold  ?? false,
    italic: opts.italic ?? false,
    color: { argb: opts.color ?? C.darkText },
  };
  if (opts.bg) cell.fill = solidFill(opts.bg);
  cell.alignment = {
    horizontal: opts.align  ?? 'left',
    vertical:   opts.valign ?? 'middle',
    wrapText:   opts.wrapText ?? false,
  };
  if (opts.border) cell.border = opts.border;
  if (opts.numFmt) cell.numFmt = opts.numFmt;
}

// Row height helper
function rowH(ws: ExcelJS.Worksheet, rowNum: number, hpt: number) {
  ws.getRow(rowNum).height = hpt;
}

// Merge cells by 1-based row/col
function merge(ws: ExcelJS.Worksheet, r: number, c1: number, c2: number) {
  ws.mergeCells(r, c1, r, c2);
}

// ── Shared row builders ───────────────────────────────────────────────────────

/** Dark navy title spanning all columns */
function addTitle(ws: ExcelJS.Worksheet, text: string, ncols: number): number {
  const row  = ws.addRow([text]);
  const rnum = row.number;
  merge(ws, rnum, 1, ncols);
  applyStyle(ws.getCell(rnum, 1), {
    bold: true, sz: 13, color: C.white, bg: C.headerDark,
    align: 'left', valign: 'middle', border: medBorder,
  });
  rowH(ws, rnum, 30);
  return rnum;
}

/** Section header spanning all columns */
function addSectionHead(ws: ExcelJS.Worksheet, text: string, ncols: number): number {
  const row  = ws.addRow([text]);
  const rnum = row.number;
  merge(ws, rnum, 1, ncols);
  applyStyle(ws.getCell(rnum, 1), {
    bold: true, sz: 11, color: C.white, bg: C.headerMid,
    align: 'left', valign: 'middle', border: medBorder,
  });
  rowH(ws, rnum, 22);
  return rnum;
}

/** Column header row */
function addColHeaders(
  ws:      ExcelJS.Worksheet,
  headers: { label: string; align?: ExcelJS.Alignment['horizontal'] }[],
): number {
  const values = headers.map(h => h.label);
  const row    = ws.addRow(values);
  const rnum   = row.number;
  headers.forEach((h, i) => {
    applyStyle(ws.getCell(rnum, i + 1), {
      bold: true, sz: 11, color: C.white, bg: C.headerDark,
      align: h.align ?? 'left', valign: 'middle', border: medBorder,
    });
  });
  rowH(ws, rnum, 22);
  return rnum;
}

/** Data row with zebra striping */
function addDataRow(
  ws:     ExcelJS.Worksheet,
  cells:  { value: ExcelJS.CellValue; align?: ExcelJS.Alignment['horizontal']; numFmt?: string; bg?: string; color?: string; bold?: boolean }[],
  isAlt:  boolean,
): number {
  const values = cells.map(c => c.value);
  const row    = ws.addRow(values);
  const rnum   = row.number;
  const defBg  = isAlt ? C.altRow : undefined;
  cells.forEach((c, i) => {
    applyStyle(ws.getCell(rnum, i + 1), {
      sz:     11,
      color:  c.color ?? C.darkText,
      bg:     c.bg ?? defBg,
      align:  c.align ?? 'left',
      valign: 'middle',
      border: thinBorder,
      numFmt: c.numFmt,
      bold:   c.bold ?? false,
    });
  });
  rowH(ws, rnum, 18);
  return rnum;
}

/** Total / summary row */
function addTotalRow(
  ws:    ExcelJS.Worksheet,
  cells: { value: ExcelJS.CellValue; align?: ExcelJS.Alignment['horizontal']; numFmt?: string }[],
): number {
  const values = cells.map(c => c.value);
  const row    = ws.addRow(values);
  const rnum   = row.number;
  cells.forEach((c, i) => {
    applyStyle(ws.getCell(rnum, i + 1), {
      bold: true, sz: 11, color: C.white, bg: C.totalRow,
      align: c.align ?? 'left', valign: 'middle',
      border: medBorder, numFmt: c.numFmt,
    });
  });
  rowH(ws, rnum, 20);
  return rnum;
}

/** Blank spacer row */
function addBlank(ws: ExcelJS.Worksheet) {
  ws.addRow([]);
}

// ── Number formats ────────────────────────────────────────────────────────────

const FMT_NOK = '"kr "#,##0.00';
const FMT_PCT = '0.0%';
const FMT_INT = '#,##0';

// ── Period helpers ────────────────────────────────────────────────────────────

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
  wb:            ExcelJS.Workbook,
  fakturaer:     ExportFaktura[],
  prevFakturaer: ExportFaktura[],
  period:        string,
  bedriftsnavn:  string,
) {
  const ws   = wb.addWorksheet('Sammendrag');
  const curr = computeSummary(fakturaer);
  const prev = computeSummary(prevFakturaer);
  const ts   = new Date().toLocaleString('nb-NO');
  const NC   = 4;

  ws.columns = [
    { width: 36 }, { width: 18 }, { width: 18 }, { width: 18 },
  ];

  // Title
  addTitle(ws, `FAKTURASAMMENDRAG — ${bedriftsnavn.toUpperCase()}`, NC);
  addBlank(ws);

  // Metadata
  const metaRows: [string, string][] = [
    ['Bedrift:',   bedriftsnavn],
    ['Periode:',   fmtPeriodLabel(period)],
    ['Generert:',  ts],
  ];
  metaRows.forEach(([label, val]) => {
    const row  = ws.addRow([label, val]);
    const rnum = row.number;
    applyStyle(ws.getCell(rnum, 1), { sz: 11, color: C.grayText });
    applyStyle(ws.getCell(rnum, 2), { sz: 11, bold: true, color: C.darkText });
    rowH(ws, rnum, 18);
  });

  addBlank(ws);

  // ── Period comparison ──────────────────────────────────────────────────────
  addSectionHead(ws, 'PERIODESAMMENLIGNING', NC);
  addColHeaders(ws, [
    { label: '' },
    { label: fmtPeriodLabel(period), align: 'right' },
    { label: prevMonthLabel(period),  align: 'right' },
    { label: 'ENDRING',               align: 'right' },
  ]);

  const compRows: [string, number, number][] = [
    ['Totalt beløp (inkl. MVA)', curr.totalBelop, prev.totalBelop],
    ['Herav MVA',                curr.totalMva,   prev.totalMva],
  ];
  compRows.forEach(([label, c, p], i) => {
    const diff   = c - p;
    const isAlt  = i % 2 === 1;
    const chColor = diff >= 0 ? C.changePos : C.changeNeg;
    addDataRow(ws, [
      { value: label },
      { value: c,    align: 'right', numFmt: FMT_NOK },
      { value: p,    align: 'right', numFmt: FMT_NOK },
      { value: diff, align: 'right', numFmt: '+' + FMT_NOK + ';-' + FMT_NOK, color: chColor, bold: true },
    ], isAlt);
  });

  const countDiff = curr.count - prev.count;
  addDataRow(ws, [
    { value: 'Antall fakturaer' },
    { value: curr.count, align: 'center', numFmt: FMT_INT },
    { value: prev.count, align: 'center', numFmt: FMT_INT },
    { value: countDiff >= 0 ? `+${countDiff}` : String(countDiff), align: 'center', color: countDiff >= 0 ? C.changePos : C.changeNeg, bold: true },
  ], true);

  addBlank(ws);

  // ── Status ─────────────────────────────────────────────────────────────────
  addSectionHead(ws, 'STATUS FAKTURAER', NC);
  addColHeaders(ws, [
    { label: 'STATUS' },
    { label: 'ANTALL', align: 'center' },
    { label: 'BELØP',  align: 'right' },
    { label: '% AV TOTALT', align: 'center' },
  ]);

  const today   = new Date();
  const forfalt = fakturaer.filter(f =>
    f.status !== 'betalt' && new Date(f.dato) < new Date(today.getTime() - 45 * 86_400_000)
  );
  const ubetaltNormal = fakturaer.filter(f =>
    f.status !== 'betalt' && new Date(f.dato) >= new Date(today.getTime() - 45 * 86_400_000)
  );
  const betalt = fakturaer.filter(f => f.status === 'betalt');

  const forfaltBelop = forfalt.reduce((s, f) => s + f.belop, 0);
  const ubetaltBelop = ubetaltNormal.reduce((s, f) => s + f.belop, 0);
  const betaltBelop  = betalt.reduce((s, f) => s + f.belop, 0);
  const total        = curr.totalBelop;

  const statusRows: [string, number, number, number][] = [
    ['Betalte fakturaer',   betalt.length,        betaltBelop,  total > 0 ? betaltBelop  / total : 0],
    ['Ubetalte fakturaer',  ubetaltNormal.length, ubetaltBelop, total > 0 ? ubetaltBelop / total : 0],
    ['Forfalte fakturaer',  forfalt.length,        forfaltBelop, total > 0 ? forfaltBelop / total : 0],
  ];

  statusRows.forEach(([label, count, belop, pct], i) => {
    addDataRow(ws, [
      { value: label },
      { value: count, align: 'center', numFmt: FMT_INT },
      { value: belop, align: 'right',  numFmt: FMT_NOK },
      { value: pct,   align: 'center', numFmt: FMT_PCT },
    ], i % 2 === 1);
  });

  addTotalRow(ws, [
    { value: 'TOTALT' },
    { value: curr.count,      align: 'center', numFmt: FMT_INT },
    { value: curr.totalBelop, align: 'right',  numFmt: FMT_NOK },
    { value: 1,               align: 'center', numFmt: FMT_PCT },
  ]);

  addBlank(ws);

  // ── Per kategori ───────────────────────────────────────────────────────────
  addSectionHead(ws, 'UTGIFTER PER KATEGORI', NC);
  addColHeaders(ws, [
    { label: 'KATEGORI' },
    { label: 'ANTALL',      align: 'center' },
    { label: 'BELØP',       align: 'right' },
    { label: '% AV TOTALT', align: 'center' },
  ]);

  curr.perKategori.forEach(({ kategori, count, belop }, i) => {
    const pct = total > 0 ? belop / total : 0;
    addDataRow(ws, [
      { value: kategori },
      { value: count, align: 'center', numFmt: FMT_INT },
      { value: belop, align: 'right',  numFmt: FMT_NOK },
      { value: pct,   align: 'center', numFmt: FMT_PCT },
    ], i % 2 === 1);
  });

  addTotalRow(ws, [
    { value: 'TOTALT' },
    { value: curr.count,      align: 'center', numFmt: FMT_INT },
    { value: curr.totalBelop, align: 'right',  numFmt: FMT_NOK },
    { value: 1,               align: 'center', numFmt: FMT_PCT },
  ]);

  addBlank(ws);

  // ── Top leverandører ───────────────────────────────────────────────────────
  addSectionHead(ws, 'TOPP 10 LEVERANDØRER', NC);
  addColHeaders(ws, [
    { label: 'LEVERANDØR' },
    { label: 'ANTALL',        align: 'center' },
    { label: 'BELØP',         align: 'right' },
    { label: 'GJENNOMSNITT',  align: 'right' },
  ]);

  curr.topLeverandorer.slice(0, 10).forEach(({ leverandor, count, belop }, i) => {
    const avg = count > 0 ? belop / count : 0;
    addDataRow(ws, [
      { value: leverandor },
      { value: count, align: 'center', numFmt: FMT_INT },
      { value: belop, align: 'right',  numFmt: FMT_NOK },
      { value: avg,   align: 'right',  numFmt: FMT_NOK },
    ], i % 2 === 1);
  });
}

// ── SHEET 2: FAKTURAER ────────────────────────────────────────────────────────

function buildInvoiceSheet(
  wb:         ExcelJS.Workbook,
  fakturaer:  ExportFaktura[],
  includeMva: boolean,
) {
  const ws = wb.addWorksheet('Fakturaer');

  // Freeze header row
  ws.views = [{ state: 'frozen', ySplit: 1 }];

  const baseCols: Partial<ExcelJS.Column>[] = [
    { header: '', width: 13 },
    { header: '', width: 28 },
    { header: '', width: 16 },
    ...(includeMva ? [{ header: '', width: 14 }] : []),
    { header: '', width: 20 },
    { header: '', width: 14 },
    { header: '', width: 14 },
  ];
  ws.columns = baseCols;

  // Header row
  const hdrCells: { label: string; align?: ExcelJS.Alignment['horizontal'] }[] = [
    { label: 'DATO' },
    { label: 'LEVERANDØR' },
    { label: 'BELØP',  align: 'right' },
    ...(includeMva ? [{ label: 'MVA', align: 'right' as const }] : []),
    { label: 'KATEGORI' },
    { label: 'STATUS',     align: 'center' },
    { label: 'BETALT DATO', align: 'center' },
  ];
  addColHeaders(ws, hdrCells);

  // Data rows
  fakturaer.forEach((f, i) => {
    const isAlt = i % 2 === 1;
    const paid  = f.status === 'betalt';

    // Status cell gets color fill regardless of zebra
    const statusBg    = paid ? C.green  : C.yellow;
    const statusColor = paid ? C.greenText : C.yellowText;
    const statusLabel = paid ? 'BETALT' : 'UBETALT';

    const cells: Parameters<typeof addDataRow>[1] = [
      { value: fmtDateNO(f.dato) },
      { value: f.leverandor },
      { value: f.belop, align: 'right', numFmt: FMT_NOK },
      ...(includeMva ? [{ value: f.mva, align: 'right' as const, numFmt: FMT_NOK }] : []),
      { value: f.kategori },
      { value: statusLabel, align: 'center', bg: statusBg, color: statusColor, bold: true },
      { value: f.betalt_dato ? fmtDateNO(f.betalt_dato) : '', align: 'center' },
    ];

    addDataRow(ws, cells, isAlt);
  });

  // Totals
  const totalBelop = fakturaer.reduce((s, f) => s + f.belop, 0);
  const totalMva   = fakturaer.reduce((s, f) => s + f.mva, 0);
  type TotalCell = Parameters<typeof addTotalRow>[1][number];
  const totalCells: TotalCell[] = [
    { value: 'TOTALT' },
    { value: '' },
    { value: totalBelop, align: 'right', numFmt: FMT_NOK },
  ];
  if (includeMva) totalCells.push({ value: totalMva, align: 'right', numFmt: FMT_NOK });
  totalCells.push(
    { value: '' },
    { value: `${fakturaer.filter(f => f.status === 'betalt').length}/${fakturaer.length} betalt`, align: 'center' },
    { value: '' },
  );
  addTotalRow(ws, totalCells);
}

// ── SHEET 3: BOKFØRING ────────────────────────────────────────────────────────

function buildBookkeepingSheet(
  wb:        ExcelJS.Workbook,
  fakturaer: ExportFaktura[],
  period:    string,
) {
  const ws      = wb.addWorksheet('Bokføring');
  const entries = generateBookkeepingEntries(fakturaer);
  const NC      = 7;

  ws.columns = [
    { width: 13 }, { width: 9 }, { width: 9 }, { width: 26 },
    { width: 16 }, { width: 16 }, { width: 30 },
  ];

  // Title block
  addTitle(ws, 'BOKFØRINGSDATA — KLAR FOR IMPORT', NC);

  const metaLines = [
    'Format: Norsk Regnskap Standard (NRS)',
    'Kan importeres direkte til Tripletex, Fiken og Visma.',
    `Periode: ${fmtPeriodLabel(period)}`,
  ];
  metaLines.forEach(text => {
    const row  = ws.addRow([text]);
    const rnum = row.number;
    merge(ws, rnum, 1, NC);
    applyStyle(ws.getCell(rnum, 1), { sz: 11, color: C.grayText });
    rowH(ws, rnum, 17);
  });

  addBlank(ws);

  // Freeze header
  ws.views = [{ state: 'frozen', ySplit: ws.rowCount + 1 }];

  addColHeaders(ws, [
    { label: 'DATO' },
    { label: 'BILAG',     align: 'center' },
    { label: 'KONTO',     align: 'center' },
    { label: 'KONTONAVN' },
    { label: 'DEBET',     align: 'right' },
    { label: 'KREDIT',    align: 'right' },
    { label: 'BESKRIVELSE' },
  ]);

  let totalDebet  = 0;
  let totalKredit = 0;

  entries.forEach((e, i) => {
    const debet  = e.Debet  ? parseFloat(e.Debet.replace(/\s/g,'').replace(',','.'))  : 0;
    const kredit = e.Kredit ? parseFloat(e.Kredit.replace(/\s/g,'').replace(',','.')) : 0;
    totalDebet  += debet;
    totalKredit += kredit;

    addDataRow(ws, [
      { value: e.Dato },
      { value: e.Bilagsnr, align: 'center' },
      { value: e.Konto,    align: 'center' },
      { value: ACCOUNT_NAMES[e.Konto] ?? e.Konto },
      { value: debet  || null, align: 'right', numFmt: FMT_NOK },
      { value: kredit || null, align: 'right', numFmt: FMT_NOK },
      { value: e.Tekst },
    ], i % 2 === 1);
  });

  // Balance row
  const balanced  = Math.abs(totalDebet - totalKredit) < 0.01;
  const balanceBg = balanced ? C.green : C.yellow;
  const balanceColor = balanced ? C.greenText : C.yellowText;

  addTotalRow(ws, [
    { value: '' },
    { value: '' },
    { value: '' },
    { value: 'TOTALT:' },
    { value: totalDebet,  align: 'right', numFmt: FMT_NOK },
    { value: totalKredit, align: 'right', numFmt: FMT_NOK },
    { value: balanced ? '✓ Balanserer' : '⚠️ Sjekk differanse' },
  ]);

  // Override balance cell color
  const lastRow = ws.lastRow!.number;
  const balCell = ws.getCell(lastRow, NC);
  applyStyle(balCell, {
    bold: true, sz: 11, color: balanceColor, bg: balanceBg,
    align: 'center', valign: 'middle', border: medBorder,
  });
}

// ── Public: generate XLSX buffer ──────────────────────────────────────────────

export async function generateXLSX(
  fakturaer:     ExportFaktura[],
  prevFakturaer: ExportFaktura[],
  options:       ExportOptions,
  period:        string,
  bedriftsnavn:  string,
): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator  = 'FinanceIQ';
  wb.created  = new Date();
  wb.modified = new Date();

  if (options.includeSummary) {
    buildSummarySheet(wb, fakturaer, prevFakturaer, period, bedriftsnavn);
  }

  buildInvoiceSheet(wb, fakturaer, options.includeMva);

  if (options.includeBookkeeping) {
    buildBookkeepingSheet(wb, fakturaer, period);
  }

  const buf = await wb.xlsx.writeBuffer();
  return Buffer.from(buf);
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
