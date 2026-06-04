// Pure logic for River Run. No canvas, no timing — fully unit-tested.
//
// River Run is an original vertical scrolling shooter: pilot a light-skimmer up
// a meandering neon canyon-river that narrows as you go. Auto-fire clears varied
// enemy craft (small fast scouts up to huge gunships that shoot back); big
// destructible fuel tanks keep you flying; temporary power-ups add firepower and
// tricks; an optional throttle (boost/brake) trades safety for speed and score.
// The canyon, biome schedule and day/night cycle are pure functions of world
// position (no stored level data), keeping generation deterministic and testable.
// The game class owns entities, rendering, audio and timing.

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
// Starts faster than before — the old base of 34 was too easy.
export const BASE_SPEED = 50;
export const SPEED_RAMP = 0.001;
export const SPEED_RAMP_CAP = 28;
export const THROTTLE_DELTA = 18;
export const MIN_SPEED = 30;
export const MAX_SPEED = 112;
export const SUPERSPEED_BONUS = 28;

// Fuel — a bigger reserve, but it drains faster and tanks are now destructible.
export const FUEL_MAX = 120;
export const FUEL_DRAIN = 5.5; // per second at cruise
export const FUEL_BOOST_MULT = 1.7;
export const FUEL_REGEN = 16; // per second while the Regen power-up is active
export const TANK_R = 6; // big destructible fuel tank
export const TANK_HP = 8;
export const TANK_REFILL_RATE = 85; // fuel per second while flying over a tank

// Scoring.
export const SCORE_PER_UNIT = 1; // distance → score
export const FUEL_BONUS = 40; // for emptying (fully using) a tank

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
  Math.max(0.42, 1.3 - distance * 0.00014);

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
  Math.floor(distance * SCORE_PER_UNIT + bonus);

// --- Biomes (scenery that changes as you progress) -----------------------------

export type BiomeId = 'city' | 'forest' | 'mountains' | 'ocean' | 'space';

export const BIOME_SEGMENT = 1100; // world units per biome

/** Deterministic biome schedule (opens in the city). */
export const biomeForSegment = (index: number): BiomeId => {
  const order: BiomeId[] = ['city', 'forest', 'mountains', 'ocean', 'space'];
  return order[((index % order.length) + order.length) % order.length]!;
};

export const biomeAt = (distance: number): { id: BiomeId; index: number; t: number } => {
  const index = Math.floor(Math.max(0, distance) / BIOME_SEGMENT);
  const t = (Math.max(0, distance) % BIOME_SEGMENT) / BIOME_SEGMENT;
  return { id: biomeForSegment(index), index, t };
};

// --- Time of day ---------------------------------------------------------------

export type DayPhase = 'day' | 'afternoon' | 'night';

export const DAY_LEG = 2400; // world units for one leg (day→night or night→day)

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

// --- Enemies -------------------------------------------------------------------

export type EnemyKind = 'scout' | 'drone' | 'gunship' | 'cruiser' | 'dread';

export interface EnemySpec {
  kind: EnemyKind;
  r: number;
  hp: number;
  points: number;
  /** Multiplies the descent speed (big ships are slower). */
  speedMul: number;
  /** Fires back at the player. */
  shoots: boolean;
  /** Counts as a "big" ship (glows when damaged, worth a big-kill trophy). */
  big: boolean;
  /** Only appears once you've travelled this far (shooters/heavies come later). */
  minDistance: number;
  weight: number;
}

export const ENEMIES: Record<EnemyKind, EnemySpec> = {
  scout: { kind: 'scout', r: 2.6, hp: 1, points: 80, speedMul: 1.5, shoots: false, big: false, minDistance: 0, weight: 0.3 },
  drone: { kind: 'drone', r: 3.2, hp: 1, points: 120, speedMul: 1.0, shoots: false, big: false, minDistance: 0, weight: 0.34 },
  gunship: { kind: 'gunship', r: 3.9, hp: 2, points: 220, speedMul: 0.9, shoots: true, big: false, minDistance: 500, weight: 0.2 },
  cruiser: { kind: 'cruiser', r: 5.2, hp: 4, points: 420, speedMul: 0.72, shoots: true, big: true, minDistance: 1400, weight: 0.12 },
  dread: { kind: 'dread', r: 6.6, hp: 7, points: 860, speedMul: 0.55, shoots: true, big: true, minDistance: 3000, weight: 0.06 },
};

export const ENEMY_KINDS: EnemyKind[] = ['scout', 'drone', 'gunship', 'cruiser', 'dread'];

/** Weighted pick among the kinds unlocked at this distance. Pure for tests. */
export const pickEnemyKind = (distance: number, rand: number): EnemyKind => {
  const eligible = ENEMY_KINDS.filter((k) => distance >= ENEMIES[k].minDistance);
  const total = eligible.reduce((s, k) => s + ENEMIES[k].weight, 0);
  let acc = 0;
  const r = clamp(rand, 0, 0.999999) * total;
  for (const k of eligible) {
    acc += ENEMIES[k].weight;
    if (r < acc) return k;
  }
  return 'drone';
};

// --- Power-ups -----------------------------------------------------------------

export type PowerKind =
  | 'shield'
  | 'superSpeed'
  | 'doubleShot'
  | 'tripleShot'
  | 'rapidFire'
  | 'piercing'
  | 'magnet'
  | 'slowmo'
  | 'scoreX2'
  | 'regen'
  // Instant pickup (not a timed buff): refills missile ammo. Spawned through its
  // own channel, so it stays OUT of POWER_KINDS / the random buff pool.
  | 'warhead';

export interface PowerSpec {
  kind: PowerKind;
  duration: number;
  color: string;
  letter: string;
  trophyId: string;
}

export const POWERS: Record<PowerKind, PowerSpec> = {
  shield: { kind: 'shield', duration: 6, color: '#7ea6ff', letter: 'I', trophyId: 'ironclad' },
  superSpeed: { kind: 'superSpeed', duration: 5, color: '#ff7a45', letter: 'V', trophyId: 'lightspeed' },
  doubleShot: { kind: 'doubleShot', duration: 8, color: '#46d4c4', letter: '2', trophyId: 'twinGuns' },
  tripleShot: { kind: 'tripleShot', duration: 8, color: '#9be15d', letter: '3', trophyId: 'trident' },
  rapidFire: { kind: 'rapidFire', duration: 7, color: '#ffd27a', letter: 'R', trophyId: 'stormFire' },
  piercing: { kind: 'piercing', duration: 8, color: '#ff5d73', letter: 'P', trophyId: 'railgun' },
  magnet: { kind: 'magnet', duration: 9, color: '#b06cff', letter: 'M', trophyId: 'tractor' },
  slowmo: { kind: 'slowmo', duration: 5, color: '#5ec8d8', letter: 'L', trophyId: 'bulletTime' },
  scoreX2: { kind: 'scoreX2', duration: 9, color: '#ffe06a', letter: 'X', trophyId: 'jackpot' },
  regen: { kind: 'regen', duration: 7, color: '#46d49a', letter: 'F', trophyId: 'recycler' },
  warhead: { kind: 'warhead', duration: 0, color: '#ff9d5d', letter: 'W', trophyId: 'warmonger' },
};

export const POWER_KINDS: PowerKind[] = [
  'shield',
  'superSpeed',
  'doubleShot',
  'tripleShot',
  'rapidFire',
  'piercing',
  'magnet',
  'slowmo',
  'scoreX2',
  'regen',
];

export const SLOWMO_FACTOR = 0.5; // enemies/bullets approach this much slower
export const MAGNET_PULL = 46; // units/s pickups drift toward the player
export const POWERUP_R = 3.2;

/** Uniform pick of a power-up from a [0,1) random. Pure for testability. */
export const pickPowerKind = (rand: number): PowerKind =>
  POWER_KINDS[
    Math.min(POWER_KINDS.length - 1, Math.floor(clamp(rand, 0, 0.999999) * POWER_KINDS.length))
  ]!;
