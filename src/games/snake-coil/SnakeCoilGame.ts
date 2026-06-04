import type { GameContext, GameModule, GameMeta, InputEvent, Direction } from '@/types';
import { clamp } from '@/engine';
import { snakeCoilMeta } from './meta';
import {
  advance,
  COLS,
  COMBO_WINDOW,
  hitsBody,
  hitsWall,
  initialSnake,
  isReverse,
  levelForOrbs,
  orbGrowth,
  orbScore,
  placeOrb,
  PRISM_EVERY,
  PRISM_LIFE,
  ROWS,
  SURGE_DURATION,
  SURGE_PER_ORB,
  tickInterval,
  type Dir,
  type OrbKind,
  type Vec,
} from './logic';

const FIXED_STEP = 1 / 60;
const SURGE_SPEEDUP = 0.62; // tick interval multiplier while surging
const PRISM_METER_BONUS = 0.4; // extra surge fill from a prism
const MAX_QUEUED_TURNS = 2;

// Sunset palette.
const BG = '#0d0820';
const PANEL = '#140b2b';
const GRID_LINE = 'rgba(255,255,255,0.04)';
const ORB_COLOR = '#b06cff'; // violet
const PRISM_COLOR = '#ffd27a'; // gold
const HEAD_COLOR = '#ffb347'; // amber
const BODY_FROM = '#ff8c42'; // deep orange
const BODY_TO = '#ff5d73'; // coral
const SURGE_HEAD = '#bfffe9';
const SURGE_BODY = '#46d4c4'; // teal

const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;

const mixHex = (from: string, to: string, t: number): string => {
  const fr = parseInt(from.slice(1), 16);
  const tr = parseInt(to.slice(1), 16);
  const r = Math.round(lerp((fr >> 16) & 255, (tr >> 16) & 255, t));
  const g = Math.round(lerp((fr >> 8) & 255, (tr >> 8) & 255, t));
  const b = Math.round(lerp(fr & 255, tr & 255, t));
  return `rgb(${r},${g},${b})`;
};

export class SnakeCoilGame implements GameModule {
  readonly meta: GameMeta = snakeCoilMeta;

  private ctx!: GameContext;
  private g!: CanvasRenderingContext2D;
  private unsub: (() => void) | null = null;

  private body: Vec[] = [];
  private prevBody: Vec[] = [];
  private dir: Dir = 'up';
  private queue: Dir[] = [];

  private orb: Vec = { x: 0, y: 0 };
  private orbKind: OrbKind = 'normal';
  private prismLife = 0;
  private orbsSpawned = 0;

  private score = 0;
  private orbs = 0;
  private level = 1;
  private combo = 0;
  private maxCombo = 0;
  private comboTimer = 0;
  private surges = 0;

  private surgeMeter = 0;
  private surgeActive = false;
  private surgeReady = false;
  private surgeTimer = 0;
  private prevSurgeHeld = false;

  private interval = tickInterval(1);
  private stepClock = 0;
  private gameOver = false;
  private flash = 0;
  private firstOrbAwarded = false;

  init(ctx: GameContext): void {
    this.ctx = ctx;
    const c2d = ctx.canvas.getContext('2d');
    if (!c2d) throw new Error('2D context unavailable');
    this.g = c2d;
    this.reset();
    this.unsub = ctx.input.subscribe((e) => this.onInput(e));
    ctx.audio.playMusic('gameplay');
    this.emitScore();
  }

  private reset(): void {
    this.body = initialSnake();
    this.prevBody = this.body.map((c) => ({ ...c }));
    this.dir = 'up';
    this.queue = [];
    this.score = 0;
    this.orbs = 0;
    this.level = 1;
    this.combo = 0;
    this.maxCombo = 0;
    this.comboTimer = 0;
    this.surges = 0;
    this.surgeMeter = 0;
    this.surgeActive = false;
    this.surgeReady = false;
    this.surgeTimer = 0;
    this.prevSurgeHeld = false;
    this.interval = tickInterval(1);
    this.stepClock = 0;
    this.gameOver = false;
    this.flash = 0;
    this.firstOrbAwarded = false;
    this.orbsSpawned = 0;
    this.spawnOrb();
  }

  // ---- Input ----------------------------------------------------------------

  private onInput(e: InputEvent): void {
    if (this.gameOver) return;
    let dir: Direction | null = null;
    if (e.kind === 'swipe') dir = e.direction;
    else if (e.kind === 'dpad' && e.phase === 'press') dir = e.direction;
    if (dir) this.enqueueTurn(dir);
  }

  /** Buffer turns so a quick two-step corner (e.g. up→right) both register on
   *  consecutive ticks. Reject 180° reversals and redundant repeats. */
  private enqueueTurn(dir: Dir): void {
    const last = this.queue.length > 0 ? this.queue[this.queue.length - 1]! : this.dir;
    if (dir === last || isReverse(dir, last)) return;
    if (this.queue.length >= MAX_QUEUED_TURNS) return;
    this.queue.push(dir);
    this.ctx.audio.playSfx('turn');
  }

  // ---- Simulation -----------------------------------------------------------

  update(dt: number): void {
    if (this.gameOver) return;

    // Dash button (C.1): the Surge is now fired manually once charged, so the
    // player can save the phase-through window for when the Coil is boxed in.
    const surgeHeld = this.ctx.input.isButtonHeld('surge');
    if (surgeHeld && !this.prevSurgeHeld && this.surgeReady && !this.surgeActive) {
      this.startSurge();
    }
    this.prevSurgeHeld = surgeHeld;

    if (this.comboTimer > 0) {
      this.comboTimer -= dt;
      if (this.comboTimer <= 0) this.combo = 0;
    }
    if (this.surgeActive) {
      this.surgeTimer -= dt;
      if (this.surgeTimer <= 0) this.endSurge();
    }
    if (this.orbKind === 'prism') {
      this.prismLife -= dt;
      if (this.prismLife <= 0) this.orbKind = 'normal'; // downgrade in place
    }
    if (this.flash > 0) this.flash = Math.max(0, this.flash - dt * 2.5);

    this.interval = this.currentInterval();
    this.stepClock += dt;
    let guard = 0;
    while (this.stepClock >= this.interval && !this.gameOver && guard < 8) {
      this.stepClock -= this.interval;
      this.step();
      guard += 1;
      this.interval = this.currentInterval();
    }
  }

  private currentInterval(): number {
    const base = tickInterval(this.level);
    return this.surgeActive ? base * SURGE_SPEEDUP : base;
  }

  private step(): void {
    if (this.queue.length > 0) this.dir = this.queue.shift()!;

    const nextHead = advance(this.body, this.dir, false)[0]!;

    if (hitsWall(nextHead)) {
      this.endGame();
      return;
    }
    // While surging the Coil phases through itself; otherwise self-hits are
    // fatal. The tail cell vacates this tick, so colliding with it is allowed.
    const tail = this.body[this.body.length - 1]!;
    const bodyToCheck = this.body.slice(0, -1);
    if (!this.surgeActive && hitsBody(nextHead, bodyToCheck)) {
      this.endGame();
      return;
    }

    const ate = nextHead.x === this.orb.x && nextHead.y === this.orb.y;
    this.prevBody = this.body.map((c) => ({ ...c }));
    this.body = advance(this.body, this.dir, ate);
    if (ate) {
      // Grow extra for prisms by appending the old tail again.
      const extra = orbGrowth(this.orbKind) - 1;
      for (let i = 0; i < extra; i += 1) this.body.push({ ...tail });
      this.onEat();
    }
  }

  private onEat(): void {
    const kind = this.orbKind;
    this.orbs += 1;

    // Combo: chained if eaten within the window.
    this.combo = this.comboTimer > 0 ? this.combo + 1 : 1;
    this.maxCombo = Math.max(this.maxCombo, this.combo);
    this.comboTimer = COMBO_WINDOW;

    this.level = levelForOrbs(this.orbs);
    this.score += orbScore(kind, this.level, this.combo - 1, this.surgeActive);
    this.ctx.audio.playSfx(kind === 'prism' ? 'prism' : 'eat');
    this.flash = kind === 'prism' ? 0.8 : 0.4;

    if (!this.firstOrbAwarded) {
      this.firstOrbAwarded = true;
      this.ctx.emit.emit('trophy', { trophyId: 'firstOrb' });
    }
    if (this.maxCombo === 5 && this.combo === 5) {
      this.ctx.emit.emit('trophy', { trophyId: 'combo' });
    }

    if (!this.surgeActive) {
      this.surgeMeter += SURGE_PER_ORB + (kind === 'prism' ? PRISM_METER_BONUS : 0);
      if (this.surgeMeter >= 1) {
        this.surgeMeter = 1;
        this.surgeReady = true;
      }
    }

    this.emitScore();
    this.spawnOrb();
  }

  private spawnOrb(): void {
    const pos = placeOrb(this.body, () => Math.random());
    if (!pos) {
      // Board full — vanishingly rare; end the run as a "perfect coil".
      this.endGame();
      return;
    }
    this.orb = pos;
    this.orbsSpawned += 1;
    if (this.orbsSpawned % PRISM_EVERY === 0) {
      this.orbKind = 'prism';
      this.prismLife = PRISM_LIFE;
    } else {
      this.orbKind = 'normal';
    }
  }

  private startSurge(): void {
    this.surgeMeter = 0;
    this.surgeReady = false;
    this.surgeActive = true;
    this.surgeTimer = SURGE_DURATION;
    this.surges += 1;
    this.ctx.audio.playSfx('surge');
    this.ctx.emit.emit('trophy', { trophyId: 'surge' });
  }

  private endSurge(): void {
    this.surgeActive = false;
    this.surgeTimer = 0;
  }

  private emitScore(): void {
    this.ctx.emit.emit('score', { score: this.score });
  }

  private endGame(): void {
    if (this.gameOver) return;
    this.gameOver = true;
    this.flash = 1;
    this.ctx.audio.playSfx('gameover');
    this.ctx.emit.emit('gameover', {
      score: this.score,
      stats: {
        orbs: this.orbs,
        length: this.body.length,
        level: this.level,
        maxCombo: this.maxCombo,
        surges: this.surges,
      },
    });
  }

  // ---- Rendering ------------------------------------------------------------

  render(alpha: number): void {
    const g = this.g;
    const { width, height } = this.ctx.viewport;
    if (width <= 0 || height <= 0) return;

    g.clearRect(0, 0, width, height);
    g.fillStyle = BG;
    g.fillRect(0, 0, width, height);

    const topStrip = 42;
    const pad = 10;
    const availW = width - pad * 2;
    const availH = height - topStrip - pad * 2;
    const cell = Math.max(8, Math.floor(Math.min(availW / COLS, availH / ROWS)));
    const boardW = cell * COLS;
    const boardH = cell * ROWS;
    const ox = Math.floor((width - boardW) / 2);
    const oy = topStrip + pad;

    this.drawTopStrip(g, width, pad);

    // Board panel + faint grid.
    g.fillStyle = PANEL;
    g.fillRect(ox - 2, oy - 2, boardW + 4, boardH + 4);
    g.strokeStyle = GRID_LINE;
    g.lineWidth = 1;
    for (let c = 0; c <= COLS; c += 1) {
      g.beginPath();
      g.moveTo(ox + c * cell + 0.5, oy);
      g.lineTo(ox + c * cell + 0.5, oy + boardH);
      g.stroke();
    }
    for (let r = 0; r <= ROWS; r += 1) {
      g.beginPath();
      g.moveTo(ox, oy + r * cell + 0.5);
      g.lineTo(ox + boardW, oy + r * cell + 0.5);
      g.stroke();
    }

    this.drawOrb(g, ox, oy, cell);
    this.drawCoil(g, ox, oy, cell, alpha);

    if (this.surgeActive) {
      const pulse = this.ctx.reducedMotion ? 0.6 : 0.5 + 0.5 * Math.sin(performance.now() / 110);
      g.strokeStyle = `rgba(70,212,196,${0.4 + pulse * 0.45})`;
      g.lineWidth = 3;
      g.strokeRect(ox - 4, oy - 4, boardW + 8, boardH + 8);
    }

    if (this.flash > 0) {
      const tint = this.gameOver ? '255,93,115' : '255,255,255';
      g.fillStyle = `rgba(${tint},${this.flash * 0.22})`;
      g.fillRect(ox, oy, boardW, boardH);
    }
  }

  private drawTopStrip(g: CanvasRenderingContext2D, width: number, pad: number): void {
    const barW = width - pad * 2;
    const barH = 10;
    const barY = 10;
    g.fillStyle = '#241640';
    g.fillRect(pad, barY, barW, barH);
    const fill = this.surgeActive ? 1 : this.surgeMeter;
    g.fillStyle = this.surgeActive ? '#46d4c4' : '#b06cff';
    g.fillRect(pad, barY, barW * clamp(fill, 0, 1), barH);
    g.strokeStyle = 'rgba(255,255,255,0.12)';
    g.strokeRect(pad + 0.5, barY + 0.5, barW, barH);

    g.fillStyle = '#a796c9';
    g.font = '10px monospace';
    g.textBaseline = 'middle';
    g.textAlign = 'left';
    g.fillText(`LV ${this.level}`, pad, barY + barH + 12);
    if (this.surgeReady && !this.surgeActive) {
      const pulse = this.ctx.reducedMotion ? 1 : 0.6 + 0.4 * Math.sin(performance.now() / 140);
      g.fillStyle = `rgba(255,210,122,${pulse})`;
      g.textAlign = 'center';
      g.fillText(this.ctx.i18n('snakeCoil:hudReady').toUpperCase(), width / 2, barY + barH + 12);
      g.fillStyle = '#a796c9';
      g.textAlign = 'left';
    }
    if (this.combo >= 2) {
      g.fillStyle = this.surgeActive ? '#46d4c4' : '#ff8c42';
      g.textAlign = 'right';
      g.fillText(`COMBO x${this.combo}`, width - pad, barY + barH + 12);
      g.textAlign = 'left';
    }
  }

  private drawOrb(g: CanvasRenderingContext2D, ox: number, oy: number, cell: number): void {
    const cx = ox + this.orb.x * cell + cell / 2;
    const cy = oy + this.orb.y * cell + cell / 2;
    const t = this.ctx.reducedMotion ? 0.5 : 0.5 + 0.5 * Math.sin(performance.now() / 180);

    if (this.orbKind === 'prism') {
      const r = cell * (0.32 + t * 0.12);
      // Countdown ring (urgency).
      g.strokeStyle = 'rgba(255,210,122,0.35)';
      g.lineWidth = 2;
      g.beginPath();
      g.arc(cx, cy, cell * 0.46, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * (this.prismLife / PRISM_LIFE));
      g.stroke();
      // Rotating gem.
      g.save();
      g.translate(cx, cy);
      if (!this.ctx.reducedMotion) g.rotate(performance.now() / 400);
      g.fillStyle = PRISM_COLOR;
      g.shadowColor = PRISM_COLOR;
      g.shadowBlur = 12;
      g.beginPath();
      g.moveTo(0, -r);
      g.lineTo(r, 0);
      g.lineTo(0, r);
      g.lineTo(-r, 0);
      g.closePath();
      g.fill();
      g.restore();
      g.shadowBlur = 0;
      return;
    }

    const r = cell * (0.28 + t * 0.06);
    g.fillStyle = ORB_COLOR;
    g.shadowColor = ORB_COLOR;
    g.shadowBlur = 10;
    g.beginPath();
    g.arc(cx, cy, r, 0, Math.PI * 2);
    g.fill();
    g.shadowBlur = 0;
  }

  private drawCoil(
    g: CanvasRenderingContext2D,
    ox: number,
    oy: number,
    cell: number,
    alpha: number,
  ): void {
    // Smooth motion: interpolate each segment from its previous cell toward its
    // current cell using how far we are into the current grid tick.
    const progress = this.gameOver
      ? 1
      : clamp((this.stepClock + alpha * FIXED_STEP) / this.interval, 0, 1);
    const n = this.body.length;
    const headColor = this.surgeActive ? SURGE_HEAD : HEAD_COLOR;

    for (let i = n - 1; i >= 0; i -= 1) {
      const cur = this.body[i]!;
      const prev = this.prevBody[i] ?? cur;
      const px = lerp(prev.x, cur.x, progress);
      const py = lerp(prev.y, cur.y, progress);
      const x = ox + px * cell;
      const y = oy + py * cell;
      const tBody = n > 1 ? i / (n - 1) : 0;
      const fill = this.surgeActive ? SURGE_BODY : mixHex(BODY_FROM, BODY_TO, tBody);

      const inset = Math.max(1, Math.floor(cell * 0.1));
      const size = cell - inset * 2;
      const radius = Math.max(2, Math.floor(cell * 0.28));

      if (i === 0) {
        g.shadowColor = headColor;
        g.shadowBlur = this.surgeActive ? 16 : 8;
      }
      g.fillStyle = i === 0 ? headColor : fill;
      this.roundRect(g, x + inset, y + inset, size, size, radius);
      g.fill();
      g.shadowBlur = 0;

      if (i === 0) this.drawEyes(g, x, y, cell);
    }
  }

  private drawEyes(g: CanvasRenderingContext2D, x: number, y: number, cell: number): void {
    const d = this.dir;
    const cx = x + cell / 2;
    const cy = y + cell / 2;
    const off = cell * 0.18;
    const er = Math.max(1.2, cell * 0.07);
    // Eyes sit toward the facing edge, offset to each side.
    const facing: Vec = d === 'up' ? { x: 0, y: -1 } : d === 'down' ? { x: 0, y: 1 } : d === 'left' ? { x: -1, y: 0 } : { x: 1, y: 0 };
    const side: Vec = { x: facing.y, y: facing.x };
    g.fillStyle = '#1a0f2e';
    for (const s of [-1, 1]) {
      const ex = cx + facing.x * off + side.x * off * s;
      const ey = cy + facing.y * off + side.y * off * s;
      g.beginPath();
      g.arc(ex, ey, er, 0, Math.PI * 2);
      g.fill();
    }
  }

  private roundRect(
    g: CanvasRenderingContext2D,
    x: number,
    y: number,
    w: number,
    h: number,
    r: number,
  ): void {
    const rr = Math.min(r, w / 2, h / 2);
    g.beginPath();
    g.moveTo(x + rr, y);
    g.arcTo(x + w, y, x + w, y + h, rr);
    g.arcTo(x + w, y + h, x, y + h, rr);
    g.arcTo(x, y + h, x, y, rr);
    g.arcTo(x, y, x + w, y, rr);
    g.closePath();
  }

  pause(): void {
    this.ctx.audio.stopMusic();
  }

  resume(): void {
    this.ctx.audio.playMusic('gameplay');
  }

  destroy(): void {
    this.unsub?.();
    this.unsub = null;
    this.ctx.audio.stopMusic();
  }
}
