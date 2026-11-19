// Maravilla — persistence: 3 manual save slots + autosave + a local
// top-5 leaderboard. Autosave writes to the current slot (state.saveSlot,
// 1..3); the pause menu's SAVE tab switches slots, loads and deletes.
// localStorage may be unavailable (headless / file:// contexts) — every
// access is wrapped in try/catch and this module never throws.

import { SAVE_KEY } from './config.js';

const BOARD_KEY = 'maravilla-board-v1';
const CURRENT_KEY = `${SAVE_KEY}.current`;
const AUTOSAVE_EVERY = 30;

function safeGet(key) {
  try {
    if (typeof localStorage === 'undefined') return null;
    return localStorage.getItem(key);
  } catch (e) {
    return null;
  }
}

function safeSet(key, value) {
  try {
    if (typeof localStorage === 'undefined') return false;
    localStorage.setItem(key, value);
    return true;
  } catch (e) {
    return false;
  }
}

function safeRemove(key) {
  try {
    if (typeof localStorage === 'undefined') return;
    localStorage.removeItem(key);
  } catch (e) { /* ignore */ }
}

function slotKey(slot) {
  return `${SAVE_KEY}.slot${slot}`;
}

export function createSave(ctx) {
  const { state, events } = ctx;
  const p = state.player;
  let autosaveTimer = 0;
  let lastScreen = state.screen;
  let loaded = false;

  function msg(text, kind = 'info') {
    if (ctx.hud && ctx.hud.message) { ctx.hud.message(text, kind); return; }
    if (state.messages) state.messages.push({ text, at: state.time, kind });
  }

  function snapshot() {
    return {
      v: 3,
      savedAt: Date.now(),
      money: p.money,
      respect: p.respect,
      rp: p.rp || 0,
      day: state.day || 1,
      districtStanding: { ...(state.districtStanding || {}) },
      missionsDone: [...state.missionsDone],
      ratings: { ...(state.ratings || {}) },
      nextMission: state.nextMission,
      garage: [...state.garage],
      garageUpgrades: JSON.parse(JSON.stringify(state.garageUpgrades || {})),
      stats: { ...state.stats },
      weaponsOwned: [...(p.weaponsOwned || ['fists', 'pistol'])],
      side: JSON.parse(JSON.stringify(state.side || {})),
      saveSlot: state.saveSlot || 1,
      playerHealth: p.health,
      playerArmour: p.armour,
      dayTime: state.dayTime,
      playerPos: { x: p.x, z: p.z },
    };
  }

  function applyData(data) {
    if (!data || typeof data !== 'object') return false;
    try {
      if (typeof data.money === 'number') p.money = data.money;
      if (typeof data.respect === 'number') p.respect = data.respect;
      if (typeof data.rp === 'number') p.rp = data.rp;
      if (typeof data.day === 'number') state.day = Math.max(1, data.day);
      if (data.districtStanding && typeof data.districtStanding === 'object') {
        Object.assign(state.districtStanding, data.districtStanding);
      }
      if (Array.isArray(data.missionsDone)) state.missionsDone = [...data.missionsDone];
      if (data.ratings && typeof data.ratings === 'object') state.ratings = { ...data.ratings };
      if (typeof data.nextMission === 'number') state.nextMission = data.nextMission;
      if (Array.isArray(data.garage) && data.garage.length > 0) state.garage = [...data.garage];
      if (data.garageUpgrades && typeof data.garageUpgrades === 'object') {
        state.garageUpgrades = JSON.parse(JSON.stringify(data.garageUpgrades));
      }
      if (data.stats && typeof data.stats === 'object') {
        Object.assign(state.stats, data.stats);
      }
      if (Array.isArray(data.weaponsOwned) && data.weaponsOwned.length > 0) {
        p.weaponsOwned = [...data.weaponsOwned];
      }
      if (data.side && typeof data.side === 'object') {
        Object.assign(state.side, JSON.parse(JSON.stringify(data.side)));
      }
      if (typeof data.saveSlot === 'number') state.saveSlot = data.saveSlot;
      if (typeof data.playerHealth === 'number') p.health = data.playerHealth;
      if (typeof data.playerArmour === 'number') p.armour = data.playerArmour;
      if (typeof data.dayTime === 'number') state.dayTime = data.dayTime;
      if (data.playerPos && typeof data.playerPos.x === 'number') {
        p.x = data.playerPos.x;
        p.z = data.playerPos.z;
      }
      loaded = true;
      return true;
    } catch (e) {
      return false;
    }
  }

  function readSlot(slot) {
    try {
      const raw = safeGet(slotKey(slot));
      if (!raw) return null;
      return JSON.parse(raw);
    } catch (e) {
      return null;
    }
  }

  function saveTo(slot) {
    if (slot < 1 || slot > 3) return false;
    state.saveSlot = slot;
    safeSet(CURRENT_KEY, String(slot));
    return safeSet(slotKey(slot), JSON.stringify(snapshot()));
  }

  function save() {
    return saveTo(state.saveSlot || 1);
  }

  function loadFrom(slot) {
    const data = readSlot(slot);
    if (!data) return false;
    if (!applyData(data)) return false;
    state.saveSlot = slot;
    safeSet(CURRENT_KEY, String(slot));
    return true;
  }

  function load() {
    // Current slot, remembered across sessions; fall back to slot 1.
    const current = Number(safeGet(CURRENT_KEY) || '1') || 1;
    const slot = Math.min(3, Math.max(1, current));
    // Legacy migration: a v1/v2 autosave under the bare key moves to slot 1.
    if (!readSlot(1) && !readSlot(2) && !readSlot(3)) {
      const legacy = safeGet(SAVE_KEY);
      if (legacy) {
        try {
          const data = JSON.parse(legacy);
          if (data && typeof data === 'object') {
            safeSet(slotKey(1), legacy);
            safeRemove(SAVE_KEY);
          }
        } catch (e) { /* not a save */ }
      }
    }
    return loadFrom(slot);
  }

  function slotInfo(slot) {
    const data = readSlot(slot);
    if (!data) return null;
    return {
      savedAt: data.savedAt || 0,
      money: data.money || 0,
      missionsDone: Array.isArray(data.missionsDone) ? data.missionsDone : [],
    };
  }

  function deleteSlot(slot) {
    safeRemove(slotKey(slot));
    return true;
  }

  function setSlot(slot) {
    if (slot < 1 || slot > 3) return false;
    state.saveSlot = slot;
    safeSet(CURRENT_KEY, String(slot));
    return true;
  }

  function clear() {
    for (let s = 1; s <= 3; s += 1) safeRemove(slotKey(s));
    safeRemove(CURRENT_KEY);
    safeRemove(SAVE_KEY);
    safeRemove(BOARD_KEY);
  }

  function getBoard() {
    try {
      const raw = safeGet(BOARD_KEY);
      if (!raw) return [];
      const arr = JSON.parse(raw);
      return Array.isArray(arr) ? arr : [];
    } catch (e) {
      return [];
    }
  }

  function recordRun() {
    try {
      const board = getBoard();
      board.push({
        missionsDone: state.stats.missionsDone,
        money: p.money,
        moneyEarned: state.stats.moneyEarned,
        date: new Date().toISOString().slice(0, 10),
      });
      board.sort((a, b) => (b.missionsDone - a.missionsDone) || (b.money - a.money));
      safeSet(BOARD_KEY, JSON.stringify(board.slice(0, 5)));
      return board.slice(0, 5);
    } catch (e) {
      return [];
    }
  }

  // --- load on boot, if a save exists.
  const hadSave = load();
  if (hadSave) {
    msg('Save loaded — welcome back, Rook.', 'good');
  }

  // --- save on mission complete + when the finale completes.
  if (events) {
    events.on('mission', (d) => {
      if (d && d.stage === 'complete') save();
    });
  }

  function update(dt) {
    // Autosave every 30 s while playing.
    if (state.screen === 'play') {
      autosaveTimer += dt;
      if (autosaveTimer >= AUTOSAVE_EVERY) {
        autosaveTimer = 0;
        save();
      }
    }
    // Save on pause (screen flips play -> paused).
    if (lastScreen === 'play' && state.screen === 'paused') save();
    // Record the run when the finale completes.
    if (lastScreen !== 'complete' && state.screen === 'complete') {
      save();
      recordRun();
    }
    lastScreen = state.screen;
  }

  return {
    update,
    save,
    saveTo,
    load,
    loadFrom,
    slotInfo,
    deleteSlot,
    setSlot,
    clear,
    getBoard,
    recordRun,
    get loaded() { return loaded; },
    get currentSlot() { return state.saveSlot || 1; },
    get saveKey() { return SAVE_KEY; },
    get boardKey() { return BOARD_KEY; },
  };
}
