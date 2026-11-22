// MARAVILLA — One Last Score: shared constants.
// Every number the game tunes lives here so the other modules stay small.
export const CITY = {
  size: 600, half: 300,
  roadEvery: 60, roadWidth: 12, sidewalk: 3,
  avenueEvery: 180, avenueWidth: 18,
  seaX: -300, // the sea and marina sit on the west edge
  waterX: -252,
};

export const DISTRICTS = [
  { id: 'marina',  name: 'MARINA ALBA',  short: 'Marina',  x0: -300, z0: -300, x1: -120, z1: -60,  color: 0x2e6f8e, accent: '#7fd4e8', look: 'yachts, stilt houses, piers' },
  { id: 'faro',    name: 'EL FARO',      short: 'El Faro',  x0: -300, z0: -60,  x1: -120, z1: 180,  color: 0xb0703a, accent: '#ffb37a', look: 'terracotta roofs, lighthouse hill' },
  { id: 'centro',  name: 'CENTRO ALBA',  short: 'Centro',   x0: -120, z0: -300, x1: 120,  z1: 60,   color: 0x8e2f5e, accent: '#ff7ab8', look: 'night market, neon, stalls' },
  { id: 'paseo',   name: 'PASEO DEL MAR',short: 'Paseo',    x0: -120, z0: 60,   x1: 120,  z1: 300,  color: 0x3a7a5a, accent: '#8fe8b0', look: 'surf shops, beach, palms' },
  { id: 'miramar', name: 'MIRAMAR',      short: 'Miramar',  x0: 120,  z0: -300, x1: 300,  z1: 60,   color: 0x3a5a9e, accent: '#9db8ff', look: 'glass hotel towers' },
  { id: 'estadio', name: 'ESTADIO SOL',  short: 'Estadio',  x0: 120,  z0: 60,   x1: 300,  z1: 300,  color: 0x9e7a2a, accent: '#ffd76a', look: 'stadium, flags, wide plaza' },
];

export const DISTRICT_TIERS = [
  { id: 'LOYAL',   min: 75, label: 'LOYAL',   heatMul: 0.55, fadeMul: 1.8, copMul: 0.8, priceMul: 0.9,  payMul: 1.25, jobsOpen: true },
  { id: 'WARM',    min: 60, label: 'WARM',    heatMul: 0.8,  fadeMul: 1.3, copMul: 0.9, priceMul: 0.95, payMul: 1.1,  jobsOpen: true },
  { id: 'NEUTRAL', min: 40, label: 'NEUTRAL', heatMul: 1.0,  fadeMul: 1.0, copMul: 1.0, priceMul: 1.0,  payMul: 1.0,  jobsOpen: true },
  { id: 'COLD',    min: 25, label: 'COLD',    heatMul: 1.3,  fadeMul: 0.7, copMul: 1.15, priceMul: 1.1, payMul: 0.9,  jobsOpen: true },
  { id: 'HOSTILE', min: 0,  label: 'HOSTILE', heatMul: 1.7,  fadeMul: 0.45, copMul: 1.3, priceMul: 1.25, payMul: 0.75, jobsOpen: false },
];

export const CREW = [
  { id: 'vera',  name: 'Vera Solano',   role: 'fixer',    key: 'F', cost: 0,   call: 'Next job',        skin: 0xc98d64, hair: 0x1c1410, hairStyle: 'bob',   shirt: 0x7a1f3d, desc: 'The fixer. She sets up every job.' },
  { id: 'juno',  name: 'Juno Park',     role: 'driver',   key: 'Z', cost: 150, call: 'Scrub heat −2★',  skin: 0xe8b98a, hair: 0x101010, hairStyle: 'short', shirt: 0x2244aa, desc: 'Getaway driver. Scrubs two wanted stars.' },
  { id: 'theo',  name: 'Theo Ashford',  role: 'mechanic', key: 'X', cost: 100, call: 'Repair ride $100', skin: 0x8a5a3b, hair: 0x2a1a0c, hairStyle: 'cap',   shirt: 0x3a5a2a, desc: 'Mechanic. Repairs the car anywhere.' },
  { id: 'iris',  name: 'Iris Calloway', role: 'lookout',  key: 'V', cost: 0,   call: 'Mark the cops',   skin: 0xf0c8a0, hair: 0x6a2a10, hairStyle: 'long',  shirt: 0x5a2a6a, desc: 'Lookout. Marks every cop on the map.' },
  { id: 'bram',  name: 'Bram Okafor',   role: 'muscle',   key: 'B', cost: 200, call: 'Clear cops $200',  skin: 0x4a2e1c, hair: 0x0a0a0a, hairStyle: 'fade',  shirt: 0x222222, desc: 'Muscle. Clears the cops around you.' },
];

export const PLAYER_DEF = { name: 'Milo Vane', skin: 0xd8a077, hair: 0x241608, hairStyle: 'swept', shirt: 0xb8860b, pants: 0x2a2a3a };

export const WEAPONS = [
  { id: 'fists',   name: 'Fists',    glyph: '✊', price: 0,    damage: 12, mag: Infinity, reserve: Infinity, auto: false, range: 2.2, rate: 0.35 },
  { id: 'pistol',  name: 'Pistol',   glyph: '🔫', price: 0,    damage: 22, mag: 12, reserve: 168, auto: false, range: 55,  rate: 0.28 },
  { id: 'smg',     name: 'SMG',      glyph: '🔫', price: 800,  damage: 14, mag: 32, reserve: 192, auto: true,  range: 45,  rate: 0.09 },
  { id: 'shotgun', name: 'Shotgun',  glyph: '💥', price: 1200, damage: 55, mag: 6,  reserve: 36,  auto: false, range: 22,  rate: 0.8 },
  { id: 'rifle',   name: 'Rifle',    glyph: '🎯', price: 1800, damage: 45, mag: 24, reserve: 120, auto: true,  range: 90,  rate: 0.13 },
  { id: 'launcher',name: 'Launcher', glyph: '🚀', price: 2500, damage: 220, mag: 1, reserve: 8,  auto: false, range: 90,  rate: 1.4 },
];

export const VEHICLES = [
  { id: 'solano',  name: 'Solano GT',   kind: 'sports', top: 52, accel: 26, grip: 2.6, color: 0xd4af37, price: 0 },
  { id: 'cometa',  name: 'Cometa S',    kind: 'sports', top: 48, accel: 24, grip: 2.5, color: 0xc02028, price: 0 },
  { id: 'alba',    name: 'Alba Sedan',  kind: 'sedan',  top: 40, accel: 18, grip: 2.2, color: 0x2a6ab0, price: 0 },
  { id: 'brisa',   name: 'Brisa Coupe', kind: 'coupe',  top: 44, accel: 21, grip: 2.4, color: 0x18a0a0, price: 0 },
  { id: 'viento',  name: 'Viento Van',  kind: 'van',    top: 34, accel: 14, grip: 1.9, color: 0xd8d0c0, price: 0 },
  { id: 'picuda',  name: 'Picuda 900',  kind: 'bike',   top: 50, accel: 28, grip: 2.8, color: 0xe06010, price: 0 },
  { id: 'taxi',    name: 'Maravilla Cab', kind: 'taxi', top: 38, accel: 17, grip: 2.1, color: 0xf0c020, price: 0 },
];

export const RANKS = [
  { name: 'ROOKIE', rp: 0 }, { name: 'HUSTLER', rp: 500 }, { name: 'FIXER', rp: 1200 },
  { name: 'SHOT CALLER', rp: 2400 }, { name: 'LEYENDA', rp: 4500 },
];

export const RADIO = [
  { id: 'sol',   name: 'RADIO SOL 98.4',   desc: 'Golden-hour pop',  bpm: 104, root: 220, scale: [0, 2, 4, 7, 9], wave: 'triangle' },
  { id: 'neon',  name: 'NEON NIGHT 91.7',  desc: 'Synthwave nights', bpm: 92,  root: 110, scale: [0, 3, 5, 7, 10], wave: 'sawtooth' },
  { id: 'mar',   name: 'MAR FM 104.2',     desc: 'Coastal reggae',   bpm: 76,  root: 164, scale: [0, 2, 5, 7, 10], wave: 'sine' },
];

export const DAY_LENGTH_S = 480; // one full day in seconds
export const PED_COUNT = 72;
export const TRAFFIC_COUNT = 22;
export const COLLECTIBLE_COUNT = 20;
export const STUNT_COUNT = 5;
export const EXPORT_COUNT = 5;
export const SAFEHOUSE_PRICE = 2000;
export const GARAGE = {
  engine: [0, 400, 900, 1600],
  armour: [0, 350, 800, 1400],
  nitro:  [0, 500, 1100],
};
export const SHOT_SIZE = { w: 1280, h: 800 };
