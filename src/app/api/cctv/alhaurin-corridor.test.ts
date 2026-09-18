import { describe, it, expect } from 'vitest';
import { labelAlhaurinCorridor } from './alhaurin-corridor';

describe('labelAlhaurinCorridor', () => {
  it('relabels the A-7 Alhaurín slip as an Alhaurín pin', () => {
    expect(labelAlhaurinCorridor({
      id: 'dgt-175602',
      name: 'A-7 km 995.3 (Ascending)',
      city: 'Málaga',
    })).toEqual({
      id: 'dgt-175602',
      name: 'A-7 km 995 — Alhaurín / Torremolinos',
      city: 'Alhaurín de la Torre',
    });
  });

  it('leaves unrelated DGT cameras alone', () => {
    const cam = { id: 'dgt-1', name: 'A-45 km 10', city: 'Málaga' };
    expect(labelAlhaurinCorridor(cam)).toEqual(cam);
  });
});
