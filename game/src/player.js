// player.js — on-foot movement, health, respawn at the hospital, and
// health-pack / ammo-box pickups. Written from the prose spec.
import * as THREE from 'three';

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

function makePlayerMesh() {
  const g = new THREE.Group();
  g.name = 'player';
  const jacket = new THREE.MeshLambertMaterial({ color: 0xc0392b });
  const skin = new THREE.MeshLambertMaterial({ color: 0xe8b88a });
  const pants = new THREE.MeshLambertMaterial({ color: 0x2c3e50 });
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.85, 0.36), jacket);
  torso.position.y = 1.15;
  torso.castShadow = true;
  g.add(torso);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.24, 12, 10), skin);
  head.position.y = 1.78;
  head.castShadow = true;
  g.add(head);
  const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.26, 0.1, 12), jacket);
  cap.position.y = 1.95;
  g.add(cap);
  const legL = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.72, 0.2), pants);
  legL.position.set(-0.17, 0.36, 0);
  g.add(legL);
  const legR = legL.clone();
  legR.position.x = 0.17;
  g.add(legR);
  const armL = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.62, 0.16), jacket);
  armL.position.set(-0.42, 1.15, 0);
  g.add(armL);
  const armR = armL.clone();
  armR.position.x = 0.42;
  g.add(armR);
  g.userData.legL = legL;
  g.userData.legR = legR;
  g.userData.armL = armL;
  g.userData.armR = armR;
  return g;
}

export function createPlayer(state, bus, input, world) {
  const keys = input || NO_INPUT;
  const events = bus || NO_BUS;
  const scene = (world && world.scene) || null;
  const city = (world && world.city) || null;
  const colliders = (city && city.colliders) || [];
  const hospital = (city && city.spawnPoints && city.spawnPoints.hospital) ||
    { x: 200, z: 200, heading: Math.PI };

  const p = state.player || {};
  if (p.health == null) p.health = 100;
  if (p.armour == null) p.armour = 25;
  if (p.money == null) p.money = 250;
  if (p.onFoot == null) p.onFoot = true;

  const mesh = makePlayerMesh();
  if (scene) scene.add(mesh);
  mesh.position.set(p.x || 0, 0, p.z || 0);

  const body = {
    vy: 0, // vertical velocity for jumping
    grounded: true,
    bob: 0,
    dead: false,
    respawnTimer: 0,
    jumpFrom: null, // takeoff point of the current jump, for longest-jump
  };

  function cameraYaw() {
    if (world && typeof world.getCameraYaw === 'function') return world.getCameraYaw();
    return p.heading || 0;
  }

  function pushOutOfBuildings(x, z) {
    for (const c of colliders) {
      const nx = clamp(x, c.x - c.hx, c.x + c.hx);
      const nz = clamp(z, c.z - c.hz, c.z + c.hz);
      const dx = x - nx;
      const dz = z - nz;
      const d2 = dx * dx + dz * dz;
      if (d2 < 0.6 * 0.6) {
        if (d2 > 0.0001) {
          const d = Math.sqrt(d2);
          x = nx + (dx / d) * 0.6;
          z = nz + (dz / d) * 0.6;
        } else {
          x += 0.8;
        }
      }
    }
    return { x, z };
  }

  function takeDamage(amount, source) {
    if (body.dead || amount <= 0) return;
    let left = amount;
    // Armour soaks damage first.
    if (p.armour > 0) {
      const soaked = Math.min(p.armour, left);
      p.armour -= soaked;
      left -= soaked;
    }
    p.health = Math.max(0, p.health - left);
    events.emit('health-changed', { health: p.health, armour: p.armour, source });
    if (p.health <= 0) {
      die(source);
    }
  }

  function heal(amount) {
    if (body.dead) return;
    p.health = Math.min(100, p.health + amount);
    events.emit('health-changed', { health: p.health, armour: p.armour, source: 'heal' });
  }

  function die(source) {
    if (body.dead) return;
    body.dead = true;
    body.respawnTimer = 2.5;
    events.emit('player-died', { source, x: p.x, z: p.z });
  }

  function respawn() {
    // Back on your feet at the hospital. You keep your money, minus a
    // small hospital bill.
    const bill = Math.min(100, Math.floor((p.money || 0) * 0.1));
    p.money = Math.max(0, (p.money || 0) - bill);
    p.health = 100;
    p.armour = 25;
    p.x = hospital.x;
    p.z = hospital.z;
    p.heading = hospital.heading || 0;
    p.speedKmh = 0;
    p.onFoot = true;
    p.currentCar = null;
    body.dead = false;
    body.vy = 0;
    body.grounded = true;
    mesh.position.set(p.x, 0, p.z);
    mesh.rotation.y = p.heading;
    events.emit('player-respawned', { x: p.x, z: p.z, bill });
  }

  function collectPickups() {
    const pickups = (world && world.pickups) || [];
    for (const pk of pickups) {
      if (pk.taken) continue;
      const dx = pk.x - p.x;
      const dz = pk.z - p.z;
      if (dx * dx + dz * dz < 2.2 * 2.2) {
        pk.taken = true;
        if (pk.mesh && pk.mesh.parent) pk.mesh.parent.remove(pk.mesh);
        if (pk.kind === 'health') {
          heal(pk.amount || 40);
          events.emit('pickup', { kind: 'health', amount: pk.amount || 40 });
        } else if (pk.kind === 'ammo') {
          events.emit('ammo-picked', { amount: pk.amount || 60, weapon: pk.weapon || null });
          events.emit('pickup', { kind: 'ammo', amount: pk.amount || 60 });
        }
      }
    }
  }

  function update(dt) {
    if (body.dead) {
      body.respawnTimer -= dt;
      mesh.rotation.x = Math.min(Math.PI / 2, mesh.rotation.x + dt * 2);
      if (body.respawnTimer <= 0) {
        mesh.rotation.x = 0;
        respawn();
      }
      return;
    }
    if (!p.onFoot) {
      // Driving: keep the on-foot mesh parked out of sight.
      mesh.visible = false;
      return;
    }
    mesh.visible = true;

    // WASD moves relative to the camera yaw; Shift runs, Space jumps.
    const yaw = cameraYaw();
    let mx = 0;
    let mz = 0;
    if (keys.isDown('KeyW') || keys.isDown('ArrowUp')) { mx += Math.sin(yaw); mz += Math.cos(yaw); }
    if (keys.isDown('KeyS') || keys.isDown('ArrowDown')) { mx -= Math.sin(yaw); mz -= Math.cos(yaw); }
    if (keys.isDown('KeyA') || keys.isDown('ArrowLeft')) { mx -= Math.cos(yaw); mz += Math.sin(yaw); }
    if (keys.isDown('KeyD') || keys.isDown('ArrowRight')) { mx += Math.cos(yaw); mz -= Math.sin(yaw); }
    const moving = mx !== 0 || mz !== 0;
    if (moving) {
      const len = Math.sqrt(mx * mx + mz * mz);
      mx /= len;
      mz /= len;
      p.heading = Math.atan2(mx, mz);
    }
    const running = keys.isDown('ShiftLeft') || keys.isDown('ShiftRight');
    const speed = running ? 6.2 : 3.4;
    let nx = p.x + mx * speed * dt;
    let nz = p.z + mz * speed * dt;
    const fixed = pushOutOfBuildings(nx, nz);
    nx = clamp(fixed.x, -295, 295);
    nz = clamp(fixed.z, -295, 295);
    p.x = nx;
    p.z = nz;
    p.speedKmh = Math.round((moving ? speed : 0) * 3.6);

    // Jump with gravity; Space only launches from the ground.
    if (keys.pressed && keys.pressed('Space') && body.grounded) {
      body.vy = 6.5;
      body.grounded = false;
      body.jumpFrom = { x: p.x, z: p.z };
    }
    if (!body.grounded) {
      body.vy -= 18 * dt;
      let y = mesh.position.y + body.vy * dt;
      if (y <= 0) {
        y = 0;
        body.vy = 0;
        body.grounded = true;
        // Longest jump: horizontal distance from takeoff to landing.
        if (body.jumpFrom && state.stats) {
          const d = Math.hypot(p.x - body.jumpFrom.x, p.z - body.jumpFrom.z);
          state.stats.longestJump = Math.max(state.stats.longestJump || 0, d);
        }
        body.jumpFrom = null;
      }
      mesh.position.y = y;
    }

    // Walk-cycle swing and facing.
    if (moving) body.bob += dt * (running ? 11 : 8);
    const swing = moving ? Math.sin(body.bob) * 0.55 : 0;
    mesh.userData.legL.rotation.x = swing;
    mesh.userData.legR.rotation.x = -swing;
    mesh.userData.armL.rotation.x = -swing * 0.7;
    mesh.userData.armR.rotation.x = swing * 0.7;
    mesh.position.x = p.x;
    mesh.position.z = p.z;
    mesh.rotation.y = p.heading;

    collectPickups();
  }

  return {
    mesh,
    body,
    update,
    takeDamage,
    heal,
    die,
    respawn,
    collectPickups,
    isDead: () => body.dead,
  };
}
