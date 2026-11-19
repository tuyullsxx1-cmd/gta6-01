// Maravilla — every tuning number, name and colour in one place.
// The city is a 600 x 600 m grid centred on (0, 0); the beach and ocean sit east of x = 264.

export const STEP = 1 / 60;
export const SAVE_KEY = 'maravilla.save.v1';

export const GAME = {
  title: 'MARAVILLA',
  subtitle: 'ONE LAST SCORE',
  city: 'Maravilla',
};

export const CITY = {
  size: 600,
  half: 300,
  block: 60,
  roadWidth: 12,
  roads: [-240, -180, -120, -60, 0, 60, 120, 180, 240],
  beachX: 264,
  oceanX: 300,
  pier: { x: 300, z: 30, length: 80, width: 10 },
  // Named places the missions and HUD refer to.
  places: {
    garage: { x: -150, z: -90, name: "Celia's Garage" },
    bank: { x: 30, z: 30, name: 'Banco Alba' },
    hotel: { x: -90, z: 150, name: 'Hotel Miramar' },
    gunshop: { x: 90, z: -150, name: 'Fierro Arms' },
    hospital: { x: -30, z: 210, name: 'Clinica Sol' },
    policeHq: { x: 150, z: 90, name: 'Maravilla PD HQ' },
    pier: { x: 300, z: 30, name: 'Miramar Pier' },
    marina: { x: -210, z: -210, name: 'Marina Alba' },
    stadium: { x: 210, z: -210, name: 'Estadio Sol' },
    mercado: { x: -150, z: 150, name: 'Mercado El Faro' },
    safehouse: { x: -210, z: 150, name: 'Casa Verde Safehouse' },
  },
  streets: {
    northSouth: ['Calle Palma', 'Calle Coral', 'Avenida del Sol', 'Calle Mango', 'Paseo del Mar'],
    eastWest: ['Calle Luna', 'Calle Alba', 'Paseo Maritimo', 'Calle Faro', 'Avenida Central'],
  },
};

export const PLAYER = {
  walkSpeed: 6,
  runSpeed: 10,
  accel: 40,
  jumpSpeed: 8,
  gravity: 22,
  radius: 0.6,
  health: 100,
  armour: 100,
  startMoney: 250,
};

/** Six named districts of Maravilla, as x/z rectangles (half-open).
 * Anything outside them (the pier, open sea) reads as 'Maravilla'.
 * Each district has its own look: a building palette, a signature prop
 * theme (built by city.js), and a one-line flavour for the HUD panel. */
export const DISTRICTS = [
  { name: 'El Faro', minX: -300, maxX: -100, minZ: 0, maxZ: 300,
    palette: [0xe8dcc8, 0xf2e3c6, 0xd8a077, 0x9fc2a8], props: 'stilts',
    flavor: 'Old fishing quarter — stilt houses under the lighthouse.' },
  { name: 'Marina Alba', minX: -300, maxX: -100, minZ: -300, maxZ: 0,
    palette: [0x7fb3c8, 0x9fc2d8, 0xe8e4da, 0x5a7a8a], props: 'boats',
    flavor: 'Working marina — docks, boats, salt in the air.' },
  { name: 'Centro Alba', minX: -100, maxX: 100, minZ: 0, maxZ: 300,
    palette: [0xd97b6c, 0xe8b4b8, 0xf2e3c6, 0xc8b8d8], props: 'oldtown',
    flavor: 'Old town — terracotta roofs, plazas, the bank.' },
  { name: 'Paseo del Mar', minX: -100, maxX: 100, minZ: -300, maxZ: 0,
    palette: [0xe87a5d, 0xf2c230, 0x3aa7a3, 0xe8dcc8], props: 'market',
    flavor: 'Night market — stalls, neon, the smell of the grill.' },
  { name: 'Miramar', minX: 100, maxX: 300, minZ: 0, maxZ: 300,
    palette: [0x7fb3c8, 0xe8d29a, 0xf2e3c6, 0x5a8a6a], props: 'boardwalk',
    flavor: 'Beachfront — boardwalk, surfboards, hotel row.' },
  { name: 'Estadio Sol', minX: 100, maxX: 300, minZ: -300, maxZ: 0,
    palette: [0x3f6fb5, 0xd84040, 0xe8e4da, 0x2e4a6b], props: 'stadium',
    flavor: 'Stadium quarter — flags, ticket booths, floodlights.' },
];

/** Standing 0..100, 50 = neutral. A mission finished in a district lifts
 * it +8; a crime committed there drops it -3. */
export function districtAt(x, z) {
  for (const d of DISTRICTS) {
    if (x >= d.minX && x < d.maxX && z >= d.minZ && z < d.maxZ) return d.name;
  }
  return 'Maravilla';
}

export function districtLabel(v) {
  if (v < 25) return 'HOSTILE';
  if (v < 40) return 'COLD';
  if (v < 60) return 'NEUTRAL';
  if (v < 80) return 'WARM';
  return 'LOYAL';
}

/** Rank ladder, earned as RP: +250 per story mission (+600 for the
 * finale), +100 per race win, +25 per taxi fare. */
export const RANKS = [
  { min: 0, tier: 'D', title: 'ROOKIE' },
  { min: 500, tier: 'C', title: 'HUSTLER' },
  { min: 1200, tier: 'B', title: 'FIXER' },
  { min: 2400, tier: 'A', title: 'SHOT CALLER' },
  { min: 4500, tier: 'S', title: 'LEYENDA' },
];

export function rankFor(rp) {
  let cur = RANKS[0];
  let next = null;
  for (let i = 0; i < RANKS.length; i += 1) {
    if (rp >= RANKS[i].min) cur = RANKS[i];
    else { next = RANKS[i]; break; }
  }
  return { tier: cur.tier, title: cur.title, min: cur.min, next };
}

/** Maravilla PD dispatch callsigns + roles. The pools are DISJOINT per unit
 * type and the sequence is a single global counter (police.js), so two
 * units can never share a callsign: HALCON-1 is always one unit. */
export const COP_CALLSIGNS = {
  foot: ['HALCON', 'FARO', 'OLA', 'ARENA', 'PALMA'],
  car: ['TIBURON', 'CORAL', 'SOL', 'BRISA', 'VIENTO'],
  roadblock: ['MURO', 'BLOQUE', 'CERCO'],
  air: ['AGUILA', 'CONDOR'],
};
export const COP_ROLES = {
  foot: ['BEAT', 'SHORE WATCH', 'MARKSMAN'],
  car: ['RAMMING', 'FLANKING', 'INTERCEPT', 'PUSH'],
  roadblock: ['ROADBLOCK'],
  air: ['AIR UNIT', 'SPOTLIGHT'],
};

export const VEHICLES = {
  vagabundo: { name: 'Vagabundo', kind: 'sedan', topSpeed: 32, accel: 14, brake: 30, grip: 2.6, color: 0x8a7f70, price: 0 },
  cometa: { name: 'Cometa GT', kind: 'sport', topSpeed: 52, accel: 22, brake: 38, grip: 3.4, color: 0xd84040, price: 12000 },
  tormenta: { name: 'Tormenta S', kind: 'sport', topSpeed: 56, accel: 24, brake: 40, grip: 3.6, color: 0xf2c230, price: 9000 },
  camioneta: { name: 'Camioneta Alba', kind: 'suv', topSpeed: 38, accel: 16, brake: 32, grip: 2.8, color: 0x3f6fb5, price: 6500 },
  taxi: { name: 'Toro Taxi', kind: 'taxi', topSpeed: 36, accel: 15, brake: 32, grip: 2.8, color: 0xf2c230, price: 0 },
  furgoneta: { name: 'Furgoneta', kind: 'van', topSpeed: 30, accel: 12, brake: 28, grip: 2.4, color: 0xe8e4da, price: 4200 },
  picuda: { name: 'Picuda 250', kind: 'bike', topSpeed: 48, accel: 26, brake: 34, grip: 4.2, color: 0x2e8a5a, price: 1500 },
  patrulla: { name: 'Patrulla', kind: 'cop', topSpeed: 46, accel: 20, brake: 36, grip: 3.2, color: 0x1c2733, price: 0 },
};

export const WEAPONS = {
  fists: { name: 'Fists', damage: 12, rate: 2.2, range: 2.2, spread: 0, auto: false, ammo: Infinity, mag: Infinity },
  pistol: { name: 'P9 Pistol', damage: 22, rate: 3.5, range: 55, spread: 0.012, auto: false, ammo: 120, mag: 12 },
  smg: { name: 'Rayo SMG', damage: 13, rate: 11, range: 45, spread: 0.05, auto: true, ammo: 240, mag: 30 },
  shotgun: { name: 'Trueno Shotgun', damage: 16, pellets: 7, rate: 1.1, range: 26, spread: 0.09, auto: false, ammo: 40, mag: 6 },
  rifle: { name: 'Largo Rifle', damage: 55, rate: 1.6, range: 110, spread: 0.004, auto: false, ammo: 60, mag: 10 },
  launcher: { name: 'Trueno RPG', damage: 120, rate: 0.7, range: 90, spread: 0.01, auto: false, ammo: 12, mag: 1, explosive: true },
};
export const WEAPON_ORDER = ['fists', 'pistol', 'smg', 'shotgun', 'rifle', 'launcher'];
/** How each gun is earned: a mission grant, a Fierro Arms price, or both.
 * Fists + pistol are owned from the start. */
export const WEAPON_SHOP = {
  smg: { price: 900, mission: 4, unlock: 'Mission 5 · FIERRO ARMS, or $900 at Fierro Arms' },
  shotgun: { price: 1100, mission: 6, unlock: 'Mission 7 · THE PIER JOB, or $1,100 at Fierro Arms' },
  rifle: { price: 1600, mission: 8, unlock: "Mission 9 · BIG MARLON'S DEBT, or $1,600 at Fierro Arms" },
  launcher: { price: 2500, mission: -1, unlock: '$2,500 at Fierro Arms' },
};

export const WANTED = {
  max: 5,
  decayDelay: 14, // seconds unseen before a star starts to fade
  decayTime: 20, // seconds per star once fading
  copCars: [0, 1, 2, 3, 4, 5],
  heliAt: 4,
  roadblockAt: 3,
};

export const RADIO = [
  { name: 'RADIO SOL 98.5', tag: 'Latin pop', bpm: 104, root: 55 },
  { name: 'OLA FM 91.2', tag: 'Chillwave', bpm: 88, root: 49.5 },
  { name: 'FARO ROCK 101', tag: 'Rock', bpm: 132, root: 41.2 },
];

export const CREW = {
  player: { name: "Rico 'Rook' Vega", role: 'Just out — back in Maravilla' },
  luz: { name: 'Mama Luz', role: 'Fixer' },
  celia: { name: 'Celia Reyes', role: 'Driver & hacker' },
  tito: { name: 'Tito Fuentes', role: 'Mechanic' },
  marlon: { name: 'Big Marlon', role: 'Muscle' },
  gato: { name: 'Detective El Gato', role: 'Maravilla PD — hunting you' },
};

export const PALETTE = {
  skyDay: 0x87bfe8,
  skyDusk: 0xff9a56,
  skyNight: 0x0e1626,
  sun: 0xfff2d0,
  fogDay: 0xcfe4ef,
  asphalt: 0x4b4e56,
  sidewalk: 0x9a938a,
  sand: 0xe8d29a,
  ocean: 0x1e6f8e,
  grass: 0x5d8a4a,
  building: [0xe8dcc8, 0xd8a077, 0x7fb3c8, 0xe8b4b8, 0xf2e3c6, 0x9fc2a8, 0xd97b6c, 0xc8b8d8],
  palmTrunk: 0x7a5c3e,
  palmLeaf: 0x3f8a4a,
};

export const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';

/** Mission names in story order; the full definitions live in missions.js. */
export const MISSION_NAMES = [
  'FIRST KEYS',
  'BANCO ALBA',
  'TAXI TROUBLE',
  'THE LONG WAY HOME',
  'FIERRO ARMS',
  'NIGHT SHIFT',
  'THE PIER JOB',
  'HOT PURSUIT',
  "BIG MARLON'S DEBT",
  'ONE LAST SCORE',
];

/** Story acts: later missions stay locked until the act's earlier ones are
 * done (missions.js enforces the sequence; the pause menu shows it). */
export const ACTS = [
  { name: 'ACT I — COMING HOME', missions: [0, 1, 2], blurb: 'Rook is back. Earn your wheels and your name.' },
  { name: 'ACT II — THE CREW', missions: [3, 4, 5, 6], blurb: 'The crew runs the city — and El Gato starts to notice.' },
  { name: 'ACT III — ONE LAST SCORE', missions: [7, 8, 9], blurb: 'The trap, the debt, and the vault. All of it.' },
];

/** Par times (seconds) for mission ratings: finish under par = G (gold),
 * under par x 1.5 = S (silver), anything else = B (bronze). */
export const MISSION_PARS = [150, 120, 180, 150, 140, 160, 150, 200, 140, 240];

export function ratingForTime(seconds, par) {
  if (seconds <= par) return 'G';
  if (seconds <= par * 1.5) return 'S';
  return 'B';
}
