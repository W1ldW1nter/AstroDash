import type { PatternDef } from '../bullets/Pattern';

/**
 * Enemy archetypes, as data. HP is counted in player bullets (both ships deal
 * 1 damage per bullet). Art sizes: small 21x17, medium 32x20, large 45x36, heavy 47x53.
 */

export type EnemyId = 'small' | 'medium' | 'large' | 'heavy' | 'boss';
export type EnemyVariant = 'a' | 'b' | 'c';

/** How an enemy moves. Coordinates in the 504x672 world; times in ms. */
export type Movement =
  /** Constant velocity (px/sec). */
  | { kind: 'straight'; vx: number; vy: number }
  /** Fly down while weaving side to side. */
  | { kind: 'sine'; vy: number; amplitude: number; period: number }
  /** Follow a cubic Bézier curve from p0 to p3 over `duration`, then keep going. */
  | { kind: 'path'; points: [number, number][]; duration: number }
  /** Fly in to `y`, hover drifting sideways for `holdMs` (0 = until killed), then leave downward. */
  | { kind: 'hold'; y: number; enterSpeed: number; holdMs: number; drift: number; exitSpeed: number };

export interface EnemyType {
  id: EnemyId;
  /** Texture atlas (default `enemy`). */
  atlas?: string;
  /** Fixed atlas frame; default is `${id}_${variant}`. */
  frame?: string;
  hp: number;
  /** Circle hit by player bullets. */
  radius: number;
  /** Smaller circle that hurts the player on contact. */
  contactRadius: number;
  score: number;
  /** Attacks fired in rotation. Each attack runs to completion, then `cooldown` passes. */
  attacks: PatternDef[][];
  firstAttackDelay: [number, number];
  cooldown: number;
  /** Chance (0-1) that a given enemy fires at all. Lets fodder be mostly harmless. */
  fireChance: number;
  explosion: 'orange' | 'teal' | 'pink' | 'red';
  /** Extra staggered explosions on death (big enemies). */
  extraExplosions: number;
  healthBar: boolean;
}

export const ENEMY_TYPES: Record<EnemyId, EnemyType> = {
  // Fodder: dies to one bullet, most common, occasionally takes a single aimed shot.
  small: {
    id: 'small',
    hp: 1,
    radius: 10,
    contactRadius: 6,
    score: 100,
    attacks: [[{ style: 'pink_orb_s', shape: 'fan', count: 1, aim: 'player', speed: 200, volleys: 1, interval: 0 }]],
    firstAttackDelay: [500, 1500],
    cooldown: 99999,
    fireChance: 0.35,
    explosion: 'orange',
    extraExplosions: 0,
    healthBar: false,
  },

  // 3 bullets. Short aimed fans.
  medium: {
    id: 'medium',
    hp: 3,
    radius: 14,
    contactRadius: 8,
    score: 300,
    attacks: [[{ style: 'pink_orb_m', shape: 'fan', count: 3, spread: 30, aim: 'player', speed: 190, volleys: 2, interval: 220 }]],
    firstAttackDelay: [400, 1000],
    cooldown: 1600,
    fireChance: 1,
    explosion: 'orange',
    extraExplosions: 0,
    healthBar: false,
  },

  // 15 bullets. Hovers and fires rings, alternating with aimed bursts.
  large: {
    id: 'large',
    hp: 15,
    radius: 20,
    contactRadius: 12,
    score: 1000,
    attacks: [
      [{ style: 'red_orb_m', shape: 'ring', count: 14, speed: 130, volleys: 3, interval: 260, turnPerVolley: 12 }],
      [{ style: 'red_capsule_m', shape: 'fan', count: 5, spread: 40, aim: 'player', speed: 230, volleys: 3, interval: 140 }],
    ],
    firstAttackDelay: [600, 900],
    cooldown: 1100,
    fireChance: 1,
    explosion: 'red',
    extraExplosions: 2,
    healthBar: false,
  },

  // Miniboss: 150 bullets, health bar, cycles through three attacks.
  heavy: {
    id: 'heavy',
    hp: 150,
    radius: 24,
    contactRadius: 16,
    score: 5000,
    attacks: [
      [
        { style: 'pink_orb_s', shape: 'ring', count: 3, speed: 150, volleys: 40, interval: 60, turnPerVolley: 13 },
        { style: 'white_orb_s', shape: 'ring', count: 3, speed: 150, volleys: 40, interval: 60, turnPerVolley: -13 },
      ],
      [{ style: 'pink_capsule_m', shape: 'fan', count: 9, spread: 80, aim: 'player', layers: 3, layerSpeedStep: 40, speed: 150, volleys: 3, interval: 600 }],
      [{ style: 'red_orb_l', shape: 'ring', count: 20, speed: 40, accel: 150, maxSpeed: 260, volleys: 4, interval: 500, turnPerVolley: 9 }],
    ],
    firstAttackDelay: [900, 900],
    cooldown: 1200,
    fireChance: 1,
    explosion: 'pink',
    extraExplosions: 6,
    healthBar: true,
  },

  // The boss (every 6th wave). HP, phases and attacks come from src/data/bosses.ts;
  // these are the shared basics. 106x106 sprite.
  boss: {
    id: 'boss',
    atlas: 'boss',
    frame: 'red',
    hp: 600,
    radius: 44,
    contactRadius: 34,
    score: 20000,
    attacks: [],
    firstAttackDelay: [1200, 1200],
    cooldown: 700,
    fireChance: 1,
    explosion: 'red',
    extraExplosions: 18,
    healthBar: false, // bosses draw their own full-width bar
  },
};
