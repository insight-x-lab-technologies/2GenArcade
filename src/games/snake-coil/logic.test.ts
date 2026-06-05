import { describe, expect, it } from 'vitest';
import {
  advance,
  COLS,
  freeCells,
  HAZARD_FROM_LEVEL,
  hitsBody,
  hitsWall,
  initialSnake,
  isReverse,
  key,
  levelForOrbs,
  opposite,
  orbGrowth,
  orbScore,
  placeHazards,
  placeOrb,
  ROWS,
  safetyZone,
  slowCountForLevel,
  START_LENGTH,
  stepHead,
  tickInterval,
  wallCountForLevel,
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

describe('hazards (C.2)', () => {
  it('keeps the board empty below the hazard level', () => {
    for (let lv = 1; lv < HAZARD_FROM_LEVEL; lv += 1) {
      expect(wallCountForLevel(lv)).toBe(0);
      expect(slowCountForLevel(lv)).toBe(0);
    }
  });

  it('grows the wall count with level but caps it', () => {
    expect(wallCountForLevel(HAZARD_FROM_LEVEL)).toBe(2);
    expect(wallCountForLevel(HAZARD_FROM_LEVEL + 1)).toBe(3);
    expect(wallCountForLevel(50)).toBe(8);
    // Never enough hazards to fill the board.
    expect(wallCountForLevel(50) + slowCountForLevel(50)).toBeLessThan(COLS * ROWS);
  });

  it('safetyZone returns the cells straight ahead of the head', () => {
    const zone = safetyZone({ x: 5, y: 5 }, 'up', 3);
    expect(zone).toEqual([
      { x: 5, y: 4 },
      { x: 5, y: 3 },
      { x: 5, y: 2 },
    ]);
  });

  it('places distinct hazards on free cells, never on blocked ones', () => {
    const snake = initialSnake();
    const orb: Vec = { x: 0, y: 0 };
    const blocked = [...snake, orb];
    const hazards = placeHazards(5, blocked, () => 0.42);
    expect(hazards).toHaveLength(5);
    const blockedKeys = new Set(blocked.map(key));
    const seen = new Set<string>();
    for (const h of hazards) {
      expect(hitsWall(h)).toBe(false);
      expect(blockedKeys.has(key(h))).toBe(false);
      expect(seen.has(key(h))).toBe(false); // distinct
      seen.add(key(h));
    }
  });

  it('never returns more cells than are free', () => {
    // Block every cell but two.
    const blocked: Vec[] = [];
    for (let y = 0; y < ROWS; y += 1)
      for (let x = 0; x < COLS; x += 1) if (!(y === 0 && x < 2)) blocked.push({ x, y });
    expect(placeHazards(5, blocked, () => 0.9)).toHaveLength(2);
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
