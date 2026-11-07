import Phaser from 'phaser';
import { SHIP_CLASSES, type ShipClass, type Skin } from '../data/ships';

/**
 * A display-only ship (hull + animated engine flames) for menus.
 * Flames match the in-game ship: same positions, flips and colours.
 */
export function makeShipPreview(scene: Phaser.Scene, x: number, y: number, shipId: ShipClass['id'], skin: Skin, scale = 1): Phaser.GameObjects.Container {
  const ship = SHIP_CLASSES[shipId];
  const blue = skin === 'blue' || skin === 'silver';
  const flames = ship.exhaust.map((e) => {
    const anim = e.kind === 'twin' ? 'exhaust_red_s' : blue ? 'exhaust_blue_l' : 'exhaust_red_l';
    return scene.add.sprite(e.x, e.y, 'exhaust').play({ key: anim, startFrame: Phaser.Math.Between(0, 3) }).setFlipY(e.flipY ?? false);
  });
  const hull = scene.add.image(0, 0, 'player', `${ship.frame}_${skin}`);
  return scene.add.container(x, y, [...flames, hull]).setScale(scale);
}
