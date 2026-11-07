import Phaser from 'phaser';
import { SCENES } from '../config';
import { FONT_LOAD } from '../ui/theme';
import { audio } from '../audio/engine';

/** First scene: global setup that must happen before anything is loaded. */
export class BootScene extends Phaser.Scene {
  constructor() {
    super(SCENES.Boot);
  }

  create(): void {
    // Silence audio while the tab is in the background.
    this.game.events.on(Phaser.Core.Events.BLUR, () => audio.setBackground(true));
    this.game.events.on(Phaser.Core.Events.FOCUS, () => audio.setBackground(false));

    // Canvas text can't use a web font until it has loaded; wait for it (but never hang on it).
    const timeout = new Promise((resolve) => setTimeout(resolve, 3000));
    Promise.race([document.fonts.load(FONT_LOAD), timeout])
      .catch(() => undefined)
      .then(() => this.scene.start(SCENES.Preload));
  }
}
