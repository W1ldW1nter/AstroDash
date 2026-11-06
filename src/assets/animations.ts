import Phaser from 'phaser';
import type { AtlasKey } from './manifest';

interface AnimDef {
  key: string;
  atlas: AtlasKey;
  /** Frames are `${prefix}0` .. `${prefix}${count - 1}` */
  prefix: string;
  count: number;
  frameRate: number;
  repeat: number; // -1 = loop forever
  yoyo?: boolean;
}

const LOOP = -1;
const ONCE = 0;

export const ANIMS: AnimDef[] = [
  // Engine exhaust
  { key: 'exhaust_red_l', atlas: 'exhaust', prefix: 'red_l_', count: 4, frameRate: 14, repeat: LOOP },
  { key: 'exhaust_red_m', atlas: 'exhaust', prefix: 'red_m_', count: 4, frameRate: 14, repeat: LOOP },
  { key: 'exhaust_red_s', atlas: 'exhaust', prefix: 'red_s_', count: 8, frameRate: 16, repeat: LOOP },
  { key: 'exhaust_blue_l', atlas: 'exhaust', prefix: 'blue_l_', count: 4, frameRate: 14, repeat: LOOP },
  { key: 'boss_flame', atlas: 'boss', prefix: 'flame_', count: 4, frameRate: 12, repeat: LOOP },

  // Explosions
  ...(['orange', 'teal', 'pink', 'red'] as const).map((c) => ({
    key: `explosion_${c}`, atlas: 'explosion' as const, prefix: `${c}_`, count: 7, frameRate: 16, repeat: ONCE,
  })),

  // Pickups (pulse)
  ...(['health', 'shield', 'bomb', 'rapid', 'double'] as const).map((t) => ({
    key: `bonus_${t}`, atlas: 'bonuses' as const, prefix: `${t}_`, count: 5, frameRate: 10, repeat: LOOP, yoyo: true,
  })),

  // Mines (blink)
  ...(['red_s', 'red_l', 'orange_s', 'orange_l', 'pink_s', 'pink_l'] as const).map((m) => ({
    key: `mine_${m}`, atlas: 'mine' as const, prefix: `${m}_`, count: 4, frameRate: 8, repeat: LOOP,
  })),

  // Laser beam pieces
  { key: 'beam_charge', atlas: 'bullets', prefix: 'beam_charge_', count: 3, frameRate: 12, repeat: LOOP },
  { key: 'beam_head', atlas: 'bullets', prefix: 'beam_head_', count: 3, frameRate: 12, repeat: LOOP },
  { key: 'beam_body', atlas: 'bullets', prefix: 'beam_body_', count: 3, frameRate: 12, repeat: LOOP },
];

export function registerAnimations(anims: Phaser.Animations.AnimationManager): void {
  for (const a of ANIMS) {
    if (anims.exists(a.key)) continue;
    anims.create({
      key: a.key,
      frames: anims.generateFrameNames(a.atlas, { prefix: a.prefix, start: 0, end: a.count - 1 }),
      frameRate: a.frameRate,
      repeat: a.repeat,
      yoyo: a.yoyo ?? false,
    });
  }
}
