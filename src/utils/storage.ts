import type { AppState } from '../types';
import { createSeedState } from '../data/seedData';

const STORAGE_KEY = 'proyekkas_absensi_state_v1';

export function loadAppState(): AppState {
  if (typeof window === 'undefined') {
    return createSeedState();
  }
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      const seed = createSeedState();
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(seed));
      return seed;
    }
    const parsed = JSON.parse(raw) as Partial<AppState>;
    const hasValidProjects =
      parsed &&
      Array.isArray(parsed.projects) &&
      parsed.projects.length > 0 &&
      Boolean(parsed.activeProjectId) &&
      parsed.projects.every(
        (proj) =>
          proj &&
          typeof proj.id === 'string' &&
          Array.isArray(proj.workers) &&
          Array.isArray(proj.periods) &&
          proj.periods.length > 0 &&
          proj.periods.every(
            (per) =>
              per &&
              typeof per.id === 'string' &&
              Array.isArray(per.attendanceDates) &&
              Array.isArray(per.dropingList) &&
              Array.isArray(per.transactions) &&
              Array.isArray(per.cashflowItems)
          )
      );

    if (!hasValidProjects) {
      const seed = createSeedState();
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(seed));
      return seed;
    }

    const fallback = createSeedState();
    const activeProj =
      parsed.projects!.find((p) => p.id === parsed.activeProjectId) ?? parsed.projects![0];
    const activePeriodId =
      activeProj.periods.some((per) => per.id === parsed.activePeriodId)
        ? parsed.activePeriodId!
        : activeProj.periods[0].id;

    return {
      version: parsed.version ?? fallback.version,
      roleMode: parsed.roleMode === 'admin' ? 'admin' : 'mandor',
      activeProjectId: activeProj.id,
      activePeriodId,
      projects: parsed.projects!,
      printConfig: {
        ...fallback.printConfig,
        ...(parsed.printConfig ?? {}),
      },
    };
  } catch {
    return createSeedState();
  }
}

export function saveAppState(state: AppState): { ok: boolean; error?: string } {
  if (typeof window === 'undefined') return { ok: true };
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      error:
        err instanceof Error
          ? err.message
          : 'Penyimpanan lokal penuh. Hapus beberapa foto nota lama jika perlu.',
    };
  }
}

export function resetAppState(): AppState {
  const fresh = createSeedState();
  saveAppState(fresh);
  return fresh;
}
