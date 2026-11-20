// state.js — the single game state object, plus save/load.
// Plain data and small helpers only; no rendering, no three.js here.
// Every module reads and writes these fields (see the contract).

import { CONFIG } from './config.js';

// Rank for a given RP total, from the CONFIG rank tiers.
export function rankForRp(rp) {
  let rank = CONFIG.ranks[0].name;
  for (const tier of CONFIG.ranks) {
    if (rp >= tier.rp) rank = tier.name;
  }
  return rank;
}

// Standing tier name for a district standing value (-100..100).
export function tierForStanding(value) {
  for (const tier of CONFIG.standing.tiers) {
    if (value >= tier.min) return tier.name;
  }
  return 'HOSTILE';
}

// Build a brand-new game state with the contract's defaults.
export function createGameState() {
  const districts = {};
  for (const d of CONFIG.districts) districts[d.name] = CONFIG.standing.start;

  const ammo = {};
  const reserve = {};
  for (const w of CONFIG.weapons) {
    ammo[w.id] = w.id === 'pistol' ? w.mag : 0;
    reserve[w.id] = w.id === 'pistol' ? w.reserve : 0;
  }

  return {
    // Who the player is and where they stand.
    player: {
      name: CONFIG.player.name,
      x: 10,
      z: 40,
      heading: 0,
      speedKmh: 0,
      health: CONFIG.player.health,
      armour: CONFIG.player.armour,
      money: CONFIG.player.money,
      onFoot: true,
      currentCar: null,
    },

    // Heat from the law.
    wanted: {
      level: 0,
      heat: 0,
      crime: '',
    },

    // The in-game clock: day 1, 16:20 (980 minutes).
    clock: {
      day: CONFIG.clock.startDay,
      minutes: CONFIG.clock.startMinutes,
    },

    radio: {
      station: 0,
      muted: false,
    },

    // Story progress: mission index 0-9, current stage, finished ids.
    missions: {
      current: 0,
      stage: 0,
      done: [],
      ratings: {},
      objective: '',
      objectivePos: { x: 0, z: 0 },
      markerVisible: false,
    },

    // How each district feels about the player (-100..100, starts at 50).
    districts,

    // Seconds left on each crew ability's cooldown.
    crew: {
      luz: 0,
      celia: 0,
      tito: 0,
      marlon: 0,
    },

    // Weapons: selected index, owned ids, ammo in mag / in reserve.
    weapons: {
      current: 1, // pistol
      owned: ['fists', 'pistol'],
      ammo,
      reserve,
    },

    // Side activities.
    collectibles: {
      geckosFound: [],
      jumpsDone: [],
      exportsDone: [],
      safehouseOwned: false,
    },

    // Garage upgrades per owned car id: engine/armour 0-3, nitro bool.
    garage: {
      upgrades: {},
    },

    // Three save slots, each a saved state or null.
    saves: {
      1: null,
      2: null,
      3: null,
    },

    // Career numbers.
    stats: {
      respect: 0,
      rp: 0,
      rank: 'ROOKIE',
      kills: 0,
      missionsDone: 0,
      distanceDriven: 0,
      moneyEarned: 0,
      timePlayed: 0,
      carsStolen: 0,
      copsEscaped: 0,
      longestJump: 0,
    },

    // UI flags.
    flags: {
      title: true,
      paused: false,
      phoneOpen: false,
      wheelOpen: false,
      garageOpen: false,
      dialogue: null,
      muted: false,
    },
  };
}

// newGame is the public factory name used across the codebase.
export function newGame() {
  return createGameState();
}

// Award RP (for example +250 per mission) and refresh the rank tier.
export function addRp(state, amount) {
  state.stats.rp += amount;
  state.stats.rank = rankForRp(state.stats.rp);
  return state.stats.rank;
}

// Deep-copy a state through JSON (the state holds plain data only).
export function serialize(state) {
  return JSON.stringify(state);
}

// Rebuild a state from serialized data, filling any missing field with
// the fresh default so older saves still load.
export function deserialize(data) {
  const fresh = createGameState();
  const parsed = typeof data === 'string' ? JSON.parse(data) : data;
  if (!parsed || typeof parsed !== 'object') return fresh;
  for (const key of Object.keys(fresh)) {
    if (parsed[key] !== undefined) fresh[key] = parsed[key];
  }
  // Shallow-merge nested objects so a partial save keeps defaults.
  for (const key of ['player', 'wanted', 'clock', 'radio', 'missions', 'crew', 'weapons', 'collectibles', 'garage', 'saves', 'stats', 'flags']) {
    if (parsed[key] && typeof parsed[key] === 'object') {
      fresh[key] = { ...fresh[key], ...parsed[key] };
    }
  }
  return fresh;
}

export default createGameState;
