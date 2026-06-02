// Pure logic for Star Defender. No canvas, no timing — fully unit-tested.
//
// Star Defender is an original fixed shooter: a grid of alien "wraiths" sweeps
// side to side and steps downward, firing back, while the defender ship at the
// bottom moves and auto-fires upward. Clear a wave to face a faster, denser one
// (endless). Destroying wraiths charges the Nova — a screen-sweeping beam worth
// double points. The formation's movement, wave scaling and scoring are pure
// functions here; the game class owns entities, rendering, audio and timing.

import { clamp } from '@/engine';

/** Virtual playfield. Logic runs in these units; the renderer scales to fit. */
export const FIELD_W = 100;
export const FIELD_H = 178;

// The defender ship.
export const PLAYER_Y = 164;
export const PLAYER_HW = 5;
export const PLAYER_HH = 4;
export const PLAYER_SPEED = 72; // units/s sideways
export const START_LIVES = 3;
export const RESPAWN_INVULN = 1.6; // seconds of i-frames after a hit

// Wraith (enemy) grid.
export const COLS = 7;
export const BASE_ROWS = 3;
export const MAX_ROWS = 5;
export const EN_HW = 3.6;
export const EN_HH = 3;
export const SPACING_X = 12;
export const SPACING_Y = 11;
export const FORMATION_TOP = 22; // y of the top row before any descent
export const FORMATION_MARGIN = 4; // keep this clear of the side walls
export const DROP_STEP = 7; // how far the formation drops on each edge bounce
export const DANGER_Y = 150; // a wraith reaching this line = invasion (game over)

// Projectiles.
export const BULLET_SPEED = 160;
export const ENEMY_BULLET_SPEED = 64;
export const FIRE_INTERVAL = 0.3; // auto-fire cadence (seconds)

// Charge / Nova — the signature mechanic.
export const CHARGE_MAX = 100;
export const CHARGE_PER_KILL = 9;
export const NOVA_DURATION = 4;
export const NOVA_FIRE_INTERVAL = 0.07;

/** Rows in the formation for a given wave (grows, then caps). */
export const rowsForWave = (wave: number): number =>
  Math.min(BASE_ROWS + Math.floor((wave - 1) / 2), MAX_ROWS);

/** Horizontal sweep speed (units/s) for a wave — escalates with a cap. */
export const formationSpeed = (wave: number): number =>
  Math.min(14 + (wave - 1) * 3, 46);

/** Seconds between enemy shots — falls (more fire) with the wave, with a floor. */
export const enemyFireInterval = (wave: number): number =>
  Math.max(0.3, 1.0 - (wave - 1) * 0.1);

/** Home x of a formation column (0-based), centred on the field. */
export const homeX = (col: number): number => {
  const totalW = (COLS - 1) * SPACING_X;
  return (FIELD_W - totalW) / 2 + col * SPACING_X;
};

/** Home y of a formation row (0-based), before descent. */
export const homeY = (row: number): number => FORMATION_TOP + row * SPACING_Y;

/** Points for a wraith on a given row — top rows are worth more. */
export const rowPoints = (row: number, rows: number): number => (rows - row) * 10;

/** At a side wall the whole formation reverses and drops one step. Pure so the
 *  bounce is deterministic and testable. */
export const reverseIfEdge = (
  leftEdge: number,
  rightEdge: number,
  dir: number,
  margin = FORMATION_MARGIN,
  fieldW = FIELD_W,
): { dir: number; drop: boolean } => {
  if (dir > 0 && rightEdge >= fieldW - margin) return { dir: -1, drop: true };
  if (dir < 0 && leftEdge <= margin) return { dir: 1, drop: true };
  return { dir, drop: false };
};

/** Keep the formation's group offset so neither edge clips outside the walls. */
export const clampOffsetX = (
  offsetX: number,
  minHomeX: number,
  maxHomeX: number,
  margin = FORMATION_MARGIN,
  fieldW = FIELD_W,
): number => {
  const lo = margin + EN_HW - minHomeX;
  const hi = fieldW - margin - EN_HW - maxHomeX;
  return clamp(offsetX, lo, hi);
};

export const invaded = (maxEnemyY: number, dangerY = DANGER_Y): boolean =>
  maxEnemyY >= dangerY;

/** Axis-aligned box overlap (used for all projectile/ship hits). */
export const aabbHit = (
  ax: number,
  ay: number,
  ahw: number,
  ahh: number,
  bx: number,
  by: number,
  bhw: number,
  bhh: number,
): boolean =>
  Math.abs(ax - bx) <= ahw + bhw && Math.abs(ay - by) <= ahh + bhh;
