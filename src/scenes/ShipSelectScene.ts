import Phaser from 'phaser';
import { GAME_HEIGHT, GAME_WIDTH, SCENES } from '../config';
import { ParallaxBackground } from '../world/ParallaxBackground';
import { SHIP_CLASSES, SKINS, type ShipClass, type Skin } from '../data/ships';
import { loadShipChoice, saveShipChoice } from '../data/prefs';
import { makeShipPreview } from '../ui/shipPreview';
import { COLORS, COLOR_NUM, textStyle } from '../ui/theme';

const SHIP_IDS: ShipClass['id'][] = ['fighter', 'gunship'];
const TAGLINE: Record<ShipClass['id'], string> = {
  fighter: 'FAST + PRECISE',
  gunship: 'WIDE + TOUGH',
};
const CARD_W = 228;
const CARD_H = 330;
const CARD_Y = 255;
const SWATCH_Y = 478;
const BAR_W = 100;

/** Derived stats for the bars, so they stay true if ships.ts is retuned. */
function stats(s: ShipClass) {
  const dps = (s.shots.length * s.bulletDamage * 1000) / s.fireInterval;
  const angles = s.shots.map((sh) => sh.angle);
  const spread = Math.max(...angles) - Math.min(...angles);
  return {
    speed: s.speed / 350,
    power: dps / 60,
    spread: Math.max(0.08, spread / 40),
  };
}

/**
 * Pick a ship and colour.
 *   Left/Right: ship   Up/Down (or Q/E): colour   Enter/Z/Space: launch   Esc: back
 * Mouse: click a card, a colour, or LAUNCH.
 */
export class ShipSelectScene extends Phaser.Scene {
  private background!: ParallaxBackground;
  private shipIndex = 0;
  private skin: Skin = 'blue';
  private cards: { box: Phaser.GameObjects.Rectangle; preview: Phaser.GameObjects.Container; x: number }[] = [];
  private swatches: { frame: Phaser.GameObjects.Rectangle; img: Phaser.GameObjects.Image }[] = [];
  private armedAt = 0;

  constructor() {
    super(SCENES.ShipSelect);
  }

  create(): void {
    const choice = loadShipChoice();
    this.shipIndex = SHIP_IDS.indexOf(choice.shipId);
    this.skin = choice.skin;
    this.cards = [];
    this.swatches = [];
    this.armedAt = performance.now() + 250;

    this.background = new ParallaxBackground(this, 0);
    this.add.rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT, COLOR_NUM.shade, 0.45).setOrigin(0);
    this.add.text(GAME_WIDTH / 2, 50, 'SELECT YOUR SHIP', textStyle(16)).setOrigin(0.5);

    SHIP_IDS.forEach((id, i) => this.buildCard(id, i));
    this.buildSwatches();

    const launch = this.add.text(GAME_WIDTH / 2, 560, 'LAUNCH', textStyle(16, COLORS.gold)).setOrigin(0.5).setInteractive({ useHandCursor: true });
    launch.on('pointerdown', () => this.launch());
    this.tweens.add({ targets: launch, alpha: 0.55, duration: 600, yoyo: true, repeat: -1 });
    this.add
      .text(GAME_WIDTH / 2, GAME_HEIGHT - 40, 'LEFT/RIGHT SHIP   UP/DOWN COLOUR\nENTER LAUNCH   ESC BACK', textStyle(8, COLORS.dim, { align: 'center', lineSpacing: 6 }))
      .setOrigin(0.5);

    this.refresh();
    this.input.keyboard!.on('keydown', (e: KeyboardEvent) => this.onKey(e));
  }

  update(_t: number, delta: number): void {
    this.background.update(delta);
  }

  // ------------------------------------------------------------------ ui

  private buildCard(id: ShipClass['id'], i: number): void {
    const s = SHIP_CLASSES[id];
    const x = GAME_WIDTH / 2 + (i === 0 ? -1 : 1) * (CARD_W / 2 + 10);
    const top = CARD_Y - CARD_H / 2;
    const box = this.add.rectangle(x, CARD_Y, CARD_W, CARD_H, COLOR_NUM.panel, 0.92).setStrokeStyle(2, COLOR_NUM.panelEdge);
    box.setInteractive({ useHandCursor: true }).on('pointerdown', () => {
      if (this.shipIndex === i) this.launch();
      else this.setShip(i);
    });

    const preview = makeShipPreview(this, x, top + 70, id, this.skin, 2);
    this.add.text(x, top + 140, s.name.toUpperCase(), textStyle(16)).setOrigin(0.5);
    this.add.text(x, top + 162, TAGLINE[id], textStyle(8, COLORS.accent)).setOrigin(0.5);

    const st = stats(s);
    const left = x - CARD_W / 2 + 16;
    const rows: [string, number][] = [
      ['SPEED', st.speed],
      ['POWER', st.power],
      ['SPREAD', st.spread],
    ];
    const g = this.add.graphics();
    rows.forEach(([label, v], r) => {
      const y = top + 196 + r * 22;
      this.add.text(left, y, label, textStyle(8, COLORS.dim)).setOrigin(0, 0.5);
      const bx = x + CARD_W / 2 - 16 - BAR_W;
      g.fillStyle(0x000000, 0.6).fillRect(bx, y - 3, BAR_W, 6);
      g.fillStyle(COLOR_NUM.gold, 1).fillRect(bx, y - 3, Math.round(BAR_W * Math.min(1, v)), 6);
    });
    const ly = top + 196 + 3 * 22;
    this.add.text(left, ly, 'LIVES', textStyle(8, COLORS.dim)).setOrigin(0, 0.5);
    for (let l = 0; l < s.lives; l++) this.add.image(x + CARD_W / 2 - 22 - l * 16, ly, 'ui', 'heart_full');
    const sy = ly + 24;
    this.add.text(left, sy, 'SHIELD', textStyle(8, COLORS.dim)).setOrigin(0, 0.5);
    this.add
      .text(x + CARD_W / 2 - 16, sy, s.shield ? 'RECHARGING' : 'NONE', textStyle(8, s.shield ? COLORS.accent : COLORS.dim))
      .setOrigin(1, 0.5);

    this.cards.push({ box, preview, x });
  }

  private buildSwatches(): void {
    this.add.text(GAME_WIDTH / 2, SWATCH_Y - 34, 'COLOUR', textStyle(8, COLORS.dim)).setOrigin(0.5);
    const step = 62;
    const x0 = GAME_WIDTH / 2 - ((SKINS.length - 1) * step) / 2;
    SKINS.forEach((skin, i) => {
      const x = x0 + i * step;
      const frame = this.add.rectangle(x, SWATCH_Y, 54, 52, COLOR_NUM.panel, 0.9).setStrokeStyle(2, COLOR_NUM.panelEdge);
      const img = this.add.image(x, SWATCH_Y, 'player', 'fighter_blue');
      frame.setInteractive({ useHandCursor: true }).on('pointerdown', () => this.setSkin(skin));
      this.swatches.push({ frame, img });
    });
  }

  private refresh(): void {
    const id = SHIP_IDS[this.shipIndex];
    this.cards.forEach((c, i) => {
      const on = i === this.shipIndex;
      c.box.setStrokeStyle(2, on ? COLOR_NUM.gold : COLOR_NUM.panelEdge);
      c.box.setFillStyle(COLOR_NUM.panel, on ? 0.95 : 0.6);
      // Rebuild the preview in the current colour; dim the unselected ship.
      const scale = c.preview.scale;
      const { x, y } = c.preview;
      c.preview.destroy();
      c.preview = makeShipPreview(this, x, y, SHIP_IDS[i], this.skin, scale).setAlpha(on ? 1 : 0.45);
    });
    this.swatches.forEach((s, i) => {
      s.img.setFrame(`${SHIP_CLASSES[id].frame}_${SKINS[i]}`);
      // Gunship hulls are wider than the swatch box at 1x; shrink to fit.
      s.img.setScale(s.img.width > 44 ? 0.75 : 1);
      s.frame.setStrokeStyle(2, SKINS[i] === this.skin ? COLOR_NUM.gold : COLOR_NUM.panelEdge);
    });
  }

  // --------------------------------------------------------------- input

  private onKey(e: KeyboardEvent): void {
    if (performance.now() < this.armedAt) return;
    switch (e.key) {
      case 'ArrowLeft':
      case 'a':
      case 'A':
        this.setShip(this.shipIndex - 1);
        break;
      case 'ArrowRight':
      case 'd':
      case 'D':
        this.setShip(this.shipIndex + 1);
        break;
      case 'ArrowUp':
      case 'w':
      case 'W':
      case 'q':
      case 'Q':
        this.setSkin(SKINS[Phaser.Math.Wrap(SKINS.indexOf(this.skin) - 1, 0, SKINS.length)]);
        break;
      case 'ArrowDown':
      case 's':
      case 'S':
      case 'e':
      case 'E':
        this.setSkin(SKINS[Phaser.Math.Wrap(SKINS.indexOf(this.skin) + 1, 0, SKINS.length)]);
        break;
      case 'Enter':
      case 'z':
      case 'Z':
      case ' ':
        this.launch();
        break;
      case 'Escape':
      case 'Backspace':
        this.scene.start(SCENES.Title);
        break;
    }
  }

  private setShip(i: number): void {
    this.shipIndex = Phaser.Math.Wrap(i, 0, SHIP_IDS.length);
    this.refresh();
  }

  private setSkin(skin: Skin): void {
    this.skin = skin;
    this.refresh();
  }

  private launch(): void {
    const choice = { shipId: SHIP_IDS[this.shipIndex], skin: this.skin };
    saveShipChoice(choice);
    this.scene.start(SCENES.Game, choice);
  }
}
