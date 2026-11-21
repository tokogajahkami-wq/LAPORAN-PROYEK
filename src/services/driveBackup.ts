import type { AppState } from '../types';
import { clearDriveAccessToken } from '../firebase';

const DRIVE_API_BASE = 'https://www.googleapis.com/drive/v3';
const DRIVE_UPLOAD_BASE = 'https://www.googleapis.com/upload/drive/v3';
const BACKUP_FOLDER_NAME = 'ProyekKas Backup';

export interface DriveBackupFile {
  id: string;
  name: string;
  modifiedTime: string;
  sizeBytes: number;
  description?: string;
}

interface DriveBackupEnvelope {
  app: 'ProyekKas & Absensi';
  formatVersion: number;
  backedUpAt: string;
  ownerEmail?: string;
  projectSummary: string;
  state: AppState;
}

function handleDriveResponseError(status: number, bodyText: string): never {
  if (status === 401 || status === 403) {
    clearDriveAccessToken();
    throw new Error(
      'Sesi izin Google Drive kedaluwarsa atau ditolak. Silakan klik Hubungkan Ulang / Login Google.'
    );
  }
  throw new Error(`Gagal mengakses Google Drive (${status}): ${bodyText.slice(0, 180)}`);
}

async function ensureBackupFolder(accessToken: string): Promise<string> {
  const q = `name='${BACKUP_FOLDER_NAME}' and mimeType='application/vnd.google-apps.folder' and trashed=false`;
  const listUrl = `${DRIVE_API_BASE}/files?q=${encodeURIComponent(q)}&fields=files(id,name)&pageSize=5`;

  const listRes = await fetch(listUrl, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!listRes.ok) {
    handleDriveResponseError(listRes.status, await listRes.text());
  }
  const listJson = (await listRes.json()) as { files?: { id: string; name: string }[] };
  if (listJson.files && listJson.files.length > 0) {
    return listJson.files[0].id;
  }

  const createRes = await fetch(`${DRIVE_API_BASE}/files?fields=id,name`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      name: BACKUP_FOLDER_NAME,
      mimeType: 'application/vnd.google-apps.folder',
      description: 'Folder cadangan otomatis aplikasi ProyekKas & Absensi',
    }),
  });
  if (!createRes.ok) {
    handleDriveResponseError(createRes.status, await createRes.text());
  }
  const created = (await createRes.json()) as { id: string };
  return created.id;
}

function formatBackupTimestamp(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}_${pad(
    date.getHours()
  )}-${pad(date.getMinutes())}-${pad(date.getSeconds())}`;
}

export async function uploadDriveBackup(
  accessToken: string,
  state: AppState,
  ownerEmail?: string | null
): Promise<DriveBackupFile> {
  const folderId = await ensureBackupFolder(accessToken);
  const now = new Date();
  const projectNames = state.projects.map((p) => p.nama).join(', ');
  const fileName = `ProyekKas-Backup-${formatBackupTimestamp(now)}.proyekkas`;

  const envelope: DriveBackupEnvelope = {
    app: 'ProyekKas & Absensi',
    formatVersion: 1,
    backedUpAt: now.toISOString(),
    ownerEmail: ownerEmail ?? undefined,
    projectSummary: projectNames,
    state,
  };

  const metadata = {
    name: fileName,
    parents: [folderId],
    mimeType: 'application/json',
    description: `Proyek: ${projectNames.slice(0, 120)}`,
  };

  const boundary = `proyekkas_boundary_${Date.now()}`;
  const multipartBody =
    `--${boundary}\r\n` +
    `Content-Type: application/json; charset=UTF-8\r\n\r\n` +
    `${JSON.stringify(metadata)}\r\n` +
    `--${boundary}\r\n` +
    `Content-Type: application/json; charset=UTF-8\r\n\r\n` +
    `${JSON.stringify(envelope)}\r\n` +
    `--${boundary}--`;

  const uploadRes = await fetch(
    `${DRIVE_UPLOAD_BASE}/files?uploadType=multipart&fields=id,name,modifiedTime,size,description`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': `multipart/related; boundary=${boundary}`,
      },
      body: multipartBody,
    }
  );

  if (!uploadRes.ok) {
    handleDriveResponseError(uploadRes.status, await uploadRes.text());
  }

  const uploaded = (await uploadRes.json()) as {
    id: string;
    name: string;
    modifiedTime?: string;
    size?: string;
    description?: string;
  };

  return {
    id: uploaded.id,
    name: uploaded.name,
    modifiedTime: uploaded.modifiedTime ?? now.toISOString(),
    sizeBytes: Number(uploaded.size) || multipartBody.length,
    description: uploaded.description,
  };
}

export async function listDriveBackups(accessToken: string): Promise<DriveBackupFile[]> {
  const folderId = await ensureBackupFolder(accessToken);
  const q = `'${folderId}' in parents and trashed=false`;
  const url = `${DRIVE_API_BASE}/files?q=${encodeURIComponent(
    q
  )}&orderBy=modifiedTime desc&pageSize=15&fields=files(id,name,modifiedTime,size,description)`;

  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) {
    handleDriveResponseError(res.status, await res.text());
  }
  const data = (await res.json()) as {
    files?: {
      id: string;
      name: string;
      modifiedTime?: string;
      size?: string;
      description?: string;
    }[];
  };

  return (data.files ?? []).map((f) => ({
    id: f.id,
    name: f.name,
    modifiedTime: f.modifiedTime ?? '',
    sizeBytes: Number(f.size) || 0,
    description: f.description,
  }));
}

export async function downloadDriveBackup(
  accessToken: string,
  fileId: string
): Promise<{ state: AppState; backedUpAt?: string }> {
  const res = await fetch(`${DRIVE_API_BASE}/files/${encodeURIComponent(fileId)}?alt=media`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) {
    handleDriveResponseError(res.status, await res.text());
  }

  const parsed = (await res.json()) as Partial<DriveBackupEnvelope> & Partial<AppState>;
  const candidateState = (parsed.state ?? parsed) as Partial<AppState>;

  if (
    !candidateState ||
    !Array.isArray(candidateState.projects) ||
    candidateState.projects.length === 0
  ) {
    throw new Error('File backup di Google Drive tidak valid atau kosong.');
  }

  const activeProject =
    candidateState.projects.find((p) => p.id === candidateState.activeProjectId) ??
    candidateState.projects[0];
  const activePeriod =
    activeProject.periods.find((per) => per.id === candidateState.activePeriodId) ??
    activeProject.periods[0];

  if (!activePeriod) {
    throw new Error('Data periode proyek di file backup tidak ditemukan.');
  }

  const normalized: AppState = {
    version: candidateState.version ?? 1,
    roleMode: candidateState.roleMode === 'admin' ? 'admin' : 'mandor',
    activeProjectId: activeProject.id,
    activePeriodId: activePeriod.id,
    projects: candidateState.projects,
    printConfig: candidateState.printConfig ?? {
      kota: activeProject.lokasi,
      tanggalCetak: new Date().toISOString().slice(0, 10),
      mengetahuiNama: 'Owner / Direktur',
      mengetahuiJabatan: 'Mengetahui',
      disetujuiNama: 'Bagian Keuangan',
      disetujuiJabatan: 'Disetujui',
      dibuatNama: activeProject.pelaksana,
      dibuatJabatan: 'Pelaksana Proyek',
      sertakanFotoNota: true,
    },
  };

  return {
    state: normalized,
    backedUpAt: parsed.backedUpAt,
  };
}

export async function deleteDriveBackup(accessToken: string, fileId: string): Promise<void> {
  const res = await fetch(`${DRIVE_API_BASE}/files/${encodeURIComponent(fileId)}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok && res.status !== 204) {
    handleDriveResponseError(res.status, await res.text());
  }
}
