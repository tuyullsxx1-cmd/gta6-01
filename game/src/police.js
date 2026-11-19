// Maravilla — wanted system + law enforcement: foot cops, patrol cars,
// roadblocks, helicopter. Listens for 'crime' events, raises/clears wanted,
// spawns and drives cops via state.cops / state.heli. Never imports a system.

import * as THREE from 'three';
import { CITY, WANTED, VEHICLES, COP_CALLSIGNS, COP_ROLES } from './config.js';

function showEndScreen(title, text) {
  if (typeof document === 'undefined') return;
  const screen = document.getElementById('end-screen');
  const t = document.getElementById('end-title');
  const tx = document.getElementById('end-text');
  if (screen) screen.style.display = 'flex';
  if (t) t.textContent = title;
  if (tx) tx.textContent = text;
}

let copSeq = 1;
// ONE global callsign sequence + disjoint pools per unit type (config):
// no two units ever share a callsign, whatever spawns when.
let callSeq = 0;

/** A dispatch identity for a unit: HALCON-1 / BEAT, TIBURON-3 / RAMMING. */
function assignCallsign(kind) {
  const pool = COP_CALLSIGNS[kind] || COP_CALLSIGNS.foot;
  const roles = COP_ROLES[kind] || COP_ROLES.foot;
  const i = callSeq;
  callSeq += 1;
  return {
    callsign: `${pool[i % pool.length]}-${Math.floor(i / pool.length) + 1}`,
    role: roles[i % roles.length],
  };
}

/** Human-readable label for the crime that brought the heat. */
const CRIME_LABELS = {
  carjack: 'CARJACKING', 'ped-hit': 'ASSAULT', 'shoot-cop': 'SHOT A COP',
  heat: 'FLEEING THE LAW', explosion: 'EXPLOSION',
};

function makeFootCopMesh(THREE_) {
  const g = new THREE_.Group();
  const navy = new THREE_.MeshLambertMaterial({ color: 0x1c2733 });
  const skin = new THREE_.MeshLambertMaterial({ color: 0xc98d64 });
  const body = new THREE_.Mesh(new THREE_.CapsuleGeometry(0.42, 0.7, 4, 10), navy);
  body.position.y = 1.05;
  body.castShadow = true;
  g.add(body);
  const head = new THREE_.Mesh(new THREE_.SphereGeometry(0.3, 12, 10), skin);
  head.position.y = 1.95;
  g.add(head);
  const hat = new THREE_.Mesh(new THREE_.CylinderGeometry(0.34, 0.36, 0.14, 12),
    new THREE_.MeshLambertMaterial({ color: 0x0e1626 }));
  hat.position.y = 2.2;
  g.add(hat);
  const badge = new THREE_.Mesh(new THREE_.BoxGeometry(0.12, 0.12, 0.05),
    new THREE_.MeshLambertMaterial({ color: 0xffd94d }));
  badge.position.set(-0.2, 1.35, 0.42);
  g.add(badge);
  return g;
}

function makeSimpleCopCarMesh(THREE_) {
  const g = new THREE_.Group();
  const body = new THREE_.Mesh(new THREE_.BoxGeometry(2, 0.7, 4.4),
    new THREE_.MeshLambertMaterial({ color: 0x1c2733 }));
  body.position.y = 0.65;
  body.castShadow = true;
  g.add(body);
  const cab = new THREE_.Mesh(new THREE_.BoxGeometry(1.7, 0.55, 2.2),
    new THREE_.MeshLambertMaterial({ color: 0x2c3e50 }));
  cab.position.set(0, 1.25, -0.2);
  g.add(cab);
  const bar = new THREE_.Mesh(new THREE_.BoxGeometry(1.2, 0.18, 0.3),
    new THREE_.MeshLambertMaterial({ color: 0xff4040, emissive: 0xaa1010 }));
  bar.position.set(0, 1.6, -0.2);
  g.add(bar);
  return g;
}

export function createPolice(ctx) {
  const { state, scene, events, city, rng } = ctx;
  const THREE_ = ctx.THREE || THREE;
  const p = state.player;
  const rand = rng || Math.random;

  let decayTimer = 0;
  let roadblockLevel = 0;
  let roadblocks = []; // cop entities acting as a stationary block
  let heliRotor = null;
  let searchlight = null;

  function msg(text, kind = 'info') {
    if (ctx.hud && ctx.hud.message) { ctx.hud.message(text, kind); return; }
    if (state.messages) state.messages.push({ text, at: state.time, kind });
    if (events) events.emit('message', { text, kind });
  }

  function addWanted(n) {
    const before = p.wanted;
    // Standing in this district scales the heat: loyal streets forgive,
    // hostile ones do not.
    const gain = (state.standingFx && state.standingFx.wantedGain) || 1;
    const scaled = n > 0 ? Math.max(1, Math.round(n * gain)) : n;
    p.wanted = Math.max(0, Math.min(WANTED.max, p.wanted + scaled));
    p.lastCrime = state.time;
    decayTimer = 0;
    if (p.wanted > before) {
      if (p.wanted >= 4) msg('The helicopter is on you. Lose them, Rook!', 'bad');
      else if (p.wanted === 3) msg('Roadblocks going up across Maravilla.', 'bad');
      else if (p.wanted === 2) msg('Patrol cars are rolling. Keep moving.', 'bad');
      else msg('The cops are onto you.', 'bad');
    }
  }

  function clearWanted() {
    p.wanted = 0;
    decayTimer = 0;
  }

  if (events) {
    events.on('crime', (d) => {
      if (!d) return;
      const amount = typeof d.amount === 'number' ? d.amount : 1;
      state.crimeLabel = CRIME_LABELS[d.type] || 'CRIME SPREE';
      addWanted(amount);
    });
  }

  function removeCopMesh(cop) {
    if (cop.mesh && scene) scene.remove(cop.mesh);
    if (cop.vehicleMesh && scene) scene.remove(cop.vehicleMesh);
  }

  function despawnAll(reason) {
    for (const cop of state.cops) removeCopMesh(cop);
    state.cops.length = 0;
    for (const rb of roadblocks) removeCopMesh(rb);
    roadblocks = [];
    roadblockLevel = 0;
    if (state.heli) {
      if (state.heli.mesh && scene) scene.remove(state.heli.mesh);
      state.heli = null;
      heliRotor = null;
      searchlight = null;
    }
    if (reason) msg(reason, 'good');
  }

  function spawnPosNear(dist) {
    // On a road near the player, so cops arrive plausibly.
    const a = rand() * Math.PI * 2;
    let x = p.x + Math.cos(a) * dist;
    let z = p.z + Math.sin(a) * dist;
    if (city && city.nearestRoadAxis) {
      const axis = city.nearestRoadAxis(x, z);
      if (axis) {
        if (axis.axis === 'x') x = axis.at;
        else z = axis.at;
      }
    }
    return {
      x: Math.max(-290, Math.min(290, x)),
      z: Math.max(-290, Math.min(290, z)),
    };
  }

  function spawnFootCop() {
    const pos = spawnPosNear(30 + rand() * 25);
    const cop = {
      id: `cop-${copSeq++}`, x: pos.x, z: pos.z, heading: 0,
      speed: 0, kind: 'foot', state: 'chase', health: 100, mesh: null,
      ...assignCallsign('foot'),
    };
    if (scene) {
      cop.mesh = makeFootCopMesh(THREE_);
      cop.mesh.position.set(cop.x, 0, cop.z);
      scene.add(cop.mesh);
    }
    state.cops.push(cop);
    return cop;
  }

  function spawnCarCop() {
    const pos = spawnPosNear(40 + rand() * 30);
    const cop = {
      id: `cop-${copSeq++}`, x: pos.x, z: pos.z, heading: 0,
      speed: 0, kind: 'car', state: 'chase', health: 100, mesh: null,
      vehicleId: null,
      ...assignCallsign('car'),
    };
    // Prefer Builder A's vehicle factory; fall back to a simple box car.
    const factory = ctx.vehicles && ctx.vehicles.spawnVehicle;
    if (factory) {
      try {
        const v = factory('patrulla', pos.x, pos.z, 0);
        if (v) cop.vehicleId = v.id || v;
      } catch (e) { /* fall through to the box mesh */ }
    }
    if (!cop.vehicleId && scene) {
      cop.mesh = makeSimpleCopCarMesh(THREE_);
      cop.mesh.position.set(cop.x, 0, cop.z);
      scene.add(cop.mesh);
    }
    state.cops.push(cop);
    return cop;
  }

  function spawnRoadblock() {
    // 2-3 stationary patrol cars across the nearest road ahead of the player.
    const ahead = 60;
    const fx = Math.sin(p.heading);
    const fz = Math.cos(p.heading);
    const cx = p.x + fx * ahead;
    const cz = p.z + fz * ahead;
    let axis = null;
    if (city && city.nearestRoadAxis) axis = city.nearestRoadAxis(cx, cz);
    const count = 2 + (rand() > 0.5 ? 1 : 0);
    for (let i = 0; i < count; i += 1) {
      const off = (i - (count - 1) / 2) * 5;
      let x = cx;
      let z = cz;
      let heading = 0;
      if (axis && axis.axis === 'x') { x = axis.at; z = cz + off; heading = Math.PI / 2; }
      else if (axis) { z = axis.at; x = cx + off; heading = 0; }
      const rb = {
        id: `rb-${copSeq++}`, x, z, heading, speed: 0,
        kind: 'car', state: 'roadblock', health: 100, mesh: null, vehicleId: null,
        ...assignCallsign('roadblock'),
      };
      if (scene) {
        rb.mesh = makeSimpleCopCarMesh(THREE_);
        rb.mesh.position.set(x, 0, z);
        rb.mesh.rotation.y = heading;
        scene.add(rb.mesh);
      }
      roadblocks.push(rb);
    }
    roadblockLevel = p.wanted;
    msg('Roadblock ahead — find another way through!', 'bad');
  }

  function spawnHeli() {
    if (state.heli || !scene) return;
    const g = new THREE_.Group();
    const body = new THREE_.Mesh(new THREE_.BoxGeometry(2.2, 1.4, 4.6),
      new THREE_.MeshLambertMaterial({ color: 0x1c2733 }));
    body.castShadow = true;
    g.add(body);
    const tail = new THREE_.Mesh(new THREE_.BoxGeometry(0.5, 0.5, 3.4),
      new THREE_.MeshLambertMaterial({ color: 0x1c2733 }));
    tail.position.set(0, 0.2, -3.6);
    g.add(tail);
    heliRotor = new THREE_.Group();
    const blade = new THREE_.Mesh(new THREE_.BoxGeometry(9, 0.08, 0.4),
      new THREE_.MeshLambertMaterial({ color: 0x2c313a }));
    heliRotor.add(blade);
    const blade2 = blade.clone();
    blade2.rotation.y = Math.PI / 2;
    heliRotor.add(blade2);
    heliRotor.position.y = 1;
    g.add(heliRotor);
    // Searchlight cone (translucent), visible at night.
    searchlight = new THREE_.Mesh(
      new THREE_.ConeGeometry(6, 40, 16, 1, true),
      new THREE_.MeshBasicMaterial({
        color: 0xfff2b0, transparent: true, opacity: 0.14,
        side: THREE_.DoubleSide, depthWrite: false,
      }),
    );
    searchlight.position.y = -20;
    searchlight.rotation.x = Math.PI; // cone points down
    searchlight.visible = false;
    g.add(searchlight);
    g.position.set(p.x, 40, p.z);
    scene.add(g);
    const id = assignCallsign('air');
    state.heli = { x: p.x, z: p.z, y: 40, heading: 0, mesh: g, callsign: id.callsign, role: id.role };
  }

  function busted() {
    if (state.screen !== 'play') return;
    p.busted = true;
    state.screen = 'busted';
    p._respawnPending = 'busted';
    if (events) events.emit('player-down', { kind: 'busted' });
    const bail = 300;
    showEndScreen('BUSTED', `El Gato finally got his collar. Bail: $${bail}. ` +
      `Missions done: ${state.stats.missionsDone} · Money earned: $${state.stats.moneyEarned}`);
    if (ctx.hud && ctx.hud.banner) ctx.hud.banner('BUSTED', 'El Gato is smiling. He loves paperwork.');
  }

  function nearestCopDist() {
    let best = Infinity;
    for (const cop of state.cops) {
      const d = Math.hypot(cop.x - p.x, cop.z - p.z);
      if (d < best) best = d;
    }
    for (const rb of roadblocks) {
      const d = Math.hypot(rb.x - p.x, rb.z - p.z);
      if (d < best) best = d;
    }
    if (state.heli) {
      const d = Math.hypot(state.heli.x - p.x, state.heli.z - p.z);
      if (d < best) best = d;
    }
    return best;
  }

  function update(dt) {
    if (state.screen !== 'play') return;

    // --- remove dead cops (shot by the player in weapons.js).
    for (let i = state.cops.length - 1; i >= 0; i -= 1) {
      if (state.cops[i].health <= 0) {
        removeCopMesh(state.cops[i]);
        state.cops.splice(i, 1);
      }
    }

    // --- wanted decay: -1 per 20 s with no crime and no cop within 40 m.
    // Standing scales it: loyal streets forget you faster.
    if (p.wanted > 0) {
      const decayMult = (state.standingFx && state.standingFx.decayMult) || 1;
      const sinceCrime = state.time - (p.lastCrime ?? -100);
      if (sinceCrime > WANTED.decayTime && nearestCopDist() > 40) {
        decayTimer += dt * decayMult;
        if (decayTimer >= WANTED.decayTime) {
          decayTimer = 0;
          p.wanted -= 1;
          if (p.wanted === 0) msg('You lost them. Maravilla forgets fast.', 'good');
          else msg(`Heat dropping — ${p.wanted} star${p.wanted > 1 ? 's' : ''} left.`, 'good');
        }
      } else {
        decayTimer = 0;
      }
    }
    p.hidden = nearestCopDist() > 40 ? (p.hidden || 0) + dt : 0;

    // --- despawn everything at zero wanted.
    if (p.wanted === 0 && (state.cops.length > 0 || roadblocks.length > 0 || state.heli)) {
      despawnAll();
      return;
    }
    if (p.wanted === 0) return;

    // --- spawn to the wanted level: 1 + wanted cops total.
    const wantFoot = Math.min(1 + p.wanted, 3);
    const wantCars = p.wanted >= 2 ? p.wanted - 1 : 0;
    const footNow = state.cops.filter((c) => c.kind === 'foot').length;
    const carNow = state.cops.filter((c) => c.kind === 'car').length;
    for (let i = footNow; i < wantFoot; i += 1) spawnFootCop();
    for (let i = carNow; i < wantCars; i += 1) spawnCarCop();

    // --- roadblocks at 3+ stars, once per level.
    if (p.wanted >= WANTED.roadblockAt && roadblockLevel < p.wanted) spawnRoadblock();
    if (p.wanted < WANTED.roadblockAt && roadblocks.length > 0) {
      for (const rb of roadblocks) removeCopMesh(rb);
      roadblocks = [];
      roadblockLevel = 0;
    }

    // --- helicopter at 4+ stars.
    if (p.wanted >= WANTED.heliAt) spawnHeli();
    else if (state.heli) {
      if (state.heli.mesh && scene) scene.remove(state.heli.mesh);
      state.heli = null;
      heliRotor = null;
      searchlight = null;
    }

    // --- foot cops chase on foot (run 7 — slower than the player's run 10).
    // Standing scales their speed: hostile streets send faster cops.
    const copSpeed = (state.standingFx && state.standingFx.copSpeed) || 1;
    for (const cop of state.cops) {
      if (cop.kind !== 'foot') continue;
      const dx = p.x - cop.x;
      const dz = p.z - cop.z;
      const d = Math.hypot(dx, dz) || 1;
      const speed = 7 * copSpeed;
      cop.x += (dx / d) * speed * dt;
      cop.z += (dz / d) * speed * dt;
      cop.heading = Math.atan2(dx, dz);
      cop.speed = speed;
      if (cop.mesh) {
        cop.mesh.position.set(cop.x, 0, cop.z);
        cop.mesh.rotation.y = cop.heading;
      }
      // Arrest on touch, only while the player is on foot.
      if (p.onFoot && d < 1.6) {
        busted();
        return;
      }
    }

    // --- patrol cars chase the player's car (top 46 < a sport car's 52,
    // so a fast driver escapes; on foot they bust on touch).
    for (const cop of state.cops) {
      if (cop.kind !== 'car') continue;
      const dx = p.x - cop.x;
      const dz = p.z - cop.z;
      const d = Math.hypot(dx, dz) || 1;
      const top = VEHICLES.patrulla.topSpeed * copSpeed;
      const speed = Math.min(top, 12 + d * 0.5);
      cop.x += (dx / d) * speed * dt;
      cop.z += (dz / d) * speed * dt;
      cop.heading = Math.atan2(dx, dz);
      cop.speed = speed;
      if (cop.mesh) {
        cop.mesh.position.set(cop.x, 0, cop.z);
        cop.mesh.rotation.y = cop.heading;
      }
      if (cop.vehicleId) {
        const v = state.vehicles.find((veh) => veh.id === cop.vehicleId);
        if (v) {
          v.x = cop.x; v.z = cop.z; v.heading = cop.heading; v.speed = speed;
        }
      }
      if (p.onFoot && d < 2.2) {
        busted();
        return;
      }
    }

    // --- helicopter follows, hovers 40 m up, rotor spins, light at night.
    if (state.heli) {
      const h = state.heli;
      const dx = p.x - h.x;
      const dz = p.z - h.z;
      const d = Math.hypot(dx, dz) || 1;
      const follow = Math.min(30, d * 0.8);
      h.x += (dx / d) * follow * dt;
      h.z += (dz / d) * follow * dt;
      h.heading = Math.atan2(dx, dz);
      if (heliRotor) heliRotor.rotation.y += dt * 18;
      if (h.mesh) {
        h.mesh.position.set(h.x, h.y, h.z);
        h.mesh.rotation.y = h.heading;
      }
      const isNight = state.dayTime > 0.8 || state.dayTime < 0.2;
      if (searchlight) searchlight.visible = isNight;
    }
  }

  return {
    update,
    addWanted,
    clearWanted,
    get roadblocks() { return roadblocks; },
  };
}
