import { SHIP_CLASSES, SKINS, type ShipClass, type Skin } from './ships';

const KEY = 'astrodash.lastShip.v1';

export interface ShipChoice {
  shipId: ShipClass['id'];
  skin: Skin;
}

/** The ship and colour picked last time (a per-browser convenience; falls back to Fighter/blue). */
export function loadShipChoice(): ShipChoice {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? 'null') as Partial<ShipChoice> | null;
    if (raw && raw.shipId && raw.shipId in SHIP_CLASSES && raw.skin && SKINS.includes(raw.skin)) {
      return { shipId: raw.shipId, skin: raw.skin };
    }
  } catch {
    /* storage unavailable or corrupt */
  }
  return { shipId: 'fighter', skin: 'blue' };
}

export function saveShipChoice(choice: ShipChoice): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(choice));
  } catch {
    /* storage blocked: not remembering is fine */
  }
}
