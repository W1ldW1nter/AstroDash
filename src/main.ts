import Phaser from 'phaser';
import '@fontsource/press-start-2p/latin-400.css'; // pixel font, bundled locally
import { GAME_HEIGHT, GAME_WIDTH, SCENES, fitZoom } from './config';
import { BootScene } from './scenes/BootScene';
import { PreloadScene } from './scenes/PreloadScene';
import { GameScene } from './scenes/GameScene';
import { TitleScene } from './scenes/TitleScene';
import { ShipSelectScene } from './scenes/ShipSelectScene';

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
  scene: [BootScene, PreloadScene, TitleScene, ShipSelectScene, GameScene],
});

window.addEventListener('resize', () => game.scale.setZoom(fitZoom()));

// Dev builds only: the bullet lab and sprite viewer scenes, and `window.game`
// for poking at the game from the browser console. Dynamic imports inside this
// branch mean production builds don't contain the dev tools at all.
if (import.meta.env.DEV) {
  (window as unknown as { game: Phaser.Game }).game = game;
  void Promise.all([import('./scenes/BulletLabScene'), import('./scenes/SpriteViewerScene')]).then(([lab, viewer]) => {
    game.scene.add(SCENES.BulletLab, lab.BulletLabScene);
    game.scene.add(SCENES.SpriteViewer, viewer.SpriteViewerScene);
  });
}
