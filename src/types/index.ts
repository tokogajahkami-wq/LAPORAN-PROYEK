export type RoleMode = 'mandor' | 'admin';

export type MainTab = 'dashboard' | 'kas' | 'absensi' | 'laporan';

export type ExpenseCategory =
  | 'MATERIAL & ALAT BANTU'
  | 'BBM'
  | 'OPERASIONAL & LISTRIK'
  | 'KOORDINASI / LINGKUNGAN'
  | 'ALAT'
  | 'POTONGAN SUBKON'
  | 'LAIN-LAIN';

export const EXPENSE_CATEGORIES: ExpenseCategory[] = [
  'MATERIAL & ALAT BANTU',
  'BBM',
  'OPERASIONAL & LISTRIK',
  'KOORDINASI / LINGKUNGAN',
  'ALAT',
  'POTONGAN SUBKON',
  'LAIN-LAIN',
];

export type FundingSource = 'KBS' | 'REMBES';

export type RembesStatus = 'Menunggu' | 'Disetujui' | 'Lunas';

export type WorkerRole = 'MANDOR' | 'TUKANG' | 'TENAGA';

export type CashflowGroupKey = 'A' | 'B' | 'C' | 'D' | 'E';

export const CASHFLOW_GROUPS: { key: CashflowGroupKey; label: string }[] = [
  { key: 'A', label: 'A. KAS' },
  { key: 'B', label: 'B. LAIN-LAIN / MATERIAL' },
  { key: 'C', label: 'C. BBM' },
  { key: 'D', label: 'D. KANTOR' },
  { key: 'E', label: 'E. ALAT' },
];

export interface TransactionItem {
  id: string;
  deskripsi: string;
  qty: string;
  nominal: number;
}

export interface ExpenseTransaction {
  id: string;
  tanggal: string; // YYYY-MM-DD
  namaToko: string;
  kategori: ExpenseCategory;
  sumberDana: FundingSource;
  items: TransactionItem[];
  totalNominal: number;
  fotoNota?: string; // base64 data URL
  catatan?: string;
  // Khusus Rembes
  namaPengaju?: string;
  rembesStatus?: RembesStatus;
  createdAt: string;
}

export interface DropingEntry {
  id: string;
  tanggal: string; // YYYY-MM-DD
  keterangan: string;
  nominal: number;
}

export interface CashflowItem {
  id: string;
  group: CashflowGroupKey;
  deskripsi: string;
  nominal: number;
  keterangan?: string;
}

export interface Worker {
  id: string;
  nama: string;
  jabatan: WorkerRole;
  upahHarian: number;
  mandor: string;
  aktif: boolean;
}

export interface DayAttendanceRecord {
  normal: number; // e.g., 0, 0.5, 1
  lembur: number; // e.g., 0, 0.5, 1, or custom numeric
  catatan?: string;
}

// Keyed by workerId -> isoDate (YYYY-MM-DD) -> DayAttendanceRecord
export type AttendanceMatrix = Record<string, Record<string, DayAttendanceRecord>>;

export interface PeriodData {
  id: string;
  mingguKe: number;
  labelPeriodeAbsensi: string; // e.g. "8 - 14 November 2026"
  labelPeriodeKbs: string; // e.g. "s/d 16 November 2026"
  attendanceDates: string[]; // 7 ISO dates: Minggu .. Sabtu
  // KBS Opening Balance (can be negative!)
  sisaSaldoLalu: number;
  tanggalSaldoLalu: string; // YYYY-MM-DD
  dropingList: DropingEntry[];
  transactions: ExpenseTransaction[];
  // Cashflow proposal
  cashflowItems: CashflowItem[];
  saldoLaluOverride: number | null; // null = auto pull from KBS Sisa Saldo Akhir
  // Attendance & Payroll
  attendance: AttendanceMatrix;
  kasbonByWorker: Record<string, number>;
  keteranganByWorker: Record<string, string>;
}

export interface ProjectData {
  id: string;
  nama: string;
  lokasi: string;
  pelaksana: string;
  mandor: string;
  workers: Worker[];
  periods: PeriodData[];
}

export interface PrintConfig {
  kota: string;
  tanggalCetak: string; // YYYY-MM-DD
  mengetahuiNama: string;
  mengetahuiJabatan: string;
  disetujuiNama: string;
  disetujuiJabatan: string;
  dibuatNama: string;
  dibuatJabatan: string;
  sertakanFotoNota: boolean;
}

export interface AppState {
  version: number;
  roleMode: RoleMode;
  activeProjectId: string;
  activePeriodId: string;
  projects: ProjectData[];
  printConfig: PrintConfig;
}

export interface ScannedReceiptResult {
  tanggal: string;
  nama_toko: string;
  kategori: ExpenseCategory;
  items: {
    deskripsi: string;
    qty: string;
    nominal: number;
  }[];
  total_nominal: number;
}
