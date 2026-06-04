import { describe, expect, it, vi } from 'vitest';
import type { Direction, GameContext, GameEventMap } from '@/types';
import { StarDefenderGame } from './StarDefenderGame';

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

describe('StarDefenderGame (integration)', () => {
  it('emits an initial score and renders without throwing', () => {
    const { ctx, events } = makeContext();
    const game = new StarDefenderGame();
    game.init(ctx);
    expect(events.some((e) => e.type === 'score')).toBe(true);
    expect(() => game.render(0)).not.toThrow();
    game.destroy();
  });

  it('moves, fires (button held) and renders mid-tick without throwing', () => {
    const { ctx, held, heldButtons } = makeContext();
    const game = new StarDefenderGame();
    game.init(ctx);
    held.add('right');
    heldButtons.add('fire');
    expect(() => {
      for (let i = 0; i < 40; i += 1) game.update(1 / 60);
      game.render(0.5);
    }).not.toThrow();
    game.destroy();
  });

  it('destroys wraiths and awards first blood while the fire button is held', () => {
    const { ctx, events, heldButtons } = makeContext();
    const game = new StarDefenderGame();
    game.init(ctx);
    // Cruise at centre holding fire: shots eventually destroy the column overhead.
    heldButtons.add('fire');
    for (let i = 0; i < 600; i += 1) game.update(1 / 60);
    const t = events.find(
      (e) => e.type === 'trophy' && (e.payload as GameEventMap['trophy']).trophyId === 'firstBlood',
    );
    expect(t).toBeDefined();
    game.destroy();
  });

  it('drops, falls and collects a power-up (firstPower) with deterministic RNG', () => {
    const rnd = vi.spyOn(Math, 'random').mockReturnValue(0.02); // always drops; picks 'shield'
    try {
      const { ctx, events, sfx, heldButtons } = makeContext();
      const game = new StarDefenderGame();
      game.init(ctx);
      // Hold fire at centre: kills the overhead column, which drops a pickup that
      // falls straight onto the centred ship.
      heldButtons.add('fire');
      for (let i = 0; i < 800; i += 1) {
        if (events.some((e) => e.type === 'gameover')) break;
        game.update(1 / 60);
      }
      expect(sfx.includes('powerup')).toBe(true);
      const t = events.find(
        (e) => e.type === 'trophy' && (e.payload as GameEventMap['trophy']).trophyId === 'firstPower',
      );
      expect(t).toBeDefined();
      game.destroy();
    } finally {
      rnd.mockRestore();
    }
  });

  it('survives a long aggressive run (fire + strafe + nova taps) without throwing', () => {
    const { ctx, events, held, heldButtons } = makeContext();
    const game = new StarDefenderGame();
    game.init(ctx);
    heldButtons.add('fire');
    expect(() => {
      for (let i = 0; i < 3000; i += 1) {
        if (events.some((e) => e.type === 'gameover')) break;
        held.clear();
        held.add(i % 80 < 40 ? 'right' : 'left');
        heldButtons.delete('nova');
        if (i % 90 === 0) heldButtons.add('nova'); // tap when it may be charged
        game.update(1 / 60);
        if (i % 7 === 0) game.render((i % 60) / 60);
      }
    }).not.toThrow();
    game.destroy();
  });

  it('ends the run (invasion or lives lost) with numeric score and stats', () => {
    const { ctx, events, held } = makeContext();
    const game = new StarDefenderGame();
    game.init(ctx);
    // Pin to the left wall so shots mostly miss and the formation invades.
    held.add('left');
    for (let i = 0; i < 8000; i += 1) {
      if (events.some((e) => e.type === 'gameover')) break;
      game.update(1 / 60);
    }
    const over = events.find((e) => e.type === 'gameover');
    expect(over).toBeDefined();
    const payload = over!.payload as GameEventMap['gameover'];
    expect(typeof payload.score).toBe('number');
    for (const key of ['wave', 'kills', 'novas', 'bosses', 'powerups', 'livesGained']) {
      expect(payload.stats).toHaveProperty(key);
    }
    game.destroy();
  });
});
