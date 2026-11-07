/**
 * Internal (logical) resolution. Everything is drawn at this size, then scaled up.
 * 504x672 (3:4) keeps sprites at 1:1 pixels while leaving enough room to dodge:
 * it was raised from 360x480, where the ships felt too big for the play area.
 */
export const GAME_WIDTH = 504;
export const GAME_HEIGHT = 672;

export const SCENES = {
  Boot: 'Boot',
  Preload: 'Preload',
  Title: 'Title',
  ShipSelect: 'ShipSelect',
  Game: 'Game',
  BulletLab: 'BulletLab',
  SpriteViewer: 'SpriteViewer',
} as const;

/**
 * Scale factor for the canvas: whole-number zoom when the window is at least 2x
 * the game size (crisp, even pixels), otherwise fractional so the game isn't
 * tiny on small/1080p windows.
 */
export function fitZoom(): number {
  const ratio = Math.min(window.innerWidth / GAME_WIDTH, window.innerHeight / GAME_HEIGHT);
  if (ratio >= 2) return Math.floor(ratio);
  return Math.max(0.5, ratio);
}
