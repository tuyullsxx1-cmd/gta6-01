// weapons.js — the weapon wheel, shooting, reloads, pickups, and the
// Trueno RPG. Six weapons: fists and a pistol from the start, then the
// SMG, shotgun, rifle, and RPG bought with cash. Shooting is a pure-math
// ray against sphere targets (no scene dependency), so the same fire()
// path works for the playtest harness and the live game. The RPG blast
// damages everything in its radius and can chain to nearby vehicles.

function clamp(v, lo, hi) {
  return v < lo ? lo : v > hi ? hi : v;
}

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
      pick: (list) => list[Math.floor(shared.next() * list.length)],
    };
  }
  const next = mulberry32(seed);
  return {
    next,
    range: (a, b) => a + (b - a) * next(),
    pick: (list) => list[Math.floor(next() * list.length)],
  };
}

// Distance from a ray to a sphere centre along the ray, or -1 for a miss.
function rayHitSphere(ox, oy, oz, dx, dy, dz, cx, cy, cz, r) {
  const lx = cx - ox;
  const ly = cy - oy;
  const lz = cz - oz;
  const tca = lx * dx + ly * dy + lz * dz;
  if (tca < 0) return -1;
  const d2 = lx * lx + ly * ly + lz * lz - tca * tca;
  if (d2 > r * r) return -1;
  // The ray may start inside the sphere (point-blank shot): the entry
  // point is then behind the origin, so clamp the hit distance to 0
  // instead of reporting a miss.
  return Math.max(0, tca - Math.sqrt(r * r - d2));
}

export const WEAPONS = [
  {
    id: 'fists',
    name: 'Fists',
    slot: 0,
    key: '1',
    price: 0,
    damage: 12,
    range: 2.4,
    magSize: 0,
    reserveMax: 0,
    fireInterval: 0.4,
    pellets: 1,
    spread: 0,
    blastRadius: 0,
    icon: 'fist',
    desc: 'Always with you. Quiet, personal, free.',
  },
  {
    id: 'pistol',
    name: 'Pistol',
    slot: 1,
    key: '2',
    price: 0,
    damage: 22,
    range: 60,
    magSize: 12,
    reserveMax: 120,
    fireInterval: 0.32,
    pellets: 1,
    spread: 0.012,
    blastRadius: 0,
    icon: 'pistol',
    desc: 'Rook’s old sidearm. Reliable at street range.',
  },
  {
    id: 'smg',
    name: 'SMG',
    slot: 2,
    key: '3',
    price: 900,
    damage: 14,
    range: 45,
    magSize: 30,
    reserveMax: 240,
    fireInterval: 0.11,
    pellets: 1,
    spread: 0.03,
    blastRadius: 0,
    icon: 'smg',
    desc: 'Sprays fast and close. Eats ammo for breakfast.',
  },
  {
    id: 'shotgun',
    name: 'Shotgun',
    slot: 3,
    key: '4',
    price: 1100,
    damage: 9,
    range: 26,
    magSize: 6,
    reserveMax: 48,
    fireInterval: 0.85,
    pellets: 6,
    spread: 0.07,
    blastRadius: 0,
    icon: 'shotgun',
    desc: 'Six pellets of bad news. Devastating up close.',
  },
  {
    id: 'rifle',
    name: 'Rifle',
    slot: 4,
    key: '5',
    price: 1600,
    damage: 45,
    range: 120,
    magSize: 20,
    reserveMax: 160,
    fireInterval: 0.5,
    pellets: 1,
    spread: 0.004,
    blastRadius: 0,
    icon: 'rifle',
    desc: 'Long reach, heavy punch. One careful shot is enough.',
  },
  {
    id: 'rpg',
    name: 'Trueno RPG',
    slot: 5,
    key: null,
    price: 2500,
    damage: 120,
    range: 150,
    magSize: 1,
    reserveMax: 6,
    fireInterval: 1.4,
    pellets: 1,
    spread: 0,
    blastRadius: 9,
    icon: 'rpg',
    desc: 'The Trueno. Fires a rocket, ends arguments, starts fires.',
  },
];

const PICKUP_KINDS = {
  health: { heal: 40, label: 'Health pack' },
  ammo: { label: 'Ammo box' },
};

function tierForStanding(value) {
  if (value >= 75) return 'LOYAL';
  if (value >= 50) return 'WARM';
  if (value >= 25) return 'NEUTRAL';
  if (value >= 0) return 'COLD';
  return 'HOSTILE';
}

const TIER_PRICE = { LOYAL: 0.9, WARM: 0.95, NEUTRAL: 1.0, COLD: 1.05, HOSTILE: 1.15 };

function ensureWeapons(state) {
  if (!state.weapons) {
    state.weapons = {
      current: 1,
      owned: ['fists', 'pistol'],
      ammo: {},
    };
  }
  const w = state.weapons;
  if (!Array.isArray(w.owned)) w.owned = ['fists', 'pistol'];
  if (typeof w.current !== 'number') w.current = 1;
  if (!w.ammo || typeof w.ammo !== 'object') w.ammo = {};
  for (const def of WEAPONS) {
    const entry = w.ammo[def.id];
    if (typeof entry === 'number') {
      // state.js stores flat mag counts with a separate reserve map;
      // upgrade them to the { mag, reserve } shape fire() reads.
      const reserveMap = (state.weapons && state.weapons.reserve) || {};
      w.ammo[def.id] = {
        mag: entry,
        reserve: typeof reserveMap[def.id] === 'number' ? reserveMap[def.id] : 0,
      };
    } else if (!entry) {
      w.ammo[def.id] = {
        mag: def.id === 'pistol' ? 12 : def.magSize,
        reserve: def.id === 'pistol' ? 60 : 0,
      };
    }
  }
  return w;
}

export function createWeapons(state, bus) {
  const rng = makeRng(state, 0x5745504e); // 'WEPN'
  const weapons = ensureWeapons(state);
  let fireCooldown = 0;
  let reloadTimer = 0;
  let reloading = false;
  let wheelOpen = false;
  let pickups = [];
  let pickupSerial = 1;

  function currentDef() {
    return WEAPONS[clamp(weapons.current, 0, WEAPONS.length - 1)];
  }

  function isOwned(id) {
    return weapons.owned.indexOf(id) >= 0;
  }

  function districtPriceMul() {
    const d = state.districts;
    const p = state.player || {};
    const name =
      (typeof p.district === 'string' && p.district) ||
      (d && typeof d.current === 'string' ? d.current : null) ||
      'Centro Alba';
    const standing = d && d.standing && typeof d.standing[name] === 'number' ? d.standing[name] : 50;
    return TIER_PRICE[tierForStanding(standing)];
  }

  function priceFor(def) {
    return Math.round(def.price * districtPriceMul());
  }

  function select(index, quiet) {
    const def = WEAPONS[clamp(index, 0, WEAPONS.length - 1)];
    if (!isOwned(def.id)) {
      if (bus && !quiet) {
        bus.emit('message', { text: def.name + ' is locked — buy it for $' + priceFor(def) + '.' });
      }
      return false;
    }
    weapons.current = def.slot;
    if (state.flags) state.flags.wheelOpen = false;
    wheelOpen = false;
    if (bus && !quiet) bus.emit('weapon-changed', { id: def.id, name: def.name });
    return true;
  }

  function cycle() {
    const ownedSlots = WEAPONS.filter((w) => isOwned(w.id)).map((w) => w.slot);
    if (ownedSlots.length === 0) return false;
    const pos = ownedSlots.indexOf(weapons.current);
    const next = ownedSlots[(pos + 1) % ownedSlots.length];
    return select(next);
  }

  function buy(id) {
    const def = WEAPONS.find((w) => w.id === id);
    if (!def) return { ok: false, reason: 'unknown weapon' };
    if (isOwned(id)) return { ok: false, reason: 'already owned' };
    const price = priceFor(def);
    const player = state.player || {};
    const money = typeof player.money === 'number' ? player.money : 0;
    if (money < price) return { ok: false, reason: 'not enough cash', price };
    player.money = money - price;
    weapons.owned.push(id);
    weapons.ammo[id] = { mag: def.magSize, reserve: def.reserveMax / 2 };
    if (bus) {
      bus.emit('weapon-bought', { id, name: def.name, price });
      bus.emit('message', { text: 'Bought the ' + def.name + ' for $' + price + '.' });
    }
    return { ok: true, price };
  }

  function reload() {
    const def = currentDef();
    if (def.magSize === 0) return false;
    const ammo = weapons.ammo[def.id];
    if (reloading || ammo.mag >= def.magSize || ammo.reserve <= 0) return false;
    reloading = true;
    reloadTimer = def.id === 'rpg' ? 1.6 : 0.9;
    if (bus) bus.emit('reload-started', { id: def.id });
    return true;
  }

  function finishReload() {
    const def = currentDef();
    const ammo = weapons.ammo[def.id];
    const needed = def.magSize - ammo.mag;
    const moved = Math.min(needed, ammo.reserve);
    ammo.mag += moved;
    ammo.reserve -= moved;
    reloading = false;
    if (bus) bus.emit('reloaded', { id: def.id, mag: ammo.mag, reserve: ammo.reserve });
  }

  function explode(x, y, z, radius, damage, sourceId) {
    if (bus) {
      bus.emit('explosion', { x, y, z, radius, damage, source: sourceId || 'rpg' });
      bus.emit('crime', { type: 'explosion' });
    }
    return { x, y, z, radius, damage };
  }

  // Fire one trigger pull along a ray. `targets` is a list of
  // { id, x, y, z, radius, health, kind } — peds, cops, vehicles.
  // Returns a result object describing the shot (or why it did not fire).
  function fire(origin, dir, targets) {
    const def = currentDef();
    if (fireCooldown > 0 || reloading) return { fired: false, reason: 'not ready' };
    if (state.flags && (state.flags.paused || state.flags.title)) return { fired: false, reason: 'paused' };
    const ammo = weapons.ammo[def.id];
    if (def.magSize > 0 && ammo.mag <= 0) {
      if (bus) bus.emit('dry-fire', { id: def.id });
      reload();
      return { fired: false, reason: 'empty' };
    }
    fireCooldown = def.fireInterval;
    if (def.magSize > 0) ammo.mag -= 1;

    const len = Math.sqrt(dir.x * dir.x + dir.y * dir.y + dir.z * dir.z) || 1;
    const dx = dir.x / len;
    const dy = dir.y / len;
    const dz = dir.z / len;

    const list = Array.isArray(targets) ? targets : [];
    let best = null;
    let bestDist = def.range;
    let impact = {
      x: origin.x + dx * def.range,
      y: origin.y + dy * def.range,
      z: origin.z + dz * def.range,
    };

    for (let p = 0; p < def.pellets; p += 1) {
      const sx = dx + (def.spread ? rng.range(-def.spread, def.spread) : 0);
      const sy = dy + (def.spread ? rng.range(-def.spread, def.spread) : 0);
      const sz = dz + (def.spread ? rng.range(-def.spread, def.spread) : 0);
      for (const t of list) {
        if (typeof t.health === 'number' && t.health <= 0) continue;
        const hit = rayHitSphere(origin.x, origin.y, origin.z, sx, sy, sz, t.x, t.y, t.z, t.radius || 1);
        if (hit >= 0 && hit < bestDist) {
          bestDist = hit;
          best = t;
          impact = { x: origin.x + sx * hit, y: origin.y + sy * hit, z: origin.z + sz * hit };
        }
      }
    }

    if (bus) {
      bus.emit('shot-fired', { id: def.id, origin, impact, hit: best ? best.id : null });
      if (def.id !== 'fists') bus.emit('crime', { type: 'shooting' });
    }

    if (def.id === 'rpg') {
      const blast = explode(impact.x, impact.y, impact.z, def.blastRadius, def.damage, 'rpg');
      const hitTargets = [];
      for (const t of list) {
        const d = Math.sqrt(
          (t.x - impact.x) * (t.x - impact.x) +
            (t.y - impact.y) * (t.y - impact.y) +
            (t.z - impact.z) * (t.z - impact.z),
        );
        if (d <= def.blastRadius + (t.radius || 1)) {
          const falloff = clamp(1 - d / (def.blastRadius + (t.radius || 1)), 0.25, 1);
          const dmg = Math.round(def.damage * falloff);
          if (typeof t.health === 'number') t.health -= dmg;
          hitTargets.push({ id: t.id, kind: t.kind, damage: dmg, health: t.health });
          if (t.kind === 'vehicle' && t.health <= 0 && bus) {
            bus.emit('vehicle-destroyed', { id: t.id, x: t.x, y: t.y, z: t.z, chained: true });
          }
        }
      }
      return { fired: true, weapon: def.id, blast, hitTargets, ammo: { ...ammo } };
    }

    if (best) {
      const dmg = def.damage;
      if (typeof best.health === 'number') best.health -= dmg;
      if (state.stats) {
        if (best.kind === 'ped' || best.kind === 'cop') state.stats.kills = (state.stats.kills || 0) + (best.health <= 0 ? 1 : 0);
      }
      if (bus) {
        bus.emit('target-hit', { id: best.id, kind: best.kind, damage: dmg, health: best.health });
        if (best.health <= 0) {
          bus.emit('target-down', { id: best.id, kind: best.kind });
          if (best.kind === 'vehicle') {
            bus.emit('vehicle-destroyed', { id: best.id, x: best.x, y: best.y, z: best.z, chained: false });
          }
        }
      }
      return { fired: true, weapon: def.id, hit: best.id, kind: best.kind, damage: dmg, health: best.health, ammo: { ...ammo } };
    }
    return { fired: true, weapon: def.id, hit: null, ammo: { ...ammo } };
  }

  function spawnPickup(kind, x, z) {
    if (!PICKUP_KINDS[kind]) return null;
    const pickup = { id: 'pickup-' + pickupSerial, kind, x, z, serial: pickupSerial };
    pickupSerial += 1;
    pickups.push(pickup);
    return pickup;
  }

  function collectPickups() {
    const p = state.player || {};
    if (typeof p.x !== 'number') return [];
    const taken = [];
    pickups = pickups.filter((pk) => {
      const d = Math.sqrt((pk.x - p.x) * (pk.x - p.x) + (pk.z - p.z) * (pk.z - p.z));
      if (d > 2.2) return true;
      taken.push(pk);
      if (pk.kind === 'health') {
        p.health = clamp((typeof p.health === 'number' ? p.health : 100) + PICKUP_KINDS.health.heal, 0, 100);
      } else if (pk.kind === 'ammo') {
        const def = currentDef();
        const ammo = weapons.ammo[def.id];
        if (def.magSize > 0) ammo.reserve = Math.min(def.reserveMax, ammo.reserve + def.magSize * 2);
      }
      if (bus) bus.emit('pickup', { kind: pk.kind, id: pk.id });
      return false;
    });
    return taken;
  }

  function seedPickups(spots) {
    // A few health packs and ammo boxes scattered around the city at boot.
    const list = Array.isArray(spots) ? spots : [];
    for (const s of list) spawnPickup(s.kind || 'health', s.x, s.z);
    return pickups.length;
  }

  function update(dt) {
    if (!dt || dt <= 0) return;
    if (fireCooldown > 0) fireCooldown -= dt;
    if (reloading) {
      reloadTimer -= dt;
      if (reloadTimer <= 0) finishReload();
    }
    collectPickups();
  }

  function handleKey(code) {
    if (code === 'Tab') {
      wheelOpen = !wheelOpen;
      if (state.flags) state.flags.wheelOpen = wheelOpen;
      if (bus) bus.emit('wheel-toggled', { open: wheelOpen });
      return true;
    }
    if (code === 'KeyQ') {
      cycle();
      return true;
    }
    if (code === 'KeyR') {
      reload();
      return true;
    }
    const digit = /^Digit([1-6])$/.exec(code);
    if (digit) {
      select(parseInt(digit[1], 10) - 1); // Digit1 -> slot 0 ... Digit6 -> slot 5
      return true;
    }
    return false;
  }

  function wheelData() {
    return WEAPONS.map((def) => ({
      id: def.id,
      name: def.name,
      slot: def.slot,
      owned: isOwned(def.id),
      price: priceFor(def),
      mag: weapons.ammo[def.id].mag,
      reserve: weapons.ammo[def.id].reserve,
      magSize: def.magSize,
      selected: weapons.current === def.slot,
      icon: def.icon,
      desc: def.desc,
    }));
  }

  return {
    update,
    fire,
    explode,
    reload,
    select,
    cycle,
    buy,
    priceFor,
    isOwned,
    currentWeapon: currentDef,
    currentIndex() {
      return weapons.current;
    },
    ownedWeapons() {
      return weapons.owned.slice();
    },
    ammoFor(id) {
      return weapons.ammo[id] ? { ...weapons.ammo[id] } : null;
    },
    openWheel() {
      wheelOpen = true;
      if (state.flags) state.flags.wheelOpen = true;
      return wheelData();
    },
    closeWheel() {
      wheelOpen = false;
      if (state.flags) state.flags.wheelOpen = false;
    },
    isWheelOpen() {
      return wheelOpen;
    },
    wheelData,
    spawnPickup,
    seedPickups,
    getPickups() {
      return pickups.slice();
    },
    collectPickups,
    handleKey,
    weaponDefs: WEAPONS,
  };
}
