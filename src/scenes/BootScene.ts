import Phaser from 'phaser';
import { SCENES } from '../config';

/** First scene: global setup that must happen before anything is loaded. */
export class BootScene extends Phaser.Scene {
  constructor() {
    super(SCENES.Boot);
  }

  create(): void {
    // Silence audio while the tab is in the background.
    this.game.events.on(Phaser.Core.Events.BLUR, () => this.sound.pauseAll());
    this.game.events.on(Phaser.Core.Events.FOCUS, () => this.sound.resumeAll());
    this.scene.start(SCENES.Preload);
  }
}
