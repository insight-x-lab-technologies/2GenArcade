import type { GameContext, GameModule, GameMeta } from '@/types';
import { clamp } from '@/engine';
import { starDefenderMeta } from './meta';
import {
  aabbHit,
  BULLET_SPEED,
  CHARGE_MAX,
  CHARGE_PER_KILL,
  clampOffsetX,
  COLS,
  DROP_STEP,
  EN_HH,
  EN_HW,
  enemyFireInterval,
  ENEMY_BULLET_SPEED,
  FIELD_H,
  FIELD_W,
  FIRE_INTERVAL,
  formationSpeed,
  homeX,
  homeY,
  invaded,
  NOVA_DURATION,
  NOVA_FIRE_INTERVAL,
  PLAYER_HH,
  PLAYER_HW,
  PLAYER_SPEED,
  PLAYER_Y,
  RESPAWN_INVULN,
  reverseIfEdge,
  rowPoints,
  rowsForWave,
  START_LIVES,
} from './logic';

const ROW_COLORS = ['#ff5d73', '#ffd27a', '#46d4c4', '#b06cff', '#7ea6ff'];
const STAR_COUNT = 40;
const NOVA_SPREAD = 46; // sideways speed of nova spread bullets
const WAVE_BREAK = 1.4; // seconds between waves

interface Bullet {
  x: number;
  y: number;
  prevX: number;
  prevY: number;
  vx: number;
}
interface EnemyBullet {
  x: number;
  y: number;
  prevY: number;
}
interface Wraith {
  col: number;
  row: number;
  points: number;
  color: string;
}
interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  max: number;
  color: string;
}
interface Star {
  x: number;
  y: number;
  speed: number;
  size: number;
}

const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;

export class StarDefenderGame implements GameModule {
  readonly meta: GameMeta = starDefenderMeta;

  private ctx!: GameContext;
  private g!: CanvasRenderingContext2D;

  private px = FIELD_W / 2;
  private prevPx = FIELD_W / 2;
  private lives = START_LIVES;
  private invuln = 0;

  private wave = 1;
  private breakTimer = 0;

  private wraiths: Wraith[] = [];
  private offsetX = 0;
  private offsetY = 0;
  private prevOffsetX = 0;
  private prevOffsetY = 0;
  private dir = 1;
  private speed = formationSpeed(1);

  private bullets: Bullet[] = [];
  private enemyBullets: EnemyBullet[] = [];
  private particles: Particle[] = [];
  private stars: Star[] = [];

  private fireTimer = 0;
  private enemyFireTimer = 1;

  private charge = 0;
  private nova = false;
  private novaTime = 0;
  private novaHeldPrev = false;

  private score = 0;
  private kills = 0;
  private novas = 0;

  private emitTimer = 0;
  private lastEmitted = -1;
  private flash = 0;
  private shake = 0;
  private gameOver = false;
  private firstBloodAwarded = false;
  private novaAwarded = false;

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
    this.lives = START_LIVES;
    this.invuln = 0;
    this.wave = 1;
    this.breakTimer = 0;
    this.bullets = [];
    this.enemyBullets = [];
    this.particles = [];
    this.fireTimer = 0;
    this.enemyFireTimer = 1;
    this.charge = 0;
    this.nova = false;
    this.novaTime = 0;
    this.novaHeldPrev = false;
    this.score = 0;
    this.kills = 0;
    this.novas = 0;
    this.emitTimer = 0;
    this.lastEmitted = -1;
    this.flash = 0;
    this.shake = 0;
    this.gameOver = false;
    this.firstBloodAwarded = false;
    this.novaAwarded = false;
    this.stars = Array.from({ length: STAR_COUNT }, () => ({
      x: Math.random() * FIELD_W,
      y: Math.random() * FIELD_H,
      speed: 6 + Math.random() * 18,
      size: 0.4 + Math.random() * 0.9,
    }));
    this.startWave(1);
  }

  private startWave(wave: number): void {
    const rows = rowsForWave(wave);
    this.wraiths = [];
    for (let row = 0; row < rows; row += 1) {
      for (let col = 0; col < COLS; col += 1) {
        this.wraiths.push({
          col,
          row,
          points: rowPoints(row, rows),
          color: ROW_COLORS[row % ROW_COLORS.length]!,
        });
      }
    }
    this.offsetX = 0;
    this.offsetY = 0;
    this.prevOffsetX = 0;
    this.prevOffsetY = 0;
    this.dir = 1;
    this.speed = formationSpeed(wave);
    this.enemyFireTimer = enemyFireInterval(wave);
  }

  private enemyX(w: Wraith, ox = this.offsetX): number {
    return homeX(w.col) + ox;
  }
  private enemyY(w: Wraith, oy = this.offsetY): number {
    return homeY(w.row) + oy;
  }

  // ---- Simulation -----------------------------------------------------------

  update(dt: number): void {
    if (this.gameOver) return;
    const input = this.ctx.input;

    // Snapshot for interpolation.
    this.prevPx = this.px;
    this.prevOffsetX = this.offsetX;
    this.prevOffsetY = this.offsetY;
    for (const b of this.bullets) {
      b.prevX = b.x;
      b.prevY = b.y;
    }
    for (const eb of this.enemyBullets) eb.prevY = eb.y;

    if (this.invuln > 0) this.invuln = Math.max(0, this.invuln - dt);
    if (this.flash > 0) this.flash = Math.max(0, this.flash - dt * 2.5);
    if (this.shake > 0) this.shake = Math.max(0, this.shake - dt * 3);

    // Steering (continuous via held inputs — no gesture lag).
    const sdir = (input.isHeld('right') ? 1 : 0) - (input.isHeld('left') ? 1 : 0);
    this.px = clamp(this.px + sdir * PLAYER_SPEED * dt, PLAYER_HW, FIELD_W - PLAYER_HW);

    // Nova trigger (rising edge on the nova button, when charged).
    const novaHeld = input.isButtonHeld('nova');
    if (novaHeld && !this.novaHeldPrev && !this.nova && this.charge >= CHARGE_MAX) {
      this.triggerNova();
    }
    this.novaHeldPrev = novaHeld;

    if (this.nova) {
      this.novaTime -= dt;
      this.charge = CHARGE_MAX * Math.max(0, this.novaTime / NOVA_DURATION);
      if (this.novaTime <= 0) {
        this.nova = false;
        this.charge = 0;
      }
    }

    this.fireWeapons(dt);
    this.moveBullets(dt);

    // Between waves: short breather, then the next (harder) wave.
    if (this.breakTimer > 0) {
      this.breakTimer -= dt;
      if (this.breakTimer <= 0) {
        this.wave += 1;
        this.startWave(this.wave);
      }
    } else {
      this.moveFormation(dt);
      this.enemyFire(dt);
    }

    this.resolveCollisions();
    this.updateParticles(dt);

    if (this.breakTimer <= 0 && this.wraiths.length === 0 && !this.gameOver) {
      this.breakTimer = WAVE_BREAK;
      this.score += 100; // wave-clear bonus
      this.ctx.audio.playSfx('wave');
    }

    this.emitTimer += dt;
    if (this.emitTimer >= 0.1) {
      this.emitTimer = 0;
      this.emitScore(false);
    }
  }

  private triggerNova(): void {
    this.nova = true;
    this.novaTime = NOVA_DURATION;
    this.novas += 1;
    this.enemyBullets = []; // the burst sweeps incoming fire away
    this.flash = Math.max(this.flash, 0.6);
    this.ctx.audio.playSfx('nova');
    if (!this.novaAwarded) {
      this.novaAwarded = true;
      this.ctx.emit.emit('trophy', { trophyId: 'nova' });
    }
  }

  private fireWeapons(dt: number): void {
    this.fireTimer -= dt;
    const y = PLAYER_Y - PLAYER_HH;
    // While Nova is active the ship auto-barrages a spread; otherwise the player
    // holds the fire button to shoot (parked at 0 so the next press is instant).
    if (this.nova) {
      if (this.fireTimer > 0) return;
      for (const vx of [-NOVA_SPREAD, 0, NOVA_SPREAD]) {
        this.bullets.push({ x: this.px, y, prevX: this.px, prevY: y, vx });
      }
      this.fireTimer = NOVA_FIRE_INTERVAL;
      return;
    }
    if (!this.ctx.input.isButtonHeld('fire')) {
      if (this.fireTimer < 0) this.fireTimer = 0;
      return;
    }
    if (this.fireTimer > 0) return;
    this.bullets.push({ x: this.px, y, prevX: this.px, prevY: y, vx: 0 });
    this.fireTimer = FIRE_INTERVAL;
    this.ctx.audio.playSfx('shoot');
  }

  private moveBullets(dt: number): void {
    for (const b of this.bullets) {
      b.x += b.vx * dt;
      b.y -= BULLET_SPEED * dt;
    }
    this.bullets = this.bullets.filter((b) => b.y > -4 && b.x > -4 && b.x < FIELD_W + 4);
    for (const eb of this.enemyBullets) eb.y += ENEMY_BULLET_SPEED * dt;
    this.enemyBullets = this.enemyBullets.filter((eb) => eb.y < FIELD_H + 4);
  }

  private moveFormation(dt: number): void {
    if (this.wraiths.length === 0) return;
    this.offsetX += this.dir * this.speed * dt;

    let minHome = Infinity;
    let maxHome = -Infinity;
    for (const w of this.wraiths) {
      const hx = homeX(w.col);
      if (hx < minHome) minHome = hx;
      if (hx > maxHome) maxHome = hx;
    }
    const leftEdge = minHome + this.offsetX - EN_HW;
    const rightEdge = maxHome + this.offsetX + EN_HW;
    const r = reverseIfEdge(leftEdge, rightEdge, this.dir);
    if (r.drop) {
      this.dir = r.dir;
      this.offsetY += DROP_STEP;
      this.offsetX = clampOffsetX(this.offsetX, minHome, maxHome);
    }
  }

  private enemyFire(dt: number): void {
    if (this.wraiths.length === 0) return;
    this.enemyFireTimer -= dt;
    if (this.enemyFireTimer > 0) return;
    // Prefer a front-most wraith per random column so shots feel "aimed".
    const shooter = this.wraiths[Math.floor(Math.random() * this.wraiths.length)]!;
    const x = this.enemyX(shooter);
    const y = this.enemyY(shooter) + EN_HH;
    this.enemyBullets.push({ x, y, prevY: y });
    this.enemyFireTimer = enemyFireInterval(this.wave) * (0.6 + Math.random() * 0.8);
  }

  private resolveCollisions(): void {
    // Player bullets vs wraiths.
    for (let i = this.wraiths.length - 1; i >= 0; i -= 1) {
      const w = this.wraiths[i]!;
      const ex = this.enemyX(w);
      const ey = this.enemyY(w);
      for (let j = this.bullets.length - 1; j >= 0; j -= 1) {
        const b = this.bullets[j]!;
        if (aabbHit(ex, ey, EN_HW, EN_HH, b.x, b.y, 1.2, 2.4)) {
          this.bullets.splice(j, 1);
          this.wraiths.splice(i, 1);
          this.kills += 1;
          this.score += w.points * (this.nova ? 2 : 1);
          this.charge = Math.min(CHARGE_MAX, this.charge + CHARGE_PER_KILL);
          this.spawnExplosion(ex, ey, w.color);
          this.ctx.audio.playSfx('explosion');
          if (!this.firstBloodAwarded) {
            this.firstBloodAwarded = true;
            this.ctx.emit.emit('trophy', { trophyId: 'firstBlood' });
          }
          break;
        }
      }
    }

    if (this.invuln <= 0 && !this.gameOver) {
      // Enemy bullets vs player.
      for (let j = this.enemyBullets.length - 1; j >= 0; j -= 1) {
        const eb = this.enemyBullets[j]!;
        if (aabbHit(this.px, PLAYER_Y, PLAYER_HW, PLAYER_HH, eb.x, eb.y, 1.2, 2.4)) {
          this.enemyBullets.splice(j, 1);
          this.loseLife();
          return;
        }
      }
      // Wraith colliding with the ship.
      for (const w of this.wraiths) {
        if (aabbHit(this.px, PLAYER_Y, PLAYER_HW, PLAYER_HH, this.enemyX(w), this.enemyY(w), EN_HW, EN_HH)) {
          this.loseLife();
          return;
        }
      }
    }

    // Invasion: a wraith reaches the danger line.
    let maxY = -Infinity;
    for (const w of this.wraiths) maxY = Math.max(maxY, this.enemyY(w));
    if (this.wraiths.length > 0 && invaded(maxY)) {
      this.endGame();
    }
  }

  private loseLife(): void {
    this.lives -= 1;
    this.invuln = RESPAWN_INVULN;
    this.shake = 1;
    this.flash = Math.max(this.flash, 0.5);
    this.spawnExplosion(this.px, PLAYER_Y, '#ffd27a');
    this.ctx.audio.playSfx('hit');
    if (this.lives <= 0) this.endGame();
  }

  private spawnExplosion(x: number, y: number, color: string): void {
    if (this.ctx.reducedMotion) {
      this.flash = Math.max(this.flash, 0.3);
      return;
    }
    const n = 9;
    for (let i = 0; i < n; i += 1) {
      const a = (Math.PI * 2 * i) / n + Math.random() * 0.5;
      const sp = 16 + Math.random() * 24;
      this.particles.push({
        x,
        y,
        vx: Math.cos(a) * sp,
        vy: Math.sin(a) * sp,
        life: 0.45,
        max: 0.45,
        color,
      });
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
    this.emitScore(true);
    this.ctx.audio.playSfx('gameover');
    this.ctx.emit.emit('gameover', {
      score: this.score,
      stats: { wave: this.wave, kills: this.kills, novas: this.novas },
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

    g.clearRect(0, 0, width, height);
    g.fillStyle = '#080514';
    g.fillRect(0, 0, width, height);

    this.drawStars(g, X, Y, s);
    this.drawWraiths(g, X, Y, s, alpha);
    this.drawEnemyBullets(g, X, Y, s, alpha);
    this.drawBullets(g, X, Y, s, alpha);
    this.drawParticles(g, X, Y, s);
    this.drawPlayer(g, X, Y, s, alpha);
    this.drawHud(g, X, Y, s, offX, offY);

    if (this.flash > 0) {
      g.fillStyle = this.nova
        ? `rgba(70,212,196,${this.flash * 0.3})`
        : `rgba(255,93,115,${this.flash * 0.3})`;
      g.fillRect(offX, offY, FIELD_W * s, FIELD_H * s);
    }
  }

  private drawStars(
    g: CanvasRenderingContext2D,
    X: (x: number) => number,
    Y: (y: number) => number,
    s: number,
  ): void {
    g.fillStyle = 'rgba(180,160,220,0.5)';
    for (const st of this.stars) {
      g.globalAlpha = 0.3 + st.size * 0.5;
      g.fillRect(X(st.x), Y(st.y), st.size * s, st.size * s);
    }
    g.globalAlpha = 1;
  }

  private drawWraiths(
    g: CanvasRenderingContext2D,
    X: (x: number) => number,
    Y: (y: number) => number,
    s: number,
    alpha: number,
  ): void {
    const ox = lerp(this.prevOffsetX, this.offsetX, alpha);
    const oy = lerp(this.prevOffsetY, this.offsetY, alpha);
    for (const w of this.wraiths) {
      const cx = X(this.enemyX(w, ox));
      const cy = Y(this.enemyY(w, oy));
      const hw = EN_HW * s;
      const hh = EN_HH * s;
      g.fillStyle = w.color;
      g.shadowColor = w.color;
      g.shadowBlur = 6;
      // Body: hexagonal wraith.
      g.beginPath();
      g.moveTo(cx, cy - hh);
      g.lineTo(cx + hw, cy - hh * 0.3);
      g.lineTo(cx + hw, cy + hh * 0.5);
      g.lineTo(cx, cy + hh);
      g.lineTo(cx - hw, cy + hh * 0.5);
      g.lineTo(cx - hw, cy - hh * 0.3);
      g.closePath();
      g.fill();
      g.shadowBlur = 0;
      // Eye.
      g.fillStyle = 'rgba(8,5,20,0.85)';
      g.fillRect(cx - hw * 0.45, cy - hh * 0.1, hw * 0.9, hh * 0.4);
    }
  }

  private drawEnemyBullets(
    g: CanvasRenderingContext2D,
    X: (x: number) => number,
    Y: (y: number) => number,
    s: number,
    alpha: number,
  ): void {
    g.fillStyle = '#ff9d5d';
    g.shadowColor = '#ff5d73';
    g.shadowBlur = 5;
    for (const eb of this.enemyBullets) {
      const y = lerp(eb.prevY, eb.y, alpha);
      g.fillRect(X(eb.x) - s * 0.7, Y(y) - s, s * 1.4, s * 3);
    }
    g.shadowBlur = 0;
  }

  private drawBullets(
    g: CanvasRenderingContext2D,
    X: (x: number) => number,
    Y: (y: number) => number,
    s: number,
    alpha: number,
  ): void {
    g.fillStyle = this.nova ? '#bffff0' : '#bfffe9';
    g.shadowColor = '#46d4c4';
    g.shadowBlur = 6;
    for (const b of this.bullets) {
      const x = lerp(b.prevX, b.x, alpha);
      const y = lerp(b.prevY, b.y, alpha);
      g.fillRect(X(x) - s * 0.5, Y(y) - s * 2, s, s * 3.4);
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
      g.fillStyle = p.color;
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
    if (this.gameOver) return;
    // Blink while invulnerable.
    if (this.invuln > 0 && !this.ctx.reducedMotion && Math.floor(this.invuln * 12) % 2 === 0) return;
    const x = lerp(this.prevPx, this.px, alpha);
    const cx = X(x);
    const cy = Y(PLAYER_Y);
    const hw = PLAYER_HW * s;
    const hh = PLAYER_HH * s;

    // Thruster.
    const flick = this.ctx.reducedMotion ? 1 : 0.7 + Math.random() * 0.6;
    g.fillStyle = this.nova ? '#bffff0' : '#ffb347';
    g.globalAlpha = 0.85;
    g.beginPath();
    g.moveTo(cx - hw * 0.4, cy + hh);
    g.lineTo(cx + hw * 0.4, cy + hh);
    g.lineTo(cx, cy + hh + hh * 1.1 * flick);
    g.closePath();
    g.fill();
    g.globalAlpha = 1;

    // Ship (arrow pointing up).
    g.fillStyle = this.nova ? '#bffff0' : '#ffd27a';
    g.shadowColor = this.nova ? '#46d4c4' : '#ffb347';
    g.shadowBlur = this.nova ? 12 : 8;
    g.beginPath();
    g.moveTo(cx, cy - hh);
    g.lineTo(cx + hw, cy + hh * 0.7);
    g.lineTo(cx + hw * 0.35, cy + hh * 0.4);
    g.lineTo(cx - hw * 0.35, cy + hh * 0.4);
    g.lineTo(cx - hw, cy + hh * 0.7);
    g.closePath();
    g.fill();
    g.shadowBlur = 0;
    // Cockpit.
    g.fillStyle = '#3a1d5e';
    g.beginPath();
    g.arc(cx, cy - hh * 0.05, hw * 0.28, 0, Math.PI * 2);
    g.fill();
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
    const barH = 3.4 * s;
    const ratio = this.charge / CHARGE_MAX;
    g.fillStyle = 'rgba(20,11,43,0.85)';
    g.fillRect(barX, barY, barW, barH);
    g.fillStyle = this.nova ? '#46d4c4' : ratio >= 1 ? '#bfffe9' : '#7ea6ff';
    g.fillRect(barX, barY, barW * clamp(ratio, 0, 1), barH);
    g.strokeStyle = 'rgba(255,255,255,0.18)';
    g.lineWidth = 1;
    g.strokeRect(barX + 0.5, barY + 0.5, barW, barH);

    g.font = `${Math.round(3.2 * s)}px monospace`;
    g.textBaseline = 'top';
    g.fillStyle = '#a796c9';
    g.textAlign = 'left';
    const label = this.ctx.i18n(
      this.nova ? 'starDefender:hudNova' : ratio >= 1 ? 'starDefender:hudReady' : 'starDefender:hudCharge',
    );
    g.fillText(label.toUpperCase(), barX, barY + barH + 2 * s);

    // Lives as little ship glyphs (top-right).
    g.textAlign = 'right';
    g.fillStyle = '#ffd27a';
    g.fillText('▲'.repeat(Math.max(0, this.lives)), barX + barW, barY + barH + 2 * s);

    // Wave banner during the breather.
    if (this.breakTimer > 0) {
      g.fillStyle = 'rgba(126,166,255,0.95)';
      g.font = `${Math.round(8 * s)}px monospace`;
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      const label2 = this.ctx.i18n('starDefender:waveBanner', { wave: this.wave + 1 });
      g.fillText(label2, offX + (FIELD_W * s) / 2, offY + (FIELD_H * s) / 2);
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
