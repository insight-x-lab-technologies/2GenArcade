// Fixed-timestep game loop with an accumulator and render interpolation.
//
// Logic runs at a constant `fixedStep` (decoupled from the display refresh
// rate), so simulation is deterministic and stable at 60 FPS or 144 FPS alike.
// Render receives `alpha` — the fractional progress toward the next step — so
// games can interpolate between the previous and current logic state and avoid
// visual stutter. See the classic "Fix Your Timestep!" pattern.

export interface LoopCallbacks {
  update(dtFixed: number): void;
  render(alpha: number): void;
}

export interface LoopOptions {
  /** Fixed logic step in seconds. Default 1/60. */
  fixedStep?: number;
  /** Clamp on a single frame's elapsed time (seconds) to avoid the "spiral of
   *  death" after tab-switches/GC pauses. Default 0.25. */
  maxFrameTime?: number;
  /** Injectable clock (ms) for testing. Defaults to performance.now. */
  now?: () => number;
  /** Injectable scheduler for testing. Defaults to requestAnimationFrame. */
  requestFrame?: (cb: (timeMs: number) => void) => number;
  cancelFrame?: (handle: number) => void;
}

export class FixedTimestepLoop {
  readonly fixedStep: number;
  private readonly maxFrameTime: number;
  private readonly now: () => number;
  private readonly requestFrame: (cb: (timeMs: number) => void) => number;
  private readonly cancelFrame: (handle: number) => void;

  private accumulator = 0;
  private lastTimeMs = 0;
  private running = false;
  private frameHandle = 0;

  constructor(
    private readonly callbacks: LoopCallbacks,
    options: LoopOptions = {},
  ) {
    this.fixedStep = options.fixedStep ?? 1 / 60;
    this.maxFrameTime = options.maxFrameTime ?? 0.25;
    this.now = options.now ?? (() => performance.now());
    this.requestFrame =
      options.requestFrame ?? ((cb) => requestAnimationFrame(cb));
    this.cancelFrame = options.cancelFrame ?? ((handle) => cancelAnimationFrame(handle));
  }

  get isRunning(): boolean {
    return this.running;
  }

  start(): void {
    if (this.running) return;
    this.running = true;
    this.lastTimeMs = this.now();
    this.accumulator = 0;
    this.frameHandle = this.requestFrame(this.onFrame);
  }

  stop(): void {
    if (!this.running) return;
    this.running = false;
    this.cancelFrame(this.frameHandle);
  }

  /** Reset the accumulator/clock — call after a long pause so the next frame
   *  doesn't try to catch up on elapsed wall-clock time. */
  resetClock(): void {
    this.lastTimeMs = this.now();
    this.accumulator = 0;
  }

  private onFrame = (timeMs: number): void => {
    if (!this.running) return;
    this.advance((timeMs - this.lastTimeMs) / 1000);
    this.lastTimeMs = timeMs;
    if (this.running) {
      this.frameHandle = this.requestFrame(this.onFrame);
    }
  };

  /** Pure-ish core: advances the simulation by `frameSeconds` of wall time,
   *  invoking `update` for each fixed step and `render` once with `alpha`.
   *  Exposed for unit testing. Returns how many update steps ran. */
  advance(frameSeconds: number): { updates: number; alpha: number } {
    const frameTime = Math.min(Math.max(frameSeconds, 0), this.maxFrameTime);
    this.accumulator += frameTime;

    let updates = 0;
    while (this.accumulator >= this.fixedStep) {
      this.callbacks.update(this.fixedStep);
      this.accumulator -= this.fixedStep;
      updates += 1;
    }

    const alpha = this.accumulator / this.fixedStep;
    this.callbacks.render(alpha);
    return { updates, alpha };
  }
}
