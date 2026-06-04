import { describe, expect, it } from 'vitest';
import {
  aabbHit,
  AMP_MAX,
  CAR_HW,
  DAY_LEG,
  FIELD_W,
  gripApproach,
  isBigVehicle,
  isNearMiss,
  laneCenter,
  MAX_SPEED,
  MIN_SPEED,
  NEARMISS_GAP,
  NUM_LANES,
  ONCOMING_MIN_DISTANCE,
  oncomingChance,
  onRoad,
  pickPowerKind,
  pickVehicleKind,
  POWER_KINDS,
  POWERS,
  ROAD_HALF,
  roadAt,
  scoreFromDistance,
  SEGMENT_LEN,
  speedFor,
  terrainAt,
  terrainForSegment,
  TERRAINS,
  timeOfDayAt,
  trafficSpawnInterval,
  VEHICLE_KINDS,
  VEHICLES,
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
    expect(trafficSpawnInterval(1e9)).toBe(0.5);
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

describe('gripApproach', () => {
  it('moves toward the target without overshooting', () => {
    const v = gripApproach(0, 100, 1, 1 / 60);
    expect(v).toBeGreaterThan(0);
    expect(v).toBeLessThan(100);
  });

  it('higher grip converges faster (slidey when low)', () => {
    const high = gripApproach(0, 100, 1.0, 1 / 60);
    const low = gripApproach(0, 100, 0.4, 1 / 60);
    expect(high).toBeGreaterThan(low);
  });
});

describe('terrains', () => {
  it('opens on asphalt then cycles through deterministic terrains', () => {
    expect(terrainForSegment(0)).toBe('asphalt');
    expect(terrainAt(0).id).toBe('asphalt');
    const seen = new Set<string>();
    for (let i = 0; i < 8; i += 1) seen.add(terrainForSegment(i));
    expect(seen).toEqual(new Set(['asphalt', 'rain', 'mud', 'snow']));
  });

  it('asphalt has the best speed and grip; snow the worst', () => {
    expect(TERRAINS.asphalt.speedMul).toBeGreaterThan(TERRAINS.snow.speedMul);
    expect(TERRAINS.asphalt.grip).toBeGreaterThan(TERRAINS.mud.grip);
    expect(TERRAINS.mud.grip).toBeGreaterThan(TERRAINS.snow.grip);
  });

  it('terrainAt reports progress within the current segment', () => {
    const a = terrainAt(SEGMENT_LEN * 1.5);
    expect(a.index).toBe(1);
    expect(a.t).toBeCloseTo(0.5);
  });
});

describe('timeOfDayAt', () => {
  it('starts in daylight and reaches night mid-cycle', () => {
    expect(timeOfDayAt(0).phase).toBe('day');
    expect(timeOfDayAt(0).darkness).toBeCloseTo(0);
    const night = timeOfDayAt(DAY_LEG); // peak darkness
    expect(night.phase).toBe('night');
    expect(night.darkness).toBeCloseTo(1);
  });

  it('keeps darkness within [0,1] across a long drive', () => {
    for (let d = 0; d < 30000; d += 137) {
      const k = timeOfDayAt(d).darkness;
      expect(k).toBeGreaterThanOrEqual(0);
      expect(k).toBeLessThanOrEqual(1);
    }
  });
});

describe('vehicles', () => {
  it('bigger vehicles are larger and slower', () => {
    expect(VEHICLES.rig.hh).toBeGreaterThan(VEHICLES.car.hh);
    expect(VEHICLES.car.hh).toBeGreaterThan(VEHICLES.bike.hh);
    expect(VEHICLES.rig.maxSpeed).toBeLessThan(VEHICLES.bike.maxSpeed);
    expect(isBigVehicle('rig')).toBe(true);
    expect(isBigVehicle('bike')).toBe(false);
  });

  it('pickVehicleKind always returns a valid kind across the range', () => {
    for (let r = 0; r < 1; r += 0.013) {
      expect(VEHICLE_KINDS).toContain(pickVehicleKind(r));
    }
  });
});

describe('oncomingChance', () => {
  it('is zero until the opening stretch is over, then ramps and caps', () => {
    expect(oncomingChance(0)).toBe(0);
    expect(oncomingChance(ONCOMING_MIN_DISTANCE - 1)).toBe(0);
    expect(oncomingChance(ONCOMING_MIN_DISTANCE + 2000)).toBeGreaterThan(0);
    expect(oncomingChance(999999)).toBeLessThanOrEqual(0.34);
    expect(oncomingChance(ONCOMING_MIN_DISTANCE + 6000)).toBeGreaterThan(
      oncomingChance(ONCOMING_MIN_DISTANCE + 2000),
    );
  });
});

describe('power-ups', () => {
  it('defines all 8 kinds with a unique trophy each', () => {
    expect(POWER_KINDS).toHaveLength(8);
    const trophies = new Set(POWER_KINDS.map((k) => POWERS[k].trophyId));
    expect(trophies.size).toBe(8);
  });

  it('pickPowerKind always returns a valid kind across the range', () => {
    for (let r = 0; r < 1; r += 0.017) {
      expect(POWER_KINDS).toContain(pickPowerKind(r));
    }
  });
});
