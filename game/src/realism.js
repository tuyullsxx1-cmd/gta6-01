// Realism pass: clouds, water glitter, dressed cars and people, casino
// depth, and staged foreground props for the plaza and marina shots.
// Purely visual: no mission, vehicle, police, HUD or save logic lives here,
// and nothing here changes how the game plays.
import * as THREE from 'three';
import { buildCarMesh } from './vehicles.js';
import { buildPersonMesh } from './traffic.js';
import { vehicleDef } from './driving.js';

function softDiscTexture() {
  const c = document.createElement('canvas');
  c.width = 256; c.height = 128;
  const g = c.getContext('2d');
  const blobs = [[64, 70, 52], [120, 58, 64], [180, 72, 48], [96, 84, 44], [150, 88, 40]];
  for (const [x, y, r] of blobs) {
    const grad = g.createRadialGradient(x, y, 2, x, y, r);
    grad.addColorStop(0, 'rgba(255,244,230,0.85)');
    grad.addColorStop(0.6, 'rgba(255,236,220,0.35)');
    grad.addColorStop(1, 'rgba(255,236,220,0)');
    g.fillStyle = grad;
    g.fillRect(0, 0, 256, 128);
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// A dozen soft dusk clouds, high over the city, drifting slowly east.
export function addClouds(scene) {
  const tex = softDiscTexture();
  const group = new THREE.Group();
  group.name = 'clouds';
  const spots = [
    [-260, 95, -260, 90], [-80, 105, -300, 120], [120, 85, -280, 100],
    [280, 110, -180, 130], [-300, 90, 40, 80], [60, 100, 120, 140],
    [-160, 165, 240, 110], [240, 150, 200, 90], [0, 185, -320, 120],
    [-320, 175, -120, 100], [160, 145, 300, 80], [-40, 195, 300, 120],
  ];
  for (const [x, y, z, w] of spots) {
    const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, opacity: 0.75, fog: false, depthWrite: false });
    const s = new THREE.Sprite(mat);
    s.position.set(x, y, z);
    s.scale.set(w, w * 0.42, 1);
    group.add(s);
  }
  scene.add(group);
  return group;
}

function noiseTexture() {
  const c = document.createElement('canvas');
  c.width = 128; c.height = 128;
  const g = c.getContext('2d');
  const img = g.createImageData(128, 128);
  for (let i = 0; i < img.data.length; i += 4) {
    const v = 118 + Math.floor(Math.random() * 20);
    img.data[i] = v; img.data[i + 1] = v; img.data[i + 2] = v; img.data[i + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = THREE.RepeatWrapping;
  t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(7, 7);
  return t;
}

// The marina water gets a real shimmer: a fine bump map that drifts, a
// brighter deep-blue body, and three warm sun-glitter strips on the swell.
export function addWaterGlitter(scene, water) {
  const bump = noiseTexture();
  water.material.bumpMap = bump;
  water.material.bumpScale = 0.6;
  water.material.color.setHex(0x16507e);
  water.material.roughness = 0.08;
  water.material.needsUpdate = true;
  const glints = new THREE.Group();
  glints.name = 'glints';
  const stripTex = (() => {
    const c = document.createElement('canvas');
    c.width = 32; c.height = 256;
    const g = c.getContext('2d');
    const grad = g.createLinearGradient(0, 0, 0, 256);
    grad.addColorStop(0, 'rgba(255,200,110,0)');
    grad.addColorStop(0.5, 'rgba(255,200,110,0.85)');
    grad.addColorStop(1, 'rgba(255,200,110,0)');
    g.fillStyle = grad;
    g.fillRect(0, 0, 32, 256);
    const t = new THREE.CanvasTexture(c);
    return t;
  })();
  for (const [x, z, len, op] of [[-292, -150, 46, 0.4], [-306, -182, 60, 0.32], [-284, -214, 38, 0.36]]) {
    const m = new THREE.Mesh(
      new THREE.PlaneGeometry(3.2, len),
      new THREE.MeshBasicMaterial({ map: stripTex, transparent: true, opacity: op, blending: THREE.AdditiveBlending, depthWrite: false })
    );
    m.rotation.x = -Math.PI / 2;
    m.rotation.z = 0.06;
    m.position.set(x, 0.16, z);
    glints.add(m);
  }
  scene.add(glints);
  return { bump, glints };
}

// A compact yacht of my own lines: white hull, cabin, mast, furled sail.
function buildYacht(scale) {
  const y = new THREE.Group();
  const hullMat = new THREE.MeshStandardMaterial({ color: 0xf2f2ea, roughness: 0.25, metalness: 0.35 });
  const hull = new THREE.Mesh(new THREE.SphereGeometry(2.2 * scale, 12, 8), hullMat);
  hull.scale.set(1, 0.55, 3.2);
  hull.position.y = 0.9 * scale;
  y.add(hull);
  const cabin = new THREE.Mesh(new THREE.BoxGeometry(2.4 * scale, 1.6 * scale, 4 * scale),
    new THREE.MeshStandardMaterial({ color: 0xe8e0d0, roughness: 0.3, metalness: 0.2 }));
  cabin.position.set(0, 2.2 * scale, -0.6 * scale);
  y.add(cabin);
  const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.09 * scale, 0.12 * scale, 11 * scale, 8),
    new THREE.MeshStandardMaterial({ color: 0xd8d8d8, metalness: 0.8, roughness: 0.3 }));
  mast.position.y = 6.5 * scale;
  y.add(mast);
  const sail = new THREE.Mesh(new THREE.BoxGeometry(0.18 * scale, 5.5 * scale, 1.7 * scale),
    new THREE.MeshStandardMaterial({ color: 0xf8f8f0, roughness: 0.55 }));
  sail.position.set(0, 6.2 * scale, 0.9 * scale);
  y.add(sail);
  const stripe = new THREE.Mesh(new THREE.BoxGeometry(4.5 * scale, 0.3, 0.4),
    new THREE.MeshStandardMaterial({ color: 0x1a4a7a, roughness: 0.4 }));
  stripe.position.set(0, 1.1 * scale, 2.8 * scale);
  y.add(stripe);
  return y;
}

// Two big yachts moored close to the pier road, plus buoys and a wooden
// dock reaching out from the pier into the open water.
export function addMarinaForeground(scene) {
  const group = new THREE.Group();
  group.name = 'marina-foreground';
  const yachts = [];
  for (const [x, z, rot, s] of [[-262, -145, 0.12, 1.45], [-262, -195, -0.1, 1.4]]) {
    const y = buildYacht(s);
    y.position.set(x, 0.2, z);
    y.rotation.y = rot;
    group.add(y);
    yachts.push(y);
  }
  const buoyMat = new THREE.MeshStandardMaterial({ color: 0xff6a20, roughness: 0.5 });
  for (const [x, z] of [[-285, -130], [-305, -160], [-295, -200], [-315, -230], [-278, -240], [-322, -110]]) {
    const b = new THREE.Mesh(new THREE.SphereGeometry(0.55, 10, 8), buoyMat);
    b.position.set(x, 0.35, z);
    group.add(b);
  }
  const dock = new THREE.Mesh(new THREE.BoxGeometry(34, 0.6, 4),
    new THREE.MeshStandardMaterial({ color: 0x7a5a34, roughness: 0.9 }));
  dock.position.set(-274, 0.3, -170);
  group.add(dock);
  for (const px of [-262, -272, -282, -290]) {
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.14, 1.6, 6),
      new THREE.MeshStandardMaterial({ color: 0x5a4028, roughness: 0.9 }));
    post.position.set(px, 0.8, -168.4);
    group.add(post);
  }
  scene.add(group);
  return { group, yachts };
}

// Dress a car so its rear and flanks read as a real machine, not a slab:
// sloped windshield, side skirts, front splitter, dark wheel-arch rings,
// side intakes, rear diffuser and twin exhausts.
export function dressCar(car) {
  if (car.userData.dressed) return car;
  car.userData.dressed = true;
  const L = car.userData.length || 4.6;
  const W = car.userData.width || 2.0;
  const glassMat = new THREE.MeshPhysicalMaterial({ color: 0x101828, roughness: 0.08, metalness: 0.4, clearcoat: 1, transparent: true, opacity: 0.85 });
  const darkMat = new THREE.MeshStandardMaterial({ color: 0x14141a, roughness: 0.7, metalness: 0.3 });
  const chromeMat = new THREE.MeshStandardMaterial({ color: 0xe8e8e8, metalness: 1, roughness: 0.15 });
  // Sloped windshield: glass leaning back from the hood to the roof.
  const shield = new THREE.Mesh(new THREE.PlaneGeometry(W * 0.78, 0.62), glassMat);
  shield.position.set(0, 1.24, L * 0.16);
  shield.rotation.x = -0.42;
  car.add(shield);
  // Sloped rear glass: the back of the cabin leans the other way, so the
  // rear reads as a hatch, not a flat slab.
  const rearGlass = new THREE.Mesh(new THREE.PlaneGeometry(W * 0.78, 0.55), glassMat);
  rearGlass.position.set(0, 1.22, -L * 0.16);
  rearGlass.rotation.x = 0.42;
  rearGlass.rotation.y = Math.PI;
  car.add(rearGlass);
  // Side skirts + front splitter.
  for (const s of [-1, 1]) {
    const skirt = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.16, L * 0.72), darkMat);
    skirt.position.set(s * (W / 2 + 0.02), 0.26, 0);
    car.add(skirt);
    const intake = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.2, 0.5), darkMat);
    intake.position.set(s * (W / 2 + 0.03), 0.55, L * 0.08);
    car.add(intake);
  }
  const splitter = new THREE.Mesh(new THREE.BoxGeometry(W * 0.98, 0.09, 0.34), darkMat);
  splitter.position.set(0, 0.2, L / 2 + 0.12);
  car.add(splitter);
  // Dark wheel-arch rings behind each tyre: a ring, not a disc, so the
  // rim and spokes still show through the middle.
  const archGeo = new THREE.TorusGeometry(0.44, 0.075, 8, 22);
  for (const [x, z] of [[-W / 2 + 0.08, L * 0.32], [W / 2 - 0.08, L * 0.32], [-W / 2 + 0.08, -L * 0.32], [W / 2 - 0.08, -L * 0.32]]) {
    const arch = new THREE.Mesh(archGeo, darkMat);
    arch.rotation.y = Math.PI / 2;
    arch.position.set(x, 0.38, z);
    car.add(arch);
  }
  // Rear diffuser + twin chrome exhausts.
  const diffuser = new THREE.Mesh(new THREE.BoxGeometry(W * 0.8, 0.14, 0.2), darkMat);
  diffuser.position.set(0, 0.24, -L / 2 - 0.05);
  car.add(diffuser);
  for (const s of [-1, 1]) {
    const tip = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.16, 10), chromeMat);
    tip.rotation.x = Math.PI / 2;
    tip.position.set(s * 0.5, 0.3, -L / 2 - 0.12);
    car.add(tip);
  }
  return car;
}

// Dress a person: belt, open jacket panels, collar and shoulder pads.
// Same skeleton, more shape — the walk cycle is untouched.
export function dressPerson(g, opts = {}) {
  if (g.userData.dressed) return g;
  g.userData.dressed = true;
  const s = 1;
  const beltMat = new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 0.6 });
  const belt = new THREE.Mesh(new THREE.BoxGeometry(0.44 * s, 0.07 * s, 0.28 * s), beltMat);
  belt.position.y = 0.82 * s;
  g.add(belt);
  const jacketMat = new THREE.MeshStandardMaterial({ color: opts.jacket ?? 0x3a3a4a, roughness: 0.55, metalness: 0.2 });
  for (const side of [-1, 1]) {
    const panel = new THREE.Mesh(new THREE.BoxGeometry(0.17 * s, 0.44 * s, 0.05 * s), jacketMat);
    panel.position.set(side * 0.12 * s, 1.06 * s, 0.2 * s);
    g.add(panel);
    const pad = new THREE.Mesh(new THREE.BoxGeometry(0.2 * s, 0.07 * s, 0.24 * s), jacketMat);
    pad.position.set(side * 0.22 * s, 1.3 * s, 0);
    g.add(pad);
  }
  const collar = new THREE.Mesh(new THREE.CylinderGeometry(0.14 * s, 0.17 * s, 0.08 * s, 10), jacketMat);
  collar.position.y = 1.38 * s;
  g.add(collar);
  if (opts.skirt) {
    const skirt = new THREE.Mesh(new THREE.CylinderGeometry(0.2 * s, 0.3 * s, 0.5 * s, 12),
      new THREE.MeshStandardMaterial({ color: opts.skirt, roughness: 0.7 }));
    skirt.position.y = 0.52 * s;
    g.add(skirt);
  }
  return g;
}

// The casino tower's flat window grid, given depth: gold mullion fins down
// the face, a warm glass atrium at its foot, side wings, and a lit canopy.
export function addCasinoDepth(scene) {
  const group = new THREE.Group();
  group.name = 'casino-depth';
  // Gold fins dress the lower tower face only: they stop at y=26 so the
  // GRAND MARAVILLA sign (y 28-40) stays clean and readable.
  const goldMat = new THREE.MeshStandardMaterial({ color: 0xd4af37, metalness: 0.85, roughness: 0.3, emissive: 0x201404, emissiveIntensity: 0.6 });
  for (let i = 0; i < 8; i++) {
    const fin = new THREE.Mesh(new THREE.BoxGeometry(0.5, 26, 0.7), goldMat);
    fin.position.set(-19.5 + i * 5.57, 13, 15.4);
    group.add(fin);
  }
  // Warm glass atrium at the foot of the tower.
  const atriumMat = new THREE.MeshStandardMaterial({ color: 0x2a1a0a, emissive: 0xffb060, emissiveIntensity: 0.85, roughness: 0.2, metalness: 0.1 });
  const atrium = new THREE.Mesh(new THREE.BoxGeometry(34, 7, 6), atriumMat);
  atrium.position.set(0, 3.5, 17);
  group.add(atrium);
  const canopy = new THREE.Mesh(new THREE.BoxGeometry(38, 0.5, 9),
    new THREE.MeshStandardMaterial({ color: 0x1a1a22, roughness: 0.4, metalness: 0.5 }));
  canopy.position.set(0, 7.4, 18);
  group.add(canopy);
  for (const s of [-1, 1]) {
    const col = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.35, 7.2, 10), goldMat);
    col.position.set(s * 16, 3.6, 20.5);
    group.add(col);
  }
  const glow = new THREE.PointLight(0xffb060, 30, 34, 1.4);
  glow.position.set(0, 4.5, 21);
  group.add(glow);
  // Lower side wings with their own lit windows (seeded, so the render is
  // stable from one load to the next).
  const wingTex = (() => {
    let seed = 20261122;
    const rnd = () => { seed |= 0; seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
    const c = document.createElement('canvas');
    c.width = 256; c.height = 128;
    const g = c.getContext('2d');
    g.fillStyle = '#3a3a5a';
    g.fillRect(0, 0, 256, 128);
    for (let r = 0; r < 3; r++) for (let col = 0; col < 8; col++) {
      const lit = rnd() < 0.55;
      g.fillStyle = lit ? (rnd() < 0.6 ? '#ffd98a' : '#9fd8ff') : '#141824';
      g.fillRect(10 + col * 30, 12 + r * 38, 20, 26);
    }
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  })();
  const wingMat = new THREE.MeshStandardMaterial({ map: wingTex, emissive: 0xffffff, emissiveMap: wingTex, emissiveIntensity: 0.4, roughness: 0.6 });
  for (const s of [-1, 1]) {
    const wing = new THREE.Mesh(new THREE.BoxGeometry(13, 16, 24), wingMat);
    wing.position.set(s * 29.5, 8, 0);
    wing.castShadow = true;
    group.add(wing);
  }
  group.position.set(180, 0, -120);
  scene.add(group);
  return group;
}

// Foreground for the plaza shot: parked cars flanking the casino avenue,
// two MCPD interceptors with light bars, and pedestrians at the entrance.
export function addPlazaForeground(scene) {
  const group = new THREE.Group();
  group.name = 'plaza-foreground';
  const flashers = [];
  const parkedDefs = [
    { def: 'alba', x: 171, z: -68, h: Math.PI, color: 0x8a8a8a },
    { def: 'brisa', x: 189, z: -68, h: Math.PI, color: 0x18a0a0 },
    { def: 'viento', x: 170, z: -92, h: 0, color: 0xd8d0c0 },
    { def: 'cometa', x: 190, z: -92, h: 0, color: 0xc02028 },
  ];
  for (const s of parkedDefs) {
    const mesh = buildCarMesh(vehicleDef(s.def), { seed: 777 + s.x, color: s.color });
    mesh.position.set(s.x, 0, s.z);
    mesh.rotation.y = s.h;
    dressCar(mesh);
    group.add(mesh);
  }
  // Two MCPD interceptors, angled as if blocking the avenue.
  for (const [x, z, h] of [[174, -80, Math.PI / 2], [186, -80, -Math.PI / 2]]) {
    const mesh = buildCarMesh({ id: 'patrol', name: 'MCPD Interceptor', kind: 'sedan', top: 46, accel: 22, grip: 2.4, color: 0x101828 }, { seed: 910 + x });
    mesh.position.set(x, 0, z);
    mesh.rotation.y = h;
    dressCar(mesh);
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.1, 4.4),
      new THREE.MeshStandardMaterial({ color: 0xf0f0f0, roughness: 0.4 }));
    stripe.position.y = 0.55;
    mesh.add(stripe);
    const bar = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.16, 0.3),
      new THREE.MeshStandardMaterial({ color: 0x222222, roughness: 0.4 }));
    bar.position.set(0, 1.62, -0.1);
    mesh.add(bar);
    const red = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.14, 0.3),
      new THREE.MeshStandardMaterial({ color: 0x881111, emissive: 0xff2020, emissiveIntensity: 2 }));
    red.position.set(-0.28, 1.72, -0.1);
    mesh.add(red);
    const blue = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.14, 0.3),
      new THREE.MeshStandardMaterial({ color: 0x111188, emissive: 0x2244ff, emissiveIntensity: 2 }));
    blue.position.set(0.28, 1.72, -0.1);
    mesh.add(blue);
    flashers.push({ red: red.material, blue: blue.material });
    group.add(mesh);
  }
  // Pedestrians waiting at the casino entrance.
  const spots = [[172, -100, 0.3], [178, -102, -0.4], [184, -100, 0.2], [188, -104, 0.9]];
  for (const [x, z, ry] of spots) {
    const p = buildPersonMesh({ seed: 600 + x });
    p.position.set(x, 0, z);
    p.rotation.y = ry;
    dressPerson(p);
    group.add(p);
  }
  scene.add(group);
  return { group, flashers };
}

// Per-frame realism animation: clouds drift, water shimmer crawls, the
// interceptors' light bars alternate red and blue.
export function updateRealism(handles, dt, time) {
  if (!handles) return;
  const clouds = handles.clouds;
  if (clouds) {
    for (const s of clouds.children) {
      s.position.x += dt * 0.9;
      if (s.position.x > 340) s.position.x = -340;
    }
  }
  const water = handles.water;
  if (water && water.bump) {
    water.bump.offset.x += dt * 0.015;
    water.bump.offset.y += dt * 0.008;
  }
  const yachts = handles.yachts;
  if (yachts) {
    for (const y of yachts) y.position.y = 0.2 + Math.sin(time * 1.1 + y.position.x) * 0.12;
  }
  const flashers = handles.flashers;
  if (flashers) {
    const phase = Math.floor(time * 2.2) % 2 === 0;
    for (const f of flashers) {
      f.red.emissiveIntensity = phase ? 3.2 : 0.25;
      f.blue.emissiveIntensity = phase ? 0.25 : 3.2;
    }
  }
}
