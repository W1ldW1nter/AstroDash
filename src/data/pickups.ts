import type { EnemyId } from './enemies';

/**
 * Pickups dropped by enemies: heals and temporary boosts only.
 * (Permanent upgrades are the boss reward, see upgrades.ts.)
 */
export type PickupId = 'health' | 'shield' | 'bomb' | 'rapid' | 'double';

export interface PickupDef {
  id: PickupId;
  name: string;
  /** Relative drop weight. */
  weight: number;
}

export const PICKUPS: Record<PickupId, PickupDef> = {
  health: { id: 'health', name: '+1 LIFE', weight: 12 },
  shield: { id: 'shield', name: 'BARRIER', weight: 16 },
  bomb: { id: 'bomb', name: '+1 BOMB', weight: 16 },
  rapid: { id: 'rapid', name: 'RAPID FIRE', weight: 30 },
  double: { id: 'double', name: '2X SCORE', weight: 26 },
};

/** Temporary boost durations (ms). */
export const RAPID_FIRE_MS = 8000;
/** Fire interval is divided by this while Rapid Fire is active. */
export const RAPID_FIRE_FACTOR = 1.6;
export const DOUBLE_SCORE_MS = 10000;
/** Barrier: a bubble that absorbs the next hit, or fades after this long. */
export const BARRIER_MS = 10000;

/** Bombs: start with this many, pickups add one, never more than the max. Respawning tops up to the start amount. */
export const START_BOMBS = 2;
export const MAX_BOMBS = 5;

/** Chance that an enemy drops something, and how many pickups big enemies drop. */
export const DROPS: Record<EnemyId, { chance: number; count: number }> = {
  small: { chance: 0.025, count: 1 },
  medium: { chance: 0.1, count: 1 },
  large: { chance: 0.35, count: 1 },
  heavy: { chance: 1, count: 2 },
  boss: { chance: 1, count: 3 },
};

/** Pickups drift down at this speed (px/sec), and fly to the player when within the magnet radius. */
export const PICKUP_FALL_SPEED = 55;
export const PICKUP_MAGNET_RADIUS = 80;
export const PICKUP_COLLECT_RADIUS = 20;
