import Phaser from 'phaser';
import type { BulletPool } from './BulletPool';
import type { PatternDef } from './Pattern';

export interface Point {
  x: number;
  y: number;
}

/** Runtime state of one pattern on an emitter. */
class PatternRun {
  private timer: number;
  private volley = 0;
  private turn = 0;
  private lockedAim: number | null = null;

  constructor(readonly def: PatternDef) {
    this.timer = def.delay ?? 0;
  }

  get done(): boolean {
    return this.def.volleys > 0 && this.volley >= this.def.volleys;
  }

  /** Advance time; fires as many volleys as are due (keeps rate exact at low FPS). */
  update(deltaMs: number, origin: Point, target: Point | null, pool: BulletPool, speedScale: number): void {
    this.timer -= deltaMs;
    while (this.timer <= 0 && !this.done) {
      this.fire(origin, target, pool, speedScale);
      this.volley++;
      this.timer += this.def.interval;
    }
  }

  private baseAngle(origin: Point, target: Point | null): number {
    const d = this.def;
    if (d.aim !== 'player') return d.aim ?? 90;
    const track = d.trackEachVolley ?? true;
    if (!track && this.lockedAim !== null) return this.lockedAim;
    const a = target ? Phaser.Math.RadToDeg(Math.atan2(target.y - origin.y, target.x - origin.x)) : 90;
    this.lockedAim = a;
    return a;
  }

  private fire(origin: Point, target: Point | null, pool: BulletPool, speedScale: number): void {
    const d = this.def;
    const base = this.baseAngle(origin, target) + this.turn;
    this.turn += d.turnPerVolley ?? 0;

    const layers = d.layers ?? 1;
    const offset = d.offset ?? 0;
    for (let i = 0; i < d.count; i++) {
      let angle: number;
      if (d.shape === 'ring') {
        angle = base + (360 / d.count) * i;
      } else if (d.shape === 'fan') {
        const spread = d.spread ?? 30;
        angle = d.count === 1 ? base : base - spread / 2 + (spread / (d.count - 1)) * i;
      } else {
        const spread = d.spread ?? 360;
        angle = base + Phaser.Math.FloatBetween(-spread / 2, spread / 2);
      }
      const rad = Phaser.Math.DegToRad(angle);
      const x = origin.x + Math.cos(rad) * offset;
      const y = origin.y + Math.sin(rad) * offset;
      for (let l = 0; l < layers; l++) {
        const speed = Array.isArray(d.speed) ? Phaser.Math.FloatBetween(d.speed[0], d.speed[1]) : d.speed;
        pool.spawn(x, y, {
          style: d.style,
          angle,
          speed: (speed + l * (d.layerSpeedStep ?? 0)) * speedScale,
          accel: d.accel !== undefined ? d.accel * speedScale : undefined,
          angularVelocity: d.angularVelocity,
          minSpeed: d.minSpeed,
          maxSpeed: d.maxSpeed !== undefined ? d.maxSpeed * speedScale : undefined,
        });
      }
    }
  }
}

/**
 * Fires one or more patterns from a (possibly moving) source.
 * `source` is read every frame, so attach it to an enemy and the bullets follow.
 */
export class Emitter {
  private runs: PatternRun[];

  constructor(
    private readonly pool: BulletPool,
    private readonly source: Point,
    patterns: PatternDef[],
    private readonly target: Point | null = null,
    /** Multiplies all bullet speeds (difficulty scaling). */
    private readonly speedScale = 1,
  ) {
    this.runs = patterns.map((p) => new PatternRun(p));
  }

  /** True once every pattern has fired all its volleys. */
  get done(): boolean {
    return this.runs.every((r) => r.done);
  }

  update(deltaMs: number): void {
    for (const r of this.runs) r.update(deltaMs, this.source, this.target, this.pool, this.speedScale);
  }

  /** Start the same patterns again from the beginning. */
  restart(): void {
    this.runs = this.runs.map((r) => new PatternRun(r.def));
  }
}
