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
  isNearMiss,
  laneCenter,
  NITRO_DURATION,
  NITRO_SPEED_BONUS,
  NUM_LANES,
  PASS_BONUS,
  PLAYER_Y,
  roadAt,
  scoreFromDistance,
  speedFor,
  trafficSpawnInterval,
  TRAFFIC_MAX_SPEED,
  TRAFFIC_MIN_SPEED,
  worldYAt,
} from './logic';

const PLAYER_STEER = 84; // units/s sideways
const CRASH_GAP_X = CAR_HW * 2; // x separation under which boxes overlap
const STRIPE_LEN = 9; // dashed lane-divider segment length (world units)
const STRIPE_GAP = 7;
const TRAFFIC_COLORS = ['#ff5d73', '#46d4c4', '#b06cff', '#ffd27a', '#7ea6ff'];

interface Car {
  lane: number;
  y: number;
  prevY: number;
  worldSpeed: number;
  color: string;
  nearLogged: boolean;
}
interface Spark {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  max: number;
}

const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;

export class RoadBurnerGame implements GameModule {
  readonly meta: GameMeta = roadBurnerMeta;

  private ctx!: GameContext;
  private g!: CanvasRenderingContext2D;

  private px = FIELD_W / 2;
  private prevPx = FIELD_W / 2;
  private distance = 0;
  private prevDistance = 0;

  private cars: Car[] = [];
  private sparks: Spark[] = [];

  private spawnTimer = 1;

  private burn = 0;
  private nitro = false;
  private nitroTime = 0;

  private score = 0;
  private bonus = 0;
  private passes = 0;
  private nitros = 0;

  private emitTimer = 0;
  private lastEmitted = -1;
  private flash = 0;
  private shake = 0;
  private gameOver = false;
  private firstPassAwarded = false;
  private burnoutAwarded = false;

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
    this.distance = 0;
    this.prevDistance = 0;
    this.cars = [];
    this.sparks = [];
    this.spawnTimer = 1;
    this.burn = 0;
    this.nitro = false;
    this.nitroTime = 0;
    this.score = 0;
    this.bonus = 0;
    this.passes = 0;
    this.nitros = 0;
    this.emitTimer = 0;
    this.lastEmitted = -1;
    this.flash = 0;
    this.shake = 0;
    this.gameOver = false;
    this.firstPassAwarded = false;
    this.burnoutAwarded = false;
  }

  /** A traffic car's x at a given screen y, following the curving road. */
  private carX(dist: number, y: number, lane: number): number {
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

    // Throttle: up = gas, down = brake.
    const gas = input.isHeld('up');
    const brake = input.isHeld('down');
    const throttle = gas && !brake ? 1 : brake ? -1 : 0;

    let speed = speedFor(throttle, this.distance);

    // Burn → Nitro (the signature risk/reward payoff).
    if (this.nitro) {
      this.nitroTime -= dt;
      speed += NITRO_SPEED_BONUS;
      this.burn = BURN_MAX * Math.max(0, this.nitroTime / NITRO_DURATION);
      if (this.nitroTime <= 0) {
        this.nitro = false;
        this.burn = 0;
      }
    } else if (this.burn >= BURN_MAX) {
      this.nitro = true;
      this.nitroTime = NITRO_DURATION;
      this.nitros += 1;
      this.ctx.audio.playSfx('nitro');
      this.flash = Math.max(this.flash, 0.5);
      if (!this.burnoutAwarded) {
        this.burnoutAwarded = true;
        this.ctx.emit.emit('trophy', { trophyId: 'burnout' });
      }
    }

    this.distance += speed * dt;
    if (this.nitro) this.bonus += speed * dt; // Nitro = 2× score (extra distance)

    // Steering (continuous via held inputs — no gesture lag). Clamp to tarmac.
    const dir = (input.isHeld('right') ? 1 : 0) - (input.isHeld('left') ? 1 : 0);
    const road = roadAt(worldYAt(this.distance, PLAYER_Y));
    this.px = clamp(
      this.px + dir * PLAYER_STEER * dt,
      road.center - road.half + CAR_HW,
      road.center + road.half - CAR_HW,
    );

    this.spawnTraffic(dt);
    this.moveTraffic(dt, speed);
    this.resolve();
    this.updateSparks(dt);

    if (this.flash > 0) this.flash = Math.max(0, this.flash - dt * 2.5);
    if (this.shake > 0) this.shake = Math.max(0, this.shake - dt * 3);

    this.score = scoreFromDistance(this.distance, this.bonus);
    this.emitTimer += dt;
    if (this.emitTimer >= 0.1) {
      this.emitTimer = 0;
      this.emitScore(false);
    }
  }

  private spawnTraffic(dt: number): void {
    this.spawnTimer -= dt;
    if (this.spawnTimer > 0) return;
    // Pick a lane that has no car still bunched near the top, so the player
    // always has a way through.
    const candidates: number[] = [];
    for (let l = 0; l < NUM_LANES; l += 1) {
      if (!this.cars.some((c) => c.lane === l && c.y < 26)) candidates.push(l);
    }
    if (candidates.length > 0) {
      const lane = candidates[Math.floor(Math.random() * candidates.length)]!;
      this.cars.push({
        lane,
        y: -CAR_HH - 2,
        prevY: -CAR_HH - 2,
        worldSpeed: TRAFFIC_MIN_SPEED + Math.random() * (TRAFFIC_MAX_SPEED - TRAFFIC_MIN_SPEED),
        color: TRAFFIC_COLORS[Math.floor(Math.random() * TRAFFIC_COLORS.length)]!,
        nearLogged: false,
      });
    }
    this.spawnTimer = trafficSpawnInterval(this.distance) * (0.75 + Math.random() * 0.5);
  }

  private moveTraffic(dt: number, speed: number): void {
    for (const c of this.cars) c.y += (speed - c.worldSpeed) * dt;
    this.cars = this.cars.filter((c) => c.y < FIELD_H + 14 && c.y > -40);
  }

  private resolve(): void {
    for (let i = this.cars.length - 1; i >= 0; i -= 1) {
      const c = this.cars[i]!;
      const cx = this.carX(this.distance, c.y, c.lane);
      const dx = this.px - cx;
      const dy = PLAYER_Y - c.y;

      // Collision (lethal unless Nitro is phasing).
      if (!this.nitro && aabbHit(this.px, PLAYER_Y, CAR_HW, CAR_HH, cx, c.y, CAR_HW, CAR_HH)) {
        this.spawnSparks(this.px, PLAYER_Y);
        this.ctx.audio.playSfx('crash');
        this.endGame();
        return;
      }

      // Near-miss overtake: alongside, close, but not crashing → charge Burn.
      if (!c.nearLogged && Math.abs(dy) <= CAR_HH && isNearMiss(dx, CRASH_GAP_X)) {
        c.nearLogged = true;
        this.passes += 1;
        this.bonus += PASS_BONUS;
        if (!this.nitro) this.burn = Math.min(BURN_MAX, this.burn + BURN_PER_PASS);
        this.flash = Math.max(this.flash, 0.18);
        this.ctx.audio.playSfx('pass');
        if (!this.firstPassAwarded) {
          this.firstPassAwarded = true;
          this.ctx.emit.emit('trophy', { trophyId: 'firstPass' });
        }
      }
    }
  }

  private spawnSparks(x: number, y: number): void {
    this.shake = 1;
    if (this.ctx.reducedMotion) {
      this.flash = Math.max(this.flash, 0.5);
      return;
    }
    for (let i = 0; i < 12; i += 1) {
      const a = (Math.PI * 2 * i) / 12 + Math.random() * 0.5;
      const sp = 20 + Math.random() * 28;
      this.sparks.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: 0.55, max: 0.55 });
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

  private emitScore(force: boolean): void {
    if (!force && this.score === this.lastEmitted) return;
    this.lastEmitted = this.score;
    this.ctx.emit.emit('score', { score: this.score });
  }

  private endGame(): void {
    if (this.gameOver) return;
    this.gameOver = true;
    this.flash = 1;
    this.score = scoreFromDistance(this.distance, this.bonus);
    this.emitScore(true);
    this.ctx.audio.playSfx('gameover');
    this.ctx.emit.emit('gameover', {
      score: this.score,
      stats: {
        distance: Math.floor(this.distance),
        passes: this.passes,
        nitros: this.nitros,
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

    g.clearRect(0, 0, width, height);
    g.fillStyle = '#080514';
    g.fillRect(0, 0, width, height);

    this.drawRoad(g, X, Y, s, dist);
    this.drawCars(g, X, Y, s, alpha, dist);
    this.drawSparks(g, X, Y, s);
    if (!this.gameOver) this.drawPlayer(g, X, Y, s, alpha);
    this.drawHud(g, X, Y, s);

    if (this.flash > 0) {
      g.fillStyle = this.nitro
        ? `rgba(255,210,122,${this.flash * 0.28})`
        : `rgba(255,93,115,${this.flash * 0.3})`;
      g.fillRect(offX, offY, FIELD_W * s, FIELD_H * s);
    }
  }

  private drawRoad(
    g: CanvasRenderingContext2D,
    X: (x: number) => number,
    Y: (y: number) => number,
    s: number,
    dist: number,
  ): void {
    const step = 6;
    const samples: Array<{ y: number; center: number; left: number; right: number }> = [];
    for (let y = -step; y <= FIELD_H + step; y += step) {
      const r = roadAt(worldYAt(dist, y));
      samples.push({ y, center: r.center, left: r.center - r.half, right: r.center + r.half });
    }

    // Grass / shoulder gradient behind the tarmac.
    const shoulder = g.createLinearGradient(0, Y(0), 0, Y(FIELD_H));
    shoulder.addColorStop(0, '#10182a');
    shoulder.addColorStop(1, '#161024');
    g.fillStyle = shoulder;
    g.fillRect(X(0), Y(0), FIELD_W * s, FIELD_H * s);

    // Tarmac polygon.
    const tar = g.createLinearGradient(0, Y(0), 0, Y(FIELD_H));
    tar.addColorStop(0, '#1c1830');
    tar.addColorStop(1, '#2a2440');
    g.fillStyle = tar;
    g.beginPath();
    samples.forEach((sm, i) => (i === 0 ? g.moveTo(X(sm.left), Y(sm.y)) : g.lineTo(X(sm.left), Y(sm.y))));
    for (let i = samples.length - 1; i >= 0; i -= 1) g.lineTo(X(samples[i]!.right), Y(samples[i]!.y));
    g.closePath();
    g.fill();

    // Dashed lane dividers (scroll with distance for a sense of speed).
    g.strokeStyle = 'rgba(255,255,255,0.5)';
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

    // Neon guardrails.
    g.lineWidth = Math.max(1.2, s * 0.8);
    g.strokeStyle = '#ffb347';
    g.beginPath();
    samples.forEach((sm, i) => (i === 0 ? g.moveTo(X(sm.left), Y(sm.y)) : g.lineTo(X(sm.left), Y(sm.y))));
    g.stroke();
    g.strokeStyle = '#b06cff';
    g.beginPath();
    samples.forEach((sm, i) => (i === 0 ? g.moveTo(X(sm.right), Y(sm.y)) : g.lineTo(X(sm.right), Y(sm.y))));
    g.stroke();
  }

  private drawCar(
    g: CanvasRenderingContext2D,
    cx: number,
    cy: number,
    s: number,
    color: string,
    glass: string,
  ): void {
    const w = CAR_HW * 2 * s;
    const h = CAR_HH * 2 * s;
    const x = cx - w / 2;
    const y = cy - h / 2;
    const r = Math.min(w, h) * 0.22;
    g.fillStyle = color;
    g.beginPath();
    g.moveTo(x + r, y);
    g.arcTo(x + w, y, x + w, y + h, r);
    g.arcTo(x + w, y + h, x, y + h, r);
    g.arcTo(x, y + h, x, y, r);
    g.arcTo(x, y, x + w, y, r);
    g.closePath();
    g.fill();
    // Windshield + rear window.
    g.fillStyle = glass;
    g.fillRect(x + w * 0.2, y + h * 0.12, w * 0.6, h * 0.22);
    g.fillRect(x + w * 0.2, y + h * 0.66, w * 0.6, h * 0.2);
  }

  private drawCars(
    g: CanvasRenderingContext2D,
    X: (x: number) => number,
    Y: (y: number) => number,
    s: number,
    alpha: number,
    dist: number,
  ): void {
    for (const c of this.cars) {
      const y = lerp(c.prevY, c.y, alpha);
      const cx = X(this.carX(dist, y, c.lane));
      const cy = Y(y);
      g.shadowColor = c.color;
      g.shadowBlur = 6;
      this.drawCar(g, cx, cy, s, c.color, 'rgba(8,5,20,0.7)');
      g.shadowBlur = 0;
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
      g.fillStyle = t > 0.5 ? '#ffd27a' : '#ff5d73';
      const sz = (1 + t * 1.6) * s;
      g.fillRect(X(p.x) - sz / 2, Y(p.y) - sz / 2, sz, sz);
    }
    g.globalAlpha = 1;
  }

  private drawPlayer(
    g: CanvasRenderingContext2D,
    X: (x: number) => number,
    Y: (y: number) => number,
    s: number,
    alpha: number,
  ): void {
    const x = lerp(this.prevPx, this.px, alpha);
    const cx = X(x);
    const cy = Y(PLAYER_Y);

    // Exhaust / nitro flame.
    const flick = this.ctx.reducedMotion ? 1 : 0.7 + Math.random() * 0.6;
    const flameLen = (this.nitro ? 4 : 1.8) * s * flick;
    g.fillStyle = this.nitro ? '#bfffe9' : '#ffb347';
    g.globalAlpha = 0.85;
    g.beginPath();
    g.moveTo(cx - CAR_HW * 0.5 * s, cy + CAR_HH * s);
    g.lineTo(cx + CAR_HW * 0.5 * s, cy + CAR_HH * s);
    g.lineTo(cx, cy + CAR_HH * s + flameLen);
    g.closePath();
    g.fill();
    g.globalAlpha = 1;

    g.shadowColor = this.nitro ? '#bfffe9' : '#ffd27a';
    g.shadowBlur = this.nitro ? 14 : 8;
    this.drawCar(g, cx, cy, s, this.nitro ? '#bfffe9' : '#ffd27a', '#3a1d5e');
    g.shadowBlur = 0;
  }

  private drawHud(
    g: CanvasRenderingContext2D,
    X: (x: number) => number,
    Y: (y: number) => number,
    s: number,
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

    g.fillStyle = '#a796c9';
    g.font = `${Math.round(3.2 * s)}px monospace`;
    g.textBaseline = 'top';
    g.textAlign = 'left';
    const label = this.ctx.i18n(this.nitro ? 'roadBurner:hudNitro' : 'roadBurner:hudBurn');
    g.fillText(label.toUpperCase(), barX, barY + barH + 2 * s);
    g.textAlign = 'right';
    g.fillText(`${Math.floor(this.distance)} m`, barX + barW, barY + barH + 2 * s);
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
