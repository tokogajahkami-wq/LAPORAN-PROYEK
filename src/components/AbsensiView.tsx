import React, { useState } from 'react';
import {
  CheckSquare,
  Clock,
  Plus,
  Pencil,
  UserCheck,
  UserX,
  Check,
  X,
} from 'lucide-react';
import type {
  DayAttendanceRecord,
  PeriodData,
  ProjectData,
  Worker,
  WorkerRole,
} from '../types';
import {
  calculateWorkerPayroll,
  formatDateShort,
  formatDays,
  formatNumberId,
  formatRupiah,
  getDayLabelLong,
  getDayLabelShort,
} from '../utils/calculations';

export type AbsensiSubTab = 'harian' | 'rekap' | 'master';

interface AbsensiViewProps {
  project: ProjectData;
  period: PeriodData;
  subTab: AbsensiSubTab;
  onChangeSubTab: (tab: AbsensiSubTab) => void;
  onUpdateAttendance: (workerId: string, date: string, record: DayAttendanceRecord) => void;
  onBulkSetDay: (date: string, field: 'normal' | 'lembur', value: number) => void;
  onUpdateKasbon: (workerId: string, amount: number) => void;
  onUpdateWorkerNote: (workerId: string, note: string) => void;
  onAddWorker: (worker: Worker) => void;
  onUpdateWorker: (worker: Worker) => void;
}

const NORMAL_OPTIONS = [0, 0.5, 1];
const LEMBUR_OPTIONS = [0, 0.5, 1];
const WORKER_ROLES: WorkerRole[] = ['MANDOR', 'TUKANG', 'TENAGA'];

export const AbsensiView: React.FC<AbsensiViewProps> = ({
  project,
  period,
  subTab,
  onChangeSubTab,
  onUpdateAttendance,
  onBulkSetDay,
  onUpdateKasbon,
  onUpdateWorkerNote,
  onAddWorker,
  onUpdateWorker,
}) => {
  const defaultDate = period.attendanceDates[1] ?? period.attendanceDates[0] ?? '2026-11-09';
  const [selectedDate, setSelectedDate] = useState<string>(defaultDate);

  // Keep selectedDate valid if period changes
  const activeDate = period.attendanceDates.includes(selectedDate)
    ? selectedDate
    : period.attendanceDates[0] ?? defaultDate;

  // Master data form
  const [newNama, setNewNama] = useState('');
  const [newJabatan, setNewJabatan] = useState<WorkerRole>('TUKANG');
  const [newUpah, setNewUpah] = useState('120000');
  const [newMandor, setNewMandor] = useState(project.mandor);
  const [editingWorkerId, setEditingWorkerId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<Worker | null>(null);

  const activeWorkers = project.workers.filter((w) => w.aktif);
  const payroll = calculateWorkerPayroll(
    project.workers,
    period.attendanceDates,
    period.attendance,
    period.kasbonByWorker,
    period.keteranganByWorker
  );

  const handleCreateWorker = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newNama.trim()) return;
    const upah = Math.max(0, Math.round(Number(newUpah) || 0));
    onAddWorker({
      id: `w-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      nama: newNama.trim().toUpperCase(),
      jabatan: newJabatan,
      upahHarian: upah,
      mandor: newMandor.trim() || project.mandor,
      aktif: true,
    });
    setNewNama('');
    setNewUpah(newJabatan === 'TENAGA' ? '90000' : '120000');
  };

  const handleSaveWorkerEdit = () => {
    if (!editDraft || !editDraft.nama.trim()) return;
    onUpdateWorker({
      ...editDraft,
      nama: editDraft.nama.trim().toUpperCase(),
      upahHarian: Math.max(0, Math.round(Number(editDraft.upahHarian) || 0)),
    });
    setEditingWorkerId(null);
    setEditDraft(null);
  };

  // Summary for selected day
  const dayPresentCount = activeWorkers.filter(
    (w) => (period.attendance[w.id]?.[activeDate]?.normal ?? 0) > 0
  ).length;
  const dayOvertimeCount = activeWorkers.filter(
    (w) => (period.attendance[w.id]?.[activeDate]?.lembur ?? 0) > 0
  ).length;

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-2">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-slate-900">
            Absensi Tukang &amp; Penggajian
          </h1>
          <p className="mt-0.5 text-sm text-slate-600">
            Mandor: {project.mandor} · Periode: {period.labelPeriodeAbsensi}
          </p>
        </div>
        <div className="text-right">
          <span className="text-xs text-slate-500 block">Total Gaji Minggu Ini</span>
          <span className="text-lg font-extrabold font-mono-num text-slate-900">
            {formatRupiah(payroll.grandTotalBayar)}
          </span>
        </div>
      </div>

      {/* 3 Sub-Tabs */}
      <div
        role="tablist"
        aria-label="Sub-menu Absensi"
        className="grid grid-cols-3 gap-1 p-1 bg-slate-200/70 rounded-xl max-w-2xl"
      >
        <button
          type="button"
          role="tab"
          aria-selected={subTab === 'harian'}
          onClick={() => onChangeSubTab('harian')}
          className={`min-h-[44px] px-3 py-2 rounded-lg text-xs sm:text-sm font-semibold transition-all cursor-pointer whitespace-nowrap truncate ${
            subTab === 'harian'
              ? 'bg-white text-slate-900 shadow-xs'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          Input Harian
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={subTab === 'rekap'}
          onClick={() => onChangeSubTab('rekap')}
          className={`min-h-[44px] px-3 py-2 rounded-lg text-xs sm:text-sm font-semibold transition-all cursor-pointer whitespace-nowrap truncate ${
            subTab === 'rekap'
              ? 'bg-white text-slate-900 shadow-xs'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          Rekap &amp; Gaji
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={subTab === 'master'}
          onClick={() => onChangeSubTab('master')}
          className={`min-h-[44px] px-3 py-2 rounded-lg text-xs sm:text-sm font-semibold transition-all cursor-pointer whitespace-nowrap truncate ${
            subTab === 'master'
              ? 'bg-white text-slate-900 shadow-xs'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          Master Tukang ({project.workers.length})
        </button>
      </div>

      {/* SUB-TAB 1: INPUT HARIAN (THUMB-FRIENDLY MANDOR VIEW) */}
      {subTab === 'harian' && (
        <div className="space-y-4">
          {/* Date Selector Strip (Minggu .. Sabtu) */}
          <div className="bg-white rounded-2xl border border-slate-200 p-3.5 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-bold text-slate-700">
                Pilih Hari Kerja ({getDayLabelLong(activeDate)}, {formatDateShort(activeDate)})
              </span>
              <span className="text-xs text-slate-500 font-mono-num">
                Hadir {dayPresentCount}/{activeWorkers.length} · Lembur {dayOvertimeCount}
              </span>
            </div>

            <div className="grid grid-cols-7 gap-1.5">
              {period.attendanceDates.map((d) => {
                const isSelected = d === activeDate;
                return (
                  <button
                    key={d}
                    type="button"
                    onClick={() => setSelectedDate(d)}
                    aria-pressed={isSelected}
                    className={`min-h-[52px] rounded-xl flex flex-col items-center justify-center gap-0.5 transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-slate-900 text-white shadow-xs'
                        : 'bg-slate-50 text-slate-700 hover:bg-slate-100 border border-slate-200'
                    }`}
                  >
                    <span className="text-[11px] font-semibold">{getDayLabelShort(d)}</span>
                    <span className="text-sm font-bold font-mono-num">{d.slice(8, 10)}</span>
                  </button>
                );
              })}
            </div>

            {/* Bulk Mass Actions */}
            <div className="grid grid-cols-2 gap-2.5 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => onBulkSetDay(activeDate, 'normal', 1)}
                className="min-h-[46px] rounded-xl bg-emerald-600 hover:bg-emerald-700 active:scale-[0.99] text-white text-xs sm:text-sm font-bold flex items-center justify-center gap-2 px-3 py-2 transition-all cursor-pointer whitespace-nowrap"
              >
                <CheckSquare className="w-4 h-4 shrink-0" />
                <span>Hadir Semua (1)</span>
              </button>
              <button
                type="button"
                onClick={() => onBulkSetDay(activeDate, 'lembur', 0.5)}
                className="min-h-[46px] rounded-xl bg-amber-500 hover:bg-amber-400 active:scale-[0.99] text-slate-950 text-xs sm:text-sm font-bold flex items-center justify-center gap-2 px-3 py-2 transition-all cursor-pointer whitespace-nowrap"
              >
                <Clock className="w-4 h-4 shrink-0" />
                <span>Lembur Semua (0.5)</span>
              </button>
            </div>
          </div>

          {/* Worker Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {activeWorkers.map((worker) => {
              const rec: DayAttendanceRecord = period.attendance[worker.id]?.[activeDate] ?? {
                normal: 0,
                lembur: 0,
                catatan: '',
              };

              return (
                <article
                  key={worker.id}
                  className="bg-white rounded-2xl border border-slate-200 p-4 space-y-3"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h3 className="text-base font-extrabold text-slate-900">{worker.nama}</h3>
                      <div className="text-xs text-slate-500 mt-0.5">
                        {worker.jabatan} ·{' '}
                        <span className="font-mono-num">{formatRupiah(worker.upahHarian)}/hari</span>
                      </div>
                    </div>
                    <div className="text-right font-mono-num">
                      <span className="text-xs text-slate-500 block">Hari ini</span>
                      <span
                        className={`text-sm font-bold ${
                          rec.normal + rec.lembur > 0 ? 'text-emerald-600' : 'text-slate-400'
                        }`}
                      >
                        {formatDays(rec.normal + rec.lembur)} hr
                      </span>
                    </div>
                  </div>

                  {/* Kerja Normal (08.00 - 15.00) */}
                  <div className="space-y-1.5">
                    <span className="text-xs font-semibold text-slate-600 block">
                      Kerja Normal (08.00–15.00)
                    </span>
                    <div className="grid grid-cols-3 gap-2">
                      {NORMAL_OPTIONS.map((val) => {
                        const active = rec.normal === val;
                        return (
                          <button
                            key={val}
                            type="button"
                            onClick={() =>
                              onUpdateAttendance(worker.id, activeDate, {
                                ...rec,
                                normal: val,
                              })
                            }
                            aria-label={`${worker.nama} kerja normal ${val}`}
                            aria-pressed={active}
                            className={`min-h-[44px] rounded-xl font-mono-num text-sm font-bold transition-all cursor-pointer ${
                              active
                                ? val > 0
                                  ? 'bg-emerald-600 text-white shadow-xs'
                                  : 'bg-slate-900 text-white shadow-xs'
                                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                            }`}
                          >
                            {val}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Lembur (16.00 - 18.00) + Manual numeric */}
                  <div className="space-y-1.5">
                    <span className="text-xs font-semibold text-slate-600 block">
                      Lembur (16.00–18.00)
                    </span>
                    <div className="grid grid-cols-4 gap-2">
                      {LEMBUR_OPTIONS.map((val) => {
                        const active = rec.lembur === val;
                        return (
                          <button
                            key={val}
                            type="button"
                            onClick={() =>
                              onUpdateAttendance(worker.id, activeDate, {
                                ...rec,
                                lembur: val,
                              })
                            }
                            aria-label={`${worker.nama} lembur ${val}`}
                            aria-pressed={active}
                            className={`min-h-[44px] rounded-xl font-mono-num text-sm font-bold transition-all cursor-pointer ${
                              active
                                ? val > 0
                                  ? 'bg-amber-500 text-slate-950 shadow-xs'
                                  : 'bg-slate-900 text-white shadow-xs'
                                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                            }`}
                          >
                            {val}
                          </button>
                        );
                      })}
                      <input
                        type="number"
                        step="0.25"
                        min="0"
                        max="3"
                        aria-label={`Lembur manual ${worker.nama}`}
                        value={rec.lembur}
                        onChange={(e) =>
                          onUpdateAttendance(worker.id, activeDate, {
                            ...rec,
                            lembur: Math.max(0, Number(e.target.value) || 0),
                          })
                        }
                        className="min-h-[44px] rounded-xl border border-slate-300 bg-white px-2 text-center font-mono-num text-sm font-bold text-slate-900 focus:border-slate-900 focus:outline-none"
                      />
                    </div>
                  </div>

                  {/* Catatan singkat */}
                  <div>
                    <input
                      type="text"
                      aria-label={`Catatan harian ${worker.nama}`}
                      value={rec.catatan ?? ''}
                      onChange={(e) =>
                        onUpdateAttendance(worker.id, activeDate, {
                          ...rec,
                          catatan: e.target.value,
                        })
                      }
                      placeholder="Catatan singkat (opsional, misal: izin siang / ngecor)"
                      className="w-full min-h-[38px] rounded-lg border border-slate-200 bg-slate-50 focus:bg-white focus:border-slate-900 px-3 py-1.5 text-xs text-slate-800 focus:outline-none"
                    />
                  </div>
                </article>
              );
            })}
          </div>
        </div>
      )}

      {/* SUB-TAB 2: REKAP MINGGUAN & PENGGAJIAN (MATRIX) */}
      {subTab === 'rekap' && (
        <section className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
          <div className="px-5 py-3.5 bg-slate-900 text-white flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <h2 className="text-sm font-bold">
                Rekap Absensi &amp; Penggajian Mingguan ({period.labelPeriodeAbsensi})
              </h2>
              <p className="text-xs text-slate-300 mt-0.5">
                N = Kerja Normal · L = Lembur · Kasbon &amp; Keterangan dapat diedit langsung
              </p>
            </div>
            <div className="text-xs font-mono-num text-amber-400 font-semibold">
              Grand Total: {formatDays(payroll.grandTotalHari)} hari · {formatRupiah(payroll.grandTotalBayar)}
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr className="bg-slate-100 border-b border-slate-200 text-slate-700">
                  <th rowSpan={2} className="px-2 py-2 border-r border-slate-200 text-center font-bold w-9">
                    NO
                  </th>
                  <th rowSpan={2} className="px-2.5 py-2 border-r border-slate-200 text-left font-bold min-w-[90px]">
                    NAMA
                  </th>
                  <th rowSpan={2} className="px-2 py-2 border-r border-slate-200 text-left font-bold">
                    JABATAN
                  </th>
                  {period.attendanceDates.map((d) => (
                    <th
                      key={d}
                      colSpan={2}
                      className="px-1 py-1.5 border-r border-slate-200 text-center font-bold whitespace-nowrap"
                    >
                      {getDayLabelShort(d)}
                      <span className="block text-[10px] font-mono-num text-slate-500 font-normal">
                        {d.slice(8, 10)}/{d.slice(5, 7)}
                      </span>
                    </th>
                  ))}
                  <th rowSpan={2} className="px-2 py-2 border-r border-slate-200 text-right font-bold whitespace-nowrap">
                    HARI
                  </th>
                  <th rowSpan={2} className="px-2 py-2 border-r border-slate-200 text-right font-bold whitespace-nowrap">
                    UPAH
                  </th>
                  <th rowSpan={2} className="px-2 py-2 border-r border-slate-200 text-right font-bold whitespace-nowrap">
                    TOTAL
                  </th>
                  <th rowSpan={2} className="px-2 py-2 border-r border-slate-200 text-right font-bold whitespace-nowrap">
                    KASBON
                  </th>
                  <th rowSpan={2} className="px-2.5 py-2 border-r border-slate-200 text-right font-bold whitespace-nowrap">
                    TOTAL BAYAR
                  </th>
                  <th rowSpan={2} className="px-2.5 py-2 text-left font-bold min-w-[115px]">
                    KETERANGAN
                  </th>
                </tr>
                <tr className="bg-slate-50 border-b border-slate-200 text-[10px] text-slate-500">
                  {period.attendanceDates.map((d) => (
                    <React.Fragment key={d}>
                      <th className="px-1 py-1 border-r border-slate-200 text-center font-semibold">N</th>
                      <th className="px-1 py-1 border-r border-slate-200 text-center font-semibold">L</th>
                    </React.Fragment>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {payroll.rows.map((row, idx) => (
                  <tr key={row.worker.id} className="hover:bg-slate-50/80">
                    <td className="px-2 py-2.5 border-r border-slate-100 text-center font-mono-num text-slate-500">
                      {idx + 1}
                    </td>
                    <td className="px-2.5 py-2.5 border-r border-slate-100 font-bold text-slate-900 whitespace-nowrap">
                      {row.worker.nama}
                    </td>
                    <td className="px-2 py-2.5 border-r border-slate-100 text-slate-600 whitespace-nowrap">
                      {row.worker.jabatan}
                    </td>
                    {period.attendanceDates.map((d) => {
                      const cell = row.daily[d] ?? { normal: 0, lembur: 0 };
                      return (
                        <React.Fragment key={d}>
                          <td
                            className={`px-1 py-2.5 border-r border-slate-100 text-center font-mono-num ${
                              cell.normal > 0 ? 'text-emerald-700 font-semibold' : 'text-slate-300'
                            }`}
                          >
                            {cell.normal > 0 ? formatDays(cell.normal) : '-'}
                          </td>
                          <td
                            className={`px-1 py-2.5 border-r border-slate-200 text-center font-mono-num ${
                              cell.lembur > 0 ? 'text-amber-700 font-semibold' : 'text-slate-300'
                            }`}
                          >
                            {cell.lembur > 0 ? formatDays(cell.lembur) : '-'}
                          </td>
                        </React.Fragment>
                      );
                    })}
                    <td className="px-2 py-2.5 border-r border-slate-100 text-right font-mono-num font-bold text-slate-900 whitespace-nowrap">
                      {formatDays(row.jmlHari)}
                    </td>
                    <td className="px-2 py-2.5 border-r border-slate-100 text-right font-mono-num text-slate-700 whitespace-nowrap">
                      {formatNumberId(row.upah)}
                    </td>
                    <td className="px-2 py-2.5 border-r border-slate-100 text-right font-mono-num font-semibold text-slate-800 whitespace-nowrap">
                      {formatNumberId(row.totalKotor)}
                    </td>
                    <td className="px-1.5 py-1.5 border-r border-slate-100 text-right">
                      <input
                        type="number"
                        min={0}
                        step={10000}
                        aria-label={`Kasbon ${row.worker.nama}`}
                        value={row.kasbon === 0 ? '' : row.kasbon}
                        placeholder="0"
                        onChange={(e) =>
                          onUpdateKasbon(row.worker.id, Math.max(0, Number(e.target.value) || 0))
                        }
                        className="w-20 rounded-md border border-slate-200 bg-slate-50 focus:bg-white focus:border-slate-900 px-1.5 py-1 text-right font-mono-num text-xs text-rose-600 focus:outline-none"
                      />
                    </td>
                    <td className="px-2.5 py-2.5 border-r border-slate-100 text-right font-mono-num font-bold text-slate-900 whitespace-nowrap">
                      {formatRupiah(row.totalBayar)}
                    </td>
                    <td className="px-1.5 py-1.5">
                      <input
                        type="text"
                        aria-label={`Keterangan gaji ${row.worker.nama}`}
                        value={row.keterangan}
                        onChange={(e) => onUpdateWorkerNote(row.worker.id, e.target.value)}
                        placeholder="-"
                        className="w-full min-w-[105px] rounded-md border border-transparent hover:border-slate-200 focus:border-slate-900 bg-transparent focus:bg-white px-1.5 py-1 text-xs text-slate-700 focus:outline-none"
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-slate-100 border-t-2 border-slate-300 font-bold text-slate-900">
                  <td colSpan={3 + period.attendanceDates.length * 2} className="px-3 py-3 text-right">
                    GRAND TOTAL
                  </td>
                  <td
                    className="px-2 py-3 text-right font-mono-num whitespace-nowrap"
                    data-testid="payroll-grand-days"
                  >
                    {formatDays(payroll.grandTotalHari)}
                  </td>
                  <td className="px-2 py-3 text-right text-slate-400">-</td>
                  <td className="px-2 py-3 text-right font-mono-num whitespace-nowrap">
                    {formatNumberId(payroll.grandTotalKotor)}
                  </td>
                  <td className="px-2 py-3 text-right font-mono-num text-rose-600 whitespace-nowrap">
                    {formatNumberId(payroll.grandTotalKasbon)}
                  </td>
                  <td
                    className="px-2.5 py-3 text-right font-mono-num text-sm text-emerald-700 whitespace-nowrap"
                    data-testid="payroll-grand-pay"
                  >
                    {formatRupiah(payroll.grandTotalBayar)}
                  </td>
                  <td />
                </tr>
              </tfoot>
            </table>
          </div>
        </section>
      )}

      {/* SUB-TAB 3: MASTER DATA TUKANG */}
      {subTab === 'master' && (
        <div className="space-y-4">
          {/* Add Worker Form */}
          <form
            onSubmit={handleCreateWorker}
            className="bg-white rounded-2xl border border-slate-200 p-5 space-y-4"
          >
            <h2 className="text-sm font-bold text-slate-900">Tambah Pekerja Baru</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
              <div>
                <label htmlFor="w-nama" className="block text-xs font-medium text-slate-600 mb-1">
                  Nama Pekerja
                </label>
                <input
                  id="w-nama"
                  type="text"
                  value={newNama}
                  onChange={(e) => setNewNama(e.target.value)}
                  placeholder="Contoh: JOKO"
                  required
                  className="w-full min-h-[42px] rounded-xl border border-slate-300 px-3 py-1.5 text-sm"
                />
              </div>
              <div>
                <label htmlFor="w-jabatan" className="block text-xs font-medium text-slate-600 mb-1">
                  Jabatan
                </label>
                <select
                  id="w-jabatan"
                  value={newJabatan}
                  onChange={(e) => setNewJabatan(e.target.value as WorkerRole)}
                  className="w-full min-h-[42px] rounded-xl border border-slate-300 bg-white px-3 py-1.5 text-sm"
                >
                  {WORKER_ROLES.map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="w-upah" className="block text-xs font-medium text-slate-600 mb-1">
                  Upah Harian (Rp)
                </label>
                <input
                  id="w-upah"
                  type="number"
                  min={0}
                  step={5000}
                  value={newUpah}
                  onChange={(e) => setNewUpah(e.target.value)}
                  required
                  className="w-full min-h-[42px] rounded-xl border border-slate-300 px-3 py-1.5 text-sm font-mono-num"
                />
              </div>
              <div>
                <label htmlFor="w-mandor" className="block text-xs font-medium text-slate-600 mb-1">
                  Mandor Penanggung Jawab
                </label>
                <input
                  id="w-mandor"
                  type="text"
                  value={newMandor}
                  onChange={(e) => setNewMandor(e.target.value)}
                  className="w-full min-h-[42px] rounded-xl border border-slate-300 px-3 py-1.5 text-sm"
                />
              </div>
              <div className="flex items-end">
                <button
                  type="submit"
                  className="w-full min-h-[42px] rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-sm font-bold inline-flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  <span>Tambah</span>
                </button>
              </div>
            </div>
          </form>

          {/* Worker List Table */}
          <section className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-xs text-slate-500">
                    <th className="text-left font-semibold px-5 py-3">Nama</th>
                    <th className="text-left font-semibold px-4 py-3">Jabatan</th>
                    <th className="text-right font-semibold px-4 py-3">Tarif Upah / Hari</th>
                    <th className="text-left font-semibold px-4 py-3">Mandor</th>
                    <th className="text-left font-semibold px-4 py-3">Status</th>
                    <th className="text-right font-semibold px-5 py-3">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {project.workers.map((worker) => {
                    const isEditing = editingWorkerId === worker.id && editDraft;
                    return (
                      <tr key={worker.id} className={!worker.aktif ? 'bg-slate-50/70 opacity-65' : ''}>
                        <td className="px-5 py-3 font-bold text-slate-900">
                          {isEditing ? (
                            <input
                              type="text"
                              aria-label="Edit nama pekerja"
                              value={editDraft.nama}
                              onChange={(e) => setEditDraft({ ...editDraft, nama: e.target.value })}
                              className="w-36 rounded-lg border border-slate-300 px-2.5 py-1 text-sm"
                            />
                          ) : (
                            worker.nama
                          )}
                        </td>
                        <td className="px-4 py-3 text-slate-700">
                          {isEditing ? (
                            <select
                              aria-label="Edit jabatan pekerja"
                              value={editDraft.jabatan}
                              onChange={(e) =>
                                setEditDraft({ ...editDraft, jabatan: e.target.value as WorkerRole })
                              }
                              className="rounded-lg border border-slate-300 bg-white px-2.5 py-1 text-sm"
                            >
                              {WORKER_ROLES.map((r) => (
                                <option key={r} value={r}>
                                  {r}
                                </option>
                              ))}
                            </select>
                          ) : (
                            worker.jabatan
                          )}
                        </td>
                        <td className="px-4 py-3 text-right font-mono-num font-semibold text-slate-900 whitespace-nowrap">
                          {isEditing ? (
                            <input
                              type="number"
                              aria-label="Edit upah harian"
                              value={editDraft.upahHarian}
                              onChange={(e) =>
                                setEditDraft({
                                  ...editDraft,
                                  upahHarian: Math.max(0, Number(e.target.value) || 0),
                                })
                              }
                              className="w-32 rounded-lg border border-slate-300 px-2.5 py-1 text-right font-mono-num text-sm"
                            />
                          ) : (
                            formatRupiah(worker.upahHarian)
                          )}
                        </td>
                        <td className="px-4 py-3 text-slate-600">
                          {isEditing ? (
                            <input
                              type="text"
                              aria-label="Edit mandor"
                              value={editDraft.mandor}
                              onChange={(e) => setEditDraft({ ...editDraft, mandor: e.target.value })}
                              className="w-32 rounded-lg border border-slate-300 px-2.5 py-1 text-sm"
                            />
                          ) : (
                            worker.mandor
                          )}
                        </td>
                        <td className="px-4 py-3 text-xs font-semibold">
                          <span className={worker.aktif ? 'text-emerald-700' : 'text-slate-500'}>
                            {worker.aktif ? 'Aktif' : 'Nonaktif'}
                          </span>
                        </td>
                        <td className="px-5 py-3 text-right whitespace-nowrap">
                          {isEditing ? (
                            <div className="inline-flex items-center gap-1">
                              <button
                                type="button"
                                onClick={handleSaveWorkerEdit}
                                aria-label="Simpan edit pekerja"
                                className="p-2 rounded-lg text-emerald-600 hover:bg-emerald-50 cursor-pointer"
                              >
                                <Check className="w-4 h-4" />
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  setEditingWorkerId(null);
                                  setEditDraft(null);
                                }}
                                aria-label="Batal edit pekerja"
                                className="p-2 rounded-lg text-slate-500 hover:bg-slate-100 cursor-pointer"
                              >
                                <X className="w-4 h-4" />
                              </button>
                            </div>
                          ) : (
                            <div className="inline-flex items-center gap-1">
                              <button
                                type="button"
                                onClick={() => {
                                  setEditingWorkerId(worker.id);
                                  setEditDraft({ ...worker });
                                }}
                                aria-label={`Edit ${worker.nama}`}
                                className="p-2 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-100 cursor-pointer"
                              >
                                <Pencil className="w-4 h-4" />
                              </button>
                              <button
                                type="button"
                                onClick={() => onUpdateWorker({ ...worker, aktif: !worker.aktif })}
                                aria-label={
                                  worker.aktif ? `Nonaktifkan ${worker.nama}` : `Aktifkan ${worker.nama}`
                                }
                                className={`p-2 rounded-lg cursor-pointer ${
                                  worker.aktif
                                    ? 'text-slate-400 hover:text-rose-600 hover:bg-rose-50'
                                    : 'text-emerald-600 hover:bg-emerald-50'
                                }`}
                              >
                                {worker.aktif ? (
                                  <UserX className="w-4 h-4" />
                                ) : (
                                  <UserCheck className="w-4 h-4" />
                                )}
                              </button>
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      )}
    </div>
  );
};
