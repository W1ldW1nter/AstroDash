import type { Wave } from './engine';

/**
 * Chiptune songs as data. Each channel is a list of 16th-note steps:
 *   melodic channels: a note ('A4', 'C#5', 'Bb3'), '-' = hold the previous note, '.' = rest
 *   drum channels:    'k' kick, 's' snare, 'h' closed hat, 'o' open hat, '.' rest
 * Channels loop independently over their own length.
 */

export interface Channel {
  wave: Wave | 'drums';
  vol: number;
  steps: string[];
  /** Play this channel late by N steps (cheap echo when paired with a copy of another channel). */
  delay?: number;
  /** 'pluck' notes decay; 'hold' notes sustain for their full length. */
  env?: 'pluck' | 'hold';
}

export interface Track {
  bpm: number;
  loop: boolean;
  channels: Channel[];
}

// ------------------------------------------------------------- helpers

const tokens = (s: string): string[] => s.trim().split(/\s+/);
const join = (...bars: string[]): string[] => bars.flatMap(tokens);
const repeat = (bars: string[], n: number): string[] => Array.from({ length: n }, () => bars).flat();

/** One bar (16 steps) cycling through chord tones. */
function arp(chord: string[], order = [0, 1, 2, 1]): string {
  return Array.from({ length: 16 }, (_, i) => chord[order[i % order.length]]).join(' ');
}

/**
 * One bar of bass from a template, where '1' = root, '8' = root an octave up,
 * '5' = fifth (an octave above the root's octave).
 */
function bass(template: string, root: string, fifth: string): string {
  const oct = Number(root.slice(-1));
  const name = root.slice(0, -1);
  const map: Record<string, string> = { '1': root, '8': `${name}${oct + 1}`, '5': fifth };
  return tokens(template)
    .map((t) => map[t] ?? t)
    .join(' ');
}

const CH = {
  Am: ['A4', 'C5', 'E5'],
  F: ['F4', 'A4', 'C5'],
  G: ['G4', 'B4', 'D5'],
  C: ['C5', 'E5', 'G5'],
  Em: ['E4', 'G4', 'B4'],
  E: ['E4', 'G#4', 'B4'],
  Dm: ['D5', 'F5', 'A5'],
  Bb: ['Bb4', 'D5', 'F5'],
  A: ['A4', 'C#5', 'E5'],
  Gm: ['G4', 'Bb4', 'D5'],
};

// ------------------------------------------------------------- title

const TITLE_CHORDS: [string[], string, string][] = [
  [CH.Am, 'A2', 'E3'],
  [CH.F, 'F2', 'C3'],
  [CH.C, 'C3', 'G3'],
  [CH.G, 'G2', 'D3'],
  [CH.Am, 'A2', 'E3'],
  [CH.F, 'F2', 'C3'],
  [CH.G, 'G2', 'D3'],
  [CH.E, 'E2', 'B2'],
];

const title: Track = {
  bpm: 96,
  loop: true,
  channels: [
    {
      wave: 'pulse25',
      vol: 0.13,
      env: 'hold',
      steps: join(
        'E5 - - - - - - - A5 - - - G5 - E5 -',
        'F5 - - - - - - - E5 - - - C5 - - -',
        'E5 - - - - - - - G5 - - - C6 - B5 -',
        'B5 - - - - - - - - - - - . . . .',
        'A5 - - - - - - - C6 - - - B5 - A5 -',
        'A5 - - - - - - - F5 - - - E5 - D5 -',
        'D5 - - - - - - - B4 - - - D5 - - -',
        'E5 - - - - - - - - - - - . . . .',
      ),
    },
    { wave: 'pulse12', vol: 0.07, steps: TITLE_CHORDS.flatMap(([c]) => tokens(arp(c, [0, 1, 2, 1, 2, 1]))) },
    { wave: 'triangle', vol: 0.4, env: 'hold', steps: TITLE_CHORDS.flatMap(([, r, f]) => tokens(bass('1 - - - - - 5 - 8 - - - 5 - - -', r, f))) },
    { wave: 'drums', vol: 0.5, steps: repeat(tokens('k . . . h . . . . . k . h . . .'), 1) },
  ],
};

// -------------------------------------------------------------- game

const GAME_CHORDS: [string[], string, string][] = [
  [CH.Am, 'A2', 'E3'],
  [CH.F, 'F2', 'C3'],
  [CH.G, 'G2', 'D3'],
  [CH.Em, 'E2', 'B2'],
  [CH.Am, 'A2', 'E3'],
  [CH.F, 'F2', 'C3'],
  [CH.G, 'G2', 'D3'],
  [CH.E, 'E2', 'B2'],
];

const GAME_LEAD = join(
  'A4 - - - C5 - E5 - A5 - - - G5 - E5 -',
  'F5 - - - E5 - C5 - A4 - - - C5 - - -',
  'D5 - - - B4 - G4 - D5 - E5 - F5 - - -',
  'E5 - - - - - - - B4 - - - . . . .',
  'A5 - - - G5 - E5 - C5 - - - E5 - A5 -',
  'C6 - - - A5 - F5 - A5 - G5 - F5 - - -',
  'G5 - - - F5 - D5 - B4 - D5 - G5 - - -',
  'E5 - - - G#5 - - - B5 - - - E5 . . .',
);
// Second time round the lead drops out for 8 bars, leaving a driving arp break.
const GAME_LEAD_FULL = [...GAME_LEAD, ...repeat(tokens('. . . . . . . . . . . . . . . .'), 8)];

const game: Track = {
  bpm: 148,
  loop: true,
  channels: [
    { wave: 'pulse25', vol: 0.14, env: 'hold', steps: GAME_LEAD_FULL },
    { wave: 'pulse25', vol: 0.05, env: 'hold', steps: GAME_LEAD_FULL, delay: 3 }, // echo
    {
      wave: 'pulse12',
      vol: 0.075,
      steps: [
        ...GAME_CHORDS.flatMap(([c]) => tokens(arp(c))),
        ...GAME_CHORDS.flatMap(([c]) => tokens(arp([c[0], c[1], c[2], c[0].replace(/\d/, (d) => String(Number(d) + 1))], [0, 1, 2, 3, 2, 1]))),
      ],
    },
    { wave: 'triangle', vol: 0.45, env: 'hold', steps: GAME_CHORDS.flatMap(([, r, f]) => tokens(bass('1 - 8 - 1 - 8 - 1 - 8 - 5 - 8 -', r, f))) },
    {
      wave: 'drums',
      vol: 0.6,
      steps: join(
        'k . h . s . h . k . k h s . h h',
        'k . h . s . h . k . k h s . h o',
        'k . h . s . h . k . k h s . h h',
        'k . h . s . h . k . s . s s s s',
      ),
    },
  ],
};

// -------------------------------------------------------------- boss

const BOSS_CHORDS: [string[], string, string][] = [
  [CH.Dm, 'D2', 'A2'],
  [CH.Dm, 'D2', 'A2'],
  [CH.Bb, 'Bb1', 'F2'],
  [CH.A, 'A1', 'E2'],
  [CH.Dm, 'D2', 'A2'],
  [CH.Dm, 'D2', 'A2'],
  [CH.Gm, 'G1', 'D2'],
  [CH.A, 'A1', 'E2'],
];

const BOSS_LEAD = join(
  'D5 - . D5 F5 - D5 - A5 - - - G#5 - A5 -',
  'C6 - A5 - F5 - D5 - E5 - F5 - E5 - C#5 -',
  'D5 - - - F5 - - - Bb5 - - - A5 - F5 -',
  'E5 - - - A4 - C#5 - E5 - G5 - A5 - - -',
  'D5 - . D5 F5 - D5 - A5 - - - G#5 - A5 -',
  'C6 - A5 - F5 - D5 - E5 - F5 - E5 - C#5 -',
  'G5 - - - Bb5 - - - D6 - - - C6 - Bb5 -',
  'A5 - - - - - - - C#6 - - - E6 - - -',
);

const boss: Track = {
  bpm: 166,
  loop: true,
  channels: [
    { wave: 'square', vol: 0.12, env: 'hold', steps: BOSS_LEAD },
    { wave: 'pulse25', vol: 0.05, env: 'hold', steps: BOSS_LEAD, delay: 3 },
    { wave: 'pulse12', vol: 0.09, steps: BOSS_CHORDS.flatMap(([c]) => tokens(arp(c, [0, 2, 1, 2]))) },
    { wave: 'triangle', vol: 0.5, steps: BOSS_CHORDS.flatMap(([, r, f]) => tokens(bass('1 1 8 1 1 1 8 1 1 1 8 1 5 5 8 5', r, f))) },
    {
      wave: 'drums',
      vol: 0.65,
      steps: join('k . h k s . h . k k h . s . h h', 'k . h k s . h . k k h . s . s s', 'k . h k s . h . k k h . s . h h', 'k . s k s . s . k k s . s s s s'),
    },
  ],
};

// ---------------------------------------------------------- game over

const gameover: Track = {
  bpm: 92,
  loop: false,
  channels: [
    { wave: 'pulse25', vol: 0.14, env: 'hold', steps: join('E5 - - D5 - - C5 - - B4 - - A4 - - - - - - - - - - . . . . . . . . .') },
    { wave: 'triangle', vol: 0.45, env: 'hold', steps: join('A2 - - - - - F2 - - - - - E2 - - - A1 - - - - - - - . . . . . . . .') },
  ],
};

export const TRACKS = { title, game, boss, gameover } satisfies Record<string, Track>;
export type TrackName = keyof typeof TRACKS;
