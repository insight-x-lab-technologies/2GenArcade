// Pure logic for Snake Coil. Grid-based, no canvas, no timing — fully unit-tested.
//
// Snake Coil is an original take on the "snake" genre: a glowing energy serpent
// (the Coil) collects orbs on a neon grid. Its signature twists are SURGE (a
// charge meter that, when full, lets the Coil phase through itself for a few
// seconds at double value) and timed PRISM orbs worth a burst of points. Walls
// are lethal, so the playfield tightens as the Coil grows. This module owns the
// grid math and scoring; the game class owns rendering, timing and audio.

export type Dir = 'up' | 'down' | 'left' | 'right';
export interface Vec {
  x: number;
  y: number;
}
export type OrbKind = 'normal' | 'prism';

export const COLS = 13;
export const ROWS = 17;

export const START_LENGTH = 3;
/** Orbs needed to advance a level (speeds the Coil up). */
export const ORBS_PER_LEVEL = 5;
/** Seconds a combo stays alive between orbs. */
export const COMBO_WINDOW = 2.4;
/** Surge meter fill per orb (5 orbs fills it). */
export const SURGE_PER_ORB = 0.2;
/** Seconds a surge lasts once triggered. */
export const SURGE_DURATION = 4;
/** Every Nth orb spawns as a (timed) prism. */
export const PRISM_EVERY = 5;
/** Seconds a prism lives before downgrading to a normal orb. */
export const PRISM_LIFE = 6;

export const DELTAS: Record<Dir, Vec> = {
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
};

export const opposite = (d: Dir): Dir => {
  switch (d) {
    case 'up':
      return 'down';
    case 'down':
      return 'up';
    case 'left':
      return 'right';
    case 'right':
      return 'left';
  }
};

/** A 180° reversal would instantly fold the Coil onto itself — disallowed. */
export const isReverse = (next: Dir, current: Dir): boolean => opposite(current) === next;

export const eq = (a: Vec, b: Vec): boolean => a.x === b.x && a.y === b.y;
export const key = (v: Vec): string => `${v.x},${v.y}`;

export const stepHead = (head: Vec, dir: Dir): Vec => ({
  x: head.x + DELTAS[dir].x,
  y: head.y + DELTAS[dir].y,
});

/** Advance the Coil one cell in `dir`. Head is index 0; `grow` keeps the tail. */
export const advance = (body: Vec[], dir: Dir, grow: boolean): Vec[] => {
  const head = stepHead(body[0]!, dir);
  const next = [head, ...body];
  if (!grow) next.pop();
  return next;
};

export const hitsWall = (p: Vec, cols = COLS, rows = ROWS): boolean =>
  p.x < 0 || p.y < 0 || p.x >= cols || p.y >= rows;

export const hitsBody = (p: Vec, body: Vec[]): boolean => body.some((s) => eq(s, p));

/** Free cells not covered by the Coil (used to place orbs). */
export const freeCells = (occupied: Vec[], cols = COLS, rows = ROWS): Vec[] => {
  const taken = new Set(occupied.map(key));
  const cells: Vec[] = [];
  for (let y = 0; y < rows; y += 1) {
    for (let x = 0; x < cols; x += 1) {
      if (!taken.has(`${x},${y}`)) cells.push({ x, y });
    }
  }
  return cells;
};

/** Pick a random free cell for a new orb. `rand` returns [0,1). Null if full. */
export const placeOrb = (
  occupied: Vec[],
  rand: () => number,
  cols = COLS,
  rows = ROWS,
): Vec | null => {
  const cells = freeCells(occupied, cols, rows);
  if (cells.length === 0) return null;
  const idx = Math.min(cells.length - 1, Math.floor(rand() * cells.length));
  return cells[idx]!;
};

export const levelForOrbs = (orbs: number): number => 1 + Math.floor(orbs / ORBS_PER_LEVEL);

// --- Hazards (C.2) --------------------------------------------------------------
// The board gains variety as the Coil levels up: lethal internal WALLS and
// non-lethal SLOW tiles. All placement is pure (a `rand` is injected) and avoids
// the Coil, the orb and the cells just ahead of the head, so a fresh hazard can
// never spawn an unavoidable trap. Below HAZARD_FROM_LEVEL the board is empty —
// so the early game plays exactly as before.

export const HAZARD_FROM_LEVEL = 3;
/** Cells ahead of the head kept hazard-free when (re)placing obstacles. */
export const HAZARD_SAFE_AHEAD = 4;
/** Multiplies the tick interval while the head sits on a slow tile (>1 = slower). */
export const SLOW_TILE_FACTOR = 1.7;
/** Steps a slow tile keeps the Coil sluggish after the head leaves it. */
export const SLOW_TILE_STEPS = 2;

/** Lethal internal walls at a given level (none before HAZARD_FROM_LEVEL). */
export const wallCountForLevel = (level: number): number =>
  level < HAZARD_FROM_LEVEL ? 0 : Math.min(2 + (level - HAZARD_FROM_LEVEL), 8);

/** Non-lethal slow tiles at a given level. */
export const slowCountForLevel = (level: number): number =>
  level < HAZARD_FROM_LEVEL ? 0 : Math.min(1 + Math.floor((level - HAZARD_FROM_LEVEL) / 2), 4);

/** The cells the head would sweep over the next `n` steps going straight — kept
 *  clear so newly placed hazards never land right in the Coil's path. */
export const safetyZone = (head: Vec, dir: Dir, n: number): Vec[] => {
  const cells: Vec[] = [];
  let p = head;
  for (let i = 0; i < n; i += 1) {
    p = stepHead(p, dir);
    cells.push(p);
  }
  return cells;
};

/** Pick `count` distinct free cells (not in `blocked`) for hazards. Pure. */
export const placeHazards = (
  count: number,
  blocked: Vec[],
  rand: () => number,
  cols = COLS,
  rows = ROWS,
): Vec[] => {
  const cells = freeCells(blocked, cols, rows);
  const picked: Vec[] = [];
  for (let i = 0; i < count && cells.length > 0; i += 1) {
    const idx = Math.min(cells.length - 1, Math.floor(rand() * cells.length));
    picked.push(cells[idx]!);
    cells.splice(idx, 1);
  }
  return picked;
};

/** Grid tick (seconds per cell). Faster each level, floored so it stays fair. */
export const tickInterval = (level: number): number =>
  Math.max(0.16 - (level - 1) * 0.012, 0.06);

/** Points for eating an orb. Combos and surge both reward aggressive play. */
export const orbScore = (kind: OrbKind, level: number, combo: number, surge: boolean): number => {
  const base = kind === 'prism' ? 50 : 10;
  const mult = surge ? 2 : 1;
  return (base + combo * 5) * level * mult;
};

/** Growth (in segments) from eating an orb. */
export const orbGrowth = (kind: OrbKind): number => (kind === 'prism' ? 2 : 1);

/** The Coil starts low-center, stacked vertically, heading up. */
export const initialSnake = (cols = COLS, rows = ROWS): Vec[] => {
  const cx = Math.floor(cols / 2);
  const baseY = Math.floor(rows * 0.7);
  return Array.from({ length: START_LENGTH }, (_, i) => ({ x: cx, y: baseY + i }));
};
