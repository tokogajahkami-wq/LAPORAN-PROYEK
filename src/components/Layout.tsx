import React from 'react';
import type { User } from 'firebase/auth';
import {
  LayoutDashboard,
  Wallet,
  Users,
  FileSpreadsheet,
  Camera,
  Settings,
  HardHat,
  ShieldCheck,
  Building2,
  Cloud,
  CloudOff,
  Loader2,
  Plus,
} from 'lucide-react';
import type { MainTab, PeriodData, ProjectData, RoleMode } from '../types';
import { PWAInstallButton } from './PWAInstallButton';

interface LayoutProps {
  activeTab: MainTab;
  onSelectTab: (tab: MainTab) => void;
  roleMode: RoleMode;
  onChangeRoleMode: (role: RoleMode) => void;
  projects: ProjectData[];
  activeProject: ProjectData;
  activePeriod: PeriodData;
  onSelectProject: (projectId: string) => void;
  onSelectPeriod: (periodId: string) => void;
  onOpenScanNota: () => void;
  onOpenSettings: () => void;
  onOpenAddProject: () => void;
  onOpenCloudSync: () => void;
  user: User | null;
  cloudStatus: 'local' | 'connecting' | 'synced' | 'saving' | 'error';
  pendingRembesCount: number;
  children: React.ReactNode;
}

const NAV_ITEMS: { id: MainTab; label: string; shortLabel: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { id: 'dashboard', label: 'Dashboard', shortLabel: 'Dashboard', icon: LayoutDashboard },
  { id: 'kas', label: 'Kas & Rembes', shortLabel: 'Kas & Rembes', icon: Wallet },
  { id: 'absensi', label: 'Absensi', shortLabel: 'Absensi', icon: Users },
  { id: 'laporan', label: 'Laporan', shortLabel: 'Laporan', icon: FileSpreadsheet },
];

export const Layout: React.FC<LayoutProps> = ({
  activeTab,
  onSelectTab,
  roleMode,
  onChangeRoleMode,
  projects,
  activeProject,
  activePeriod,
  onSelectProject,
  onSelectPeriod,
  onOpenScanNota,
  onOpenSettings,
  onOpenAddProject,
  onOpenCloudSync,
  user,
  cloudStatus,
  pendingRembesCount,
  children,
}) => {
  const renderCloudIcon = () => {
    if (cloudStatus === 'connecting' || cloudStatus === 'saving') {
      return <Loader2 className="w-4 h-4 text-amber-400 animate-spin shrink-0" />;
    }
    if (user && cloudStatus === 'synced') {
      return <Cloud className="w-4 h-4 text-emerald-400 shrink-0" />;
    }
    return <CloudOff className="w-4 h-4 text-slate-400 shrink-0" />;
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col lg:flex-row">
      {/* Desktop Left Sidebar */}
      <aside className="hidden lg:flex lg:flex-col lg:w-64 lg:fixed lg:inset-y-0 bg-slate-900 text-slate-100 border-r border-slate-800 z-30 no-print">
        <div className="px-6 py-5 border-b border-slate-800 flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-amber-500 text-slate-950 flex items-center justify-center shrink-0">
            <Building2 className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <span className="block text-base font-bold tracking-tight text-white truncate">
              ProyekKas
            </span>
            <span className="block text-xs text-slate-400 truncate">
              Keuangan &amp; Absensi
            </span>
          </div>
        </div>

        <div className="p-4">
          <button
            type="button"
            onClick={onOpenScanNota}
            className="w-full min-h-[44px] flex items-center justify-center gap-2 rounded-xl bg-amber-500 hover:bg-amber-400 active:scale-[0.99] text-slate-950 font-bold text-sm px-4 py-2.5 transition-all shadow-sm cursor-pointer whitespace-nowrap"
          >
            <Camera className="w-4 h-4 shrink-0" />
            <span>Scan Nota AI</span>
          </button>
        </div>

        <nav className="flex-1 px-3 py-2 space-y-1" aria-label="Navigasi Utama">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onSelectTab(item.id)}
                aria-current={isActive ? 'page' : undefined}
                className={`w-full min-h-[44px] flex items-center justify-between gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium transition-colors cursor-pointer whitespace-nowrap ${
                  isActive
                    ? 'bg-slate-800 text-white font-semibold'
                    : 'text-slate-300 hover:text-white hover:bg-slate-800/60'
                }`}
              >
                <span className="flex items-center gap-3 min-w-0">
                  <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-amber-400' : 'text-slate-400'}`} />
                  <span className="truncate">{item.label}</span>
                </span>
                {item.id === 'kas' && pendingRembesCount > 0 && (
                  <span className="text-xs font-mono-num font-semibold text-amber-400">
                    {pendingRembesCount}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        <div className="p-4 border-t border-slate-800 space-y-2">
          <button
            type="button"
            onClick={onOpenCloudSync}
            className="w-full min-h-[44px] flex items-center justify-between gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold bg-slate-800/80 hover:bg-slate-800 text-slate-100 border border-slate-700 transition-colors cursor-pointer"
          >
            <span className="flex items-center gap-2.5 min-w-0">
              {renderCloudIcon()}
              <span className="truncate">
                {user ? user.displayName || user.email : 'Login Cloud & Drive'}
              </span>
            </span>
            <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold shrink-0 ${user ? 'bg-emerald-500/20 text-emerald-300' : 'bg-amber-500/20 text-amber-300'}`}>
              {user ? 'Sync' : 'Masuk'}
            </span>
          </button>
          <PWAInstallButton />
          <button
            type="button"
            onClick={onOpenSettings}
            className="w-full min-h-[44px] flex items-center gap-3 px-3.5 py-2 rounded-xl text-sm font-medium text-slate-300 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer whitespace-nowrap"
          >
            <Settings className="w-4 h-4 text-slate-400 shrink-0" />
            <span>Pengaturan &amp; Data</span>
          </button>
          <div className="px-3.5 pt-1 text-xs text-slate-400 leading-relaxed">
            <div className="truncate font-medium text-slate-300">{activeProject.pelaksana}</div>
            <div className="truncate">Mandor: {activeProject.mandor}</div>
          </div>
        </div>
      </aside>

      {/* Main Column */}
      <div className="flex-1 lg:pl-64 flex flex-col min-w-0">
        {/* Top Header Bar (Normal flow on mobile to respect 15% sticky cap, sticky on desktop) */}
        <header className="bg-white border-b border-slate-200 lg:sticky lg:top-0 z-20 no-print">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            {/* Mobile Brand + Cloud + Settings Row */}
            <div className="flex items-center justify-between gap-2 lg:hidden">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-8 h-8 rounded-lg bg-slate-900 text-amber-400 flex items-center justify-center shrink-0">
                  <Building2 className="w-4 h-4" />
                </div>
                <span className="text-base font-bold tracking-tight text-slate-900 whitespace-nowrap truncate">
                  ProyekKas &amp; Absensi
                </span>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  type="button"
                  onClick={onOpenCloudSync}
                  aria-label="Status Login Cloud dan Backup Google Drive"
                  className={`min-h-[40px] px-2.5 py-1.5 rounded-xl border text-xs font-semibold inline-flex items-center gap-1.5 transition-colors cursor-pointer ${
                    user
                      ? 'border-emerald-200 bg-emerald-50 text-emerald-800 hover:bg-emerald-100'
                      : 'border-slate-300 bg-white text-slate-800 hover:bg-slate-50'
                  }`}
                >
                  {cloudStatus === 'connecting' || cloudStatus === 'saving' ? (
                    <Loader2 className="w-4 h-4 animate-spin text-amber-600" />
                  ) : user ? (
                    <Cloud className="w-4 h-4 text-emerald-600" />
                  ) : (
                    <CloudOff className="w-4 h-4 text-slate-500" />
                  )}
                  <span>{user ? 'Cloud' : 'Login'}</span>
                </button>
                <PWAInstallButton compact />
                <button
                  type="button"
                  onClick={onOpenSettings}
                  aria-label="Buka Pengaturan dan Reset Data"
                  className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
                >
                  <Settings className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Selectors: Proyek Aktif & Minggu/Periode */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:flex lg:items-center gap-2.5 min-w-0">
              <div className="flex items-center gap-2 min-w-0">
                <label htmlFor="project-select" className="text-xs font-medium text-slate-500 whitespace-nowrap shrink-0">
                  Proyek ({projects.length})
                </label>
                <div className="flex items-center gap-1.5 min-w-0 flex-1">
                  <select
                    id="project-select"
                    value={activeProject.id}
                    onChange={(e) => onSelectProject(e.target.value)}
                    className="w-full lg:w-52 min-h-[40px] rounded-lg border border-slate-300 bg-slate-50 px-3 py-1.5 text-sm font-semibold text-slate-900 focus:border-slate-900 focus:bg-white focus:outline-none cursor-pointer truncate"
                  >
                    {projects.map((proj) => (
                      <option key={proj.id} value={proj.id}>
                        {proj.nama}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={onOpenAddProject}
                    title="Tambah Proyek Baru"
                    aria-label="Tambah Proyek Baru"
                    className="min-h-[40px] min-w-[40px] px-2.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-100 text-slate-800 inline-flex items-center justify-center shrink-0 cursor-pointer transition-colors"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <div className="flex items-center gap-2 min-w-0">
                <label htmlFor="period-select" className="text-xs font-medium text-slate-500 whitespace-nowrap shrink-0">
                  Periode
                </label>
                <select
                  id="period-select"
                  value={activePeriod.id}
                  onChange={(e) => onSelectPeriod(e.target.value)}
                  className="w-full lg:w-72 min-h-[40px] rounded-lg border border-slate-300 bg-slate-50 px-3 py-1.5 text-sm font-semibold text-slate-900 focus:border-slate-900 focus:bg-white focus:outline-none cursor-pointer truncate"
                >
                  {activeProject.periods.map((per) => (
                    <option key={per.id} value={per.id}>
                      Minggu ke-{per.mingguKe} ({per.labelPeriodeAbsensi})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Role Switcher: Lapangan/Mandor vs Admin/Owner */}
            <div className="flex items-center justify-between sm:justify-end gap-3 shrink-0">
              <div
                className="grid grid-cols-2 w-full sm:w-auto bg-slate-100 p-1 rounded-xl border border-slate-200"
                role="group"
                aria-label="Mode Pengguna"
              >
                <button
                  type="button"
                  onClick={() => onChangeRoleMode('mandor')}
                  aria-pressed={roleMode === 'mandor'}
                  className={`min-h-[36px] px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-all whitespace-nowrap shrink-0 cursor-pointer ${
                    roleMode === 'mandor'
                      ? 'bg-slate-900 text-white shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <HardHat className="w-3.5 h-3.5 shrink-0" />
                  <span>Lapangan / Mandor</span>
                </button>
                <button
                  type="button"
                  onClick={() => onChangeRoleMode('admin')}
                  aria-pressed={roleMode === 'admin'}
                  className={`min-h-[36px] px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-all whitespace-nowrap shrink-0 cursor-pointer ${
                    roleMode === 'admin'
                      ? 'bg-slate-900 text-white shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <ShieldCheck className="w-3.5 h-3.5 shrink-0" />
                  <span>Admin / Owner</span>
                </button>
              </div>
            </div>
          </div>
        </header>

        {/* Main Viewport */}
        <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-5 pb-28 lg:pb-10">
          {children}
        </main>
      </div>

      {/* Mobile Floating Action Button (FAB) — Scan Nota */}
      <button
        type="button"
        onClick={onOpenScanNota}
        aria-label="Scan Nota Fisik dengan AI"
        className="lg:hidden fixed right-4 bottom-[74px] z-40 h-12 px-4 rounded-2xl bg-amber-500 hover:bg-amber-400 active:scale-95 text-slate-950 font-bold text-sm shadow-lg shadow-amber-500/25 flex items-center gap-2 transition-transform cursor-pointer no-print"
      >
        <Camera className="w-5 h-5 shrink-0" />
        <span>Scan Nota</span>
      </button>

      {/* Mobile Bottom Navigation Bar (Fixed 64px <= 15% cap) */}
      <nav
        aria-label="Navigasi Mobile"
        className="lg:hidden fixed bottom-0 left-0 right-0 z-30 bg-white/95 backdrop-blur-md border-t border-slate-200 no-print pb-safe"
      >
        <div className="grid grid-cols-4 h-16">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onSelectTab(item.id)}
                aria-current={isActive ? 'page' : undefined}
                className={`flex flex-col items-center justify-center gap-1 min-h-[44px] transition-colors relative cursor-pointer ${
                  isActive ? 'text-slate-900 font-bold' : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                {isActive && (
                  <span
                    aria-hidden="true"
                    className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-0.5 bg-amber-500 rounded-full"
                  />
                )}
                <Icon className={`w-5 h-5 ${isActive ? 'text-amber-600' : 'text-slate-400'}`} />
                <span className="text-[11px] leading-none whitespace-nowrap">
                  {item.shortLabel}
                </span>
              </button>
            );
          })}
        </div>
      </nav>
    </div>
  );
};
