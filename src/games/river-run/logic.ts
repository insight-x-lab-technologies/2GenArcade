// Pure logic for River Run. No canvas, no timing — fully unit-tested.
//
// River Run is an original vertical scrolling shooter: pilot a light-skimmer up
// a meandering neon canyon-river that narrows as you go. Auto-fire clears enemy
// drones; fuel cells keep you alive; an optional throttle (boost/brake) trades
// safety for speed and score. The canyon walls are a *pure function* of world
// position (no stored level data), which keeps generation deterministic and
// trivially testable. The game class owns entities, rendering, audio and timing.

import { clamp } from '@/engine';

/** Virtual playfield. Logic runs in these units; the renderer scales to fit. */
export const FIELD_W = 100;
export const FIELD_H = 178;
export const PLAYER_Y = 150;
export const PLAYER_R = 3.2;

// Canyon shape.
export const HW_MAX = 40; // half-width at the start (wide)
export const HW_MIN = 17; // narrowest the channel ever gets
export const NARROW_RATE = 0.005; // half-width lost per world unit
export const AMP_MAX = 26; // max meander amplitude
export const MEANDER_FREQ = 0.018;

// Speed / throttle (units per second). throttle ∈ {-1 brake, 0 cruise, +1 boost}.
export const BASE_SPEED = 34;
export const SPEED_RAMP = 0.0008;
export const SPEED_RAMP_CAP = 20;
export const THROTTLE_DELTA = 16;
export const MIN_SPEED = 22;
export const MAX_SPEED = 80;

// Fuel.
export const FUEL_MAX = 100;
export const FUEL_DRAIN = 4.5; // per second at cruise
export const FUEL_BOOST_MULT = 1.7;
export const FUEL_REFILL = 34;

// Scoring.
export const SCORE_PER_UNIT = 1; // distance → score
export const KILL_BONUS = 120;
export const FUEL_BONUS = 60;

export interface Channel {
  center: number;
  half: number;
}

/** The canyon at a given world position — a pure function, so walls need no
 *  stored level data and generation is deterministic. */
export const channelAt = (worldY: number): Channel => {
  const half = Math.max(HW_MIN, HW_MAX - NARROW_RATE * worldY);
  const amp = Math.min(AMP_MAX, Math.max(0, worldY) * 0.004);
  const raw = 50 + amp * Math.sin(worldY * MEANDER_FREQ);
  const margin = 2;
  const center = clamp(raw, half + margin, FIELD_W - half - margin);
  return { center, half };
};

/** World position of a given on-screen y (top of screen is further upriver). */
export const worldYAt = (distance: number, screenY: number): number =>
  distance + (FIELD_H - screenY);

/** Is x inside the channel walls (accounting for a body radius)? */
export const insideChannel = (x: number, ch: Channel, radius = 0): boolean =>
  x >= ch.center - ch.half + radius && x <= ch.center + ch.half - radius;

export const speedFor = (throttle: number, distance: number): number => {
  const base = BASE_SPEED + Math.min(distance * SPEED_RAMP, SPEED_RAMP_CAP);
  return clamp(base + throttle * THROTTLE_DELTA, MIN_SPEED, MAX_SPEED);
};

export const fuelDrain = (boosting: boolean): number =>
  FUEL_DRAIN * (boosting ? FUEL_BOOST_MULT : 1);

/** Seconds between enemy spawns — falls (more enemies) as you travel. */
export const enemySpawnInterval = (distance: number): number =>
  Math.max(0.5, 1.6 - distance * 0.00012);

/** Circle/circle overlap (used for all entity hits). */
export const circleHit = (
  ax: number,
  ay: number,
  ar: number,
  bx: number,
  by: number,
  br: number,
): boolean => {
  const dx = ax - bx;
  const dy = ay - by;
  const rr = ar + br;
  return dx * dx + dy * dy <= rr * rr;
};

export const scoreFromDistance = (distance: number, bonus: number): number =>
  Math.floor(distance * SCORE_PER_UNIT) + bonus;
