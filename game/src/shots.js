// shots.js — staged screenshot scenes for MARAVILLA.
// Each shot is a deterministic setup driven by ?shot= and &seed=:
//   start   — title screen over the city at golden hour
//   drive   — Rook driving on Paseo del Mar, car big and centre-frame
//   chase   — a three-star chase with patrol cars and a roadblock ahead
//   mission — mission 1 at the garage, dialogue above the weapon bar
// The car sits at about 24% of frame height in drive/chase/mission, and
// every shot keeps the streets populated.

import { createCar, VEHICLE_DEFS } from './vehicles.js';
import { PLACES } from './missions.js';

const GOLDEN_HOUR = 1020; // 17:00 — low warm sun

// Tiny seeded generator so each shot's dressing is stable for its seed.
function mulberry32(seed) {
  let a = (seed >>> 0) || 0x9e3779b9;
  return function next() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const SHOT_CAR_COLORS = [0xd94f4f, 0x2e7f8f, 0xf2b13c, 0x2b4a6f];

// Move the nearest street car to (x, z) and put Rook in it; if nothing is
// close, build a fresh one there instead.
function placeCarAt(game, x, z, heading, rng) {
  let car = null;
  let best = Infinity;
  for (const c of game.allCars) {
    if (c.exploded) continue;
    const d = Math.hypot(c.x - x, c.z - z);
    if (d < best) {
      best = d;
      car = c;
    }
  }
  if (!car || best > 80) {
    const def = VEHICLE_DEFS[Math.floor(rng() * 4)];
    const color = SHOT_CAR_COLORS[Math.floor(rng() * SHOT_CAR_COLORS.length)];
    car = createCar(def, color);
    game.city.scene.add(car.group);
    game.allCars.push(car);
  }
  car.x = x;
  car.z = z;
  car.heading = heading;
  car.speed = 0;
  car.damage = 0;
  car.group.position.set(x, 0, z);
  car.group.rotation.y = heading;
  game.driving.enterCar(car);
  return car;
}

// Pull a few traffic cars and pedestrians onto the street around (x, z)
// so the shot never shows an empty road. pedCount defaults to 10.
function populateStreet(game, x, z, rng, pedCount) {
  const drivers = game.traffic.drivers || [];
  const roadX = x;
  for (let i = 0; i < Math.min(4, drivers.length); i++) {
    const t = drivers[i];
    const car = t.car;
    if (!car || car.exploded) continue;
    const lane = i % 2 === 0 ? 3.2 : -3.2;
    car.x = roadX + lane;
    car.z = z + (i - 1.5) * 26 + rng() * 6;
    car.heading = i % 2 === 0 ? 0 : Math.PI;
    t.axis = 'z';
    t.speed = t.cruise || 9;
    car.group.position.set(car.x, 0, car.z);
    car.group.rotation.y = car.heading;
  }
  const peds = game.traffic.peds || [];
  const n = pedCount || 10;
  for (let i = 0; i < Math.min(n, peds.length); i++) {
    const p = peds[i];
    p.x = x + (rng() * 36 - 18);
    p.z = z + (rng() * 60 - 30);
    p.tx = x + (rng() * 40 - 20);
    p.tz = z + (rng() * 60 - 30);
    p.mesh.position.set(p.x, 0, p.z);
  }
}

function hideTitle(game) {
  game.state.flags.title = false;
  const title = document.getElementById('title-screen');
  if (title) title.style.display = 'none';
}

function showTitle(game) {
  game.state.flags.title = true;
  const title = document.getElementById('title-screen');
  if (title) title.style.display = 'flex';
}

export function stageShot(game, name, seed) {
  const rng = mulberry32(typeof seed === 'number' ? seed : 20261120);
  const state = game.state;
  game.setClock(1, GOLDEN_HOUR);

  if (name === 'start') {
    showTitle(game);
    state.wanted.level = 0;
    state.wanted.heat = 0;
    state.wanted.crime = '';
    game.teleport(
      game.city.spawnPoints.playerStart.x,
      game.city.spawnPoints.playerStart.z
    );
    state.player.heading = Math.PI * 0.75;
    game.renderer.setZoom(13);
    return { shot: 'start', seed };
  }

  if (name === 'drive') {
    hideTitle(game);
    // Paseo del Mar avenue, on the road line x = -150, heading north.
    // A crowd frame: 16 pedestrians pulled onto the avenue.
    placeCarAt(game, -150, 60, 0, rng);
    populateStreet(game, -150, 60, rng, 16);
    game.setWanted(0);
    game.renderer.setZoom(11);
    return { shot: 'drive', seed };
  }

  if (name === 'chase') {
    hideTitle(game);
    // Northbound on the Centro Alba avenue, wanted 3, units closing in.
    // The car sits mid-block (z=-30) so the chase camera is clear of the
    // intersection buildings. The tail units start ~105m back: during the
    // 5s settle they close to ~30m behind the player — still behind the
    // camera, so they never pile onto the player's car in frame.
    placeCarAt(game, 50, -30, 0, rng);
    populateStreet(game, 50, -30, rng);
    game.setWanted(3);
    // Stage the pursuit: ALL patrol/rammer units go on the player's tail,
    // staggered 105-135m back, and the roadblock just ahead. (Wanted 3
    // deploys 3 patrol + 1 rammer; capping the loop at 2 left the others
    // deployed on top of the player, and they piled onto the car in frame
    // during the settle.) After the 5s settle they sit ~25-70m behind the
    // player — still behind the camera, so the player's car stays clear.
    const units = game.police.getUnits();
    const p = state.player;
    let tail = 0;
    for (const u of units) {
      if (u.type === 'patrol' || u.type === 'rammer') {
        const back = 105 + tail * 10;
        const side = tail % 2 === 0 ? -4 : 5;
        u.x = p.x + Math.cos(p.heading) * side - Math.sin(p.heading) * back;
        u.z = p.z - Math.sin(p.heading) * side - Math.cos(p.heading) * back;
        tail += 1;
      }
      if (u.type === 'roadblock') {
        u.x = p.x + Math.sin(p.heading) * 38;
        u.z = p.z + Math.cos(p.heading) * 38;
      }
    }
    game.renderer.setZoom(11.5);
    return { shot: 'chase', seed };
  }

  if (name === 'mission') {
    hideTitle(game);
    // Mission 1 at Celia's Garage: Rook in a car by the garage door,
    // the FIRST KEYS briefing open above the weapon bar.
    const g = PLACES.garage;
    placeCarAt(game, g.x + 8, g.z + 10, Math.PI * 0.85, rng);
    populateStreet(game, g.x, g.z, rng);
    game.setWanted(0);
    game.startMission(1);
    game.renderer.setZoom(11);
    return { shot: 'mission', seed };
  }

  return { shot: name || 'unknown', seed };
}

export default stageShot;
