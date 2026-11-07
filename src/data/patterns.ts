import type { PatternDef } from '../bullets/Pattern';

/**
 * Example attacks, as data. Enemies (Milestone 3) and bosses (Milestone 5)
 * will pick from and extend this library. Speeds are px/sec in the 504x672 world.
 */
export interface Attack {
  name: string;
  patterns: PatternDef[];
}

export const ATTACKS: Attack[] = [
  {
    name: 'Aimed burst',
    patterns: [{ style: 'pink_orb_m', shape: 'fan', count: 5, spread: 24, aim: 'player', speed: 260, volleys: 5, interval: 110 }],
  },
  {
    name: 'Ring',
    patterns: [{ style: 'red_orb_l', shape: 'ring', count: 24, speed: 150, volleys: 4, interval: 500, turnPerVolley: 7.5 }],
  },
  {
    name: 'Spiral',
    patterns: [{ style: 'pink_orb_s', shape: 'ring', count: 4, speed: 190, volleys: 80, interval: 50, turnPerVolley: 9 }],
  },
  {
    name: 'Twin spiral',
    patterns: [
      { style: 'pink_orb_s', shape: 'ring', count: 3, speed: 170, volleys: 90, interval: 45, turnPerVolley: 11 },
      { style: 'white_orb_s', shape: 'ring', count: 3, speed: 170, volleys: 90, interval: 45, turnPerVolley: -11 },
    ],
  },
  {
    name: 'Flower',
    patterns: [{ style: 'white_orb_m', shape: 'ring', count: 18, speed: 120, angularVelocity: 40, volleys: 6, interval: 400, turnPerVolley: 10 }],
  },
  {
    name: 'Rain',
    patterns: [{ style: 'red_dart_m', shape: 'random', count: 2, aim: 90, spread: 140, speed: [140, 280], volleys: 60, interval: 60 }],
  },
  {
    name: 'Accelerating ring',
    patterns: [{ style: 'yellow_orb_m', shape: 'ring', count: 32, speed: 30, accel: 170, maxSpeed: 320, volleys: 3, interval: 700, turnPerVolley: 5.6 }],
  },
  {
    name: 'Wall',
    patterns: [
      { style: 'pink_capsule_m', shape: 'fan', count: 9, spread: 70, aim: 'player', layers: 4, layerSpeedStep: 35, speed: 140, volleys: 3, interval: 650 },
    ],
  },
];

/** Used by the Bullet Lab stress test: dense spirals from several sources at once. */
export const STRESS_PATTERN: PatternDef = {
  style: 'pink_orb_s',
  shape: 'ring',
  count: 8,
  speed: 140,
  volleys: 0,
  interval: 60,
  turnPerVolley: 7,
};
