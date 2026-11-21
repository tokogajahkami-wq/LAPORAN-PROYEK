import React, { useRef, useState } from 'react';
import {
  Camera,
  Upload,
  Sparkles,
  Plus,
  Trash2,
  X,
  Loader2,
  AlertCircle,
  CheckCircle2,
  ArrowDownCircle,
  FileEdit,
  RefreshCw,
} from 'lucide-react';
import {
  EXPENSE_CATEGORIES,
  type DropingEntry,
  type ExpenseCategory,
  type ExpenseTransaction,
  type FundingSource,
  type ScannedReceiptResult,
  type TransactionItem,
} from '../types';
import { compressReceiptImage } from '../utils/imageCompress';
import { formatRupiah } from '../utils/calculations';

interface ScanNotaModalProps {
  isOpen: boolean;
  initialMode: 'scan' | 'manual' | 'droping';
  defaultDate: string;
  defaultPelaksana: string;
  onClose: () => void;
  onSaveExpense: (tx: ExpenseTransaction) => void;
  onSaveDroping: (entry: DropingEntry) => void;
}

function makeId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

export const ScanNotaModal: React.FC<ScanNotaModalProps> = ({
  isOpen,
  initialMode,
  defaultDate,
  defaultPelaksana,
  onClose,
  onSaveExpense,
  onSaveDroping,
}) => {
  const [mode, setMode] = useState<'scan' | 'manual' | 'droping'>(initialMode);
  const [photoDataUrl, setPhotoDataUrl] = useState<string | undefined>(undefined);
  const [photoMimeType, setPhotoMimeType] = useState<string>('image/jpeg');
  const [photoSizeKb, setPhotoSizeKb] = useState<number>(0);
  const [isScanning, setIsScanning] = useState(false);
  const [scanSuccessMsg, setScanSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Expense form fields
  const [tanggal, setTanggal] = useState(defaultDate);
  const [namaToko, setNamaToko] = useState('');
  const [kategori, setKategori] = useState<ExpenseCategory>('MATERIAL & ALAT BANTU');
  const [sumberDana, setSumberDana] = useState<FundingSource>('KBS');
  const [namaPengaju, setNamaPengaju] = useState(defaultPelaksana);
  const [catatan, setCatatan] = useState('');
  const [items, setItems] = useState<TransactionItem[]>([
    { id: makeId('it'), deskripsi: '', qty: '1 ls', nominal: 0 },
  ]);

  // Droping form fields
  const [dropTanggal, setDropTanggal] = useState(defaultDate);
  const [dropKeterangan, setDropKeterangan] = useState('DROPING Kas Proyek');
  const [dropNominal, setDropNominal] = useState<string>('');

  const cameraInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const totalNominal = items.reduce((sum, it) => sum + (Number(it.nominal) || 0), 0);

  const runAiScan = async (dataUrl: string, mimeType: string) => {
    setErrorMsg(null);
    setScanSuccessMsg(null);
    setIsScanning(true);

    try {
      const controller = new AbortController();
      const timeoutId = window.setTimeout(() => controller.abort(), 95000);
      let res: Response;
      try {
        res = await fetch('/api/scan-nota', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          signal: controller.signal,
          body: JSON.stringify({
            imageBase64: dataUrl,
            mimeType,
            defaultDate,
          }),
        });
      } catch (fetchErr) {
        if (fetchErr instanceof Error && fetchErr.name === 'AbortError') {
          throw new Error(
            "Waktu pemindaian nota habis. Tekan 'Coba Scan Ulang' atau lengkapi rincian di bawah secara manual."
          );
        }
        throw fetchErr;
      } finally {
        window.clearTimeout(timeoutId);
      }

      const rawBody = await res.text();
      let payload: Record<string, unknown> | null = null;
      try {
        payload = rawBody ? (JSON.parse(rawBody) as Record<string, unknown>) : null;
      } catch {
        payload = null;
      }

      if (!res.ok) {
        if (payload && typeof payload.error === 'string' && payload.error) {
          throw new Error(payload.error);
        }
        if (res.status === 404) {
          throw new Error(
            'Endpoint /api/scan-nota tidak ditemukan di server (404). Pastikan fungsi API server sudah ikut ter-deploy.'
          );
        }
        const plainSnippet = rawBody
          .replace(/<[^>]+>/g, ' ')
          .replace(/\s+/g, ' ')
          .trim()
          .slice(0, 140);
        throw new Error(
          plainSnippet
            ? `Server AI error (HTTP ${res.status}): ${plainSnippet}`
            : `Server AI mengembalikan respons tidak valid (HTTP ${res.status}). Silakan coba lagi atau lengkapi rincian nota secara manual.`
        );
      }

      if (!payload) {
        throw new Error(
          'Respons server Scan Nota kosong atau bukan JSON valid. Silakan coba lagi atau isi rincian secara manual.'
        );
      }

      const result = payload as unknown as ScannedReceiptResult;
      setTanggal(result.tanggal || defaultDate);
      setNamaToko(result.nama_toko || '');
      setKategori(
        EXPENSE_CATEGORIES.includes(result.kategori) ? result.kategori : 'MATERIAL & ALAT BANTU'
      );
      if (Array.isArray(result.items) && result.items.length > 0) {
        setItems(
          result.items.map((it) => ({
            id: makeId('it'),
            deskripsi: it.deskripsi,
            qty: it.qty || '1 ls',
            nominal: Number(it.nominal) || 0,
          }))
        );
      } else {
        setItems([
          {
            id: makeId('it'),
            deskripsi: result.nama_toko || 'Belanja Proyek',
            qty: '1 ls',
            nominal: Number(result.total_nominal) || 0,
          },
        ]);
      }
      setScanSuccessMsg(
        'Nota berhasil dibaca oleh Gemini AI. Silakan periksa & verifikasi rincian di bawah sebelum menyimpan.'
      );
    } catch (err) {
      setErrorMsg(
        err instanceof Error
          ? err.message
          : 'Gagal memindai nota. Anda tetap bisa melengkapi rincian di bawah secara manual.'
      );
    } finally {
      setIsScanning(false);
    }
  };

  const handleFileSelected = async (file: File | undefined) => {
    if (!file) return;
    setErrorMsg(null);
    setScanSuccessMsg(null);
    setIsScanning(true);

    try {
      const compressed = await compressReceiptImage(file, 1024, 0.68);
      setPhotoDataUrl(compressed.dataUrl);
      setPhotoMimeType(compressed.mimeType);
      setPhotoSizeKb(compressed.sizeKb);
      await runAiScan(compressed.dataUrl, compressed.mimeType);
    } catch (err) {
      setErrorMsg(
        err instanceof Error
          ? err.message
          : 'Gagal memproses foto nota. Silakan coba gambar lain.'
      );
      setIsScanning(false);
    }
  };

  const handleUpdateItem = (id: string, patch: Partial<TransactionItem>) => {
    setItems((prev) => prev.map((it) => (it.id === id ? { ...it, ...patch } : it)));
  };

  const handleAddItem = () => {
    setItems((prev) => [...prev, { id: makeId('it'), deskripsi: '', qty: '1 ls', nominal: 0 }]);
  };

  const handleRemoveItem = (id: string) => {
    setItems((prev) => (prev.length > 1 ? prev.filter((it) => it.id !== id) : prev));
  };

  const handleSubmitExpense = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    const validItems = items
      .map((it) => ({
        ...it,
        deskripsi: it.deskripsi.trim(),
        qty: it.qty.trim() || '1 ls',
        nominal: Math.max(0, Math.round(Number(it.nominal) || 0)),
      }))
      .filter((it) => it.deskripsi.length > 0 && it.nominal > 0);

    if (!tanggal) {
      setErrorMsg('Tanggal transaksi wajib diisi.');
      return;
    }
    if (validItems.length === 0) {
      setErrorMsg('Isi minimal 1 rincian barang/pengeluaran beserta nominal lebih dari Rp 0.');
      return;
    }
    if (sumberDana === 'REMBES' && !namaPengaju.trim()) {
      setErrorMsg('Nama pengaju rembes wajib diisi.');
      return;
    }

    const total = validItems.reduce((sum, it) => sum + it.nominal, 0);
    const tx: ExpenseTransaction = {
      id: makeId('tx'),
      tanggal,
      namaToko: namaToko.trim() || (sumberDana === 'REMBES' ? 'Belanja Pribadi' : 'Pengeluaran Lapangan'),
      kategori,
      sumberDana,
      items: validItems,
      totalNominal: total,
      fotoNota: photoDataUrl,
      catatan: catatan.trim() || undefined,
      namaPengaju: sumberDana === 'REMBES' ? namaPengaju.trim() : undefined,
      rembesStatus: sumberDana === 'REMBES' ? 'Menunggu' : undefined,
      createdAt: new Date().toISOString(),
    };

    onSaveExpense(tx);
    onClose();
  };

  const handleSubmitDroping = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    const nominalVal = Math.round(Number(dropNominal.replace(/[^\d]/g, '')) || 0);
    if (!dropTanggal) {
      setErrorMsg('Tanggal droping wajib diisi.');
      return;
    }
    if (!dropKeterangan.trim()) {
      setErrorMsg('Keterangan droping wajib diisi.');
      return;
    }
    if (nominalVal <= 0) {
      setErrorMsg('Nominal droping harus lebih dari Rp 0.');
      return;
    }

    onSaveDroping({
      id: makeId('drop'),
      tanggal: dropTanggal,
      keterangan: dropKeterangan.trim(),
      nominal: nominalVal,
    });
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-900/60 backdrop-blur-xs sm:p-4 no-print"
      role="dialog"
      aria-modal="true"
      aria-labelledby="scan-modal-title"
    >
      <div className="w-full max-w-2xl max-h-[92vh] bg-white rounded-t-3xl sm:rounded-2xl border border-slate-200 shadow-2xl flex flex-col overflow-hidden">
        {/* Modal Header */}
        <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between gap-3 shrink-0">
          <div>
            <h2 id="scan-modal-title" className="text-lg font-bold text-slate-900">
              {mode === 'scan'
                ? 'AI Scan Nota Fisik'
                : mode === 'manual'
                ? 'Input Pengeluaran Manual'
                : 'Catat Droping Dana Kas'}
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              {mode === 'scan'
                ? 'Foto nota toko bangunan/BBM, AI otomatis ekstrak rincian & nominal'
                : mode === 'manual'
                ? 'Catat pengeluaran non-nota seperti koordinasi lingkungan atau iuran'
                : 'Tambah pemasukan droping dana dari kantor pusat ke Kas Proyek'}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Tutup modal transaksi"
            className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl text-slate-500 hover:bg-slate-100 cursor-pointer shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Mode Tabs */}
        <div className="px-5 pt-3 pb-2 bg-slate-50 border-b border-slate-200 shrink-0">
          <div className="grid grid-cols-3 gap-1 p-1 bg-slate-200/70 rounded-xl">
            <button
              type="button"
              onClick={() => {
                setMode('scan');
                setErrorMsg(null);
              }}
              className={`min-h-[40px] rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer whitespace-nowrap ${
                mode === 'scan'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5 text-amber-500 shrink-0" />
              <span>AI Scan Nota</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setMode('manual');
                setErrorMsg(null);
              }}
              className={`min-h-[40px] rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer whitespace-nowrap ${
                mode === 'manual'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <FileEdit className="w-3.5 h-3.5 shrink-0" />
              <span>Input Manual</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setMode('droping');
                setErrorMsg(null);
              }}
              className={`min-h-[40px] rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer whitespace-nowrap ${
                mode === 'droping'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <ArrowDownCircle className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
              <span>Droping Dana</span>
            </button>
          </div>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {errorMsg && (
            <div
              role="alert"
              className="rounded-xl bg-rose-50 border border-rose-200 p-3.5 flex flex-col gap-2.5 text-sm text-rose-800"
            >
              <div className="flex items-start gap-2.5">
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                <span className="flex-1">{errorMsg}</span>
              </div>
              {mode === 'scan' && photoDataUrl && !isScanning && (
                <div className="pl-6">
                  <button
                    type="button"
                    onClick={() => runAiScan(photoDataUrl, photoMimeType)}
                    className="min-h-[38px] inline-flex items-center gap-1.5 rounded-lg bg-rose-700 hover:bg-rose-800 text-white text-xs font-semibold px-3 py-1.5 transition-colors cursor-pointer whitespace-nowrap"
                  >
                    <RefreshCw className="w-3.5 h-3.5 shrink-0" />
                    <span>Coba Scan Ulang</span>
                  </button>
                </div>
              )}
            </div>
          )}

          {scanSuccessMsg && mode === 'scan' && (
            <div
              role="status"
              className="rounded-xl bg-emerald-50 border border-emerald-200 p-3.5 flex items-start gap-2.5 text-sm text-emerald-800"
            >
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              <span>{scanSuccessMsg}</span>
            </div>
          )}

          {mode === 'droping' ? (
            <form id="droping-form" onSubmit={handleSubmitDroping} className="space-y-4">
              <div>
                <label htmlFor="drop-tanggal" className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Tanggal Droping
                </label>
                <input
                  id="drop-tanggal"
                  type="date"
                  value={dropTanggal}
                  onChange={(e) => setDropTanggal(e.target.value)}
                  required
                  className="w-full min-h-[44px] rounded-xl border border-slate-300 px-3.5 py-2 text-sm text-slate-900 focus:border-slate-900 focus:outline-none"
                />
              </div>

              <div>
                <label htmlFor="drop-ket" className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Keterangan Pemasukan / Droping
                </label>
                <input
                  id="drop-ket"
                  type="text"
                  value={dropKeterangan}
                  onChange={(e) => setDropKeterangan(e.target.value)}
                  placeholder="Contoh: DROPING Kas Proyek Tahap 2"
                  required
                  className="w-full min-h-[44px] rounded-xl border border-slate-300 px-3.5 py-2 text-sm text-slate-900 focus:border-slate-900 focus:outline-none"
                />
              </div>

              <div>
                <label htmlFor="drop-nominal" className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Nominal Droping (Rp)
                </label>
                <input
                  id="drop-nominal"
                  type="number"
                  min={1}
                  step={1000}
                  value={dropNominal}
                  onChange={(e) => setDropNominal(e.target.value)}
                  placeholder="2000000"
                  required
                  className="w-full min-h-[44px] rounded-xl border border-slate-300 px-3.5 py-2 text-base font-bold font-mono-num text-emerald-700 focus:border-slate-900 focus:outline-none"
                />
                {Number(dropNominal) > 0 && (
                  <p className="mt-1 text-xs text-slate-500 font-mono-num">
                    Terbaca: {formatRupiah(Number(dropNominal))}
                  </p>
                )}
              </div>
            </form>
          ) : (
            <form id="expense-form" onSubmit={handleSubmitExpense} className="space-y-5">
              {/* Camera / Gallery Upload Area (shown in scan mode, or optional photo attach in manual) */}
              {mode === 'scan' && (
                <div className="space-y-3">
                  <input
                    ref={cameraInputRef}
                    type="file"
                    accept="image/*"
                    capture="environment"
                    className="hidden"
                    onChange={(e) => {
                      handleFileSelected(e.target.files?.[0]);
                      e.target.value = '';
                    }}
                  />
                  <input
                    ref={galleryInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      handleFileSelected(e.target.files?.[0]);
                      e.target.value = '';
                    }}
                  />

                  <div className="grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      disabled={isScanning}
                      onClick={() => cameraInputRef.current?.click()}
                      className="min-h-[56px] flex flex-col sm:flex-row items-center justify-center gap-2 rounded-xl bg-amber-500 hover:bg-amber-400 disabled:opacity-60 text-slate-950 font-bold text-sm px-4 py-3 transition-colors cursor-pointer"
                    >
                      <Camera className="w-5 h-5 shrink-0" />
                      <span>Foto Kamera HP</span>
                    </button>
                    <button
                      type="button"
                      disabled={isScanning}
                      onClick={() => galleryInputRef.current?.click()}
                      className="min-h-[56px] flex flex-col sm:flex-row items-center justify-center gap-2 rounded-xl bg-slate-900 hover:bg-slate-800 disabled:opacity-60 text-white font-semibold text-sm px-4 py-3 transition-colors cursor-pointer"
                    >
                      <Upload className="w-5 h-5 shrink-0" />
                      <span>Upload Galeri</span>
                    </button>
                  </div>

                  {isScanning && (
                    <div className="rounded-xl bg-slate-50 border border-slate-200 p-4 flex items-center gap-3 text-sm text-slate-700">
                      <Loader2 className="w-5 h-5 animate-spin text-amber-500 shrink-0" />
                      <div>
                        <div className="font-semibold text-slate-900">
                          Membaca nota dengan Gemini AI...
                        </div>
                        <div className="text-xs text-slate-500">
                          Mengekstrak nama toko, tanggal, daftar barang, dan total rupiah.
                        </div>
                      </div>
                    </div>
                  )}

                  {photoDataUrl && (
                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 flex items-center gap-3">
                      <img
                        src={photoDataUrl}
                        alt="Pratinjau foto nota belanja"
                        referrerPolicy="no-referrer"
                        className="w-20 h-20 rounded-lg object-cover border border-slate-200 bg-white shrink-0"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="text-xs font-semibold text-slate-800">
                          Lampiran Foto Nota Tersimpan
                        </div>
                        <div className="text-xs text-slate-500 mt-0.5">
                          Ukuran terkompresi ~{photoSizeKb} KB · Otomatis dilampirkan pada laporan PDF
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            setPhotoDataUrl(undefined);
                            setScanSuccessMsg(null);
                          }}
                          className="mt-1.5 text-xs font-semibold text-rose-600 hover:text-rose-700 cursor-pointer"
                        >
                          Hapus Foto
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Form Verifikasi Cepat */}
              <div className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  <div>
                    <label htmlFor="tx-tanggal" className="block text-xs font-semibold text-slate-700 mb-1.5">
                      Tanggal Nota
                    </label>
                    <input
                      id="tx-tanggal"
                      type="date"
                      value={tanggal}
                      onChange={(e) => setTanggal(e.target.value)}
                      required
                      className="w-full min-h-[44px] rounded-xl border border-slate-300 px-3.5 py-2 text-sm text-slate-900 focus:border-slate-900 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label htmlFor="tx-toko" className="block text-xs font-semibold text-slate-700 mb-1.5">
                      Nama Toko / Penerima
                    </label>
                    <input
                      id="tx-toko"
                      type="text"
                      value={namaToko}
                      onChange={(e) => setNamaToko(e.target.value)}
                      placeholder="Contoh: TB Mitra Bangunan / SPBU"
                      className="w-full min-h-[44px] rounded-xl border border-slate-300 px-3.5 py-2 text-sm text-slate-900 focus:border-slate-900 focus:outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label htmlFor="tx-kategori" className="block text-xs font-semibold text-slate-700 mb-1.5">
                    Kategori Pengeluaran
                  </label>
                  <select
                    id="tx-kategori"
                    value={kategori}
                    onChange={(e) => setKategori(e.target.value as ExpenseCategory)}
                    className="w-full min-h-[44px] rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-sm font-medium text-slate-900 focus:border-slate-900 focus:outline-none"
                  >
                    {EXPENSE_CATEGORIES.map((cat) => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Sumber Dana Selector */}
                <div>
                  <span className="block text-xs font-semibold text-slate-700 mb-1.5">
                    Sumber Dana
                  </span>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    <button
                      type="button"
                      onClick={() => setSumberDana('KBS')}
                      aria-pressed={sumberDana === 'KBS'}
                      className={`min-h-[52px] text-left rounded-xl border p-3 transition-all cursor-pointer ${
                        sumberDana === 'KBS'
                          ? 'border-slate-900 bg-slate-900 text-white'
                          : 'border-slate-300 bg-white text-slate-800 hover:bg-slate-50'
                      }`}
                    >
                      <div className="text-sm font-bold">Kas Proyek (KBS)</div>
                      <div
                        className={`text-xs mt-0.5 ${
                          sumberDana === 'KBS' ? 'text-slate-300' : 'text-slate-500'
                        }`}
                      >
                        Langsung memotong saldo kas proyek
                      </div>
                    </button>
                    <button
                      type="button"
                      onClick={() => setSumberDana('REMBES')}
                      aria-pressed={sumberDana === 'REMBES'}
                      className={`min-h-[52px] text-left rounded-xl border p-3 transition-all cursor-pointer ${
                        sumberDana === 'REMBES'
                          ? 'border-amber-500 bg-amber-500 text-slate-950'
                          : 'border-slate-300 bg-white text-slate-800 hover:bg-slate-50'
                      }`}
                    >
                      <div className="text-sm font-bold">Uang Pribadi (Rembes)</div>
                      <div
                        className={`text-xs mt-0.5 ${
                          sumberDana === 'REMBES' ? 'text-slate-900/80' : 'text-slate-500'
                        }`}
                      >
                        Masuk antrean klaim approval admin
                      </div>
                    </button>
                  </div>
                </div>

                {sumberDana === 'REMBES' && (
                  <div>
                    <label htmlFor="tx-pengaju" className="block text-xs font-semibold text-slate-700 mb-1.5">
                      Nama Pengaju Rembes
                    </label>
                    <input
                      id="tx-pengaju"
                      type="text"
                      value={namaPengaju}
                      onChange={(e) => setNamaPengaju(e.target.value)}
                      placeholder="Nama pelaksana / mandor"
                      required
                      className="w-full min-h-[44px] rounded-xl border border-slate-300 px-3.5 py-2 text-sm text-slate-900 focus:border-slate-900 focus:outline-none"
                    />
                  </div>
                )}

                {/* Editable Line Items */}
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-semibold text-slate-700">
                      Rincian Item Belanja
                    </span>
                    <button
                      type="button"
                      onClick={handleAddItem}
                      className="inline-flex items-center gap-1 text-xs font-semibold text-slate-900 hover:text-amber-600 cursor-pointer py-1 px-2"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Tambah Baris</span>
                    </button>
                  </div>

                  <div className="space-y-2.5">
                    {items.map((item, idx) => (
                      <div
                        key={item.id}
                        className="grid grid-cols-12 gap-2 items-center bg-slate-50 p-2.5 rounded-xl border border-slate-200"
                      >
                        <div className="col-span-12 sm:col-span-5">
                          <label htmlFor={`item-desc-${item.id}`} className="sr-only">
                            Deskripsi item {idx + 1}
                          </label>
                          <input
                            id={`item-desc-${item.id}`}
                            type="text"
                            value={item.deskripsi}
                            onChange={(e) => handleUpdateItem(item.id, { deskripsi: e.target.value })}
                            placeholder="Nama barang / uraian"
                            className="w-full min-h-[40px] rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-sm text-slate-900 focus:border-slate-900 focus:outline-none"
                          />
                        </div>
                        <div className="col-span-4 sm:col-span-2">
                          <label htmlFor={`item-qty-${item.id}`} className="sr-only">
                            Qty item {idx + 1}
                          </label>
                          <input
                            id={`item-qty-${item.id}`}
                            type="text"
                            value={item.qty}
                            onChange={(e) => handleUpdateItem(item.id, { qty: e.target.value })}
                            placeholder="Qty"
                            className="w-full min-h-[40px] rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-sm text-slate-900 focus:border-slate-900 focus:outline-none"
                          />
                        </div>
                        <div className="col-span-6 sm:col-span-4">
                          <label htmlFor={`item-nom-${item.id}`} className="sr-only">
                            Nominal Rupiah item {idx + 1}
                          </label>
                          <input
                            id={`item-nom-${item.id}`}
                            type="number"
                            min={0}
                            step={500}
                            value={item.nominal === 0 ? '' : item.nominal}
                            onChange={(e) =>
                              handleUpdateItem(item.id, {
                                nominal: Math.max(0, Number(e.target.value) || 0),
                              })
                            }
                            placeholder="Nominal Rp"
                            className="w-full min-h-[40px] rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-sm font-mono-num font-semibold text-right text-slate-900 focus:border-slate-900 focus:outline-none"
                          />
                        </div>
                        <div className="col-span-2 sm:col-span-1 flex justify-end">
                          <button
                            type="button"
                            onClick={() => handleRemoveItem(item.id)}
                            disabled={items.length <= 1}
                            aria-label={`Hapus baris item ${idx + 1}`}
                            className="min-h-[40px] min-w-[40px] flex items-center justify-center rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 disabled:opacity-30 cursor-pointer"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t border-slate-200">
                    <span className="text-sm font-semibold text-slate-600">Total Transaksi</span>
                    <span className="text-lg font-bold font-mono-num text-slate-900">
                      {formatRupiah(totalNominal)}
                    </span>
                  </div>
                </div>

                <div>
                  <label htmlFor="tx-catatan" className="block text-xs font-semibold text-slate-700 mb-1.5">
                    Catatan Tambahan (Opsional)
                  </label>
                  <input
                    id="tx-catatan"
                    type="text"
                    value={catatan}
                    onChange={(e) => setCatatan(e.target.value)}
                    placeholder="Keterangan singkat penggunaan di lapangan"
                    className="w-full min-h-[44px] rounded-xl border border-slate-300 px-3.5 py-2 text-sm text-slate-900 focus:border-slate-900 focus:outline-none"
                  />
                </div>
              </div>
            </form>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-5 py-4 border-t border-slate-200 bg-slate-50 flex items-center justify-end gap-3 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="min-h-[44px] px-4 py-2 rounded-xl border border-slate-300 bg-white text-sm font-semibold text-slate-700 hover:bg-slate-100 cursor-pointer"
          >
            Batal
          </button>
          <button
            type="submit"
            form={mode === 'droping' ? 'droping-form' : 'expense-form'}
            disabled={isScanning}
            className="min-h-[44px] px-5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white text-sm font-bold cursor-pointer"
          >
            {mode === 'droping'
              ? 'Simpan Droping Dana'
              : sumberDana === 'REMBES'
              ? 'Ajukan Klaim Rembes'
              : 'Simpan ke Kas Proyek'}
          </button>
        </div>
      </div>
    </div>
  );
};
