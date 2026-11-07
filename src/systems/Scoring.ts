import { DOUBLE_SCORE_MS } from '../data/pickups';

/** Kills within this window keep the chain going (ms). */
const CHAIN_WINDOW_MS = 2000;
/** Chain length that reaches the maximum multiplier. */
const CHAIN_FOR_MAX = 50;
const MAX_CHAIN_MULTIPLIER = 3;
/** Points for brushing past an enemy bullet without being hit. */
export const GRAZE_POINTS = 20;
/** Wave clear bonus per wave number; doubled if no hit was taken during the wave. */
const WAVE_BONUS_PER_WAVE = 250;

const STORAGE_KEY = 'astrodash.highscores.v1';

/**
 * Score, kill chain multiplier, graze count, 2x-score boost and saved high
 * scores (one per ship class, stored in this browser).
 */
export class Scoring {
  score = 0;
  chain = 0;
  grazes = 0;
  kills = 0;
  /** ms left on the 2x score pickup. */
  doubleScore = 0;
  readonly highScore: number;
  private chainTimer = 0;
  private hitThisWave = false;

  constructor(private readonly shipId: string) {
    this.highScore = loadHighScores()[shipId] ?? 0;
  }

  /** 1.0 .. 3.0, grows with the kill chain. */
  get chainMultiplier(): number {
    return 1 + (Math.min(this.chain, CHAIN_FOR_MAX) / CHAIN_FOR_MAX) * (MAX_CHAIN_MULTIPLIER - 1);
  }

  /** Everything that multiplies points right now. */
  get multiplier(): number {
    return this.chainMultiplier * (this.doubleScore > 0 ? 2 : 1);
  }

  update(deltaMs: number): void {
    if (this.doubleScore > 0) this.doubleScore = Math.max(0, this.doubleScore - deltaMs);
    if (this.chain > 0) {
      this.chainTimer -= deltaMs;
      if (this.chainTimer <= 0) this.chain = 0;
    }
  }

  /** Award points for a kill; returns the points actually added. */
  kill(basePoints: number): number {
    this.kills++;
    this.chain++;
    this.chainTimer = CHAIN_WINDOW_MS;
    return this.add(basePoints);
  }

  graze(): number {
    this.grazes++;
    return this.add(GRAZE_POINTS);
  }

  /** Flat points with the current multiplier applied. */
  add(points: number): number {
    const p = Math.round(points * this.multiplier);
    this.score += p;
    return p;
  }

  startDoubleScore(): void {
    this.doubleScore = DOUBLE_SCORE_MS;
  }

  /** Taking a hit breaks the chain and forfeits the no-hit wave bonus. */
  playerHit(): void {
    this.chain = 0;
    this.hitThisWave = true;
  }

  /** Wave cleared: bonus points (not multiplied), doubled for a no-hit wave. */
  waveCleared(wave: number): { bonus: number; noHit: boolean } {
    const noHit = !this.hitThisWave;
    const bonus = WAVE_BONUS_PER_WAVE * wave * (noHit ? 2 : 1);
    this.score += bonus;
    this.hitThisWave = false;
    return { bonus, noHit };
  }

  /** Save if this run beat the stored high score for this ship. Returns true on a new record. */
  saveHighScore(): boolean {
    if (this.score <= this.highScore) return false;
    const all = loadHighScores();
    all[this.shipId] = this.score;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
    } catch {
      /* storage blocked (private mode etc.): keep playing without saving */
    }
    return true;
  }
}

/** Saved high scores, keyed by ship id. */
export function loadHighScores(): Record<string, number> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Record<string, number>) : {};
  } catch {
    return {};
  }
}
