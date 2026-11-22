// Arcade driving: throttle, steering that tightens with speed, handbrake
// slides, nitro, horn, carjacking. The speedometer reads real velocity.
import * as THREE from 'three';
import { VEHICLES } from './config.js';

export function vehicleDef(id) { return VEHICLES.find((v) => v.id === id) || VEHICLES[0]; }

export function upgradeTop(def, garage) {
  return def.top * (1 + 0.12 * garage.engine) * (garage.nitro > 0 ? 1.0 : 1.0);
}

export function enterCar(state, defId, x, z, heading) {
  const def = vehicleDef(defId);
  state.car = { defId, x, z, heading, speed: 0, damage: 0, nitro: 100, upgrades: { ...state.garage } };
  state.player.onFoot = false;
  state.stats.stolen += 1;
  return state.car;
}

export function exitCar(state) {
  if (!state.car) return;
  state.player.x = state.car.x + Math.sin(state.car.heading + Math.PI / 2) * 2.2;
  state.player.z = state.car.z + Math.cos(state.car.heading + Math.PI / 2) * 2.2;
  state.player.heading = state.car.heading;
  state.player.onFoot = true;
}

export function updateDriving(state, input, dt, bus) {
  const car = state.car;
  if (!car) return 0;
  const def = vehicleDef(car.defId);
  const top = upgradeTop(def, car.upgrades);
  const ax = input.axis();
  const handbrake = input.down('Space');
  const nitro = input.down('ShiftLeft') || input.down('ShiftRight');
  const maxSpeed = top * (nitro && car.upgrades.nitro > 0 && car.nitro > 0 ? 1.35 : 1);
  if (nitro && car.upgrades.nitro > 0 && car.speed > 5) car.nitro = Math.max(0, car.nitro - 30 * dt);
  else car.nitro = Math.min(100, car.nitro + 8 * dt);
  if (ax.y > 0) car.speed += def.accel * (nitro && car.nitro > 0 ? 1.5 : 1) * dt;
  else if (ax.y < 0) car.speed -= def.accel * 0.8 * dt;
  else car.speed -= Math.sign(car.speed) * Math.min(Math.abs(car.speed), 6 * dt);
  if (handbrake) car.speed -= Math.sign(car.speed) * Math.min(Math.abs(car.speed), 22 * dt);
  car.speed = THREE.MathUtils.clamp(car.speed, -top * 0.35, maxSpeed);
  const steer = ax.x * (handbrake ? 1.6 : 1);
  const turnRate = def.grip * (0.35 + 0.65 * Math.min(1, Math.abs(car.speed) / 20));
  car.heading -= steer * turnRate * dt * Math.sign(car.speed || 1) * (car.speed < 0 ? -1 : 1) * (handbrake ? 1.4 : 1);
  car.x += Math.sin(car.heading) * car.speed * dt;
  car.z += Math.cos(car.heading) * car.speed * dt;
  // Keep inside the city; the sea blocks the west edge.
  car.x = THREE.MathUtils.clamp(car.x, -248, 292);
  car.z = THREE.MathUtils.clamp(car.z, -292, 292);
  state.stats.km += Math.abs(car.speed) * dt / 1000;
  if (car.speed > 28) {
    // Speeding draws a little heat in busy districts (deterministic tick).
    state.flags.speedTick = (state.flags.speedTick || 0) + dt;
    if (state.flags.speedTick > 10) {
      state.flags.speedTick = 0;
      bus.emit('crime', { kind: 'speeding', amount: 0.4 });
    }
  }
  if (input.down('KeyH')) bus.emit('horn', {});
  return car.speed;
}

// Carjacking: the nearest traffic car within 4 m is taken when E is pressed.
export function tryCarjack(state, traffic, bus) {
  let best = null, bd = 16;
  for (const c of traffic.cars) {
    const d = (c.mesh.position.x - state.player.x) ** 2 + (c.mesh.position.z - state.player.z) ** 2;
    if (d < bd) { bd = d; best = c; }
  }
  if (!best) return null;
  const def = best.def;
  enterCar(state, def.id, best.mesh.position.x, best.mesh.position.z, best.mesh.rotation.y);
  state.car.damage = 0;
  // Remove the jacked car from traffic and respawn it later as a fresh car.
  best.mesh.visible = false;
  best.gone = true;
  bus.emit('crime', { kind: 'carjacking', amount: 6 });
  bus.emit('message', { text: `You took the ${def.name}. The owner ran off shouting.` });
  return def;
}
