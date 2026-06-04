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
  const heldButtons = new Set<string>();
  const canvas = { getContext: () => stubCtx2d() } as unknown as HTMLCanvasElement;

  const ctx: GameContext = {
    canvas,
    input: {
      subscribe: () => () => undefined,
      isHeld: (d) => held.has(d),
      isButtonHeld: (id) => heldButtons.has(id),
    },
    audio: { playMusic: vi.fn(), stopMusic: vi.fn(), playSfx: vi.fn() },
    storage: { get: (_k, fb) => fb, set: () => undefined, remove: () => undefined },
    emit: { emit: (type, payload) => events.push({ type, payload }) },
    i18n: ((k: string) => k) as unknown as GameContext['i18n'],
    reducedMotion: false,
    viewport: { width: 360, height: 640 },
  };

  return { ctx, events, held, heldButtons };
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
    for (const key of [
      'distance',
      'passes',
      'bigPasses',
      'nitros',
      'powerups',
      'usedShield',
      'mud',
      'snow',
      'rain',
      'night',
    ]) {
      expect(payload.stats).toHaveProperty(key);
    }
    game.destroy();
  });

  it('drives with the manual Nitro held and periodic dash taps without throwing', () => {
    const { ctx, held, heldButtons } = makeContext();
    const game = new RoadBurnerGame();
    game.init(ctx);
    heldButtons.add('nitro'); // held: ignites whenever Burn fills
    expect(() => {
      for (let i = 0; i < 600; i += 1) {
        held.clear();
        held.add('up');
        held.add(i % 40 < 20 ? 'right' : 'left');
        heldButtons.delete('dash');
        if (i % 30 === 0) heldButtons.add('dash'); // rising-edge dash taps
        game.update(1 / 60);
        if (i % 7 === 0) game.render((i % 60) / 60);
      }
    }).not.toThrow();
    game.destroy();
  });

  it('runs a long random drive through terrains and power-ups without throwing', () => {
    const { ctx, held } = makeContext();
    const game = new RoadBurnerGame();
    game.init(ctx);
    // Drive far enough to cross terrain segments and the day→night cycle.
    expect(() => {
      for (let i = 0; i < 4000; i += 1) {
        held.clear();
        if (i % 120 < 60) held.add('right');
        else held.add('left');
        held.add('up');
        game.update(1 / 60);
        if (i % 7 === 0) game.render((i % 60) / 60);
      }
    }).not.toThrow();
    game.destroy();
  });
});
