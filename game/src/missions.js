// missions.js — story missions, street races and taxi fares for MARAVILLA.
// Written from the prose design spec. No code was read or copied from any
// earlier build. All mission data lives in MISSIONS; createMissions drives
// stage flow, objectives, dialogue, ratings and rewards.

const DISTRICTS = [
  'Marina Alba',
  'El Faro',
  'Centro Alba',
  'Paseo del Mar',
  'Miramar',
  'Estadio Sol',
];

// Shared map anchors (metres, city is roughly 600 x 600, centre 0,0).
export const PLACES = {
  lockup: { x: -250, z: 200, label: 'Marina Alba lockup' },
  garage: { x: 30, z: 120, label: "Celia's Garage" },
  pier: { x: -260, z: -40, label: 'The pier' },
  banco: { x: 60, z: -120, label: 'Banco Alba' },
  estadio: { x: 220, z: 180, label: 'Estadio Sol' },
  hotel: { x: 180, z: -200, label: 'Hotel Miramar' },
  lighthouse: { x: -260, z: -240, label: 'Faro de Maravilla' },
  market: { x: 20, z: 40, label: 'Centro Alba night market' },
  dock: { x: -280, z: 120, label: 'Marina Alba dock' },
  safehouse: { x: 140, z: 210, label: 'Casa Verde' },
  impound: { x: -180, z: -190, label: 'El Faro impound lot' },
  stadiumGate: { x: 190, z: 150, label: 'Estadio Sol gate' },
};

// ---------------------------------------------------------------------------
// Mission data: 10 named story missions in 3 acts.
// Every stage has an objective string and a target position {x, z}.
// Rewards: money, RP (250 per mission is the standard), standing district.
// ---------------------------------------------------------------------------
export const MISSIONS = [
  {
    id: 1,
    act: 1,
    title: 'FIRST KEYS',
    giver: 'Mama Luz',
    district: 'Marina Alba',
    parSeconds: 420,
    reward: { money: 400, rp: 250, standing: 8 },
    briefing:
      'Rook is home. First job: make a hot car look clean before the sun goes down.',
    dialogue: [
      { speaker: 'Mama Luz', text: 'Rook. Five years, and you still walk like the city owes you money.' },
      { speaker: 'Rico Vega', text: 'It does, Luz. I just came to collect.' },
      { speaker: 'Mama Luz', text: 'Then start small. There is a sedan sitting in the Marina Alba lockup with plates that will get you stopped before the first corner.' },
      { speaker: 'Mama Luz', text: 'Swap the plates on it. Then take it to Celia at the garage and register it clean. No noise, no heat, no shortcuts.' },
      { speaker: 'Rico Vega', text: 'Plates, then paper. Got it. Tell Celia I am coming.' },
    ],
    stages: [
      { name: 'Reach the lockup', objective: 'Go to the Marina Alba lockup', target: { ...PLACES.lockup }, radius: 14 },
      { name: 'Swap the plates', objective: 'Swap the plates on the sedan', target: { ...PLACES.lockup }, radius: 8, action: 'swap' },
      { name: 'Drive to the garage', objective: "Drive the car to Celia's Garage", target: { ...PLACES.garage }, radius: 14, needsCar: true },
      { name: 'Register it clean', objective: 'Register the car clean at the garage', target: { ...PLACES.garage }, radius: 8, action: 'register' },
    ],
  },
  {
    id: 2,
    act: 1,
    title: 'THE WELCOME WAGON',
    giver: 'Big Marlon',
    district: 'Centro Alba',
    parSeconds: 480,
    reward: { money: 600, rp: 250, standing: 8 },
    briefing:
      'The night market pays for protection. Marlon wants the rounds done right.',
    dialogue: [
      { speaker: 'Big Marlon', text: 'Rook! You are back and already skinny. The market missed you, little brother.' },
      { speaker: 'Rico Vega', text: 'I missed the food. The work, less so.' },
      { speaker: 'Big Marlon', text: 'Three stalls owe this week. Be polite. Be firm. Be Marlon-sized about it, even if you are not Marlon-sized.' },
      { speaker: 'Big Marlon', text: 'Stall one by the lanterns, stall two by the fish crates, stall three by the flower carts. Then bring it all back to me.' },
    ],
    stages: [
      { name: 'First stall', objective: 'Collect from the lantern stall', target: { x: 20, z: 40 }, radius: 10, action: 'collect' },
      { name: 'Second stall', objective: 'Collect from the fish-crate stall', target: { x: 70, z: 10 }, radius: 10, action: 'collect' },
      { name: 'Third stall', objective: 'Collect from the flower-cart stall', target: { x: -10, z: -30 }, radius: 10, action: 'collect' },
      { name: 'Bring it home', objective: 'Bring the takings back to Big Marlon', target: { x: 190, z: 150 }, radius: 12 },
    ],
  },
  {
    id: 3,
    act: 1,
    title: 'NIGHT SHIFT',
    giver: 'Celia Reyes',
    district: 'Centro Alba',
    parSeconds: 540,
    reward: { money: 800, rp: 250, standing: 8 },
    briefing:
      'Celia needs eyes on the city. Plant her taps, stay out of sight.',
    dialogue: [
      { speaker: 'Celia Reyes', text: 'Welcome home, Rook. You look exactly like your mugshot. Older, though.' },
      { speaker: 'Rico Vega', text: 'Charming as ever, Celia. What do you need?' },
      { speaker: 'Celia Reyes', text: 'Two little boxes, two big buildings. One on Banco Alba, one on Hotel Miramar. Stick them where nobody looks — vents, service doors, the boring places.' },
      { speaker: 'Celia Reyes', text: 'Then come back to the garage and I will show you what the city is saying.' },
    ],
    stages: [
      { name: 'Banco Alba tap', objective: 'Plant a tap on Banco Alba', target: { ...PLACES.banco }, radius: 10, action: 'plant' },
      { name: 'Hotel Miramar tap', objective: 'Plant a tap on Hotel Miramar', target: { ...PLACES.hotel }, radius: 10, action: 'plant' },
      { name: 'Back to the garage', objective: "Return to Celia's Garage", target: { ...PLACES.garage }, radius: 12 },
    ],
  },
  {
    id: 4,
    act: 2,
    title: "EL GATO'S LEASH",
    giver: 'Mama Luz',
    district: 'El Faro',
    parSeconds: 600,
    reward: { money: 1000, rp: 250, standing: 8 },
    briefing:
      'El Gato has a file on the crew. Steal it back from the impound lot.',
    dialogue: [
      { speaker: 'Mama Luz', text: 'El Gato is not a cop, Rook. He is a collector. And he has collected us.' },
      { speaker: 'Mama Luz', text: 'There is a file in the El Faro impound lot with every name we care about. It burns tonight, or we do.' },
      { speaker: 'Rico Vega', text: 'I will get the file. What about the tail he puts on me after?' },
      { speaker: 'Mama Luz', text: 'Lose them in the streets. You know this city better than any badge.' },
    ],
    stages: [
      { name: 'Reach the impound', objective: 'Reach the El Faro impound lot', target: { ...PLACES.impound }, radius: 14 },
      { name: 'Grab the file', objective: 'Take the crew file from the lockbox', target: { ...PLACES.impound }, radius: 8, action: 'grab' },
      { name: 'Lose the tail', objective: 'Lose the police tail — drop your wanted level', target: { x: 0, z: 0 }, radius: 999, needsClear: true },
      { name: 'Deliver the file', objective: 'Deliver the file to Mama Luz', target: { x: -30, z: 90 }, radius: 12 },
    ],
  },
  {
    id: 5,
    act: 2,
    title: 'SHARKS AT THE PIER',
    giver: 'Big Marlon',
    district: 'Paseo del Mar',
    parSeconds: 600,
    reward: { money: 1200, rp: 250, standing: 8 },
    briefing:
      'A rival crew is muscling in on the pier. Marlon wants them gone.',
    dialogue: [
      { speaker: 'Big Marlon', text: 'Los Tiburones. Sharks. They think the pier is theirs now.' },
      { speaker: 'Rico Vega', text: 'And what do we think?' },
      { speaker: 'Big Marlon', text: 'We think the pier belongs to whoever is still standing on it at the end. Go stand on it, Rook.' },
      { speaker: 'Big Marlon', text: 'Three of them, loud and proud. Send them home. Then come back and tell me the water is ours again.' },
    ],
    stages: [
      { name: 'Reach the pier', objective: 'Go to the pier', target: { ...PLACES.pier }, radius: 16 },
      { name: 'Clear the pier', objective: 'Deal with the three rivals at the pier', target: { ...PLACES.pier }, radius: 20, action: 'clear', count: 3 },
      { name: 'Report back', objective: 'Report back to Big Marlon', target: { x: 190, z: 150 }, radius: 12 },
    ],
  },
  {
    id: 6,
    act: 2,
    title: 'SIRENS IN THE RAIN',
    giver: 'Celia Reyes',
    district: 'Estadio Sol',
    parSeconds: 660,
    reward: { money: 1400, rp: 250, standing: 8 },
    briefing:
      'A getaway van, two checkpoints, and a city full of sirens. Drive like Celia taught you.',
    dialogue: [
      { speaker: 'Celia Reyes', text: 'I borrowed a van. Do not ask from where. It is parked at the stadium gate and it is full of things we cannot explain.' },
      { speaker: 'Rico Vega', text: 'Full of what?' },
      { speaker: 'Celia Reyes', text: 'Full of "drive carefully". Two checkpoints on the route — I will ping them to your map. Pass both, bring the van to the garage, and nobody asks anything.' },
      { speaker: 'Rico Vega', text: 'And if the sirens find me?' },
      { speaker: 'Celia Reyes', text: 'Then drive faster than the sirens. You have done it before.' },
    ],
    stages: [
      { name: 'Pick up the van', objective: 'Pick up the van at Estadio Sol gate', target: { ...PLACES.stadiumGate }, radius: 12, needsCar: true },
      { name: 'Checkpoint one', objective: 'Pass the first checkpoint on Paseo del Mar', target: { x: -120, z: -60 }, radius: 14, needsCar: true },
      { name: 'Checkpoint two', objective: 'Pass the second checkpoint in Centro Alba', target: { x: 40, z: 60 }, radius: 14, needsCar: true },
      { name: 'Deliver the van', objective: 'Deliver the van to the garage', target: { ...PLACES.garage }, radius: 12, needsCar: true },
    ],
  },
  {
    id: 7,
    act: 2,
    title: 'THE INFORMANT',
    giver: 'Mama Luz',
    district: 'El Faro',
    parSeconds: 660,
    reward: { money: 1600, rp: 250, standing: 8 },
    briefing:
      'A man at the lighthouse knows what El Gato is planning. Keep him alive.',
    dialogue: [
      { speaker: 'Mama Luz', text: 'There is a man at the lighthouse who used to count El Gato’s money. Now he wants to count his own days instead.' },
      { speaker: 'Mama Luz', text: 'He will tell us everything — if he lives to the safehouse. El Gato’s people will try to make sure he does not.' },
      { speaker: 'Rico Vega', text: 'I will bring him in, Luz. Nobody touches my passengers.' },
      { speaker: 'Mama Luz', text: 'Good. Casa Verde is waiting. Do not stop for anything.' },
    ],
    stages: [
      { name: 'Meet the informant', objective: 'Meet the informant at the lighthouse', target: { ...PLACES.lighthouse }, radius: 12 },
      { name: 'Survive the ambush', objective: 'Survive the ambush — stay alive', target: { ...PLACES.lighthouse }, radius: 30, action: 'survive', surviveSeconds: 30 },
      { name: 'Get him to safety', objective: 'Deliver the informant to Casa Verde', target: { ...PLACES.safehouse }, radius: 12 },
    ],
  },
  {
    id: 8,
    act: 3,
    title: 'HOT PURSUIT',
    giver: 'Celia Reyes',
    district: 'Marina Alba',
    parSeconds: 720,
    reward: { money: 2000, rp: 250, standing: 8 },
    briefing:
      'The net is closing. Grab the getaway car, break the cordon, and vanish.',
    dialogue: [
      { speaker: 'Celia Reyes', text: 'Rook, they are coming. Every unit El Gato owns is rolling toward Marina Alba.' },
      { speaker: 'Rico Vega', text: 'Then we give them a chase they will tell stories about.' },
      { speaker: 'Celia Reyes', text: 'The getaway car is at the lockup — the fast one, plates already swapped. Get to the pier checkpoint, then disappear.' },
      { speaker: 'Celia Reyes', text: 'Listen to me: do not come back until the heat is GONE. Not low. Gone. They will be watching every street until then.' },
    ],
    stages: [
      { name: 'Grab the getaway car', objective: 'Grab the getaway car at the lockup', target: { ...PLACES.lockup }, radius: 12, needsCar: true },
      { name: 'Break the cordon', objective: 'Break through to the pier checkpoint', target: { x: -200, z: 0 }, radius: 16, needsCar: true },
      {
        name: 'Vanish',
        objective: 'Escape — lose all heat before returning',
        target: { x: -30, z: 90 },
        radius: 12,
        needsClear: true,
        blockedNote: 'Stay hidden until the heat clears — the escape only counts once wanted is gone.',
      },
    ],
  },
  {
    id: 9,
    act: 3,
    title: 'THE LAST SCORE',
    giver: 'Mama Luz',
    district: 'Centro Alba',
    parSeconds: 780,
    reward: { money: 3500, rp: 250, standing: 8 },
    briefing:
      'Banco Alba. The vault. The haul that ends all of this — if the crew can pull it off.',
    dialogue: [
      { speaker: 'Mama Luz', text: 'One last score, Rook. I have said it before and I have meant it never. This time I mean it.' },
      { speaker: 'Mama Luz', text: 'Banco Alba keeps its old money in a vault that has not been opened in years. Celia has the codes. Marlon has the muscle. You have the driving.' },
      { speaker: 'Rico Vega', text: 'And El Gato?' },
      { speaker: 'Mama Luz', text: 'El Gato will be there. Count on it. Get in, crack the vault, get the haul to the dock — and do not look back.' },
    ],
    stages: [
      { name: 'Reach Banco Alba', objective: 'Get to Banco Alba', target: { ...PLACES.banco }, radius: 14 },
      { name: 'Crack the vault', objective: 'Crack the vault — hold the position', target: { ...PLACES.banco }, radius: 8, action: 'crack', holdSeconds: 20 },
      { name: 'Haul to the dock', objective: 'Carry the haul to the Marina Alba dock', target: { ...PLACES.dock }, radius: 14, needsCar: true },
      { name: 'Lose the heat', objective: 'Lose the heat before the handoff', target: { ...PLACES.dock }, radius: 20, needsClear: true },
    ],
  },
  {
    id: 10,
    act: 3,
    title: 'LEYENDA',
    giver: 'Mama Luz',
    district: 'El Faro',
    parSeconds: 840,
    reward: { money: 5000, rp: 250, standing: 8 },
    briefing:
      'The final run. One last drive to the lighthouse, one last face-off with El Gato, and a boat waiting at the pier.',
    dialogue: [
      { speaker: 'Mama Luz', text: 'It is done, Rook. The money is moving. All that is left is you — and him.' },
      { speaker: 'Rico Vega', text: 'El Gato.' },
      { speaker: 'Mama Luz', text: 'He will be at the lighthouse. He has waited five years to finish this. Go and finish it first.' },
      { speaker: 'Mama Luz', text: 'Then the pier. There is a boat with no name and no questions. Maravilla will remember us, Rook. Make sure it remembers us free.' },
    ],
    stages: [
      { name: 'To the lighthouse', objective: 'Drive to the Faro de Maravilla', target: { ...PLACES.lighthouse }, radius: 14 },
      { name: 'Face El Gato', objective: 'Confront Detective El Gato', target: { ...PLACES.lighthouse }, radius: 10, action: 'confront' },
      { name: 'The boat', objective: 'Reach the boat at the pier', target: { ...PLACES.pier }, radius: 14 },
    ],
  },
];

// ---------------------------------------------------------------------------
// Street races: 3 timed checkpoint races with generous timers.
// ---------------------------------------------------------------------------
export const RACES = [
  {
    id: 'race-paseo',
    name: 'Paseo Sprint',
    district: 'Paseo del Mar',
    timeLimit: 150,
    reward: 500,
    checkpoints: [
      { x: -200, z: -80 },
      { x: -80, z: -140 },
      { x: 60, z: -120 },
      { x: 160, z: -60 },
      { x: 120, z: 60 },
      { x: -40, z: 40 },
    ],
  },
  {
    id: 'race-faro',
    name: 'Faro Loop',
    district: 'El Faro',
    timeLimit: 180,
    reward: 700,
    checkpoints: [
      { x: -260, z: -240 },
      { x: -120, z: -220 },
      { x: 0, z: -180 },
      { x: 40, z: -60 },
      { x: -100, z: -40 },
      { x: -220, z: -140 },
    ],
  },
  {
    id: 'race-estadio',
    name: 'Estadio Grand Prix',
    district: 'Estadio Sol',
    timeLimit: 200,
    reward: 900,
    checkpoints: [
      { x: 220, z: 180 },
      { x: 240, z: 40 },
      { x: 160, z: -60 },
      { x: 60, z: 20 },
      { x: 120, z: 140 },
      { x: 220, z: 180 },
    ],
  },
];

// Taxi fare spots (pickup -> dropoff pairs around the city).
export const TAXI_STOPS = [
  { from: { x: -250, z: 200, label: 'Marina Alba lockup' }, to: { x: 180, z: -200, label: 'Hotel Miramar' } },
  { from: { x: 20, z: 40, label: 'Centro Alba market' }, to: { x: -260, z: -240, label: 'Faro de Maravilla' } },
  { from: { x: 220, z: 180, label: 'Estadio Sol' }, to: { x: -260, z: -40, label: 'The pier' } },
  { from: { x: 180, z: -200, label: 'Hotel Miramar' }, to: { x: 60, z: -120, label: 'Banco Alba' } },
  { from: { x: -120, z: -60, label: 'Paseo del Mar beach' }, to: { x: 140, z: 210, label: 'Casa Verde' } },
];

function dist(a, b) {
  const dx = a.x - b.x;
  const dz = a.z - b.z;
  return Math.sqrt(dx * dx + dz * dz);
}

function clampStanding(v) {
  return Math.max(-100, Math.min(100, v));
}

export function createMissions(state, bus) {
  const emit = (name, data) => {
    if (bus && typeof bus.emit === 'function') bus.emit(name, data);
  };

  // Runtime progress lives on the module, mirrored into state.missions so
  // save/load and the HUD can read it without knowing internals.
  const progress = {
    index: (state.missions && state.missions.current) || 0,
    stage: (state.missions && state.missions.stage) || 0,
    started: false,
    stageStartedAt: 0,
    missionStartedAt: 0,
    actionCount: 0,
    holdTimer: 0,
    surviveTimer: 0,
    elapsed: 0,
    deaths: 0,
  };

  const race = { active: null, checkpoint: 0, timeLeft: 0 };
  const taxi = { active: null, phase: 'idle', timeLeft: 0, fare: 0 };

  function mission() {
    return MISSIONS[progress.index] || null;
  }

  function stage() {
    const m = mission();
    return m ? m.stages[progress.stage] : null;
  }

  function syncState() {
    if (!state.missions) state.missions = {};
    state.missions.current = progress.index;
    state.missions.stage = progress.stage;
    const m = mission();
    const s = stage();
    state.missions.objective = s ? s.objective : m ? 'Mission complete' : 'No mission';
    state.missions.objectivePos = s ? { x: s.target.x, z: s.target.z } : null;
    state.missions.markerVisible = !!s;
    state.missions.title = m ? m.title : '';
    state.missions.giver = m ? m.giver : '';
    state.missions.payout = m ? m.reward.money : 0;
    state.missions.stageName = s ? s.name : '';
    state.missions.stageTotal = m ? m.stages.length : 0;
  }

  function showDialogue(lines) {
    if (!state.flags) state.flags = {};
    state.flags.dialogue = lines;
    emit('dialogue:show', { lines });
  }

  function startMission(index) {
    const i = index == null ? progress.index : index;
    if (i < 0 || i >= MISSIONS.length) return false;
    progress.index = i;
    progress.stage = 0;
    progress.started = true;
    progress.actionCount = 0;
    progress.holdTimer = 0;
    progress.surviveTimer = 0;
    progress.elapsed = 0;
    progress.missionStartedAt = (state.stats && state.stats.timePlayed) || 0;
    progress.stageStartedAt = progress.missionStartedAt;
    const m = MISSIONS[i];
    showDialogue(m.dialogue);
    syncState();
    emit('mission:started', { id: m.id, title: m.title, giver: m.giver });
    emit('objective:update', { objective: state.missions.objective, pos: state.missions.objectivePos });
    return true;
  }

  function rateMission(m) {
    // G: finished well inside par with no deaths. S: inside par. B: the rest.
    const par = m.parSeconds || 600;
    if (progress.deaths === 0 && progress.elapsed <= par * 0.8) return 'G';
    if (progress.elapsed <= par) return 'S';
    return 'B';
  }

  function applyReward(m) {
    const r = m.reward;
    if (state.player) {
      state.player.money = (state.player.money || 0) + r.money;
    }
    if (state.stats) {
      state.stats.rp = (state.stats.rp || 0) + r.rp;
      state.stats.missionsDone = (state.stats.missionsDone || 0) + 1;
      state.stats.moneyEarned = (state.stats.moneyEarned || 0) + r.money;
      state.stats.respect = (state.stats.respect || 0) + 10;
    }
    if (state.districts && state.districts.standing && m.district) {
      const cur = state.districts.standing[m.district] ?? 50;
      state.districts.standing[m.district] = clampStanding(cur + (r.standing || 8));
    }
    if (state.missions) {
      if (!Array.isArray(state.missions.done)) state.missions.done = [];
      if (!state.missions.done.includes(m.id)) state.missions.done.push(m.id);
      if (!state.missions.ratings) state.missions.ratings = {};
      state.missions.ratings[m.id] = rateMission(m);
    }
    updateRank();
  }

  function updateRank() {
    if (!state.stats) return;
    const rp = state.stats.rp || 0;
    const ranks = [
      { at: 4500, name: 'LEYENDA' },
      { at: 2400, name: 'SHOT CALLER' },
      { at: 1200, name: 'FIXER' },
      { at: 500, name: 'HUSTLER' },
      { at: 0, name: 'ROOKIE' },
    ];
    for (const r of ranks) {
      if (rp >= r.at) {
        state.stats.rank = r.name;
        return;
      }
    }
  }

  function completeMission() {
    const m = mission();
    if (!m) return false;
    applyReward(m);
    progress.started = false;
    const rating = (state.missions.ratings && state.missions.ratings[m.id]) || 'B';
    emit('mission:complete', {
      id: m.id,
      title: m.title,
      rating,
      money: m.reward.money,
      rp: m.reward.rp,
    });
    emit('message', { text: `Mission complete: ${m.title} — rating ${rating} (+$${m.reward.money}, +${m.reward.rp} RP)` });
    progress.index = Math.min(progress.index + 1, MISSIONS.length - 1);
    if (progress.index < MISSIONS.length && !state.missions.done.includes(MISSIONS[progress.index].id)) {
      progress.stage = 0;
      progress.started = false;
    }
    syncState();
    return true;
  }

  function advanceStage() {
    const m = mission();
    if (!m) return false;
    progress.actionCount = 0;
    progress.holdTimer = 0;
    progress.surviveTimer = 0;
    progress.stage += 1;
    progress.stageStartedAt = (state.stats && state.stats.timePlayed) || 0;
    if (progress.stage >= m.stages.length) {
      return completeMission();
    }
    syncState();
    emit('mission:stage', { id: m.id, stage: progress.stage, name: stage().name });
    emit('objective:update', { objective: state.missions.objective, pos: state.missions.objectivePos });
    return true;
  }

  // Called by the game loop / playtest harness when the player does the
  // stage action (E key near the target, shooting the right target, etc).
  function doStageAction() {
    const s = stage();
    if (!s || !progress.started) return false;
    if (s.action === 'clear') {
      progress.actionCount += 1;
      const need = s.count || 1;
      emit('message', { text: `Rivals dealt with: ${progress.actionCount}/${need}` });
      if (progress.actionCount >= need) return advanceStage();
      return true;
    }
    if (s.action) return advanceStage();
    return false;
  }

  // Proximity + heat checks, called every tick with the player position.
  function update(dt, playerPos) {
    if (state.stats) progress.elapsed = ((state.stats.timePlayed || 0) - progress.missionStartedAt);
    if (!progress.started || !playerPos) return;
    const s = stage();
    if (!s) return;

    // Hold / survive stages tick down while the player stays in place.
    if (s.action === 'crack' && s.holdSeconds) {
      if (dist(playerPos, s.target) <= (s.radius || 10)) {
        progress.holdTimer += dt;
        if (progress.holdTimer >= s.holdSeconds) advanceStage();
      } else {
        progress.holdTimer = 0;
      }
      return;
    }
    if (s.action === 'survive' && s.surviveSeconds) {
      progress.surviveTimer += dt;
      if (progress.surviveTimer >= s.surviveSeconds) advanceStage();
      return;
    }

    // Escape stages only complete once the heat is actually gone.
    if (s.needsClear) {
      const wanted = (state.wanted && state.wanted.level) || 0;
      if (wanted > 0) {
        // Blocked: stay on this stage while any heat remains. Mission 8
        // must sit here at wanted 3 until the player lays low.
        if (s.blockedNote) state.missions.blockedNote = s.blockedNote;
        return;
      }
      // Heat is gone — but the player still has to reach the target.
      state.missions.blockedNote = null;
      if (dist(playerPos, s.target) <= (s.radius || 12)) advanceStage();
      return;
    }

    if (s.needsCar && state.player && state.player.onFoot) return;
    if (dist(playerPos, s.target) <= (s.radius || 12)) {
      // Stages with an action wait for doStageAction(); plain travel
      // stages complete on arrival.
      if (s.action && s.action !== 'clear') return;
      advanceStage();
    }
  }

  function currentObjective() {
    const s = stage();
    const m = mission();
    if (!m) return { text: 'All missions complete — Maravilla is yours.', pos: null };
    if (!s) return { text: m.title, pos: null };
    return { text: s.objective, pos: { x: s.target.x, z: s.target.z }, stageName: s.name };
  }

  // --- Street races -------------------------------------------------------
  function startRace(id) {
    const def = RACES.find((r) => r.id === id) || RACES[0];
    race.active = def;
    race.checkpoint = 0;
    race.timeLeft = def.timeLimit;
    emit('race:started', { id: def.id, name: def.name, timeLimit: def.timeLimit });
    emit('message', { text: `Race started: ${def.name} — ${def.checkpoints.length} checkpoints, ${def.timeLimit}s` });
    return def;
  }

  function updateRace(dt, playerPos) {
    if (!race.active || !playerPos) return;
    race.timeLeft -= dt;
    if (race.timeLeft <= 0) {
      emit('race:failed', { id: race.active.id, name: race.active.name });
      emit('message', { text: `Race failed: ${race.active.name} — out of time` });
      race.active = null;
      return;
    }
    const cp = race.active.checkpoints[race.checkpoint];
    if (cp && dist(playerPos, cp) <= 16) {
      race.checkpoint += 1;
      emit('race:checkpoint', { index: race.checkpoint, total: race.active.checkpoints.length });
      if (race.checkpoint >= race.active.checkpoints.length) {
        const reward = race.active.reward;
        if (state.player) state.player.money = (state.player.money || 0) + reward;
        if (state.stats) state.stats.moneyEarned = (state.stats.moneyEarned || 0) + reward;
        emit('race:won', { id: race.active.id, name: race.active.name, reward, timeLeft: race.timeLeft });
        emit('message', { text: `Race won: ${race.active.name} (+$${reward})` });
        race.active = null;
      }
    }
  }

  // --- Taxi fares ---------------------------------------------------------
  function startTaxi(stopIndex) {
    const stop = TAXI_STOPS[stopIndex == null ? 0 : stopIndex % TAXI_STOPS.length];
    const distance = dist(stop.from, stop.to);
    taxi.active = stop;
    taxi.phase = 'pickup';
    taxi.timeLeft = Math.max(120, Math.ceil(distance / 4));
    taxi.fare = Math.round(40 + distance * 0.35);
    emit('taxi:started', { fare: taxi.fare, timeLeft: taxi.timeLeft, from: stop.from, to: stop.to });
    emit('message', { text: `Taxi fare: pick up the passenger at ${stop.from.label} ($${taxi.fare})` });
    return taxi.active;
  }

  function updateTaxi(dt, playerPos) {
    if (!taxi.active || !playerPos) return;
    taxi.timeLeft -= dt;
    if (taxi.timeLeft <= 0) {
      emit('taxi:failed', { text: 'Fare expired — the passenger walked away' });
      taxi.active = null;
      taxi.phase = 'idle';
      return;
    }
    if (taxi.phase === 'pickup' && dist(playerPos, taxi.active.from) <= 12) {
      taxi.phase = 'dropoff';
      taxi.timeLeft = Math.max(taxi.timeLeft, 90);
      emit('taxi:picked-up', { to: taxi.active.to });
      emit('message', { text: `Passenger aboard — drop them at ${taxi.active.to.label}` });
      return;
    }
    if (taxi.phase === 'dropoff' && dist(playerPos, taxi.active.to) <= 12) {
      if (state.player) state.player.money = (state.player.money || 0) + taxi.fare;
      if (state.stats) state.stats.moneyEarned = (state.stats.moneyEarned || 0) + taxi.fare;
      emit('taxi:done', { fare: taxi.fare });
      emit('message', { text: `Fare complete (+$${taxi.fare})` });
      taxi.active = null;
      taxi.phase = 'idle';
    }
  }

  function onPlayerDeath() {
    progress.deaths += 1;
  }

  // Re-read the mission index/stage from state after a save is loaded:
  // the module keeps its own progress counters, so a load would
  // otherwise leave them pointing at the pre-load mission.
  function syncFromState() {
    const idx = (state.missions && state.missions.current) || 0;
    progress.index = Math.max(0, Math.min(MISSIONS.length - 1, idx));
    progress.stage = (state.missions && state.missions.stage) || 0;
    progress.started = true;
    progress.actionCount = 0;
    progress.holdTimer = 0;
    progress.surviveTimer = 0;
    progress.missionStartedAt = (state.stats && state.stats.timePlayed) || 0;
    progress.stageStartedAt = progress.missionStartedAt;
    syncState();
  }

  syncState();

  return {
    MISSIONS,
    RACES,
    TAXI_STOPS,
    PLACES,
    startMission,
    advanceStage,
    completeMission,
    doStageAction,
    syncFromState,
    currentObjective,
    update,
    startRace,
    updateRace,
    startTaxi,
    updateTaxi,
    onPlayerDeath,
    get current() {
      return mission();
    },
    get currentStage() {
      return stage();
    },
    get progress() {
      return progress;
    },
    get race() {
      return race;
    },
    get taxi() {
      return taxi;
    },
  };
}
