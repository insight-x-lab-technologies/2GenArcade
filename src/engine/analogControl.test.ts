import { describe, expect, it } from 'vitest';
import type { Direction } from '@/types';
import { diffHeld, vectorToDirections } from './analogControl';

describe('vectorToDirections', () => {
  it('returns nothing inside the deadzone', () => {
    expect(vectorToDirections(0, 0)).toEqual([]);
    expect(vectorToDirections(3, -4, 12)).toEqual([]); // r = 5 < 12
  });

  it('maps the four cardinals (screen y grows downward)', () => {
    expect(vectorToDirections(40, 0)).toEqual(['right']);
    expect(vectorToDirections(-40, 0)).toEqual(['left']);
    expect(vectorToDirections(0, -40)).toEqual(['up']);
    expect(vectorToDirections(0, 40)).toEqual(['down']);
  });

  it('maps diagonals to two simultaneous directions (analog feel)', () => {
    expect(new Set(vectorToDirections(40, -40))).toEqual(new Set<Direction>(['up', 'right']));
    expect(new Set(vectorToDirections(-40, -40))).toEqual(new Set<Direction>(['up', 'left']));
    expect(new Set(vectorToDirections(-40, 40))).toEqual(new Set<Direction>(['down', 'left']));
    expect(new Set(vectorToDirections(40, 40))).toEqual(new Set<Direction>(['down', 'right']));
  });
});

describe('diffHeld', () => {
  it('presses newly-added and releases newly-removed directions', () => {
    const calls: Array<[Direction, 'press' | 'release']> = [];
    diffHeld(new Set<Direction>(['left']), new Set<Direction>(['up', 'right']), (d, p) =>
      calls.push([d, p]),
    );
    expect(calls).toContainEqual(['up', 'press']);
    expect(calls).toContainEqual(['right', 'press']);
    expect(calls).toContainEqual(['left', 'release']);
    expect(calls).toHaveLength(3);
  });

  it('does nothing when the sets match', () => {
    const calls: unknown[] = [];
    diffHeld(new Set<Direction>(['up']), new Set<Direction>(['up']), () => calls.push(1));
    expect(calls).toHaveLength(0);
  });
});
