// The one game state every system reads and writes. Entities are plain data
// ({x, z, heading, ...}); meshes live on the entity as `.mesh` and are synced
// by their owner system each frame. Nothing here imports a system module.

import { PLAYER } from './config.js';

/** A fresh state for a new game (or a staged screenshot) at the given seed. */
export function createState(seed) {
  return {
    seed,
    time: 0,
    // 0..1 around the clock; 0.32 is late afternoon sun, 0.0 is midnight.
    dayTime: 0.32,
    day: 1, // increments every time dayTime wraps past midnight
    screen: 'title', // title | play | paused | busted | wasted | complete
    paused: false,
    player: {
      x: -150, z: -60, y: 0, heading: 0, speed: 0, // on the road south of the garage, clear of building colliders
      onFoot: true, health: PLAYER.health, armour: 25,
      money: PLAYER.startMoney, respect: 0, rp: 0, wanted: 0,
      weapon: 'fists', ammo: { pistol: 60, smg: 90, shotgun: 18, rifle: 20, launcher: 4 },
      mag: { pistol: 12, smg: 30, shotgun: 6, rifle: 10, launcher: 1 },
      weaponsOwned: ['fists', 'pistol'],
      vehicleId: null, running: false, dead: false, busted: false,
      lastCrime: -100, hidden: 0,
    },
    vehicles: [], // { id, defId, x, z, heading, speed, steer, color, kind, driver, health, mesh }
    peds: [], // { id, x, z, heading, speed, state, mesh }
    cops: [], // { id, x, z, heading, speed, kind: 'car'|'foot', state, mesh }
    heli: null, // { x, z, y, heading, mesh }
    mission: null, // { id, title, giver, stage, objective, marker, timer, data }
    missionsDone: [],
    ratings: {}, // { missionId: 'G' | 'S' | 'B' } — awarded on completion
    missionStartTime: 0, // state.time when the current mission started
    nextMission: 0,
    saveSlot: 1, // 1..3 — which manual slot autosave writes to
    // Side activities (side.js owns the world objects; progress lives here).
    side: {
      geckosFound: 0, jumpsDone: 0, jobsDone: 0, exportsDone: 0,
      safehouse: false, // Casa Verde bought — save + heal there
      exportRemaining: ['cometa', 'camioneta', 'furgoneta', 'tormenta', 'taxi'],
      jobCooldowns: {}, // { district: state.time when the next job unlocks }
      geckoIds: [], // indices of collected Golden Geckos (positions are seeded)
      jumpIds: [], // indices of landed stunt jumps
    },
    // District standing: one value per named district (0..100, 50 neutral).
    district: 'Marina Alba',
    districtStanding: {
      'El Faro': 50, 'Marina Alba': 50, 'Centro Alba': 50,
      'Paseo del Mar': 50, Miramar: 50, 'Estadio Sol': 50,
    },
    // Live standing effects for the district the player is in (districts.js).
    standingFx: { wantedGain: 1, decayMult: 1, copSpeed: 1, priceMult: 1, label: 'NEUTRAL GROUND' },
    crimeLabel: '', // what the cops want you for (police.js sets it)
    garage: ['vagabundo'],
    garageUpgrades: {}, // { defId: { engine: 0..3, armour: 0..3, nitro: bool } }
    stats: {
      carsStolen: 0, shotsFired: 0, hits: 0, missionsDone: 0,
      moneyEarned: 0, racesWon: 0, taxiFares: 0, distanceDriven: 0, pedsDown: 0,
      collectibles: 0, jumps: 0, jobs: 0, exports: 0, timePlayed: 0,
    },
    radio: { station: 0, on: true },
    camera: { yaw: 0, pitch: 0.18, dist: 7, mode: 'follow' },
    messages: [], // { text, at, kind } feed shown top-left, newest first
    objective: '', // current objective line shown under the minimap
    race: null, // active race state when a street race runs
    taxi: null, // active fare when driving a taxi
    muted: false,
  };
}
