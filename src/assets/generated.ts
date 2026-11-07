import Phaser from 'phaser';

/** Small textures drawn in code rather than shipped as art. */
export function createGeneratedTextures(scene: Phaser.Scene): void {
  const g = scene.make.graphics({}, false);

  // Hitbox marker: white core, red rim. Shown while focusing.
  if (!scene.textures.exists('hitbox')) {
    g.clear();
    g.fillStyle(0xff3355, 1).fillCircle(4, 4, 4);
    g.fillStyle(0xffffff, 1).fillCircle(4, 4, 2.5);
    g.generateTexture('hitbox', 8, 8);
  }

  // Dashed ring that spins around the ship while focusing.
  if (!scene.textures.exists('focus_ring')) {
    g.clear();
    g.lineStyle(1, 0x9bd8ff, 0.85);
    const dashes = 12;
    for (let i = 0; i < dashes; i++) {
      const a = (i / dashes) * Math.PI * 2;
      g.beginPath();
      g.arc(16, 16, 14, a, a + 0.28);
      g.strokePath();
    }
    g.generateTexture('focus_ring', 32, 32);
  }

  g.destroy();
}
