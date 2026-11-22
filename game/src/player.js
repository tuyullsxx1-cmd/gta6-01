// On-foot movement: WASD relative to the camera, Shift to run, Space to
// jump, health, damage and respawn at the safehouse or hospital corner.
import * as THREE from 'three';
import { buildPersonMesh, animateWalk } from './traffic.js';
import { PLAYER_DEF } from './config.js';

export function createPlayerMesh() {
  const mesh = buildPersonMesh({
    seed: 99, skin: PLAYER_DEF.skin, hair: PLAYER_DEF.hair,
    hairStyle: PLAYER_DEF.hairStyle, shirt: PLAYER_DEF.shirt, pants: PLAYER_DEF.pants, height: 1.82,
  });
  // Milo's gold jacket pops against the street: a bright open jacket.
  const jacket = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.5, 0.08),
    new THREE.MeshStandardMaterial({ color: 0xd4af37, roughness: 0.4, metalness: 0.4 }));
  jacket.position.set(0, 1.05, 0.2);
  mesh.add(jacket);
  mesh.name = 'milo';
  return mesh;
}

export function updatePlayer(state, input, dt, bus) {
  const p = state.player;
  if (!p.onFoot) return;
  const ax = input.axis();
  const run = input.down('ShiftLeft') || input.down('ShiftRight');
  const speed = run ? 7.2 : 4.2;
  const camYaw = state.camera.yaw;
  // Movement relative to camera yaw; forward is away from the camera.
  const fx = -Math.sin(camYaw), fz = -Math.cos(camYaw);
  const rx = -Math.cos(camYaw), rz = Math.sin(camYaw);
  let mx = fx * ax.y + rx * ax.x;
  let mz = fz * ax.y + rz * ax.x;
  const len = Math.hypot(mx, mz);
  if (len > 0.01) {
    mx /= len; mz /= len;
    p.x += mx * speed * dt;
    p.z += mz * speed * dt;
    const target = Math.atan2(mx, mz);
    let diff = target - p.heading;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    p.heading += THREE.MathUtils.clamp(diff, -8 * dt, 8 * dt);
    p.speed = speed;
  } else {
    p.speed = 0;
  }
  p.x = THREE.MathUtils.clamp(p.x, -248, 292);
  p.z = THREE.MathUtils.clamp(p.z, -292, 292);
  // Jump
  if (input.down('Space') && p.grounded) { p.vy = 6.5; p.grounded = false; }
  if (!p.grounded) {
    p.vy -= 18 * dt;
    p.y = (p.y || 0) + p.vy * dt;
    if ((p.y || 0) <= 0) { p.y = 0; p.vy = 0; p.grounded = true; }
  }
}

export function damagePlayer(state, amount, bus) {
  let rest = amount;
  if (state.armour > 0) {
    const absorbed = Math.min(state.armour, rest);
    state.armour -= absorbed; rest -= absorbed;
  }
  state.health -= rest;
  if (state.health <= 0) {
    state.health = 0;
    bus.emit('message', { text: 'Milo went down. Waking up at the clinic — $150 gone.' });
    state.money = Math.max(0, state.money - 150);
    respawn(state);
  }
}

export function respawn(state) {
  state.health = 100;
  state.armour = 25;
  state.wanted = 0; state.heat = 0; state.crime = '';
  state.car = null;
  state.player.x = 180; state.player.z = 10;
  state.player.onFoot = true;
  state.player.heading = Math.PI;
}
