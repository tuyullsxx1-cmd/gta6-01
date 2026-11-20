// police.js — Maravilla PD: wanted level, heat, pursuit units, dispatch feed.
//
// The wanted system runs on heat (0-100). Crimes add heat, scaled by how
// the district the player is standing in feels about them: the same crime
// lands much harder in a hostile district than a loyal one. Heat decays
// while the player lays low, and the wanted level is derived from heat.
// Units spawn by level: foot cops and patrol cars at low heat, roadblocks
// from 3 stars, a helicopter from 4 stars. Every unit carries a callsign
// that is unique forever: one global serial counter plus a disjoint
// prefix pool per unit type, so no callsign can ever repeat.

function clamp(v, lo, hi) {
  return v < lo ? lo : v > hi ? hi : v;
}

function distance2d(ax, az, bx, bz) {
  const dx = ax - bx;
  const dz = az - bz;
  return Math.sqrt(dx * dx + dz * dz);
}

// Small deterministic PRNG (mulberry32). Gameplay randomness must never
// come from Math.random or the clock, so this module keeps its own seeded
// stream and prefers a shared one on state.rng when the state provides it.
function mulberry32(seed) {
  let a = seed >>> 0;
  return function next() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function makeRng(state, seed) {
  if (state && state.rng && typeof state.rng.next === 'function') {
    const shared = state.rng;
    return {
      next: () => shared.next(),
      range: (a, b) => a + (b - a) * shared.next(),
      int: (a, b) => Math.floor(a + (b - a + 1) * shared.next()),
      pick: (list) => list[Math.floor(shared.next() * list.length)],
    };
  }
  const next = mulberry32(seed);
  return {
    next,
    range: (a, b) => a + (b - a) * next(),
    int: (a, b) => Math.floor(a + (b - a + 1) * next()),
    pick: (list) => list[Math.floor(next() * list.length)],
  };
}

// Heat bands -> wanted stars. A 60-heat carjacking lands at 36 heat
// (3 stars) in a loyal district and 100 heat (5 stars) in a hostile one.
const HEAT_BANDS = [
  { max: 0, level: 0 },
  { max: 15, level: 1 },
  { max: 35, level: 2 },
  { max: 55, level: 3 },
  { max: 75, level: 4 },
  { max: 100, level: 5 },
];

export function wantedLevelForHeat(heat) {
  for (const band of HEAT_BANDS) {
    if (heat <= band.max) return band.level;
  }
  return 5;
}

// Base heat per crime type, before the district multiplier.
export const CRIME_HEAT = {
  shove: 12,
  theft: 25,
  assault: 40,
  carjacking: 60,
  shooting: 70,
  killing: 85,
  explosion: 90,
};

export const CRIME_LABELS = {
  shove: 'DISORDERLY CONDUCT',
  theft: 'PETTY THEFT',
  assault: 'ASSAULT',
  carjacking: 'GRAND THEFT AUTO',
  shooting: 'DISCHARGING A FIREARM',
  killing: 'HOMICIDE',
  explosion: 'DESTRUCTION OF PROPERTY',
};

// District standing tiers, mirroring the districts module.
function tierForStanding(value) {
  if (value >= 75) return 'LOYAL';
  if (value >= 50) return 'WARM';
  if (value >= 25) return 'NEUTRAL';
  if (value >= 0) return 'COLD';
  return 'HOSTILE';
}

const TIER_HEAT_GAIN = { LOYAL: 0.6, WARM: 0.8, NEUTRAL: 1.0, COLD: 1.3, HOSTILE: 1.7 };
const TIER_HEAT_DECAY = { LOYAL: 1.5, WARM: 1.25, NEUTRAL: 1.0, COLD: 0.8, HOSTILE: 0.6 };
const TIER_COP_SPEED = { LOYAL: 0.85, WARM: 0.95, NEUTRAL: 1.0, COLD: 1.05, HOSTILE: 1.15 };

// How many of each unit type the department fields at each wanted level.
const DEPLOYMENT = {
  0: { foot: 0, patrol: 0, rammer: 0, roadblock: 0, heli: 0 },
  1: { foot: 2, patrol: 1, rammer: 0, roadblock: 0, heli: 0 },
  2: { foot: 3, patrol: 2, rammer: 0, roadblock: 0, heli: 0 },
  3: { foot: 2, patrol: 3, rammer: 1, roadblock: 2, heli: 0 },
  4: { foot: 2, patrol: 3, rammer: 2, roadblock: 3, heli: 1 },
  5: { foot: 3, patrol: 4, rammer: 2, roadblock: 4, heli: 1 },
};

const UNIT_DEFS = {
  foot: { prefix: 'FOOT', role: 'Beat', speed: 4.6, radius: 1.0 },
  patrol: { prefix: 'UNIT', role: 'Pursuit', speed: 13.0, radius: 2.2 },
  rammer: { prefix: 'RAM', role: 'Ramming', speed: 16.5, radius: 2.2 },
  roadblock: { prefix: 'BLOCK', role: 'Roadblock', speed: 0, radius: 2.4 },
  heli: { prefix: 'AIR', role: 'Air', speed: 20.0, radius: 3.0 },
};

const TICKER_LINES = {
  1: [
    'MPD responding to a disturbance call',
    'Units asked to keep an eye out in the area',
    'Patrols sweeping the block, stay calm',
  ],
  2: [
    'Suspect vehicle reported, units converging',
    'MPD setting up a perimeter around the district',
    'Dispatch: suspect is mobile, use caution',
  ],
  3: [
    'Roadblocks going up on the main avenues',
    'Air support on standby, ground units pursue',
    'Detective El Gato wants this one brought in',
  ],
  4: [
    'Helicopter over the scene, spotlight on the suspect',
    'All units: suspect is considered armed',
    'Roadblocks on every exit, nobody slips out',
  ],
  5: [
    'Full city alert, every available unit responding',
    'El Gato has taken command of the pursuit',
    'Maravilla PD will not let this one go',
  ],
};

function ensureWanted(state) {
  if (!state.wanted) state.wanted = { level: 0, heat: 0, crime: '' };
  if (typeof state.wanted.level !== 'number') state.wanted.level = 0;
  if (typeof state.wanted.heat !== 'number') state.wanted.heat = 0;
  if (typeof state.wanted.crime !== 'string') state.wanted.crime = '';
  return state.wanted;
}

function playerPos(state) {
  const p = state.player || {};
  return { x: typeof p.x === 'number' ? p.x : 0, z: typeof p.z === 'number' ? p.z : 0 };
}

function playerHeading(state) {
  const p = state.player || {};
  return typeof p.heading === 'number' ? p.heading : 0;
}

export function createPolice(state, bus) {
  const rng = makeRng(state, 0x504f4c49); // 'POLI'
  const wanted = ensureWanted(state);

  // One global serial counter for every unit ever created. Callsign pools
  // are disjoint by prefix, so a callsign can never repeat.
  let nextSerial = 1;
  let units = [];
  let elapsed = 0;
  let secondsSinceCrime = 999;
  let spawnTimer = 0;
  let standDownTimer = 0;
  let bustTimer = 0;
  let lastTickerIndex = -1;

  function districtStanding(name) {
    const d = state.districts;
    if (d && d.standing && typeof d.standing[name] === 'number') return d.standing[name];
    return 50;
  }

  function currentDistrictName() {
    const p = state.player || {};
    if (typeof p.district === 'string' && p.district) return p.district;
    if (state.districts && typeof state.districts.current === 'string') return state.districts.current;
    return 'Centro Alba';
  }

  function currentTier() {
    return tierForStanding(districtStanding(currentDistrictName()));
  }

  function makeCallsign(type) {
    const serial = nextSerial;
    nextSerial += 1;
    return UNIT_DEFS[type].prefix + '-' + String(serial).padStart(3, '0');
  }

  function spawnUnit(type) {
    const def = UNIT_DEFS[type];
    const p = playerPos(state);
    const angle = rng.range(0, Math.PI * 2);
    const ring = type === 'heli' ? rng.range(20, 45) : rng.range(70, 130);
    let x = p.x + Math.cos(angle) * ring;
    let z = p.z + Math.sin(angle) * ring;
    let y = 0;
    if (type === 'roadblock') {
      // Roadblocks go up ahead of the player, across their path.
      const h = playerHeading(state);
      const ahead = rng.range(45, 75);
      const lateral = rng.pick([-9, 0, 9]);
      x = p.x + Math.sin(h) * ahead + Math.cos(h) * lateral;
      z = p.z + Math.cos(h) * ahead - Math.sin(h) * lateral;
    }
    if (type === 'heli') y = 46;
    const unit = {
      id: 'police-' + nextSerial,
      callsign: makeCallsign(type),
      type,
      role: def.role,
      x,
      y,
      z,
      speed: def.speed,
      radius: def.radius,
      ramCooldown: 0,
      giveUp: 0,
    };
    units.push(unit);
    return unit;
  }

  function desiredCounts(level) {
    return DEPLOYMENT[clamp(level, 0, 5)];
  }

  function maintainDeployment() {
    const want = desiredCounts(wanted.level);
    const have = { foot: 0, patrol: 0, rammer: 0, roadblock: 0, heli: 0 };
    for (const u of units) have[u.type] += 1;
    for (const type of Object.keys(want)) {
      while (have[type] < want[type] && units.length < 14) {
        spawnUnit(type);
        have[type] += 1;
      }
    }
    // Too many of a type (level dropped): the extras give up first.
    for (const type of Object.keys(want)) {
      while (have[type] > want[type]) {
        const idx = units.findIndex((u) => u.type === type);
        if (idx < 0) break;
        units.splice(idx, 1);
        have[type] -= 1;
      }
    }
  }

  function applyLevelChange(oldLevel, newLevel) {
    if (oldLevel === newLevel) return;
    wanted.level = newLevel;
    // Escaped the law: heat fully cleared after having been wanted.
    if (newLevel === 0 && oldLevel > 0 && state.stats) {
      state.stats.copsEscaped = (state.stats.copsEscaped || 0) + 1;
    }
    if (bus) {
      bus.emit('wanted-changed', { level: newLevel, heat: wanted.heat, crime: wanted.crime });
      bus.emit('message', {
        text:
          newLevel === 0
            ? 'You slipped away. The heat is off.'
            : 'Wanted level ' + newLevel + ' — Maravilla PD is on you.',
      });
    }
  }

  function refreshLevel() {
    const next = wantedLevelForHeat(Math.round(wanted.heat));
    applyLevelChange(wanted.level, next);
  }

  function addHeat(amount, crimeKey, districtName) {
    const district = districtName || currentDistrictName();
    const tier = tierForStanding(districtStanding(district));
    const scaled = amount * TIER_HEAT_GAIN[tier];
    wanted.heat = clamp(wanted.heat + scaled, 0, 100);
    if (crimeKey && CRIME_LABELS[crimeKey]) wanted.crime = CRIME_LABELS[crimeKey];
    secondsSinceCrime = 0;
    refreshLevel();
    if (bus) {
      bus.emit('heat-changed', { heat: wanted.heat, level: wanted.level, tier, district });
      bus.emit('message', { text: 'WANTED FOR: ' + wanted.crime + ' — ' + district + ' (' + tier + ')' });
    }
    return { heat: wanted.heat, level: wanted.level, tier };
  }

  function reportCrime(crimeKey, districtName) {
    const base = CRIME_HEAT[crimeKey] || 25;
    const result = addHeat(base, crimeKey, districtName);
    // The district hears about it too.
    if (bus) bus.emit('crime-committed', { crime: crimeKey, district: districtName || currentDistrictName() });
    return result;
  }

  function clearHeat(amount) {
    wanted.heat = clamp(wanted.heat - amount, 0, 100);
    if (wanted.heat === 0) wanted.crime = '';
    refreshLevel();
    return wanted.heat;
  }

  function scrubStars(stars) {
    // Celia's scrub: two stars is worth forty heat.
    return clearHeat(stars * 20);
  }

  function clearNearby(radius) {
    const p = playerPos(state);
    const before = units.length;
    units = units.filter((u) => {
      if (u.type === 'heli') return true;
      return distance2d(u.x, u.z, p.x, p.z) > radius;
    });
    const cleared = before - units.length;
    if (bus && cleared > 0) {
      bus.emit('message', { text: 'Big Marlon cleared ' + cleared + ' unit' + (cleared === 1 ? '' : 's') + ' off your tail.' });
    }
    return cleared;
  }

  function updateUnit(u, dt, copSpeedMul) {
    const p = playerPos(state);
    const player = state.player || {};
    const playerSpeed = typeof player.speedKmh === 'number' ? player.speedKmh : 0;
    const inCar = player.onFoot === false && player.currentCar;
    if (u.ramCooldown > 0) u.ramCooldown -= dt;

    if (u.type === 'foot') {
      const d = distance2d(u.x, u.z, p.x, p.z);
      if (d > 0.01) {
        const step = Math.min(d, u.speed * copSpeedMul * dt);
        u.x += ((p.x - u.x) / d) * step;
        u.z += ((p.z - u.z) / d) * step;
      }
      // A foot cop who catches the player on foot starts a bust.
      if (player.onFoot !== false && d < 2.5 && wanted.level > 0) {
        bustTimer += dt;
        if (bustTimer > 2.5) {
          bustTimer = 0;
          if (bus) bus.emit('busted', { level: wanted.level, district: currentDistrictName() });
        }
      }
      return;
    }

    if (u.type === 'heli') {
      const k = Math.min(1, dt * 1.5);
      u.x += (p.x - u.x) * k;
      u.z += (p.z - u.z) * k;
      u.y = 46;
      return;
    }

    if (u.type === 'roadblock') return; // Roadblocks hold their ground.

    // Patrol and rammer cars chase. Rammers aim ahead of the player to cut
    // them off; patrol cars drive straight at them.
    let tx = p.x;
    let tz = p.z;
    if (u.type === 'rammer') {
      const h = playerHeading(state);
      const lead = clamp(playerSpeed * 0.35, 0, 14);
      tx = p.x + Math.sin(h) * lead;
      tz = p.z + Math.cos(h) * lead;
    }
    const d = distance2d(u.x, u.z, tx, tz);
    if (d > 0.01) {
      const step = Math.min(d, u.speed * copSpeedMul * dt);
      u.x += ((tx - u.x) / d) * step;
      u.z += ((tz - u.z) / d) * step;
    }
    const touch = distance2d(u.x, u.z, p.x, p.z);
    const ramRange = inCar ? 4.5 : 3.0;
    if (touch < ramRange && u.ramCooldown <= 0) {
      u.ramCooldown = 3;
      const damage = u.type === 'rammer' ? 14 : 8;
      if (bus) {
        bus.emit('rammed', { callsign: u.callsign, damage, inCar });
        bus.emit('vehicle-damaged', { amount: damage, source: u.callsign });
        if (!inCar) bus.emit('player-hurt', { amount: 6, source: u.callsign });
      }
    }
  }

  function update(dt) {
    if (!dt || dt <= 0) return;
    elapsed += dt;
    secondsSinceCrime += dt;

    // Heat decays while the player lays low: no new crime for a while and
    // no active shooting. Loyal districts cool off faster, hostile slower.
    const layingLow = secondsSinceCrime > 6;
    if (layingLow && wanted.heat > 0) {
      const tier = currentTier();
      const decay = 1.2 * TIER_HEAT_DECAY[tier] * dt;
      wanted.heat = clamp(wanted.heat - decay, 0, 100);
      if (wanted.heat === 0) wanted.crime = '';
      refreshLevel();
    }

    if (wanted.level > 0) {
      spawnTimer -= dt;
      if (spawnTimer <= 0) {
        spawnTimer = 2;
        maintainDeployment();
      }
      const copSpeedMul = TIER_COP_SPEED[currentTier()];
      for (const u of units) updateUnit(u, dt, copSpeedMul);
      // Roadblocks the player smashes through are gone for good.
      const p = playerPos(state);
      const player = state.player || {};
      if (player.onFoot === false && player.currentCar) {
        units = units.filter((u) => {
          if (u.type !== 'roadblock') return true;
          if (distance2d(u.x, u.z, p.x, p.z) < 5) {
            if (bus) {
              bus.emit('roadblock-smashed', { callsign: u.callsign });
              bus.emit('vehicle-damaged', { amount: 15, source: u.callsign });
            }
            return false;
          }
          return true;
        });
      }
    } else if (units.length > 0) {
      // Heat is gone: units stand down one at a time instead of vanishing.
      standDownTimer -= dt;
      if (standDownTimer <= 0) {
        standDownTimer = 1;
        units.pop();
        if (units.length === 0 && bus) bus.emit('pursuit-ended', {});
      }
    }
  }

  function getDispatch() {
    const p = playerPos(state);
    const rows = units
      .map((u) => ({
        callsign: u.callsign,
        role: u.role,
        type: u.type,
        distanceM: Math.round(distance2d(u.x, u.z, p.x, p.z)),
        x: u.x,
        z: u.z,
      }))
      .sort((a, b) => a.distanceM - b.distanceM);
    const lines = TICKER_LINES[clamp(wanted.level, 1, 5)] || [];
    const ticker =
      wanted.level === 0
        ? 'All quiet across Maravilla.'
        : lines.length > 0
          ? lines[Math.floor(elapsed / 4) % lines.length]
          : '';
    if (lastTickerIndex !== Math.floor(elapsed / 4)) lastTickerIndex = Math.floor(elapsed / 4);
    return {
      level: wanted.level,
      heat: Math.round(wanted.heat),
      crime: wanted.crime || '—',
      wantedFor: wanted.crime || '—',
      district: currentDistrictName(),
      tier: currentTier(),
      units: rows,
      ticker,
    };
  }

  if (bus) {
    bus.on('crime', (data) => {
      if (!data) return;
      reportCrime(data.type || data.crime || 'theft', data.district);
    });
    bus.on('clear-cops', (data) => {
      clearNearby(data && data.radius ? data.radius : 60);
    });
    bus.on('scrub-heat', (data) => {
      scrubStars(data && data.stars ? data.stars : 2);
    });
  }

  return {
    update,
    addHeat,
    reportCrime,
    clearHeat,
    scrubStars,
    clearNearby,
    setWanted(level) {
      const target = clamp(level, 0, 5);
      wanted.heat = target === 0 ? 0 : [0, 8, 25, 45, 65, 88][target];
      // The wanted level was just (re)asserted: the player is not laying
      // low, so the heat-decay clock restarts here.
      secondsSinceCrime = 0;
      refreshLevel();
    },
    getDispatch,
    getUnits() {
      return units.slice();
    },
    unitCount() {
      return units.length;
    },
    isPursued() {
      return wanted.level > 0 && units.length > 0;
    },
    wantedLevel() {
      return wanted.level;
    },
    heat() {
      return wanted.heat;
    },
    currentDistrict: currentDistrictName,
    currentTier,
  };
}
