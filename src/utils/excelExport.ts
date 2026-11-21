import ExcelJS from 'exceljs';
import type { PeriodData, PrintConfig, ProjectData } from '../types';
import { CASHFLOW_GROUPS } from '../types';
import {
  calculateCashflowSummary,
  calculateKbsSummary,
  calculateWorkerPayroll,
  formatDateIndo,
  formatDateShort,
  getDayLabelShort,
} from './calculations';

const CURRENCY_FMT = '"Rp "#,##0;[Red]-"Rp "#,##0;"Rp 0"';
const DAYS_FMT = '0.##;-0.##;"-"';
const FONT_NAME = 'Calibri';

const COLOR = {
  navy: 'FF0F172A',
  slateDark: 'FF1E293B',
  slateMed: 'FF334155',
  slateBorder: 'FF94A3B8',
  slateGrid: 'FFCBD5E1',
  metaBg: 'FFF1F5F9',
  zebraBg: 'FFF8FAFC',
  groupBg: 'FFE2E8F0',
  subtotalBg: 'FFFEF3C7',
  grandTotalBg: 'FFFDE68A',
  emeraldHeader: 'FF065F46',
  emeraldBg: 'FFD1FAE5',
  emeraldText: 'FF065F46',
  emeraldSoft: 'FFF0FDF4',
  roseHeader: 'FF881337',
  roseBg: 'FFFFE4E6',
  roseText: 'FF9F1239',
  amberSoft: 'FFFFFBEB',
  white: 'FFFFFFFF',
  textDark: 'FF0F172A',
  textMuted: 'FF475569',
} as const;

const THIN_SIDE: Partial<ExcelJS.Border> = {
  style: 'thin',
  color: { argb: COLOR.slateGrid },
};

const MED_DARK_SIDE: Partial<ExcelJS.Border> = {
  style: 'medium',
  color: { argb: COLOR.navy },
};

const DOUBLE_DARK_SIDE: Partial<ExcelJS.Border> = {
  style: 'double',
  color: { argb: COLOR.navy },
};

const THIN_DARK_SIDE: Partial<ExcelJS.Border> = {
  style: 'thin',
  color: { argb: COLOR.slateBorder },
};

const CELL_BORDER: Partial<ExcelJS.Borders> = {
  top: THIN_SIDE,
  left: THIN_SIDE,
  bottom: THIN_SIDE,
  right: THIN_SIDE,
};

const HEADER_BORDER: Partial<ExcelJS.Borders> = {
  top: THIN_DARK_SIDE,
  left: THIN_DARK_SIDE,
  bottom: MED_DARK_SIDE,
  right: THIN_DARK_SIDE,
};

const SUBTOTAL_BORDER: Partial<ExcelJS.Borders> = {
  top: THIN_DARK_SIDE,
  left: THIN_SIDE,
  bottom: THIN_DARK_SIDE,
  right: THIN_SIDE,
};

const GRAND_TOTAL_BORDER: Partial<ExcelJS.Borders> = {
  top: MED_DARK_SIDE,
  left: THIN_DARK_SIDE,
  bottom: DOUBLE_DARK_SIDE,
  right: THIN_DARK_SIDE,
};

function sanitizeFileName(name: string): string {
  return name.replace(/[^a-zA-Z0-9_-]+/g, '_').replace(/^_+|_+$/g, '');
}

function solidFill(argb: string): ExcelJS.Fill {
  return {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb },
  };
}

function styleRange(
  ws: ExcelJS.Worksheet,
  startRow: number,
  startCol: number,
  endRow: number,
  endCol: number,
  opts: {
    font?: Partial<ExcelJS.Font>;
    fill?: ExcelJS.Fill;
    border?: Partial<ExcelJS.Borders>;
    alignment?: Partial<ExcelJS.Alignment>;
    numFmt?: string;
  }
): void {
  for (let r = startRow; r <= endRow; r++) {
    const row = ws.getRow(r);
    for (let c = startCol; c <= endCol; c++) {
      const cell = row.getCell(c);
      if (opts.font) cell.font = { name: FONT_NAME, ...opts.font };
      if (opts.fill) cell.fill = opts.fill;
      if (opts.border) cell.border = opts.border;
      if (opts.alignment) cell.alignment = opts.alignment;
      if (opts.numFmt) cell.numFmt = opts.numFmt;
    }
  }
}

function calcWrappedRowHeight(texts: { text: string; colWidth: number }[], baseHeight = 20): number {
  let maxLines = 1;
  for (const item of texts) {
    if (!item.text) continue;
    const effectiveWidth = Math.max(8, item.colWidth - 2);
    const lines = item.text
      .split('\n')
      .reduce((acc, seg) => acc + Math.max(1, Math.ceil(seg.length / effectiveWidth)), 0);
    if (lines > maxLines) maxLines = lines;
  }
  return Math.max(baseHeight, maxLines * 15 + 6);
}

function addTitleBanner(ws: ExcelJS.Worksheet, totalCols: number, title: string): void {
  ws.mergeCells(1, 1, 1, totalCols);
  const cell = ws.getCell(1, 1);
  cell.value = title;
  styleRange(ws, 1, 1, 1, totalCols, {
    font: { size: 13, bold: true, color: { argb: COLOR.white } },
    fill: solidFill(COLOR.navy),
    alignment: { horizontal: 'center', vertical: 'middle' },
  });
  ws.getRow(1).height = 30;
}

function addSignatureBlock(
  ws: ExcelJS.Worksheet,
  startRow: number,
  colSpans: [number, number][],
  printConfig: PrintConfig
): void {
  const [leftSpan, midSpan, rightSpan] = colSpans;
  const totalCols = rightSpan[1];

  const dateRow = startRow + 1;
  ws.mergeCells(dateRow, rightSpan[0], dateRow, totalCols);
  const dateCell = ws.getCell(dateRow, rightSpan[0]);
  dateCell.value = `${printConfig.kota}, ${formatDateIndo(printConfig.tanggalCetak)}`;
  dateCell.font = { name: FONT_NAME, size: 10, italic: true, color: { argb: COLOR.textDark } };
  dateCell.alignment = { horizontal: 'center', vertical: 'middle' };
  ws.getRow(dateRow).height = 20;

  const roleRow = dateRow + 1;
  const roles: [number, number, string][] = [
    [leftSpan[0], leftSpan[1], `${printConfig.mengetahuiJabatan},`],
    [midSpan[0], midSpan[1], `${printConfig.disetujuiJabatan},`],
    [rightSpan[0], rightSpan[1], `${printConfig.dibuatJabatan},`],
  ];
  for (const [c1, c2, label] of roles) {
    if (c2 > c1) ws.mergeCells(roleRow, c1, roleRow, c2);
    const cell = ws.getCell(roleRow, c1);
    cell.value = label;
    cell.font = { name: FONT_NAME, size: 10, bold: true, color: { argb: COLOR.textDark } };
    cell.alignment = { horizontal: 'center', vertical: 'middle' };
  }
  ws.getRow(roleRow).height = 20;

  // Space for wet signature
  ws.getRow(roleRow + 1).height = 22;
  ws.getRow(roleRow + 2).height = 22;

  const nameRow = roleRow + 3;
  const names: [number, number, string][] = [
    [leftSpan[0], leftSpan[1], printConfig.mengetahuiNama],
    [midSpan[0], midSpan[1], printConfig.disetujuiNama],
    [rightSpan[0], rightSpan[1], printConfig.dibuatNama],
  ];
  for (const [c1, c2, person] of names) {
    if (c2 > c1) ws.mergeCells(nameRow, c1, nameRow, c2);
    const cell = ws.getCell(nameRow, c1);
    cell.value = person;
    cell.font = {
      name: FONT_NAME,
      size: 10,
      bold: true,
      underline: true,
      color: { argb: COLOR.textDark },
    };
    cell.alignment = { horizontal: 'center', vertical: 'middle' };
  }
  ws.getRow(nameRow).height = 20;
}

function buildKbsSheet(
  wb: ExcelJS.Workbook,
  project: ProjectData,
  period: PeriodData,
  printConfig: PrintConfig
): ExcelJS.Worksheet {
  const ws = wb.addWorksheet('Pengembalian Kas', {
    views: [{ showGridLines: true }],
    pageSetup: {
      paperSize: 9,
      orientation: 'portrait',
      fitToPage: true,
      fitToWidth: 1,
      fitToHeight: 0,
      margins: { left: 0.4, right: 0.4, top: 0.5, bottom: 0.5, header: 0.2, footer: 0.2 },
    },
  });

  const colWidths = [15, 28, 28, 38, 12, 20];
  ws.columns = colWidths.map((width) => ({ width }));

  const kbs = calculateKbsSummary(period);

  // Row 1: Title
  addTitleBanner(ws, 6, 'LAPORAN PENGEMBALIAN KAS PROYEK (KBS)');

  // Rows 2-4: Metadata
  const metaRows: [string, string, string, string][] = [
    ['PROYEK', `: ${project.nama}`, 'MINGGU KE', `: Minggu ke-${period.mingguKe}`],
    ['LOKASI', `: ${project.lokasi}`, 'PERIODE', `: ${period.labelPeriodeKbs}`],
    ['PELAKSANA', `: ${project.pelaksana}`, 'MANDOR', `: ${project.mandor}`],
  ];
  metaRows.forEach((m, idx) => {
    const r = 2 + idx;
    ws.getCell(r, 1).value = m[0];
    ws.mergeCells(r, 2, r, 3);
    ws.getCell(r, 2).value = m[1];
    ws.getCell(r, 4).value = m[2];
    ws.mergeCells(r, 5, r, 6);
    ws.getCell(r, 5).value = m[3];

    styleRange(ws, r, 1, r, 1, {
      font: { size: 10, bold: true, color: { argb: COLOR.textDark } },
      fill: solidFill(COLOR.metaBg),
      border: CELL_BORDER,
      alignment: { horizontal: 'left', vertical: 'middle' },
    });
    styleRange(ws, r, 2, r, 3, {
      font: { size: 10, color: { argb: COLOR.textDark } },
      fill: solidFill(COLOR.white),
      border: CELL_BORDER,
      alignment: { horizontal: 'left', vertical: 'middle', wrapText: true },
    });
    styleRange(ws, r, 4, r, 4, {
      font: { size: 10, bold: true, color: { argb: COLOR.textDark } },
      fill: solidFill(COLOR.metaBg),
      border: CELL_BORDER,
      alignment: { horizontal: 'left', vertical: 'middle' },
    });
    styleRange(ws, r, 5, r, 6, {
      font: { size: 10, color: { argb: COLOR.textDark } },
      fill: solidFill(COLOR.white),
      border: CELL_BORDER,
      alignment: { horizontal: 'left', vertical: 'middle', wrapText: true },
    });
    ws.getRow(r).height = 20;
  });

  ws.getRow(5).height = 10;

  // Section A: PEMASUKAN (DEBET)
  let r = 6;
  ws.mergeCells(r, 1, r, 6);
  ws.getCell(r, 1).value = 'A. PEMASUKAN (DEBET)';
  styleRange(ws, r, 1, r, 6, {
    font: { size: 10.5, bold: true, color: { argb: COLOR.white } },
    fill: solidFill(COLOR.emeraldHeader),
    border: CELL_BORDER,
    alignment: { horizontal: 'left', vertical: 'middle' },
  });
  ws.getRow(r).height = 24;

  r += 1;
  ws.getCell(r, 1).value = 'TANGGAL';
  ws.mergeCells(r, 2, r, 5);
  ws.getCell(r, 2).value = 'KETERANGAN';
  ws.getCell(r, 6).value = 'NOMINAL (Rp)';
  styleRange(ws, r, 1, r, 6, {
    font: { size: 10, bold: true, color: { argb: COLOR.white } },
    fill: solidFill(COLOR.slateDark),
    border: HEADER_BORDER,
    alignment: { horizontal: 'center', vertical: 'middle' },
  });
  ws.getCell(r, 2).alignment = { horizontal: 'left', vertical: 'middle' };
  ws.getCell(r, 6).alignment = { horizontal: 'right', vertical: 'middle' };
  ws.getRow(r).height = 22;

  const pemStartRow = r + 1;
  const pemasukanEntries = [
    {
      tanggal: formatDateShort(period.tanggalSaldoLalu),
      keterangan: 'SISA SALDO MINGGU LALU',
      nominal: kbs.sisaSaldoLalu,
      isBold: true,
    },
    ...period.dropingList.map((d) => ({
      tanggal: formatDateShort(d.tanggal),
      keterangan: d.keterangan,
      nominal: d.nominal,
      isBold: false,
    })),
  ];

  pemasukanEntries.forEach((entry, idx) => {
    r += 1;
    ws.getCell(r, 1).value = entry.tanggal;
    ws.mergeCells(r, 2, r, 5);
    ws.getCell(r, 2).value = entry.keterangan;
    ws.getCell(r, 6).value = entry.nominal;

    const bg = idx % 2 === 1 ? COLOR.zebraBg : COLOR.white;
    styleRange(ws, r, 1, r, 6, {
      font: { size: 10, bold: entry.isBold, color: { argb: COLOR.textDark } },
      fill: solidFill(bg),
      border: CELL_BORDER,
      alignment: { vertical: 'middle', wrapText: true },
    });
    ws.getCell(r, 1).alignment = { horizontal: 'center', vertical: 'middle' };
    ws.getCell(r, 2).alignment = { horizontal: 'left', vertical: 'middle', wrapText: true };
    ws.getCell(r, 6).alignment = { horizontal: 'right', vertical: 'middle' };
    ws.getCell(r, 6).numFmt = CURRENCY_FMT;
    if (entry.nominal < 0) {
      ws.getCell(r, 6).font = { name: FONT_NAME, size: 10, bold: true, color: { argb: COLOR.roseText } };
    }
    ws.getRow(r).height = 21;
  });

  const pemEndRow = r;
  r += 1;
  const totalPemasukanRow = r;
  ws.mergeCells(r, 1, r, 5);
  ws.getCell(r, 1).value = 'TOTAL PEMASUKAN';
  ws.getCell(r, 6).value = { formula: `SUM(F${pemStartRow}:F${pemEndRow})`, result: kbs.totalPemasukan };
  styleRange(ws, r, 1, r, 6, {
    font: { size: 10.5, bold: true, color: { argb: COLOR.emeraldText } },
    fill: solidFill(COLOR.emeraldBg),
    border: SUBTOTAL_BORDER,
    alignment: { horizontal: 'right', vertical: 'middle' },
  });
  ws.getCell(r, 6).numFmt = CURRENCY_FMT;
  ws.getRow(r).height = 24;

  // Spacer
  r += 1;
  ws.getRow(r).height = 10;

  // Section B: PENGELUARAN (KREDIT)
  r += 1;
  ws.mergeCells(r, 1, r, 6);
  ws.getCell(r, 1).value = 'B. PENGELUARAN (KREDIT)';
  styleRange(ws, r, 1, r, 6, {
    font: { size: 10.5, bold: true, color: { argb: COLOR.white } },
    fill: solidFill(COLOR.roseHeader),
    border: CELL_BORDER,
    alignment: { horizontal: 'left', vertical: 'middle' },
  });
  ws.getRow(r).height = 24;

  r += 1;
  const expHeaders = ['TANGGAL', 'KATEGORI', 'TOKO / SUMBER', 'URAIAN ITEM', 'QTY', 'NOMINAL (Rp)'];
  expHeaders.forEach((h, idx) => {
    ws.getCell(r, idx + 1).value = h;
  });
  styleRange(ws, r, 1, r, 6, {
    font: { size: 10, bold: true, color: { argb: COLOR.white } },
    fill: solidFill(COLOR.slateDark),
    border: HEADER_BORDER,
    alignment: { horizontal: 'left', vertical: 'middle' },
  });
  ws.getCell(r, 1).alignment = { horizontal: 'center', vertical: 'middle' };
  ws.getCell(r, 5).alignment = { horizontal: 'center', vertical: 'middle' };
  ws.getCell(r, 6).alignment = { horizontal: 'right', vertical: 'middle' };
  ws.getRow(r).height = 22;

  const subtotalCells: string[] = [];

  if (kbs.groupedExpenses.length === 0) {
    r += 1;
    ws.mergeCells(r, 1, r, 5);
    ws.getCell(r, 1).value = 'Belum ada pengeluaran Kas Proyek pada periode ini.';
    ws.getCell(r, 6).value = 0;
    styleRange(ws, r, 1, r, 6, {
      font: { size: 10, italic: true, color: { argb: COLOR.textMuted } },
      fill: solidFill(COLOR.white),
      border: CELL_BORDER,
      alignment: { horizontal: 'left', vertical: 'middle' },
    });
    ws.getCell(r, 6).alignment = { horizontal: 'right', vertical: 'middle' };
    ws.getCell(r, 6).numFmt = CURRENCY_FMT;
    ws.getRow(r).height = 22;
  } else {
    let rowCounter = 0;
    for (const group of kbs.groupedExpenses) {
      const groupStartRow = r + 1;
      group.lines.forEach((line, lineIdx) => {
        r += 1;
        rowCounter += 1;
        const bg = rowCounter % 2 === 0 ? COLOR.zebraBg : COLOR.white;

        ws.getCell(r, 1).value = lineIdx === 0 ? formatDateShort(line.tanggal) : '';
        ws.getCell(r, 2).value = line.kategori;
        ws.getCell(r, 3).value = line.namaToko;
        ws.getCell(r, 4).value = line.deskripsi;
        ws.getCell(r, 5).value = line.qty;
        ws.getCell(r, 6).value = line.nominal;

        styleRange(ws, r, 1, r, 6, {
          font: { size: 10, color: { argb: COLOR.textDark } },
          fill: solidFill(bg),
          border: CELL_BORDER,
          alignment: { horizontal: 'left', vertical: 'middle', wrapText: true },
        });
        ws.getCell(r, 1).alignment = { horizontal: 'center', vertical: 'middle' };
        ws.getCell(r, 5).alignment = { horizontal: 'center', vertical: 'middle' };
        ws.getCell(r, 6).alignment = { horizontal: 'right', vertical: 'middle' };
        ws.getCell(r, 6).numFmt = CURRENCY_FMT;

        ws.getRow(r).height = calcWrappedRowHeight(
          [
            { text: line.kategori, colWidth: colWidths[1] },
            { text: line.namaToko, colWidth: colWidths[2] },
            { text: line.deskripsi, colWidth: colWidths[3] },
          ],
          20
        );
      });
      const groupEndRow = r;

      // Daily Subtotal Row
      r += 1;
      ws.mergeCells(r, 1, r, 5);
      ws.getCell(r, 1).value = `SUB TOTAL (${formatDateShort(group.tanggal)})`;
      ws.getCell(r, 6).value = {
        formula: `SUM(F${groupStartRow}:F${groupEndRow})`,
        result: group.subTotal,
      };
      subtotalCells.push(`F${r}`);

      styleRange(ws, r, 1, r, 6, {
        font: { size: 10, bold: true, color: { argb: COLOR.textDark } },
        fill: solidFill(COLOR.subtotalBg),
        border: SUBTOTAL_BORDER,
        alignment: { horizontal: 'right', vertical: 'middle' },
      });
      ws.getCell(r, 6).numFmt = CURRENCY_FMT;
      ws.getRow(r).height = 22;
    }
  }

  // TOTAL PENGELUARAN
  r += 1;
  const totalPengeluaranRow = r;
  ws.mergeCells(r, 1, r, 5);
  ws.getCell(r, 1).value = 'TOTAL PENGELUARAN';
  ws.getCell(r, 6).value =
    subtotalCells.length > 0
      ? { formula: subtotalCells.join('+'), result: kbs.totalPengeluaran }
      : 0;
  styleRange(ws, r, 1, r, 6, {
    font: { size: 10.5, bold: true, color: { argb: COLOR.roseText } },
    fill: solidFill(COLOR.roseBg),
    border: SUBTOTAL_BORDER,
    alignment: { horizontal: 'right', vertical: 'middle' },
  });
  ws.getCell(r, 6).numFmt = CURRENCY_FMT;
  ws.getRow(r).height = 24;

  // SISA SALDO AKHIR KAS (KBS)
  r += 1;
  ws.mergeCells(r, 1, r, 5);
  ws.getCell(r, 1).value = 'SISA SALDO AKHIR KAS (KBS)';
  ws.getCell(r, 6).value = {
    formula: `F${totalPemasukanRow}-F${totalPengeluaranRow}`,
    result: kbs.sisaSaldoAkhir,
  };
  styleRange(ws, r, 1, r, 6, {
    font: {
      size: 11,
      bold: true,
      color: { argb: kbs.sisaSaldoAkhir < 0 ? COLOR.roseText : COLOR.textDark },
    },
    fill: solidFill(COLOR.grandTotalBg),
    border: GRAND_TOTAL_BORDER,
    alignment: { horizontal: 'right', vertical: 'middle' },
  });
  ws.getCell(r, 6).numFmt = CURRENCY_FMT;
  ws.getRow(r).height = 26;

  addSignatureBlock(ws, r + 1, [[1, 2], [3, 4], [5, 6]], printConfig);
  return ws;
}

function buildCashflowSheet(
  wb: ExcelJS.Workbook,
  project: ProjectData,
  period: PeriodData,
  printConfig: PrintConfig
): ExcelJS.Worksheet {
  const ws = wb.addWorksheet('Pengajuan Cashflow', {
    views: [{ showGridLines: true }],
    pageSetup: {
      paperSize: 9,
      orientation: 'portrait',
      fitToPage: true,
      fitToWidth: 1,
      fitToHeight: 0,
      margins: { left: 0.4, right: 0.4, top: 0.5, bottom: 0.5, header: 0.2, footer: 0.2 },
    },
  });

  const colWidths = [28, 42, 32, 22];
  ws.columns = colWidths.map((width) => ({ width }));

  const kbs = calculateKbsSummary(period);
  const cf = calculateCashflowSummary(period, kbs.sisaSaldoAkhir);

  // Row 1: Title
  addTitleBanner(ws, 4, 'PENGAJUAN CASHFLOW MINGGUAN PROYEK');

  // Rows 2-4: Metadata
  const metaRows: [string, string, string, string][] = [
    ['PROYEK', `: ${project.nama}`, 'MINGGU KE', `: Minggu ke-${period.mingguKe}`],
    ['LOKASI', `: ${project.lokasi}`, 'PERIODE', `: ${period.labelPeriodeKbs}`],
    ['PELAKSANA', `: ${project.pelaksana}`, 'MANDOR', `: ${project.mandor}`],
  ];
  metaRows.forEach((m, idx) => {
    const r = 2 + idx;
    ws.getCell(r, 1).value = m[0];
    ws.getCell(r, 2).value = m[1];
    ws.getCell(r, 3).value = m[2];
    ws.getCell(r, 4).value = m[3];

    styleRange(ws, r, 1, r, 1, {
      font: { size: 10, bold: true, color: { argb: COLOR.textDark } },
      fill: solidFill(COLOR.metaBg),
      border: CELL_BORDER,
      alignment: { horizontal: 'left', vertical: 'middle' },
    });
    styleRange(ws, r, 2, r, 2, {
      font: { size: 10, color: { argb: COLOR.textDark } },
      fill: solidFill(COLOR.white),
      border: CELL_BORDER,
      alignment: { horizontal: 'left', vertical: 'middle', wrapText: true },
    });
    styleRange(ws, r, 3, r, 3, {
      font: { size: 10, bold: true, color: { argb: COLOR.textDark } },
      fill: solidFill(COLOR.metaBg),
      border: CELL_BORDER,
      alignment: { horizontal: 'left', vertical: 'middle' },
    });
    styleRange(ws, r, 4, r, 4, {
      font: { size: 10, color: { argb: COLOR.textDark } },
      fill: solidFill(COLOR.white),
      border: CELL_BORDER,
      alignment: { horizontal: 'left', vertical: 'middle', wrapText: true },
    });
    ws.getRow(r).height = 20;
  });

  ws.getRow(5).height = 10;

  // Table Header
  let r = 6;
  const headers = ['KELOMPOK', 'URAIAN PENGAJUAN', 'KETERANGAN', 'NOMINAL (Rp)'];
  headers.forEach((h, idx) => {
    ws.getCell(r, idx + 1).value = h;
  });
  styleRange(ws, r, 1, r, 4, {
    font: { size: 10, bold: true, color: { argb: COLOR.white } },
    fill: solidFill(COLOR.slateDark),
    border: HEADER_BORDER,
    alignment: { horizontal: 'left', vertical: 'middle' },
  });
  ws.getCell(r, 4).alignment = { horizontal: 'right', vertical: 'middle' };
  ws.getRow(r).height = 24;

  const groupSubtotalCells: string[] = [];

  for (const grp of CASHFLOW_GROUPS) {
    const data = cf.byGroup[grp.key];

    // Group Header
    r += 1;
    ws.mergeCells(r, 1, r, 4);
    ws.getCell(r, 1).value = grp.label;
    styleRange(ws, r, 1, r, 4, {
      font: { size: 10, bold: true, color: { argb: COLOR.textDark } },
      fill: solidFill(COLOR.groupBg),
      border: CELL_BORDER,
      alignment: { horizontal: 'left', vertical: 'middle' },
    });
    ws.getRow(r).height = 22;

    const grpStartRow = r + 1;
    if (data.items.length === 0) {
      r += 1;
      ws.getCell(r, 1).value = '';
      ws.getCell(r, 2).value = '(Tidak ada pengajuan)';
      ws.getCell(r, 3).value = '';
      ws.getCell(r, 4).value = 0;
      styleRange(ws, r, 1, r, 4, {
        font: { size: 10, italic: true, color: { argb: COLOR.textMuted } },
        fill: solidFill(COLOR.white),
        border: CELL_BORDER,
        alignment: { horizontal: 'left', vertical: 'middle' },
      });
      ws.getCell(r, 4).alignment = { horizontal: 'right', vertical: 'middle' };
      ws.getCell(r, 4).numFmt = CURRENCY_FMT;
      ws.getRow(r).height = 20;
    } else {
      data.items.forEach((item, idx) => {
        r += 1;
        const bg = idx % 2 === 1 ? COLOR.zebraBg : COLOR.white;
        ws.getCell(r, 1).value = '';
        ws.getCell(r, 2).value = item.deskripsi;
        ws.getCell(r, 3).value = item.keterangan ?? '';
        ws.getCell(r, 4).value = item.nominal;

        styleRange(ws, r, 1, r, 4, {
          font: { size: 10, color: { argb: COLOR.textDark } },
          fill: solidFill(bg),
          border: CELL_BORDER,
          alignment: { horizontal: 'left', vertical: 'middle', wrapText: true },
        });
        ws.getCell(r, 4).alignment = { horizontal: 'right', vertical: 'middle' };
        ws.getCell(r, 4).numFmt = CURRENCY_FMT;
        ws.getRow(r).height = calcWrappedRowHeight(
          [
            { text: item.deskripsi, colWidth: colWidths[1] },
            { text: item.keterangan ?? '', colWidth: colWidths[2] },
          ],
          20
        );
      });
    }
    const grpEndRow = r;

    // Group Subtotal
    r += 1;
    ws.mergeCells(r, 1, r, 3);
    ws.getCell(r, 1).value = `Sub Total ${grp.label}`;
    ws.getCell(r, 4).value = {
      formula: `SUM(D${grpStartRow}:D${grpEndRow})`,
      result: data.total,
    };
    groupSubtotalCells.push(`D${r}`);

    styleRange(ws, r, 1, r, 4, {
      font: { size: 10, bold: true, color: { argb: COLOR.textDark } },
      fill: solidFill(COLOR.subtotalBg),
      border: SUBTOTAL_BORDER,
      alignment: { horizontal: 'right', vertical: 'middle' },
    });
    ws.getCell(r, 4).numFmt = CURRENCY_FMT;
    ws.getRow(r).height = 22;
  }

  r += 1;
  ws.getRow(r).height = 8;

  // SUB TOTAL PENGAJUAN (A s/d E)
  r += 1;
  const subTotalRow = r;
  ws.mergeCells(r, 1, r, 3);
  ws.getCell(r, 1).value = 'SUB TOTAL PENGAJUAN (A s/d E)';
  ws.getCell(r, 4).value = {
    formula: groupSubtotalCells.join('+'),
    result: cf.subTotalPengajuan,
  };
  styleRange(ws, r, 1, r, 4, {
    font: { size: 10.5, bold: true, color: { argb: COLOR.textDark } },
    fill: solidFill(COLOR.metaBg),
    border: SUBTOTAL_BORDER,
    alignment: { horizontal: 'right', vertical: 'middle' },
  });
  ws.getCell(r, 4).numFmt = CURRENCY_FMT;
  ws.getRow(r).height = 23;

  // SALDO MINGGU LALU
  r += 1;
  const saldoRow = r;
  ws.mergeCells(r, 1, r, 3);
  ws.getCell(r, 1).value = cf.isOverridden
    ? 'SALDO MINGGU LALU (OVERRIDE MANUAL)'
    : 'SALDO MINGGU LALU (OTOMATIS KBS)';
  ws.getCell(r, 4).value = cf.saldoMingguLaluEffective;
  styleRange(ws, r, 1, r, 4, {
    font: {
      size: 10.5,
      bold: true,
      color: {
        argb: cf.saldoMingguLaluEffective < 0 ? COLOR.roseText : COLOR.emeraldText,
      },
    },
    fill: solidFill(cf.saldoMingguLaluEffective < 0 ? COLOR.roseBg : COLOR.emeraldBg),
    border: SUBTOTAL_BORDER,
    alignment: { horizontal: 'right', vertical: 'middle' },
  });
  ws.getCell(r, 4).numFmt = CURRENCY_FMT;
  ws.getRow(r).height = 23;

  // TOTAL CASHFLOW DIAJUKAN
  r += 1;
  ws.mergeCells(r, 1, r, 3);
  ws.getCell(r, 1).value = 'TOTAL CASHFLOW DIAJUKAN';
  ws.getCell(r, 4).value = {
    formula: `D${subTotalRow}-D${saldoRow}`,
    result: cf.totalCashflowDiajukan,
  };
  styleRange(ws, r, 1, r, 4, {
    font: { size: 11, bold: true, color: { argb: COLOR.textDark } },
    fill: solidFill(COLOR.grandTotalBg),
    border: GRAND_TOTAL_BORDER,
    alignment: { horizontal: 'right', vertical: 'middle' },
  });
  ws.getCell(r, 4).numFmt = CURRENCY_FMT;
  ws.getRow(r).height = 26;

  addSignatureBlock(ws, r + 1, [[1, 1], [2, 2], [3, 4]], printConfig);
  return ws;
}

function buildAbsensiSheet(
  wb: ExcelJS.Workbook,
  project: ProjectData,
  period: PeriodData,
  printConfig: PrintConfig
): ExcelJS.Worksheet {
  const ws = wb.addWorksheet('Absensi', {
    views: [{ showGridLines: true }],
    pageSetup: {
      paperSize: 9,
      orientation: 'landscape',
      fitToPage: true,
      fitToWidth: 1,
      fitToHeight: 0,
      margins: { left: 0.3, right: 0.3, top: 0.4, bottom: 0.4, header: 0.2, footer: 0.2 },
    },
  });

  const dayCount = period.attendanceDates.length;
  const totalCols = 3 + dayCount * 2 + 6; // NO, NAMA, JABATAN + N/L*days + HARI, UPAH, TOTAL, KASBON, TOTAL BAYAR, KET

  const colWidths = [
    5.5, // NO
    19, // NAMA
    11, // JABATAN
    ...Array(dayCount * 2).fill(5.4), // N, L per day (merged pair width = 10.8)
    10.5, // JML HARI
    15, // UPAH
    16, // TOTAL
    15, // KASBON
    17, // TOTAL BAYAR
    25, // KETERANGAN
  ];
  ws.columns = colWidths.map((width) => ({ width }));

  const payroll = calculateWorkerPayroll(
    project.workers,
    period.attendanceDates,
    period.attendance,
    period.kasbonByWorker,
    period.keteranganByWorker
  );

  // Row 1: Title
  addTitleBanner(ws, totalCols, 'LAPORAN ABSENSI & PENGGAJIAN TUKANG MINGGUAN');

  // Rows 2-4: Metadata (merged cleanly so no label ever gets truncated)
  const leftLabelEnd = 2; // cols A..B (width ~24.5)
  const leftValStart = 3;
  const leftValEnd = Math.min(11, totalCols - 8);
  const rightLabelStart = leftValEnd + 1;
  const rightLabelEnd = rightLabelStart + 2; // 3 cols (~16.2)
  const rightValStart = rightLabelEnd + 1;

  const metaRows: [string, string, string, string][] = [
    ['PROYEK', `: ${project.nama}`, 'MINGGU KE', `: Minggu ke-${period.mingguKe}`],
    ['MANDOR', `: ${project.mandor}`, 'PERIODE', `: ${period.labelPeriodeAbsensi}`],
    ['PELAKSANA', `: ${project.pelaksana}`, 'LOKASI', `: ${project.lokasi}`],
  ];

  metaRows.forEach((m, idx) => {
    const r = 2 + idx;
    ws.mergeCells(r, 1, r, leftLabelEnd);
    ws.getCell(r, 1).value = m[0];
    ws.mergeCells(r, leftValStart, r, leftValEnd);
    ws.getCell(r, leftValStart).value = m[1];
    ws.mergeCells(r, rightLabelStart, r, rightLabelEnd);
    ws.getCell(r, rightLabelStart).value = m[2];
    ws.mergeCells(r, rightValStart, r, totalCols);
    ws.getCell(r, rightValStart).value = m[3];

    styleRange(ws, r, 1, r, leftLabelEnd, {
      font: { size: 10, bold: true, color: { argb: COLOR.textDark } },
      fill: solidFill(COLOR.metaBg),
      border: CELL_BORDER,
      alignment: { horizontal: 'left', vertical: 'middle' },
    });
    styleRange(ws, r, leftValStart, r, leftValEnd, {
      font: { size: 10, color: { argb: COLOR.textDark } },
      fill: solidFill(COLOR.white),
      border: CELL_BORDER,
      alignment: { horizontal: 'left', vertical: 'middle' },
    });
    styleRange(ws, r, rightLabelStart, r, rightLabelEnd, {
      font: { size: 10, bold: true, color: { argb: COLOR.textDark } },
      fill: solidFill(COLOR.metaBg),
      border: CELL_BORDER,
      alignment: { horizontal: 'left', vertical: 'middle' },
    });
    styleRange(ws, r, rightValStart, r, totalCols, {
      font: { size: 10, color: { argb: COLOR.textDark } },
      fill: solidFill(COLOR.white),
      border: CELL_BORDER,
      alignment: { horizontal: 'left', vertical: 'middle' },
    });
    ws.getRow(r).height = 20;
  });

  ws.getRow(5).height = 10;

  // Rows 6-7: 2-tier Table Header
  const h1 = 6;
  const h2 = 7;

  // Fixed left headers (merged vertically)
  const leftHeaders: [number, string][] = [
    [1, 'NO'],
    [2, 'NAMA'],
    [3, 'JABATAN'],
  ];
  for (const [col, label] of leftHeaders) {
    ws.mergeCells(h1, col, h2, col);
    ws.getCell(h1, col).value = label;
  }

  // Day headers (each day merged horizontally across N & L)
  period.attendanceDates.forEach((d, idx) => {
    const c1 = 4 + idx * 2;
    const c2 = c1 + 1;
    ws.mergeCells(h1, c1, h1, c2);
    ws.getCell(h1, c1).value = `${getDayLabelShort(d)}\n${d.slice(8, 10)}/${d.slice(5, 7)}`;
    ws.getCell(h2, c1).value = 'N';
    ws.getCell(h2, c2).value = 'L';
  });

  // Summary right headers (merged vertically)
  const colHari = 4 + dayCount * 2;
  const colUpah = colHari + 1;
  const colTotal = colHari + 2;
  const colKasbon = colHari + 3;
  const colBayar = colHari + 4;
  const colKet = colHari + 5;

  const rightHeaders: [number, string][] = [
    [colHari, 'JML\nHARI'],
    [colUpah, 'UPAH\n(Rp)'],
    [colTotal, 'TOTAL\n(Rp)'],
    [colKasbon, 'KASBON\n(Rp)'],
    [colBayar, 'TOTAL BAYAR\n(Rp)'],
    [colKet, 'KETERANGAN'],
  ];
  for (const [col, label] of rightHeaders) {
    ws.mergeCells(h1, col, h2, col);
    ws.getCell(h1, col).value = label;
  }

  styleRange(ws, h1, 1, h1, totalCols, {
    font: { size: 9.5, bold: true, color: { argb: COLOR.white } },
    fill: solidFill(COLOR.navy),
    border: { top: THIN_DARK_SIDE, left: THIN_DARK_SIDE, bottom: THIN_DARK_SIDE, right: THIN_DARK_SIDE },
    alignment: { horizontal: 'center', vertical: 'middle', wrapText: true },
  });
  styleRange(ws, h2, 4, h2, 3 + dayCount * 2, {
    font: { size: 9, bold: true, color: { argb: COLOR.white } },
    fill: solidFill(COLOR.slateMed),
    border: HEADER_BORDER,
    alignment: { horizontal: 'center', vertical: 'middle' },
  });
  // Ensure merged vertical headers keep bottom medium border
  for (const [col] of [...leftHeaders, ...rightHeaders]) {
    ws.getCell(h2, col).border = HEADER_BORDER;
    ws.getCell(h2, col).fill = solidFill(COLOR.navy);
  }
  ws.getCell(h1, 2).alignment = { horizontal: 'left', vertical: 'middle' };
  ws.getCell(h1, colKet).alignment = { horizontal: 'left', vertical: 'middle' };
  ws.getRow(h1).height = 28;
  ws.getRow(h2).height = 18;

  const firstDataRow = h2 + 1;
  let r = h2;

  payroll.rows.forEach((row, idx) => {
    r += 1;
    const bg = idx % 2 === 1 ? COLOR.zebraBg : COLOR.white;

    ws.getCell(r, 1).value = idx + 1;
    ws.getCell(r, 2).value = row.worker.nama;
    ws.getCell(r, 3).value = row.worker.jabatan;

    const firstDayColLetter = ws.getColumn(4).letter;
    const lastDayColLetter = ws.getColumn(3 + dayCount * 2).letter;
    const hariColLetter = ws.getColumn(colHari).letter;
    const upahColLetter = ws.getColumn(colUpah).letter;
    const totalColLetter = ws.getColumn(colTotal).letter;
    const kasbonColLetter = ws.getColumn(colKasbon).letter;

    period.attendanceDates.forEach((d, dIdx) => {
      const rec = row.daily[d];
      const c1 = 4 + dIdx * 2;
      const c2 = c1 + 1;
      ws.getCell(r, c1).value = rec?.normal ?? 0;
      ws.getCell(r, c2).value = rec?.lembur ?? 0;
    });

    ws.getCell(r, colHari).value = {
      formula: `SUM(${firstDayColLetter}${r}:${lastDayColLetter}${r})`,
      result: row.jmlHari,
    };
    ws.getCell(r, colUpah).value = row.upah;
    ws.getCell(r, colTotal).value = {
      formula: `ROUND(${hariColLetter}${r}*${upahColLetter}${r},0)`,
      result: row.totalKotor,
    };
    ws.getCell(r, colKasbon).value = row.kasbon;
    ws.getCell(r, colBayar).value = {
      formula: `${totalColLetter}${r}-${kasbonColLetter}${r}`,
      result: row.totalBayar,
    };
    ws.getCell(r, colKet).value = row.keterangan;

    styleRange(ws, r, 1, r, totalCols, {
      font: { size: 10, color: { argb: COLOR.textDark } },
      fill: solidFill(bg),
      border: CELL_BORDER,
      alignment: { horizontal: 'center', vertical: 'middle' },
    });

    ws.getCell(r, 2).alignment = { horizontal: 'left', vertical: 'middle' };
    ws.getCell(r, 2).font = { name: FONT_NAME, size: 10, bold: true, color: { argb: COLOR.textDark } };
    ws.getCell(r, 3).font = {
      name: FONT_NAME,
      size: 9.5,
      bold: true,
      color: { argb: row.worker.jabatan === 'MANDOR' ? COLOR.emeraldText : COLOR.textMuted },
    };

    // Format day cells N/L
    for (let dc = 4; dc <= 3 + dayCount * 2; dc++) {
      const cell = ws.getCell(r, dc);
      cell.numFmt = DAYS_FMT;
      const val = Number(cell.value) || 0;
      const isLembur = (dc - 4) % 2 === 1;
      if (val > 0 && isLembur) {
        cell.fill = solidFill(COLOR.amberSoft);
        cell.font = { name: FONT_NAME, size: 9.5, bold: true, color: { argb: 'FFB45309' } };
      } else if (val > 0) {
        cell.font = { name: FONT_NAME, size: 9.5, bold: true, color: { argb: COLOR.emeraldText } };
      } else {
        cell.font = { name: FONT_NAME, size: 9.5, color: { argb: 'FF94A3B8' } };
      }
    }

    ws.getCell(r, colHari).numFmt = '0.##';
    ws.getCell(r, colHari).alignment = { horizontal: 'right', vertical: 'middle' };
    ws.getCell(r, colHari).font = { name: FONT_NAME, size: 10, bold: true, color: { argb: COLOR.textDark } };

    for (const c of [colUpah, colTotal, colKasbon, colBayar]) {
      ws.getCell(r, c).numFmt = CURRENCY_FMT;
      ws.getCell(r, c).alignment = { horizontal: 'right', vertical: 'middle' };
    }
    if (row.kasbon > 0) {
      ws.getCell(r, colKasbon).font = { name: FONT_NAME, size: 10, bold: true, color: { argb: COLOR.roseText } };
    }

    // Highlight TOTAL BAYAR column subtly
    ws.getCell(r, colBayar).fill = solidFill(COLOR.emeraldSoft);
    ws.getCell(r, colBayar).font = { name: FONT_NAME, size: 10, bold: true, color: { argb: COLOR.emeraldText } };

    ws.getCell(r, colKet).alignment = { horizontal: 'left', vertical: 'middle', wrapText: true };
    ws.getRow(r).height = calcWrappedRowHeight(
      [{ text: row.keterangan, colWidth: colWidths[colKet - 1] }],
      21
    );
  });

  const lastDataRow = r;

  // GRAND TOTAL row
  r += 1;
  ws.mergeCells(r, 1, r, 3 + dayCount * 2);
  ws.getCell(r, 1).value = 'GRAND TOTAL';

  const hariLetter = ws.getColumn(colHari).letter;
  const totalLetter = ws.getColumn(colTotal).letter;
  const kasbonLetter = ws.getColumn(colKasbon).letter;
  const bayarLetter = ws.getColumn(colBayar).letter;

  ws.getCell(r, colHari).value =
    payroll.rows.length > 0
      ? { formula: `SUM(${hariLetter}${firstDataRow}:${hariLetter}${lastDataRow})`, result: payroll.grandTotalHari }
      : 0;
  ws.getCell(r, colUpah).value = '-';
  ws.getCell(r, colTotal).value =
    payroll.rows.length > 0
      ? { formula: `SUM(${totalLetter}${firstDataRow}:${totalLetter}${lastDataRow})`, result: payroll.grandTotalKotor }
      : 0;
  ws.getCell(r, colKasbon).value =
    payroll.rows.length > 0
      ? { formula: `SUM(${kasbonLetter}${firstDataRow}:${kasbonLetter}${lastDataRow})`, result: payroll.grandTotalKasbon }
      : 0;
  ws.getCell(r, colBayar).value =
    payroll.rows.length > 0
      ? { formula: `SUM(${bayarLetter}${firstDataRow}:${bayarLetter}${lastDataRow})`, result: payroll.grandTotalBayar }
      : 0;
  ws.getCell(r, colKet).value = '';

  styleRange(ws, r, 1, r, totalCols, {
    font: { size: 10.5, bold: true, color: { argb: COLOR.textDark } },
    fill: solidFill(COLOR.grandTotalBg),
    border: GRAND_TOTAL_BORDER,
    alignment: { horizontal: 'right', vertical: 'middle' },
  });
  ws.getCell(r, colUpah).alignment = { horizontal: 'center', vertical: 'middle' };
  ws.getCell(r, colHari).numFmt = '0.##';
  ws.getCell(r, colTotal).numFmt = CURRENCY_FMT;
  ws.getCell(r, colKasbon).numFmt = CURRENCY_FMT;
  ws.getCell(r, colBayar).numFmt = CURRENCY_FMT;
  ws.getCell(r, colBayar).font = { name: FONT_NAME, size: 11, bold: true, color: { argb: COLOR.emeraldText } };
  ws.getRow(r).height = 25;

  // Signature block spread cleanly across 3 thirds of the 23 columns
  const third = Math.floor(totalCols / 3);
  addSignatureBlock(
    ws,
    r + 1,
    [
      [1, third],
      [third + 1, third * 2],
      [third * 2 + 1, totalCols],
    ],
    printConfig
  );

  return ws;
}

async function downloadWorkbook(wb: ExcelJS.Workbook, fileName: string): Promise<void> {
  const buffer = await wb.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function buildKbsWorkbook(
  project: ProjectData,
  period: PeriodData,
  printConfig: PrintConfig
): ExcelJS.Workbook {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'ProyekKas & Absensi';
  wb.created = new Date();
  buildKbsSheet(wb, project, period, printConfig);
  return wb;
}

export function buildCashflowWorkbook(
  project: ProjectData,
  period: PeriodData,
  printConfig: PrintConfig
): ExcelJS.Workbook {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'ProyekKas & Absensi';
  wb.created = new Date();
  buildCashflowSheet(wb, project, period, printConfig);
  return wb;
}

export function buildAbsensiWorkbook(
  project: ProjectData,
  period: PeriodData,
  printConfig: PrintConfig
): ExcelJS.Workbook {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'ProyekKas & Absensi';
  wb.created = new Date();
  buildAbsensiSheet(wb, project, period, printConfig);
  return wb;
}

export function buildAllReportsWorkbook(
  project: ProjectData,
  period: PeriodData,
  printConfig: PrintConfig
): ExcelJS.Workbook {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'ProyekKas & Absensi';
  wb.created = new Date();
  buildAbsensiSheet(wb, project, period, printConfig);
  buildKbsSheet(wb, project, period, printConfig);
  buildCashflowSheet(wb, project, period, printConfig);
  return wb;
}

export async function exportKbsExcel(
  project: ProjectData,
  period: PeriodData,
  printConfig: PrintConfig
): Promise<void> {
  const wb = buildKbsWorkbook(project, period, printConfig);
  const fileName = `Pengembalian_Kas_${sanitizeFileName(project.nama)}_M${period.mingguKe}.xlsx`;
  await downloadWorkbook(wb, fileName);
}

export async function exportCashflowExcel(
  project: ProjectData,
  period: PeriodData,
  printConfig: PrintConfig
): Promise<void> {
  const wb = buildCashflowWorkbook(project, period, printConfig);
  const fileName = `Pengajuan_Cashflow_${sanitizeFileName(project.nama)}_M${period.mingguKe}.xlsx`;
  await downloadWorkbook(wb, fileName);
}

export async function exportAbsensiExcel(
  project: ProjectData,
  period: PeriodData,
  printConfig: PrintConfig
): Promise<void> {
  const wb = buildAbsensiWorkbook(project, period, printConfig);
  const fileName = `Absensi_Penggajian_${sanitizeFileName(project.nama)}_M${period.mingguKe}.xlsx`;
  await downloadWorkbook(wb, fileName);
}

export async function exportAllReportsExcel(
  project: ProjectData,
  period: PeriodData,
  printConfig: PrintConfig
): Promise<void> {
  const wb = buildAllReportsWorkbook(project, period, printConfig);
  const fileName = `Laporan_Lengkap_${sanitizeFileName(project.nama)}_M${period.mingguKe}.xlsx`;
  await downloadWorkbook(wb, fileName);
}
