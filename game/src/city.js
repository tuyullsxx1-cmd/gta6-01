// Maravilla itself: a 600 x 600 m road grid, pastel buildings with lit
// windows, palms, lamps, a beach and a pier. Builds the static meshes once
// into the scene and answers the questions gameplay asks: where the roads
// are, what blocks movement, where things can spawn.

import * as THREE from 'three';
import { CITY, PALETTE, DISTRICTS } from './config.js';

/** The district a point sits in (same rectangles as config.DISTRICTS). */
function districtFor(x, z) {
  for (const d of DISTRICTS) {
    if (x >= d.minX && x < d.maxX && z >= d.minZ && z < d.maxZ) return d;
  }
  return null;
}

/** Generic shop signs for buildings without a named sign. */
const GENERIC_SIGNS = [
  { text: 'CAFÉ LUNA', bg: '#5a3a2e', fg: '#ffe9c8' },
  { text: 'TALLER SOL', bg: '#2c313a', fg: '#f2c230' },
  { text: 'PANADERÍA', bg: '#c85a2e', fg: '#ffe9c8' },
  { text: 'FARMACIA', bg: '#2a7a6a', fg: '#e8f2f2' },
  { text: 'BAR EL FARO', bg: '#7a2e3a', fg: '#ffe9c8' },
  { text: 'TIENDA MAR', bg: '#123a5c', fg: '#9fc2e8' },
  { text: 'PESCADERÍA', bg: '#1e6f8e', fg: '#e8f2f2' },
  { text: 'CARNICERÍA', bg: '#8a2e2e', fg: '#ffe9c8' },
  { text: 'LIBRERÍA', bg: '#4a3a6a', fg: '#e8e4da' },
  { text: 'FLORERÍA', bg: '#2e8a5a', fg: '#ffe9c8' },
  { text: 'BODEGA', bg: '#6a5a3a', fg: '#f2e3c6' },
  { text: 'HELADERÍA', bg: '#e87a5d', fg: '#ffffff' },
];

function makeFacadeTexture(seed) {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 256;
  const g = canvas.getContext('2d');
  g.fillStyle = '#e8e2d4';
  g.fillRect(0, 0, 128, 256);
  const rnd = (() => {
    let a = seed | 0;
    return () => {
      a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  })();
  for (let row = 0; row < 8; row += 1) {
    for (let col = 0; col < 4; col += 1) {
      const lit = rnd() > 0.55;
      g.fillStyle = lit ? '#ffd98a' : '#2c3542';
      g.fillRect(12 + col * 28, 14 + row * 30, 18, 20);
    }
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function makeSignTexture(text, bg, fg) {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 128;
  const g = canvas.getContext('2d');
  g.fillStyle = bg;
  g.fillRect(0, 0, 512, 128);
  g.fillStyle = fg;
  g.font = 'bold 56px system-ui, sans-serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText(text, 256, 66);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function buildCity(scene, rng) {
  const group = new THREE.Group();
  group.name = 'maravilla';
  scene.add(group);

  const colliders = []; // { minX, maxX, minZ, maxZ }
  const buildings = [];
  const facadeTex = [makeFacadeTexture(11), makeFacadeTexture(47), makeFacadeTexture(83)];

  const lambert = (color, opts = {}) => new THREE.MeshLambertMaterial({ color, ...opts });
  function box(w, h, d, color, x, y, z, opts) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), lambert(color, opts));
    m.position.set(x, y, z);
    m.castShadow = true;
    m.receiveShadow = true;
    group.add(m);
    return m;
  }
  function plane(w, d, color, x, y, z, opts) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, d), lambert(color, opts));
    m.rotation.x = -Math.PI / 2;
    m.position.set(x, y, z);
    m.receiveShadow = true;
    group.add(m);
    return m;
  }

  // Ground base (concrete) and the grass parks sit on it.
  plane(CITY.size + 40, CITY.size + 40, 0x8f8a80, 0, 0, 0);
  // Roads: dark strips on both axes, with centre dashes.
  const roadMat = lambert(PALETTE.asphalt);
  for (const c of CITY.roads) {
    const v = new THREE.Mesh(new THREE.PlaneGeometry(CITY.roadWidth, CITY.size), roadMat);
    v.rotation.x = -Math.PI / 2;
    v.position.set(c, 0.02, 0);
    v.receiveShadow = true;
    group.add(v);
    const h = new THREE.Mesh(new THREE.PlaneGeometry(CITY.size, CITY.roadWidth), roadMat);
    h.rotation.x = -Math.PI / 2;
    h.position.set(0, 0.02, c);
    h.receiveShadow = true;
    group.add(h);
    for (let p = -270; p <= 270; p += 12) {
      box(0.6, 0.05, 3, 0xf2ead8, c, 0.04, p);
      box(3, 0.05, 0.6, 0xf2ead8, p, 0.04, c);
    }
  }

  // Blocks: sidewalk slabs, buildings, parks, palms, lamps.
  const blockCentres = [];
  for (let i = 0; i < CITY.roads.length - 1; i += 1) {
    for (let j = 0; j < CITY.roads.length - 1; j += 1) {
      const cx = (CITY.roads[i] + CITY.roads[i + 1]) / 2;
      const cz = (CITY.roads[j] + CITY.roads[j + 1]) / 2;
      if (cx > 240) continue; // beach strip, no blocks
      blockCentres.push({ x: cx, z: cz });
    }
  }
  const parks = new Set(['-90,90', '150,-30']);
  const downtown = (x, z) => Math.abs(x) < 130 && Math.abs(z) < 130;

  function addBuilding(x, z, w, d, h, color, sign, district) {
    const tex = facadeTex[Math.floor(rng() * facadeTex.length)];
    const mat = new THREE.MeshLambertMaterial({ color, map: tex });
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    // El Faro stilt houses stand on poles above the ground.
    const stilts = district && district.props === 'stilts';
    const baseY = stilts ? 2.5 : 0.3;
    m.position.set(x, h / 2 + baseY, z);
    m.castShadow = true;
    m.receiveShadow = true;
    group.add(m);
    if (stilts) {
      for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
        const pole = new THREE.Mesh(
          new THREE.CylinderGeometry(0.22, 0.28, 2.5, 6),
          lambert(0x7a5c3e),
        );
        pole.position.set(x + sx * (w / 2 - 1), 1.25, z + sz * (d / 2 - 1));
        pole.castShadow = true;
        group.add(pole);
      }
    }
    // Rooftop box so the skyline reads at a glance (terracotta in the
    // old town, grey elsewhere).
    const roofColor = district && district.props === 'oldtown' ? 0xd97b6c : 0x6a6f75;
    box(w * 0.4, 1.6, d * 0.4, roofColor, x, h + baseY + 0.8, z);
    colliders.push({ minX: x - w / 2, maxX: x + w / 2, minZ: z - d / 2, maxZ: z + d / 2 });
    buildings.push({ x, z, w, d, h });
    // Every building gets a name sign: the named one for landmarks, a
    // generic shop sign for the rest.
    const useSign = sign || GENERIC_SIGNS[Math.floor(rng() * GENERIC_SIGNS.length)];
    const signW = sign ? Math.min(w * 0.9, 12) : Math.min(w * 0.9, 10);
    const signH = sign ? 3.5 : 2.8;
    const signMesh = new THREE.Mesh(
      new THREE.PlaneGeometry(signW, signH),
      new THREE.MeshBasicMaterial({ map: makeSignTexture(useSign.text, useSign.bg, useSign.fg) }),
    );
    signMesh.position.set(x, Math.min(h * 0.55, sign ? 14 : 10), z + d / 2 + 0.15);
    group.add(signMesh);
    return m;
  }

  function addPalm(x, z) {
    const trunk = new THREE.Mesh(
      new THREE.CylinderGeometry(0.22, 0.34, 7, 6),
      lambert(PALETTE.palmTrunk),
    );
    trunk.position.set(x, 3.5, z);
    trunk.castShadow = true;
    group.add(trunk);
    for (let k = 0; k < 5; k += 1) {
      const leaf = new THREE.Mesh(
        new THREE.ConeGeometry(1.5, 4.2, 4),
        lambert(PALETTE.palmLeaf),
      );
      const a = (k / 5) * Math.PI * 2;
      leaf.position.set(x + Math.cos(a) * 1.4, 7.6, z + Math.sin(a) * 1.4);
      leaf.rotation.z = Math.cos(a) * 0.9;
      leaf.rotation.x = -Math.sin(a) * 0.9;
      leaf.castShadow = true;
      group.add(leaf);
    }
  }

  function addLamp(x, z) {
    const pole = new THREE.Mesh(
      new THREE.CylinderGeometry(0.09, 0.12, 6, 6),
      lambert(0x2c313a),
    );
    pole.position.set(x, 3, z);
    group.add(pole);
    const lamp = new THREE.Mesh(
      new THREE.SphereGeometry(0.35, 8, 8),
      new THREE.MeshBasicMaterial({ color: 0xffe9a8 }),
    );
    lamp.position.set(x, 6.1, z);
    lamp.name = 'lamp';
    group.add(lamp);
  }

  // --- signature props per district (gap 10) -------------------------------
  function addStall(x, z) {
    // Night-market stall: counter + striped awning.
    const awningCols = [0xe85d5d, 0xf2c230, 0x3aa7a3, 0x3f6fb5];
    const c = awningCols[Math.floor(rng() * awningCols.length)];
    box(3.4, 1, 2, 0x8a6a48, x, 0.8, z);
    const awn = new THREE.Mesh(
      new THREE.BoxGeometry(4, 0.18, 2.6),
      lambert(c),
    );
    awn.position.set(x, 2.4, z);
    awn.rotation.z = 0.12;
    awn.castShadow = true;
    group.add(awn);
    for (const s of [-1.7, 1.7]) {
      const pole = new THREE.Mesh(
        new THREE.CylinderGeometry(0.06, 0.06, 2.4, 6),
        lambert(0x2c313a),
      );
      pole.position.set(x + s, 1.2, z + 1.1);
      group.add(pole);
    }
  }

  function addSurfboard(x, z) {
    const cols = [0xe85d5d, 0x3f6fb5, 0xf2c230, 0x2e8a5a];
    const board = new THREE.Mesh(
      new THREE.BoxGeometry(0.7, 3.4, 0.12),
      lambert(cols[Math.floor(rng() * cols.length)]),
    );
    board.position.set(x, 1.7, z);
    board.rotation.z = 0.28;
    board.rotation.y = rng() * Math.PI;
    board.castShadow = true;
    group.add(board);
  }

  function addBoat(x, z) {
    // Small fishing boat on the marina ground.
    const hull = new THREE.Mesh(
      new THREE.BoxGeometry(2.2, 0.9, 5),
      lambert(0x7a5c3e),
    );
    hull.position.set(x, 0.6, z);
    hull.castShadow = true;
    group.add(hull);
    const bow = new THREE.Mesh(
      new THREE.ConeGeometry(1.1, 1.8, 4),
      lambert(0x7a5c3e),
    );
    bow.rotation.x = Math.PI / 2;
    bow.rotation.y = Math.PI / 4;
    bow.position.set(x, 0.6, z + 3.2);
    group.add(bow);
    const mast = new THREE.Mesh(
      new THREE.CylinderGeometry(0.07, 0.07, 3.4, 6),
      lambert(0x2c313a),
    );
    mast.position.set(x, 2.4, z);
    group.add(mast);
  }

  const signs = {
    '30,30': { text: 'BANCO ALBA', bg: '#123a5c', fg: '#ffd98a' },
    '-90,150': { text: 'HOTEL MIRAMAR', bg: '#7a2e3a', fg: '#ffe9c8' },
    '90,-150': { text: 'FIERRO ARMS', bg: '#20242a', fg: '#f2c230' },
    '150,90': { text: 'MARAVILLA PD', bg: '#1c2733', fg: '#9fc2e8' },
    '-30,210': { text: 'CLINICA SOL', bg: '#e8f2f2', fg: '#2a7a6a' },
    '-150,150': { text: 'MERCADO EL FARO', bg: '#c85a2e', fg: '#ffe9c8' },
  };

  for (const b of blockCentres) {
    const key = `${b.x},${b.z}`;
    // Sidewalk slab.
    box(48, 0.3, 48, PALETTE.sidewalk, b.x, 0.15, b.z);
    if (key === '210,-210') {
      // Estadio Sol: bowl, pitch, floodlights — replaces the block's buildings.
      const bowl = new THREE.Mesh(
        new THREE.CylinderGeometry(21, 23, 11, 24, 1, true),
        lambert(0xd8d2c4, { side: THREE.DoubleSide }),
      );
      bowl.position.set(b.x, 5.8, b.z);
      bowl.castShadow = true;
      group.add(bowl);
      const rim = new THREE.Mesh(
        new THREE.TorusGeometry(21, 1.1, 8, 24),
        lambert(0x3f6fb5),
      );
      rim.rotation.x = Math.PI / 2;
      rim.position.set(b.x, 11.4, b.z);
      group.add(rim);
      plane(34, 22, 0x4a8a3f, b.x, 0.35, b.z);
      box(30, 0.3, 0.4, 0xf2ead8, b.x, 0.4, b.z);
      const standSign = new THREE.Mesh(
        new THREE.PlaneGeometry(22, 5),
        new THREE.MeshBasicMaterial({ map: makeSignTexture('ESTADIO SOL', '#123a5c', '#ffd98a') }),
      );
      standSign.position.set(b.x, 9, b.z + 21.2);
      group.add(standSign);
      for (const [fx, fz] of [[-20, -20], [20, -20], [-20, 20], [20, 20]]) {
        const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.24, 16, 6), lambert(0x2c313a));
        pole.position.set(b.x + fx, 8, b.z + fz);
        group.add(pole);
        const head = new THREE.Mesh(new THREE.BoxGeometry(3, 1, 0.6), new THREE.MeshBasicMaterial({ color: 0xfff2b0 }));
        head.position.set(b.x + fx, 16.2, b.z + fz);
        head.name = 'lamp';
        group.add(head);
      }
      // Ticket booths + flags at the stadium gates.
      for (const [bx, bz] of [[-26, 0], [26, 0]]) {
        box(4, 3, 3, 0x3f6fb5, b.x + bx, 1.8, b.z + bz);
        box(4.4, 0.3, 3.4, 0xf2c230, b.x + bx, 3.4, b.z + bz);
      }
      for (const [fx, fz, col] of [[-24, -24, 0x3f6fb5], [24, -24, 0xd84040], [-24, 24, 0xf2c230], [24, 24, 0x2e8a5a]]) {
        const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 7, 6), lambert(0x2c313a));
        pole.position.set(b.x + fx, 3.5, b.z + fz);
        group.add(pole);
        const flag = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 1.4),
          new THREE.MeshBasicMaterial({ color: col, side: THREE.DoubleSide }));
        flag.position.set(b.x + fx + 1.1, 6.2, b.z + fz);
        group.add(flag);
      }
      colliders.push({ minX: b.x - 23, maxX: b.x + 23, minZ: b.z - 23, maxZ: b.z + 23 });
      buildings.push({ x: b.x, z: b.z, w: 46, d: 46, h: 11 });
      continue;
    }
    if (parks.has(key)) {
      plane(44, 44, PALETTE.grass, b.x, 0.32, b.z);
      // Fountain at the plaza centre.
      const basin = new THREE.Mesh(
        new THREE.CylinderGeometry(6, 6.6, 1, 20),
        lambert(0x9aa0a8),
      );
      basin.position.set(b.x, 0.8, b.z);
      basin.castShadow = true;
      group.add(basin);
      const water = new THREE.Mesh(
        new THREE.CylinderGeometry(5.4, 5.4, 0.3, 20),
        lambert(0x4fa8c8),
      );
      water.position.set(b.x, 1.2, b.z);
      group.add(water);
      colliders.push({ minX: b.x - 6.6, maxX: b.x + 6.6, minZ: b.z - 6.6, maxZ: b.z + 6.6 });
      for (let k = 0; k < 6; k += 1) addPalm(b.x + (rng() - 0.5) * 36, b.z + (rng() - 0.5) * 36);
      continue;
    }
    const tall = downtown(b.x, b.z);
    const count = tall ? 2 : 1 + (rng() > 0.6 ? 1 : 0);
    const district = districtFor(b.x, b.z);
    const palette = (district && district.palette) || PALETTE.building;
    for (let k = 0; k < count; k += 1) {
      // Width/depth cap 20: a two-building block offsets its buildings by
      // +-11 from the block centre, and the block is 48 m wide between the
      // road edges, so 11 + 20/2 = 21 < 24 keeps every face 3 m clear of
      // the road. Uncapped (up to 30) a building could jut 2 m into the
      // road and pin any car that hugs that edge; even at 24 the face
      // sits 1 m from the edge, which is not enough shoulder for a car
      // dodging traffic.
      const w = 16 + rng() * 4;
      const d = 16 + rng() * 4;
      const h = tall ? 18 + rng() * 30 : 8 + rng() * 10;
      const ox = count === 1 ? 0 : (k === 0 ? -11 : 11);
      const oz = count === 1 ? 0 : (k === 0 ? -11 : 11);
      const color = palette[Math.floor(rng() * palette.length)];
      addBuilding(b.x + ox, b.z + oz, w, d, h, color, k === 0 ? signs[key] : null, district);
    }
    // Palms and lamps around the block corners.
    if (rng() > 0.4) addPalm(b.x - 22, b.z - 22);
    if (rng() > 0.4) addPalm(b.x + 22, b.z + 22);
    addLamp(b.x - 24, b.z + 6);
    addLamp(b.x + 24, b.z - 6);
    // Signature props per district (night-market stalls, surfboards, boats).
    if (district) {
      if (district.props === 'market') {
        addStall(b.x - 18, b.z + 18);
        addStall(b.x + 18, b.z - 18);
      } else if (district.props === 'boardwalk') {
        addSurfboard(b.x - 22, b.z + 20);
        addSurfboard(b.x + 22, b.z - 20);
      } else if (district.props === 'boats' && rng() > 0.4) {
        addBoat(b.x + 18, b.z + 18);
      }
    }
  }

  // Beach: sand, umbrellas, towels. Ocean: one big plane past x = 300.
  plane(36, CITY.size, PALETTE.sand, 282, 0.06, 0);
  const ocean = new THREE.Mesh(
    new THREE.PlaneGeometry(700, 900),
    new THREE.MeshLambertMaterial({ color: PALETTE.ocean, transparent: true, opacity: 0.96 }),
  );
  ocean.rotation.x = -Math.PI / 2;
  ocean.position.set(650, 0.05, 0);
  ocean.receiveShadow = true;
  ocean.name = 'ocean';
  group.add(ocean);
  for (let i = 0; i < 12; i += 1) {
    const ux = 272 + rng() * 20;
    const uz = -260 + i * 50 + rng() * 16;
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 3, 6), lambert(0x8a7a5a));
    pole.position.set(ux, 1.5, uz);
    group.add(pole);
    const top = new THREE.Mesh(
      new THREE.ConeGeometry(2.6, 1.2, 8),
      lambert([0xe85d5d, 0x3f8a4a, 0xf2c230, 0x3f6fb5][i % 4]),
    );
    top.position.set(ux, 3.4, uz);
    top.castShadow = true;
    group.add(top);
    box(2.2, 0.12, 1.2, [0xe85d5d, 0x3f6fb5, 0xf2c230][i % 3], ux + 2.5, 0.15, uz + 1);
  }

  // Two parked scooters on the sand, by the umbrellas.
  function addScooter(x, z, color) {
    const g = new THREE.Group();
    const body = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.35, 0.5), lambert(color));
    body.position.y = 0.55;
    body.castShadow = true;
    g.add(body);
    const seat = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.12, 0.45), lambert(0x1c2733));
    seat.position.set(-0.3, 0.78, 0);
    g.add(seat);
    const wheelGeo = new THREE.CylinderGeometry(0.28, 0.28, 0.18, 10);
    const wheelMat = lambert(0x14181d);
    for (const s of [0.65, -0.65]) {
      const w = new THREE.Mesh(wheelGeo, wheelMat);
      w.rotation.x = Math.PI / 2;
      w.position.set(s, 0.28, 0);
      g.add(w);
    }
    const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.7, 6), lambert(0x2c313a));
    bar.rotation.x = Math.PI / 2;
    bar.position.set(0.72, 0.95, 0);
    g.add(bar);
    g.position.set(x, 0, z);
    g.rotation.y = rng() * Math.PI;
    group.add(g);
  }
  addScooter(276, -40, 0xd84040);
  addScooter(278, 120, 0x3f6fb5);

  // Miramar Pier: planks out to sea, lamps, a shack at the end.
  const pier = CITY.pier;
  for (let x = pier.x; x < pier.x + pier.length; x += 4) {
    box(4, 0.5, pier.width, 0x8a6a48, x, 0.6, pier.z);
  }
  for (let x = pier.x + 6; x < pier.x + pier.length; x += 14) addLamp(x, pier.z - 4);
  box(10, 5, 8, 0x7a5c3e, pier.x + pier.length - 4, 3.1, pier.z);
  box(11, 0.6, 9, 0xd97b6c, pier.x + pier.length - 4, 5.9, pier.z);
  colliders.push({ minX: pier.x + pier.length - 9, maxX: pier.x + pier.length + 1, minZ: pier.z - 4, maxZ: pier.z + 4 });

  // Faro de Maravilla — lighthouse just past the pier end.
  const lightX = pier.x + pier.length + 6;
  const lightBase = new THREE.Mesh(
    new THREE.CylinderGeometry(2.4, 3.2, 24, 12),
    lambert(0xf2ead8),
  );
  lightBase.position.set(lightX, 12.6, pier.z);
  lightBase.castShadow = true;
  group.add(lightBase);
  const lightBand = new THREE.Mesh(
    new THREE.CylinderGeometry(2.55, 2.7, 4, 12),
    lambert(0xd84040),
  );
  lightBand.position.set(lightX, 18, pier.z);
  group.add(lightBand);
  const lightTop = new THREE.Mesh(
    new THREE.CylinderGeometry(1.8, 1.8, 3, 10),
    lambert(0x2c313a),
  );
  lightTop.position.set(lightX, 26, pier.z);
  group.add(lightTop);
  const lightBulb = new THREE.Mesh(
    new THREE.SphereGeometry(1.1, 10, 10),
    new THREE.MeshBasicMaterial({ color: 0xfff2a8 }),
  );
  lightBulb.position.set(lightX, 26, pier.z);
  lightBulb.name = 'lamp';
  group.add(lightBulb);
  const lightRoof = new THREE.Mesh(
    new THREE.ConeGeometry(2.4, 2, 10),
    lambert(0xd84040),
  );
  lightRoof.position.set(lightX, 28.6, pier.z);
  group.add(lightRoof);
  colliders.push({ minX: lightX - 3.2, maxX: lightX + 3.2, minZ: pier.z - 3.2, maxZ: pier.z + 3.2 });
  buildings.push({ x: lightX, z: pier.z, w: 6.4, d: 6.4, h: 29 });

  // Hotel Miramar tower on the beachfront (x = 260: the x = 240 road spans
  // 234-246, so the tower footprint 250-270 clears it by 4 m. It used to sit
  // at x = 250, which put its west face on the road and blocked races 0-1.)
  const hotelTower = new THREE.Mesh(
    new THREE.BoxGeometry(20, 48, 20),
    new THREE.MeshLambertMaterial({ color: 0xe8b4b8, map: facadeTex[1] }),
  );
  hotelTower.position.set(260, 24.3, 210);
  hotelTower.castShadow = true;
  hotelTower.receiveShadow = true;
  group.add(hotelTower);
  box(22, 1.6, 22, 0x6a6f75, 260, 49.1, 210);
  const hotelSign = new THREE.Mesh(
    new THREE.PlaneGeometry(18, 4.5),
    new THREE.MeshBasicMaterial({ map: makeSignTexture('HOTEL MIRAMAR', '#7a2e3a', '#ffe9c8') }),
  );
  hotelSign.position.set(260, 40, 199.8);
  hotelSign.rotation.y = Math.PI;
  group.add(hotelSign);
  colliders.push({ minX: 250, maxX: 270, minZ: 200, maxZ: 220 });
  buildings.push({ x: 260, z: 210, w: 20, d: 20, h: 48 });

  // Street props at the main intersections: traffic lights, hydrants, benches.
  const trafficLights = [];
  for (const ix of [-120, 0, 120]) {
    for (const iz of [-120, 0, 120]) {
      // Traffic light on the north-east corner of the intersection.
      const pole = new THREE.Mesh(
        new THREE.CylinderGeometry(0.12, 0.16, 5.4, 6),
        lambert(0x2c313a),
      );
      pole.position.set(ix + 7.5, 2.7, iz + 7.5);
      group.add(pole);
      const head = new THREE.Mesh(new THREE.BoxGeometry(0.8, 2, 0.8), lambert(0x1c2733));
      head.position.set(ix + 7.5, 5.9, iz + 7.5);
      group.add(head);
      const lampCols = [0xd84040, 0xf2c230, 0x37d67a];
      for (let k = 0; k < 3; k += 1) {
        const dot = new THREE.Mesh(
          new THREE.SphereGeometry(0.24, 8, 8),
          new THREE.MeshBasicMaterial({ color: lampCols[k] }),
        );
        dot.position.set(ix + 7.5, 6.55 - k * 0.62, iz + 7.96);
        dot.name = 'traffic-dot';
        group.add(dot);
        if (k === 0) trafficLights.push(dot);
      }
      // Red hydrant on the opposite corner.
      const hyd = new THREE.Mesh(
        new THREE.CylinderGeometry(0.28, 0.34, 0.9, 8),
        lambert(0xd84040),
      );
      hyd.position.set(ix - 7.5, 0.75, iz + 7.5);
      hyd.castShadow = true;
      group.add(hyd);
      const hydTop = new THREE.Mesh(new THREE.SphereGeometry(0.3, 8, 8), lambert(0xd84040));
      hydTop.position.set(ix - 7.5, 1.3, iz + 7.5);
      group.add(hydTop);
      // Bench on the south-west corner.
      box(2.4, 0.18, 0.7, 0x8a6a48, ix - 8, 0.75, iz - 7.5);
      box(2.4, 0.7, 0.14, 0x8a6a48, ix - 8, 1.15, iz - 7.85);
      box(0.14, 0.6, 0.6, 0x2c313a, ix - 9.1, 0.45, iz - 7.5);
      box(0.14, 0.6, 0.6, 0x2c313a, ix - 6.9, 0.45, iz - 7.5);
    }
  }

  // A few parked cars' worth of street furniture near the garage.
  box(2, 1.2, 1, 0xd97b6c, -142, 0.9, -84);
  box(2, 1.2, 1, 0x3f6fb5, -138, 0.9, -84);

  const city = {
    group, colliders, buildings, trafficLights,
    /** Push a circle out of every building AABB it overlaps; returns corrected {x, z}. */
    collide(x, z, r) {
      let nx = x;
      let nz = z;
      for (const c of colliders) {
        const cx = Math.max(c.minX, Math.min(nx, c.maxX));
        const cz = Math.max(c.minZ, Math.min(nz, c.maxZ));
        const dx = nx - cx;
        const dz = nz - cz;
        const d2 = dx * dx + dz * dz;
        if (d2 < r * r) {
          if (d2 > 0.0001) {
            const d = Math.sqrt(d2);
            nx = cx + (dx / d) * r;
            nz = cz + (dz / d) * r;
          } else {
            // Centre inside the box: push out along the smallest penetration.
            const pl = nx - (c.minX - r);
            const pr = (c.maxX + r) - nx;
            const pt = nz - (c.minZ - r);
            const pb = (c.maxZ + r) - nz;
            const m = Math.min(pl, pr, pt, pb);
            if (m === pl) nx = c.minX - r;
            else if (m === pr) nx = c.maxX + r;
            else if (m === pt) nz = c.minZ - r;
            else nz = c.maxZ + r;
          }
        }
      }
      return { x: nx, z: nz };
    },
    isOnRoad(x, z) {
      for (const c of CITY.roads) {
        if (Math.abs(x - c) < CITY.roadWidth / 2 + 1) return true;
        if (Math.abs(z - c) < CITY.roadWidth / 2 + 1) return true;
      }
      return false;
    },
    nearestRoadAxis(x, z) {
      let best = null;
      let bestD = Infinity;
      for (const c of CITY.roads) {
        const d = Math.abs(x - c);
        if (d < bestD) { bestD = d; best = { axis: 'x', at: c, d }; }
        const d2 = Math.abs(z - c);
        if (d2 < bestD) { bestD = d2; best = { axis: 'z', at: c, d: d2 }; }
      }
      return best;
    },
    randomRoadPoint(rngFn) {
      const vertical = rngFn() > 0.5;
      const road = CITY.roads[Math.floor(rngFn() * CITY.roads.length)];
      const along = -270 + rngFn() * 540;
      return vertical ? { x: road, z: along } : { x: along, z: road };
    },
    randomSidewalkPoint(rngFn) {
      const b = blockCentres[Math.floor(rngFn() * blockCentres.length)];
      return { x: b.x + (rngFn() - 0.5) * 44, z: b.z + (rngFn() - 0.5) * 44 };
    },
  };
  return city;
}
