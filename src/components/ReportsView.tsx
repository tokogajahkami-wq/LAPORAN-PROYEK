import React, { useState } from 'react';
import { FileSpreadsheet, Printer, Download, Loader2 } from 'lucide-react';
import {
  CASHFLOW_GROUPS,
  type PeriodData,
  type PrintConfig,
  type ProjectData,
} from '../types';
import {
  calculateCashflowSummary,
  calculateKbsSummary,
  calculateWorkerPayroll,
  formatDateIndo,
  formatDateShort,
  formatDays,
  formatNumberId,
  formatRupiah,
  getDayLabelShort,
} from '../utils/calculations';

type ReportType = 'kbs' | 'cashflow' | 'absensi';

interface ReportsViewProps {
  project: ProjectData;
  period: PeriodData;
  printConfig: PrintConfig;
  onUpdatePrintConfig: (patch: Partial<PrintConfig>) => void;
}

export const ReportsView: React.FC<ReportsViewProps> = ({
  project,
  period,
  printConfig,
  onUpdatePrintConfig,
}) => {
  const [selectedReport, setSelectedReport] = useState<ReportType>('kbs');
  const [isExporting, setIsExporting] = useState(false);

  const kbs = calculateKbsSummary(period);
  const cashflow = calculateCashflowSummary(period, kbs.sisaSaldoAkhir);
  const payroll = calculateWorkerPayroll(
    project.workers,
    period.attendanceDates,
    period.attendance,
    period.kasbonByWorker,
    period.keteranganByWorker
  );

  const receiptsWithPhotos = period.transactions.filter((tx) => Boolean(tx.fotoNota));

  const handleExportCurrentExcel = async () => {
    setIsExporting(true);
    try {
      const mod = await import('../utils/excelExport');
      if (selectedReport === 'kbs') {
        await mod.exportKbsExcel(project, period, printConfig);
      } else if (selectedReport === 'cashflow') {
        await mod.exportCashflowExcel(project, period, printConfig);
      } else {
        await mod.exportAbsensiExcel(project, period, printConfig);
      }
    } finally {
      setIsExporting(false);
    }
  };

  const handleExportAllExcel = async () => {
    setIsExporting(true);
    try {
      const mod = await import('../utils/excelExport');
      await mod.exportAllReportsExcel(project, period, printConfig);
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Control Panel (Hidden when printing) */}
      <div className="space-y-4 no-print">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-extrabold tracking-tight text-slate-900">
              Pusat Laporan Resmi
            </h1>
            <p className="mt-0.5 text-sm text-slate-600">
              Ekspor file Excel (.xlsx) atau cetak / simpan PDF format formal A4/F4
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              disabled={isExporting}
              onClick={handleExportAllExcel}
              className="min-h-[44px] px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white text-xs sm:text-sm font-bold inline-flex items-center gap-2 cursor-pointer whitespace-nowrap"
            >
              {isExporting ? (
                <Loader2 className="w-4 h-4 animate-spin shrink-0" />
              ) : (
                <FileSpreadsheet className="w-4 h-4 shrink-0" />
              )}
              <span>Download Semua (1 Excel · 3 Sheet)</span>
            </button>
            <button
              type="button"
              onClick={() => window.print()}
              className="min-h-[44px] px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs sm:text-sm font-bold inline-flex items-center gap-2 cursor-pointer whitespace-nowrap"
            >
              <Printer className="w-4 h-4 text-amber-400 shrink-0" />
              <span>Cetak / Simpan PDF</span>
            </button>
          </div>
        </div>

        {/* Report Type Selector + Print Options */}
        <div className="bg-white rounded-2xl border border-slate-200 p-4 sm:p-5 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div
              role="tablist"
              aria-label="Jenis Laporan"
              className="grid grid-cols-1 sm:grid-cols-3 gap-1.5 p-1 bg-slate-100 rounded-xl flex-1"
            >
              <button
                type="button"
                role="tab"
                aria-selected={selectedReport === 'kbs'}
                onClick={() => setSelectedReport('kbs')}
                className={`min-h-[42px] px-3 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  selectedReport === 'kbs'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                1. Pengembalian Kas (KBS)
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={selectedReport === 'cashflow'}
                onClick={() => setSelectedReport('cashflow')}
                className={`min-h-[42px] px-3 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  selectedReport === 'cashflow'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                2. Pengajuan Cashflow
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={selectedReport === 'absensi'}
                onClick={() => setSelectedReport('absensi')}
                className={`min-h-[42px] px-3 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  selectedReport === 'absensi'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                3. Absensi &amp; Penggajian
              </button>
            </div>

            <button
              type="button"
              disabled={isExporting}
              onClick={handleExportCurrentExcel}
              className="min-h-[42px] px-4 py-2 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 disabled:opacity-60 text-slate-800 text-xs font-bold inline-flex items-center justify-center gap-1.5 cursor-pointer whitespace-nowrap"
            >
              {isExporting ? (
                <Loader2 className="w-4 h-4 animate-spin text-emerald-600 shrink-0" />
              ) : (
                <Download className="w-4 h-4 text-emerald-600 shrink-0" />
              )}
              <span>Unduh Excel Laporan Ini</span>
            </button>
          </div>

          {/* Editable Print Config (City, Date, Signatories, Receipt Photo Grid Checkbox) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 pt-3 border-t border-slate-100">
            <div>
              <label htmlFor="print-kota" className="block text-xs font-medium text-slate-600 mb-1">
                Kota Tanda Tangan
              </label>
              <input
                id="print-kota"
                type="text"
                value={printConfig.kota}
                onChange={(e) => onUpdatePrintConfig({ kota: e.target.value })}
                className="w-full min-h-[38px] rounded-lg border border-slate-300 px-3 py-1 text-xs"
              />
            </div>
            <div>
              <label htmlFor="print-tgl" className="block text-xs font-medium text-slate-600 mb-1">
                Tanggal Laporan
              </label>
              <input
                id="print-tgl"
                type="date"
                value={printConfig.tanggalCetak}
                onChange={(e) => onUpdatePrintConfig({ tanggalCetak: e.target.value })}
                className="w-full min-h-[38px] rounded-lg border border-slate-300 px-3 py-1 text-xs"
              />
            </div>
            <div>
              <label htmlFor="print-mengetahui" className="block text-xs font-medium text-slate-600 mb-1">
                Mengetahui
              </label>
              <input
                id="print-mengetahui"
                type="text"
                value={printConfig.mengetahuiNama}
                onChange={(e) => onUpdatePrintConfig({ mengetahuiNama: e.target.value })}
                className="w-full min-h-[38px] rounded-lg border border-slate-300 px-3 py-1 text-xs"
              />
            </div>
            <div>
              <label htmlFor="print-disetujui" className="block text-xs font-medium text-slate-600 mb-1">
                Disetujui
              </label>
              <input
                id="print-disetujui"
                type="text"
                value={printConfig.disetujuiNama}
                onChange={(e) => onUpdatePrintConfig({ disetujuiNama: e.target.value })}
                className="w-full min-h-[38px] rounded-lg border border-slate-300 px-3 py-1 text-xs"
              />
            </div>
            <div>
              <label htmlFor="print-dibuat" className="block text-xs font-medium text-slate-600 mb-1">
                Dibuat Oleh
              </label>
              <input
                id="print-dibuat"
                type="text"
                value={printConfig.dibuatNama}
                onChange={(e) => onUpdatePrintConfig({ dibuatNama: e.target.value })}
                className="w-full min-h-[38px] rounded-lg border border-slate-300 px-3 py-1 text-xs"
              />
            </div>
          </div>

          <label className="inline-flex items-center gap-2.5 text-xs font-semibold text-slate-800 cursor-pointer pt-1">
            <input
              type="checkbox"
              checked={printConfig.sertakanFotoNota}
              onChange={(e) => onUpdatePrintConfig({ sertakanFotoNota: e.target.checked })}
              className="w-4 h-4 rounded border-slate-300 text-slate-900 focus:ring-slate-900"
            />
            <span>
              Sertakan Lampiran Foto Nota ({receiptsWithPhotos.length} foto nota tersedia di periode ini)
            </span>
          </label>
        </div>
      </div>

      {/* FORMAL PRINT PREVIEW SHEET */}
      <article
        className="print-sheet bg-white rounded-2xl border border-slate-200 p-6 sm:p-8 shadow-xs text-slate-950"
        data-testid="print-preview-sheet"
      >
        {/* Kop Proyek Formal */}
        <header className="border-b-2 border-slate-900 pb-4 mb-5">
          <div className="bg-slate-900 text-white px-4 py-2.5 rounded-lg mb-3">
            <h2 className="text-base sm:text-lg font-extrabold uppercase tracking-tight">
              {selectedReport === 'kbs'
                ? 'LAPORAN PENGEMBALIAN KAS PROYEK (KBS)'
                : selectedReport === 'cashflow'
                ? 'PENGAJUAN CASHFLOW MINGGUAN PROYEK'
                : 'LAPORAN ABSENSI & PENGGAJIAN TUKANG MINGGUAN'}
            </h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-y-1.5 gap-x-8 text-xs">
            <div className="flex gap-2">
              <span className="font-bold w-36 shrink-0 whitespace-nowrap text-slate-600">PROYEK</span>
              <span className="font-semibold text-slate-950">: {project.nama}</span>
            </div>
            <div className="flex gap-2">
              <span className="font-bold w-36 shrink-0 whitespace-nowrap text-slate-600">MINGGU KE</span>
              <span className="font-semibold text-slate-950">: Minggu ke-{period.mingguKe}</span>
            </div>
            <div className="flex gap-2">
              <span className="font-bold w-36 shrink-0 whitespace-nowrap text-slate-600">LOKASI</span>
              <span className="text-slate-900">: {project.lokasi}</span>
            </div>
            <div className="flex gap-2">
              <span className="font-bold w-36 shrink-0 whitespace-nowrap text-slate-600">PERIODE</span>
              <span className="text-slate-900">
                : {selectedReport === 'absensi' ? period.labelPeriodeAbsensi : period.labelPeriodeKbs}
              </span>
            </div>
            <div className="flex gap-2 sm:col-span-2">
              <span className="font-bold w-36 shrink-0 whitespace-nowrap text-slate-600">PELAKSANA / MANDOR</span>
              <span className="text-slate-900">: {project.pelaksana} / {project.mandor}</span>
            </div>
          </div>
        </header>

        {/* REPORT 1: PENGEMBALIAN KAS (KBS) */}
        {selectedReport === 'kbs' && (
          <div className="space-y-5 text-xs">
            <div>
              <h3 className="font-bold uppercase px-3 py-1.5 bg-emerald-800 text-white rounded-t">
                A. PEMASUKAN (DEBET)
              </h3>
              <table className="w-full border border-slate-700">
                <thead>
                  <tr className="bg-slate-800 text-white">
                    <th className="border border-slate-700 px-2.5 py-1.5 text-left w-28">TANGGAL</th>
                    <th className="border border-slate-700 px-2.5 py-1.5 text-left">KETERANGAN</th>
                    <th className="border border-slate-700 px-2.5 py-1.5 text-right w-36">NOMINAL</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td className="border border-slate-700 px-2.5 py-1.5">
                      {formatDateShort(period.tanggalSaldoLalu)}
                    </td>
                    <td className="border border-slate-700 px-2.5 py-1.5 font-semibold">
                      SISA SALDO MINGGU LALU
                    </td>
                    <td
                      className={`border border-slate-700 px-2.5 py-1.5 text-right font-mono-num font-semibold ${
                        kbs.sisaSaldoLalu < 0 ? 'text-rose-700' : 'text-slate-900'
                      }`}
                    >
                      {formatRupiah(kbs.sisaSaldoLalu)}
                    </td>
                  </tr>
                  {period.dropingList.map((drop) => (
                    <tr key={drop.id} className="bg-slate-50/50">
                      <td className="border border-slate-700 px-2.5 py-1.5">
                        {formatDateShort(drop.tanggal)}
                      </td>
                      <td className="border border-slate-700 px-2.5 py-1.5">{drop.keterangan}</td>
                      <td className="border border-slate-700 px-2.5 py-1.5 text-right font-mono-num">
                        {formatRupiah(drop.nominal)}
                      </td>
                    </tr>
                  ))}
                  <tr className="bg-emerald-100 text-emerald-950 font-bold">
                    <td colSpan={2} className="border border-slate-700 px-2.5 py-1.5 text-right">
                      TOTAL PEMASUKAN
                    </td>
                    <td className="border border-slate-700 px-2.5 py-1.5 text-right font-mono-num">
                      {formatRupiah(kbs.totalPemasukan)}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div>
              <h3 className="font-bold uppercase px-3 py-1.5 bg-rose-900 text-white rounded-t">
                B. PENGELUARAN (KREDIT)
              </h3>
              <div className="overflow-x-auto">
                <table className="w-full border border-slate-700">
                  <thead>
                    <tr className="bg-slate-800 text-white">
                      <th className="border border-slate-700 px-2.5 py-1.5 text-left w-28">TANGGAL</th>
                      <th className="border border-slate-700 px-2.5 py-1.5 text-left w-44">KATEGORI</th>
                      <th className="border border-slate-700 px-2.5 py-1.5 text-left">URAIAN &amp; TOKO</th>
                      <th className="border border-slate-700 px-2.5 py-1.5 text-right w-36">NOMINAL</th>
                    </tr>
                  </thead>
                  <tbody>
                    {kbs.groupedExpenses.map((group) => (
                      <React.Fragment key={group.tanggal}>
                        {group.lines.map((line, idx) => (
                          <tr
                            key={`${line.transactionId}-${line.itemId}`}
                            className={idx % 2 === 1 ? 'bg-slate-50/70' : 'bg-white'}
                          >
                            <td className="border border-slate-700 px-2.5 py-1">
                              {idx === 0 ? formatDateShort(group.tanggal) : ''}
                            </td>
                            <td className="border border-slate-700 px-2.5 py-1">{line.kategori}</td>
                            <td className="border border-slate-700 px-2.5 py-1">
                              {line.deskripsi}
                              {line.qty && line.qty !== '1 ls' ? ` (${line.qty})` : ''}
                              <span className="text-slate-500"> · {line.namaToko}</span>
                            </td>
                            <td className="border border-slate-700 px-2.5 py-1 text-right font-mono-num">
                              {formatRupiah(line.nominal)}
                            </td>
                          </tr>
                        ))}
                        <tr className="bg-amber-50 font-bold">
                          <td colSpan={3} className="border border-slate-700 px-2.5 py-1 text-right">
                            SUB TOTAL ({formatDateShort(group.tanggal)})
                          </td>
                          <td className="border border-slate-700 px-2.5 py-1 text-right font-mono-num">
                            {formatRupiah(group.subTotal)}
                          </td>
                        </tr>
                      </React.Fragment>
                    ))}
                    <tr className="bg-rose-100 text-rose-950 font-bold">
                      <td colSpan={3} className="border border-slate-700 px-2.5 py-1.5 text-right">
                        TOTAL PENGELUARAN
                      </td>
                      <td className="border border-slate-700 px-2.5 py-1.5 text-right font-mono-num">
                        {formatRupiah(kbs.totalPengeluaran)}
                      </td>
                    </tr>
                    <tr className="bg-amber-200 font-extrabold">
                      <td colSpan={3} className="border border-slate-700 px-2.5 py-2 text-right">
                        SISA SALDO AKHIR KAS (KBS)
                      </td>
                      <td
                        className={`border border-slate-700 px-2.5 py-2 text-right font-mono-num ${
                          kbs.sisaSaldoAkhir < 0 ? 'text-rose-700' : 'text-slate-950'
                        }`}
                      >
                        {formatRupiah(kbs.sisaSaldoAkhir)}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* REPORT 2: PENGAJUAN CASHFLOW */}
        {selectedReport === 'cashflow' && (
          <div className="text-xs overflow-x-auto">
            <table className="w-full border border-slate-700">
              <thead>
                <tr className="bg-slate-800 text-white">
                  <th className="border border-slate-700 px-2.5 py-2 text-left w-48">KELOMPOK</th>
                  <th className="border border-slate-700 px-2.5 py-2 text-left">URAIAN PENGAJUAN</th>
                  <th className="border border-slate-700 px-2.5 py-2 text-left w-44">KETERANGAN</th>
                  <th className="border border-slate-700 px-2.5 py-2 text-right w-36">NOMINAL</th>
                </tr>
              </thead>
              <tbody>
                {CASHFLOW_GROUPS.map((grp) => {
                  const data = cashflow.byGroup[grp.key];
                  return (
                    <React.Fragment key={grp.key}>
                      <tr className="bg-slate-200 font-bold text-slate-900">
                        <td colSpan={4} className="border border-slate-700 px-2.5 py-1.5">
                          {grp.label}
                        </td>
                      </tr>
                      {data.items.length === 0 ? (
                        <tr>
                          <td className="border border-slate-700 px-2.5 py-1" />
                          <td className="border border-slate-700 px-2.5 py-1 text-slate-400">
                            (Tidak ada item)
                          </td>
                          <td className="border border-slate-700 px-2.5 py-1" />
                          <td className="border border-slate-700 px-2.5 py-1 text-right font-mono-num">
                            Rp 0
                          </td>
                        </tr>
                      ) : (
                        data.items.map((item, idx) => (
                          <tr key={item.id} className={idx % 2 === 1 ? 'bg-slate-50/70' : 'bg-white'}>
                            <td className="border border-slate-700 px-2.5 py-1" />
                            <td className="border border-slate-700 px-2.5 py-1">{item.deskripsi}</td>
                            <td className="border border-slate-700 px-2.5 py-1">{item.keterangan ?? ''}</td>
                            <td className="border border-slate-700 px-2.5 py-1 text-right font-mono-num">
                              {formatRupiah(item.nominal)}
                            </td>
                          </tr>
                        ))
                      )}
                      <tr className="bg-amber-50 font-semibold">
                        <td colSpan={3} className="border border-slate-700 px-2.5 py-1 text-right">
                          Sub Total {grp.label}
                        </td>
                        <td className="border border-slate-700 px-2.5 py-1 text-right font-mono-num">
                          {formatRupiah(data.total)}
                        </td>
                      </tr>
                    </React.Fragment>
                  );
                })}
                <tr className="bg-slate-100 font-bold">
                  <td colSpan={3} className="border border-slate-700 px-2.5 py-1.5 text-right">
                    SUB TOTAL PENGAJUAN (A s/d E)
                  </td>
                  <td className="border border-slate-700 px-2.5 py-1.5 text-right font-mono-num">
                    {formatRupiah(cashflow.subTotalPengajuan)}
                  </td>
                </tr>
                <tr
                  className={`font-bold ${
                    cashflow.saldoMingguLaluEffective < 0
                      ? 'bg-rose-100 text-rose-950'
                      : 'bg-emerald-100 text-emerald-950'
                  }`}
                >
                  <td colSpan={3} className="border border-slate-700 px-2.5 py-1.5 text-right">
                    SALDO MINGGU LALU {cashflow.isOverridden ? '(Manual)' : '(Dari KBS)'}
                  </td>
                  <td className="border border-slate-700 px-2.5 py-1.5 text-right font-mono-num">
                    {formatRupiah(cashflow.saldoMingguLaluEffective)}
                  </td>
                </tr>
                <tr className="bg-amber-200 font-extrabold">
                  <td colSpan={3} className="border border-slate-700 px-2.5 py-2 text-right">
                    TOTAL CASHFLOW DIAJUKAN
                  </td>
                  <td className="border border-slate-700 px-2.5 py-2 text-right font-mono-num">
                    {formatRupiah(cashflow.totalCashflowDiajukan)}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        )}

        {/* REPORT 3: ABSENSI & PENGGAJIAN */}
        {selectedReport === 'absensi' && (
          <div className="text-[11px] overflow-x-auto">
            <table className="w-full border border-slate-700">
              <thead>
                <tr className="bg-slate-900 text-white">
                  <th rowSpan={2} className="border border-slate-700 px-1.5 py-1 text-center">NO</th>
                  <th rowSpan={2} className="border border-slate-700 px-2 py-1 text-left">NAMA</th>
                  <th rowSpan={2} className="border border-slate-700 px-1.5 py-1 text-left">JABATAN</th>
                  {period.attendanceDates.map((d) => (
                    <th key={d} colSpan={2} className="border border-slate-700 px-1 py-1 text-center">
                      {getDayLabelShort(d)}
                      <span className="block text-[9px] font-mono-num font-normal text-slate-300">
                        {d.slice(8, 10)}/{d.slice(5, 7)}
                      </span>
                    </th>
                  ))}
                  <th rowSpan={2} className="border border-slate-700 px-1.5 py-1 text-right">HARI</th>
                  <th rowSpan={2} className="border border-slate-700 px-1.5 py-1 text-right">UPAH</th>
                  <th rowSpan={2} className="border border-slate-700 px-1.5 py-1 text-right">TOTAL</th>
                  <th rowSpan={2} className="border border-slate-700 px-1.5 py-1 text-right">KASBON</th>
                  <th rowSpan={2} className="border border-slate-700 px-2 py-1 text-right">TOTAL BAYAR</th>
                  <th rowSpan={2} className="border border-slate-700 px-2 py-1 text-left">KET</th>
                </tr>
                <tr className="bg-slate-700 text-white text-[10px]">
                  {period.attendanceDates.map((d) => (
                    <React.Fragment key={d}>
                      <th className="border border-slate-600 px-1 py-0.5 text-center">N</th>
                      <th className="border border-slate-600 px-1 py-0.5 text-center">L</th>
                    </React.Fragment>
                  ))}
                </tr>
              </thead>
              <tbody>
                {payroll.rows.map((row, idx) => (
                  <tr key={row.worker.id} className={idx % 2 === 1 ? 'bg-slate-50/70' : 'bg-white'}>
                    <td className="border border-slate-700 px-1.5 py-1 text-center font-mono-num">
                      {idx + 1}
                    </td>
                    <td className="border border-slate-700 px-2 py-1 font-bold">{row.worker.nama}</td>
                    <td className="border border-slate-700 px-1.5 py-1">{row.worker.jabatan}</td>
                    {period.attendanceDates.map((d) => {
                      const rec = row.daily[d] ?? { normal: 0, lembur: 0 };
                      return (
                        <React.Fragment key={d}>
                          <td className="border border-slate-700 px-1 py-1 text-center font-mono-num">
                            {rec.normal > 0 ? formatDays(rec.normal) : '-'}
                          </td>
                          <td
                            className={`border border-slate-700 px-1 py-1 text-center font-mono-num ${
                              rec.lembur > 0 ? 'bg-amber-50 font-semibold text-amber-800' : ''
                            }`}
                          >
                            {rec.lembur > 0 ? formatDays(rec.lembur) : '-'}
                          </td>
                        </React.Fragment>
                      );
                    })}
                    <td className="border border-slate-700 px-1.5 py-1 text-right font-mono-num font-bold">
                      {formatDays(row.jmlHari)}
                    </td>
                    <td className="border border-slate-700 px-1.5 py-1 text-right font-mono-num">
                      {formatNumberId(row.upah)}
                    </td>
                    <td className="border border-slate-700 px-1.5 py-1 text-right font-mono-num">
                      {formatNumberId(row.totalKotor)}
                    </td>
                    <td
                      className={`border border-slate-700 px-1.5 py-1 text-right font-mono-num ${
                        row.kasbon > 0 ? 'text-rose-700 font-semibold' : ''
                      }`}
                    >
                      {formatNumberId(row.kasbon)}
                    </td>
                    <td className="border border-slate-700 px-2 py-1 text-right font-mono-num font-bold bg-emerald-50 text-emerald-900">
                      {formatRupiah(row.totalBayar)}
                    </td>
                    <td className="border border-slate-700 px-2 py-1">{row.keterangan}</td>
                  </tr>
                ))}
                <tr className="bg-amber-200 font-extrabold">
                  <td
                    colSpan={3 + period.attendanceDates.length * 2}
                    className="border border-slate-700 px-2 py-1.5 text-right"
                  >
                    GRAND TOTAL
                  </td>
                  <td className="border border-slate-700 px-1.5 py-1.5 text-right font-mono-num">
                    {formatDays(payroll.grandTotalHari)}
                  </td>
                  <td className="border border-slate-700 px-1.5 py-1.5 text-center">-</td>
                  <td className="border border-slate-700 px-1.5 py-1.5 text-right font-mono-num">
                    {formatNumberId(payroll.grandTotalKotor)}
                  </td>
                  <td className="border border-slate-700 px-1.5 py-1.5 text-right font-mono-num">
                    {formatNumberId(payroll.grandTotalKasbon)}
                  </td>
                  <td className="border border-slate-700 px-2 py-1.5 text-right font-mono-num text-emerald-900">
                    {formatRupiah(payroll.grandTotalBayar)}
                  </td>
                  <td className="border border-slate-700 px-2 py-1.5" />
                </tr>
              </tbody>
            </table>
          </div>
        )}

        {/* Signature Block */}
        <footer className="mt-8 print-avoid-break">
          <div className="text-right text-xs mb-5">
            {printConfig.kota}, {formatDateIndo(printConfig.tanggalCetak)}
          </div>
          <div className="grid grid-cols-3 gap-6 text-center text-xs">
            <div>
              <div className="font-semibold">{printConfig.mengetahuiJabatan},</div>
              <div className="h-16" />
              <div className="font-bold underline underline-offset-4">{printConfig.mengetahuiNama}</div>
            </div>
            <div>
              <div className="font-semibold">{printConfig.disetujuiJabatan},</div>
              <div className="h-16" />
              <div className="font-bold underline underline-offset-4">{printConfig.disetujuiNama}</div>
            </div>
            <div>
              <div className="font-semibold">{printConfig.dibuatJabatan},</div>
              <div className="h-16" />
              <div className="font-bold underline underline-offset-4">{printConfig.dibuatNama}</div>
            </div>
          </div>
        </footer>

        {/* Optional Receipt Photo Attachment Page */}
        {printConfig.sertakanFotoNota && (
          <section className="mt-10 pt-6 border-t-2 border-dashed border-slate-300 print-break-before">
            <h3 className="text-sm font-extrabold uppercase tracking-tight text-slate-950 mb-1">
              LAMPIRAN FOTO NOTA FISIK · {project.nama} (Minggu ke-{period.mingguKe})
            </h3>
            <p className="text-xs text-slate-500 mb-4">
              {receiptsWithPhotos.length > 0
                ? `${receiptsWithPhotos.length} lampiran bukti transaksi fisik`
                : 'Belum ada transaksi yang melampirkan foto nota pada periode ini. Gunakan fitur Scan Nota untuk melampirkan bukti fisik.'}
            </p>
            {receiptsWithPhotos.length > 0 && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {receiptsWithPhotos.map((tx, idx) => (
                  <figure
                    key={tx.id}
                    className="border border-slate-300 rounded-lg p-3 print-avoid-break bg-white"
                  >
                    <img
                      src={tx.fotoNota}
                      alt={`Lampiran nota ${tx.namaToko}`}
                      referrerPolicy="no-referrer"
                      className="w-full h-56 object-contain bg-slate-50 rounded"
                    />
                    <figcaption className="mt-2 text-xs text-slate-800 flex items-center justify-between gap-2">
                      <span className="font-semibold truncate">
                        {idx + 1}. {tx.namaToko} ({formatDateShort(tx.tanggal)})
                      </span>
                      <span className="font-mono-num font-bold shrink-0">
                        {formatRupiah(tx.totalNominal)}
                      </span>
                    </figcaption>
                  </figure>
                ))}
              </div>
            )}
          </section>
        )}
      </article>
    </div>
  );
};
