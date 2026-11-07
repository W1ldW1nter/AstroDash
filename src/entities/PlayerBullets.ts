import Phaser from 'phaser';
import { GAME_HEIGHT, GAME_WIDTH } from '../config';

export class PlayerBullet extends Phaser.GameObjects.Image {
  vx = 0;
  vy = 0;
  damage = 1;
  /** Collision radius against enemies. */
  radius = BASE_RADIUS;
}

const OFFSCREEN_MARGIN = 24;
/** Hit circle of a normal-size shot (shots are thin; generous enough to feel fair). */
const BASE_RADIUS = 3;

/**
 * Object pool for the player's shots. Bullets are recycled, never destroyed,
 * so firing creates no garbage. (The general enemy bullet engine is Milestone 2.)
 */
export class PlayerBullets {
  private readonly group: Phaser.GameObjects.Group;

  constructor(scene: Phaser.Scene, maxSize = 256, private readonly depth = 10) {
    this.group = scene.add.group({ classType: PlayerBullet, maxSize, runChildUpdate: false });
  }

  /** @param angleDeg degrees from straight up, negative = left */
  fire(x: number, y: number, angleDeg: number, speed: number, frame: string, damage: number, scale = 1): PlayerBullet | null {
    const b = this.group.get(x, y, 'bullets', frame) as PlayerBullet | null;
    if (!b) return null; // pool exhausted: drop the shot rather than allocate
    const rad = Phaser.Math.DegToRad(angleDeg);
    b.setActive(true).setVisible(true).setFrame(frame).setDepth(this.depth).setRotation(rad).setScale(scale);
    b.setPosition(x, y);
    b.vx = Math.sin(rad) * speed;
    b.vy = -Math.cos(rad) * speed;
    b.damage = damage;
    b.radius = BASE_RADIUS * scale;
    return b;
  }

  update(deltaMs: number): void {
    const dt = deltaMs / 1000;
    for (const obj of this.group.getChildren()) {
      const b = obj as PlayerBullet;
      if (!b.active) continue;
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      if (b.y < -OFFSCREEN_MARGIN || b.y > GAME_HEIGHT + OFFSCREEN_MARGIN || b.x < -OFFSCREEN_MARGIN || b.x > GAME_WIDTH + OFFSCREEN_MARGIN) {
        this.kill(b);
      }
    }
  }

  /** Visit every live shot (for collision checks). */
  forEachActive(fn: (b: PlayerBullet) => void): void {
    const list = this.group.getChildren();
    for (let i = 0; i < list.length; i++) {
      const b = list[i] as PlayerBullet;
      if (b.active) fn(b);
    }
  }

  clear(): void {
    this.forEachActive((b) => this.kill(b));
  }

  kill(b: PlayerBullet): void {
    this.group.killAndHide(b);
  }

  get activeCount(): number {
    return this.group.countActive(true);
  }

  get poolSize(): number {
    return this.group.getLength();
  }
}
