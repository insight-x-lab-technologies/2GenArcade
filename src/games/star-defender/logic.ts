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

// --- Power-ups (drop from destroyed wraiths / bosses) --------------------------

export type PowerKind = 'shield' | 'rapid' | 'twin' | 'spread' | 'slow' | 'life';

export interface PowerSpec {
  kind: PowerKind;
  /** Seconds the buff lasts; 0 = instant (life). */
  duration: number;
  color: string;
  letter: string;
}

export const POWERS: Record<PowerKind, PowerSpec> = {
  shield: { kind: 'shield', duration: 6, color: '#7ea6ff', letter: 'I' },
  rapid: { kind: 'rapid', duration: 7, color: '#ffd27a', letter: 'R' },
  twin: { kind: 'twin', duration: 8, color: '#46d4c4', letter: '2' },
  spread: { kind: 'spread', duration: 8, color: '#9be15d', letter: 'W' },
  slow: { kind: 'slow', duration: 5, color: '#5ec8d8', letter: 'L' },
  life: { kind: 'life', duration: 0, color: '#ff5d73', letter: '+' },
};

export const POWER_KINDS: PowerKind[] = ['shield', 'rapid', 'twin', 'spread', 'slow', 'life'];

/** Uniform pick of a power-up from a [0,1) random. Pure for testability. */
export const pickPowerKind = (rand: number): PowerKind =>
  POWER_KINDS[
    Math.min(POWER_KINDS.length - 1, Math.floor(clamp(rand, 0, 0.999999) * POWER_KINDS.length))
  ]!;

export const POWERUP_HW = 3;
export const POWERUP_HH = 3;
export const POWERUP_FALL = 42; // units/s the pickup drifts down
export const DROP_CHANCE = 0.1; // chance a destroyed wraith drops a pickup
export const RAPID_FIRE_INTERVAL = 0.13; // fire cadence while Rapid is active
export const SLOW_FACTOR = 0.5; // enemy speed/fire multiplier while Slow is active
export const MAX_LIVES = 5;

// --- Bosses (a guardian appears every Nth wave) --------------------------------

export const BOSS_EVERY = 4; // a boss wave every N waves
export const BOSS_Y = 30;
export const BOSS_HW = 12;
export const BOSS_HH = 7;
export const BOSS_SPEED = 24; // units/s sideways
export const BOSS_BULLET_SPEED = 60;

/** Which boss number (1-based) a wave is, or 0 if it is a normal wave. */
export const bossIndex = (wave: number): number => (wave % BOSS_EVERY === 0 ? wave / BOSS_EVERY : 0);
export const isBossWave = (wave: number): boolean => bossIndex(wave) > 0;
export const bossHp = (wave: number): number => 36 + Math.max(0, bossIndex(wave) - 1) * 28;
export const bossPoints = (wave: number): number => 500 + Math.max(0, bossIndex(wave) - 1) * 250;
export const bossFireInterval = (wave: number): number =>
  Math.max(0.65, 1.5 - Math.max(0, bossIndex(wave) - 1) * 0.16);

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
