import { describe, it, expect, beforeEach } from 'vitest';
import {
  loadCctvGridState,
  saveCctvGridState,
  addCameraToGridSlots,
  normalizeGridSlots,
  CCTV_GRID_STORAGE_KEY,
} from './cctv-grid-storage';

function mockLocalStorage() {
  const store = new Map<string, string>();
  const ls = {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => { store.set(k, v); },
    removeItem: (k: string) => { store.delete(k); },
    clear: () => { store.clear(); },
  };
  Object.defineProperty(globalThis, 'localStorage', { value: ls, configurable: true });
  return store;
}

describe('cctv-grid-storage', () => {
  beforeEach(() => {
    mockLocalStorage();
  });

  it('returns empty slots by default', () => {
    expect(loadCctvGridState()).toEqual({ slotIds: [], refreshMs: 1000 });
  });

  it('round-trips slot layout and refresh cadence', () => {
    saveCctvGridState({ slotIds: ['a', 'b', '', 'd'], refreshMs: 2000 });
    expect(loadCctvGridState()).toEqual({ slotIds: ['a', 'b', '', 'd'], refreshMs: 2000 });
    expect(localStorage.getItem(CCTV_GRID_STORAGE_KEY)).toBeTruthy();
  });

  it('fills grid slots in order without duplicates', () => {
    let slots = normalizeGridSlots([]);
    ({ slots } = addCameraToGridSlots(slots, 'cam-a'));
    ({ slots } = addCameraToGridSlots(slots, 'cam-b'));
    ({ slots } = addCameraToGridSlots(slots, 'cam-a'));
    expect(slots).toEqual(['cam-a', 'cam-b', '', '']);
    const done = addCameraToGridSlots(slots, 'cam-c');
    expect(done.slots).toEqual(['cam-a', 'cam-b', 'cam-c', '']);
    const finished = addCameraToGridSlots(done.slots, 'cam-d');
    expect(finished.slots).toEqual(['cam-a', 'cam-b', 'cam-c', 'cam-d']);
    expect(finished.complete).toBe(true);
  });
});
