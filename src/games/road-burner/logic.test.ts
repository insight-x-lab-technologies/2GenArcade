import { describe, expect, it } from 'vitest';
import {
  aabbHit,
  AMP_MAX,
  CAR_HW,
  FIELD_W,
  isNearMiss,
  laneCenter,
  MAX_SPEED,
  MIN_SPEED,
  NEARMISS_GAP,
  NUM_LANES,
  onRoad,
  ROAD_HALF,
  roadAt,
  scoreFromDistance,
  speedFor,
  trafficSpawnInterval,
  worldYAt,
} from './logic';

describe('roadAt', () => {
  it('keeps a constant width but curves within bounds', () => {
    expect(roadAt(0).half).toBe(ROAD_HALF);
    expect(roadAt(50000).half).toBe(ROAD_HALF);
  });

  it('always keeps both guardrails on the field', () => {
    for (let w = 0; w < 8000; w += 113) {
      const r = roadAt(w);
      expect(r.center - r.half).toBeGreaterThanOrEqual(0);
      expect(r.center + r.half).toBeLessThanOrEqual(FIELD_W);
    }
  });

  it('curve amplitude grows with distance but stays capped', () => {
    const offsets: number[] = [];
    for (let w = 0; w < 6000; w += 7) offsets.push(Math.abs(roadAt(w).center - 50));
    expect(Math.max(...offsets)).toBeLessThanOrEqual(AMP_MAX + 1e-6);
  });
});

describe('laneCenter', () => {
  it('places every lane fully on the road, left-to-right', () => {
    const road = roadAt(1234);
    const centers = Array.from({ length: NUM_LANES }, (_, i) => laneCenter(road, i));
    for (let i = 1; i < centers.length; i += 1) {
      expect(centers[i]!).toBeGreaterThan(centers[i - 1]!);
    }
    for (const c of centers) {
      expect(onRoad(c, road)).toBe(true);
    }
  });
});

describe('onRoad', () => {
  it('respects the car half-width at the guardrails', () => {
    const road = { center: 50, half: 30 };
    expect(onRoad(50, road)).toBe(true);
    expect(onRoad(21, road, 3)).toBe(false); // 21 - 3 < 20
    expect(onRoad(24, road, 3)).toBe(true);
    expect(onRoad(82, road, CAR_HW)).toBe(false);
  });
});

describe('worldYAt', () => {
  it('maps the top of the screen further up-road than the bottom', () => {
    expect(worldYAt(1000, 0)).toBeGreaterThan(worldYAt(1000, 178));
  });
});

describe('speedFor', () => {
  it('gas is faster than cruise is faster than brake', () => {
    expect(speedFor(1, 0)).toBeGreaterThan(speedFor(0, 0));
    expect(speedFor(0, 0)).toBeGreaterThan(speedFor(-1, 0));
  });

  it('ramps with distance but stays clamped', () => {
    expect(speedFor(0, 100000)).toBeGreaterThan(speedFor(0, 0));
    expect(speedFor(1, 100000)).toBeLessThanOrEqual(MAX_SPEED);
    expect(speedFor(-1, 0)).toBeGreaterThanOrEqual(MIN_SPEED);
  });
});

describe('trafficSpawnInterval', () => {
  it('spawns denser traffic the further you go, with a floor', () => {
    expect(trafficSpawnInterval(0)).toBeGreaterThan(trafficSpawnInterval(5000));
    expect(trafficSpawnInterval(1e9)).toBe(0.55);
  });
});

describe('aabbHit', () => {
  it('detects box overlap and clears separation', () => {
    expect(aabbHit(0, 0, 4, 7, 5, 0, 4, 7)).toBe(true); // dx 5 <= 8
    expect(aabbHit(0, 0, 4, 7, 20, 0, 4, 7)).toBe(false); // dx 20 > 8
    expect(aabbHit(0, 0, 4, 7, 0, 20, 4, 7)).toBe(false); // dy 20 > 14
  });
});

describe('isNearMiss', () => {
  it('is true only when close but not crashing', () => {
    const crashGap = CAR_HW * 2;
    expect(isNearMiss(crashGap + 1, crashGap)).toBe(true);
    expect(isNearMiss(crashGap - 1, crashGap)).toBe(false); // a crash, not a pass
    expect(isNearMiss(NEARMISS_GAP + 5, crashGap)).toBe(false); // too far apart
  });
});

describe('scoreFromDistance', () => {
  it('combines floored distance with bonuses', () => {
    expect(scoreFromDistance(1234.7, 0)).toBe(1234);
    expect(scoreFromDistance(1000, 360)).toBe(1360);
  });
});
