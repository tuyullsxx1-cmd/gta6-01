// Driving: arcade vehicle physics + enter/exit (including carjack).
// Reads held keys with edge detection for E/H so it never fights main.js's
// takeActions() consumption. Owns nothing in state except the player/vehicle
// fields that already exist (player.onFoot/vehicleId/speed/heading, vehicle
// x/z/heading/speed/steer/health, stats.carsStolen/pedsDown/distanceDriven).

import { VEHICLES } from './config.js';

export function createDriving(ctx) {
  const { state, city, events, input } = ctx;
  let prevE = false;
  let prevH = false;
  let lastRamAt = -10;

  function nearestVehicle(maxDist) {
    let best = null;
    let bestD = maxDist;
    for (const v of state.vehicles) {
      const d = Math.hypot(v.x - state.player.x, v.z - state.player.z);
      if (d < bestD) { bestD = d; best = v; }
    }
    return best;
  }

  function enterVehicle(vehicle) {
    const v = vehicle || nearestVehicle(4);
    if (!v) return false;
    if (v.driver) {
      // Carjack: the driver bails and flees on foot.
      v.driver = false;
      state.stats.carsStolen += 1;
      events.emit('crime', { type: 'carjack', amount: 1 });
      events.emit('message', { text: 'Carjacked! The driver ran off.', kind: 'bad' });
    } else if (ctx.hud) {
      ctx.hud.message(`Driving the ${(VEHICLES[v.defId] || {}).name || v.defId}.`, 'info');
    }
    state.player.vehicleId = v.id;
    state.player.onFoot = false;
    state.player.hidden = 1; // player mesh hidden while driving
    state.player.speed = v.speed;
    state.player.heading = v.heading;
    state.player.x = v.x;
    state.player.z = v.z;
    events.emit('vehicle-enter', { vehicle: v });
    return true;
  }

  function exitVehicle() {
    const v = state.vehicles.find((x) => x.id === state.player.vehicleId);
    if (!v) {
      state.player.vehicleId = null;
      state.player.onFoot = true;
      state.player.hidden = 0;
      return false;
    }
    // Step out on the driver's side.
    const px = v.x + Math.cos(v.heading) * 2.6;
    const pz = v.z - Math.sin(v.heading) * 2.6;
    const fixed = city.collide(px, pz, 0.6);
    state.player.x = fixed.x;
    state.player.z = fixed.z;
    state.player.heading = v.heading;
    state.player.speed = 0;
    v.speed = 0;
    state.player.vehicleId = null;
    state.player.onFoot = true;
    state.player.hidden = 0;
    events.emit('vehicle-exit', { vehicle: v });
    return true;
  }

  function update(dt) {
    // Enter/exit on the rising edge of E; horn on the rising edge of H.
    const eHeld = input.held('KeyE');
    if (eHeld && !prevE && state.screen === 'play') {
      if (state.player.onFoot) enterVehicle(null);
      else exitVehicle();
    }
    prevE = eHeld;
    const hHeld = input.held('KeyH');
    if (hHeld && !prevH && ctx.audio) ctx.audio.horn();
    prevH = hHeld;
    // NOTE: never call input.takeActions() here — main.js owns the one-shot
    // action flags (Enter to start, P to pause); draining them here would
    // steal CONFIRM/PAUSE from the loop.

    const v = state.player.vehicleId !== null
      ? state.vehicles.find((x) => x.id === state.player.vehicleId)
      : null;
    if (!v) {
      if (ctx.audio) ctx.audio.engine(false, 0);
      return;
    }
    const def = VEHICLES[v.defId] || VEHICLES.vagabundo;
    // Garage upgrades: engine +15% top speed per level, nitro (Shift) +60%
    // accel and +25% top speed while held.
    const upg = (state.garageUpgrades && state.garageUpgrades[v.defId]) || {};
    const boosting = !!upg.nitro && input.held('ShiftLeft');
    const top = def.topSpeed * (1 + 0.15 * (upg.engine || 0)) * (boosting ? 1.25 : 1);
    const throttle = input.moveAxis(); // W +1, S -1
    const steerInput = input.strafeAxis(); // D +1, A -1
    const handbrake = input.held('Space');

    if (throttle > 0) {
      v.speed += def.accel * (boosting ? 1.6 : 1) * throttle * dt;
    } else if (throttle < 0) {
      if (v.speed > 0.5) v.speed += def.brake * throttle * dt; // brake
      else v.speed += def.accel * 0.6 * throttle * dt; // reverse
    }
    // Rolling drag.
    v.speed -= v.speed * 0.22 * dt;
    if (handbrake) {
      const cut = Math.min(Math.abs(v.speed), 30 * dt);
      v.speed -= Math.sign(v.speed) * cut;
    }
    // Speed cap: forward topSpeed, reverse ~40%.
    v.speed = Math.max(-top * 0.4, Math.min(top, v.speed));
    if (Math.abs(v.speed) < 0.05 && throttle === 0) v.speed = 0;

    // Steering: scaled by speed, sharper with the handbrake, inverted in reverse.
    v.steer += (steerInput - v.steer) * Math.min(1, dt * 8);
    const steerAuthority = Math.min(1, Math.abs(v.speed) / 8);
    const turnRate = v.steer * def.grip * 0.3 * steerAuthority * (handbrake ? 1.8 : 1);
    v.heading += turnRate * dt * Math.sign(v.speed || 1);
    // Bikes lean into the turn (visual only; the mesh sync keeps rotation.y).
    if (def.kind === 'bike' && v.mesh) {
      v.mesh.rotation.z = -v.steer * 0.28 * steerAuthority;
    }

    // Move + building collision (slide: keep the corrected position, lose speed).
    const nx = v.x + Math.sin(v.heading) * v.speed * dt;
    const nz = v.z + Math.cos(v.heading) * v.speed * dt;
    const fixed = city.collide(nx, nz, 1.7);
    const hit = Math.hypot(fixed.x - nx, fixed.z - nz) > 0.01;
    v.x = Math.max(-295, Math.min(295, fixed.x));
    v.z = Math.max(-295, Math.min(295, fixed.z));
    if (hit) {
      const impact = Math.abs(v.speed);
      v.speed *= 0.45;
      if (impact > 12) {
        if (ctx.vehicles && ctx.vehicles.damageVehicle) ctx.vehicles.damageVehicle(v.id, 8);
        else v.health = Math.max(0, v.health - 8);
        events.emit('message', { text: 'Crash!', kind: 'bad' });
      }
    }

    // Bump traffic cars (slow down, nudge them aside).
    for (const o of state.vehicles) {
      if (o === v) continue;
      const d = Math.hypot(o.x - v.x, o.z - v.z);
      if (d < 3.4 && d > 0.01) {
        v.speed *= 0.7;
        const push = (3.4 - d) * 0.5;
        o.x += ((o.x - v.x) / d) * push;
        o.z += ((o.z - v.z) / d) * push;
        // A patrol car ramming you damages your car (and itself, a little).
        // Gated to one hit per 0.6 s so a long shove is not a death sentence.
        if (o.defId === 'patrulla' && state.time - lastRamAt > 0.6) {
          const impact = Math.abs(v.speed) + Math.abs(o.speed || 0);
          if (impact > 8) {
            lastRamAt = state.time;
            if (ctx.vehicles && ctx.vehicles.damageVehicle) {
              ctx.vehicles.damageVehicle(v.id, 8);
              ctx.vehicles.damageVehicle(o.id, 4);
            } else {
              v.health = Math.max(0, v.health - 8);
            }
            events.emit('message', { text: 'The patrol car rammed you!', kind: 'bad' });
          }
        }
      }
    }
    // Hit a pedestrian: knock them down (never a graphic kill) + wanted.
    if (Math.abs(v.speed) > 3) {
      for (const ped of state.peds) {
        if (ped.state === 'down') continue;
        const d = Math.hypot(ped.x - v.x, ped.z - v.z);
        if (d < 2.2) {
          ped.state = 'down';
          ped._downT = 4;
          state.stats.pedsDown += 1;
          events.emit('crime', { type: 'ped-hit', amount: 1 });
          events.emit('message', { text: 'You hit a pedestrian!', kind: 'bad' });
        }
      }
    }

    // Sync the player onto the car; HUD reads player.speed.
    state.player.x = v.x;
    state.player.z = v.z;
    state.player.heading = v.heading;
    state.player.speed = v.speed;
    state.stats.distanceDriven += Math.abs(v.speed) * dt;
    if (ctx.audio) ctx.audio.engine(true, Math.abs(v.speed) / top);
  }

  return { update, enterVehicle, exitVehicle, nearestVehicle };
}
