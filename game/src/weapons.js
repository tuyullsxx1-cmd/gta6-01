// Weapons: a persistent 6-slot bar, a radial wheel on Tab, ray-cast
// shooting, pickups, and the launcher's explosive rounds.
import * as THREE from 'three';
import { WEAPONS } from './config.js';

export function weaponDef(id) { return WEAPONS.find((w) => w.id === id); }

export function buyWeapon(state, id) {
  const def = weaponDef(id);
  const w = state.weapons[id];
  if (!def || w.owned) return false;
  if (state.money < def.price) return false;
  state.money -= def.price;
  w.owned = true;
  w.mag = def.mag; w.reserve = def.reserve;
  return true;
}

export function selectWeapon(state, id) {
  if (state.weapons[id] && state.weapons[id].owned) { state.weapon = id; return true; }
  return false;
}

export function cycleWeapon(state, dir = 1) {
  const owned = WEAPONS.filter((w) => state.weapons[w.id].owned);
  const i = owned.findIndex((w) => w.id === state.weapon);
  const next = owned[(i + dir + owned.length) % owned.length];
  state.weapon = next.id;
}

export function reload(state) {
  const def = weaponDef(state.weapon);
  const w = state.weapons[state.weapon];
  if (!def || def.mag === Infinity) return;
  const need = def.mag - w.mag;
  const take = Math.min(need, w.reserve);
  w.mag += take; w.reserve -= take;
}

// Ray-cast a shot from the camera through the crosshair. Returns a hit
// record or null. Targets are traffic cars, cops and peds (scene objects
// carrying userData.shootable).
export function shoot(state, scene, camera, bus) {
  const def = weaponDef(state.weapon);
  const w = state.weapons[state.weapon];
  if (!def) return null;
  if (def.id !== 'fists') {
    if (w.mag <= 0) { reload(state); return { empty: true }; }
    w.mag -= 1;
  }
  const origin = camera.position.clone();
  const dir = new THREE.Vector3();
  camera.getWorldDirection(dir);
  const ray = new THREE.Raycaster(origin, dir, 0.1, def.range);
  const targets = [];
  scene.traverse((o) => { if (o.userData && o.userData.shootable) targets.push(o); });
  const hits = ray.intersectObjects(targets, true);
  if (hits.length === 0) return { hit: false };
  const hit = hits[0];
  let obj = hit.object;
  while (obj && !obj.userData.shootable) obj = obj.parent;
  const rec = { hit: true, target: obj, point: hit.point, damage: def.damage, weapon: def.id };
  bus.emit('shot-hit', rec);
  return rec;
}

export function createPickups(scene, seed) {
  const group = new THREE.Group();
  group.name = 'pickups';
  scene.add(group);
  const items = [];
  const spots = [
    { kind: 'health', x: 20, z: 50 }, { kind: 'health', x: -140, z: 60 }, { kind: 'health', x: 200, z: 150 },
    { kind: 'ammo', x: -60, z: -60 }, { kind: 'ammo', x: 90, z: 90 }, { kind: 'ammo', x: -200, z: -200 },
    { kind: 'armour', x: 120, z: -60 }, { kind: 'armour', x: -30, z: 150 },
  ];
  for (const s of spots) {
    const color = s.kind === 'health' ? 0x2aff66 : s.kind === 'ammo' ? 0xffc020 : 0x2a9aff;
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.7, 0.7),
      new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 0.9 }));
    mesh.position.set(s.x, 0.7, s.z);
    mesh.userData.pickup = s.kind;
    group.add(mesh);
    items.push({ kind: s.kind, mesh, taken: false });
  }
  return { group, items };
}

export function updatePickups(pickups, state, dt) {
  for (const p of pickups.items) {
    if (p.taken) continue;
    p.mesh.rotation.y += dt;
    p.mesh.position.y = 0.7 + Math.sin(performance.now() / 500 + p.mesh.position.x) * 0.12;
    const px = state.car ? state.car.x : state.player.x;
    const pz = state.car ? state.car.z : state.player.z;
    const d = Math.hypot(p.mesh.position.x - px, p.mesh.position.z - pz);
    if (d < 2.5) {
      p.taken = true; p.mesh.visible = false;
      if (p.kind === 'health') state.health = Math.min(100, state.health + 50);
      if (p.kind === 'armour') state.armour = Math.min(100, state.armour + 50);
      if (p.kind === 'ammo') {
        const w = state.weapons[state.weapon];
        const def = weaponDef(state.weapon);
        if (def && def.reserve !== Infinity) w.reserve += def.mag * 2;
      }
    }
  }
}
