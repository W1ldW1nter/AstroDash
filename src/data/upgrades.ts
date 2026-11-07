import Phaser from 'phaser';
import type { Player } from '../entities/Player';

/**
 * Upgrades offered after each boss (pick 1 of 3). They change this run's copy
 * of the ship's stats only. `max` caps how often one can be taken.
 */
export interface Upgrade {
  id: string;
  name: string;
  description: (p: Player) => string;
  /** Frame in the `bonuses` atlas. */
  icon: string;
  max: number;
  available?: (p: Player) => boolean;
  apply: (p: Player) => void;
}

export const UPGRADES: Upgrade[] = [
  {
    id: 'rapid',
    name: 'Rapid Fire',
    description: () => 'Fire 15% faster',
    icon: 'rapid_0',
    max: 4,
    apply: (p) => (p.ship.fireInterval = Math.max(30, p.ship.fireInterval * 0.85)),
  },
  {
    id: 'damage',
    name: 'Heavy Rounds',
    description: () => '+25% bullet damage',
    icon: 'bomb_0',
    max: 4,
    apply: (p) => (p.ship.bulletDamage *= 1.25),
  },
  {
    id: 'spread',
    name: 'Wide Guns',
    description: () => '+2 angled shots',
    icon: 'double_0',
    max: 3,
    apply: (p) => {
      const level = (p.upgrades.spread ?? 0) + 1;
      const angle = p.ship.id === 'gunship' ? 16 + 8 * level : 4 + 5 * level;
      const x = p.ship.id === 'gunship' ? 14 : 10;
      p.ship.shots.push({ x: -x, y: -6, angle: -angle }, { x, y: -6, angle });
      p.ship.focusShots.push({ x: -x / 2, y: -8, angle: -angle / 3 }, { x: x / 2, y: -8, angle: angle / 3 });
    },
  },
  {
    id: 'thrusters',
    name: 'Thrusters',
    description: () => 'Move 12% faster',
    icon: 'rapid_1',
    max: 3,
    apply: (p) => {
      p.ship.speed *= 1.12;
      p.ship.focusSpeed *= 1.12;
    },
  },
  {
    id: 'velocity',
    name: 'Rail Rounds',
    description: () => 'Bullets fly 20% faster',
    icon: 'double_1',
    max: 2,
    apply: (p) => (p.ship.bulletSpeed *= 1.2),
  },
  {
    id: 'life',
    name: 'Repair',
    description: () => '+1 life',
    icon: 'health_0',
    max: 3,
    apply: (p) => {
      p.ship.lives += 1;
      p.lives += 1;
    },
  },
  {
    id: 'shield',
    name: 'Shield',
    description: (p) => (p.ship.shield ? 'Shield recharges 25% faster' : 'Gain a shield that absorbs 1 hit (12s recharge)'),
    icon: 'shield_0',
    max: 3,
    apply: (p) => {
      if (p.ship.shield) p.ship.shield.rechargeMs = Math.max(2000, p.ship.shield.rechargeMs * 0.75);
      else p.grantShield(12000);
    },
  },
];

/** Three different upgrades the player can still take. */
export function rollUpgrades(p: Player, count = 3): Upgrade[] {
  const options = UPGRADES.filter((u) => (p.upgrades[u.id] ?? 0) < u.max && (u.available?.(p) ?? true));
  return Phaser.Utils.Array.Shuffle([...options]).slice(0, count);
}

export function applyUpgrade(p: Player, u: Upgrade): void {
  u.apply(p);
  p.upgrades[u.id] = (p.upgrades[u.id] ?? 0) + 1;
}
