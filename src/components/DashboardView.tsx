import React from 'react';
import {
  Camera,
  ClipboardCheck,
  ArrowDownCircle,
  ChevronRight,
  Image as ImageIcon,
} from 'lucide-react';
import type { ExpenseTransaction, MainTab, PeriodData, ProjectData, RoleMode } from '../types';
import {
  calculateCashflowSummary,
  calculateKbsSummary,
  calculateRembesSummary,
  calculateWorkerPayroll,
  formatDateShort,
  formatDays,
  formatRupiah,
} from '../utils/calculations';

interface DashboardViewProps {
  project: ProjectData;
  period: PeriodData;
  roleMode: RoleMode;
  onNavigate: (tab: MainTab, subTab?: string) => void;
  onOpenScanNota: (initialMode?: 'scan' | 'manual' | 'droping') => void;
  onViewPhoto: (tx: ExpenseTransaction) => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  project,
  period,
  roleMode,
  onNavigate,
  onOpenScanNota,
  onViewPhoto,
}) => {
  const kbs = calculateKbsSummary(period);
  const rembes = calculateRembesSummary(period);
  const payroll = calculateWorkerPayroll(
    project.workers,
    period.attendanceDates,
    period.attendance,
    period.kasbonByWorker,
    period.keteranganByWorker
  );
  const cashflow = calculateCashflowSummary(period, kbs.sisaSaldoAkhir);

  const recentTransactions = [...period.transactions]
    .sort((a, b) => {
      const dateCmp = b.tanggal.localeCompare(a.tanggal);
      if (dateCmp !== 0) return dateCmp;
      return b.createdAt.localeCompare(a.createdAt);
    })
    .slice(0, 5);

  return (
    <div className="space-y-6">
      {/* Page Title & Context */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-slate-900">
            Ringkasan Proyek
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            <span>{project.nama}</span>
            <span aria-hidden="true" className="mx-1.5 text-slate-300">·</span>
            <span>Minggu ke-{period.mingguKe}</span>
            <span aria-hidden="true" className="mx-1.5 text-slate-300">·</span>
            <span>Pelaksana: {project.pelaksana}</span>
          </p>
        </div>
        <div className="text-xs text-slate-500">
          Mode aktif:{' '}
          <span className="font-semibold text-slate-800">
            {roleMode === 'admin' ? 'Admin / Owner (Approval Aktif)' : 'Lapangan / Mandor'}
          </span>
        </div>
      </div>

      {/* Quick Actions Bar */}
      <section aria-label="Aksi Cepat" className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <button
          type="button"
          onClick={() => onOpenScanNota('scan')}
          className="min-h-[52px] flex items-center justify-center gap-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 active:scale-[0.99] text-slate-950 font-bold text-sm px-4 py-3 transition-all shadow-xs cursor-pointer whitespace-nowrap"
        >
          <Camera className="w-5 h-5 shrink-0" />
          <span>+ Scan Nota</span>
        </button>
        <button
          type="button"
          onClick={() => onNavigate('absensi', 'harian')}
          className="min-h-[52px] flex items-center justify-center gap-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 active:scale-[0.99] text-white font-semibold text-sm px-4 py-3 transition-all cursor-pointer whitespace-nowrap"
        >
          <ClipboardCheck className="w-5 h-5 text-amber-400 shrink-0" />
          <span>+ Input Absen Hari Ini</span>
        </button>
        <button
          type="button"
          onClick={() => onOpenScanNota('droping')}
          className="min-h-[52px] flex items-center justify-center gap-2.5 rounded-xl bg-white hover:bg-slate-100 active:scale-[0.99] text-slate-900 font-semibold text-sm px-4 py-3 border border-slate-300 transition-all cursor-pointer whitespace-nowrap"
        >
          <ArrowDownCircle className="w-5 h-5 text-emerald-600 shrink-0" />
          <span>+ Catat Droping Dana</span>
        </button>
      </section>

      {/* 4 Real-Time KPI Summary Cards */}
      <section aria-label="Indikator Utama" className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {/* KPI 1: Sisa Saldo Kas (KBS) */}
        <button
          type="button"
          onClick={() => onNavigate('kas', 'kbs')}
          className="text-left bg-white rounded-2xl border border-slate-200 p-5 hover:border-slate-300 transition-colors cursor-pointer flex flex-col justify-between gap-3"
        >
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-semibold text-slate-500">Sisa Saldo Kas (KBS)</span>
            <ChevronRight className="w-4 h-4 text-slate-400 shrink-0" />
          </div>
          <div
            className={`text-2xl font-bold font-mono-num tracking-tight ${
              kbs.sisaSaldoAkhir < 0 ? 'text-rose-600' : 'text-emerald-600'
            }`}
            data-testid="kpi-kbs-balance"
          >
            {formatRupiah(kbs.sisaSaldoAkhir)}
          </div>
          <div className="text-xs text-slate-500 font-mono-num">
            Masuk {formatRupiah(kbs.totalPemasukan)} · Keluar {formatRupiah(kbs.totalPengeluaran)}
          </div>
        </button>

        {/* KPI 2: Tagihan Rembes */}
        <button
          type="button"
          onClick={() => onNavigate('kas', 'rembes')}
          className="text-left bg-white rounded-2xl border border-slate-200 p-5 hover:border-slate-300 transition-colors cursor-pointer flex flex-col justify-between gap-3"
        >
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-semibold text-slate-500">Tagihan Rembes (Pribadi)</span>
            <ChevronRight className="w-4 h-4 text-slate-400 shrink-0" />
          </div>
          <div
            className={`text-2xl font-bold font-mono-num tracking-tight ${
              rembes.unpaidTotal > 0 ? 'text-amber-600' : 'text-slate-900'
            }`}
            data-testid="kpi-rembes-unpaid"
          >
            {formatRupiah(rembes.unpaidTotal)}
          </div>
          <div className="text-xs text-slate-500">
            {rembes.pendingCount} menunggu approval · {rembes.approvedCount} disetujui
          </div>
        </button>

        {/* KPI 3: Estimasi Gaji Tukang Minggu Ini */}
        <button
          type="button"
          onClick={() => onNavigate('absensi', 'rekap')}
          className="text-left bg-white rounded-2xl border border-slate-200 p-5 hover:border-slate-300 transition-colors cursor-pointer flex flex-col justify-between gap-3"
        >
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-semibold text-slate-500">Estimasi Gaji Tukang</span>
            <ChevronRight className="w-4 h-4 text-slate-400 shrink-0" />
          </div>
          <div
            className="text-2xl font-bold font-mono-num tracking-tight text-slate-900"
            data-testid="kpi-payroll-total"
          >
            {formatRupiah(payroll.grandTotalBayar)}
          </div>
          <div className="text-xs text-slate-500">
            {payroll.rows.length} pekerja aktif · {formatDays(payroll.grandTotalHari)} total hari kerja
          </div>
        </button>

        {/* KPI 4: Estimasi Pengajuan Cashflow */}
        <button
          type="button"
          onClick={() => onNavigate('kas', 'cashflow')}
          className="text-left bg-white rounded-2xl border border-slate-200 p-5 hover:border-slate-300 transition-colors cursor-pointer flex flex-col justify-between gap-3"
        >
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-semibold text-slate-500">Estimasi Pengajuan Cashflow</span>
            <ChevronRight className="w-4 h-4 text-slate-400 shrink-0" />
          </div>
          <div
            className="text-2xl font-bold font-mono-num tracking-tight text-slate-900"
            data-testid="kpi-cashflow-total"
          >
            {formatRupiah(cashflow.totalCashflowDiajukan)}
          </div>
          <div className="text-xs text-slate-500 font-mono-num">
            Pengajuan {formatRupiah(cashflow.subTotalPengajuan)} − Saldo {formatRupiah(cashflow.saldoMingguLaluEffective)}
          </div>
        </button>
      </section>

      {/* Recent 5 Transactions */}
      <section className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between gap-4">
          <div>
            <h2 className="text-base font-bold text-slate-900">5 Transaksi Terakhir</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Pengeluaran KBS dan pengajuan Rembes periode {period.labelPeriodeKbs}
            </p>
          </div>
          <button
            type="button"
            onClick={() => onNavigate('kas', 'kbs')}
            className="text-xs font-semibold text-slate-700 hover:text-slate-900 underline underline-offset-4 cursor-pointer whitespace-nowrap shrink-0"
          >
            Lihat semua
          </button>
        </div>

        {recentTransactions.length === 0 ? (
          <div className="p-8 text-center">
            <p className="text-sm text-slate-500">Belum ada transaksi tercatat di periode ini.</p>
            <button
              type="button"
              onClick={() => onOpenScanNota('scan')}
              className="mt-3 min-h-[44px] px-4 py-2 rounded-xl bg-amber-500 text-slate-950 font-semibold text-sm hover:bg-amber-400 cursor-pointer"
            >
              Catat Transaksi Pertama
            </button>
          </div>
        ) : (
          <ul className="divide-y divide-slate-100">
            {recentTransactions.map((tx) => {
              const firstDesc =
                tx.items.length === 1
                  ? tx.items[0].deskripsi
                  : `${tx.items[0]?.deskripsi ?? tx.namaToko} (+${tx.items.length - 1} item)`;
              const statusLabel =
                tx.sumberDana === 'KBS'
                  ? 'Kas Proyek (KBS)'
                  : `Rembes · ${tx.rembesStatus ?? 'Menunggu'}`;
              const statusColor =
                tx.sumberDana === 'KBS'
                  ? 'text-slate-600'
                  : tx.rembesStatus === 'Lunas'
                  ? 'text-emerald-600'
                  : tx.rembesStatus === 'Disetujui'
                  ? 'text-slate-900'
                  : 'text-amber-600';

              return (
                <li
                  key={tx.id}
                  className="px-5 py-3.5 flex items-center justify-between gap-4 hover:bg-slate-50/80 transition-colors"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-slate-900 truncate">
                        {firstDesc}
                      </span>
                      {tx.fotoNota && (
                        <button
                          type="button"
                          onClick={() => onViewPhoto(tx)}
                          aria-label={`Lihat foto nota ${tx.namaToko}`}
                          className="inline-flex items-center justify-center text-amber-600 hover:text-amber-700 cursor-pointer shrink-0"
                        >
                          <ImageIcon className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                    <div className="mt-0.5 flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-xs text-slate-500">
                      <span>{formatDateShort(tx.tanggal)}</span>
                      <span aria-hidden="true">·</span>
                      <span className="truncate">{tx.namaToko}</span>
                      <span aria-hidden="true">·</span>
                      <span className="truncate">{tx.kategori}</span>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="text-sm font-bold font-mono-num text-rose-600">
                      -{formatRupiah(tx.totalNominal)}
                    </div>
                    <div className={`text-xs font-medium mt-0.5 ${statusColor}`}>
                      {statusLabel}
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
};
