// Pure logic for Road Burner. No canvas, no timing — fully unit-tested.
//
// Road Burner is an original lane-based racing/dodge game: you pilot a burner
// up a gently curving multi-lane highway, weaving through slower traffic. There
// is no shooting — the loop is risk-driven overtaking. Passing a car *close*
// (a near-miss) charges the Burn gauge; when it fills, Nitro auto-ignites for a
// few seconds of double score, extra speed and phase-through. Crashing into
// traffic or the guardrails ends the run. The road (centre + lanes) is a pure
// function of world position, so generation is deterministic and testable; the
// game class owns entities, rendering, audio and timing.

import { clamp } from '@/engine';

/** Virtual playfield. Logic runs in these units; the renderer scales to fit. */
export const FIELD_W = 100;
export const FIELD_H = 178;
export const PLAYER_Y = 150;

// The burner (player car) half-extents.
export const CAR_HW = 4.2;
export const CAR_HH = 7;

// Road geometry. Unlike River Run's narrowing canyon, the highway keeps a
// constant width and instead *curves* — difficulty comes from speed + traffic.
export const ROAD_HALF = 34;
export const ROAD_MARGIN = 1.5;
export const AMP_MAX = 12;
export const MEANDER_FREQ = 0.016;
export const NUM_LANES = 4;

// Speed / throttle (units per second). throttle ∈ {-1 brake, 0 cruise, +1 gas}.
export const BASE_SPEED = 40;
export const SPEED_RAMP = 0.0009;
export const SPEED_RAMP_CAP = 26;
export const THROTTLE_DELTA = 18;
export const MIN_SPEED = 26;
export const MAX_SPEED = 96;
export const NITRO_SPEED_BONUS = 22;

// Traffic moves forward too, just slower; we store each car's own world speed so
// the player overtakes it. Relative descent on screen = playerSpeed - carSpeed.
export const TRAFFIC_MIN_SPEED = 12;
export const TRAFFIC_MAX_SPEED = 30;

// Burn / Nitro — the signature risk/reward mechanic.
export const BURN_MAX = 100;
export const BURN_PER_PASS = 20; // a near-miss overtake adds this much
export const NITRO_DURATION = 3.6; // seconds
export const NEARMISS_GAP = 16; // |dx| under this (but not a crash) = near-miss

// Scoring.
export const SCORE_PER_UNIT = 1;
export const PASS_BONUS = 40;

export interface Road {
  center: number;
  half: number;
}

/** The road at a given world position — a pure function, so the highway needs
 *  no stored level data and generation is deterministic. */
export const roadAt = (worldY: number): Road => {
  const half = ROAD_HALF;
  const amp = Math.min(AMP_MAX, Math.max(0, worldY) * 0.004);
  const raw = 50 + amp * Math.sin(worldY * MEANDER_FREQ);
  const center = clamp(raw, half + ROAD_MARGIN, FIELD_W - half - ROAD_MARGIN);
  return { center, half };
};

/** World position of a given on-screen y (top of screen is further up-road). */
export const worldYAt = (distance: number, screenY: number): number =>
  distance + (FIELD_H - screenY);

/** Centre x of lane `i` (0-based) for a given road slice. */
export const laneCenter = (road: Road, lane: number, lanes = NUM_LANES): number => {
  const laneW = (road.half * 2) / lanes;
  return road.center - road.half + laneW * (lane + 0.5);
};

/** Is the car (centre x, half-width hw) fully on the tarmac? */
export const onRoad = (x: number, road: Road, hw = CAR_HW): boolean =>
  x - hw >= road.center - road.half && x + hw <= road.center + road.half;

export const speedFor = (throttle: number, distance: number): number => {
  const base = BASE_SPEED + Math.min(distance * SPEED_RAMP, SPEED_RAMP_CAP);
  return clamp(base + throttle * THROTTLE_DELTA, MIN_SPEED, MAX_SPEED);
};

/** Seconds between traffic spawns — falls (denser traffic) as you travel. */
export const trafficSpawnInterval = (distance: number): number =>
  Math.max(0.55, 1.5 - distance * 0.0001);

/** Axis-aligned box overlap (cars are rectangles). */
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

/** A near-miss is a side-by-side pass that's close but not a crash. */
export const isNearMiss = (dx: number, crashGap: number): boolean => {
  const g = Math.abs(dx);
  return g > crashGap && g <= NEARMISS_GAP;
};

export const scoreFromDistance = (distance: number, bonus: number): number =>
  Math.floor(distance * SCORE_PER_UNIT + bonus);
