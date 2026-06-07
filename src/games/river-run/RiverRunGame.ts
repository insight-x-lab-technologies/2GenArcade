import type { GameContext, GameModule, GameMeta } from '@/types';
import { clamp } from '@/engine';
import { riverRunMeta } from './meta';
import {
  type BiomeId,
  type DayPhase,
  type EnemyKind,
  type FormationKind,
  type PowerKind,
  biomeAt,
  BOSS_HOLD_Y,
  BOSS_R,
  bossDueForIndex,
  bossHpForIndex,
  bossRewardForIndex,
  channelAt,
  circleHit,
  ENEMIES,
  enemySpawnInterval,
  FIELD_H,
  FIELD_W,
  FORMATION_MIN_DISTANCE,
  formationChance,
  formationSlots,
  fuelDrain,
  FUEL_BONUS,
  FUEL_MAX,
  FUEL_REGEN,
  insideChannel,
  MAGNET_PULL,
  PLAYER_R,
  PLAYER_Y,
  pickEnemyKind,
  pickPowerKind,
  POWER_KINDS,
  POWERS,
  POWERUP_R,
  scoreFromDistance,
  SLOWMO_FACTOR,
  speedFor,
  SUPERSPEED_BONUS,
  TANK_HP,
  TANK_R,
  TANK_REFILL_RATE,
  timeOfDayAt,
  worldYAt,
} from './logic';

const PLAYER_SPEED = 78;
const BULLET_SPEED = 168;
const ENEMY_BULLET_SPEED = 74;
const FIRE_NORMAL = 0.18;
const FIRE_BOOST = 0.12;
const FIRE_RAPID = 0.07;
const ENEMY_REL = 1;
const ENEMY_EXTRA = 12;
const STAR_COUNT = 52;
const SPREAD_VX = 42;

// Missile (secondary weapon): slower than bullets, limited ammo, area blast.
const MISSILE_SPEED = 116;
const MISSILE_START = 3;
const MISSILE_MAX = 6;
const MISSILE_REGEN = 11; // seconds to passively regain one missile
const MISSILE_BLAST_R = 16; // area-of-effect radius (field units)
const MISSILE_DAMAGE = 5; // damage to every ship caught in the blast
const MISSILE_COOLDOWN = 0.18; // min seconds between launches
const MISSILE_DETONATE_Y = 14; // detonate near the top if it hits nothing

// Mini-boss (B2). Reuses the enemy-bullet stream so player collisions are shared.
const BOSS_ID = -1; // reserved pierce-tracking id (enemy ids start at 1)
const BOSS_DESCENT = 26; // units/s while entering from the top
const BOSS_FIRE_INTERVAL = 1.15;
const BOSS_BULLET_SPREAD = 34;

// Formations (B3): kamikaze ships steer toward the player's column as they dive.
const DIVE_STEER = 30; // horizontal units/s a diver tracks the player

interface Bullet {
  x: number;
  y: number;
  prevX: number;
  prevY: number;
  vx: number;
  pierce: boolean;
  hit: Set<number> | null;
}
interface Missile {
  x: number;
  y: number;
  prevX: number;
  prevY: number;
}
interface EnemyBullet {
  x: number;
  y: number;
  prevX: number;
  prevY: number;
  vx: number;
}
interface Enemy {
  id: number;
  kind: EnemyKind;
  x: number;
  y: number;
  prevY: number;
  r: number;
  hp: number;
  maxHp: number;
  points: number;
  speedMul: number;
  shoots: boolean;
  big: boolean;
  spin: number;
  fireTimer: number;
  hitFlash: number;
  /** Kamikaze: steers toward the player as it descends (B3 formations). */
  dive: boolean;
}
interface Tank {
  x: number;
  y: number;
  prevY: number;
  hp: number;
  hitFlash: number;
  tapped: boolean;
}
interface Boss {
  x: number;
  y: number;
  prevX: number;
  prevY: number;
  hp: number;
  maxHp: number;
  index: number;
  entering: boolean;
  sway: number;
  fireTimer: number;
  pattern: number;
  hitFlash: number;
}
interface PowerUp {
  kind: PowerKind;
  x: number;
  y: number;
  prevY: number;
}
interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  max: number;
  color: string;
}
interface Star {
  x: number;
  y: number;
  speed: number;
  size: number;
}

interface BiomePalette {
  wall: [string, string];
  edges: [string, string];
  bg: string;
  star: string;
}

const PALETTES: Record<BiomeId, BiomePalette> = {
  city: { wall: ['#2a1d5e', '#5e2a6e'], edges: ['#ff7ad0', '#7ea6ff'], bg: '#0a0618', star: '#c0a8e8' },
  forest: { wall: ['#173a1d', '#2a5e2d'], edges: ['#9be15d', '#46d4c4'], bg: '#06120a', star: '#9be0a0' },
  mountains: { wall: ['#2a3340', '#4a5466'], edges: ['#cfe0ff', '#9fb0c8'], bg: '#0a1018', star: '#dfe8ff' },
  ocean: { wall: ['#0d2a4a', '#16506e'], edges: ['#46d4c4', '#5ec8ff'], bg: '#04101c', star: '#7fe6ff' },
  space: { wall: ['#1a1030', '#2a1d4e'], edges: ['#b06cff', '#ff7ad0'], bg: '#03030f', star: '#ffffff' },
};

const POWER_TROPHY: Record<PowerKind, string> = {
  shield: 'ironclad',
  superSpeed: 'lightspeed',
  doubleShot: 'twinGuns',
  tripleShot: 'trident',
  rapidFire: 'stormFire',
  piercing: 'railgun',
  magnet: 'tractor',
  slowmo: 'bulletTime',
  scoreX2: 'jackpot',
  regen: 'recycler',
  warhead: 'warmonger',
};
const BIOME_TROPHY: Record<BiomeId, string> = {
  city: 'cityRunner',
  forest: 'forestRunner',
  mountains: 'mountaineer',
  ocean: 'seafarer',
  space: 'astronaut',
};
const ENEMY_COLORS: Record<EnemyKind, string> = {
  scout: '#ff9d5d',
  drone: '#ff5d73',
  gunship: '#ffd27a',
  cruiser: '#b06cff',
  dread: '#ff5db0',
};

const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;
const hexToRgb = (hex: string): [number, number, number] => {
  const h = hex.replace('#', '');
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
};
const darken = (hex: string, k: number): string => {
  const [r, g, b] = hexToRgb(hex);
  const f = 1 - clamp(k, 0, 1);
  return `rgb(${Math.round(r * f + 8 * (1 - f))},${Math.round(g * f + 6 * (1 - f))},${Math.round(
    b * f + 20 * (1 - f),
  )})`;
};

export class RiverRunGame implements GameModule {
  readonly meta: GameMeta = riverRunMeta;

  private ctx!: GameContext;
  private g!: CanvasRenderingContext2D;

  private px = FIELD_W / 2;
  private prevPx = FIELD_W / 2;
  private distance = 0;
  private prevDistance = 0;
  private fuel = FUEL_MAX;

  private bullets: Bullet[] = [];
  private missiles: Missile[] = [];
  private enemies: Enemy[] = [];
  private enemyBullets: EnemyBullet[] = [];
  private tanks: Tank[] = [];
  private powerups: PowerUp[] = [];
  private particles: Particle[] = [];
  private stars: Star[] = [];
  private nextId = 1;

  // Mini-boss (B2): one at a time, spawned at biome transitions.
  private boss: Boss | null = null;
  private bossSpawnedIndex = -1;
  private lastBiomeIndex = 0;
  private bossKills = 0;
  private diverKills = 0;

  private fireTimer = 0;
  private missileAmmo = MISSILE_START;
  private missileRegenTimer = 0;
  private missileCd = 0;
  private prevMissileHeld = false;
  private shake = 0;
  private enemyTimer = 1;
  private tankTimer = 4;
  private powerTimer = 6;
  private warheadTimer = 16;

  private fx: Record<PowerKind, number> = this.zeroFx();

  private score = 0;
  private bonus = 0;
  private kills = 0;
  private bigKills = 0;
  private fuelTanks = 0;
  private boosts = 0;
  private missilesFired = 0;
  private missileKills = 0;
  private powerupsCollected = 0;
  private usedKinds = new Set<PowerKind>();
  private biomesSeen = new Set<BiomeId>();
  private nightSeen = false;
  private awarded = new Set<string>();

  private biomeId: BiomeId = 'city';
  private darkness = 0;
  private phase: DayPhase = 'day';

  private toast = '';
  private toastColor = '#ffd27a';
  private toastTime = 0;

  private emitTimer = 0;
  private lastEmitted = -1;
  private flash = 0;
  private flashColor = '#ff5d73';
  private gameOver = false;
  private boosting = false;

  private zeroFx(): Record<PowerKind, number> {
    return {
      shield: 0,
      superSpeed: 0,
      doubleShot: 0,
      tripleShot: 0,
      rapidFire: 0,
      piercing: 0,
      magnet: 0,
      slowmo: 0,
      scoreX2: 0,
      regen: 0,
      warhead: 0,
    };
  }

  init(ctx: GameContext): void {
    this.ctx = ctx;
    const c2d = ctx.canvas.getContext('2d');
    if (!c2d) throw new Error('2D context unavailable');
    this.g = c2d;
    this.reset();
    ctx.audio.playMusic('gameplay');
    this.emitScore(true);
  }

  private reset(): void {
    this.px = FIELD_W / 2;
    this.prevPx = this.px;
    this.distance = 0;
    this.prevDistance = 0;
    this.fuel = FUEL_MAX;
    this.bullets = [];
    this.missiles = [];
    this.enemies = [];
    this.enemyBullets = [];
    this.tanks = [];
    this.powerups = [];
    this.particles = [];
    this.nextId = 1;
    this.boss = null;
    this.bossSpawnedIndex = -1;
    this.lastBiomeIndex = 0;
    this.bossKills = 0;
    this.diverKills = 0;
    this.fireTimer = 0;
    this.missileAmmo = MISSILE_START;
    this.missileRegenTimer = 0;
    this.missileCd = 0;
    this.prevMissileHeld = false;
    this.shake = 0;
    this.enemyTimer = 1;
    this.tankTimer = 4;
    this.powerTimer = 6;
    this.warheadTimer = 16;
    this.fx = this.zeroFx();
    this.score = 0;
    this.bonus = 0;
    this.kills = 0;
    this.bigKills = 0;
    this.fuelTanks = 0;
    this.boosts = 0;
    this.missilesFired = 0;
    this.missileKills = 0;
    this.powerupsCollected = 0;
    this.usedKinds = new Set();
    this.biomesSeen = new Set();
    this.nightSeen = false;
    this.awarded = new Set();
    this.biomeId = 'city';
    this.darkness = 0;
    this.phase = 'day';
    this.toast = '';
    this.toastTime = 0;
    this.emitTimer = 0;
    this.lastEmitted = -1;
    this.flash = 0;
    this.gameOver = false;
    this.boosting = false;
    this.stars = Array.from({ length: STAR_COUNT }, () => ({
      x: Math.random() * FIELD_W,
      y: Math.random() * FIELD_H,
      speed: 0.12 + Math.random() * 0.4,
      size: 0.4 + Math.random() * 0.9,
    }));
  }

  private active(k: PowerKind): boolean {
    return this.fx[k] > 0;
  }
  private award(id: string): void {
    if (this.awarded.has(id)) return;
    this.awarded.add(id);
    this.ctx.emit.emit('trophy', { trophyId: id });
  }
  private setFlash(color: string, amount: number): void {
    this.flashColor = color;
    this.flash = Math.max(this.flash, amount);
  }

  // ---- Simulation -----------------------------------------------------------

  update(dt: number): void {
    if (this.gameOver) return;
    const input = this.ctx.input;

    this.prevPx = this.px;
    this.prevDistance = this.distance;
    for (const b of this.bullets) {
      b.prevX = b.x;
      b.prevY = b.y;
    }
    for (const m of this.missiles) {
      m.prevX = m.x;
      m.prevY = m.y;
    }
    for (const e of this.enemies) e.prevY = e.y;
    for (const eb of this.enemyBullets) {
      eb.prevX = eb.x;
      eb.prevY = eb.y;
    }
    for (const t of this.tanks) t.prevY = t.y;
    for (const p of this.powerups) p.prevY = p.y;
    if (this.boss) {
      this.boss.prevX = this.boss.x;
      this.boss.prevY = this.boss.y;
    }

    // Biome + time of day (pure functions of distance).
    const biome = biomeAt(this.distance);
    const tod = timeOfDayAt(this.distance);
    this.biomeId = biome.id;
    this.darkness = tod.darkness;
    this.phase = tod.phase;
    if (!this.biomesSeen.has(biome.id)) {
      this.biomesSeen.add(biome.id);
      this.award(BIOME_TROPHY[biome.id]);
    }
    if (tod.phase === 'night' && !this.nightSeen) {
      this.nightSeen = true;
      this.award('nightOwl');
    }

    // Mini-boss at biome transitions (B2): spawn once per new biome index.
    if (biome.index !== this.lastBiomeIndex) {
      this.lastBiomeIndex = biome.index;
      if (!this.boss && bossDueForIndex(biome.index, this.bossSpawnedIndex)) {
        this.spawnBoss(biome.index);
      }
    }
    if (this.boss) this.updateBoss(dt, this.active('slowmo') ? SLOWMO_FACTOR : 1);

    // Throttle: up = boost, down = brake.
    const boost = input.isHeld('up');
    const brake = input.isHeld('down');
    this.boosting = boost && !brake;
    const throttle = this.boosting ? 1 : brake ? -1 : 0;
    let speed = speedFor(throttle, this.distance);
    if (this.active('superSpeed')) speed += SUPERSPEED_BONUS;

    this.distance += speed * dt;
    const scoreMul = this.active('scoreX2') ? 2 : 1;
    if (scoreMul > 1) this.bonus += speed * dt * (scoreMul - 1);

    // Fuel: drains faster now; Regen tops it up.
    this.fuel = Math.max(0, this.fuel - fuelDrain(this.boosting) * dt);
    if (this.active('regen')) this.fuel = Math.min(FUEL_MAX, this.fuel + FUEL_REGEN * dt);
    if (this.fuel <= 0) {
      this.endGame();
      return;
    }
    if (this.boosting && this.boosts === 0) {
      this.boosts = 1;
      this.ctx.audio.playSfx('boost');
      this.award('afterburner');
    }

    // Steering (continuous via held inputs — no gesture lag).
    const dir = (input.isHeld('right') ? 1 : 0) - (input.isHeld('left') ? 1 : 0);
    this.px = clamp(this.px + dir * PLAYER_SPEED * dt, PLAYER_R, FIELD_W - PLAYER_R);

    this.fireWeapons(dt);
    this.spawnTimers(dt);
    this.moveEntities(dt, speed);
    this.resolveCollisions(dt);

    for (const k of POWER_KINDS) if (this.fx[k] > 0) this.fx[k] = Math.max(0, this.fx[k] - dt);
    this.updateParticles(dt);
    if (this.flash > 0) this.flash = Math.max(0, this.flash - dt * 2.5);
    if (this.shake > 0) this.shake = Math.max(0, this.shake - dt * 16);
    if (this.toastTime > 0) this.toastTime = Math.max(0, this.toastTime - dt);

    this.score = scoreFromDistance(this.distance, this.bonus);
    this.emitTimer += dt;
    if (this.emitTimer >= 0.1) {
      this.emitTimer = 0;
      this.emitScore(false);
    }
  }

  private fireWeapons(dt: number): void {
    const input = this.ctx.input;

    // Missiles slowly replenish so the secondary weapon is never dead for long.
    if (this.missileCd > 0) this.missileCd = Math.max(0, this.missileCd - dt);
    if (this.missileAmmo < MISSILE_MAX) {
      this.missileRegenTimer += dt;
      if (this.missileRegenTimer >= MISSILE_REGEN) {
        this.missileRegenTimer = 0;
        this.missileAmmo += 1;
      }
    } else {
      this.missileRegenTimer = 0;
    }

    // Secondary: missile on the rising edge of the (tap) button.
    const missileHeld = input.isButtonHeld('missile');
    if (missileHeld && !this.prevMissileHeld) this.fireMissile();
    this.prevMissileHeld = missileHeld;

    // Primary: hold-to-fire. The timer keeps the original cadence; when the
    // button is released we park it at 0 so the next press fires immediately.
    this.fireTimer -= dt;
    if (!input.isButtonHeld('fire')) {
      if (this.fireTimer < 0) this.fireTimer = 0;
      return;
    }
    if (this.fireTimer > 0) return;

    const pierce = this.active('piercing');
    const y = PLAYER_Y - 4;
    const make = (x: number, vx: number): Bullet => ({
      x,
      y,
      prevX: x,
      prevY: y,
      vx,
      pierce,
      hit: pierce ? new Set<number>() : null,
    });
    if (this.active('tripleShot')) {
      this.bullets.push(make(this.px, 0), make(this.px, -SPREAD_VX), make(this.px, SPREAD_VX));
    } else if (this.active('doubleShot')) {
      this.bullets.push(make(this.px - 2.2, 0), make(this.px + 2.2, 0));
    } else {
      this.bullets.push(make(this.px, 0));
    }
    this.fireTimer = this.active('rapidFire') ? FIRE_RAPID : this.boosting ? FIRE_BOOST : FIRE_NORMAL;
    this.ctx.audio.playSfx('shoot');
  }

  private fireMissile(): void {
    if (this.missileCd > 0) return;
    if (this.missileAmmo <= 0) {
      this.ctx.audio.playSfx('empty');
      return;
    }
    this.missileAmmo -= 1;
    this.missileCd = MISSILE_COOLDOWN;
    this.missilesFired += 1;
    const y = PLAYER_Y - PLAYER_R;
    this.missiles.push({ x: this.px, y, prevX: this.px, prevY: y });
    this.ctx.audio.playSfx('missile');
    this.award('warmonger');
  }

  /** Area-of-effect detonation: damages every ship and tank within the blast. */
  private explodeMissile(x: number, y: number, scoreMul: number): void {
    this.ctx.audio.playSfx('missileBoom');
    this.spawnExplosion(x, y, '#ff9d5d');
    this.spawnExplosion(x, y, '#ffd27a');
    this.setFlash('#ff9d5d', 0.5);
    this.shake = Math.max(this.shake, 2.4);
    for (const e of this.enemies) {
      if (e.hp <= 0) continue;
      if (!circleHit(x, y, MISSILE_BLAST_R, e.x, e.y, e.r)) continue;
      e.hp -= MISSILE_DAMAGE;
      e.hitFlash = 1;
      if (e.hp <= 0) {
        this.killEnemy(e, scoreMul, true);
        this.missileKills += 1;
      }
    }
    for (const t of this.tanks) {
      if (t.hp <= 0) continue;
      if (!circleHit(x, y, MISSILE_BLAST_R, t.x, t.y, TANK_R)) continue;
      t.hp -= MISSILE_DAMAGE;
      t.hitFlash = 1;
      if (t.hp <= 0) this.spawnExplosion(t.x, t.y, '#46d4c4');
    }
    if (this.boss && circleHit(x, y, MISSILE_BLAST_R, this.boss.x, this.boss.y, BOSS_R)) {
      this.boss.hp -= MISSILE_DAMAGE;
      this.boss.hitFlash = 1;
      if (this.boss.hp <= 0) {
        this.missileKills += 1;
        this.killBoss(scoreMul);
      }
    }
  }

  // ---- Mini-boss (B2) -------------------------------------------------------

  private spawnBoss(index: number): void {
    const ch = channelAt(worldYAt(this.distance, BOSS_HOLD_Y));
    const hp = bossHpForIndex(index);
    this.boss = {
      x: ch.center,
      y: -BOSS_R,
      prevX: ch.center,
      prevY: -BOSS_R,
      hp,
      maxHp: hp,
      index,
      entering: true,
      sway: 0,
      fireTimer: 1.4,
      pattern: 0,
      hitFlash: 0,
    };
    this.bossSpawnedIndex = index;
    this.toast = this.ctx.i18n('riverRun:bossWarning');
    this.toastColor = '#ff5db0';
    this.toastTime = 1.8;
    this.ctx.audio.playSfx('bigHit');
    this.shake = Math.max(this.shake, this.ctx.reducedMotion ? 0 : 1.6);
  }

  private updateBoss(dt: number, slow: number): void {
    const boss = this.boss;
    if (!boss) return;
    if (boss.hitFlash > 0) boss.hitFlash = Math.max(0, boss.hitFlash - dt * 4);
    const ch = channelAt(worldYAt(this.distance, boss.y));
    if (boss.entering) {
      boss.y += BOSS_DESCENT * dt;
      boss.x = ch.center;
      if (boss.y >= BOSS_HOLD_Y) {
        boss.y = BOSS_HOLD_Y;
        boss.entering = false;
      }
      return;
    }
    // Sway across the channel, staying inside the walls.
    boss.sway += dt * 0.9 * slow;
    const amp = Math.max(0, ch.half - BOSS_R - 2);
    boss.x = clamp(ch.center + Math.sin(boss.sway) * amp, BOSS_R, FIELD_W - BOSS_R);
    // Alternate a downward fan with an aimed burst.
    boss.fireTimer -= dt * slow;
    if (boss.fireTimer <= 0) {
      this.fireBossPattern(boss);
      boss.pattern = (boss.pattern + 1) % 2;
      boss.fireTimer = BOSS_FIRE_INTERVAL;
    }
  }

  private fireBossPattern(boss: Boss): void {
    const y = boss.y + BOSS_R;
    const push = (vx: number): void => {
      this.enemyBullets.push({ x: boss.x, y, prevX: boss.x, prevY: y, vx });
    };
    if (boss.pattern === 0) {
      for (let i = -2; i <= 2; i += 1) push(i * (BOSS_BULLET_SPREAD / 2));
    } else {
      const aim = clamp((this.px - boss.x) * 0.8, -34, 34);
      push(aim - 12);
      push(aim);
      push(aim + 12);
    }
    this.ctx.audio.playSfx('enemyShoot');
  }

  private killBoss(scoreMul: number): void {
    const boss = this.boss;
    if (!boss) return;
    this.boss = null;
    this.bossKills += 1;
    this.kills += 1;
    this.bigKills += 1;
    this.bonus += bossRewardForIndex(boss.index) * scoreMul;
    this.spawnExplosion(boss.x, boss.y, '#ff5db0');
    this.spawnExplosion(boss.x, boss.y, '#ffd27a');
    this.setFlash('#ff5db0', 0.7);
    this.shake = Math.max(this.shake, this.ctx.reducedMotion ? 0 : 3.2);
    this.ctx.audio.playSfx('bigBoom');
    // Guaranteed power-up reward for downing the boss.
    this.powerups.push({
      kind: pickPowerKind(Math.random()),
      x: boss.x,
      y: boss.y,
      prevY: boss.y,
    });
    this.award('warlord');
  }

  /** Spawn one enemy of `kind` at `x`, `yOffset` field units above the top.
   *  Shared by the single-spawn and formation paths. */
  private pushEnemy(kind: EnemyKind, x: number, yOffset: number, dive: boolean): void {
    const spec = ENEMIES[kind];
    const y = -spec.r - yOffset;
    this.enemies.push({
      id: this.nextId++,
      kind,
      x: clamp(x, spec.r, FIELD_W - spec.r),
      y,
      prevY: y,
      r: spec.r,
      hp: spec.hp,
      maxHp: spec.hp,
      points: spec.points,
      speedMul: spec.speedMul,
      shoots: spec.shoots,
      big: spec.big,
      spin: 0,
      fireTimer: 0.8 + Math.random() * 1.2,
      hitFlash: 0,
      dive,
    });
  }

  /** A coordinated squad of light ships (B3): a downward vee or a staggered
   *  wave, sometimes kamikaze divers that track the player. */
  private spawnFormation(): void {
    const kind: FormationKind = Math.random() < 0.5 ? 'vee' : 'wave';
    const n = 3 + Math.floor(Math.random() * 3); // 3..5 ships
    const dive = kind === 'vee' && Math.random() < 0.5;
    const shipKind: EnemyKind = Math.random() < 0.5 ? 'scout' : 'drone';
    const r = ENEMIES[shipKind].r;
    const slots = formationSlots(kind, n);
    const spread = Math.max(...slots.map((s) => Math.abs(s.dx))) + r;
    const ch = channelAt(worldYAt(this.distance, -r));
    const room = Math.max(0, ch.half - spread - 1);
    const cx = ch.center + (Math.random() * 2 - 1) * room;
    for (const slot of slots) this.pushEnemy(shipKind, cx + slot.dx, slot.dy, dive);
  }

  private spawnTimers(dt: number): void {
    // Hold regular enemy spawns while a boss is on screen so the duel reads clean
    // (fuel tanks + power-ups keep coming).
    this.enemyTimer -= dt;
    if (this.enemyTimer <= 0 && !this.boss) {
      // Occasionally a coordinated squad replaces the single random spawn (B3).
      if (
        this.distance >= FORMATION_MIN_DISTANCE &&
        Math.random() < formationChance(this.distance)
      ) {
        this.spawnFormation();
      } else {
        const kind = pickEnemyKind(this.distance, Math.random());
        const spec = ENEMIES[kind];
        const ch = channelAt(worldYAt(this.distance, -spec.r));
        const x = ch.center + (Math.random() * 2 - 1) * (ch.half - spec.r - 1);
        this.pushEnemy(kind, x, 0, false);
      }
      this.enemyTimer = enemySpawnInterval(this.distance) * (0.7 + Math.random() * 0.6);
    }

    this.tankTimer -= dt;
    if (this.tankTimer <= 0) {
      const ch = channelAt(worldYAt(this.distance, -TANK_R));
      const x = ch.center + (Math.random() * 2 - 1) * (ch.half - TANK_R - 1);
      this.tanks.push({ x, y: -TANK_R, prevY: -TANK_R, hp: TANK_HP, hitFlash: 0, tapped: false });
      this.tankTimer = 5 + Math.random() * 3;
    }

    this.powerTimer -= dt;
    if (this.powerTimer <= 0) {
      const ch = channelAt(worldYAt(this.distance, -POWERUP_R));
      const x = ch.center + (Math.random() * 2 - 1) * (ch.half - POWERUP_R - 1);
      this.powerups.push({ kind: pickPowerKind(Math.random()), x, y: -POWERUP_R, prevY: -POWERUP_R });
      this.powerTimer = 7 + Math.random() * 5;
    }

    // Warhead pickups (missile refills) spawn on their own slower cadence so
    // they stay out of the timed-buff pool.
    this.warheadTimer -= dt;
    if (this.warheadTimer <= 0) {
      const ch = channelAt(worldYAt(this.distance, -POWERUP_R));
      const x = ch.center + (Math.random() * 2 - 1) * (ch.half - POWERUP_R - 1);
      this.powerups.push({ kind: 'warhead', x, y: -POWERUP_R, prevY: -POWERUP_R });
      this.warheadTimer = 14 + Math.random() * 8;
    }
  }

  private moveEntities(dt: number, speed: number): void {
    const slow = this.active('slowmo') ? SLOWMO_FACTOR : 1;
    const magnet = this.active('magnet');

    for (const b of this.bullets) {
      b.x += b.vx * dt;
      b.y -= BULLET_SPEED * dt;
    }
    this.bullets = this.bullets.filter((b) => b.y > -6 && b.x > -6 && b.x < FIELD_W + 6);

    for (const m of this.missiles) m.y -= MISSILE_SPEED * dt;

    for (const e of this.enemies) {
      e.y += (speed * ENEMY_REL + ENEMY_EXTRA) * e.speedMul * slow * dt;
      e.spin += dt * 4;
      // Kamikaze divers track the player's column on the way down.
      if (e.dive) {
        e.x = clamp(
          e.x + clamp(this.px - e.x, -1, 1) * DIVE_STEER * slow * dt,
          e.r,
          FIELD_W - e.r,
        );
      }
      if (e.hitFlash > 0) e.hitFlash = Math.max(0, e.hitFlash - dt * 4);
      if (e.shoots) {
        e.fireTimer -= dt * slow;
        if (e.fireTimer <= 0 && e.y > 0 && e.y < PLAYER_Y - 6) {
          const vx = clamp((this.px - e.x) * 0.6, -26, 26);
          this.enemyBullets.push({ x: e.x, y: e.y + e.r, prevX: e.x, prevY: e.y + e.r, vx });
          this.ctx.audio.playSfx('enemyShoot');
          e.fireTimer = 1.3 + Math.random() * 1.4;
        }
      }
    }
    this.enemies = this.enemies.filter((e) => e.y < FIELD_H + 12);

    for (const eb of this.enemyBullets) {
      eb.x += eb.vx * slow * dt;
      eb.y += ENEMY_BULLET_SPEED * slow * dt;
    }
    this.enemyBullets = this.enemyBullets.filter((eb) => eb.y < FIELD_H + 6);

    for (const t of this.tanks) {
      t.y += speed * dt;
      if (t.hitFlash > 0) t.hitFlash = Math.max(0, t.hitFlash - dt * 4);
      if (magnet) t.x += clamp(this.px - t.x, -1, 1) * MAGNET_PULL * dt;
    }
    this.tanks = this.tanks.filter((t) => t.y < FIELD_H + 12 && t.hp > 0);

    for (const p of this.powerups) {
      p.y += speed * dt;
      if (magnet) p.x += clamp(this.px - p.x, -1, 1) * MAGNET_PULL * dt;
    }
    this.powerups = this.powerups.filter((p) => p.y < FIELD_H + 8);
  }

  private resolveCollisions(dt: number): void {
    const scoreMul = this.active('scoreX2') ? 2 : 1;

    // Missiles: detonate on contact with a ship/tank, or near the top.
    for (let i = this.missiles.length - 1; i >= 0; i -= 1) {
      const m = this.missiles[i]!;
      let detonate = m.y <= MISSILE_DETONATE_Y;
      if (!detonate) {
        for (const e of this.enemies) {
          if (e.hp > 0 && circleHit(m.x, m.y, 2, e.x, e.y, e.r)) {
            detonate = true;
            break;
          }
        }
      }
      if (!detonate) {
        for (const t of this.tanks) {
          if (t.hp > 0 && circleHit(m.x, m.y, 2, t.x, t.y, TANK_R)) {
            detonate = true;
            break;
          }
        }
      }
      if (!detonate && this.boss && circleHit(m.x, m.y, 2, this.boss.x, this.boss.y, BOSS_R)) {
        detonate = true;
      }
      if (detonate) {
        this.explodeMissile(m.x, m.y, scoreMul);
        this.missiles.splice(i, 1);
      }
    }
    this.missiles = this.missiles.filter((m) => m.y > -8);
    this.enemies = this.enemies.filter((e) => e.hp > 0);

    // Bullets vs enemies.
    for (const e of this.enemies) {
      if (e.hp <= 0) continue;
      for (let j = this.bullets.length - 1; j >= 0; j -= 1) {
        const b = this.bullets[j]!;
        if (b.hit && b.hit.has(e.id)) continue;
        if (!circleHit(e.x, e.y, e.r, b.x, b.y, 1.6)) continue;
        e.hp -= 1;
        e.hitFlash = 1;
        if (b.pierce && b.hit) b.hit.add(e.id);
        else this.bullets.splice(j, 1);
        if (e.hp <= 0) {
          this.killEnemy(e, scoreMul);
          break;
        } else if (e.big) {
          this.ctx.audio.playSfx('bigHit');
        }
      }
    }
    this.enemies = this.enemies.filter((e) => e.hp > 0);

    // Bullets vs boss.
    if (this.boss) {
      const boss = this.boss;
      for (let j = this.bullets.length - 1; j >= 0; j -= 1) {
        const b = this.bullets[j]!;
        if (b.hit && b.hit.has(BOSS_ID)) continue;
        if (!circleHit(boss.x, boss.y, BOSS_R, b.x, b.y, 1.6)) continue;
        boss.hp -= 1;
        boss.hitFlash = 1;
        if (b.pierce && b.hit) b.hit.add(BOSS_ID);
        else this.bullets.splice(j, 1);
        if (boss.hp <= 0) {
          this.killBoss(scoreMul);
          break;
        }
        this.ctx.audio.playSfx('bigHit');
      }
    }

    // Bullets vs fuel tanks (destructible — careful not to pop your own fuel).
    for (const t of this.tanks) {
      for (let j = this.bullets.length - 1; j >= 0; j -= 1) {
        const b = this.bullets[j]!;
        if (!circleHit(t.x, t.y, TANK_R, b.x, b.y, 1.6)) continue;
        t.hp -= 1;
        t.hitFlash = 1;
        if (!b.pierce) this.bullets.splice(j, 1);
        if (t.hp <= 0) {
          this.spawnExplosion(t.x, t.y, '#46d4c4');
          this.ctx.audio.playSfx('explosion');
          break;
        }
      }
    }

    const shield = this.active('shield');

    // Player vs enemies.
    for (const e of this.enemies) {
      if (!circleHit(this.px, PLAYER_Y, PLAYER_R, e.x, e.y, e.r)) continue;
      if (shield) {
        this.killEnemy(e, scoreMul);
      } else {
        this.spawnExplosion(this.px, PLAYER_Y, '#ffd27a');
        this.endGame();
        return;
      }
    }
    this.enemies = this.enemies.filter((e) => e.hp > 0);

    // Player vs boss hull (lethal unless shielded — the shield chips its HP).
    if (this.boss && circleHit(this.px, PLAYER_Y, PLAYER_R, this.boss.x, this.boss.y, BOSS_R)) {
      if (shield) {
        this.boss.hp -= MISSILE_DAMAGE;
        this.boss.hitFlash = 1;
        if (this.boss.hp <= 0) this.killBoss(scoreMul);
      } else {
        this.spawnExplosion(this.px, PLAYER_Y, '#ffd27a');
        this.endGame();
        return;
      }
    }

    // Player vs enemy bullets.
    for (let j = this.enemyBullets.length - 1; j >= 0; j -= 1) {
      const eb = this.enemyBullets[j]!;
      if (!circleHit(this.px, PLAYER_Y, PLAYER_R, eb.x, eb.y, 1.6)) continue;
      if (shield) {
        this.enemyBullets.splice(j, 1);
      } else {
        this.spawnExplosion(this.px, PLAYER_Y, '#ff5d73');
        this.endGame();
        return;
      }
    }

    // Player flying over a fuel tank → continuous refuel.
    for (const t of this.tanks) {
      if (!circleHit(this.px, PLAYER_Y, PLAYER_R, t.x, t.y, TANK_R)) continue;
      this.fuel = Math.min(FUEL_MAX, this.fuel + TANK_REFILL_RATE * dt);
      if (!t.tapped) {
        t.tapped = true;
        this.fuelTanks += 1;
        this.bonus += FUEL_BONUS;
        this.award('topUp');
        this.ctx.audio.playSfx('fuel');
        this.setFlash('#46d4c4', 0.25);
      }
    }

    // Player vs power-ups.
    for (let i = this.powerups.length - 1; i >= 0; i -= 1) {
      const p = this.powerups[i]!;
      if (circleHit(this.px, PLAYER_Y, PLAYER_R, p.x, p.y, POWERUP_R)) {
        this.powerups.splice(i, 1);
        this.applyPower(p.kind);
      }
    }

    // Player vs canyon walls (lethal unless shielded).
    if (!shield) {
      const ch = channelAt(worldYAt(this.distance, PLAYER_Y));
      if (!insideChannel(this.px, ch, PLAYER_R)) {
        this.spawnExplosion(this.px, PLAYER_Y, '#ffd27a');
        this.endGame();
      }
    }
  }

  private killEnemy(e: Enemy, scoreMul: number, silent = false): void {
    e.hp = 0;
    this.kills += 1;
    if (e.big) this.bigKills += 1;
    if (e.dive) this.diverKills += 1;
    this.bonus += e.points * scoreMul;
    // Missile kills share one big blast/boom, so skip the per-ship FX.
    if (!silent) {
      this.spawnExplosion(e.x, e.y, ENEMY_COLORS[e.kind]);
      this.ctx.audio.playSfx(e.big ? 'bigBoom' : 'explosion');
    }
    this.award('firstKill');
  }

  private applyPower(kind: PowerKind): void {
    const spec = POWERS[kind];
    // Warhead is an instant missile refill, not a timed buff.
    if (kind === 'warhead') {
      this.missileAmmo = Math.min(MISSILE_MAX, this.missileAmmo + 2);
      this.powerupsCollected += 1;
      this.award('collector');
      this.toast = this.ctx.i18n('riverRun:powers.warhead');
      this.toastColor = spec.color;
      this.toastTime = 1.5;
      this.ctx.audio.playSfx('powerup');
      this.setFlash(spec.color, 0.32);
      return;
    }
    this.fx[kind] = spec.duration;
    this.powerupsCollected += 1;
    this.award('collector');
    if (!this.usedKinds.has(kind)) {
      this.usedKinds.add(kind);
      this.award(POWER_TROPHY[kind]);
    }
    this.toast = this.ctx.i18n(`riverRun:powers.${kind}`);
    this.toastColor = spec.color;
    this.toastTime = 1.5;
    this.ctx.audio.playSfx('powerup');
    this.setFlash(spec.color, 0.32);
  }

  private spawnExplosion(x: number, y: number, color: string): void {
    if (this.ctx.reducedMotion) {
      this.setFlash(color, 0.4);
      return;
    }
    const n = 11;
    for (let i = 0; i < n; i += 1) {
      const a = (Math.PI * 2 * i) / n + Math.random() * 0.5;
      const sp = 18 + Math.random() * 28;
      this.particles.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: 0.5, max: 0.5, color });
    }
  }

  private updateParticles(dt: number): void {
    for (const p of this.particles) {
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.life -= dt;
    }
    this.particles = this.particles.filter((p) => p.life > 0);
  }

  private emitScore(force: boolean): void {
    if (!force && this.score === this.lastEmitted) return;
    this.lastEmitted = this.score;
    this.ctx.emit.emit('score', { score: this.score });
  }

  private endGame(): void {
    if (this.gameOver) return;
    this.gameOver = true;
    this.setFlash('#ff5d73', 1);
    this.score = scoreFromDistance(this.distance, this.bonus);
    this.emitScore(true);
    this.ctx.audio.playSfx('gameover');
    this.ctx.emit.emit('gameover', {
      score: this.score,
      stats: {
        distance: Math.floor(this.distance),
        kills: this.kills,
        bigKills: this.bigKills,
        fuel: this.fuelTanks,
        boosts: this.boosts,
        missiles: this.missilesFired,
        missileKills: this.missileKills,
        bossKills: this.bossKills,
        diverKills: this.diverKills,
        powerups: this.powerupsCollected,
        usedShield: this.usedKinds.has('shield') ? 1 : 0,
        usedSuperSpeed: this.usedKinds.has('superSpeed') ? 1 : 0,
        usedDouble: this.usedKinds.has('doubleShot') ? 1 : 0,
        usedTriple: this.usedKinds.has('tripleShot') ? 1 : 0,
        usedRapid: this.usedKinds.has('rapidFire') ? 1 : 0,
        usedPierce: this.usedKinds.has('piercing') ? 1 : 0,
        usedMagnet: this.usedKinds.has('magnet') ? 1 : 0,
        usedSlow: this.usedKinds.has('slowmo') ? 1 : 0,
        usedScoreX2: this.usedKinds.has('scoreX2') ? 1 : 0,
        usedRegen: this.usedKinds.has('regen') ? 1 : 0,
        city: this.biomesSeen.has('city') ? 1 : 0,
        forest: this.biomesSeen.has('forest') ? 1 : 0,
        mountains: this.biomesSeen.has('mountains') ? 1 : 0,
        ocean: this.biomesSeen.has('ocean') ? 1 : 0,
        space: this.biomesSeen.has('space') ? 1 : 0,
        night: this.nightSeen ? 1 : 0,
      },
    });
  }

  // ---- Rendering ------------------------------------------------------------

  render(alpha: number): void {
    const g = this.g;
    const { width, height } = this.ctx.viewport;
    if (width <= 0 || height <= 0) return;

    const s = Math.min(width / FIELD_W, height / FIELD_H);
    const shakeMag = this.ctx.reducedMotion ? 0 : this.shake;
    const shX = shakeMag > 0 ? (Math.random() * 2 - 1) * shakeMag * s : 0;
    const shY = shakeMag > 0 ? (Math.random() * 2 - 1) * shakeMag * s : 0;
    const offX = (width - FIELD_W * s) / 2 + shX;
    const offY = (height - FIELD_H * s) / 2 + shY;
    const X = (x: number): number => offX + x * s;
    const Y = (y: number): number => offY + y * s;
    const dist = lerp(this.prevDistance, this.distance, alpha);
    const pal = PALETTES[this.biomeId];
    const night = this.darkness;

    g.clearRect(0, 0, width, height);
    g.fillStyle = pal.bg;
    g.fillRect(0, 0, width, height);

    this.drawStars(g, X, Y, s, dist, pal);
    this.drawCanyon(g, X, Y, s, dist, pal, night);
    this.drawTanks(g, X, Y, s, alpha, night);
    this.drawPowerups(g, X, Y, s, alpha);
    this.drawEnemies(g, X, Y, s, alpha, night);
    if (this.boss) this.drawBoss(g, X, Y, s, alpha, night);
    this.drawEnemyBullets(g, X, Y, s, alpha);
    this.drawBullets(g, X, Y, s, alpha);
    this.drawMissiles(g, X, Y, s, alpha);
    this.drawParticles(g, X, Y, s);
    if (!this.gameOver) this.drawPlayer(g, X, Y, s, alpha, night);

    if (night > 0.04) {
      g.fillStyle = `rgba(3,3,16,${night * 0.55})`;
      g.fillRect(offX, offY, FIELD_W * s, FIELD_H * s);
      if (!this.gameOver && night > 0.3) this.drawHeadlight(g, X, Y, s, alpha, night);
    }

    this.drawHud(g, X, Y, s, offX, offY);

    if (this.flash > 0) {
      const [r, gg, b] = hexToRgb(this.flashColor);
      g.fillStyle = `rgba(${r},${gg},${b},${this.flash * 0.3})`;
      g.fillRect(offX, offY, FIELD_W * s, FIELD_H * s);
    }
  }

  private drawStars(
    g: CanvasRenderingContext2D,
    X: (x: number) => number,
    Y: (y: number) => number,
    s: number,
    dist: number,
    pal: BiomePalette,
  ): void {
    g.fillStyle = pal.star;
    for (const st of this.stars) {
      const y = this.ctx.reducedMotion ? st.y : (st.y + dist * st.speed) % FIELD_H;
      g.globalAlpha = 0.25 + st.speed;
      g.fillRect(X(st.x), Y(y), st.size * s, st.size * s);
    }
    g.globalAlpha = 1;
  }

  private drawCanyon(
    g: CanvasRenderingContext2D,
    X: (x: number) => number,
    Y: (y: number) => number,
    s: number,
    dist: number,
    pal: BiomePalette,
    night: number,
  ): void {
    const step = 6;
    const samples: Array<{ y: number; left: number; right: number }> = [];
    for (let y = -step; y <= FIELD_H + step; y += step) {
      const ch = channelAt(worldYAt(dist, y));
      samples.push({ y, left: ch.center - ch.half, right: ch.center + ch.half });
    }
    const grad = g.createLinearGradient(0, Y(0), 0, Y(FIELD_H));
    grad.addColorStop(0, darken(pal.wall[0], night * 0.5));
    grad.addColorStop(1, darken(pal.wall[1], night * 0.5));

    g.fillStyle = grad;
    g.beginPath();
    g.moveTo(X(0), Y(-step));
    for (const sm of samples) g.lineTo(X(sm.left), Y(sm.y));
    g.lineTo(X(0), Y(FIELD_H + step));
    g.closePath();
    g.fill();
    g.beginPath();
    g.moveTo(X(FIELD_W), Y(-step));
    for (const sm of samples) g.lineTo(X(sm.right), Y(sm.y));
    g.lineTo(X(FIELD_W), Y(FIELD_H + step));
    g.closePath();
    g.fill();

    g.lineWidth = Math.max(1, s * 0.7);
    g.strokeStyle = pal.edges[0];
    g.beginPath();
    samples.forEach((sm, i) => (i === 0 ? g.moveTo(X(sm.left), Y(sm.y)) : g.lineTo(X(sm.left), Y(sm.y))));
    g.stroke();
    g.strokeStyle = pal.edges[1];
    g.beginPath();
    samples.forEach((sm, i) => (i === 0 ? g.moveTo(X(sm.right), Y(sm.y)) : g.lineTo(X(sm.right), Y(sm.y))));
    g.stroke();
  }

  private drawTanks(
    g: CanvasRenderingContext2D,
    X: (x: number) => number,
    Y: (y: number) => number,
    s: number,
    alpha: number,
    night: number,
  ): void {
    for (const t of this.tanks) {
      const y = lerp(t.prevY, t.y, alpha);
      const cx = X(t.x);
      const cy = Y(y);
      const r = TANK_R * s;
      const dmg = 1 - t.hp / TANK_HP;
      g.fillStyle = t.hitFlash > 0 ? '#ffffff' : '#2c8f86';
      g.shadowColor = '#46d4c4';
      g.shadowBlur = night > 0.4 ? 12 : 6;
      g.beginPath();
      g.moveTo(cx - r * 0.7, cy - r);
      g.lineTo(cx + r * 0.7, cy - r);
      g.lineTo(cx + r, cy);
      g.lineTo(cx + r * 0.7, cy + r);
      g.lineTo(cx - r * 0.7, cy + r);
      g.lineTo(cx - r, cy);
      g.closePath();
      g.fill();
      g.shadowBlur = 0;
      // Damage cracks (darker overlay growing with damage).
      if (dmg > 0) {
        g.fillStyle = `rgba(10,30,28,${0.5 * dmg})`;
        g.fillRect(cx - r, cy - r, r * 2, r * 2 * dmg);
      }
      g.fillStyle = '#0b2a27';
      g.font = `bold ${Math.round(r * 1.1)}px monospace`;
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      g.fillText('F', cx, cy + 0.5);
    }
  }

  private drawPowerups(
    g: CanvasRenderingContext2D,
    X: (x: number) => number,
    Y: (y: number) => number,
    s: number,
    alpha: number,
  ): void {
    for (const p of this.powerups) {
      const y = lerp(p.prevY, p.y, alpha);
      const cx = X(p.x);
      const cy = Y(y);
      const r = POWERUP_R * s;
      const spec = POWERS[p.kind];
      g.fillStyle = spec.color;
      g.shadowColor = spec.color;
      g.shadowBlur = 10;
      g.beginPath();
      g.arc(cx, cy, r, 0, Math.PI * 2);
      g.fill();
      g.shadowBlur = 0;
      g.fillStyle = '#0b0820';
      g.font = `bold ${Math.round(r * 1.3)}px monospace`;
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      g.fillText(spec.letter, cx, cy + 0.5);
    }
  }

  private drawEnemies(
    g: CanvasRenderingContext2D,
    X: (x: number) => number,
    Y: (y: number) => number,
    s: number,
    alpha: number,
    night: number,
  ): void {
    for (const e of this.enemies) {
      const y = lerp(e.prevY, e.y, alpha);
      const cx = X(e.x);
      const cy = Y(y);
      const r = e.r * s;
      const base = ENEMY_COLORS[e.kind];
      const color = e.hitFlash > 0 ? '#ffffff' : darken(base, night * 0.6);
      // Kamikaze divers glow red so the threat reads at a glance.
      const glow = e.dive ? '#ff3b30' : base;
      g.save();
      g.translate(cx, cy);
      if (!this.ctx.reducedMotion && !e.big) g.rotate(e.spin);
      g.fillStyle = color;
      g.shadowColor = glow;
      g.shadowBlur = e.hitFlash > 0 ? 16 : e.dive ? 12 : night > 0.4 ? 10 : 6;
      if (e.big) {
        // Rounded heavy hull with wings.
        g.beginPath();
        g.moveTo(0, -r);
        g.lineTo(r * 0.9, -r * 0.2);
        g.lineTo(r, r * 0.5);
        g.lineTo(0, r);
        g.lineTo(-r, r * 0.5);
        g.lineTo(-r * 0.9, -r * 0.2);
        g.closePath();
        g.fill();
      } else {
        g.beginPath();
        g.moveTo(0, -r);
        g.lineTo(r, 0);
        g.lineTo(0, r);
        g.lineTo(-r, 0);
        g.closePath();
        g.fill();
      }
      g.shadowBlur = 0;
      g.fillStyle = e.shoots ? '#2a0a12' : 'rgba(8,5,20,0.7)';
      g.fillRect(-r * 0.28, -r * 0.28, r * 0.56, r * 0.56);
      // Running lights at night.
      if (night > 0.45) {
        g.fillStyle = '#ff3b30';
        g.fillRect(-r * 0.85, r * 0.2, r * 0.25, r * 0.25);
        g.fillStyle = '#46ff8a';
        g.fillRect(r * 0.6, r * 0.2, r * 0.25, r * 0.25);
      }
      g.restore();
      // Health pips for big ships.
      if (e.big && e.hp < e.maxHp) {
        const pipW = (r * 1.6) / e.maxHp;
        for (let i = 0; i < e.maxHp; i += 1) {
          g.fillStyle = i < e.hp ? '#9be15d' : 'rgba(255,255,255,0.18)';
          g.fillRect(cx - r * 0.8 + i * pipW + 1, cy - r - 3 * s, pipW - 1, 1.5 * s);
        }
      }
    }
  }

  private drawBoss(
    g: CanvasRenderingContext2D,
    X: (x: number) => number,
    Y: (y: number) => number,
    s: number,
    alpha: number,
    night: number,
  ): void {
    const boss = this.boss;
    if (!boss) return;
    const x = lerp(boss.prevX, boss.x, alpha);
    const y = lerp(boss.prevY, boss.y, alpha);
    const cx = X(x);
    const cy = Y(y);
    const r = BOSS_R * s;
    const base = '#ff5db0';
    g.save();
    g.translate(cx, cy);
    g.fillStyle = boss.hitFlash > 0 ? '#ffffff' : darken(base, night * 0.5);
    g.shadowColor = base;
    g.shadowBlur = boss.hitFlash > 0 ? 22 : 14;
    g.beginPath();
    g.moveTo(0, -r);
    g.lineTo(r, -r * 0.25);
    g.lineTo(r * 0.7, r * 0.7);
    g.lineTo(0, r * 0.45);
    g.lineTo(-r * 0.7, r * 0.7);
    g.lineTo(-r, -r * 0.25);
    g.closePath();
    g.fill();
    g.shadowBlur = 0;
    // Glowing core.
    g.fillStyle = '#2a0a1e';
    g.beginPath();
    g.arc(0, 0, r * 0.34, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = boss.hitFlash > 0 ? '#ffffff' : '#ffd27a';
    g.beginPath();
    g.arc(0, 0, r * 0.17, 0, Math.PI * 2);
    g.fill();
    g.restore();

    // HP bar low on the field, clear of the top fuel HUD.
    const barX = X(8);
    const barW = (FIELD_W - 16) * s;
    const barY = Y(FIELD_H - 6);
    const barH = 2.6 * s;
    const ratio = clamp(boss.hp / boss.maxHp, 0, 1);
    g.fillStyle = 'rgba(20,11,43,0.85)';
    g.fillRect(barX, barY, barW, barH);
    g.fillStyle = base;
    g.fillRect(barX, barY, barW * ratio, barH);
    g.strokeStyle = 'rgba(255,255,255,0.28)';
    g.lineWidth = 1;
    g.strokeRect(barX + 0.5, barY + 0.5, barW, barH);
  }

  private drawEnemyBullets(
    g: CanvasRenderingContext2D,
    X: (x: number) => number,
    Y: (y: number) => number,
    s: number,
    alpha: number,
  ): void {
    g.fillStyle = '#ff7a45';
    g.shadowColor = '#ff5d73';
    g.shadowBlur = 6;
    for (const eb of this.enemyBullets) {
      const x = lerp(eb.prevX, eb.x, alpha);
      const y = lerp(eb.prevY, eb.y, alpha);
      g.beginPath();
      g.arc(X(x), Y(y), s * 1.3, 0, Math.PI * 2);
      g.fill();
    }
    g.shadowBlur = 0;
  }

  private drawBullets(
    g: CanvasRenderingContext2D,
    X: (x: number) => number,
    Y: (y: number) => number,
    s: number,
    alpha: number,
  ): void {
    const pierce = this.active('piercing');
    g.fillStyle = pierce ? '#ff8ad0' : '#bfffe9';
    g.shadowColor = pierce ? '#ff5db0' : '#46d4c4';
    g.shadowBlur = 6;
    for (const b of this.bullets) {
      const x = lerp(b.prevX, b.x, alpha);
      const y = lerp(b.prevY, b.y, alpha);
      g.fillRect(X(x) - s * 0.5, Y(y) - s * 2, s, s * 3);
    }
    g.shadowBlur = 0;
  }

  private drawMissiles(
    g: CanvasRenderingContext2D,
    X: (x: number) => number,
    Y: (y: number) => number,
    s: number,
    alpha: number,
  ): void {
    g.shadowColor = '#ff9d5d';
    g.shadowBlur = 8;
    for (const m of this.missiles) {
      const x = lerp(m.prevX, m.x, alpha);
      const y = lerp(m.prevY, m.y, alpha);
      const cx = X(x);
      const cy = Y(y);
      // Exhaust flame.
      const flick = this.ctx.reducedMotion ? 1 : 0.7 + Math.random() * 0.6;
      g.fillStyle = '#ffd27a';
      g.beginPath();
      g.moveTo(cx - s * 0.8, cy + s * 1.4);
      g.lineTo(cx + s * 0.8, cy + s * 1.4);
      g.lineTo(cx, cy + s * (1.4 + 2.2 * flick));
      g.closePath();
      g.fill();
      // Body (pointing up).
      g.fillStyle = '#ff7a45';
      g.beginPath();
      g.moveTo(cx, cy - s * 2.4);
      g.lineTo(cx + s * 1.1, cy + s * 1.4);
      g.lineTo(cx - s * 1.1, cy + s * 1.4);
      g.closePath();
      g.fill();
    }
    g.shadowBlur = 0;
  }

  private drawParticles(
    g: CanvasRenderingContext2D,
    X: (x: number) => number,
    Y: (y: number) => number,
    s: number,
  ): void {
    for (const p of this.particles) {
      const t = p.life / p.max;
      g.globalAlpha = clamp(t, 0, 1);
      g.fillStyle = p.color;
      const sz = (1 + t * 1.6) * s;
      g.fillRect(X(p.x) - sz / 2, Y(p.y) - sz / 2, sz, sz);
    }
    g.globalAlpha = 1;
  }

  private drawPlayer(
    g: CanvasRenderingContext2D,
    X: (x: number) => number,
    Y: (y: number) => number,
    s: number,
    alpha: number,
    night: number,
  ): void {
    const x = lerp(this.prevPx, this.px, alpha);
    const cx = X(x);
    const cy = Y(PLAYER_Y);
    const r = PLAYER_R * s * 1.5;
    const fast = this.boosting || this.active('superSpeed');

    const flick = this.ctx.reducedMotion ? 1 : 0.7 + Math.random() * 0.6;
    const flameLen = (fast ? 3.4 : 2) * s * flick;
    g.fillStyle = fast ? '#bfffe9' : '#ffb347';
    g.globalAlpha = 0.85;
    g.beginPath();
    g.moveTo(cx - r * 0.45, cy + r * 0.6);
    g.lineTo(cx + r * 0.45, cy + r * 0.6);
    g.lineTo(cx, cy + r * 0.6 + flameLen);
    g.closePath();
    g.fill();
    g.globalAlpha = 1;

    g.fillStyle = '#ffd27a';
    g.shadowColor = '#ffb347';
    g.shadowBlur = 10;
    g.beginPath();
    g.moveTo(cx, cy - r);
    g.lineTo(cx + r * 0.8, cy + r * 0.7);
    g.lineTo(cx - r * 0.8, cy + r * 0.7);
    g.closePath();
    g.fill();
    g.shadowBlur = 0;
    g.fillStyle = '#5e2a6e';
    g.beginPath();
    g.arc(cx, cy - r * 0.05, r * 0.28, 0, Math.PI * 2);
    g.fill();

    if (night > 0.45) {
      g.fillStyle = '#fff3c0';
      g.fillRect(cx - r * 0.7, cy - r * 0.2, r * 0.2, r * 0.2);
      g.fillRect(cx + r * 0.5, cy - r * 0.2, r * 0.2, r * 0.2);
    }
    if (this.active('shield')) {
      g.strokeStyle = `rgba(126,166,255,${0.55 + 0.3 * Math.sin(this.fx.shield * 8)})`;
      g.lineWidth = Math.max(1.4, s);
      g.beginPath();
      g.arc(cx, cy, r * 1.5, 0, Math.PI * 2);
      g.stroke();
    }
  }

  private drawHeadlight(
    g: CanvasRenderingContext2D,
    X: (x: number) => number,
    Y: (y: number) => number,
    s: number,
    alpha: number,
    night: number,
  ): void {
    const x = lerp(this.prevPx, this.px, alpha);
    const cx = X(x);
    const cy = Y(PLAYER_Y - PLAYER_R * 1.5);
    g.save();
    g.globalCompositeOperation = 'lighter';
    const grad = g.createLinearGradient(0, cy, 0, Y(PLAYER_Y - 80));
    grad.addColorStop(0, `rgba(255,245,200,${0.16 * night})`);
    grad.addColorStop(1, 'rgba(255,245,200,0)');
    g.fillStyle = grad;
    g.beginPath();
    g.moveTo(cx - 2 * s, cy);
    g.lineTo(cx + 2 * s, cy);
    g.lineTo(cx + 24 * s, Y(PLAYER_Y - 80));
    g.lineTo(cx - 24 * s, Y(PLAYER_Y - 80));
    g.closePath();
    g.fill();
    g.restore();
  }

  private drawHud(
    g: CanvasRenderingContext2D,
    X: (x: number) => number,
    Y: (y: number) => number,
    s: number,
    offX: number,
    offY: number,
  ): void {
    const pad = 3;
    const barX = X(pad);
    const barW = (FIELD_W - pad * 2) * s;
    const barY = Y(2);
    const barH = 4.6 * s;
    const ratio = this.fuel / FUEL_MAX;
    g.fillStyle = 'rgba(20,11,43,0.85)';
    g.fillRect(barX, barY, barW, barH);
    g.fillStyle = ratio < 0.25 ? '#ff5d73' : '#46d4c4';
    g.fillRect(barX, barY, barW * clamp(ratio, 0, 1), barH);
    g.strokeStyle = 'rgba(255,255,255,0.18)';
    g.lineWidth = 1;
    g.strokeRect(barX + 0.5, barY + 0.5, barW, barH);

    g.font = `${Math.round(3.2 * s)}px monospace`;
    g.textBaseline = 'top';
    g.fillStyle = '#cdbce8';
    g.textAlign = 'left';
    g.fillText('FUEL', barX, barY + barH + 2 * s);
    g.textAlign = 'right';
    g.fillText(`${Math.floor(this.distance)} m`, barX + barW, barY + barH + 2 * s);
    g.textAlign = 'center';
    g.fillStyle = '#a796c9';
    const biomeName = this.ctx.i18n(`riverRun:biomes.${this.biomeId}`);
    const phaseName = this.ctx.i18n(`riverRun:timeOfDay.${this.phase}`);
    g.fillText(`${biomeName} · ${phaseName}`, barX + barW / 2, barY + barH + 2 * s);

    // Active power-up chips.
    let chipX = barX;
    const chipY = barY + barH + 7 * s;
    const chipS = 6 * s;
    for (const k of POWER_KINDS) {
      if (this.fx[k] <= 0) continue;
      const spec = POWERS[k];
      g.fillStyle = spec.color;
      g.fillRect(chipX, chipY, chipS, chipS);
      g.fillStyle = '#0b0820';
      g.font = `bold ${Math.round(3.4 * s)}px monospace`;
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      g.fillText(spec.letter, chipX + chipS / 2, chipY + chipS / 2 + 0.5);
      g.fillStyle = 'rgba(255,255,255,0.5)';
      g.fillRect(chipX, chipY + chipS + s * 0.4, chipS * clamp(this.fx[k] / spec.duration, 0, 1), s);
      chipX += chipS + 2 * s;
    }

    // Missile ammo: little rockets on the right of the chip row.
    const pipR = 2 * s;
    const pipGap = 5 * s;
    for (let i = 0; i < MISSILE_MAX; i += 1) {
      const px = barX + barW - pipR - i * pipGap;
      const py = chipY + pipR;
      const armed = i < this.missileAmmo;
      g.fillStyle = armed ? '#ff9d5d' : 'rgba(255,157,93,0.22)';
      g.beginPath();
      g.moveTo(px, py - pipR);
      g.lineTo(px + pipR * 0.8, py + pipR);
      g.lineTo(px - pipR * 0.8, py + pipR);
      g.closePath();
      g.fill();
    }

    if (this.toastTime > 0) {
      g.globalAlpha = clamp(this.toastTime / 1.5, 0, 1);
      g.fillStyle = this.toastColor;
      g.font = `bold ${Math.round(6 * s)}px monospace`;
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      g.fillText(this.toast.toUpperCase(), offX + (FIELD_W * s) / 2, offY + FIELD_H * s * 0.4);
      g.globalAlpha = 1;
    }
  }

  pause(): void {
    this.ctx.audio.stopMusic();
  }

  resume(): void {
    this.ctx.audio.playMusic('gameplay');
  }

  destroy(): void {
    this.ctx.audio.stopMusic();
  }
}
