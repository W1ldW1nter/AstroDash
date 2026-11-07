import Phaser from 'phaser';
import { GAME_HEIGHT } from '../config';
import { PICKUPS, PICKUP_COLLECT_RADIUS, PICKUP_FALL_SPEED, PICKUP_MAGNET_RADIUS, type PickupId } from '../data/pickups';

class Pickup extends Phaser.GameObjects.Sprite {
  pickupId: PickupId = 'rapid';
  vx = 0;
  vy = 0;
  age = 0;
}

/**
 * Pickups dropped by enemies. They pop out, then drift down; once the player
 * is close they're pulled in. Collected when touching the ship (not just the hitbox).
 */
export class PickupManager {
  private readonly list: Pickup[] = [];
  /** Called when the player collects a pickup. */
  onCollect: (id: PickupId, x: number, y: number) => void = () => {};

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly depth: number,
  ) {}

  /** Pick a random pickup type. `weights` can override per-type weights (e.g. no health at full lives). */
  static roll(adjust: Partial<Record<PickupId, number>> = {}): PickupId {
    const entries = Object.values(PICKUPS).map((p) => [p.id, adjust[p.id] ?? p.weight] as const);
    const total = entries.reduce((s, [, w]) => s + w, 0);
    let r = Math.random() * total;
    for (const [id, w] of entries) {
      r -= w;
      if (r <= 0) return id;
    }
    return entries[entries.length - 1][0];
  }

  spawn(x: number, y: number, id: PickupId): void {
    const p = new Pickup(this.scene, x, y, 'bonuses');
    p.pickupId = id;
    p.play(`bonus_${id}`).setDepth(this.depth);
    // Pop outward a little before falling, so several drops don't stack.
    const a = Phaser.Math.FloatBetween(-Math.PI * 0.85, -Math.PI * 0.15);
    const s = Phaser.Math.FloatBetween(60, 140);
    p.vx = Math.cos(a) * s;
    p.vy = Math.sin(a) * s;
    this.scene.add.existing(p);
    this.list.push(p);
  }

  update(deltaMs: number, player: { x: number; y: number; alive: boolean }): void {
    const dt = deltaMs / 1000;
    for (let i = this.list.length - 1; i >= 0; i--) {
      const p = this.list[i];
      p.age += deltaMs;
      const dx = player.x - p.x;
      const dy = player.y - p.y;
      const dist = Math.hypot(dx, dy);

      if (player.alive && dist < PICKUP_MAGNET_RADIUS) {
        // Magnet: fly to the player.
        const pull = 420;
        p.vx = (dx / dist) * pull;
        p.vy = (dy / dist) * pull;
      } else {
        // Ease the pop velocity into a gentle fall.
        p.vx *= Math.pow(0.05, dt);
        p.vy += (PICKUP_FALL_SPEED - p.vy) * Math.min(1, dt * 3);
      }
      p.x += p.vx * dt;
      p.y += p.vy * dt;

      if (player.alive && dist < PICKUP_COLLECT_RADIUS) {
        this.onCollect(p.pickupId, p.x, p.y);
        this.remove(i);
      } else if (p.y > GAME_HEIGHT + 30) {
        this.remove(i);
      }
    }
  }

  get count(): number {
    return this.list.length;
  }

  clear(): void {
    while (this.list.length) this.remove(this.list.length - 1);
  }

  private remove(i: number): void {
    this.list[i].destroy();
    this.list.splice(i, 1);
  }
}
