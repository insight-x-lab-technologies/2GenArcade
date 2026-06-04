import { describe, expect, it } from 'vitest';
import {
  BALL_SPEED_BASE,
  BALL_SPEED_MAX,
  brickCenterX,
  brickHalfW,
  brickHp,
  brickPoints,
  brickReflection,
  BRICK_COLS,
  BRICK_HP_MAX,
  circleRectHit,
  FIELD_W,
  levelBallSpeed,
  MAX_BOUNCE,
  paddleBounce,
  pickBrickKind,
  pickPowerKind,
  POWER_KINDS,
  ROWS_BASE,
  ROWS_MAX,
  rowsForLevel,
  WALL,
} from './logic';

describe('levelBallSpeed', () => {
  it('grows with the level then caps', () => {
    expect(levelBallSpeed(1)).toBe(BALL_SPEED_BASE);
    expect(levelBallSpeed(4)).toBeGreaterThan(levelBallSpeed(1));
    expect(levelBallSpeed(999)).toBe(BALL_SPEED_MAX);
  });
});

describe('rowsForLevel', () => {
  it('grows every other level then caps', () => {
    expect(rowsForLevel(1)).toBe(ROWS_BASE);
    expect(rowsForLevel(5)).toBeGreaterThan(rowsForLevel(1));
    expect(rowsForLevel(999)).toBe(ROWS_MAX);
  });
});

describe('brickHp', () => {
  it('makes back rows tougher and hardens with level, clamped', () => {
    const rows = 6;
    expect(brickHp(0, rows, 1)).toBeGreaterThanOrEqual(brickHp(rows - 1, rows, 1));
    expect(brickHp(0, rows, 1)).toBeLessThan(brickHp(0, rows, 9));
    expect(brickHp(0, rows, 999)).toBeLessThanOrEqual(BRICK_HP_MAX);
    expect(brickHp(rows - 1, rows, 1)).toBeGreaterThanOrEqual(1);
  });
});

describe('brickPoints', () => {
  it('scales with starting hp', () => {
    expect(brickPoints(3)).toBeGreaterThan(brickPoints(1));
  });
});

describe('brick layout', () => {
  it('lays columns out left-to-right inside the walls and symmetric', () => {
    const xs = Array.from({ length: BRICK_COLS }, (_, c) => brickCenterX(c));
    for (let i = 1; i < xs.length; i += 1) expect(xs[i]!).toBeGreaterThan(xs[i - 1]!);
    expect(xs[0]! + xs[BRICK_COLS - 1]!).toBeCloseTo(FIELD_W);
    // First/last brick bodies stay inside the side walls.
    expect(xs[0]! - brickHalfW()).toBeGreaterThanOrEqual(WALL - 1e-6);
    expect(xs[BRICK_COLS - 1]! + brickHalfW()).toBeLessThanOrEqual(FIELD_W - WALL + 1e-6);
  });
});

describe('paddleBounce', () => {
  it('always sends the ball upward and aims by contact offset', () => {
    const speed = 60;
    const left = paddleBounce(-1, speed);
    const mid = paddleBounce(0, speed);
    const right = paddleBounce(1, speed);
    expect(left.vy).toBeLessThan(0);
    expect(mid.vy).toBeLessThan(0);
    expect(right.vy).toBeLessThan(0);
    expect(left.vx).toBeLessThan(0);
    expect(mid.vx).toBeCloseTo(0);
    expect(right.vx).toBeGreaterThan(0);
    // Speed is preserved.
    expect(Math.hypot(left.vx, left.vy)).toBeCloseTo(speed);
    // Clamped to the steepest angle.
    expect(Math.abs(Math.atan2(right.vx, -right.vy))).toBeLessThanOrEqual(MAX_BOUNCE + 1e-6);
  });
});

describe('brickReflection', () => {
  it('flips Y for a face hit from below, X for a side hit, both at a corner', () => {
    // Ball centred under the brick → vertical face.
    const below = brickReflection(0, 3, 1.5, 0, 0, 4, 2);
    expect(below.hit).toBe(true);
    expect(below.flipY).toBe(true);
    expect(below.flipX).toBe(false);
    // Ball to the side → horizontal face.
    const side = brickReflection(5, 0, 1.5, 0, 0, 4, 2);
    expect(side.hit).toBe(true);
    expect(side.flipX).toBe(true);
    expect(side.flipY).toBe(false);
    // Far away → no hit.
    expect(brickReflection(50, 50, 1.5, 0, 0, 4, 2).hit).toBe(false);
  });
});

describe('circleRectHit', () => {
  it('detects ball vs paddle overlap', () => {
    expect(circleRectHit(0, 0, 2, 0, 1, 9, 1.8)).toBe(true);
    expect(circleRectHit(0, 20, 2, 0, 1, 9, 1.8)).toBe(false);
  });
});

describe('pickPowerKind', () => {
  it('always returns a known kind across the [0,1) range', () => {
    for (let i = 0; i < 50; i += 1) {
      const k = pickPowerKind(i / 50);
      expect(POWER_KINDS).toContain(k);
    }
  });
});

describe('pickBrickKind', () => {
  it('keeps the opening field plain (level 1 is always normal)', () => {
    for (let i = 0; i < 30; i += 1) expect(pickBrickKind(1, i / 30)).toBe('normal');
  });

  it('introduces special kinds from level 2+ and stays within the known set', () => {
    const kinds = new Set<string>();
    for (let lvl = 2; lvl <= 8; lvl += 1) {
      for (let i = 0; i < 200; i += 1) kinds.add(pickBrickKind(lvl, i / 200));
    }
    for (const k of kinds) {
      expect(['normal', 'steel', 'explosive', 'mover', 'regen']).toContain(k);
    }
    expect([...kinds].some((k) => k !== 'normal')).toBe(true);
  });
});
