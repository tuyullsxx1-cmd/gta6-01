// garage.js — Celia's Garage: engine, armour, and nitro upgrades for
// every car Rook owns, plus taking a car out onto the street. The garage
// only opens on foot while standing at the garage itself (key G). Upgrade
// prices climb with the level already fitted, and loyal districts knock
// 10% off the bill. Each upgrade changes how the car drives: engine adds
// top speed, armour soaks damage, nitro unlocks the Shift boost.

function clamp(v, lo, hi) {
  return v < lo ? lo : v > hi ? hi : v;
}

function tierForStanding(value) {
  if (value >= 75) return 'LOYAL';
  if (value >= 50) return 'WARM';
  if (value >= 25) return 'NEUTRAL';
  if (value >= 0) return 'COLD';
  return 'HOSTILE';
}

const TIER_PRICE = { LOYAL: 0.9, WARM: 0.95, NEUTRAL: 1.0, COLD: 1.05, HOSTILE: 1.15 };

// Price ladders: index = the level being bought (0 -> level 1, etc.).
export const UPGRADE_PRICES = {
  engine: [400, 800, 1400],
  armour: [300, 600, 1000],
  nitro: [700],
};

export const UPGRADE_MAX = { engine: 3, armour: 3, nitro: 1 };

export const UPGRADE_NAMES = {
  engine: 'Engine',
  armour: 'Armour',
  nitro: 'Nitro',
};

const GARAGE_SPOT = { x: 24, z: -160, radius: 14 };

// Fallback garage position when the city module has not registered its
// own spawn points yet. The city module may override via state.spawnPoints.
function garagePosition(state) {
  const spots = state.spawnPoints || state.spawns;
  if (spots && spots.garage && typeof spots.garage.x === 'number') return spots.garage;
  return GARAGE_SPOT;
}

function ensureGarage(state) {
  if (!state.garage) state.garage = { upgrades: {}, ownedCars: [] };
  if (!state.garage.upgrades || typeof state.garage.upgrades !== 'object') state.garage.upgrades = {};
  if (!Array.isArray(state.garage.ownedCars)) state.garage.ownedCars = [];
  return state.garage;
}

function ensureUpgrades(garage, carId) {
  if (!garage.upgrades[carId]) garage.upgrades[carId] = { engine: 0, armour: 0, nitro: false };
  const u = garage.upgrades[carId];
  if (typeof u.engine !== 'number') u.engine = 0;
  if (typeof u.armour !== 'number') u.armour = 0;
  if (typeof u.nitro !== 'boolean') u.nitro = false;
  return u;
}

export function createGarage(state, bus) {
  const garage = ensureGarage(state);
  let garageOpen = false;

  function districtPriceMul() {
    const d = state.districts;
    const p = state.player || {};
    const name =
      (typeof p.district === 'string' && p.district) ||
      (d && typeof d.current === 'string' ? d.current : null) ||
      'Centro Alba';
    const standing = d && d.standing && typeof d.standing[name] === 'number' ? d.standing[name] : 50;
    return TIER_PRICE[tierForStanding(standing)];
  }

  function priceFor(kind, level) {
    const ladder = UPGRADE_PRICES[kind];
    if (!ladder || level >= ladder.length) return null;
    return Math.round(ladder[level] * districtPriceMul());
  }

  function isAtGarage() {
    const p = state.player || {};
    if (typeof p.x !== 'number' || typeof p.z !== 'number') return false;
    const g = garagePosition(state);
    const d = Math.sqrt((p.x - g.x) * (p.x - g.x) + (p.z - g.z) * (p.z - g.z));
    return d <= (g.radius || GARAGE_SPOT.radius);
  }

  function canOpen() {
    const p = state.player || {};
    if (p.onFoot === false) return { ok: false, reason: 'Get out of the car first.' };
    if (!isAtGarage()) return { ok: false, reason: 'You need to be at Celia’s Garage.' };
    return { ok: true };
  }

  function open() {
    const check = canOpen();
    if (!check.ok) {
      if (bus) bus.emit('message', { text: check.reason });
      return check;
    }
    garageOpen = true;
    if (state.flags) state.flags.garageOpen = true;
    if (bus) bus.emit('garage-opened', { at: garagePosition(state) });
    return { ok: true };
  }

  function close() {
    garageOpen = false;
    if (state.flags) state.flags.garageOpen = false;
    if (bus) bus.emit('garage-closed', {});
  }

  function toggle() {
    if (garageOpen) close();
    else open();
    return garageOpen;
  }

  function addOwnedCar(carId, name) {
    if (!carId) return false;
    const found = garage.ownedCars.find((c) => c.id === carId);
    if (found) return false;
    garage.ownedCars.push({ id: carId, name: name || carId });
    ensureUpgrades(garage, carId);
    if (bus) bus.emit('car-acquired', { id: carId, name: name || carId });
    return true;
  }

  function buyUpgrade(carId, kind) {
    if (!UPGRADE_PRICES[kind]) return { ok: false, reason: 'unknown upgrade' };
    const upgrades = ensureUpgrades(garage, carId);
    const currentLevel = kind === 'nitro' ? (upgrades.nitro ? 1 : 0) : upgrades[kind];
    if (currentLevel >= UPGRADE_MAX[kind]) return { ok: false, reason: 'already maxed' };
    const price = priceFor(kind, currentLevel);
    const player = state.player || {};
    const money = typeof player.money === 'number' ? player.money : 0;
    if (money < price) return { ok: false, reason: 'not enough cash', price };
    player.money = money - price;
    if (kind === 'nitro') upgrades.nitro = true;
    else upgrades[kind] = currentLevel + 1;
    if (bus) {
      bus.emit('garage-upgraded', { carId, kind, level: kind === 'nitro' ? 1 : upgrades[kind], price });
      bus.emit('message', {
        text:
          UPGRADE_NAMES[kind] +
          ' fitted to ' +
          carId +
          (kind === 'nitro' ? '' : ' (level ' + upgrades[kind] + ')') +
          ' — $' +
          price +
          '.',
      });
    }
    return { ok: true, price, level: kind === 'nitro' ? 1 : upgrades[kind] };
  }

  // Effective stats for a car after upgrades. The driving module reads
  // these instead of the base vehicle definition.
  function getCarStats(carId) {
    const u = ensureUpgrades(garage, carId);
    return {
      carId,
      engine: u.engine,
      armour: u.armour,
      nitro: u.nitro,
      topSpeedMul: 1 + u.engine * 0.12,
      accelMul: 1 + u.engine * 0.1,
      damageReduction: u.armour * 0.12,
      nitroBoost: u.nitro ? 1.35 : 1,
    };
  }

  function takeOut(carId) {
    const owned = garage.ownedCars.find((c) => c.id === carId);
    if (!owned) return { ok: false, reason: 'you do not own that car' };
    const player = state.player || {};
    if (player.onFoot === false && player.currentCar) {
      return { ok: false, reason: 'you are already in a car' };
    }
    const stats = getCarStats(carId);
    if (bus) {
      bus.emit('car-taken-out', { carId, name: owned.name, stats });
      bus.emit('message', { text: 'Took the ' + owned.name + ' out of the garage.' });
    }
    return { ok: true, carId, name: owned.name, stats };
  }

  function panelData() {
    return {
      open: garageOpen,
      atGarage: isAtGarage(),
      cars: garage.ownedCars.map((c) => ({
        id: c.id,
        name: c.name,
        upgrades: { ...ensureUpgrades(garage, c.id) },
        stats: getCarStats(c.id),
        prices: {
          engine: priceFor('engine', ensureUpgrades(garage, c.id).engine),
          armour: priceFor('armour', ensureUpgrades(garage, c.id).armour),
          nitro: ensureUpgrades(garage, c.id).nitro ? null : priceFor('nitro', 0),
        },
      })),
      priceMul: districtPriceMul(),
    };
  }

  function handleKey(code) {
    if (code === 'KeyG') {
      toggle();
      return true;
    }
    if (code === 'Escape' && open) {
      close();
      return true;
    }
    return false;
  }

  return {
    update() {
      // The garage has no per-frame work; it reacts to keys and purchases.
    },
    open,
    close,
    toggle,
    canOpen,
    isOpen() {
      return garageOpen;
    },
    isAtGarage,
    garagePosition: () => garagePosition(state),
    buyUpgrade,
    priceFor,
    getUpgrades(carId) {
      return { ...ensureUpgrades(garage, carId) };
    },
    getCarStats,
    addOwnedCar,
    takeOut,
    ownedCars() {
      return garage.ownedCars.map((c) => ({ ...c }));
    },
    panelData,
    handleKey,
  };
}
