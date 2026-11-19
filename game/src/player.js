// Maravilla — on-foot player: movement, jumping, health regen, WASTED.
// Owns the player mesh (a bright-jacket low-poly figure) and respawning.
// Communicates only via state.* and events; never imports another system.

import * as THREE from 'three';
import { PLAYER, CITY } from './config.js';

const BOUND = 295;

function showEndScreen(title, text) {
  if (typeof document === 'undefined') return;
  const screen = document.getElementById('end-screen');
  const t = document.getElementById('end-title');
  const tx = document.getElementById('end-text');
  if (screen) screen.style.display = 'flex';
  if (t) t.textContent = title;
  if (tx) tx.textContent = text;
}

export function createPlayer(ctx) {
  const { state, scene, input, events, city, rng } = ctx;
  const p = state.player;
  const THREE_ = ctx.THREE || THREE;

  let mesh = null;
  let vy = 0;
  let grounded = true;
  let lastHurtAt = -100;
  let lastHealth = p.health;
  let endBound = false;

  // --- mesh: capsule body in a bright jacket, head, cap — visible at a glance.
  if (scene) {
    const g = new THREE_.Group();
    const jacket = new THREE_.MeshLambertMaterial({ color: 0xff7a1a });
    const skin = new THREE_.MeshLambertMaterial({ color: 0xc98d64 });
    const denim = new THREE_.MeshLambertMaterial({ color: 0x2e4a6b });
    const body = new THREE_.Mesh(new THREE_.CapsuleGeometry(0.42, 0.7, 4, 10), jacket);
    body.position.y = 1.05;
    body.castShadow = true;
    g.add(body);
    const head = new THREE_.Mesh(new THREE_.SphereGeometry(0.3, 12, 10), skin);
    head.position.y = 1.95;
    head.castShadow = true;
    g.add(head);
    const cap = new THREE_.Mesh(new THREE_.CylinderGeometry(0.32, 0.34, 0.12, 12),
      new THREE_.MeshLambertMaterial({ color: 0x1c2733 }));
    cap.position.y = 2.18;
    g.add(cap);
    const brim = new THREE_.Mesh(new THREE_.BoxGeometry(0.4, 0.05, 0.3),
      new THREE_.MeshLambertMaterial({ color: 0x1c2733 }));
    brim.position.set(0, 2.14, 0.32);
    g.add(brim);
    const legL = new THREE_.Mesh(new THREE_.CapsuleGeometry(0.16, 0.5, 4, 8), denim);
    legL.position.set(-0.2, 0.45, 0);
    g.add(legL);
    const legR = legL.clone();
    legR.position.x = 0.2;
    g.add(legR);
    g.position.set(p.x, 0, p.z);
    scene.add(g);
    mesh = g;
  }

  function respawn(place, fee, title) {
    p.health = PLAYER.health;
    p.armour = 0;
    p.wanted = 0;
    p.dead = false;
    p.busted = false;
    p.vehicleId = null;
    p.onFoot = true;
    p.x = place.x;
    p.z = place.z;
    p.y = 0;
    vy = 0;
    if (fee > 0) p.money = Math.max(0, p.money - fee);
    state.screen = 'play';
    if (typeof document !== 'undefined') {
      const s = document.getElementById('end-screen');
      if (s) s.style.display = 'none';
    }
    if (events) events.emit('message', { text: `${title} — back on your feet, Rook.`, kind: 'info' });
    if (state.messages) state.messages.push({ text: `${title} — back on your feet, Rook.`, at: state.time, kind: 'info' });
  }

  function wasted() {
    if (state.screen !== 'play') return;
    p.dead = true;
    p.health = 0;
    state.screen = 'wasted';
    if (events) events.emit('player-down', { kind: 'wasted' });
    const fee = 200;
    const stats = state.stats;
    showEndScreen('WASTED', `The bay got the better of you. Hospital fee: $${fee}. ` +
      `Missions done: ${stats.missionsDone} · Money earned: $${stats.moneyEarned} · Cars stolen: ${stats.carsStolen}`);
    if (ctx.hud && ctx.hud.banner) ctx.hud.banner('WASTED', 'Clinica Sol patched you up.');
    // Respawn happens on Enter (bound below) or via respawnWasted().
    p._respawnPending = 'wasted';
  }

  function respawnWasted() {
    respawn(CITY.places.hospital, 200, 'WASTED');
  }

  // Enter restarts after WASTED/BUSTED even though main.js only steps systems
  // while screen === 'play', so this listener lives outside the loop.
  if (typeof window !== 'undefined' && !endBound) {
    endBound = true;
    window.addEventListener('keydown', (event) => {
      if (event.code !== 'Enter' && event.code !== 'Space') return;
      if (state.screen === 'wasted') respawnWasted();
      else if (state.screen === 'busted' && p._respawnPending === 'busted') {
        respawn(CITY.places.policeHq, 300, 'BUSTED');
      }
    });
  }

  // Track damage taken from any source (cops, falls) for the regen delay.
  if (events) {
    events.on('damage', (d) => {
      if (!d || d.target !== 'player') return;
      lastHurtAt = state.time;
      const amount = d.amount || 0;
      if (p.armour > 0) {
        const absorbed = Math.min(p.armour, amount);
        p.armour -= absorbed;
        p.health -= (amount - absorbed);
      } else {
        p.health -= amount;
      }
      p.health = Math.max(0, p.health);
    });
  }

  function update(dt) {
    // Keep the mesh in sync even when not on foot (hidden while driving).
    if (mesh) {
      mesh.visible = p.onFoot && state.screen !== 'title';
      mesh.position.set(p.x, p.y, p.z);
      mesh.rotation.y = p.heading;
    }
    if (state.screen !== 'play' || !p.onFoot) return;

    // Damage taken directly to state (e.g. tests, other systems) still counts.
    if (p.health < lastHealth) lastHurtAt = state.time;
    lastHealth = p.health;

    if (p.health <= 0) {
      wasted();
      return;
    }

    // --- movement, relative to the camera yaw (same convention as roam()).
    const yaw = state.camera ? state.camera.yaw : 0;
    const fwd = input ? input.moveAxis() : 0;
    const str = input ? input.strafeAxis() : 0;
    const run = input ? input.running() : false;
    const speed = run ? PLAYER.runSpeed : PLAYER.walkSpeed;
    const mx = Math.sin(yaw) * fwd + Math.cos(yaw) * str;
    const mz = Math.cos(yaw) * fwd - Math.sin(yaw) * str;
    const len = Math.hypot(mx, mz);
    if (len > 0.001) {
      const nx = (mx / len) * speed * dt;
      const nz = (mz / len) * speed * dt;
      // Slide along walls: try x and z separately through city.collide().
      let next = { x: p.x + nx, z: p.z };
      if (city && city.collide) next = city.collide(next.x, next.z, PLAYER.radius);
      else next.x = Math.max(-BOUND, Math.min(BOUND, next.x));
      p.x = next.x;
      next = { x: p.x, z: p.z + nz };
      if (city && city.collide) next = city.collide(next.x, next.z, PLAYER.radius);
      else next.z = Math.max(-BOUND, Math.min(BOUND, next.z));
      p.z = next.z;
      p.heading = Math.atan2(mx, mz);
      p.speed = speed;
      p.running = run;
    } else {
      p.speed = 0;
      p.running = false;
    }
    p.x = Math.max(-BOUND, Math.min(BOUND, p.x));
    p.z = Math.max(-BOUND, Math.min(BOUND, p.z));

    // --- jump: Space, simple vertical velocity + gravity, land on y = 0.
    if (input && input.jumping() && grounded) {
      vy = PLAYER.jumpSpeed;
      grounded = false;
    }
    if (!grounded) {
      vy -= PLAYER.gravity * dt;
      p.y += vy * dt;
      if (p.y <= 0) {
        p.y = 0;
        vy = 0;
        grounded = true;
      }
    }

    // --- slow health regen after 10 s calm, only when not wanted.
    if (p.wanted === 0 && p.health > 0 && p.health < PLAYER.health
      && state.time - lastHurtAt > 10) {
      p.health = Math.min(PLAYER.health, p.health + 1 * dt);
    }
  }

  return {
    update,
    respawnWasted,
    respawnAtHospital() { respawn(CITY.places.hospital, 200, 'WASTED'); },
    get mesh() { return mesh; },
  };
}
