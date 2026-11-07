/**
 * Player ship classes. Pure data: tune numbers here, not in Player.ts.
 * Coordinates are pixels relative to the ship sprite's center (+y = down).
 * Speeds are px/sec in the 504x672 world (crossing the screen takes ~1.6s at full speed).
 */

export const SKINS = ['silver', 'green', 'blue', 'orange', 'dark', 'red'] as const;
export type Skin = (typeof SKINS)[number];

export interface ShotDef {
  /** Muzzle offset from ship center. */
  x: number;
  y: number;
  /** Degrees from straight up; negative = left. */
  angle: number;
}

export interface ExhaustDef {
  x: number;
  y: number;
  /** 'twin' = small 8-frame flame (fighter nozzles), 'main' = large flame. */
  kind: 'twin' | 'main';
  /** Flip the flame upside down (the small flame art points the wrong way for our nozzles). */
  flipY?: boolean;
}

export interface ShipClass {
  id: 'fighter' | 'gunship';
  name: string;
  /** Atlas frame = `${frame}_${skin}` in the `player` atlas. */
  frame: string;
  /** px/sec */
  speed: number;
  focusSpeed: number;
  /** Collision circle, much smaller than the sprite (bullet-hell standard). */
  hitboxRadius: number;
  hitboxOffsetY: number;
  /** ms between volleys */
  fireInterval: number;
  bulletSpeed: number;
  bulletDamage: number;
  /** Visual and hit-circle scale of the shots. */
  bulletScale: number;
  bulletFrame: string;
  shots: ShotDef[];
  /** Volley used while focusing (holding Shift). */
  focusShots: ShotDef[];
  exhaust: ExhaustDef[];
  /** Hits that cost a life before game over. */
  lives: number;
  /** Regenerating shield that absorbs one hit; null = no shield. */
  shield: { rechargeMs: number } | null;
}

export const SHIP_CLASSES: Record<ShipClass['id'], ShipClass> = {
  // Fast, narrow twin stream. Three lives plus a shield that absorbs a hit and recharges.
  fighter: {
    id: 'fighter',
    name: 'Fighter',
    frame: 'fighter',
    speed: 320,
    focusSpeed: 135,
    hitboxRadius: 2.5,
    hitboxOffsetY: 1,
    fireInterval: 60,
    bulletSpeed: 900,
    bulletDamage: 1, // 1 bullet = 1 hit (enemy HP is counted in Fighter bullets)
    bulletScale: 1,
    lives: 3,
    shield: { rechargeMs: 5000 },
    bulletFrame: 'blue_capsule_l',
    shots: [
      { x: -6, y: -14, angle: 0 },
      { x: 6, y: -14, angle: 0 },
    ],
    focusShots: [
      { x: -3, y: -16, angle: 0 },
      { x: 3, y: -16, angle: 0 },
    ],
    exhaust: [
      { x: -4.5, y: 24, kind: 'twin', flipY: true },
      { x: 6.5, y: 24, kind: 'twin', flipY: true },
    ],
  },

  // Slower, wide 5-way spread. Covers the screen. Five lives, no shield.
  gunship: {
    id: 'gunship',
    name: 'Gunship',
    frame: 'gunship',
    speed: 196, // -20% (was 245)
    focusSpeed: 88, // -20% (was 110)
    hitboxRadius: 3,
    hitboxOffsetY: 0,
    fireInterval: 190, // half the fire rate (was 95ms)
    bulletSpeed: 532, // -30% (was 760)
    bulletDamage: 1.2,
    bulletScale: 1.2, // 20% bigger shots (also a 20% bigger hit circle)
    lives: 5,
    shield: null,
    bulletFrame: 'yellow_dart_m',
    shots: [
      { x: -12, y: -6, angle: -16 },
      { x: -6, y: -12, angle: -8 },
      { x: 0, y: -18, angle: 0 },
      { x: 6, y: -12, angle: 8 },
      { x: 12, y: -6, angle: 16 },
    ],
    focusShots: [
      { x: -8, y: -8, angle: -5 },
      { x: -4, y: -14, angle: -2.5 },
      { x: 0, y: -18, angle: 0 },
      { x: 4, y: -14, angle: 2.5 },
      { x: 8, y: -8, angle: 5 },
    ],
    exhaust: [{ x: 0, y: 28, kind: 'main' }],
  },
};
