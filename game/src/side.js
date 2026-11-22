// Side activities: 20 golden sun collectibles, 5 stunt jumps, repeatable
// district jobs, a 5-car export list and a $2,000 safehouse.
import * as THREE from 'three';
import { addMoney, addRp } from './state.js';
import { COLLECTIBLE_COUNT, STUNT_COUNT, SAFEHOUSE_PRICE } from './config.js';
import { makeRng } from './random.js';
import { jobsOpen, payFor } from './districts.js';

export function createSide(scene, seed) {
  const rng = makeRng(seed + 77);
  const group = new THREE.Group();
  group.name = 'side';
  scene.add(group);
  const collectibles = [];
  const sunMat = new THREE.MeshStandardMaterial({ color: 0xffd76a, emissive: 0xffb800, emissiveIntensity: 1.6, metalness: 0.8, roughness: 0.2 });
  for (let i = 0; i < COLLECTIBLE_COUNT; i++) {
    const mesh = new THREE.Mesh(new THREE.SphereGeometry(0.55, 12, 8), sunMat);
    mesh.scale.y = 1.4;
    // Place on roads and plazas so every one is reachable on foot.
    const onRoad = i % 2 === 0;
    const x = onRoad ? rng.pick([-240, -180, -120, -60, 0, 60, 120, 180, 240]) : rng.range(-260, 260);
    const z = onRoad ? rng.range(-260, 260) : rng.pick([-240, -180, -120, -60, 0, 60, 120, 180, 240]);
    mesh.position.set(x, 1.4, z);
    group.add(mesh);
    collectibles.push({ id: i, mesh, x, z, taken: false });
  }
  const jumps = [];
  const rampMat = new THREE.MeshStandardMaterial({ color: 0xff8020, roughness: 0.5 });
  const jumpSpots = [
    { x: 60, z: 0, rot: 0 }, { x: -60, z: 120, rot: Math.PI / 2 }, { x: 120, z: -180, rot: 0 },
    { x: -180, z: 60, rot: Math.PI / 2 }, { x: 0, z: -240, rot: 0 },
  ];
  for (let i = 0; i < STUNT_COUNT; i++) {
    const s = jumpSpots[i];
    const ramp = new THREE.Mesh(new THREE.BoxGeometry(6, 1.2, 8), rampMat);
    ramp.position.set(s.x, 0.6, s.z);
    ramp.rotation.y = s.rot;
    ramp.rotation.x = -0.18;
    group.add(ramp);
    jumps.push({ id: i, x: s.x, z: s.z, done: false });
  }
  return { group, collectibles, jumps };
}

export function updateSide(side, state, dt, bus) {
  const p = state.car ? { x: state.car.x, z: state.car.z } : { x: state.player.x, z: state.player.z };
  for (const c of side.collectibles) {
    if (c.taken) continue;
    c.mesh.rotation.y += dt * 2;
    c.mesh.position.y = 1.4 + Math.sin(performance.now() / 400 + c.id) * 0.2;
    if (Math.hypot(c.x - p.x, c.z - p.z) < 2.5) {
      c.taken = true; c.mesh.visible = false;
      state.collectibles.push(c.id);
      addMoney(state, 100);
      addRp(state, 20);
      bus.emit('message', { text: `Golden Sun ${state.collectibles.length}/${COLLECTIBLE_COUNT} — +$100 · +20 RP` });
    }
  }
  // Stunt jumps: air time while driving fast over a ramp.
  if (state.car && Math.abs(state.car.speed) > 22) {
    for (const j of side.jumps) {
      if (j.done) continue;
      if (Math.hypot(j.x - p.x, j.z - p.z) < 5) {
        j.done = true;
        state.jumpsDone.push(j.id);
        const air = Math.round(20 + Math.abs(state.car.speed) * 2);
        state.stats.longestJump = Math.max(state.stats.longestJump, air);
        addMoney(state, 250);
        bus.emit('message', { text: `Stunt jump! ${air} m in the air — ${state.jumpsDone.length}/${STUNT_COUNT} ramps · +$250` });
      }
    }
  }
}

export const EXPORT_LIST = [
  { id: 'solano', name: 'Solano GT', pay: 2500 },
  { id: 'cometa', name: 'Cometa S', pay: 2200 },
  { id: 'brisa', name: 'Brisa Coupe', pay: 1800 },
  { id: 'alba', name: 'Alba Sedan', pay: 1200 },
  { id: 'viento', name: 'Viento Van', pay: 1500 },
];

export function tryExport(state, bus) {
  if (!state.car) return false;
  const want = EXPORT_LIST.find((e) => e.id === state.car.defId && !state.exportsDone.includes(e.id));
  if (!want) return false;
  state.exportsDone.push(want.id);
  addMoney(state, want.pay);
  bus.emit('message', { text: `Export delivered · ${want.name} — +$${want.pay} (${state.exportsDone.length}/${EXPORT_LIST.length})` });
  state.car = null;
  state.player.onFoot = true;
  return true;
}

export function districtJob(state, bus) {
  const d = state.district;
  if (!jobsOpen(state, d)) {
    bus.emit('message', { text: 'This district has closed its job board to you. Raise your standing first.' });
    return false;
  }
  const p = state.car ? { x: state.car.x, z: state.car.z } : { x: state.player.x, z: state.player.z };
  const pay = payFor(state, 300, p.x, p.z);
  addMoney(state, pay);
  addRp(state, 15);
  state.jobsDone += 1;
  state.standing[d] = Math.min(100, state.standing[d] + 1);
  bus.emit('message', { text: `District job done — +$${pay} · +15 RP` });
  return true;
}

export function buySafehouse(state, bus) {
  if (state.safehouse) return false;
  if (state.money < SAFEHOUSE_PRICE) return false;
  state.money -= SAFEHOUSE_PRICE;
  state.safehouse = true;
  bus.emit('message', { text: 'Safehouse bought — Miramar villa. Rest here to heal and save.' });
  return true;
}

export function restAtSafehouse(state, bus) {
  if (!state.safehouse) return false;
  state.health = 100;
  state.armour = 100;
  state.wanted = 0; state.heat = 0;
  bus.emit('message', { text: 'Rested at the safehouse. Full health, clean slate.' });
  return true;
}
