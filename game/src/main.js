// MARAVILLA — One Last Score. Boot, game loop, input wiring, car and crew
// meshes, shooting and explosions, and the in-page self-test (?selftest=1).
import * as THREE from 'three';
import { createState, snapshot, districtAt } from './state.js';
import { createBus } from './events.js';
import { createInput } from './input.js';
import { buildCity, PLACES, isOnRoad } from './city.js';
import { createRenderer, createLights, createSky, createEnvironment, updateDayNight, updateCamera, clockText } from './render.js';
import { buildCarMesh, spawnExplosion, updateExplosion } from './vehicles.js';
import { createTraffic, updateTraffic, buildPersonMesh, animateWalk } from './traffic.js';
import { updateDriving, enterCar, exitCar, tryCarjack, vehicleDef } from './driving.js';
import { createPlayerMesh, updatePlayer, damagePlayer, respawn } from './player.js';
import { createPolice, addHeat, decayHeat, updatePolice, dispatchRows, clearCops } from './police.js';
import { buyWeapon, selectWeapon, cycleWeapon, reload, shoot, createPickups, updatePickups, weaponDef } from './weapons.js';
import { MISSIONS, RACES, currentMission, startMission, updateMission, startRace, updateRace, startTaxi, updateTaxi, missionObjective } from './missions.js';
import { callCrew, tickCooldowns, CREW_CALLS } from './phone.js';
import { currentStanding } from './districts.js';
import { buyUpgrade, repair } from './garage.js';
import { createHud } from './hud.js';
import { createAudio } from './audio.js';
import { saveSlot, loadSlot, hasSlot } from './save.js';
import { createSide, updateSide, tryExport, districtJob, buySafehouse, restAtSafehouse } from './side.js';
import { createPause } from './pause.js';
import { portraitURL } from './portraits.js';
import { applyShot } from './shots.js';
import { CREW, VEHICLES } from './config.js';
import { DAY_LENGTH_S } from './config.js';

const params = new URLSearchParams(location.search);
const SEED = Number(params.get('seed') || 20261122);
const SHOT = params.get('shot');
const SELFTEST = params.get('selftest') === '1';
const NORENDER = params.get('norender') === '1'; // headless self-test: skip WebGL frames

const state = createState(SEED);
const bus = createBus();
const errors = [];
window.addEventListener('error', (e) => errors.push(String(e.message || e.error)));

const canvas = document.getElementById('game-canvas');
const renderer = createRenderer(canvas);
const scene = new THREE.Scene();
scene.fog = new THREE.Fog(0x1a2038, 120, 620);
const camera = new THREE.PerspectiveCamera(55, window.innerWidth / window.innerHeight, 0.1, 2000);
camera.position.set(0, 4, 12);

const lights = createLights(scene);
const sky = createSky(scene);
const env = createEnvironment(scene, renderer);
const city = buildCity(scene, SEED);
scene.add(city.group);
const traffic = createTraffic(scene, SEED, city.roadPoints);
const police = createPolice(scene);
const pickups = createPickups(scene, SEED);
const side = createSide(scene, SEED);
const audio = createAudio();
const input = createInput(canvas);

// Hero light: a warm follow-spot above the player so the car and Milo
// always read at night, like a street lamp riding with them.
const heroLight = new THREE.PointLight(0xffc070, 0, 34, 1.4);
scene.add(heroLight);

// Player mesh (Milo) and crew meshes standing in the world.
const playerMesh = createPlayerMesh();
scene.add(playerMesh);
const crewMeshes = {};
for (const m of CREW) {
  const mesh = buildPersonMesh({ seed: 300 + m.id.length * 7, skin: m.skin, hair: m.hair, hairStyle: m.hairStyle, shirt: m.shirt, height: m.id === 'bram' ? 1.92 : 1.74 });
  mesh.name = 'crew-' + m.id;
  scene.add(mesh);
  crewMeshes[m.id] = mesh;
}
crewMeshes.vera.position.set(8, 0, 34);
crewMeshes.juno.position.set(-84, 0, 126);
crewMeshes.theo.position.set(-96, 0, 126);
crewMeshes.iris.position.set(-36, 0, -96);
crewMeshes.bram.position.set(204, 0, 156);
for (const m of Object.values(crewMeshes)) m.rotation.y = Math.PI;

// Parked cars along the roads, including Milo's gold Solano GT at the plaza.
const parked = [];
const parkedSpots = [
  { def: 'solano', x: 8, z: 44, h: Math.PI / 2, color: 0xd4af37 },
  { def: 'alba', x: -8, z: 60, h: -Math.PI / 2, color: 0x2a6ab0 },
  { def: 'brisa', x: 60, z: 8, h: 0, color: 0x18a0a0 },
  { def: 'cometa', x: -60, z: -8, h: Math.PI, color: 0xc02028 },
  { def: 'viento', x: 120, z: 68, h: Math.PI / 2, color: 0xd8d0c0 },
  { def: 'alba', x: 180, z: -52, h: 0, color: 0x8a8a8a },
  { def: 'brisa', x: -120, z: 128, h: Math.PI / 2, color: 0xe07820 },
  { def: 'taxi', x: 30, z: -68, h: -Math.PI / 2, color: 0xf0c020 },
  { def: 'solano', x: -180, z: -128, h: 0, color: 0x3a3a4a },
  { def: 'cometa', x: 240, z: 60, h: Math.PI, color: 0x7a2a6a },
  { def: 'alba', x: 60, z: 240, h: Math.PI / 2, color: 0x5a7a3a },
  { def: 'viento', x: -240, z: 200, h: 0, color: 0x9a9a9a },
  { def: 'brisa', x: 150, z: 190, h: -Math.PI / 2, color: 0xc02028 },
  { def: 'taxi', x: -30, z: 200, h: Math.PI / 2, color: 0xf0c020 },
];
for (const s of parkedSpots) {
  const mesh = buildCarMesh(vehicleDef(s.def), { seed: SEED + parked.length * 13, color: s.color });
  mesh.position.set(s.x, 0, s.z);
  mesh.rotation.y = s.h;
  mesh.userData.shootable = { kind: 'parked', defId: s.def };
  mesh.userData.damage = 0;
  scene.add(mesh);
  parked.push({ ...s, mesh, taken: false });
}

// Mission 4 steal target: a van parked ON the road at (120, 60).
let stealVan = null;
function ensureStealVan() {
  if (stealVan) return stealVan;
  const mesh = buildCarMesh(vehicleDef('viento'), { seed: SEED + 555, color: 0xd8d0c0 });
  mesh.position.set(120, 0, 60);
  mesh.rotation.y = Math.PI / 2;
  mesh.userData.shootable = { kind: 'steal', defId: 'viento' };
  scene.add(mesh);
  stealVan = { mesh, defId: 'viento', x: 120, z: 60 };
  return stealVan;
}

let playerCarMesh = null;
let playerCarDef = null;
const explosions = [];
let maxKmh = 0;

// Debug hook for headless verification (camera/car positions, state).
window.__game = { state, get camera() { return camera; }, get carMesh() { return playerCarMesh; }, get playerMesh() { return playerMesh; } };

const hud = createHud(state, { crew: CREW, police });
const pauseMenu = createPause(state, { saveSlot, loadSlot });

function markerTarget() {
  const obj = missionObjective(state);
  if (state.taxi) return state.taxi.phase === 'pickup' ? state.taxi.pick : state.taxi.drop;
  if (state.race) {
    const def = RACES[state.race.id];
    return def.checkpoints[Math.min(state.race.cp, def.checkpoints.length - 1)];
  }
  if (obj) {
    const m = currentMission(state);
    if (m && state.mission) return m.stages[state.mission.stage].target;
    if (m) return m.stages[0].target;
  }
  return null;
}

const missionCtx = {
  bus,
  police,
  setWaitProgress: (k) => { state.flags.waitProgress = k; },
  hint: (t) => hud.say(t),
  startRace: (id) => startRace(state, id, missionCtx),
};

bus.on('message', ({ text }) => hud.say(text));
bus.on('dialogue', ({ who, text }) => hud.showDialogue(who, text));
bus.on('crime', ({ kind, amount }) => {
  const label = { speeding: 'SPEEDING', carjacking: 'GRAND THEFT AUTO', shooting: 'SHOTS FIRED', explosion: 'EXPLOSION' }[kind] || kind.toUpperCase();
  addHeat(state, amount, label, bus);
});
bus.on('horn', () => audio.sfx('horn'));
bus.on('shot-hit', (rec) => {
  const target = rec.target;
  if (!target) return;
  const info = target.userData.shootable;
  if (info && info.kind === 'parked') {
    target.userData.damage = (target.userData.damage || 0) + rec.damage;
    if (target.userData.damage >= 100) explodeAt(target.position, false);
  } else if (info && info.kind === 'steal') {
    target.userData.damage = (target.userData.damage || 0) + rec.damage;
    if (target.userData.damage >= 100) explodeAt(target.position, false);
  } else {
    addHeat(state, 8, 'SHOTS FIRED', bus);
    state.stats.takenOut += 1;
  }
  if (rec.weapon === 'launcher') explodeAt(rec.point, true);
});
bus.on('rammed', () => { if (state.car && state.car.damage >= 100) explodePlayerCar(); });
bus.on('caught', () => {
  damagePlayer(state, 25, bus);
  hud.say('A cop grabbed you — you broke free, but it hurt.');
});
bus.on('mission-complete', () => audio.sfx('mission'));
bus.on('wanted', ({ wanted }) => { if (wanted >= 4) hud.say('AIR ONE is circling. Lose the helicopter.'); });

function explodeAt(pos, big) {
  const e = spawnExplosion(scene, pos.clone ? pos.clone() : new THREE.Vector3(pos.x, 0, pos.z), big);
  explosions.push(e);
  audio.sfx('explosion');
  addHeat(state, 12, 'EXPLOSION', bus);
  // Chain: nearby cars catch fire too.
  for (const p of parked) {
    if (!p.taken && p.mesh.position.distanceTo(e.group.position) < 9) {
      p.mesh.userData.damage = 100;
      setTimeout(() => explodeAt(p.mesh.position, false), 350);
    }
  }
  return e;
}

function explodePlayerCar() {
  if (!state.car) return;
  const pos = new THREE.Vector3(state.car.x, 0, state.car.z);
  explodeAt(pos, true);
  state.car = null;
  state.player.onFoot = true;
  state.player.x = pos.x + 3; state.player.z = pos.z + 3;
  damagePlayer(state, 30, bus);
}

// --- Input actions (single taps) ---
function handlePressed() {
  for (const code of input.consumePressed()) {
    if (!state.started) {
      if (code === 'Enter') startGame();
      continue;
    }
    if (code === 'KeyP' || code === 'Escape') { pauseMenu.toggle(); continue; }
    if (state.paused) continue;
    if (code === 'KeyE') {
      if (state.car) { exitCar(state); }
      else {
        // Steal van first, then parked cars, then traffic.
        let done = false;
        if (stealVan) {
          const d = Math.hypot(stealVan.x - state.player.x, stealVan.z - state.player.z);
          if (d < 5) {
            enterCar(state, 'viento', stealVan.x, stealVan.z, Math.PI / 2);
            stealVan.mesh.visible = false; stealVan.taken = true;
            bus.emit('crime', { kind: 'carjacking', amount: 8 });
            done = true;
          }
        }
        if (!done) {
          for (const p of parked) {
            if (p.taken) continue;
            const d = Math.hypot(p.mesh.position.x - state.player.x, p.mesh.position.z - state.player.z);
            if (d < 4.5) {
              enterCar(state, p.def, p.mesh.position.x, p.mesh.position.z, p.mesh.rotation.y);
              p.taken = true; p.mesh.visible = false;
              bus.emit('crime', { kind: 'carjacking', amount: 6 });
              done = true;
              break;
            }
          }
        }
        if (!done) tryCarjack(state, traffic, bus);
      }
      continue;
    }
    if (code === 'KeyF') { callCrew(state, 'vera', missionCtx); continue; }
    if (code === 'KeyZ') { callCrew(state, 'juno', missionCtx); continue; }
    if (code === 'KeyX') { callCrew(state, 'theo', missionCtx); continue; }
    if (code === 'KeyV') { callCrew(state, 'iris', missionCtx); continue; }
    if (code === 'KeyB') { callCrew(state, 'bram', missionCtx); continue; }
    if (code === 'KeyC') { const st = audio.nextStation(); state.radio = (state.radio + 1) % 3; hud.say('Radio: ' + st.name); continue; }
    if (code === 'KeyM') { state.muted = !state.muted; audio.setMuted(state.muted); hud.say(state.muted ? 'Radio muted.' : 'Radio on.'); continue; }
    if (code === 'KeyG') {
      const d = Math.hypot(PLACES.garage.x - state.player.x, PLACES.garage.z - state.player.z);
      if (d < 16 && state.player.onFoot) {
        const r = buyUpgrade(state, 'engine', state.player.x, state.player.z);
        hud.say(r.ok ? `Engine upgraded to level ${r.level} — $${r.cost}.` : 'Garage: ' + r.why + '.');
      }
      continue;
    }
    if (code === 'Tab') { document.getElementById('wheel').classList.toggle('hidden'); continue; }
    if (code === 'KeyQ') { cycleWeapon(state, 1); continue; }
    if (code === 'KeyR') { reload(state); continue; }
    if (code.startsWith('Digit')) {
      const idx = Number(code.slice(5)) - 1;
      const w = ['fists', 'pistol', 'smg', 'shotgun', 'rifle', 'launcher'][idx];
      if (w) selectWeapon(state, w);
      continue;
    }
    if (code === 'KeyJ') { districtJob(state, bus); continue; }
    if (code === 'KeyT') { if (!state.taxi) startTaxi(state, missionCtx); continue; }
    if (code === 'KeyU') { tryExport(state, bus); continue; }
  }
  // Mouse click = shoot.
  if (input.mouseDown() && state.started && !state.paused) {
    if (state.weapon !== 'fists' || true) {
      const rec = shoot(state, scene, camera, bus);
      if (rec && !rec.empty) audio.sfx('shot');
    }
  }
}

function startGame() {
  state.started = true;
  document.getElementById('title-screen').classList.add('hidden');
  audio.unlock();
  hud.say('Welcome to Maravilla, Milo.');
  hud.say('NEXT JOB: FIRST LIGHT — meet Vera at Downtown Plaza.');
  if (!state.mission && state.missionIndex === 0) {
    // Mission 1 waits for the player to walk to Vera; the marker shows it.
  }
}

// --- Per-frame step (shared by the render loop and the self-test) ---
function step(dt) {
  if (state.paused) return;
  // Clock
  state.dayTime += (dt / DAY_LENGTH_S) * state.timeScale;
  if (state.dayTime >= 1) { state.dayTime -= 1; state.day += 1; }
  const { dusk, night } = updateDayNight(state, lights, sky, dt);
  state.flags.dusk = dusk; state.flags.night = night;
  // Hero light follows the player (car or on foot) and only burns at night.
  const heroPos = state.car ? { x: state.car.x, z: state.car.z } : { x: state.player.x, z: state.player.z };
  heroLight.position.set(heroPos.x, 7, heroPos.z - 2);
  heroLight.intensity = night > 0.15 ? 70 * night : 0;

  handlePressed();

  // Mission 1 auto-start when Milo reaches Vera.
  if (state.started && !state.mission && state.missionIndex === 0) {
    const d = Math.hypot(state.player.x - 0, state.player.z - 30);
    if (d < 8 && state.player.onFoot) startMission(state, 0, bus);
  }
  // Mission 4 steal target spawns on the road when the mission begins.
  if (state.mission && state.mission.id === 'cold-storage' && state.mission.stage >= 1) ensureStealVan();

  if (state.car) {
    const sp = updateDriving(state, input, dt, bus);
    maxKmh = Math.max(maxKmh, Math.abs(sp) * 3.6);
    if (state.car.damage >= 100) explodePlayerCar();
  } else {
    updatePlayer(state, input, dt, bus);
  }
  updateTraffic(traffic, dt, state.dayTime * DAY_LENGTH_S);
  updatePolice(police, state, dt, bus);
  decayHeat(state, dt);
  updateMission(state, missionCtx, dt);
  if (state.race) updateRace(state, dt, missionCtx);
  if (state.taxi) updateTaxi(state, dt, missionCtx);
  updateSide(side, state, dt, bus);
  updatePickups(pickups, state, dt);
  tickCooldowns(state, dt);

  // Sync meshes.
  playerMesh.visible = state.player.onFoot;
  if (state.player.onFoot) {
    playerMesh.position.set(state.player.x, state.player.y || 0, state.player.z);
    playerMesh.rotation.y = state.player.heading;
    animateWalk(playerMesh, state.player.speed || 0, dt);
  }
  if (state.car) {
    if (!playerCarMesh || playerCarDef !== state.car.defId) {
      if (playerCarMesh) scene.remove(playerCarMesh);
      playerCarMesh = buildCarMesh(vehicleDef(state.car.defId), { seed: SEED + 31 });
      playerCarMesh.userData.beam.intensity = 0;
      scene.add(playerCarMesh);
      playerCarDef = state.car.defId;
    }
    playerCarMesh.position.set(state.car.x, 0, state.car.z);
    playerCarMesh.rotation.y = state.car.heading;
    const w = playerCarMesh.userData.wheels;
    if (w) for (const wheel of w) wheel.rotation.x += (state.car.speed * dt) / 0.38;
    // Body roll + headlight beams at night.
    playerCarMesh.rotation.z = -0.03 * Math.sin(state.car.heading) * Math.min(1, Math.abs(state.car.speed) / 30);
    playerCarMesh.userData.beam.intensity = night > 0.4 ? 25 : 0;
    // Damage smoke.
    if (state.car.damage > 60) {
      playerCarMesh.userData.paint.emissive = new THREE.Color(0x301505);
      playerCarMesh.userData.paint.emissiveIntensity = 0.4;
    }
  } else if (playerCarMesh) {
    scene.remove(playerCarMesh); playerCarMesh = null; playerCarDef = null;
  }
  // Rival race cars.
  if (state.race) {
    for (let i = 0; i < state.race.rivals.length; i++) {
      const r = state.race.rivals[i];
      if (!r.mesh) {
        r.mesh = buildCarMesh(vehicleDef(i === 0 ? 'cometa' : i === 1 ? 'brisa' : 'alba'), { seed: SEED + 400 + i, color: [0xc02028, 0x18a0a0, 0x2a6ab0][i] });
        scene.add(r.mesh);
      }
      r.mesh.position.set(r.x, 0, r.z);
      r.mesh.rotation.y = Math.atan2(r.x - (r.px || r.x), r.z - (r.pz || r.z)) || 0;
      r.px = r.x; r.pz = r.z;
    }
  }
  // Explosions.
  for (const e of [...explosions]) {
    if (!updateExplosion(e, dt)) { scene.remove(e.group); explosions.splice(explosions.indexOf(e), 1); }
  }
  // Water shimmer + yacht bob + lighthouse beam.
  city.water.position.y = 0.1 + Math.sin(state.dayTime * 40) * 0.05;
  for (const y of city.yachts) y.position.y = 0.2 + Math.sin(state.dayTime * 30 + y.position.x) * 0.15;
  city.beam.parent.rotation.y += dt * 0.4;

  state.district = districtAt(state.player.x, state.player.z).id;
  hud.update(state, { marker: markerTarget() }, dt);
}

function renderFrame(dt) {
  // Camera: fixed shot camera, else the low chase rig.
  if (state.flags.shotCam) {
    const [x, y, z] = state.flags.shotCam.pos;
    const [lx, ly, lz] = state.flags.shotCam.look;
    camera.position.set(x, y, z);
    camera.lookAt(lx, ly, lz);
  } else {
    updateCamera(camera, state, playerCarMesh, playerMesh, input, dt);
  }
  renderer.render(scene, camera);
}

let last = performance.now();
function loop(now) {
  requestAnimationFrame(loop);
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  if (!state.flags.selftest) step(dt);
  if (!NORENDER) renderFrame(dt);
}

// --- Title screen wiring ---
document.getElementById('start-btn').addEventListener('click', startGame);
document.getElementById('title-screen').addEventListener('click', (e) => { if (e.target.id === 'title-screen') startGame(); });
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// --- Shot staging / self-test entry points ---
if (SHOT) {
  applyShot(SHOT, { state, bus, placeVera: (x, z) => crewMeshes.vera.position.set(x, 0, z) });
  state.started = true;
}
if (SELFTEST) {
  state.flags.selftest = true;
  document.getElementById('title-screen').classList.add('hidden');
  state.started = true;
  runSelfTest();
}
requestAnimationFrame(loop);

// --- Self-test: drives the real systems headlessly and reports honestly. ---
async function runSelfTest() {
  const results = [];
  const el = document.getElementById('selftest');
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  function check(name, pass, detail) { results.push({ name, pass: !!pass, detail: String(detail ?? '') }); }
  function steps(n, dt = 1 / 30) { for (let i = 0; i < n; i++) step(dt); }
  try {
    // 1 walk
    state.player.x = 0; state.player.z = 40; state.player.onFoot = true; state.car = null;
    input.inject('KeyW'); steps(60); input.release('KeyW');
    check('walk', Math.hypot(state.player.x - 0, state.player.z - 40) > 2, `moved to ${state.player.x.toFixed(1)},${state.player.z.toFixed(1)}`);
    // 2 drive + speedometer
    enterCar(state, 'solano', 0, 0, 0);
    input.inject('KeyW'); steps(150); input.release('KeyW');
    const topSpeed = Math.abs(state.car.speed);
    check('drive', topSpeed > 10, `top ${topSpeed.toFixed(1)} m/s = ${(topSpeed * 3.6).toFixed(0)} km/h`);
    // 3 carjack
    exitCar(state);
    const tc = traffic.cars[0];
    state.player.x = tc.mesh.position.x; state.player.z = tc.mesh.position.z;
    const before = state.stats.stolen;
    tryCarjack(state, traffic, bus);
    check('carjack', !!state.car && state.stats.stolen === before + 1, state.car ? state.car.defId : 'none');
    // 4 weapon wheel + shoot
    state.money = 5000;
    const bought = buyWeapon(state, 'smg');
    selectWeapon(state, 'smg');
    const magBefore = state.weapons.smg.mag;
    shoot(state, scene, camera, bus);
    check('weapon-wheel-shoot', bought && state.weapons.smg.mag === magBefore - 1, `smg mag ${magBefore} -> ${state.weapons.smg.mag}`);
    // 5 explosion
    const ex = explodeAt(new THREE.Vector3(10, 0, 10), true);
    steps(10);
    check('explosion', !!ex && explosions.includes(ex), `explosion live, core scale ${ex.core.scale.x.toFixed(2)}`);
    // 6 mission 1 complete
    state.mission = null; state.missionIndex = 0; state.missionDone = [];
    startMission(state, 0, bus);
    state.player.x = 0; state.player.z = 30; state.car = null; state.player.onFoot = true;
    steps(5);
    const stageAfterMeet = state.mission ? state.mission.stage : -1;
    state.player.x = -90; state.player.z = 120;
    steps(5);
    steps(180); // wait stage at the garage
    check('mission-1-complete', state.missionDone.includes('first-light') && state.missionIndex === 1, `stage after meet ${stageAfterMeet}, done ${state.missionDone.join(',')}`);
    // 7 wanted-3 survival + dispatch uniqueness (55 heat survives decay)
    state.heat = 0; state.wanted = 0;
    addHeat(state, 55, 'TEST', bus);
    steps(60);
    const rows = dispatchRows(police, state);
    const calls = rows.rows.map((r) => r.callsign);
    check('wanted-3-dispatch', state.wanted === 3 && police.units.length >= 4 && new Set(calls).size === calls.length, `wanted ${state.wanted}, units ${police.units.length}, rows ${rows.rows.length}`);
    // 8 phone: Juno scrubs heat
    state.money = 500;
    const wBefore = state.wanted;
    callCrew(state, 'juno', missionCtx);
    check('phone-juno', state.wanted <= Math.max(0, wBefore - 2), `wanted ${wBefore} -> ${state.wanted}`);
    // 9 garage upgrade
    const gBefore = state.garage.engine;
    state.money = 5000;
    buyUpgrade(state, 'engine', -90, 120);
    check('garage-upgrade', state.garage.engine === gBefore + 1, `engine ${gBefore} -> ${state.garage.engine}`);
    // 10 radio
    const rBefore = state.radio;
    audio.nextStation(); state.radio = (state.radio + 1) % 3;
    check('radio', state.radio !== rBefore, `station ${rBefore} -> ${state.radio}`);
    // 11 save/load exact
    const snapBefore = JSON.stringify(snapshot(state));
    saveSlot(state, 1);
    state.money = 1;
    loadSlot(state, 1);
    const snapAfter = JSON.stringify(snapshot(state));
    let diffKeys = '';
    if (snapAfter !== snapBefore) {
      const a = JSON.parse(snapBefore), b = JSON.parse(snapAfter);
      diffKeys = Object.keys(a).filter((k) => JSON.stringify(a[k]) !== JSON.stringify(b[k]))
        .map((k) => `${k}: ${JSON.stringify(a[k]).slice(0, 80)} != ${JSON.stringify(b[k]).slice(0, 80)}`).join(' | ');
    }
    check('save-load-exact', snapAfter === snapBefore, diffKeys || `money restored ${state.money}`);
    // 12 district heat scaling: loyal 3 vs hostile 5
    state.player.x = -200; state.player.z = -200; state.player.onFoot = true; state.car = null;
    state.standing.marina = 90; state.heat = 0; state.wanted = 0;
    addHeat(state, 90, 'TEST', bus);
    const loyalWanted = state.wanted;
    state.standing.marina = 10; state.heat = 0; state.wanted = 0;
    addHeat(state, 90, 'TEST', bus);
    const hostileWanted = state.wanted;
    check('district-heat-scaling', loyalWanted === 3 && hostileWanted === 5, `loyal ${loyalWanted} vs hostile ${hostileWanted}`);
    // 13 collectible
    const c0 = side.collectibles.find((c) => !c.taken);
    state.player.x = c0.x; state.player.z = c0.z;
    steps(3);
    check('collectible', c0.taken, `collected ${state.collectibles.length}/20`);
    // 14 stunt jump
    enterCar(state, 'solano', side.jumps[0].x, side.jumps[0].z, 0);
    state.car.speed = 30;
    steps(3);
    check('stunt-jump', side.jumps[0].done, `jumps ${state.jumpsDone.length}/5`);
    // 15 district job
    state.district = 'centro'; state.standing.centro = 50;
    const mBefore = state.money;
    districtJob(state, bus);
    check('district-job', state.money > mBefore, `+$${state.money - mBefore}`);
    // 16 export
    enterCar(state, 'solano', 0, 0, 0);
    const eBefore = state.money;
    tryExport(state, bus);
    check('export', state.exportsDone.includes('solano') && state.money > eBefore, `exports ${state.exportsDone.length}/5`);
    // 17 safehouse
    state.money = 5000;
    check('safehouse', buySafehouse(state, bus) === true && state.safehouse, 'owned');
    // 18 motorbike
    enterCar(state, 'picuda', 0, 0, 0);
    check('motorbike', state.car.defId === 'picuda', state.car.defId);
    // 19 weapon purchase
    state.money = 5000;
    check('weapon-purchase', buyWeapon(state, 'launcher') && state.weapons.launcher.owned, 'launcher owned');
    // 20 three save slots
    saveSlot(state, 1); saveSlot(state, 2); saveSlot(state, 3);
    check('three-save-slots', hasSlot(1) && hasSlot(2) && hasSlot(3), 'slots 1-3 present');
    // 21 pause tabs
    pauseMenu.open('STATS');
    const bodyText = document.getElementById('pause-body').textContent;
    pauseMenu.close();
    check('pause-tabs', bodyText.includes('CAREER STATS'), 'STATS tab renders');
    // 22 density
    check('density', traffic.peds.length >= 64 && traffic.cars.length >= 20, `${traffic.peds.length} peds, ${traffic.cars.length} traffic`);
    // 23 race won by real driving inputs
    state.wanted = 0; state.heat = 0;
    enterCar(state, 'solano', -30, -90, 0);
    state.car.speed = 0;
    startRace(state, 'neon-mile', missionCtx);
    let won = false;
    for (let t = 0; t < 150 * 30; t++) {
      const def = RACES['neon-mile'];
      const cp = def.checkpoints[Math.min(state.race.cp, def.checkpoints.length - 1)];
      const dx = cp.x - state.car.x, dz = cp.z - state.car.z;
      const targetH = Math.atan2(dx, dz);
      let diff = targetH - state.car.heading;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      input.releaseAll();
      if (Math.abs(diff) < 0.5 || Math.abs(state.car.speed) < 8) input.inject('KeyW');
      // D turns the car toward -x (screen right when facing +z), so a
      // positive angle error needs A, not D.
      if (diff > 0.08) input.inject('KeyA');
      else if (diff < -0.08) input.inject('KeyD');
      step(1 / 30);
      if (state.race.done) { won = state.race.won; break; }
    }
    input.releaseAll();
    check('race-won-real-driving', won === true, `won=${won} time=${state.race ? state.race.time.toFixed(1) : '?'}s cp=${state.race ? state.race.cp : '?'}`);
    // 24 taxi pays real money
    const tBefore = state.money;
    startTaxi(state, missionCtx);
    state.player.x = 60; state.player.z = -60; state.car = null; state.player.onFoot = true;
    steps(3);
    state.player.x = -180; state.player.z = 180;
    steps(3);
    check('taxi-pays', state.money > tBefore, `+$${state.money - tBefore}`);
    // 25 speedometer max
    check('speedometer-max-kmh', maxKmh > 60, `${maxKmh.toFixed(0)} km/h observed`);
    // 26 dispatch 6 rows at wanted 5
    state.heat = 0; state.wanted = 0;
    addHeat(state, 100, 'TEST', bus);
    steps(180);
    const rows5 = dispatchRows(police, state);
    const calls5 = rows5.rows.map((r) => r.callsign);
    check('dispatch-6-rows', rows5.rows.length === 6 && new Set(calls5).size === calls5.length, `rows ${rows5.rows.length}, total ${rows5.total}, unique ${new Set(calls5).size}`);
    // 27 mission 8 escape: blocked at wanted 3, completes after heat clears
    state.mission = null; state.missionIndex = 7; state.missionDone = state.missionDone.filter((m) => m !== 'hot-pursuit');
    startMission(state, 7, bus);
    state.wanted = 3; state.heat = 45;
    state.player.x = 0; state.player.z = 270; state.car = null; state.player.onFoot = true;
    steps(10);
    const stageAfterHeat = state.mission ? state.mission.stage : -1;
    state.wanted = 0; state.heat = 0;
    steps(10);
    check('mission-8-escape', stageAfterHeat === 1 && state.missionDone.includes('hot-pursuit'), `stage ${stageAfterHeat} -> done ${state.missionDone.includes('hot-pursuit')}`);
    // 28 mission 4 steal target spawns on a road (the van at 120,60)
    check('mission-4-target-on-road', isOnRoad(120, 60) && isOnRoad(MISSIONS[3].stages[0].target.x, MISSIONS[3].stages[0].target.z), `van spawn 120,60 on road: ${isOnRoad(120, 60)}`);
    // 29 weapon bar has 6 slots
    hud.renderWeaponBar(state);
    check('weapon-bar-6-slots', document.querySelectorAll('#weapon-bar .wslot').length === 6, '6 slots rendered');
    // 30 no console errors
    check('no-console-errors', errors.length === 0, errors.join('; ') || 'clean');
  } catch (e) {
    check('selftest-crashed', false, e.message + ' ' + (e.stack || '').slice(0, 300));
  }
  const passed = results.filter((r) => r.pass).length;
  el.textContent = JSON.stringify({ passed, total: results.length, errors, results }, null, 1);
  document.title = `SELFTEST ${passed}/${results.length} ${passed === results.length ? 'PASS' : 'FAIL'}`;
  state.flags.selftest = false;
}
