// main.js — boot and game loop for MARAVILLA.
// Wires the 23 modules into a playable game: state, RNG, bus, input,
// renderer, city, traffic, driving, player, police, weapons, districts,
// garage, phone, audio, missions, side activities, saves, pause menu,
// portraits and HUD. Fixed-timestep updates, a chase camera with mouse
// orbit and wheel zoom, a title screen until Enter, pause on P/Esc, and
// staged screenshot scenes through ?shot=.

import * as THREE from 'three';
import { CONFIG } from './config.js';
import { createRng } from './random.js';
import { createBus } from './events.js';
import { createGameState } from './state.js';
import { createInput } from './input.js';
import { createRenderer } from './render.js';
import { buildCity } from './city.js';
import {
  createCar,
  VEHICLE_DEFS,
  spawnParkedCars,
  updateVehicles,
  damageCar,
} from './vehicles.js';
import { createTraffic } from './traffic.js';
import { createDriving } from './driving.js';
import { createPlayer } from './player.js';
import { createPolice } from './police.js';
import { createWeapons } from './weapons.js';
import { createDistricts } from './districts.js';
import { createGarage } from './garage.js';
import { createPhone } from './phone.js';
import { createAudio } from './audio.js';
import { createMissions, MISSIONS, PLACES } from './missions.js';
import { createSide, GECKOS, STUNT_JUMPS } from './side.js';
import { saveSlot, loadSlot, recordScore } from './save.js';
import { createPause } from './pause.js';
import { createHud } from './hud.js';
import { stageShot } from './shots.js';

const STEP = 1 / 60;
const DEFAULT_SEED = 20261120;

function $(id) {
  return document.getElementById(id);
}

function clamp(v, lo, hi) {
  return v < lo ? lo : v > hi ? hi : v;
}

function dist2d(ax, az, bx, bz) {
  const dx = ax - bx;
  const dz = az - bz;
  return Math.sqrt(dx * dx + dz * dz);
}

function lam(color) {
  return new THREE.MeshLambertMaterial({ color });
}

// A simple police car mesh: dark body, white doors, red/blue light bar.
function makePoliceCarMesh() {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.72, 4.1), lam(0x1a2a4a));
  body.position.y = 0.62;
  body.castShadow = true;
  g.add(body);
  const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.55, 0.6, 2.0), lam(0xe8e8e8));
  cabin.position.set(0, 1.25, -0.2);
  cabin.castShadow = true;
  g.add(cabin);
  const barBase = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.12, 0.4), lam(0x111111));
  barBase.position.set(0, 1.62, -0.2);
  g.add(barBase);
  const red = new THREE.Mesh(
    new THREE.BoxGeometry(0.5, 0.16, 0.34),
    new THREE.MeshBasicMaterial({ color: 0xff2d2d })
  );
  red.position.set(-0.32, 1.7, -0.2);
  g.add(red);
  const blue = new THREE.Mesh(
    new THREE.BoxGeometry(0.5, 0.16, 0.34),
    new THREE.MeshBasicMaterial({ color: 0x2d6bff })
  );
  blue.position.set(0.32, 1.7, -0.2);
  g.add(blue);
  const wheelGeo = new THREE.CylinderGeometry(0.36, 0.36, 0.28, 12);
  const wheelMat = lam(0x1a1a1a);
  for (const [x, z] of [[-0.95, 1.25], [0.95, 1.25], [-0.95, -1.25], [0.95, -1.25]]) {
    const w = new THREE.Mesh(wheelGeo, wheelMat);
    w.rotation.z = Math.PI / 2;
    w.position.set(x, 0.36, z);
    g.add(w);
  }
  return g;
}

function makeFootCopMesh() {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.38, 1.05, 8), lam(0x1a2a4a));
  body.position.y = 0.95;
  body.castShadow = true;
  g.add(body);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.26, 10, 8), lam(0xe8b88a));
  head.position.y = 1.75;
  g.add(head);
  const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.28, 0.12, 10), lam(0x0d1526));
  cap.position.y = 1.95;
  g.add(cap);
  return g;
}

function makeRoadblockMesh() {
  const g = new THREE.Group();
  for (let i = 0; i < 2; i++) {
    const barrier = new THREE.Mesh(new THREE.BoxGeometry(3.4, 0.9, 0.5), lam(i === 0 ? 0xe87a2d : 0xf2f2f2));
    barrier.position.set(0, 0.75, i * 2.4 - 1.2);
    barrier.castShadow = true;
    g.add(barrier);
    for (const x of [-1.5, 1.5]) {
      const leg = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.8, 0.18), lam(0x333333));
      leg.position.set(x, 0.4, i * 2.4 - 1.2);
      g.add(leg);
    }
  }
  const car = makePoliceCarMesh();
  car.position.set(0, 0, 4.5);
  g.add(car);
  return g;
}

function makeHeliMesh() {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.BoxGeometry(2.2, 1.1, 4.6), lam(0x22344e));
  body.castShadow = true;
  g.add(body);
  const glass = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.7, 1.4), lam(0x9fd4e8));
  glass.position.set(0, 0.2, 1.8);
  g.add(glass);
  const tail = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.5, 3.4), lam(0x22344e));
  tail.position.set(0, 0.2, -3.6);
  g.add(tail);
  const rotor = new THREE.Mesh(new THREE.BoxGeometry(9.5, 0.08, 0.5), lam(0x111111));
  rotor.position.y = 0.85;
  g.add(rotor);
  const lamp = new THREE.Mesh(
    new THREE.SphereGeometry(0.35, 8, 6),
    new THREE.MeshBasicMaterial({ color: 0xffe9a8 })
  );
  lamp.position.set(0, -0.7, 1.5);
  g.add(lamp);
  g.userData.rotor = rotor;
  return g;
}

export function boot() {
  const params = new URLSearchParams(window.location.search);
  const seedParam = parseInt(params.get('seed') || '', 10);
  const seed = Number.isFinite(seedParam) ? seedParam : DEFAULT_SEED;
  const shotParam = params.get('shot') || null;

  const canvas = $('game-canvas');
  const state = createGameState();
  const rng = createRng(seed);
  state.rng = rng;
  const bus = createBus();
  const input = createInput();
  input.attach(window);

  // --- World -------------------------------------------------------------
  const renderer = createRenderer(canvas);
  const scene = renderer.scene;
  const city = buildCity(scene, rng);
  city.bus = bus;
  state.spawnPoints = city.spawnPoints;
  state.player.x = city.spawnPoints.playerStart.x;
  state.player.z = city.spawnPoints.playerStart.z;
  state.player.heading = city.spawnPoints.playerStart.heading;

  const parked = spawnParkedCars(city, rng);
  const traffic = createTraffic(city, rng);
  const allCars = [...parked, ...traffic.cars];

  // Mission 1's sedan, waiting in the Marina Alba lockup.
  const lockupSedan = createCar(VEHICLE_DEFS[0], 0xc0392b);
  lockupSedan.x = PLACES.lockup.x;
  lockupSedan.z = PLACES.lockup.z;
  lockupSedan.heading = Math.PI / 2;
  lockupSedan.group.position.set(lockupSedan.x, 0, lockupSedan.z);
  lockupSedan.group.rotation.y = lockupSedan.heading;
  scene.add(lockupSedan.group);
  allCars.push(lockupSedan);

  // A motorbike and a sports car parked by the player start. The random
  // parked spawns skip bikes and sports, so without these two neither
  // kind would exist anywhere in the world.
  const starterBike = createCar(VEHICLE_DEFS.find((d) => d.id === 'picuda'), 0x2c3e50);
  starterBike.x = 34;
  starterBike.z = 106;
  starterBike.heading = Math.PI / 2;
  starterBike.group.position.set(starterBike.x, 0, starterBike.z);
  starterBike.group.rotation.y = starterBike.heading;
  scene.add(starterBike.group);
  allCars.push(starterBike);
  const starterSports = createCar(VEHICLE_DEFS.find((d) => d.id === 'tormenta'), 0xf1c40f);
  starterSports.x = 26;
  starterSports.z = 106;
  starterSports.heading = Math.PI / 2;
  starterSports.group.position.set(starterSports.x, 0, starterSports.z);
  starterSports.group.rotation.y = starterSports.heading;
  scene.add(starterSports.group);
  allCars.push(starterSports);

  const world = {
    scene,
    city,
    cars: allCars,
    pickups: [],
    getCameraYaw: () => renderer.getYaw(),
  };
  const vehCtx = { scene, bus, cars: allCars };

  // --- Modules -------------------------------------------------------------
  const driving = createDriving(state, bus, input, world);
  const player = createPlayer(state, bus, input, world);
  const police = createPolice(state, bus);
  const weapons = createWeapons(state, bus);
  const districts = createDistricts(state, bus);
  const garage = createGarage(state, bus);
  const phone = createPhone(state, bus);
  const audio = createAudio(state, bus);
  const missions = createMissions(state, bus);
  const side = createSide(state, bus);
  const pauseMenu = createPause(state, bus);
  const hud = createHud(state, bus);

  // --- Scene dressing: geckos, stunt ramps, pickups, objective marker ----
  const geckoMeshes = new Map();
  const geckoGeo = new THREE.SphereGeometry(0.5, 10, 8);
  const geckoMat = new THREE.MeshBasicMaterial({ color: 0xffd23a });
  for (const g of GECKOS) {
    if (state.collectibles.geckosFound.includes(g.id)) continue;
    const m = new THREE.Mesh(geckoGeo, geckoMat);
    m.position.set(g.x, 1.1, g.z);
    scene.add(m);
    geckoMeshes.set(g.id, m);
  }

  const rampMat = lam(0xe87a2d);
  for (const j of STUNT_JUMPS) {
    const ramp = new THREE.Mesh(new THREE.BoxGeometry(6, 0.6, 4), rampMat);
    ramp.position.set(j.ramp.x, 0.8, j.ramp.z);
    ramp.rotation.z = -0.35;
    ramp.rotation.y = Math.atan2(j.land.x - j.ramp.x, j.land.z - j.ramp.z);
    ramp.castShadow = true;
    scene.add(ramp);
  }

  // Weapon pickups: a few health packs and ammo boxes around the city.
  weapons.seedPickups([
    { kind: 'health', x: 200, z: 200 },
    { kind: 'health', x: 20, z: 40 },
    { kind: 'health', x: -260, z: -40 },
    { kind: 'health', x: 0, z: 190 },
    { kind: 'ammo', x: -250, z: 200 },
    { kind: 'ammo', x: 30, z: 120 },
    { kind: 'ammo', x: 60, z: -120 },
    { kind: 'ammo', x: 220, z: 180 },
  ]);
  const pickupMeshes = new Map();
  function pickupMeshFor(pk) {
    const g = new THREE.Group();
    if (pk.kind === 'health') {
      const boxM = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.7, 1.1), lam(0x2fae5a));
      boxM.position.y = 0.5;
      g.add(boxM);
      const cross1 = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.18, 0.18), lam(0xffffff));
      cross1.position.y = 0.9;
      g.add(cross1);
      const cross2 = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.7, 0.18), lam(0xffffff));
      cross2.position.y = 0.9;
      g.add(cross2);
    } else {
      const boxM = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.7, 1.1), lam(0xf2b13c));
      boxM.position.y = 0.5;
      g.add(boxM);
      const lid = new THREE.Mesh(new THREE.BoxGeometry(1.15, 0.16, 1.15), lam(0x8a6a1a));
      lid.position.y = 0.9;
      g.add(lid);
    }
    g.position.set(pk.x, 0, pk.z);
    return g;
  }
  function syncPickupMeshes() {
    const live = new Map();
    for (const pk of weapons.getPickups()) {
      live.set(pk.id, pk);
      if (!pickupMeshes.has(pk.id)) {
        const m = pickupMeshFor(pk);
        scene.add(m);
        pickupMeshes.set(pk.id, m);
      }
    }
    for (const [id, m] of pickupMeshes) {
      if (!live.has(id)) {
        scene.remove(m);
        pickupMeshes.delete(id);
      }
    }
  }

  // Objective marker: a floating diamond over the current target.
  const marker = new THREE.Mesh(
    new THREE.OctahedronGeometry(1.1),
    new THREE.MeshBasicMaterial({ color: 0xffd23a })
  );
  const markerRing = new THREE.Mesh(
    new THREE.RingGeometry(2.2, 3.0, 24),
    new THREE.MeshBasicMaterial({ color: 0xffd23a, side: THREE.DoubleSide })
  );
  markerRing.rotation.x = -Math.PI / 2;
  scene.add(marker);
  scene.add(markerRing);

  // Police unit meshes, synced from the police module's unit list.
  const policeMeshes = new Map();
  function syncPoliceMeshes(time) {
    const units = police.getUnits();
    const seen = new Set();
    const p = state.player;
    for (const u of units) {
      seen.add(u.id);
      let mesh = policeMeshes.get(u.id);
      if (!mesh) {
        if (u.type === 'foot') mesh = makeFootCopMesh();
        else if (u.type === 'roadblock') mesh = makeRoadblockMesh();
        else if (u.type === 'heli') mesh = makeHeliMesh();
        else mesh = makePoliceCarMesh();
        scene.add(mesh);
        policeMeshes.set(u.id, mesh);
      }
      mesh.position.set(u.x, u.y || 0, u.z);
      if (u.type === 'heli') {
        mesh.position.y = 46 + Math.sin(time * 1.3) * 1.5;
        if (mesh.userData.rotor) mesh.userData.rotor.rotation.y += 0.55;
        mesh.rotation.y = Math.atan2(p.x - u.x, p.z - u.z);
      } else if (u.type === 'roadblock') {
        mesh.rotation.y = Math.atan2(p.x - u.x, p.z - u.z);
      } else {
        mesh.rotation.y = Math.atan2(p.x - u.x, p.z - u.z);
      }
    }
    for (const [id, mesh] of policeMeshes) {
      if (!seen.has(id)) {
        scene.remove(mesh);
        policeMeshes.delete(id);
      }
    }
  }

  // --- Cross-module glue on the bus ---------------------------------------
  bus.on('vehicle-damaged', (d) => {
    if (d && typeof d.amount === 'number') driving.damageRide(d.amount);
  });
  bus.on('player-hurt', (d) => {
    if (d && typeof d.amount === 'number') player.takeDamage(d.amount, d.source || 'police');
  });
  bus.on('busted', () => {
    police.clearHeat(100);
    state.player.money = Math.max(0, (state.player.money || 0) - 100);
    bus.emit('message', { text: 'Busted — El Gato let you off with a $100 fine. The heat is off... for now.' });
  });
  bus.on('player-died', () => missions.onPlayerDeath());
  bus.on('vehicle-destroyed', (d) => {
    const car = d && allCars.find((c) => c.id === d.id);
    if (car) damageCar(car, 100, vehCtx);
  });
  bus.on('explosion', (d) => {
    if (!d) return;
    for (const car of allCars) {
      if (car.exploded) continue;
      if (dist2d(car.x, car.z, d.x, d.z) <= (d.radius || 9) + 2.5) {
        damageCar(car, d.damage || 60, vehCtx);
      }
    }
    const p = state.player;
    if (dist2d(p.x, p.z, d.x, d.z) <= (d.radius || 9)) {
      player.takeDamage(Math.round((d.damage || 60) * 0.5), 'explosion');
    }
  });
  bus.on('entered-car', (d) => {
    if (d && d.car) garage.addOwnedCar(d.car.id, d.car.def.name);
  });
  bus.on('car-taken-out', (d) => {
    const car = d && allCars.find((c) => c.id === d.carId);
    if (!car || car.exploded) {
      bus.emit('message', { text: 'That car is not on the street right now.' });
      return;
    }
    const g = city.spawnPoints.garage;
    car.x = g.x + 6;
    car.z = g.z + 6;
    car.heading = g.heading || 0;
    car.speed = 0;
    car.group.position.set(car.x, 0, car.z);
    car.group.rotation.y = car.heading;
    driving.enterCar(car);
  });
  bus.on('gecko:found', (d) => {
    if (!d) return;
    const m = geckoMeshes.get(d.id);
    if (m) {
      scene.remove(m);
      geckoMeshes.delete(d.id);
    }
  });
  bus.on('save:autosave', (d) => {
    saveSlot((d && d.slot) || 1, state);
  });
  bus.on('save:loaded', () => {
    state.rng = rng;
    driving.reset();
    state.player.onFoot = true;
    state.player.currentCar = null;
    missions.syncFromState();
  });
  bus.on('mission:complete', (d) => {
    if (d && d.id === 10) {
      recordScore(state, 'Rook');
      const end = $('end-screen');
      if (end) {
        end.style.display = 'flex';
        const stats = $('end-stats');
        if (stats) {
          stats.textContent =
            `All 10 missions done. Rank ${state.stats.rank} — ${state.stats.rp} RP — ` +
            `$${state.player.money} on hand — ${state.collectibles.geckosFound.length}/20 Golden Geckos. ` +
            `Maravilla is yours, Leyenda.`;
        }
      }
    }
  });

  // --- Phone / garage / wheel panels --------------------------------------
  let phoneSig = '';
  function renderPhonePanel() {
    const panel = $('phone-panel');
    if (!panel) return;
    if (!phone.isOpen()) {
      if (panel.style.display !== 'none') panel.style.display = 'none';
      phoneSig = '';
      return;
    }
    const abilities = phone.getAbilities();
    const sig = JSON.stringify(abilities);
    if (sig === phoneSig && panel.style.display === 'block') return;
    phoneSig = sig;
    panel.style.display = 'block';
    panel.innerHTML = '<h3>PHONE — CREW</h3>';
    for (const a of abilities) {
      const row = document.createElement('div');
      row.className = 'phone-row';
      const ready = a.cooldownLeft <= 0;
      row.innerHTML =
        `<strong>${a.name}</strong> <span>${a.role} — ${a.ability}</span> ` +
        `<span>${a.cost ? '$' + a.cost : 'Free'}</span> ` +
        `<span>${ready ? 'Ready' : 'Busy ' + a.cooldownLeft + 's'}</span> ` +
        `<span class="phone-key">[${a.keyLabel}]</span>`;
      const btn = document.createElement('button');
      btn.textContent = ready ? 'Call' : 'Busy';
      btn.disabled = !ready;
      btn.addEventListener('click', () => phone.call(a.id));
      row.appendChild(btn);
      panel.appendChild(row);
    }
    const hint = document.createElement('p');
    hint.className = 'muted';
    hint.textContent = 'F closes the phone. Quick-call keys Z / X / V / B work anywhere.';
    panel.appendChild(hint);
  }

  let garageSig = '';
  function renderGaragePanel() {
    const panel = $('garage-panel');
    if (!panel) return;
    if (!garage.isOpen()) {
      if (panel.style.display !== 'none') panel.style.display = 'none';
      garageSig = '';
      return;
    }
    const data = garage.panelData();
    const sig = JSON.stringify(data);
    if (sig === garageSig && panel.style.display === 'block') return;
    garageSig = sig;
    panel.style.display = 'block';
    panel.innerHTML = '<h3>CELIA\u2019S GARAGE</h3>';
    if (data.cars.length === 0) {
      const p = document.createElement('p');
      p.textContent = 'No cars in the garage yet — steal one and drive it here. (Press E next to any car.)';
      panel.appendChild(p);
    }
    for (const c of data.cars) {
      const card = document.createElement('div');
      card.className = 'garage-car';
      const up = c.upgrades;
      card.innerHTML =
        `<strong>${c.name}</strong> <span>Engine ${up.engine}/3 — Armour ${up.armour}/3 — ` +
        `Nitro ${up.nitro ? 'fitted' : 'not fitted'}</span>`;
      const mkBtn = (label, price, fn) => {
        const b = document.createElement('button');
        b.textContent = price == null ? `${label} — MAX` : `${label} — $${price}`;
        b.disabled = price == null;
        b.addEventListener('click', fn);
        return b;
      };
      card.appendChild(mkBtn('Engine', c.prices.engine, () => garage.buyUpgrade(c.id, 'engine')));
      card.appendChild(mkBtn('Armour', c.prices.armour, () => garage.buyUpgrade(c.id, 'armour')));
      card.appendChild(mkBtn('Nitro', c.prices.nitro, () => garage.buyUpgrade(c.id, 'nitro')));
      const take = document.createElement('button');
      take.textContent = 'Take out';
      take.addEventListener('click', () => garage.takeOut(c.id));
      card.appendChild(take);
      panel.appendChild(card);
    }
    const close = document.createElement('button');
    close.textContent = 'Close (G)';
    close.addEventListener('click', () => garage.close());
    panel.appendChild(close);
  }

  let wheelSig = '';
  function renderWheel() {
    const wheel = $('wheel');
    if (!wheel) return;
    if (!weapons.isWheelOpen()) {
      if (wheel.style.display !== 'none') wheel.style.display = 'none';
      wheelSig = '';
      return;
    }
    const data = weapons.wheelData();
    const sig = JSON.stringify(data.map((d) => [d.id, d.owned, d.selected]));
    if (sig === wheelSig && wheel.style.display === 'block') return;
    wheelSig = sig;
    wheel.style.display = 'block';
    wheel.innerHTML = '<h3>WEAPONS</h3>';
    for (const d of data) {
      const slot = document.createElement('div');
      slot.className = 'wheel-slot' + (d.selected ? ' selected' : '') + (d.owned ? '' : ' locked');
      slot.innerHTML =
        `<strong>${d.name}</strong><span>${d.owned ? d.magSize > 0 ? `${d.mag} / ${d.reserve}` : 'Ready' : 'LOCKED — $' + d.price}</span>` +
        `<span>${d.desc}</span>`;
      slot.addEventListener('click', () => {
        if (d.owned) weapons.select(d.slot);
        else weapons.buy(d.id);
      });
      wheel.appendChild(slot);
    }
    const hint = document.createElement('p');
    hint.className = 'muted';
    hint.textContent = 'Click a weapon to equip it, or buy a locked one. Tab closes the wheel.';
    wheel.appendChild(hint);
  }

  // HUD crew cards double as quick-call buttons.
  for (const member of ['luz', 'celia', 'tito', 'marlon']) {
    const card = $('crew-' + member);
    if (card) {
      card.style.cursor = 'pointer';
      card.addEventListener('click', () => phone.call(member));
    }
  }

  // --- Title screen --------------------------------------------------------
  function startGame() {
    if (!state.flags.title) return;
    state.flags.title = false;
    audio.resume();
    bus.emit('user-gesture', {});
    const title = $('title-screen');
    if (title) title.style.display = 'none';
    if (!missions.progress.started && state.missions.done.length === 0) {
      missions.startMission(0);
    }
    bus.emit('message', { text: 'Welcome home, Rook. Mama Luz has your first job — check the NEXT JOB header.' });
  }
  const startBtn = $('start-button');
  if (startBtn) startBtn.addEventListener('click', startGame);

  // --- Input: gestures, Tab, click-to-shoot --------------------------------
  window.addEventListener('keydown', (e) => {
    if (e.code === 'Tab') e.preventDefault();
    audio.resume();
    bus.emit('user-gesture', {});
  });
  window.addEventListener('mousedown', () => {
    audio.resume();
    bus.emit('user-gesture', {});
  });

  function buildTargets() {
    const list = [];
    traffic.peds.forEach((ped, i) => {
      list.push({ id: 'ped-' + i, x: ped.x, y: 1.2, z: ped.z, radius: 0.9, health: 100, kind: 'ped' });
    });
    for (const u of police.getUnits()) {
      list.push({ id: u.id, x: u.x, y: (u.y || 0) + 1.5, z: u.z, radius: 1.4, health: 100, kind: 'cop' });
    }
    for (const car of allCars) {
      if (car.exploded) continue;
      list.push({
        id: car.id, x: car.x, y: 1.0, z: car.z, radius: 2.4,
        health: 100 - car.damage, kind: 'vehicle', car,
      });
    }
    return list;
  }

  canvas.addEventListener('mousedown', (e) => {
    if (e.button !== 0) return;
    if (state.flags.title || state.flags.paused || state.flags.phoneOpen ||
        state.flags.garageOpen || state.flags.wheelOpen) return;
    const p = state.player;
    const dir = new THREE.Vector3();
    renderer.camera.getWorldDirection(dir);
    const result = weapons.fire(
      { x: p.x, y: 1.5, z: p.z },
      { x: dir.x, y: dir.y, z: dir.z },
      buildTargets()
    );
    if (result && result.fired && result.kind === 'vehicle' && result.weapon !== 'rpg') {
      const target = buildTargets().find((t) => t.id === result.hit);
      if (target && target.car && !target.car.exploded) {
        damageCar(target.car, result.damage || 0, vehCtx);
      }
    }
  });

  // --- Per-frame key routing -------------------------------------------------
  function routeKeys() {
    if (state.flags.title) {
      if (input.pressed('Enter') || input.pressed('NumpadEnter')) startGame();
      return;
    }
    if (pauseMenu.isOpen) {
      for (const code of ['KeyP', 'Escape', 'Digit1', 'Digit2', 'Digit3', 'Digit4', 'Digit5']) {
        if (input.pressed(code)) pauseMenu.handleKey(code);
      }
      return;
    }
    if (input.pressed('KeyP') || input.pressed('Escape')) {
      if (state.flags.phoneOpen) phone.close();
      else if (state.flags.garageOpen) garage.close();
      else if (weapons.isWheelOpen()) weapons.closeWheel();
      else pauseMenu.toggle();
      return;
    }
    if (input.pressed('KeyF')) phone.handleKey('KeyF');
    if (input.pressed('KeyG')) garage.handleKey('KeyG');
    if (input.pressed('Tab')) weapons.handleKey('Tab');
    if (input.pressed('KeyQ')) weapons.handleKey('KeyQ');
    if (input.pressed('KeyR')) weapons.handleKey('KeyR');
    for (let n = 1; n <= 6; n++) {
      if (input.pressed('Digit' + n)) weapons.handleKey('Digit' + n);
    }
    if (input.pressed('KeyC')) audio.handleKey('KeyC');
    if (input.pressed('KeyM')) audio.handleKey('KeyM');
    for (const member of phone.crewList) {
      if (input.pressed(member.key)) phone.handleKey(member.key);
    }
    if (input.pressed('KeyE')) {
      if (state.flags.dialogue) {
        const box = $('dialogue-box');
        if (box) box.click();
      } else {
        const s = missions.currentStage;
        if (s && s.action && state.player) {
          const d = dist2d(state.player.x, state.player.z, s.target.x, s.target.z);
          if (d <= (s.radius || 12)) missions.doStageAction();
        }
      }
    }
  }

  // --- Fixed-timestep step ---------------------------------------------------
  function step(dt, time) {
    const p = state.player;
    if (!state.flags.title && !state.flags.paused) {
      // Game clock: 1 game-minute per ~2 real seconds.
      state.clock.minutes += dt * CONFIG.clock.minutesPerRealSecond;
      if (state.clock.minutes >= CONFIG.clock.minutesPerDay) {
        state.clock.minutes -= CONFIG.clock.minutesPerDay;
        state.clock.day += 1;
      }
      state.stats.timePlayed = (state.stats.timePlayed || 0) + dt;

      // The city sets the district authoritatively every step.
      districts.setCurrentDistrict(city.districtAt(p.x, p.z));

      driving.update(dt);
      player.update(dt);
      traffic.update(dt);
      police.update(dt);
      weapons.update(dt);
      missions.update(dt, { x: p.x, z: p.z });
      missions.updateRace(dt, { x: p.x, z: p.z });
      missions.updateTaxi(dt, { x: p.x, z: p.z });
      side.update({ x: p.x, z: p.z });
      if (!p.onFoot && p.speedKmh >= 60) {
        side.tryStuntJump({ x: p.x, z: p.z }, p.speedKmh, true);
      }
      updateVehicles(allCars, dt, vehCtx);
      audio.update(dt);
      phone.update(dt);
      garage.update();
      districts.update();
    }

    syncPoliceMeshes(time);
    syncPickupMeshes();

    // Objective marker: race checkpoint, taxi stop, then mission target.
    let markerPos = null;
    let markerVisible = false;
    if (missions.race.active) {
      const cp = missions.race.active.checkpoints[missions.race.checkpoint];
      if (cp) { markerPos = cp; markerVisible = true; }
    } else if (missions.taxi.active) {
      const t = missions.taxi;
      markerPos = t.phase === 'pickup' ? t.active.from : t.active.to;
      markerVisible = true;
    } else if (state.missions.markerVisible && state.missions.objectivePos) {
      markerPos = state.missions.objectivePos;
      markerVisible = true;
    }
    marker.visible = markerVisible;
    markerRing.visible = markerVisible;
    if (markerPos) {
      marker.position.set(markerPos.x, 3.2 + Math.sin(time * 2.2) * 0.35, markerPos.z);
      marker.rotation.y = time * 1.4;
      markerRing.position.set(markerPos.x, 0.18, markerPos.z);
    }

    state.dispatch = police.getDispatch();
    hud.update();
    renderPhonePanel();
    renderGaragePanel();
    renderWheel();
  }

  // --- Main loop ---------------------------------------------------------------
  let last = performance.now();
  let acc = 0;
  let time = 0;
  function frame(now) {
    requestAnimationFrame(frame);
    const frameDt = Math.min(0.1, (now - last) / 1000);
    last = now;
    time += frameDt;

    routeKeys();

    if (state.flags.title || state.flags.paused) {
      // Still render the city behind the overlays; on the title screen the
      // camera drifts slowly so the city shows itself off. Always consume
      // the input deltas so nothing piles up while the overlays are up.
      const held = input.consumeDrag();
      input.consumeWheel();
      const drag = state.flags.title ? { x: 0.16, y: 0 } : held;
      const focus = {
        x: state.player.x, z: state.player.z,
        heading: state.player.heading, inCar: false, speedKmh: 0,
      };
      renderer.update(frameDt, state, focus, drag, 0);
      state.dispatch = police.getDispatch();
      hud.update();
    } else {
      acc += frameDt;
      let n = 0;
      while (acc >= STEP && n < 5) {
        step(STEP, time);
        acc -= STEP;
        n += 1;
      }
      if (n === 5) acc = 0;
      const drag = input.consumeDrag();
      const wheel = input.consumeWheel() / 120;
      const focus = {
        x: state.player.x, z: state.player.z,
        heading: state.player.heading,
        inCar: !state.player.onFoot,
        speedKmh: state.player.speedKmh || 0,
      };
      renderer.update(frameDt, state, focus, drag, wheel);
    }
    input.endFrame();
  }

  // --- Test helpers for the playtest harness -----------------------------------
  function teleport(x, z) {
    const p = state.player;
    const car = driving.currentCar();
    if (car && !p.onFoot) {
      car.x = x;
      car.z = z;
      car.speed = 0;
      car.group.position.set(x, 0, z);
    }
    p.x = x;
    p.z = z;
    p.speedKmh = 0;
    districts.setCurrentDistrict(city.districtAt(x, z));
    return { x: p.x, z: p.z };
  }

  function setWanted(n) {
    police.setWanted(n);
    police.update(2.5);
    state.dispatch = police.getDispatch();
    return state.wanted.level;
  }

  function completeStage() {
    const s = missions.currentStage;
    if (!s) return false;
    if (s.action) return missions.doStageAction();
    return missions.advanceStage();
  }

  function giveMoney(n) {
    state.player.money = (state.player.money || 0) + n;
    return state.player.money;
  }

  function startMission(n) {
    // 1-based mission number (1..10); 0 means the first mission.
    const idx = n >= 1 && n <= MISSIONS.length ? n - 1 : 0;
    return missions.startMission(idx);
  }

  function setClock(day, minutes) {
    state.clock.day = day;
    state.clock.minutes = minutes;
    return { day: state.clock.day, minutes: state.clock.minutes };
  }

  const game = {
    state,
    rng,
    bus,
    input,
    renderer,
    city,
    traffic,
    allCars,
    driving,
    player,
    police,
    weapons,
    districts,
    garage,
    phone,
    audio,
    missions,
    side,
    pause: pauseMenu,
    hud,
    seed,
    teleport,
    setWanted,
    completeStage,
    giveMoney,
    startMission,
    setClock,
    saveSlot: (n) => saveSlot(n, state),
    loadSlot: (n) => loadSlot(n, state),
    stageShot: (name, shotSeed) => stageShot(game, name, shotSeed),
    startGame,
  };
  window.__game = game;

  // --- Staged screenshot, then settle the scene --------------------------------
  if (shotParam) {
    stageShot(game, shotParam, seed);
    // Run the world forward a few seconds headlessly so police units
    // spawn, traffic spreads out and the HUD fills in before the shot.
    for (let i = 0; i < 300; i++) step(STEP, i * STEP);
    const focus = {
      x: state.player.x, z: state.player.z,
      heading: state.player.heading,
      inCar: !state.player.onFoot,
      speedKmh: state.player.speedKmh || 0,
    };
    renderer.update(STEP, state, focus, { x: 0, y: 0 }, 0);
    hud.update();
  }

  requestAnimationFrame(frame);
  return game;
}

try {
  boot();
} catch (err) {
  console.error('MARAVILLA failed to start:', err);
  const title = document.getElementById('title-screen');
  if (title) {
    title.style.display = 'flex';
    const p = title.querySelector('p');
    if (p) p.textContent = 'The game could not start in this browser: ' + (err && err.message ? err.message : err);
  }
}
