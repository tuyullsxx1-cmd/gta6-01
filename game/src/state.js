// The whole game state in one factory. Save/load serialises the plain
// fields of this object, so a round trip can be compared exactly.
import { DISTRICTS, WEAPONS, VEHICLES, RANKS } from './config.js';

export function createState(seed = 20261122) {
  const standing = {};
  for (const d of DISTRICTS) standing[d.id] = 50;
  const weapons = {};
  for (const w of WEAPONS) {
    weapons[w.id] = {
      owned: w.id === 'fists' || w.id === 'pistol',
      mag: w.mag === Infinity ? Infinity : w.mag,
      reserve: w.reserve === Infinity ? Infinity : w.reserve,
    };
  }
  return {
    seed,
    day: 3,
    dayTime: 0.78, // evening: golden hour sliding into blue hour
    timeScale: 1,
    money: 1250,
    rp: 620,
    respect: 0,
    health: 100,
    armour: 25,
    wanted: 0,
    heat: 0,
    crime: '',
    standing,
    district: 'centro',
    player: { x: 0, z: 40, heading: Math.PI, speed: 0, onFoot: true, vy: 0, grounded: true },
    car: null, // { defId, x, z, heading, speed, damage, nitro, upgrades }
    ownedCars: ['solano'],
    garage: { engine: 0, armour: 0, nitro: 0 },
    weapons,
    weapon: 'pistol',
    missionIndex: 0,
    mission: null, // { id, stage, startedAt, timer }
    missionDone: [],
    ratings: {},
    race: null,
    taxi: null,
    collectibles: [],
    jumpsDone: [],
    jobsDone: 0,
    exportsDone: [],
    safehouse: false,
    stats: { km: 0, stolen: 0, escaped: 0, takenOut: 0, longestJump: 0, fares: 0, earned: 0 },
    leaderboard: [
      { name: 'Milo Vane', score: 620 },
      { name: 'Juno Park', score: 540 },
      { name: 'Theo Ashford', score: 410 },
      { name: 'Iris Calloway', score: 330 },
      { name: 'Bram Okafor', score: 260 },
    ],
    radio: 0,
    muted: false,
    phoneCooldowns: {},
    paused: false,
    pauseTab: 'MAP',
    started: false,
    gameOver: false,
    messages: [],
    dispatchTicker: 'MCPD: all units, be advised — suspect vehicle last seen downtown.',
    camera: { dist: 7.2, pitch: 0.32, yaw: 0 },
    flags: {},
  };
}

export function rankFor(rp) {
  let r = RANKS[0];
  for (const cand of RANKS) if (rp >= cand.rp) r = cand;
  return r.name;
}

export function nextRank(rp) {
  for (const cand of RANKS) if (rp < cand.rp) return cand;
  return null;
}

export function addMoney(state, n) { state.money = Math.max(0, state.money + n); state.stats.earned += Math.max(0, n); }
export function addRp(state, n) {
  state.rp += n;
  const entry = state.leaderboard.find((e) => e.name === 'Milo Vane');
  if (entry) entry.score = state.rp;
  state.leaderboard.sort((a, b) => b.score - a.score);
}

export function districtAt(x, z) {
  for (const d of DISTRICTS) if (x >= d.x0 && x < d.x1 && z >= d.z0 && z < d.z1) return d;
  return DISTRICTS[2];
}

export function tierFor(value, tiers) {
  for (const t of tiers) if (value >= t.min) return t;
  return tiers[tiers.length - 1];
}

// Plain-data snapshot for saves: only JSON-safe fields, in fixed key order.
export function snapshot(state) {
  return JSON.parse(JSON.stringify({
    money: state.money, rp: state.rp, respect: state.respect,
    health: state.health, armour: state.armour, wanted: state.wanted, heat: state.heat, crime: state.crime,
    standing: state.standing, day: state.day, dayTime: state.dayTime,
    player: state.player, car: state.car, ownedCars: state.ownedCars,
    garage: state.garage, weapons: state.weapons, weapon: state.weapon,
    missionIndex: state.missionIndex, missionDone: state.missionDone,
    ratings: state.ratings, collectibles: state.collectibles,
    jumpsDone: state.jumpsDone, jobsDone: state.jobsDone,
    exportsDone: state.exportsDone, safehouse: state.safehouse,
    stats: state.stats, radio: state.radio,
  }));
}

export function restore(state, snap) {
  for (const k of Object.keys(snap)) state[k] = JSON.parse(JSON.stringify(snap[k]));
  // A load never resumes mid-mission, mid-race or mid-fare: those restart.
  state.mission = null; state.race = null; state.taxi = null;
}
