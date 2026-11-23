// Staged screenshots: shot=start (neon cover), drive (marina),
// chase (casino plaza), mission (on foot with Vera). Fixed seed, fixed
// staging, so every retake matches the last one.
import { PLACES } from './city.js';
import { enterCar, vehicleDef } from './driving.js';
import { buildCarMesh } from './vehicles.js';
import { dressCar } from './realism.js';
import { startMission } from './missions.js';
import { addHeat } from './police.js';

export const SHOTS = {
  start: { file: '1-cover.jpg', label: 'Neon cover — night avenue at speed' },
  drive: { file: '2-marina.jpg', label: 'Marina at blue hour' },
  chase: { file: '3-plaza.jpg', label: 'Golden-hour casino plaza' },
  mission: { file: '4-mission.jpg', label: 'Mission moment on foot' },
};

export function applyShot(name, ctx) {
  const { state, bus, scene } = ctx;
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
    state.camera.dist = 5.2; // closer chase camera: the Solano reads big
    addHeat(state, 22, 'SPEEDING', bus); // wanted 1, dispatch alive
    state.dispatchTicker = 'MCPD: all units, be advised — suspect vehicle last seen downtown.';
    bus.emit('message', { text: 'Welcome to Maravilla, Milo.' });
    bus.emit('message', { text: 'NEXT JOB: FIRST LIGHT — meet Vera at Downtown Plaza.' });
    bus.emit('message', { text: 'MCPD: suspect vehicle speeding on the neon avenue.' });
    // Two oncoming cars filling the avenue ahead of the Solano. They sit
    // far ahead: at screenshot time the Solano has covered ~100 units, so
    // cars at -150 would already be behind it.
    for (const [x, z, def] of [[5, -238, 'alba'], [-5, -262, 'brisa']]) {
      const c = buildCarMesh(vehicleDef(def), { seed: 4242 + x });
      c.position.set(x, 0, z);
      dressCar(c);
      scene.add(c);
    }
    state.flags.shotCam = null;
  } else if (name === 'drive') {
    // Marina: blue hour, camera ON the pier road looking WEST at the yachts
    // moored just off the pier, with open water behind them.
    state.dayTime = 0.72; state.day = 3;
    enterCar(state, 'solano', -258, -168, -Math.PI / 2);
    state.car.speed = 0; // parked on the pier road, engine off
    state.money = 1250; state.rp = 620;
    state.camera.dist = 10; // pulled back: the Solano smaller, the marina bigger
    bus.emit('message', { text: 'Welcome to Maravilla, Milo.' });
    bus.emit('message', { text: 'NEXT JOB: FIRST LIGHT — meet Vera at Downtown Plaza.' });
    bus.emit('message', { text: 'Juno: the boat is fuelled. One last score, Milo.' });
    // Chase camera, not a fixed one: the fixed pier camera cut the Solano
    // out of the frame. Parked, the chase rig sits behind the car looking
    // west at the moored yachts and open water.
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
    // Slightly higher and further back so the interceptors and parked cars
    // fill the foreground and the casino crown stays in frame.
    state.flags.shotCam = { pos: [180, 2.8, -38], look: [180, 10, -120] };
  } else if (name === 'mission') {
    // Mission: ON FOOT, Milo visible next to Vera on the patterned plaza.
    state.dayTime = 0.66; state.day = 3;
    state.player.x = 4; state.player.z = 38; state.player.heading = Math.PI;
    state.player.onFoot = true;
    state.car = null;
    state.money = 1250; state.rp = 620;
    startMission(state, 0, bus);
    ctx.placeVera && ctx.placeVera(7, 32);
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
