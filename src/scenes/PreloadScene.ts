import Phaser from 'phaser';
import { GAME_HEIGHT, GAME_WIDTH, SCENES } from '../config';
import { ATLASES, BACKGROUNDS } from '../assets/manifest';
import { registerAnimations } from '../assets/animations';

/** Loads every texture, shows a progress bar, registers animations. */
export class PreloadScene extends Phaser.Scene {
  constructor() {
    super(SCENES.Preload);
  }

  preload(): void {
    const barW = 200;
    const x = (GAME_WIDTH - barW) / 2;
    const y = GAME_HEIGHT / 2;
    const frame = this.add.rectangle(x - 2, y - 2, barW + 4, 10, 0x000000).setOrigin(0).setStrokeStyle(1, 0x5b6ee1);
    const fill = this.add.rectangle(x, y, 0, 6, 0x9bd8ff).setOrigin(0);
    this.add.text(GAME_WIDTH / 2, y - 14, 'LOADING', { fontFamily: 'monospace', fontSize: '10px', color: '#9bd8ff' }).setOrigin(0.5);
    this.load.on(Phaser.Loader.Events.PROGRESS, (p: number) => (fill.width = barW * p));
    this.load.once(Phaser.Loader.Events.COMPLETE, () => frame.destroy());

    for (const a of ATLASES) {
      // Atlas JSON is bundled by Vite, so it's passed as an object rather than a URL.
      this.load.atlas(a.key, a.image, a.data as object);
    }
    for (const b of BACKGROUNDS) {
      this.load.image(b.key, b.url);
    }
  }

  create(): void {
    registerAnimations(this.anims);
    this.scene.start(SCENES.SpriteViewer);
  }
}
