import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch,
  type Unsubscribe,
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import type {
  AppState,
  ExpenseTransaction,
  PeriodData,
  PrintConfig,
  ProjectData,
  RembesStatus,
  RoleMode,
  Worker,
} from '../types';

export interface CloudWorkspaceMeta {
  lastDriveBackupAt?: string;
  lastDriveBackupName?: string;
}

const sanitizeId = (raw: string, fallbackPrefix: string): string => {
  const cleaned = raw.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 128);
  return cleaned.length > 0 ? cleaned : `${fallbackPrefix}_${Date.now()}`;
};

const clampStr = (val: unknown, maxLen: number): string =>
  String(val ?? '').trim().slice(0, maxLen);

function sanitizePrintConfig(cfg: PrintConfig): PrintConfig {
  return {
    kota: clampStr(cfg.kota, 120),
    tanggalCetak: clampStr(cfg.tanggalCetak, 20),
    mengetahuiNama: clampStr(cfg.mengetahuiNama, 120),
    mengetahuiJabatan: clampStr(cfg.mengetahuiJabatan, 120),
    disetujuiNama: clampStr(cfg.disetujuiNama, 120),
    disetujuiJabatan: clampStr(cfg.disetujuiJabatan, 120),
    dibuatNama: clampStr(cfg.dibuatNama, 120),
    dibuatJabatan: clampStr(cfg.dibuatJabatan, 120),
    sertakanFotoNota: Boolean(cfg.sertakanFotoNota),
  };
}

function buildWorkspacePayload(
  uid: string,
  email: string,
  displayName: string | null,
  state: AppState
) {
  return {
    ownerId: uid,
    email: clampStr(email, 320),
    ...(displayName ? { displayName: clampStr(displayName, 120) } : {}),
    roleMode: state.roleMode === 'admin' ? 'admin' : 'mandor',
    activeProjectId: sanitizeId(state.activeProjectId, 'proj'),
    activePeriodId: sanitizeId(state.activePeriodId, 'per'),
    printConfig: sanitizePrintConfig(state.printConfig),
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };
}

function buildProjectPayload(uid: string, proj: ProjectData) {
  return {
    ownerId: uid,
    id: sanitizeId(proj.id, 'proj'),
    nama: clampStr(proj.nama || 'Proyek Baru', 120) || 'Proyek Baru',
    lokasi: clampStr(proj.lokasi, 160),
    pelaksana: clampStr(proj.pelaksana, 120),
    mandor: clampStr(proj.mandor, 120),
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };
}

function buildWorkerPayload(uid: string, projectId: string, worker: Worker) {
  return {
    ownerId: uid,
    projectId: sanitizeId(projectId, 'proj'),
    id: sanitizeId(worker.id, 'w'),
    nama: clampStr(worker.nama || 'Pekerja', 100) || 'Pekerja',
    jabatan: worker.jabatan,
    upahHarian: Math.max(0, Number(worker.upahHarian) || 0),
    mandor: clampStr(worker.mandor, 100),
    aktif: Boolean(worker.aktif),
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };
}

function buildPeriodPayload(uid: string, projectId: string, period: PeriodData) {
  return {
    ownerId: uid,
    projectId: sanitizeId(projectId, 'proj'),
    id: sanitizeId(period.id, 'per'),
    mingguKe: Math.max(1, Math.round(Number(period.mingguKe) || 1)),
    labelPeriodeAbsensi: clampStr(period.labelPeriodeAbsensi || `Minggu ke-${period.mingguKe}`, 120) || 'Minggu',
    labelPeriodeKbs: clampStr(period.labelPeriodeKbs || `Minggu ke-${period.mingguKe}`, 120) || 'Minggu',
    attendanceDates: period.attendanceDates.slice(0, 7).map((d) => clampStr(d, 20)),
    sisaSaldoLalu: Number(period.sisaSaldoLalu) || 0,
    tanggalSaldoLalu: clampStr(period.tanggalSaldoLalu, 20),
    dropingList: period.dropingList.slice(0, 100),
    cashflowItems: period.cashflowItems.slice(0, 150),
    saldoLaluOverride:
      period.saldoLaluOverride === null || period.saldoLaluOverride === undefined
        ? null
        : Number(period.saldoLaluOverride) || 0,
    attendance: period.attendance ?? {},
    kasbonByWorker: period.kasbonByWorker ?? {},
    keteranganByWorker: period.keteranganByWorker ?? {},
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };
}

function buildTransactionPayload(
  uid: string,
  projectId: string,
  periodId: string,
  tx: ExpenseTransaction
) {
  const hasFoto = Boolean(tx.fotoNota && tx.fotoNota.length > 0 && tx.fotoNota.length <= 350000);
  return {
    ownerId: uid,
    projectId: sanitizeId(projectId, 'proj'),
    periodId: sanitizeId(periodId, 'per'),
    id: sanitizeId(tx.id, 'tx'),
    tanggal: clampStr(tx.tanggal, 20),
    namaToko: clampStr(tx.namaToko || 'Toko', 160) || 'Toko',
    kategori: tx.kategori,
    sumberDana: tx.sumberDana,
    items: tx.items.slice(0, 100),
    totalNominal: Math.max(0, Math.round(Number(tx.totalNominal) || 0)),
    hasFotoNota: hasFoto,
    ...(tx.catatan ? { catatan: clampStr(tx.catatan, 500) } : {}),
    ...(tx.namaPengaju ? { namaPengaju: clampStr(tx.namaPengaju, 120) } : {}),
    ...(tx.rembesStatus ? { rembesStatus: tx.rembesStatus } : {}),
    txCreatedAt: clampStr(tx.createdAt || new Date().toISOString(), 64),
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };
}

function buildReceiptPayload(uid: string, projectId: string, txId: string, dataUrl: string) {
  return {
    ownerId: uid,
    projectId: sanitizeId(projectId, 'proj'),
    transactionId: sanitizeId(txId, 'tx'),
    id: sanitizeId(txId, 'tx'),
    dataUrl: dataUrl.slice(0, 350000),
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };
}

async function deleteCollectionDocs(uid: string, subcol: string): Promise<void> {
  const colPath = `users/${uid}/${subcol}`;
  try {
    const q = query(collection(db, 'users', uid, subcol), where('ownerId', '==', uid));
    const snap = await getDocs(q);
    if (snap.empty) return;
    const chunks: typeof snap.docs[] = [];
    for (let i = 0; i < snap.docs.length; i += 400) {
      chunks.push(snap.docs.slice(i, i + 400));
    }
    for (const chunk of chunks) {
      const batch = writeBatch(db);
      chunk.forEach((d) => batch.delete(d.ref));
      await batch.commit();
    }
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, colPath);
  }
}

async function writeFullWorkspaceHierarchy(
  uid: string,
  email: string,
  displayName: string | null,
  fullState: AppState,
  workspaceAlreadyExists: boolean
): Promise<void> {
  const workspaceRef = doc(db, 'users', uid);
  try {
    if (workspaceAlreadyExists) {
      await updateDoc(workspaceRef, {
        ...(email ? { email: clampStr(email, 320) } : {}),
        ...(displayName ? { displayName: clampStr(displayName, 120) } : {}),
        roleMode: fullState.roleMode === 'admin' ? 'admin' : 'mandor',
        activeProjectId: sanitizeId(fullState.activeProjectId, 'proj'),
        activePeriodId: sanitizeId(fullState.activePeriodId, 'per'),
        printConfig: sanitizePrintConfig(fullState.printConfig),
        updatedAt: serverTimestamp(),
      });
    } else {
      await setDoc(workspaceRef, buildWorkspacePayload(uid, email, displayName, fullState));
    }
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `users/${uid}`);
  }

  // Step 2: Projects (parent workspace now exists)
  try {
    for (let i = 0; i < fullState.projects.length; i += 400) {
      const projectBatch = writeBatch(db);
      for (const proj of fullState.projects.slice(i, i + 400)) {
        const pid = sanitizeId(proj.id, 'proj');
        projectBatch.set(doc(db, 'users', uid, 'projects', pid), buildProjectPayload(uid, proj));
      }
      await projectBatch.commit();
    }
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `users/${uid}/projects`);
  }

  // Step 3: Workers & Periods (parent projects now exist)
  try {
    const wpEntries: {
      col: 'workers' | 'periods';
      id: string;
      payload: ReturnType<typeof buildWorkerPayload> | ReturnType<typeof buildPeriodPayload>;
    }[] = [];
    for (const proj of fullState.projects) {
      for (const worker of proj.workers) {
        wpEntries.push({
          col: 'workers',
          id: sanitizeId(worker.id, 'w'),
          payload: buildWorkerPayload(uid, proj.id, worker),
        });
      }
      for (const period of proj.periods) {
        wpEntries.push({
          col: 'periods',
          id: sanitizeId(period.id, 'per'),
          payload: buildPeriodPayload(uid, proj.id, period),
        });
      }
    }
    for (let i = 0; i < wpEntries.length; i += 400) {
      const wpBatch = writeBatch(db);
      for (const entry of wpEntries.slice(i, i + 400)) {
        wpBatch.set(doc(db, 'users', uid, entry.col, entry.id), entry.payload);
      }
      await wpBatch.commit();
    }
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `users/${uid}/periods`);
  }

  // Step 4: Transactions (parent periods now exist)
  const receiptsToWrite: { projectId: string; txId: string; dataUrl: string }[] = [];
  try {
    const txDocs: { id: string; payload: ReturnType<typeof buildTransactionPayload> }[] = [];
    for (const proj of fullState.projects) {
      for (const period of proj.periods) {
        for (const tx of period.transactions) {
          const txId = sanitizeId(tx.id, 'tx');
          txDocs.push({
            id: txId,
            payload: buildTransactionPayload(uid, proj.id, period.id, tx),
          });
          if (tx.fotoNota && tx.fotoNota.length > 0 && tx.fotoNota.length <= 350000) {
            receiptsToWrite.push({ projectId: proj.id, txId, dataUrl: tx.fotoNota });
          }
        }
      }
    }
    for (let i = 0; i < txDocs.length; i += 400) {
      const batch = writeBatch(db);
      for (const item of txDocs.slice(i, i + 400)) {
        batch.set(doc(db, 'users', uid, 'transactions', item.id), item.payload);
      }
      await batch.commit();
    }
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `users/${uid}/transactions`);
  }

  // Step 5: Receipt photos (parent transactions now exist)
  try {
    for (let i = 0; i < receiptsToWrite.length; i += 400) {
      const batch = writeBatch(db);
      for (const r of receiptsToWrite.slice(i, i + 400)) {
        batch.set(
          doc(db, 'users', uid, 'receipts', r.txId),
          buildReceiptPayload(uid, r.projectId, r.txId, r.dataUrl)
        );
      }
      await batch.commit();
    }
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `users/${uid}/receipts`);
  }
}

export async function ensureCloudWorkspaceInitialized(
  uid: string,
  email: string,
  displayName: string | null,
  localState: AppState
): Promise<{ createdNewWorkspace: boolean }> {
  const path = `users/${uid}`;
  try {
    const snap = await getDoc(doc(db, 'users', uid));
    if (snap.exists()) {
      return { createdNewWorkspace: false };
    }
    await writeFullWorkspaceHierarchy(uid, email, displayName, localState, false);
    return { createdNewWorkspace: true };
  } catch (err) {
    handleFirestoreError(err, OperationType.GET, path);
  }
}

export async function replaceEntireCloudWorkspace(
  uid: string,
  email: string,
  displayName: string | null,
  newState: AppState
): Promise<void> {
  // Delete children in reverse dependency order before recreating
  await deleteCollectionDocs(uid, 'receipts');
  await deleteCollectionDocs(uid, 'transactions');
  await deleteCollectionDocs(uid, 'periods');
  await deleteCollectionDocs(uid, 'workers');
  await deleteCollectionDocs(uid, 'projects');

  const snap = await getDoc(doc(db, 'users', uid));
  await writeFullWorkspaceHierarchy(uid, email, displayName, newState, snap.exists());
}

export function subscribeCloudWorkspace(
  uid: string,
  onState: (state: AppState, meta: CloudWorkspaceMeta) => void,
  onError: (err: unknown) => void
): Unsubscribe {
  let wsDoc: Record<string, unknown> | null = null;
  let projectDocs: Record<string, unknown>[] = [];
  let workerDocs: Record<string, unknown>[] = [];
  let periodDocs: Record<string, unknown>[] = [];
  let txDocs: Record<string, unknown>[] = [];
  let receiptMap: Record<string, string> = {};

  let readyWs = false;
  let readyProj = false;
  let readyWorkers = false;
  let readyPeriods = false;
  let readyTx = false;
  let readyReceipts = false;

  const emitIfReady = () => {
    if (!readyWs || !readyProj || !readyWorkers || !readyPeriods || !readyTx || !readyReceipts) {
      return;
    }
    if (!wsDoc || projectDocs.length === 0) return;

    const projects: ProjectData[] = projectDocs.map((p) => {
      const pid = String(p.id);
      const projWorkers: Worker[] = workerDocs
        .filter((w) => String(w.projectId) === pid)
        .map((w) => ({
          id: String(w.id),
          nama: String(w.nama),
          jabatan: w.jabatan as Worker['jabatan'],
          upahHarian: Number(w.upahHarian) || 0,
          mandor: String(w.mandor ?? ''),
          aktif: Boolean(w.aktif),
        }));

      const projPeriods: PeriodData[] = periodDocs
        .filter((per) => String(per.projectId) === pid)
        .map((per) => {
          const perId = String(per.id);
          const periodTxs: ExpenseTransaction[] = txDocs
            .filter((t) => String(t.projectId) === pid && String(t.periodId) === perId)
            .map((t) => {
              const txId = String(t.id);
              const fotoNota = receiptMap[txId];
              return {
                id: txId,
                tanggal: String(t.tanggal),
                namaToko: String(t.namaToko),
                kategori: t.kategori as ExpenseTransaction['kategori'],
                sumberDana: t.sumberDana as ExpenseTransaction['sumberDana'],
                items: Array.isArray(t.items) ? t.items : [],
                totalNominal: Number(t.totalNominal) || 0,
                ...(fotoNota ? { fotoNota } : {}),
                ...(t.catatan ? { catatan: String(t.catatan) } : {}),
                ...(t.namaPengaju ? { namaPengaju: String(t.namaPengaju) } : {}),
                ...(t.rembesStatus ? { rembesStatus: t.rembesStatus as RembesStatus } : {}),
                createdAt: String(t.txCreatedAt ?? ''),
              };
            })
            .sort((a, b) => b.createdAt.localeCompare(a.createdAt));

          return {
            id: perId,
            mingguKe: Number(per.mingguKe) || 1,
            labelPeriodeAbsensi: String(per.labelPeriodeAbsensi),
            labelPeriodeKbs: String(per.labelPeriodeKbs),
            attendanceDates: Array.isArray(per.attendanceDates)
              ? (per.attendanceDates as string[])
              : [],
            sisaSaldoLalu: Number(per.sisaSaldoLalu) || 0,
            tanggalSaldoLalu: String(per.tanggalSaldoLalu ?? ''),
            dropingList: Array.isArray(per.dropingList) ? per.dropingList : [],
            transactions: periodTxs,
            cashflowItems: Array.isArray(per.cashflowItems) ? per.cashflowItems : [],
            saldoLaluOverride:
              per.saldoLaluOverride === null || per.saldoLaluOverride === undefined
                ? null
                : Number(per.saldoLaluOverride),
            attendance: (per.attendance as PeriodData['attendance']) ?? {},
            kasbonByWorker: (per.kasbonByWorker as Record<string, number>) ?? {},
            keteranganByWorker: (per.keteranganByWorker as Record<string, string>) ?? {},
          };
        })
        .sort((a, b) => a.mingguKe - b.mingguKe);

      return {
        id: pid,
        nama: String(p.nama),
        lokasi: String(p.lokasi ?? ''),
        pelaksana: String(p.pelaksana ?? ''),
        mandor: String(p.mandor ?? ''),
        workers: projWorkers,
        periods: projPeriods,
      };
    });

    const validProjects = projects.filter((p) => p.periods.length > 0);
    if (validProjects.length === 0) return;

    const reqProjId = String(wsDoc.activeProjectId ?? '');
    const activeProj = validProjects.find((p) => p.id === reqProjId) ?? validProjects[0];
    const reqPerId = String(wsDoc.activePeriodId ?? '');
    const activePer =
      activeProj.periods.find((per) => per.id === reqPerId) ?? activeProj.periods[0];

    const state: AppState = {
      version: 1,
      roleMode: wsDoc.roleMode === 'admin' ? 'admin' : 'mandor',
      activeProjectId: activeProj.id,
      activePeriodId: activePer.id,
      projects: validProjects,
      printConfig: wsDoc.printConfig as PrintConfig,
    };

    const meta: CloudWorkspaceMeta = {
      lastDriveBackupAt:
        typeof wsDoc.lastDriveBackupAt === 'string' ? wsDoc.lastDriveBackupAt : undefined,
      lastDriveBackupName:
        typeof wsDoc.lastDriveBackupName === 'string' ? wsDoc.lastDriveBackupName : undefined,
    };

    onState(state, meta);
  };

  const unsubs: Unsubscribe[] = [];

  unsubs.push(
    onSnapshot(
      doc(db, 'users', uid),
      (snap) => {
        wsDoc = snap.exists() ? (snap.data() as Record<string, unknown>) : null;
        readyWs = true;
        emitIfReady();
      },
      (err) => {
        onError(err);
        handleFirestoreError(err, OperationType.GET, `users/${uid}`);
      }
    )
  );

  const watchCol = (
    subcol: string,
    onRows: (rows: Record<string, unknown>[]) => void
  ) => {
    const q = query(collection(db, 'users', uid, subcol), where('ownerId', '==', uid));
    unsubs.push(
      onSnapshot(
        q,
        (snap) => {
          onRows(snap.docs.map((d) => d.data() as Record<string, unknown>));
          emitIfReady();
        },
        (err) => {
          onError(err);
          handleFirestoreError(err, OperationType.LIST, `users/${uid}/${subcol}`);
        }
      )
    );
  };

  watchCol('projects', (rows) => {
    projectDocs = rows;
    readyProj = true;
  });
  watchCol('workers', (rows) => {
    workerDocs = rows;
    readyWorkers = true;
  });
  watchCol('periods', (rows) => {
    periodDocs = rows;
    readyPeriods = true;
  });
  watchCol('transactions', (rows) => {
    txDocs = rows;
    readyTx = true;
  });
  watchCol('receipts', (rows) => {
    const next: Record<string, string> = {};
    for (const r of rows) {
      if (typeof r.transactionId === 'string' && typeof r.dataUrl === 'string') {
        next[r.transactionId] = r.dataUrl;
      }
    }
    receiptMap = next;
    readyReceipts = true;
  });

  return () => {
    unsubs.forEach((u) => u());
  };
}

// Incremental mutation helpers
export async function syncWorkspacePrefs(
  uid: string,
  patch: Partial<{
    roleMode: RoleMode;
    activeProjectId: string;
    activePeriodId: string;
    printConfig: PrintConfig;
    lastDriveBackupAt: string;
    lastDriveBackupName: string;
  }>
): Promise<void> {
  const path = `users/${uid}`;
  try {
    const payload: Record<string, unknown> = { updatedAt: serverTimestamp() };
    if (patch.roleMode !== undefined) payload.roleMode = patch.roleMode;
    if (patch.activeProjectId !== undefined)
      payload.activeProjectId = sanitizeId(patch.activeProjectId, 'proj');
    if (patch.activePeriodId !== undefined)
      payload.activePeriodId = sanitizeId(patch.activePeriodId, 'per');
    if (patch.printConfig !== undefined)
      payload.printConfig = sanitizePrintConfig(patch.printConfig);
    if (patch.lastDriveBackupAt !== undefined)
      payload.lastDriveBackupAt = clampStr(patch.lastDriveBackupAt, 64);
    if (patch.lastDriveBackupName !== undefined)
      payload.lastDriveBackupName = clampStr(patch.lastDriveBackupName, 200);
    await updateDoc(doc(db, 'users', uid), payload);
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, path);
  }
}

export async function syncProjectCreate(
  uid: string,
  project: ProjectData
): Promise<void> {
  const pid = sanitizeId(project.id, 'proj');
  const projPath = `users/${uid}/projects/${pid}`;
  try {
    await setDoc(doc(db, 'users', uid, 'projects', pid), buildProjectPayload(uid, project));
  } catch (err) {
    handleFirestoreError(err, OperationType.CREATE, projPath);
  }

  try {
    const entries: {
      col: 'workers' | 'periods';
      id: string;
      payload: ReturnType<typeof buildWorkerPayload> | ReturnType<typeof buildPeriodPayload>;
    }[] = [];
    for (const worker of project.workers) {
      entries.push({
        col: 'workers',
        id: sanitizeId(worker.id, 'w'),
        payload: buildWorkerPayload(uid, pid, worker),
      });
    }
    for (const period of project.periods) {
      entries.push({
        col: 'periods',
        id: sanitizeId(period.id, 'per'),
        payload: buildPeriodPayload(uid, pid, period),
      });
    }
    for (let i = 0; i < entries.length; i += 400) {
      const batch = writeBatch(db);
      for (const item of entries.slice(i, i + 400)) {
        batch.set(doc(db, 'users', uid, item.col, item.id), item.payload);
      }
      await batch.commit();
    }
  } catch (err) {
    handleFirestoreError(err, OperationType.CREATE, `users/${uid}/periods`);
  }
}

export async function syncProjectDelete(
  uid: string,
  projectId: string
): Promise<void> {
  const pid = sanitizeId(projectId, 'proj');
  const deleteByProjectId = async (subcol: string) => {
    const q = query(collection(db, 'users', uid, subcol), where('ownerId', '==', uid));
    const snap = await getDocs(q);
    const matching = snap.docs.filter((d) => String(d.data().projectId) === pid);
    for (let i = 0; i < matching.length; i += 400) {
      const batch = writeBatch(db);
      matching.slice(i, i + 400).forEach((d) => batch.delete(d.ref));
      await batch.commit();
    }
  };

  try {
    await deleteByProjectId('receipts');
    await deleteByProjectId('transactions');
    await deleteByProjectId('periods');
    await deleteByProjectId('workers');
    await deleteDoc(doc(db, 'users', uid, 'projects', pid));
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, `users/${uid}/projects/${pid}`);
  }
}

export async function syncProjectUpdate(
  uid: string,
  projectId: string,
  patch: Partial<Pick<ProjectData, 'nama' | 'lokasi' | 'pelaksana' | 'mandor'>>,
  fullProject: ProjectData
): Promise<void> {
  const pid = sanitizeId(projectId, 'proj');
  const path = `users/${uid}/projects/${pid}`;
  try {
    await updateDoc(doc(db, 'users', uid, 'projects', pid), {
      nama: clampStr(patch.nama ?? fullProject.nama, 120) || 'Proyek',
      lokasi: clampStr(patch.lokasi ?? fullProject.lokasi, 160),
      pelaksana: clampStr(patch.pelaksana ?? fullProject.pelaksana, 120),
      mandor: clampStr(patch.mandor ?? fullProject.mandor, 120),
      updatedAt: serverTimestamp(),
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, path);
  }
}

export async function syncWorkerCreate(
  uid: string,
  projectId: string,
  worker: Worker
): Promise<void> {
  const wid = sanitizeId(worker.id, 'w');
  const path = `users/${uid}/workers/${wid}`;
  try {
    await setDoc(doc(db, 'users', uid, 'workers', wid), buildWorkerPayload(uid, projectId, worker));
  } catch (err) {
    handleFirestoreError(err, OperationType.CREATE, path);
  }
}

export async function syncWorkerUpdate(uid: string, worker: Worker): Promise<void> {
  const wid = sanitizeId(worker.id, 'w');
  const path = `users/${uid}/workers/${wid}`;
  try {
    await updateDoc(doc(db, 'users', uid, 'workers', wid), {
      nama: clampStr(worker.nama || 'Pekerja', 100) || 'Pekerja',
      jabatan: worker.jabatan,
      upahHarian: Math.max(0, Number(worker.upahHarian) || 0),
      mandor: clampStr(worker.mandor, 100),
      aktif: Boolean(worker.aktif),
      updatedAt: serverTimestamp(),
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, path);
  }
}

export async function syncPeriodCreate(
  uid: string,
  projectId: string,
  period: PeriodData
): Promise<void> {
  const perId = sanitizeId(period.id, 'per');
  const path = `users/${uid}/periods/${perId}`;
  try {
    await setDoc(doc(db, 'users', uid, 'periods', perId), buildPeriodPayload(uid, projectId, period));
  } catch (err) {
    handleFirestoreError(err, OperationType.CREATE, path);
  }
}

export async function syncPeriodFields(
  uid: string,
  periodId: string,
  patch: Partial<
    Pick<
      PeriodData,
      | 'sisaSaldoLalu'
      | 'tanggalSaldoLalu'
      | 'dropingList'
      | 'cashflowItems'
      | 'saldoLaluOverride'
      | 'attendance'
      | 'kasbonByWorker'
      | 'keteranganByWorker'
    >
  >
): Promise<void> {
  const perId = sanitizeId(periodId, 'per');
  const path = `users/${uid}/periods/${perId}`;
  try {
    const payload: Record<string, unknown> = { updatedAt: serverTimestamp() };
    if (patch.sisaSaldoLalu !== undefined) payload.sisaSaldoLalu = Number(patch.sisaSaldoLalu) || 0;
    if (patch.tanggalSaldoLalu !== undefined)
      payload.tanggalSaldoLalu = clampStr(patch.tanggalSaldoLalu, 20);
    if (patch.dropingList !== undefined) payload.dropingList = patch.dropingList.slice(0, 100);
    if (patch.cashflowItems !== undefined)
      payload.cashflowItems = patch.cashflowItems.slice(0, 150);
    if (patch.saldoLaluOverride !== undefined)
      payload.saldoLaluOverride =
        patch.saldoLaluOverride === null ? null : Number(patch.saldoLaluOverride) || 0;
    if (patch.attendance !== undefined) payload.attendance = patch.attendance;
    if (patch.kasbonByWorker !== undefined) payload.kasbonByWorker = patch.kasbonByWorker;
    if (patch.keteranganByWorker !== undefined)
      payload.keteranganByWorker = patch.keteranganByWorker;

    await updateDoc(doc(db, 'users', uid, 'periods', perId), payload);
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, path);
  }
}

export async function syncTransactionCreate(
  uid: string,
  projectId: string,
  periodId: string,
  tx: ExpenseTransaction
): Promise<void> {
  const txId = sanitizeId(tx.id, 'tx');
  const txPath = `users/${uid}/transactions/${txId}`;
  try {
    await setDoc(
      doc(db, 'users', uid, 'transactions', txId),
      buildTransactionPayload(uid, projectId, periodId, tx)
    );
  } catch (err) {
    handleFirestoreError(err, OperationType.CREATE, txPath);
  }

  if (tx.fotoNota && tx.fotoNota.length > 0 && tx.fotoNota.length <= 350000) {
    const receiptPath = `users/${uid}/receipts/${txId}`;
    try {
      await setDoc(
        doc(db, 'users', uid, 'receipts', txId),
        buildReceiptPayload(uid, projectId, txId, tx.fotoNota)
      );
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, receiptPath);
    }
  }
}

export async function syncTransactionRembesStatus(
  uid: string,
  txId: string,
  rembesStatus: RembesStatus
): Promise<void> {
  const safeId = sanitizeId(txId, 'tx');
  const path = `users/${uid}/transactions/${safeId}`;
  try {
    await updateDoc(doc(db, 'users', uid, 'transactions', safeId), {
      rembesStatus,
      updatedAt: serverTimestamp(),
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, path);
  }
}

export async function syncTransactionDelete(uid: string, txId: string): Promise<void> {
  const safeId = sanitizeId(txId, 'tx');
  try {
    await deleteDoc(doc(db, 'users', uid, 'receipts', safeId)).catch(() => {});
    await deleteDoc(doc(db, 'users', uid, 'transactions', safeId));
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, `users/${uid}/transactions/${safeId}`);
  }
}
