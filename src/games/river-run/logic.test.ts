import { describe, expect, it } from 'vitest';
import {
  BIOME_SEGMENT,
  biomeAt,
  biomeForSegment,
  channelAt,
  circleHit,
  DAY_LEG,
  ENEMIES,
  ENEMY_KINDS,
  enemySpawnInterval,
  FIELD_W,
  fuelDrain,
  FUEL_DRAIN,
  HW_MAX,
  HW_MIN,
  insideChannel,
  MAX_SPEED,
  MIN_SPEED,
  pickEnemyKind,
  pickPowerKind,
  POWER_KINDS,
  POWERS,
  scoreFromDistance,
  speedFor,
  timeOfDayAt,
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
    expect(enemySpawnInterval(1e9)).toBe(0.42);
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

describe('biomes', () => {
  it('opens in the city and cycles through all five deterministically', () => {
    expect(biomeForSegment(0)).toBe('city');
    expect(biomeAt(0).id).toBe('city');
    const seen = new Set<string>();
    for (let i = 0; i < 5; i += 1) seen.add(biomeForSegment(i));
    expect(seen).toEqual(new Set(['city', 'forest', 'mountains', 'ocean', 'space']));
  });

  it('reports progress within the current biome segment', () => {
    const a = biomeAt(BIOME_SEGMENT * 2.25);
    expect(a.index).toBe(2);
    expect(a.t).toBeCloseTo(0.25);
  });
});

describe('timeOfDayAt', () => {
  it('starts in daylight and reaches night mid-cycle', () => {
    expect(timeOfDayAt(0).phase).toBe('day');
    expect(timeOfDayAt(0).darkness).toBeCloseTo(0);
    const night = timeOfDayAt(DAY_LEG);
    expect(night.phase).toBe('night');
    expect(night.darkness).toBeCloseTo(1);
  });

  it('keeps darkness within [0,1] across a long flight', () => {
    for (let d = 0; d < 30000; d += 131) {
      const k = timeOfDayAt(d).darkness;
      expect(k).toBeGreaterThanOrEqual(0);
      expect(k).toBeLessThanOrEqual(1);
    }
  });
});

describe('enemies', () => {
  it('bigger ships take more hits and are worth more', () => {
    expect(ENEMIES.dread.hp).toBeGreaterThan(ENEMIES.drone.hp);
    expect(ENEMIES.dread.points).toBeGreaterThan(ENEMIES.drone.points);
    expect(ENEMIES.cruiser.big).toBe(true);
    expect(ENEMIES.scout.big).toBe(false);
  });

  it('only spawns scouts/drones early; shooters and heavies come later', () => {
    for (let r = 0; r < 1; r += 0.05) {
      const early = pickEnemyKind(0, r);
      expect(ENEMIES[early].minDistance).toBe(0);
      expect(ENEMIES[early].shoots).toBe(false);
    }
    const lateKinds = new Set<string>();
    for (let r = 0; r < 1; r += 0.01) lateKinds.add(pickEnemyKind(5000, r));
    expect([...lateKinds].some((k) => ENEMIES[k as keyof typeof ENEMIES].shoots)).toBe(true);
  });

  it('pickEnemyKind always returns a valid kind', () => {
    for (let r = 0; r < 1; r += 0.03) expect(ENEMY_KINDS).toContain(pickEnemyKind(2000, r));
  });
});

describe('power-ups', () => {
  it('defines all 10 kinds with a unique trophy each', () => {
    expect(POWER_KINDS).toHaveLength(10);
    expect(new Set(POWER_KINDS.map((k) => POWERS[k].trophyId)).size).toBe(10);
  });

  it('pickPowerKind always returns a valid kind across the range', () => {
    for (let r = 0; r < 1; r += 0.017) expect(POWER_KINDS).toContain(pickPowerKind(r));
  });
});
