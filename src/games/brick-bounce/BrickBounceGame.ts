import type { GameContext, GameModule, GameMeta } from '@/types';
import { clamp, lerp } from '@/engine';
import { brickBounceMeta } from './meta';
import {
  aabbHit,
  BALL_R,
  BLAZE_DROP_ON_MISS,
  BLAZE_DURATION,
  BLAZE_MAX,
  BLAZE_PER_HIT,
  BLAZE_SPEED_BONUS,
  BOLT_SPEED,
  BRICK_TOP,
  brickCenterX,
  brickCenterY,
  brickHalfH,
  brickHalfW,
  brickHp,
  brickPoints,
  brickReflection,
  circleRectHit,
  DROP_CHANCE,
  EXPLOSION_RADIUS,
  FIELD_H,
  FIELD_W,
  levelBallSpeed,
  MAX_BOUNCE,
  MOVER_SPEED,
  PADDLE_HH,
  PADDLE_HW_BASE,
  PADDLE_HW_WIDE,
  PADDLE_SPEED,
  PADDLE_Y,
  paddleBounce,
  pickBrickKind,
  pickPowerKind,
  POWERS,
  POWERUP_FALL,
  POWERUP_R,
  REGEN_DELAY,
  rowsForLevel,
  SLOW_FACTOR,
  WALL,
  type BrickKind,
  type PowerKind,
} from './logic';

// Brick colours keyed by current hit points (1..5): sturdier bricks read hotter.
const HP_COLORS = ['#7ea6ff', '#46d4c4', '#9dffb0', '#ffd27a', '#ff7a5d'];
const MAX_BALLS = 8;
const LEVEL_BREAK = 1.6; // seconds of "Level N" banner between fields
const WALL_SFX_GAP = 0.05; // throttle wall pings

interface Ball {
  x: number;
  y: number;
  prevX: number;
  prevY: number;
  vx: number;
  vy: number;
  stuck: boolean;
  rel: number; // offset on the paddle while stuck, in [-1, 1]
}
interface Brick {
  x: number;
  y: number;
  hw: number;
  hh: number;
  hp: number;
  maxHp: number;
  flash: number;
  kind: BrickKind;
  vx: number; // mover drift (units/s)
  regen: number; // regen countdown (s); >0 means a heal is pending
  dead: boolean; // marked during a hit pass, swept after
}
interface PowerUp {
  x: number;
  y: number;
  prevY: number;
  kind: PowerKind;
}
interface Bolt {
  x: number;
  y: number;
  prevY: number;
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

export class BrickBounceGame implements GameModule {
  readonly meta: GameMeta = brickBounceMeta;

  private ctx!: GameContext;
  private g!: CanvasRenderingContext2D;

  private px = FIELD_W / 2;
  private prevPx = FIELD_W / 2;
  private paddleHW = PADDLE_HW_BASE;

  private balls: Ball[] = [];
  private bricks: Brick[] = [];
  private powerups: PowerUp[] = [];
  private bolts: Bolt[] = [];
  private particles: Particle[] = [];

  private level = 1;
  private lives = 3;
  private score = 0;
  private speed = levelBallSpeed(1);

  // Blaze meter / Blaze Ball.
  private blaze = 0;
  private blazeTime = 0;

  // Power-up effect timers (seconds remaining).
  private fxWiden = 0;
  private fxSlow = 0;
  private fxCatch = 0;
  private fxCannon = 0;
  private fxShield = 0;
  private boltTimer = 0;

  private levelBreak = 0;
  private upPrev = false;
  private blazePrev = false;
  private wallSfxCd = 0;

  // Feedback.
  private flash = 0;
  private shake = 0;
  private toast = '';
  private toastTime = 0;

  // Stats / trophy flags.
  private bricksBroken = 0;
  private chainKills = 0;
  private blazes = 0;
  private levelsCleared = 0;
  private powerupsTaken = 0;
  private livesLostThisLevel = 0;

  private emitTimer = 0;
  private lastEmitted = -1;
  private gameOver = false;
  private firstBrickAwarded = false;
  private blazeAwarded = false;

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
    this.paddleHW = PADDLE_HW_BASE;
    this.balls = [];
    this.powerups = [];
    this.bolts = [];
    this.particles = [];
    this.level = 1;
    this.lives = 3;
    this.score = 0;
    this.speed = levelBallSpeed(1);
    this.blaze = 0;
    this.blazeTime = 0;
    this.fxWiden = 0;
    this.fxSlow = 0;
    this.fxCatch = 0;
    this.fxCannon = 0;
    this.fxShield = 0;
    this.boltTimer = 0;
    this.levelBreak = 0;
    this.upPrev = false;
    this.blazePrev = false;
    this.wallSfxCd = 0;
    this.flash = 0;
    this.shake = 0;
    this.toast = '';
    this.toastTime = 0;
    this.bricksBroken = 0;
    this.chainKills = 0;
    this.blazes = 0;
    this.levelsCleared = 0;
    this.powerupsTaken = 0;
    this.livesLostThisLevel = 0;
    this.emitTimer = 0;
    this.lastEmitted = -1;
    this.gameOver = false;
    this.firstBrickAwarded = false;
    this.blazeAwarded = false;
    this.buildField(1);
    this.spawnBallOnPaddle();
  }

  private buildField(level: number): void {
    this.bricks = [];
    const rows = rowsForLevel(level);
    const hw = brickHalfW();
    const hh = brickHalfH();
    for (let row = 0; row < rows; row += 1) {
      for (let col = 0; col < 9; col += 1) {
        // A sparse, symmetric gap pattern keeps fields readable and varied.
        if (level > 1 && (row + col) % 7 === level % 7) continue;
        const hp = brickHp(row, rows, level);
        const kind = pickBrickKind(level, Math.random());
        this.bricks.push({
          x: brickCenterX(col),
          y: brickCenterY(row),
          hw,
          hh,
          hp,
          maxHp: hp,
          flash: 0,
          kind,
          vx: kind === 'mover' ? (Math.random() < 0.5 ? -MOVER_SPEED : MOVER_SPEED) : 0,
          regen: 0,
          dead: false,
        });
      }
    }
    // Safety: never let an (improbable) all-steel field clear instantly.
    if (this.bricks.length > 0 && !this.bricks.some((br) => br.kind !== 'steel')) {
      const b = this.bricks[0]!;
      b.kind = 'normal';
      b.vx = 0;
    }
    this.speed = levelBallSpeed(level);
  }

  private spawnBallOnPaddle(): void {
    this.balls = [
      {
        x: this.px,
        y: PADDLE_Y - PADDLE_HH - BALL_R,
        prevX: this.px,
        prevY: PADDLE_Y - PADDLE_HH - BALL_R,
        vx: 0,
        vy: 0,
        stuck: true,
        rel: 0,
      },
    ];
  }

  // ---- Simulation -----------------------------------------------------------

  update(dt: number): void {
    if (this.gameOver) return;
    const input = this.ctx.input;

    this.prevPx = this.px;
    for (const b of this.balls) {
      b.prevX = b.x;
      b.prevY = b.y;
    }
    for (const p of this.powerups) p.prevY = p.y;
    for (const bo of this.bolts) bo.prevY = bo.y;

    this.tickTimers(dt);

    // Paddle steering (continuous via held inputs — no gesture lag).
    const sdir = (input.isHeld('right') ? 1 : 0) - (input.isHeld('left') ? 1 : 0);
    this.px = clamp(
      this.px + sdir * PADDLE_SPEED * dt,
      WALL + this.paddleHW,
      FIELD_W - WALL - this.paddleHW,
    );

    // Launch stuck balls on a rising "up" edge.
    const up = input.isHeld('up');
    if (up && !this.upPrev) this.launchStuck();
    this.upPrev = up;

    // Blaze is fired manually (F.1): the meter charges, then the player picks
    // the moment to ignite the piercing, double-score Blaze Ball.
    const blaze = input.isButtonHeld('blaze');
    if (blaze && !this.blazePrev) this.igniteBlaze();
    this.blazePrev = blaze;

    if (this.levelBreak > 0) {
      this.levelBreak -= dt;
      if (this.levelBreak <= 0) this.startLevel(this.level);
    }

    this.updateBricks(dt);
    this.moveBalls(dt);
    this.updateCannon(dt);
    this.moveBolts(dt);
    this.movePowerups(dt);
    this.updateParticles(dt);

    // Field cleared once no *breakable* bricks remain (steel never counts).
    const breakableLeft = this.bricks.some((br) => br.kind !== 'steel');
    if (!breakableLeft && this.levelBreak <= 0 && !this.gameOver) {
      this.levelsCleared += 1;
      this.score += 250; // clear bonus
      this.level += 1;
      this.levelBreak = LEVEL_BREAK;
      this.showToast(this.ctx.i18n('brickBounce:levelClear'));
      this.ctx.audio.playSfx('levelClear');
    }

    this.emitTimer += dt;
    if (this.emitTimer >= 0.1) {
      this.emitTimer = 0;
      this.emitScore(false);
    }
  }

  private tickTimers(dt: number): void {
    if (this.wallSfxCd > 0) this.wallSfxCd -= dt;
    if (this.flash > 0) this.flash = Math.max(0, this.flash - dt * 2.5);
    if (this.shake > 0) this.shake = Math.max(0, this.shake - dt * 3);
    if (this.toastTime > 0) this.toastTime = Math.max(0, this.toastTime - dt);
    for (const br of this.bricks) if (br.flash > 0) br.flash = Math.max(0, br.flash - dt * 4);

    if (this.fxSlow > 0) this.fxSlow = Math.max(0, this.fxSlow - dt);
    if (this.fxCatch > 0) this.fxCatch = Math.max(0, this.fxCatch - dt);
    if (this.fxCannon > 0) this.fxCannon = Math.max(0, this.fxCannon - dt);
    if (this.fxShield > 0) this.fxShield = Math.max(0, this.fxShield - dt);
    if (this.fxWiden > 0) this.fxWiden = Math.max(0, this.fxWiden - dt);
    if (this.blazeTime > 0) {
      this.blazeTime = Math.max(0, this.blazeTime - dt);
      if (this.blazeTime <= 0) this.blaze = 0;
    }

    // Paddle eases toward its target width.
    const targetHW = this.fxWiden > 0 ? PADDLE_HW_WIDE : PADDLE_HW_BASE;
    this.paddleHW += (targetHW - this.paddleHW) * Math.min(1, dt * 8);
  }

  private launchStuck(): void {
    let launched = false;
    for (const b of this.balls) {
      if (!b.stuck) continue;
      // Always serve at a lively angle (toward the field centre) so the ball
      // never just oscillates straight up and down.
      const dirSign = this.px < FIELD_W / 2 ? 1 : -1;
      const aim = clamp(b.rel * 0.5 + dirSign * 0.28, -1, 1);
      const v = paddleBounce(aim, this.ballSpeed(), MAX_BOUNCE);
      b.vx = v.vx;
      b.vy = v.vy;
      b.stuck = false;
      launched = true;
    }
    if (launched) this.ctx.audio.playSfx('paddle');
  }

  private ballSpeed(): number {
    let s = this.speed;
    if (this.blazeTime > 0) s += BLAZE_SPEED_BONUS;
    if (this.fxSlow > 0) s *= SLOW_FACTOR;
    return s;
  }

  private moveBalls(dt: number): void {
    const speed = this.ballSpeed();
    const blazing = this.blazeTime > 0;
    for (const b of this.balls) {
      if (b.stuck) {
        b.x = clamp(this.px + b.rel * this.paddleHW, WALL + BALL_R, FIELD_W - WALL - BALL_R);
        b.y = PADDLE_Y - PADDLE_HH - BALL_R;
        continue;
      }
      // Re-normalise to the current target speed (keeps energy constant).
      const mag = Math.hypot(b.vx, b.vy) || 1;
      b.vx = (b.vx / mag) * speed;
      b.vy = (b.vy / mag) * speed;
      b.x += b.vx * dt;
      b.y += b.vy * dt;

      this.wallBounce(b);
      this.paddleBounceBall(b);
      this.brickCollisions(b, blazing);
    }

    // Cull fallen balls; a shield saves them while active.
    const floor = FIELD_H + BALL_R * 2;
    this.balls = this.balls.filter((b) => b.y <= floor);
    if (this.balls.length === 0 && !this.gameOver) this.loseLife();
  }

  private wallBounce(b: Ball): void {
    let pinged = false;
    if (b.x < WALL + BALL_R) {
      b.x = WALL + BALL_R;
      b.vx = Math.abs(b.vx);
      pinged = true;
    } else if (b.x > FIELD_W - WALL - BALL_R) {
      b.x = FIELD_W - WALL - BALL_R;
      b.vx = -Math.abs(b.vx);
      pinged = true;
    }
    if (b.y < WALL + BALL_R) {
      b.y = WALL + BALL_R;
      b.vy = Math.abs(b.vy);
      pinged = true;
    }
    // Shield: a floor barrier that kicks the ball back up while active.
    if (this.fxShield > 0 && b.vy > 0 && b.y > PADDLE_Y + 4 - BALL_R) {
      b.y = PADDLE_Y + 4 - BALL_R;
      b.vy = -Math.abs(b.vy);
      pinged = true;
    }
    if (pinged && this.wallSfxCd <= 0) {
      this.wallSfxCd = WALL_SFX_GAP;
      this.ctx.audio.playSfx('wall');
    }
  }

  private paddleBounceBall(b: Ball): void {
    if (b.vy <= 0) return;
    if (!circleRectHit(b.x, b.y, BALL_R, this.px, PADDLE_Y, this.paddleHW, PADDLE_HH)) return;
    const rel = clamp((b.x - this.px) / this.paddleHW, -1, 1);
    if (this.fxCatch > 0) {
      b.stuck = true;
      b.rel = rel;
      b.vx = 0;
      b.vy = 0;
    } else {
      const v = paddleBounce(rel, this.ballSpeed(), MAX_BOUNCE);
      b.vx = v.vx;
      b.vy = v.vy;
      b.y = PADDLE_Y - PADDLE_HH - BALL_R;
      this.ctx.audio.playSfx('paddle');
    }
  }

  private brickCollisions(b: Ball, blazing: boolean): void {
    let reflected = false;
    for (const br of this.bricks) {
      if (br.dead) continue;
      const ref = brickReflection(b.x, b.y, BALL_R, br.x, br.y, br.hw, br.hh);
      if (!ref.hit) continue;

      this.hitBrick(br, blazing ? Math.max(1, br.hp) : 1);

      // The Blaze Ball ploughs through everything except steel, which still
      // reflects it. A normal ball reflects off the first brick it touches.
      if (blazing && br.kind !== 'steel') continue;
      if (!reflected) {
        if (ref.flipX) b.vx = -b.vx;
        if (ref.flipY) b.vy = -b.vy;
        if (ref.flipX) b.x += Math.sign(b.x - br.x) * 0.4;
        if (ref.flipY) b.y += Math.sign(b.y - br.y) * 0.4;
        reflected = true;
      }
      if (!blazing) break; // one reflection per ball per tick
    }
    this.sweepDead();
  }

  /** A single brick takes a hit. Steel shrugs it off; others lose hp and may die. */
  private hitBrick(br: Brick, dmg: number): void {
    if (br.dead) return;
    if (br.kind === 'steel') {
      br.flash = 1;
      this.ctx.audio.playSfx('brickHit');
      return;
    }
    this.blaze = Math.min(BLAZE_MAX, this.blaze + BLAZE_PER_HIT);
    br.hp -= dmg;
    if (br.hp > 0) {
      br.flash = 1;
      if (br.kind === 'regen') br.regen = REGEN_DELAY; // schedule a heal
      this.ctx.audio.playSfx('brickHit');
      return;
    }
    this.killBrick(br, false);
  }

  /** Destroy a brick: score, particles, drops, and explosive chain reactions. */
  private killBrick(br: Brick, chained: boolean): void {
    if (br.dead) return;
    br.dead = true;
    this.bricksBroken += 1;
    if (chained) {
      this.chainKills += 1;
      if (this.chainKills >= 20) this.ctx.emit.emit('trophy', { trophyId: 'chainReaction' });
    }
    this.score += brickPoints(br.maxHp) * (this.blazeTime > 0 ? 2 : 1);
    this.spawnBrickBurst(br);
    this.ctx.audio.playSfx(br.kind === 'explosive' ? 'blaze' : 'brickBreak');
    if (!this.firstBrickAwarded) {
      this.firstBrickAwarded = true;
      this.ctx.emit.emit('trophy', { trophyId: 'firstBrick' });
    }
    if (Math.random() < DROP_CHANCE) this.dropPowerUp(br.x, br.y);
    if (br.kind === 'explosive') this.explode(br);
  }

  /** Explosive chain: destroy non-steel neighbours within the blast radius. */
  private explode(src: Brick): void {
    this.shake = Math.max(this.shake, 0.8);
    this.flash = Math.max(this.flash, 0.4);
    for (const br of this.bricks) {
      if (br.dead || br === src || br.kind === 'steel') continue;
      if (Math.hypot(br.x - src.x, br.y - src.y) <= EXPLOSION_RADIUS) {
        this.killBrick(br, true); // recurses for chained explosives (dead-guarded)
      }
    }
  }

  private sweepDead(): void {
    if (this.bricks.some((br) => br.dead)) this.bricks = this.bricks.filter((br) => !br.dead);
  }

  /** Movers drift and bounce; regen bricks slowly heal after being chipped. */
  private updateBricks(dt: number): void {
    for (const br of this.bricks) {
      if (br.kind === 'mover') {
        br.x += br.vx * dt;
        const lo = WALL + br.hw;
        const hi = FIELD_W - WALL - br.hw;
        if (br.x < lo) {
          br.x = lo;
          br.vx = Math.abs(br.vx);
        } else if (br.x > hi) {
          br.x = hi;
          br.vx = -Math.abs(br.vx);
        }
      } else if (br.kind === 'regen' && br.regen > 0) {
        br.regen -= dt;
        if (br.regen <= 0 && br.hp < br.maxHp) {
          br.hp += 1;
          br.flash = 0.6;
          if (br.hp < br.maxHp) br.regen = REGEN_DELAY;
        }
      }
    }
  }

  private igniteBlaze(): void {
    if (this.blazeTime > 0 || this.blaze < BLAZE_MAX) return;
    this.blazeTime = BLAZE_DURATION;
    this.blazes += 1;
    this.flash = Math.max(this.flash, 0.5);
    this.showToast(this.ctx.i18n('brickBounce:blazeOn'));
    this.ctx.audio.playSfx('blaze');
    if (!this.blazeAwarded) {
      this.blazeAwarded = true;
      this.ctx.emit.emit('trophy', { trophyId: 'blazeRunner' });
    }
  }

  private dropPowerUp(x: number, y: number): void {
    const kind = pickPowerKind(Math.random());
    this.powerups.push({ x, y, prevY: y, kind });
  }

  private updateCannon(dt: number): void {
    if (this.fxCannon <= 0) {
      this.boltTimer = 0;
      return;
    }
    this.boltTimer -= dt;
    if (this.boltTimer <= 0) {
      this.boltTimer = 0.32;
      const y = PADDLE_Y - PADDLE_HH;
      this.bolts.push({ x: this.px - this.paddleHW * 0.8, y, prevY: y });
      this.bolts.push({ x: this.px + this.paddleHW * 0.8, y, prevY: y });
      this.ctx.audio.playSfx('bolt');
    }
  }

  private moveBolts(dt: number): void {
    for (const bo of this.bolts) bo.y -= BOLT_SPEED * dt;
    for (let bi = this.bolts.length - 1; bi >= 0; bi -= 1) {
      const bo = this.bolts[bi]!;
      if (bo.y < -2) {
        this.bolts.splice(bi, 1);
        continue;
      }
      for (const br of this.bricks) {
        if (br.dead) continue;
        if (aabbHit(bo.x, bo.y, 0.6, 1.6, br.x, br.y, br.hw, br.hh)) {
          this.bolts.splice(bi, 1);
          this.hitBrick(br, 1);
          this.sweepDead();
          break;
        }
      }
    }
  }

  private movePowerups(dt: number): void {
    for (const p of this.powerups) p.y += POWERUP_FALL * dt;
    for (let i = this.powerups.length - 1; i >= 0; i -= 1) {
      const p = this.powerups[i]!;
      if (p.y > FIELD_H + POWERUP_R) {
        this.powerups.splice(i, 1);
        continue;
      }
      if (circleRectHit(p.x, p.y, POWERUP_R, this.px, PADDLE_Y, this.paddleHW, PADDLE_HH + 1)) {
        this.powerups.splice(i, 1);
        this.applyPowerUp(p.kind);
      }
    }
  }

  private applyPowerUp(kind: PowerKind): void {
    this.powerupsTaken += 1;
    const dur = POWERS[kind].duration;
    switch (kind) {
      case 'widen':
        this.fxWiden = dur;
        break;
      case 'slow':
        this.fxSlow = dur;
        break;
      case 'catch':
        this.fxCatch = dur;
        break;
      case 'cannon':
        this.fxCannon = dur;
        break;
      case 'shield':
        this.fxShield = dur;
        break;
      case 'multi':
        this.splitBalls();
        break;
      case 'bonus':
        this.score += 500;
        break;
    }
    this.flash = Math.max(this.flash, 0.25);
    this.showToast(this.ctx.i18n(`brickBounce:powers.${kind}`));
    this.ctx.audio.playSfx('powerup');
    if (this.powerupsTaken >= 10) this.ctx.emit.emit('trophy', { trophyId: 'magpie' });
  }

  private splitBalls(): void {
    const active = this.balls.filter((b) => !b.stuck);
    const source = active.length > 0 ? active : this.balls;
    const fresh: Ball[] = [];
    for (const b of source) {
      if (this.balls.length + fresh.length >= MAX_BALLS) break;
      const speed = this.ballSpeed();
      const base = Math.atan2(b.vy || -1, b.vx || 0);
      for (const da of [-0.35, 0.35]) {
        if (this.balls.length + fresh.length >= MAX_BALLS) break;
        const a = base + da;
        fresh.push({
          x: b.x,
          y: b.y,
          prevX: b.x,
          prevY: b.y,
          vx: Math.cos(a) * speed,
          vy: Math.sin(a) * speed,
          stuck: false,
          rel: 0,
        });
      }
    }
    this.balls.push(...fresh);
  }

  private loseLife(): void {
    this.lives -= 1;
    this.livesLostThisLevel += 1;
    this.blaze = Math.max(0, this.blaze - BLAZE_DROP_ON_MISS);
    this.blazeTime = 0;
    this.shake = 1;
    this.flash = Math.max(this.flash, 0.5);
    this.ctx.audio.playSfx('life');
    if (this.lives <= 0) {
      this.endGame();
      return;
    }
    // Reset power-up state and serve a fresh ball on the paddle.
    this.fxCannon = 0;
    this.fxCatch = 0;
    this.spawnBallOnPaddle();
  }

  private startLevel(level: number): void {
    this.buildField(level);
    this.livesLostThisLevel = 0;
    this.spawnBallOnPaddle();
    if (level >= 5) this.ctx.emit.emit('trophy', { trophyId: 'veteran' });
  }

  private spawnBrickBurst(br: Brick): void {
    if (this.ctx.reducedMotion) return;
    const color = HP_COLORS[Math.min(br.maxHp - 1, HP_COLORS.length - 1)]!;
    const n = 8;
    for (let i = 0; i < n; i += 1) {
      const a = (Math.PI * 2 * i) / n + Math.random() * 0.5;
      const sp = 14 + Math.random() * 22;
      this.particles.push({
        x: br.x,
        y: br.y,
        vx: Math.cos(a) * sp,
        vy: Math.sin(a) * sp,
        life: 0.4,
        max: 0.4,
        color,
      });
    }
  }

  private updateParticles(dt: number): void {
    for (const p of this.particles) {
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += 36 * dt; // light gravity
      p.life -= dt;
    }
    this.particles = this.particles.filter((p) => p.life > 0);
  }

  private showToast(text: string): void {
    this.toast = text;
    this.toastTime = 1.4;
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
      stats: {
        level: this.level,
        bricks: this.bricksBroken,
        chainKills: this.chainKills,
        blazes: this.blazes,
        levelsCleared: this.levelsCleared,
        powerups: this.powerupsTaken,
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

    g.clearRect(0, 0, width, height);
    g.fillStyle = '#0b0818';
    g.fillRect(0, 0, width, height);

    this.drawFrame(g, X, Y, s);
    this.drawBricks(g, X, Y, s);
    this.drawPowerups(g, X, Y, s, alpha);
    this.drawBolts(g, X, Y, s, alpha);
    this.drawParticles(g, X, Y, s);
    const pxLerp = lerp(this.prevPx, this.px, alpha);
    this.drawShield(g, X, Y, s);
    this.drawPaddle(g, X, Y, s, pxLerp);
    this.drawAimLine(g, X, Y, s);
    this.drawBalls(g, X, Y, s, alpha);
    this.drawHud(g, X, Y, s, offX, offY);

    if (this.flash > 0) {
      g.fillStyle =
        this.blazeTime > 0
          ? `rgba(255,122,93,${this.flash * 0.3})`
          : `rgba(126,166,255,${this.flash * 0.25})`;
      g.fillRect(offX, offY, FIELD_W * s, FIELD_H * s);
    }
  }

  private drawFrame(
    g: CanvasRenderingContext2D,
    X: (x: number) => number,
    Y: (y: number) => number,
    s: number,
  ): void {
    g.strokeStyle = 'rgba(126,166,255,0.5)';
    g.lineWidth = Math.max(1, s * 0.6);
    g.strokeRect(X(WALL * 0.5), Y(WALL * 0.5), (FIELD_W - WALL) * s, (FIELD_H - WALL * 0.5) * s);
  }

  private drawBricks(
    g: CanvasRenderingContext2D,
    X: (x: number) => number,
    Y: (y: number) => number,
    s: number,
  ): void {
    const MARKER: Partial<Record<BrickKind, string>> = {
      steel: '▦',
      explosive: '✸',
      mover: '↔',
      regen: '✚',
    };
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    for (const br of this.bricks) {
      const hpColor = HP_COLORS[Math.min(br.hp - 1, HP_COLORS.length - 1)]!;
      const color =
        br.kind === 'steel' ? '#9aa6bf' : br.kind === 'explosive' ? '#ff7a5d' : hpColor;
      const x = X(br.x - br.hw);
      const y = Y(br.y - br.hh);
      const w = br.hw * 2 * s;
      const h = br.hh * 2 * s;
      g.fillStyle = color;
      g.shadowColor = color;
      g.shadowBlur = br.kind === 'explosive' ? 9 : 5;
      g.fillRect(x, y, w, h);
      g.shadowBlur = 0;
      // Inner highlight + flash on a non-lethal hit.
      g.fillStyle = br.flash > 0 ? `rgba(255,255,255,${0.2 + br.flash * 0.5})` : 'rgba(255,255,255,0.14)';
      g.fillRect(x, y, w, h * 0.32);
      // Regen pending → green pulsing outline.
      if (br.kind === 'regen' && br.regen > 0) {
        const pulse = this.ctx.reducedMotion ? 0.6 : 0.4 + 0.3 * Math.sin(br.regen * 6);
        g.strokeStyle = `rgba(157,255,176,${pulse})`;
        g.lineWidth = Math.max(1, s * 0.5);
        g.strokeRect(x + 1, y + 1, w - 2, h - 2);
      }
      // Kind marker glyph.
      const marker = MARKER[br.kind];
      if (marker) {
        g.fillStyle = 'rgba(11,8,24,0.7)';
        g.font = `bold ${Math.round(3 * s)}px monospace`;
        g.fillText(marker, x + w / 2, y + h / 2 + 0.3 * s);
      }
    }
  }

  private drawPaddle(
    g: CanvasRenderingContext2D,
    X: (x: number) => number,
    Y: (y: number) => number,
    s: number,
    px: number,
  ): void {
    if (this.gameOver) return;
    const x = X(px - this.paddleHW);
    const y = Y(PADDLE_Y - PADDLE_HH);
    const w = this.paddleHW * 2 * s;
    const h = PADDLE_HH * 2 * s;
    const glow = this.fxCannon > 0 ? '#ff7a5d' : this.fxCatch > 0 ? '#b06cff' : '#46d4c4';
    g.fillStyle = glow;
    g.shadowColor = glow;
    g.shadowBlur = 8;
    g.fillRect(x, y, w, h);
    g.shadowBlur = 0;
    g.fillStyle = 'rgba(255,255,255,0.3)';
    g.fillRect(x, y, w, h * 0.4);
    if (this.fxCannon > 0) {
      g.fillStyle = '#ffd27a';
      g.fillRect(X(px - this.paddleHW * 0.8) - s * 0.6, y - s, s * 1.2, s * 1.4);
      g.fillRect(X(px + this.paddleHW * 0.8) - s * 0.6, y - s, s * 1.2, s * 1.4);
    }
  }

  /** Serve aim preview (F.1): trace where the waiting ball would launch, with a
   *  couple of wall bounces, so the player can read the angle before serving. */
  private drawAimLine(
    g: CanvasRenderingContext2D,
    X: (x: number) => number,
    Y: (y: number) => number,
    s: number,
  ): void {
    if (this.gameOver || this.levelBreak > 0) return;
    const ball = this.balls.find((b) => b.stuck);
    if (!ball) return;

    // Mirror launchStuck()'s serve angle so the preview matches the real shot.
    const dirSign = this.px < FIELD_W / 2 ? 1 : -1;
    const aim = clamp(ball.rel * 0.5 + dirSign * 0.28, -1, 1);
    const v = paddleBounce(aim, this.ballSpeed(), MAX_BOUNCE);
    const mag = Math.hypot(v.vx, v.vy) || 1;
    let dx = v.vx / mag;
    const dy = v.vy / mag; // serve always heads up; only side walls flip dx
    let x = ball.x;
    let y = ball.y;

    const pts: Array<[number, number]> = [[x, y]];
    const stepLen = 2.4;
    let bounces = 0;
    for (let i = 0; i < 90 && bounces < 3; i += 1) {
      x += dx * stepLen;
      y += dy * stepLen;
      if (x < WALL + BALL_R) {
        x = WALL + BALL_R;
        dx = Math.abs(dx);
        bounces += 1;
      } else if (x > FIELD_W - WALL - BALL_R) {
        x = FIELD_W - WALL - BALL_R;
        dx = -Math.abs(dx);
        bounces += 1;
      }
      pts.push([x, y]);
      if (y <= BRICK_TOP + BALL_R) break; // stop at the brick field
    }

    g.strokeStyle = 'rgba(255,228,108,0.45)';
    g.lineWidth = Math.max(1, s * 0.4);
    g.setLineDash([s * 1.6, s * 1.6]);
    g.beginPath();
    pts.forEach(([px, py], i) => (i === 0 ? g.moveTo(X(px), Y(py)) : g.lineTo(X(px), Y(py))));
    g.stroke();
    g.setLineDash([]);
  }

  private drawShield(
    g: CanvasRenderingContext2D,
    X: (x: number) => number,
    Y: (y: number) => number,
    s: number,
  ): void {
    if (this.fxShield <= 0) return;
    const pulse = this.ctx.reducedMotion ? 0.5 : 0.35 + 0.25 * Math.sin(this.fxShield * 6);
    g.strokeStyle = `rgba(157,255,176,${pulse})`;
    g.lineWidth = Math.max(1, s * 0.8);
    const y = Y(PADDLE_Y + 4);
    g.beginPath();
    g.moveTo(X(WALL), y);
    g.lineTo(X(FIELD_W - WALL), y);
    g.stroke();
  }

  private drawBalls(
    g: CanvasRenderingContext2D,
    X: (x: number) => number,
    Y: (y: number) => number,
    s: number,
    alpha: number,
  ): void {
    const blazing = this.blazeTime > 0;
    for (const b of this.balls) {
      const x = b.stuck ? b.x : lerp(b.prevX, b.x, alpha);
      const y = b.stuck ? b.y : lerp(b.prevY, b.y, alpha);
      g.fillStyle = blazing ? '#ffe46c' : '#ffffff';
      g.shadowColor = blazing ? '#ff7a5d' : '#46d4c4';
      g.shadowBlur = blazing ? 14 : 8;
      g.beginPath();
      g.arc(X(x), Y(y), BALL_R * s, 0, Math.PI * 2);
      g.fill();
      g.shadowBlur = 0;
    }
  }

  private drawPowerups(
    g: CanvasRenderingContext2D,
    X: (x: number) => number,
    Y: (y: number) => number,
    s: number,
    alpha: number,
  ): void {
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.font = `bold ${Math.round(3.4 * s)}px monospace`;
    for (const p of this.powerups) {
      const y = lerp(p.prevY, p.y, alpha);
      const spec = POWERS[p.kind];
      g.fillStyle = spec.color;
      g.shadowColor = spec.color;
      g.shadowBlur = 6;
      g.beginPath();
      g.arc(X(p.x), Y(y), POWERUP_R * s, 0, Math.PI * 2);
      g.fill();
      g.shadowBlur = 0;
      g.fillStyle = '#0b0818';
      g.fillText(spec.letter, X(p.x), Y(y) + 0.2 * s);
    }
  }

  private drawBolts(
    g: CanvasRenderingContext2D,
    X: (x: number) => number,
    Y: (y: number) => number,
    s: number,
    alpha: number,
  ): void {
    g.fillStyle = '#ffd27a';
    g.shadowColor = '#ff7a5d';
    g.shadowBlur = 5;
    for (const bo of this.bolts) {
      const y = lerp(bo.prevY, bo.y, alpha);
      g.fillRect(X(bo.x) - s * 0.5, Y(y) - s * 1.6, s, s * 3.2);
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
      const sz = (1 + t * 1.4) * s;
      g.fillRect(X(p.x) - sz / 2, Y(p.y) - sz / 2, sz, sz);
    }
    g.globalAlpha = 1;
  }

  private drawHud(
    g: CanvasRenderingContext2D,
    X: (x: number) => number,
    Y: (y: number) => number,
    s: number,
    offX: number,
    offY: number,
  ): void {
    // Blaze meter across the top.
    const pad = WALL + 1;
    const barX = X(pad);
    const barW = (FIELD_W - pad * 2) * s;
    const barY = Y(3.6);
    const barH = 2.6 * s;
    const ratio = this.blaze / BLAZE_MAX;
    g.fillStyle = 'rgba(20,11,43,0.85)';
    g.fillRect(barX, barY, barW, barH);
    g.fillStyle = this.blazeTime > 0 ? '#ff7a5d' : ratio >= 1 ? '#ffe46c' : '#7ea6ff';
    g.fillRect(barX, barY, barW * clamp(ratio, 0, 1), barH);
    g.strokeStyle = 'rgba(255,255,255,0.18)';
    g.lineWidth = 1;
    g.strokeRect(barX + 0.5, barY + 0.5, barW, barH);

    g.font = `${Math.round(3 * s)}px monospace`;
    g.textBaseline = 'top';
    g.textAlign = 'left';
    const ready = this.blazeTime <= 0 && this.blaze >= BLAZE_MAX;
    const labelKey =
      this.blazeTime > 0 ? 'brickBounce:hudBlaze' : ready ? 'brickBounce:hudReady' : 'brickBounce:hudCharge';
    g.fillStyle = ready ? '#ffe46c' : '#a796c9';
    g.fillText(this.ctx.i18n(labelKey).toUpperCase(), barX, barY + barH + 1.4 * s);

    // Lives (top-right) + level.
    g.textAlign = 'right';
    g.fillStyle = '#46d4c4';
    g.fillText('●'.repeat(Math.max(0, this.lives)), barX + barW, barY + barH + 1.4 * s);
    g.fillStyle = '#a796c9';
    g.fillText(this.ctx.i18n('brickBounce:hudLevel', { level: this.level }), barX + barW, barY - 3.4 * s);

    // Centre toast (power-up / blaze / level-clear).
    if (this.toastTime > 0 && this.toast) {
      g.globalAlpha = clamp(this.toastTime / 0.8, 0, 1);
      g.fillStyle = 'rgba(255,228,108,0.95)';
      g.font = `bold ${Math.round(5 * s)}px monospace`;
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      g.fillText(this.toast, offX + (FIELD_W * s) / 2, offY + FIELD_H * s * 0.62);
      g.globalAlpha = 1;
    }

    // Level banner during the breather.
    if (this.levelBreak > 0) {
      g.fillStyle = 'rgba(126,166,255,0.95)';
      g.font = `bold ${Math.round(8 * s)}px monospace`;
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      g.fillText(
        this.ctx.i18n('brickBounce:levelBanner', { level: this.level }),
        offX + (FIELD_W * s) / 2,
        offY + (FIELD_H * s) / 2,
      );
    }

    // Launch hint when a ball is waiting on the paddle.
    if (!this.gameOver && this.levelBreak <= 0 && this.balls.some((b) => b.stuck)) {
      g.fillStyle = 'rgba(167,150,201,0.9)';
      g.font = `${Math.round(3.6 * s)}px monospace`;
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      g.fillText(
        this.ctx.i18n('brickBounce:launchHint'),
        offX + (FIELD_W * s) / 2,
        Y(PADDLE_Y - 10),
      );
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
