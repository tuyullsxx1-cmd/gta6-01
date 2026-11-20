// side.js — side activities for MARAVILLA: Golden Geckos, stunt jumps,
// district jobs, the export list, and the Casa Verde safehouse.
// Written from the prose design spec. All positions come from a fixed-seed
// generator so every run places the same 20 geckos in the same spots.

const GECKO_SEED = 20261120;
const SAFEHOUSE_PRICE = 2000;

// Small seeded generator (mulberry-style). Gameplay randomness must never
// come from Math.random or the clock, so side activities use this.
function seededRng(seed) {
  let a = seed >>> 0;
  return function next() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function geckoPositions() {
  const next = seededRng(GECKO_SEED);
  const spots = [];
  // Hand-placed anchor spots first (landmarks), then seeded fill so the
  // total is exactly 20 and the layout is stable across runs.
  const anchors = [
    { x: -258, z: -238, hint: 'by the lighthouse steps' },
    { x: -252, z: 196, hint: 'on the lockup fence' },
    { x: -278, z: 118, hint: 'on the dock crates' },
    { x: 62, z: -118, hint: 'on the Banco Alba steps' },
    { x: 218, z: 178, hint: 'on the stadium gate' },
    { x: 178, z: -198, hint: 'on the hotel sign' },
    { x: 138, z: 208, hint: 'in the Casa Verde garden' },
    { x: 22, z: 38, hint: 'under the market lanterns' },
  ];
  for (const a of anchors) spots.push({ ...a });
  while (spots.length < 20) {
    const x = Math.round(-280 + next() * 560);
    const z = Math.round(-260 + next() * 520);
    if (spots.some((s) => Math.abs(s.x - x) < 24 && Math.abs(s.z - z) < 24)) continue;
    spots.push({ x, z, hint: 'hidden in the streets' });
  }
  return spots.map((s, i) => ({ id: `gecko-${i + 1}`, ...s }));
}

export const GECKOS = geckoPositions();

export const STUNT_JUMPS = [
  { id: 'jump-pier', name: 'Pier Leap', district: 'Paseo del Mar', ramp: { x: -230, z: -60 }, land: { x: -190, z: -60 }, reward: 300 },
  { id: 'jump-market', name: 'Market Flyer', district: 'Centro Alba', ramp: { x: 10, z: 20 }, land: { x: 50, z: 20 }, reward: 300 },
  { id: 'jump-stadium', name: 'Stadium Air', district: 'Estadio Sol', ramp: { x: 200, z: 160 }, land: { x: 240, z: 160 }, reward: 400 },
  { id: 'jump-faro', name: 'Lighthouse Drop', district: 'El Faro', ramp: { x: -240, z: -220 }, land: { x: -200, z: -220 }, reward: 400 },
  { id: 'jump-marina', name: 'Marina Hop', district: 'Marina Alba', ramp: { x: -260, z: 160 }, land: { x: -220, z: 160 }, reward: 300 },
];

// The five cars the export buyer wants, in order. Deliver the named car to
// the Marina Alba dock for the payout.
export const EXPORT_LIST = [
  { id: 'export-1', car: 'Solano', payout: 1200 },
  { id: 'export-2', car: 'Coral', payout: 1500 },
  { id: 'export-3', car: 'Carguero', payout: 1000 },
  { id: 'export-4', car: 'Tormenta S', payout: 2500 },
  { id: 'export-5', car: 'Brisa', payout: 2000 },
];

export const EXPORT_DOCK = { x: -280, z: 120, label: 'Marina Alba dock' };
export const SAFEHOUSE_POS = { x: 140, z: 210, label: 'Casa Verde' };

// Repeatable job templates per district. Payouts scale with standing
// (loyal districts pay 25% more); hostile districts close the board.
const JOB_TEMPLATES = [
  { kind: 'courier', name: 'Courier run', base: 120, blurb: 'Deliver a package across the district, no questions asked.' },
  { kind: 'lookout', name: 'Lookout shift', base: 100, blurb: 'Watch a corner for an hour and whistle if you see blue lights.' },
  { kind: 'tow', name: 'Tow job', base: 150, blurb: 'Drag a broken-down car to the nearest garage.' },
  { kind: 'flyers', name: 'Flyer drop', base: 80, blurb: 'Paper the district with flyers for the night market.' },
];

function dist(a, b) {
  const dx = a.x - b.x;
  const dz = a.z - b.z;
  return Math.sqrt(dx * dx + dz * dz);
}

function tierOf(standing) {
  if (standing >= 75) return 'LOYAL';
  if (standing >= 50) return 'WARM';
  if (standing >= 25) return 'NEUTRAL';
  if (standing >= 0) return 'COLD';
  return 'HOSTILE';
}

export function createSide(state, bus) {
  const emit = (name, data) => {
    if (bus && typeof bus.emit === 'function') bus.emit(name, data);
  };
  if (!state.collectibles) state.collectibles = {};
  if (!Array.isArray(state.collectibles.geckosFound)) state.collectibles.geckosFound = [];
  if (!Array.isArray(state.collectibles.jumpsDone)) state.collectibles.jumpsDone = [];
  if (!Array.isArray(state.collectibles.exportsDone)) state.collectibles.exportsDone = [];
  if (typeof state.collectibles.safehouseOwned !== 'boolean') state.collectibles.safehouseOwned = false;

  let activeJob = null;

  // --- Golden Geckos ------------------------------------------------------
  function nearestGecko(pos, radius = 6) {
    for (const g of GECKOS) {
      if (state.collectibles.geckosFound.includes(g.id)) continue;
      if (dist(pos, g) <= radius) return g;
    }
    return null;
  }

  function collectGecko(pos) {
    const g = nearestGecko(pos);
    if (!g) return null;
    state.collectibles.geckosFound.push(g.id);
    const count = state.collectibles.geckosFound.length;
    const bonus = count % 5 === 0 ? 250 : 50;
    if (state.player) state.player.money = (state.player.money || 0) + bonus;
    if (state.stats) {
      state.stats.moneyEarned = (state.stats.moneyEarned || 0) + bonus;
      state.stats.respect = (state.stats.respect || 0) + 2;
    }
    emit('gecko:found', { id: g.id, count, total: GECKOS.length, bonus });
    emit('message', { text: `Golden Gecko found! ${count}/20 (+$${bonus})` });
    if (count === GECKOS.length) {
      emit('message', { text: 'All 20 Golden Geckos collected — Maravilla is yours, Leyenda!' });
    }
    return g;
  }

  // --- Stunt jumps ----------------------------------------------------------
  function tryStuntJump(pos, speedKmh, airborne) {
    for (const j of STUNT_JUMPS) {
      if (state.collectibles.jumpsDone.includes(j.id)) continue;
      if (airborne && speedKmh >= 60 && dist(pos, j.ramp) <= 12) {
        state.collectibles.jumpsDone.push(j.id);
        if (state.player) state.player.money = (state.player.money || 0) + j.reward;
        if (state.stats) {
          state.stats.moneyEarned = (state.stats.moneyEarned || 0) + j.reward;
          // Longest jump: the ramp-to-landing distance of this stunt jump.
          state.stats.longestJump = Math.max(state.stats.longestJump || 0, dist(j.ramp, j.land));
        }
        emit('jump:done', { id: j.id, name: j.name, reward: j.reward });
        emit('message', { text: `Stunt jump: ${j.name}! (+$${j.reward})` });
        return j;
      }
    }
    return null;
  }

  // --- District jobs --------------------------------------------------------
  function standingOf(district) {
    if (state.districts && state.districts.standing) {
      return state.districts.standing[district] ?? 50;
    }
    return 50;
  }

  function jobsFor(district) {
    const tier = tierOf(standingOf(district));
    if (tier === 'HOSTILE') return { open: false, tier, jobs: [] };
    const payMult = tier === 'LOYAL' ? 1.25 : 1;
    const jobs = JOB_TEMPLATES.map((t, i) => ({
      id: `job-${district}-${i}`,
      district,
      kind: t.kind,
      name: t.name,
      blurb: t.blurb,
      payout: Math.round(t.base * payMult),
    }));
    return { open: true, tier, jobs };
  }

  function takeJob(district, jobId) {
    const board = jobsFor(district);
    if (!board.open) {
      emit('message', { text: `The ${district} job board is closed — the district is HOSTILE.` });
      return null;
    }
    const job = board.jobs.find((j) => j.id === jobId) || board.jobs[0];
    if (!job) return null;
    activeJob = { ...job, startedAt: (state.stats && state.stats.timePlayed) || 0 };
    emit('job:taken', { job: activeJob });
    emit('message', { text: `Job taken: ${job.name} in ${district} ($${job.payout})` });
    return activeJob;
  }

  function completeJob() {
    if (!activeJob) return false;
    const payout = activeJob.payout;
    if (state.player) state.player.money = (state.player.money || 0) + payout;
    if (state.stats) {
      state.stats.moneyEarned = (state.stats.moneyEarned || 0) + payout;
      state.stats.respect = (state.stats.respect || 0) + 1;
    }
    emit('job:done', { job: activeJob, payout });
    emit('message', { text: `Job done: ${activeJob.name} (+$${payout})` });
    activeJob = null;
    return true;
  }

  // --- Export list ----------------------------------------------------------
  function nextExport() {
    return EXPORT_LIST.find((e) => !state.collectibles.exportsDone.includes(e.id)) || null;
  }

  function deliverExport(carName, pos) {
    const want = nextExport();
    if (!want) {
      emit('message', { text: 'Export list complete — the buyer is happy.' });
      return null;
    }
    if (carName !== want.car) {
      emit('message', { text: `The buyer wants a ${want.car}, not a ${carName}.` });
      return null;
    }
    if (dist(pos, EXPORT_DOCK) > 16) {
      emit('message', { text: 'Deliver the car to the Marina Alba dock.' });
      return null;
    }
    state.collectibles.exportsDone.push(want.id);
    if (state.player) state.player.money = (state.player.money || 0) + want.payout;
    if (state.stats) state.stats.moneyEarned = (state.stats.moneyEarned || 0) + want.payout;
    emit('export:done', { id: want.id, car: want.car, payout: want.payout });
    emit('message', { text: `Export delivered: ${want.car} (+$${want.payout})` });
    const next = nextExport();
    if (next) emit('message', { text: `Next export wanted: ${next.car}` });
    return want;
  }

  // --- Casa Verde safehouse ---------------------------------------------------
  function buySafehouse() {
    if (state.collectibles.safehouseOwned) return true;
    const money = (state.player && state.player.money) || 0;
    if (money < SAFEHOUSE_PRICE) {
      emit('message', { text: `Casa Verde costs $${SAFEHOUSE_PRICE} — you have $${money}.` });
      return false;
    }
    state.player.money = money - SAFEHOUSE_PRICE;
    state.collectibles.safehouseOwned = true;
    emit('safehouse:bought', { price: SAFEHOUSE_PRICE });
    emit('message', { text: 'Casa Verde is yours — rest here to heal and save.' });
    return true;
  }

  function restAtSafehouse(pos) {
    if (!state.collectibles.safehouseOwned) return false;
    if (dist(pos, SAFEHOUSE_POS) > 14) return false;
    if (state.player) {
      state.player.health = 100;
      state.player.armour = Math.max(state.player.armour || 0, 25);
    }
    emit('safehouse:rested', {});
    emit('message', { text: 'Rested at Casa Verde — health restored. Game saved.' });
    if (bus && typeof bus.emit === 'function') bus.emit('save:autosave', { slot: 1 });
    return true;
  }

  // Tick hook: gecko pickup is proximity based; call from the main loop.
  function update(pos) {
    if (!pos) return;
    collectGecko(pos);
  }

  return {
    GECKOS,
    STUNT_JUMPS,
    EXPORT_LIST,
    EXPORT_DOCK,
    SAFEHOUSE_POS,
    SAFEHOUSE_PRICE,
    collectGecko,
    nearestGecko,
    tryStuntJump,
    jobsFor,
    takeJob,
    completeJob,
    nextExport,
    deliverExport,
    buySafehouse,
    restAtSafehouse,
    update,
    get activeJob() {
      return activeJob;
    },
    get geckosFound() {
      return state.collectibles.geckosFound.length;
    },
  };
}
