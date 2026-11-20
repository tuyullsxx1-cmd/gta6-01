// save.js — 3 save slots plus a local top-5 leaderboard for MARAVILLA.
// Written from the prose design spec. Slots persist in localStorage; a
// round-trip restores money, mission progress, standing and collectibles
// exactly. The leaderboard is local only — no network, ever.

const SLOT_KEY = (n) => `maravilla-save-${n}`;
const BOARD_KEY = 'maravilla-leaderboard';
const MAX_SLOTS = 3;
const BOARD_SIZE = 5;

function storageAvailable() {
  try {
    return typeof localStorage !== 'undefined' && localStorage !== null;
  } catch (e) {
    return false;
  }
}

function readStore(key) {
  if (!storageAvailable()) return null;
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch (e) {
    return null;
  }
}

function writeStore(key, value) {
  if (!storageAvailable()) return false;
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch (e) {
    return false;
  }
}

// Snapshot the fields a round-trip must restore exactly. Numbers are kept
// as plain numbers; lists are copied so later play never mutates a save.
function snapshot(state) {
  const s = state || {};
  return {
    version: 1,
    savedAt: (s.clock && s.clock.day) || 1,
    day: (s.clock && s.clock.day) || 1,
    minutes: (s.clock && s.clock.minutes) || 980,
    player: {
      x: (s.player && s.player.x) || 0,
      z: (s.player && s.player.z) || 0,
      heading: (s.player && s.player.heading) || 0,
      health: (s.player && s.player.health) || 100,
      armour: (s.player && s.player.armour) || 25,
      money: (s.player && s.player.money) || 0,
      onFoot: s.player ? !!s.player.onFoot : true,
      currentCar: (s.player && s.player.currentCar) || null,
      name: (s.player && s.player.name) || 'Rico "Rook" Vega',
    },
    wanted: {
      level: (s.wanted && s.wanted.level) || 0,
      heat: (s.wanted && s.wanted.heat) || 0,
      crime: (s.wanted && s.wanted.crime) || '',
    },
    missions: {
      current: (s.missions && s.missions.current) || 0,
      stage: (s.missions && s.missions.stage) || 0,
      done: Array.isArray(s.missions && s.missions.done) ? [...s.missions.done] : [],
      ratings: s.missions && s.missions.ratings ? { ...s.missions.ratings } : {},
    },
    districts: {
      standing: s.districts && s.districts.standing ? { ...s.districts.standing } : {},
    },
    collectibles: {
      geckosFound: Array.isArray(s.collectibles && s.collectibles.geckosFound) ? [...s.collectibles.geckosFound] : [],
      jumpsDone: Array.isArray(s.collectibles && s.collectibles.jumpsDone) ? [...s.collectibles.jumpsDone] : [],
      exportsDone: Array.isArray(s.collectibles && s.collectibles.exportsDone) ? [...s.collectibles.exportsDone] : [],
      safehouseOwned: !!(s.collectibles && s.collectibles.safehouseOwned),
    },
    garage: {
      upgrades: s.garage && s.garage.upgrades ? JSON.parse(JSON.stringify(s.garage.upgrades)) : {},
    },
    weapons: {
      current: (s.weapons && s.weapons.current) || 0,
      owned: Array.isArray(s.weapons && s.weapons.owned) ? [...s.weapons.owned] : ['fists', 'pistol'],
      ammo: s.weapons && s.weapons.ammo ? { ...s.weapons.ammo } : {},
    },
    stats: {
      respect: (s.stats && s.stats.respect) || 0,
      rp: (s.stats && s.stats.rp) || 0,
      rank: (s.stats && s.stats.rank) || 'ROOKIE',
      kills: (s.stats && s.stats.kills) || 0,
      missionsDone: (s.stats && s.stats.missionsDone) || 0,
      distanceDriven: (s.stats && s.stats.distanceDriven) || 0,
      moneyEarned: (s.stats && s.stats.moneyEarned) || 0,
      timePlayed: (s.stats && s.stats.timePlayed) || 0,
    },
  };
}

function restore(state, snap) {
  if (!snap || snap.version !== 1) return false;
  state.clock = state.clock || {};
  state.clock.day = snap.day;
  state.clock.minutes = snap.minutes;
  // Mutate the live objects in place instead of replacing them: the
  // player, police and districts modules hold references to these
  // objects and would keep moving the stale ones after a load.
  if (!state.player) state.player = {};
  Object.assign(state.player, snap.player);
  if (!state.wanted) state.wanted = {};
  Object.assign(state.wanted, snap.wanted);
  state.missions = state.missions || {};
  state.missions.current = snap.missions.current;
  state.missions.stage = snap.missions.stage;
  state.missions.done = [...snap.missions.done];
  state.missions.ratings = { ...snap.missions.ratings };
  state.districts = state.districts || {};
  if (!state.districts.standing) state.districts.standing = {};
  Object.assign(state.districts.standing, snap.districts.standing);
  state.collectibles = state.collectibles || {};
  state.collectibles.geckosFound = [...snap.collectibles.geckosFound];
  state.collectibles.jumpsDone = [...snap.collectibles.jumpsDone];
  state.collectibles.exportsDone = [...snap.collectibles.exportsDone];
  state.collectibles.safehouseOwned = snap.collectibles.safehouseOwned;
  state.garage = state.garage || {};
  state.garage.upgrades = JSON.parse(JSON.stringify(snap.garage.upgrades));
  state.weapons = state.weapons || {};
  state.weapons.current = snap.weapons.current;
  state.weapons.owned = [...snap.weapons.owned];
  state.weapons.ammo = { ...snap.weapons.ammo };
  if (!state.stats) state.stats = {};
  Object.assign(state.stats, snap.stats);
  return true;
}

function validSlot(n) {
  const num = Number(n);
  return num >= 1 && num <= MAX_SLOTS ? num : null;
}

// Save the current state into slot n (1-3). Returns the saved record or
// null when storage is unavailable.
export function saveSlot(n, state) {
  const slot = validSlot(n);
  if (!slot) return null;
  const snap = snapshot(state);
  snap.slot = slot;
  snap.savedLabel = `Day ${snap.day} — $${snap.player.money} — ${snap.stats.rank}`;
  if (!writeStore(SLOT_KEY(slot), snap)) return null;
  return snap;
}

// Load slot n into the given state object. Returns true on success.
export function loadSlot(n, state) {
  const slot = validSlot(n);
  if (!slot || !state) return false;
  const snap = readStore(SLOT_KEY(slot));
  if (!snap) return false;
  return restore(state, snap);
}

// List all three slots: { slot, filled, label, money, rank, day } each.
export function listSlots() {
  const out = [];
  for (let n = 1; n <= MAX_SLOTS; n += 1) {
    const snap = readStore(SLOT_KEY(n));
    if (!snap) {
      out.push({ slot: n, filled: false, label: 'Empty slot', money: 0, rank: 'ROOKIE', day: 1 });
    } else {
      out.push({
        slot: n,
        filled: true,
        label: snap.savedLabel || `Day ${snap.day}`,
        money: snap.player.money,
        rank: snap.stats.rank,
        day: snap.day,
        missionsDone: snap.stats.missionsDone,
        rp: snap.stats.rp,
      });
    }
  }
  return out;
}

export function deleteSlot(n) {
  const slot = validSlot(n);
  if (!slot || !storageAvailable()) return false;
  try {
    localStorage.removeItem(SLOT_KEY(slot));
    return true;
  } catch (e) {
    return false;
  }
}

// --- Local top-5 leaderboard ---------------------------------------------
// Entries: { name, rp, money, missionsDone, day }. Ranked by RP, then
// money. Stored locally; nothing leaves the machine.

export function loadLeaderboard() {
  const board = readStore(BOARD_KEY);
  return Array.isArray(board) ? board.slice(0, BOARD_SIZE) : [];
}

export function recordScore(state, name) {
  const entry = {
    name: name || ((state.player && state.player.name) || 'Rook'),
    rp: (state.stats && state.stats.rp) || 0,
    money: (state.player && state.player.money) || 0,
    missionsDone: (state.stats && state.stats.missionsDone) || 0,
    day: (state.clock && state.clock.day) || 1,
  };
  const board = loadLeaderboard();
  board.push(entry);
  board.sort((a, b) => b.rp - a.rp || b.money - a.money);
  const top = board.slice(0, BOARD_SIZE);
  writeStore(BOARD_KEY, top);
  return { board: top, rank: top.indexOf(entry) + 1 };
}

export function clearLeaderboard() {
  if (!storageAvailable()) return false;
  try {
    localStorage.removeItem(BOARD_KEY);
    return true;
  } catch (e) {
    return false;
  }
}

export { snapshot, restore, MAX_SLOTS, BOARD_SIZE };
