// traffic.js — 20 traffic cars with simple road-following AI, 64
// pedestrians on the sidewalks, and visual traffic lights.
// Written from the prose spec.
import * as THREE from 'three';
import { createCar, VEHICLE_DEFS, CAR_COLORS } from './vehicles.js';

const ROAD_LINES = [-250, -150, -50, 50, 150, 250];
const PED_COLORS = [
  0xe87a5d, 0x7ec8c0, 0xf5d76e, 0x5a4a6e, 0x3d8b4f,
  0x2c4a6e, 0xe8e0cc, 0xc0392b, 0xf2a65a, 0x9b59b6,
];

function lam(color) {
  return new THREE.MeshLambertMaterial({ color });
}

function makePedMesh(color) {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.38, 1.05, 8), lam(color));
  body.position.y = 0.95;
  body.castShadow = true;
  g.add(body);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.26, 10, 8), lam(0xe8b88a));
  head.position.y = 1.75;
  head.castShadow = true;
  g.add(head);
  const legL = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.5, 0.16), lam(0x2c3e50));
  legL.position.set(-0.14, 0.25, 0);
  g.add(legL);
  const legR = legL.clone();
  legR.position.x = 0.14;
  g.add(legR);
  g.userData.legL = legL;
  g.userData.legR = legR;
  return g;
}

function makeTrafficLight(x, z) {
  const g = new THREE.Group();
  g.position.set(x, 0, z);
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.18, 5.4, 8), lam(0x333333));
  pole.position.y = 2.7;
  pole.castShadow = true;
  g.add(pole);
  const arm = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.16, 0.16), lam(0x333333));
  arm.position.set(1.1, 5.2, 0);
  g.add(arm);
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.7, 1.9, 0.7), lam(0x1a1a1a));
  head.position.set(2.2, 4.6, 0);
  g.add(head);
  const lampGeo = new THREE.SphereGeometry(0.24, 10, 8);
  const red = new THREE.Mesh(lampGeo, new THREE.MeshBasicMaterial({ color: 0x330000 }));
  red.position.set(2.2, 5.2, 0.36);
  g.add(red);
  const yellow = new THREE.Mesh(lampGeo, new THREE.MeshBasicMaterial({ color: 0x332200 }));
  yellow.position.set(2.2, 4.6, 0.36);
  g.add(yellow);
  const green = new THREE.Mesh(lampGeo, new THREE.MeshBasicMaterial({ color: 0x003300 }));
  green.position.set(2.2, 4.0, 0.36);
  g.add(green);
  return { group: g, x, z, red, yellow, green, state: 'green', timer: 0, phase: 0 };
}

function setLightVisual(light) {
  const on = { red: 0xff2d2d, yellow: 0xffc21a, green: 0x2dff5a };
  const off = { red: 0x330000, yellow: 0x332200, green: 0x003300 };
  light.red.material.color.setHex(light.state === 'red' ? on.red : off.red);
  light.yellow.material.color.setHex(light.state === 'yellow' ? on.yellow : off.yellow);
  light.green.material.color.setHex(light.state === 'green' ? on.green : off.green);
}

function randomRoadPoint(rng) {
  // A point on a road, slightly offset to the right-hand lane.
  if (rng.next() < 0.5) {
    return {
      x: ROAD_LINES[rng.int(0, ROAD_LINES.length - 1)] + 3.2,
      z: rng.range(-280, 280),
      axis: 'z',
    };
  }
  return {
    x: rng.range(-280, 280),
    z: ROAD_LINES[rng.int(0, ROAD_LINES.length - 1)] + 3.2,
    axis: 'x',
  };
}

export function createTraffic(city, rng) {
  const scene = city.scene;
  const group = new THREE.Group();
  group.name = 'traffic';
  if (scene) scene.add(group);

  const bus = city.bus || null;
  const cars = [];
  const defs = VEHICLE_DEFS.filter((d) => d.kind === 'car' || d.kind === 'van');

  // --- 20 traffic cars ---
  for (let i = 0; i < 20; i++) {
    const def = defs[rng.int(0, defs.length - 1)];
    const color = CAR_COLORS[rng.int(0, CAR_COLORS.length - 1)];
    const car = createCar(def, color);
    const spot = randomRoadPoint(rng);
    car.x = spot.x;
    car.z = spot.z;
    car.heading = spot.axis === 'z'
      ? (rng.next() < 0.5 ? 0 : Math.PI)
      : (rng.next() < 0.5 ? Math.PI / 2 : -Math.PI / 2);
    car.group.position.set(car.x, 0, car.z);
    car.group.rotation.y = car.heading;
    group.add(car.group);
    cars.push({
      car,
      axis: spot.axis,
      dir: 1,
      speed: rng.range(6, 11),
      cruise: rng.range(8, 13),
      honkCooldown: 0,
      stopped: false,
    });
  }

  // Crowd hotspots: pedestrians cluster at the night market, the beach and
  // the pier so those frames read crowded; the rest roam the whole city.
  // Total stays 64 — same render cost, denser frames.
  const HOTSPOTS = [
    { x: 10, z: -150, r: 28 },   // Centro Alba night market
    { x: -140, z: 268, r: 40 },  // Paseo del Mar beach
    { x: -258, z: 40, r: 26 },   // Marina Alba pier
  ];

  function hotspotPoint(rng, home) {
    return {
      x: Math.max(-295, Math.min(295, home.x + rng.range(-home.r, home.r))),
      z: Math.max(-295, Math.min(295, home.z + rng.range(-home.r, home.r))),
    };
  }

  // --- 64 pedestrians: 30 clustered at the hotspots, 34 roaming ---
  const peds = [];
  for (let i = 0; i < 64; i++) {
    const color = PED_COLORS[rng.int(0, PED_COLORS.length - 1)];
    const mesh = makePedMesh(color);
    const home = i < 30 ? HOTSPOTS[i % HOTSPOTS.length] : null;
    let x;
    let z;
    let tx;
    let tz;
    if (home) {
      const at = hotspotPoint(rng, home);
      const to = hotspotPoint(rng, home);
      x = at.x;
      z = at.z;
      tx = to.x;
      tz = to.z;
    } else {
      const spot = randomRoadPoint(rng);
      // Sidewalk offset: a few metres off the road centre line.
      x = spot.axis === 'z' ? spot.x + 8.5 : spot.x;
      z = spot.axis === 'x' ? spot.z + 8.5 : spot.z;
      const target = randomRoadPoint(rng);
      tx = target.axis === 'z' ? target.x + 8.5 : target.x;
      tz = target.axis === 'x' ? target.z + 8.5 : target.z;
    }
    mesh.position.set(x, 0, z);
    group.add(mesh);
    peds.push({
      mesh,
      x,
      z,
      home,
      heading: rng.range(0, Math.PI * 2),
      speed: rng.range(1.1, 2.0),
      tx,
      tz,
      bob: rng.range(0, Math.PI * 2),
    });
  }

  // --- Traffic lights at four main intersections ---
  const lights = [];
  for (const [lx, lz] of [[-50, -50], [50, -50], [-50, 50], [50, 50]]) {
    const light = makeTrafficLight(lx + 8, lz + 8);
    light.phase = lights.length * 2.5;
    light.timer = light.phase;
    setLightVisual(light);
    group.add(light.group);
    lights.push(light);
  }

  function lightStateAt(x, z) {
    // Red if any light within 18 m of the car is red.
    for (const light of lights) {
      const dx = light.x - x;
      const dz = light.z - z;
      if (dx * dx + dz * dz < 18 * 18 && light.state === 'red') return 'red';
    }
    return 'green';
  }

  function update(dt) {
    // Traffic light cycle: green 8 s, yellow 2 s, red 8 s, staggered.
    for (const light of lights) {
      light.timer += dt;
      const cycle = light.timer % 18;
      const next = cycle < 8 ? 'green' : cycle < 10 ? 'yellow' : 'red';
      if (next !== light.state) {
        light.state = next;
        setLightVisual(light);
      }
    }

    // Traffic cars: drive along their road, stop at red lights, turn at
    // intersections, honk when blocked by the car ahead.
    for (const t of cars) {
      const car = t.car;
      if (car.exploded) continue;
      if (car.playerDriven) continue; // the player's ride: never AI-driven
      t.honkCooldown = Math.max(0, t.honkCooldown - dt);

      // Blocked by the car ahead?
      let blocked = false;
      for (const other of cars) {
        if (other === t || other.car.exploded) continue;
        const dx = other.car.x - car.x;
        const dz = other.car.z - car.z;
        const ahead =
          (t.axis === 'z' && Math.sign(dz) === Math.sign(Math.sin(car.heading)) && Math.abs(dx) < 3) ||
          (t.axis === 'x' && Math.sign(dx) === Math.sign(Math.cos(car.heading)) && Math.abs(dz) < 3);
        const dist = Math.sqrt(dx * dx + dz * dz);
        if (ahead && dist < 9) {
          blocked = true;
          break;
        }
      }
      if (blocked && t.honkCooldown <= 0) {
        t.honkCooldown = rng.range(3, 6);
        if (bus) bus.emit('honk', { x: car.x, z: car.z });
      }

      const nearLight = lightStateAt(car.x, car.z) === 'red';
      const target = blocked || nearLight ? 0 : t.cruise;
      t.speed += (target - t.speed) * Math.min(1, 2.2 * dt);
      const step = t.speed * dt;
      const fx = Math.sin(car.heading);
      const fz = Math.cos(car.heading);
      car.x += fx * step;
      car.z += fz * step;

      // Turn around at the city edge; chance to turn at intersections.
      let turned = false;
      if (car.x > 285 || car.x < -285 || car.z > 285 || car.z < -285) {
        car.heading += Math.PI;
        turned = true;
      } else if (Math.abs(car.x % 100) < 2 || Math.abs(car.z % 100) < 2) {
        if (rng.next() < 0.004) {
          car.heading += (rng.next() < 0.5 ? 1 : -1) * (Math.PI / 2);
          turned = true;
        }
      }
      if (turned) {
        car.heading = Math.round(car.heading / (Math.PI / 2)) * (Math.PI / 2);
        t.axis = Math.abs(Math.sin(car.heading)) > 0.5 ? 'z' : 'x';
      }
      car.group.position.set(car.x, 0, car.z);
      car.group.rotation.y = car.heading;
    }

    // Pedestrians: walk toward their target, pick a new one on arrival.
    for (const p of peds) {
      const dx = p.tx - p.x;
      const dz = p.tz - p.z;
      const dist = Math.sqrt(dx * dx + dz * dz);
      if (dist < 2) {
        if (p.home) {
          // Crowd peds mill around their hotspot instead of wandering off.
          const next = hotspotPoint(rng, p.home);
          p.tx = next.x;
          p.tz = next.z;
        } else {
          const next = randomRoadPoint(rng);
          p.tx = next.axis === 'z' ? next.x + 8.5 : next.x;
          p.tz = next.axis === 'x' ? next.z + 8.5 : next.z;
        }
        continue;
      }
      p.heading = Math.atan2(dx, dz);
      p.x += (dx / dist) * p.speed * dt;
      p.z += (dz / dist) * p.speed * dt;
      p.bob += dt * 6;
      p.mesh.position.set(p.x, Math.abs(Math.sin(p.bob)) * 0.06, p.z);
      p.mesh.rotation.y = p.heading;
      p.mesh.userData.legL.rotation.x = Math.sin(p.bob) * 0.5;
      p.mesh.userData.legR.rotation.x = -Math.sin(p.bob) * 0.5;
    }
  }

  return {
    group,
    cars: cars.map((t) => t.car),
    drivers: cars,
    peds,
    lights,
    update,
    count: { cars: cars.length, peds: peds.length },
  };
}
