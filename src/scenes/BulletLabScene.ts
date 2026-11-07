import Phaser from 'phaser';
import { GAME_HEIGHT, GAME_WIDTH, SCENES } from '../config';
import { Controls } from '../input/Controls';
import { ParallaxBackground } from '../world/ParallaxBackground';
import { Player } from '../entities/Player';
import { PlayerBullets } from '../entities/PlayerBullets';
import { BulletPool } from '../bullets/BulletPool';
import { Emitter, type Point } from '../bullets/Emitter';
import { ATTACKS, STRESS_PATTERN } from '../data/patterns';
import { DEPTH } from './GameScene';

const TEXT = { fontFamily: 'monospace', fontSize: '11px', color: '#cfe8ff' };
const INVULN_MS = 1000;

/**
 * Dev testbed for the bullet engine (Milestone 2). Fly and dodge while a
 * dummy enemy loops the selected attack.
 *   Q / E  previous / next attack     T  stress test (1000+ bullets)
 *   R      clear bullets              H  show bullet hitboxes
 *   1 / 2  ship class                 Esc back to the game
 */
export class BulletLabScene extends Phaser.Scene {
  private controls!: Controls;
  private background!: ParallaxBackground;
  private player!: Player;
  private playerBullets!: PlayerBullets;
  private pool!: BulletPool;

  private attackIndex = 0;
  private source!: Phaser.GameObjects.Image;
  private sourcePos: Point = { x: GAME_WIDTH / 2, y: 130 };
  private emitter!: Emitter;
  private restartTimer = 0;

  private stress = false;
  private stressEmitters: { pos: Point; emitter: Emitter; sprite: Phaser.GameObjects.Image }[] = [];

  private showHitboxes = false;
  private hitboxGfx!: Phaser.GameObjects.Graphics;

  private hits = 0;
  private invuln = 0;
  private elapsed = 0;
  private worstFrame = 0;
  private worstFrameShown = 0;
  private worstTimer = 0;
  private info!: Phaser.GameObjects.Text;

  constructor() {
    super(SCENES.BulletLab);
  }

  create(): void {
    this.attackIndex = 0;
    this.stress = false;
    this.stressEmitters = [];
    this.hits = 0;
    this.invuln = 0;
    this.elapsed = 0;

    this.controls = new Controls(this);
    this.background = new ParallaxBackground(this, DEPTH.background);
    this.playerBullets = new PlayerBullets(this, 256, DEPTH.playerBullets);
    this.pool = new BulletPool(this, 3000, DEPTH.enemyBullets);
    this.player = new Player(this, GAME_WIDTH / 2, GAME_HEIGHT - 90, this.playerBullets).setDepth(DEPTH.player);

    this.source = this.add.image(this.sourcePos.x, this.sourcePos.y, 'enemy', 'heavy_a').setDepth(DEPTH.enemies);
    this.hitboxGfx = this.add.graphics().setDepth(DEPTH.enemyBullets + 1);
    this.info = this.add.text(6, 6, '', TEXT).setDepth(DEPTH.ui);
    this.add
      .text(GAME_WIDTH / 2, GAME_HEIGHT - 6, 'Q/E attack  T stress  R clear  H hitboxes  1/2 ship  Esc game', { ...TEXT, color: '#8b9bb4' })
      .setOrigin(0.5, 1)
      .setDepth(DEPTH.ui);

    this.selectAttack(0);
    this.bindKeys();
  }

  update(_t: number, delta: number): void {
    const dt = Math.min(delta, 50);
    this.elapsed += dt;
    this.background.update(dt);
    this.player.update(dt, this.controls);
    this.playerBullets.update(dt);

    // Dummy enemy drifts side to side so moving-source patterns can be seen.
    this.sourcePos.x = GAME_WIDTH / 2 + Math.sin(this.elapsed / 1400) * 110;
    this.source.setPosition(this.sourcePos.x, this.sourcePos.y);

    this.emitter.update(dt);
    if (this.emitter.done) {
      this.restartTimer -= dt;
      if (this.restartTimer <= 0) {
        this.emitter.restart();
        this.restartTimer = 700;
      }
    }
    for (const s of this.stressEmitters) s.emitter.update(dt);

    this.pool.update(dt);
    this.checkHits(dt);
    this.drawHitboxes();
    this.updateInfo(delta);
  }

  // ------------------------------------------------------------------ logic

  private selectAttack(i: number): void {
    this.attackIndex = Phaser.Math.Wrap(i, 0, ATTACKS.length);
    this.emitter = new Emitter(this.pool, this.sourcePos, ATTACKS[this.attackIndex].patterns, this.player);
    this.restartTimer = 700;
  }

  private toggleStress(): void {
    this.stress = !this.stress;
    for (const s of this.stressEmitters) s.sprite.destroy();
    this.stressEmitters = [];
    if (!this.stress) return;
    const xs = [70, 190, 314, 434];
    xs.forEach((x, i) => {
      const pos = { x, y: 90 + (i % 2) * 70 };
      const sprite = this.add.image(pos.x, pos.y, 'enemy', 'medium_b').setDepth(DEPTH.enemies);
      const pattern = { ...STRESS_PATTERN, turnPerVolley: i % 2 ? -STRESS_PATTERN.turnPerVolley! : STRESS_PATTERN.turnPerVolley };
      this.stressEmitters.push({ pos, sprite, emitter: new Emitter(this.pool, pos, [pattern]) });
    });
  }

  private checkHits(dt: number): void {
    if (this.invuln > 0) {
      this.invuln -= dt;
      return;
    }
    const h = this.player.hitbox;
    let hit = false;
    this.pool.collideCircle(h.x, h.y, h.radius, () => {
      hit = true;
      return true; // the bullet that hit is removed
    });
    if (hit) {
      this.hits++;
      this.invuln = INVULN_MS;
      this.tweens.add({ targets: this.player, alpha: 0.25, duration: 70, yoyo: true, repeat: 6, onComplete: () => this.player.setAlpha(1) });
      this.cameras.main.shake(120, 0.004);
    }
  }

  private drawHitboxes(): void {
    const g = this.hitboxGfx;
    g.clear();
    if (!this.showHitboxes) return;
    g.lineStyle(1, 0x00ff88, 0.9);
    this.pool.forEach((b) => g.strokeCircle(b.x, b.y, b.radius));
    const h = this.player.hitbox;
    g.lineStyle(1, 0xffff00, 1).strokeCircle(h.x, h.y, h.radius);
  }

  private updateInfo(rawDelta: number): void {
    // Track the slowest frame of each second: a better jank signal than average FPS.
    this.worstFrame = Math.max(this.worstFrame, rawDelta);
    this.worstTimer += rawDelta;
    if (this.worstTimer >= 1000) {
      this.worstFrameShown = this.worstFrame;
      this.worstFrame = 0;
      this.worstTimer = 0;
    }
    this.info.setText(
      [
        `BULLET LAB   FPS ${Math.round(this.game.loop.actualFps)}  worst ${this.worstFrameShown.toFixed(1)}ms`,
        `bullets ${this.pool.count} / ${this.pool.capacity}${this.pool.dropped ? `  dropped ${this.pool.dropped}` : ''}${this.stress ? '  [STRESS]' : ''}`,
        `attack ${this.attackIndex + 1}/${ATTACKS.length}: ${ATTACKS[this.attackIndex].name}`,
        `hits ${this.hits}`,
      ].join('\n'),
    );
  }

  private bindKeys(): void {
    const kb = this.input.keyboard!;
    kb.on('keydown-Q', () => this.selectAttack(this.attackIndex - 1));
    kb.on('keydown-E', () => this.selectAttack(this.attackIndex + 1));
    kb.on('keydown-T', () => this.toggleStress());
    kb.on('keydown-R', () => this.pool.clear());
    kb.on('keydown-H', () => (this.showHitboxes = !this.showHitboxes));
    kb.on('keydown-ONE', () => this.player.setShip('fighter', this.player.skin));
    kb.on('keydown-TWO', () => this.player.setShip('gunship', this.player.skin));
    kb.on('keydown-ESC', () => this.scene.start(SCENES.Game));
  }
}
