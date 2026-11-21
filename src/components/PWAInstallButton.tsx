import React, { useState } from 'react';
import { CheckCircle2, Download, Smartphone, X } from 'lucide-react';
import { usePWAInstall } from '../hooks/usePWAInstall';

interface PWAInstallButtonProps {
  compact?: boolean;
  showFallbackGuide?: boolean;
}

export const PWAInstallButton: React.FC<PWAInstallButtonProps> = ({
  compact = false,
  showFallbackGuide = false,
}) => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showIOSGuide, setShowIOSGuide] = useState(false);

  if (isInstalled) {
    if (showFallbackGuide) {
      return (
        <div className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3.5 py-2.5 text-xs font-medium text-emerald-800">
          <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
          <span>Aplikasi sudah terpasang dan berjalan dalam mode layar utama.</span>
        </div>
      );
    }
    return null;
  }

  if (isInstallable) {
    return (
      <button
        type="button"
        onClick={install}
        className={`inline-flex items-center justify-center gap-2 rounded-lg bg-slate-900 text-white font-medium transition-colors hover:bg-slate-800 whitespace-nowrap shrink-0 cursor-pointer ${
          compact ? 'px-3 py-2 text-xs min-h-[40px]' : 'w-full px-4 py-2.5 text-sm min-h-[44px]'
        }`}
      >
        <Download className="w-4 h-4 shrink-0" />
        <span>Install Aplikasi</span>
      </button>
    );
  }

  if (isIOS) {
    return (
      <>
        <button
          type="button"
          onClick={() => setShowIOSGuide(true)}
          className={`inline-flex items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white text-slate-800 font-medium transition-colors hover:bg-slate-50 whitespace-nowrap shrink-0 cursor-pointer ${
            compact ? 'px-3 py-2 text-xs min-h-[40px]' : 'w-full px-4 py-2.5 text-sm min-h-[44px]'
          }`}
        >
          <Smartphone className="w-4 h-4 shrink-0" />
          <span>Install di iPhone</span>
        </button>

        {showIOSGuide && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4 no-print"
            role="dialog"
            aria-modal="true"
            aria-labelledby="ios-install-title"
          >
            <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl border border-slate-200">
              <div className="flex items-center justify-between gap-4">
                <h3 id="ios-install-title" className="text-base font-bold text-slate-900">
                  Install di iPhone / iPad
                </h3>
                <button
                  type="button"
                  onClick={() => setShowIOSGuide(false)}
                  aria-label="Tutup panduan install"
                  className="min-h-[40px] min-w-[40px] flex items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <ol className="mt-3 space-y-2 text-sm text-slate-600 list-decimal list-inside">
                <li>Ketuk tombol <strong>Bagikan (Share)</strong> di bilah bawah Safari.</li>
                <li>Gulir ke bawah lalu pilih <strong>Tambah ke Layar Utama (Add to Home Screen)</strong>.</li>
                <li>Ketuk <strong>Tambah</strong> untuk membuka ProyekKas seperti aplikasi native.</li>
              </ol>
              <button
                type="button"
                onClick={() => setShowIOSGuide(false)}
                className="mt-5 w-full min-h-[44px] rounded-xl bg-slate-900 text-white text-sm font-semibold hover:bg-slate-800"
              >
                Mengerti
              </button>
            </div>
          </div>
        )}
      </>
    );
  }

  if (showFallbackGuide) {
    return (
      <div className="rounded-xl border border-slate-200 bg-slate-50 p-3.5 text-xs text-slate-600 space-y-1.5 leading-relaxed">
        <p className="font-semibold text-slate-800">Panduan Pasang di Layar Utama:</p>
        <p>
          <strong>Android (Chrome):</strong> Buka di tab browser penuh, ketuk menu titik tiga (⋮) di pojok kanan atas, lalu pilih <strong>Tambahkan ke Layar utama</strong> atau <strong>Install aplikasi</strong>.
        </p>
        <p>
          <strong>iPhone (Safari):</strong> Ketuk ikon <strong>Bagikan (Share)</strong> di bilah bawah lalu pilih <strong>Tambah ke Layar Utama</strong>.
        </p>
      </div>
    );
  }

  return null;
};
