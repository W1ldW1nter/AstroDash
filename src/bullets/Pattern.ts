import type { BulletStyle } from './BulletStyles';

/**
 * A bullet pattern, as data. One pattern = a series of volleys; each volley
 * fires `count` bullets in a shape. Combine several patterns on one emitter
 * for compound attacks (e.g. two spirals turning opposite ways).
 *
 * Angles are degrees, Phaser convention: 0 = right, 90 = down, 180 = left.
 */
export interface PatternDef {
  style: BulletStyle;
  /**
   * ring:   `count` bullets evenly around 360°
   * fan:    `count` bullets evenly across `spread` degrees, centered on the aim
   * random: `count` bullets at random angles within `spread`
   */
  shape: 'ring' | 'fan' | 'random';
  count: number;
  /** Arc width in degrees for fan/random. */
  spread?: number;
  /** Base direction in degrees, or 'player' to aim at the player. Default 90 (straight down). */
  aim?: number | 'player';
  /** Re-aim at the player every volley (true) or only on the first (false). Default true. */
  trackEachVolley?: boolean;

  /** px/sec. A [min, max] pair picks randomly per bullet. */
  speed: number | [number, number];
  /** Fire this many copies per volley, each `layerSpeedStep` px/sec faster (makes "walls"). */
  layers?: number;
  layerSpeedStep?: number;
  accel?: number;
  angularVelocity?: number;
  minSpeed?: number;
  maxSpeed?: number;

  /** Number of volleys; 0 = forever. */
  volleys: number;
  /** ms between volleys */
  interval: number;
  /** Degrees added to the aim after each volley: the spiral maker. */
  turnPerVolley?: number;
  /** ms before the first volley. */
  delay?: number;
  /** Spawn bullets this far from the source center (px), along their direction. */
  offset?: number;
}
