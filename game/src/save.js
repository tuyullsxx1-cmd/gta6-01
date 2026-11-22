// Saves: three slots in localStorage, exact round trips, plus a local
// top-5 leaderboard that follows RP.
import { snapshot, restore } from './state.js';

const PREFIX = 'maravilla-save-';

export function saveSlot(state, slot) {
  const data = { savedAt: new Date().toISOString(), day: state.day, snap: snapshot(state) };
  localStorage.setItem(PREFIX + slot, JSON.stringify(data));
  return data;
}

export function loadSlot(state, slot) {
  const raw = localStorage.getItem(PREFIX + slot);
  if (!raw) return null;
  const data = JSON.parse(raw);
  restore(state, data.snap);
  return data;
}

export function slotInfo(slot) {
  const raw = localStorage.getItem(PREFIX + slot);
  if (!raw) return null;
  const data = JSON.parse(raw);
  return { day: data.day, money: data.snap.money, rp: data.snap.rp, savedAt: data.savedAt };
}

export function hasSlot(slot) { return localStorage.getItem(PREFIX + slot) !== null; }

export function top5(state) {
  return [...state.leaderboard].sort((a, b) => b.score - a.score).slice(0, 5);
}
