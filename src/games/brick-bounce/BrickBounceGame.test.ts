import { describe, expect, it, vi } from 'vitest';
import type { Direction, GameContext, GameEventMap } from '@/types';
import { BrickBounceGame } from './BrickBounceGame';

const stubCtx2d = () => {
  const gradient = { addColorStop: () => undefined };
  return new Proxy(
    {},
    {
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
      isButtonHeld: () => false,
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

describe('BrickBounceGame (integration)', () => {
  it('emits an initial score and renders without throwing', () => {
    const { ctx, events } = makeContext();
    const game = new BrickBounceGame();
    game.init(ctx);
    expect(events.some((e) => e.type === 'score')).toBe(true);
    expect(() => game.render(0)).not.toThrow();
    game.destroy();
  });

  it('launches the ball on up and renders mid-tick without throwing', () => {
    const { ctx, held } = makeContext();
    const game = new BrickBounceGame();
    game.init(ctx);
    held.add('up');
    game.update(1 / 60);
    held.delete('up');
    expect(() => {
      for (let i = 0; i < 60; i += 1) game.update(1 / 60);
      game.render(0.5);
    }).not.toThrow();
    game.destroy();
  });

  it('breaks bricks and awards the first-brick trophy on a held launch flight', () => {
    const { ctx, events, held } = makeContext();
    const game = new BrickBounceGame();
    game.init(ctx);
    held.add('up');
    game.update(1 / 60);
    held.delete('up');
    // Cruise upward; the serve goes straight up into the wall of bricks.
    for (let i = 0; i < 400; i += 1) game.update(1 / 60);
    const t = events.find(
      (e) => e.type === 'trophy' && (e.payload as GameEventMap['trophy']).trophyId === 'firstBrick',
    );
    expect(t).toBeDefined();
    game.destroy();
  });

  it('ends the run with a numeric score and rich stats when balls are never launched', () => {
    // Never pressing up means the ball waits on the paddle; force a loss by
    // launching then ignoring it until every life is spent.
    const { ctx, events, held } = makeContext();
    const game = new BrickBounceGame();
    game.init(ctx);
    for (let i = 0; i < 6000; i += 1) {
      if (events.some((e) => e.type === 'gameover')) break;
      // Tap up occasionally to serve a fresh ball, then let it drain off-centre.
      if (i % 600 === 0) held.add('up');
      else held.delete('up');
      // Drift the paddle to a corner so served balls eventually fall past it.
      held.add('left');
      game.update(1 / 60);
    }
    const over = events.find((e) => e.type === 'gameover');
    expect(over).toBeDefined();
    const payload = over!.payload as GameEventMap['gameover'];
    expect(typeof payload.score).toBe('number');
    for (const key of ['level', 'bricks', 'blazes', 'levelsCleared', 'powerups']) {
      expect(payload.stats).toHaveProperty(key);
    }
    game.destroy();
  });

  it('survives a long random rally without throwing', () => {
    const { ctx, held } = makeContext();
    const game = new BrickBounceGame();
    game.init(ctx);
    held.add('up');
    game.update(1 / 60);
    held.delete('up');
    expect(() => {
      for (let i = 0; i < 4000; i += 1) {
        held.clear();
        if (i % 80 < 40) held.add('right');
        else held.add('left');
        if (i % 200 === 0) held.add('up'); // re-serve if a ball was lost
        game.update(1 / 60);
        if (i % 7 === 0) game.render((i % 60) / 60);
      }
    }).not.toThrow();
    game.destroy();
  });
});
