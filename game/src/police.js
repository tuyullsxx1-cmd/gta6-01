// Wanted level 1-5, foot cops, patrol cars, roadblocks at 3+, helicopter
// at 4+. Dispatch panel rows use ONE global callsign sequence and disjoint
// pools per unit type, so no callsign ever repeats.
import * as THREE from 'three';
import { buildPersonMesh } from './traffic.js';
import { buildCarMesh } from './vehicles.js';
import { districtAt, tierFor } from './state.js';
import { DISTRICT_TIERS } from './config.js';

const FOOT_POOL = ['HALCON', 'OLA', 'ARENA', 'PALMA', 'BRISA'];
const CAR_POOL = ['TIBURON', 'CORAL', 'SOL', 'VIENTO', 'MARE'];
const BLOCK_POOL = ['FARO', 'PIER', 'DUNA', 'ROCA', 'PUERTA'];
const AIR_POOL = ['AGUILA', 'CONDOR'];

export function createPolice(scene) {
  const group = new THREE.Group();
  group.name = 'police';
  scene.add(group);
  return { group, units: [], callSeq: 0, heli: null, ticker: 0, crime: '' };
}

// Heat scaling: the same crime is wanted 3 in a loyal district, wanted 5
// in a hostile one. addHeat maps the raw amount through the district tier.
export function addHeat(state, rawAmount, crimeLabel, bus) {
  const d = districtAt(state.player.x, state.player.z);
  const tier = tierFor(state.standing[d.id], DISTRICT_TIERS);
  const scaled = rawAmount * tier.heatMul;
  state.heat = Math.min(100, state.heat + scaled);
  state.crime = crimeLabel;
  const wanted = state.heat <= 0 ? 0 : Math.min(5, 1 + Math.floor(state.heat / 20));
  if (wanted !== state.wanted) {
    state.wanted = wanted;
    bus.emit('wanted', { wanted, crime: crimeLabel, district: d.name, tier: tier.label });
  }
  // Standing drops by 3 per crime in that district.
  state.standing[d.id] = Math.max(0, state.standing[d.id] - 3);
  return { wanted: state.wanted, tier: tier.label, district: d.id };
}

export function decayHeat(state, dt) {
  if (state.wanted === 0) return;
  const d = districtAt(state.player.x, state.player.z);
  const tier = tierFor(state.standing[d.id], DISTRICT_TIERS);
  state.heat = Math.max(0, state.heat - dt * 2.2 * tier.fadeMul);
  const wanted = state.heat <= 0 ? 0 : Math.min(5, 1 + Math.floor(state.heat / 20));
  if (wanted !== state.wanted) state.wanted = wanted;
}

function nextCallsign(police, pool, kind) {
  police.callSeq += 1;
  const word = pool[(police.callSeq - 1) % pool.length];
  return `${word}-${police.callSeq}`;
}

function spawnUnit(police, state, kind, role, x, z) {
  let mesh;
  if (kind === 'foot') {
    mesh = buildPersonMesh({ seed: 500 + police.callSeq, shirt: 0x1a2a5a, pants: 0x1a1a2a, height: 1.8 });
    const vest = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.4, 0.1),
      new THREE.MeshStandardMaterial({ color: 0x0a1a3a, roughness: 0.7 }));
    vest.position.set(0, 1.05, 0.2); mesh.add(vest);
  } else if (kind === 'car') {
    mesh = buildCarMesh({ id: 'patrol', name: 'MCPD Interceptor', kind: 'sedan', top: 46, accel: 22, grip: 2.4, color: 0x101828 }, { seed: 900 + police.callSeq });
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(2.02, 0.2, 4.62),
      new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.4 }));
    stripe.position.y = 0.55; mesh.add(stripe);
    const bar = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.12, 0.3),
      new THREE.MeshStandardMaterial({ color: 0xaa1010, emissive: 0xff2020, emissiveIntensity: 2 }));
    bar.position.y = 1.62; mesh.add(bar);
  } else if (kind === 'heli') {
    mesh = new THREE.Group();
    const body = new THREE.Mesh(new THREE.SphereGeometry(1.6, 12, 8),
      new THREE.MeshStandardMaterial({ color: 0x1a2a4a, roughness: 0.4, metalness: 0.5 }));
    body.scale.set(1, 0.8, 2); mesh.add(body);
    const rotor = new THREE.Mesh(new THREE.BoxGeometry(9, 0.08, 0.5),
      new THREE.MeshStandardMaterial({ color: 0x222222 }));
    rotor.position.y = 1.5; rotor.name = 'rotor'; mesh.add(rotor);
    const search = new THREE.Mesh(new THREE.ConeGeometry(3, 18, 12, 1, true),
      new THREE.MeshBasicMaterial({ color: 0xfff2b0, transparent: true, opacity: 0.12, side: THREE.DoubleSide, depthWrite: false }));
    search.rotation.x = Math.PI; search.position.y = -9; mesh.add(search);
    const spot = new THREE.SpotLight(0xfff2b0, 80, 60, 0.35, 0.4, 1);
    spot.position.y = -1; const tgt = new THREE.Object3D(); tgt.position.y = -20;
    mesh.add(tgt); spot.target = tgt; mesh.add(spot);
  } else { // roadblock
    mesh = new THREE.Group();
    const barrier = new THREE.Mesh(new THREE.BoxGeometry(6, 1.1, 0.5),
      new THREE.MeshStandardMaterial({ color: 0xff8020, roughness: 0.6 }));
    barrier.position.y = 0.55; mesh.add(barrier);
    const car = buildCarMesh({ id: 'patrol', name: 'MCPD Interceptor', kind: 'sedan', top: 46, accel: 22, grip: 2.4, color: 0x101828 }, { seed: 950 + police.callSeq });
    car.position.set(0, 0, 3); mesh.add(car);
  }
  const pool = kind === 'foot' ? FOOT_POOL : kind === 'car' ? CAR_POOL : kind === 'heli' ? AIR_POOL : BLOCK_POOL;
  const unit = {
    kind, role, mesh, callsign: nextCallsign(police, pool, kind),
    x, z, speed: kind === 'car' ? 20 : kind === 'foot' ? 3.2 : 0,
    heading: 0, life: 0,
  };
  mesh.position.set(x, kind === 'heli' ? 42 : 0, z);
  police.group.add(mesh);
  police.units.push(unit);
  if (kind === 'heli') police.heli = unit;
  return unit;
}

function desiredUnits(wanted) {
  if (wanted <= 0) return { foot: 0, car: 0, block: 0, heli: 0 };
  return {
    foot: wanted === 1 ? 2 : 3,
    car: wanted === 1 ? 0 : wanted === 2 ? 1 : 2,
    block: wanted >= 3 ? 2 : 0,
    heli: wanted >= 4 ? 1 : 0,
  };
}

export function updatePolice(police, state, dt, bus) {
  const wanted = state.wanted;
  const want = desiredUnits(wanted);
  const count = (k) => police.units.filter((u) => u.kind === k).length;
  const px = state.car ? state.car.x : state.player.x;
  const pz = state.car ? state.car.z : state.player.z;
  // Spawn to match the desired roster, around the player.
  const spawnAt = (kind) => {
    // Deterministic spawn angle from the global call sequence.
    const a = (police.callSeq * 2.39996) % (Math.PI * 2);
    const r = kind === 'block' ? 55 : 45;
    return [px + Math.cos(a) * r, pz + Math.sin(a) * r];
  };
  if (count('foot') < want.foot) { const [x, z] = spawnAt('foot'); spawnUnit(police, state, 'foot', wanted >= 3 ? 'FOOT CHASE' : 'BEAT', x, z); }
  if (count('car') < want.car) { const [x, z] = spawnAt('car'); spawnUnit(police, state, 'car', wanted >= 3 ? 'RAMMING' : 'PURSUIT', x, z); }
  if (count('block') < want.block) { const [x, z] = spawnAt('block'); spawnUnit(police, state, 'block', 'ROADBLOCK', x, z); }
  if (count('heli') < want.heli && !police.heli) spawnUnit(police, state, 'heli', 'AIR ONE', px + 30, pz - 30);
  // Remove extras when heat drops.
  for (const u of [...police.units]) {
    const keep = u.kind === 'foot' ? want.foot : u.kind === 'car' ? want.car : u.kind === 'block' ? want.block : want.heli;
    const idx = police.units.filter((v) => v.kind === u.kind).indexOf(u);
    if (idx >= keep) {
      police.group.remove(u.mesh);
      police.units.splice(police.units.indexOf(u), 1);
      if (u.kind === 'heli') police.heli = null;
    }
  }
  // Chase behaviour.
  for (const u of police.units) {
    u.life += dt;
    const dx = px - u.x, dz = pz - u.z;
    const d = Math.hypot(dx, dz) || 1;
    u.dist = d;
    if (u.kind === 'foot') {
      const sp = u.speed * (d < 30 ? 1 : 0.7);
      u.x += (dx / d) * sp * dt; u.z += (dz / d) * sp * dt;
      u.mesh.position.set(u.x, 0, u.z);
      u.mesh.rotation.y = Math.atan2(dx, dz);
      if (d < 2.2) {
        // A cop grabs Milo.
        if (state.player.onFoot) bus.emit('caught', {});
      }
    } else if (u.kind === 'car') {
      const target = Math.atan2(dx, dz);
      let diff = target - u.heading;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      u.heading += THREE.MathUtils.clamp(diff, -2.2 * dt, 2.2 * dt);
      const sp = Math.min(26, u.speed + 8 * dt);
      u.speed = sp;
      u.x += Math.sin(u.heading) * sp * dt;
      u.z += Math.cos(u.heading) * sp * dt;
      u.mesh.position.set(u.x, 0, u.z);
      u.mesh.rotation.y = u.heading;
      if (d < 4.5 && state.car) {
        state.car.damage = Math.min(100, state.car.damage + 30 * dt);
        bus.emit('rammed', { damage: state.car.damage });
      }
    } else if (u.kind === 'heli') {
      u.x += (dx / d) * 12 * dt; u.z += (dz / d) * 12 * dt;
      u.mesh.position.set(u.x, 42 + Math.sin(u.life * 0.8) * 2, u.z);
      const rotor = u.mesh.getObjectByName('rotor');
      if (rotor) rotor.rotation.y += dt * 18;
    } else if (u.kind === 'block') {
      u.mesh.position.set(u.x, 0, u.z);
      u.mesh.rotation.y = Math.atan2(dx, dz);
    }
  }
  // Ticker rotates every few seconds.
  police.ticker += dt;
  if (police.ticker > 6) {
    police.ticker = 0;
    const lines = [
      'MCPD: all units, be advised — suspect vehicle last seen downtown.',
      'MCPD: air unit circling the marina district, keep eyes on the pier.',
      'MCPD: roadblock holding on the avenue, do not let the suspect through.',
      'MCPD: foot units moving in on foot near the plaza.',
    ];
    police.tickerCount = (police.tickerCount || 0) + 1;
    state.dispatchTicker = lines[police.tickerCount % lines.length];
  }
}

export function dispatchRows(police, state) {
  const rows = [...police.units]
    .sort((a, b) => (a.dist || 0) - (b.dist || 0))
    .slice(0, 6)
    .map((u) => ({ callsign: u.callsign, role: u.role, dist: Math.round(u.dist || 0), kind: u.kind }));
  return { rows, total: police.units.length, crime: state.crime || '—' };
}

export function clearCops(police, state) {
  for (const u of [...police.units]) {
    police.group.remove(u.mesh);
    police.units.splice(police.units.indexOf(u), 1);
  }
  police.heli = null;
  state.wanted = 0; state.heat = 0; state.crime = '';
  state.stats.escaped += 1;
}
