import Phaser from 'phaser';
import { Enemy, type EnemyContext } from '../entities/Enemy';
import { Boss } from '../entities/Boss';
import type { PlayerBullets } from '../entities/PlayerBullets';
import type { EnemyId, EnemyVariant, Movement } from '../data/enemies';
import { sfx, type SfxName } from '../audio/sfx';

const BAR_W = 52;
const BAR_H = 4;
/** Impact sparks where player shots hit. */
const SPARK_MS = 90;
const MAX_SPARKS = 48;

const DEATH_SOUND: Record<EnemyId, SfxName> = {
  small: 'explodeS',
  medium: 'explodeM',
  large: 'explodeL',
  heavy: 'explodeL',
  boss: 'explodeBoss',
};

interface Spark {
  x: number;
  y: number;
  life: number;
}

/**
 * Owns all live enemies: spawning, updating, player-shot collisions,
 * death explosions and miniboss health bars.
 */
export class EnemyManager {
  readonly list: Enemy[] = [];
  private readonly bars: Phaser.GameObjects.Graphics;
  private readonly sparks: Spark[] = [];
  /** Called with each enemy killed by the player (score, drops, etc.). */
  onKilled: (e: Enemy) => void = () => {};
  /** Called when a boss enters a new phase. */
  onBossPhase: (boss: Boss, phase: number) => void = () => {};

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly ctx: EnemyContext,
    private readonly depth: number,
    private readonly explosionDepth: number,
    /** For boss health bars. */
    private readonly uiDepth: number,
  ) {
    this.bars = scene.add.graphics().setDepth(explosionDepth + 1);
  }

  spawn(id: EnemyId, variant: EnemyVariant, x: number, y: number, movement: Movement): Enemy {
    const e = new Enemy(this.scene, id, variant, x, y, movement, this.ctx).setDepth(this.depth);
    this.list.push(e);
    return e;
  }

  spawnBoss(cycle: number): Boss {
    const b = new Boss(this.scene, cycle, this.ctx, this.depth + 1, this.uiDepth);
    b.onPhaseChange = (phase) => this.onBossPhase(b, phase);
    this.list.push(b);
    return b;
  }

  count(id?: EnemyId): number {
    return id ? this.list.filter((e) => e.def.id === id).length : this.list.length;
  }

  update(deltaMs: number, shots: PlayerBullets): void {
    for (const e of this.list) e.update(deltaMs);

    // Player shots vs enemies.
    shots.forEachActive((b) => {
      for (const e of this.list) {
        if (e.removed) continue;
        const dx = b.x - e.x;
        const dy = b.y - e.y;
        const r = e.def.radius + b.radius;
        if (dx * dx + dy * dy <= r * r && e.onScreen) {
          shots.kill(b);
          if (e.damage(b.damage)) {
            this.kill(e);
          } else if (!e.shielded) {
            sfx('hit');
            this.addSpark(b.x, b.y);
          }
          break;
        }
      }
    });

    // Drop removed enemies.
    for (let i = this.list.length - 1; i >= 0; i--) {
      if (this.list[i].removed) {
        this.list[i].destroy();
        this.list.splice(i, 1);
      }
    }
    for (let i = this.sparks.length - 1; i >= 0; i--) {
      this.sparks[i].life -= deltaMs;
      if (this.sparks[i].life <= 0) this.sparks.splice(i, 1);
    }
    this.drawBars();
  }

  private addSpark(x: number, y: number): void {
    if (this.sparks.length >= MAX_SPARKS) this.sparks.shift();
    this.sparks.push({ x: x + Phaser.Math.Between(-3, 3), y: y - 4, life: SPARK_MS });
  }

  /** First enemy whose contact circle overlaps the given circle, if any. */
  findContact(x: number, y: number, r: number): Enemy | null {
    for (const e of this.list) {
      if (e.removed || !e.onScreen) continue;
      const dx = e.x - x;
      const dy = e.y - y;
      const rr = e.def.contactRadius + r;
      if (dx * dx + dy * dy <= rr * rr) return e;
    }
    return null;
  }

  /** Damage every on-screen enemy (bombs). Kills count as normal kills. */
  damageAll(amount: number): void {
    for (const e of this.list) {
      if (!e.removed && e.onScreen && e.damage(amount)) this.kill(e);
    }
  }

  /** Blow up every enemy on the field (e.g. when the boss dies). Counts as kills. */
  killAll(): void {
    for (const e of this.list) {
      if (e.removed) continue;
      e.removed = true;
      this.kill(e);
    }
  }

  /** Remove everything without explosions (e.g. restart). */
  clear(): void {
    for (const e of this.list) e.destroy();
    this.list.length = 0;
    this.sparks.length = 0;
    this.bars.clear();
  }

  private kill(e: Enemy): void {
    sfx(DEATH_SOUND[e.def.id]);
    const colour = e.explosionColour;
    this.explode(e.x, e.y, colour);
    for (let i = 0; i < e.def.extraExplosions; i++) {
      const ox = Phaser.Math.Between(-e.width / 2, e.width / 2);
      const oy = Phaser.Math.Between(-e.height / 2, e.height / 2);
      const { x, y } = e;
      this.scene.time.delayedCall(70 * (i + 1), () => this.explode(x + ox, y + oy, colour));
    }
    if (e instanceof Boss) this.scene.cameras.main.shake(900, 0.014);
    else if (e.def.healthBar) this.scene.cameras.main.shake(250, 0.008);
    else if (e.def.id === 'large') this.scene.cameras.main.shake(120, 0.004);
    this.onKilled(e);
  }

  explode(x: number, y: number, colour: string): void {
    const s = this.scene.add.sprite(x, y, 'explosion').setDepth(this.explosionDepth);
    s.play(`explosion_${colour}`);
    s.once(Phaser.Animations.Events.ANIMATION_COMPLETE, () => s.destroy());
  }

  private drawBars(): void {
    const g = this.bars;
    g.clear();
    for (const s of this.sparks) {
      const k = s.life / SPARK_MS; // 1 → 0
      const r = Math.round(1 + (1 - k) * 3);
      g.fillStyle(0xffffff, k);
      g.fillRect(Math.round(s.x) - r, Math.round(s.y), r * 2 + 1, 1);
      g.fillRect(Math.round(s.x), Math.round(s.y) - r, 1, r * 2 + 1);
    }
    for (const e of this.list) {
      if (!e.def.healthBar || e.removed) continue;
      const x = Math.round(e.x - BAR_W / 2);
      const y = Math.round(e.y - e.height / 2 - 10);
      const pct = Math.max(0, e.hp / e.def.hp);
      g.fillStyle(0x000000, 0.7).fillRect(x - 1, y - 1, BAR_W + 2, BAR_H + 2);
      g.fillStyle(0x3a1020, 1).fillRect(x, y, BAR_W, BAR_H);
      g.fillStyle(pct > 0.3 ? 0xff3d6e : 0xffd23f, 1).fillRect(x, y, Math.ceil(BAR_W * pct), BAR_H);
    }
  }
}
