import Phaser from 'phaser';
import { GAME_WIDTH } from '../config';
import type { Enemy } from '../entities/Enemy';
import type { EnemyManager } from './EnemyManager';
import type { EnemyVariant } from '../data/enemies';
import { FORMATIONS, type Formation, type SpawnApi } from '../data/formations';
import {
  BIG_ENEMY_SPAWN_RATE,
  BOSS_ARRIVAL_MS,
  FILLER_INTERVAL_MS,
  MINIBOSS_ARRIVAL_MS,
  SPAWN_WINDOW_MS,
  WAVE_CLEAR_TIMEOUT_MS,
  WAVE_GAP_MS,
  WAVE_INTRO_MS,
  difficultyFor,
  waveBudget,
  waveKind,
  type Difficulty,
  type WaveKind,
} from '../data/waves';

type Phase = 'intro' | 'active' | 'clearing' | 'gap' | 'waiting';

export interface WaveEvents {
  /** A new wave is starting: show its banner. */
  onWaveStart(wave: number, kind: WaveKind): void;
  /** The miniboss / boss has entered. */
  onBigEnemy(kind: 'miniboss' | 'boss'): void;
  /**
   * The wave is over. For boss waves the director waits until `resume()` is
   * called (the upgrade screen calls it once the player has picked).
   */
  onWaveCleared(wave: number, kind: WaveKind, resume: () => void): void;
}

/**
 * Runs the endless sequence of waves:
 *  - each wave spends a growing budget on formations, spread over the spawn window;
 *  - every 2nd wave adds a miniboss, every 6th a boss;
 *  - while either is alive, regular spawns slow to 70% and small filler groups
 *    keep coming until it dies;
 *  - a wave ends once its spawns are done, any big enemy is dead and the
 *    screen is clear (or a timeout passes).
 */
export class WaveDirector {
  wave = 0;
  kind: WaveKind = 'normal';
  phase: Phase = 'gap';

  private phaseTimer = 0;
  /** Spawn-schedule clock: advances slower while a big enemy is alive. */
  private spawnClock = 0;
  private waveElapsed = 0;
  private schedule: { at: number; formation: Formation }[] = [];
  private fillerTimer = 0;
  private bigEnemy: Enemy | null = null;
  private bigEnemyDue = false;
  private readonly queue: { at: number; fn: () => void }[] = [];
  private readonly api: SpawnApi;

  constructor(
    private readonly enemies: EnemyManager,
    /** Shared with enemies; mutated in place each wave. */
    private readonly difficulty: Difficulty,
    private readonly events: WaveEvents,
  ) {
    this.api = {
      spawn: (id, variant, x, y, movement) => void this.enemies.spawn(id, variant, x, y, movement),
      later: (ms, fn) => this.queue.push({ at: this.waveElapsed + ms, fn }),
      variant: () => Phaser.Math.RND.pick(['a', 'b', 'c'] as const),
    };
    this.phaseTimer = 600; // short breath before wave 1
  }

  /** True while a miniboss/boss is on the field. */
  get bigEnemyAlive(): boolean {
    return this.bigEnemy !== null && !this.bigEnemy.removed;
  }

  update(deltaMs: number): void {
    this.waveElapsed += deltaMs;
    this.runQueue();

    switch (this.phase) {
      case 'gap':
        this.phaseTimer -= deltaMs;
        if (this.phaseTimer <= 0) this.startWave(this.wave + 1);
        break;

      case 'intro':
        this.phaseTimer -= deltaMs;
        if (this.phaseTimer <= 0) this.phase = 'active';
        break;

      case 'active':
        this.updateActive(deltaMs);
        break;

      case 'clearing':
        this.phaseTimer -= deltaMs;
        if ((this.enemies.count() === 0 && this.queue.length === 0) || this.phaseTimer <= 0) this.finishWave();
        break;

      case 'waiting':
        break; // paused until resume() (upgrade screen)
    }
  }

  /** Dev: abandon the current wave and start `wave` immediately. */
  jumpToWave(wave: number): void {
    this.enemies.clear();
    this.startWave(wave);
  }

  // ------------------------------------------------------------- internals

  private startWave(wave: number): void {
    this.wave = wave;
    this.kind = waveKind(wave);
    Object.assign(this.difficulty, difficultyFor(wave));
    this.spawnClock = 0;
    this.waveElapsed = 0;
    this.fillerTimer = 0;
    this.bigEnemy = null;
    this.bigEnemyDue = this.kind !== 'normal';
    this.queue.length = 0;
    this.schedule = this.buildSchedule(wave);
    this.phase = 'intro';
    this.phaseTimer = WAVE_INTRO_MS;
    this.events.onWaveStart(wave, this.kind);
  }

  /** Spend the wave's budget on random formations, spread evenly over the spawn window. */
  private buildSchedule(wave: number): { at: number; formation: Formation }[] {
    let budget = waveBudget(wave);
    // Big-enemy waves spend part of their budget on the miniboss/boss itself.
    if (this.kind === 'miniboss') budget *= 0.75;
    if (this.kind === 'boss') budget *= 0.5;

    const pool = FORMATIONS.filter((f) => f.minWave <= wave);
    const cheapest = Math.min(...pool.map((f) => f.cost));
    const picks: Formation[] = [];
    // Normal waves always include at least one large enemy (from wave 2), so no wave is fodder-only.
    const large = pool.find((f) => f.id === 'large');
    if (this.kind === 'normal' && large && budget >= large.cost) {
      picks.push(large);
      budget -= large.cost;
    }
    while (budget >= cheapest) {
      const affordable = pool.filter((f) => f.cost <= budget);
      const f = weightedPick(affordable);
      picks.push(f);
      budget -= f.cost;
    }
    Phaser.Utils.Array.Shuffle(picks);
    const step = SPAWN_WINDOW_MS / Math.max(1, picks.length);
    return picks.map((formation, i) => ({ at: i * step + Phaser.Math.FloatBetween(0, step * 0.4), formation }));
  }

  private updateActive(deltaMs: number): void {
    // Boss killed: skip the rest of the wave's spawns so the reward comes right away.
    if (this.kind === 'boss' && this.bigEnemy?.removed && this.schedule.length) {
      this.schedule.length = 0;
      this.queue.length = 0;
    }

    const rate = this.bigEnemyAlive ? BIG_ENEMY_SPAWN_RATE : 1;
    this.spawnClock += deltaMs * rate;

    // Scheduled formations.
    while (this.schedule.length && this.schedule[0].at <= this.spawnClock) {
      this.schedule.shift()!.formation.run(this.api);
    }

    // Miniboss / boss arrival (measured in real wave time, not the slowed clock).
    if (this.bigEnemyDue) {
      const arrival = (this.kind === 'boss' ? BOSS_ARRIVAL_MS : MINIBOSS_ARRIVAL_MS) + WAVE_INTRO_MS;
      if (this.waveElapsed >= arrival) this.spawnBigEnemy();
    }

    // Spawns used up but the big enemy still lives: keep a trickle of small fodder coming.
    if (!this.schedule.length && this.bigEnemyAlive) {
      this.fillerTimer += deltaMs * rate;
      if (this.fillerTimer >= FILLER_INTERVAL_MS) {
        this.fillerTimer = 0;
        weightedPick(FORMATIONS.filter((f) => f.filler)).run(this.api);
      }
    }

    if (!this.schedule.length && !this.bigEnemyDue && !this.bigEnemyAlive) {
      this.phase = 'clearing';
      this.phaseTimer = WAVE_CLEAR_TIMEOUT_MS;
    }
  }

  private spawnBigEnemy(): void {
    this.bigEnemyDue = false;
    const cycle = Math.floor((this.wave - 1) / 6); // boss cycle: 0 for waves 1-6, 1 for 7-12, ...
    if (this.kind === 'boss') {
      this.bigEnemy = this.enemies.spawnBoss(cycle);
      this.events.onBigEnemy('boss');
      return;
    }
    const variant: EnemyVariant = (['a', 'b', 'c'] as const)[cycle % 3];
    this.bigEnemy = this.enemies.spawn('heavy', variant, GAME_WIDTH / 2, -40, { kind: 'hold', y: 130, enterSpeed: 100, holdMs: 0, drift: 140, exitSpeed: 0 });
    this.events.onBigEnemy('miniboss');
  }

  private finishWave(): void {
    const resume = () => {
      this.phase = 'gap';
      this.phaseTimer = WAVE_GAP_MS;
    };
    if (this.kind === 'boss') {
      this.phase = 'waiting';
      this.events.onWaveCleared(this.wave, this.kind, resume);
    } else {
      resume();
      this.events.onWaveCleared(this.wave, this.kind, () => {});
    }
  }

  private runQueue(): void {
    for (let i = this.queue.length - 1; i >= 0; i--) {
      if (this.queue[i].at <= this.waveElapsed) {
        const { fn } = this.queue[i];
        this.queue.splice(i, 1);
        fn();
      }
    }
  }
}

function weightedPick<T extends { weight: number }>(items: T[]): T {
  const total = items.reduce((s, i) => s + i.weight, 0);
  let r = Math.random() * total;
  for (const i of items) {
    r -= i.weight;
    if (r <= 0) return i;
  }
  return items[items.length - 1];
}
