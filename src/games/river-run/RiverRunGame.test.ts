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
  const heldButtons = new Set<string>();
  const sfx: string[] = [];
  const canvas = { getContext: () => stubCtx2d() } as unknown as HTMLCanvasElement;

  const ctx: GameContext = {
    canvas,
    input: {
      subscribe: () => () => undefined,
      isHeld: (d) => held.has(d),
      isButtonHeld: (id) => heldButtons.has(id),
    },
    audio: {
      playMusic: vi.fn(),
      stopMusic: vi.fn(),
      playSfx: (name: string) => {
        sfx.push(name);
      },
    },
    storage: { get: (_k, fb) => fb, set: () => undefined, remove: () => undefined },
    emit: { emit: (type, payload) => events.push({ type, payload }) },
    i18n: ((k: string) => k) as unknown as GameContext['i18n'],
    reducedMotion: false,
    viewport: { width: 360, height: 640 },
  };

  return { ctx, events, held, heldButtons, sfx };
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

  it('fires the primary weapon only while the fire button is held', () => {
    const { ctx, sfx, heldButtons } = makeContext();
    const game = new RiverRunGame();
    game.init(ctx);
    // No button held → no shots.
    for (let i = 0; i < 20; i += 1) game.update(1 / 60);
    expect(sfx.includes('shoot')).toBe(false);
    // Hold fire → shots come out.
    heldButtons.add('fire');
    expect(() => {
      for (let i = 0; i < 20; i += 1) game.update(1 / 60);
      game.render(0.5);
    }).not.toThrow();
    expect(sfx.includes('shoot')).toBe(true);
    game.destroy();
  });

  it('launches a missile on a button tap and awards the warmonger trophy', () => {
    const { ctx, events, sfx, heldButtons } = makeContext();
    const game = new RiverRunGame();
    game.init(ctx);
    heldButtons.add('missile'); // rising edge
    game.update(1 / 60);
    heldButtons.delete('missile'); // release so a later tap could re-fire
    game.update(1 / 60);
    expect(sfx.includes('missile')).toBe(true);
    const t = events.find(
      (e) => e.type === 'trophy' && (e.payload as GameEventMap['trophy']).trophyId === 'warmonger',
    );
    expect(t).toBeDefined();
    expect(() => {
      for (let i = 0; i < 60; i += 1) game.update(1 / 60);
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
