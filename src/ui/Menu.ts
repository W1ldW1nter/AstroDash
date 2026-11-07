import Phaser from 'phaser';
import { COLORS, textStyle, type FontSize } from './theme';
import { sfx } from '../audio/sfx';

export interface MenuItem {
  label: string;
  action: () => void;
}

export interface MenuOptions {
  depth?: number;
  size?: FontSize;
  spacing?: number;
  /** Ignore input for this long after opening, so a held fire/confirm key can't trigger it (ms). */
  armMs?: number;
  /** Called on Esc / Backspace (e.g. "resume" or "back"). */
  onCancel?: () => void;
}

/**
 * Vertical text menu. Up/Down or W/S to move, Enter/Z/Space to confirm,
 * Esc to cancel; mouse hover selects and click confirms.
 * Uses wall-clock time for its arm delay, so it works while the scene's clock is paused.
 */
export class Menu {
  private readonly texts: Phaser.GameObjects.Text[] = [];
  private readonly cursor: Phaser.GameObjects.Text;
  private selected = 0;
  private readonly armedAt: number;
  private closed = false;
  private readonly onKey: (e: KeyboardEvent) => void;

  constructor(
    private readonly scene: Phaser.Scene,
    x: number,
    y: number,
    private readonly items: MenuItem[],
    opts: MenuOptions = {},
  ) {
    const size = opts.size ?? 16;
    const spacing = opts.spacing ?? size + 14;
    const depth = opts.depth ?? 200;
    this.armedAt = performance.now() + (opts.armMs ?? 250);

    items.forEach((item, i) => {
      const t = scene.add
        .text(x, y + i * spacing, item.label, textStyle(size, COLORS.dim))
        .setOrigin(0.5)
        .setDepth(depth)
        .setInteractive({ useHandCursor: true });
      t.on('pointerover', () => this.move(i));
      t.on('pointerdown', () => this.confirm(i));
      this.texts.push(t);
    });
    this.cursor = scene.add.text(0, 0, '>', textStyle(size, COLORS.gold)).setOrigin(1, 0.5).setDepth(depth);
    this.select(0);

    this.onKey = (e: KeyboardEvent) => {
      switch (e.key) {
        case 'ArrowUp':
        case 'w':
        case 'W':
          this.move(this.selected - 1);
          break;
        case 'ArrowDown':
        case 's':
        case 'S':
          this.move(this.selected + 1);
          break;
        case 'Enter':
        case 'z':
        case 'Z':
        case ' ':
          this.confirm(this.selected);
          break;
        case 'Escape':
        case 'Backspace':
          if (this.armed && opts.onCancel) {
            sfx('menuBack');
            this.destroy();
            opts.onCancel();
          }
          break;
      }
    };
    scene.input.keyboard!.on('keydown', this.onKey);
  }

  private get armed(): boolean {
    return performance.now() >= this.armedAt;
  }

  select(i: number): void {
    if (this.closed) return;
    this.selected = Phaser.Math.Wrap(i, 0, this.items.length);
    this.texts.forEach((t, idx) => t.setColor(idx === this.selected ? COLORS.text : COLORS.dim));
    const t = this.texts[this.selected];
    this.cursor.setPosition(t.x - t.width / 2 - 8, t.y);
  }

  /** Selection changed by the player (plays a blip if it actually moved). */
  private move(i: number): void {
    if (this.closed) return;
    const before = this.selected;
    this.select(i);
    if (this.selected !== before) sfx('menuMove');
  }

  private confirm(i: number): void {
    if (this.closed || !this.armed) return;
    this.select(i);
    sfx('menuConfirm');
    const action = this.items[i].action;
    this.destroy();
    action();
  }

  destroy(): void {
    if (this.closed) return;
    this.closed = true;
    this.scene.input.keyboard?.off('keydown', this.onKey);
    for (const t of this.texts) t.destroy();
    this.cursor.destroy();
  }
}
