import Phaser from 'phaser';
import { GAME_HEIGHT, GAME_WIDTH } from '../config';
import type { Player } from '../entities/Player';
import type { Upgrade } from '../data/upgrades';
import { COLORS, COLOR_NUM, textStyle } from './theme';

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

    const shade = scene.add.rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT, COLOR_NUM.shade, 0.78).setOrigin(0);
    const title = scene.add.text(cx, cy - CARD_H / 2 - 52, 'BOSS DEFEATED', textStyle(8, COLORS.accent)).setOrigin(0.5);
    const sub = scene.add.text(cx, cy - CARD_H / 2 - 28, 'CHOOSE AN UPGRADE', textStyle(16)).setOrigin(0.5);
    const hint = scene.add.text(cx, cy + CARD_H / 2 + 28, 'LEFT/RIGHT SELECT   Z/ENTER CONFIRM', textStyle(8, COLORS.dim)).setOrigin(0.5);
    this.root.add([shade, title, sub, hint]);

    const totalW = options.length * CARD_W + (options.length - 1) * GAP;
    options.forEach((u, i) => {
      const x = cx - totalW / 2 + CARD_W / 2 + i * (CARD_W + GAP);
      const group = scene.add.container(x, cy);
      const box = scene.add.rectangle(0, 0, CARD_W, CARD_H, COLOR_NUM.panel, 1).setStrokeStyle(2, COLOR_NUM.panelEdge);
      const icon = scene.add.image(0, -42, 'bonuses', u.icon).setScale(2);
      const level = player.upgrades[u.id] ?? 0;
      const name = scene.add.text(0, 6, u.name.toUpperCase(), textStyle(8)).setOrigin(0.5);
      const desc = scene.add
        .text(0, 26, u.description(player).toUpperCase(), textStyle(8, COLORS.accent, { align: 'center', lineSpacing: 4, wordWrap: { width: CARD_W - 16 } }))
        .setOrigin(0.5, 0);
      // Level pips: filled = already taken, outline = still available.
      const pips = scene.add.graphics();
      const pipX = -((u.max - 1) * 12) / 2;
      for (let p = 0; p < u.max; p++) {
        if (p < level) pips.fillStyle(COLOR_NUM.gold, 1).fillRect(pipX + p * 12 - 3, CARD_H / 2 - 19, 7, 7);
        else pips.lineStyle(1, COLOR_NUM.gold, 1).strokeRect(pipX + p * 12 - 3 + 0.5, CARD_H / 2 - 19 + 0.5, 6, 6);
      }
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
