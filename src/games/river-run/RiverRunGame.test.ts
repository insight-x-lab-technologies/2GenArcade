import { describe, expect, it, vi } from 'vitest';
import type { Direction, GameContext, GameEventMap } from '@/types';
import { RiverRunGame } from './RiverRunGame';

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

describe('RiverRunGame (integration)', () => {
  it('emits an initial score and renders without throwing', () => {
    const { ctx, events } = makeContext();
    const game = new RiverRunGame();
    game.init(ctx);
    expect(events.some((e) => e.type === 'score')).toBe(true);
    expect(() => game.render(0)).not.toThrow();
    game.destroy();
  });

  it('auto-fires and renders mid-tick without throwing', () => {
    const { ctx, held } = makeContext();
    const game = new RiverRunGame();
    game.init(ctx);
    held.add('right');
    expect(() => {
      for (let i = 0; i < 20; i += 1) game.update(1 / 60);
      game.render(0.5);
    }).not.toThrow();
    game.destroy();
  });

  it('awards the afterburner trophy when boost is held', () => {
    const { ctx, events, held } = makeContext();
    const game = new RiverRunGame();
    game.init(ctx);
    held.add('up');
    game.update(1 / 60);
    const t = events.find(
      (e) => e.type === 'trophy' && (e.payload as GameEventMap['trophy']).trophyId === 'afterburner',
    );
    expect(t).toBeDefined();
    game.destroy();
  });

  it('ends the run (crash or out of fuel) with numeric score and rich stats', () => {
    const { ctx, events } = makeContext();
    const game = new RiverRunGame();
    game.init(ctx);
    // No input: cruise straight until a drone hits or fuel runs dry.
    for (let i = 0; i < 3000; i += 1) {
      if (events.some((e) => e.type === 'gameover')) break;
      game.update(1 / 60);
    }
    const over = events.find((e) => e.type === 'gameover');
    expect(over).toBeDefined();
    const payload = over!.payload as GameEventMap['gameover'];
    expect(typeof payload.score).toBe('number');
    for (const key of ['distance', 'kills', 'bigKills', 'fuel', 'boosts', 'powerups', 'night', 'space']) {
      expect(payload.stats).toHaveProperty(key);
    }
    game.destroy();
  });

  it('survives a long random flight across biomes/day-cycle without throwing', () => {
    const { ctx, held } = makeContext();
    const game = new RiverRunGame();
    game.init(ctx);
    expect(() => {
      for (let i = 0; i < 4000; i += 1) {
        held.clear();
        if (i % 100 < 50) held.add('right');
        else held.add('left');
        held.add('up'); // keep refuelling pressure low via boost? still drains — fine
        game.update(1 / 60);
        if (i % 7 === 0) game.render((i % 60) / 60);
      }
    }).not.toThrow();
    game.destroy();
  });
});
