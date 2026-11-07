import Phaser from 'phaser';

/**
 * Keyboard bindings, read as simple values each frame.
 *   Move:  WASD / arrow keys
 *   Fire:  Z / Space (hold)
 *   Focus: Shift (hold) - slower movement, visible hitbox, tighter shots
 *   Bomb:  X (wired up in Milestone 6)
 */
export class Controls {
  private readonly k: Record<
    'up' | 'down' | 'left' | 'right' | 'w' | 'a' | 's' | 'd' | 'z' | 'space' | 'shift' | 'x',
    Phaser.Input.Keyboard.Key
  >;

  constructor(scene: Phaser.Scene) {
    const kb = scene.input.keyboard!;
    const K = Phaser.Input.Keyboard.KeyCodes;
    this.k = kb.addKeys({
      up: K.UP, down: K.DOWN, left: K.LEFT, right: K.RIGHT,
      w: K.W, a: K.A, s: K.S, d: K.D,
      z: K.Z, space: K.SPACE, shift: K.SHIFT, x: K.X,
    }) as Controls['k'];
    // Stop the page from scrolling on arrows/space.
    kb.addCapture([K.UP, K.DOWN, K.LEFT, K.RIGHT, K.SPACE]);
  }

  /** -1, 0 or 1 */
  get moveX(): number {
    return (this.k.right.isDown || this.k.d.isDown ? 1 : 0) - (this.k.left.isDown || this.k.a.isDown ? 1 : 0);
  }

  /** -1 (up), 0 or 1 (down) */
  get moveY(): number {
    return (this.k.down.isDown || this.k.s.isDown ? 1 : 0) - (this.k.up.isDown || this.k.w.isDown ? 1 : 0);
  }

  get fire(): boolean {
    return this.k.z.isDown || this.k.space.isDown;
  }

  get focus(): boolean {
    return this.k.shift.isDown;
  }

  get bomb(): boolean {
    return Phaser.Input.Keyboard.JustDown(this.k.x);
  }
}
