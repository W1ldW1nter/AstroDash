import { audio } from './engine';

/**
 * Generated retro sound effects. `sfx('name')` plays one; each effect has a
 * minimum gap so a burst of events (a bomb killing ten enemies, a rain of grazes)
 * doesn't stack into a wall of noise.
 */

interface SfxDef {
  /** Minimum seconds between two plays of this effect. */
  gap: number;
  play: () => void;
}

const a = audio;

const SFX = {
  // ---------------------------------------------------------- player
  shoot: { gap: 0.045, play: () => a.tone({ wave: 'pulse25', freq: 1250, to: 520, dur: 0.05, vol: 0.11 }) },
  shootHeavy: {
    gap: 0.08,
    play: () => {
      a.tone({ wave: 'square', freq: 420, to: 160, dur: 0.09, vol: 0.12 });
      a.noise({ dur: 0.05, vol: 0.12, filter: 'highpass', freq: 3000 });
    },
  },
  shieldBreak: {
    gap: 0.1,
    play: () => {
      a.tone({ wave: 'triangle', freq: 1400, to: 300, dur: 0.25, vol: 0.35 });
      a.tone({ wave: 'pulse25', freq: 2100, to: 700, dur: 0.18, vol: 0.12 });
      a.noise({ dur: 0.2, vol: 0.25, filter: 'highpass', freq: 2500 });
    },
  },
  playerDeath: {
    gap: 0.2,
    play: () => {
      a.tone({ wave: 'square', freq: 700, to: 50, dur: 0.7, vol: 0.22 });
      a.tone({ wave: 'sine', freq: 140, to: 30, dur: 0.6, vol: 0.5 });
      a.noise({ dur: 0.9, vol: 0.5, filter: 'lowpass', freq: 3000, to: 120 });
    },
  },
  graze: { gap: 0.05, play: () => a.tone({ wave: 'sine', freq: 2600, to: 3100, dur: 0.035, vol: 0.12 }) },
  bomb: {
    gap: 0.2,
    play: () => {
      a.noise({ dur: 1.4, vol: 0.7, filter: 'lowpass', freq: 5000, to: 80 });
      a.tone({ wave: 'sine', freq: 220, to: 28, dur: 1.1, vol: 0.6 });
      a.tone({ wave: 'sawtooth', freq: 880, to: 60, dur: 0.5, vol: 0.12 });
    },
  },

  // --------------------------------------------------------- enemies
  hit: {
    gap: 0.035,
    play: () => {
      a.noise({ dur: 0.04, vol: 0.4, filter: 'bandpass', freq: 3000, q: 0.8 });
      a.tone({ wave: 'square', freq: 900, to: 500, dur: 0.03, vol: 0.05 });
    },
  },
  explodeS: {
    gap: 0.04,
    play: () => {
      a.noise({ dur: 0.28, vol: 0.6, filter: 'lowpass', freq: 3500, to: 200 });
      a.tone({ wave: 'square', freq: 260, to: 60, dur: 0.15, vol: 0.12 });
    },
  },
  explodeM: {
    gap: 0.06,
    play: () => {
      a.noise({ dur: 0.5, vol: 0.5, filter: 'lowpass', freq: 2500, to: 100 });
      a.tone({ wave: 'sine', freq: 160, to: 40, dur: 0.35, vol: 0.4 });
    },
  },
  explodeL: {
    gap: 0.1,
    play: () => {
      a.noise({ dur: 1.0, vol: 0.7, filter: 'lowpass', freq: 2000, to: 60 });
      a.tone({ wave: 'sine', freq: 120, to: 25, dur: 0.9, vol: 0.6 });
      a.tone({ wave: 'square', freq: 300, to: 40, dur: 0.4, vol: 0.1 });
    },
  },
  explodeBoss: {
    gap: 0.5,
    play: () => {
      // A long rumble with several blasts on top.
      a.noise({ dur: 2.6, vol: 0.8, filter: 'lowpass', freq: 1800, to: 50 });
      a.tone({ wave: 'sine', freq: 100, to: 20, dur: 2.4, vol: 0.7 });
      for (let i = 0; i < 6; i++) a.noise({ at: 0.18 * i + Math.random() * 0.08, dur: 0.4, vol: 0.45, filter: 'lowpass', freq: 3000, to: 150 });
    },
  },
  warning: {
    gap: 1,
    play: () => {
      for (let i = 0; i < 3; i++) {
        a.tone({ at: i * 0.32, wave: 'sawtooth', freq: 660, dur: 0.15, vol: 0.12, env: 'hold' });
        a.tone({ at: i * 0.32 + 0.15, wave: 'sawtooth', freq: 440, dur: 0.15, vol: 0.12, env: 'hold' });
      }
    },
  },
  phase: {
    gap: 0.5,
    play: () => {
      a.tone({ wave: 'sawtooth', freq: 90, to: 600, dur: 0.6, vol: 0.14 });
      a.noise({ dur: 0.7, vol: 0.3, filter: 'bandpass', freq: 400, to: 3000, q: 3 });
    },
  },

  // --------------------------------------------------------- pickups
  pickup: {
    gap: 0.05,
    play: () => {
      a.tone({ wave: 'pulse25', freq: 988, dur: 0.06, vol: 0.24, env: 'hold' });
      a.tone({ at: 0.06, wave: 'pulse25', freq: 1319, dur: 0.14, vol: 0.24 });
    },
  },
  powerup: {
    gap: 0.05,
    play: () => [523, 659, 784, 1047, 1319].forEach((f, i) => a.tone({ at: i * 0.045, wave: 'pulse25', freq: f, dur: 0.09, vol: 0.22 })),
  },
  life: {
    gap: 0.1,
    play: () =>
      [523, 659, 784, 1047, 784, 1047].forEach((f, i) => a.tone({ at: i * 0.07, wave: 'square', freq: f, dur: 0.1, vol: 0.1, env: 'hold' })),
  },

  // ------------------------------------------------------ waves & ui
  wave: {
    gap: 0.3,
    play: () => {
      a.tone({ wave: 'pulse25', freq: 440, dur: 0.08, vol: 0.1, env: 'hold' });
      a.tone({ at: 0.1, wave: 'pulse25', freq: 880, dur: 0.14, vol: 0.1, env: 'hold' });
    },
  },
  waveClear: {
    gap: 0.3,
    play: () => [659, 784, 988, 1319].forEach((f, i) => a.tone({ at: i * 0.08, wave: 'pulse25', freq: f, dur: i === 3 ? 0.3 : 0.08, vol: 0.12, env: 'hold' })),
  },
  upgrade: {
    gap: 0.3,
    play: () => {
      [392, 523, 659, 784, 1047].forEach((f, i) => a.tone({ at: i * 0.06, wave: 'square', freq: f, dur: 0.08, vol: 0.09, env: 'hold' }));
      a.tone({ at: 0.32, wave: 'triangle', freq: 1047, dur: 0.5, vol: 0.3 });
    },
  },
  menuMove: { gap: 0.03, play: () => a.tone({ wave: 'pulse25', freq: 880, dur: 0.04, vol: 0.16, env: 'hold' }) },
  menuConfirm: {
    gap: 0.1,
    play: () => {
      a.tone({ wave: 'pulse25', freq: 660, dur: 0.05, vol: 0.18, env: 'hold' });
      a.tone({ at: 0.05, wave: 'pulse25', freq: 1320, dur: 0.1, vol: 0.18, env: 'hold' });
    },
  },
  menuBack: { gap: 0.1, play: () => a.tone({ wave: 'pulse25', freq: 660, to: 330, dur: 0.1, vol: 0.18 }) },
  launch: {
    gap: 0.3,
    play: () => {
      a.tone({ wave: 'square', freq: 220, to: 1760, dur: 0.35, vol: 0.08 });
      a.noise({ dur: 0.5, vol: 0.2, filter: 'bandpass', freq: 800, to: 5000, q: 1.5 });
    },
  },
  pause: { gap: 0.1, play: () => a.tone({ wave: 'triangle', freq: 880, to: 440, dur: 0.12, vol: 0.25 }) },
} satisfies Record<string, SfxDef>;

export type SfxName = keyof typeof SFX;

const lastPlayed: Partial<Record<SfxName, number>> = {};
/** Plays per effect, for testing (dev console: `__sfxStats`). */
export const sfxStats: Partial<Record<SfxName, number>> = {};

export function sfx(name: SfxName): void {
  const ctx = audio.ctx;
  if (!ctx || audio.muted) return;
  const now = ctx.currentTime;
  const def: SfxDef = SFX[name];
  const last = lastPlayed[name];
  if (last !== undefined && now - last < def.gap) return;
  lastPlayed[name] = now;
  sfxStats[name] = (sfxStats[name] ?? 0) + 1;
  def.play();
}
