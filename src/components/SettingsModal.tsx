import React, { useEffect, useState } from 'react';
import type { User } from 'firebase/auth';
import {
  X,
  RotateCcw,
  Plus,
  Check,
  Cloud,
  HardDrive,
  Building2,
  Trash2,
} from 'lucide-react';
import type { ProjectData } from '../types';
import { PWAInstallButton } from './PWAInstallButton';

export interface CreateProjectInput {
  nama: string;
  lokasi: string;
  pelaksana: string;
  mandor: string;
  mingguKe: number;
  startDateIso: string;
  copyWorkersFromActive: boolean;
}

interface SettingsModalProps {
  isOpen: boolean;
  initialFocusAddProject?: boolean;
  projects: ProjectData[];
  activeProject: ProjectData;
  user: User | null;
  lastDriveBackupAt?: string;
  onClose: () => void;
  onOpenCloudSync: () => void;
  onSelectProject: (projectId: string) => void;
  onCreateProject: (input: CreateProjectInput) => void;
  onDeleteProject: (projectId: string) => void;
  onUpdateProjectMeta: (
    patch: Partial<Pick<ProjectData, 'nama' | 'lokasi' | 'pelaksana' | 'mandor'>>
  ) => void;
  onCreatePeriod: (mingguKe: number, startDateIso: string, labelKbs: string) => void;
  onResetSeedData: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  initialFocusAddProject = false,
  projects,
  activeProject,
  user,
  lastDriveBackupAt,
  onClose,
  onOpenCloudSync,
  onSelectProject,
  onCreateProject,
  onDeleteProject,
  onUpdateProjectMeta,
  onCreatePeriod,
  onResetSeedData,
}) => {
  const [nama, setNama] = useState(activeProject.nama);
  const [lokasi, setLokasi] = useState(activeProject.lokasi);
  const [pelaksana, setPelaksana] = useState(activeProject.pelaksana);
  const [mandor, setMandor] = useState(activeProject.mandor);
  const [savedNotice, setSavedNotice] = useState(false);

  // Add New Project Form state
  const [showAddProject, setShowAddProject] = useState(initialFocusAddProject);
  const [newProjNama, setNewProjNama] = useState('');
  const [newProjLokasi, setNewProjLokasi] = useState('');
  const [newProjPelaksana, setNewProjPelaksana] = useState(activeProject.pelaksana);
  const [newProjMandor, setNewProjMandor] = useState(activeProject.mandor);
  const [newProjMinggu, setNewProjMinggu] = useState('1');
  const [newProjStartDate, setNewProjStartDate] = useState(() =>
    new Date().toISOString().slice(0, 10)
  );
  const [copyWorkers, setCopyWorkers] = useState(true);
  const [confirmDeleteProjId, setConfirmDeleteProjId] = useState<string | null>(null);

  const nextWeek = Math.max(0, ...activeProject.periods.map((p) => p.mingguKe)) + 1;
  const [newWeek, setNewWeek] = useState(String(nextWeek));
  const [newStartDate, setNewStartDate] = useState('2026-11-22');
  const [newLabelKbs, setNewLabelKbs] = useState('s/d 30 November 2026');
  const [confirmReset, setConfirmReset] = useState(false);

  useEffect(() => {
    setNama(activeProject.nama);
    setLokasi(activeProject.lokasi);
    setPelaksana(activeProject.pelaksana);
    setMandor(activeProject.mandor);
    setNewWeek(String(Math.max(0, ...activeProject.periods.map((p) => p.mingguKe)) + 1));
  }, [activeProject]);

  useEffect(() => {
    if (isOpen && initialFocusAddProject) {
      setShowAddProject(true);
    }
  }, [isOpen, initialFocusAddProject]);

  if (!isOpen) return null;

  const handleSaveMeta = (e: React.FormEvent) => {
    e.preventDefault();
    if (!nama.trim()) return;
    onUpdateProjectMeta({
      nama: nama.trim(),
      lokasi: lokasi.trim(),
      pelaksana: pelaksana.trim(),
      mandor: mandor.trim(),
    });
    setSavedNotice(true);
    setTimeout(() => setSavedNotice(false), 2000);
  };

  const handleCreateProjectSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProjNama.trim()) return;
    onCreateProject({
      nama: newProjNama.trim(),
      lokasi: newProjLokasi.trim() || '-',
      pelaksana: newProjPelaksana.trim() || activeProject.pelaksana,
      mandor: newProjMandor.trim() || activeProject.mandor,
      mingguKe: Math.max(1, Number(newProjMinggu) || 1),
      startDateIso: newProjStartDate || new Date().toISOString().slice(0, 10),
      copyWorkersFromActive: copyWorkers,
    });
    setNewProjNama('');
    setNewProjLokasi('');
    setShowAddProject(false);
    onClose();
  };

  const handleAddPeriod = (e: React.FormEvent) => {
    e.preventDefault();
    const wk = Math.max(1, Number(newWeek) || nextWeek);
    if (!newStartDate) return;
    onCreatePeriod(wk, newStartDate, newLabelKbs.trim() || `Minggu ke-${wk}`);
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-900/60 backdrop-blur-xs sm:p-4 no-print"
      role="dialog"
      aria-modal="true"
      aria-labelledby="settings-modal-title"
    >
      <div className="w-full max-w-xl max-h-[90vh] bg-white rounded-t-3xl sm:rounded-2xl border border-slate-200 shadow-2xl flex flex-col overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between gap-3">
          <div>
            <h2 id="settings-modal-title" className="text-lg font-bold text-slate-900">
              Pengaturan Proyek &amp; Data
            </h2>
            <p className="text-xs text-slate-500">
              {user
                ? `Tersinkron otomatis ke Cloud (${user.email})`
                : 'Mode lokal browser — masuk Google untuk sinkronisasi cloud & Google Drive'}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Tutup pengaturan"
            className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl text-slate-500 hover:bg-slate-100 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-6">
          {/* Multi-Project Manager (Unlimited / >10 Active Projects) */}
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Building2 className="w-4 h-4 text-slate-700" />
                <h3 className="text-sm font-bold text-slate-900">
                  Daftar Proyek Aktif ({projects.length})
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowAddProject((prev) => !prev)}
                className="min-h-[36px] inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>{showAddProject ? 'Tutup Form' : 'Tambah Proyek Baru'}</span>
              </button>
            </div>

            {showAddProject && (
              <form
                onSubmit={handleCreateProjectSubmit}
                className="rounded-2xl border border-amber-300 bg-amber-50/70 p-4 space-y-3"
              >
                <div className="text-xs font-bold text-slate-900">
                  Buat Proyek Aktif Baru (Mendukung &gt;10 Proyek)
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label
                      htmlFor="add-proj-nama"
                      className="block text-xs font-medium text-slate-700 mb-1"
                    >
                      Nama Proyek <span className="text-rose-600">*</span>
                    </label>
                    <input
                      id="add-proj-nama"
                      type="text"
                      required
                      placeholder="Contoh: Ruko Solo Baru Blok B"
                      value={newProjNama}
                      onChange={(e) => setNewProjNama(e.target.value)}
                      className="w-full min-h-[40px] rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-900"
                    />
                  </div>
                  <div>
                    <label
                      htmlFor="add-proj-lokasi"
                      className="block text-xs font-medium text-slate-700 mb-1"
                    >
                      Lokasi Proyek
                    </label>
                    <input
                      id="add-proj-lokasi"
                      type="text"
                      placeholder="Contoh: Sukoharjo"
                      value={newProjLokasi}
                      onChange={(e) => setNewProjLokasi(e.target.value)}
                      className="w-full min-h-[40px] rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-900"
                    />
                  </div>
                  <div>
                    <label
                      htmlFor="add-proj-pelaksana"
                      className="block text-xs font-medium text-slate-700 mb-1"
                    >
                      Pelaksana
                    </label>
                    <input
                      id="add-proj-pelaksana"
                      type="text"
                      value={newProjPelaksana}
                      onChange={(e) => setNewProjPelaksana(e.target.value)}
                      className="w-full min-h-[40px] rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-900"
                    />
                  </div>
                  <div>
                    <label
                      htmlFor="add-proj-mandor"
                      className="block text-xs font-medium text-slate-700 mb-1"
                    >
                      Mandor
                    </label>
                    <input
                      id="add-proj-mandor"
                      type="text"
                      value={newProjMandor}
                      onChange={(e) => setNewProjMandor(e.target.value)}
                      className="w-full min-h-[40px] rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-900"
                    />
                  </div>
                  <div>
                    <label
                      htmlFor="add-proj-wk"
                      className="block text-xs font-medium text-slate-700 mb-1"
                    >
                      Mulai Minggu ke-
                    </label>
                    <input
                      id="add-proj-wk"
                      type="number"
                      min={1}
                      value={newProjMinggu}
                      onChange={(e) => setNewProjMinggu(e.target.value)}
                      className="w-full min-h-[40px] rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-mono-num text-slate-900"
                    />
                  </div>
                  <div>
                    <label
                      htmlFor="add-proj-date"
                      className="block text-xs font-medium text-slate-700 mb-1"
                    >
                      Tanggal Mulai Periode
                    </label>
                    <input
                      id="add-proj-date"
                      type="date"
                      value={newProjStartDate}
                      onChange={(e) => setNewProjStartDate(e.target.value)}
                      className="w-full min-h-[40px] rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-900"
                    />
                  </div>
                </div>
                <label className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={copyWorkers}
                    onChange={(e) => setCopyWorkers(e.target.checked)}
                    className="rounded border-slate-300"
                  />
                  <span>
                    Salin daftar tukang dari proyek aktif ({activeProject.workers.length} pekerja)
                  </span>
                </label>
                <div className="flex items-center gap-2">
                  <button
                    type="submit"
                    className="min-h-[40px] px-4 py-2 rounded-xl bg-slate-900 text-white text-xs font-bold hover:bg-slate-800 cursor-pointer"
                  >
                    Simpan &amp; Buka Proyek Baru
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowAddProject(false)}
                    className="min-h-[40px] px-3 py-2 rounded-xl border border-slate-300 bg-white text-slate-700 text-xs font-semibold hover:bg-slate-50 cursor-pointer"
                  >
                    Batal
                  </button>
                </div>
              </form>
            )}

            <div className="max-h-52 overflow-y-auto space-y-1.5 pr-1">
              {projects.map((proj, idx) => {
                const isActive = proj.id === activeProject.id;
                const isConfirmingDelete = confirmDeleteProjId === proj.id;
                return (
                  <div
                    key={proj.id}
                    className={`rounded-xl border p-2.5 flex items-center justify-between gap-2 ${
                      isActive
                        ? 'border-slate-900 bg-slate-50'
                        : 'border-slate-200 bg-white'
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => onSelectProject(proj.id)}
                      className="min-w-0 flex-1 text-left cursor-pointer"
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-[11px] font-mono-num text-slate-400">
                          #{idx + 1}
                        </span>
                        <span className="text-xs font-bold text-slate-900 truncate">
                          {proj.nama}
                        </span>
                        {isActive && (
                          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-900 text-white shrink-0">
                            Aktif
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-slate-500 truncate pl-6">
                        {proj.lokasi} • {proj.pelaksana} • {proj.periods.length} minggu
                      </div>
                    </button>

                    {projects.length > 1 && (
                      <div className="shrink-0">
                        {!isConfirmingDelete ? (
                          <button
                            type="button"
                            onClick={() => setConfirmDeleteProjId(proj.id)}
                            aria-label={`Hapus proyek ${proj.nama}`}
                            className="min-h-[34px] min-w-[34px] px-2 rounded-lg border border-slate-200 text-slate-500 hover:text-rose-700 hover:border-rose-200 hover:bg-rose-50 inline-flex items-center justify-center cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        ) : (
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => {
                                onDeleteProject(proj.id);
                                setConfirmDeleteProjId(null);
                              }}
                              className="min-h-[34px] px-2.5 rounded-lg bg-rose-600 text-white text-[11px] font-bold cursor-pointer"
                            >
                              Hapus
                            </button>
                            <button
                              type="button"
                              onClick={() => setConfirmDeleteProjId(null)}
                              className="min-h-[34px] px-2 rounded-lg border border-slate-300 bg-white text-slate-700 text-[11px] font-semibold cursor-pointer"
                            >
                              Batal
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Edit Active Project Info */}
          <form onSubmit={handleSaveMeta} className="pt-5 border-t border-slate-200 space-y-3">
            <h3 className="text-sm font-bold text-slate-900">Identitas Proyek Aktif</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label htmlFor="set-nama" className="block text-xs font-medium text-slate-600 mb-1">
                  Nama Proyek
                </label>
                <input
                  id="set-nama"
                  type="text"
                  value={nama}
                  onChange={(e) => setNama(e.target.value)}
                  className="w-full min-h-[40px] rounded-lg border border-slate-300 px-3 py-1.5 text-sm text-slate-900"
                />
              </div>
              <div>
                <label htmlFor="set-lokasi" className="block text-xs font-medium text-slate-600 mb-1">
                  Lokasi
                </label>
                <input
                  id="set-lokasi"
                  type="text"
                  value={lokasi}
                  onChange={(e) => setLokasi(e.target.value)}
                  className="w-full min-h-[40px] rounded-lg border border-slate-300 px-3 py-1.5 text-sm text-slate-900"
                />
              </div>
              <div>
                <label htmlFor="set-pelaksana" className="block text-xs font-medium text-slate-600 mb-1">
                  Pelaksana
                </label>
                <input
                  id="set-pelaksana"
                  type="text"
                  value={pelaksana}
                  onChange={(e) => setPelaksana(e.target.value)}
                  className="w-full min-h-[40px] rounded-lg border border-slate-300 px-3 py-1.5 text-sm text-slate-900"
                />
              </div>
              <div>
                <label htmlFor="set-mandor" className="block text-xs font-medium text-slate-600 mb-1">
                  Mandor
                </label>
                <input
                  id="set-mandor"
                  type="text"
                  value={mandor}
                  onChange={(e) => setMandor(e.target.value)}
                  className="w-full min-h-[40px] rounded-lg border border-slate-300 px-3 py-1.5 text-sm text-slate-900"
                />
              </div>
            </div>
            <div className="flex items-center gap-3">
              <button
                type="submit"
                className="min-h-[40px] px-4 py-2 rounded-lg bg-slate-900 text-white text-xs font-semibold hover:bg-slate-800 cursor-pointer"
              >
                Simpan Perubahan
              </button>
              {savedNotice && (
                <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-600">
                  <Check className="w-4 h-4" /> Tersimpan
                </span>
              )}
            </div>
          </form>

          {/* Add New Week / Period */}
          <form onSubmit={handleAddPeriod} className="pt-5 border-t border-slate-200 space-y-3">
            <h3 className="text-sm font-bold text-slate-900">Buka Periode Mingguan Baru</h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label htmlFor="new-wk" className="block text-xs font-medium text-slate-600 mb-1">
                  Minggu ke-
                </label>
                <input
                  id="new-wk"
                  type="number"
                  min={1}
                  value={newWeek}
                  onChange={(e) => setNewWeek(e.target.value)}
                  className="w-full min-h-[40px] rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-mono-num text-slate-900"
                />
              </div>
              <div>
                <label htmlFor="new-start" className="block text-xs font-medium text-slate-600 mb-1">
                  Mulai Hari Minggu
                </label>
                <input
                  id="new-start"
                  type="date"
                  value={newStartDate}
                  onChange={(e) => setNewStartDate(e.target.value)}
                  className="w-full min-h-[40px] rounded-lg border border-slate-300 px-3 py-1.5 text-sm text-slate-900"
                />
              </div>
              <div>
                <label htmlFor="new-kbs-lbl" className="block text-xs font-medium text-slate-600 mb-1">
                  Periode KBS
                </label>
                <input
                  id="new-kbs-lbl"
                  type="text"
                  value={newLabelKbs}
                  onChange={(e) => setNewLabelKbs(e.target.value)}
                  className="w-full min-h-[40px] rounded-lg border border-slate-300 px-3 py-1.5 text-sm text-slate-900"
                />
              </div>
            </div>
            <button
              type="submit"
              className="min-h-[40px] inline-flex items-center gap-1.5 px-4 py-2 rounded-lg border border-slate-300 bg-white text-slate-800 text-xs font-semibold hover:bg-slate-50 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Tambah Minggu ke-{newWeek || nextWeek}</span>
            </button>
          </form>

          {/* Cloud Sync & Google Drive Backup */}
          <div className="pt-5 border-t border-slate-200 space-y-2.5">
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <Cloud className="w-4 h-4 text-slate-700" />
              <span>Cloud Sync &amp; Backup Google Drive</span>
            </h3>
            <p className="text-xs text-slate-500 leading-relaxed">
              {user
                ? `Terhubung sebagai ${user.email}. Data tersinkron otomatis ke Firebase Cloud dan cadangan dapat dikirim/dimuat ulang dari Google Drive.`
                : 'Login dengan Google untuk menyinkronkan data proyek antar perangkat dan mengirim backup otomatis ke Google Drive.'}
            </p>
            {lastDriveBackupAt && (
              <p className="text-[11px] font-medium text-emerald-700">
                Backup Drive terakhir: {new Date(lastDriveBackupAt).toLocaleString('id-ID')}
              </p>
            )}
            <button
              type="button"
              onClick={() => {
                onClose();
                onOpenCloudSync();
              }}
              className="min-h-[44px] w-full inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-slate-900 text-white text-xs font-bold hover:bg-slate-800 cursor-pointer"
            >
              <HardDrive className="w-4 h-4" />
              <span>
                {user ? 'Kelola Cloud Sync & Backup Google Drive' : 'Login Google & Aktifkan Cloud Sync'}
              </span>
            </button>
          </div>

          {/* PWA Install */}
          <div className="pt-5 border-t border-slate-200 space-y-2">
            <h3 className="text-sm font-bold text-slate-900">Aplikasi Mobile (PWA)</h3>
            <p className="text-xs text-slate-500">
              Pasang ProyekKas &amp; Absensi di layar utama HP agar bisa dibuka layar penuh seperti aplikasi native.
            </p>
            <PWAInstallButton showFallbackGuide />
          </div>

          {/* Reset Seed Data */}
          <div className="pt-5 border-t border-slate-200 space-y-2.5">
            <h3 className="text-sm font-bold text-rose-700">Reset Data Contoh</h3>
            <p className="text-xs text-slate-600">
              Kembalikan seluruh data ke contoh awal <strong>Omah Wangi Kalioso (Minggu ke-48)</strong>. Semua perubahan lokal Anda akan diganti.
            </p>
            {!confirmReset ? (
              <button
                type="button"
                onClick={() => setConfirmReset(true)}
                className="min-h-[44px] inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-rose-300 bg-rose-50 text-rose-700 text-sm font-semibold hover:bg-rose-100 cursor-pointer"
              >
                <RotateCcw className="w-4 h-4" />
                <span>Reset Data Contoh</span>
              </button>
            ) : (
              <div className="flex items-center gap-2.5">
                <button
                  type="button"
                  onClick={() => {
                    onResetSeedData();
                    setConfirmReset(false);
                    onClose();
                  }}
                  className="min-h-[44px] px-4 py-2 rounded-xl bg-rose-600 text-white text-sm font-bold hover:bg-rose-700 cursor-pointer"
                >
                  Ya, Reset Sekarang
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmReset(false)}
                  className="min-h-[44px] px-4 py-2 rounded-xl border border-slate-300 bg-white text-slate-700 text-sm font-semibold hover:bg-slate-50 cursor-pointer"
                >
                  Batal
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
