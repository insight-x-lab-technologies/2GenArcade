import type { GameContext, GameModule, GameMeta } from '@/types';
import { clamp } from '@/engine';
import { riverRunMeta } from './meta';
import {
  channelAt,
  circleHit,
  enemySpawnInterval,
  FIELD_H,
  FIELD_W,
  fuelDrain,
  FUEL_BONUS,
  FUEL_MAX,
  FUEL_REFILL,
  insideChannel,
  KILL_BONUS,
  PLAYER_R,
  PLAYER_Y,
  scoreFromDistance,
  speedFor,
  worldYAt,
} from './logic';

const PLAYER_SPEED = 70;
const BULLET_SPEED = 150;
const FIRE_NORMAL = 0.18;
const FIRE_FAST = 0.11;
const ENEMY_REL = 1;
const ENEMY_EXTRA = 10;
const ENEMY_R = 3.2;
const FUEL_R = 3.4;
const STAR_COUNT = 44;

interface Bullet {
  x: number;
  y: number;
  prevY: number;
}
interface Mover {
  x: number;
  y: number;
  prevY: number;
  r: number;
  spin: number;
}
interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  max: number;
}
interface Star {
  x: number;
  y: number;
  speed: number;
  size: number;
}

const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;

export class RiverRunGame implements GameModule {
  readonly meta: GameMeta = riverRunMeta;

  private ctx!: GameContext;
  private g!: CanvasRenderingContext2D;

  private px = FIELD_W / 2;
  private prevPx = FIELD_W / 2;
  private distance = 0;
  private prevDistance = 0;
  private fuel = FUEL_MAX;

  private bullets: Bullet[] = [];
  private enemies: Mover[] = [];
  private fuels: Mover[] = [];
  private particles: Particle[] = [];
  private stars: Star[] = [];

  private fireTimer = 0;
  private enemyTimer = 1;
  private fuelTimer = 5;

  private score = 0;
  private bonus = 0;
  private kills = 0;
  private fuelCollected = 0;
  private boosts = 0;
  private boostedBefore = false;

  private emitTimer = 0;
  private lastEmitted = -1;
  private flash = 0;
  private gameOver = false;
  private firstKillAwarded = false;
  private boosting = false;

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
    this.fuel = FUEL_MAX;
    this.bullets = [];
    this.enemies = [];
    this.fuels = [];
    this.particles = [];
    this.fireTimer = 0;
    this.enemyTimer = 1;
    this.fuelTimer = 5;
    this.score = 0;
    this.bonus = 0;
    this.kills = 0;
    this.fuelCollected = 0;
    this.boosts = 0;
    this.boostedBefore = false;
    this.emitTimer = 0;
    this.lastEmitted = -1;
    this.flash = 0;
    this.gameOver = false;
    this.firstKillAwarded = false;
    this.boosting = false;
    this.stars = Array.from({ length: STAR_COUNT }, () => ({
      x: Math.random() * FIELD_W,
      y: Math.random() * FIELD_H,
      speed: 0.12 + Math.random() * 0.4,
      size: 0.4 + Math.random() * 0.9,
    }));
  }

  // ---- Simulation -----------------------------------------------------------

  update(dt: number): void {
    if (this.gameOver) return;
    const input = this.ctx.input;

    // Snapshot for interpolation.
    this.prevPx = this.px;
    this.prevDistance = this.distance;
    for (const b of this.bullets) b.prevY = b.y;
    for (const e of this.enemies) e.prevY = e.y;
    for (const f of this.fuels) f.prevY = f.y;

    // Throttle: up = boost, down = brake.
    const boost = input.isHeld('up');
    const brake = input.isHeld('down');
    this.boosting = boost && !brake;
    const throttle = this.boosting ? 1 : brake ? -1 : 0;

    const speed = speedFor(throttle, this.distance);
    this.distance += speed * dt;

    // Fuel.
    this.fuel = Math.max(0, this.fuel - fuelDrain(this.boosting) * dt);
    if (this.fuel <= 0) {
      this.endGame();
      return;
    }
    if (this.boosting && !this.boostedBefore) {
      this.boostedBefore = true;
      this.boosts = 1;
      this.ctx.audio.playSfx('boost');
      this.ctx.emit.emit('trophy', { trophyId: 'afterburner' });
    }

    // Steering (continuous via held inputs — no gesture lag).
    const dir = (input.isHeld('right') ? 1 : 0) - (input.isHeld('left') ? 1 : 0);
    this.px = clamp(this.px + dir * PLAYER_SPEED * dt, PLAYER_R, FIELD_W - PLAYER_R);

    // Auto-fire.
    this.fireTimer -= dt;
    if (this.fireTimer <= 0) {
      this.bullets.push({ x: this.px, y: PLAYER_Y - 4, prevY: PLAYER_Y - 4 });
      this.fireTimer = this.boosting ? FIRE_FAST : FIRE_NORMAL;
      this.ctx.audio.playSfx('shoot');
    }

    this.spawnTimers(dt, speed);
    this.moveEntities(dt, speed);
    this.resolveCollisions();
    this.updateParticles(dt);

    if (this.flash > 0) this.flash = Math.max(0, this.flash - dt * 2.5);

    // Score (distance-based + bonuses), emitted ~10×/s when it changes.
    this.score = scoreFromDistance(this.distance, this.bonus);
    this.emitTimer += dt;
    if (this.emitTimer >= 0.1) {
      this.emitTimer = 0;
      this.emitScore(false);
    }
  }

  private spawnTimers(dt: number, _speed: number): void {
    this.enemyTimer -= dt;
    if (this.enemyTimer <= 0) {
      const ch = channelAt(worldYAt(this.distance, -6));
      const x = ch.center + (Math.random() * 2 - 1) * (ch.half - ENEMY_R - 1);
      this.enemies.push({ x, y: -6, prevY: -6, r: ENEMY_R, spin: 0 });
      this.enemyTimer = enemySpawnInterval(this.distance) * (0.7 + Math.random() * 0.6);
    }
    this.fuelTimer -= dt;
    if (this.fuelTimer <= 0) {
      const ch = channelAt(worldYAt(this.distance, -6));
      const x = ch.center + (Math.random() * 2 - 1) * (ch.half - FUEL_R - 1);
      this.fuels.push({ x, y: -6, prevY: -6, r: FUEL_R, spin: 0 });
      this.fuelTimer = 4.5 + Math.random() * 2.5;
    }
  }

  private moveEntities(dt: number, speed: number): void {
    for (const b of this.bullets) b.y -= BULLET_SPEED * dt;
    this.bullets = this.bullets.filter((b) => b.y > -4);

    for (const e of this.enemies) {
      e.y += (speed * ENEMY_REL + ENEMY_EXTRA) * dt;
      e.spin += dt * 4;
    }
    this.enemies = this.enemies.filter((e) => e.y < FIELD_H + 8);

    for (const f of this.fuels) f.y += speed * dt;
    this.fuels = this.fuels.filter((f) => f.y < FIELD_H + 8);
  }

  private resolveCollisions(): void {
    // Bullets vs enemies.
    for (let i = this.enemies.length - 1; i >= 0; i -= 1) {
      const e = this.enemies[i]!;
      let hit = false;
      for (let j = this.bullets.length - 1; j >= 0; j -= 1) {
        const b = this.bullets[j]!;
        if (circleHit(e.x, e.y, e.r, b.x, b.y, 1.5)) {
          this.bullets.splice(j, 1);
          hit = true;
          break;
        }
      }
      if (hit) {
        this.enemies.splice(i, 1);
        this.kills += 1;
        this.bonus += KILL_BONUS;
        this.spawnExplosion(e.x, e.y);
        this.ctx.audio.playSfx('explosion');
        if (!this.firstKillAwarded) {
          this.firstKillAwarded = true;
          this.ctx.emit.emit('trophy', { trophyId: 'firstKill' });
        }
      }
    }

    // Player vs enemies (lethal).
    for (const e of this.enemies) {
      if (circleHit(this.px, PLAYER_Y, PLAYER_R, e.x, e.y, e.r)) {
        this.spawnExplosion(this.px, PLAYER_Y);
        this.endGame();
        return;
      }
    }

    // Player vs fuel (collect).
    for (let i = this.fuels.length - 1; i >= 0; i -= 1) {
      const f = this.fuels[i]!;
      if (circleHit(this.px, PLAYER_Y, PLAYER_R, f.x, f.y, f.r)) {
        this.fuels.splice(i, 1);
        this.fuel = Math.min(FUEL_MAX, this.fuel + FUEL_REFILL);
        this.fuelCollected += 1;
        this.bonus += FUEL_BONUS;
        this.flash = Math.max(this.flash, 0.3);
        this.ctx.audio.playSfx('fuel');
      }
    }

    // Player vs canyon walls (lethal).
    const ch = channelAt(worldYAt(this.distance, PLAYER_Y));
    if (!insideChannel(this.px, ch, PLAYER_R)) {
      this.spawnExplosion(this.px, PLAYER_Y);
      this.endGame();
    }
  }

  private spawnExplosion(x: number, y: number): void {
    if (this.ctx.reducedMotion) {
      this.flash = Math.max(this.flash, 0.4);
      return;
    }
    const n = 10;
    for (let i = 0; i < n; i += 1) {
      const a = (Math.PI * 2 * i) / n + Math.random() * 0.5;
      const sp = 18 + Math.random() * 26;
      this.particles.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: 0.5, max: 0.5 });
    }
  }

  private updateParticles(dt: number): void {
    for (const p of this.particles) {
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.life -= dt;
    }
    this.particles = this.particles.filter((p) => p.life > 0);
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
        kills: this.kills,
        fuel: this.fuelCollected,
        boosts: this.boosts,
      },
    });
  }

  // ---- Rendering ------------------------------------------------------------

  render(alpha: number): void {
    const g = this.g;
    const { width, height } = this.ctx.viewport;
    if (width <= 0 || height <= 0) return;

    const s = Math.min(width / FIELD_W, height / FIELD_H);
    const offX = (width - FIELD_W * s) / 2;
    const offY = (height - FIELD_H * s) / 2;
    const X = (x: number): number => offX + x * s;
    const Y = (y: number): number => offY + y * s;

    const dist = lerp(this.prevDistance, this.distance, alpha);

    g.clearRect(0, 0, width, height);
    g.fillStyle = '#080514';
    g.fillRect(0, 0, width, height);

    this.drawStars(g, X, Y, s, dist);
    this.drawCanyon(g, X, Y, s, dist);
    this.drawFuels(g, X, Y, s, alpha);
    this.drawEnemies(g, X, Y, s, alpha);
    this.drawBullets(g, X, Y, s, alpha);
    this.drawParticles(g, X, Y, s);
    if (!this.gameOver) this.drawPlayer(g, X, Y, s, alpha);

    this.drawHud(g, X, Y, s);

    if (this.flash > 0) {
      g.fillStyle = `rgba(255,93,115,${this.flash * 0.3})`;
      g.fillRect(offX, offY, FIELD_W * s, FIELD_H * s);
    }
  }

  private drawStars(
    g: CanvasRenderingContext2D,
    X: (x: number) => number,
    Y: (y: number) => number,
    s: number,
    dist: number,
  ): void {
    g.fillStyle = 'rgba(180,160,220,0.5)';
    for (const st of this.stars) {
      const y = this.ctx.reducedMotion ? st.y : (st.y + dist * st.speed) % FIELD_H;
      g.globalAlpha = 0.3 + st.speed;
      g.fillRect(X(st.x), Y(y), st.size * s, st.size * s);
    }
    g.globalAlpha = 1;
  }

  private drawCanyon(
    g: CanvasRenderingContext2D,
    X: (x: number) => number,
    Y: (y: number) => number,
    s: number,
    dist: number,
  ): void {
    const step = 6;
    const samples: Array<{ y: number; left: number; right: number }> = [];
    for (let y = -step; y <= FIELD_H + step; y += step) {
      const ch = channelAt(worldYAt(dist, y));
      samples.push({ y, left: ch.center - ch.half, right: ch.center + ch.half });
    }

    const grad = g.createLinearGradient(0, Y(0), 0, Y(FIELD_H));
    grad.addColorStop(0, '#3a1d5e');
    grad.addColorStop(1, '#5e2a1d');

    // Left wall fill.
    g.fillStyle = grad;
    g.beginPath();
    g.moveTo(X(0), Y(-step));
    for (const sm of samples) g.lineTo(X(sm.left), Y(sm.y));
    g.lineTo(X(0), Y(FIELD_H + step));
    g.closePath();
    g.fill();

    // Right wall fill.
    g.beginPath();
    g.moveTo(X(FIELD_W), Y(-step));
    for (const sm of samples) g.lineTo(X(sm.right), Y(sm.y));
    g.lineTo(X(FIELD_W), Y(FIELD_H + step));
    g.closePath();
    g.fill();

    // Neon inner edges.
    g.lineWidth = Math.max(1, s * 0.7);
    g.strokeStyle = '#ffb347';
    g.beginPath();
    samples.forEach((sm, i) => (i === 0 ? g.moveTo(X(sm.left), Y(sm.y)) : g.lineTo(X(sm.left), Y(sm.y))));
    g.stroke();
    g.strokeStyle = '#b06cff';
    g.beginPath();
    samples.forEach((sm, i) => (i === 0 ? g.moveTo(X(sm.right), Y(sm.y)) : g.lineTo(X(sm.right), Y(sm.y))));
    g.stroke();
  }

  private drawFuels(
    g: CanvasRenderingContext2D,
    X: (x: number) => number,
    Y: (y: number) => number,
    s: number,
    alpha: number,
  ): void {
    for (const f of this.fuels) {
      const y = lerp(f.prevY, f.y, alpha);
      const cx = X(f.x);
      const cy = Y(y);
      const r = f.r * s;
      g.fillStyle = '#46d4c4';
      g.shadowColor = '#46d4c4';
      g.shadowBlur = 8;
      g.beginPath();
      for (let i = 0; i < 6; i += 1) {
        const a = (Math.PI / 3) * i - Math.PI / 2;
        const xx = cx + Math.cos(a) * r;
        const yy = cy + Math.sin(a) * r;
        if (i === 0) g.moveTo(xx, yy);
        else g.lineTo(xx, yy);
      }
      g.closePath();
      g.fill();
      g.shadowBlur = 0;
      g.fillStyle = '#0b2a27';
      g.font = `${Math.round(r)}px monospace`;
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      g.fillText('F', cx, cy + 0.5);
    }
  }

  private drawEnemies(
    g: CanvasRenderingContext2D,
    X: (x: number) => number,
    Y: (y: number) => number,
    s: number,
    alpha: number,
  ): void {
    for (const e of this.enemies) {
      const y = lerp(e.prevY, e.y, alpha);
      const cx = X(e.x);
      const cy = Y(y);
      const r = e.r * s;
      g.save();
      g.translate(cx, cy);
      if (!this.ctx.reducedMotion) g.rotate(e.spin);
      g.fillStyle = '#ff5d73';
      g.shadowColor = '#ff5d73';
      g.shadowBlur = 8;
      g.beginPath();
      g.moveTo(0, -r);
      g.lineTo(r, 0);
      g.lineTo(0, r);
      g.lineTo(-r, 0);
      g.closePath();
      g.fill();
      g.fillStyle = '#2a0a12';
      g.fillRect(-r * 0.25, -r * 0.25, r * 0.5, r * 0.5);
      g.restore();
      g.shadowBlur = 0;
    }
  }

  private drawBullets(
    g: CanvasRenderingContext2D,
    X: (x: number) => number,
    Y: (y: number) => number,
    s: number,
    alpha: number,
  ): void {
    g.fillStyle = '#bfffe9';
    g.shadowColor = '#46d4c4';
    g.shadowBlur = 6;
    for (const b of this.bullets) {
      const y = lerp(b.prevY, b.y, alpha);
      g.fillRect(X(b.x) - s * 0.5, Y(y) - s * 2, s, s * 3);
    }
    g.shadowBlur = 0;
  }

  private drawParticles(
    g: CanvasRenderingContext2D,
    X: (x: number) => number,
    Y: (y: number) => number,
    s: number,
  ): void {
    for (const p of this.particles) {
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
    const r = PLAYER_R * s * 1.5;

    // Thruster flame.
    const flick = this.ctx.reducedMotion ? 1 : 0.7 + Math.random() * 0.6;
    const flameLen = (this.boosting ? 3.4 : 2) * s * flick;
    g.fillStyle = this.boosting ? '#bfffe9' : '#ffb347';
    g.globalAlpha = 0.85;
    g.beginPath();
    g.moveTo(cx - r * 0.45, cy + r * 0.6);
    g.lineTo(cx + r * 0.45, cy + r * 0.6);
    g.lineTo(cx, cy + r * 0.6 + flameLen);
    g.closePath();
    g.fill();
    g.globalAlpha = 1;

    // Skimmer body (triangle pointing up).
    g.fillStyle = '#ffd27a';
    g.shadowColor = '#ffb347';
    g.shadowBlur = 10;
    g.beginPath();
    g.moveTo(cx, cy - r);
    g.lineTo(cx + r * 0.8, cy + r * 0.7);
    g.lineTo(cx - r * 0.8, cy + r * 0.7);
    g.closePath();
    g.fill();
    g.shadowBlur = 0;
    // Cockpit.
    g.fillStyle = '#5e2a6e';
    g.beginPath();
    g.arc(cx, cy - r * 0.05, r * 0.28, 0, Math.PI * 2);
    g.fill();
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
    const ratio = this.fuel / FUEL_MAX;
    g.fillStyle = 'rgba(20,11,43,0.85)';
    g.fillRect(barX, barY, barW, barH);
    g.fillStyle = ratio < 0.25 ? '#ff5d73' : '#46d4c4';
    g.fillRect(barX, barY, barW * clamp(ratio, 0, 1), barH);
    g.strokeStyle = 'rgba(255,255,255,0.18)';
    g.lineWidth = 1;
    g.strokeRect(barX + 0.5, barY + 0.5, barW, barH);

    g.fillStyle = '#a796c9';
    g.font = `${Math.round(3.2 * s)}px monospace`;
    g.textBaseline = 'top';
    g.textAlign = 'left';
    g.fillText('FUEL', barX, barY + barH + 2 * s);
    g.textAlign = 'right';
    g.fillText(`${Math.floor(this.distance)} m`, barX + barW, barY + barH + 2 * s);
    if (this.boosting) {
      g.fillStyle = '#bfffe9';
      g.textAlign = 'center';
      g.fillText('BOOST', barX + barW / 2, barY + barH + 2 * s);
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
