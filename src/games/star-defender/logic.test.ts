import { describe, expect, it } from 'vitest';
import {
  aabbHit,
  BASE_ROWS,
  BOSS_EVERY,
  bossHp,
  bossIndex,
  clampOffsetX,
  COLS,
  EN_HW,
  enemyFireInterval,
  FIELD_W,
  formationSpeed,
  FORMATION_MARGIN,
  homeX,
  invaded,
  isBossWave,
  MAX_ROWS,
  pickPowerKind,
  POWER_KINDS,
  reverseIfEdge,
  rowPoints,
  rowsForWave,
} from './logic';

describe('rowsForWave', () => {
  it('grows with the wave then caps', () => {
    expect(rowsForWave(1)).toBe(BASE_ROWS);
    expect(rowsForWave(3)).toBeGreaterThan(rowsForWave(1));
    expect(rowsForWave(99)).toBe(MAX_ROWS);
  });
});

describe('formationSpeed / enemyFireInterval', () => {
  it('later waves sweep faster and fire more often, both clamped', () => {
    expect(formationSpeed(5)).toBeGreaterThan(formationSpeed(1));
    expect(formationSpeed(999)).toBeLessThanOrEqual(46);
    expect(enemyFireInterval(5)).toBeLessThan(enemyFireInterval(1));
    expect(enemyFireInterval(999)).toBeGreaterThanOrEqual(0.3);
  });
});

describe('homeX', () => {
  it('lays the columns out centred and left-to-right within the field', () => {
    const xs = Array.from({ length: COLS }, (_, c) => homeX(c));
    for (let i = 1; i < xs.length; i += 1) expect(xs[i]!).toBeGreaterThan(xs[i - 1]!);
    // Symmetric about the centre line.
    expect(xs[0]! + xs[COLS - 1]!).toBeCloseTo(FIELD_W);
  });
});

describe('rowPoints', () => {
  it('rewards the top (front) rows more', () => {
    expect(rowPoints(0, 4)).toBeGreaterThan(rowPoints(3, 4));
    expect(rowPoints(3, 4)).toBe(10);
  });
});

describe('reverseIfEdge', () => {
  it('reverses + drops at the right wall when moving right', () => {
    const r = reverseIfEdge(20, FIELD_W - FORMATION_MARGIN, 1);
    expect(r.dir).toBe(-1);
    expect(r.drop).toBe(true);
  });
  it('reverses + drops at the left wall when moving left', () => {
    const r = reverseIfEdge(FORMATION_MARGIN, 80, -1);
    expect(r.dir).toBe(1);
    expect(r.drop).toBe(true);
  });
  it('keeps going mid-field', () => {
    const r = reverseIfEdge(30, 70, 1);
    expect(r).toEqual({ dir: 1, drop: false });
  });
});

describe('clampOffsetX', () => {
  it('never lets either edge clip outside the walls', () => {
    const minHome = homeX(0);
    const maxHome = homeX(COLS - 1);
    const tooFarRight = clampOffsetX(999, minHome, maxHome);
    const tooFarLeft = clampOffsetX(-999, minHome, maxHome);
    expect(maxHome + tooFarRight + EN_HW).toBeLessThanOrEqual(FIELD_W - FORMATION_MARGIN + 1e-6);
    expect(minHome + tooFarLeft - EN_HW).toBeGreaterThanOrEqual(FORMATION_MARGIN - 1e-6);
  });
});

describe('invaded', () => {
  it('triggers once a wraith reaches the danger line', () => {
    expect(invaded(149)).toBe(false);
    expect(invaded(151)).toBe(true);
  });
});

describe('aabbHit', () => {
  it('detects box overlap and clears separation', () => {
    expect(aabbHit(0, 0, 4, 3, 3, 0, 4, 3)).toBe(true); // dx 3 <= 8
    expect(aabbHit(0, 0, 4, 3, 20, 0, 4, 3)).toBe(false);
    expect(aabbHit(0, 0, 4, 3, 0, 10, 4, 3)).toBe(false);
  });
});

describe('boss schedule', () => {
  it('flags every Nth wave as a boss wave with a growing index', () => {
    expect(isBossWave(BOSS_EVERY)).toBe(true);
    expect(isBossWave(BOSS_EVERY * 2)).toBe(true);
    expect(isBossWave(BOSS_EVERY - 1)).toBe(false);
    expect(isBossWave(1)).toBe(false);
    expect(bossIndex(BOSS_EVERY)).toBe(1);
    expect(bossIndex(BOSS_EVERY * 3)).toBe(3);
    expect(bossIndex(3)).toBe(0);
  });
  it('makes later bosses tougher', () => {
    expect(bossHp(BOSS_EVERY * 2)).toBeGreaterThan(bossHp(BOSS_EVERY));
  });
});

describe('pickPowerKind', () => {
  it('always returns a known kind across the [0,1) range', () => {
    for (let r = 0; r < 1; r += 0.013) expect(POWER_KINDS).toContain(pickPowerKind(r));
  });
});
