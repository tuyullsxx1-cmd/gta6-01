// Ten story missions in three acts, three street races and taxi fares.
// Every mission is staged: the HUD shows stage progress and the next
// objective. Dialogue is original, written for this game.
import { addMoney, addRp } from './state.js';

export const MISSIONS = [
  {
    id: 'first-light', act: 1, title: 'FIRST LIGHT', giver: 'vera',
    reward: { money: 600, rp: 250, district: 'centro' },
    dialogue: [
      { who: 'vera', text: 'Milo Vane. Fresh off the boat, fast hands, faster car. I like that.' },
      { who: 'vera', text: 'One job first, to see if you are real. The gold coupe by the plaza is hot — new plates, clean papers.' },
      { who: 'milo', text: 'Plates and papers. I can do that before the sun is gone.' },
      { who: 'vera', text: 'Theo is waiting at the garage. Do not make me regret the introduction.' },
    ],
    stages: [
      { name: 'MEET VERA', objective: 'Meet Vera at Downtown Plaza', target: { x: 0, z: 30 }, kind: 'goto' },
      { name: 'PLATE SWAP', objective: 'Drive the gold coupe to Theo\'s Garage', target: { x: -90, z: 120 }, kind: 'drive' },
      { name: 'CLEAN REGISTRATION', objective: 'Hold at the garage while Theo files the papers', target: { x: -90, z: 120 }, kind: 'wait', wait: 4 },
    ],
  },
  {
    id: 'salt-air', act: 1, title: 'SALT AIR', giver: 'juno',
    reward: { money: 800, rp: 250, district: 'marina' },
    dialogue: [
      { who: 'juno', text: 'Theo needs a tuned intake off a boat that came in at dawn. Marina Alba, pier two.' },
      { who: 'milo', text: 'A boat part. Why do I feel like there is a catch?' },
      { who: 'juno', text: 'The catch is the harbour patrol. Take it quiet, bring it back loud if you have to.' },
    ],
    stages: [
      { name: 'PIER TWO', objective: 'Pick up the intake at Marina Alba pier', target: { x: -252, z: -168 }, kind: 'goto' },
      { name: 'BACK TO THE GARAGE', objective: 'Deliver the intake to Theo\'s Garage', target: { x: -90, z: 120 }, kind: 'drive' },
    ],
  },
  {
    id: 'neon-mile', act: 1, title: 'NEON MILE', giver: 'juno',
    reward: { money: 1200, rp: 250, district: 'centro' },
    dialogue: [
      { who: 'juno', text: 'Word is out that you can drive. The Neon Mile starts at the market — three laps of the avenue.' },
      { who: 'milo', text: 'Three laps. Winner takes the pot?' },
      { who: 'juno', text: 'Winner takes the pot and the respect. Do not embarrass me out there.' },
    ],
    stages: [
      { name: 'START LINE', objective: 'Reach the Neon Mile start at the market', target: { x: -30, z: -90 }, kind: 'goto' },
      { name: 'RACE THE MILE', objective: 'Win the Neon Mile street race', target: { x: -30, z: -90 }, kind: 'race', race: 'neon-mile' },
    ],
  },
  {
    id: 'cold-storage', act: 2, title: 'COLD STORAGE', giver: 'vera',
    reward: { money: 1500, rp: 250, district: 'faro' },
    dialogue: [
      { who: 'vera', text: 'A refrigerated van full of casino cash is parked on the avenue, driver gone for coffee.' },
      { who: 'vera', text: 'It is sitting on the road in plain sight. Take it, bring it to the garage, no noise.' },
      { who: 'milo', text: 'A van on the road. Easiest hard job I ever heard of.' },
    ],
    stages: [
      { name: 'FIND THE VAN', objective: 'Reach the van parked on the avenue', target: { x: 120, z: 60 }, kind: 'goto' },
      { name: 'TAKE THE VAN', objective: 'Take the van and drive it to the garage', target: { x: 120, z: 60 }, kind: 'steal', stealDef: 'viento' },
      { name: 'PARK IT COLD', objective: 'Park the van inside the garage yard', target: { x: -90, z: 120 }, kind: 'drive' },
    ],
  },
  {
    id: 'alarm-bells', act: 2, title: 'ALARM BELLS', giver: 'anselm',
    reward: { money: 1800, rp: 250, district: 'miramar' },
    dialogue: [
      { who: 'anselm', text: 'Milo Vane. I know your name, your car, your crew. The net is closing.' },
      { who: 'milo', text: 'Then you had better tighten it fast, detective.' },
      { who: 'anselm', text: 'Run. I want to see how fast you really are.' },
    ],
    stages: [
      { name: 'THE NET CLOSES', objective: 'Anselm has your position — break away', target: { x: 180, z: 0 }, kind: 'heat', heatAtLeast: 2 },
      { name: 'LOSE THE TAIL', objective: 'Lose the heat completely', target: { x: 180, z: 0 }, kind: 'escape' },
    ],
  },
  {
    id: 'rival-heat', act: 2, title: 'RIVAL HEAT', giver: 'bram',
    reward: { money: 2000, rp: 250, district: 'estadio' },
    dialogue: [
      { who: 'bram', text: 'A rival crew is running the stadium streets tonight, showing off. They think the city is theirs.' },
      { who: 'milo', text: 'Then we show them whose streets these are.' },
      { who: 'bram', text: 'Win the race at the stadium. I will handle anyone who argues with the result.' },
    ],
    stages: [
      { name: 'STADIUM START', objective: 'Reach the stadium race start', target: { x: 210, z: 150 }, kind: 'goto' },
      { name: 'BEAT THE RIVALS', objective: 'Win the Estadio street race', target: { x: 210, z: 150 }, kind: 'race', race: 'estadio' },
    ],
  },
  {
    id: 'the-vault-key', act: 2, title: 'THE VAULT KEY', giver: 'iris',
    reward: { money: 2200, rp: 250, district: 'miramar' },
    dialogue: [
      { who: 'iris', text: 'The casino courier carries the vault keycard every night at nine. Same route, same arrogance.' },
      { who: 'milo', text: 'A keycard. That is the whole plan for the last score?' },
      { who: 'iris', text: 'A keycard opens the door. You open the rest. Lift it at the hotel corner.' },
    ],
    stages: [
      { name: 'THE COURIER', objective: 'Intercept the courier at the Miramar hotel corner', target: { x: 180, z: -60 }, kind: 'goto' },
      { name: 'LIFT THE KEYCARD', objective: 'Get the keycard and reach the safehouse', target: { x: 180, z: 0 }, kind: 'drive' },
    ],
  },
  {
    id: 'hot-pursuit', act: 3, title: 'HOT PURSUIT', giver: 'vera',
    reward: { money: 3000, rp: 250, district: 'paseo' },
    dialogue: [
      { who: 'vera', text: 'Anselm moved early. The whole force is on the beach road — they want the keycard back.' },
      { who: 'milo', text: 'Then they can chase me for it.' },
      { who: 'vera', text: 'Lose them. All of them. The escape only counts when the heat is gone.' },
    ],
    stages: [
      { name: 'THE CHASE', objective: 'Outrun the pursuit to the beach road', target: { x: 0, z: 270 }, kind: 'heat', heatAtLeast: 3 },
      { name: 'VANISH', objective: 'Escape — the stage only clears when the heat is gone', target: { x: 0, z: 270 }, kind: 'escape' },
    ],
  },
  {
    id: 'the-long-con', act: 3, title: 'THE LONG CON', giver: 'theo',
    reward: { money: 3500, rp: 250, district: 'centro' },
    dialogue: [
      { who: 'theo', text: 'The vault needs a distraction. I built a fireworks rig on the casino roof — needs a driver to light it and vanish.' },
      { who: 'milo', text: 'Fireworks on the roof of the biggest casino in the city. Subtle.' },
      { who: 'theo', text: 'Subtle is for other crews. Get to the roof stair, light it, get out.' },
    ],
    stages: [
      { name: 'ROOF STAIR', objective: 'Reach the casino roof stair', target: { x: 180, z: -150 }, kind: 'goto' },
      { name: 'LIGHT IT UP', objective: 'Trigger the distraction, then reach the plaza', target: { x: 0, z: 30 }, kind: 'drive' },
    ],
  },
  {
    id: 'one-last-score', act: 3, title: 'ONE LAST SCORE', giver: 'vera',
    reward: { money: 10000, rp: 500, district: 'miramar' },
    dialogue: [
      { who: 'vera', text: 'This is it. The vault, the keycard, the whole crew. One last score and we are done.' },
      { who: 'milo', text: 'Anselm will be waiting.' },
      { who: 'vera', text: 'Let him wait. We walk in as guests and leave as legends.' },
    ],
    stages: [
      { name: 'THE VAULT DOOR', objective: 'Reach the Grand Maravilla vault door', target: { x: 180, z: -120 }, kind: 'goto' },
      { name: 'CRACK THE VAULT', objective: 'Hold at the vault while Iris cracks the lock', target: { x: 180, z: -120 }, kind: 'wait', wait: 6 },
      { name: 'THE GETAWAY', objective: 'Escape with the score to the marina', target: { x: -240, z: -180 }, kind: 'drive' },
    ],
  },
];

export const RACES = {
  'neon-mile': {
    name: 'Neon Mile', start: { x: -30, z: -90 }, timeLimit: 150,
    checkpoints: [{ x: -30, z: 90 }, { x: 90, z: 90 }, { x: 90, z: -90 }, { x: -30, z: -90 }],
    rivals: [{ name: 'Kess', skill: 38 }, { name: 'Dario', skill: 40 }, { name: 'Sable', skill: 41 }],
  },
  'estadio': {
    name: 'Estadio Sprint', start: { x: 210, z: 150 }, timeLimit: 150,
    checkpoints: [{ x: 210, z: 270 }, { x: 60, z: 270 }, { x: 60, z: 150 }, { x: 210, z: 150 }],
    rivals: [{ name: 'Kess', skill: 39 }, { name: 'Dario', skill: 41 }, { name: 'Sable', skill: 40 }],
  },
  'paseo': {
    name: 'Paseo Dash', start: { x: 0, z: 240 }, timeLimit: 140,
    checkpoints: [{ x: -180, z: 240 }, { x: -180, z: 120 }, { x: 0, z: 120 }, { x: 0, z: 240 }],
    rivals: [{ name: 'Kess', skill: 38 }, { name: 'Dario', skill: 39 }, { name: 'Sable', skill: 41 }],
  },
};

export function currentMission(state) {
  if (state.missionIndex >= MISSIONS.length) return null;
  return MISSIONS[state.missionIndex];
}

export function startMission(state, idx, bus) {
  const m = MISSIONS[idx];
  if (!m) return null;
  state.mission = { id: m.id, stage: 0, startedAt: state.dayTime, waitLeft: 0 };
  state.missionIndex = idx;
  for (const line of m.dialogue) bus.emit('dialogue', { who: line.who, text: line.text });
  bus.emit('message', { text: `MISSION ${idx + 1} · ${m.title} — ${m.stages[0].objective}` });
  return state.mission;
}

export function missionObjective(state) {
  const m = currentMission(state);
  if (!m) return null;
  const active = state.mission;
  if (!active) return { title: m.title, next: m.stages[0].objective, stage: 0, total: m.stages.length, stageName: m.stages[0].name, missionNumber: state.missionIndex + 1, started: false };
  const s = m.stages[active.stage];
  return { title: m.title, next: s.objective, stage: active.stage, total: m.stages.length, stageName: s.name, missionNumber: state.missionIndex + 1, started: true };
}

function posOf(state) {
  return state.car ? { x: state.car.x, z: state.car.z } : { x: state.player.x, z: state.player.z };
}
function near(state, target, r = 9) {
  const p = posOf(state);
  return Math.hypot(p.x - target.x, p.z - target.z) < r;
}

export function gradeMission(state) {
  // G/S/B by heat at the finish: clean run gold, messy run bronze.
  const heat = state.wanted;
  return heat === 0 ? 'G' : heat <= 2 ? 'S' : 'B';
}

function completeMission(state, bus) {
  const m = currentMission(state);
  const grade = gradeMission(state);
  state.ratings[m.id] = grade;
  state.missionDone.push(m.id);
  addMoney(state, m.reward.money);
  addRp(state, m.reward.rp);
  state.standing[m.reward.district] = Math.min(100, state.standing[m.reward.district] + 8);
  bus.emit('message', { text: `MISSION COMPLETE · ${m.title} — rating ${grade} · +$${m.reward.money} · +${m.reward.rp} RP` });
  bus.emit('mission-complete', { id: m.id, grade });
  state.mission = null;
  state.missionIndex += 1;
  if (state.missionIndex < MISSIONS.length) {
    const next = MISSIONS[state.missionIndex];
    bus.emit('message', { text: `NEXT JOB: ${next.title} — see Vera on the phone (F).` });
  } else {
    bus.emit('message', { text: 'ONE LAST SCORE — complete. Maravilla is yours, Milo.' });
  }
}

export function updateMission(state, ctx, dt) {
  const m = currentMission(state);
  if (!m || !state.mission) return;
  const st = state.mission;
  const s = m.stages[st.stage];
  if (!s) return;
  if (s.kind === 'goto' || s.kind === 'drive') {
    if (near(state, s.target, s.kind === 'drive' ? 10 : 8)) advance(state, ctx);
  } else if (s.kind === 'wait') {
    if (near(state, s.target, 12)) {
      st.waitLeft = (st.waitLeft || s.wait) - dt;
      ctx.setWaitProgress && ctx.setWaitProgress(1 - st.waitLeft / s.wait);
      if (st.waitLeft <= 0) advance(state, ctx);
    } else st.waitLeft = s.wait;
  } else if (s.kind === 'heat') {
    if (state.wanted >= (s.heatAtLeast || 2)) advance(state, ctx);
    else if (near(state, s.target, 12)) ctx.hint && ctx.hint('Cause some heat — the law needs a reason to chase you.');
  } else if (s.kind === 'escape') {
    if (state.wanted === 0 && state.heat === 0) advance(state, ctx);
  } else if (s.kind === 'steal') {
    if (state.car && state.car.defId === s.stealDef) advance(state, ctx);
    else if (near(state, s.target, 6)) ctx.hint && ctx.hint('Press E to take the van.');
  } else if (s.kind === 'race') {
    if (!state.race) ctx.startRace && ctx.startRace(s.race);
    else if (state.race.done) {
      if (state.race.won) advance(state, ctx);
      else { busFail(state, ctx); }
    }
  }
}

function advance(state, ctx) {
  const m = currentMission(state);
  const st = state.mission;
  st.stage += 1;
  st.waitLeft = 0;
  if (st.stage >= m.stages.length) completeMission(state, ctx.bus);
  else {
    const s = m.stages[st.stage];
    ctx.bus.emit('message', { text: `STAGE ${st.stage + 1}/${m.stages.length} · ${s.name} — ${s.objective}` });
    ctx.bus.emit('dialogue', { who: m.giver, text: s.objective });
  }
}

function busFail(state, ctx) {
  state.race = null;
  ctx.bus.emit('message', { text: 'Race lost. The start line is still there — try again.' });
}

// --- Street races ---
export function startRace(state, raceId, ctx) {
  const def = RACES[raceId];
  if (!def) return null;
  state.race = {
    id: raceId, cp: 0, time: 0, limit: def.timeLimit, done: false, won: false,
    rivals: def.rivals.map((r, i) => ({ ...r, cp: 0, progress: 0, x: def.start.x + (i - 1) * 6, z: def.start.z - 8 - i * 4, seg: 0, segT: 0 })),
  };
  ctx.bus.emit('message', { text: `RACE · ${def.name} — ${def.checkpoints.length} checkpoints, ${def.timeLimit}s. Beat the rivals.` });
  return state.race;
}

export function updateRace(state, dt, ctx) {
  const race = state.race;
  if (!race || race.done) return;
  const def = RACES[race.id];
  race.time += dt;
  // Rivals drive the checkpoint loop at their skill speed (m/s).
  const path = [def.start, ...def.checkpoints];
  for (const r of race.rivals) {
    if (r.cp >= def.checkpoints.length) continue;
    const from = path[r.seg], to = path[r.seg + 1];
    if (!to) { r.cp = def.checkpoints.length; continue; }
    const dx = to.x - from.x, dz = to.z - from.z;
    const len = Math.hypot(dx, dz) || 1;
    // Rivals brake into corners (first 20% of each segment), so they run
    // 38-41 on the straights but lose time turning — a real driver wins.
    const corner = r.segT < 0.2 ? 0.7 : 1;
    r.segT += (r.skill * corner * dt) / len;
    if (r.segT >= 1) { r.seg += 1; r.segT = 0; r.cp += 1; }
    else { r.x = from.x + dx * r.segT; r.z = from.z + dz * r.segT; }
  }
  // Player progress: proximity to the next checkpoint.
  const p = posOf(state);
  const nextCp = def.checkpoints[race.cp];
  if (nextCp && Math.hypot(p.x - nextCp.x, p.z - nextCp.z) < 12) {
    race.cp += 1;
    ctx.bus.emit('message', { text: `CHECKPOINT ${race.cp}/${def.checkpoints.length}` });
  }
  const playerDone = race.cp >= def.checkpoints.length;
  const rivalsDone = race.rivals.some((r) => r.cp >= def.checkpoints.length);
  if (playerDone || rivalsDone || race.time > race.limit) {
    race.done = true;
    // The player wins by finishing first, or by being furthest along.
    const bestRival = Math.max(...race.rivals.map((r) => r.cp));
    race.won = playerDone && race.cp >= bestRival;
    if (race.won) {
      const prize = 1500;
      addMoney(state, prize);
      ctx.bus.emit('message', { text: `RACE WON · ${def.name} — +$${prize}` });
    }
  }
  race.position = 1 + race.rivals.filter((r) => r.cp > race.cp).length;
}

// --- Taxi fares ---
export function startTaxi(state, ctx) {
  const pick = { x: 60, z: -60 };
  const drop = { x: -180, z: 180 };
  state.taxi = { phase: 'pickup', pick, drop, time: 0, limit: 120, fare: 0 };
  ctx.bus.emit('message', { text: 'TAXI FARE — pick up the passenger at the gold marker.' });
  return state.taxi;
}

export function updateTaxi(state, dt, ctx) {
  const t = state.taxi;
  if (!t) return;
  t.time += dt;
  const p = posOf(state);
  if (t.phase === 'pickup' && Math.hypot(p.x - t.pick.x, p.z - t.pick.z) < 8) {
    t.phase = 'dropoff';
    ctx.bus.emit('message', { text: 'Passenger aboard — drop them at the gold marker. Timer is running.' });
  } else if (t.phase === 'dropoff' && Math.hypot(p.x - t.drop.x, p.z - t.drop.z) < 8) {
    const dist = Math.hypot(t.drop.x - t.pick.x, t.drop.z - t.pick.z);
    const fare = Math.round(40 + dist * 0.25);
    addMoney(state, fare);
    state.stats.fares += 1;
    ctx.bus.emit('message', { text: `FARE PAID · +$${fare}. The passenger tips their hat.` });
    state.taxi = null;
  } else if (t.time > t.limit) {
    ctx.bus.emit('message', { text: 'Fare expired — the passenger hailed another cab.' });
    state.taxi = null;
  }
}
