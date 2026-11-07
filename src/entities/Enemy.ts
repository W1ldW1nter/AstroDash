import Phaser from 'phaser';
import { GAME_HEIGHT, GAME_WIDTH } from '../config';
import type { BulletPool } from '../bullets/BulletPool';
import { Emitter, type Point } from '../bullets/Emitter';
import { ENEMY_TYPES, type EnemyId, type EnemyType, type EnemyVariant, type Movement } from '../data/enemies';
import type { Difficulty } from '../data/waves';
import type { PatternDef } from '../bullets/Pattern';

const FLASH_MS = 60;
/** Once on screen, an enemy this far outside the edges is gone for good. */
const EXIT_MARGIN = 60;

export interface EnemyContext {
  pool: BulletPool;
  /** What aimed shots aim at (the player). */
  target: Point;
  /** Live difficulty; the wave director updates it each wave. */
  difficulty: Difficulty;
}

/** One enemy: moves along its Movement, cycles its attacks, takes damage. */
export class Enemy extends Phaser.GameObjects.Image {
  readonly def: EnemyType;
  hp: number;
  /** Set when the enemy should be removed (killed or flew away). */
  removed = false;

  /** Hits are absorbed without damage (e.g. a boss changing phase). */
  shielded = false;

  protected elapsed = 0;
  protected readonly start: Point;
  private readonly curve: Phaser.Curves.CubicBezier | null = null;
  private pathEndVelocity = { x: 0, y: 0 };
  private hasEntered = false;

  // hold movement state
  protected holdPhase: 'enter' | 'hold' | 'exit' = 'enter';
  protected holdTimer = 0;

  // attacks
  private readonly fires: boolean;
  private attackIndex = 0;
  private attackTimer: number;
  private emitter: Emitter | null = null;
  protected flashTimer = 0;

  constructor(
    scene: Phaser.Scene,
    id: EnemyId,
    variant: EnemyVariant,
    x: number,
    y: number,
    protected readonly movement: Movement,
    protected readonly ctx: EnemyContext,
  ) {
    super(scene, x, y, ENEMY_TYPES[id].atlas ?? 'enemy', ENEMY_TYPES[id].frame ?? `${id}_${variant}`);
    this.def = ENEMY_TYPES[id];
    this.hp = this.def.hp;
    this.start = { x, y };
    const fireChance = id === 'small' ? ctx.difficulty.fodderFireChance : this.def.fireChance;
    this.fires = Math.random() < fireChance;
    this.attackTimer = Phaser.Math.Between(...this.def.firstAttackDelay) / ctx.difficulty.fireRate;

    if (movement.kind === 'path') {
      const [p0, p1, p2, p3] = movement.points.map(([px, py]) => new Phaser.Math.Vector2(px, py));
      this.curve = new Phaser.Curves.CubicBezier(p0, p1, p2, p3);
      // After the curve ends, keep flying in the direction it was heading.
      const tangent = this.curve.getTangent(1);
      const speed = this.curve.getLength() / (movement.duration / 1000);
      this.pathEndVelocity = { x: tangent.x * speed, y: tangent.y * speed };
      this.setPosition(p0.x, p0.y);
    }
    scene.add.existing(this);
  }

  get explosionColour(): string {
    return this.def.explosion;
  }

  /** True while any part of the sprite is on screen. Enemies can't be hurt or shoot before this. */
  get onScreen(): boolean {
    return this.y > -this.height / 2 && this.y < GAME_HEIGHT + this.height / 2 && this.x > -this.width / 2 && this.x < GAME_WIDTH + this.width / 2;
  }

  update(deltaMs: number): void {
    this.elapsed += deltaMs;
    this.move(deltaMs);

    if (this.onScreen) this.hasEntered = true;
    else if (this.hasEntered && this.isFarOffscreen()) this.removed = true;

    if (this.fires && this.onScreen) this.updateAttacks(deltaMs);

    if (this.flashTimer > 0) {
      this.flashTimer -= deltaMs;
      if (this.flashTimer <= 0) this.clearTint();
    }
  }

  /** Returns true if this hit killed the enemy. */
  damage(amount: number): boolean {
    if (this.removed || !this.onScreen || this.shielded) return false;
    this.hp -= amount;
    this.setTintFill(0xffffff);
    this.flashTimer = FLASH_MS;
    if (this.hp <= 0) {
      this.removed = true;
      return true;
    }
    return false;
  }

  // ------------------------------------------------- overridable (bosses)

  /** Attacks currently in rotation. */
  protected attackList(): PatternDef[][] {
    return this.def.attacks;
  }

  /** ms between attacks, before difficulty scaling. */
  protected attackCooldown(): number {
    return this.def.cooldown;
  }

  /** Stop the current attack and start the rotation over after `delayMs`. */
  protected resetAttacks(delayMs: number): void {
    this.emitter = null;
    this.attackIndex = 0;
    this.attackTimer = delayMs;
  }

  // ---------------------------------------------------------------- internals

  private isFarOffscreen(): boolean {
    return this.y > GAME_HEIGHT + EXIT_MARGIN || this.y < -EXIT_MARGIN * 2 || this.x < -EXIT_MARGIN || this.x > GAME_WIDTH + EXIT_MARGIN;
  }

  protected move(deltaMs: number): void {
    const dt = deltaMs / 1000;
    const m = this.movement;
    switch (m.kind) {
      case 'straight':
        this.x += m.vx * dt;
        this.y += m.vy * dt;
        break;
      case 'sine':
        this.y += m.vy * dt;
        this.x = this.start.x + Math.sin((this.elapsed / m.period) * Math.PI * 2) * m.amplitude;
        break;
      case 'path': {
        const t = this.elapsed / m.duration;
        if (t <= 1) {
          const p = this.curve!.getPoint(t);
          this.setPosition(p.x, p.y);
        } else {
          this.x += this.pathEndVelocity.x * dt;
          this.y += this.pathEndVelocity.y * dt;
        }
        break;
      }
      case 'hold':
        if (this.holdPhase === 'enter') {
          // Ease into position: up to enterSpeed, slowing as it arrives.
          this.y += Math.min(m.enterSpeed, Math.max(40, (m.y - this.y) * 3)) * dt;
          if (this.y >= m.y - 1) {
            this.y = m.y;
            this.holdPhase = 'hold';
          }
        } else if (this.holdPhase === 'hold') {
          this.holdTimer += deltaMs;
          this.x = this.start.x + Math.sin(this.holdTimer / 1800) * m.drift;
          if (m.holdMs > 0 && this.holdTimer >= m.holdMs) this.holdPhase = 'exit';
        } else {
          this.y += m.exitSpeed * dt;
        }
        break;
    }
  }

  private updateAttacks(deltaMs: number): void {
    if (this.emitter) {
      this.emitter.update(deltaMs);
      if (this.emitter.done) {
        this.emitter = null;
        this.attackTimer = this.attackCooldown() / this.ctx.difficulty.fireRate;
        this.attackIndex = (this.attackIndex + 1) % this.attackList().length;
      }
      return;
    }
    this.attackTimer -= deltaMs;
    const attacks = this.attackList();
    if (this.attackTimer <= 0 && attacks.length) {
      this.emitter = new Emitter(this.ctx.pool, this, attacks[this.attackIndex % attacks.length], this.ctx.target, this.ctx.difficulty.bulletSpeed);
    }
  }
}
