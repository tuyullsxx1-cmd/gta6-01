// vehicles.js — low-poly car factory, parked cars, damage, burning,
// explosions that chain to nearby cars. Written from the prose spec.
import * as THREE from 'three';

export const VEHICLE_DEFS = [
  { id: 'brisa', name: 'Brisa', kind: 'car', topSpeed: 132, accel: 14, handling: 1.0, seats: 4 },
  { id: 'solano', name: 'Solano', kind: 'car', topSpeed: 148, accel: 16, handling: 1.05, seats: 4 },
  { id: 'coral', name: 'Coral', kind: 'car', topSpeed: 158, accel: 18, handling: 1.15, seats: 2 },
  { id: 'arena', name: 'Arena', kind: 'car', topSpeed: 140, accel: 13, handling: 0.9, seats: 5 },
  { id: 'carguero', name: 'Carguero', kind: 'van', topSpeed: 118, accel: 10, handling: 0.8, seats: 3 },
  { id: 'picuda', name: 'Picuda 250', kind: 'bike', topSpeed: 176, accel: 22, handling: 1.35, seats: 2 },
  { id: 'tormenta', name: 'Tormenta S', kind: 'sports', topSpeed: 205, accel: 26, handling: 1.3, seats: 2 },
];

export const CAR_COLORS = [
  0xc0392b, 0x2c4a6e, 0xf5d76e, 0x7ec8c0, 0xe8e0cc,
  0xe87a5d, 0x5a4a6e, 0x3d8b4f, 0xdddddd, 0x222222,
];

let carCounter = 0;

function lam(color) {
  return new THREE.MeshLambertMaterial({ color });
}

function box(w, h, d, material, x, y, z) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
  m.position.set(x, y, z);
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}

function wheel(r, w, x, y, z) {
  const m = new THREE.Mesh(
    new THREE.CylinderGeometry(r, r, w, 12),
    lam(0x1a1a1a)
  );
  m.rotation.z = Math.PI / 2;
  m.position.set(x, y, z);
  m.castShadow = true;
  return m;
}

// Build one low-poly vehicle as a THREE.Group and wrap it in a car record.
// def: one of VEHICLE_DEFS. color: hex number.
export function createCar(def, color) {
  const group = new THREE.Group();
  group.name = 'car-' + def.id;
  const paint = lam(color != null ? color : 0xc0392b);
  const glass = lam(0x1e2f3f);
  const trim = lam(0x222222);

  if (def.kind === 'bike') {
    // Picuda 250 motorbike: slim frame, tank, two wheels, handlebar.
    group.add(box(0.5, 0.5, 1.9, paint, 0, 0.85, 0));
    group.add(box(0.44, 0.4, 0.7, trim, 0, 1.05, -0.2));
    group.add(box(0.4, 0.3, 0.9, paint, 0, 1.0, 0.45));
    group.add(box(0.7, 0.08, 0.12, trim, 0, 1.15, 0.85));
    group.add(wheel(0.36, 0.18, 0, 0.36, 0.85));
    group.add(wheel(0.36, 0.18, 0, 0.36, -0.85));
    const lamp = box(0.3, 0.18, 0.08, lam(0xffe9a8), 0, 0.95, 1.02);
    group.add(lamp);
  } else {
    const long = def.kind === 'van' ? 4.9 : def.kind === 'sports' ? 4.3 : 4.1;
    const wide = def.kind === 'van' ? 2.1 : 1.9;
    const bodyH = def.kind === 'van' ? 1.5 : 0.72;
    const bodyY = def.kind === 'van' ? 0.95 : 0.62;
    // Lower body + cabin.
    group.add(box(wide, bodyH, long, paint, 0, bodyY, 0));
    if (def.kind === 'van') {
      group.add(box(wide - 0.1, 0.9, long - 1.6, glass, 0, 1.9, -0.4));
    } else {
      group.add(box(wide - 0.35, 0.62, long * 0.48, glass, 0, bodyY + bodyH / 2 + 0.28, -0.2));
    }
    // Bumpers, grille, headlights, taillights.
    group.add(box(wide + 0.06, 0.22, 0.3, trim, 0, 0.42, long / 2));
    group.add(box(wide + 0.06, 0.22, 0.3, trim, 0, 0.42, -long / 2));
    group.add(box(0.42, 0.2, 0.06, lam(0xffe9a8), -wide / 2 + 0.35, 0.72, long / 2 + 0.02));
    group.add(box(0.42, 0.2, 0.06, lam(0xffe9a8), wide / 2 - 0.35, 0.72, long / 2 + 0.02));
    group.add(box(0.42, 0.18, 0.06, lam(0xc0392b), -wide / 2 + 0.35, 0.72, -long / 2 - 0.02));
    group.add(box(0.42, 0.18, 0.06, lam(0xc0392b), wide / 2 - 0.35, 0.72, -long / 2 - 0.02));
    if (def.kind === 'sports') {
      // Rear wing on the Tormenta S.
      group.add(box(wide - 0.2, 0.08, 0.5, trim, 0, 1.25, -long / 2 + 0.3));
      group.add(box(0.1, 0.3, 0.1, trim, -wide / 2 + 0.4, 1.05, -long / 2 + 0.3));
      group.add(box(0.1, 0.3, 0.1, trim, wide / 2 - 0.4, 1.05, -long / 2 + 0.3));
    }
    // Four wheels.
    const wy = 0.36;
    const wz = long / 2 - 0.85;
    group.add(wheel(0.36, 0.28, -wide / 2, wy, wz));
    group.add(wheel(0.36, 0.28, wide / 2, wy, wz));
    group.add(wheel(0.36, 0.28, -wide / 2, wy, -wz));
    group.add(wheel(0.36, 0.28, wide / 2, wy, -wz));
  }

  const car = {
    id: 'car-' + (++carCounter),
    def,
    color: color != null ? color : 0xc0392b,
    group,
    damage: 0, // 0..100, shown on the HUD as a percent
    speed: 0, // m/s, signed
    heading: 0,
    x: 0,
    z: 0,
    burning: false,
    burnTime: 0,
    exploded: false,
    explodeTime: 0,
    fireball: null,
    fireLight: null,
    smoke: [],
    wreck: false,
  };
  group.userData.car = car;
  return car;
}

// Park a spread of cars along road edges so the streets feel lived-in.
// Returns the parked car records; meshes are added to city.scene.
export function spawnParkedCars(city, rng) {
  const parked = [];
  const roadLines = [-250, -150, -50, 50, 150, 250];
  const defs = VEHICLE_DEFS.filter((d) => d.kind !== 'bike');
  for (let i = 0; i < 14; i++) {
    const def = defs[rng.int(0, defs.length - 1)];
    const color = CAR_COLORS[rng.int(0, CAR_COLORS.length - 1)];
    const car = createCar(def, color);
    const alongRoad = rng.next() < 0.5;
    const line = roadLines[rng.int(0, roadLines.length - 1)];
    const along = rng.range(-280, 280);
    const side = rng.next() < 0.5 ? 8.5 : -8.5;
    if (alongRoad) {
      car.x = line + side;
      car.z = along;
      car.heading = side > 0 ? 0 : Math.PI;
    } else {
      car.x = along;
      car.z = line + side;
      car.heading = side > 0 ? Math.PI / 2 : -Math.PI / 2;
    }
    car.group.position.set(car.x, 0, car.z);
    car.group.rotation.y = car.heading;
    if (city.scene) city.scene.add(car.group);
    parked.push(car);
  }
  return parked;
}

function makeSmoke(scene, x, z) {
  const puffs = [];
  for (let i = 0; i < 6; i++) {
    const puff = new THREE.Mesh(
      new THREE.SphereGeometry(0.7, 8, 6),
      new THREE.MeshLambertMaterial({
        color: 0x333333, transparent: true, opacity: 0.7,
      })
    );
    puff.position.set(x, 1.5 + i * 0.4, z);
    puff.userData.rise = 1.2 + i * 0.25;
    scene.add(puff);
    puffs.push(puff);
  }
  return puffs;
}

function startBurning(car, ctx) {
  car.burning = true;
  car.burnTime = 0;
  if (ctx && ctx.scene) {
    car.smoke = makeSmoke(ctx.scene, car.x, car.z);
    const light = new THREE.PointLight(0xff7a2d, 12, 18);
    light.position.set(car.x, 2, car.z);
    ctx.scene.add(light);
    car.fireLight = light;
  }
  if (ctx && ctx.bus) ctx.bus.emit('car-burning', { car });
}

export function explodeCar(car, ctx) {
  if (car.exploded) return;
  car.exploded = true;
  car.explodeTime = 0;
  car.burning = false;
  const scene = ctx && ctx.scene;
  if (scene) {
    // Fireball: bright core that swells then fades.
    const ball = new THREE.Mesh(
      new THREE.SphereGeometry(1.6, 16, 12),
      new THREE.MeshBasicMaterial({ color: 0xffb347, transparent: true, opacity: 0.95 })
    );
    ball.position.set(car.x, 1.6, car.z);
    scene.add(ball);
    car.fireball = ball;
    const light = new THREE.PointLight(0xff9a3d, 60, 40);
    light.position.set(car.x, 3, car.z);
    scene.add(light);
    car.fireLight = light;
    // Kill the old smoke, start fresh thick smoke.
    for (const p of car.smoke || []) scene.remove(p);
    car.smoke = makeSmoke(scene, car.x, car.z);
    // Char the wreck.
    car.group.traverse((child) => {
      if (child.isMesh) child.material = new THREE.MeshLambertMaterial({ color: 0x1c1c1c });
    });
    car.wreck = true;
  }
  if (ctx && ctx.bus) {
    ctx.bus.emit('car-exploded', { car, x: car.x, z: car.z });
  }
  // Chain reaction: nearby cars take a heavy hit and may blow too.
  const others = (ctx && ctx.cars) || [];
  for (const other of others) {
    if (other === car || other.exploded) continue;
    const dx = other.x - car.x;
    const dz = other.z - car.z;
    const dist = Math.sqrt(dx * dx + dz * dz);
    if (dist < 13) {
      damageCar(other, 65, ctx);
    }
  }
}

// Apply damage; burning starts at 70, explosion at 100.
export function damageCar(car, amount, ctx) {
  if (!car || car.exploded) return;
  car.damage = Math.min(100, car.damage + amount);
  if (car.damage >= 100) {
    explodeCar(car, ctx);
  } else if (car.damage >= 70 && !car.burning) {
    startBurning(car, ctx);
  }
  if (ctx && ctx.bus) {
    ctx.bus.emit('car-damaged', { car, damage: car.damage });
  }
}

// Per-frame upkeep for burning / exploding cars. ctx: { scene, bus, cars }.
export function updateVehicles(cars, dt, ctx) {
  for (const car of cars) {
    if (car.burning && !car.exploded) {
      car.burnTime += dt;
      // A burning car cooks off after ~4 seconds.
      if (car.burnTime > 4) {
        explodeCar(car, ctx);
      }
    }
    if (car.exploded) {
      car.explodeTime += dt;
      if (car.fireball) {
        const t = car.explodeTime;
        const s = 1 + t * 5;
        car.fireball.scale.set(s, s, s);
        car.fireball.material.opacity = Math.max(0, 0.95 - t * 1.6);
        if (t > 0.6 && car.fireball.parent) {
          car.fireball.parent.remove(car.fireball);
          car.fireball = null;
        }
      }
      if (car.fireLight) {
        car.fireLight.intensity = Math.max(0, 60 - car.explodeTime * 90);
        if (car.explodeTime > 0.7 && car.fireLight.parent) {
          car.fireLight.parent.remove(car.fireLight);
          car.fireLight = null;
        }
      }
    }
    // Smoke rises and drifts.
    for (const puff of car.smoke || []) {
      puff.position.y += puff.userData.rise * dt;
      puff.scale.multiplyScalar(1 + dt * 0.7);
      puff.material.opacity = Math.max(0, puff.material.opacity - dt * 0.25);
      if (puff.material.opacity <= 0 && puff.parent) {
        puff.parent.remove(puff);
      }
    }
    if (car.smoke) car.smoke = car.smoke.filter((p) => p.parent);
  }
}
