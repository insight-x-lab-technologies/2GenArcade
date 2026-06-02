import { describe, expect, it } from 'vitest';
import {
  advance,
  COLS,
  freeCells,
  hitsBody,
  hitsWall,
  initialSnake,
  isReverse,
  levelForOrbs,
  opposite,
  orbGrowth,
  orbScore,
  placeOrb,
  ROWS,
  START_LENGTH,
  stepHead,
  tickInterval,
  type Vec,
} from './logic';

describe('directions', () => {
  it('opposites pair up', () => {
    expect(opposite('up')).toBe('down');
    expect(opposite('left')).toBe('right');
  });

  it('flags 180° reversals only', () => {
    expect(isReverse('down', 'up')).toBe(true);
    expect(isReverse('left', 'up')).toBe(false);
    expect(isReverse('up', 'up')).toBe(false);
  });

  it('steps the head by one cell', () => {
    expect(stepHead({ x: 5, y: 5 }, 'up')).toEqual({ x: 5, y: 4 });
    expect(stepHead({ x: 5, y: 5 }, 'right')).toEqual({ x: 6, y: 5 });
  });
});

describe('advance', () => {
  const body: Vec[] = [
    { x: 5, y: 5 },
    { x: 5, y: 6 },
    { x: 5, y: 7 },
  ];

  it('moves without growing (keeps length, drops tail)', () => {
    const next = advance(body, 'up', false);
    expect(next).toHaveLength(3);
    expect(next[0]).toEqual({ x: 5, y: 4 });
    expect(next).not.toContainEqual({ x: 5, y: 7 });
  });

  it('grows by keeping the tail', () => {
    const next = advance(body, 'up', true);
    expect(next).toHaveLength(4);
    expect(next[0]).toEqual({ x: 5, y: 4 });
    expect(next).toContainEqual({ x: 5, y: 7 });
  });
});

describe('collisions', () => {
  it('detects walls on every edge', () => {
    expect(hitsWall({ x: -1, y: 0 })).toBe(true);
    expect(hitsWall({ x: 0, y: -1 })).toBe(true);
    expect(hitsWall({ x: COLS, y: 0 })).toBe(true);
    expect(hitsWall({ x: 0, y: ROWS })).toBe(true);
    expect(hitsWall({ x: 0, y: 0 })).toBe(false);
  });

  it('detects self-overlap', () => {
    const body: Vec[] = [
      { x: 2, y: 2 },
      { x: 2, y: 3 },
    ];
    expect(hitsBody({ x: 2, y: 3 }, body)).toBe(true);
    expect(hitsBody({ x: 4, y: 4 }, body)).toBe(false);
  });
});

describe('orb placement', () => {
  it('never lands on the Coil and stays in bounds', () => {
    const snake = initialSnake();
    // Force the lowest index and the highest index.
    const first = placeOrb(snake, () => 0);
    const last = placeOrb(snake, () => 0.999999);
    for (const orb of [first, last]) {
      expect(orb).not.toBeNull();
      expect(hitsBody(orb!, snake)).toBe(false);
      expect(hitsWall(orb!)).toBe(false);
    }
  });

  it('returns null when the grid is full', () => {
    const full: Vec[] = [];
    for (let y = 0; y < ROWS; y += 1) for (let x = 0; x < COLS; x += 1) full.push({ x, y });
    expect(placeOrb(full, () => 0)).toBeNull();
    expect(freeCells(full)).toHaveLength(0);
  });
});

describe('difficulty + scoring', () => {
  it('levels up every five orbs', () => {
    expect(levelForOrbs(0)).toBe(1);
    expect(levelForOrbs(4)).toBe(1);
    expect(levelForOrbs(5)).toBe(2);
    expect(levelForOrbs(12)).toBe(3);
  });

  it('ticks faster each level but never below the floor', () => {
    expect(tickInterval(1)).toBeCloseTo(0.16);
    expect(tickInterval(2)).toBeLessThan(tickInterval(1));
    expect(tickInterval(50)).toBe(0.06);
  });

  it('scores with kind, level, combo and surge', () => {
    expect(orbScore('normal', 1, 0, false)).toBe(10);
    expect(orbScore('prism', 1, 0, false)).toBe(50);
    expect(orbScore('normal', 2, 0, false)).toBe(20);
    expect(orbScore('normal', 1, 2, false)).toBe(20); // (10 + 2*5) * 1
    expect(orbScore('normal', 1, 0, true)).toBe(20); // surge doubles
  });

  it('prisms grow the Coil more', () => {
    expect(orbGrowth('normal')).toBe(1);
    expect(orbGrowth('prism')).toBe(2);
  });
});

describe('initial snake', () => {
  it('has the start length and is vertical', () => {
    const s = initialSnake();
    expect(s).toHaveLength(START_LENGTH);
    expect(new Set(s.map((c) => c.x)).size).toBe(1); // single column
    expect(s[0]!.y).toBeLessThan(s[1]!.y); // head above tail (heading up)
  });
});
