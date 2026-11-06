import Phaser from 'phaser';
import { GAME_HEIGHT, GAME_WIDTH, SCENES } from '../config';
import { ATLASES, type AtlasKey } from '../assets/manifest';
import { ANIMS } from '../assets/animations';

/**
 * Debug scene for Milestone 0: browse every sliced frame and animation.
 *   Left/Right (or click the arrows) - change page
 *   Mouse wheel / Up/Down            - scroll
 *   Hover a sprite                   - show its atlas key, frame name and size
 */

type Page =
  | { kind: 'parallax'; title: string }
  | { kind: 'atlas'; title: string; key: AtlasKey }
  | { kind: 'anims'; title: string };

const PAGES: Page[] = [
  { kind: 'parallax', title: 'parallax' },
  ...ATLASES.map((a) => ({ kind: 'atlas' as const, title: a.key, key: a.key })),
  { kind: 'anims', title: 'animations' },
];

const HEADER_H = 34;
const PAD = 6;
const TEXT = { fontFamily: 'monospace', fontSize: '10px', color: '#cfe8ff' };

export class SpriteViewerScene extends Phaser.Scene {
  private pageIndex = 0;
  private leaving = false;
  private contentBottom = 0;
  private info!: Phaser.GameObjects.Text;
  private layers: { sprite: Phaser.GameObjects.TileSprite; speed: number }[] = [];

  constructor() {
    super(SCENES.SpriteViewer);
  }

  init(data: { page?: number }): void {
    this.pageIndex = Phaser.Math.Wrap(data.page ?? 0, 0, PAGES.length);
    this.layers = [];
    this.leaving = false;
    this.contentBottom = 0;
  }

  create(): void {
    const page = PAGES[this.pageIndex];
    if (page.kind === 'parallax') this.buildParallax();
    else if (page.kind === 'atlas') this.buildAtlas(page.key);
    else this.buildAnims();
    this.buildHeader(page);
    this.bindInput();
  }

  update(_time: number, delta: number): void {
    for (const l of this.layers) l.sprite.tilePositionY -= (l.speed * delta) / 1000;
  }

  // ---------------------------------------------------------------- pages

  private buildParallax(): void {
    // Back to front, px/sec. Background scrolls down = ship flies up.
    const layerDefs = [
      { key: 'bg_space', speed: 4 },
      { key: 'bg_nebula_1', speed: 10 },
      { key: 'bg_nebula_2', speed: 16 },
      { key: 'bg_small_stars', speed: 28 },
      { key: 'bg_stars', speed: 48 },
    ];
    for (const d of layerDefs) {
      const sprite = this.add.tileSprite(0, 0, GAME_WIDTH, GAME_HEIGHT, d.key).setOrigin(0);
      // Tiles are 320px wide on a 360px screen: center them so the horizontal seams sit at the edges.
      sprite.tilePositionX = (sprite.texture.getSourceImage().width - GAME_WIDTH) / 2;
      this.layers.push({ sprite, speed: d.speed });
    }

    // Exhaust is added first so it renders underneath the ship.
    const shipX = GAME_WIDTH / 2;
    const shipY = GAME_HEIGHT * 0.75;
    const exhaust = this.add.sprite(shipX, shipY, 'exhaust').play('exhaust_blue_l');
    const ship = this.add.image(shipX, shipY, 'player', 'fighter_blue');
    exhaust.y = shipY + ship.height / 2 + exhaust.height / 2 - 6;
    this.makeHoverable(ship, 'player:fighter_blue');

    this.add.text(PAD, GAME_HEIGHT - 14, 'space > nebula x2 > small stars > stars', TEXT).setAlpha(0.7);
  }

  private buildAtlas(key: AtlasKey): void {
    const tex = this.textures.get(key);
    const names = tex.getFrameNames();
    const g = this.add.graphics().lineStyle(1, 0x3a4466, 1);
    this.flow(
      names.map((name) => {
        const f = tex.get(name); // realWidth = untrimmed size for trimmed (animation) frames
        return { w: f.realWidth, h: f.realHeight, name };
      }),
      (item, x, y) => {
        g.strokeRect(x - 0.5, y - 0.5, item.w + 1, item.h + 1);
        const img = this.add.image(x, y, key, item.name).setOrigin(0);
        this.makeHoverable(img, `${key}:${item.name}  ${item.w}x${item.h}`);
      },
    );
  }

  private buildAnims(): void {
    const items = ANIMS.map((a) => {
      const first = this.textures.getFrame(a.atlas, `${a.prefix}0`);
      return { w: first.realWidth, h: first.realHeight, name: a.key };
    });
    this.flow(items, (item, x, y) => {
      const s = this.add.sprite(x + item.w / 2, y + item.h / 2, '__DEFAULT');
      // Loop one-shot animations (explosions) so they can be inspected.
      s.play({ key: item.name, repeat: -1, repeatDelay: 300 });
      this.makeHoverable(s, `anim:${item.name}  ${s.anims.currentAnim?.frames.length ?? 0}f`);
    });
  }

  // -------------------------------------------------------------- helpers

  /** Left-to-right, top-to-bottom layout that wraps at the screen edge. */
  private flow<T extends { w: number; h: number }>(items: T[], place: (item: T, x: number, y: number) => void): void {
    let x = PAD;
    let y = HEADER_H + PAD;
    let rowH = 0;
    for (const item of items) {
      if (x + item.w > GAME_WIDTH - PAD && x > PAD) {
        x = PAD;
        y += rowH + PAD;
        rowH = 0;
      }
      place(item, x, y);
      x += item.w + PAD;
      rowH = Math.max(rowH, item.h);
    }
    this.contentBottom = y + rowH + PAD;
  }

  private makeHoverable(obj: Phaser.GameObjects.Image | Phaser.GameObjects.Sprite, label: string): void {
    obj.setInteractive();
    obj.on('pointerover', () => {
      this.info.setText(label);
      obj.setTint(0xffffaa);
    });
    obj.on('pointerout', () => obj.clearTint());
  }

  private buildHeader(page: Page): void {
    this.add.rectangle(0, 0, GAME_WIDTH, HEADER_H, 0x0b0d1c, 0.92).setOrigin(0).setScrollFactor(0).setDepth(100);
    const title = `${this.pageIndex + 1}/${PAGES.length}  ${page.title.toUpperCase()}`;
    this.add.text(GAME_WIDTH / 2, 4, title, { ...TEXT, color: '#ffffff' }).setOrigin(0.5, 0).setScrollFactor(0).setDepth(101);
    this.info = this.add
      .text(GAME_WIDTH / 2, 19, 'hover a sprite', { ...TEXT, color: '#8b9bb4' })
      .setOrigin(0.5, 0)
      .setScrollFactor(0)
      .setDepth(101);

    const arrow = (x: number, label: string, dir: number) =>
      this.add
        .text(x, 10, label, { ...TEXT, fontSize: '14px', color: '#9bd8ff' })
        .setOrigin(0.5)
        .setScrollFactor(0)
        .setDepth(101)
        .setInteractive({ useHandCursor: true })
        .on('pointerdown', () => this.goTo(dir));
    arrow(12, '<', -1);
    arrow(GAME_WIDTH - 12, '>', 1);
  }

  private bindInput(): void {
    const kb = this.input.keyboard!;
    kb.on('keydown-LEFT', () => this.goTo(-1));
    kb.on('keydown-RIGHT', () => this.goTo(1));
    kb.on('keydown-UP', () => this.scrollBy(-40));
    kb.on('keydown-DOWN', () => this.scrollBy(40));
    this.input.on('wheel', (_p: unknown, _o: unknown, _dx: number, dy: number) => this.scrollBy(dy * 0.5));
  }

  private scrollBy(dy: number): void {
    const cam = this.cameras.main;
    const max = Math.max(0, this.contentBottom - GAME_HEIGHT);
    cam.scrollY = Phaser.Math.Clamp(cam.scrollY + dy, 0, max);
  }

  private goTo(dir: number): void {
    if (this.leaving) return; // ignore repeat clicks while the scene restarts
    this.leaving = true;
    this.scene.restart({ page: this.pageIndex + dir });
  }
}
