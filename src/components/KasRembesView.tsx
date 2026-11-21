import React, { useState } from 'react';
import {
  Camera,
  Plus,
  Trash2,
  CheckCircle2,
  Banknote,
  Pencil,
  Check,
  X,
  RotateCcw,
} from 'lucide-react';
import {
  CASHFLOW_GROUPS,
  type CashflowGroupKey,
  type CashflowItem,
  type ExpenseTransaction,
  type PeriodData,
  type RembesStatus,
  type RoleMode,
} from '../types';
import {
  calculateCashflowSummary,
  calculateKbsSummary,
  calculateRembesSummary,
  formatDateShort,
  formatRupiah,
} from '../utils/calculations';

export type KasSubTab = 'kbs' | 'rembes' | 'cashflow';

interface KasRembesViewProps {
  period: PeriodData;
  roleMode: RoleMode;
  subTab: KasSubTab;
  onChangeSubTab: (tab: KasSubTab) => void;
  onOpenAddModal: (mode: 'scan' | 'manual' | 'droping') => void;
  onViewPhoto: (tx: ExpenseTransaction) => void;
  onUpdateOpeningBalance: (amount: number, tanggal: string) => void;
  onDeleteDroping: (dropId: string) => void;
  onDeleteTransaction: (txId: string) => void;
  onUpdateRembesStatus: (txId: string, status: RembesStatus) => void;
  onAddCashflowItem: (item: CashflowItem) => void;
  onUpdateCashflowItem: (item: CashflowItem) => void;
  onDeleteCashflowItem: (itemId: string) => void;
  onUpdateSaldoLaluOverride: (override: number | null) => void;
}

export const KasRembesView: React.FC<KasRembesViewProps> = ({
  period,
  roleMode,
  subTab,
  onChangeSubTab,
  onOpenAddModal,
  onViewPhoto,
  onUpdateOpeningBalance,
  onDeleteDroping,
  onDeleteTransaction,
  onUpdateRembesStatus,
  onAddCashflowItem,
  onUpdateCashflowItem,
  onDeleteCashflowItem,
  onUpdateSaldoLaluOverride,
}) => {
  const kbs = calculateKbsSummary(period);
  const rembes = calculateRembesSummary(period);
  const cashflow = calculateCashflowSummary(period, kbs.sisaSaldoAkhir);

  // Opening balance inline editor
  const [editingOpening, setEditingOpening] = useState(false);
  const [openingInput, setOpeningInput] = useState(String(period.sisaSaldoLalu));
  const [openingDateInput, setOpeningDateInput] = useState(period.tanggalSaldoLalu);

  // Rembes filter
  const [rembesFilter, setRembesFilter] = useState<'Semua' | RembesStatus>('Semua');

  // Cashflow add-item inline form per group
  const [addingGroup, setAddingGroup] = useState<CashflowGroupKey | null>(null);
  const [cfDesc, setCfDesc] = useState('');
  const [cfNominal, setCfNominal] = useState('');
  const [cfKet, setCfKet] = useState('');

  // Cashflow override input
  const [editingOverride, setEditingOverride] = useState(false);
  const [overrideInput, setOverrideInput] = useState(
    String(period.saldoLaluOverride ?? kbs.sisaSaldoAkhir)
  );

  const filteredRembes = rembes.transactions.filter((tx) => {
    if (rembesFilter === 'Semua') return true;
    return (tx.rembesStatus ?? 'Menunggu') === rembesFilter;
  });

  const handleSaveOpening = () => {
    const parsed = Math.round(Number(openingInput) || 0);
    onUpdateOpeningBalance(parsed, openingDateInput || period.tanggalSaldoLalu);
    setEditingOpening(false);
  };

  const handleSaveCashflowItem = (group: CashflowGroupKey) => {
    const nom = Math.max(0, Math.round(Number(cfNominal) || 0));
    if (!cfDesc.trim() || nom <= 0) return;
    onAddCashflowItem({
      id: `cf-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      group,
      deskripsi: cfDesc.trim(),
      nominal: nom,
      keterangan: cfKet.trim() || undefined,
    });
    setCfDesc('');
    setCfNominal('');
    setCfKet('');
    setAddingGroup(null);
  };

  const handleSaveOverride = () => {
    const val = Math.round(Number(overrideInput) || 0);
    onUpdateSaldoLaluOverride(val);
    setEditingOverride(false);
  };

  return (
    <div className="space-y-5">
      {/* Header & Action */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-slate-900">
            Kas Proyek, Rembes &amp; Cashflow
          </h1>
          <p className="mt-0.5 text-sm text-slate-600">
            Periode KBS: {period.labelPeriodeKbs}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => onOpenAddModal('droping')}
            className="min-h-[44px] px-3.5 py-2 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-slate-800 text-xs font-semibold cursor-pointer whitespace-nowrap"
          >
            + Droping Dana
          </button>
          <button
            type="button"
            onClick={() => onOpenAddModal('scan')}
            className="min-h-[44px] px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
          >
            <Camera className="w-4 h-4 shrink-0" />
            <span>Scan / Input Nota</span>
          </button>
        </div>
      </div>

      {/* 3 Sub-Tabs */}
      <div
        role="tablist"
        aria-label="Sub-menu Kas dan Rembes"
        className="grid grid-cols-3 gap-1 p-1 bg-slate-200/70 rounded-xl max-w-2xl"
      >
        <button
          type="button"
          role="tab"
          aria-selected={subTab === 'kbs'}
          onClick={() => onChangeSubTab('kbs')}
          className={`min-h-[44px] px-3 py-2 rounded-lg text-xs sm:text-sm font-semibold transition-all cursor-pointer whitespace-nowrap truncate ${
            subTab === 'kbs'
              ? 'bg-white text-slate-900 shadow-xs'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          Pengembalian Kas
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={subTab === 'rembes'}
          onClick={() => onChangeSubTab('rembes')}
          className={`min-h-[44px] px-3 py-2 rounded-lg text-xs sm:text-sm font-semibold transition-all cursor-pointer whitespace-nowrap truncate ${
            subTab === 'rembes'
              ? 'bg-white text-slate-900 shadow-xs'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          Sistem Rembes ({rembes.transactions.length})
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={subTab === 'cashflow'}
          onClick={() => onChangeSubTab('cashflow')}
          className={`min-h-[44px] px-3 py-2 rounded-lg text-xs sm:text-sm font-semibold transition-all cursor-pointer whitespace-nowrap truncate ${
            subTab === 'cashflow'
              ? 'bg-white text-slate-900 shadow-xs'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          Pengajuan Cashflow
        </button>
      </div>

      {/* SUB-TAB 1: PENGEMBALIAN KAS (KBS) */}
      {subTab === 'kbs' && (
        <div className="space-y-5">
          {/* PEMASUKAN (DEBET) */}
          <section className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
            <div className="px-5 py-3.5 bg-slate-900 text-white flex items-center justify-between gap-3">
              <h2 className="text-sm font-bold tracking-tight">A. PEMASUKAN (Debet)</h2>
              <button
                type="button"
                onClick={() => onOpenAddModal('droping')}
                className="text-xs font-semibold text-amber-400 hover:text-amber-300 inline-flex items-center gap-1 cursor-pointer whitespace-nowrap"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Tambah Droping</span>
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-xs text-slate-500">
                    <th className="text-left font-semibold px-5 py-2.5 w-36">Tanggal</th>
                    <th className="text-left font-semibold px-4 py-2.5">Keterangan</th>
                    <th className="text-right font-semibold px-5 py-2.5 w-44">Nominal</th>
                    <th className="w-20 px-3 py-2.5 text-right font-semibold">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {/* Sisa Saldo Minggu Lalu (Editable, supports negative) */}
                  <tr className="hover:bg-slate-50/70">
                    <td className="px-5 py-3 text-slate-600 whitespace-nowrap">
                      {editingOpening ? (
                        <input
                          type="date"
                          aria-label="Tanggal Sisa Saldo"
                          value={openingDateInput}
                          onChange={(e) => setOpeningDateInput(e.target.value)}
                          className="rounded-lg border border-slate-300 px-2 py-1 text-xs"
                        />
                      ) : (
                        formatDateShort(period.tanggalSaldoLalu)
                      )}
                    </td>
                    <td className="px-4 py-3 font-semibold text-slate-900">
                      SISA SALDO (Minggu Lalu)
                      {kbs.sisaSaldoLalu < 0 && (
                        <span className="ml-2 text-xs font-medium text-rose-600">
                          Defisit / Minus
                        </span>
                      )}
                    </td>
                    <td className="px-5 py-3 text-right font-mono-num font-bold whitespace-nowrap">
                      {editingOpening ? (
                        <input
                          type="number"
                          aria-label="Nominal Sisa Saldo Minggu Lalu"
                          value={openingInput}
                          onChange={(e) => setOpeningInput(e.target.value)}
                          className="w-36 rounded-lg border border-slate-300 px-2.5 py-1 text-right text-sm font-mono-num"
                        />
                      ) : (
                        <span className={kbs.sisaSaldoLalu < 0 ? 'text-rose-600' : 'text-emerald-600'}>
                          {formatRupiah(kbs.sisaSaldoLalu)}
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-3 text-right whitespace-nowrap">
                      {editingOpening ? (
                        <div className="inline-flex items-center gap-1">
                          <button
                            type="button"
                            onClick={handleSaveOpening}
                            aria-label="Simpan Sisa Saldo"
                            className="p-2 rounded-lg text-emerald-600 hover:bg-emerald-50 cursor-pointer"
                          >
                            <Check className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setEditingOpening(false)}
                            aria-label="Batal edit Sisa Saldo"
                            className="p-2 rounded-lg text-slate-500 hover:bg-slate-100 cursor-pointer"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => {
                            setOpeningInput(String(period.sisaSaldoLalu));
                            setOpeningDateInput(period.tanggalSaldoLalu);
                            setEditingOpening(true);
                          }}
                          aria-label="Edit Sisa Saldo Minggu Lalu"
                          className="p-2 rounded-lg text-slate-400 hover:text-slate-800 hover:bg-slate-100 cursor-pointer"
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                      )}
                    </td>
                  </tr>

                  {/* Droping List */}
                  {period.dropingList.map((drop) => (
                    <tr key={drop.id} className="hover:bg-slate-50/70">
                      <td className="px-5 py-3 text-slate-600 whitespace-nowrap">
                        {formatDateShort(drop.tanggal)}
                      </td>
                      <td className="px-4 py-3 text-slate-900 font-medium">{drop.keterangan}</td>
                      <td className="px-5 py-3 text-right font-mono-num font-semibold text-emerald-600 whitespace-nowrap">
                        {formatRupiah(drop.nominal)}
                      </td>
                      <td className="px-3 py-3 text-right">
                        <button
                          type="button"
                          onClick={() => onDeleteDroping(drop.id)}
                          aria-label={`Hapus droping ${drop.keterangan}`}
                          className="p-2 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 cursor-pointer"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="bg-slate-50 border-t border-slate-200">
                    <td colSpan={2} className="px-5 py-3 font-bold text-slate-900">
                      TOTAL PEMASUKAN
                    </td>
                    <td className="px-5 py-3 text-right font-mono-num font-bold text-emerald-700 whitespace-nowrap">
                      {formatRupiah(kbs.totalPemasukan)}
                    </td>
                    <td />
                  </tr>
                </tfoot>
              </table>
            </div>
          </section>

          {/* PENGELUARAN (KREDIT) GROUPED BY DATE */}
          <section className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
            <div className="px-5 py-3.5 bg-slate-900 text-white flex items-center justify-between gap-3">
              <h2 className="text-sm font-bold tracking-tight">B. PENGELUARAN (Kredit)</h2>
              <button
                type="button"
                onClick={() => onOpenAddModal('manual')}
                className="text-xs font-semibold text-amber-400 hover:text-amber-300 inline-flex items-center gap-1 cursor-pointer whitespace-nowrap"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Input Pengeluaran</span>
              </button>
            </div>

            {kbs.groupedExpenses.length === 0 ? (
              <div className="p-8 text-center text-sm text-slate-500">
                Belum ada pengeluaran Kas Proyek di periode ini.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50 text-xs text-slate-500">
                      <th className="text-left font-semibold px-5 py-2.5 w-32">Tanggal</th>
                      <th className="text-left font-semibold px-4 py-2.5">Uraian Item &amp; Toko</th>
                      <th className="text-left font-semibold px-4 py-2.5 hidden md:table-cell">Kategori</th>
                      <th className="text-right font-semibold px-5 py-2.5 w-40">Nominal</th>
                      <th className="w-20 px-3 py-2.5 text-right font-semibold">Nota</th>
                    </tr>
                  </thead>
                  <tbody>
                    {kbs.groupedExpenses.map((group) => (
                      <React.Fragment key={group.tanggal}>
                        {group.lines.map((line, idx) => {
                          const parentTx = period.transactions.find((t) => t.id === line.transactionId);
                          return (
                            <tr
                              key={`${line.transactionId}-${line.itemId}`}
                              className="border-b border-slate-100 hover:bg-slate-50/70"
                            >
                              <td className="px-5 py-2.5 text-slate-600 whitespace-nowrap align-top">
                                {idx === 0 ? formatDateShort(group.tanggal) : ''}
                              </td>
                              <td className="px-4 py-2.5 align-top">
                                <div className="font-medium text-slate-900">
                                  {line.deskripsi}{' '}
                                  {line.qty && line.qty !== '1 ls' && (
                                    <span className="text-xs text-slate-500">({line.qty})</span>
                                  )}
                                </div>
                                <div className="text-xs text-slate-500 mt-0.5">
                                  {line.namaToko}
                                  <span className="md:hidden"> · {line.kategori}</span>
                                </div>
                              </td>
                              <td className="px-4 py-2.5 text-xs text-slate-600 hidden md:table-cell align-top">
                                {line.kategori}
                              </td>
                              <td className="px-5 py-2.5 text-right font-mono-num font-medium text-slate-900 whitespace-nowrap align-top">
                                {formatRupiah(line.nominal)}
                              </td>
                              <td className="px-3 py-2.5 text-right whitespace-nowrap align-top">
                                <div className="inline-flex items-center gap-0.5">
                                  {line.hasPhoto && parentTx && (
                                    <button
                                      type="button"
                                      onClick={() => onViewPhoto(parentTx)}
                                      aria-label={`Lihat foto nota ${line.namaToko}`}
                                      className="p-1.5 rounded-lg text-amber-600 hover:bg-amber-50 cursor-pointer"
                                    >
                                      <Camera className="w-4 h-4" />
                                    </button>
                                  )}
                                  {parentTx && (
                                    <button
                                      type="button"
                                      onClick={() => onDeleteTransaction(parentTx.id)}
                                      aria-label={`Hapus transaksi ${line.deskripsi}`}
                                      className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 cursor-pointer"
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                  )}
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                        {/* SUB TOTAL per date */}
                        <tr className="bg-slate-50/90 border-b border-slate-200">
                          <td colSpan={3} className="px-5 py-2 text-right text-xs font-bold text-slate-600 hidden md:table-cell">
                            SUB TOTAL ({formatDateShort(group.tanggal)})
                          </td>
                          <td colSpan={2} className="px-5 py-2 text-right text-xs font-bold text-slate-600 md:hidden">
                            SUB TOTAL ({formatDateShort(group.tanggal)})
                          </td>
                          <td className="px-5 py-2 text-right font-mono-num text-sm font-bold text-slate-900 whitespace-nowrap">
                            {formatRupiah(group.subTotal)}
                          </td>
                          <td />
                        </tr>
                      </React.Fragment>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="bg-slate-100 border-t-2 border-slate-300">
                      <td colSpan={3} className="px-5 py-3 font-bold text-slate-900 hidden md:table-cell">
                        TOTAL PENGELUARAN
                      </td>
                      <td colSpan={2} className="px-5 py-3 font-bold text-slate-900 md:hidden">
                        TOTAL PENGELUARAN
                      </td>
                      <td className="px-5 py-3 text-right font-mono-num font-bold text-rose-600 whitespace-nowrap">
                        {formatRupiah(kbs.totalPengeluaran)}
                      </td>
                      <td />
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </section>

          {/* SISA SALDO AKHIR */}
          <section className="bg-white rounded-2xl border border-slate-200 p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <div className="text-sm font-bold text-slate-900">SISA SALDO AKHIR KAS (KBS)</div>
              <div className="text-xs text-slate-500 mt-0.5 font-mono-num">
                Total Pemasukan ({formatRupiah(kbs.totalPemasukan)}) − Total Pengeluaran ({formatRupiah(kbs.totalPengeluaran)})
              </div>
            </div>
            <div
              className={`text-2xl font-extrabold font-mono-num ${
                kbs.sisaSaldoAkhir < 0 ? 'text-rose-600' : 'text-emerald-600'
              }`}
              data-testid="kbs-ending-balance"
            >
              {formatRupiah(kbs.sisaSaldoAkhir)}
            </div>
          </section>
        </div>
      )}

      {/* SUB-TAB 2: SISTEM REMBES */}
      {subTab === 'rembes' && (
        <div className="space-y-4">
          {/* Summary strip & Filter */}
          <div className="bg-white rounded-2xl border border-slate-200 p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm">
              <div>
                <span className="text-xs text-slate-500 block">Belum Diganti (Menunggu + Disetujui)</span>
                <span className="text-lg font-bold font-mono-num text-amber-600">
                  {formatRupiah(rembes.unpaidTotal)}
                </span>
              </div>
              <div>
                <span className="text-xs text-slate-500 block">Sudah Lunas</span>
                <span className="text-lg font-bold font-mono-num text-emerald-600">
                  {formatRupiah(rembes.paidTotal)}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-xl self-start md:self-auto">
              {(['Semua', 'Menunggu', 'Disetujui', 'Lunas'] as const).map((status) => (
                <button
                  key={status}
                  type="button"
                  onClick={() => setRembesFilter(status)}
                  className={`min-h-[36px] px-3 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer whitespace-nowrap ${
                    rembesFilter === status
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {status}
                </button>
              ))}
            </div>
          </div>

          {roleMode === 'mandor' && rembes.pendingCount > 0 && (
            <div className="rounded-xl bg-slate-100 border border-slate-200 px-4 py-3 text-xs text-slate-700">
              Sedang di <strong>Mode Lapangan / Mandor</strong>. Ubah ke{' '}
              <strong>Admin / Owner</strong> di header atas untuk menyetujui atau menandai klaim rembes sebagai Lunas.
            </div>
          )}

          {filteredRembes.length === 0 ? (
            <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center">
              <p className="text-sm text-slate-500">
                Tidak ada klaim rembes dengan status "{rembesFilter}".
              </p>
              <button
                type="button"
                onClick={() => onOpenAddModal('scan')}
                className="mt-3 min-h-[44px] px-4 py-2 rounded-xl bg-amber-500 text-slate-950 text-sm font-bold hover:bg-amber-400 cursor-pointer"
              >
                + Ajukan Rembes Baru
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredRembes.map((tx) => {
                const status = tx.rembesStatus ?? 'Menunggu';
                const statusTextColor =
                  status === 'Lunas'
                    ? 'text-emerald-700'
                    : status === 'Disetujui'
                    ? 'text-slate-900'
                    : 'text-amber-700';

                return (
                  <article
                    key={tx.id}
                    className="bg-white rounded-2xl border border-slate-200 p-4 sm:p-5 flex flex-col gap-3"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="text-base font-bold text-slate-900">
                            {tx.items.map((i) => i.deskripsi).join(', ')}
                          </h3>
                        </div>
                        <div className="mt-1 text-xs text-slate-500 flex flex-wrap items-center gap-x-1.5 gap-y-0.5">
                          <span>Pengaju: <strong className="text-slate-700">{tx.namaPengaju || 'Pelaksana'}</strong></span>
                          <span aria-hidden="true">·</span>
                          <span>{formatDateShort(tx.tanggal)}</span>
                          <span aria-hidden="true">·</span>
                          <span>{tx.namaToko}</span>
                          <span aria-hidden="true">·</span>
                          <span>{tx.kategori}</span>
                        </div>
                        {tx.catatan && (
                          <p className="mt-1.5 text-xs text-slate-600">{tx.catatan}</p>
                        )}
                      </div>

                      <div className="sm:text-right shrink-0">
                        <div className="text-lg font-extrabold font-mono-num text-slate-900">
                          {formatRupiah(tx.totalNominal)}
                        </div>
                        <div className={`text-xs font-bold mt-0.5 ${statusTextColor}`}>
                          Status: {status === 'Lunas' ? 'Lunas / Dibayar' : status}
                        </div>
                      </div>
                    </div>

                    <div className="pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        {tx.fotoNota && (
                          <button
                            type="button"
                            onClick={() => onViewPhoto(tx)}
                            className="min-h-[40px] px-3 py-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-xs font-semibold text-slate-700 inline-flex items-center gap-1.5 cursor-pointer"
                          >
                            <Camera className="w-4 h-4 text-amber-600" />
                            <span>Lihat Foto Nota</span>
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => onDeleteTransaction(tx.id)}
                          aria-label={`Hapus rembes ${tx.namaToko}`}
                          className="min-h-[40px] px-3 py-1.5 rounded-lg text-xs font-medium text-slate-500 hover:text-rose-600 hover:bg-rose-50 inline-flex items-center gap-1 cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          <span>Hapus</span>
                        </button>
                      </div>

                      {roleMode === 'admin' && (
                        <div className="flex items-center gap-2">
                          {status === 'Menunggu' && (
                            <button
                              type="button"
                              onClick={() => onUpdateRembesStatus(tx.id, 'Disetujui')}
                              className="min-h-[40px] px-3.5 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer"
                            >
                              <CheckCircle2 className="w-4 h-4 text-amber-400" />
                              <span>Setujui</span>
                            </button>
                          )}
                          {status !== 'Lunas' && (
                            <button
                              type="button"
                              onClick={() => onUpdateRembesStatus(tx.id, 'Lunas')}
                              className="min-h-[40px] px-3.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer"
                            >
                              <Banknote className="w-4 h-4" />
                              <span>Tandai Lunas</span>
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* SUB-TAB 3: PENGAJUAN CASHFLOW MINGGUAN */}
      {subTab === 'cashflow' && (
        <div className="space-y-4">
          <section className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
            <div className="px-5 py-3.5 bg-slate-900 text-white flex items-center justify-between gap-3">
              <h2 className="text-sm font-bold tracking-tight">
                Rincian Pengajuan Cashflow Mingguan (A s/d E)
              </h2>
              <span className="text-xs text-slate-300 font-mono-num">
                Minggu ke-{period.mingguKe}
              </span>
            </div>

            <div className="divide-y divide-slate-200">
              {CASHFLOW_GROUPS.map((grp) => {
                const groupData = cashflow.byGroup[grp.key];
                const isAddingHere = addingGroup === grp.key;

                return (
                  <div key={grp.key} className="p-4 sm:p-5 space-y-3">
                    <div className="flex items-center justify-between gap-2">
                      <div>
                        <h3 className="text-sm font-bold text-slate-900">{grp.label}</h3>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-sm font-bold font-mono-num text-slate-900">
                          {formatRupiah(groupData.total)}
                        </span>
                        <button
                          type="button"
                          onClick={() => {
                            setAddingGroup(isAddingHere ? null : grp.key);
                            setCfDesc('');
                            setCfNominal('');
                            setCfKet('');
                          }}
                          className="min-h-[36px] px-2.5 py-1 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-xs font-semibold text-slate-700 inline-flex items-center gap-1 cursor-pointer whitespace-nowrap"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          <span>Item</span>
                        </button>
                      </div>
                    </div>

                    {groupData.items.length > 0 ? (
                      <ul className="divide-y divide-slate-100 border-t border-slate-100">
                        {groupData.items.map((item) => (
                          <li
                            key={item.id}
                            className="py-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2"
                          >
                            <div className="min-w-0 flex-1">
                              <div className="text-sm font-medium text-slate-900">
                                {item.deskripsi}
                              </div>
                              {item.keterangan && (
                                <div className="text-xs text-slate-500">{item.keterangan}</div>
                              )}
                            </div>
                            <div className="flex items-center justify-between sm:justify-end gap-2 shrink-0">
                              <input
                                type="number"
                                aria-label={`Nominal ${item.deskripsi}`}
                                min={0}
                                step={1000}
                                value={item.nominal}
                                onChange={(e) =>
                                  onUpdateCashflowItem({
                                    ...item,
                                    nominal: Math.max(0, Math.round(Number(e.target.value) || 0)),
                                  })
                                }
                                className="w-36 min-h-[36px] rounded-lg border border-slate-200 bg-slate-50 focus:bg-white focus:border-slate-900 px-2.5 py-1 text-right text-sm font-mono-num font-semibold text-slate-900 focus:outline-none"
                              />
                              <button
                                type="button"
                                onClick={() => onDeleteCashflowItem(item.id)}
                                aria-label={`Hapus item cashflow ${item.deskripsi}`}
                                className="min-h-[36px] min-w-[36px] flex items-center justify-center rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 cursor-pointer"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-xs text-slate-400">Belum ada item di kelompok ini.</p>
                    )}

                    {isAddingHere && (
                      <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 pt-2 border-t border-slate-100">
                        <input
                          type="text"
                          value={cfDesc}
                          onChange={(e) => setCfDesc(e.target.value)}
                          placeholder="Nama item pengajuan"
                          className="sm:col-span-5 min-h-[40px] rounded-lg border border-slate-300 px-3 py-1.5 text-sm"
                        />
                        <input
                          type="number"
                          min={0}
                          step={1000}
                          value={cfNominal}
                          onChange={(e) => setCfNominal(e.target.value)}
                          placeholder="Nominal Rp"
                          className="sm:col-span-3 min-h-[40px] rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-mono-num text-right"
                        />
                        <input
                          type="text"
                          value={cfKet}
                          onChange={(e) => setCfKet(e.target.value)}
                          placeholder="Keterangan (opsional)"
                          className="sm:col-span-2 min-h-[40px] rounded-lg border border-slate-300 px-3 py-1.5 text-sm"
                        />
                        <button
                          type="button"
                          onClick={() => handleSaveCashflowItem(grp.key)}
                          className="sm:col-span-2 min-h-[40px] rounded-lg bg-slate-900 text-white text-xs font-bold hover:bg-slate-800 cursor-pointer"
                        >
                          Simpan
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </section>

          {/* Cashflow Calculation Summary Box */}
          <section className="bg-white rounded-2xl border border-slate-200 p-5 space-y-3">
            <div className="flex items-center justify-between text-sm">
              <span className="font-semibold text-slate-700">SUB TOTAL PENGAJUAN (A s/d E)</span>
              <span className="font-mono-num font-bold text-slate-900">
                {formatRupiah(cashflow.subTotalPengajuan)}
              </span>
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-sm pt-2 border-t border-slate-100">
              <div>
                <span className="font-semibold text-slate-700">SALDO MINGGU LALU</span>
                <span className="block text-xs text-slate-500">
                  {cashflow.isOverridden
                    ? 'Override manual aktif'
                    : 'Otomatis ditarik dari Sisa Saldo Akhir KBS'}
                </span>
              </div>

              <div className="flex items-center gap-2">
                {editingOverride ? (
                  <>
                    <input
                      type="number"
                      aria-label="Override Saldo Minggu Lalu"
                      value={overrideInput}
                      onChange={(e) => setOverrideInput(e.target.value)}
                      className="w-36 min-h-[38px] rounded-lg border border-slate-300 px-2.5 py-1 text-right font-mono-num text-sm"
                    />
                    <button
                      type="button"
                      onClick={handleSaveOverride}
                      aria-label="Simpan Override Saldo"
                      className="min-h-[38px] px-3 rounded-lg bg-slate-900 text-white text-xs font-semibold cursor-pointer"
                    >
                      Pakai
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditingOverride(false)}
                      className="min-h-[38px] px-2.5 rounded-lg border border-slate-300 text-xs text-slate-600 cursor-pointer"
                    >
                      Batal
                    </button>
                  </>
                ) : (
                  <>
                    <span
                      className={`font-mono-num font-bold ${
                        cashflow.saldoMingguLaluEffective < 0
                          ? 'text-rose-600'
                          : 'text-emerald-600'
                      }`}
                    >
                      {formatRupiah(cashflow.saldoMingguLaluEffective)}
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        setOverrideInput(String(cashflow.saldoMingguLaluEffective));
                        setEditingOverride(true);
                      }}
                      className="text-xs font-semibold text-slate-600 hover:text-slate-900 underline underline-offset-4 cursor-pointer"
                    >
                      Override
                    </button>
                    {cashflow.isOverridden && (
                      <button
                        type="button"
                        onClick={() => onUpdateSaldoLaluOverride(null)}
                        aria-label="Kembalikan saldo otomatis dari KBS"
                        className="inline-flex items-center gap-1 text-xs font-semibold text-amber-700 hover:text-amber-800 cursor-pointer"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                        <span>Auto</span>
                      </button>
                    )}
                  </>
                )}
              </div>
            </div>

            <div className="pt-3 border-t-2 border-slate-900 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <div className="text-base font-extrabold text-slate-900">
                  TOTAL CASHFLOW DIAJUKAN
                </div>
                <div className="text-xs text-slate-500">
                  Rumus: Sub Total Pengajuan − Saldo Minggu Lalu
                </div>
              </div>
              <div
                className="text-2xl font-extrabold font-mono-num text-slate-900"
                data-testid="cashflow-total-proposed"
              >
                {formatRupiah(cashflow.totalCashflowDiajukan)}
              </div>
            </div>
          </section>
        </div>
      )}
    </div>
  );
};
