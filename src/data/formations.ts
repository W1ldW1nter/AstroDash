import Phaser from 'phaser';
import { GAME_WIDTH } from '../config';
import type { EnemyId, EnemyVariant, Movement } from './enemies';

/** What a formation can do: spawn enemies now or after a delay. */
export interface SpawnApi {
  spawn(id: EnemyId, variant: EnemyVariant, x: number, y: number, movement: Movement): void;
  later(ms: number, fn: () => void): void;
  variant(): EnemyVariant;
}

/**
 * A reusable group of enemies. The wave director spends each wave's budget on
 * these, weighted so small fodder is by far the most common.
 */
export interface Formation {
  id: string;
  /** Budget points. Roughly: small 1, medium 3, large 8. */
  cost: number;
  /** Relative pick chance. */
  weight: number;
  /** First wave this can appear in. */
  minWave: number;
  /** Small-only formations can be used as filler while a miniboss/boss is alive. */
  filler?: boolean;
  run(api: SpawnApi): void;
}

const W = GAME_WIDTH;
const rnd = Phaser.Math.Between;

function swoop(api: SpawnApi, fromLeft: boolean, count: number, v: EnemyVariant): void {
  const m = (x: number) => (fromLeft ? x : W - x);
  const points: [number, number][] = [
    [m(-20), 60],
    [m(220), 60],
    [m(340), 320],
    [m(W + 60), 380],
  ];
  for (let i = 0; i < count; i++) api.later(i * 220, () => api.spawn('small', v, points[0][0], points[0][1], { kind: 'path', points, duration: 3200 }));
}

export const FORMATIONS: Formation[] = [
  {
    id: 'small-column',
    cost: 4,
    weight: 10,
    minWave: 1,
    filler: true,
    run(api) {
      const v = api.variant();
      const x = rnd(60, W - 60);
      for (let i = 0; i < 4; i++) api.later(i * 170, () => api.spawn('small', v, x, -20, { kind: 'straight', vx: 0, vy: 160 }));
    },
  },
  {
    id: 'small-sine-pair',
    cost: 2,
    weight: 6,
    minWave: 1,
    filler: true,
    run(api) {
      const v = api.variant();
      const x = rnd(80, W / 2 - 40);
      for (const sx of [x, W - x]) api.spawn('small', v, sx, -20, { kind: 'sine', vy: 110, amplitude: 60, period: 2200 });
    },
  },
  {
    id: 'small-swoop',
    cost: 5,
    weight: 8,
    minWave: 1,
    run(api) {
      swoop(api, Math.random() < 0.5, 5, api.variant());
    },
  },
  {
    id: 'small-vee',
    cost: 5,
    weight: 8,
    minWave: 1,
    filler: true,
    run(api) {
      const v = api.variant();
      const cx = rnd(100, W - 100);
      [0, -1, 1, -2, 2].forEach((o) => api.spawn('small', v, cx + o * 26, -20 - Math.abs(o) * 22, { kind: 'straight', vx: 0, vy: 130 }));
    },
  },
  {
    id: 'small-double-swoop',
    cost: 8,
    weight: 5,
    minWave: 3,
    run(api) {
      const v = api.variant();
      swoop(api, true, 4, v);
      swoop(api, false, 4, v);
    },
  },
  {
    id: 'medium',
    cost: 3,
    weight: 5,
    minWave: 1,
    run(api) {
      api.spawn('medium', api.variant(), rnd(70, W - 70), -24, { kind: 'sine', vy: 65, amplitude: 40, period: 3000 });
    },
  },
  {
    id: 'medium-trio',
    cost: 9,
    weight: 3,
    minWave: 3,
    run(api) {
      const v = api.variant();
      const cx = rnd(120, W - 120);
      [-60, 0, 60].forEach((o, i) => api.later(i * 250, () => api.spawn('medium', v, cx + o, -24, { kind: 'straight', vx: 0, vy: 75 })));
    },
  },
  {
    id: 'large',
    cost: 8,
    weight: 3,
    minWave: 2,
    run(api) {
      api.spawn('large', api.variant(), rnd(110, W - 110), -30, { kind: 'hold', y: rnd(110, 200), enterSpeed: 140, holdMs: 9000, drift: 50, exitSpeed: 70 });
    },
  },
  {
    id: 'large-pair',
    cost: 16,
    weight: 2,
    minWave: 5,
    run(api) {
      const v = api.variant();
      for (const x of [130, W - 130]) api.spawn('large', v, x, -30, { kind: 'hold', y: rnd(120, 180), enterSpeed: 140, holdMs: 8000, drift: 40, exitSpeed: 70 });
    },
  },
];
