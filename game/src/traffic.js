// Ambient life: traffic cars that follow the road grid and pedestrians on
// the sidewalks. Owns state.peds; traffic cars live in state.vehicles with
// kind 'traffic' (spawned through ctx.vehicles when the coordinator wires it
// in — if it is absent, peds still spawn and any traffic cars already in
// state are still driven). Nothing here imports another system module.

import * as THREE from 'three';
import { CITY, VEHICLES } from './config.js';

const SHIRTS = [0xd84040, 0x3f6fb5, 0x2e8a5a, 0xf2c230, 0xe8e4da, 0x5a4a8a, 0x3aa7a3, 0xe87a5d];
const SKINS = [0xc8956c, 0x8a5a3a, 0xe8b88a, 0x6e4423, 0xd9a066];
const TRAFFIC_DEFS = ['vagabundo', 'vagabundo', 'cometa', 'camioneta', 'taxi', 'furgoneta'];
const TRAFFIC_COUNT = 20;
const PED_COUNT = 64;
// Pedestrian hotspots: crowds where the city lives — the beach, the
// night market in Paseo del Mar, and the Marina Alba docks.
const PED_CLUSTERS = [
  { x: 276, z: 0, n: 8, r: 40 }, // beach boardwalk
  { x: 0, z: -150, n: 8, r: 30 }, // night market, Paseo del Mar
  { x: -210, z: -210, n: 8, r: 30 }, // marina docks
];

export function createTraffic(ctx) {
  const { state, scene, city, events, rng } = ctx;

  function freeSidewalkPoint() {
    for (let tries = 0; tries < 8; tries += 1) {
      const p = city.randomSidewalkPoint(rng);
      const fixed = city.collide(p.x, p.z, 0.6);
      if (Math.hypot(fixed.x - p.x, fixed.z - p.z) < 0.05) return p;
    }
    return city.randomSidewalkPoint(rng);
  }

  function buildPedMesh(shirt, skin) {
    const g = new THREE.Group();
    const body = new THREE.Mesh(
      new THREE.CylinderGeometry(0.3, 0.36, 0.95, 8),
      new THREE.MeshLambertMaterial({ color: shirt }),
    );
    body.position.y = 0.95;
    body.castShadow = true;
    g.add(body);
    const head = new THREE.Mesh(
      new THREE.SphereGeometry(0.26, 10, 10),
      new THREE.MeshLambertMaterial({ color: skin }),
    );
    head.position.y = 1.62;
    head.castShadow = true;
    g.add(head);
    const legs = new THREE.Mesh(
      new THREE.CylinderGeometry(0.22, 0.26, 0.5, 8),
      new THREE.MeshLambertMaterial({ color: 0x2c313a }),
    );
    legs.position.y = 0.25;
    g.add(legs);
    return g;
  }

  let nextPedId = 1;
  function spawnPed(at) {
    const p0 = at || freeSidewalkPoint();
    const mesh = buildPedMesh(
      SHIRTS[Math.floor(rng() * SHIRTS.length)],
      SKINS[Math.floor(rng() * SKINS.length)],
    );
    mesh.position.set(p0.x, 0, p0.z);
    scene.add(mesh);
    const t = freeSidewalkPoint();
    const ped = {
      id: nextPedId, x: p0.x, z: p0.z,
      heading: rng() * Math.PI * 2,
      speed: 1.1 + rng() * 0.9, state: 'walk', mesh,
      _tx: t.x, _tz: t.z, _wait: 0, _fleeX: 0, _fleeZ: 0, _fleeT: 0, _downT: 0,
    };
    nextPedId += 1;
    state.peds.push(ped);
    return ped;
  }

  function spawnTrafficCar() {
    const spawn = ctx.vehicles && ctx.vehicles.spawnVehicle;
    if (typeof spawn !== 'function') return null;
    const vertical = rng() > 0.5;
    const road = CITY.roads[Math.floor(rng() * CITY.roads.length)];
    const along = -260 + rng() * 520;
    const lane = (rng() > 0.5 ? 1 : -1) * 1.6;
    const x = vertical ? road + lane : along;
    const z = vertical ? along : road + lane;
    const dir = rng() > 0.5 ? 1 : -1;
    const heading = vertical ? (dir > 0 ? 0 : Math.PI) : (dir > 0 ? Math.PI / 2 : -Math.PI / 2);
    const v = spawn(TRAFFIC_DEFS[Math.floor(rng() * TRAFFIC_DEFS.length)], x, z, heading, {
      kind: 'traffic', driver: true, randomColor: true,
    });
    if (!v) return null;
    // _axis is the TRAVEL axis ('z' = along a vertical road, 'x' = along a
    // horizontal road); _road is the constant coordinate of that road.
    v._axis = vertical ? 'z' : 'x';
    v._road = road;
    v._dir = dir;
    v._cruise = 10 + rng() * 4;
    v._wait = 0;
    v._lastCross = null;
    return v;
  }

  for (let i = 0; i < PED_COUNT - 24; i += 1) spawnPed();
  // Hotspot clusters: crowds at the beach, the night market, the docks.
  for (const c of PED_CLUSTERS) {
    for (let i = 0; i < c.n; i += 1) {
      const px = c.x + (rng() - 0.5) * 2 * c.r;
      const pz = c.z + (rng() - 0.5) * 2 * c.r;
      const fixed = city.collide(px, pz, 0.6);
      spawnPed({ x: fixed.x, z: fixed.z });
    }
  }
  for (let i = 0; i < TRAFFIC_COUNT; i += 1) spawnTrafficCar();

  function fleeFrom(x, z) {
    for (const ped of state.peds) {
      if (ped.state === 'down') continue;
      const d = Math.hypot(ped.x - x, ped.z - z);
      if (d < 15) {
        ped.state = 'flee';
        ped._fleeX = x;
        ped._fleeZ = z;
        ped._fleeT = 3;
      }
    }
  }
  if (events) {
    events.on('gunfire', (d) => { if (d) fleeFrom(d.x, d.z); });
    events.on('explosion', (d) => { if (d) fleeFrom(d.x, d.z); });
  }

  function aheadBlocked(v, dist) {
    const fx = Math.sin(v.heading);
    const fz = Math.cos(v.heading);
    for (const o of state.vehicles) {
      if (o === v) continue;
      const dx = o.x - v.x;
      const dz = o.z - v.z;
      const d = Math.hypot(dx, dz);
      if (d < dist && d > 0.01 && (dx * fx + dz * fz) / d > 0.6) return true;
    }
    // The player's car counts too (it is in state.vehicles while driving).
    return false;
  }

  function updateTrafficCar(v, dt) {
    if (v._wait > 0) {
      v._wait -= dt;
      v.speed += (0 - v.speed) * Math.min(1, dt * 6);
      return;
    }
    // Turn at intersections, or pause at a "red light".
    const crossCoord = v._axis === 'x' ? v.x : v.z;
    let nearestCross = null;
    let nearestD = Infinity;
    for (const c of CITY.roads) {
      const d = Math.abs(crossCoord - c);
      if (d < nearestD) { nearestD = d; nearestCross = c; }
    }
    if (nearestD < 4 && nearestCross !== v._lastCross) {
      v._lastCross = nearestCross;
      const roll = rng();
      if (roll < 0.22) {
        // Turn 90 degrees onto the crossing road.
        const newDir = rng() > 0.5 ? 1 : -1;
        if (v._axis === 'x') {
          // Was travelling along x; turn onto the vertical road at this x.
          v._axis = 'z'; v._road = nearestCross; v._dir = newDir;
          v.x = nearestCross + (newDir > 0 ? 1.6 : -1.6);
          v.heading = newDir > 0 ? 0 : Math.PI;
        } else {
          // Was travelling along z; turn onto the horizontal road at this z.
          v._axis = 'x'; v._road = nearestCross; v._dir = newDir;
          v.z = nearestCross + (newDir > 0 ? 1.6 : -1.6);
          v.heading = newDir > 0 ? Math.PI / 2 : -Math.PI / 2;
        }
      } else if (roll < 0.38) {
        v._wait = 2 + rng() * 2; // red light
        return;
      }
    }
    const target = aheadBlocked(v, 8) ? 0 : v._cruise;
    v.speed += (target - v.speed) * Math.min(1, dt * 2.5);
    const step = v.speed * dt;
    let nx = v.x;
    let nz = v.z;
    if (v._axis === 'x') nx += Math.sin(v.heading) * step;
    else nz += Math.cos(v.heading) * step;
    // Stay in the lane (constant coordinate) and out of buildings; wrap at edge.
    if (v._axis === 'x') nz = v._road + (v._dir > 0 ? 1.6 : -1.6);
    else nx = v._road + (v._dir > 0 ? 1.6 : -1.6);
    const fixed = city.collide(nx, nz, 1.6);
    nx = fixed.x;
    nz = fixed.z;
    if (Math.abs(nx) > 292 || Math.abs(nz) > 292) {
      // Turn around at the edge instead of leaving town.
      v._dir *= -1;
      v.heading += Math.PI;
      nx = Math.max(-290, Math.min(290, nx));
      nz = Math.max(-290, Math.min(290, nz));
    }
    v.x = nx;
    v.z = nz;
  }

  function updatePed(ped, dt) {
    if (ped.state === 'down') {
      ped._downT -= dt;
      ped.mesh.rotation.z = Math.PI / 2;
      ped.mesh.position.y = 0.35;
      if (ped._downT <= 0) {
        ped.state = 'flee';
        ped._fleeX = state.player.x;
        ped._fleeZ = state.player.z;
        ped._fleeT = 3;
        ped.mesh.rotation.z = 0;
        ped.mesh.position.y = 0;
      }
      return;
    }
    if (ped.state === 'flee') {
      ped._fleeT -= dt;
      const dx = ped.x - ped._fleeX;
      const dz = ped.z - ped._fleeZ;
      const d = Math.hypot(dx, dz) || 1;
      ped.heading = Math.atan2(dx / d, dz / d);
      const nx = ped.x + (dx / d) * 5 * dt;
      const nz = ped.z + (dz / d) * 5 * dt;
      const fixed = city.collide(nx, nz, 0.5);
      ped.x = fixed.x;
      ped.z = fixed.z;
      if (ped._fleeT <= 0) {
        ped.state = 'walk';
        const t = freeSidewalkPoint();
        ped._tx = t.x;
        ped._tz = t.z;
      }
    } else if (ped.state === 'idle') {
      ped._wait -= dt;
      if (ped._wait <= 0) {
        ped.state = 'walk';
        const t = freeSidewalkPoint();
        ped._tx = t.x;
        ped._tz = t.z;
      }
    } else {
      // Walk toward the waypoint.
      const dx = ped._tx - ped.x;
      const dz = ped._tz - ped.z;
      const d = Math.hypot(dx, dz);
      if (d < 1) {
        ped.state = 'idle';
        ped._wait = 1 + rng() * 2;
      } else {
        ped.heading = Math.atan2(dx / d, dz / d);
        const nx = ped.x + (dx / d) * ped.speed * dt;
        const nz = ped.z + (dz / d) * ped.speed * dt;
        const fixed = city.collide(nx, nz, 0.5);
        ped.x = fixed.x;
        ped.z = fixed.z;
      }
    }
    ped.mesh.position.set(ped.x, ped.mesh.position.y, ped.z);
    ped.mesh.rotation.y = ped.heading;
  }

  function update(dt) {
    for (const v of state.vehicles) {
      if (v.kind === 'traffic') updateTrafficCar(v, dt);
    }
    for (const ped of state.peds) updatePed(ped, dt);
  }

  return { update, spawnPed, spawnTrafficCar };
}
