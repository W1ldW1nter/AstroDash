import Phaser from 'phaser';
import { GAME_WIDTH } from '../config';
import { Enemy, type EnemyContext } from './Enemy';
import type { PatternDef } from '../bullets/Pattern';
import { PHASE_THRESHOLDS, PHASE_TRANSITION_MS, bossHp, bossLook, bossPhases, type BossPhase } from '../data/bosses';
import { textStyle } from '../ui/theme';

const BAR_X = 72;
const BAR_W = GAME_WIDTH - 144;
const BAR_Y = 42;
const BAR_H = 6;
const HOVER_Y = 150;
/** Engine flames on the top edge (the boss flies "down" the screen, so exhaust trails up). */
const FLAMES: [number, number][] = [
  [-7, -58],
  [7, -58],
];

/**
 * The boss: three phases (switching at 66% and 33% HP), a full-width health
 * bar, invulnerable while entering and while changing phase. Phase 3 swaps to
 * the dark sprite. Colour and attack intensity depend on the boss cycle.
 */
export class Boss extends Enemy {
  readonly cycle: number;
  readonly maxHp: number;
  phase = 0;
  /** Called when a new phase begins (1 = second phase, 2 = final). */
  onPhaseChange: (phase: number) => void = () => {};

  private readonly look: ReturnType<typeof bossLook>;
  private readonly phases: BossPhase[];
  private drift = 0;
  private driftPeriod = 2400;
  private readonly flames: Phaser.GameObjects.Sprite[] = [];
  private readonly bar: Phaser.GameObjects.Graphics;
  private readonly nameText: Phaser.GameObjects.Text;

  constructor(scene: Phaser.Scene, cycle: number, ctx: EnemyContext, depth: number, uiDepth: number) {
    super(scene, 'boss', 'a', GAME_WIDTH / 2, -60, { kind: 'hold', y: HOVER_Y, enterSpeed: 90, holdMs: 0, drift: 0, exitSpeed: 0 }, ctx);
    this.cycle = cycle;
    this.look = bossLook(cycle);
    this.phases = bossPhases(cycle);
    this.maxHp = bossHp(cycle);
    this.hp = this.maxHp;
    this.setFrame(this.look.frame).setDepth(depth);
    this.shielded = true; // until it reaches its hover position

    for (const [fx, fy] of FLAMES) {
      this.flames.push(scene.add.sprite(this.x + fx, this.y + fy, 'boss').play({ key: 'boss_flame', startFrame: Phaser.Math.Between(0, 3) }).setDepth(depth - 1));
    }
    this.bar = scene.add.graphics().setDepth(uiDepth);
    this.nameText = scene.add
      .text(GAME_WIDTH / 2, BAR_Y - 14, this.look.title, textStyle(8))
      .setOrigin(0.5)
      .setDepth(uiDepth);
  }

  get explosionColour(): string {
    return this.look.explosion;
  }

  update(deltaMs: number): void {
    const wasEntering = this.holdPhase === 'enter';
    super.update(deltaMs);
    if (wasEntering && this.holdPhase === 'hold') this.shielded = false; // arrived: fight on

    // Phase change when HP crosses the next threshold.
    const threshold = PHASE_THRESHOLDS[this.phase];
    if (threshold !== undefined && !this.removed && this.hp / this.maxHp <= threshold) this.startPhase(this.phase + 1);

    this.flames.forEach((f, i) => f.setPosition(this.x + FLAMES[i][0], this.y + FLAMES[i][1]));
    this.drawBar();
  }

  destroy(fromScene?: boolean): void {
    for (const f of this.flames) f.destroy();
    this.bar?.destroy();
    this.nameText?.destroy();
    super.destroy(fromScene);
  }

  // ------------------------------------------------------------ overrides

  protected attackList(): PatternDef[][] {
    return this.phases[this.phase].attacks;
  }

  protected attackCooldown(): number {
    return this.phases[this.phase].cooldown;
  }

  protected move(deltaMs: number): void {
    if (this.holdPhase === 'enter') {
      super.move(deltaMs);
      return;
    }
    // Sway side to side; ease towards the current phase's wider/faster sway.
    const target = this.phases[this.phase];
    const k = Math.min(1, deltaMs / 600);
    this.drift += (target.drift - this.drift) * k;
    this.driftPeriod += (target.driftPeriod - this.driftPeriod) * k;
    this.holdTimer += deltaMs;
    this.x = this.start.x + Math.sin((this.holdTimer / this.driftPeriod) * Math.PI * 2) * this.drift;
    // Final phase also bobs up and down.
    this.y = HOVER_Y + (this.phase === 2 ? Math.sin(this.holdTimer / 700) * 12 : 0);
  }

  // ------------------------------------------------------------ internals

  private startPhase(next: number): void {
    this.phase = next;
    this.shielded = true;
    this.resetAttacks(PHASE_TRANSITION_MS + 300);
    this.ctx.pool.clear(); // breathing room between phases
    if (next === 2) this.setFrame(`${this.look.frame}_dark`);

    this.scene.cameras.main.shake(400, 0.01);
    this.scene.tweens.add({ targets: this, alpha: 0.35, duration: 90, yoyo: true, repeat: 7, onComplete: () => this.setAlpha(1) });
    this.scene.time.delayedCall(PHASE_TRANSITION_MS, () => {
      if (!this.removed) this.shielded = false;
    });
    this.onPhaseChange(next);
  }

  private drawBar(): void {
    const g = this.bar;
    g.clear();
    const pct = Math.max(0, this.hp / this.maxHp);
    g.fillStyle(0x000000, 0.75).fillRect(BAR_X - 2, BAR_Y - 2, BAR_W + 4, BAR_H + 4);
    g.fillStyle(0x2a0f1c, 1).fillRect(BAR_X, BAR_Y, BAR_W, BAR_H);
    const colour = this.shielded && this.holdPhase !== 'enter' ? 0xffffff : this.phase === 2 ? 0xffd23f : 0xff3d6e;
    g.fillStyle(colour, 1).fillRect(BAR_X, BAR_Y, Math.ceil(BAR_W * pct), BAR_H);
    // Phase markers at 66% and 33%.
    g.fillStyle(0x05060f, 1);
    for (const t of PHASE_THRESHOLDS) g.fillRect(Math.round(BAR_X + BAR_W * t), BAR_Y - 2, 2, BAR_H + 4);
  }
}
