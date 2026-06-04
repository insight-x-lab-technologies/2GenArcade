import type { GameContext, GameModule, GameMeta, InputEvent } from '@/types';
import { clamp } from '@/engine';
import { blockDropMeta } from './meta';
import {
  clearFullRows,
  collides,
  createBoard,
  dropDistance,
  mergeShard,
  rotateCW,
  scoreForClear,
  shardWidth,
  spawnColumn,
  SHARDS,
  COLS,
  ROWS,
  type Board,
  type Shard,
} from './logic';

// Sunset palette (1-based color indices match Shard.color).
const COLORS: string[] = [
  '#1a1030', // 0 unused (board bg ref)
  '#ffb347', // 1 amber
  '#ff8c42', // 2 deep orange
  '#ff5d73', // 3 coral
  '#b06cff', // 4 violet
  '#46d4c4', // 5 teal
  '#ffd27a', // 6 gold
  '#ff7ae0', // 7 magenta
];

const DAS_DELAY = 0.16;
const ARR = 0.045;
const LOCK_DELAY = 0.5;
const MAX_LOCK_RESETS = 15;
const SOFT_DROP_SPEED = 24;
const LINES_PER_LEVEL = 8;
const OVERDRIVE_DURATION = 8;
const OVERDRIVE_FILL_PER_LINE = 0.1;

const gravityForLevel = (level: number): number => Math.min(1.5 + (level - 1) * 1.15, 18);

export class BlockDropGame implements GameModule {
  readonly meta: GameMeta = blockDropMeta;

  private ctx!: GameContext;
  private render2d!: CanvasRenderingContext2D;
  private unsub: (() => void) | null = null;

  private board: Board = createBoard();
  private bag: Shard[] = [];
  private current!: Shard;
  private next!: Shard;
  private holdPiece: Shard | null = null;
  private holdUsed = false;
  private offR = 0;
  private offC = 0;
  private fallProgress = 0;

  private score = 0;
  private lines = 0;
  private level = 1;
  private maxClear = 0;
  private overdrives = 0;
  private combo = 0;

  private overdriveMeter = 0;
  private overdriveActive = false;
  private overdriveTimer = 0;

  private heldDir = 0;
  private dasTimer = 0;
  private arrTimer = 0;
  private lockTimer = 0;
  private lockResets = 0;
  private grounded = false;

  private gameOver = false;
  private flash = 0; // line-clear flash decay (cosmetic)

  init(ctx: GameContext): void {
    this.ctx = ctx;
    const c2d = ctx.canvas.getContext('2d');
    if (!c2d) throw new Error('2D context unavailable');
    this.render2d = c2d;

    this.reset();
    this.unsub = ctx.input.subscribe((e) => this.onInput(e));
    ctx.audio.playMusic('gameplay');
    this.emitScore();
  }

  private reset(): void {
    this.board = createBoard();
    this.bag = [];
    this.score = 0;
    this.lines = 0;
    this.level = 1;
    this.maxClear = 0;
    this.overdrives = 0;
    this.combo = 0;
    this.overdriveMeter = 0;
    this.overdriveActive = false;
    this.overdriveTimer = 0;
    this.gameOver = false;
    this.holdPiece = null;
    this.holdUsed = false;
    this.next = this.drawFromBag();
    this.spawn();
  }

  private drawFromBag(): Shard {
    if (this.bag.length === 0) {
      this.bag = SHARDS.map((s) => ({ ...s, cells: s.cells.map(([r, c]) => [r, c] as [number, number]) }));
      for (let i = this.bag.length - 1; i > 0; i -= 1) {
        const j = Math.floor(Math.random() * (i + 1));
        [this.bag[i], this.bag[j]] = [this.bag[j] as Shard, this.bag[i] as Shard];
      }
    }
    return this.bag.pop() as Shard;
  }

  private spawn(): void {
    this.current = this.next;
    this.next = this.drawFromBag();
    this.holdUsed = false; // hold becomes available again for the new piece
    this.offC = spawnColumn(this.current, COLS);
    this.offR = 0;
    this.fallProgress = 0;
    this.lockTimer = 0;
    this.lockResets = 0;
    if (collides(this.board, this.current, this.offR, this.offC)) {
      this.endGame();
    }
  }

  /** A fresh, spawn-orientation copy of a shard by id (for the hold slot). */
  private canonical(id: string): Shard {
    const base = SHARDS.find((s) => s.id === id) ?? SHARDS[0]!;
    return { ...base, cells: base.cells.map(([r, c]) => [r, c] as [number, number]) };
  }

  /** Shelve the current piece (G.1). Swaps with the held one, or banks it and
   *  pulls the next. Allowed once per piece so it can't be abused to stall. */
  private hold(): void {
    if (this.gameOver || this.holdUsed) return;
    this.holdUsed = true;
    const shelved = this.canonical(this.current.id);
    if (this.holdPiece) {
      this.current = this.holdPiece;
      this.holdPiece = shelved;
    } else {
      this.holdPiece = shelved;
      this.current = this.next;
      this.next = this.drawFromBag();
    }
    this.offC = spawnColumn(this.current, COLS);
    this.offR = 0;
    this.fallProgress = 0;
    this.lockTimer = 0;
    this.lockResets = 0;
    this.ctx.audio.playSfx('rotate');
    if (collides(this.board, this.current, this.offR, this.offC)) this.endGame();
  }

  // ---- Input ----------------------------------------------------------------

  private onInput(e: InputEvent): void {
    if (this.gameOver) return;
    switch (e.kind) {
      case 'swipe':
        if (e.direction === 'left') this.move(-1);
        else if (e.direction === 'right') this.move(1);
        else if (e.direction === 'down') this.softStep();
        else this.rotate();
        break;
      case 'tap':
        this.rotate();
        break;
      case 'hold':
        if (e.phase === 'start') this.hardDrop();
        break;
      case 'dpad':
        if (e.phase === 'press') {
          if (e.direction === 'left') this.move(-1);
          else if (e.direction === 'right') this.move(1);
          else if (e.direction === 'up') this.rotate();
        }
        break;
      case 'button':
        if (e.phase === 'press') {
          if (e.id === 'rotate' || e.id === 'action') this.rotate();
          else if (e.id === 'drop') this.hardDrop();
          else if (e.id === 'hold') this.hold();
        }
        break;
    }
  }

  private move(dir: number): void {
    if (!collides(this.board, this.current, this.offR, this.offC + dir)) {
      this.offC += dir;
      this.resetLockOnAction();
      this.ctx.audio.playSfx('move');
    }
  }

  private rotate(): void {
    const rotated = rotateCW(this.current);
    for (const dc of [0, -1, 1, -2, 2]) {
      if (!collides(this.board, rotated, this.offR, this.offC + dc)) {
        this.current = rotated;
        this.offC += dc;
        this.resetLockOnAction();
        this.ctx.audio.playSfx('rotate');
        return;
      }
    }
  }

  private softStep(): void {
    if (!collides(this.board, this.current, this.offR + 1, this.offC)) {
      this.offR += 1;
      this.score += 1;
      this.lockTimer = 0;
    }
  }

  private hardDrop(): void {
    const d = dropDistance(this.board, this.current, this.offR, this.offC);
    this.offR += d;
    this.score += d * 2;
    this.ctx.audio.playSfx('drop');
    this.lockPiece();
  }

  private resetLockOnAction(): void {
    if (this.grounded && this.lockResets < MAX_LOCK_RESETS) {
      this.lockTimer = 0;
      this.lockResets += 1;
    }
  }

  // ---- Simulation -----------------------------------------------------------

  update(dt: number): void {
    if (this.gameOver) return;

    this.handleHorizontalDAS(dt);

    const softDrop = this.ctx.input.isHeld('down');
    const speed = softDrop ? Math.max(gravityForLevel(this.level), SOFT_DROP_SPEED) : gravityForLevel(this.level);

    this.fallProgress += dt * speed;
    while (this.fallProgress >= 1) {
      if (!collides(this.board, this.current, this.offR + 1, this.offC)) {
        this.offR += 1;
        this.fallProgress -= 1;
        this.lockTimer = 0;
        if (softDrop) this.score += 1;
      } else {
        this.fallProgress = 0;
        break;
      }
    }

    this.grounded = collides(this.board, this.current, this.offR + 1, this.offC);
    if (this.grounded) {
      this.lockTimer += dt;
      if (this.lockTimer >= LOCK_DELAY) this.lockPiece();
    } else {
      this.lockTimer = 0;
    }

    if (this.overdriveActive) {
      this.overdriveTimer -= dt;
      if (this.overdriveTimer <= 0) this.overdriveActive = false;
    }
    if (this.flash > 0) this.flash = Math.max(0, this.flash - dt * 3);
  }

  private handleHorizontalDAS(dt: number): void {
    const left = this.ctx.input.isHeld('left');
    const right = this.ctx.input.isHeld('right');
    const dir = left && !right ? -1 : right && !left ? 1 : 0;
    if (dir === 0) {
      this.heldDir = 0;
      this.dasTimer = 0;
      this.arrTimer = 0;
      return;
    }
    if (dir !== this.heldDir) {
      this.heldDir = dir;
      this.dasTimer = 0;
      this.arrTimer = 0;
      return;
    }
    this.dasTimer += dt;
    if (this.dasTimer >= DAS_DELAY) {
      this.arrTimer += dt;
      while (this.arrTimer >= ARR) {
        this.move(dir);
        this.arrTimer -= ARR;
      }
    }
  }

  private lockPiece(): void {
    this.board = mergeShard(this.board, this.current, this.offR, this.offC);
    this.ctx.audio.playSfx('lock');

    const { board, cleared } = clearFullRows(this.board);
    this.board = board;

    if (cleared > 0) {
      this.combo += 1;
      this.maxClear = Math.max(this.maxClear, cleared);
      this.lines += cleared;
      const mult = this.overdriveActive ? 2 : 1;
      this.score += scoreForClear(cleared, this.level, this.combo) * mult;
      this.level = 1 + Math.floor(this.lines / LINES_PER_LEVEL);
      this.flash = 1;
      this.ctx.audio.playSfx('clear');
      this.chargeOverdrive(cleared);
    } else {
      this.combo = 0;
    }

    this.emitScore();
    this.spawn();
  }

  private chargeOverdrive(cleared: number): void {
    if (this.overdriveActive) return;
    this.overdriveMeter += cleared * OVERDRIVE_FILL_PER_LINE + this.combo * 0.03;
    if (this.overdriveMeter >= 1) {
      this.overdriveMeter = 0;
      this.overdriveActive = true;
      this.overdriveTimer = OVERDRIVE_DURATION;
      this.overdrives += 1;
      this.ctx.audio.playSfx('overdrive');
      this.ctx.emit.emit('trophy', { trophyId: 'overdrive' });
    }
  }

  private emitScore(): void {
    this.ctx.emit.emit('score', { score: this.score });
  }

  private endGame(): void {
    if (this.gameOver) return;
    this.gameOver = true;
    this.ctx.audio.playSfx('gameover');
    this.ctx.emit.emit('gameover', {
      score: this.score,
      stats: {
        lines: this.lines,
        level: this.level,
        maxClear: this.maxClear,
        overdrives: this.overdrives,
      },
    });
  }

  // ---- Rendering ------------------------------------------------------------

  render(_alpha: number): void {
    const g = this.render2d;
    const { width, height } = this.ctx.viewport;
    if (width <= 0 || height <= 0) return;

    g.clearRect(0, 0, width, height);
    g.fillStyle = '#0d0820';
    g.fillRect(0, 0, width, height);

    const topStrip = 46;
    const pad = 10;
    const availH = height - topStrip - pad * 2;
    const availW = width - pad * 2;
    const cell = Math.max(6, Math.floor(Math.min(availW / COLS, availH / ROWS)));
    const boardW = cell * COLS;
    const boardH = cell * ROWS;
    const originX = Math.floor((width - boardW) / 2);
    const originY = topStrip + pad;

    this.drawTopStrip(g, width, topStrip, cell);

    // Board panel + grid.
    g.fillStyle = '#140b2b';
    g.fillRect(originX - 2, originY - 2, boardW + 4, boardH + 4);
    g.strokeStyle = 'rgba(255,255,255,0.04)';
    g.lineWidth = 1;
    for (let c = 0; c <= COLS; c += 1) {
      g.beginPath();
      g.moveTo(originX + c * cell + 0.5, originY);
      g.lineTo(originX + c * cell + 0.5, originY + boardH);
      g.stroke();
    }
    for (let r = 0; r <= ROWS; r += 1) {
      g.beginPath();
      g.moveTo(originX, originY + r * cell + 0.5);
      g.lineTo(originX + boardW, originY + r * cell + 0.5);
      g.stroke();
    }

    // Settled cells.
    for (let r = 0; r < ROWS; r += 1) {
      for (let c = 0; c < COLS; c += 1) {
        const v = this.board[r]![c]!;
        if (v !== 0) this.drawCell(g, originX + c * cell, originY + r * cell, cell, v, 1);
      }
    }

    if (!this.gameOver) {
      // Ghost.
      const ghostD = dropDistance(this.board, this.current, this.offR, this.offC);
      for (const [r, c] of this.current.cells) {
        const gr = r + this.offR + ghostD;
        const gc = c + this.offC;
        if (gr >= 0) {
          g.strokeStyle = 'rgba(255,210,122,0.35)';
          g.lineWidth = 1.5;
          g.strokeRect(originX + gc * cell + 2, originY + gr * cell + 2, cell - 4, cell - 4);
        }
      }
      // Active piece (interpolated fall when airborne).
      const visualOffset = this.grounded ? 0 : Math.min(this.fallProgress, 1);
      for (const [r, c] of this.current.cells) {
        const pr = r + this.offR;
        const pc = c + this.offC;
        if (pr >= 0) {
          this.drawCell(g, originX + pc * cell, originY + (pr + visualOffset) * cell, cell, this.current.color, 1);
        }
      }
    }

    // Overdrive border pulse.
    if (this.overdriveActive) {
      const pulse = this.ctx.reducedMotion ? 0.6 : 0.5 + 0.5 * Math.sin(performance.now() / 120);
      g.strokeStyle = `rgba(255,140,66,${0.4 + pulse * 0.4})`;
      g.lineWidth = 3;
      g.strokeRect(originX - 4, originY - 4, boardW + 8, boardH + 8);
    }

    if (this.flash > 0) {
      g.fillStyle = `rgba(255,255,255,${this.flash * 0.18})`;
      g.fillRect(originX, originY, boardW, boardH);
    }
  }

  private drawTopStrip(g: CanvasRenderingContext2D, width: number, h: number, cell: number): void {
    const pad = 10;
    // Overdrive meter (leaves room on the right for the hold + next previews).
    const barW = width - pad * 2 - 96;
    const barH = 10;
    const barY = 10;
    g.fillStyle = '#241640';
    g.fillRect(pad, barY, barW, barH);
    const fill = this.overdriveActive ? 1 : this.overdriveMeter;
    g.fillStyle = this.overdriveActive ? '#ff8c42' : '#b06cff';
    g.fillRect(pad, barY, barW * clamp(fill, 0, 1), barH);
    g.strokeStyle = 'rgba(255,255,255,0.12)';
    g.strokeRect(pad + 0.5, barY + 0.5, barW, barH);

    g.fillStyle = '#a796c9';
    g.font = '10px monospace';
    g.textBaseline = 'middle';
    g.fillText(`LV ${this.level}  ·  ${this.lines}`, pad, barY + barH + 12);

    // Next piece mini-preview at top-right, with the held piece to its left.
    const previewSize = Math.min(8, cell - 2);
    const py = 8;
    const wN = shardWidth(this.next);
    const nx = width - pad - wN * previewSize;
    for (const [r, c] of this.next.cells) {
      this.drawCell(g, nx + c * previewSize, py + r * previewSize, previewSize, this.next.color, 0.85);
    }
    if (this.holdPiece) {
      const wH = shardWidth(this.holdPiece);
      const hx = nx - 10 - wH * previewSize;
      // Dimmed while it can't be swapped again until the current piece locks.
      const a = this.holdUsed ? 0.3 : 0.7;
      for (const [r, c] of this.holdPiece.cells) {
        this.drawCell(g, hx + c * previewSize, py + r * previewSize, previewSize, this.holdPiece.color, a);
      }
    }
    void h;
  }

  private drawCell(
    g: CanvasRenderingContext2D,
    x: number,
    y: number,
    size: number,
    color: number,
    alpha: number,
  ): void {
    const base = COLORS[color] ?? '#ffffff';
    const inset = Math.max(1, Math.floor(size * 0.08));
    g.globalAlpha = alpha;
    g.fillStyle = base;
    g.fillRect(x + inset, y + inset, size - inset * 2, size - inset * 2);
    // Top highlight + bottom shade for a chunky retro bevel.
    g.fillStyle = 'rgba(255,255,255,0.28)';
    g.fillRect(x + inset, y + inset, size - inset * 2, Math.max(1, inset));
    g.fillStyle = 'rgba(0,0,0,0.3)';
    g.fillRect(x + inset, y + size - inset * 2, size - inset * 2, Math.max(1, inset));
    g.globalAlpha = 1;
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
