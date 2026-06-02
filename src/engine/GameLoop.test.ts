import { describe, expect, it, vi } from 'vitest';
import { FixedTimestepLoop } from './GameLoop';

const makeLoop = (fixedStep = 1 / 60) => {
  const update = vi.fn();
  const render = vi.fn();
  const loop = new FixedTimestepLoop({ update, render }, { fixedStep });
  return { loop, update, render };
};

describe('FixedTimestepLoop', () => {
  it('runs exactly one update per fixed step at matching frame time', () => {
    const { loop, update, render } = makeLoop();
    const { updates, alpha } = loop.advance(1 / 60);
    expect(updates).toBe(1);
    expect(update).toHaveBeenCalledTimes(1);
    expect(update).toHaveBeenCalledWith(1 / 60);
    expect(render).toHaveBeenCalledTimes(1);
    expect(alpha).toBeCloseTo(0, 5);
  });

  it('catches up with multiple updates on a long frame', () => {
    const { loop, update } = makeLoop();
    const { updates } = loop.advance(3 / 60 + 1 / 600);
    expect(updates).toBe(3);
    expect(update).toHaveBeenCalledTimes(3);
  });

  it('accumulates leftover time across frames (no time lost)', () => {
    const { loop, update } = makeLoop();
    // Two half-steps should produce exactly one update total.
    loop.advance(1 / 120);
    let total = update.mock.calls.length;
    expect(total).toBe(0);
    loop.advance(1 / 120);
    total = update.mock.calls.length;
    expect(total).toBe(1);
  });

  it('reports alpha as fractional progress toward the next step', () => {
    const { loop } = makeLoop();
    const { alpha } = loop.advance(1 / 120); // half a step
    expect(alpha).toBeCloseTo(0.5, 5);
  });

  it('clamps huge frames to avoid the spiral of death', () => {
    const { loop } = makeLoop();
    // 10 real seconds, clamped to maxFrameTime 0.25 => 15 updates at 60Hz.
    const { updates } = loop.advance(10);
    expect(updates).toBe(15);
  });

  it('drives frames through an injected scheduler', () => {
    const update = vi.fn();
    const render = vi.fn();
    let time = 1000;
    const ref: { cb: ((t: number) => void) | null } = { cb: null };
    const loop = new FixedTimestepLoop(
      { update, render },
      {
        fixedStep: 1 / 60,
        now: () => time,
        requestFrame: (cb) => {
          ref.cb = cb;
          return 1;
        },
        cancelFrame: () => undefined,
      },
    );
    loop.start();
    expect(loop.isRunning).toBe(true);
    time += 20; // > 16.67ms => one step
    ref.cb?.(time);
    expect(update).toHaveBeenCalledTimes(1);
    loop.stop();
    expect(loop.isRunning).toBe(false);
  });
});
