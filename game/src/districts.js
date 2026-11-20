// districts.js — district standing: how each part of Maravilla feels
// about Rook. Standing runs -100..100 per district, starting at 50.
// Finishing a mission in a district lifts it by 8; each crime there drops
// it by 3. The tier (LOYAL / WARM / NEUTRAL / COLD / HOSTILE) changes the
// game: loyal districts hide the player, cut prices, and pay jobs better;
// hostile districts do the opposite and close their job boards. The same
// crime earns wanted 3 in a loyal district and wanted 5 in a hostile one,
// through the heat multiplier below.

export const DISTRICTS = [
  { name: 'Marina Alba', flavor: 'Stilt houses, boats, and the smell of salt and diesel.' },
  { name: 'El Faro', flavor: 'Terracotta roofs climbing the hill under the lighthouse.' },
  { name: 'Centro Alba', flavor: 'Night-market stalls, neon, and everybody knowing everybody.' },
  { name: 'Paseo del Mar', flavor: 'Surfboards, sand, and a beach that never really sleeps.' },
  { name: 'Miramar', flavor: 'Hotels and palm shade along the grand promenade.' },
  { name: 'Estadio Sol', flavor: 'Stadium flags, fried food, and match-day crowds.' },
];

export const DISTRICT_NAMES = DISTRICTS.map((d) => d.name);

// Rough district centres on the 600x600 city grid, used only when no
// authoritative district lookup is supplied by the city module. The city
// module may override the player's district through setCurrentDistrict.
const DISTRICT_CENTRES = {
  'Marina Alba': { x: -190, z: -190 },
  'El Faro': { x: 190, z: -190 },
  'Centro Alba': { x: 0, z: -150 },
  'Paseo del Mar': { x: -190, z: 190 },
  Miramar: { x: 190, z: 190 },
  'Estadio Sol': { x: 0, z: 150 },
};

export function tierForStanding(value) {
  if (value >= 75) return 'LOYAL';
  if (value >= 50) return 'WARM';
  if (value >= 25) return 'NEUTRAL';
  if (value >= 0) return 'COLD';
  return 'HOSTILE';
}

// Per-tier gameplay modifiers. Loyal hides the player; hostile exposes them.
export const TIER_MODIFIERS = {
  LOYAL: { heatGain: 0.6, heatDecay: 1.5, copSpeed: 0.85, price: 0.9, jobPay: 1.25, jobsOpen: true },
  WARM: { heatGain: 0.8, heatDecay: 1.25, copSpeed: 0.95, price: 0.95, jobPay: 1.1, jobsOpen: true },
  NEUTRAL: { heatGain: 1.0, heatDecay: 1.0, copSpeed: 1.0, price: 1.0, jobPay: 1.0, jobsOpen: true },
  COLD: { heatGain: 1.3, heatDecay: 0.8, copSpeed: 1.05, price: 1.05, jobPay: 0.9, jobsOpen: true },
  HOSTILE: { heatGain: 1.7, heatDecay: 0.6, copSpeed: 1.15, price: 1.15, jobPay: 0.75, jobsOpen: false },
};

// Heat bands shared with the police module: the same base crime heat
// must land at wanted 3 in a loyal district and wanted 5 in a hostile one.
export function wantedLevelForHeat(heat) {
  if (heat <= 0) return 0;
  if (heat <= 15) return 1;
  if (heat <= 35) return 2;
  if (heat <= 55) return 3;
  if (heat <= 75) return 4;
  return 5;
}

export function heatForCrime(baseHeat, standingValue) {
  const tier = tierForStanding(standingValue);
  const scaled = Math.min(100, Math.max(0, baseHeat * TIER_MODIFIERS[tier].heatGain));
  return { heat: Math.round(scaled), level: wantedLevelForHeat(scaled), tier };
}

function clamp(v, lo, hi) {
  return v < lo ? lo : v > hi ? hi : v;
}

function ensureStanding(state) {
  if (!state.districts) state.districts = { standing: {}, current: 'Centro Alba' };
  if (!state.districts.standing || typeof state.districts.standing !== 'object') {
    state.districts.standing = {};
  }
  for (const name of DISTRICT_NAMES) {
    if (typeof state.districts.standing[name] !== 'number') {
      state.districts.standing[name] = 50;
    }
  }
  return state.districts.standing;
}

export function createDistricts(state, bus) {
  const standing = ensureStanding(state);
  let currentOverride = null;

  function nearestDistrict(x, z) {
    let best = 'Centro Alba';
    let bestD = Infinity;
    for (const name of DISTRICT_NAMES) {
      const c = DISTRICT_CENTRES[name];
      const d = (c.x - x) * (c.x - x) + (c.z - z) * (c.z - z);
      if (d < bestD) {
        bestD = d;
        best = name;
      }
    }
    return best;
  }

  function currentDistrict() {
    if (currentOverride) return currentOverride;
    const p = state.player || {};
    if (typeof p.district === 'string' && p.district) return p.district;
    if (state.districts && typeof state.districts.current === 'string' && state.districts.current) {
      return state.districts.current;
    }
    if (typeof p.x === 'number' && typeof p.z === 'number') return nearestDistrict(p.x, p.z);
    return 'Centro Alba';
  }

  function setCurrentDistrict(name) {
    if (DISTRICT_NAMES.indexOf(name) < 0) return false;
    currentOverride = name;
    if (state.districts) state.districts.current = name;
    const p = state.player || {};
    p.district = name;
    return true;
  }

  function getStanding(name) {
    if (DISTRICT_NAMES.indexOf(name) < 0) return 50;
    return standing[name];
  }

  function setStanding(name, value) {
    if (DISTRICT_NAMES.indexOf(name) < 0) return false;
    const before = standing[name];
    standing[name] = clamp(Math.round(value), -100, 100);
    if (bus && standing[name] !== before) {
      bus.emit('standing-changed', {
        district: name,
        standing: standing[name],
        tier: tierForStanding(standing[name]),
        before,
      });
    }
    return true;
  }

  function shiftStanding(name, delta) {
    return setStanding(name, getStanding(name) + delta);
  }

  function applyCrime(districtName, crime) {
    const district = districtName || currentDistrict();
    const before = getStanding(district);
    shiftStanding(district, -3);
    if (bus) {
      bus.emit('district-crime', { district, crime: crime || 'crime', before, after: standing[district] });
      if (tierForStanding(standing[district]) === 'HOSTILE' && tierForStanding(before) !== 'HOSTILE') {
        bus.emit('message', { text: district + ' has turned HOSTILE. Its job board is closed.' });
      }
    }
    return standing[district];
  }

  function applyMissionDone(districtName) {
    const district = districtName || currentDistrict();
    const before = getStanding(district);
    shiftStanding(district, 8);
    if (bus) {
      bus.emit('district-mission-done', { district, before, after: standing[district] });
      if (tierForStanding(standing[district]) === 'LOYAL' && tierForStanding(before) !== 'LOYAL') {
        bus.emit('message', { text: district + ' is LOYAL now. Prices down, jobs pay more, heat fades fast.' });
      }
    }
    return standing[district];
  }

  function modifiersFor(name) {
    const district = name || currentDistrict();
    const tier = tierForStanding(getStanding(district));
    return { district, tier, standing: getStanding(district), ...TIER_MODIFIERS[tier] };
  }

  function priceFor(amount, districtName) {
    return Math.round(amount * modifiersFor(districtName).price);
  }

  function jobPayFor(amount, districtName) {
    return Math.round(amount * modifiersFor(districtName).jobPay);
  }

  function jobsOpen(districtName) {
    return modifiersFor(districtName).jobsOpen;
  }

  function summary() {
    return DISTRICTS.map((d) => ({
      name: d.name,
      flavor: d.flavor,
      standing: standing[d.name],
      tier: tierForStanding(standing[d.name]),
      jobsOpen: TIER_MODIFIERS[tierForStanding(standing[d.name])].jobsOpen,
    }));
  }

  if (bus) {
    bus.on('crime-committed', (data) => {
      if (data) applyCrime(data.district, data.crime);
    });
    bus.on('mission-complete', (data) => {
      if (data) applyMissionDone(data.district);
    });
  }

  return {
    update() {
      // Standing only moves on events; nothing to tick per frame.
    },
    DISTRICTS,
    DISTRICT_NAMES,
    tierFor: tierForStanding,
    modifiersFor,
    currentDistrict,
    setCurrentDistrict,
    getStanding,
    setStanding,
    shiftStanding,
    applyCrime,
    applyMissionDone,
    heatForCrime: (baseHeat, districtName) =>
      heatForCrime(baseHeat, getStanding(districtName || currentDistrict())),
    wantedLevelForHeat,
    priceFor,
    jobPayFor,
    jobsOpen,
    summary,
  };
}
