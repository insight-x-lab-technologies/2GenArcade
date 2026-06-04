// Pure logic for Brick Bounce. No canvas, no timing — fully unit-tested.
//
// Brick Bounce is an original breakout-inspired game: a paddle at the bottom
// keeps a glowing ball alive, chipping away at a wall of neon bricks. Clearing a
// wall advances to a faster, tougher one (endless). Breaking bricks fills the
// Blaze meter; when full it auto-ignites a Blaze Ball that pierces bricks and
// scores double for a few seconds. Bricks may drop temporary power-ups. The
// geometry, scaling and scoring are pure functions here; the game class owns the
// entities, rendering, audio and timing.

import { clamp } from '@/engine';

/** Virtual playfield. Logic runs in these units; the renderer scales to fit. */
export const FIELD_W = 100;
export const FIELD_H = 156;
/** Inset of the play area from the canvas edge (the glowing frame). */
export const WALL = 2;

// The paddle.
export const PADDLE_Y = 146;
export const PADDLE_HH = 1.8;
export const PADDLE_HW_BASE = 9;
export const PADDLE_HW_WIDE = 14;
export const PADDLE_SPEED = 104; // units/s sideways
/** Steepest launch angle off the paddle edge, measured from straight up. */
export const MAX_BOUNCE = Math.PI * 0.37;

// The ball.
export const BALL_R = 1.7;
export const BALL_SPEED_BASE = 60;
export const BALL_SPEED_PER_LEVEL = 4;
export const BALL_SPEED_MAX = 112;
export const SLOW_FACTOR = 0.62; // SlowFlux power-up multiplier
export const BLAZE_SPEED_BONUS = 10; // Blaze Ball is a touch faster

// Bricks.
export const BRICK_COLS = 9;
export const BRICK_TOP = 18;
export const BRICK_H = 5;
export const BRICK_GAP = 0.7;
export const ROWS_BASE = 4;
export const ROWS_MAX = 8;
export const BRICK_HP_MAX = 5;

// Lives & Blaze meter.
export const START_LIVES = 3;
export const BLAZE_MAX = 100;
export const BLAZE_PER_HIT = 4;
export const BLAZE_DROP_ON_MISS = 35; // meter lost when a life is lost
export const BLAZE_DURATION = 5.5;

// Power-ups.
export const POWERUP_R = 3;
export const POWERUP_FALL = 34; // units/s
export const DROP_CHANCE = 0.16; // per destroyed brick
export const BOLT_SPEED = 120; // Cannon bolts

/** Ball speed for a level — escalates, then caps. */
export const levelBallSpeed = (level: number): number =>
  Math.min(BALL_SPEED_BASE + (level - 1) * BALL_SPEED_PER_LEVEL, BALL_SPEED_MAX);

/** Brick rows for a level — grows every other level, then caps. */
export const rowsForLevel = (level: number): number =>
  Math.min(ROWS_BASE + Math.floor((level - 1) / 2), ROWS_MAX);

/** Hit points for a brick: top rows are tougher, and walls harden with level. */
export const brickHp = (row: number, rows: number, level: number): number => {
  const tough = Math.floor((level - 1) / 2); // +1 every two levels
  const topBonus = row < Math.ceil(rows * 0.3) ? 1 : 0; // sturdier back rows
  return clamp(1 + tough + topBonus, 1, BRICK_HP_MAX);
};

/** Points awarded for destroying a brick of the given (starting) hp. */
export const brickPoints = (hp: number): number => hp * 25;

/** Usable inner width for the brick field (between the side walls). */
export const fieldInnerW = (): number => FIELD_W - WALL * 2;

/** Width of a single brick cell, gaps included on both sides. */
export const brickCellW = (): number => fieldInnerW() / BRICK_COLS;

/** Centre x of a brick column (0-based). */
export const brickCenterX = (col: number): number =>
  WALL + brickCellW() * (col + 0.5);

/** Centre y of a brick row (0-based). */
export const brickCenterY = (row: number): number =>
  BRICK_TOP + BRICK_H * (row + 0.5) + BRICK_GAP * row;

/** Half-extents of a brick's solid body (gap trimmed off). */
export const brickHalfW = (): number => brickCellW() / 2 - BRICK_GAP / 2;
export const brickHalfH = (): number => BRICK_H / 2;

/**
 * Reflect a ball's velocity off the paddle. `rel` is the contact offset on the
 * paddle in [-1, 1] (negative = left of centre). The outgoing direction sweeps
 * from -MAX_BOUNCE to +MAX_BOUNCE around straight up, so the player aims by
 * where the ball lands on the paddle. Pure and deterministic.
 */
export const paddleBounce = (
  rel: number,
  speed: number,
  maxAngle = MAX_BOUNCE,
): { vx: number; vy: number } => {
  const a = clamp(rel, -1, 1) * maxAngle;
  return { vx: speed * Math.sin(a), vy: -speed * Math.abs(Math.cos(a)) };
};

/**
 * Decide which axes a ball should flip when overlapping a brick AABB. Returns
 * the shallower-penetration axis (so a ball hitting a face reflects on that
 * face, and a near-corner hit can flip both). Pure → testable.
 */
export const brickReflection = (
  cx: number,
  cy: number,
  r: number,
  rx: number,
  ry: number,
  rhw: number,
  rhh: number,
): { hit: boolean; flipX: boolean; flipY: boolean } => {
  const dx = cx - rx;
  const dy = cy - ry;
  const overlapX = rhw + r - Math.abs(dx);
  const overlapY = rhh + r - Math.abs(dy);
  if (overlapX <= 0 || overlapY <= 0) return { hit: false, flipX: false, flipY: false };
  // Flip the axis with the smaller penetration; near-equal → flip both (corner).
  const corner = Math.abs(overlapX - overlapY) < r * 0.5;
  if (corner) return { hit: true, flipX: true, flipY: true };
  if (overlapX < overlapY) return { hit: true, flipX: true, flipY: false };
  return { hit: true, flipX: false, flipY: true };
};

/** Circle vs AABB overlap test (ball vs paddle / shield). */
export const circleRectHit = (
  cx: number,
  cy: number,
  r: number,
  rx: number,
  ry: number,
  rhw: number,
  rhh: number,
): boolean => {
  const nx = clamp(cx, rx - rhw, rx + rhw);
  const ny = clamp(cy, ry - rhh, ry + rhh);
  const ddx = cx - nx;
  const ddy = cy - ny;
  return ddx * ddx + ddy * ddy <= r * r;
};

/** Temporary power-ups dropped by bricks. */
export type PowerKind =
  | 'widen' // wider paddle
  | 'multi' // split every ball into three
  | 'slow' // slow the balls down
  | 'catch' // sticky paddle: the ball clings, relaunch with up
  | 'cannon' // paddle fires bolts upward
  | 'shield' // a temporary floor barrier that saves the ball
  | 'bonus'; // instant points

export interface PowerSpec {
  /** Effect length in seconds. 0 = instant. */
  duration: number;
  color: string;
  letter: string;
  /** Relative drop weight. */
  weight: number;
}

export const POWERS: Record<PowerKind, PowerSpec> = {
  widen: { duration: 13, color: '#46d4c4', letter: 'W', weight: 5 },
  multi: { duration: 0, color: '#ffd27a', letter: 'M', weight: 4 },
  slow: { duration: 8, color: '#7ea6ff', letter: 'S', weight: 4 },
  catch: { duration: 12, color: '#b06cff', letter: 'C', weight: 3 },
  cannon: { duration: 9, color: '#ff7a5d', letter: 'L', weight: 3 },
  shield: { duration: 11, color: '#9dffb0', letter: 'B', weight: 3 },
  bonus: { duration: 0, color: '#ffe46c', letter: '+', weight: 4 },
};

export const POWER_KINDS = Object.keys(POWERS) as PowerKind[];

/** Pick a power-up kind by weight. `rand` ∈ [0, 1). Pure. */
export const pickPowerKind = (rand: number): PowerKind => {
  const total = POWER_KINDS.reduce((s, k) => s + POWERS[k].weight, 0);
  let r = clamp(rand, 0, 0.999999) * total;
  for (const k of POWER_KINDS) {
    r -= POWERS[k].weight;
    if (r < 0) return k;
  }
  return 'bonus';
};

/** Axis-aligned box overlap (used for bolts vs bricks). */
export const aabbHit = (
  ax: number,
  ay: number,
  ahw: number,
  ahh: number,
  bx: number,
  by: number,
  bhw: number,
  bhh: number,
): boolean => Math.abs(ax - bx) <= ahw + bhw && Math.abs(ay - by) <= ahh + bhh;
