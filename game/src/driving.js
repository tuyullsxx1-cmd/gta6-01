// driving.js — arcade driving physics, carjacking, enter/exit, speed and
// damage on the HUD. Written from the prose spec.
import { damageCar } from './vehicles.js';

const NO_INPUT = {
  isDown: () => false,
  pressed: () => false,
};
const NO_BUS = {
  on: () => {},
  emit: () => {},
  off: () => {},
};

function clamp(v, a, b) {
  return Math.min(b, Math.max(a, v));
}

function collideCircle(x, z, radius, colliders) {
  // Push a circle out of building AABBs. Returns corrected {x, z, hit}.
  let hit = false;
  for (const c of colliders || []) {
    const nx = clamp(x, c.x - c.hx, c.x + c.hx);
    const nz = clamp(z, c.z - c.hz, c.z + c.hz);
    const dx = x - nx;
    const dz = z - nz;
    const d2 = dx * dx + dz * dz;
    if (d2 < radius * radius) {
      hit = true;
      if (d2 > 0.0001) {
        const d = Math.sqrt(d2);
        x = nx + (dx / d) * radius;
        z = nz + (dz / d) * radius;
      } else {
        // Centre inside the box: push out along the smaller axis.
        const px = c.hx + radius - Math.abs(x - c.x);
        const pz = c.hz + radius - Math.abs(z - c.z);
        if (px < pz) x += (x >= c.x ? px : -px);
        else z += (z >= c.z ? pz : -pz);
      }
    }
  }
  return { x, z, hit };
}

export function createDriving(state, bus, input, world) {
  const keys = input || NO_INPUT;
  const events = bus || NO_BUS;
  const city = (world && world.city) || null;
  const cars = (world && world.cars) || [];
  const colliders = (city && city.colliders) || [];

  const drive = {
    inCar: false,
    car: null,
    steer: 0,
    nitroLeft: 0,
  };

  function playerPos() {
    return state.player || { x: 0, z: 0, heading: 0 };
  }

  function nearestCar(maxDist) {
    const p = playerPos();
    let best = null;
    let bestD = maxDist;
    for (const car of cars) {
      if (car.exploded) continue;
      const dx = car.x - p.x;
      const dz = car.z - p.z;
      const d = Math.sqrt(dx * dx + dz * dz);
      if (d < bestD) {
        bestD = d;
        best = car;
      }
    }
    return best;
  }

  function enterCar(car) {
    if (!car || car.exploded) return false;
    drive.inCar = true;
    drive.car = car;
    drive.steer = 0;
    drive.nitroLeft = 3; // seconds of nitro, refills when not used
    // Once the player takes a car it leaves traffic for good: the traffic
    // AI must not keep driving it (it would fight the player's input and
    // drive staged shot cars away during settling).
    car.playerDriven = true;
    state.player.onFoot = false;
    state.player.currentCar = car.id;
    state.player.x = car.x;
    state.player.z = car.z;
    state.player.heading = car.heading;
    events.emit('entered-car', { car });
    return true;
  }

  function exitCar() {
    const car = drive.car;
    if (!car) return false;
    // Step out to the driver's side.
    const sideX = car.x + Math.cos(car.heading) * 2.2;
    const sideZ = car.z - Math.sin(car.heading) * 2.2;
    state.player.x = sideX;
    state.player.z = sideZ;
    state.player.heading = car.heading;
    state.player.speedKmh = 0;
    state.player.onFoot = true;
    state.player.currentCar = null;
    car.speed = 0;
    drive.inCar = false;
    drive.car = null;
    events.emit('exited-car', { car });
    return true;
  }

  function tryCarjack() {
    const car = nearestCar(4.5);
    if (!car) return false;
    const wasParked = car.speed === 0;
    const ok = enterCar(car);
    if (ok) {
      if (state.stats) state.stats.carsStolen = (state.stats.carsStolen || 0) + 1;
      events.emit('carjacked', { car, wasParked });
      // Taking a car that is not yours is a crime where you stand.
      events.emit('crime', { type: 'carjacking', x: car.x, z: car.z });
    }
    return ok;
  }

  function damageRide(amount) {
    const car = drive.car;
    if (!car) return;
    damageCar(car, amount, { scene: world && world.scene, bus: events, cars });
    events.emit('ride-damaged', { car, damage: car.damage });
  }

  function update(dt) {
    const p = playerPos();
    if (!drive.inCar || !drive.car) {
      // On foot: E near a car takes it — unless a dialogue box is up,
      // in which case E advances the dialogue instead.
      if (keys.pressed && keys.pressed('KeyE')) {
        if (state.flags && state.flags.dialogue) return;
        tryCarjack();
      }
      return;
    }
    const car = drive.car;
    const def = car.def;
    const upgrades = (state.garage && state.garage.upgrades && state.garage.upgrades[car.id]) || {};
    const engineLvl = upgrades.engine || 0;
    const hasNitro = upgrades.nitro === true;

    // E exits the car — unless a dialogue box is up, in which case E
    // advances the dialogue instead.
    if (keys.pressed && keys.pressed('KeyE')) {
      if (state.flags && state.flags.dialogue) return;
      exitCar();
      return;
    }

    const topSpeed = (def.topSpeed / 3.6) * (1 + engineLvl * 0.12);
    const accel = def.accel * (1 + engineLvl * 0.1);
    const forward = keys.isDown('KeyW') || keys.isDown('ArrowUp');
    const back = keys.isDown('KeyS') || keys.isDown('ArrowDown');
    const left = keys.isDown('KeyA') || keys.isDown('ArrowLeft');
    const right = keys.isDown('KeyD') || keys.isDown('ArrowRight');
    const handbrake = keys.isDown('Space');
    const wantNitro = hasNitro && keys.isDown('ShiftLeft') && forward;

    // Nitro: short burst from a 3-second reserve that refills slowly.
    if (wantNitro && drive.nitroLeft > 0) {
      drive.nitroLeft = Math.max(0, drive.nitroLeft - dt);
    } else {
      drive.nitroLeft = Math.min(3, drive.nitroLeft + dt * 0.4);
    }
    const nitroBoost = wantNitro && drive.nitroLeft > 0 ? 1.45 : 1;

    // Longitudinal physics: accelerate, brake, reverse, drag.
    if (forward) {
      car.speed += accel * nitroBoost * dt;
    } else if (back) {
      if (car.speed > 0.5) car.speed -= accel * 1.6 * dt; // brake
      else car.speed -= accel * 0.55 * dt; // reverse
    } else {
      car.speed -= car.speed * 0.6 * dt; // coast drag
    }
    if (handbrake) {
      car.speed -= car.speed * 3.2 * dt;
    }
    const maxReverse = topSpeed * 0.35;
    car.speed = clamp(car.speed, -maxReverse, topSpeed * nitroBoost);

    // Steering: less turn at speed, sharper with the handbrake.
    const speedFrac = clamp(Math.abs(car.speed) / topSpeed, 0, 1);
    const steerTarget = (left ? 1 : 0) - (right ? 1 : 0);
    drive.steer += (steerTarget - drive.steer) * Math.min(1, 8 * dt);
    const turnRate = (handbrake ? 2.4 : 1.5) * def.handling * (1 - speedFrac * 0.55);
    const dirSign = car.speed >= 0 ? 1 : -1;
    car.heading += drive.steer * turnRate * dirSign * Math.min(1, Math.abs(car.speed) / 6 + 0.15) * dt;

    // Integrate and collide with buildings.
    const prevX = car.x;
    const prevZ = car.z;
    const nx = car.x + Math.sin(car.heading) * car.speed * dt;
    const nz = car.z + Math.cos(car.heading) * car.speed * dt;
    const fixed = collideCircle(nx, nz, 1.6, colliders);
    const impact = Math.abs(car.speed);
    car.x = clamp(fixed.x, -292, 292);
    car.z = clamp(fixed.z, -292, 292);
    if (fixed.hit && impact > 6) {
      // A hard hit damages the ride; faster hits hurt more.
      const dmg = Math.min(24, (impact - 6) * 0.9);
      damageCar(car, dmg, { scene: world && world.scene, bus: events, cars });
      events.emit('crash', { car, damage: car.damage, speed: impact });
      car.speed *= 0.35;
    } else if (fixed.hit) {
      car.speed *= 0.7;
    }
    if ((prevX !== car.x || prevZ !== car.z) && state.stats) {
      state.stats.distanceDriven = (state.stats.distanceDriven || 0) +
        Math.sqrt((car.x - prevX) ** 2 + (car.z - prevZ) ** 2);
    }

    // Horn.
    if (keys.pressed && keys.pressed('KeyH')) {
      events.emit('honk', { x: car.x, z: car.z });
    }

    // Sync the car mesh and the player state to the HUD.
    car.group.position.set(car.x, 0, car.z);
    car.group.rotation.y = car.heading;
    p.x = car.x;
    p.z = car.z;
    p.heading = car.heading;
    p.speedKmh = Math.round(Math.abs(car.speed) * 3.6);
    state.player.damage = Math.round(car.damage);
  }

  return {
    drive,
    update,
    enterCar,
    exitCar,
    tryCarjack,
    nearestCar,
    damageRide,
    // Drop the driving state without moving the player (used after a
    // save is loaded, where the saved ride no longer exists). The dropped
    // car returns to traffic.
    reset() {
      if (drive.car) drive.car.playerDriven = false;
      drive.inCar = false;
      drive.car = null;
      drive.steer = 0;
    },
    isInCar: () => drive.inCar,
    currentCar: () => drive.car,
  };
}
