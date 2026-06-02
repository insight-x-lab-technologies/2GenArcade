import { describe, expect, it } from 'vitest';
import {
  channelAt,
  circleHit,
  enemySpawnInterval,
  FIELD_W,
  fuelDrain,
  FUEL_DRAIN,
  HW_MAX,
  HW_MIN,
  insideChannel,
  MAX_SPEED,
  MIN_SPEED,
  scoreFromDistance,
  speedFor,
  worldYAt,
} from './logic';

describe('channelAt', () => {
  it('starts wide and narrows monotonically to a floor', () => {
    expect(channelAt(0).half).toBeCloseTo(HW_MAX);
    expect(channelAt(2000).half).toBeLessThan(channelAt(0).half);
    expect(channelAt(100000).half).toBe(HW_MIN);
  });

  it('always keeps both walls on the field', () => {
    for (let w = 0; w < 8000; w += 137) {
      const ch = channelAt(w);
      expect(ch.center - ch.half).toBeGreaterThanOrEqual(0);
      expect(ch.center + ch.half).toBeLessThanOrEqual(FIELD_W);
    }
  });
});

describe('insideChannel', () => {
  it('respects the body radius', () => {
    const ch = { center: 50, half: 20 };
    expect(insideChannel(50, ch)).toBe(true);
    expect(insideChannel(31, ch, 3)).toBe(false); // 31 - 3 < 30
    expect(insideChannel(34, ch, 3)).toBe(true);
    expect(insideChannel(72, ch, 0)).toBe(false); // beyond right wall
  });
});

describe('worldYAt', () => {
  it('maps the top of the screen further upriver than the bottom', () => {
    expect(worldYAt(1000, 0)).toBeGreaterThan(worldYAt(1000, 178));
  });
});

describe('speedFor', () => {
  it('boost is faster than cruise is faster than brake', () => {
    expect(speedFor(1, 0)).toBeGreaterThan(speedFor(0, 0));
    expect(speedFor(0, 0)).toBeGreaterThan(speedFor(-1, 0));
  });

  it('ramps with distance but stays clamped', () => {
    expect(speedFor(0, 100000)).toBeGreaterThan(speedFor(0, 0));
    expect(speedFor(1, 100000)).toBeLessThanOrEqual(MAX_SPEED);
    expect(speedFor(-1, 0)).toBeGreaterThanOrEqual(MIN_SPEED);
  });
});

describe('fuel + spawns', () => {
  it('drains faster while boosting', () => {
    expect(fuelDrain(false)).toBe(FUEL_DRAIN);
    expect(fuelDrain(true)).toBeGreaterThan(fuelDrain(false));
  });

  it('spawns enemies more often the further you go, with a floor', () => {
    expect(enemySpawnInterval(0)).toBeGreaterThan(enemySpawnInterval(5000));
    expect(enemySpawnInterval(1e9)).toBe(0.5);
  });
});

describe('circleHit', () => {
  it('detects overlap and clears non-overlap', () => {
    expect(circleHit(0, 0, 2, 3, 0, 2)).toBe(true); // distance 3 <= 4
    expect(circleHit(0, 0, 1, 5, 0, 1)).toBe(false); // distance 5 > 2
  });
});

describe('scoreFromDistance', () => {
  it('combines floored distance with bonuses', () => {
    expect(scoreFromDistance(1234.7, 0)).toBe(1234);
    expect(scoreFromDistance(1000, 360)).toBe(1360);
  });
});
