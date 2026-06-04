import { describe, expect, it, vi } from 'vitest';
import type { GameContext, GameEventMap, InputEvent, InputHandler } from '@/types';
import { BlockDropGame } from './BlockDropGame';

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
  const store = new Map<string, unknown>();

  const canvas = {
    getContext: () => stubCtx2d(),
  } as unknown as HTMLCanvasElement;

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
      isButtonHeld: () => false,
    },
    audio: { playMusic: vi.fn(), stopMusic: vi.fn(), playSfx: vi.fn() },
    storage: {
      get: (k, fb) => (store.has(k) ? (store.get(k) as typeof fb) : fb),
      set: (k, v) => void store.set(k, v),
      remove: (k) => void store.delete(k),
    },
    emit: {
      emit: (type, payload) => events.push({ type, payload }),
    },
    i18n: ((k: string) => k) as unknown as GameContext['i18n'],
    reducedMotion: false,
    viewport: { width: 320, height: 600 },
  };

  return {
    ctx,
    events,
    fire: (e: InputEvent) => handler?.(e),
  };
}

describe('BlockDropGame (integration)', () => {
  it('emits an initial score and renders without throwing', () => {
    const { ctx, events } = makeContext();
    const game = new BlockDropGame();
    game.init(ctx);
    expect(events.some((e) => e.type === 'score')).toBe(true);
    expect(() => game.render(0)).not.toThrow();
    game.destroy();
  });

  it('processes input gestures without throwing', () => {
    const { ctx, fire } = makeContext();
    const game = new BlockDropGame();
    game.init(ctx);
    expect(() => {
      fire({ kind: 'tap', x: 10, y: 10 });
      fire({ kind: 'swipe', direction: 'left' });
      fire({ kind: 'swipe', direction: 'right' });
      fire({ kind: 'dpad', direction: 'up', phase: 'press' });
      fire({ kind: 'button', id: 'rotate', phase: 'press' });
      game.update(1 / 60);
      game.render(0.5);
    }).not.toThrow();
    game.destroy();
  });

  it('holds/swaps a piece on the hold button without throwing', () => {
    const { ctx, fire } = makeContext();
    const game = new BlockDropGame();
    game.init(ctx);
    expect(() => {
      fire({ kind: 'button', id: 'hold', phase: 'press' }); // bank the current piece
      game.render(0);
      fire({ kind: 'button', id: 'hold', phase: 'press' }); // ignored: once per piece
      for (let i = 0; i < 30; i += 1) game.update(1 / 60);
      fire({ kind: 'button', id: 'drop', phase: 'press' }); // lock → hold re-armed
      game.update(1 / 60);
      fire({ kind: 'button', id: 'hold', phase: 'press' }); // swap back in
      game.render(0.5);
    }).not.toThrow();
    game.destroy();
  });

  it('reaches game over when the well fills, with numeric score and stats', () => {
    const { ctx, events, fire } = makeContext();
    const game = new BlockDropGame();
    game.init(ctx);

    // Hard-drop pieces repeatedly without clearing; the stack eventually tops out.
    for (let i = 0; i < 400; i += 1) {
      if (events.some((e) => e.type === 'gameover')) break;
      fire({ kind: 'button', id: 'drop', phase: 'press' });
      game.update(1 / 60);
    }

    const over = events.find((e) => e.type === 'gameover');
    expect(over).toBeDefined();
    const payload = over!.payload as GameEventMap['gameover'];
    expect(typeof payload.score).toBe('number');
    expect(payload.stats).toBeDefined();
    expect(payload.stats).toHaveProperty('lines');
    expect(payload.stats).toHaveProperty('level');
    game.destroy();
  });

  it('advances gravity over time', () => {
    const { ctx, events } = makeContext();
    const game = new BlockDropGame();
    game.init(ctx);
    const before = events.length;
    // Run until at least one piece falls and locks under gravity (re-emits score).
    for (let i = 0; i < 2000 && events.length <= before; i += 1) game.update(1 / 60);
    expect(events.length).toBeGreaterThan(before);
    game.destroy();
  });
});
