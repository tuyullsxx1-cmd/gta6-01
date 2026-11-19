// Maravilla — weapon wheel + combat: cycling, reload, ray-hit shooting,
// fists, muzzle flash, sparks, health/ammo pickups.
// NOTE on input: main.js consumes the one-shot ACTION_* queue before systems
// run, so this file listens directly for pointerdown (fire) and keydown
// (Q / 1 / 2 cycle, R reload) — it works regardless of the loop wiring.
// Communicates only via state.* and events; never imports another system.

import * as THREE from 'three';
import { WEAPONS, WEAPON_ORDER, WEAPON_SHOP, CITY } from './config.js';

const PICKUP_RADIUS = 2;

export function createWeapons(ctx) {
  const { state, scene, camera, events, rng } = ctx;
  const THREE_ = ctx.THREE || THREE;
  const p = state.player;
  const rand = rng || Math.random;

  let cooldown = 0;
  let flashTimer = 0;
  let flash = null;
  let flashLight = null;
  let sparks = []; // { points, life }
  let pickups = []; // { kind: 'health'|'ammo', x, z, mesh }
  let canvas = null;

  function msg(text, kind = 'info') {
    if (ctx.hud && ctx.hud.message) { ctx.hud.message(text, kind); return; }
    if (state.messages) state.messages.push({ text, at: state.time, kind });
  }

  // --- muzzle flash: small emissive plane + point light at the gun, 60 ms.
  if (scene && camera) {
    flash = new THREE_.Mesh(
      new THREE_.PlaneGeometry(0.7, 0.7),
      new THREE_.MeshBasicMaterial({ color: 0xffe9a8, transparent: true, opacity: 0.95 }),
    );
    flash.visible = false;
    scene.add(flash);
    flashLight = new THREE_.PointLight(0xffc860, 0, 12);
    scene.add(flashLight);
  }

  function spawnPickups() {
    if (!scene) return;
    const spots = [];
    // Deterministic spread: 6 health + 6 ammo around the city.
    for (let i = 0; i < 12; i += 1) {
      const x = -260 + rand() * 520;
      const z = -260 + rand() * 520;
      spots.push({ x, z });
    }
    spots.forEach((s, i) => {
      const kind = i < 6 ? 'health' : 'ammo';
      const g = new THREE_.Group();
      if (kind === 'health') {
        const box = new THREE_.Mesh(new THREE_.BoxGeometry(0.9, 0.9, 0.9),
          new THREE_.MeshLambertMaterial({ color: 0x2fae5f }));
        box.castShadow = true;
        g.add(box);
        const crossMat = new THREE_.MeshBasicMaterial({ color: 0xffffff });
        const v = new THREE_.Mesh(new THREE_.BoxGeometry(0.18, 0.6, 0.05), crossMat);
        v.position.z = 0.48;
        g.add(v);
        const h = new THREE_.Mesh(new THREE_.BoxGeometry(0.6, 0.18, 0.05), crossMat);
        h.position.z = 0.48;
        g.add(h);
      } else {
        const box = new THREE_.Mesh(new THREE_.BoxGeometry(1, 0.6, 0.7),
          new THREE_.MeshLambertMaterial({ color: 0xc8a03a }));
        box.castShadow = true;
        g.add(box);
        const lid = new THREE_.Mesh(new THREE_.BoxGeometry(1.05, 0.12, 0.75),
          new THREE_.MeshLambertMaterial({ color: 0x8a6a20 }));
        lid.position.y = 0.36;
        g.add(lid);
      }
      g.position.set(s.x, kind === 'health' ? 0.6 : 0.4, s.z);
      scene.add(g);
      pickups.push({ kind, x: s.x, z: s.z, mesh: g });
    });
  }
  spawnPickups();

  function isOwned(id) {
    return (p.weaponsOwned || ['fists', 'pistol']).includes(id);
  }

  /** Near Fierro Arms (the gunshop)? Purchases happen there. */
  function nearGunshop() {
    const g = CITY.places.gunshop;
    return Math.hypot(p.x - g.x, p.z - g.z) < 12;
  }

  /** Buy a locked weapon at Fierro Arms. Returns true on success. */
  function buyWeapon(id) {
    const shop = WEAPON_SHOP[id];
    if (!shop || isOwned(id)) return false;
    // District standing moves the price: loyal streets get a discount.
    const mult = (state.standingFx && state.standingFx.priceMult) || 1;
    const price = Math.round((shop.price * mult) / 10) * 10;
    if (!nearGunshop()) {
      msg(`${WEAPONS[id].name} is LOCKED — buy it at Fierro Arms ($${price}).`, 'bad');
      return false;
    }
    if (p.money < price) {
      msg(`Not enough cash for the ${WEAPONS[id].name} ($${price}).`, 'bad');
      return false;
    }
    p.money -= price;
    p.weaponsOwned.push(id);
    msg(`Bought the ${WEAPONS[id].name} at Fierro Arms.`, 'good');
    if (events) events.emit('weapon-bought', { weapon: id });
    refreshWheel();
    return true;
  }

  // --- weapon wheel: a radial overlay (Tab to open). Six slots around a
  // ring; mouse angle highlights a slice, click or keys 1-6 select it.
  // Locked weapons show LOCKED + their unlock line; clicking one near
  // Fierro Arms buys it, anywhere else it just says where to get it.
  // Built lazily so Node smoke tests (no document) never touch the DOM.
  let wheelEl = null;
  let wheelSlots = [];
  let wheelOpen = false;
  let wheelHi = -1;

  function buildWheel() {
    if (wheelEl || typeof document === 'undefined') return;
    wheelEl = document.createElement('div');
    wheelEl.id = 'weapon-wheel';
    wheelEl.style.display = 'none';
    wheelEl.innerHTML = '<div class="wheel-title">WEAPONS</div>'
      + '<div class="wheel-ring"></div>'
      + '<div class="wheel-hint">Click a weapon or press 1–6 · Tab closes · Locked guns sell at Fierro Arms</div>';
    const ring = wheelEl.querySelector('.wheel-ring');
    WEAPON_ORDER.forEach((id, i) => {
      const w = WEAPONS[id];
      const slot = document.createElement('div');
      slot.className = 'wheel-slot';
      slot.dataset.weapon = id;
      const ang = (-90 + i * 60) * (Math.PI / 180);
      slot.style.left = `${180 + Math.cos(ang) * 118 - 52}px`;
      slot.style.top = `${180 + Math.sin(ang) * 118 - 32}px`;
      slot.innerHTML = `<b>${w.name}</b><span class="wheel-ammo"></span><span class="wheel-lock"></span>`;
      slot.addEventListener('click', () => selectWeapon(id));
      ring.appendChild(slot);
      wheelSlots.push(slot);
    });
    wheelEl.addEventListener('mousemove', (event) => {
      const r = ring.getBoundingClientRect();
      const cx = r.left + r.width / 2;
      const cy = r.top + r.height / 2;
      const ang = Math.atan2(event.clientY - cy, event.clientX - cx) * (180 / Math.PI);
      let best = 0;
      let bestD = Infinity;
      WEAPON_ORDER.forEach((id, i) => {
        const slotAng = -90 + i * 60;
        let d = Math.abs(((ang - slotAng + 540) % 360) - 180);
        if (d < bestD) { bestD = d; best = i; }
      });
      highlightSlot(best);
    });
    document.body.appendChild(wheelEl);
  }

  function highlightSlot(i) {
    wheelHi = i;
    wheelSlots.forEach((s, j) => s.classList.toggle('active', j === i));
  }

  function refreshWheel() {
    if (!wheelEl) return;
    wheelSlots.forEach((slot, i) => {
      const id = WEAPON_ORDER[i];
      const w = WEAPONS[id];
      const owned = isOwned(id);
      const ammoEl = slot.querySelector('.wheel-ammo');
      if (ammoEl) {
        ammoEl.textContent = !owned ? '' : (Number.isFinite(w.mag)
          ? `${p.mag[id] || 0} / ${p.ammo[id] || 0}` : '∞');
      }
      const lockEl = slot.querySelector('.wheel-lock');
      if (lockEl) {
        lockEl.textContent = owned ? '' : `LOCKED · ${WEAPON_SHOP[id] ? `$${WEAPON_SHOP[id].price}` : ''}`;
      }
      slot.classList.toggle('locked', !owned);
      slot.classList.toggle('current', p.weapon === id);
    });
  }

  function openWheel() {
    if (state.screen !== 'play') return;
    buildWheel();
    if (!wheelEl) return;
    wheelOpen = true;
    wheelEl.style.display = 'block';
    highlightSlot(Math.max(0, WEAPON_ORDER.indexOf(p.weapon)));
    refreshWheel();
  }

  function closeWheel() {
    wheelOpen = false;
    if (wheelEl) wheelEl.style.display = 'none';
  }

  function selectWeapon(id) {
    if (!WEAPONS[id]) return;
    if (!isOwned(id)) {
      // Locked: buying at Fierro Arms selects it; otherwise say how.
      if (buyWeapon(id)) {
        p.weapon = id;
        msg(`${WEAPONS[id].name} ready.`, 'info');
        if (ctx.audio && ctx.audio.play) ctx.audio.play('click');
      }
      refreshWheel();
      return;
    }
    p.weapon = id;
    msg(`${WEAPONS[id].name} ready.`, 'info');
    if (ctx.audio && ctx.audio.play) ctx.audio.play('click');
    refreshWheel();
    closeWheel();
  }

  function cycle(dir) {
    // Cycling skips locked weapons — the wheel is the only way to see them.
    const owned = WEAPON_ORDER.filter((id) => isOwned(id));
    if (owned.length === 0) return;
    const idx = owned.indexOf(p.weapon);
    const next = owned[(idx + dir + owned.length) % owned.length];
    p.weapon = next;
    const w = WEAPONS[next];
    msg(`${w.name} ready.`, 'info');
    if (ctx.audio && ctx.audio.play) ctx.audio.play('click');
  }

  function reload() {
    const w = WEAPONS[p.weapon];
    if (!w || !Number.isFinite(w.mag)) return; // fists: nothing to reload
    const need = w.mag - (p.mag[p.weapon] || 0);
    if (need <= 0) return;
    const reserve = p.ammo[p.weapon] || 0;
    if (reserve <= 0) {
      msg(`No ${w.name} ammo left. Find an ammo box.`, 'bad');
      return;
    }
    const take = Math.min(need, reserve);
    p.mag[p.weapon] = (p.mag[p.weapon] || 0) + take;
    p.ammo[p.weapon] = reserve - take;
    msg(`${w.name} reloaded.`, 'info');
  }

  function sparkBurst(at) {
    if (!scene) return;
    const n = 10;
    const pos = new Float32Array(n * 3);
    for (let i = 0; i < n; i += 1) {
      pos[i * 3] = at.x + (rand() - 0.5) * 0.6;
      pos[i * 3 + 1] = (at.y || 1) + (rand() - 0.5) * 0.6;
      pos[i * 3 + 2] = at.z + (rand() - 0.5) * 0.6;
    }
    const geo = new THREE_.BufferGeometry();
    geo.setAttribute('position', new THREE_.BufferAttribute(pos, 3));
    const points = new THREE_.Points(geo, new THREE_.PointsMaterial({
      color: 0xffc860, size: 0.22, transparent: true, opacity: 1,
    }));
    scene.add(points);
    sparks.push({ points, life: 0.35 });
  }

  // Manual ray-sphere test against peds / cops / vehicles — cheap, and it does
  // not depend on the scene graph (traffic may or may not be wired yet).
  function rayHit(origin, dir, range) {
    let best = null;
    const consider = (obj, radius, kind) => {
      const ox = obj.x - origin.x;
      const oz = obj.z - origin.z;
      const oy = (obj.y ?? 0) + 1 - origin.y;
      const t = ox * dir.x + oy * dir.y + oz * dir.z;
      if (t < 0 || t > range) return;
      const cx = origin.x + dir.x * t;
      const cy = origin.y + dir.y * t;
      const cz = origin.z + dir.z * t;
      const d2 = (obj.x - cx) ** 2 + ((obj.y ?? 0) + 1 - cy) ** 2 + (obj.z - cz) ** 2;
      if (d2 < radius * radius && (!best || t < best.t)) best = { t, obj, kind };
    };
    for (const ped of state.peds) {
      if (ped.state === 'down' || ped.state === 'dead') continue;
      consider(ped, 0.9, 'ped');
    }
    for (const cop of state.cops) consider(cop, 0.9, 'cop');
    for (const v of state.vehicles) {
      if (v.id === p.vehicleId) continue;
      consider(v, 2.2, 'car');
    }
    return best;
  }

  function applyHit(hit, damage, point) {
    if (hit.kind === 'ped') {
      const ped = hit.obj;
      ped.state = 'down';
      ped.speed = 0;
      if (ped.mesh) {
        ped.mesh.rotation.z = Math.PI / 2;
        ped.mesh.position.y = 0.3;
      }
      state.stats.pedsDown += 1;
      state.stats.hits += 1;
      if (events) events.emit('crime', { type: 'ped-hit', amount: 1 });
      msg('Pedestrian down. The city saw that.', 'bad');
    } else if (hit.kind === 'cop') {
      const cop = hit.obj;
      cop.health = (cop.health ?? 100) - damage;
      state.stats.hits += 1;
      if (events) events.emit('crime', { type: 'shoot-cop', amount: 2 });
      if (cop.health <= 0) msg('Cop down. El Gato will take that personally.', 'bad');
      else msg('You shot a cop. Heat is rising.', 'bad');
    } else if (hit.kind === 'car') {
      const v = hit.obj;
      if (ctx.vehicles && ctx.vehicles.damageVehicle) ctx.vehicles.damageVehicle(v.id, damage);
      else v.health = (v.health ?? 100) - damage;
      state.stats.hits += 1;
      sparkBurst(point || { x: v.x, y: 1, z: v.z });
    }
  }

  function fire() {
    if (state.screen !== 'play' || !p.onFoot) return;
    // A save from before ownership existed, or a stale selection: fall back.
    if (!isOwned(p.weapon)) p.weapon = 'fists';
    const w = WEAPONS[p.weapon];
    if (!w) return;
    if (cooldown > 0) return;

    // --- fists: short-range melee swing, 0.5 s cooldown.
    if (p.weapon === 'fists') {
      cooldown = 0.5;
      const fx = Math.sin(p.heading);
      const fz = Math.cos(p.heading);
      let best = null;
      let bestD = w.range;
      const near = (obj, kind) => {
        const dx = obj.x - p.x;
        const dz = obj.z - p.z;
        const d = Math.hypot(dx, dz);
        if (d > w.range) return;
        if (d > 0.01 && (dx * fx + dz * fz) / d < 0.3) return; // must face it
        if (d < bestD) { bestD = d; best = { obj, kind }; }
      };
      for (const ped of state.peds) {
        if (ped.state !== 'down') near(ped, 'ped');
      }
      for (const cop of state.cops) near(cop, 'cop');
      if (best) {
        applyHit({ obj: best.obj, kind: best.kind }, w.damage, { x: best.obj.x, y: 1, z: best.obj.z });
      }
      if (ctx.audio && ctx.audio.play) ctx.audio.play('swing');
      return;
    }

    // --- guns: need a round in the mag.
    if ((p.mag[p.weapon] || 0) <= 0) {
      msg('Click — empty. Press R to reload.', 'bad');
      if (ctx.audio && ctx.audio.play) ctx.audio.play('click');
      cooldown = 0.25;
      return;
    }
    p.mag[p.weapon] -= 1;
    state.stats.shotsFired += 1;
    cooldown = 1 / w.rate;

    // Direction: the camera's forward, flattened to horizontal, from the
    // player's eye height. (A raw camera ray dives below targets at range
    // because the third-person camera sits above the player.)
    let origin = { x: p.x, y: 1.6, z: p.z };
    let dir = { x: Math.sin(p.heading), y: 0, z: Math.cos(p.heading) };
    if (camera && camera.getWorldDirection) {
      const v = new THREE_.Vector3();
      camera.getWorldDirection(v);
      const len = Math.hypot(v.x, v.z) || 1;
      dir = { x: v.x / len, y: 0, z: v.z / len };
    }
    const pellets = w.pellets || 1;
    for (let i = 0; i < pellets; i += 1) {
      const d = { ...dir };
      if (w.spread) {
        d.x += (rand() - 0.5) * 2 * w.spread;
        d.y += (rand() - 0.5) * 2 * w.spread;
        d.z += (rand() - 0.5) * 2 * w.spread;
        const len = Math.hypot(d.x, d.y, d.z) || 1;
        d.x /= len; d.y /= len; d.z /= len;
      }
      const hit = rayHit(origin, d, w.range);
      if (hit) {
        const point = {
          x: origin.x + d.x * hit.t,
          y: origin.y + d.y * hit.t,
          z: origin.z + d.z * hit.t,
        };
        applyHit(hit, w.damage, point);
        sparkBurst(point);
      }
    }

    // --- muzzle flash, 60 ms.
    if (flash && camera) {
      flash.position.set(
        origin.x + dir.x * 1.2,
        origin.y + dir.y * 1.2 - 0.2,
        origin.z + dir.z * 1.2,
      );
      flash.lookAt(camera.position);
      flash.visible = true;
      flashTimer = 0.06;
      if (flashLight) {
        flashLight.position.copy(flash.position);
        flashLight.intensity = 6;
      }
    }
    if (ctx.audio && ctx.audio.play) ctx.audio.play('shot');
  }

  // Direct listeners (see the note at the top of this file).
  if (typeof window !== 'undefined') {
    window.addEventListener('keydown', (event) => {
      if (event.repeat) return;
      if (state.screen !== 'play') return;
      // Tab opens/closes the weapon wheel; while it is open, 1-5 pick a
      // weapon and cycling is suppressed.
      if (event.code === 'Tab') {
        event.preventDefault();
        if (wheelOpen) closeWheel();
        else openWheel();
        return;
      }
      if (event.code === 'Escape' && wheelOpen) { closeWheel(); return; }
      if (wheelOpen) {
        const n = ['Digit1', 'Digit2', 'Digit3', 'Digit4', 'Digit5', 'Digit6'].indexOf(event.code);
        if (n >= 0) selectWeapon(WEAPON_ORDER[n]);
        return;
      }
      if (event.code === 'KeyQ' || event.code === 'Digit1') cycle(-1);
      else if (event.code === 'Digit2') cycle(1);
      else if (event.code === 'KeyR') reload();
    });
  }
  if (typeof document !== 'undefined') {
    // Canvas may not exist yet in a stub ctx; resolve lazily on first use.
    const bind = () => {
      canvas = document.getElementById('game');
      if (canvas) {
        canvas.addEventListener('pointerdown', (event) => {
          if (event.button !== 0) return;
          if (state.screen === 'play' && p.onFoot) fire();
        });
      }
    };
    bind();
    if (!canvas) {
      setTimeout(bind, 0);
    }
  }

  function update(dt) {
    if (cooldown > 0) cooldown -= dt;
    if (wheelOpen) refreshWheel();
    if (flashTimer > 0) {
      flashTimer -= dt;
      if (flashTimer <= 0 && flash) {
        flash.visible = false;
        if (flashLight) flashLight.intensity = 0;
      }
    }
    // Auto fire while the mouse is held, for automatic weapons.
    if (state.screen === 'play' && p.onFoot && WEAPONS[p.weapon]
      && WEAPONS[p.weapon].auto && ctx.input && ctx.input.mouseDown
      && typeof ctx.input.mouseDown === 'function' && ctx.input.mouseDown()) {
      fire();
    }
    // Sparks fade.
    for (let i = sparks.length - 1; i >= 0; i -= 1) {
      sparks[i].life -= dt;
      if (sparks[i].points.material) sparks[i].points.material.opacity = Math.max(0, sparks[i].life / 0.35);
      if (sparks[i].life <= 0) {
        if (scene) scene.remove(sparks[i].points);
        sparks.splice(i, 1);
      }
    }
    // Crosshair only with a gun equipped.
    if (typeof document !== 'undefined') {
      const ch = document.getElementById('crosshair');
      if (ch) {
        const gun = p.weapon !== 'fists';
        ch.style.display = (state.screen === 'play' && p.onFoot && gun) ? 'block' : 'none';
      }
    }
    if (state.screen !== 'play' || !p.onFoot) return;

    // --- pickups: walk within 2 m to collect.
    for (let i = pickups.length - 1; i >= 0; i -= 1) {
      const pk = pickups[i];
      if (Math.hypot(pk.x - p.x, pk.z - p.z) > PICKUP_RADIUS) continue;
      if (pk.kind === 'health') {
        if (p.health >= 100) continue;
        p.health = Math.min(100, p.health + 50);
        msg('Health pack: +50.', 'good');
      } else {
        const w = WEAPONS[p.weapon];
        const key = p.weapon === 'fists' ? 'pistol' : p.weapon;
        if (w && Number.isFinite(w.ammo)) {
          p.ammo[key] = (p.ammo[key] || 0) + 30;
          msg(`Ammo box: +30 ${WEAPONS[key].name} rounds.`, 'good');
        } else {
          p.ammo.pistol = (p.ammo.pistol || 0) + 30;
          msg('Ammo box: +30 pistol rounds.', 'good');
        }
      }
      if (scene && pk.mesh) scene.remove(pk.mesh);
      pickups.splice(i, 1);
    }
  }

  return {
    update,
    fire,
    reload,
    cycle,
    openWheel,
    closeWheel,
    selectWeapon,
    isOwned,
    buyWeapon,
    nearGunshop,
    get wheelOpen() { return wheelOpen; },
    get pickups() { return pickups; },
  };
}
