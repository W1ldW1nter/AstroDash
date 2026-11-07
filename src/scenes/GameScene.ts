import Phaser from 'phaser';
import { GAME_HEIGHT, GAME_WIDTH, SCENES } from '../config';
import { Controls } from '../input/Controls';
import { ParallaxBackground } from '../world/ParallaxBackground';
import { Player, type HitResult } from '../entities/Player';
import { PlayerBullets } from '../entities/PlayerBullets';
import { BulletPool } from '../bullets/BulletPool';
import { EnemyManager } from '../systems/EnemyManager';
import { WaveDirector } from '../systems/WaveDirector';
import { Hud } from '../ui/Hud';
import { UpgradePicker } from '../ui/UpgradePicker';
import { SKINS, type ShipClass, type Skin } from '../data/ships';
import { difficultyFor, type WaveKind } from '../data/waves';
import { applyUpgrade, rollUpgrades } from '../data/upgrades';
import { bossLook } from '../data/bosses';
import { Boss } from '../entities/Boss';
import type { Enemy } from '../entities/Enemy';
import { PickupManager } from '../entities/Pickups';
import { Scoring } from '../systems/Scoring';
import { DROPS, MAX_BOMBS, PICKUPS, type PickupId } from '../data/pickups';
import { Menu } from '../ui/Menu';
import { COLORS, COLOR_NUM, textStyle } from '../ui/theme';

/** Render order. */
export const DEPTH = {
  background: 0,
  enemies: 5,
  playerBullets: 10,
  explosions: 12,
  pickups: 14,
  enemyBullets: 15, // above enemies, shots, explosions and pickups, so threats are never hidden
  player: 20,
  effects: 30,
  ui: 100,
} as const;

const SPAWN_X = GAME_WIDTH / 2;
const SPAWN_Y = GAME_HEIGHT - 90;
const RESPAWN_DELAY_MS = 1000;
/** Bullets this close to the player are wiped when the shield breaks, so the hit isn't followed by a cheap second one. */
const SHIELD_CLEAR_RADIUS = 70;
/** Pause between the boss dying and the upgrade screen, so its explosions can play. */
const BOSS_REWARD_DELAY_MS = 1600;
/** Bomb: damage to every on-screen enemy, how long it keeps erasing bullets, and invulnerability granted. */
const BOMB_DAMAGE = 20;
const BOMB_CLEAR_MS = 1000;
const BOMB_INVULN_MS = 1500;
/** Bullets passing within this distance of the hitbox (without hitting) count as grazes. */
const GRAZE_RADIUS = 14;
/** Points given instead when a pickup can't be used (full lives, max bombs). */
const SPARE_PICKUP_POINTS = 2000;

/**
 * Main gameplay scene: endless waves (miniboss every 2nd, boss every 6th,
 * pick-1-of-3 upgrade after each boss), lives/shield, game over.
 * Dev builds only (`npm run dev`): 1/2 switch ship class (resets lives),
 * C cycles colour, F3 debug overlay, V sprite viewer, L bullet lab, B next boss.
 */
export class GameScene extends Phaser.Scene {
  private controls!: Controls;
  private background!: ParallaxBackground;
  private player!: Player;
  private playerBullets!: PlayerBullets;
  private enemyBullets!: BulletPool;
  private enemies!: EnemyManager;
  private director!: WaveDirector;
  private hud!: Hud;
  private pickups!: PickupManager;
  private scoring!: Scoring;
  private debugText!: Phaser.GameObjects.Text;

  private gameOver = false;
  /** ms left of an active bomb's bullet-erasing effect. */
  private bombTimer = 0;
  /** Gameplay frozen (upgrade screen open). */
  private paused = false;
  /** Pause menu open: everything frozen, including the background, timers and animations. */
  private menuPaused = false;
  private pauseLayer: Phaser.GameObjects.GameObject[] = [];
  private pauseMenu: Menu | null = null;
  /** Time survived this run (ms), excluding pauses and the upgrade screen. */
  private runTime = 0;
  private bannerTexts: Phaser.GameObjects.Text[] = [];
  private startShip: ShipClass['id'] = 'fighter';
  private startSkin: Skin = 'blue';

  constructor() {
    super(SCENES.Game);
  }

  init(data: { shipId?: ShipClass['id']; skin?: Skin }): void {
    if (data.shipId) this.startShip = data.shipId;
    if (data.skin) this.startSkin = data.skin;
  }

  create(): void {
    this.gameOver = false;
    this.paused = false;
    this.menuPaused = false;
    this.pauseLayer = [];
    this.pauseMenu = null;
    this.runTime = 0;
    this.bombTimer = 0;
    this.bannerTexts = [];
    this.scoring = new Scoring(this.startShip);

    this.controls = new Controls(this);
    this.background = new ParallaxBackground(this, DEPTH.background);
    this.playerBullets = new PlayerBullets(this, 256, DEPTH.playerBullets);
    this.enemyBullets = new BulletPool(this, 3000, DEPTH.enemyBullets);
    this.player = new Player(this, SPAWN_X, SPAWN_Y, this.playerBullets, this.startShip, this.startSkin).setDepth(DEPTH.player);

    const difficulty = difficultyFor(1);
    this.enemies = new EnemyManager(this, { pool: this.enemyBullets, target: this.player, difficulty }, DEPTH.enemies, DEPTH.explosions, DEPTH.ui);
    this.pickups = new PickupManager(this, DEPTH.pickups);
    this.pickups.onCollect = (id, x, y) => this.collectPickup(id, x, y);
    this.enemies.onKilled = (e) => this.onEnemyKilled(e);
    this.enemies.onBossPhase = (_boss, phase) => this.banner(phase === 2 ? 'FINAL PHASE' : `PHASE ${phase + 1}`, '', COLORS.gold);
    this.director = new WaveDirector(this.enemies, difficulty, {
      onWaveStart: (wave, kind) => this.banner(`WAVE ${wave}`, kind === 'boss' ? 'BOSS WAVE' : kind === 'miniboss' ? 'MINIBOSS WAVE' : ''),
      onBigEnemy: (kind) =>
        this.banner('WARNING', kind === 'boss' ? bossLook(Math.floor((this.director.wave - 1) / 6)).title : 'MINIBOSS APPROACHING', COLORS.danger),
      onWaveCleared: (wave, kind, resume) => this.onWaveCleared(wave, kind, resume),
    });

    this.hud = new Hud(this, DEPTH.ui);
    this.debugText = this.add.text(6, 100, '', textStyle(8, COLORS.accent, { lineSpacing: 4 })).setDepth(DEPTH.ui).setVisible(false);
    this.showHelp();
    this.bindPauseKeys();
    this.bindDevKeys();
  }

  update(_time: number, delta: number): void {
    if (this.menuPaused) return;
    // Clamp huge frame gaps (tab switch, breakpoint) so nothing teleports.
    const dt = Math.min(delta, 50);
    this.background.update(dt);
    if (this.paused) return;
    if (!this.gameOver) this.runTime += dt;
    this.player.update(dt, this.controls);
    if (this.controls.bomb) this.useBomb();
    this.playerBullets.update(dt);
    if (!this.gameOver) this.director.update(dt);
    this.enemies.update(dt, this.playerBullets);
    this.enemyBullets.update(dt);
    if (this.bombTimer > 0) {
      this.bombTimer -= dt;
      this.enemyBullets.clear(); // the bomb keeps erasing bullets while it lasts
    }
    this.pickups.update(dt, this.player);
    this.scoring.update(dt);
    this.checkPlayerHits();

    this.hud.update(this.player, this.scoring, this.director.wave);
    if (this.debugText.visible) {
      const p = this.player;
      this.debugText.setText(
        [
          `FPS ${Math.round(this.game.loop.actualFps)}`,
          `${p.ship.name} / ${p.skin}${p.focusing ? '  [FOCUS]' : ''}`,
          `enemies ${this.enemies.count()}  bullets ${this.enemyBullets.count}`,
          `wave ${this.director.wave} ${this.director.kind} [${this.director.phase}]`,
        ].join('\n'),
      );
    }
  }

  // -------------------------------------------------------------- waves

  private onWaveCleared(wave: number, kind: WaveKind, resume: () => void): void {
    if (this.gameOver) return;
    const { bonus, noHit } = this.scoring.waveCleared(wave);
    if (kind !== 'boss') {
      this.banner('WAVE CLEAR', `+${bonus}${noHit ? '  NO-HIT BONUS x2' : ''}`, COLORS.accent);
      return;
    }
    // Boss down: let the explosions play out, then freeze the action and offer 1 of 3 upgrades.
    this.time.delayedCall(BOSS_REWARD_DELAY_MS, () => {
      if (this.gameOver) return;
      this.enemyBullets.clear();
      this.playerBullets.clear();
      this.paused = true;
      new UpgradePicker(this, this.player, rollUpgrades(this.player), DEPTH.ui + 10, (u) => {
        applyUpgrade(this.player, u);
        this.paused = false;
        this.banner(u.name.toUpperCase(), 'UPGRADE ACQUIRED', COLORS.gold);
        resume();
      });
    });
  }

  /** Big centered text that fades in and out. */
  private banner(title: string, subtitle = '', color: string = COLORS.text): void {
    // A new banner replaces any that is still showing.
    for (const o of this.bannerTexts) o.destroy();
    const cx = GAME_WIDTH / 2;
    const cy = GAME_HEIGHT * 0.36;
    const t = this.add.text(cx, cy, title, textStyle(24, color)).setOrigin(0.5).setDepth(DEPTH.ui);
    const s = this.add.text(cx, cy + 30, subtitle, textStyle(8, COLORS.accent)).setOrigin(0.5).setDepth(DEPTH.ui);
    this.bannerTexts = [t, s];
    for (const o of [t, s]) {
      o.setAlpha(0);
      this.tweens.add({ targets: o, alpha: 1, duration: 250, yoyo: true, hold: 1100, onComplete: () => o.destroy() });
    }
  }

  // ------------------------------------------------------------- combat

  private checkPlayerHits(): void {
    if (!this.player.alive || this.player.invulnerable > 0) return;
    const h = this.player.hitbox;

    let result = 'ignored' as HitResult; // assigned inside the callback below
    this.enemyBullets.collideCircle(h.x, h.y, h.radius, () => {
      if (result !== 'ignored') return false; // one hit per frame
      result = this.player.takeHit();
      return result !== 'ignored';
    });
    if (result === 'ignored' && this.enemies.findContact(h.x, h.y, h.radius)) {
      result = this.player.takeHit();
    }
    if (result !== 'ignored') {
      this.onPlayerHit(result);
      return;
    }
    // Close call: bullets brushing past the hitbox score graze points.
    this.enemyBullets.graze(h.x, h.y, GRAZE_RADIUS, () => this.scoring.graze());
  }

  private onPlayerHit(result: HitResult): void {
    const { x, y } = this.player;
    this.scoring.playerHit();
    if (result === 'shield') {
      this.enemyBullets.clearRadius(x, y, SHIELD_CLEAR_RADIUS);
      this.cameras.main.shake(120, 0.005);
      this.cameras.main.flash(80, 120, 200, 255);
      return;
    }

    // Ship destroyed.
    this.enemies.explode(x, y, 'teal');
    this.time.delayedCall(90, () => this.enemies.explode(x - 8, y + 6, 'teal'));
    this.time.delayedCall(180, () => this.enemies.explode(x + 8, y - 4, 'teal'));
    this.cameras.main.shake(300, 0.012);
    this.enemyBullets.clear();

    if (result === 'life') {
      this.time.delayedCall(RESPAWN_DELAY_MS, () => {
        this.enemyBullets.clear();
        this.player.respawn(SPAWN_X, SPAWN_Y);
      });
    } else {
      this.gameOver = true;
      this.time.delayedCall(900, () => this.showGameOver());
    }
  }

  private showGameOver(): void {
    const cx = GAME_WIDTH / 2;
    const top = 150;
    const d = DEPTH.ui + 5;
    const record = this.scoring.saveHighScore();
    const s = this.scoring;

    this.add.rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT, COLOR_NUM.shade, 0.6).setOrigin(0).setDepth(d);
    this.add.rectangle(cx, top + 165, 340, 350, COLOR_NUM.panel, 0.95).setStrokeStyle(2, COLOR_NUM.panelEdge).setDepth(d);
    this.add.text(cx, top + 30, 'GAME OVER', textStyle(24, COLORS.danger)).setOrigin(0.5).setDepth(d);
    this.add.text(cx, top + 58, this.player.ship.name.toUpperCase(), textStyle(8, COLORS.dim)).setOrigin(0.5).setDepth(d);

    const mins = Math.floor(this.runTime / 60000);
    const secs = Math.floor((this.runTime % 60000) / 1000).toString().padStart(2, '0');
    const rows: [string, string, string?][] = [
      ['SCORE', s.score.toString(), COLORS.text],
      ['BEST', Math.max(s.highScore, s.score).toString(), record ? COLORS.gold : COLORS.dim],
      ['WAVE', this.director.wave.toString()],
      ['KILLS', s.kills.toString()],
      ['GRAZES', s.grazes.toString()],
      ['TIME', `${mins}:${secs}`],
    ];
    rows.forEach(([label, value, color], i) => {
      const y = top + 90 + i * 20;
      this.add.text(cx - 130, y, label, textStyle(8, COLORS.dim)).setOrigin(0, 0.5).setDepth(d);
      this.add.text(cx + 130, y, value, textStyle(8, color ?? COLORS.text)).setOrigin(1, 0.5).setDepth(d);
    });
    if (record) {
      const nh = this.add.text(cx, top + 222, 'NEW HIGH SCORE!', textStyle(16, COLORS.gold)).setOrigin(0.5).setDepth(d);
      this.tweens.add({ targets: nh, alpha: 0.4, duration: 500, yoyo: true, repeat: -1 });
    }

    const choice = { shipId: this.player.ship.id, skin: this.player.skin };
    new Menu(
      this,
      cx,
      top + 260,
      [
        { label: 'RETRY', action: () => this.scene.restart(choice) },
        { label: 'CHANGE SHIP', action: () => this.scene.start(SCENES.ShipSelect) },
        { label: 'TITLE', action: () => this.scene.start(SCENES.Title) },
      ],
      { depth: d, size: 8, spacing: 18, armMs: 600 },
    );
  }

  // ---------------------------------------------------------------- pause

  private bindPauseKeys(): void {
    const kb = this.input.keyboard!;
    kb.on('keydown-ESC', () => (this.menuPaused ? this.resume() : this.pause()));
    kb.on('keydown-P', () => (this.menuPaused ? this.resume() : this.pause()));
    // Auto-pause when the window loses focus (alt-tab, clicking elsewhere).
    const onBlur = () => this.pause();
    this.game.events.on(Phaser.Core.Events.BLUR, onBlur);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.game.events.off(Phaser.Core.Events.BLUR, onBlur));
  }

  private pause(): void {
    // Not while dying, on the game-over screen, or choosing an upgrade.
    if (this.menuPaused || this.gameOver || this.paused || !this.player.alive) return;
    this.menuPaused = true;
    this.tweens.pauseAll();
    this.time.paused = true;
    this.anims.pauseAll();

    const cx = GAME_WIDTH / 2;
    const d = DEPTH.ui + 20;
    this.pauseLayer = [
      this.add.rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT, COLOR_NUM.shade, 0.65).setOrigin(0).setDepth(d),
      this.add.text(cx, 250, 'PAUSED', textStyle(24)).setOrigin(0.5).setDepth(d),
    ];
    const choice = { shipId: this.player.ship.id, skin: this.player.skin };
    this.pauseMenu = new Menu(
      this,
      cx,
      310,
      [
        { label: 'RESUME', action: () => this.resume() },
        { label: 'RESTART', action: () => this.leavePause(() => this.scene.restart(choice)) },
        { label: 'QUIT TO TITLE', action: () => this.leavePause(() => this.scene.start(SCENES.Title)) },
      ],
      { depth: d, size: 8, spacing: 20, armMs: 150 },
    );
  }

  private resume(): void {
    if (!this.menuPaused) return;
    this.pauseMenu?.destroy();
    this.pauseMenu = null;
    for (const o of this.pauseLayer) o.destroy();
    this.pauseLayer = [];
    this.menuPaused = false;
    this.tweens.resumeAll();
    this.time.paused = false;
    this.anims.resumeAll();
  }

  /** Unfreeze global state (animations are game-wide) before leaving the scene. */
  private leavePause(go: () => void): void {
    this.resume();
    go();
  }

  // ----------------------------------------------- kills, pickups, bombs

  private onEnemyKilled(e: Enemy): void {
    if (e instanceof Boss) {
      this.scoring.kill(e.def.score * (1 + e.cycle)); // later bosses are worth more
      this.enemyBullets.clear();
      this.cameras.main.flash(250, 255, 255, 255);
      this.enemies.killAll(); // the boss's escorts go down with it
    } else {
      this.scoring.kill(e.def.score);
    }

    // Drops: heals and temporary boosts. Skip ones that would be wasted.
    const drop = DROPS[e.def.id];
    if (Math.random() >= drop.chance) return;
    const p = this.player;
    const adjust: Partial<Record<PickupId, number>> = {};
    if (p.lives >= p.ship.lives) adjust.health = 0;
    if (p.bombs >= MAX_BOMBS) adjust.bomb = 0;
    for (let i = 0; i < drop.count; i++) this.pickups.spawn(e.x, e.y, PickupManager.roll(adjust));
  }

  private collectPickup(id: PickupId, x: number, y: number): void {
    const p = this.player;
    let label = PICKUPS[id].name;
    switch (id) {
      case 'health':
        if (!p.heal()) label = `+${this.scoring.add(SPARE_PICKUP_POINTS)}`;
        break;
      case 'shield':
        p.startBarrier();
        break;
      case 'bomb':
        if (p.bombs >= MAX_BOMBS) label = `+${this.scoring.add(SPARE_PICKUP_POINTS)}`;
        else p.addBomb();
        break;
      case 'rapid':
        p.startRapidFire();
        break;
      case 'double':
        this.scoring.startDoubleScore();
        break;
    }
    this.floatText(x, y - 10, label);
  }

  private useBomb(): void {
    if (this.gameOver || !this.player.useBomb()) return;
    const { x, y } = this.player;
    this.bombTimer = BOMB_CLEAR_MS;
    this.enemyBullets.clear();
    this.enemies.damageAll(BOMB_DAMAGE);
    this.player.invulnerable = Math.max(this.player.invulnerable, BOMB_INVULN_MS);

    // Expanding shockwave ring + flash.
    const ring = this.add.circle(x, y, 10).setStrokeStyle(4, 0xffffff, 1).setDepth(DEPTH.effects);
    const ring2 = this.add.circle(x, y, 10).setStrokeStyle(2, 0x9bd8ff, 1).setDepth(DEPTH.effects);
    this.tweens.add({ targets: ring, radius: 700, alpha: 0, duration: 700, ease: 'Cubic.Out', onComplete: () => ring.destroy() });
    this.tweens.add({ targets: ring2, radius: 500, alpha: 0, duration: 900, delay: 80, ease: 'Cubic.Out', onComplete: () => ring2.destroy() });
    this.cameras.main.flash(180, 255, 255, 255);
    this.cameras.main.shake(350, 0.01);
  }

  /** Small rising label (pickup names, bonus points). */
  private floatText(x: number, y: number, text: string): void {
    const t = this.add.text(x, y, text, textStyle(8, COLORS.gold)).setOrigin(0.5).setDepth(DEPTH.ui);
    this.tweens.add({ targets: t, y: y - 26, alpha: 0, duration: 900, ease: 'Cubic.Out', onComplete: () => t.destroy() });
  }

  // ---------------------------------------------------------------- dev

  private showHelp(): void {
    let lines = 'MOVE ARROWS/WASD  FIRE Z/SPACE\nFOCUS SHIFT  BOMB X  PAUSE ESC';
    if (import.meta.env.DEV) lines += '\n[DEV] 1/2 SHIP  C COLOUR  F3 DEBUG\nV SPRITES  L LAB  B NEXT BOSS';
    const help = this.add
      .text(GAME_WIDTH / 2, GAME_HEIGHT - 8, lines, textStyle(8, COLORS.accent, { align: 'center', lineSpacing: 6 }))
      .setOrigin(0.5, 1)
      .setDepth(DEPTH.ui);
    this.tweens.add({ targets: help, alpha: 0, delay: 6000, duration: 1000, onComplete: () => help.destroy() });
  }

  /** Dev-build only shortcuts. Vite strips this code from production builds. */
  private bindDevKeys(): void {
    if (!import.meta.env.DEV) return;
    const kb = this.input.keyboard!;
    const setShip = (id: ShipClass['id']) => {
      if (this.player.alive) this.player.setShip(id, this.player.skin);
    };
    kb.on('keydown-ONE', () => setShip('fighter'));
    kb.on('keydown-TWO', () => setShip('gunship'));
    kb.on('keydown-C', () => {
      if (!this.player.alive) return;
      this.player.setSkin(SKINS[(SKINS.indexOf(this.player.skin) + 1) % SKINS.length]);
    });
    kb.on('keydown-F3', (e: KeyboardEvent) => {
      e.preventDefault();
      this.debugText.setVisible(!this.debugText.visible);
    });
    kb.on('keydown-V', () => this.scene.start(SCENES.SpriteViewer));
    kb.on('keydown-L', () => this.scene.start(SCENES.BulletLab));
    // Jump to the next boss wave (6, 12, 18, ...).
    kb.on('keydown-B', () => {
      if (this.paused || this.gameOver) return;
      this.enemyBullets.clear();
      this.director.jumpToWave(Math.floor(this.director.wave / 6) * 6 + 6);
    });
  }
}
