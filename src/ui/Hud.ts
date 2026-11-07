import Phaser from 'phaser';
import { GAME_WIDTH } from '../config';
import type { Player } from '../entities/Player';
import type { Scoring } from '../systems/Scoring';
import { BARRIER_MS, DOUBLE_SCORE_MS, MAX_BOMBS, RAPID_FIRE_MS } from '../data/pickups';

const TEXT = { fontFamily: 'monospace', fontSize: '12px', color: '#ffffff' };
const SMALL = { fontFamily: 'monospace', fontSize: '10px', color: '#8b9bb4' };

/**
 * HUD:
 *   left   hearts + shield / bombs / active boosts with timers
 *   centre wave number
 *   right  score / high score / multiplier / grazes
 * (The full sprite-based HUD pass comes in Milestone 7.)
 */
export class Hud {
  private readonly hearts: Phaser.GameObjects.Image[] = [];
  private readonly shieldIcon: Phaser.GameObjects.Image;
  private readonly bombIcons: Phaser.GameObjects.Image[] = [];
  private readonly boostIcons: Record<'rapid' | 'barrier' | 'double', Phaser.GameObjects.Image>;
  private readonly gfx: Phaser.GameObjects.Graphics;
  private readonly scoreText: Phaser.GameObjects.Text;
  private readonly hiText: Phaser.GameObjects.Text;
  private readonly multText: Phaser.GameObjects.Text;
  private readonly grazeText: Phaser.GameObjects.Text;
  private readonly waveText: Phaser.GameObjects.Text;
  private maxLives = -1;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly depth: number,
  ) {
    this.shieldIcon = scene.add.image(0, 0, 'ui', 'icon_shield').setDepth(depth).setVisible(false);
    this.gfx = scene.add.graphics().setDepth(depth);
    for (let i = 0; i < MAX_BOMBS; i++) {
      this.bombIcons.push(scene.add.image(12 + i * 14, 36, 'ui', 'icon_bomb').setScale(0.5).setDepth(depth));
    }
    this.boostIcons = {
      rapid: scene.add.image(0, 0, 'ui', 'icon_rapid').setScale(0.5).setDepth(depth),
      barrier: scene.add.image(0, 0, 'ui', 'icon_shield').setScale(0.5).setDepth(depth),
      double: scene.add.image(0, 0, 'ui', 'icon_double').setScale(0.5).setDepth(depth),
    };
    const R = GAME_WIDTH - 8;
    this.scoreText = scene.add.text(R, 6, '0', TEXT).setOrigin(1, 0).setDepth(depth);
    this.hiText = scene.add.text(R, 22, '', SMALL).setOrigin(1, 0).setDepth(depth);
    this.multText = scene.add.text(R, 35, '', { ...SMALL, color: '#ffd23f' }).setOrigin(1, 0).setDepth(depth);
    this.grazeText = scene.add.text(R, 48, '', SMALL).setOrigin(1, 0).setDepth(depth);
    this.waveText = scene.add.text(GAME_WIDTH / 2, 8, '', { ...TEXT, color: '#9bd8ff' }).setOrigin(0.5, 0).setDepth(depth);
  }

  update(player: Player, scoring: Scoring, wave: number): void {
    this.waveText.setText(wave > 0 ? `WAVE ${wave}` : '');

    // Hearts: rebuilt when max lives changes (ship switch, Repair upgrade).
    if (player.ship.lives !== this.maxLives) {
      this.maxLives = player.ship.lives;
      for (const h of this.hearts) h.destroy();
      this.hearts.length = 0;
      for (let i = 0; i < this.maxLives; i++) this.hearts.push(this.scene.add.image(14 + i * 16, 14, 'ui', 'heart_full').setDepth(this.depth));
    }
    this.hearts.forEach((h, i) => h.setFrame(i < player.lives ? 'heart_full' : 'heart_empty'));

    const g = this.gfx;
    g.clear();

    // Shield: bright when up, dim with a refill bar while recharging.
    const hasShield = player.ship.shield !== null;
    this.shieldIcon.setVisible(hasShield);
    if (hasShield) {
      const x = 14 + this.maxLives * 16 + 10;
      this.shieldIcon.setPosition(x, 14).setAlpha(player.shieldUp ? 1 : 0.35);
      if (!player.shieldUp) {
        g.fillStyle(0x000000, 0.6).fillRect(x - 11, 27, 22, 3);
        g.fillStyle(0x7fd8ff, 1).fillRect(x - 11, 27, Math.floor(22 * player.shieldCharge), 3);
      }
    }

    // Bombs: lit icons for bombs in stock, faint outlines up to the max.
    this.bombIcons.forEach((b, i) => b.setAlpha(i < player.bombs ? 1 : 0.15));

    // Active boosts, each with a draining timer bar.
    let y = 54;
    const boost = (icon: Phaser.GameObjects.Image, left: number, total: number) => {
      icon.setVisible(left > 0);
      if (left <= 0) return;
      icon.setPosition(12, y);
      g.fillStyle(0x000000, 0.6).fillRect(22, y - 2, 36, 4);
      g.fillStyle(0xffd23f, 1).fillRect(22, y - 2, Math.ceil(36 * (left / total)), 4);
      y += 14;
    };
    boost(this.boostIcons.rapid, player.rapidFire, RAPID_FIRE_MS);
    boost(this.boostIcons.barrier, player.barrier, BARRIER_MS);
    boost(this.boostIcons.double, scoring.doubleScore, DOUBLE_SCORE_MS);

    this.scoreText.setText(scoring.score.toString().padStart(7, '0'));
    this.hiText.setText(`HI ${Math.max(scoring.highScore, scoring.score).toString().padStart(7, '0')}`);
    const m = scoring.multiplier;
    this.multText.setText(m > 1.001 ? `x${m.toFixed(1)}${scoring.doubleScore > 0 ? ' 2X' : ''}  CHAIN ${scoring.chain}` : '');
    this.grazeText.setText(scoring.grazes ? `GRAZE ${scoring.grazes}` : '');
  }
}
