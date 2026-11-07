import Phaser from 'phaser';
import { GAME_HEIGHT, GAME_WIDTH, SCENES } from '../config';
import { ParallaxBackground } from '../world/ParallaxBackground';
import { Menu } from '../ui/Menu';
import { COLORS, textStyle } from '../ui/theme';
import { loadHighScores } from '../systems/Scoring';
import { SHIP_CLASSES } from '../data/ships';
import { loadShipChoice } from '../data/prefs';
import { makeShipPreview } from '../ui/shipPreview';
import { bindMuteKey } from '../ui/muteKey';
import { music } from '../audio/music';

/** Title screen: logo, START, best score per ship, controls. */
export class TitleScene extends Phaser.Scene {
  private background!: ParallaxBackground;
  private flyby: Phaser.GameObjects.Image | null = null;
  private flybyTimer = 0;

  constructor() {
    super(SCENES.Title);
  }

  create(): void {
    const cx = GAME_WIDTH / 2;
    this.background = new ParallaxBackground(this, 0);
    this.flyby = null;
    this.flybyTimer = 1500;

    // Logo: two-tone with a gentle bob.
    const logo = this.add.container(cx, 170);
    const astro = this.add.text(0, 0, 'ASTRO', textStyle(32, COLORS.accent)).setOrigin(1, 0.5);
    const dash = this.add.text(0, 0, 'DASH', textStyle(32, COLORS.gold)).setOrigin(0, 0.5);
    logo.add([astro, dash]);
    this.tweens.add({ targets: logo, y: 178, duration: 1600, yoyo: true, repeat: -1, ease: 'Sine.InOut' });
    this.add.text(cx, 214, 'ENDLESS BULLET HELL', textStyle(8, COLORS.dim)).setOrigin(0.5);

    // Hero ship (your last pick), bobbing gently.
    const choice = loadShipChoice();
    const hero = makeShipPreview(this, cx, 300, choice.shipId, choice.skin).setDepth(1);
    this.tweens.add({ targets: hero, y: 294, duration: 900, yoyo: true, repeat: -1, ease: 'Sine.InOut' });

    new Menu(this, cx, 392, [{ label: 'START', action: () => this.scene.start(SCENES.ShipSelect) }], { size: 16 });
    const prompt = this.add.text(cx, 420, 'PRESS ENTER', textStyle(8, COLORS.dim)).setOrigin(0.5);
    this.tweens.add({ targets: prompt, alpha: 0.25, duration: 700, yoyo: true, repeat: -1 });

    // Best scores.
    const hs = loadHighScores();
    this.add.text(cx, 480, 'HIGH SCORES', textStyle(8, COLORS.gold)).setOrigin(0.5);
    Object.values(SHIP_CLASSES).forEach((s, i) => {
      const score = (hs[s.id] ?? 0).toString().padStart(7, '0');
      this.add.text(cx, 500 + i * 16, `${s.name.toUpperCase().padEnd(8)} ${score}`, textStyle(8)).setOrigin(0.5);
    });

    this.add
      .text(cx, GAME_HEIGHT - 40, 'MOVE ARROWS/WASD  FIRE Z/SPACE\nFOCUS SHIFT  BOMB X  PAUSE ESC\nSOUND ON/OFF M', textStyle(8, COLORS.dim, { align: 'center', lineSpacing: 6 }))
      .setOrigin(0.5);

    bindMuteKey(this);
    music.play('title');
  }

  update(_t: number, delta: number): void {
    this.background.update(delta);

    // An enemy occasionally crosses the background for some life.
    this.flybyTimer -= delta;
    if (!this.flyby && this.flybyTimer <= 0) {
      const frame = Phaser.Math.RND.pick(['small_a', 'small_b', 'medium_a', 'medium_c']);
      this.flyby = this.add.image(Phaser.Math.Between(40, GAME_WIDTH - 40), -20, 'enemy', frame).setAlpha(0.6).setDepth(0.5);
    }
    if (this.flyby) {
      this.flyby.y += delta * 0.09;
      if (this.flyby.y > GAME_HEIGHT + 20) {
        this.flyby.destroy();
        this.flyby = null;
        this.flybyTimer = Phaser.Math.Between(2000, 5000);
      }
    }
  }
}
