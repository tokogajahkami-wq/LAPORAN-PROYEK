import React, { useEffect, useState } from 'react';
import type { User } from 'firebase/auth';
import {
  Cloud,
  CloudUpload,
  HardDrive,
  LogOut,
  RefreshCw,
  RotateCcw,
  Trash2,
  X,
  CheckCircle2,
  AlertCircle,
  Loader2,
} from 'lucide-react';
import { GoogleSignInButton } from './GoogleSignInButton';
import type { DriveBackupFile } from '../services/driveBackup';
import type { CloudWorkspaceMeta } from '../services/cloudSync';

interface CloudSyncModalProps {
  isOpen: boolean;
  user: User | null;
  cloudStatus: 'local' | 'connecting' | 'synced' | 'saving' | 'error';
  cloudError: string | null;
  cloudMeta: CloudWorkspaceMeta;
  driveBusy: boolean;
  driveBackups: DriveBackupFile[];
  driveLoaded: boolean;
  driveError: string | null;
  onClose: () => void;
  onGoogleLogin: () => Promise<void>;
  onGoogleLogout: () => Promise<void>;
  onBackupToDriveNow: () => Promise<void>;
  onRefreshDriveBackups: () => Promise<void>;
  onRestoreDriveBackup: (file: DriveBackupFile) => Promise<void>;
  onDeleteDriveBackup: (file: DriveBackupFile) => Promise<void>;
}

function formatDateTimeIndo(iso?: string): string {
  if (!iso) return '-';
  const dt = new Date(iso);
  if (Number.isNaN(dt.getTime())) return iso;
  return new Intl.DateTimeFormat('id-ID', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(dt);
}

function formatSizeKb(bytes: number): string {
  if (!bytes) return '';
  if (bytes < 1024) return `${bytes} B`;
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

export const CloudSyncModal: React.FC<CloudSyncModalProps> = ({
  isOpen,
  user,
  cloudStatus,
  cloudError,
  cloudMeta,
  driveBusy,
  driveBackups,
  driveLoaded,
  driveError,
  onClose,
  onGoogleLogin,
  onGoogleLogout,
  onBackupToDriveNow,
  onRefreshDriveBackups,
  onRestoreDriveBackup,
  onDeleteDriveBackup,
}) => {
  const [loggingIn, setLoggingIn] = useState(false);
  const [confirmAction, setConfirmAction] = useState<{
    type: 'restore' | 'delete';
    file: DriveBackupFile;
  } | null>(null);

  useEffect(() => {
    if (!isOpen) {
      setConfirmAction(null);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleLoginClick = async () => {
    setLoggingIn(true);
    try {
      await onGoogleLogin();
    } finally {
      setLoggingIn(false);
    }
  };

  const handleConfirmProceed = async () => {
    if (!confirmAction) return;
    const target = confirmAction;
    setConfirmAction(null);
    if (target.type === 'restore') {
      await onRestoreDriveBackup(target.file);
    } else {
      await onDeleteDriveBackup(target.file);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-900/60 backdrop-blur-xs sm:p-4 no-print"
      role="dialog"
      aria-modal="true"
      aria-labelledby="cloud-sync-title"
    >
      <div className="w-full max-w-xl max-h-[90vh] bg-white rounded-t-3xl sm:rounded-2xl border border-slate-200 shadow-2xl flex flex-col overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-slate-900 text-amber-400 flex items-center justify-center shrink-0">
              <Cloud className="w-5 h-5" />
            </div>
            <div>
              <h2 id="cloud-sync-title" className="text-base font-bold text-slate-900">
                Cloud Sync &amp; Backup Google Drive
              </h2>
              <p className="text-xs text-slate-500">
                Sinkron otomatis lintas perangkat &amp; cadangan aman di Google Drive Anda
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Tutup panel Cloud Sync"
            className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl text-slate-500 hover:bg-slate-100 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {!user ? (
            <div className="space-y-4">
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 space-y-2.5 text-sm text-slate-700">
                <p className="font-bold text-slate-900">
                  Masuk dengan Akun Google untuk Mengaktifkan Sinkronisasi Cloud
                </p>
                <ul className="space-y-1.5 text-xs text-slate-600 list-disc list-inside leading-relaxed">
                  <li>
                    <strong>Sinkronisasi Real-Time (Firebase Cloud):</strong> Semua data kas, rembes, tukang, absensi, dan nota tersimpan otomatis ke cloud dan langsung termuat saat login di HP/laptop lain.
                  </li>
                  <li>
                    <strong>Backup Otomatis ke Google Drive:</strong> Setelah login berhasil, cadangan proyek langsung dikirim ke folder <em>ProyekKas Backup</em> di Google Drive Anda dan dapat dimuat ulang kapan saja.
                  </li>
                </ul>
              </div>

              {(cloudError || driveError) && (
                <div className="rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-2.5 text-xs text-rose-700 flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{cloudError || driveError}</span>
                </div>
              )}

              <div className="flex justify-center pt-1">
                <GoogleSignInButton
                  onClick={handleLoginClick}
                  disabled={loggingIn}
                  label={loggingIn ? 'Menghubungkan...' : 'Sign in with Google'}
                  fullWidth
                />
              </div>
            </div>
          ) : (
            <>
              {/* Account & Firestore Cloud Status */}
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  {user.photoURL ? (
                    <img
                      src={user.photoURL}
                      alt={user.displayName ?? 'Akun Google'}
                      className="w-10 h-10 rounded-full border border-slate-300 shrink-0"
                    />
                  ) : (
                    <div className="w-10 h-10 rounded-full bg-slate-900 text-white font-bold text-sm flex items-center justify-center shrink-0">
                      {(user.displayName || user.email || 'U').slice(0, 1).toUpperCase()}
                    </div>
                  )}
                  <div className="min-w-0">
                    <div className="text-sm font-bold text-slate-900 truncate">
                      {user.displayName || 'Pengguna Google'}
                    </div>
                    <div className="text-xs text-slate-500 truncate">{user.email}</div>
                    <div className="mt-1 inline-flex items-center gap-1.5 text-[11px] font-semibold">
                      {cloudStatus === 'connecting' || cloudStatus === 'saving' ? (
                        <span className="text-amber-700 inline-flex items-center gap-1">
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          {cloudStatus === 'connecting'
                            ? 'Memuat data dari Cloud...'
                            : 'Menyinkronkan ke Cloud...'}
                        </span>
                      ) : cloudStatus === 'error' ? (
                        <span className="text-rose-700 inline-flex items-center gap-1">
                          <AlertCircle className="w-3.5 h-3.5" />
                          Gangguan sinkronisasi cloud
                        </span>
                      ) : (
                        <span className="text-emerald-700 inline-flex items-center gap-1">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          Cloud Firestore Aktif &amp; Tersinkron Otomatis
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={onGoogleLogout}
                  className="min-h-[40px] px-3.5 py-2 rounded-xl border border-slate-300 bg-white text-slate-700 text-xs font-semibold hover:bg-slate-100 inline-flex items-center justify-center gap-1.5 shrink-0 cursor-pointer"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span>Keluar</span>
                </button>
              </div>

              {cloudError && (
                <div className="rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-2.5 text-xs text-rose-700 flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{cloudError}</span>
                </div>
              )}

              {/* Google Drive Backup Controls */}
              <div className="space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <HardDrive className="w-4 h-4 text-slate-700" />
                    <h3 className="text-sm font-bold text-slate-900">
                      Backup Google Drive (Folder: ProyekKas Backup)
                    </h3>
                  </div>
                </div>

                {cloudMeta.lastDriveBackupAt && (
                  <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3.5 py-2.5 text-xs text-emerald-800 flex items-center justify-between gap-2">
                    <span className="truncate">
                      Backup terakhir: <strong>{formatDateTimeIndo(cloudMeta.lastDriveBackupAt)}</strong>
                      {cloudMeta.lastDriveBackupName ? ` (${cloudMeta.lastDriveBackupName})` : ''}
                    </span>
                  </div>
                )}

                {driveError && (
                  <div className="rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-2.5 text-xs text-rose-700 flex items-start gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                    <span>{driveError}</span>
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <button
                    type="button"
                    disabled={driveBusy}
                    onClick={onBackupToDriveNow}
                    className="min-h-[44px] inline-flex items-center justify-center gap-2 rounded-xl bg-slate-900 text-white text-xs font-bold px-4 py-2.5 hover:bg-slate-800 disabled:opacity-60 cursor-pointer"
                  >
                    {driveBusy ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <CloudUpload className="w-4 h-4" />
                    )}
                    <span>Kirim Backup ke Drive Sekarang</span>
                  </button>

                  <button
                    type="button"
                    disabled={driveBusy}
                    onClick={onRefreshDriveBackups}
                    className="min-h-[44px] inline-flex items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white text-slate-800 text-xs font-semibold px-4 py-2.5 hover:bg-slate-50 disabled:opacity-60 cursor-pointer"
                  >
                    <RefreshCw className={`w-4 h-4 ${driveBusy ? 'animate-spin' : ''}`} />
                    <span>{driveLoaded ? 'Segarkan Daftar Drive' : 'Lihat Backup di Drive'}</span>
                  </button>
                </div>

                {/* Explicit Confirmation Box for Mutating / Destructive Drive Actions */}
                {confirmAction && (
                  <div
                    role="alertdialog"
                    aria-modal="true"
                    className="rounded-2xl border-2 border-amber-400 bg-amber-50 p-4 space-y-3"
                  >
                    <p className="text-xs font-bold text-slate-900">
                      {confirmAction.type === 'restore'
                        ? `Muat ulang data dari backup "${confirmAction.file.name}"?`
                        : `Hapus file backup "${confirmAction.file.name}" dari Google Drive?`}
                    </p>
                    <p className="text-xs text-slate-700 leading-relaxed">
                      {confirmAction.type === 'restore'
                        ? `Seluruh data proyek di perangkat ini dan di Cloud Firestore akan diganti dengan isi backup tanggal ${formatDateTimeIndo(
                            confirmAction.file.modifiedTime
                          )}.`
                        : 'File backup ini akan dihapus permanen dari folder ProyekKas Backup di Google Drive Anda dan tidak dapat dikembalikan.'}
                    </p>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        disabled={driveBusy}
                        onClick={handleConfirmProceed}
                        className={`min-h-[40px] px-4 py-2 rounded-xl text-xs font-bold text-white cursor-pointer ${
                          confirmAction.type === 'delete'
                            ? 'bg-rose-600 hover:bg-rose-700'
                            : 'bg-slate-900 hover:bg-slate-800'
                        }`}
                      >
                        {confirmAction.type === 'restore'
                          ? 'Ya, Muat Ulang Data'
                          : 'Ya, Hapus dari Drive'}
                      </button>
                      <button
                        type="button"
                        disabled={driveBusy}
                        onClick={() => setConfirmAction(null)}
                        className="min-h-[40px] px-4 py-2 rounded-xl border border-slate-300 bg-white text-slate-700 text-xs font-semibold hover:bg-slate-50 cursor-pointer"
                      >
                        Batal
                      </button>
                    </div>
                  </div>
                )}

                {/* List of Drive Backups */}
                {driveLoaded && (
                  <div className="space-y-2 pt-1">
                    <div className="text-xs font-semibold text-slate-500">
                      Riwayat Backup di Google Drive ({driveBackups.length})
                    </div>
                    {driveBackups.length === 0 ? (
                      <div className="rounded-xl border border-dashed border-slate-300 p-4 text-center text-xs text-slate-500">
                        Belum ada file backup di folder <strong>ProyekKas Backup</strong>.
                      </div>
                    ) : (
                      <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                        {driveBackups.map((file) => (
                          <div
                            key={file.id}
                            className="rounded-xl border border-slate-200 bg-white p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5"
                          >
                            <div className="min-w-0">
                              <div className="text-xs font-bold text-slate-900 truncate">
                                {file.name}
                              </div>
                              <div className="text-[11px] text-slate-500">
                                {formatDateTimeIndo(file.modifiedTime)}
                                {file.sizeBytes ? ` • ${formatSizeKb(file.sizeBytes)}` : ''}
                              </div>
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                              <button
                                type="button"
                                disabled={driveBusy}
                                onClick={() => setConfirmAction({ type: 'restore', file })}
                                className="min-h-[36px] px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer"
                              >
                                <RotateCcw className="w-3.5 h-3.5" />
                                <span>Muat Ulang</span>
                              </button>
                              <button
                                type="button"
                                disabled={driveBusy}
                                aria-label={`Hapus ${file.name}`}
                                onClick={() => setConfirmAction({ type: 'delete', file })}
                                className="min-h-[36px] min-w-[36px] px-2.5 py-1.5 rounded-lg border border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100 inline-flex items-center justify-center cursor-pointer"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
