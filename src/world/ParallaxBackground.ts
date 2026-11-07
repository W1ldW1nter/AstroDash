import Phaser from 'phaser';
import { GAME_HEIGHT, GAME_WIDTH } from '../config';
import type { BackgroundKey } from '../assets/manifest';

interface LayerDef {
  key: BackgroundKey;
  /** px/sec. The background scrolls down, so the ship appears to fly up. */
  speed: number;
  /** Layer art doesn't wrap horizontally: draw it as [image | mirrored image]. */
  mirror?: boolean;
  /** Horizontal tile offset. Staggered between nebulae so their mirror lines don't coincide. */
  offsetX?: number;
}

/** Back to front. Space and star layers wrap cleanly on their own; the nebulae don't. */
const LAYERS: LayerDef[] = [
  { key: 'bg_space', speed: 6 },
  { key: 'bg_nebula_1', speed: 14, mirror: true, offsetX: -92 }, // mirror lines at x=92 and x=412
  { key: 'bg_nebula_2', speed: 22, mirror: true, offsetX: -40 }, // mirror lines at x=40 and x=360
  { key: 'bg_small_stars', speed: 40 },
  { key: 'bg_stars', speed: 67 },
];

/**
 * The nebula art tiles vertically but not horizontally (hard edge where the
 * tile repeats), and the 320px tiles are narrower than the screen. Those
 * layers are drawn as [image | mirrored image]: a 640px texture whose edges
 * always match, so it wraps seamlessly in both directions with 1:1 pixels.
 */
function mirroredTexture(scene: Phaser.Scene, key: BackgroundKey): string {
  const mirrorKey = `${key}_mirrored`;
  if (scene.textures.exists(mirrorKey)) return mirrorKey;
  const src = scene.textures.get(key).getSourceImage() as HTMLImageElement;
  const tex = scene.textures.createCanvas(mirrorKey, src.width * 2, src.height)!;
  const ctx = tex.getContext();
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(src, 0, 0);
  ctx.save();
  ctx.translate(src.width * 2, 0);
  ctx.scale(-1, 1);
  ctx.drawImage(src, 0, 0);
  ctx.restore();
  tex.refresh();
  return mirrorKey;
}

export class ParallaxBackground {
  private readonly layers: { sprite: Phaser.GameObjects.TileSprite; speed: number }[] = [];
  /** Multiplier for all layers (e.g. speed up during a boss warning). */
  speedScale = 1;

  constructor(scene: Phaser.Scene, depth = 0) {
    for (const l of LAYERS) {
      const key = l.mirror ? mirroredTexture(scene, l.key) : l.key;
      const sprite = scene.add.tileSprite(0, 0, GAME_WIDTH, GAME_HEIGHT, key).setOrigin(0).setDepth(depth);
      sprite.tilePositionX = l.offsetX ?? 0;
      this.layers.push({ sprite, speed: l.speed });
    }
  }

  update(deltaMs: number): void {
    const dt = (deltaMs / 1000) * this.speedScale;
    for (const l of this.layers) l.sprite.tilePositionY -= l.speed * dt;
  }
}
