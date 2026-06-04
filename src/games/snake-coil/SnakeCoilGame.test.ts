import { describe, expect, it, vi } from 'vitest';
import type { GameContext, GameEventMap, InputEvent, InputHandler } from '@/types';
import { SnakeCoilGame } from './SnakeCoilGame';

// Stub 2D context: every method is a no-op, every property is settable.
const stubCtx2d = () =>
  new Proxy(
    {},
    {
      get: () => () => undefined,
      set: () => true,
    },
  ) as unknown as CanvasRenderingContext2D;

function makeContext() {
  let handler: InputHandler | null = null;
  const events: Array<{ type: keyof GameEventMap; payload: unknown }> = [];
  const heldButtons = new Set<string>();

  const canvas = { getContext: () => stubCtx2d() } as unknown as HTMLCanvasElement;

  const ctx: GameContext = {
    canvas,
    input: {
      subscribe: (h) => {
        handler = h;
        return () => {
          handler = null;
        };
      },
      isHeld: () => false,
      isButtonHeld: (id) => heldButtons.has(id),
    },
    audio: { playMusic: vi.fn(), stopMusic: vi.fn(), playSfx: vi.fn() },
    storage: {
      get: (_k, fb) => fb,
      set: () => undefined,
      remove: () => undefined,
    },
    emit: { emit: (type, payload) => events.push({ type, payload }) },
    i18n: ((k: string) => k) as unknown as GameContext['i18n'],
    reducedMotion: false,
    viewport: { width: 320, height: 600 },
  };

  return { ctx, events, heldButtons, fire: (e: InputEvent) => handler?.(e) };
}

describe('SnakeCoilGame (integration)', () => {
  it('emits an initial score and renders without throwing', () => {
    const { ctx, events } = makeContext();
    const game = new SnakeCoilGame();
    game.init(ctx);
    expect(events.some((e) => e.type === 'score')).toBe(true);
    expect(() => game.render(0)).not.toThrow();
    game.destroy();
  });

  it('processes input gestures and renders mid-tick without throwing', () => {
    const { ctx, fire } = makeContext();
    const game = new SnakeCoilGame();
    game.init(ctx);
    expect(() => {
      fire({ kind: 'swipe', direction: 'right' });
      fire({ kind: 'dpad', direction: 'down', phase: 'press' });
      fire({ kind: 'tap', x: 10, y: 10 });
      game.update(1 / 60);
      game.render(0.5);
    }).not.toThrow();
    game.destroy();
  });

  it('ignores 180° reversals (does not instantly fold on itself)', () => {
    const { ctx, events, fire } = makeContext();
    const game = new SnakeCoilGame();
    game.init(ctx);
    // Coil starts heading up; an immediate "down" must be ignored.
    fire({ kind: 'swipe', direction: 'down' });
    for (let i = 0; i < 30; i += 1) game.update(1 / 60);
    // Still alive after a few steps (no self-fold from the rejected reversal).
    expect(events.some((e) => e.type === 'gameover')).toBe(false);
    game.destroy();
  });

  it('steers in a loop and taps the manual Surge button without throwing', () => {
    const { ctx, heldButtons, fire } = makeContext();
    const game = new SnakeCoilGame();
    game.init(ctx);
    // Drive the Coil around the board, periodically tapping Surge (it only fires
    // once charged, so most taps are no-ops — it must never throw regardless).
    const dirs = ['right', 'down', 'left', 'up'] as const;
    expect(() => {
      for (let i = 0; i < 400; i += 1) {
        if (i % 12 === 0) fire({ kind: 'dpad', direction: dirs[(i / 12) % 4]!, phase: 'press' });
        heldButtons.delete('surge');
        if (i % 25 === 0) heldButtons.add('surge'); // rising-edge surge attempts
        game.update(1 / 60);
        if (i % 7 === 0) game.render((i % 60) / 60);
      }
    }).not.toThrow();
    game.destroy();
  });

  it('ends the run at the wall with numeric score and stats', () => {
    const { ctx, events } = makeContext();
    const game = new SnakeCoilGame();
    game.init(ctx);
    // Left untouched, the Coil heads straight up into the top wall.
    for (let i = 0; i < 600; i += 1) {
      if (events.some((e) => e.type === 'gameover')) break;
      game.update(1 / 60);
    }
    const over = events.find((e) => e.type === 'gameover');
    expect(over).toBeDefined();
    const payload = over!.payload as GameEventMap['gameover'];
    expect(typeof payload.score).toBe('number');
    expect(payload.stats).toHaveProperty('orbs');
    expect(payload.stats).toHaveProperty('length');
    expect(payload.stats).toHaveProperty('level');
    expect(payload.stats).toHaveProperty('surges');
    game.destroy();
  });
});
