import Phaser from 'phaser';
import { GAME_HEIGHT, GAME_WIDTH } from '../config';
import type { Player } from '../entities/Player';
import type { Upgrade } from '../data/upgrades';

const CARD_W = 140;
const CARD_H = 168;
const GAP = 14;
/** Ignore input briefly so a held fire button can't pick a card by accident. */
const ARM_DELAY_MS = 600;

/**
 * "Choose an upgrade" overlay: three cards. Left/Right (or A/D) to select,
 * Z / Space / Enter to confirm, or click a card.
 */
export class UpgradePicker {
  private readonly root: Phaser.GameObjects.Container;
  private readonly cards: { box: Phaser.GameObjects.Rectangle; group: Phaser.GameObjects.Container }[] = [];
  private selected = 1;
  private armed = false;
  private done = false;
  private readonly keyHandler: (e: KeyboardEvent) => void;

  constructor(
    private readonly scene: Phaser.Scene,
    player: Player,
    private readonly options: Upgrade[],
    depth: number,
    private readonly onPick: (u: Upgrade) => void,
  ) {
    const cx = GAME_WIDTH / 2;
    const cy = GAME_HEIGHT / 2;
    this.root = scene.add.container(0, 0).setDepth(depth);

    const shade = scene.add.rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT, 0x05060f, 0.78).setOrigin(0);
    const title = scene.add.text(cx, cy - CARD_H / 2 - 44, 'BOSS DEFEATED', { fontFamily: 'monospace', fontSize: '12px', color: '#9bd8ff' }).setOrigin(0.5);
    const sub = scene.add.text(cx, cy - CARD_H / 2 - 24, 'CHOOSE AN UPGRADE', { fontFamily: 'monospace', fontSize: '18px', color: '#ffffff' }).setOrigin(0.5);
    const hint = scene.add
      .text(cx, cy + CARD_H / 2 + 26, '← → select    Z / ENTER confirm', { fontFamily: 'monospace', fontSize: '11px', color: '#8b9bb4' })
      .setOrigin(0.5);
    this.root.add([shade, title, sub, hint]);

    const totalW = options.length * CARD_W + (options.length - 1) * GAP;
    options.forEach((u, i) => {
      const x = cx - totalW / 2 + CARD_W / 2 + i * (CARD_W + GAP);
      const group = scene.add.container(x, cy);
      const box = scene.add.rectangle(0, 0, CARD_W, CARD_H, 0x111428, 1).setStrokeStyle(2, 0x3a4466);
      const icon = scene.add.image(0, -42, 'bonuses', u.icon).setScale(2);
      const level = player.upgrades[u.id] ?? 0;
      const name = scene.add.text(0, 6, u.name.toUpperCase(), { fontFamily: 'monospace', fontSize: '13px', color: '#ffffff' }).setOrigin(0.5);
      const desc = scene.add
        .text(0, 34, u.description(player), { fontFamily: 'monospace', fontSize: '10px', color: '#cfe8ff', align: 'center', wordWrap: { width: CARD_W - 20 } })
        .setOrigin(0.5, 0);
      const pips = scene.add
        .text(0, CARD_H / 2 - 16, '■'.repeat(level) + '□'.repeat(u.max - level), { fontFamily: 'monospace', fontSize: '10px', color: '#ffd23f' })
        .setOrigin(0.5);
      group.add([box, icon, name, desc, pips]);
      box.setInteractive({ useHandCursor: true });
      box.on('pointerover', () => this.select(i));
      box.on('pointerdown', () => this.confirm(i));
      this.root.add(group);
      this.cards.push({ box, group });
    });
    this.select(Math.min(1, options.length - 1));

    // Fade in, then accept input.
    this.root.setAlpha(0);
    scene.tweens.add({ targets: this.root, alpha: 1, duration: 200 });
    scene.time.delayedCall(ARM_DELAY_MS, () => (this.armed = true));

    this.keyHandler = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase();
      if (k === 'arrowleft' || k === 'a') this.select(this.selected - 1);
      else if (k === 'arrowright' || k === 'd') this.select(this.selected + 1);
      else if (k === 'z' || k === ' ' || k === 'enter') this.confirm(this.selected);
    };
    scene.input.keyboard!.on('keydown', this.keyHandler);
  }

  private select(i: number): void {
    if (this.done) return;
    this.selected = Phaser.Math.Clamp(i, 0, this.cards.length - 1);
    this.cards.forEach((c, idx) => {
      const on = idx === this.selected;
      c.box.setStrokeStyle(2, on ? 0xffd23f : 0x3a4466);
      c.group.y = GAME_HEIGHT / 2 - (on ? 6 : 0);
    });
  }

  private confirm(i: number): void {
    if (!this.armed || this.done) return;
    this.select(i);
    this.done = true;
    this.scene.input.keyboard!.off('keydown', this.keyHandler);
    const picked = this.options[i];
    this.scene.tweens.add({
      targets: this.root,
      alpha: 0,
      duration: 200,
      delay: 150,
      onComplete: () => {
        this.root.destroy();
        this.onPick(picked);
      },
    });
  }
}
