import { describe, expect, it, vi } from 'vitest';
import type { Direction, GameContext, GameEventMap } from '@/types';
import { RoadBurnerGame } from './RoadBurnerGame';

const stubCtx2d = () => {
  const gradient = { addColorStop: () => undefined };
  return new Proxy(
    {},
    {
      // Every method is a no-op; createLinearGradient needs a chainable result.
      get: () => () => gradient,
      set: () => true,
    },
  ) as unknown as CanvasRenderingContext2D;
};

function makeContext() {
  const events: Array<{ type: keyof GameEventMap; payload: unknown }> = [];
  const held = new Set<Direction>();
  const canvas = { getContext: () => stubCtx2d() } as unknown as HTMLCanvasElement;

  const ctx: GameContext = {
    canvas,
    input: {
      subscribe: () => () => undefined,
      isHeld: (d) => held.has(d),
    },
    audio: { playMusic: vi.fn(), stopMusic: vi.fn(), playSfx: vi.fn() },
    storage: { get: (_k, fb) => fb, set: () => undefined, remove: () => undefined },
    emit: { emit: (type, payload) => events.push({ type, payload }) },
    i18n: ((k: string) => k) as unknown as GameContext['i18n'],
    reducedMotion: false,
    viewport: { width: 360, height: 640 },
  };

  return { ctx, events, held };
}

describe('RoadBurnerGame (integration)', () => {
  it('emits an initial score and renders without throwing', () => {
    const { ctx, events } = makeContext();
    const game = new RoadBurnerGame();
    game.init(ctx);
    expect(events.some((e) => e.type === 'score')).toBe(true);
    expect(() => game.render(0)).not.toThrow();
    game.destroy();
  });

  it('steers and renders mid-tick without throwing', () => {
    const { ctx, held } = makeContext();
    const game = new RoadBurnerGame();
    game.init(ctx);
    held.add('right');
    held.add('up');
    expect(() => {
      for (let i = 0; i < 30; i += 1) game.update(1 / 60);
      game.render(0.5);
    }).not.toThrow();
    game.destroy();
  });

  it('ends the run with a numeric score and racing stats', () => {
    const { ctx, events, held } = makeContext();
    const game = new RoadBurnerGame();
    game.init(ctx);
    // Hug the left guardrail: lane-0 traffic then crashes head-on (no near-miss
    // charging, so no Nitro invincibility), guaranteeing a deterministic end.
    held.add('left');
    for (let i = 0; i < 20000; i += 1) {
      if (events.some((e) => e.type === 'gameover')) break;
      game.update(1 / 60);
    }
    const over = events.find((e) => e.type === 'gameover');
    expect(over).toBeDefined();
    const payload = over!.payload as GameEventMap['gameover'];
    expect(typeof payload.score).toBe('number');
    expect(payload.stats).toHaveProperty('distance');
    expect(payload.stats).toHaveProperty('passes');
    expect(payload.stats).toHaveProperty('nitros');
    game.destroy();
  });
});
