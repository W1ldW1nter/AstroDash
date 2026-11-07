/**
 * Wave rules and the difficulty curve, as data. Tuned for a FAST ramp
 * (a typical run lasts ~5 minutes).
 *
 *   wave 1  normal        wave 2  miniboss      wave 3  normal
 *   wave 4  miniboss      wave 5  normal        wave 6  BOSS -> pick 1 of 3 upgrades
 *   ...repeats, getting harder every wave.
 */

export type WaveKind = 'normal' | 'miniboss' | 'boss';

export function waveKind(wave: number): WaveKind {
  if (wave % 6 === 0) return 'boss';
  if (wave % 2 === 0) return 'miniboss';
  return 'normal';
}

/** How long a wave keeps spawning its scheduled formations (ms). */
export const SPAWN_WINDOW_MS = 20000;
/** Pause between the end of one wave and the next banner (ms). */
export const WAVE_GAP_MS = 1500;
/** How long the wave banner shows before spawning starts (ms). */
export const WAVE_INTRO_MS = 1800;
/** After its spawns finish, a wave ends once the screen is clear, or after this long (ms). */
export const WAVE_CLEAR_TIMEOUT_MS = 6000;
/** When the miniboss / boss arrives, measured from the start of the wave (ms). */
export const MINIBOSS_ARRIVAL_MS = 4000;
export const BOSS_ARRIVAL_MS = 2500;
/** While a miniboss or boss is alive, regular enemies spawn at this rate (0.7 = 30% fewer). */
export const BIG_ENEMY_SPAWN_RATE = 0.7;
/** Once scheduled spawns run out but a miniboss/boss is still alive, small filler groups keep coming this often (ms, before the rate above). */
export const FILLER_INTERVAL_MS = 2600;

/** Formation "points" to spend per wave. Grows fast: wave 1 = 28, wave 6 = 88, wave 12 = 160. */
export function waveBudget(wave: number): number {
  return 28 + 12 * (wave - 1);
}

/** Live difficulty multipliers, read by enemies as they shoot. Enemy HP never scales. */
export interface Difficulty {
  /** Multiplies enemy bullet speed. */
  bulletSpeed: number;
  /** Multiplies how often enemies attack (divides their cooldowns). */
  fireRate: number;
  /** Chance that a small (fodder) enemy shoots at all. */
  fodderFireChance: number;
}

export function difficultyFor(wave: number): Difficulty {
  const w = wave - 1;
  return {
    bulletSpeed: Math.min(1.8, 1 + 0.06 * w),
    fireRate: Math.min(2.2, 1 + 0.08 * w),
    fodderFireChance: Math.min(0.85, 0.3 + 0.05 * w),
  };
}
