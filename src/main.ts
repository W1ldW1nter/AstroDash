import Phaser from 'phaser';
import { GAME_HEIGHT, GAME_WIDTH, fitZoom } from './config';
import { BootScene } from './scenes/BootScene';
import { PreloadScene } from './scenes/PreloadScene';
import { SpriteViewerScene } from './scenes/SpriteViewerScene';

const game = new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game',
  width: GAME_WIDTH,
  height: GAME_HEIGHT,
  backgroundColor: '#05060f',
  pixelArt: true, // nearest-neighbour filtering, no sub-pixel smoothing
  roundPixels: true,
  scale: {
    mode: Phaser.Scale.NONE,
    autoCenter: Phaser.Scale.CENTER_BOTH,
    zoom: fitZoom(),
  },
  physics: {
    default: 'arcade',
    arcade: { debug: false },
  },
  scene: [BootScene, PreloadScene, SpriteViewerScene],
});

window.addEventListener('resize', () => game.scale.setZoom(fitZoom()));

// Handy for poking at the game from the browser console during development.
if (import.meta.env.DEV) (window as unknown as { game: Phaser.Game }).game = game;
