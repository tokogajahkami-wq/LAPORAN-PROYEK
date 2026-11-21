import React from 'react';
import { X } from 'lucide-react';
import type { ExpenseTransaction } from '../types';
import { formatDateShort, formatRupiah } from '../utils/calculations';

interface ReceiptViewerModalProps {
  transaction: ExpenseTransaction | null;
  onClose: () => void;
}

export const ReceiptViewerModal: React.FC<ReceiptViewerModalProps> = ({
  transaction,
  onClose,
}) => {
  if (!transaction) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/75 backdrop-blur-xs p-4 no-print"
      role="dialog"
      aria-modal="true"
      aria-labelledby="receipt-viewer-title"
    >
      <div className="w-full max-w-lg bg-white rounded-2xl border border-slate-200 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        <div className="px-5 py-3.5 border-b border-slate-200 flex items-center justify-between gap-3">
          <div className="min-w-0">
            <h3 id="receipt-viewer-title" className="text-base font-bold text-slate-900 truncate">
              Foto Nota · {transaction.namaToko}
            </h3>
            <p className="text-xs text-slate-500">
              {formatDateShort(transaction.tanggal)} · {transaction.kategori} ·{' '}
              <span className="font-mono-num font-semibold text-slate-800">
                {formatRupiah(transaction.totalNominal)}
              </span>
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Tutup foto nota"
            className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl text-slate-500 hover:bg-slate-100 cursor-pointer shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto bg-slate-100 p-4 flex items-center justify-center">
          {transaction.fotoNota ? (
            <img
              src={transaction.fotoNota}
              alt={`Foto nota ${transaction.namaToko}`}
              referrerPolicy="no-referrer"
              className="max-h-[60vh] w-auto rounded-lg shadow-sm border border-slate-200 bg-white"
            />
          ) : (
            <div className="py-12 text-sm text-slate-500">Foto nota tidak tersedia.</div>
          )}
        </div>

        <div className="px-5 py-3 border-t border-slate-200 bg-white">
          <ul className="space-y-1 text-xs text-slate-700">
            {transaction.items.map((it) => (
              <li key={it.id} className="flex items-center justify-between gap-2">
                <span className="truncate">
                  {it.deskripsi} <span className="text-slate-400">({it.qty})</span>
                </span>
                <span className="font-mono-num font-semibold shrink-0">
                  {formatRupiah(it.nominal)}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
};
