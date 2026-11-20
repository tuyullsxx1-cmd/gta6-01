// config.js — fixed design data for MARAVILLA.
// One plain object: city, districts, vehicles, weapons, ranks, radio,
// prices and population counts. No logic lives here, only values that
// every other module reads.

export const CONFIG = {
  // The playable city is a square about 600 metres across, centred on 0,0.
  city: {
    size: 600,
    halfSize: 300,
    blockSize: 60,
    roadWidth: 12,
    seaLevel: 0,
    beachWidth: 34,
    goldenHourMinutes: 1020, // 17:00 — the sun sits low for screenshots
  },

  // Six districts. bounds are [minX, minZ, maxX, maxZ] in world metres.
  // palette drives building/roof colours; landmark is the signature prop.
  districts: [
    {
      name: 'Marina Alba',
      bounds: [-300, -300, -100, -80],
      palette: { wall: 0xf2e3c8, roof: 0xc96f3f, accent: 0x2e7f8f, ground: 0xd9c9a3 },
      landmark: 'Marina Alba',
      flavour: 'stilt houses and boats',
      spawn: { x: -210, z: -190 },
    },
    {
      name: 'El Faro',
      bounds: [-300, -80, -100, 140],
      palette: { wall: 0xf5d9b0, roof: 0xb5502a, accent: 0xe8a13c, ground: 0xcbb58c },
      landmark: 'Faro de Maravilla',
      flavour: 'terracotta roofs',
      spawn: { x: -200, z: 30 },
    },
    {
      name: 'Centro Alba',
      bounds: [-100, -300, 120, -80],
      palette: { wall: 0xe8dcc0, roof: 0x8a4a3a, accent: 0xd94f4f, ground: 0xbfb49a },
      landmark: 'Banco Alba',
      flavour: 'night-market stalls',
      spawn: { x: 10, z: -190 },
    },
    {
      name: 'Paseo del Mar',
      bounds: [-100, -80, 120, 160],
      palette: { wall: 0xf7ead0, roof: 0x3f8f7a, accent: 0xf2b13c, ground: 0xe6d3a8 },
      landmark: 'the pier',
      flavour: 'surfboards and a beach',
      spawn: { x: 10, z: 40 },
    },
    {
      name: 'Miramar',
      bounds: [120, -300, 300, 0],
      palette: { wall: 0xf0e6d2, roof: 0x4a6fa5, accent: 0xe88ca0, ground: 0xd6c8a8 },
      landmark: 'Hotel Miramar',
      flavour: 'hotels',
      spawn: { x: 210, z: -150 },
    },
    {
      name: 'Estadio Sol',
      bounds: [120, 0, 300, 300],
      palette: { wall: 0xe9d9b8, roof: 0xd97b2b, accent: 0x3fae6a, ground: 0xc9b78f },
      landmark: 'Estadio Sol',
      flavour: 'stadium flags',
      spawn: { x: 210, z: 150 },
    },
  ],

  // Seven drivable vehicles: five cars (the Tormenta S is the fifth),
  // one van, and the Picuda 250 motorbike. topSpeed in km/h, accel/brake/
  // steer are arcade tuning factors.
  vehicles: [
    { id: 'brisa', name: 'Brisa', kind: 'car', topSpeed: 132, accel: 13, brake: 26, steer: 1.9, seats: 4, price: 0, colors: [0xd94f4f, 0x4a6fa5, 0xe8e0c8] },
    { id: 'solmar', name: 'Solmar', kind: 'car', topSpeed: 148, accel: 15, brake: 28, steer: 2.1, seats: 4, price: 0, colors: [0xf2b13c, 0x2e7f8f, 0x8a4a3a] },
    { id: 'coral', name: 'Coral', kind: 'car', topSpeed: 118, accel: 11, brake: 24, steer: 1.7, seats: 4, price: 0, colors: [0xe88ca0, 0x3f8f7a, 0xf5d9b0] },
    { id: 'oleaje', name: 'Oleaje', kind: 'car', topSpeed: 156, accel: 16, brake: 29, steer: 2.2, seats: 2, price: 0, colors: [0x2b4a6f, 0xc96f3f, 0xdddddd] },
    { id: 'carguero', name: 'Carguero', kind: 'van', topSpeed: 104, accel: 9, brake: 22, steer: 1.4, seats: 3, price: 0, colors: [0xe8e0c8, 0x6a7a8a, 0xb5502a] },
    { id: 'picuda250', name: 'Picuda 250', kind: 'bike', topSpeed: 168, accel: 18, brake: 30, steer: 2.8, seats: 2, price: 0, colors: [0xd94f4f, 0x222222, 0xf2b13c] },
    { id: 'tormenta', name: 'Tormenta S', kind: 'sports', topSpeed: 212, accel: 22, brake: 34, steer: 2.6, seats: 2, price: 0, colors: [0xc22a2a, 0x111111, 0xf2b13c] },
  ],

  // Six weapons. Fists and the pistol are owned from the start; the rest
  // are bought at the garage or picked up. mag is the magazine size,
  // reserve is the starting spare ammo for owned weapons.
  weapons: [
    { id: 'fists', name: 'Fists', key: '0', price: 0, owned: true, damage: 12, mag: 0, reserve: 0, range: 2.2, rate: 2.4 },
    { id: 'pistol', name: 'Pistol', key: '1', price: 0, owned: true, damage: 22, mag: 12, reserve: 60, range: 60, rate: 3.5 },
    { id: 'smg', name: 'SMG', key: '2', price: 900, owned: false, damage: 14, mag: 30, reserve: 120, range: 45, rate: 9 },
    { id: 'shotgun', name: 'Shotgun', key: '3', price: 1100, owned: false, damage: 55, mag: 6, reserve: 24, range: 26, rate: 1.1 },
    { id: 'rifle', name: 'Rifle', key: '4', price: 1600, owned: false, damage: 42, mag: 24, reserve: 96, range: 110, rate: 4.5 },
    { id: 'rpg', name: 'Trueno RPG', key: '5', price: 2500, owned: false, damage: 180, mag: 1, reserve: 4, range: 120, rate: 0.7 },
  ],

  // Respect ranks. rp is the minimum RP for the tier.
  ranks: [
    { name: 'ROOKIE', rp: 0 },
    { name: 'HUSTLER', rp: 500 },
    { name: 'FIXER', rp: 1200 },
    { name: 'SHOT CALLER', rp: 2400 },
    { name: 'LEYENDA', rp: 4500 },
  ],
  rpPerMission: 250,

  // Three invented radio stations, all procedural WebAudio.
  radio: [
    { id: 'faro-rock', name: 'Faro Rock 101', genre: 'rock', tempo: 132, root: 110 },
    { id: 'maravilla-nights', name: 'Maravilla Nights', genre: 'night', tempo: 96, root: 82.4 },
    { id: 'sol-fm', name: 'Sol FM', genre: 'sun', tempo: 118, root: 98 },
  ],

  // Prices in dollars.
  prices: {
    crewScrub: 150, // Celia scrubs heat (-2 stars)
    crewRepair: 100, // Tito repairs the ride
    crewClear: 200, // Big Marlon clears nearby cops
    safehouse: 2000, // Casa Verde
    garageEngine: [0, 400, 800, 1400],
    garageArmour: [0, 350, 700, 1200],
    garageNitro: 900,
    healthPack: 50,
    ammoBox: 75,
  },

  // Population counts.
  counts: {
    pedestrians: 64,
    trafficCars: 20,
    geckos: 20,
    stuntJumps: 5,
    exportCars: 5,
    saveSlots: 3,
    leaderboardSize: 5,
    dispatchRows: 6,
  },

  // Wanted / police tuning.
  police: {
    maxWanted: 5,
    heatMax: 100,
    roadblockAt: 3,
    helicopterAt: 4,
    heatDecayPerSecond: 1.2,
    heatDecayLoyal: 1.9,
    heatDecayHostile: 0.6,
  },

  // District standing: tiers, mission/crime effects, modifiers.
  standing: {
    start: 50,
    tiers: [
      { name: 'LOYAL', min: 75 },
      { name: 'WARM', min: 50 },
      { name: 'NEUTRAL', min: 25 },
      { name: 'COLD', min: 0 },
      { name: 'HOSTILE', min: -100 },
    ],
    missionDone: 8,
    crime: -3,
    loyalPriceDiscount: 0.10,
    loyalJobBonus: 0.25,
  },

  // Player defaults.
  player: {
    name: 'Rico "Rook" Vega',
    health: 100,
    armour: 25,
    money: 250,
    walkSpeed: 4.2,
    runSpeed: 7.5,
    jumpSpeed: 6.5,
  },

  clock: {
    startDay: 1,
    startMinutes: 980, // 16:20
    minutesPerRealSecond: 0.5, // 1 game-minute per ~2 real seconds
    minutesPerDay: 1440,
  },
};

export default CONFIG;
