import type {
  AttendanceMatrix,
  CashflowGroupKey,
  CashflowItem,
  ExpenseTransaction,
  PeriodData,
  Worker,
} from '../types';

export function formatRupiah(value: number): string {
  const safeVal = Number.isFinite(value) ? Math.round(value) : 0;
  const isNeg = safeVal < 0;
  const absFormatted = Math.abs(safeVal)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return isNeg ? `-Rp ${absFormatted}` : `Rp ${absFormatted}`;
}

export function formatNumberId(value: number): string {
  const safeVal = Number.isFinite(value) ? Math.round(value) : 0;
  const isNeg = safeVal < 0;
  const absFormatted = Math.abs(safeVal)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return isNeg ? `-${absFormatted}` : absFormatted;
}

export function formatDays(value: number): string {
  if (!Number.isFinite(value) || value === 0) return '0';
  return Number.isInteger(value) ? String(value) : value.toFixed(1).replace(/\.0$/, '');
}

const BULAN_SHORT = [
  'Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun',
  'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des',
];

const BULAN_LONG = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember',
];

const HARI_SHORT = ['Mg', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];
const HARI_LONG = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];

export function parseIsoDateParts(isoDate: string): { year: number; month: number; day: number } | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(isoDate);
  if (!match) return null;
  return {
    year: Number(match[1]),
    month: Number(match[2]),
    day: Number(match[3]),
  };
}

export function formatDateShort(isoDate: string): string {
  const parts = parseIsoDateParts(isoDate);
  if (!parts) return isoDate;
  return `${parts.day} ${BULAN_SHORT[parts.month - 1] ?? ''} ${parts.year}`;
}

export function formatDateIndo(isoDate: string): string {
  const parts = parseIsoDateParts(isoDate);
  if (!parts) return isoDate;
  return `${parts.day} ${BULAN_LONG[parts.month - 1] ?? ''} ${parts.year}`;
}

export function getDayLabelShort(isoDate: string): string {
  const parts = parseIsoDateParts(isoDate);
  if (!parts) return isoDate;
  const d = new Date(Date.UTC(parts.year, parts.month - 1, parts.day));
  return HARI_SHORT[d.getUTCDay()] ?? '';
}

export function getDayLabelLong(isoDate: string): string {
  const parts = parseIsoDateParts(isoDate);
  if (!parts) return isoDate;
  const d = new Date(Date.UTC(parts.year, parts.month - 1, parts.day));
  return HARI_LONG[d.getUTCDay()] ?? '';
}

export interface KbsExpenseLine {
  transactionId: string;
  itemId: string;
  tanggal: string;
  namaToko: string;
  kategori: ExpenseTransaction['kategori'];
  deskripsi: string;
  qty: string;
  nominal: number;
  hasPhoto: boolean;
  fotoNota?: string;
}

export interface KbsDateGroup {
  tanggal: string;
  lines: KbsExpenseLine[];
  subTotal: number;
}

export interface KbsSummary {
  sisaSaldoLalu: number;
  totalDroping: number;
  totalPemasukan: number;
  groupedExpenses: KbsDateGroup[];
  totalPengeluaran: number;
  sisaSaldoAkhir: number;
}

export function calculateKbsSummary(period: PeriodData): KbsSummary {
  const sisaSaldoLalu = Number(period.sisaSaldoLalu) || 0;
  const totalDroping = period.dropingList.reduce(
    (sum, entry) => sum + (Number(entry.nominal) || 0),
    0
  );
  const totalPemasukan = sisaSaldoLalu + totalDroping;

  const kbsTx = period.transactions.filter((tx) => tx.sumberDana === 'KBS');
  const mapByDate = new Map<string, KbsExpenseLine[]>();

  for (const tx of kbsTx) {
    const existing = mapByDate.get(tx.tanggal) ?? [];
    if (tx.items.length > 0) {
      for (const item of tx.items) {
        existing.push({
          transactionId: tx.id,
          itemId: item.id,
          tanggal: tx.tanggal,
          namaToko: tx.namaToko,
          kategori: tx.kategori,
          deskripsi: item.deskripsi,
          qty: item.qty,
          nominal: Number(item.nominal) || 0,
          hasPhoto: Boolean(tx.fotoNota),
          fotoNota: tx.fotoNota,
        });
      }
    } else {
      existing.push({
        transactionId: tx.id,
        itemId: `${tx.id}-single`,
        tanggal: tx.tanggal,
        namaToko: tx.namaToko,
        kategori: tx.kategori,
        deskripsi: tx.namaToko,
        qty: '1 ls',
        nominal: Number(tx.totalNominal) || 0,
        hasPhoto: Boolean(tx.fotoNota),
        fotoNota: tx.fotoNota,
      });
    }
    mapByDate.set(tx.tanggal, existing);
  }

  const sortedDates = Array.from(mapByDate.keys()).sort((a, b) => a.localeCompare(b));
  const groupedExpenses: KbsDateGroup[] = sortedDates.map((tanggal) => {
    const lines = mapByDate.get(tanggal) ?? [];
    const subTotal = lines.reduce((sum, l) => sum + l.nominal, 0);
    return { tanggal, lines, subTotal };
  });

  const totalPengeluaran = groupedExpenses.reduce((sum, g) => sum + g.subTotal, 0);
  const sisaSaldoAkhir = totalPemasukan - totalPengeluaran;

  return {
    sisaSaldoLalu,
    totalDroping,
    totalPemasukan,
    groupedExpenses,
    totalPengeluaran,
    sisaSaldoAkhir,
  };
}

export interface RembesSummary {
  transactions: ExpenseTransaction[];
  pendingCount: number;
  approvedCount: number;
  paidCount: number;
  pendingTotal: number;
  approvedTotal: number;
  paidTotal: number;
  unpaidTotal: number; // Menunggu + Disetujui (belum diganti/lunas)
}

export function calculateRembesSummary(period: PeriodData): RembesSummary {
  const transactions = period.transactions
    .filter((tx) => tx.sumberDana === 'REMBES')
    .sort((a, b) => b.tanggal.localeCompare(a.tanggal));

  let pendingCount = 0;
  let approvedCount = 0;
  let paidCount = 0;
  let pendingTotal = 0;
  let approvedTotal = 0;
  let paidTotal = 0;

  for (const tx of transactions) {
    const status = tx.rembesStatus ?? 'Menunggu';
    const amt = Number(tx.totalNominal) || 0;
    if (status === 'Menunggu') {
      pendingCount += 1;
      pendingTotal += amt;
    } else if (status === 'Disetujui') {
      approvedCount += 1;
      approvedTotal += amt;
    } else {
      paidCount += 1;
      paidTotal += amt;
    }
  }

  return {
    transactions,
    pendingCount,
    approvedCount,
    paidCount,
    pendingTotal,
    approvedTotal,
    paidTotal,
    unpaidTotal: pendingTotal + approvedTotal,
  };
}

export interface CashflowSummary {
  byGroup: Record<CashflowGroupKey, { items: CashflowItem[]; total: number }>;
  subTotalPengajuan: number;
  saldoMingguLaluAuto: number;
  saldoMingguLaluEffective: number;
  isOverridden: boolean;
  totalCashflowDiajukan: number;
}

export function calculateCashflowSummary(
  period: PeriodData,
  kbsEndingBalance: number
): CashflowSummary {
  const keys: CashflowGroupKey[] = ['A', 'B', 'C', 'D', 'E'];
  const byGroup = {} as Record<CashflowGroupKey, { items: CashflowItem[]; total: number }>;

  for (const k of keys) {
    const items = period.cashflowItems.filter((item) => item.group === k);
    const total = items.reduce((sum, item) => sum + (Number(item.nominal) || 0), 0);
    byGroup[k] = { items, total };
  }

  const subTotalPengajuan = keys.reduce((sum, k) => sum + byGroup[k].total, 0);
  const isOverridden = period.saldoLaluOverride !== null && Number.isFinite(period.saldoLaluOverride);
  const saldoMingguLaluEffective = isOverridden
    ? Number(period.saldoLaluOverride)
    : kbsEndingBalance;

  // Rumus resmi: SUB TOTAL PENGAJUAN - SALDO MINGGU LALU
  const totalCashflowDiajukan = subTotalPengajuan - saldoMingguLaluEffective;

  return {
    byGroup,
    subTotalPengajuan,
    saldoMingguLaluAuto: kbsEndingBalance,
    saldoMingguLaluEffective,
    isOverridden,
    totalCashflowDiajukan,
  };
}

export interface WorkerPayrollRow {
  worker: Worker;
  daily: Record<string, { normal: number; lembur: number; catatan?: string }>;
  totalNormal: number;
  totalLembur: number;
  jmlHari: number;
  upah: number;
  totalKotor: number;
  kasbon: number;
  totalBayar: number;
  keterangan: string;
}

export interface PayrollSummary {
  rows: WorkerPayrollRow[];
  grandTotalNormal: number;
  grandTotalLembur: number;
  grandTotalHari: number;
  grandTotalKotor: number;
  grandTotalKasbon: number;
  grandTotalBayar: number;
}

export function calculateWorkerPayroll(
  workers: Worker[],
  attendanceDates: string[],
  attendance: AttendanceMatrix,
  kasbonByWorker: Record<string, number>,
  keteranganByWorker: Record<string, string>
): PayrollSummary {
  const activeWorkers = workers.filter((w) => w.aktif);

  let grandTotalNormal = 0;
  let grandTotalLembur = 0;
  let grandTotalHari = 0;
  let grandTotalKotor = 0;
  let grandTotalKasbon = 0;
  let grandTotalBayar = 0;

  const rows: WorkerPayrollRow[] = activeWorkers.map((worker) => {
    const workerDays = attendance[worker.id] ?? {};
    const daily: Record<string, { normal: number; lembur: number; catatan?: string }> = {};

    let totalNormal = 0;
    let totalLembur = 0;

    for (const date of attendanceDates) {
      const rec = workerDays[date];
      const normal = Math.max(0, Number(rec?.normal) || 0);
      const lembur = Math.max(0, Number(rec?.lembur) || 0);
      daily[date] = { normal, lembur, catatan: rec?.catatan };
      totalNormal += normal;
      totalLembur += lembur;
    }

    const jmlHari = Math.round((totalNormal + totalLembur) * 100) / 100;
    const upah = Math.max(0, Number(worker.upahHarian) || 0);
    const totalKotor = Math.round(jmlHari * upah);
    const kasbon = Math.max(0, Math.round(Number(kasbonByWorker[worker.id]) || 0));
    const totalBayar = totalKotor - kasbon;
    const keterangan = keteranganByWorker[worker.id] ?? '';

    grandTotalNormal += totalNormal;
    grandTotalLembur += totalLembur;
    grandTotalHari += jmlHari;
    grandTotalKotor += totalKotor;
    grandTotalKasbon += kasbon;
    grandTotalBayar += totalBayar;

    return {
      worker,
      daily,
      totalNormal,
      totalLembur,
      jmlHari,
      upah,
      totalKotor,
      kasbon,
      totalBayar,
      keterangan,
    };
  });

  return {
    rows,
    grandTotalNormal: Math.round(grandTotalNormal * 100) / 100,
    grandTotalLembur: Math.round(grandTotalLembur * 100) / 100,
    grandTotalHari: Math.round(grandTotalHari * 100) / 100,
    grandTotalKotor,
    grandTotalKasbon,
    grandTotalBayar,
  };
}
