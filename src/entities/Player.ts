import Phaser from 'phaser';
import { GAME_HEIGHT, GAME_WIDTH } from '../config';
import type { Controls } from '../input/Controls';
import { SHIP_CLASSES, type ShipClass, type Skin } from '../data/ships';
import type { PlayerBullets } from './PlayerBullets';
import { BARRIER_MS, MAX_BOMBS, RAPID_FIRE_FACTOR, RAPID_FIRE_MS, START_BOMBS } from '../data/pickups';

/** How far the sprite may poke past the screen edge (keeps the hitbox reachable near walls). */
const EDGE_OVERHANG = 6;
/** Grace period after the shield absorbs a hit. */
const SHIELD_BREAK_INVULN_MS = 800;
/** Grace period after respawning. */
const RESPAWN_INVULN_MS = 2500;
const BLINK_MS = 70;

export type HitResult = 'ignored' | 'shield' | 'life' | 'gameover';

/**
 * The player's ship. A container holding exhaust flames, the hull sprite,
 * the shield bubble and the focus-mode visuals (spinning ring + hitbox dot).
 * Movement is direct (no physics/inertia): snappy, as bullet hells need.
 */
export class Player extends Phaser.GameObjects.Container {
  ship!: ShipClass;
  skin!: Skin;
  focusing = false;

  lives = 0;
  alive = true;
  shieldUp = false;
  /** ms left until the shield is back (0 when up or the ship has none). */
  shieldRecharge = 0;
  invulnerable = 0;
  /** How many times each upgrade has been taken this run. */
  upgrades: Record<string, number> = {};

  bombs = START_BOMBS;
  /** ms left on temporary boosts (0 = inactive). */
  rapidFire = 0;
  barrier = 0;

  private hull!: Phaser.GameObjects.Image;
  private exhausts: Phaser.GameObjects.Sprite[] = [];
  private ring!: Phaser.GameObjects.Image;
  private hitboxDot!: Phaser.GameObjects.Image;
  private shieldSprite!: Phaser.GameObjects.Image;
  private barrierSprite!: Phaser.GameObjects.Image;
  private fireCooldown = 0;

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    private readonly bullets: PlayerBullets,
    shipId: ShipClass['id'] = 'fighter',
    skin: Skin = 'blue',
  ) {
    super(scene, x, y);
    this.setShip(shipId, skin);
    scene.add.existing(this);
  }

  /** Swap hull/stats and reset lives/shield. Rebuilds the child sprites so exhaust layout matches the hull. */
  setShip(shipId: ShipClass['id'], skin: Skin): void {
    // Own copy of the stats, so upgrades change this run only.
    this.ship = structuredClone(SHIP_CLASSES[shipId]);
    this.upgrades = {};
    this.buildVisuals(skin);

    this.lives = this.ship.lives;
    this.alive = true;
    this.invulnerable = 0;
    this.setShieldUp(this.ship.shield !== null);
    this.shieldRecharge = 0;
    this.bombs = START_BOMBS;
    this.rapidFire = 0;
    this.barrier = 0;
    this.barrierSprite.setVisible(false);
  }

  // ------------------------------------------------------------ pickups

  addBomb(): void {
    this.bombs = Math.min(MAX_BOMBS, this.bombs + 1);
  }

  /** Spend a bomb; returns false if none left or the ship is down. */
  useBomb(): boolean {
    if (!this.alive || this.bombs <= 0) return false;
    this.bombs--;
    return true;
  }

  /** Heal one life; returns false if already at max. */
  heal(): boolean {
    if (this.lives >= this.ship.lives) return false;
    this.lives++;
    return true;
  }

  startRapidFire(): void {
    this.rapidFire = RAPID_FIRE_MS;
  }

  startBarrier(): void {
    this.barrier = BARRIER_MS;
    this.barrierSprite.setVisible(true).setScale(0.6);
    this.scene.tweens.add({ targets: this.barrierSprite, scale: 1, duration: 180, ease: 'Back.Out' });
  }

  /** Change colour only; keeps lives, shield state and upgrades. */
  setSkin(skin: Skin): void {
    this.buildVisuals(skin);
    this.shieldSprite.setVisible(this.shieldUp);
  }

  private buildVisuals(skin: Skin): void {
    this.skin = skin;
    this.removeAll(true);
    this.exhausts = [];

    // Exhaust first so it renders under the hull. Blue hulls get a blue main flame.
    const blue = skin === 'blue' || skin === 'silver';
    for (const e of this.ship.exhaust) {
      const anim = e.kind === 'twin' ? 'exhaust_red_s' : blue ? 'exhaust_blue_l' : 'exhaust_red_l';
      const s = this.scene.add.sprite(e.x, e.y, 'exhaust').play({ key: anim, startFrame: Phaser.Math.Between(0, 3) });
      s.setFlipY(e.flipY ?? false);
      this.exhausts.push(s);
    }
    this.hull = this.scene.add.image(0, 0, 'player', `${this.ship.frame}_${skin}`);

    // Shield bubble over the hull; focus visuals on top, centered on the hitbox.
    this.shieldSprite = this.scene.add.image(0, 0, 'barrier', 'cyan').setAlpha(0.45).setVisible(false);
    this.barrierSprite = this.scene.add.image(0, 0, 'barrier', 'green').setAlpha(0.5).setVisible(this.barrier > 0);
    this.ring = this.scene.add.image(0, this.ship.hitboxOffsetY, 'focus_ring').setVisible(false);
    this.hitboxDot = this.scene.add.image(0, this.ship.hitboxOffsetY, 'hitbox').setVisible(false);

    this.add([...this.exhausts, this.hull, this.shieldSprite, this.barrierSprite, this.ring, this.hitboxDot]);
    this.setSize(this.hull.width, this.hull.height);
  }

  /** World-space hitbox for collision checks. */
  get hitbox(): { x: number; y: number; radius: number } {
    return { x: this.x, y: this.y + this.ship.hitboxOffsetY, radius: this.ship.hitboxRadius };
  }

  /** 0..1 shield charge for the HUD (1 = up). */
  get shieldCharge(): number {
    if (!this.ship.shield) return 0;
    return this.shieldUp ? 1 : 1 - this.shieldRecharge / this.ship.shield.rechargeMs;
  }

  /** Apply one hit. The shield absorbs it if up; otherwise a life is lost. */
  takeHit(): HitResult {
    if (!this.alive || this.invulnerable > 0) return 'ignored';
    // The temporary barrier pops first, then the ship's own shield.
    if (this.barrier > 0) {
      this.barrier = 0;
      this.barrierSprite.setVisible(false);
      this.invulnerable = SHIELD_BREAK_INVULN_MS;
      return 'shield';
    }
    if (this.shieldUp && this.ship.shield) {
      this.setShieldUp(false);
      this.shieldRecharge = this.ship.shield.rechargeMs;
      this.invulnerable = SHIELD_BREAK_INVULN_MS;
      return 'shield';
    }
    this.lives--;
    this.alive = false;
    this.setVisible(false);
    return this.lives > 0 ? 'life' : 'gameover';
  }

  respawn(x: number, y: number): void {
    this.setPosition(x, y).setVisible(true).setAlpha(1);
    this.alive = true;
    this.invulnerable = RESPAWN_INVULN_MS;
    this.fireCooldown = 0;
    this.bombs = Math.max(this.bombs, START_BOMBS); // top up bombs after losing a life
    if (this.ship.shield) {
      this.setShieldUp(true);
      this.shieldRecharge = 0;
    }
  }

  update(deltaMs: number, controls: Controls): void {
    if (!this.alive) return;
    const dt = deltaMs / 1000;
    this.focusing = controls.focus;

    // --- movement: normalized so diagonals aren't faster
    let mx = controls.moveX;
    let my = controls.moveY;
    if (mx !== 0 && my !== 0) {
      mx *= Math.SQRT1_2;
      my *= Math.SQRT1_2;
    }
    const speed = this.focusing ? this.ship.focusSpeed : this.ship.speed;
    const halfW = this.hull.width / 2 - EDGE_OVERHANG;
    const halfH = this.hull.height / 2 - EDGE_OVERHANG;
    this.x = Phaser.Math.Clamp(this.x + mx * speed * dt, halfW, GAME_WIDTH - halfW);
    this.y = Phaser.Math.Clamp(this.y + my * speed * dt, halfH, GAME_HEIGHT - halfH);

    // --- exhaust reacts to thrust: longer flying up, shorter flying down
    const flameScale = my < 0 ? 1.3 : my > 0 ? 0.7 : 1;
    for (const e of this.exhausts) e.setScale(1, Phaser.Math.Linear(e.scaleY, flameScale, Math.min(1, dt * 12)));

    // --- focus visuals
    this.ring.setVisible(this.focusing);
    this.hitboxDot.setVisible(this.focusing);
    if (this.focusing) this.ring.rotation += dt * 3;

    // --- shield recharge
    if (!this.shieldUp && this.ship.shield) {
      this.shieldRecharge -= deltaMs;
      if (this.shieldRecharge <= 0) {
        this.shieldRecharge = 0;
        this.setShieldUp(true);
        this.shieldSprite.setScale(0.6);
        this.scene.tweens.add({ targets: this.shieldSprite, scale: 1, duration: 180, ease: 'Back.Out' });
      }
    }
    if (this.shieldUp) this.shieldSprite.setAlpha(0.38 + Math.sin(this.scene.time.now / 220) * 0.08);

    // --- temporary boosts
    if (this.rapidFire > 0) this.rapidFire = Math.max(0, this.rapidFire - deltaMs);
    if (this.barrier > 0) {
      this.barrier = Math.max(0, this.barrier - deltaMs);
      // Blink during the last 2 seconds as a warning.
      const fading = this.barrier < 2000 && Math.floor(this.barrier / 120) % 2 === 0;
      this.barrierSprite.setVisible(this.barrier > 0).setAlpha(fading ? 0.15 : 0.5);
    }

    // --- invulnerability blink
    if (this.invulnerable > 0) {
      this.invulnerable -= deltaMs;
      this.hull.setAlpha(this.invulnerable > 0 && Math.floor(this.invulnerable / BLINK_MS) % 2 === 0 ? 0.25 : 1);
    }

    // --- shooting
    this.fireCooldown -= deltaMs;
    if (controls.fire && this.fireCooldown <= 0) {
      this.fireVolley();
      // Carry over the remainder so fire rate stays exact regardless of frame timing.
      this.fireCooldown += this.ship.fireInterval / (this.rapidFire > 0 ? RAPID_FIRE_FACTOR : 1);
      if (this.fireCooldown < 0) this.fireCooldown = 0;
    } else if (!controls.fire && this.fireCooldown < 0) {
      this.fireCooldown = 0;
    }
  }

  /** Give the ship a shield (if it had none) or keep the current one; raises it immediately. */
  grantShield(rechargeMs: number): void {
    if (!this.ship.shield) this.ship.shield = { rechargeMs };
    this.shieldRecharge = 0;
    this.setShieldUp(true);
  }

  private setShieldUp(up: boolean): void {
    this.shieldUp = up;
    this.shieldSprite.setVisible(up);
  }

  private fireVolley(): void {
    const s = this.ship;
    for (const shot of this.focusing ? s.focusShots : s.shots) {
      this.bullets.fire(this.x + shot.x, this.y + shot.y, shot.angle, s.bulletSpeed, s.bulletFrame, s.bulletDamage, s.bulletScale);
    }
  }
}
