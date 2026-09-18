/** Persisted CCTV wall layout — survives page refresh. */

export const CCTV_GRID_STORAGE_KEY = 'osiris.cctv-grid.v1';

export interface CctvGridPersisted {
  slotIds: string[];
  refreshMs: number;
}

const DEFAULT: CctvGridPersisted = { slotIds: [], refreshMs: 1000 };

export function loadCctvGridState(): CctvGridPersisted {
  if (typeof localStorage === 'undefined') return DEFAULT;
  try {
    const raw = localStorage.getItem(CCTV_GRID_STORAGE_KEY);
    if (!raw) return DEFAULT;
    const parsed = JSON.parse(raw) as Partial<CctvGridPersisted>;
    const slotIds = Array.isArray(parsed.slotIds)
      ? parsed.slotIds.slice(0, 4).map(String)
      : [];
    const refreshMs = typeof parsed.refreshMs === 'number' && parsed.refreshMs >= 500
      ? parsed.refreshMs
      : DEFAULT.refreshMs;
    return { slotIds, refreshMs };
  } catch {
    return DEFAULT;
  }
}

export function saveCctvGridState(state: CctvGridPersisted): void {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(CCTV_GRID_STORAGE_KEY, JSON.stringify({
      slotIds: state.slotIds.slice(0, 4),
      refreshMs: state.refreshMs,
    }));
  } catch { /* private mode / quota */ }
}

export const GRID_SLOT_COUNT = 4;

export function normalizeGridSlots(slotIds: string[]): string[] {
  const next = [...slotIds];
  while (next.length < GRID_SLOT_COUNT) next.push('');
  return next.slice(0, GRID_SLOT_COUNT);
}

/** Add a camera id to the next free wall slot. Returns updated slots and whether all 4 are filled. */
export function addCameraToGridSlots(
  slotIds: string[],
  cameraId: string,
): { slots: string[]; picked: number; complete: boolean } {
  const next = normalizeGridSlots(slotIds);
  if (!cameraId || next.includes(cameraId)) {
    const picked = next.filter(Boolean).length;
    return { slots: next, picked, complete: picked >= GRID_SLOT_COUNT };
  }
  const empty = next.findIndex(id => !id);
  if (empty < 0) {
    const picked = GRID_SLOT_COUNT;
    return { slots: next, picked, complete: true };
  }
  next[empty] = cameraId;
  const picked = next.filter(Boolean).length;
  return { slots: next, picked, complete: picked >= GRID_SLOT_COUNT };
}
