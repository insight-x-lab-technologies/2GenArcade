// Pure logic for Road Burner. No canvas, no timing — fully unit-tested.
//
// Road Burner is an original lane-based racing/dodge game: you pilot a burner up
// a gently curving multi-lane highway, weaving through slower traffic of varied
// vehicles (bikes, cars, trucks, rigs). Passing a vehicle *close* (a near-miss)
// charges the Burn gauge; when it fills, Nitro auto-ignites for a few seconds of
// extra speed, multiplied score and phase-through. The road cycles through
// terrains (asphalt, rain, mud, snow) that change speed and grip, and through a
// day → afternoon → night cycle. Temporary power-ups add dynamism. Crashing into
// traffic ends the run. The road, terrain schedule and day cycle are pure
// functions of world position, so generation is deterministic and testable; the
// game class owns entities, rendering, audio and timing.

import { clamp } from '@/engine';

/** Virtual playfield. Logic runs in these units; the renderer scales to fit. */
export const FIELD_W = 100;
export const FIELD_H = 178;
export const PLAYER_Y = 150;

// The burner (player car) half-extents.
export const CAR_HW = 4.2;
export const CAR_HH = 7;
export const MINI_SCALE = 0.62; // hitbox scale while the Mini power-up is active

// Road geometry. Unlike River Run's narrowing canyon, the highway keeps a
// constant width and instead *curves* — difficulty comes from speed + traffic.
export const ROAD_HALF = 34;
export const ROAD_MARGIN = 1.5;
export const AMP_MAX = 12;
export const MEANDER_FREQ = 0.016;
export const NUM_LANES = 4;

// Speed / throttle (units per second). throttle ∈ {-1 brake, 0 cruise, +1 gas}.
// Starts fast on purpose — the old 40 was too easy.
export const BASE_SPEED = 58;
export const SPEED_RAMP = 0.001;
export const SPEED_RAMP_CAP = 32;
export const THROTTLE_DELTA = 20;
export const MIN_SPEED = 34;
export const MAX_SPEED = 124;
export const NITRO_SPEED_BONUS = 24;
export const TURBO_SPEED_BONUS = 32;

// Sideways handling. The car has lateral inertia governed by grip; on slick
// terrain it slides, which is what makes mud/snow interesting.
export const STEER_TARGET = 88; // target lateral speed at full input

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
  Math.max(0.5, 1.35 - distance * 0.00012);

/** Axis-aligned box overlap (vehicles are rectangles). */
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

// --- Lateral grip --------------------------------------------------------------

/** Move the lateral velocity toward a target; higher grip converges faster, so
 *  low-grip terrain (mud/snow) keeps the car sliding. Pure & frame-rate aware. */
export const gripApproach = (vx: number, target: number, grip: number, dt: number): number => {
  const rate = clamp(grip * 16, 1, 16);
  const k = 1 - Math.exp(-rate * dt);
  return vx + (target - vx) * k;
};

// --- Terrains ------------------------------------------------------------------

export type TerrainId = 'asphalt' | 'rain' | 'mud' | 'snow';

export interface TerrainSpec {
  id: TerrainId;
  /** Multiplies the achievable speed (slick/soft ground is slower). */
  speedMul: number;
  /** 1 = razor handling, lower = slidey. */
  grip: number;
}

export const TERRAINS: Record<TerrainId, TerrainSpec> = {
  asphalt: { id: 'asphalt', speedMul: 1.0, grip: 1.0 },
  rain: { id: 'rain', speedMul: 0.92, grip: 0.66 },
  mud: { id: 'mud', speedMul: 0.82, grip: 0.48 },
  snow: { id: 'snow', speedMul: 0.74, grip: 0.38 },
};

export const SEGMENT_LEN = 850; // world units per terrain segment

/** Deterministic terrain schedule. The opening segment is always clean asphalt
 *  so the (already faster) start is fair. */
export const terrainForSegment = (index: number): TerrainId => {
  if (index <= 0) return 'asphalt';
  const order: TerrainId[] = ['asphalt', 'rain', 'mud', 'asphalt', 'snow', 'rain', 'mud', 'snow'];
  return order[index % order.length]!;
};

export const terrainAt = (distance: number): { id: TerrainId; index: number; t: number } => {
  const index = Math.floor(Math.max(0, distance) / SEGMENT_LEN);
  const t = (Math.max(0, distance) % SEGMENT_LEN) / SEGMENT_LEN;
  return { id: terrainForSegment(index), index, t };
};

// --- Time of day ---------------------------------------------------------------

export type DayPhase = 'day' | 'afternoon' | 'night';

export const DAY_LEG = 2600; // world units for one leg (day→night or night→day)

/** A smooth day → afternoon → night → afternoon → day cycle by distance.
 *  `darkness` ∈ [0,1] (0 = bright day, 1 = deep night). Starts at full day. */
export const timeOfDayAt = (distance: number): { phase: DayPhase; darkness: number } => {
  const cycle = (Math.max(0, distance) % (DAY_LEG * 2)) / (DAY_LEG * 2); // 0..1
  const darkness = 1 - Math.abs(1 - 2 * cycle); // triangle wave 0→1→0
  let phase: DayPhase = 'day';
  if (darkness >= 0.62) phase = 'night';
  else if (darkness >= 0.3) phase = 'afternoon';
  return { phase, darkness };
};

// --- Vehicles ------------------------------------------------------------------

export type VehicleKind = 'bike' | 'car' | 'truck' | 'rig';

export interface VehicleSpec {
  kind: VehicleKind;
  hw: number;
  hh: number;
  minSpeed: number;
  maxSpeed: number;
  weight: number; // spawn probability weight
}

export const VEHICLES: Record<VehicleKind, VehicleSpec> = {
  bike: { kind: 'bike', hw: 2.2, hh: 4.6, minSpeed: 24, maxSpeed: 36, weight: 0.22 },
  car: { kind: 'car', hw: 4.2, hh: 7, minSpeed: 16, maxSpeed: 30, weight: 0.44 },
  truck: { kind: 'truck', hw: 4.8, hh: 11, minSpeed: 12, maxSpeed: 20, weight: 0.2 },
  rig: { kind: 'rig', hw: 5.2, hh: 16, minSpeed: 9, maxSpeed: 16, weight: 0.14 },
};

export const VEHICLE_KINDS: VehicleKind[] = ['bike', 'car', 'truck', 'rig'];

export const isBigVehicle = (kind: VehicleKind): boolean => kind === 'truck' || kind === 'rig';

/** Weighted pick from a uniform [0,1) random. Pure for testability. */
export const pickVehicleKind = (rand: number): VehicleKind => {
  const total = VEHICLE_KINDS.reduce((s, k) => s + VEHICLES[k].weight, 0);
  let acc = 0;
  const r = clamp(rand, 0, 0.999999) * total;
  for (const k of VEHICLE_KINDS) {
    acc += VEHICLES[k].weight;
    if (r < acc) return k;
  }
  return 'car';
};

// --- Power-ups -----------------------------------------------------------------

export type PowerKind =
  | 'shield'
  | 'turbo'
  | 'slowmo'
  | 'double'
  | 'surge'
  | 'mini'
  | 'grip'
  | 'sweep';

export interface PowerSpec {
  kind: PowerKind;
  /** Effect duration in seconds (0 = instant, e.g. Sweep). */
  duration: number;
  color: string;
  /** Single-glyph badge drawn on the capsule and HUD chip. */
  letter: string;
  /** Trophy id awarded the first time this power-up is used. */
  trophyId: string;
}

export const POWERS: Record<PowerKind, PowerSpec> = {
  shield: { kind: 'shield', duration: 6, color: '#7ea6ff', letter: 'I', trophyId: 'shielded' },
  turbo: { kind: 'turbo', duration: 5, color: '#ff7a45', letter: 'V', trophyId: 'supersonic' },
  slowmo: { kind: 'slowmo', duration: 5, color: '#46d4c4', letter: 'L', trophyId: 'timebender' },
  double: { kind: 'double', duration: 8, color: '#ffd27a', letter: '2', trophyId: 'doubler' },
  surge: { kind: 'surge', duration: 5, color: '#b06cff', letter: 'B', trophyId: 'overcharged' },
  mini: { kind: 'mini', duration: 7, color: '#bfffe9', letter: 'M', trophyId: 'compact' },
  grip: { kind: 'grip', duration: 8, color: '#9be15d', letter: 'G', trophyId: 'gripmaster' },
  sweep: { kind: 'sweep', duration: 0, color: '#ff5d73', letter: 'X', trophyId: 'sweeper' },
};

export const POWER_KINDS: PowerKind[] = [
  'shield',
  'turbo',
  'slowmo',
  'double',
  'surge',
  'mini',
  'grip',
  'sweep',
];

export const SLOWMO_FACTOR = 0.55; // traffic approaches this much slower
export const SWEEP_SPAWN_PAUSE = 2.5; // seconds of clear road after a Sweep
export const POWERUP_HW = 3;
export const POWERUP_HH = 3;

/** Uniform pick of a power-up from a [0,1) random. Pure for testability. */
export const pickPowerKind = (rand: number): PowerKind =>
  POWER_KINDS[Math.min(POWER_KINDS.length - 1, Math.floor(clamp(rand, 0, 0.999999) * POWER_KINDS.length))]!;
