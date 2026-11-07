import type { PatternDef } from '../bullets/Pattern';
import type { BulletColour } from '../bullets/BulletStyles';

/**
 * The boss: one design, re-fought every 6th wave. Each cycle uses the next
 * colour and harder attacks (more bullets, shorter gaps), on top of the
 * normal per-wave difficulty ramp.
 *
 *   cycle 0 (wave 6)  red     cycle 1 (wave 12) orange    cycle 2 (wave 18) pink
 *   cycle 3+          colours repeat, still getting harder ("MK II", "MK III", ...)
 *
 * Three phases: 100-66% HP, 66-33%, 33-0%. The last phase uses the dark sprite.
 */

export interface BossLook {
  name: string;
  /** Frame prefix in the `boss` atlas: `red`, `red_dark`, ... */
  frame: 'red' | 'orange' | 'pink';
  /** Main bullet colour; white is used as the accent. */
  bullet: BulletColour;
  explosion: 'red' | 'orange' | 'pink';
}

export const BOSS_LOOKS: BossLook[] = [
  { name: 'CRIMSON WARDEN', frame: 'red', bullet: 'red', explosion: 'red' },
  { name: 'SOLAR WARDEN', frame: 'orange', bullet: 'yellow', explosion: 'orange' },
  { name: 'NEON WARDEN', frame: 'pink', bullet: 'pink', explosion: 'pink' },
];

/** HP thresholds (fraction of max) where phases 2 and 3 begin. */
export const PHASE_THRESHOLDS = [2 / 3, 1 / 3];
/** Invulnerable pause when switching phase (ms). Also clears all enemy bullets. */
export const PHASE_TRANSITION_MS = 1600;

export function bossHp(cycle: number): number {
  return 600 + 300 * cycle;
}

export function bossLook(cycle: number): BossLook & { title: string } {
  const look = BOSS_LOOKS[cycle % BOSS_LOOKS.length];
  const mark = Math.floor(cycle / BOSS_LOOKS.length);
  return { ...look, title: mark ? `${look.name} MK ${'I'.repeat(mark + 1)}` : look.name };
}

export interface BossPhase {
  /** Side-to-side sway in px and how long one sway takes (ms). */
  drift: number;
  driftPeriod: number;
  cooldown: number;
  attacks: PatternDef[][];
}

/** The three phases, built for a bullet colour `c`. */
function basePhases(c: BulletColour): BossPhase[] {
  return [
    // Phase 1: readable openers.
    {
      drift: 120,
      driftPeriod: 2400,
      cooldown: 900,
      attacks: [
        [{ style: `${c}_orb_m`, shape: 'ring', count: 20, speed: 140, volleys: 4, interval: 450, turnPerVolley: 9, offset: 30 }],
        [{ style: `${c}_capsule_m`, shape: 'fan', count: 7, spread: 50, aim: 'player', speed: 230, volleys: 5, interval: 200, offset: 40 }],
        [
          { style: `white_orb_s`, shape: 'random', count: 3, aim: 90, spread: 150, speed: [120, 220], volleys: 25, interval: 80, offset: 30 },
          { style: `${c}_orb_l`, shape: 'fan', count: 3, spread: 30, aim: 'player', speed: 170, volleys: 3, interval: 600, offset: 30 },
        ],
      ],
    },
    // Phase 2: spirals and curving bullets.
    {
      drift: 150,
      driftPeriod: 2000,
      cooldown: 700,
      attacks: [
        [
          { style: `${c}_orb_s`, shape: 'ring', count: 4, speed: 160, volleys: 60, interval: 50, turnPerVolley: 10, offset: 30 },
          { style: 'white_orb_s', shape: 'ring', count: 4, speed: 160, volleys: 60, interval: 50, turnPerVolley: -10, offset: 30 },
        ],
        [
          { style: `${c}_orb_m`, shape: 'ring', count: 16, speed: 120, angularVelocity: 45, volleys: 5, interval: 380, offset: 30 },
          { style: 'white_orb_m', shape: 'ring', count: 16, speed: 120, angularVelocity: -45, volleys: 5, interval: 380, delay: 190, offset: 30 },
        ],
        [{ style: `${c}_capsule_m`, shape: 'fan', count: 9, spread: 90, aim: 'player', layers: 3, layerSpeedStep: 40, speed: 150, volleys: 4, interval: 550, offset: 40 }],
      ],
    },
    // Phase 3 (dark sprite): everything at once, faster sway.
    {
      drift: 170,
      driftPeriod: 1500,
      cooldown: 500,
      attacks: [
        [
          { style: `${c}_orb_s`, shape: 'ring', count: 6, speed: 170, volleys: 70, interval: 45, turnPerVolley: 7, offset: 30 },
          { style: `${c}_dart_m`, shape: 'fan', count: 3, spread: 20, aim: 'player', speed: 260, volleys: 8, interval: 400, offset: 40 },
        ],
        [{ style: `${c}_orb_l`, shape: 'ring', count: 30, speed: 30, accel: 170, maxSpeed: 300, volleys: 5, interval: 380, turnPerVolley: 6, offset: 30 }],
        [
          { style: 'white_orb_s', shape: 'random', count: 4, aim: 90, spread: 170, speed: [130, 260], volleys: 40, interval: 60, offset: 30 },
          { style: `${c}_orb_m`, shape: 'ring', count: 18, speed: 130, volleys: 4, interval: 600, turnPerVolley: 10, offset: 30 },
        ],
      ],
    },
  ];
}

/** Each cycle: +25% bullets per volley, 10% shorter gaps (min 60%), shorter cooldowns. */
function intensify(p: PatternDef, cycle: number): PatternDef {
  if (cycle === 0) return p;
  const countScale = 1 + 0.25 * cycle;
  const timeScale = Math.max(0.6, 1 - 0.1 * cycle);
  return {
    ...p,
    count: p.shape === 'random' ? p.count + cycle : Math.round(p.count * countScale),
    interval: p.interval * timeScale,
    spread: p.spread !== undefined && p.shape === 'fan' ? p.spread * Math.min(1.5, 1 + 0.1 * cycle) : p.spread,
  };
}

export function bossPhases(cycle: number): BossPhase[] {
  const look = bossLook(cycle);
  return basePhases(look.bullet).map((ph) => ({
    ...ph,
    cooldown: ph.cooldown * Math.max(0.6, 1 - 0.1 * cycle),
    attacks: ph.attacks.map((attack) => attack.map((p) => intensify(p, cycle))),
  }));
}
