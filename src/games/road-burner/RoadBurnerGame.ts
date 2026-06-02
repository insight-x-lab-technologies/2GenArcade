import type { GameContext, GameModule, GameMeta } from '@/types';
import { clamp } from '@/engine';
import { roadBurnerMeta } from './meta';
import {
  aabbHit,
  BURN_MAX,
  BURN_PER_PASS,
  CAR_HH,
  CAR_HW,
  FIELD_H,
  FIELD_W,
  gripApproach,
  isBigVehicle,
  isNearMiss,
  laneCenter,
  MINI_SCALE,
  NITRO_DURATION,
  NITRO_SPEED_BONUS,
  NUM_LANES,
  PASS_BONUS,
  pickPowerKind,
  pickVehicleKind,
  PLAYER_Y,
  POWER_KINDS,
  POWERS,
  POWERUP_HH,
  POWERUP_HW,
  roadAt,
  scoreFromDistance,
  SLOWMO_FACTOR,
  speedFor,
  STEER_TARGET,
  SWEEP_SPAWN_PAUSE,
  type DayPhase,
  type PowerKind,
  type TerrainId,
  type VehicleKind,
  terrainAt,
  TERRAINS,
  timeOfDayAt,
  trafficSpawnInterval,
  TURBO_SPEED_BONUS,
  VEHICLES,
  worldYAt,
} from './logic';

const STRIPE_LEN = 9;
const STRIPE_GAP = 7;
const TRAFFIC_COLORS = ['#ff5d73', '#46d4c4', '#b06cff', '#ffd27a', '#7ea6ff', '#ff9d5d'];
const POWERUP_MIN_GAP = 6.5; // seconds between power-up spawns
const POWERUP_VAR = 5;

interface Vehicle {
  kind: VehicleKind;
  lane: number;
  y: number;
  prevY: number;
  worldSpeed: number;
  hw: number;
  hh: number;
  color: string;
  big: boolean;
  nearLogged: boolean;
}
interface PowerUp {
  kind: PowerKind;
  lane: number;
  y: number;
  prevY: number;
}
interface Spark {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  max: number;
  color: string;
}
interface Mote {
  x: number;
  y: number;
  speed: number;
  sway: number;
  len: number;
}

interface TerrainPalette {
  shoulder: [string, string];
  tar: [string, string];
  stripe: string;
  rails: [string, string];
}

const PALETTES: Record<TerrainId, TerrainPalette> = {
  asphalt: {
    shoulder: ['#10182a', '#161024'],
    tar: ['#1c1830', '#2a2440'],
    stripe: 'rgba(255,255,255,0.5)',
    rails: ['#ffb347', '#b06cff'],
  },
  rain: {
    shoulder: ['#0b1320', '#0a1822'],
    tar: ['#16202e', '#1d2a3a'],
    stripe: 'rgba(200,220,255,0.45)',
    rails: ['#5ec8d8', '#7ea6ff'],
  },
  mud: {
    shoulder: ['#241a10', '#2a1e12'],
    tar: ['#3a2a18', '#4a3420'],
    stripe: 'rgba(230,210,170,0.4)',
    rails: ['#caa15a', '#8a6a3a'],
  },
  snow: {
    shoulder: ['#c7d2e6', '#b4c0d6'],
    tar: ['#525c70', '#646e84'],
    stripe: 'rgba(255,255,255,0.85)',
    rails: ['#9fc0ff', '#dce6ff'],
  },
};

const POWER_TROPHY: Record<PowerKind, string> = {
  shield: 'shielded',
  turbo: 'supersonic',
  slowmo: 'timebender',
  double: 'doubler',
  surge: 'overcharged',
  mini: 'compact',
  grip: 'gripmaster',
  sweep: 'sweeper',
};
const TERRAIN_TROPHY: Partial<Record<TerrainId, string>> = {
  mud: 'mudder',
  snow: 'snowdrifter',
  rain: 'rainman',
};

const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;

const hexToRgb = (hex: string): [number, number, number] => {
  const h = hex.replace('#', '');
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
};

/** Mix a colour toward near-black by `k` (0..1) — used to dim cars at night. */
const darken = (hex: string, k: number): string => {
  const [r, g, b] = hexToRgb(hex);
  const f = 1 - clamp(k, 0, 1);
  return `rgb(${Math.round(r * f + 8 * (1 - f))},${Math.round(g * f + 6 * (1 - f))},${Math.round(
    b * f + 18 * (1 - f),
  )})`;
};

export class RoadBurnerGame implements GameModule {
  readonly meta: GameMeta = roadBurnerMeta;

  private ctx!: GameContext;
  private g!: CanvasRenderingContext2D;

  private px = FIELD_W / 2;
  private prevPx = FIELD_W / 2;
  private pvx = 0; // lateral velocity (grip/inertia)
  private distance = 0;
  private prevDistance = 0;

  private cars: Vehicle[] = [];
  private powerups: PowerUp[] = [];
  private sparks: Spark[] = [];
  private motes: Mote[] = [];

  private spawnTimer = 0.8;
  private powerTimer = 3;
  private spawnSuppress = 0;

  private burn = 0;
  private nitro = false;
  private nitroTime = 0;
  private fx: Record<PowerKind, number> = this.zeroFx();

  private score = 0;
  private bonus = 0;
  private passes = 0;
  private bigPasses = 0;
  private nitros = 0;
  private powerupsCollected = 0;
  private usedKinds = new Set<PowerKind>();
  private terrainsSeen = new Set<TerrainId>();
  private nightSeen = false;
  private awarded = new Set<string>();

  private terrainId: TerrainId = 'asphalt';
  private darkness = 0;
  private phase: DayPhase = 'day';

  private toast = '';
  private toastTime = 0;
  private toastColor = '#ffd27a';

  private emitTimer = 0;
  private lastEmitted = -1;
  private flash = 0;
  private flashColor = '#ff5d73';
  private shake = 0;
  private gameOver = false;

  private zeroFx(): Record<PowerKind, number> {
    return { shield: 0, turbo: 0, slowmo: 0, double: 0, surge: 0, mini: 0, grip: 0, sweep: 0 };
  }

  init(ctx: GameContext): void {
    this.ctx = ctx;
    const c2d = ctx.canvas.getContext('2d');
    if (!c2d) throw new Error('2D context unavailable');
    this.g = c2d;
    this.reset();
    ctx.audio.playMusic('gameplay');
    this.emitScore(true);
  }

  private reset(): void {
    this.px = FIELD_W / 2;
    this.prevPx = this.px;
    this.pvx = 0;
    this.distance = 0;
    this.prevDistance = 0;
    this.cars = [];
    this.powerups = [];
    this.sparks = [];
    this.spawnTimer = 0.8;
    this.powerTimer = 3;
    this.spawnSuppress = 0;
    this.burn = 0;
    this.nitro = false;
    this.nitroTime = 0;
    this.fx = this.zeroFx();
    this.score = 0;
    this.bonus = 0;
    this.passes = 0;
    this.bigPasses = 0;
    this.nitros = 0;
    this.powerupsCollected = 0;
    this.usedKinds = new Set();
    this.terrainsSeen = new Set();
    this.nightSeen = false;
    this.awarded = new Set();
    this.terrainId = 'asphalt';
    this.darkness = 0;
    this.phase = 'day';
    this.toast = '';
    this.toastTime = 0;
    this.emitTimer = 0;
    this.lastEmitted = -1;
    this.flash = 0;
    this.shake = 0;
    this.gameOver = false;
    this.motes = Array.from({ length: 70 }, () => ({
      x: Math.random() * FIELD_W,
      y: Math.random() * FIELD_H,
      speed: 0,
      sway: Math.random() * Math.PI * 2,
      len: 2 + Math.random() * 3,
    }));
  }

  private active(k: PowerKind): boolean {
    return this.fx[k] > 0;
  }

  private award(id: string): void {
    if (this.awarded.has(id)) return;
    this.awarded.add(id);
    this.ctx.emit.emit('trophy', { trophyId: id });
  }

  /** A vehicle/power-up x at a given screen y, following the curving road. */
  private laneX(dist: number, y: number, lane: number): number {
    return laneCenter(roadAt(worldYAt(dist, y)), lane);
  }

  // ---- Simulation -----------------------------------------------------------

  update(dt: number): void {
    if (this.gameOver) return;
    const input = this.ctx.input;

    // Snapshot for interpolation.
    this.prevPx = this.px;
    this.prevDistance = this.distance;
    for (const c of this.cars) c.prevY = c.y;
    for (const p of this.powerups) p.prevY = p.y;

    // Terrain + time of day (pure functions of distance).
    const ter = terrainAt(this.distance);
    const terrain = TERRAINS[ter.id];
    const tod = timeOfDayAt(this.distance);
    this.terrainId = ter.id;
    this.darkness = tod.darkness;
    this.phase = tod.phase;
    if (ter.id !== 'asphalt' && !this.terrainsSeen.has(ter.id)) {
      this.terrainsSeen.add(ter.id);
      const tId = TERRAIN_TROPHY[ter.id];
      if (tId) this.award(tId);
    }
    if (tod.phase === 'night' && !this.nightSeen) {
      this.nightSeen = true;
      this.award('nightrider');
    }

    // Throttle: up = gas, down = brake. Terrain caps the speed.
    const gas = input.isHeld('up');
    const brake = input.isHeld('down');
    const throttle = gas && !brake ? 1 : brake ? -1 : 0;
    let speed = speedFor(throttle, this.distance) * terrain.speedMul;

    // Surge pins the Burn gauge full so Nitro keeps re-igniting.
    if (this.active('surge')) this.burn = BURN_MAX;

    // Burn → Nitro (the signature risk/reward payoff).
    if (this.nitro) {
      this.nitroTime -= dt;
      speed += NITRO_SPEED_BONUS;
      if (!this.active('surge')) this.burn = BURN_MAX * Math.max(0, this.nitroTime / NITRO_DURATION);
      if (this.nitroTime <= 0) {
        this.nitro = false;
        this.burn = this.active('surge') ? BURN_MAX : 0;
      }
    } else if (this.burn >= BURN_MAX) {
      this.nitro = true;
      this.nitroTime = NITRO_DURATION;
      this.nitros += 1;
      this.ctx.audio.playSfx('nitro');
      this.setFlash('#ffd27a', 0.5);
      this.award('burnout');
    }

    if (this.active('turbo')) speed += TURBO_SPEED_BONUS;

    this.distance += speed * dt;
    const scoreMul = (this.nitro ? 2 : 1) * (this.active('double') ? 2 : 1);
    if (scoreMul > 1) this.bonus += speed * dt * (scoreMul - 1);

    // Steering with lateral grip (slidey on mud/snow unless Grip power-up is on).
    const grip = this.active('grip') ? 1 : terrain.grip;
    const dir = (input.isHeld('right') ? 1 : 0) - (input.isHeld('left') ? 1 : 0);
    this.pvx = gripApproach(this.pvx, dir * STEER_TARGET, grip, dt);
    const phw = CAR_HW * (this.active('mini') ? MINI_SCALE : 1);
    const road = roadAt(worldYAt(this.distance, PLAYER_Y));
    let nx = this.px + this.pvx * dt;
    const lo = road.center - road.half + phw;
    const hi = road.center + road.half - phw;
    if (nx < lo) {
      nx = lo;
      if (this.pvx < 0) this.pvx = 0;
    } else if (nx > hi) {
      nx = hi;
      if (this.pvx > 0) this.pvx = 0;
    }
    this.px = nx;

    this.spawnTraffic(dt);
    this.spawnPowerups(dt);

    const slow = this.active('slowmo') ? SLOWMO_FACTOR : 1;
    this.moveEntities(dt, speed, slow);
    this.resolve(phw, CAR_HH * (this.active('mini') ? MINI_SCALE : 1));

    for (const k of POWER_KINDS) if (this.fx[k] > 0) this.fx[k] = Math.max(0, this.fx[k] - dt);
    if (this.spawnSuppress > 0) this.spawnSuppress -= dt;

    this.updateWeather(dt, ter.id);
    this.updateSparks(dt);
    if (this.flash > 0) this.flash = Math.max(0, this.flash - dt * 2.5);
    if (this.shake > 0) this.shake = Math.max(0, this.shake - dt * 3);
    if (this.toastTime > 0) this.toastTime = Math.max(0, this.toastTime - dt);

    this.score = scoreFromDistance(this.distance, this.bonus);
    this.emitTimer += dt;
    if (this.emitTimer >= 0.1) {
      this.emitTimer = 0;
      this.emitScore(false);
    }
  }

  private setFlash(color: string, amount: number): void {
    this.flashColor = color;
    this.flash = Math.max(this.flash, amount);
  }

  private spawnTraffic(dt: number): void {
    this.spawnTimer -= dt;
    if (this.spawnTimer > 0) return;
    this.spawnTimer = trafficSpawnInterval(this.distance) * (0.7 + Math.random() * 0.6);
    if (this.spawnSuppress > 0) return;

    const kind = pickVehicleKind(Math.random());
    const spec = VEHICLES[kind];
    const candidates: number[] = [];
    for (let l = 0; l < NUM_LANES; l += 1) {
      if (!this.cars.some((c) => c.lane === l && c.y < spec.hh + 18)) candidates.push(l);
    }
    if (candidates.length === 0) return;
    const lane = candidates[Math.floor(Math.random() * candidates.length)]!;
    this.cars.push({
      kind,
      lane,
      y: -spec.hh - 2,
      prevY: -spec.hh - 2,
      worldSpeed: spec.minSpeed + Math.random() * (spec.maxSpeed - spec.minSpeed),
      hw: spec.hw,
      hh: spec.hh,
      color: TRAFFIC_COLORS[Math.floor(Math.random() * TRAFFIC_COLORS.length)]!,
      big: isBigVehicle(kind),
      nearLogged: false,
    });
  }

  private spawnPowerups(dt: number): void {
    this.powerTimer -= dt;
    if (this.powerTimer > 0) return;
    this.powerTimer = POWERUP_MIN_GAP + Math.random() * POWERUP_VAR;
    const candidates: number[] = [];
    for (let l = 0; l < NUM_LANES; l += 1) {
      const carNear = this.cars.some((c) => c.lane === l && c.y < 22);
      const puNear = this.powerups.some((p) => p.lane === l && p.y < 30);
      if (!carNear && !puNear) candidates.push(l);
    }
    if (candidates.length === 0) return;
    const lane = candidates[Math.floor(Math.random() * candidates.length)]!;
    this.powerups.push({ kind: pickPowerKind(Math.random()), lane, y: -6, prevY: -6 });
  }

  private moveEntities(dt: number, speed: number, slow: number): void {
    for (const c of this.cars) c.y += (speed - c.worldSpeed) * slow * dt;
    this.cars = this.cars.filter((c) => c.y < FIELD_H + 22 && c.y > -60);
    for (const p of this.powerups) p.y += speed * slow * dt;
    this.powerups = this.powerups.filter((p) => p.y < FIELD_H + 10);
  }

  private resolve(phw: number, phh: number): void {
    const invuln = this.active('shield') || this.nitro;
    for (let i = this.cars.length - 1; i >= 0; i -= 1) {
      const c = this.cars[i]!;
      const cx = this.laneX(this.distance, c.y, c.lane);
      const dx = this.px - cx;
      const dy = PLAYER_Y - c.y;

      if (!invuln && aabbHit(this.px, PLAYER_Y, phw, phh, cx, c.y, c.hw, c.hh)) {
        this.spawnSparks(this.px, PLAYER_Y, '#ff5d73');
        this.ctx.audio.playSfx('crash');
        this.endGame();
        return;
      }

      if (!c.nearLogged && Math.abs(dy) <= phh + c.hh && isNearMiss(dx, phw + c.hw)) {
        c.nearLogged = true;
        this.passes += 1;
        if (c.big) this.bigPasses += 1;
        this.bonus += PASS_BONUS;
        if (!this.nitro) this.burn = Math.min(BURN_MAX, this.burn + BURN_PER_PASS);
        this.setFlash('#ffd27a', 0.18);
        this.ctx.audio.playSfx('pass');
        this.award('firstPass');
      }
    }

    for (let i = this.powerups.length - 1; i >= 0; i -= 1) {
      const p = this.powerups[i]!;
      const px2 = this.laneX(this.distance, p.y, p.lane);
      if (aabbHit(this.px, PLAYER_Y, phw, phh, px2, p.y, POWERUP_HW, POWERUP_HH)) {
        this.powerups.splice(i, 1);
        this.applyPower(p.kind);
      }
    }
  }

  private applyPower(kind: PowerKind): void {
    const spec = POWERS[kind];
    this.powerupsCollected += 1;
    this.award('collector');
    if (!this.usedKinds.has(kind)) {
      this.usedKinds.add(kind);
      this.award(POWER_TROPHY[kind]);
    }
    this.toast = this.ctx.i18n(`roadBurner:powers.${kind}`);
    this.toastColor = spec.color;
    this.toastTime = 1.5;
    this.ctx.audio.playSfx('powerup');
    this.setFlash(spec.color, 0.35);

    if (kind === 'sweep') {
      for (const c of this.cars) this.spawnSparks(this.laneX(this.distance, c.y, c.lane), c.y, c.color);
      this.cars = [];
      this.spawnSuppress = SWEEP_SPAWN_PAUSE;
    } else {
      this.fx[kind] = spec.duration;
    }
  }

  private spawnSparks(x: number, y: number, color: string): void {
    this.shake = Math.max(this.shake, 0.7);
    if (this.ctx.reducedMotion) {
      this.setFlash(color, 0.4);
      return;
    }
    for (let i = 0; i < 12; i += 1) {
      const a = (Math.PI * 2 * i) / 12 + Math.random() * 0.5;
      const sp = 18 + Math.random() * 26;
      this.sparks.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: 0.5, max: 0.5, color });
    }
  }

  private updateSparks(dt: number): void {
    for (const p of this.sparks) {
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.life -= dt;
    }
    this.sparks = this.sparks.filter((p) => p.life > 0);
  }

  private updateWeather(dt: number, terrain: TerrainId): void {
    if (this.ctx.reducedMotion) return;
    if (terrain === 'rain') {
      for (const m of this.motes) {
        m.speed = 220;
        m.y += m.speed * dt;
        m.x -= 24 * dt;
        if (m.y > FIELD_H) {
          m.y -= FIELD_H;
          m.x = Math.random() * FIELD_W;
        }
        if (m.x < 0) m.x += FIELD_W;
      }
    } else if (terrain === 'snow') {
      for (const m of this.motes) {
        m.sway += dt * 2;
        m.y += 26 * dt;
        m.x += Math.sin(m.sway) * 8 * dt;
        if (m.y > FIELD_H) {
          m.y -= FIELD_H;
          m.x = Math.random() * FIELD_W;
        }
      }
    }
  }

  private emitScore(force: boolean): void {
    if (!force && this.score === this.lastEmitted) return;
    this.lastEmitted = this.score;
    this.ctx.emit.emit('score', { score: this.score });
  }

  private endGame(): void {
    if (this.gameOver) return;
    this.gameOver = true;
    this.setFlash('#ff5d73', 1);
    this.score = scoreFromDistance(this.distance, this.bonus);
    this.emitScore(true);
    this.ctx.audio.playSfx('gameover');
    this.ctx.emit.emit('gameover', {
      score: this.score,
      stats: {
        distance: Math.floor(this.distance),
        passes: this.passes,
        bigPasses: this.bigPasses,
        nitros: this.nitros,
        powerups: this.powerupsCollected,
        usedShield: this.usedKinds.has('shield') ? 1 : 0,
        usedTurbo: this.usedKinds.has('turbo') ? 1 : 0,
        usedSlow: this.usedKinds.has('slowmo') ? 1 : 0,
        usedDouble: this.usedKinds.has('double') ? 1 : 0,
        usedSurge: this.usedKinds.has('surge') ? 1 : 0,
        usedMini: this.usedKinds.has('mini') ? 1 : 0,
        usedGrip: this.usedKinds.has('grip') ? 1 : 0,
        usedSweep: this.usedKinds.has('sweep') ? 1 : 0,
        mud: this.terrainsSeen.has('mud') ? 1 : 0,
        snow: this.terrainsSeen.has('snow') ? 1 : 0,
        rain: this.terrainsSeen.has('rain') ? 1 : 0,
        night: this.nightSeen ? 1 : 0,
      },
    });
  }

  // ---- Rendering ------------------------------------------------------------

  render(alpha: number): void {
    const g = this.g;
    const { width, height } = this.ctx.viewport;
    if (width <= 0 || height <= 0) return;

    const s = Math.min(width / FIELD_W, height / FIELD_H);
    let offX = (width - FIELD_W * s) / 2;
    let offY = (height - FIELD_H * s) / 2;
    if (this.shake > 0 && !this.ctx.reducedMotion) {
      offX += (Math.random() * 2 - 1) * this.shake * 3;
      offY += (Math.random() * 2 - 1) * this.shake * 3;
    }
    const X = (x: number): number => offX + x * s;
    const Y = (y: number): number => offY + y * s;
    const dist = lerp(this.prevDistance, this.distance, alpha);
    const pal = PALETTES[this.terrainId];
    const night = this.darkness;

    g.clearRect(0, 0, width, height);
    g.fillStyle = '#080514';
    g.fillRect(0, 0, width, height);

    this.drawRoad(g, X, Y, s, dist, pal);
    this.drawPowerups(g, X, Y, s, alpha, dist);
    this.drawCars(g, X, Y, s, alpha, dist, night);
    this.drawSparks(g, X, Y, s);
    if (!this.gameOver) this.drawPlayer(g, X, Y, s, alpha, night);
    this.drawWeather(g, X, Y, s);

    // Night overlay (darkens the scene; player headlights cut through a little).
    if (night > 0.02) {
      g.fillStyle = `rgba(4,4,16,${night * 0.6})`;
      g.fillRect(offX, offY, FIELD_W * s, FIELD_H * s);
      if (!this.gameOver) this.drawHeadlights(g, X, Y, s, alpha, night);
    }

    this.drawHud(g, X, Y, s, offX, offY);

    if (this.flash > 0) {
      const [r, gg, b] = hexToRgb(this.flashColor);
      g.fillStyle = `rgba(${r},${gg},${b},${this.flash * 0.3})`;
      g.fillRect(offX, offY, FIELD_W * s, FIELD_H * s);
    }
  }

  private drawRoad(
    g: CanvasRenderingContext2D,
    X: (x: number) => number,
    Y: (y: number) => number,
    s: number,
    dist: number,
    pal: TerrainPalette,
  ): void {
    const step = 6;
    const samples: Array<{ y: number; left: number; right: number }> = [];
    for (let y = -step; y <= FIELD_H + step; y += step) {
      const r = roadAt(worldYAt(dist, y));
      samples.push({ y, left: r.center - r.half, right: r.center + r.half });
    }

    const shoulder = g.createLinearGradient(0, Y(0), 0, Y(FIELD_H));
    shoulder.addColorStop(0, pal.shoulder[0]);
    shoulder.addColorStop(1, pal.shoulder[1]);
    g.fillStyle = shoulder;
    g.fillRect(X(0), Y(0), FIELD_W * s, FIELD_H * s);

    const tar = g.createLinearGradient(0, Y(0), 0, Y(FIELD_H));
    tar.addColorStop(0, pal.tar[0]);
    tar.addColorStop(1, pal.tar[1]);
    g.fillStyle = tar;
    g.beginPath();
    samples.forEach((sm, i) => (i === 0 ? g.moveTo(X(sm.left), Y(sm.y)) : g.lineTo(X(sm.left), Y(sm.y))));
    for (let i = samples.length - 1; i >= 0; i -= 1) g.lineTo(X(samples[i]!.right), Y(samples[i]!.y));
    g.closePath();
    g.fill();

    g.strokeStyle = pal.stripe;
    g.lineWidth = Math.max(1, s * 0.5);
    g.lineCap = 'round';
    const period = STRIPE_LEN + STRIPE_GAP;
    const phase = this.ctx.reducedMotion ? 0 : dist % period;
    for (let lane = 1; lane < NUM_LANES; lane += 1) {
      g.beginPath();
      for (let y = -step; y <= FIELD_H + step; y += step) {
        const r = roadAt(worldYAt(dist, y));
        const w = (r.half * 2) / NUM_LANES;
        const x = r.center - r.half + w * lane;
        const worldY = worldYAt(dist, y);
        const inDash = (((worldY + phase) % period) + period) % period < STRIPE_LEN;
        if (inDash) {
          g.moveTo(X(x), Y(y));
          g.lineTo(X(x), Y(Math.min(FIELD_H + step, y + step * 0.9)));
        }
      }
      g.stroke();
    }
    g.lineCap = 'butt';

    g.lineWidth = Math.max(1.2, s * 0.8);
    g.strokeStyle = pal.rails[0];
    g.beginPath();
    samples.forEach((sm, i) => (i === 0 ? g.moveTo(X(sm.left), Y(sm.y)) : g.lineTo(X(sm.left), Y(sm.y))));
    g.stroke();
    g.strokeStyle = pal.rails[1];
    g.beginPath();
    samples.forEach((sm, i) => (i === 0 ? g.moveTo(X(sm.right), Y(sm.y)) : g.lineTo(X(sm.right), Y(sm.y))));
    g.stroke();
  }

  private roundRect(
    g: CanvasRenderingContext2D,
    x: number,
    y: number,
    w: number,
    h: number,
    r: number,
  ): void {
    g.beginPath();
    g.moveTo(x + r, y);
    g.arcTo(x + w, y, x + w, y + h, r);
    g.arcTo(x + w, y + h, x, y + h, r);
    g.arcTo(x, y + h, x, y, r);
    g.arcTo(x, y, x + w, y, r);
    g.closePath();
  }

  private drawVehicle(
    g: CanvasRenderingContext2D,
    c: Vehicle,
    cx: number,
    cy: number,
    s: number,
    night: number,
  ): void {
    const w = c.hw * 2 * s;
    const h = c.hh * 2 * s;
    const x = cx - w / 2;
    const y = cy - h / 2;
    const body = darken(c.color, night * 0.72);
    const glass = `rgba(8,5,20,${0.65 + night * 0.25})`;
    g.fillStyle = body;
    g.shadowColor = night > 0.4 ? 'rgba(0,0,0,0)' : c.color;
    g.shadowBlur = night > 0.4 ? 0 : 5;
    this.roundRect(g, x, y, w, h, Math.min(w, h) * 0.22);
    g.fill();
    g.shadowBlur = 0;

    if (c.kind === 'bike') {
      g.fillStyle = glass;
      g.fillRect(x + w * 0.3, y + h * 0.3, w * 0.4, h * 0.34);
    } else if (c.kind === 'truck' || c.kind === 'rig') {
      // Cab at the front (top) + cargo body with separator lines.
      g.fillStyle = glass;
      g.fillRect(x + w * 0.16, y + h * 0.05, w * 0.68, h * 0.14);
      g.strokeStyle = 'rgba(0,0,0,0.35)';
      g.lineWidth = Math.max(1, s * 0.4);
      const segs = c.kind === 'rig' ? 4 : 2;
      for (let i = 1; i < segs; i += 1) {
        const yy = y + h * (0.22 + (0.74 * i) / segs);
        g.beginPath();
        g.moveTo(x + w * 0.1, yy);
        g.lineTo(x + w * 0.9, yy);
        g.stroke();
      }
    } else {
      g.fillStyle = glass;
      g.fillRect(x + w * 0.2, y + h * 0.12, w * 0.6, h * 0.22);
      g.fillRect(x + w * 0.2, y + h * 0.66, w * 0.6, h * 0.2);
    }

    // Brake lights glow at the rear (bottom) at night.
    if (night > 0.45) {
      g.fillStyle = '#ff3b30';
      g.shadowColor = '#ff3b30';
      g.shadowBlur = 6;
      const lw = w * 0.18;
      const lh = Math.max(s * 1.2, h * 0.06);
      g.fillRect(x + w * 0.12, y + h - lh, lw, lh);
      g.fillRect(x + w * 0.7, y + h - lh, lw, lh);
      g.shadowBlur = 0;
    }
  }

  private drawCars(
    g: CanvasRenderingContext2D,
    X: (x: number) => number,
    Y: (y: number) => number,
    s: number,
    alpha: number,
    dist: number,
    night: number,
  ): void {
    for (const c of this.cars) {
      const y = lerp(c.prevY, c.y, alpha);
      this.drawVehicle(g, c, X(this.laneX(dist, y, c.lane)), Y(y), s, night);
    }
  }

  private drawPowerups(
    g: CanvasRenderingContext2D,
    X: (x: number) => number,
    Y: (y: number) => number,
    s: number,
    alpha: number,
    dist: number,
  ): void {
    for (const p of this.powerups) {
      const y = lerp(p.prevY, p.y, alpha);
      const cx = X(this.laneX(dist, y, p.lane));
      const cy = Y(y);
      const spec = POWERS[p.kind];
      const r = POWERUP_HW * s;
      g.fillStyle = spec.color;
      g.shadowColor = spec.color;
      g.shadowBlur = 10;
      this.roundRect(g, cx - r, cy - r, r * 2, r * 2, r * 0.5);
      g.fill();
      g.shadowBlur = 0;
      g.fillStyle = '#0b0820';
      g.font = `bold ${Math.round(r * 1.5)}px monospace`;
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      g.fillText(spec.letter, cx, cy + 0.5);
    }
  }

  private drawSparks(
    g: CanvasRenderingContext2D,
    X: (x: number) => number,
    Y: (y: number) => number,
    s: number,
  ): void {
    for (const p of this.sparks) {
      const t = p.life / p.max;
      g.globalAlpha = clamp(t, 0, 1);
      g.fillStyle = p.color;
      const sz = (1 + t * 1.6) * s;
      g.fillRect(X(p.x) - sz / 2, Y(p.y) - sz / 2, sz, sz);
    }
    g.globalAlpha = 1;
  }

  private drawWeather(
    g: CanvasRenderingContext2D,
    X: (x: number) => number,
    Y: (y: number) => number,
    s: number,
  ): void {
    if (this.ctx.reducedMotion) return;
    if (this.terrainId === 'rain') {
      g.strokeStyle = 'rgba(170,200,255,0.5)';
      g.lineWidth = Math.max(1, s * 0.4);
      g.beginPath();
      for (const m of this.motes) {
        g.moveTo(X(m.x), Y(m.y));
        g.lineTo(X(m.x - 1.4), Y(m.y + m.len + 3));
      }
      g.stroke();
    } else if (this.terrainId === 'snow') {
      g.fillStyle = 'rgba(255,255,255,0.85)';
      for (const m of this.motes) {
        const sz = m.len * 0.45 * s;
        g.fillRect(X(m.x), Y(m.y), sz, sz);
      }
    }
  }

  private drawPlayer(
    g: CanvasRenderingContext2D,
    X: (x: number) => number,
    Y: (y: number) => number,
    s: number,
    alpha: number,
    night: number,
  ): void {
    const x = lerp(this.prevPx, this.px, alpha);
    const cx = X(x);
    const cy = Y(PLAYER_Y);
    const mini = this.active('mini');
    const shield = this.active('shield');
    const hw = CAR_HW * (mini ? MINI_SCALE : 1);
    const hh = CAR_HH * (mini ? MINI_SCALE : 1);

    // Exhaust / nitro flame.
    const flick = this.ctx.reducedMotion ? 1 : 0.7 + Math.random() * 0.6;
    const flameLen = (this.nitro ? 4 : 1.8) * s * flick;
    g.fillStyle = this.nitro || this.active('turbo') ? '#bfffe9' : '#ffb347';
    g.globalAlpha = 0.85;
    g.beginPath();
    g.moveTo(cx - hw * 0.5 * s, cy + hh * s);
    g.lineTo(cx + hw * 0.5 * s, cy + hh * s);
    g.lineTo(cx, cy + hh * s + flameLen);
    g.closePath();
    g.fill();
    g.globalAlpha = 1;

    const bodyColor = this.nitro ? '#bfffe9' : '#ffd27a';
    g.shadowColor = this.nitro ? '#bfffe9' : '#ffd27a';
    g.shadowBlur = this.nitro ? 14 : 8;
    const w = hw * 2 * s;
    const h = hh * 2 * s;
    g.fillStyle = bodyColor;
    this.roundRect(g, cx - w / 2, cy - h / 2, w, h, Math.min(w, h) * 0.22);
    g.fill();
    g.shadowBlur = 0;
    g.fillStyle = '#3a1d5e';
    g.fillRect(cx - w * 0.3, cy - h * 0.32, w * 0.6, h * 0.22);

    // Brake light when braking, especially visible at night.
    if (this.ctx.input.isHeld('down') || night > 0.45) {
      g.fillStyle = '#ff3b30';
      g.shadowColor = '#ff3b30';
      g.shadowBlur = 6;
      g.fillRect(cx - w * 0.36, cy + h * 0.36, w * 0.2, Math.max(s, h * 0.08));
      g.fillRect(cx + w * 0.16, cy + h * 0.36, w * 0.2, Math.max(s, h * 0.08));
      g.shadowBlur = 0;
    }

    if (shield) {
      g.strokeStyle = `rgba(126,166,255,${0.6 + 0.3 * Math.sin(this.fx.shield * 8)})`;
      g.lineWidth = Math.max(1.4, s);
      g.beginPath();
      g.arc(cx, cy, Math.max(w, h) * 0.7, 0, Math.PI * 2);
      g.stroke();
    }
  }

  private drawHeadlights(
    g: CanvasRenderingContext2D,
    X: (x: number) => number,
    Y: (y: number) => number,
    s: number,
    alpha: number,
    night: number,
  ): void {
    const x = lerp(this.prevPx, this.px, alpha);
    const cx = X(x);
    const cy = Y(PLAYER_Y - CAR_HH);
    g.save();
    g.globalCompositeOperation = 'lighter';
    const grad = g.createLinearGradient(0, cy, 0, Y(PLAYER_Y - CAR_HH - 70));
    grad.addColorStop(0, `rgba(255,245,200,${0.16 * night})`);
    grad.addColorStop(1, 'rgba(255,245,200,0)');
    g.fillStyle = grad;
    g.beginPath();
    g.moveTo(cx - 2 * s, cy);
    g.lineTo(cx + 2 * s, cy);
    g.lineTo(cx + 22 * s, Y(PLAYER_Y - CAR_HH - 70));
    g.lineTo(cx - 22 * s, Y(PLAYER_Y - CAR_HH - 70));
    g.closePath();
    g.fill();
    g.restore();
  }

  private drawHud(
    g: CanvasRenderingContext2D,
    X: (x: number) => number,
    Y: (y: number) => number,
    s: number,
    offX: number,
    offY: number,
  ): void {
    const pad = 3;
    const barX = X(pad);
    const barW = (FIELD_W - pad * 2) * s;
    const barY = Y(2);
    const barH = 4 * s;
    const ratio = this.burn / BURN_MAX;
    g.fillStyle = 'rgba(20,11,43,0.85)';
    g.fillRect(barX, barY, barW, barH);
    g.fillStyle = this.nitro ? '#bfffe9' : ratio >= 1 ? '#ffd27a' : '#ff7a45';
    g.fillRect(barX, barY, barW * clamp(ratio, 0, 1), barH);
    g.strokeStyle = 'rgba(255,255,255,0.18)';
    g.lineWidth = 1;
    g.strokeRect(barX + 0.5, barY + 0.5, barW, barH);

    g.font = `${Math.round(3.2 * s)}px monospace`;
    g.textBaseline = 'top';
    g.fillStyle = '#cdbce8';
    g.textAlign = 'left';
    const label = this.ctx.i18n(this.nitro ? 'roadBurner:hudNitro' : 'roadBurner:hudBurn');
    g.fillText(label.toUpperCase(), barX, barY + barH + 2 * s);
    g.textAlign = 'right';
    g.fillText(`${Math.floor(this.distance)} m`, barX + barW, barY + barH + 2 * s);

    // Terrain + time-of-day chip (centre).
    g.textAlign = 'center';
    g.fillStyle = '#a796c9';
    const terrainName = this.ctx.i18n(`roadBurner:terrains.${this.terrainId}`);
    const phaseName = this.ctx.i18n(`roadBurner:timeOfDay.${this.phase}`);
    g.fillText(`${terrainName} · ${phaseName}`, barX + barW / 2, barY + barH + 2 * s);

    // Active power-up chips.
    let chipX = barX;
    const chipY = barY + barH + 7 * s;
    const chipS = 6 * s;
    for (const k of POWER_KINDS) {
      if (this.fx[k] <= 0) continue;
      const spec = POWERS[k];
      g.fillStyle = spec.color;
      this.roundRect(g, chipX, chipY, chipS, chipS, chipS * 0.25);
      g.fill();
      g.fillStyle = '#0b0820';
      g.font = `bold ${Math.round(3.4 * s)}px monospace`;
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      g.fillText(spec.letter, chipX + chipS / 2, chipY + chipS / 2 + 0.5);
      // Shrinking time bar.
      const frac = clamp(this.fx[k] / spec.duration, 0, 1);
      g.fillStyle = 'rgba(255,255,255,0.5)';
      g.fillRect(chipX, chipY + chipS + s * 0.4, chipS * frac, s);
      chipX += chipS + 2 * s;
    }

    // Power-up pickup toast (centre of screen).
    if (this.toastTime > 0) {
      g.globalAlpha = clamp(this.toastTime / 1.5, 0, 1);
      g.fillStyle = this.toastColor;
      g.font = `bold ${Math.round(6 * s)}px monospace`;
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      g.fillText(this.toast.toUpperCase(), offX + (FIELD_W * s) / 2, offY + FIELD_H * s * 0.4);
      g.globalAlpha = 1;
    }
  }

  pause(): void {
    this.ctx.audio.stopMusic();
  }

  resume(): void {
    this.ctx.audio.playMusic('gameplay');
  }

  destroy(): void {
    this.ctx.audio.stopMusic();
  }
}
