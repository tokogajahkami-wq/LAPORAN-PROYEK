import { useEffect, useMemo, useRef, useState } from 'react';
import type { User } from 'firebase/auth';
import {
  type AppState,
  type CashflowItem,
  type DayAttendanceRecord,
  type DropingEntry,
  type ExpenseTransaction,
  type MainTab,
  type PeriodData,
  type PrintConfig,
  type ProjectData,
  type RembesStatus,
  type RoleMode,
  type Worker,
} from './types';
import { loadAppState, resetAppState, saveAppState } from './utils/storage';
import { calculateKbsSummary, calculateRembesSummary, formatDateIndo } from './utils/calculations';
import { Layout } from './components/Layout';
import { DashboardView } from './components/DashboardView';
import { KasRembesView, type KasSubTab } from './components/KasRembesView';
import { AbsensiView, type AbsensiSubTab } from './components/AbsensiView';
import { ReportsView } from './components/ReportsView';
import { ScanNotaModal } from './components/ScanNotaModal';
import { ReceiptViewerModal } from './components/ReceiptViewerModal';
import { SettingsModal, type CreateProjectInput } from './components/SettingsModal';
import { CloudSyncModal } from './components/CloudSyncModal';
import { OfflineIndicator } from './components/OfflineIndicator';
import {
  ensureDriveAccessToken,
  firebaseSignOut,
  getCachedDriveAccessToken,
  googleSignInWithDrive,
  subscribeAuthState,
  testFirestoreConnection,
} from './firebase';
import {
  ensureCloudWorkspaceInitialized,
  replaceEntireCloudWorkspace,
  subscribeCloudWorkspace,
  syncPeriodCreate,
  syncPeriodFields,
  syncProjectCreate,
  syncProjectDelete,
  syncProjectUpdate,
  syncTransactionCreate,
  syncTransactionDelete,
  syncTransactionRembesStatus,
  syncWorkerCreate,
  syncWorkerUpdate,
  syncWorkspacePrefs,
  type CloudWorkspaceMeta,
} from './services/cloudSync';
import {
  deleteDriveBackup,
  downloadDriveBackup,
  listDriveBackups,
  uploadDriveBackup,
  type DriveBackupFile,
} from './services/driveBackup';

function addDaysIso(isoDate: string, offset: number): string {
  const [y, m, d] = isoDate.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + offset));
  return dt.toISOString().slice(0, 10);
}

export default function App() {
  const [state, setState] = useState<AppState>(() => loadAppState());
  const stateRef = useRef<AppState>(state);
  stateRef.current = state;

  const [activeTab, setActiveTab] = useState<MainTab>('dashboard');
  const [kasSubTab, setKasSubTab] = useState<KasSubTab>('kbs');
  const [absensiSubTab, setAbsensiSubTab] = useState<AbsensiSubTab>('harian');

  const [scanModalOpen, setScanModalOpen] = useState(false);
  const [scanModalMode, setScanModalMode] = useState<'scan' | 'manual' | 'droping'>('scan');
  const [viewerTx, setViewerTx] = useState<ExpenseTransaction | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settingsFocusAddProject, setSettingsFocusAddProject] = useState(false);
  const [cloudModalOpen, setCloudModalOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Firebase Auth + Firestore Cloud Sync state
  const [user, setUser] = useState<User | null>(null);
  const userRef = useRef<User | null>(null);
  userRef.current = user;

  const [cloudStatus, setCloudStatus] = useState<
    'local' | 'connecting' | 'synced' | 'saving' | 'error'
  >('local');
  const [cloudError, setCloudError] = useState<string | null>(null);
  const [cloudMeta, setCloudMeta] = useState<CloudWorkspaceMeta>({});

  // Google Drive Backup state
  const [driveBusy, setDriveBusy] = useState(false);
  const [driveBackups, setDriveBackups] = useState<DriveBackupFile[]>([]);
  const [driveLoaded, setDriveLoaded] = useState(false);
  const [driveError, setDriveError] = useState<string | null>(null);
  const pendingPostLoginDriveBackupRef = useRef(false);

  // Persist to localStorage automatically (acts as fast local/offline cache)
  useEffect(() => {
    const res = saveAppState(state);
    if (!res.ok && res.error) {
      setToastMessage(res.error);
    }
  }, [state]);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    window.setTimeout(() => {
      setToastMessage((prev) => (prev === msg ? null : prev));
    }, 3500);
  };

  // Validate Firestore connection on initial mount
  useEffect(() => {
    testFirestoreConnection().catch(() => {});
  }, []);

  // Subscribe to Firebase Auth & attach Firestore onSnapshot listeners when authenticated
  useEffect(() => {
    let unsubCloud: (() => void) | null = null;
    let cancelled = false;

    const unsubAuth = subscribeAuthState((authUser) => {
      if (unsubCloud) {
        unsubCloud();
        unsubCloud = null;
      }

      setUser(authUser);
      setCloudError(null);
      setDriveError(null);

      if (!authUser) {
        setCloudStatus('local');
        setCloudMeta({});
        setDriveBackups([]);
        setDriveLoaded(false);
        pendingPostLoginDriveBackupRef.current = false;
        return;
      }

      setCloudStatus('connecting');

      void (async () => {
        try {
          await ensureCloudWorkspaceInitialized(
            authUser.uid,
            authUser.email ?? '',
            authUser.displayName,
            stateRef.current
          );
          if (cancelled) return;

          unsubCloud = subscribeCloudWorkspace(
            authUser.uid,
            (cloudState, meta) => {
              if (cancelled) return;
              setState(cloudState);
              setCloudMeta(meta);
              setCloudStatus('synced');
              setCloudError(null);

              // Automatically send backup to Google Drive right after login once cloud data loads
              if (pendingPostLoginDriveBackupRef.current) {
                pendingPostLoginDriveBackupRef.current = false;
                const token = getCachedDriveAccessToken();
                if (token) {
                  void (async () => {
                    setDriveBusy(true);
                    try {
                      const uploaded = await uploadDriveBackup(
                        token,
                        cloudState,
                        authUser.email
                      );
                      await syncWorkspacePrefs(authUser.uid, {
                        lastDriveBackupAt: uploaded.modifiedTime,
                        lastDriveBackupName: uploaded.name,
                      });
                      setDriveBackups((prev) => [
                        uploaded,
                        ...prev.filter((f) => f.id !== uploaded.id),
                      ]);
                      setDriveLoaded(true);
                      showToast(
                        `Login berhasil — Data tersinkron ke Cloud & terbackup ke Google Drive (${uploaded.name}).`
                      );
                    } catch (err) {
                      const msg =
                        err instanceof Error
                          ? err.message
                          : 'Backup otomatis ke Google Drive gagal.';
                      setDriveError(msg);
                    } finally {
                      setDriveBusy(false);
                    }
                  })();
                }
              }
            },
            (err) => {
              if (cancelled) return;
              setCloudStatus('error');
              setCloudError(
                err instanceof Error
                  ? err.message
                  : 'Gagal menyinkronkan data dengan Cloud Firestore.'
              );
            }
          );
        } catch (err) {
          if (cancelled) return;
          setCloudStatus('error');
          setCloudError(
            err instanceof Error
              ? err.message
              : 'Gagal menginisialisasi penyimpanan Cloud Firestore.'
          );
        }
      })();
    });

    return () => {
      cancelled = true;
      unsubAuth();
      if (unsubCloud) unsubCloud();
    };
  }, []);

  const runCloudTask = (task: (uid: string) => Promise<void>) => {
    const activeUser = userRef.current;
    if (!activeUser) return;
    setCloudStatus('saving');
    void task(activeUser.uid)
      .then(() => {
        setCloudStatus((prev) => (prev === 'saving' ? 'synced' : prev));
        setCloudError(null);
      })
      .catch((err) => {
        setCloudStatus('error');
        const msg =
          err instanceof Error ? err.message : 'Gagal menyimpan perubahan ke Cloud.';
        setCloudError(msg);
        showToast('Perubahan tersimpan lokal, namun gagal sinkron ke Cloud.');
      });
  };

  // Auth & Google Drive handlers
  const handleGoogleLogin = async () => {
    setCloudError(null);
    setDriveError(null);
    try {
      pendingPostLoginDriveBackupRef.current = true;
      const { user: signedInUser, accessToken } = await googleSignInWithDrive();
      if (!accessToken) {
        pendingPostLoginDriveBackupRef.current = false;
        showToast(`Login berhasil sebagai ${signedInUser.email}.`);
      }
    } catch (err) {
      pendingPostLoginDriveBackupRef.current = false;
      const raw = err instanceof Error ? err.message : String(err);
      if (raw.includes('popup-closed-by-user')) {
        setCloudError('Login Google dibatalkan.');
      } else {
        setCloudError(raw);
      }
    }
  };

  const handleGoogleLogout = async () => {
    await firebaseSignOut();
    setCloudModalOpen(false);
    showToast('Anda keluar dari akun Google. Aplikasi kembali ke mode lokal.');
  };

  const handleBackupToDriveNow = async () => {
    const activeUser = userRef.current;
    if (!activeUser) return;
    setDriveError(null);
    setDriveBusy(true);
    try {
      const token = await ensureDriveAccessToken();
      const uploaded = await uploadDriveBackup(token, stateRef.current, activeUser.email);
      await syncWorkspacePrefs(activeUser.uid, {
        lastDriveBackupAt: uploaded.modifiedTime,
        lastDriveBackupName: uploaded.name,
      });
      setDriveBackups((prev) => [uploaded, ...prev.filter((f) => f.id !== uploaded.id)]);
      setDriveLoaded(true);
      showToast(`Backup berhasil dikirim ke Google Drive (${uploaded.name}).`);
    } catch (err) {
      setDriveError(
        err instanceof Error ? err.message : 'Gagal mengirim backup ke Google Drive.'
      );
    } finally {
      setDriveBusy(false);
    }
  };

  const handleRefreshDriveBackups = async () => {
    setDriveError(null);
    setDriveBusy(true);
    try {
      const token = await ensureDriveAccessToken();
      const files = await listDriveBackups(token);
      setDriveBackups(files);
      setDriveLoaded(true);
    } catch (err) {
      setDriveError(
        err instanceof Error ? err.message : 'Gagal memuat daftar backup Google Drive.'
      );
    } finally {
      setDriveBusy(false);
    }
  };

  const handleRestoreDriveBackup = async (file: DriveBackupFile) => {
    const activeUser = userRef.current;
    if (!activeUser) return;
    setDriveError(null);
    setDriveBusy(true);
    setCloudStatus('saving');
    try {
      const token = await ensureDriveAccessToken();
      const { state: restoredState } = await downloadDriveBackup(token, file.id);
      await replaceEntireCloudWorkspace(
        activeUser.uid,
        activeUser.email ?? '',
        activeUser.displayName,
        restoredState
      );
      setState(restoredState);
      setCloudStatus('synced');
      setCloudModalOpen(false);
      showToast(`Data berhasil dimuat ulang dari Google Drive (${file.name}).`);
    } catch (err) {
      setCloudStatus('error');
      setDriveError(
        err instanceof Error ? err.message : 'Gagal memuat ulang data dari Google Drive.'
      );
    } finally {
      setDriveBusy(false);
    }
  };

  const handleDeleteDriveBackup = async (file: DriveBackupFile) => {
    setDriveError(null);
    setDriveBusy(true);
    try {
      const token = await ensureDriveAccessToken();
      await deleteDriveBackup(token, file.id);
      setDriveBackups((prev) => prev.filter((f) => f.id !== file.id));
      showToast(`File backup "${file.name}" dihapus dari Google Drive.`);
    } catch (err) {
      setDriveError(
        err instanceof Error ? err.message : 'Gagal menghapus file backup di Google Drive.'
      );
    } finally {
      setDriveBusy(false);
    }
  };

  const activeProject: ProjectData = useMemo(() => {
    return state.projects.find((p) => p.id === state.activeProjectId) ?? state.projects[0];
  }, [state.projects, state.activeProjectId]);

  const activePeriod: PeriodData = useMemo(() => {
    return (
      activeProject.periods.find((per) => per.id === state.activePeriodId) ??
      activeProject.periods[0]
    );
  }, [activeProject, state.activePeriodId]);

  const pendingRembesCount = useMemo(() => {
    return calculateRembesSummary(activePeriod).pendingCount;
  }, [activePeriod]);

  // Helper to update active project immutably
  const updateActiveProject = (updater: (project: ProjectData) => ProjectData) => {
    setState((prev) => ({
      ...prev,
      projects: prev.projects.map((p) => (p.id === activeProject.id ? updater(p) : p)),
    }));
  };

  // Helper to update active period immutably
  const updateActivePeriod = (updater: (period: PeriodData) => PeriodData) => {
    updateActiveProject((proj) => ({
      ...proj,
      periods: proj.periods.map((per) => (per.id === activePeriod.id ? updater(per) : per)),
    }));
  };

  const handleSelectProject = (projectId: string) => {
    const target = state.projects.find((p) => p.id === projectId);
    if (!target) return;
    const nextPeriodId = target.periods[0]?.id ?? '';
    const nextPrintConfig: PrintConfig = {
      ...state.printConfig,
      kota: target.lokasi,
      dibuatNama: target.pelaksana,
    };
    setState((prev) => ({
      ...prev,
      activeProjectId: target.id,
      activePeriodId: nextPeriodId,
      printConfig: nextPrintConfig,
    }));
    runCloudTask((uid) =>
      syncWorkspacePrefs(uid, {
        activeProjectId: target.id,
        activePeriodId: nextPeriodId,
        printConfig: nextPrintConfig,
      })
    );
  };

  const handleSelectPeriod = (periodId: string) => {
    setState((prev) => ({ ...prev, activePeriodId: periodId }));
    runCloudTask((uid) => syncWorkspacePrefs(uid, { activePeriodId: periodId }));
  };

  const handleChangeRoleMode = (roleMode: RoleMode) => {
    setState((prev) => ({ ...prev, roleMode }));
    runCloudTask((uid) => syncWorkspacePrefs(uid, { roleMode }));
  };

  const handleNavigate = (tab: MainTab, subTab?: string) => {
    setActiveTab(tab);
    if (tab === 'kas' && (subTab === 'kbs' || subTab === 'rembes' || subTab === 'cashflow')) {
      setKasSubTab(subTab);
    }
    if (tab === 'absensi' && (subTab === 'harian' || subTab === 'rekap' || subTab === 'master')) {
      setAbsensiSubTab(subTab);
    }
  };

  const handleOpenScanModal = (initialMode: 'scan' | 'manual' | 'droping' = 'scan') => {
    setScanModalMode(initialMode);
    setScanModalOpen(true);
  };

  // Expense & Droping mutations
  const handleSaveExpense = (tx: ExpenseTransaction) => {
    const projId = activeProject.id;
    const perId = activePeriod.id;
    updateActivePeriod((per) => ({
      ...per,
      transactions: [tx, ...per.transactions],
    }));
    runCloudTask((uid) => syncTransactionCreate(uid, projId, perId, tx));
    showToast(
      tx.sumberDana === 'REMBES'
        ? 'Klaim rembes berhasil diajukan.'
        : 'Pengeluaran berhasil dicatat ke Kas Proyek.'
    );
  };

  const handleSaveDroping = (entry: DropingEntry) => {
    const nextDropingList = [...activePeriod.dropingList, entry];
    const perId = activePeriod.id;
    updateActivePeriod((per) => ({
      ...per,
      dropingList: nextDropingList,
    }));
    runCloudTask((uid) => syncPeriodFields(uid, perId, { dropingList: nextDropingList }));
    showToast('Droping dana berhasil ditambahkan.');
  };

  const handleUpdateOpeningBalance = (amount: number, tanggal: string) => {
    const perId = activePeriod.id;
    updateActivePeriod((per) => ({
      ...per,
      sisaSaldoLalu: amount,
      tanggalSaldoLalu: tanggal,
    }));
    runCloudTask((uid) =>
      syncPeriodFields(uid, perId, { sisaSaldoLalu: amount, tanggalSaldoLalu: tanggal })
    );
    showToast('Sisa saldo minggu lalu diperbarui.');
  };

  const handleDeleteDroping = (dropId: string) => {
    const nextDropingList = activePeriod.dropingList.filter((d) => d.id !== dropId);
    const perId = activePeriod.id;
    updateActivePeriod((per) => ({
      ...per,
      dropingList: nextDropingList,
    }));
    runCloudTask((uid) => syncPeriodFields(uid, perId, { dropingList: nextDropingList }));
  };

  const handleDeleteTransaction = (txId: string) => {
    updateActivePeriod((per) => ({
      ...per,
      transactions: per.transactions.filter((t) => t.id !== txId),
    }));
    runCloudTask((uid) => syncTransactionDelete(uid, txId));
  };

  const handleUpdateRembesStatus = (txId: string, status: RembesStatus) => {
    updateActivePeriod((per) => ({
      ...per,
      transactions: per.transactions.map((t) =>
        t.id === txId ? { ...t, rembesStatus: status } : t
      ),
    }));
    runCloudTask((uid) => syncTransactionRembesStatus(uid, txId, status));
    showToast(
      status === 'Lunas' ? 'Klaim rembes ditandai Lunas.' : 'Klaim rembes disetujui.'
    );
  };

  // Cashflow mutations
  const handleAddCashflowItem = (item: CashflowItem) => {
    const nextCashflow = [...activePeriod.cashflowItems, item];
    const perId = activePeriod.id;
    updateActivePeriod((per) => ({
      ...per,
      cashflowItems: nextCashflow,
    }));
    runCloudTask((uid) => syncPeriodFields(uid, perId, { cashflowItems: nextCashflow }));
  };

  const handleUpdateCashflowItem = (updated: CashflowItem) => {
    const nextCashflow = activePeriod.cashflowItems.map((it) =>
      it.id === updated.id ? updated : it
    );
    const perId = activePeriod.id;
    updateActivePeriod((per) => ({
      ...per,
      cashflowItems: nextCashflow,
    }));
    runCloudTask((uid) => syncPeriodFields(uid, perId, { cashflowItems: nextCashflow }));
  };

  const handleDeleteCashflowItem = (itemId: string) => {
    const nextCashflow = activePeriod.cashflowItems.filter((it) => it.id !== itemId);
    const perId = activePeriod.id;
    updateActivePeriod((per) => ({
      ...per,
      cashflowItems: nextCashflow,
    }));
    runCloudTask((uid) => syncPeriodFields(uid, perId, { cashflowItems: nextCashflow }));
  };

  const handleUpdateSaldoLaluOverride = (override: number | null) => {
    const perId = activePeriod.id;
    updateActivePeriod((per) => ({
      ...per,
      saldoLaluOverride: override,
    }));
    runCloudTask((uid) => syncPeriodFields(uid, perId, { saldoLaluOverride: override }));
  };

  // Attendance & Worker mutations
  const handleUpdateAttendance = (
    workerId: string,
    date: string,
    record: DayAttendanceRecord
  ) => {
    const perId = activePeriod.id;
    const nextAttendance = {
      ...activePeriod.attendance,
      [workerId]: {
        ...(activePeriod.attendance[workerId] ?? {}),
        [date]: record,
      },
    };
    updateActivePeriod((per) => ({
      ...per,
      attendance: {
        ...per.attendance,
        [workerId]: {
          ...(per.attendance[workerId] ?? {}),
          [date]: record,
        },
      },
    }));
    runCloudTask((uid) => syncPeriodFields(uid, perId, { attendance: nextAttendance }));
  };

  const handleBulkSetDay = (date: string, field: 'normal' | 'lembur', value: number) => {
    const activeWorkerIds = activeProject.workers.filter((w) => w.aktif).map((w) => w.id);
    const perId = activePeriod.id;
    const nextAttendance = { ...activePeriod.attendance };
    for (const wid of activeWorkerIds) {
      const currentWorkerDays = nextAttendance[wid] ?? {};
      const currentRec = currentWorkerDays[date] ?? { normal: 0, lembur: 0 };
      nextAttendance[wid] = {
        ...currentWorkerDays,
        [date]: {
          ...currentRec,
          [field]: value,
        },
      };
    }

    updateActivePeriod((per) => ({ ...per, attendance: nextAttendance }));
    runCloudTask((uid) => syncPeriodFields(uid, perId, { attendance: nextAttendance }));
    showToast(
      field === 'normal'
        ? `Semua pekerja ditandai Hadir (${value}).`
        : `Semua pekerja ditandai Lembur (${value}).`
    );
  };

  const handleUpdateKasbon = (workerId: string, amount: number) => {
    const perId = activePeriod.id;
    const nextKasbon = {
      ...activePeriod.kasbonByWorker,
      [workerId]: amount,
    };
    updateActivePeriod((per) => ({
      ...per,
      kasbonByWorker: nextKasbon,
    }));
    runCloudTask((uid) => syncPeriodFields(uid, perId, { kasbonByWorker: nextKasbon }));
  };

  const handleUpdateWorkerNote = (workerId: string, note: string) => {
    const perId = activePeriod.id;
    const nextNotes = {
      ...activePeriod.keteranganByWorker,
      [workerId]: note,
    };
    updateActivePeriod((per) => ({
      ...per,
      keteranganByWorker: nextNotes,
    }));
    runCloudTask((uid) => syncPeriodFields(uid, perId, { keteranganByWorker: nextNotes }));
  };

  const handleAddWorker = (worker: Worker) => {
    const projId = activeProject.id;
    updateActiveProject((proj) => ({
      ...proj,
      workers: [...proj.workers, worker],
    }));
    runCloudTask((uid) => syncWorkerCreate(uid, projId, worker));
    showToast(`${worker.nama} ditambahkan ke daftar pekerja.`);
  };

  const handleUpdateWorker = (worker: Worker) => {
    updateActiveProject((proj) => ({
      ...proj,
      workers: proj.workers.map((w) => (w.id === worker.id ? worker : w)),
    }));
    runCloudTask((uid) => syncWorkerUpdate(uid, worker));
  };

  // Print Config & Settings mutations
  const handleUpdatePrintConfig = (patch: Partial<PrintConfig>) => {
    const nextPrintConfig = { ...state.printConfig, ...patch };
    setState((prev) => ({
      ...prev,
      printConfig: { ...prev.printConfig, ...patch },
    }));
    runCloudTask((uid) => syncWorkspacePrefs(uid, { printConfig: nextPrintConfig }));
  };

  const handleCreateProject = (input: CreateProjectInput) => {
    const suffix = `${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    const projectId = `proj-${suffix}`;
    const periodId = `per-${suffix}`;
    const dates = Array.from({ length: 7 }, (_, i) => addDaysIso(input.startDateIso, i));
    const endDateIso = dates[6];
    const startDay = Number(input.startDateIso.slice(8, 10));
    const labelAbsensi = `${startDay} - ${formatDateIndo(endDateIso)}`;
    const labelKbs = `s/d ${formatDateIndo(endDateIso)}`;

    const copiedWorkers: Worker[] = input.copyWorkersFromActive
      ? activeProject.workers.map((w, idx) => ({
          ...w,
          id: `w-${suffix}-${idx + 1}`,
          mandor: input.mandor || w.mandor,
        }))
      : [];

    const newProject: ProjectData = {
      id: projectId,
      nama: input.nama,
      lokasi: input.lokasi,
      pelaksana: input.pelaksana,
      mandor: input.mandor,
      workers: copiedWorkers,
      periods: [
        {
          id: periodId,
          mingguKe: input.mingguKe,
          labelPeriodeAbsensi: labelAbsensi,
          labelPeriodeKbs: labelKbs,
          attendanceDates: dates,
          sisaSaldoLalu: 0,
          tanggalSaldoLalu: input.startDateIso,
          dropingList: [],
          transactions: [],
          cashflowItems: [
            { id: `cf-a-${suffix}`, group: 'A', deskripsi: 'Kas Proyek', nominal: 2000000 },
          ],
          saldoLaluOverride: null,
          attendance: {},
          kasbonByWorker: {},
          keteranganByWorker: {},
        },
      ],
    };

    const nextPrintConfig: PrintConfig = {
      ...state.printConfig,
      kota: newProject.lokasi,
      dibuatNama: newProject.pelaksana,
    };

    setState((prev) => ({
      ...prev,
      activeProjectId: newProject.id,
      activePeriodId: periodId,
      projects: [...prev.projects, newProject],
      printConfig: nextPrintConfig,
    }));

    runCloudTask(async (uid) => {
      await syncProjectCreate(uid, newProject);
      await syncWorkspacePrefs(uid, {
        activeProjectId: newProject.id,
        activePeriodId: periodId,
        printConfig: nextPrintConfig,
      });
    });
    showToast(`Proyek "${newProject.nama}" berhasil ditambahkan.`);
  };

  const handleDeleteProject = (projectId: string) => {
    if (state.projects.length <= 1) return;
    const remaining = state.projects.filter((p) => p.id !== projectId);
    if (remaining.length === 0) return;

    const deletedProj = state.projects.find((p) => p.id === projectId);
    const fallbackProject =
      state.activeProjectId === projectId ? remaining[0] : activeProject;
    const fallbackPeriodId =
      state.activeProjectId === projectId
        ? fallbackProject.periods[0]?.id ?? ''
        : state.activePeriodId;
    const nextPrintConfig: PrintConfig =
      state.activeProjectId === projectId
        ? {
            ...state.printConfig,
            kota: fallbackProject.lokasi,
            dibuatNama: fallbackProject.pelaksana,
          }
        : state.printConfig;

    setState((prev) => ({
      ...prev,
      activeProjectId: fallbackProject.id,
      activePeriodId: fallbackPeriodId,
      projects: remaining,
      printConfig: nextPrintConfig,
    }));

    runCloudTask(async (uid) => {
      await syncProjectDelete(uid, projectId);
      if (state.activeProjectId === projectId) {
        await syncWorkspacePrefs(uid, {
          activeProjectId: fallbackProject.id,
          activePeriodId: fallbackPeriodId,
          printConfig: nextPrintConfig,
        });
      }
    });
    showToast(`Proyek "${deletedProj?.nama ?? ''}" dihapus.`);
  };

  const handleUpdateProjectMeta = (
    patch: Partial<Pick<ProjectData, 'nama' | 'lokasi' | 'pelaksana' | 'mandor'>>
  ) => {
    const currentProj = activeProject;
    updateActiveProject((proj) => ({ ...proj, ...patch }));
    runCloudTask((uid) => syncProjectUpdate(uid, currentProj.id, patch, currentProj));
  };

  const handleCreatePeriod = (mingguKe: number, startDateIso: string, labelKbs: string) => {
    const dates = Array.from({ length: 7 }, (_, i) => addDaysIso(startDateIso, i));
    const endDateIso = dates[6];
    const startDay = Number(startDateIso.slice(8, 10));
    const labelAbsensi = `${startDay} - ${formatDateIndo(endDateIso)}`;
    const prevKbsEnding = calculateKbsSummary(activePeriod).sisaSaldoAkhir;
    const projId = activeProject.id;

    const newPeriod: PeriodData = {
      id: `per-${Date.now()}`,
      mingguKe,
      labelPeriodeAbsensi: labelAbsensi,
      labelPeriodeKbs: labelKbs,
      attendanceDates: dates,
      sisaSaldoLalu: prevKbsEnding,
      tanggalSaldoLalu: startDateIso,
      dropingList: [],
      transactions: [],
      cashflowItems: [
        { id: `cf-a-${Date.now()}`, group: 'A', deskripsi: 'Kas Proyek', nominal: 2000000 },
      ],
      saldoLaluOverride: null,
      attendance: {},
      kasbonByWorker: {},
      keteranganByWorker: {},
    };

    setState((prev) => ({
      ...prev,
      activePeriodId: newPeriod.id,
      projects: prev.projects.map((p) =>
        p.id === projId ? { ...p, periods: [...p.periods, newPeriod] } : p
      ),
    }));
    runCloudTask(async (uid) => {
      await syncPeriodCreate(uid, projId, newPeriod);
      await syncWorkspacePrefs(uid, { activePeriodId: newPeriod.id });
    });
    showToast(`Periode Minggu ke-${mingguKe} berhasil dibuat.`);
  };

  const handleResetSeedData = () => {
    const fresh = resetAppState();
    setState(fresh);
    setActiveTab('dashboard');
    const activeUser = userRef.current;
    if (activeUser) {
      runCloudTask((uid) =>
        replaceEntireCloudWorkspace(
          uid,
          activeUser.email ?? '',
          activeUser.displayName,
          fresh
        )
      );
    }
    showToast('Data berhasil dikembalikan ke data contoh Omah Wangi Kalioso.');
  };

  const defaultTxDate =
    activePeriod.attendanceDates[activePeriod.attendanceDates.length - 1] ?? '2026-11-16';

  return (
    <>
      <Layout
        activeTab={activeTab}
        onSelectTab={setActiveTab}
        roleMode={state.roleMode}
        onChangeRoleMode={handleChangeRoleMode}
        projects={state.projects}
        activeProject={activeProject}
        activePeriod={activePeriod}
        onSelectProject={handleSelectProject}
        onSelectPeriod={handleSelectPeriod}
        onOpenScanNota={() => handleOpenScanModal('scan')}
        onOpenSettings={() => {
          setSettingsFocusAddProject(false);
          setSettingsOpen(true);
        }}
        onOpenAddProject={() => {
          setSettingsFocusAddProject(true);
          setSettingsOpen(true);
        }}
        onOpenCloudSync={() => setCloudModalOpen(true)}
        user={user}
        cloudStatus={cloudStatus}
        pendingRembesCount={pendingRembesCount}
      >
        {activeTab === 'dashboard' && (
          <DashboardView
            project={activeProject}
            period={activePeriod}
            roleMode={state.roleMode}
            onNavigate={handleNavigate}
            onOpenScanNota={handleOpenScanModal}
            onViewPhoto={setViewerTx}
          />
        )}

        {activeTab === 'kas' && (
          <KasRembesView
            period={activePeriod}
            roleMode={state.roleMode}
            subTab={kasSubTab}
            onChangeSubTab={setKasSubTab}
            onOpenAddModal={handleOpenScanModal}
            onViewPhoto={setViewerTx}
            onUpdateOpeningBalance={handleUpdateOpeningBalance}
            onDeleteDroping={handleDeleteDroping}
            onDeleteTransaction={handleDeleteTransaction}
            onUpdateRembesStatus={handleUpdateRembesStatus}
            onAddCashflowItem={handleAddCashflowItem}
            onUpdateCashflowItem={handleUpdateCashflowItem}
            onDeleteCashflowItem={handleDeleteCashflowItem}
            onUpdateSaldoLaluOverride={handleUpdateSaldoLaluOverride}
          />
        )}

        {activeTab === 'absensi' && (
          <AbsensiView
            project={activeProject}
            period={activePeriod}
            subTab={absensiSubTab}
            onChangeSubTab={setAbsensiSubTab}
            onUpdateAttendance={handleUpdateAttendance}
            onBulkSetDay={handleBulkSetDay}
            onUpdateKasbon={handleUpdateKasbon}
            onUpdateWorkerNote={handleUpdateWorkerNote}
            onAddWorker={handleAddWorker}
            onUpdateWorker={handleUpdateWorker}
          />
        )}

        {activeTab === 'laporan' && (
          <ReportsView
            project={activeProject}
            period={activePeriod}
            printConfig={state.printConfig}
            onUpdatePrintConfig={handleUpdatePrintConfig}
          />
        )}
      </Layout>

      {scanModalOpen && (
        <ScanNotaModal
          isOpen={scanModalOpen}
          initialMode={scanModalMode}
          defaultDate={defaultTxDate}
          defaultPelaksana={activeProject.pelaksana}
          onClose={() => setScanModalOpen(false)}
          onSaveExpense={handleSaveExpense}
          onSaveDroping={handleSaveDroping}
        />
      )}

      <ReceiptViewerModal
        transaction={viewerTx}
        onClose={() => setViewerTx(null)}
      />

      {settingsOpen && (
        <SettingsModal
          isOpen={settingsOpen}
          initialFocusAddProject={settingsFocusAddProject}
          projects={state.projects}
          activeProject={activeProject}
          user={user}
          lastDriveBackupAt={cloudMeta.lastDriveBackupAt}
          onClose={() => {
            setSettingsOpen(false);
            setSettingsFocusAddProject(false);
          }}
          onOpenCloudSync={() => setCloudModalOpen(true)}
          onSelectProject={handleSelectProject}
          onCreateProject={handleCreateProject}
          onDeleteProject={handleDeleteProject}
          onUpdateProjectMeta={handleUpdateProjectMeta}
          onCreatePeriod={handleCreatePeriod}
          onResetSeedData={handleResetSeedData}
        />
      )}

      <CloudSyncModal
        isOpen={cloudModalOpen}
        user={user}
        cloudStatus={cloudStatus}
        cloudError={cloudError}
        cloudMeta={cloudMeta}
        driveBusy={driveBusy}
        driveBackups={driveBackups}
        driveLoaded={driveLoaded}
        driveError={driveError}
        onClose={() => setCloudModalOpen(false)}
        onGoogleLogin={handleGoogleLogin}
        onGoogleLogout={handleGoogleLogout}
        onBackupToDriveNow={handleBackupToDriveNow}
        onRefreshDriveBackups={handleRefreshDriveBackups}
        onRestoreDriveBackup={handleRestoreDriveBackup}
        onDeleteDriveBackup={handleDeleteDriveBackup}
      />

      {toastMessage && (
        <div
          role="status"
          aria-live="polite"
          className="fixed bottom-20 lg:bottom-6 right-4 z-50 max-w-sm rounded-xl bg-slate-900 text-white text-xs font-semibold px-4 py-3 shadow-lg border border-slate-700 no-print"
        >
          {toastMessage}
        </div>
      )}

      <OfflineIndicator />
    </>
  );
}
