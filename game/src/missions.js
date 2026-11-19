// Maravilla — story missions (10, in MISSION_NAMES order) + side activities
// (street races, taxi fares). Small stage machines: go-to marker, checkpoints,
// timers, lose-the-cops escapes. All dialogue is original writing.
// Communicates only via state.* and events; never imports another system.

import * as THREE from 'three';
import { CITY, MISSION_NAMES, ACTS, MISSION_PARS, ratingForTime } from './config.js';

const MARKER_RADIUS = 6;
const CHECKPOINT_RADIUS = 9;

function dist(ax, az, bx, bz) {
  return Math.hypot(ax - bx, az - bz);
}

export function createMissions(ctx) {
  const { state, scene, events, rng } = ctx;
  const THREE_ = ctx.THREE || THREE;
  const p = state.player;
  const rand = rng || Math.random;
  const P = CITY.places;

  let markerMesh = null;
  let flagMesh = null;
  let subtitleQueue = [];
  let subtitleTimer = 0;
  let subtitleEl = null;

  // --- marker: a floating yellow diamond + beacon, moved to the active point.
  if (scene) {
    markerMesh = new THREE_.Group();
    const diamond = new THREE_.Mesh(
      new THREE_.OctahedronGeometry(1.6),
      new THREE_.MeshBasicMaterial({ color: 0xffd94d }),
    );
    diamond.position.y = 3.2;
    markerMesh.add(diamond);
    const beam = new THREE_.Mesh(
      new THREE_.CylinderGeometry(1.1, 1.1, 30, 12, 1, true),
      new THREE_.MeshBasicMaterial({
        color: 0xffd94d, transparent: true, opacity: 0.16,
        side: THREE_.DoubleSide, depthWrite: false,
      }),
    );
    beam.position.y = 15;
    markerMesh.add(beam);
    markerMesh.visible = false;
    markerMesh.userData.diamond = diamond;
    scene.add(markerMesh);

    flagMesh = new THREE_.Group();
    const pole = new THREE_.Mesh(new THREE_.CylinderGeometry(0.09, 0.09, 5, 6),
      new THREE_.MeshLambertMaterial({ color: 0x2c313a }));
    pole.position.y = 2.5;
    flagMesh.add(pole);
    const flag = new THREE_.Mesh(new THREE_.PlaneGeometry(1.6, 1),
      new THREE_.MeshBasicMaterial({ color: 0x3f8a4a, side: THREE_.DoubleSide }));
    flag.position.set(0.85, 4.4, 0);
    flagMesh.add(flag);
    flagMesh.visible = false;
    scene.add(flagMesh);
  }

  // --- text helpers: hud first, DOM/state fallback.
  function say(text) {
    if (ctx.hud && ctx.hud.subtitle) { ctx.hud.subtitle(text); return; }
    subtitleQueue.push(text);
  }
  function banner(title, sub) {
    if (ctx.hud && ctx.hud.banner) { ctx.hud.banner(title, sub); return; }
    if (typeof document !== 'undefined') {
      const b = document.getElementById('mission-banner');
      const t = document.getElementById('mission-title');
      const s = document.getElementById('mission-sub');
      if (b && t && s) {
        t.textContent = title;
        s.textContent = sub || '';
        b.style.display = 'block';
        setTimeout(() => { b.style.display = 'none'; }, 4200);
      }
    }
  }
  function msg(text, kind = 'info') {
    if (ctx.hud && ctx.hud.message) { ctx.hud.message(text, kind); return; }
    if (state.messages) state.messages.push({ text, at: state.time, kind });
  }
  function setObjective(text) {
    state.objective = text;
    if (ctx.hud && ctx.hud.setObjective) ctx.hud.setObjective(text);
  }
  function setMarker(x, z) {
    if (state.mission) state.mission.marker = { x, z };
    if (markerMesh) {
      markerMesh.position.set(x, 0, z);
      markerMesh.visible = true;
    }
  }
  function hideMarker() {
    if (markerMesh) markerMesh.visible = false;
  }

  // A bust or waste mid-mission fails it (player/police emit 'player-down').
  if (events) {
    events.on('player-down', (d) => {
      if (state.mission) failMission(d && d.kind ? d.kind : 'caught');
    });
  }

  // --- mission definitions. Stages: { kind, at, text, timer, next }.
  // kind: 'goto' (reach marker), 'checkpoints' (sequence), 'escape' (reach
  // marker while wanted, then lose the heat), 'deliver' (goto with timer).
  const DEFS = [
    {
      giver: 'luz',
      briefing: [
        "Mama Luz: Rook. Five years, and this city still owes you a set of wheels. Celia's got one — but the plates on it are hot.",
        "Celia: The plates on the Vagabundo belong to a cop's cousin. Swap them at the marina lockup, then bring the car home and I'll register it clean.",
      ],
      stages: [
        { kind: 'goto', at: P.garage, name: 'MEET CELIA', text: "Go to Celia's Garage" },
        { kind: 'deliver', at: P.marina, name: 'PLATE SWAP', text: 'Swap the plates at the Marina Alba lockup', timer: 240 },
        { kind: 'deliver', at: P.garage, name: 'REGISTER', text: 'Bring the clean plates back to the garage', timer: 240 },
      ],
      reward: { money: 400, respect: 10 },
    },
    {
      giver: 'luz',
      briefing: [
        "Mama Luz: Banco Alba keeps its cash in a van, not a vault. Grab the bag, Rook.",
        "Mama Luz: In and out. The bank's guards are slow, but El Gato is not.",
      ],
      stages: [
        { kind: 'goto', at: P.bank, name: 'THE VAN', text: 'Reach Banco Alba' },
        { kind: 'deliver', at: P.marina, name: 'GETAWAY', text: 'Get the bag to Marina Alba', timer: 200 },
      ],
      reward: { money: 900, respect: 10 },
    },
    {
      giver: 'celia',
      briefing: [
        "Celia: My cousin's taxi got impounded and the fares are piling up. Drive it, Rook.",
        "Celia: Three stops. Don't keep the passengers waiting — and don't scratch the paint.",
      ],
      stages: [
        { kind: 'goto', at: P.garage, name: 'THE CAB', text: "Pick up the Toro Taxi at the garage" },
        { kind: 'checkpoints', at: [P.mercado, P.hotel, P.stadium], name: 'THREE STOPS', text: 'Drop off passengers', timer: 300 },
      ],
      reward: { money: 700, respect: 10, garage: 'cometa' },
    },
    {
      giver: 'tito',
      briefing: [
        "Tito: The Cometa's engine is singing, but she needs parts from the marina. Long way, Rook.",
        "Tito: Take the coast road. Paseo del Mar at sunset — that's the whole point of this city.",
      ],
      stages: [
        { kind: 'goto', at: P.marina, name: 'COAST ROAD', text: 'Collect the engine parts at Marina Alba' },
        { kind: 'deliver', at: P.garage, name: 'BRING IT BACK', text: 'Bring the parts back to the garage', timer: 260 },
      ],
      reward: { money: 800, respect: 10 },
    },
    {
      giver: 'marlon',
      briefing: [
        "Big Marlon: Fierro Arms is holding a shipment with my name on it. Go collect, Rook.",
        "Big Marlon: If anyone asks, you're picking up plumbing supplies. Heavy plumbing.",
      ],
      stages: [
        { kind: 'goto', at: P.gunshop, name: 'THE SHIPMENT', text: 'Reach Fierro Arms' },
        { kind: 'deliver', at: P.garage, name: 'HEAVY PLUMBING', text: 'Bring the shipment to the garage', timer: 220 },
      ],
      reward: { money: 1000, respect: 10, ammo: true, weapon: 'smg' },
    },
    {
      giver: 'celia',
      briefing: [
        "Celia: Night shift. A client needs a quiet ride from the hotel to the pier. No questions.",
        "Celia: Keep it under the speed limit past Maravilla PD. El Gato works nights.",
      ],
      stages: [
        { kind: 'goto', at: P.hotel, name: 'THE CLIENT', text: 'Pick up the client at Hotel Miramar' },
        { kind: 'deliver', at: P.pier, name: 'QUIET RIDE', text: 'Drop the client at Miramar Pier', timer: 280 },
      ],
      reward: { money: 1100, respect: 10, garage: 'camioneta' },
    },
    {
      giver: 'luz',
      briefing: [
        "Mama Luz: A boat is coming in at the pier with cargo nobody should see. Be there.",
        "Mama Luz: Take the cargo to the stadium lockup. Fast, quiet, no souvenirs.",
      ],
      stages: [
        { kind: 'goto', at: P.pier, name: 'THE BOAT', text: 'Meet the boat at Miramar Pier' },
        { kind: 'deliver', at: P.stadium, name: 'NO SOUVENIRS', text: 'Deliver the cargo to Estadio Sol', timer: 240 },
      ],
      reward: { money: 1400, respect: 10, weapon: 'shotgun' },
    },
    {
      giver: 'gato',
      briefing: [
        "El Gato: Vega. I know you're in my city. Come say hello at HQ — or run. Your choice.",
        "Celia: That's a trap, Rook. Lose the tail, then meet me at the marina.",
      ],
      stages: [
        { kind: 'goto', at: P.policeHq, name: 'THE TRAP', text: 'Show yourself at Maravilla PD HQ' },
        { kind: 'escape', at: P.marina, name: 'LOSE THE TAIL', text: 'Lose the cops, then reach Marina Alba', timer: 300, require: 'lose' },
      ],
      reward: { money: 1500, respect: 10 },
      heatOnStage: { 1: 3 },
    },
    {
      giver: 'marlon',
      briefing: [
        "Big Marlon: I owe a man at the stadium. You drive, I talk. Then we both walk away.",
        "Big Marlon: If it goes loud, you already know the way out. Through them.",
      ],
      stages: [
        { kind: 'goto', at: P.stadium, name: 'THE MEETING', text: 'Meet Marlon at Estadio Sol' },
        { kind: 'deliver', at: P.hospital, name: 'GET HIM OUT', text: 'Get Marlon to Clinica Sol, fast', timer: 200 },
      ],
      reward: { money: 1800, respect: 10, weapon: 'rifle' },
    },
    {
      giver: 'luz',
      briefing: [
        "Mama Luz: One last score, Rook. Banco Alba, the vault, the whole bay watching.",
        "Mama Luz: Grab it, run the heat, and meet us at the pier. Then we're gone.",
      ],
      stages: [
        { kind: 'goto', at: P.bank, name: 'THE VAULT', text: 'Hit Banco Alba' },
        { kind: 'escape', at: P.pier, name: 'RUN THE HEAT', text: 'Escape the 4-star heat — reach Miramar Pier', timer: 360, require: 'reach' },
      ],
      reward: { money: 5000, respect: 25, rp: 600 },
      heatOnStage: { 1: 4 },
      finale: true,
    },
  ];

  const RACES = [
    { id: 0, name: 'Sunset Sprint', start: { x: -240, z: 0 }, points: [{ x: 0, z: -240 }, { x: 240, z: 0 }, { x: 0, z: 240 }], timer: 150 },
    { id: 1, name: 'Coast Road Dash', start: { x: 240, z: -240 }, points: [{ x: 240, z: 240 }, { x: -240, z: 240 }, { x: -240, z: -240 }], timer: 180 },
    { id: 2, name: 'Maravilla Loop', start: { x: 0, z: 240 }, points: [{ x: -240, z: 0 }, { x: 0, z: -240 }, { x: 240, z: 0 }], timer: 180 },
  ];

  function startMission(i) {
    if (i < 0 || i >= DEFS.length) return false;
    if (state.mission) return false;
    const def = DEFS[i];
    const title = MISSION_NAMES[i];
    state.mission = {
      id: i, title, giver: def.giver, stage: 0,
      objective: def.stages[0].text,
      marker: { x: def.stages[0].at.x ?? def.stages[0].at[0].x, z: def.stages[0].at.z ?? def.stages[0].at[0].z },
      timer: def.stages[0].timer || 0,
      data: {},
    };
    state.missionStartTime = state.time;
    setObjective(def.stages[0].text);
    setMarker(state.mission.marker.x, state.mission.marker.z);
    banner(title, `Mission ${i + 1} of 10`);
    for (const line of def.briefing) say(line);
    if (events) events.emit('mission', { stage: 'start', id: i, title });
    return true;
  }

  function nextMission() {
    const i = state.nextMission;
    if (i >= DEFS.length) return false;
    return startMission(i);
  }

  function failMission(reason) {
    const m = state.mission;
    if (!m) return;
    msg(`Mission failed: ${reason}. Head back to the marker to try again.`, 'bad');
    if (events) events.emit('mission', { stage: 'failed', id: m.id, reason });
    state.mission = null;
    hideMarker();
    setObjective('Go to the yellow marker to start the next mission.');
  }

  function completeMission() {
    const m = state.mission;
    if (!m) return;
    const def = DEFS[m.id];
    const rp = def.reward.rp ?? 250;
    // Mission rating: gold/silver/bronze against the par time.
    const elapsed = Math.max(0, state.time - (state.missionStartTime || state.time));
    const rating = ratingForTime(elapsed, MISSION_PARS[m.id] || 180);
    state.ratings[m.id] = rating;
    p.money += def.reward.money;
    p.respect += def.reward.respect;
    p.rp += rp;
    state.stats.moneyEarned += def.reward.money;
    state.stats.missionsDone += 1;
    state.missionsDone.push(m.id);
    state.nextMission = m.id + 1;
    if (def.reward.weapon && !p.weaponsOwned.includes(def.reward.weapon)) {
      p.weaponsOwned.push(def.reward.weapon);
      msg(`New weapon unlocked: the ${def.reward.weapon} is yours. Press Tab to see it.`, 'good');
    }
    if (def.reward.garage && !state.garage.includes(def.reward.garage)) {
      state.garage.push(def.reward.garage);
      msg(`New car in the garage! The ${def.reward.garage} is yours.`, 'good');
    }
    if (def.reward.ammo) {
      p.ammo.smg = (p.ammo.smg || 0) + 90;
      p.ammo.pistol = (p.ammo.pistol || 0) + 60;
      msg('Marlon tossed you extra ammo. Nice.', 'good');
    }
    msg(`Mission complete: ${m.title} — $${def.reward.money}, +${def.reward.respect} respect, +${rp} RP. Rating: ${rating} (${Math.round(elapsed)}s vs par ${MISSION_PARS[m.id] || 180}s).`, 'good');
    if (events) events.emit('mission', { stage: 'complete', id: m.id, title: m.title });
    state.mission = null;
    hideMarker();
    if (def.finale) {
      state.screen = 'complete';
      if (typeof document !== 'undefined') {
        const s = document.getElementById('end-screen');
        const t = document.getElementById('end-title');
        const tx = document.getElementById('end-text');
        if (s) s.style.display = 'flex';
        if (t) t.textContent = 'THE LAST SCORE';
        if (tx) {
          tx.textContent = `Maravilla is yours, Rook. Missions: ${state.stats.missionsDone}/10 · ` +
            `Money earned: $${state.stats.moneyEarned} · Races won: ${state.stats.racesWon} · ` +
            `Taxi fares: ${state.stats.taxiFares}`;
        }
      }
      setObjective('Maravilla is yours.');
      return;
    }
    setObjective('Go to the yellow marker to start the next mission.');
  }

  function advanceStage() {
    const m = state.mission;
    const def = DEFS[m.id];
    m.stage += 1;
    if (m.stage >= def.stages.length) {
      completeMission();
      return;
    }
    const st = def.stages[m.stage];
    m.objective = st.text;
    m.timer = st.timer || 0;
    m.data = {};
    const at = Array.isArray(st.at) ? st.at[0] : st.at;
    setMarker(at.x, at.z);
    setObjective(st.text);
    if (def.heatOnStage && def.heatOnStage[m.stage]) {
      if (events) events.emit('crime', { type: 'heat', amount: def.heatOnStage[m.stage] });
      else p.wanted = Math.max(p.wanted, def.heatOnStage[m.stage]);
    }
    msg(st.text, 'info');
  }

  // --- side activities -------------------------------------------------------
  function startRace(race) {
    state.race = {
      id: race.id, name: race.name,
      checkpoints: race.points.map((pt) => ({ x: pt.x, z: pt.z })),
      current: 0, timer: race.timer, startedAt: state.time,
    };
    setObjective(`Race: ${race.name} — hit checkpoint 1 of ${race.points.length}`);
    msg(`Race started: ${race.name}. Follow the flags!`, 'info');
    if (events) events.emit('mission', { stage: 'race-start', id: race.id });
  }

  function updateRace(dt) {
    const r = state.race;
    if (!r) return;
    r.timer -= dt;
    const cp = r.checkpoints[r.current];
    if (cp && dist(p.x, p.z, cp.x, cp.z) < CHECKPOINT_RADIUS) {
      r.current += 1;
      if (r.current >= r.checkpoints.length) {
        p.money += 500;
        p.respect += 5;
        p.rp += 100;
        state.stats.moneyEarned += 500;
        state.stats.racesWon += 1;
        msg(`You won the ${r.name}! +$500, +5 respect, +100 RP.`, 'good');
        state.race = null;
        setObjective(state.mission ? state.mission.objective : 'Go to the yellow marker to start the next mission.');
        return;
      }
      setObjective(`Race: ${r.name} — hit checkpoint ${r.current + 1} of ${r.checkpoints.length}`);
    }
    if (r.timer <= 0) {
      msg(`Race over — too slow on the ${r.name}.`, 'bad');
      state.race = null;
      setObjective(state.mission ? state.mission.objective : 'Go to the yellow marker to start the next mission.');
    }
  }

  function updateTaxi(dt) {
    // A fare appears while driving a taxi (defId 'taxi').
    const veh = p.vehicleId !== null
      ? state.vehicles.find((v) => v.id === p.vehicleId) : null;
    const inTaxi = !!veh && veh.defId === 'taxi';
    if (!inTaxi) {
      if (state.taxi) {
        state.taxi = null;
        if (flagMesh) flagMesh.visible = false;
      }
      return;
    }
    if (!state.taxi) {
      // Spawn a passenger at a random sidewalk point.
      let px = -150;
      let pz = 150;
      if (ctx.city && ctx.city.randomSidewalkPoint) {
        const pt = ctx.city.randomSidewalkPoint(rand);
        px = pt.x; pz = pt.z;
      }
      state.taxi = { stage: 'pickup', x: px, z: pz, timer: 120, fare: 0 };
      setObjective('Taxi fare: pick up the passenger at the flag.');
      msg('Taxi fare waiting — pick up the passenger.', 'info');
    }
    const t = state.taxi;
    if (!t) return;
    t.timer -= dt;
    if (flagMesh) {
      flagMesh.position.set(t.x, 0, t.z);
      flagMesh.visible = true;
    }
    if (t.stage === 'pickup' && dist(p.x, p.z, t.x, t.z) < 5) {
      let dx = 30;
      let dz = 30;
      if (ctx.city && ctx.city.randomRoadPoint) {
        const pt = ctx.city.randomRoadPoint(rand);
        dx = pt.x; dz = pt.z;
      }
      t.stage = 'dropoff';
      t.x = dx; t.z = dz;
      t.timer = 120;
      t.fare = Math.round(25 + dist(p.x, p.z, dx, dz) * 0.4);
      setObjective(`Taxi fare: drop the passenger off ($${t.fare}).`);
      msg(`Passenger aboard. Destination pays $${t.fare} — hurry.`, 'info');
    } else if (t.stage === 'dropoff' && dist(p.x, p.z, t.x, t.z) < 6) {
      p.money += t.fare;
      p.respect += 2;
      p.rp += 25;
      state.stats.moneyEarned += t.fare;
      state.stats.taxiFares += 1;
      msg(`Fare complete: +$${t.fare}, +2 respect, +25 RP.`, 'good');
      state.taxi = null;
      if (flagMesh) flagMesh.visible = false;
      setObjective(state.mission ? state.mission.objective : 'Go to the yellow marker to start the next mission.');
    } else if (t.timer <= 0) {
      msg('The passenger gave up waiting. Fare lost.', 'bad');
      state.taxi = null;
      if (flagMesh) flagMesh.visible = false;
    }
  }

  function update(dt) {
    // Subtitle queue (DOM fallback when hud has no subtitle method).
    if (subtitleQueue.length > 0) {
      subtitleTimer -= dt;
      if (subtitleTimer <= 0) {
        const line = subtitleQueue.shift();
        if (typeof document !== 'undefined') {
          if (!subtitleEl) subtitleEl = document.getElementById('subtitle');
          if (subtitleEl) {
            subtitleEl.textContent = line;
            subtitleEl.style.display = 'block';
            subtitleTimer = 3.5;
            setTimeout(() => {
              if (subtitleEl && subtitleQueue.length === 0) subtitleEl.style.display = 'none';
            }, 3500);
          } else {
            msg(line, 'info');
          }
        } else {
          msg(line, 'info');
        }
      }
    }
    if (state.screen !== 'play') return;

    // --- idle: show the start marker for the next mission.
    if (!state.mission && state.nextMission < DEFS.length) {
      const def = DEFS[state.nextMission];
      const at = Array.isArray(def.stages[0].at) ? def.stages[0].at[0] : def.stages[0].at;
      if (markerMesh && !markerMesh.visible) {
        setMarker(at.x, at.z);
        setObjective(`Go to the yellow marker — ${MISSION_NAMES[state.nextMission]}`);
      }
      // Mission 1 (and any next mission) starts by walking/driving in.
      if (dist(p.x, p.z, at.x, at.z) < MARKER_RADIUS) {
        startMission(state.nextMission);
        return;
      }
    }

    // --- active mission stage machine.
    if (state.mission) {
      const m = state.mission;
      const def = DEFS[m.id];
      const st = def.stages[m.stage];
      if (!st) { completeMission(); return; }
      if (m.timer > 0) {
        m.timer -= dt;
        if (m.timer <= 0) {
          failMission('time ran out');
          return;
        }
      }
      if (st.kind === 'goto' || st.kind === 'deliver') {
        const at = st.at;
        if (dist(p.x, p.z, at.x, at.z) < MARKER_RADIUS) advanceStage();
      } else if (st.kind === 'checkpoints') {
        const idx = m.data.cp || 0;
        const cps = st.at;
        if (idx < cps.length) {
          setMarker(cps[idx].x, cps[idx].z);
          if (dist(p.x, p.z, cps[idx].x, cps[idx].z) < CHECKPOINT_RADIUS) {
            m.data.cp = idx + 1;
            if (m.data.cp >= cps.length) advanceStage();
            else msg(`Checkpoint ${m.data.cp + 1} of ${cps.length}.`, 'info');
          }
        }
      } else if (st.kind === 'escape') {
        const at = st.at;
        if (dist(p.x, p.z, at.x, at.z) < MARKER_RADIUS) {
          // 'lose' (mission 8): the heat must be gone first — arriving with
          // cops on your tail does not count. 'reach' (the finale): getting
          // to the pier with the heat on IS the escape.
          if (st.require === 'lose' && p.wanted > 0) {
            if (!m.data.warned) {
              m.data.warned = true;
              msg('Lose the cops first — get the heat to zero, then come back here.', 'bad');
            }
          } else {
            advanceStage();
          }
        } else {
          m.data.warned = false;
        }
      }
      if (markerMesh && markerMesh.visible && markerMesh.userData.diamond) {
        markerMesh.userData.diamond.rotation.y += dt * 1.5;
        markerMesh.userData.diamond.position.y = 3.2 + Math.sin(state.time * 2) * 0.4;
      }
    }

    // --- races: start by driving into a race start flag.
    if (!state.race) {
      for (const race of RACES) {
        if (dist(p.x, p.z, race.start.x, race.start.z) < 8 && !p.onFoot) {
          startRace(race);
          break;
        }
      }
    } else {
      updateRace(dt);
      const r = state.race;
      if (r && flagMesh) {
        const cp = r.checkpoints[r.current];
        if (cp) {
          flagMesh.position.set(cp.x, 0, cp.z);
          flagMesh.visible = true;
        }
      }
    }

    updateTaxi(dt);
  }

  return {
    update,
    startMission,
    nextMission,
    get definitions() { return DEFS; },
    get races() { return RACES; },
    get acts() { return ACTS; },
    get ratings() { return state.ratings; },
  };
}
