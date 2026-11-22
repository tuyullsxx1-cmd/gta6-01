// Garage: engine, armour and nitro upgrades per owned car, plus repairs.
// Prices scale with district standing through priceFor.
import { GARAGE } from './config.js';
import { priceFor } from './districts.js';

export const UPGRADE_NAMES = { engine: 'Engine', armour: 'Armour', nitro: 'Nitro' };

export function upgradeCost(state, kind, x, z) {
  const level = state.garage[kind];
  const table = GARAGE[kind];
  if (level >= table.length - 1) return null;
  return priceFor(state, table[level + 1], x, z);
}

export function buyUpgrade(state, kind, x, z) {
  const cost = upgradeCost(state, kind, x, z);
  if (cost === null) return { ok: false, why: 'maxed out' };
  if (state.money < cost) return { ok: false, why: 'not enough money' };
  state.money -= cost;
  state.garage[kind] += 1;
  if (state.car) state.car.upgrades = { ...state.garage };
  return { ok: true, level: state.garage[kind], cost };
}

export function repairCost(state, x, z) {
  if (!state.car || state.car.damage <= 0) return 0;
  return priceFor(state, Math.round(state.car.damage * 2), x, z);
}

export function repair(state, x, z) {
  const cost = repairCost(state, x, z);
  if (cost === 0) return { ok: false, why: 'nothing to repair' };
  if (state.money < cost) return { ok: false, why: 'not enough money' };
  state.money -= cost;
  state.car.damage = 0;
  return { ok: true, cost };
}
