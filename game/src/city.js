// Maravilla: six districts, a marina with yachts, a lighthouse, a stadium,
// a neon-crowned casino, markets, plazas and dense street props.
// Every sign sits ON a building face or on a pole with visible supports.
import * as THREE from 'three';
import { CITY, DISTRICTS } from './config.js';
import { makeRng } from './random.js';

export const PLACES = {
  plaza: { x: 0, z: 30, name: 'Downtown Plaza' },
  garage: { x: -90, z: 120, name: 'Theo\'s Garage' },
  casino: { x: 180, z: -120, name: 'Grand Maravilla' },
  marina: { x: -240, z: -180, name: 'Marina Alba' },
  lighthouse: { x: -240, z: 240, name: 'Faro de Maravilla' },
  stadium: { x: 210, z: 210, name: 'Estadio Sol' },
  safehouse: { x: 180, z: 0, name: 'Miramar Safehouse' },
  beach: { x: 0, z: 285, name: 'Paseo Beach' },
  market: { x: -30, z: -90, name: 'Centro Night Market' },
};

function canvasTexture(w, h, draw) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// Facade: windows grid, some lit warm, some dark; a ground-floor shop band.
function facadeTexture(rng, base, litRatio) {
  return canvasTexture(256, 512, (g, w, h) => {
    g.fillStyle = base; g.fillRect(0, 0, w, h);
    g.fillStyle = 'rgba(0,0,0,0.18)';
    for (let y = 0; y < h; y += 4) g.fillRect(0, y, w, 1);
    const cols = 6, rows = 12;
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
      const lit = rng.next() < litRatio;
      g.fillStyle = lit ? (rng.next() < 0.6 ? '#ffd98a' : '#9fd8ff') : '#1c2433';
      g.fillRect(14 + c * 40, 16 + r * 40, 26, 26);
      g.fillStyle = 'rgba(255,255,255,0.08)';
      g.fillRect(14 + c * 40, 16 + r * 40, 26, 6);
    }
    g.fillStyle = '#101018'; g.fillRect(0, h - 64, w, 64);
    g.fillStyle = '#ffd76a'; g.fillRect(0, h - 66, w, 3);
  });
}

function signTexture(text, fg = '#ffd76a', bg = '#14101e') {
  return canvasTexture(1024, 128, (g, w, h) => {
    g.fillStyle = bg; g.fillRect(0, 0, w, h);
    g.strokeStyle = fg; g.lineWidth = 8; g.strokeRect(8, 8, w - 16, h - 16);
    g.fillStyle = fg; g.font = 'bold 72px Georgia, serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText(text, w / 2, h / 2 + 2);
  });
}

function awningTexture(c1, c2) {
  return canvasTexture(128, 64, (g, w, h) => {
    for (let i = 0; i < 8; i++) { g.fillStyle = i % 2 ? c1 : c2; g.fillRect(i * 16, 0, 16, h); }
  });
}

export function buildCity(scene, seed) {
  const rng = makeRng(seed);
  const group = new THREE.Group();
  group.name = 'city';
  const colliders = []; // {x0,z0,x1,z1} building footprints (for spawn safety)
  const roadPoints = [];

  const asphalt = new THREE.MeshStandardMaterial({ color: 0x23242c, roughness: 0.35, metalness: 0.55 });
  const asphaltWet = new THREE.MeshStandardMaterial({ color: 0x1a1b22, roughness: 0.18, metalness: 0.7 });
  const sidewalkMat = new THREE.MeshStandardMaterial({ color: 0x8a8578, roughness: 0.9 });
  const grassMat = new THREE.MeshStandardMaterial({ color: 0x4a7a44, roughness: 1 });
  const sandMat = new THREE.MeshStandardMaterial({ color: 0xd8b878, roughness: 1 });
  const plazaMat = new THREE.MeshStandardMaterial({ color: 0xb8a888, roughness: 0.6, metalness: 0.1 });

  // Ground base
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(CITY.size + 400, CITY.size + 400), grassMat);
  ground.rotation.x = -Math.PI / 2; ground.position.y = -0.05; ground.receiveShadow = true;
  group.add(ground);

  // Beach strip along the south edge
  const beach = new THREE.Mesh(new THREE.PlaneGeometry(CITY.size, 36), sandMat);
  beach.rotation.x = -Math.PI / 2; beach.position.set(0, 0.02, 288); beach.receiveShadow = true;
  group.add(beach);

  // Water: west of the marina, glossy with a moving sheen handled in render.
  const water = new THREE.Mesh(
    new THREE.PlaneGeometry(160, CITY.size + 200),
    new THREE.MeshStandardMaterial({ color: 0x0e3a5a, roughness: 0.12, metalness: 0.85, transparent: true, opacity: 0.94 })
  );
  water.rotation.x = -Math.PI / 2; water.position.set(-330, 0.1, 0);
  water.name = 'water';
  group.add(water);

  // Roads: grid + avenues, with wet-look asphalt in the neon districts.
  const roadGeo = new THREE.PlaneGeometry(1, 1);
  const roads = [];
  for (let i = -4; i <= 4; i++) {
    const c = i * CITY.roadEvery;
    roads.push({ x: c, z: 0, w: Math.abs(i) % 3 === 0 ? CITY.avenueWidth : CITY.roadWidth, vertical: true });
    roads.push({ x: 0, z: c, w: Math.abs(i) % 3 === 0 ? CITY.avenueWidth : CITY.roadWidth, vertical: false });
  }
  for (const r of roads) {
    const m = new THREE.Mesh(roadGeo, r.vertical && Math.abs(r.x) < 130 ? asphaltWet : asphalt);
    m.rotation.x = -Math.PI / 2;
    m.scale.set(r.vertical ? r.w : CITY.size, r.vertical ? CITY.size : r.w, 1);
    m.position.set(r.x, 0.06, r.z);
    m.receiveShadow = true;
    group.add(m);
    // Sidewalks along both edges
    for (const s of [-1, 1]) {
      const sw = new THREE.Mesh(roadGeo, sidewalkMat);
      sw.rotation.x = -Math.PI / 2;
      const off = r.w / 2 + CITY.sidewalk / 2;
      sw.scale.set(r.vertical ? CITY.sidewalk : CITY.size, r.vertical ? CITY.size : CITY.sidewalk, 1);
      sw.position.set(r.vertical ? r.x + s * off : r.x, 0.04, r.vertical ? r.z : r.z + s * off);
      group.add(sw);
    }
  }
  // Dashed centre lines
  const dashGeo = new THREE.BoxGeometry(0.5, 0.02, 4);
  const dashMat = new THREE.MeshBasicMaterial({ color: 0xd8d8c8 });
  const dashes = [];
  for (let i = -4; i <= 4; i++) {
    const c = i * CITY.roadEvery;
    for (let p = -280; p < 280; p += 16) {
      dashes.push([c, p, 0]); dashes.push([p, c, 1]);
    }
  }
  const dashMesh = new THREE.InstancedMesh(dashGeo, dashMat, dashes.length);
  const m4 = new THREE.Matrix4();
  dashes.forEach(([x, z, rot], i) => {
    m4.makeRotationY(rot ? Math.PI / 2 : 0); m4.setPosition(x, 0.08, z);
    dashMesh.setMatrixAt(i, m4);
  });
  group.add(dashMesh);

  // Road centre points for traffic / spawn helpers
  for (let i = -4; i <= 4; i++) for (let p = -270; p <= 270; p += 30) {
    roadPoints.push({ x: i * CITY.roadEvery, z: p });
    roadPoints.push({ x: p, z: i * CITY.roadEvery });
  }

  // Buildings, one block at a time. Heights and palettes vary per district.
  const facades = {};
  const palette = ['#6a4a3a', '#7a5a4a', '#4a5a7a', '#8a6a3a', '#5a3a5a', '#3a6a6a', '#9a7a5a'];
  const signs = ['HOTEL MIRAMAR', 'BANCO ALBA', 'CAFÉ LUNA', 'TALLER SOL', 'MERCADO', 'CINE MAR', 'BAR BRISA',
    'HOTEL FARO', 'PIZZA SOL', 'FARMACIA', 'LIBRERÍA', 'DISCO NEÓN', 'PANADERÍA', 'COMIDA EL FARO',
    'SURF SHOP', 'JOYERÍA', 'TEATRO ALBA', 'GYM TITÁN', 'FLORERÍA', 'HOTEL VISTA'];
  let signIdx = 0;
  const poleMat = new THREE.MeshStandardMaterial({ color: 0x2a2a30, roughness: 0.6, metalness: 0.6 });
  const trunkMat = new THREE.MeshStandardMaterial({ color: 0x6a4a2a, roughness: 1 });
  const leafMat = new THREE.MeshStandardMaterial({ color: 0x2a7a3a, roughness: 1 });

  function addSignOnFace(building, w, h, d, text, y) {
    const tex = signTexture(text);
    const mat = new THREE.MeshStandardMaterial({ map: tex, emissive: 0xffffff, emissiveMap: tex, emissiveIntensity: 0.55 });
    const s = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat);
    s.position.set(building.position.x, y, building.position.z + d / 2 + 0.15);
    group.add(s);
  }
  function addPoleSign(x, z, text, height = 7) {
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, height, 8), poleMat);
    pole.position.set(x, height / 2, z); pole.castShadow = true; group.add(pole);
    const tex = signTexture(text);
    const mat = new THREE.MeshStandardMaterial({ map: tex, emissive: 0xffffff, emissiveMap: tex, emissiveIntensity: 0.6, side: THREE.DoubleSide });
    const s = new THREE.Mesh(new THREE.PlaneGeometry(7, 1.75), mat);
    s.position.set(x, height + 0.9, z); group.add(s);
  }
  function addPalm(x, z, scale = 1) {
    const g = new THREE.Group();
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.18 * scale, 0.3 * scale, 6 * scale, 7), trunkMat);
    trunk.position.y = 3 * scale; trunk.rotation.z = 0.08; g.add(trunk);
    for (let i = 0; i < 6; i++) {
      const frond = new THREE.Mesh(new THREE.ConeGeometry(0.5 * scale, 3.2 * scale, 4), leafMat);
      frond.position.y = 6.1 * scale;
      frond.rotation.z = Math.PI / 2.4; frond.rotation.y = (i / 6) * Math.PI * 2;
      frond.position.x = Math.cos((i / 6) * Math.PI * 2) * 1.1 * scale;
      frond.position.z = Math.sin((i / 6) * Math.PI * 2) * 1.1 * scale;
      g.add(frond);
    }
    g.position.set(x, 0, z);
    group.add(g);
  }
  function addLamp(x, z) {
    const g = new THREE.Group();
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.12, 5.4, 8), poleMat);
    pole.position.y = 2.7; g.add(pole);
    const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 1.6, 6), poleMat);
    arm.rotation.z = Math.PI / 2; arm.position.set(0.7, 5.3, 0); g.add(arm);
    const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.22, 10, 8),
      new THREE.MeshStandardMaterial({ color: 0xffe9a8, emissive: 0xffd76a, emissiveIntensity: 2.2 }));
    bulb.position.set(1.4, 5.25, 0); g.add(bulb);
    const glow = new THREE.Mesh(new THREE.SphereGeometry(0.55, 10, 8),
      new THREE.MeshBasicMaterial({ color: 0xffd76a, transparent: true, opacity: 0.16 }));
    glow.position.copy(bulb.position); g.add(glow);
    g.position.set(x, 0, z);
    group.add(g);
  }

  for (let bx = -4; bx <= 3; bx++) for (let bz = -4; bz <= 3; bz++) {
    const cx = bx * CITY.roadEvery + 30, cz = bz * CITY.roadEvery + 30;
    const d = DISTRICTS.find((dd) => cx >= dd.x0 && cx < dd.x1 && cz >= dd.z0 && cz < dd.z1);
    if (!d) continue;
    // Keep the plaza, casino lot, stadium lot and marina clear.
    if (Math.abs(cx) < 70 && Math.abs(cz - 30) < 70) continue;
    if (cx > 120 && cz < 0 && cz > -180) continue;
    if (cx > 150 && cz > 150) continue;
    if (cx < -180) continue;
    const n = d.id === 'miramar' ? 2 : rng.int(2, 3);
    for (let k = 0; k < n; k++) {
      const w = rng.range(14, 24), dep = rng.range(12, 20);
      let hgt = rng.range(9, 22);
      if (d.id === 'miramar') hgt = rng.range(30, 58);
      if (d.id === 'faro') hgt = rng.range(7, 13);
      if (d.id === 'estadio') hgt = rng.range(8, 14);
      const ox = cx + rng.range(-12, 12), oz = cz + rng.range(-12, 12);
      const base = d.id === 'faro' ? '#a06a42' : palette[Math.floor(rng.next() * palette.length)];
      const key = base + (d.id === 'miramar' ? '-glass' : '');
      if (!facades[key]) {
        const tex = facadeTexture(rng, base, d.id === 'miramar' ? 0.55 : 0.42);
        facades[key] = new THREE.MeshStandardMaterial({
          map: tex, emissive: 0xffffff, emissiveMap: tex, emissiveIntensity: 0.35,
          roughness: d.id === 'miramar' ? 0.15 : 0.8, metalness: d.id === 'miramar' ? 0.7 : 0.05,
        });
      }
      const b = new THREE.Mesh(new THREE.BoxGeometry(w, hgt, dep), facades[key]);
      b.position.set(ox, hgt / 2, oz);
      b.castShadow = true; b.receiveShadow = true;
      group.add(b);
      colliders.push({ x0: ox - w / 2, z0: oz - dep / 2, x1: ox + w / 2, z1: oz + dep / 2 });
      // Roof trim + sign flat on the face (never floating).
      const trim = new THREE.Mesh(new THREE.BoxGeometry(w + 0.4, 0.5, dep + 0.4),
        new THREE.MeshStandardMaterial({ color: 0x1a1a22, roughness: 0.5 }));
      trim.position.set(ox, hgt + 0.25, oz); group.add(trim);
      if (rng.next() < 0.55) addSignOnFace(b, Math.min(12, w * 0.7), 3, dep, signs[signIdx++ % signs.length], Math.min(hgt - 2.5, 9));
      if (rng.next() < 0.3) addPalm(ox + w / 2 + 3, oz + dep / 2 + 2, rng.range(0.8, 1.2));
    }
    // Corner lamps on every block
    addLamp(cx - 26, cz - 26); addLamp(cx + 26, cz + 26);
  }

  // Downtown Plaza: patterned floor, fountain, benches, café tables.
  const plazaTex = canvasTexture(512, 512, (g, w, h) => {
    for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) {
      g.fillStyle = (x + y) % 2 ? '#c8b898' : '#a89878'; g.fillRect(x * 64, y * 64, 64, 64);
      g.strokeStyle = 'rgba(120,90,40,0.5)'; g.strokeRect(x * 64 + 2, y * 64 + 2, 60, 60);
    }
    g.fillStyle = '#8a6a3a'; g.beginPath(); g.arc(256, 256, 90, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#5a9ac8'; g.beginPath(); g.arc(256, 256, 70, 0, Math.PI * 2); g.fill();
  });
  const plaza = new THREE.Mesh(new THREE.PlaneGeometry(110, 110),
    new THREE.MeshStandardMaterial({ map: plazaTex, roughness: 0.55, metalness: 0.15 }));
  plaza.rotation.x = -Math.PI / 2; plaza.position.set(0, 0.07, 30); plaza.receiveShadow = true;
  group.add(plaza);
  const fountain = new THREE.Group();
  const basin = new THREE.Mesh(new THREE.CylinderGeometry(7, 7.6, 1.1, 20),
    new THREE.MeshStandardMaterial({ color: 0x8a6a3a, roughness: 0.5 }));
  basin.position.y = 0.55; fountain.add(basin);
  const fwater = new THREE.Mesh(new THREE.CylinderGeometry(6.4, 6.4, 0.3, 20),
    new THREE.MeshStandardMaterial({ color: 0x3a8ac8, roughness: 0.1, metalness: 0.6 }));
  fwater.position.y = 1.05; fountain.add(fwater);
  const spout = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.6, 1.8, 10),
    new THREE.MeshStandardMaterial({ color: 0xd8c8a0, roughness: 0.4 }));
  spout.position.y = 1.9; fountain.add(spout);
  const tier = new THREE.Mesh(new THREE.CylinderGeometry(1.8, 1.4, 0.35, 14),
    new THREE.MeshStandardMaterial({ color: 0xd8c8a0, roughness: 0.4 }));
  tier.position.y = 2.9; fountain.add(tier);
  const tierWater = new THREE.Mesh(new THREE.CylinderGeometry(1.6, 1.6, 0.12, 14),
    new THREE.MeshStandardMaterial({ color: 0x3a8ac8, roughness: 0.1, metalness: 0.6 }));
  tierWater.position.y = 3.1; fountain.add(tierWater);
  fountain.position.set(0, 0, 30);
  group.add(fountain);
  // Plaza props: benches, planters, café tables, flags
  const benchMat = new THREE.MeshStandardMaterial({ color: 0x6a4a2a, roughness: 0.9 });
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    const bx = Math.cos(a) * 26, bz = 30 + Math.sin(a) * 26;
    const bench = new THREE.Mesh(new THREE.BoxGeometry(3, 0.5, 1), benchMat);
    bench.position.set(bx, 0.5, bz); bench.rotation.y = -a; bench.castShadow = true; group.add(bench);
    const planter = new THREE.Mesh(new THREE.BoxGeometry(1.6, 1, 1.6),
      new THREE.MeshStandardMaterial({ color: 0x3a5a3a, roughness: 1 }));
    planter.position.set(bx * 1.25, 0.5, 30 + (bz - 30) * 1.25); group.add(planter);
  }
  addPoleSign(-40, 78, 'PLAZA ALBA', 6);
  addPoleSign(40, -18, 'CENTRO', 6);

  // Grand Maravilla casino: glass tower with LIT WINDOWS + gold neon crown
  // + a big glowing face sign. It must read as the centrepiece, not a slab.
  const casino = new THREE.Group();
  const casinoTex = facadeTexture(rng, '#4a4a7a', 0.55);
  const tower = new THREE.Mesh(new THREE.BoxGeometry(46, 44, 30),
    new THREE.MeshStandardMaterial({ map: casinoTex, emissive: 0xffffff, emissiveMap: casinoTex, emissiveIntensity: 0.5, roughness: 0.25, metalness: 0.5 }));
  tower.position.y = 22; tower.castShadow = true; casino.add(tower);
  const crown = new THREE.Mesh(new THREE.TorusGeometry(10, 1.1, 10, 24),
    new THREE.MeshStandardMaterial({ color: 0xffd76a, emissive: 0xffb800, emissiveIntensity: 3, metalness: 0.8, roughness: 0.2 }));
  crown.rotation.x = Math.PI / 2; crown.position.y = 45.5; crown.scale.set(2.2, 1.4, 1); casino.add(crown);
  const crown2 = new THREE.Mesh(new THREE.TorusGeometry(7, 0.8, 8, 20),
    new THREE.MeshStandardMaterial({ color: 0xffe9a8, emissive: 0xffc040, emissiveIntensity: 3, metalness: 0.8, roughness: 0.2 }));
  crown2.rotation.x = Math.PI / 2; crown2.position.y = 47.5; crown2.scale.set(2.2, 1.4, 1); casino.add(crown2);
  const crownGlow = new THREE.Mesh(new THREE.SphereGeometry(12, 16, 12),
    new THREE.MeshBasicMaterial({ color: 0xffc040, transparent: true, opacity: 0.16 }));
  crownGlow.position.y = 46; crownGlow.scale.y = 0.5; casino.add(crownGlow);
  const cSignTex = signTexture('GRAND MARAVILLA', '#ffe9a8', '#3a0a2a');
  const cSign = new THREE.Mesh(new THREE.PlaneGeometry(44, 7),
    new THREE.MeshStandardMaterial({ map: cSignTex, emissive: 0xffffff, emissiveMap: cSignTex, emissiveIntensity: 1.4 }));
  cSign.position.set(0, 34, 15.2); casino.add(cSign);
  const cSign2 = cSign.clone(); cSign2.rotation.y = Math.PI; cSign2.position.z = -15.2; casino.add(cSign2);
  // Gold halo ring on the face: reads as the casino's crown even when a
  // taller tower stands behind it.
  const halo = new THREE.Mesh(new THREE.TorusGeometry(5, 0.7, 10, 32),
    new THREE.MeshStandardMaterial({ color: 0xffd76a, emissive: 0xffb800, emissiveIntensity: 3, metalness: 0.8, roughness: 0.2 }));
  halo.position.set(0, 40, 15.3); casino.add(halo);
  const halo2 = halo.clone(); halo2.rotation.y = Math.PI; halo2.position.z = -15.3; casino.add(halo2);
  casino.position.set(PLACES.casino.x, 0, PLACES.casino.z);
  group.add(casino);
  colliders.push({ x0: 157, z0: -135, x1: 203, z1: -105 });

  // Lighthouse on the hill at El Faro.
  const light = new THREE.Group();
  const lt = new THREE.Mesh(new THREE.CylinderGeometry(3.2, 4.6, 26, 14),
    new THREE.MeshStandardMaterial({ color: 0xf0e8d8, roughness: 0.6 }));
  lt.position.y = 13; lt.castShadow = true; light.add(lt);
  const band = new THREE.Mesh(new THREE.CylinderGeometry(3.6, 3.9, 3, 14),
    new THREE.MeshStandardMaterial({ color: 0xc02028, roughness: 0.5 }));
  band.position.y = 18; light.add(band);
  const lampRoom = new THREE.Mesh(new THREE.CylinderGeometry(2.6, 2.6, 3, 12),
    new THREE.MeshStandardMaterial({ color: 0x222233, emissive: 0xffe9a8, emissiveIntensity: 1.6 }));
  lampRoom.position.y = 27.5; light.add(lampRoom);
  const beam = new THREE.Mesh(new THREE.ConeGeometry(4, 60, 12, 1, true),
    new THREE.MeshBasicMaterial({ color: 0xfff2b0, transparent: true, opacity: 0.14, side: THREE.DoubleSide, depthWrite: false }));
  beam.rotation.z = Math.PI / 2; beam.position.set(30, 27.5, 0); beam.name = 'beam'; light.add(beam);
  light.position.set(PLACES.lighthouse.x, 0, PLACES.lighthouse.z);
  group.add(light);

  // Estadio Sol: bowl + flags.
  const stadium = new THREE.Group();
  const bowl = new THREE.Mesh(new THREE.CylinderGeometry(34, 38, 14, 20),
    new THREE.MeshStandardMaterial({ color: 0xd8d0c0, roughness: 0.7 }));
  bowl.position.y = 7; bowl.castShadow = true; stadium.add(bowl);
  const rim = new THREE.Mesh(new THREE.TorusGeometry(34, 1.2, 8, 24),
    new THREE.MeshStandardMaterial({ color: 0xc02028, emissive: 0x801010, emissiveIntensity: 0.6 }));
  rim.rotation.x = Math.PI / 2; rim.position.y = 14.5; stadium.add(rim);
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2;
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 7, 6), poleMat);
    pole.position.set(Math.cos(a) * 36, 17.5, Math.sin(a) * 36); stadium.add(pole);
    const flag = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 1.5, 1, 1),
      new THREE.MeshStandardMaterial({ color: i % 2 ? 0xffd76a : 0xc02028, side: THREE.DoubleSide, emissive: 0x331111, emissiveIntensity: 0.3 }));
    flag.position.set(Math.cos(a) * 36 + 1.3, 19.5, Math.sin(a) * 36); stadium.add(flag);
  }
  stadium.position.set(PLACES.stadium.x, 0, PLACES.stadium.z);
  group.add(stadium);
  colliders.push({ x0: 172, z0: 172, x1: 248, z1: 248 });

  // Marina: wooden piers + yachts with white hulls, masts, cabins; water behind.
  const woodMat = new THREE.MeshStandardMaterial({ color: 0x7a5a34, roughness: 0.9 });
  const hullMat = new THREE.MeshStandardMaterial({ color: 0xf2f2ea, roughness: 0.25, metalness: 0.35 });
  const yachts = [];
  for (let p = 0; p < 3; p++) {
    const pier = new THREE.Mesh(new THREE.BoxGeometry(6, 0.8, 90), woodMat);
    pier.position.set(-268 + p * 16, 0.4, -180 + p * 24);
    pier.castShadow = true; group.add(pier);
    // Pier lamps
    for (let l = 0; l < 4; l++) addLamp(-265 + p * 16, -215 + p * 24 + l * 24);
  }
  function addYacht(x, z, rot, scale = 1) {
    const y = new THREE.Group();
    const hull = new THREE.Mesh(new THREE.SphereGeometry(2.2 * scale, 12, 8), hullMat);
    hull.scale.set(1, 0.55, 3.2); hull.position.y = 0.9 * scale; y.add(hull);
    const cabin = new THREE.Mesh(new THREE.BoxGeometry(2.4 * scale, 1.6 * scale, 4 * scale),
      new THREE.MeshStandardMaterial({ color: 0xe8e0d0, roughness: 0.3, metalness: 0.2 }));
    cabin.position.set(0, 2.2 * scale, -0.6 * scale); y.add(cabin);
    const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.09 * scale, 0.12 * scale, 11 * scale, 8),
      new THREE.MeshStandardMaterial({ color: 0xd8d8d8, metalness: 0.8, roughness: 0.3 }));
    mast.position.y = 6.5 * scale; y.add(mast);
    // Furled white sail along the mast: the thing that reads as "yacht".
    const sail = new THREE.Mesh(new THREE.BoxGeometry(0.18 * scale, 5.5 * scale, 1.7 * scale),
      new THREE.MeshStandardMaterial({ color: 0xf8f8f0, roughness: 0.55 }));
    sail.position.set(0, 6.2 * scale, 0.9 * scale); y.add(sail);
    const boom = new THREE.Mesh(new THREE.CylinderGeometry(0.07 * scale, 0.07 * scale, 5 * scale, 6), mast.material);
    boom.rotation.x = Math.PI / 2; boom.position.set(0, 3.4 * scale, 1.6 * scale); y.add(boom);
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(4.5 * scale, 0.3, 0.4),
      new THREE.MeshStandardMaterial({ color: 0x1a4a7a, roughness: 0.4 }));
    stripe.position.set(0, 1.1 * scale, 2.8 * scale); y.add(stripe);
    y.position.set(x, 0.2, z); y.rotation.y = rot;
    group.add(y); yachts.push(y);
    return y;
  }
  addYacht(-285, -210, 0.15, 1.15);
  addYacht(-292, -160, -0.1, 1.0);
  addYacht(-278, -120, 0.2, 0.9);
  addYacht(-296, -95, 0.05, 1.2);
  addYacht(-282, -235, -0.15, 0.95);
  addYacht(-268, -150, 0.1, 1.05); // close to the pier road: big in the shot
  addYacht(-266, -190, -0.08, 1.1);
  addPoleSign(-252, -150, 'MARINA ALBA', 7);
  for (let i = 0; i < 8; i++) addPalm(-232 + rng.range(-4, 4), -230 + i * 16, rng.range(0.9, 1.3));

  // Centro night market: stalls with striped awnings on poles.
  for (let s = 0; s < 10; s++) {
    const sx = -90 + (s % 5) * 16, sz = -110 + Math.floor(s / 5) * 14;
    const stall = new THREE.Group();
    const counter = new THREE.Mesh(new THREE.BoxGeometry(4, 1.1, 2.4),
      new THREE.MeshStandardMaterial({ color: 0x6a4a2a, roughness: 0.9 }));
    counter.position.y = 0.55; stall.add(counter);
    const awn = new THREE.Mesh(new THREE.PlaneGeometry(4.6, 3),
      new THREE.MeshStandardMaterial({ map: awningTexture('#c02028', '#f0e8d8'), side: THREE.DoubleSide, roughness: 0.8 }));
    awn.rotation.x = -Math.PI / 2 + 0.25; awn.position.y = 2.6; stall.add(awn);
    for (const [px, pz] of [[-2, -1], [2, -1], [-2, 1], [2, 1]]) {
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 2.6, 6), poleMat);
      post.position.set(px, 1.3, pz); stall.add(post);
    }
    const goods = new THREE.Mesh(new THREE.BoxGeometry(3.6, 0.5, 1.8),
      new THREE.MeshStandardMaterial({ color: s % 2 ? 0xe07820 : 0x3aa84a, roughness: 0.7 }));
    goods.position.y = 1.35; stall.add(goods);
    stall.position.set(sx, 0, sz);
    group.add(stall);
  }

  // Beach props: umbrellas, surfboards, deck chairs.
  const umbMat = new THREE.MeshStandardMaterial({ color: 0xff7a5a, roughness: 0.8, side: THREE.DoubleSide });
  for (let i = 0; i < 10; i++) {
    const ux = -240 + i * 52, uz = 288 + rng.range(-6, 6);
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 2.6, 6), poleMat);
    pole.position.set(ux, 1.3, uz); group.add(pole);
    const top = new THREE.Mesh(new THREE.ConeGeometry(2.4, 1, 10), i % 2 ? umbMat : new THREE.MeshStandardMaterial({ color: 0x2a9ad8, roughness: 0.8, side: THREE.DoubleSide }));
    top.position.set(ux, 2.9, uz); group.add(top);
    const board = new THREE.Mesh(new THREE.CapsuleGeometry(0.35, 2.2, 4, 8),
      new THREE.MeshStandardMaterial({ color: [0xffd76a, 0x2ad8c8, 0xff5a8a][i % 3], roughness: 0.4 }));
    board.rotation.z = Math.PI / 2 - 0.15; board.rotation.y = rng.next();
    board.position.set(ux + 3, 0.35, uz + 2); group.add(board);
  }

  // Street props everywhere: hydrants, bins, benches, planters, café tables.
  const hydMat = new THREE.MeshStandardMaterial({ color: 0xc02028, roughness: 0.5 });
  const binMat = new THREE.MeshStandardMaterial({ color: 0x3a4a3a, roughness: 0.8, metalness: 0.3 });
  for (let i = 0; i < 60; i++) {
    const rx = rng.pick([-270, -210, -150, -90, -30, 30, 90, 150, 210, 270]);
    const rz = rng.range(-270, 270);
    const kind = i % 4;
    if (kind === 0) {
      const h = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.4, 0.9, 8), hydMat);
      h.position.set(rx + 8, 0.45, rz); group.add(h);
    } else if (kind === 1) {
      const b = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.45, 1.1, 10), binMat);
      b.position.set(rx - 8, 0.55, rz); group.add(b);
    } else if (kind === 2) {
      const bench = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.45, 0.9), benchMat);
      bench.position.set(rx + 8, 0.45, rz); group.add(bench);
    } else {
      const table = new THREE.Mesh(new THREE.CylinderGeometry(0.8, 0.8, 0.08, 12),
        new THREE.MeshStandardMaterial({ color: 0xe8e0d0, roughness: 0.5 }));
      table.position.set(rx - 8, 0.75, rz); group.add(table);
      const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.75, 6), poleMat);
      leg.position.set(rx - 8, 0.37, rz); group.add(leg);
    }
  }

  // Neon reflections on the wet asphalt: additive streaks along the two
  // neon avenues, as if the signs and lamps were mirrored in the road.
  const streakTex = canvasTexture(64, 256, (g, w, h) => {
    const grad = g.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0, 'rgba(255,255,255,0)');
    grad.addColorStop(0.5, 'rgba(255,255,255,0.9)');
    grad.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = grad; g.fillRect(0, 0, w, h);
  });
  const streakColors = [0xff5a8a, 0x2ad8ff, 0xffc040, 0xff7a40, 0x9a6aff];
  for (let i = 0; i < 40; i++) {
    const mat = new THREE.MeshBasicMaterial({
      map: streakTex, color: streakColors[i % streakColors.length],
      transparent: true, opacity: 0.5, blending: THREE.AdditiveBlending, depthWrite: false,
    });
    const streak = new THREE.Mesh(new THREE.PlaneGeometry(1.8, rng.range(8, 16)), mat);
    streak.rotation.x = -Math.PI / 2;
    if (i % 3 === 0) {
      streak.position.set(rng.range(-4, 4), 0.09, -260 + i * 13);
      streak.rotation.z = 0;
    } else if (i % 3 === 1) {
      streak.position.set(-260 + (i - 1) * 13, 0.09, -120 + rng.range(-3, 3));
      streak.rotation.z = Math.PI / 2;
    } else {
      // The casino avenue (x = 180), so the plaza shot has wet reflections too.
      streak.position.set(180 + rng.range(-3, 3), 0.09, -180 + i * 7);
      streak.rotation.z = 0;
    }
    group.add(streak);
  }

  // Garage building (Theo's) with a big face sign + open bay.
  const garage = new THREE.Group();
  const gbox = new THREE.Mesh(new THREE.BoxGeometry(26, 9, 18),
    new THREE.MeshStandardMaterial({ color: 0x4a4a55, roughness: 0.7 }));
  gbox.position.y = 4.5; gbox.castShadow = true; garage.add(gbox);
  const gSign = new THREE.Mesh(new THREE.PlaneGeometry(20, 3),
    new THREE.MeshStandardMaterial({ map: signTexture("THEO'S GARAGE", '#7fd4e8', '#1a1a22'), emissive: 0xffffff, emissiveMap: signTexture("THEO'S GARAGE", '#7fd4e8', '#1a1a22'), emissiveIntensity: 0.7 }));
  gSign.position.set(0, 7, 9.15); garage.add(gSign);
  garage.position.set(PLACES.garage.x, 0, PLACES.garage.z);
  group.add(garage);
  colliders.push({ x0: -103, z0: 111, x1: -77, z1: 129 });

  // Safehouse: small villa with a lit porch.
  const safe = new THREE.Group();
  const sbox = new THREE.Mesh(new THREE.BoxGeometry(14, 7, 12),
    new THREE.MeshStandardMaterial({ color: 0xd8c8a0, roughness: 0.8 }));
  sbox.position.y = 3.5; sbox.castShadow = true; safe.add(sbox);
  const roof = new THREE.Mesh(new THREE.ConeGeometry(10, 3.5, 4),
    new THREE.MeshStandardMaterial({ color: 0xa04a2a, roughness: 0.8 }));
  roof.position.y = 8.5; roof.rotation.y = Math.PI / 4; safe.add(roof);
  safe.position.set(PLACES.safehouse.x, 0, PLACES.safehouse.z);
  group.add(safe);

  scene.add(group);
  return { group, colliders, roadPoints, yachts, water, beam };
}

export function nearestRoadPoint(roadPoints, x, z) {
  let best = roadPoints[0], bd = Infinity;
  for (const p of roadPoints) {
    const d = (p.x - x) ** 2 + (p.z - z) ** 2;
    if (d < bd) { bd = d; best = p; }
  }
  return best;
}

export function isOnRoad(x, z) {
  // On a road if close to a grid line (within half the road width + margin).
  const rx = Math.abs(((x + 30) % 60 + 60) % 60 - 30);
  const rz = Math.abs(((z + 30) % 60 + 60) % 60 - 30);
  return rx < 8 || rz < 8;
}
