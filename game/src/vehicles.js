// Vehicles: car definitions + low-poly mesh factory + parked-car spawns.
// Owns state.vehicles; driving.js moves them, traffic.js steers the ambient
// ones, police.js (Builder B) drives the patrullas. Meshes are synced here.

import * as THREE from 'three';
import { VEHICLES, CITY } from './config.js';

// Body dimensions per kind: [width, bodyHeight, length, cabinHeight].
const DIMS = {
  sedan: [1.9, 0.72, 4.4, 0.62],
  sport: [1.9, 0.62, 4.2, 0.55],
  suv: [2.0, 0.9, 4.6, 0.75],
  taxi: [1.9, 0.72, 4.4, 0.62],
  van: [2.1, 1.3, 5.0, 1.1],
  cop: [1.9, 0.72, 4.5, 0.62],
  bike: [0.7, 0.9, 2.2, 0.5],
};

const PAINTS = [0xd84040, 0x3f6fb5, 0x2e8a5a, 0xf2c230, 0x8a7f70, 0x5a4a8a, 0x3aa7a3, 0xe8e4da, 0x22262c];

export function createVehicles(ctx) {
  const { state, scene, rng } = ctx;
  let nextId = 1;

  /** Build a low-poly car mesh for a def. Returns a THREE.Group. */
  function buildCarMesh(defId, color) {
    const def = VEHICLES[defId] || VEHICLES.vagabundo;
    if (def.kind === 'bike') return buildBikeMesh(defId, color);
    const [w, bh, len, ch] = DIMS[def.kind] || DIMS.sedan;
    const g = new THREE.Group();
    const paint = new THREE.MeshLambertMaterial({ color: color ?? def.color });
    const dark = new THREE.MeshLambertMaterial({ color: 0x1c2733 });
    const glass = new THREE.MeshLambertMaterial({ color: 0x2a4a5a });

    const body = new THREE.Mesh(new THREE.BoxGeometry(w, bh, len), paint);
    body.position.y = 0.55 + bh / 2;
    body.castShadow = true;
    g.add(body);
    // Cabin (vans get a tall full-length cabin).
    const cabinLen = def.kind === 'van' ? len * 0.82 : len * 0.48;
    const cabin = new THREE.Mesh(new THREE.BoxGeometry(w * 0.86, ch, cabinLen), glass);
    cabin.position.set(0, 0.55 + bh + ch / 2 - 0.04, def.kind === 'van' ? -0.1 : -len * 0.06);
    cabin.castShadow = true;
    g.add(cabin);
    if (def.kind === 'van') {
      const roof = new THREE.Mesh(new THREE.BoxGeometry(w * 0.9, 0.08, cabinLen), paint);
      roof.position.set(0, 0.55 + bh + ch, -0.1);
      g.add(roof);
    }
    // Bumpers.
    for (const s of [1, -1]) {
      const b = new THREE.Mesh(new THREE.BoxGeometry(w * 0.96, 0.22, 0.3), dark);
      b.position.set(0, 0.45, s * (len / 2 - 0.05));
      g.add(b);
    }
    // Headlights (emissive-looking) + red taillights.
    const headMat = new THREE.MeshBasicMaterial({ color: 0xfff2b0 });
    const tailMat = new THREE.MeshBasicMaterial({ color: 0xd84040 });
    const headlights = [];
    for (const s of [-1, 1]) {
      const h = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.18, 0.08), headMat);
      h.position.set(s * (w / 2 - 0.35), 0.85, len / 2 + 0.02);
      g.add(h);
      headlights.push(h);
      const t = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.16, 0.08), tailMat);
      t.position.set(s * (w / 2 - 0.35), 0.85, -len / 2 - 0.02);
      g.add(t);
    }
    // Wheels: steer pivot (front) -> spin pivot -> cylinder (axle along X).
    const wheels = [];
    const wheelGeo = new THREE.CylinderGeometry(0.36, 0.36, 0.26, 10);
    const wheelMat = new THREE.MeshLambertMaterial({ color: 0x14181d });
    for (const sx of [-1, 1]) {
      for (const sz of [-1, 1]) {
        const steer = new THREE.Group();
        steer.position.set(sx * (w / 2 - 0.05), 0.36, sz * (len * 0.32));
        const spin = new THREE.Group();
        const wheel = new THREE.Mesh(wheelGeo, wheelMat);
        wheel.rotation.z = Math.PI / 2;
        wheel.castShadow = true;
        spin.add(wheel);
        steer.add(spin);
        g.add(steer);
        wheels.push({ steer, spin, front: sz > 0 });
      }
    }
    // Taxi roof sign.
    if (defId === 'taxi') {
      const sign = new THREE.Mesh(
        new THREE.BoxGeometry(0.9, 0.28, 0.4),
        new THREE.MeshBasicMaterial({ color: 0xffe14d }),
      );
      sign.position.set(0, 0.55 + bh + ch + 0.16, -len * 0.06);
      g.add(sign);
    }
    // Police light bar (red/blue boxes that flash when active).
    let lightBar = null;
    if (defId === 'patrulla') {
      const bar = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.16, 0.4), dark);
      bar.position.set(0, 0.55 + bh + ch + 0.1, -len * 0.06);
      g.add(bar);
      const red = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.2, 0.42), new THREE.MeshBasicMaterial({ color: 0xff2222 }));
      red.position.set(-0.28, 0.55 + bh + ch + 0.22, -len * 0.06);
      g.add(red);
      const blue = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.2, 0.42), new THREE.MeshBasicMaterial({ color: 0x2266ff }));
      blue.position.set(0.28, 0.55 + bh + ch + 0.22, -len * 0.06);
      g.add(blue);
      lightBar = { red, blue };
    }
    g.userData = { wheels, lightBar, headlights, headMat };
    return g;
  }

  /** Build a low-poly motorbike mesh (Picuda 250): two wheels, frame,
   * tank, seat, handlebars. Same Group/wheels contract as cars so the
   * shared update loop (wheel spin, steering) works unchanged. */
  function buildBikeMesh(defId, color) {
    const def = VEHICLES[defId] || VEHICLES.picuda;
    const g = new THREE.Group();
    const paint = new THREE.MeshLambertMaterial({ color: color ?? def.color });
    const dark = new THREE.MeshLambertMaterial({ color: 0x1c2733 });
    const chrome = new THREE.MeshLambertMaterial({ color: 0x9aa0a8 });
    // Frame + tank.
    const frame = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.3, 1.5), paint);
    frame.position.y = 0.62;
    frame.castShadow = true;
    g.add(frame);
    const tank = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.28, 0.6), paint);
    tank.position.set(0, 0.85, 0.25);
    tank.castShadow = true;
    g.add(tank);
    const seat = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.12, 0.7), dark);
    seat.position.set(0, 0.82, -0.45);
    g.add(seat);
    // Front fork + handlebars.
    const fork = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.9, 6), chrome);
    fork.position.set(0, 0.75, 0.85);
    fork.rotation.x = 0.5;
    g.add(fork);
    const bars = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.7, 6), dark);
    bars.rotation.z = Math.PI / 2;
    bars.position.set(0, 1.08, 0.62);
    g.add(bars);
    // Headlight.
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.18, 0.08),
      new THREE.MeshBasicMaterial({ color: 0xfff2b0 }));
    head.position.set(0, 0.85, 1.02);
    g.add(head);
    // Wheels: steer pivot (front) -> spin pivot -> cylinder (axle along X).
    const wheels = [];
    const wheelGeo = new THREE.CylinderGeometry(0.34, 0.34, 0.16, 12);
    const wheelMat = new THREE.MeshLambertMaterial({ color: 0x14181d });
    for (const sz of [-1, 1]) {
      const steer = new THREE.Group();
      steer.position.set(0, 0.34, sz * 0.85);
      const spin = new THREE.Group();
      const wheel = new THREE.Mesh(wheelGeo, wheelMat);
      wheel.rotation.z = Math.PI / 2;
      wheel.castShadow = true;
      spin.add(wheel);
      steer.add(spin);
      g.add(steer);
      wheels.push({ steer, spin, front: sz > 0 });
    }
    g.userData = { wheels, lightBar: null, headlights: [head], headMat: null, isBike: true };
    return g;
  }

  function spawnVehicle(defId, x, z, heading, opts = {}) {
    const def = VEHICLES[defId] || VEHICLES.vagabundo;
    const color = opts.color ?? (opts.randomColor ? PAINTS[Math.floor(rng() * PAINTS.length)] : def.color);
    const mesh = buildCarMesh(defId, color);
    mesh.position.set(x, 0, z);
    mesh.rotation.y = heading;
    scene.add(mesh);
    const v = {
      id: nextId, defId, x, z, heading,
      speed: 0, steer: 0, color, kind: opts.kind || 'parked',
      driver: opts.driver ?? (opts.kind === 'traffic'),
      // Garage armour upgrade raises max health (owned cars only).
      health: 100 + 50 * ((state.garageUpgrades && state.garageUpgrades[defId] && state.garageUpgrades[defId].armour) || 0),
      mesh,
      _spin: 0, _flash: false, _spot: null, _burning: false, _burnT: 0, _dead: false,
    };
    nextId += 1;
    state.vehicles.push(v);
    return v;
  }

  function removeVehicle(id) {
    const i = state.vehicles.findIndex((v) => v.id === id);
    if (i < 0) return false;
    const [v] = state.vehicles.splice(i, 1);
    if (v.mesh) scene.remove(v.mesh);
    if (v._spot) scene.remove(v._spot);
    return true;
  }

  // --- damage, fire and explosions. A car at <=25 health catches fire
  // (smoke + flame, 2 hp/s burn); at 0 it explodes: flash, shockwave ring,
  // radius damage to peds, nearby cars (chain) and the player, then the
  // wreck is removed. The player is ejected first if they were inside.
  let fx = []; // { mesh|points, light, life, maxLife, kind, x, z }
  let _smokeT = 0;

  function spawnExplosionFx(x, z) {
    // White-orange flash sphere that swells and fades + a point light.
    const flash = new THREE.Mesh(
      new THREE.SphereGeometry(1, 12, 10),
      new THREE.MeshBasicMaterial({ color: 0xffd27a, transparent: true, opacity: 0.95 }),
    );
    flash.position.set(x, 1.5, z);
    scene.add(flash);
    const light = new THREE.PointLight(0xff9a3c, 80, 40);
    light.position.set(x, 3, z);
    scene.add(light);
    fx.push({ mesh: flash, light, life: 0.5, maxLife: 0.5, kind: 'flash' });
    // Debris sparks.
    const n = 26;
    const pos = new Float32Array(n * 3);
    for (let i = 0; i < n; i += 1) {
      pos[i * 3] = x + (Math.random() - 0.5) * 2;
      pos[i * 3 + 1] = 1 + Math.random() * 2;
      pos[i * 3 + 2] = z + (Math.random() - 0.5) * 2;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const points = new THREE.Points(geo, new THREE.PointsMaterial({
      color: 0xffb03c, size: 0.4, transparent: true, opacity: 1,
    }));
    scene.add(points);
    fx.push({ points, life: 0.9, maxLife: 0.9, kind: 'sparks' });
  }

  function explodeVehicle(v) {
    if (v._dead) return;
    v._dead = true;
    const { x, z } = v;
    const wasPlayerCar = state.player.vehicleId === v.id;
    if (wasPlayerCar) {
      // Eject the player next to the wreck before it goes up.
      state.player.vehicleId = null;
      state.player.onFoot = true;
      state.player.hidden = 0;
      state.player.x = x + 3;
      state.player.z = z + 3;
      state.player.speed = 0;
    }
    spawnExplosionFx(x, z);
    if (ctx.audio && ctx.audio.explosion) ctx.audio.explosion();
    if (ctx.events) ctx.events.emit('explosion', { x, z });
    // Radius damage: peds go down, nearby cars take 40 (chains), the
    // player takes 40 if on foot and close.
    for (const ped of state.peds) {
      if (ped.state === 'down') continue;
      if (Math.hypot(ped.x - x, ped.z - z) < 12) {
        ped.state = 'down';
        ped._downT = 6;
      }
    }
    for (const o of [...state.vehicles]) {
      if (o === v || o._dead) continue;
      if (Math.hypot(o.x - x, o.z - z) < 10) damageVehicle(o.id, 40);
    }
    if (state.player.onFoot && Math.hypot(state.player.x - x, state.player.z - z) < 10) {
      state.player.health = Math.max(0, state.player.health - 40);
      if (ctx.hud) ctx.hud.message('The blast caught you! -40 health.', 'bad');
    }
    removeVehicle(v.id);
  }

  function damageVehicle(id, amount) {
    const v = state.vehicles.find((x) => x.id === id);
    if (!v || v._dead) return false;
    v.health = Math.max(0, (v.health ?? 100) - amount);
    if (v.health <= 25 && v.health > 0 && !v._burning) {
      v._burning = true;
      v._burnT = 0;
      if (ctx.hud) ctx.hud.message('That car is on fire — get clear!', 'bad');
    }
    if (v.health <= 0) explodeVehicle(v);
    return true;
  }

  /** Parked cars at roadside spots (deterministic via ctx.rng). */
  function spawnParked(count) {
    const defIds = ['vagabundo', 'vagabundo', 'cometa', 'camioneta', 'taxi', 'furgoneta', 'tormenta', 'picuda'];
    let placed = 0;
    let guard = 0;
    while (placed < count && guard < count * 12) {
      guard += 1;
      const vertical = rng() > 0.5;
      const road = CITY.roads[Math.floor(rng() * CITY.roads.length)];
      const along = -260 + rng() * 520;
      const off = (rng() > 0.5 ? 1 : -1) * (CITY.roadWidth / 2 - 1.6);
      const x = vertical ? road + off : along;
      const z = vertical ? along : road + off;
      // Keep the player's spawn clear.
      if (Math.hypot(x - state.player.x, z - state.player.z) < 12) continue;
      const heading = vertical ? (rng() > 0.5 ? 0 : Math.PI) : (rng() > 0.5 ? Math.PI / 2 : -Math.PI / 2);
      spawnVehicle(defIds[Math.floor(rng() * defIds.length)], x, z, heading, { kind: 'parked', randomColor: true });
      placed += 1;
    }
    return placed;
  }

  // Boot: the starter Vagabundo on the z = -60 road by Celia's garage
  // (a real road, not inside the garage block) + parked cars around town.
  spawnVehicle('vagabundo', -150, -60, Math.PI / 2, { kind: 'parked', color: 0x3f6fb5 });
  spawnParked(13);

  function isNight() {
    const t = state.dayTime;
    // Headlights on at night and at dusk, when the roads go dark.
    return t < 0.2 || t > 0.68;
  }

  function update(dt) {
    // Snapshot: explodeVehicle() may remove a car mid-loop.
    for (const v of [...state.vehicles]) {
      if (!v.mesh) continue;
      v.mesh.position.set(v.x, v._airY || 0, v.z);
      v.mesh.rotation.y = v.heading;
      // Wheel spin + front steering.
      v._spin += (v.speed * dt) / 0.36;
      for (const w of v.mesh.userData.wheels) {
        w.spin.rotation.x = v._spin;
        if (w.front) w.steer.rotation.y = v.steer * 0.42;
      }
      // Police light bar flashes while the player is wanted (or flagged).
      const lb = v.mesh.userData.lightBar;
      if (lb) {
        const active = v._flash || state.player.wanted > 0;
        const phase = Math.floor(state.time * 5) % 2 === 0;
        lb.red.visible = active ? phase : true;
        lb.blue.visible = active ? !phase : true;
        if (!active) { lb.red.material.color.setHex(0xff2222); lb.blue.material.color.setHex(0x2266ff); }
      }
      // One SpotLight for the player's car at night, none otherwise.
      const isPlayerCar = state.player.vehicleId === v.id;
      if (isPlayerCar && isNight() && !v._spot) {
        const spot = new THREE.SpotLight(0xffe9a8, 60, 45, 0.5, 0.5, 1.2);
        spot.position.set(0, 1.4, 1.6);
        const target = new THREE.Object3D();
        target.position.set(0, 0, 14);
        v.mesh.add(target);
        spot.target = target;
        v.mesh.add(spot);
        v._spot = spot;
      } else if (!isPlayerCar && v._spot) {
        v.mesh.remove(v._spot);
        v._spot = null;
      } else if (v._spot) {
        v._spot.visible = isNight();
      }
      // Burning cars smoke, smoulder and take 2 hp/s until they blow.
      if (v._burning && !v._dead) {
        v.health = Math.max(0, v.health - 2 * dt);
        _smokeT += dt;
        if (_smokeT > 0.15) {
          _smokeT = 0;
          const n = 6;
          const pos = new Float32Array(n * 3);
          for (let i = 0; i < n; i += 1) {
            pos[i * 3] = v.x + (Math.random() - 0.5) * 1.5;
            pos[i * 3 + 1] = 1.5 + Math.random();
            pos[i * 3 + 2] = v.z + (Math.random() - 0.5) * 1.5;
          }
          const geo = new THREE.BufferGeometry();
          geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
          const points = new THREE.Points(geo, new THREE.PointsMaterial({
            color: 0x555555, size: 0.7, transparent: true, opacity: 0.7,
          }));
          scene.add(points);
          fx.push({ points, life: 1.2, maxLife: 1.2, kind: 'smoke', vy: 2.2 });
        }
        if (v.health <= 0) explodeVehicle(v);
      }
    }
    // Explosion / fire / smoke effects tick.
    for (let i = fx.length - 1; i >= 0; i -= 1) {
      const f = fx[i];
      f.life -= dt;
      if (f.life <= 0) {
        if (f.mesh) scene.remove(f.mesh);
        if (f.points) scene.remove(f.points);
        if (f.light) scene.remove(f.light);
        fx.splice(i, 1);
        continue;
      }
      const k = f.life / f.maxLife;
      if (f.kind === 'flash' && f.mesh) {
        const s = 1 + (1 - k) * 9;
        f.mesh.scale.set(s, s, s);
        f.mesh.material.opacity = 0.95 * k;
        if (f.light) f.light.intensity = 80 * k;
      } else if (f.points) {
        f.points.material.opacity = Math.max(0, k * (f.kind === 'smoke' ? 0.7 : 1));
        if (f.kind === 'smoke') f.points.position.y += (f.vy || 2) * dt;
        else if (f.kind === 'sparks') f.points.position.y += 3 * dt;
      }
    }
  }

  return { update, spawnVehicle, buildCarMesh, removeVehicle, damageVehicle };
}
