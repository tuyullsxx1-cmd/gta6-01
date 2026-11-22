// Staged screenshots: shot=start (neon cover), drive (marina),
// chase (casino plaza), mission (on foot with Vera). Fixed seed, fixed
// staging, so every retake matches the last one.
import { PLACES } from './city.js';
import { enterCar } from './driving.js';
import { startMission } from './missions.js';
import { addHeat } from './police.js';

export const SHOTS = {
  start: { file: '1-cover.jpg', label: 'Neon cover — night avenue at speed' },
  drive: { file: '2-marina.jpg', label: 'Marina at blue hour' },
  chase: { file: '3-plaza.jpg', label: 'Golden-hour casino plaza' },
  mission: { file: '4-mission.jpg', label: 'Mission moment on foot' },
};

export function applyShot(name, ctx) {
  const { state, bus } = ctx;
  state.started = true;
  state.flags.shot = name;
  // Hide the title screen; the HUD stays fully visible.
  const title = document.getElementById('title-screen');
  if (title) title.classList.add('hidden');
  if (name === 'start') {
    // Neon cover: blue hour sliding into night, gold Solano GT at speed on
    // the neon avenue — the low sun still kisses the paint.
    state.dayTime = 0.80; state.day = 3;
    enterCar(state, 'solano', 0, -120, Math.PI);
    state.car.speed = 16; // cruising the neon avenue, staying in the dense blocks
    state.money = 1250; state.rp = 620;
    state.camera.dist = 6.8;
    addHeat(state, 22, 'SPEEDING', bus); // wanted 1, dispatch alive
    state.dispatchTicker = 'MCPD: all units, be advised — suspect vehicle last seen downtown.';
    bus.emit('message', { text: 'Welcome to Maravilla, Milo.' });
    bus.emit('message', { text: 'NEXT JOB: FIRST LIGHT — meet Vera at Downtown Plaza.' });
    bus.emit('message', { text: 'MCPD: suspect vehicle speeding on the neon avenue.' });
    state.flags.shotCam = null;
  } else if (name === 'drive') {
    // Marina: blue hour, camera ON the pier road looking WEST at the yachts
    // moored just off the pier, with open water behind them.
    state.dayTime = 0.72; state.day = 3;
    enterCar(state, 'solano', -258, -168, -Math.PI / 2);
    state.car.speed = 6;
    state.money = 1250; state.rp = 620;
    state.camera.dist = 6.8;
    bus.emit('message', { text: 'Welcome to Maravilla, Milo.' });
    bus.emit('message', { text: 'NEXT JOB: FIRST LIGHT — meet Vera at Downtown Plaza.' });
    bus.emit('message', { text: 'Juno: the boat is fuelled. One last score, Milo.' });
    state.flags.shotCam = null;
  } else if (name === 'chase') {
    // Plaza: golden hour, casino CENTRED ahead, car big and red.
    // Fixed camera tilted UP: the car at the bottom, the tower, the gold
    // sign and the neon crown all in frame.
    state.dayTime = 0.68; state.day = 3;
    enterCar(state, 'cometa', 180, -52, Math.PI);
    state.car.speed = 6;
    state.money = 1250; state.rp = 620;
    state.camera.dist = 6.8;
    addHeat(state, 45, 'STREET RACING', bus); // wanted 3: roadblocks + dispatch
    bus.emit('message', { text: 'Welcome to Maravilla, Milo.' });
    bus.emit('message', { text: 'NEXT JOB: FIRST LIGHT — meet Vera at Downtown Plaza.' });
    bus.emit('message', { text: 'MCPD: pursuit on the casino avenue.' });
    state.flags.shotCam = { pos: [180, 2.2, -46], look: [180, 12, -120] };
  } else if (name === 'mission') {
    // Mission: ON FOOT, Milo visible next to Vera on the patterned plaza.
    state.dayTime = 0.66; state.day = 3;
    state.player.x = 4; state.player.z = 38; state.player.heading = Math.PI;
    state.player.onFoot = true;
    state.car = null;
    state.money = 1250; state.rp = 620;
    startMission(state, 0, bus);
    ctx.placeVera && ctx.placeVera(8, 34);
    bus.emit('dialogue', { who: 'vera', text: 'Milo Vane. Fresh off the boat, fast hands, faster car. I like that.' });
    bus.emit('message', { text: 'MISSION 1 · FIRST LIGHT — STAGE 1/3: MEET VERA' });
    bus.emit('message', { text: 'NEXT: Meet Vera at Downtown Plaza.' });
    // Fixed close camera: Milo large centre-bottom, Vera just ahead of him
    // to the right, fountain and plaza pattern behind them.
    state.flags.shotCam = { pos: [4, 2.6, 44], look: [5, 1.3, 34] };
  }
  state.flags.shotReady = false;
  state.flags.snapCamera = true;
  // Let the scene settle (traffic, lights, water) before the screenshot.
  setTimeout(() => { state.flags.shotReady = true; document.title = 'SHOT READY ' + name; }, 2500);
}
