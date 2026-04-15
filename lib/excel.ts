// ─── Excel / CSV generation helpers ──────────────────────────────────────────
// Runs server-side only (API route). Uses the 'xlsx' package.

import * as XLSX from 'xlsx';
import {
  type ExportFaktura,
  fmtDateNO,
  fmtDateNOFull,
  fmtNOK,
  generateBookkeepingEntries,
  computeSummary,
} from './accounting';

export interface ExportOptions {
  includeBookkeeping: boolean;
  includeSummary:     boolean;
  includeMva:         boolean;
  filterBetalt:       boolean;
  filterUbetalt:      boolean;
}

function fmtPeriod(period: string): string {
  // period is YYYY-MM
  const MONTHS_NO = ['Januar','Februar','Mars','April','Mai','Juni','Juli','August','September','Oktober','November','Desember'];
  const [y, m] = period.split('-');
  if (!y || !m) return period;
  return `${MONTHS_NO[+m - 1]} ${y}`;
}

// ── Summary sheet ─────────────────────────────────────────────────────────────

function buildSummarySheet(
  fakturaer: ExportFaktura[],
  period: string,
): XLSX.WorkSheet {
  const s  = computeSummary(fakturaer);
  const ts = new Date().toLocaleString('nb-NO');

  const rows: (string | number)[][] = [
    ['FAKTURASAMMENDRAG'],
    [`Periode: ${fmtPeriod(period)}`],
    [`Generert: ${ts}`],
    [],
    ['TOTALER'],
    ['Totalt beløp (inkl. MVA):', s.totalBelop],
    ['Herav MVA:',                s.totalMva],
    ['Antall fakturaer:',         s.count],
    [],
    ['STATUS'],
    ['Betalte fakturaer:',   s.betaltCount,  s.betaltBelop],
    ['Ubetalte fakturaer:',  s.ubetaltCount, s.ubetaltBelop],
    [],
    ['PER KATEGORI'],
    ...s.perKategori.map(k => [k.kategori, k.belop, `(${k.count} faktura${k.count !== 1 ? 'er' : ''})`]),
    [],
    ['TOPP LEVERANDØRER'],
    ...s.topLeverandorer.map(l => [l.leverandor, l.belop, `(${l.count} faktura${l.count !== 1 ? 'er' : ''})`]),
  ];

  const ws = XLSX.utils.aoa_to_sheet(rows);

  // Column widths
  ws['!cols'] = [{ wch: 36 }, { wch: 18 }, { wch: 20 }];

  // Bold the section headers
  const bold = { font: { bold: true } };
  ['A1','A5','A10','A14','A18'].forEach(addr => {
    if (ws[addr]) ws[addr].s = bold;
  });

  return ws;
}

// ── Invoice detail sheet ──────────────────────────────────────────────────────

function buildInvoiceSheet(
  fakturaer: ExportFaktura[],
  includeMva: boolean,
): XLSX.WorkSheet {
  const headers = [
    'Dato',
    'Leverandør',
    'Beskrivelse',
    'Beløp (kr)',
    ...(includeMva ? ['MVA (kr)'] : []),
    'Kategori',
    'Status',
    'Betalt dato',
  ];

  const dataRows = fakturaer.map(f => [
    fmtDateNO(f.dato),
    f.leverandor,
    f.leverandor,          // description field — same as supplier until a separate field exists
    f.belop,
    ...(includeMva ? [f.mva] : []),
    f.kategori,
    f.status === 'betalt' ? 'Betalt' : 'Ubetalt',
    f.betalt_dato ? fmtDateNO(f.betalt_dato) : '',
  ]);

  const ws = XLSX.utils.aoa_to_sheet([headers, ...dataRows]);

  // Column widths
  const cols = includeMva
    ? [{ wch: 12 }, { wch: 26 }, { wch: 26 }, { wch: 14 }, { wch: 12 }, { wch: 16 }, { wch: 10 }, { wch: 12 }]
    : [{ wch: 12 }, { wch: 26 }, { wch: 26 }, { wch: 14 }, { wch: 16 }, { wch: 10 }, { wch: 12 }];
  ws['!cols'] = cols;

  return ws;
}

// ── Bookkeeping sheet ─────────────────────────────────────────────────────────

function buildBookkeepingSheet(fakturaer: ExportFaktura[]): XLSX.WorkSheet {
  const entries = generateBookkeepingEntries(fakturaer);

  const headers = ['Dato', 'Bilagsnr', 'Konto', 'Debet', 'Kredit', 'Tekst'];
  const rows    = entries.map(e => [e.Dato, e.Bilagsnr, e.Konto, e.Debet, e.Kredit, e.Tekst]);

  const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
  ws['!cols'] = [
    { wch: 12 }, { wch: 10 }, { wch: 8 }, { wch: 14 }, { wch: 14 }, { wch: 28 },
  ];
  return ws;
}

// ── Public: generate XLSX buffer ──────────────────────────────────────────────

export function generateXLSX(
  fakturaer: ExportFaktura[],
  options: ExportOptions,
  period: string,
): Buffer {
  const wb = XLSX.utils.book_new();

  if (options.includeSummary) {
    XLSX.utils.book_append_sheet(wb, buildSummarySheet(fakturaer, period), 'Sammendrag');
  }

  XLSX.utils.book_append_sheet(wb, buildInvoiceSheet(fakturaer, options.includeMva), 'Fakturaer');

  if (options.includeBookkeeping) {
    XLSX.utils.book_append_sheet(wb, buildBookkeepingSheet(fakturaer), 'Bokføring');
  }

  return Buffer.from(XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }));
}

// ── Public: generate CSV string ───────────────────────────────────────────────

export function generateCSV(
  fakturaer: ExportFaktura[],
  options: ExportOptions,
): string {
  const headers = [
    'Dato',
    'Leverandør',
    'Beløp',
    ...(options.includeMva ? ['MVA'] : []),
    'Kategori',
    'Status',
    'Betalt dato',
  ];

  const escape = (v: string | number) => {
    const s = String(v);
    return s.includes(';') || s.includes('"') || s.includes('\n')
      ? `"${s.replace(/"/g, '""')}"`
      : s;
  };

  const rows = fakturaer.map(f => [
    fmtDateNOFull(f.dato),
    escape(f.leverandor),
    fmtNOK(f.belop),
    ...(options.includeMva ? [fmtNOK(f.mva)] : []),
    escape(f.kategori),
    f.status === 'betalt' ? 'Betalt' : 'Ubetalt',
    f.betalt_dato ? fmtDateNOFull(f.betalt_dato) : '',
  ]);

  const bom = '\uFEFF'; // UTF-8 BOM so Excel opens it correctly
  return bom + [headers.join(';'), ...rows.map(r => r.join(';'))].join('\n');
}
