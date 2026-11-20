// city.js — builds Maravilla: 600x600 m, six districts, road grid,
// landmarks, props, and spawn points. Written from the prose spec.
import * as THREE from 'three';

export const CITY_SIZE = 600;
export const HALF = 300;

// District rects (x0, z0, x1, z1) over the [-300, 300] square.
export const DISTRICT_RECTS = {
  'Marina Alba': { x0: -300, z0: -300, x1: -100, z1: 0 },
  'Centro Alba': { x0: -100, z0: -300, x1: 100, z1: 0 },
  'El Faro': { x0: 100, z0: -300, x1: 300, z1: 0 },
  'Paseo del Mar': { x0: -300, z0: 0, x1: -100, z1: 300 },
  'Estadio Sol': { x0: -100, z0: 0, x1: 100, z1: 300 },
  Miramar: { x0: 100, z0: 0, x1: 300, z1: 300 },
};

// Road centre lines (grid every 100 m) and road width.
const ROAD_LINES = [-250, -150, -50, 50, 150, 250];
const ROAD_W = 12;

// Small shop / building sign words. Signs stay modest: a narrow board on
// the facade, never a giant sign that can dominate a frame.
const SIGN_WORDS = {
  'Marina Alba': ['PESCA', 'MUELLE', 'BARCO', 'MARINA', 'CEBO'],
  'El Faro': ['FARO', 'VISTA', 'COLINA', 'TERRAZA', 'SOL'],
  'Centro Alba': ['MERCADO', 'TAPAS', 'FRUTA', 'PAN', 'CAFÉ'],
  'Paseo del Mar': ['SURF', 'PLAYA', 'OLAS', 'TABLA', 'SOL'],
  'Estadio Sol': ['ESTADIO', 'GOL', 'CLUB', 'FÚTBOL', 'SOL'],
  Miramar: ['HOTEL', 'VISTA', 'PLAYA', 'BAR', 'SUITE'],
};

const PALETTES = {
  'Marina Alba': { wall: [0xe8dcc0, 0xd9c9a3, 0xcfe0d8, 0xf0e6d2], roof: 0x8a5a3b, trim: 0x2e6f7e },
  'El Faro': { wall: [0xf2e3c6, 0xe8cfa8, 0xdfd3b8, 0xf5ead0], roof: 0xb5502e, trim: 0x7a3b1e },
  'Centro Alba': { wall: [0xf5d76e, 0xe87a5d, 0x7ec8c0, 0xf2a65a, 0xe8e0cc], roof: 0x5a4a6e, trim: 0x3d2f4e },
  'Paseo del Mar': { wall: [0xffe9c9, 0xffd9a0, 0x9fd8e8, 0xfff3d6], roof: 0x2e8b8b, trim: 0xe87a5d },
  'Estadio Sol': { wall: [0xdfe6ea, 0xc9d4da, 0xe8e0cc], roof: 0x3d6e3d, trim: 0xc0392b },
  Miramar: { wall: [0xffffff, 0xf0ead8, 0xdceef2, 0xf5e6c8], roof: 0x2c4a6e, trim: 0xc9a227 },
};

function mat(color, opts) {
  return new THREE.MeshLambertMaterial({ color, ...(opts || {}) });
}

function box(w, h, d, material, x, y, z, ry) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
  m.position.set(x, y, z);
  if (ry) m.rotation.y = ry;
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}

function cyl(rt, rb, h, seg, material, x, y, z) {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), material);
  m.position.set(x, y, z);
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}

// Tiny canvas-texture sign, reused per word so we only make a handful.
const signCache = new Map();
function signTexture(word, bg, fg) {
  const key = word + '|' + bg + '|' + fg;
  if (signCache.has(key)) return signCache.get(key);
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 64;
  const g = c.getContext('2d');
  g.fillStyle = bg;
  g.fillRect(0, 0, 256, 64);
  g.fillStyle = fg;
  g.font = 'bold 34px sans-serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText(word, 128, 34);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  signCache.set(key, tex);
  return tex;
}

function makeSign(word, district) {
  const pal = PALETTES[district];
  const tex = signTexture(word, '#' + pal.trim.toString(16).padStart(6, '0'), '#ffffff');
  const m = new THREE.Mesh(
    new THREE.PlaneGeometry(2.4, 0.6),
    new THREE.MeshBasicMaterial({ map: tex })
  );
  return m;
}

function districtAt(x, z) {
  for (const name of Object.keys(DISTRICT_RECTS)) {
    const r = DISTRICT_RECTS[name];
    if (x >= r.x0 && x < r.x1 && z >= r.z0 && z < r.z1) return name;
  }
  return 'Centro Alba';
}

function onRoad(x, z) {
  for (const line of ROAD_LINES) {
    if (Math.abs(x - line) < ROAD_W / 2 + 2) return true;
    if (Math.abs(z - line) < ROAD_W / 2 + 2) return true;
  }
  return false;
}

export function buildCity(scene, rng) {
  const group = new THREE.Group();
  group.name = 'city';
  scene.add(group);

  const buildings = [];
  const landmarks = {};
  const colliders = [];
  const districts = Object.keys(DISTRICT_RECTS).map((name) => ({
    name,
    rect: DISTRICT_RECTS[name],
  }));

  // --- Ground: warm sand base, grass-green centre, beach strip south ---
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(CITY_SIZE, CITY_SIZE),
    mat(0xc9b285)
  );
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  group.add(ground);

  const lawn = new THREE.Mesh(
    new THREE.PlaneGeometry(420, 420),
    mat(0x7fae62)
  );
  lawn.rotation.x = -Math.PI / 2;
  lawn.position.y = 0.05;
  lawn.receiveShadow = true;
  group.add(lawn);

  // Beach: pale sand band along the south edge (Paseo del Mar / Miramar).
  const beach = new THREE.Mesh(
    new THREE.PlaneGeometry(600, 42),
    mat(0xf2e2b8)
  );
  beach.rotation.x = -Math.PI / 2;
  beach.position.set(0, 0.08, 279);
  beach.receiveShadow = true;
  group.add(beach);

  // Harbour water: blue strip along the west edge (Marina Alba).
  const water = new THREE.Mesh(
    new THREE.PlaneGeometry(46, 600),
    new THREE.MeshLambertMaterial({ color: 0x2e7f9e })
  );
  water.rotation.x = -Math.PI / 2;
  water.position.set(-277, 0.1, 0);
  water.receiveShadow = true;
  group.add(water);

  // --- Roads: dark asphalt planes on the grid + pale centre dashes ---
  const roadMat = mat(0x3a3a40);
  const dashMat = mat(0xe8e4d8);
  for (const line of ROAD_LINES) {
    const ns = new THREE.Mesh(new THREE.PlaneGeometry(ROAD_W, CITY_SIZE), roadMat);
    ns.rotation.x = -Math.PI / 2;
    ns.position.set(line, 0.12, 0);
    ns.receiveShadow = true;
    group.add(ns);
    const ew = new THREE.Mesh(new THREE.PlaneGeometry(CITY_SIZE, ROAD_W), roadMat);
    ew.rotation.x = -Math.PI / 2;
    ew.position.set(0, 0.12, line);
    ew.receiveShadow = true;
    group.add(ew);
    for (let d = -280; d <= 280; d += 20) {
      if (Math.abs(d - line) < 14) continue;
      const dash = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 4), dashMat);
      dash.rotation.x = -Math.PI / 2;
      dash.position.set(line, 0.15, d);
      group.add(dash);
      const dash2 = new THREE.Mesh(new THREE.PlaneGeometry(4, 1.2), dashMat);
      dash2.rotation.x = -Math.PI / 2;
      dash2.position.set(d, 0.15, line);
      group.add(dash2);
    }
  }

  // --- Buildings: one or two per block, district palettes and roofs ---
  const blockCentres = [];
  for (let gx = -2; gx <= 2; gx++) {
    for (let gz = -2; gz <= 2; gz++) {
      blockCentres.push({ x: gx * 100, z: gz * 100 });
    }
  }
  const wallMats = {};
  function wallMat(district, shade) {
    const key = district + shade;
    if (!wallMats[key]) {
      const pal = PALETTES[district];
      wallMats[key] = mat(pal.wall[shade % pal.wall.length]);
    }
    return wallMats[key];
  }

  let bIndex = 0;
  for (const block of blockCentres) {
    const district = districtAt(block.x, block.z);
    const pal = PALETTES[district];
    const count = 1 + rng.int(0, 1);
    for (let i = 0; i < count; i++) {
      const ox = rng.range(-26, 26);
      const oz = rng.range(-26, 26);
      const x = block.x + ox;
      const z = block.z + oz;
      if (onRoad(x, z)) continue;
      // Keep the landmark plots clear.
      if (Math.abs(x - 0) < 40 && Math.abs(z - 190) < 40) continue;
      if (Math.abs(x - 230) < 45 && Math.abs(z + 230) < 45) continue;
      if (Math.abs(x - 220) < 40 && Math.abs(z - 220) < 40) continue;
      if (Math.abs(x + 230) < 40 && Math.abs(z + 200) < 40) continue;

      const tall = district === 'Miramar' && rng.next() < 0.5;
      const w = rng.range(12, 22);
      const d = rng.range(12, 20);
      const h = tall ? rng.range(28, 46) : rng.range(7, 18);
      const b = box(w, h, d, wallMat(district, bIndex), x, h / 2, z, rng.next() < 0.5 ? 0 : 0);
      group.add(b);
      // Roof: terracotta pyramid in El Faro, flat slab elsewhere.
      if (district === 'El Faro') {
        const roof = new THREE.Mesh(
          new THREE.ConeGeometry(Math.max(w, d) * 0.72, 4.5, 4),
          mat(pal.roof)
        );
        roof.position.set(x, h + 2.2, z);
        roof.rotation.y = Math.PI / 4;
        roof.castShadow = true;
        group.add(roof);
      } else {
        const slab = box(w + 0.8, 0.7, d + 0.8, mat(pal.roof), x, h + 0.35, z);
        group.add(slab);
      }
      // Windows: a few dark inset planes on the street face.
      const winMat = mat(0x2c3e50);
      const floors = Math.max(1, Math.floor(h / 5));
      for (let f = 0; f < floors; f++) {
        for (let s = -1; s <= 1; s++) {
          const win = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 2.0), winMat);
          win.position.set(x + s * (w / 3.2), 3 + f * 5, z + d / 2 + 0.06);
          group.add(win);
        }
      }
      // Small name sign on the facade — narrow board, never huge.
      const words = SIGN_WORDS[district];
      const sign = makeSign(words[bIndex % words.length], district);
      sign.position.set(x, Math.min(h - 1.2, 6.5), z + d / 2 + 0.12);
      group.add(sign);

      buildings.push({ x, z, w, h, d, district, mesh: b });
      colliders.push({ x, z, hx: w / 2 + 0.5, hz: d / 2 + 0.5 });
      bIndex++;
    }
  }

  // --- Landmark: Faro de Maravilla lighthouse (El Faro, NE hill) ---
  const lightGroup = new THREE.Group();
  lightGroup.position.set(230, 0, -230);
  const tower = cyl(4.5, 6, 42, 12, mat(0xf5ead0), 0, 21, 0);
  lightGroup.add(tower);
  const band = cyl(4.7, 4.7, 3, 12, mat(0xc0392b), 0, 30, 0);
  lightGroup.add(band);
  const lampRoom = cyl(3.4, 3.4, 5, 12, mat(0x2c3e50), 0, 44, 0);
  lightGroup.add(lampRoom);
  const lamp = new THREE.Mesh(
    new THREE.SphereGeometry(2.2, 12, 10),
    new THREE.MeshBasicMaterial({ color: 0xffe9a8 })
  );
  lamp.position.set(0, 44, 0);
  lightGroup.add(lamp);
  const beam = new THREE.Mesh(
    new THREE.ConeGeometry(9, 60, 12, 1, true),
    new THREE.MeshBasicMaterial({
      color: 0xffe9a8, transparent: true, opacity: 0.14, side: THREE.DoubleSide,
    })
  );
  beam.rotation.z = Math.PI / 2;
  beam.position.set(32, 44, 0);
  lightGroup.add(beam);
  group.add(lightGroup);
  landmarks.lighthouse = { name: 'Faro de Maravilla', x: 230, z: -230, mesh: lightGroup };
  colliders.push({ x: 230, z: -230, hx: 7, hz: 7 });

  // --- Landmark: Estadio Sol stadium (Estadio Sol, centre-south) ---
  const stadGroup = new THREE.Group();
  stadGroup.position.set(0, 0, 190);
  const bowl = cyl(42, 46, 16, 24, mat(0xdfe6ea), 0, 8, 0);
  stadGroup.add(bowl);
  const rim = cyl(43, 43, 2, 24, mat(0xc0392b), 0, 16.5, 0);
  stadGroup.add(rim);
  const pitch = new THREE.Mesh(
    new THREE.CylinderGeometry(32, 32, 1, 24),
    mat(0x3d8b4f)
  );
  pitch.position.set(0, 1.2, 0);
  pitch.receiveShadow = true;
  stadGroup.add(pitch);
  // Stadium flags ringing the bowl.
  for (let i = 0; i < 10; i++) {
    const ang = (i / 10) * Math.PI * 2;
    const fx = Math.cos(ang) * 46;
    const fz = Math.sin(ang) * 46;
    const pole = cyl(0.15, 0.15, 9, 6, mat(0xeeeeee), fx, 21, fz);
    stadGroup.add(pole);
    const flag = new THREE.Mesh(
      new THREE.PlaneGeometry(3.4, 2),
      mat(i % 2 ? 0xc0392b : 0xffffff, { side: THREE.DoubleSide })
    );
    flag.position.set(fx + 1.7, 24, fz);
    stadGroup.add(flag);
  }
  group.add(stadGroup);
  landmarks.stadium = { name: 'Estadio Sol', x: 0, z: 190, mesh: stadGroup };
  colliders.push({ x: 0, z: 190, hx: 46, hz: 46 });

  // --- Landmark: Hotel Miramar (tall, Miramar SE) ---
  const hotel = new THREE.Group();
  hotel.position.set(220, 0, 220);
  const hMain = box(26, 52, 18, mat(0xffffff), 0, 26, 0);
  hotel.add(hMain);
  const hTop = box(20, 4, 14, mat(0x2c4a6e), 0, 54, 0);
  hotel.add(hTop);
  for (let f = 0; f < 8; f++) {
    for (let s = -2; s <= 2; s++) {
      const win = new THREE.Mesh(
        new THREE.PlaneGeometry(2, 2.4),
        mat(0x9fd4e8)
      );
      win.position.set(s * 4.4, 6 + f * 5.6, 9.1);
      hotel.add(win);
    }
  }
  const hSign = makeSign('HOTEL', 'Miramar');
  hSign.position.set(0, 48, 9.2);
  hotel.add(hSign);
  group.add(hotel);
  landmarks.hotel = { name: 'Hotel Miramar', x: 220, z: 220, mesh: hotel };
  colliders.push({ x: 220, z: 220, hx: 14, hz: 10 });

  // --- Landmark: Banco Alba (Centro Alba, colonnaded bank) ---
  const bank = new THREE.Group();
  bank.position.set(-30, 0, -60);
  const bMain = box(30, 14, 20, mat(0xe8e0cc), 0, 7, 0);
  bank.add(bMain);
  for (let i = -2; i <= 2; i++) {
    bank.add(cyl(1, 1, 12, 8, mat(0xf5f0dc), i * 5.5, 6, 11));
  }
  const bSign = makeSign('BANCO', 'Centro Alba');
  bSign.position.set(0, 12.5, 10.2);
  bank.add(bSign);
  group.add(bank);
  landmarks.bank = { name: 'Banco Alba', x: -30, z: -60, mesh: bank };
  colliders.push({ x: -30, z: -60, hx: 16, hz: 11 });

  // --- Landmark: the pier (west edge, out over the harbour water) ---
  const pier = new THREE.Group();
  pier.position.set(-272, 0, 40);
  for (let i = 0; i < 12; i++) {
    pier.add(box(3, 0.6, 34, mat(0x8a6a4a), -i * 3.4, 1.6, 0));
  }
  for (let i = 0; i < 4; i++) {
    pier.add(cyl(0.5, 0.5, 4, 6, mat(0x6a4a2e), -i * 10, 0, 15));
    pier.add(cyl(0.5, 0.5, 4, 6, mat(0x6a4a2e), -i * 10, 0, -15));
  }
  group.add(pier);
  landmarks.pier = { name: 'The Pier', x: -272, z: 40, mesh: pier };

  // --- Marina Alba stilt houses + boats ---
  for (let i = 0; i < 5; i++) {
    const sx = -258 + i * 2;
    const sz = -180 + i * 55;
    const hut = new THREE.Group();
    hut.position.set(sx, 0, sz);
    hut.add(box(9, 5, 8, mat(0xd9c9a3), 0, 5, 0));
    const hutRoof = new THREE.Mesh(
      new THREE.ConeGeometry(7, 3.5, 4),
      mat(0x8a5a3b)
    );
    hutRoof.position.set(0, 9, 0);
    hutRoof.rotation.y = Math.PI / 4;
    hutRoof.castShadow = true;
    hut.add(hutRoof);
    for (const [px, pz] of [[-3.5, -3], [3.5, -3], [-3.5, 3], [3.5, 3]]) {
      hut.add(cyl(0.35, 0.35, 4, 6, mat(0x6a4a2e), px, 2, pz));
    }
    group.add(hut);
    buildings.push({ x: sx, z: sz, w: 9, h: 9, d: 8, district: 'Marina Alba', mesh: hut });
  }
  for (let i = 0; i < 4; i++) {
    const bx = -282 + rng.range(-3, 3);
    const bz = -140 + i * 90;
    const boat = new THREE.Group();
    boat.position.set(bx, 0.6, bz);
    boat.rotation.y = rng.range(-0.4, 0.4);
    const hull = box(4, 1.6, 12, mat(0xe8e0cc), 0, 0.8, 0);
    boat.add(hull);
    boat.add(cyl(0.18, 0.18, 9, 6, mat(0x6a4a2e), 0, 5, 0));
    const sail = new THREE.Mesh(
      new THREE.PlaneGeometry(4.5, 6),
      mat(0xffffff, { side: THREE.DoubleSide })
    );
    sail.position.set(2.2, 6, 0);
    boat.add(sail);
    group.add(boat);
  }

  // --- Centro Alba night-market stalls ---
  const market = new THREE.Group();
  market.position.set(10, 0, -150);
  for (let i = 0; i < 12; i++) {
    const stall = new THREE.Group();
    const sx = (i % 4) * 12 - 18;
    const sz = Math.floor(i / 4) * 12 - 6;
    stall.position.set(sx, 0, sz);
    stall.add(box(7, 1, 5, mat(0x8a6a4a), 0, 1, 0));
    const awning = new THREE.Mesh(
      new THREE.PlaneGeometry(8, 6),
      mat(i % 2 ? 0xe87a5d : 0xf5d76e, { side: THREE.DoubleSide })
    );
    awning.rotation.x = -0.5;
    awning.position.set(0, 3.4, 0);
    awning.castShadow = true;
    stall.add(awning);
    for (const [px, pz] of [[-3.4, -2.4], [3.4, -2.4], [-3.4, 2.4], [3.4, 2.4]]) {
      stall.add(cyl(0.12, 0.12, 3, 6, mat(0x6a4a2e), px, 1.5, pz));
    }
    market.add(stall);
  }
  group.add(market);
  landmarks.market = { name: 'Centro Alba Night Market', x: 10, z: -150, mesh: market };

  // --- Paseo del Mar surfboards + beach umbrellas ---
  for (let i = 0; i < 7; i++) {
    const bx = -240 + i * 40 + rng.range(-8, 8);
    const bz = 268 + rng.range(-4, 6);
    const board = new THREE.Mesh(
      new THREE.CapsuleGeometry(0.7, 2.6, 4, 8),
      mat([0xe87a5d, 0x7ec8c0, 0xf5d76e, 0x2e8b8b][i % 4])
    );
    board.rotation.z = Math.PI / 2 - 0.35;
    board.rotation.y = rng.range(0, 1);
    board.position.set(bx, 0.9, bz);
    board.castShadow = true;
    group.add(board);
  }
  for (let i = 0; i < 7; i++) {
    const ux = -260 + i * 55;
    const uz = 282;
    group.add(cyl(0.12, 0.12, 4, 6, mat(0xeeeeee), ux, 2, uz));
    const shade = new THREE.Mesh(
      new THREE.ConeGeometry(4, 1.6, 8),
      mat(i % 2 ? 0xe87a5d : 0xffffff)
    );
    shade.position.set(ux, 4.4, uz);
    shade.castShadow = true;
    group.add(shade);
  }

  // --- Palms along the avenues ---
  const palmSpots = [];
  for (let gx = -2; gx <= 2; gx++) {
    for (const line of [-150, 50, 250]) {
      palmSpots.push({ x: gx * 100 + 8, z: line });
      palmSpots.push({ x: gx * 100 - 8, z: -line });
    }
  }
  for (const spot of palmSpots) {
    if (onRoad(spot.x, spot.z)) continue;
    const palm = new THREE.Group();
    palm.position.set(spot.x, 0, spot.z);
    const trunk = cyl(0.35, 0.55, 7, 7, mat(0x8a6a4a), 0, 3.5, 0);
    trunk.rotation.z = rng.range(-0.08, 0.08);
    palm.add(trunk);
    for (let f = 0; f < 6; f++) {
      const frond = new THREE.Mesh(
        new THREE.PlaneGeometry(1.1, 4.4),
        mat(0x3d8b4f, { side: THREE.DoubleSide })
      );
      const ang = (f / 6) * Math.PI * 2;
      frond.position.set(Math.cos(ang) * 1.6, 7.4, Math.sin(ang) * 1.6);
      frond.rotation.set(Math.sin(ang) * 1.1, 0, -Math.cos(ang) * 1.1);
      palm.add(frond);
    }
    group.add(palm);
  }

  const spawnPoints = {
    garage: { x: 30, z: 120, heading: Math.PI },
    lockup: { x: -230, z: -180, heading: 0 },
    pier: { x: -268, z: 40, heading: Math.PI / 2 },
    stadium: { x: 0, z: 130, heading: Math.PI },
    safehouse: { x: 180, z: -180, heading: 0 },
    hospital: { x: 200, z: 200, heading: Math.PI },
    playerStart: { x: 30, z: 110, heading: Math.PI },
  };

  return {
    scene,
    group,
    districts,
    buildings,
    landmarks,
    colliders,
    roadColliders: colliders,
    spawnPoints,
    districtAt,
  };
}
