/**
 * Public DGT stills already sit on the A-7 / A-357 / MA-21 approaches to
 * Alhaurín de la Torre, but they arrive labeled as generic "Málaga" province
 * pins. Relabel the ones that actually serve the town so they cluster as
 * Alhaurín-area cameras. Municipal Policía Local feeds stay out.
 */

export interface CorridorCamera {
  id: string;
  name: string;
  city: string;
}

const BY_ID: Record<string, { city: string; name: string }> = {
  'dgt-175602': { city: 'Alhaurín de la Torre', name: 'A-7 km 995 — Alhaurín / Torremolinos' },
  'dgt-177220': { city: 'Alhaurín de la Torre', name: 'A-7 km 990 — Alhaurín / Churriana' },
  'dgt-177219': { city: 'Alhaurín de la Torre', name: 'A-7 km 993 — Alhaurín / Churriana' },
  'dgt-167611': { city: 'Alhaurín de la Torre', name: 'A-357 km 61.8 — Alhaurín / Cártama' },
  'dgt-167610': { city: 'Alhaurín de la Torre', name: 'A-357 km 60.2 — Alhaurín / Cártama' },
  'dgt-167609': { city: 'Cártama', name: 'A-357 km 58.2 — Cártama / Alhaurín' },
  'dgt-169630': { city: 'Cártama', name: 'A-357 km 56.9 — Cártama / Alhaurín' },
  'dgt-169629': { city: 'Cártama', name: 'A-357 km 54.2 — Cártama' },
  'dgt-167612': { city: 'Alhaurín de la Torre', name: 'A-357 km 64.3 — Campanillas / Alhaurín' },
  'dgt-177218': { city: 'Alhaurín de la Torre', name: 'A-357 km 66.0 — Campanillas' },
  'dgt-167607': { city: 'Campanillas', name: 'A-7056 km 0.6 — PTA / Campanillas' },
  'dgt-167608': { city: 'Campanillas', name: 'A-7056 km 1.4 — PTA / Campanillas' },
  'dgt-281': { city: 'Alhaurín de la Torre', name: 'MA-21 km 0.9 — Guadalhorce / Alhaurín' },
  'dgt-280': { city: 'Alhaurín de la Torre', name: 'MA-21 km 2.5 — Guadalhorce' },
};

export function labelAlhaurinCorridor<T extends CorridorCamera>(cam: T): T {
  const overlay = BY_ID[cam.id];
  if (!overlay) return cam;
  return { ...cam, city: overlay.city, name: overlay.name };
}
