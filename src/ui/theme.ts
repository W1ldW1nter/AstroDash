import type Phaser from 'phaser';

/**
 * Shared look for all game text. "Press Start 2P" is an 8px-grid pixel font,
 * bundled locally (@fontsource), so sizes should stay multiples of 8 to stay crisp.
 */
export const FONT = '"Press Start 2P", monospace';
export const FONT_LOAD = '8px "Press Start 2P"';

export const COLORS = {
  text: '#ffffff',
  dim: '#8b9bb4',
  accent: '#9bd8ff',
  gold: '#ffd23f',
  danger: '#ff3d6e',
  shadow: '#05060f',
} as const;

export const COLOR_NUM = {
  panel: 0x111428,
  panelEdge: 0x3a4466,
  gold: 0xffd23f,
  shade: 0x05060f,
} as const;

export type FontSize = 8 | 16 | 24 | 32;

/** Pixel-font text style with a hard 1px drop shadow for readability over the background. */
export function textStyle(size: FontSize = 8, color: string = COLORS.text, extra: Phaser.Types.GameObjects.Text.TextStyle = {}): Phaser.Types.GameObjects.Text.TextStyle {
  const shadow = size >= 16 ? 2 : 1;
  return {
    fontFamily: FONT,
    fontSize: `${size}px`,
    color,
    shadow: { offsetX: shadow, offsetY: shadow, color: COLORS.shadow, fill: true },
    ...extra,
  };
}
