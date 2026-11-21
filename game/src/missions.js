'use strict';
/* MARAVILLA — 10 story missions in 3 acts, race, taxi, standing, wanted, rewards. */
var MV = window.MV || (window.MV = {});

MV.missions = (function () {
  var U = MV.util;
  /* Race loop: Downtown rectangle on roads (avenues -100/100, streets -100/100). */
  var RACE_WAYPOINTS = [
    { x: -100, z: 100 }, { x: -100, z: -100 }, { x: 100, z: -100 },
    { x: 100, z: 100 }
  ];
  var RACE_LAPS = 2;

  var CREW = [
    { id: 'juno', name: 'Juno Park', role: 'Driver', color: '#35d6ff', skin: '#e8b98a', hair: '#1a1210', bio: 'Ex-street racer. Knows every shortcut in Maravilla and never lifts.' },
    { id: 'theo', name: 'Theo Ashford', role: 'Mechanic', color: '#7ee081', skin: '#c9a186', hair: '#3a2a1a', bio: 'Turns wrecks into rockets. If it has an engine, Theo can make it sing.' },
    { id: 'iris', name: 'Iris Calloway', role: 'Lookout', color: '#c98cff', skin: '#8a5a3b', hair: '#0e0a08', bio: 'Eyes on every roof in the city. Nothing moves in Maravilla without Iris seeing it.' },
    { id: 'bram', name: 'Bram Okafor', role: 'Muscle', color: '#ff9a5c', skin: '#6a3a22', hair: '#14100c', bio: 'Quiet, huge, loyal. Doors open for Bram. So do safes.' }
  ];

  /* All mission coordinates verified on roads (isOnRoad) — see audit in playtest. */
  var DEFS = [
    { id: 0, act: 1, title: 'First Light', giver: 'juno', payout: 250, gold: 75, silver: 120,
      dialogue: ['Milo. You made it. Maravilla eats strangers — but I hear you drive.', 'Meet me at the plaza. Bring wheels if you can find them. Walk if you must.'],
      stages: [
        { objective: 'Meet Juno at Downtown Plaza', target: { x: 0, z: 50 }, radius: 10, next: 'Juno is waiting by the fountain.' },
        { objective: 'Take Juno\u2019s car and drive to the Velvet overlook', target: { x: 200, z: -100 }, radius: 12, next: 'Follow the gold marker. Easy does it.' }
      ] },
    { id: 1, act: 1, title: 'Hot Wheels', giver: 'theo', payout: 400, gold: 90, silver: 150,
      dialogue: ['Theo here. I need a ride with a proper engine. There is a coupe parked up on 5th — go get it.', 'Bring it to my garage in one piece. Mostly one piece.'],
      stages: [
        { objective: 'Steal the coupe parked on the avenue', target: { x: 106, z: -56 }, radius: 8, next: 'The coupe is yours. Get in.' },
        { objective: 'Deliver the coupe to Theo\u2019s garage', target: { x: -100, z: 200 }, radius: 12, next: 'Garage is marked. Don\u2019t scratch the paint.' }
      ] },
    { id: 2, act: 1, title: 'Taxi Nights', giver: 'iris', payout: 350, gold: 150, silver: 240,
      dialogue: ['Iris. We need clean cash and quiet wheels. Run the cab tonight — three fares, no questions.', 'Pick them up, drop them off, smile like you mean it.'],
      stages: [
        { objective: 'Complete 3 taxi fares', target: { x: 0, z: 0 }, radius: 9999, taxi: true, next: 'Fares pay the bills. Keep driving.' }
      ] },
    { id: 3, act: 2, title: 'Heavy Lifting', giver: 'bram', payout: 900, gold: 110, silver: 180,
      dialogue: ['Bram. There is a delivery van the crew needs. It is parked on the avenue by the plaza — not in a lot, not behind a wall. On the road.', 'Take it to the Ironworks drop. If anyone follows, lose them.'],
      stages: [
        { objective: 'Steal the van parked on the avenue', target: { x: 100, z: -50 }, radius: 8, next: 'Van is on the road, keys in it. Go.' },
        { objective: 'Deliver the van to the Ironworks drop', target: { x: 200, z: 200 }, radius: 12, next: 'Drop point is marked. Steady hands.' }
      ] },
    { id: 4, act: 2, title: 'Neon Run', giver: 'juno', payout: 1500, gold: 55, silver: 75,
      dialogue: ['Juno again. Midnight race, Downtown loop, two laps. The fast boys think they own these streets.', 'Show them what Maravilla\u2019s best driver looks like. Win it.'],
      stages: [
        { objective: 'Win the Neon Run street race (2 laps)', target: { x: -100, z: 100 }, radius: 9999, race: true, next: 'Two laps. Beat them all.' }
      ] },
    { id: 5, act: 2, title: 'Standing Ground', giver: 'iris', payout: 600, gold: 120, silver: 200,
      dialogue: ['Iris. The districts talk. Do two jobs for the locals and they will hide you when the heat comes.', 'Earn their trust. It pays better than fear.'],
      stages: [
        { objective: 'Complete 2 district jobs for the locals', target: { x: 0, z: 0 }, radius: 9999, jobs: true, next: 'The locals are watching. Make it count.' }
      ] },
    { id: 6, act: 2, title: 'The Collection', giver: 'theo', payout: 800, gold: 100, silver: 170,
      dialogue: ['Theo. Somebody scattered my prototype parts all over the city. Five of them. Gold cases, you cannot miss them.', 'Grab five and bring them home. The car will thank you.'],
      stages: [
        { objective: 'Recover 5 prototype parts', target: { x: 0, z: 0 }, radius: 9999, collect: 5, next: 'Five gold cases out there. Hunt them down.' }
      ] },
    { id: 7, act: 3, title: 'Inside Man', giver: 'juno', payout: 1200, gold: 100, silver: 160,
      dialogue: ['Juno. The Grand Maravilla keeps its cash close. Walk in quiet, case the vault room, walk out quieter.', 'No sirens, Milo. Ghost it.'],
      stages: [
        { objective: 'Case the casino vault room — stay unseen (wanted 0)', target: { x: 200, z: -200 }, radius: 12, next: 'In through the front. Calm face.' },
        { objective: 'Slip out to the marina overlook', target: { x: 300, z: -300 }, radius: 12, next: 'Out the same way. No noise.' }
      ] },
    { id: 8, act: 3, title: 'The Crew Gathers', giver: 'bram', payout: 700, gold: 110, silver: 180,
      dialogue: ['Bram. One last job needs the whole crew. Gather them: Juno at the plaza, Theo at the garage, Iris on the roof.', 'Then we take the city.'],
      stages: [
        { objective: 'Gather Juno at Downtown Plaza', target: { x: 0, z: 50 }, radius: 10, next: 'Juno first. Then Theo.' },
        { objective: 'Gather Theo at the garage', target: { x: -100, z: 200 }, radius: 10, next: 'Theo next. Then Iris.' },
        { objective: 'Gather Iris at the marina overlook', target: { x: 300, z: -300 }, radius: 10, next: 'All four. The crew is whole.' }
      ] },
    { id: 9, act: 3, title: 'The Vault', giver: 'bram', payout: 5000, gold: 180, silver: 280,
      dialogue: ['Bram. Tonight we take the Grand Maravilla vault. In, out, gone before the sun is up.', 'This is the one they will sing about, Milo. Make it count.'],
      stages: [
        { objective: 'Enter the Grand Maravilla casino', target: { x: 200, z: -200 }, radius: 14, next: 'Walk in like you own it.' },
        { objective: 'Crack the vault', target: { x: 250, z: -250 }, radius: 12, next: 'Crack it. Take everything.' },
        { objective: 'Escape to the Boardwalk with the score', target: { x: 0, z: 300 }, radius: 14, next: 'Run. Do not look back.' }
      ] }
  ];

  var state = {
    cash: 250, day: 1, clockMin: 19 * 60 + 40,
    current: -1, stageIdx: 0, missionTime: 0, completed: [],
    standing: { downtown: 20, velvet: 10, hills: 15, oldtown: 25, industrial: 10, beach: 15 },
    wanted: 0, heat: 0, collectibles: 0, jumps: 0, fares: 0, jobsDone: 0,
    racesWon: 0, exportsDone: 0, kills: 0, busted: 0,
    weapons: { fists: { owned: true, ammo: -1 }, pistol: { owned: true, ammo: 60 }, smg: { owned: false, ammo: 0 }, shotgun: { owned: false, ammo: 0 }, rifle: { owned: false, ammo: 0 }, launcher: { owned: false, ammo: 0 } },
    weaponOrder: ['fists', 'pistol', 'smg', 'shotgun', 'rifle', 'launcher'],
    selectedWeapon: 'pistol',
    upgrades: { engine: 0, armour: 0, nitro: 0 },
    race: null, taxi: null, job: null, nextLine: '', lastRating: ''
  };

  function auditTargets() {
    /* Every mission target must lie on a road. Returns list of violations. */
    var bad = [];
    for (var i = 0; i < DEFS.length; i++) {
      for (var s = 0; s < DEFS[i].stages.length; s++) {
        var t = DEFS[i].stages[s].target;
        if (t.radius < 900 && !U.isOnRoad(t.x, t.z)) bad.push(DEFS[i].title + ' stage ' + s + ' (' + t.x + ',' + t.z + ')');
      }
    }
    return bad;
  }

  function startMission(idx, game) {
    if (idx < 0 || idx >= DEFS.length) return null;
    if (state.completed.indexOf(idx) >= 0) return null;
    state.current = idx;
    state.stageIdx = 0;
    state.missionTime = 0;
    state.race = null; state.taxi = null; state.job = null;
    var def = DEFS[idx];
    if (def.stages[0].race) startRace(game);
    if (def.stages[0].taxi) startTaxi(game);
    if (def.stages[0].jobs) startJob(game);
    return def;
  }

  function startRace(game) {
    var rivals = [];
    var specs = [
      { color: 0x8a1622, maxSpeed: 38, offset: -4 },
      { color: 0x1a5fb4, maxSpeed: 40, offset: 4 },
      { color: 0xd4af37, maxSpeed: 41, offset: 0 }
    ];
    for (var i = 0; i < specs.length; i++) {
      var sp = specs[i];
      var wp = RACE_WAYPOINTS[0];
      /* Rivals start BEHIND the player on the grid (pole position is the
         player's) — they used to spawn ahead of the start line, handing
         them a 24-40 unit head start the player could never claw back
         because the corner caps equalise everyone's pace. */
      var car = MV.entities.createCar({
        x: wp.x + sp.offset, z: wp.z + 22 + i * 8, heading: Math.PI,
        color: sp.color, luxury: true, type: 'rival', maxSpeed: sp.maxSpeed, accel: 16
      });
      rivals.push({ car: car, wpIdx: 1, lap: 0, finished: false, finishTime: 0 });
    }
    state.race = {
      rivals: rivals, playerWp: 1, playerLap: 0, playerFinished: false,
      playerTime: 0, positions: [], started: false, countdown: 3
    };
    /* Clear the course of slow traffic so the race is decided by driving. */
    MV.entities.setRaceActive(true);
    MV.entities.clearRaceCourse();
    /* Place the player car at the start line. */
    if (game) game.placePlayerCar(RACE_WAYPOINTS[0].x, RACE_WAYPOINTS[0].z + 14, Math.PI);
  }

  function raceProgress(game) {
    var r = state.race;
    if (!r) return null;
    var pc = game.playerCar();
    if (pc) {
      var wp = RACE_WAYPOINTS[r.playerWp % RACE_WAYPOINTS.length];
      if (U.dist2(pc.x, pc.z, wp.x, wp.z) < 14) {
        r.playerWp++;
        if (r.playerWp % RACE_WAYPOINTS.length === 0) r.playerLap++;
        if (r.playerLap >= RACE_LAPS) { r.playerFinished = true; r.playerTime = state.missionTime; }
      }
    }
    for (var i = 0; i < r.rivals.length; i++) {
      var rv = r.rivals[i];
      if (rv.finished) continue;
      var w = RACE_WAYPOINTS[rv.wpIdx % RACE_WAYPOINTS.length];
      if (U.dist2(rv.car.x, rv.car.z, w.x, w.z) < 14) {
        rv.wpIdx++;
        if (rv.wpIdx % RACE_WAYPOINTS.length === 0) rv.lap++;
        if (rv.lap >= RACE_LAPS) { rv.finished = true; rv.finishTime = state.missionTime; }
      }
    }
    var finished = r.rivals.filter(function (v) { return v.finished; }).length;
    return { playerLap: r.playerLap, playerWp: r.playerWp, playerFinished: r.playerFinished, rivalsFinished: finished };
  }

  function raceWon() {
    var r = state.race;
    if (!r || !r.playerFinished) return false;
    for (var i = 0; i < r.rivals.length; i++) {
      if (r.rivals[i].finished && r.rivals[i].finishTime < r.playerTime) return false;
    }
    return true;
  }

  function updateRaceAI(dt) {
    var r = state.race;
    if (!r) return;
    for (var i = 0; i < r.rivals.length; i++) {
      var rv = r.rivals[i];
      if (rv.finished) { MV.entities.updateCar(rv.car, dt, { throttle: 0, steer: 0, brake: 1, nitro: false, reverse: false }); continue; }
      var res = MV.entities.pursue(rv.car, RACE_WAYPOINTS, rv.wpIdx, 18, rv.car.maxSpeed);
      rv.wpIdx = res.next;
      var rInput = { throttle: res.throttle, steer: res.steer, brake: res.brake, nitro: false, reverse: false };
      /* Anti-stuck: reverse out if wedged against a building. */
      if (rv.reverseT > 0) {
        rv.reverseT -= dt;
        rInput = { throttle: 0, steer: -res.steer, brake: 0, nitro: false, reverse: true };
      } else {
        if (Math.abs(rv.car.speed) < 2 && res.throttle) rv.stuckT = (rv.stuckT || 0) + dt; else rv.stuckT = 0;
        if (rv.stuckT > 1.2) { rv.reverseT = 1.0; rv.stuckT = 0; }
      }
      MV.entities.updateCar(rv.car, dt, rInput);
    }
  }

  function startTaxi(game) {
    state.taxi = { faresDone: 0, phase: 'pickup', passenger: null, dest: null, fare: 0 };
    nextFare(game);
  }
  function nextFare(game) {
    var tx = state.taxi;
    var spots = [[-200, 100], [100, -200], [200, 200], [-100, -100], [0, -300], [300, 0], [-300, -200], [50, 150]];
    var p = spots[Math.floor(Math.random() * spots.length)];
    var d = spots[Math.floor(Math.random() * spots.length)];
    tx.passenger = { x: p[0], z: p[1] };
    tx.dest = { x: d[0], z: d[1] };
    tx.phase = 'pickup';
    tx.fare = 60 + Math.floor(Math.random() * 90);
  }
  function updateTaxi(game) {
    var tx = state.taxi;
    if (!tx) return null;
    var pc = game.playerCar();
    var pos = pc ? { x: pc.x, z: pc.z } : game.playerPos();
    if (tx.phase === 'pickup' && U.dist2(pos.x, pos.z, tx.passenger.x, tx.passenger.z) < 10) {
      tx.phase = 'dropoff';
      return 'passenger';
    }
    if (tx.phase === 'dropoff' && U.dist2(pos.x, pos.z, tx.dest.x, tx.dest.z) < 12) {
      tx.faresDone++;
      state.fares++;
      state.cash += tx.fare;
      MV.audio.cash();
      if (tx.faresDone >= 3) { state.taxi = null; return 'done'; }
      nextFare(game);
      return 'fare';
    }
    return null;
  }

  function startJob(game) {
    var spots = [[-200, -200], [100, 200], [250, 0], [-100, 300], [0, -100], [200, -200]];
    var p = spots[state.jobsDone % spots.length];
    state.job = { target: { x: p[0], z: p[1] }, done: false };
  }
  function updateJob(game) {
    if (!state.job) return false;
    var pos = game.playerPos();
    if (U.dist2(pos.x, pos.z, state.job.target.x, state.job.target.z) < 12) {
      state.jobsDone++;
      var d = U.districtAt(pos.x, pos.z);
      state.standing[d.id] = Math.min(100, state.standing[d.id] + 15);
      state.cash += 120;
      MV.audio.cash();
      if (state.jobsDone >= 2) { state.job = null; return true; }
      startJob(game);
      return false;
    }
    return false;
  }

  function currentDef() {
    return state.current >= 0 ? DEFS[state.current] : null;
  }
  function currentStage() {
    var d = currentDef();
    return d ? d.stages[state.stageIdx] : null;
  }
  function currentTarget(game) {
    var st = currentStage();
    if (!st) return null;
    if (st.race && state.race) {
      var wp = RACE_WAYPOINTS[state.race.playerWp % RACE_WAYPOINTS.length];
      return { x: wp.x, z: wp.z, radius: 14 };
    }
    if (st.taxi && state.taxi) {
      var t = state.taxi.phase === 'pickup' ? state.taxi.passenger : state.taxi.dest;
      return { x: t.x, z: t.z, radius: 12 };
    }
    if (st.jobs && state.job) return { x: state.job.target.x, z: state.job.target.z, radius: 12 };
    if (st.collect) {
      var pos = game ? game.playerPos() : { x: 0, z: 0 };
      var best = null, bd = 1e9;
      var cols = MV.world.collectibles;
      for (var i = 0; i < cols.length; i++) {
        if (cols[i].taken) continue;
        var d = U.dist2(pos.x, pos.z, cols[i].x, cols[i].z);
        if (d < bd) { bd = d; best = cols[i]; }
      }
      if (best) return { x: best.x, z: best.z, radius: 4 };
      return { x: 0, z: 0, radius: 9999 };
    }
    return st.target;
  }

  function completeStage(game) {
    var d = currentDef();
    state.stageIdx++;
    if (state.stageIdx >= d.stages.length) {
      completeMission(game);
      return 'mission';
    }
    var st = d.stages[state.stageIdx];
    state.nextLine = st.next || '';
    if (st.race) startRace(game);
    if (st.taxi) startTaxi(game);
    if (st.jobs) startJob(game);
    return 'stage';
  }

  function ratingFor(def) {
    if (state.missionTime <= def.gold) return 'GOLD';
    if (state.missionTime <= def.silver) return 'SILVER';
    return 'BRONZE';
  }

  function completeMission(game) {
    var d = currentDef();
    var rating = ratingFor(d);
    state.lastRating = rating;
    var bonus = rating === 'GOLD' ? 200 : rating === 'SILVER' ? 100 : 0;
    state.cash += d.payout + bonus;
    state.completed.push(state.current);
    if (d.id === 4) state.racesWon++;
    if (d.id === 9) state.exportsDone++;
    /* Unlocks. */
    if (d.id === 1) state.weapons.smg.owned = true, state.weapons.smg.ammo = 120;
    if (d.id === 3) state.weapons.shotgun.owned = true, state.weapons.shotgun.ammo = 24;
    if (d.id === 6) state.weapons.rifle.owned = true, state.weapons.rifle.ammo = 90;
    if (d.id === 8) state.weapons.launcher.owned = true, state.weapons.launcher.ammo = 6;
    state.nextLine = d.id === 9 ? 'MARAVILLA IS YOURS.' : 'Next job unlocked. The city is watching, Milo.';
    if (state.race) {
      for (var i = 0; i < state.race.rivals.length; i++) MV.entities.removeCar(state.race.rivals[i].car);
      state.race = null;
      MV.entities.setRaceActive(false);
    }
    state.taxi = null; state.job = null;
    state.current = -1;
    state.stageIdx = 0;
    MV.audio.cash();
    return { title: d.title, payout: d.payout + bonus, rating: rating };
  }

  function failMission(game) {
    if (state.race) {
      for (var i = 0; i < state.race.rivals.length; i++) MV.entities.removeCar(state.race.rivals[i].car);
      state.race = null;
      MV.entities.setRaceActive(false);
    }
    state.taxi = null; state.job = null;
    state.current = -1;
    state.stageIdx = 0;
    state.nextLine = 'Job failed. The crew still believes in you — try again.';
  }

  function addWanted(n, game) {
    state.wanted = U.clamp(state.wanted + n, 0, 5);
    state.heat = 100;
    if (game) game.onWantedChange(state.wanted);
  }
  function decayWanted(dt, game) {
    if (state.wanted <= 0) return;
    var d = U.districtAt(game.playerPos().x, game.playerPos().z);
    var standing = state.standing[d.id] || 0;
    var rate = 1.6 * (standing >= 70 ? 2 : standing >= 40 ? 1.4 : 1);
    state.heat -= rate * dt;
    if (state.heat <= 0) {
      state.wanted--;
      state.heat = state.wanted > 0 ? 100 : 0;
      if (game) game.onWantedChange(state.wanted);
    }
  }

  function update(dt, game) {
    state.clockMin += dt * 0.5;
    if (state.clockMin >= 1440) { state.clockMin -= 1440; state.day++; }
    if (state.current >= 0) state.missionTime += dt;
    decayWanted(dt, game);
    updateRaceAI(dt);
    var prog = raceProgress(game);
    if (prog && prog.playerFinished) {
      if (raceWon()) completeStage(game);
      else failMission(game);
      return;
    }
    var tx = updateTaxi(game);
    if (tx === 'done') completeStage(game);
    if (updateJob(game)) completeStage(game);
    var st = currentStage();
    if (st && !st.race && !st.taxi && !st.jobs && !st.collect) {
      var pos = game.playerPos();
      if (U.dist2(pos.x, pos.z, st.target.x, st.target.z) < st.radius) {
        completeStage(game);
      }
    }
    if (st && st.collect) {
      if (state.collectibles >= 5) completeStage(game);
    }
  }

  return {
    DEFS: DEFS, CREW: CREW, RACE_WAYPOINTS: RACE_WAYPOINTS, state: state,
    auditTargets: auditTargets, startMission: startMission, currentDef: currentDef,
    currentStage: currentStage, currentTarget: currentTarget,
    completeMission: completeMission, failMission: failMission,
    addWanted: addWanted, raceWon: raceWon, raceProgress: raceProgress,
    update: update
  };
})();
