// Maravilla — side activities: 20 Golden Gecko collectibles, 5 stunt
// jumps, repeatable district jobs, a 5-car export list, and the Casa Verde
// safehouse. Everything pays, everything is tracked in state.side +
// state.stats, and everything shows up in the pause menu's STATS tab.
// Communicates only via state.* and events; never imports another system.

import * as THREE from 'three';
import { CITY, VEHICLES, DISTRICTS } from './config.js';

const GECKO_COUNT = 20;
const GECKO_REWARD = 150;
const JUMP_REWARD = 200;
const EXPORT_REWARD = 1200;
const SAFEHOUSE_PRICE = 2000;
const JOB_BASE_PAY = 200;
const JOB_TIME = 120;
const JOB_COOLDOWN = 60;

// Stunt jumps: ramp spots (x, z, heading the ramp faces).
const JUMPS = [
  { x: 0, z: -120, heading: Math.PI / 2, name: 'Avenida Launch' },
  { x: 240, z: 60, heading: 0, name: 'Beachfront Kicker' },
  { x: -240, z: 120, heading: -Math.PI / 2, name: 'Faro Flyer' },
  { x: 120, z: -240, heading: Math.PI, name: 'Stadium Leap' },
  { x: -60, z: 240, heading: Math.PI / 2, name: 'Centro Air' },
];

// District job boards: one spot per district (walk up, press E).
const JOB_SPOTS = [
  { district: 'El Faro', x: -210, z: 90, name: 'Fish market' },
  { district: 'Marina Alba', x: -210, z: -150, name: 'Dock office' },
  { district: 'Centro Alba', x: -30, z: 90, name: 'Plaza kiosk' },
  { district: 'Paseo del Mar', x: 30, z: -150, name: 'Night stall' },
  { district: 'Miramar', x: 210, z: 150, name: 'Boardwalk stand' },
  { district: 'Estadio Sol', x: 150, z: -150, name: 'Ticket booth' },
];

const EXPORT_POINT = { x: -260, z: -260, name: 'Marina Alba export dock' };

export function createSide(ctx) {
  const { state, scene, events, rng, city, input } = ctx;
  const THREE_ = ctx.THREE || THREE;
  const p = state.player;
  const rand = rng || Math.random;

  let geckos = []; // { i, x, z, mesh }
  let jumpMeshes = [];
  let exportMarker = null;
  let safehouseMarker = null;
  let jobMarker = null;
  let activeJob = null; // { district, x, z, timer, pay }
  let prevE = false;
  let airT = 0; // remaining hop time for a stunt jump
  let airVeh = null;

  function msg(text, kind = 'info') {
    if (ctx.hud && ctx.hud.message) { ctx.hud.message(text, kind); return; }
    if (state.messages) state.messages.push({ text, at: state.time, kind });
  }
  function setObjective(text) {
    state.objective = text;
    if (ctx.hud && ctx.hud.setObjective) ctx.hud.setObjective(text);
  }

  function goldGeckoMesh() {
    const g = new THREE_.Group();
    const gold = new THREE_.MeshLambertMaterial({ color: 0xf2c230, emissive: 0x8a6a10 });
    const body = new THREE_.Mesh(new THREE_.OctahedronGeometry(0.55), gold);
    body.position.y = 1.2;
    body.castShadow = true;
    g.add(body);
    const tail = new THREE_.Mesh(new THREE_.ConeGeometry(0.18, 0.9, 6), gold);
    tail.rotation.z = Math.PI / 2.4;
    tail.position.set(0.55, 1.1, 0);
    g.add(tail);
    const eye = new THREE_.Mesh(new THREE_.SphereGeometry(0.09, 6, 6),
      new THREE_.MeshBasicMaterial({ color: 0x1c2733 }));
    eye.position.set(-0.4, 1.35, 0.2);
    g.add(eye);
    return g;
  }

  function buildGeckos() {
    if (!scene) return;
    for (let i = 0; i < GECKO_COUNT; i += 1) {
      let pt = null;
      for (let tries = 0; tries < 6; tries += 1) {
        const cand = city.randomSidewalkPoint(rand);
        const fixed = city.collide(cand.x, cand.z, 0.6);
        if (Math.hypot(fixed.x - cand.x, fixed.z - cand.z) < 0.05) { pt = cand; break; }
      }
      if (!pt) pt = city.randomSidewalkPoint(rand);
      const mesh = goldGeckoMesh();
      mesh.position.set(pt.x, 0, pt.z);
      scene.add(mesh);
      geckos.push({ i, x: pt.x, z: pt.z, mesh });
    }
    // Hide the ones a loaded save already collected.
    for (const g of geckos) {
      if ((state.side.geckoIds || []).includes(g.i)) {
        g.mesh.visible = false;
      }
    }
  }

  function buildJumps() {
    if (!scene) return;
    for (const j of JUMPS) {
      const g = new THREE_.Group();
      const ramp = new THREE_.Mesh(
        new THREE_.BoxGeometry(4, 0.5, 6),
        new THREE_.MeshLambertMaterial({ color: 0xf2c230 }),
      );
      ramp.position.y = 0.6;
      ramp.rotation.x = -0.42;
      ramp.castShadow = true;
      g.add(ramp);
      const chevron = new THREE_.Mesh(
        new THREE_.ConeGeometry(0.7, 1.6, 4),
        new THREE_.MeshBasicMaterial({ color: 0xffd94d }),
      );
      chevron.position.y = 2.6;
      chevron.rotation.x = Math.PI;
      g.add(chevron);
      g.position.set(j.x, 0, j.z);
      g.rotation.y = j.heading;
      scene.add(g);
      jumpMeshes.push(g);
    }
  }

  function buildMarkers() {
    if (!scene) return;
    // Export dock marker (green flag) at Marina Alba.
    exportMarker = new THREE_.Group();
    const pole = new THREE_.Mesh(new THREE_.CylinderGeometry(0.09, 0.09, 5, 6),
      new THREE_.MeshLambertMaterial({ color: 0x2c313a }));
    pole.position.y = 2.5;
    exportMarker.add(pole);
    const flag = new THREE_.Mesh(new THREE_.PlaneGeometry(1.8, 1.1),
      new THREE_.MeshBasicMaterial({ color: 0x37d67a, side: THREE_.DoubleSide }));
    flag.position.set(0.95, 4.4, 0);
    exportMarker.add(flag);
    exportMarker.position.set(EXPORT_POINT.x, 0, EXPORT_POINT.z);
    exportMarker.visible = false;
    scene.add(exportMarker);
    // Safehouse: a small green house + marker at Casa Verde.
    safehouseMarker = new THREE_.Group();
    const house = new THREE_.Mesh(new THREE_.BoxGeometry(6, 4, 5),
      new THREE_.MeshLambertMaterial({ color: 0x2e8a5a }));
    house.position.y = 2;
    house.castShadow = true;
    safehouseMarker.add(house);
    const roof = new THREE_.Mesh(new THREE_.ConeGeometry(4.4, 2, 4),
      new THREE_.MeshLambertMaterial({ color: 0xd84040 }));
    roof.position.y = 5;
    roof.rotation.y = Math.PI / 4;
    safehouseMarker.add(roof);
    const diamond = new THREE_.Mesh(new THREE_.OctahedronGeometry(0.9),
      new THREE_.MeshBasicMaterial({ color: 0x37d67a }));
    diamond.position.y = 7.5;
    safehouseMarker.add(diamond);
    safehouseMarker.position.set(CITY.places.safehouse.x, 0, CITY.places.safehouse.z);
    scene.add(safehouseMarker);
  }

  function nearCar(dist) {
    let best = Infinity;
    for (const v of state.vehicles) {
      const d = Math.hypot(v.x - p.x, v.z - p.z);
      if (d < best) best = d;
    }
    return best < dist;
  }

  function startJob(spot) {
    const standing = state.districtStanding[spot.district] ?? 50;
    const fx = state.standingFx || {};
    if ((fx.jobMult || 1) <= 0 || standing < 25) {
      msg(`${spot.district} is hostile — nobody there will hire you. Raise your standing first.`, 'bad');
      return;
    }
    const readyAt = (state.side.jobCooldowns || {})[spot.district] || 0;
    if (state.time < readyAt) {
      msg(`No work at the ${spot.name} yet — come back in ${Math.ceil(readyAt - state.time)}s.`, 'info');
      return;
    }
    // Destination: a random road point inside the same district.
    const d = DISTRICTS.find((x) => x.name === spot.district);
    let tx = spot.x + 40;
    let tz = spot.z + 40;
    for (let tries = 0; tries < 8; tries += 1) {
      const cand = city.randomRoadPoint(rand);
      if (d && cand.x >= d.minX && cand.x < d.maxX && cand.z >= d.minZ && cand.z < d.maxZ) {
        tx = cand.x; tz = cand.z; break;
      }
    }
    const pay = Math.round(JOB_BASE_PAY * (fx.jobMult || 1));
    activeJob = { district: spot.district, x: tx, z: tz, timer: JOB_TIME, pay };
    setObjective(`District job (${spot.district}): deliver the package — $${pay}.`);
    msg(`Job from the ${spot.name}: deliver the package across ${spot.district} in ${JOB_TIME}s — $${pay}.`, 'info');
    if (events) events.emit('mission', { stage: 'job-start', district: spot.district });
  }

  function completeJob() {
    if (!activeJob) return;
    p.money += activeJob.pay;
    p.rp += 25;
    state.stats.moneyEarned += activeJob.pay;
    state.stats.jobs += 1;
    state.side.jobsDone += 1;
    state.side.jobCooldowns[activeJob.district] = state.time + JOB_COOLDOWN;
    msg(`Job done in ${activeJob.district}: +$${activeJob.pay}, +25 RP.`, 'good');
    activeJob = null;
    setObjective(state.mission ? state.mission.objective : 'Go to the yellow marker to start the next mission.');
  }

  function trySafehouse() {
    const sh = CITY.places.safehouse;
    if (Math.hypot(p.x - sh.x, p.z - sh.z) > 6) return false;
    if (!state.side.safehouse) {
      const mult = (state.standingFx && state.standingFx.priceMult) || 1;
      const price = Math.round((SAFEHOUSE_PRICE * mult) / 10) * 10;
      if (p.money < price) {
        msg(`Casa Verde costs $${price} — you have $${Math.floor(p.money)}.`, 'bad');
        return true;
      }
      p.money -= price;
      state.side.safehouse = true;
      msg('Casa Verde is yours. Press E here any time to rest: full health + save.', 'good');
      return true;
    }
    // Owned: rest — full health + save.
    p.health = 100;
    p.armour = Math.max(p.armour, 25);
    if (ctx.save && ctx.save.save) ctx.save.save();
    msg('Rested at Casa Verde. Health restored, game saved.', 'good');
    return true;
  }

  function isExportTarget(defId) {
    return (state.side.exportRemaining || []).includes(defId);
  }

  function update(dt) {
    if (state.screen !== 'play') return;

    // --- Golden Geckos: walk within 2.5 m.
    for (const g of geckos) {
      if (!g.mesh.visible) continue;
      g.mesh.rotation.y += dt * 1.5;
      if (Math.hypot(p.x - g.x, p.z - g.z) < 2.5) {
        g.mesh.visible = false;
        state.side.geckoIds.push(g.i);
        state.side.geckosFound += 1;
        state.stats.collectibles += 1;
        p.money += GECKO_REWARD;
        p.rp += 25;
        state.stats.moneyEarned += GECKO_REWARD;
        msg(`Golden Gecko ${state.side.geckosFound}/20! +$${GECKO_REWARD}, +25 RP.`, 'good');
        if (state.side.geckosFound >= GECKO_COUNT) {
          p.money += 2000;
          state.stats.moneyEarned += 2000;
          msg('All 20 Golden Geckos! Mama Luz pays a $2,000 completion bonus.', 'good');
        }
      }
    }

    // --- Stunt jumps: drive over a ramp faster than 12 m/s.
    const veh = p.vehicleId !== null
      ? state.vehicles.find((v) => v.id === p.vehicleId) : null;
    if (veh && Math.abs(veh.speed) > 12) {
      for (let i = 0; i < JUMPS.length; i += 1) {
        const j = JUMPS[i];
        if ((state.side.jumpIds || []).includes(i)) continue;
        if (Math.hypot(p.x - j.x, p.z - j.z) < 5) {
          state.side.jumpIds.push(i);
          state.side.jumpsDone += 1;
          state.stats.jumps += 1;
          p.money += JUMP_REWARD;
          p.rp += 25;
          state.stats.moneyEarned += JUMP_REWARD;
          airT = 0.9;
          airVeh = veh;
          msg(`Stunt jump! ${j.name} — ${state.side.jumpsDone}/5. +$${JUMP_REWARD}, +25 RP.`, 'good');
        }
      }
    }
    // The hop itself: a visible arc on the vehicle mesh.
    if (airT > 0 && airVeh) {
      airT -= dt;
      const k = 1 - airT / 0.9;
      airVeh._airY = Math.sin(k * Math.PI) * 2.2;
      if (airT <= 0) { airVeh._airY = 0; airVeh = null; }
    }

    // --- Export list: drive a wanted car to the Marina Alba dock.
    const wanted = veh && isExportTarget(veh.defId);
    if (exportMarker) exportMarker.visible = !!wanted;
    if (wanted) {
      if (!state.mission) {
        setObjective(`EXPORT: deliver the ${(VEHICLES[veh.defId] || {}).name || veh.defId} to Marina Alba — $${EXPORT_REWARD}.`);
      }
      if (Math.hypot(p.x - EXPORT_POINT.x, p.z - EXPORT_POINT.z) < 8) {
        const defId = veh.defId;
        state.side.exportRemaining = state.side.exportRemaining.filter((d) => d !== defId);
        state.side.exportsDone += 1;
        state.stats.exports += 1;
        p.money += EXPORT_REWARD;
        p.rp += 50;
        state.stats.moneyEarned += EXPORT_REWARD;
        if (ctx.vehicles && ctx.vehicles.removeVehicle) ctx.vehicles.removeVehicle(veh.id);
        p.vehicleId = null;
        p.onFoot = true;
        p.hidden = 0;
        p.speed = 0;
        msg(`Exported the ${(VEHICLES[defId] || {}).name}! +$${EXPORT_REWARD}, +50 RP. ${state.side.exportRemaining.length} left on the list.`, 'good');
        if (state.side.exportRemaining.length === 0) {
          p.money += 3000;
          state.stats.moneyEarned += 3000;
          msg('Export list complete! The buyer pays a $3,000 bonus.', 'good');
        }
        setObjective(state.mission ? state.mission.objective : 'Go to the yellow marker to start the next mission.');
      }
    }

    // --- District jobs + safehouse on E (on foot, no car within 4 m so E
    // never fights the enter-car action).
    const eHeld = input ? input.held('KeyE') : false;
    if (eHeld && !prevE && p.onFoot) {
      if (!nearCar(4)) {
        if (trySafehouse()) {
          // handled
        } else {
          for (const spot of JOB_SPOTS) {
            if (Math.hypot(p.x - spot.x, p.z - spot.z) < 5) {
              startJob(spot);
              break;
            }
          }
        }
      }
    }
    prevE = eHeld;

    // --- Active job: timer + arrival.
    if (activeJob) {
      activeJob.timer -= dt;
      if (Math.hypot(p.x - activeJob.x, p.z - activeJob.z) < 6) {
        completeJob();
      } else if (activeJob.timer <= 0) {
        msg(`Job in ${activeJob.district} expired — the package went to someone else.`, 'bad');
        activeJob = null;
        setObjective(state.mission ? state.mission.objective : 'Go to the yellow marker to start the next mission.');
      }
    }
  }

  buildGeckos();
  buildJumps();
  buildMarkers();

  // A wanted car entered: tell the player it is on the export list.
  if (events) {
    events.on('vehicle-enter', (d) => {
      const v = d && d.vehicle;
      if (v && isExportTarget(v.defId)) {
        msg(`That ${(VEHICLES[v.defId] || {}).name} is on the export list — take it to the Marina Alba dock.`, 'good');
      }
    });
  }

  return {
    update,
    isExportTarget,
    get geckos() { return geckos; },
    get jumps() { return JUMPS; },
    get jobSpots() { return JOB_SPOTS; },
    get exportPoint() { return EXPORT_POINT; },
    get activeJob() { return activeJob; },
    get safehousePrice() { return SAFEHOUSE_PRICE; },
  };
}
