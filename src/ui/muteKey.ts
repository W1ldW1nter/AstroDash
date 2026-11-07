import Phaser from 'phaser';
import { GAME_WIDTH } from '../config';
import { audio } from '../audio/engine';
import { COLORS, textStyle } from './theme';

/** M toggles sound in this scene, with a short "SOUND ON/OFF" notice. The setting is remembered. */
export function bindMuteKey(scene: Phaser.Scene, depth = 500): void {
  let notice: Phaser.GameObjects.Text | null = null;
  scene.input.keyboard!.on('keydown-M', () => {
    const muted = audio.toggleMute();
    notice?.destroy();
    const t = scene.add
      .text(GAME_WIDTH - 8, 8, muted ? 'SOUND OFF' : 'SOUND ON', textStyle(8, muted ? COLORS.dim : COLORS.accent))
      .setOrigin(1, 0)
      .setDepth(depth);
    notice = t;
    // Wall-clock timer so it also fades while the game is paused.
    setTimeout(() => {
      if (t.active) t.destroy();
      if (notice === t) notice = null;
    }, 1200);
  });
}
