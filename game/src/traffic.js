// Traffic cars with simple lane AI, pedestrians built from rounded
// multi-part bodies with a real walk cycle, and visual traffic lights.
import * as THREE from 'three';
import { VEHICLES, PED_COUNT, TRAFFIC_COUNT } from './config.js';
import { makeRng } from './random.js';
import { buildCarMesh } from './vehicles.js';
import { nearestRoadPoint } from './city.js';

const SKINS = [0xd8a077, 0x8a5a3b, 0xe8b98a, 0x4a2e1c, 0xf0c8a0, 0xc98d64];
const SHIRTS = [0xc02028, 0x2a6ab0, 0x18a0a0, 0xe07820, 0x5a2a6a, 0xd8d0c0, 0x3a5a2a, 0xffd76a, 0x2244aa, 0x8a2a4a];
const PANTS = [0x2a2a3a, 0x3a3a2a, 0x1a1a2a, 0x5a4a3a, 0x4a4a55];
const HAIRS = [0x1c1410, 0x101010, 0x6a2a10, 0x2a1a0c, 0x8a8a8a, 0x3a2a1a];

// A person from distinct rounded shapes: head, torso, arms, legs, hair.
export function buildPersonMesh(opts = {}) {
  const rng = makeRng(opts.seed || 5);
  const skin = opts.skin ?? SKINS[Math.floor(rng.next() * SKINS.length)];
  const shirt = opts.shirt ?? SHIRTS[Math.floor(rng.next() * SHIRTS.length)];
  const pants = opts.pants ?? PANTS[Math.floor(rng.next() * PANTS.length)];
  const hairC = opts.hair ?? HAIRS[Math.floor(rng.next() * HAIRS.length)];
  const height = opts.height ?? rng.range(1.62, 1.9);
  const s = height / 1.75;
  const g = new THREE.Group();
  const skinMat = new THREE.MeshStandardMaterial({ color: skin, roughness: 0.7 });
  const shirtMat = new THREE.MeshStandardMaterial({ color: shirt, roughness: 0.85 });
  const pantsMat = new THREE.MeshStandardMaterial({ color: pants, roughness: 0.9 });
  const hairMat = new THREE.MeshStandardMaterial({ color: hairC, roughness: 0.9 });

  const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.21 * s, 0.42 * s, 4, 10), shirtMat);
  torso.position.y = 1.02 * s; torso.castShadow = true; g.add(torso);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.16 * s, 14, 10), skinMat);
  head.position.y = 1.52 * s; head.castShadow = true; g.add(head);
  const hair = new THREE.Mesh(new THREE.SphereGeometry(0.165 * s, 12, 8, 0, Math.PI * 2, 0, Math.PI * 0.55), hairMat);
  hair.position.y = 1.55 * s; g.add(hair);
  if (opts.hairStyle === 'long') {
    const back = new THREE.Mesh(new THREE.CapsuleGeometry(0.09 * s, 0.3 * s, 4, 8), hairMat);
    back.position.set(0, 1.32 * s, -0.15 * s); g.add(back);
  } else if (opts.hairStyle === 'cap') {
    const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.17 * s, 0.17 * s, 0.06 * s, 12),
      new THREE.MeshStandardMaterial({ color: 0xc02028, roughness: 0.8 }));
    cap.position.y = 1.66 * s; g.add(cap);
  } else if (opts.hairStyle === 'bob') {
    const bob = new THREE.Mesh(new THREE.SphereGeometry(0.18 * s, 12, 8), hairMat);
    bob.scale.set(1, 0.8, 1); bob.position.y = 1.5 * s; g.add(bob);
  }
  // Eyes: two small dark spheres so faces read at a distance.
  for (const ex of [-0.06, 0.06]) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.02 * s, 6, 6),
      new THREE.MeshStandardMaterial({ color: 0x141414 }));
    eye.position.set(ex * s, 1.54 * s, 0.14 * s); g.add(eye);
  }
  const arms = {}, legs = {};
  for (const side of [-1, 1]) {
    const armPivot = new THREE.Group();
    armPivot.position.set(side * 0.26 * s, 1.28 * s, 0);
    const arm = new THREE.Mesh(new THREE.CapsuleGeometry(0.06 * s, 0.42 * s, 4, 8), shirtMat);
    arm.position.y = -0.26 * s; arm.castShadow = true; armPivot.add(arm);
    const hand = new THREE.Mesh(new THREE.SphereGeometry(0.06 * s, 8, 6), skinMat);
    hand.position.y = -0.52 * s; armPivot.add(hand);
    g.add(armPivot); arms[side < 0 ? 'l' : 'r'] = armPivot;
    const legPivot = new THREE.Group();
    legPivot.position.set(side * 0.11 * s, 0.78 * s, 0);
    const leg = new THREE.Mesh(new THREE.CapsuleGeometry(0.08 * s, 0.5 * s, 4, 8), pantsMat);
    leg.position.y = -0.32 * s; leg.castShadow = true; legPivot.add(leg);
    const shoe = new THREE.Mesh(new THREE.BoxGeometry(0.14 * s, 0.08 * s, 0.26 * s),
      new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 0.6 }));
    shoe.position.set(0, -0.62 * s, 0.05 * s); legPivot.add(shoe);
    g.add(legPivot); legs[side < 0 ? 'l' : 'r'] = legPivot;
  }
  g.userData = { arms, legs, walkPhase: rng.next() * Math.PI * 2, height };
  return g;
}

export function animateWalk(mesh, speed, dt) {
  const u = mesh.userData;
  u.walkPhase += dt * speed * 4.2;
  const swing = Math.min(0.7, speed * 0.16) * Math.sin(u.walkPhase);
  u.arms.l.rotation.x = swing;
  u.arms.r.rotation.x = -swing;
  u.legs.l.rotation.x = -swing * 1.1;
  u.legs.r.rotation.x = swing * 1.1;
  mesh.position.y = Math.abs(Math.sin(u.walkPhase)) * 0.03 * Math.min(1, speed);
}

export function createTraffic(scene, seed, roadPoints) {
  const rng = makeRng(seed + 101);
  const group = new THREE.Group();
  group.name = 'traffic';
  scene.add(group);
  const cars = [];
  for (let i = 0; i < TRAFFIC_COUNT; i++) {
    const def = VEHICLES[Math.floor(rng.next() * 5)];
    const mesh = buildCarMesh(def, { seed: seed + i * 17, color: [0x8a8a8a, 0x3a3a4a, 0x7a2a2a, 0x2a5a3a, 0xc8b060, 0x5a7a9a][i % 6] });
    const p = roadPoints[Math.floor(rng.next() * roadPoints.length)];
    const vertical = rng.chance(0.5);
    mesh.position.set(p.x + (vertical ? rng.range(-2.5, 2.5) : 0), 0, p.z + (vertical ? 0 : rng.range(-2.5, 2.5)));
    mesh.rotation.y = vertical ? (rng.chance(0.5) ? 0 : Math.PI) : (rng.chance(0.5) ? Math.PI / 2 : -Math.PI / 2);
    group.add(mesh);
    cars.push({ mesh, def, speed: rng.range(7, 12), vertical, dir: rng.chance(0.5) ? 1 : -1, lane: rng.range(-2.5, 2.5) });
  }
  const peds = [];
  for (let i = 0; i < PED_COUNT; i++) {
    const mesh = buildPersonMesh({ seed: seed + i * 31 });
    // Cluster around hotspots: plaza, market, beach, marina, casino.
    const hotspots = [[0, 30], [-30, -90], [0, 270], [-240, -170], [180, -120], [0, 0]];
    const hs = hotspots[i % hotspots.length];
    const x = hs[0] + rng.range(-40, 40), z = hs[1] + rng.range(-40, 40);
    mesh.position.set(x, 0, z);
    mesh.rotation.y = rng.next() * Math.PI * 2;
    group.add(mesh);
    peds.push({
      mesh, speed: rng.range(0.8, 1.6), heading: rng.next() * Math.PI * 2,
      tx: x, tz: z, wait: rng.range(0, 4), kind: 'ped',
    });
  }
  // Traffic lights at the big intersections.
  const lights = [];
  for (const [x, z] of [[0, 0], [0, 180], [180, 0], [-180, 0], [0, -180], [180, 180], [-180, -180]]) {
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.12, 5, 8),
      new THREE.MeshStandardMaterial({ color: 0x222222, metalness: 0.6, roughness: 0.5 }));
    pole.position.set(x + 8, 2.5, z + 8); group.add(pole);
    const box = new THREE.Mesh(new THREE.BoxGeometry(0.5, 1.4, 0.5),
      new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 0.6 }));
    box.position.set(x + 8, 5.2, z + 8); group.add(box);
    const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.16, 8, 6),
      new THREE.MeshStandardMaterial({ color: 0x33ff33, emissive: 0x22ff22, emissiveIntensity: 2 }));
    lamp.position.set(x + 8, 5.6, z + 8.3); group.add(lamp);
    lights.push({ lamp, phase: rng.next() * 6 });
  }
  return { group, cars, peds, lights, rng: makeRng(seed + 202) };
}

export function updateTraffic(traffic, dt, time) {
  const rng = traffic.rng;
  for (const c of traffic.cars) {
    const step = c.speed * c.dir * dt;
    if (c.vertical) c.mesh.position.z += step; else c.mesh.position.x += step;
    const p = c.vertical ? c.mesh.position.z : c.mesh.position.x;
    if (p > 285) { if (c.vertical) c.mesh.position.z = -285; else c.mesh.position.x = -285; }
    if (p < -285) { if (c.vertical) c.mesh.position.z = 285; else c.mesh.position.x = 285; }
    const w = c.mesh.userData.wheels;
    if (w) for (const wheel of w) wheel.rotation.x += (c.speed * dt) / 0.38;
  }
  for (const p of traffic.peds) {
    if (p.wait > 0) { p.wait -= dt; continue; }
    const dx = p.tx - p.mesh.position.x, dz = p.tz - p.mesh.position.z;
    const d = Math.hypot(dx, dz);
    if (d < 1.5) {
      p.tx = p.mesh.position.x + (rng.next() - 0.5) * 90;
      p.tz = p.mesh.position.z + (rng.next() - 0.5) * 90;
      p.tx = THREE.MathUtils.clamp(p.tx, -290, 290);
      p.tz = THREE.MathUtils.clamp(p.tz, -290, 290);
      p.wait = rng.next() * 3;
      continue;
    }
    const target = Math.atan2(dx, dz);
    let diff = target - p.mesh.rotation.y;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    p.mesh.rotation.y += THREE.MathUtils.clamp(diff, -2 * dt, 2 * dt);
    p.mesh.position.x += Math.sin(p.mesh.rotation.y) * p.speed * dt;
    p.mesh.position.z += Math.cos(p.mesh.rotation.y) * p.speed * dt;
    animateWalk(p.mesh, p.speed, dt);
  }
  for (const l of traffic.lights) {
    const phase = (time + l.phase) % 9;
    const green = phase < 4;
    l.lamp.material.color.setHex(green ? 0x33ff33 : 0xff3333);
    l.lamp.material.emissive.setHex(green ? 0x22ff22 : 0xff2222);
  }
}
