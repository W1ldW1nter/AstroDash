import Phaser from 'phaser';
import { GAME_HEIGHT, GAME_WIDTH } from '../config';
import { styleInfo, type BulletStyle } from './BulletStyles';

const DEG = Math.PI / 180;
/** How far past the screen edge a bullet may travel before it is recycled. */
const CULL_MARGIN = 32;
/** Safety net: no bullet lives longer than this (ms), e.g. one orbiting forever. */
const MAX_AGE = 20000;

/** Everything needed to fire one bullet. Angles in degrees, Phaser convention: 0 = right, 90 = down. */
export interface BulletSpawn {
  style: BulletStyle;
  angle: number;
  /** px/sec */
  speed: number;
  /** px/sec² (negative = decelerate) */
  accel?: number;
  /** deg/sec: makes the bullet curve */
  angularVelocity?: number;
  minSpeed?: number;
  maxSpeed?: number;
}

/** A pooled bullet. Plain fields, no per-frame Phaser update: the pool moves them all in one loop. */
export class Bullet extends Phaser.GameObjects.Image {
  angleRad = 0;
  speed = 0;
  accel = 0;
  angularVelocity = 0; // rad/sec
  minSpeed = 0;
  maxSpeed = Infinity;
  radius = 3;
  rotates = false;
  age = 0;
  /** Already counted as a graze (each bullet can only be grazed once). */
  grazed = false;
  /** Index in the pool's active list (for O(1) removal). */
  slot = -1;
}

/**
 * Fixed-size pool for enemy bullets. All bullets are created up front, so
 * firing never allocates. Active bullets live in a dense array, and removal
 * swaps with the last element, so the update loop only touches live bullets.
 */
export class BulletPool {
  private readonly free: Bullet[] = [];
  private readonly active: Bullet[] = [];
  /** Shots dropped because the pool was full; non-zero means `capacity` is too low. */
  dropped = 0;

  constructor(scene: Phaser.Scene, readonly capacity = 3000, depth = 15) {
    for (let i = 0; i < capacity; i++) {
      const b = new Bullet(scene, -100, -100, 'bullets', 'white_orb_s');
      b.setActive(false).setVisible(false).setDepth(depth);
      scene.add.existing(b);
      this.free.push(b);
    }
  }

  get count(): number {
    return this.active.length;
  }

  spawn(x: number, y: number, s: BulletSpawn): Bullet | null {
    const b = this.free.pop();
    if (!b) {
      this.dropped++;
      return null;
    }
    const info = styleInfo(s.style);
    b.setFrame(info.frame).setPosition(x, y).setActive(true).setVisible(true);
    b.angleRad = s.angle * DEG;
    b.speed = s.speed;
    b.accel = s.accel ?? 0;
    b.angularVelocity = (s.angularVelocity ?? 0) * DEG;
    b.minSpeed = s.minSpeed ?? 0;
    b.maxSpeed = s.maxSpeed ?? Infinity;
    b.radius = info.radius;
    b.rotates = info.rotates;
    b.rotation = info.rotates ? b.angleRad + Math.PI / 2 : 0; // art points up
    b.age = 0;
    b.grazed = false;
    b.slot = this.active.length;
    this.active.push(b);
    return b;
  }

  update(deltaMs: number): void {
    const dt = deltaMs / 1000;
    const minX = -CULL_MARGIN;
    const maxX = GAME_WIDTH + CULL_MARGIN;
    const minY = -CULL_MARGIN;
    const maxY = GAME_HEIGHT + CULL_MARGIN;
    // Iterate backwards so swap-removal never skips a bullet.
    for (let i = this.active.length - 1; i >= 0; i--) {
      const b = this.active[i];
      if (b.accel !== 0) {
        b.speed = Math.min(b.maxSpeed, Math.max(b.minSpeed, b.speed + b.accel * dt));
      }
      if (b.angularVelocity !== 0) {
        b.angleRad += b.angularVelocity * dt;
        if (b.rotates) b.rotation = b.angleRad + Math.PI / 2;
      }
      b.x += Math.cos(b.angleRad) * b.speed * dt;
      b.y += Math.sin(b.angleRad) * b.speed * dt;
      b.age += deltaMs;
      if (b.x < minX || b.x > maxX || b.y < minY || b.y > maxY || b.age > MAX_AGE) this.release(b);
    }
  }

  /**
   * Calls `onHit` for every bullet whose circle overlaps the given circle.
   * Return true from `onHit` to destroy that bullet.
   */
  collideCircle(x: number, y: number, r: number, onHit: (b: Bullet) => boolean): void {
    for (let i = this.active.length - 1; i >= 0; i--) {
      const b = this.active[i];
      const dx = b.x - x;
      const dy = b.y - y;
      const rr = b.radius + r;
      if (dx * dx + dy * dy <= rr * rr && onHit(b)) this.release(b);
    }
  }

  /** Calls `onGraze` once for each bullet that comes within `r` of a point for the first time. */
  graze(x: number, y: number, r: number, onGraze: (b: Bullet) => void): void {
    for (let i = 0; i < this.active.length; i++) {
      const b = this.active[i];
      if (b.grazed) continue;
      const dx = b.x - x;
      const dy = b.y - y;
      const rr = r + b.radius;
      if (dx * dx + dy * dy <= rr * rr) {
        b.grazed = true;
        onGraze(b);
      }
    }
  }

  /** Visit every live bullet (e.g. for debug drawing). */
  forEach(fn: (b: Bullet) => void): void {
    for (let i = 0; i < this.active.length; i++) fn(this.active[i]);
  }

  release(b: Bullet): void {
    if (b.slot < 0) return;
    const last = this.active.pop()!;
    if (last !== b) {
      this.active[b.slot] = last;
      last.slot = b.slot;
    }
    b.slot = -1;
    b.setActive(false).setVisible(false);
    this.free.push(b);
  }

  /** Remove bullets within `r` px of a point (e.g. a breathing gap after a shield break). */
  clearRadius(x: number, y: number, r: number): void {
    const rr = r * r;
    for (let i = this.active.length - 1; i >= 0; i--) {
      const b = this.active[i];
      const dx = b.x - x;
      const dy = b.y - y;
      if (dx * dx + dy * dy <= rr) this.release(b);
    }
  }

  /** Remove every bullet (bombs, death, wave clear). */
  clear(): void {
    while (this.active.length) this.release(this.active[this.active.length - 1]);
  }
}
