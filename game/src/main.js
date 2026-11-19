// Maravilla — boot and the one loop: the city renders, the crew's systems
// run, and ?shot=start|drive|chase|mission stages a fixed frame for
// screenshots. Every system is created here, in dependency order, and shares
// one ctx object; systems talk to each other only through state.* and the
// event bus, never by importing each other.

import * as THREE from 'three';
import { STEP } from './config.js';
import { createState } from './state.js';
import { createEvents } from './events.js';
import { createInput, ACTION_CONFIRM, ACTION_PAUSE } from './input.js';
import { createRenderer } from './render.js';
import { buildCity } from './city.js';
import { createRandom } from './random.js';
import { createAudio } from './audio.js';
import { createHud } from './hud.js';
import { createVehicles } from './vehicles.js';
import { createTraffic } from './traffic.js';
import { createDriving } from './driving.js';
import { createPlayer } from './player.js';
import { createPolice } from './police.js';
import { createWeapons } from './weapons.js';
import { createMissions } from './missions.js';
import { createPhone } from './phone.js';
import { createGarage } from './garage.js';
import { createSave } from './save.js';
import { createDistricts } from './districts.js';
import { createPause } from './pause.js';
import { createSide } from './side.js';
import { stageShot } from './shots.js';

const MAX_FRAME = 0.25;

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : Math.floor(Math.random() * 4294967296);

const canvas = document.getElementById('game');
const status = document.getElementById('status');
const rng = createRandom(seed);
const state = createState(seed);
const events = createEvents();
const input = createInput(canvas);
const renderer = createRenderer(canvas);
const city = buildCity(renderer.scene, rng);
renderer.setCity(city);

function resize() {
  renderer.resize(window.innerWidth, window.innerHeight);
}
window.addEventListener('resize', resize);
resize();

// Systems, in dependency order: audio and the HUD first (everyone calls
// them lazily through ctx), then the world (vehicles, traffic), then the
// actors (driving, player, police, weapons, missions), then the phone,
// the garage and the save. Cross-links (ctx.vehicles, ctx.missions,
// ctx.police) are filled in as each system is created, because later
// systems read them off ctx.
const ctx = {
  state, scene: renderer.scene, camera: renderer.camera, renderer,
  input, audio: null, hud: null, events, city, THREE, rng,
  vehicles: null, missions: null, police: null, phone: null,
};
const audio = createAudio(ctx);
ctx.audio = audio;
const hud = createHud(ctx);
ctx.hud = hud;
const vehicles = createVehicles(ctx);
ctx.vehicles = vehicles;
const traffic = createTraffic(ctx);
const driving = createDriving(ctx);
const player = createPlayer(ctx);
const police = createPolice(ctx);
ctx.police = police;
const weapons = createWeapons(ctx);
ctx.weapons = weapons;
const missions = createMissions(ctx);
ctx.missions = missions;
const phone = createPhone(ctx);
ctx.phone = phone;
const garage = createGarage(ctx);
const save = createSave(ctx);
ctx.save = save;
const districts = createDistricts(ctx);
const pause = createPause(ctx);
ctx.pause = pause;
const side = createSide(ctx);
ctx.side = side;

const systems = [
  audio, hud, vehicles, traffic, driving, player, police, weapons,
  missions, phone, garage, save, districts, pause, side,
];

// Debug handle for headless playtesting (CDP evals read window.__game).
window.__game = {
  state, systems, input, events,
  driving, missions, police, weapons, vehicles, phone, garage, save, pause, side,
};

function step(dt) {
  state.time += dt;
  const prevDayTime = state.dayTime;
  state.dayTime = (state.dayTime + dt / 480) % 1; // one full day every 8 minutes
  if (state.dayTime < prevDayTime) state.day += 1; // wrapped past midnight
  for (const sys of systems) sys.update(dt);
  renderer.setDayTime(state.dayTime);
  renderer.updateCamera(state, dt);
}

// Camera orbit: mouse drag orbits, wheel zooms. Movement itself belongs to
// the player (on foot) and driving (in a car) systems.
function orbit(dt) {
  const drag = input.takeDrag();
  state.camera.yaw -= drag.x * 0.005;
  state.camera.pitch = Math.max(0.05, Math.min(1.2, state.camera.pitch + drag.y * 0.003));
  state.camera.dist = Math.max(5, Math.min(40, state.camera.dist + input.takeWheel() * 0.01));
}

function runShot(name) {
  const staged = stageShot(name, state, { renderer, city, systems, driving, missions, police, vehicles, step });
  // Shot mode never runs runGame, so the title screen would otherwise stay
  // over every gameplay shot: hide it unless the shot IS the title screen.
  const title = document.getElementById('title-screen');
  if (title) title.style.display = staged.screen === 'title' ? '' : 'none';
  const pause = document.getElementById('pause-screen');
  if (pause) pause.style.display = 'none';
  let painted = 0;
  function paint() {
    renderer.setDayTime(state.dayTime);
    renderer.updateCamera(state, 1 / 60);
    renderer.draw();
    painted += 1;
    if (painted < 2) requestAnimationFrame(paint);
    else window.__shotReady = true;
  }
  requestAnimationFrame(paint);
  return staged;
}

function runGame() {
  let accumulator = 0;
  let last = performance.now();
  status.textContent = 'Maravilla. Press Enter to play.';

  function frame(now) {
    requestAnimationFrame(frame);
    accumulator += Math.min((now - last) / 1000, MAX_FRAME);
    last = now;
    const actions = input.takeActions();
    if (actions & ACTION_CONFIRM && state.screen === 'title') {
      state.screen = 'play';
      document.getElementById('title-screen').style.display = 'none';
      status.textContent = 'Playing. Explore Maravilla.';
    } else if (actions & ACTION_PAUSE && state.screen === 'play') {
      state.screen = 'paused';
    } else if (actions & ACTION_PAUSE && state.screen === 'paused') {
      state.screen = 'play';
    }
    // The tabbed pause menu owns the paused screen (the plain #pause-screen
    // div is no longer used); show/hide it on the flip.
    if (state.screen === 'paused') pause.show();
    else pause.hide();
    // The city stays alive behind the title screen (traffic drives, the
    // clock runs); pause and the end screens freeze the simulation.
    if (state.screen === 'play' || state.screen === 'title') {
      orbit(STEP);
      while (accumulator >= STEP) {
        step(STEP);
        accumulator -= STEP;
      }
    } else {
      accumulator = 0;
      renderer.setDayTime(state.dayTime);
      renderer.updateCamera(state, STEP);
    }
    renderer.draw();
  }
  requestAnimationFrame(frame);
}

if (shot) runShot(shot);
else runGame();
