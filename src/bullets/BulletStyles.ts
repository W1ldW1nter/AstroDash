/**
 * Bullet styles = frames in the `bullets` atlas: `${colour}_${shape}_${size}`.
 * Collision radii are deliberately smaller than the art (bullet-hell standard):
 * touching a bullet's glow is not a hit, only its core.
 */

export const BULLET_COLOURS = ['blue', 'green', 'red', 'yellow', 'pink', 'white'] as const;
export type BulletColour = (typeof BULLET_COLOURS)[number];
export type BulletShape = 'orb' | 'capsule' | 'dart';
export type BulletSize = 's' | 'm' | 'l';
export type BulletStyle = `${BulletColour}_${BulletShape}_${BulletSize}`;

/** Collision radius in px, by shape and size. Art sizes: orb 10/14/16, capsule 4-8 wide, dart 7 wide. */
const RADIUS: Record<BulletShape, Record<BulletSize, number>> = {
  orb: { s: 3, m: 4.5, l: 5.5 },
  capsule: { s: 1.5, m: 2.5, l: 3 },
  dart: { s: 2, m: 2.5, l: 3 },
};

export interface StyleInfo {
  frame: BulletStyle;
  radius: number;
  /** Elongated bullets turn to face their direction of travel; orbs don't need to. */
  rotates: boolean;
}

const cache = new Map<BulletStyle, StyleInfo>();

export function styleInfo(style: BulletStyle): StyleInfo {
  let info = cache.get(style);
  if (!info) {
    const [, shape, size] = style.split('_') as [BulletColour, BulletShape, BulletSize];
    info = { frame: style, radius: RADIUS[shape][size], rotates: shape !== 'orb' };
    cache.set(style, info);
  }
  return info;
}
