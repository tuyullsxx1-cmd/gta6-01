'use strict';
/* MARAVILLA — boot, game loop, input, camera, shooting, wanted response, save/load, test hooks. */
var MV = window.MV || (window.MV = {});

MV.main = (function () {
  var U = MV.util;
  var renderer, scene, camera, clock;
  var worldData;
  var keys = {};
  var state = 'menu'; /* menu | play | pause | phone | wheel */
  var pauseTab = 'map';
  var t = 0, fps = 0, fpsFrames = 0, fpsTime = 0, totalFrames = 0, timeScale = 1;
  var lowfx = false;
  var headless = false; /* logic only, skip the WebGL render (test hook) */
  try {
    lowfx = new URLSearchParams(window.location.search).get('lowfx') === '1';
    headless = new URLSearchParams(window.location.search).get('headless') === '1';
  } catch (e) {}
  var camPos = new THREE.Vector3(0, 40, 220);
  var camLook = new THREE.Vector3(0, 0, 0);
  var shake = 0;
  var errors = [];
  var autopilot = false;
  var autopilotRoute = null;
  var stuckT = 0, reverseT = 0;
  var muzzle = null, muzzleLight = null, tracers = [];
  var heli = null, heliLight = null;
  var roadblockCars = [];
  var bustedTimer = 0;
  var phoneMessages = [
    { from: 'Juno Park', text: 'You drive yet, or are you still sightseeing? Plaza. Now.' },
    { from: 'Theo Ashford', text: 'Brought the coupe in yet? My lift is empty and my patience is thinner.' },
    { from: 'Iris Calloway', text: 'Eyes on the rooftops. The city is quiet tonight. Too quiet.' },
    { from: 'Bram Okafor', text: 'One last job. Then we are legends, Milo. Legends.' }
  ];
  var tickerItems = [
    'GRAND THEFT AUTO — Downtown, suspect fled in a gold coupe',
    'STREET RACING — Neon Run heats up on the Downtown loop',
    'ARMED ROBBERY — Velvet Bay casino reports a suspicious visitor',
    'RECKLESS DRIVING — taxi seen drifting the Boardwalk at dusk',
    'WANTED — Milo Vane, last seen near Plaza Maravilla',
    'DISTRICT WATCH — locals in Old Town refuse to talk to police'
  ];
  var tickerIdx = 0;
  var CALLSIGNS = [
    { callsign: 'UNIT 7 · FALCON', role: 'Patrol' }, { callsign: 'UNIT 12 · VIPER', role: 'Pursuit' },
    { callsign: 'UNIT 3 · HAVOC', role: 'Intercept' }, { callsign: 'UNIT 21 · GHOST', role: 'Air One' },
    { callsign: 'UNIT 9 · RAPTOR', role: 'Patrol' }, { callsign: 'UNIT 30 · SABLE', role: 'Pursuit' }
  ];
  var CRIMES = ['Grand theft auto', 'Street racing', 'Armed robbery', 'Reckless driving', 'Evading police', 'Illegal street race'];

  window.addEventListener('error', function (e) { errors.push(String(e.message || e.error)); });

  function init() {
    var container = document.getElementById('game');
    renderer = new THREE.WebGLRenderer({ antialias: !lowfx, preserveDrawingBuffer: true });
    renderer.setPixelRatio(lowfx ? 1 : Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.18;
    renderer.shadowMap.enabled = !lowfx;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    container.appendChild(renderer.domElement);
    scene = new THREE.Scene();
    scene.fog = new THREE.Fog(0x2a1440, 220, 900);
    camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.1, 2200);
    camera.position.copy(camPos);
    worldData = MV.world.build(renderer, scene);
    MV.entities.init(scene, worldData.colliders);
    MV.ui.init();
    clock = new THREE.Clock();
    bindInput();
    window.addEventListener('resize', onResize);
    buildHeli();
    /* Muzzle flash + light (reused). */
    muzzle = new THREE.Sprite(new THREE.SpriteMaterial({
      map: U.glowTexture('rgba(255,220,120,1)'), transparent: true,
      blending: THREE.AdditiveBlending, depthWrite: false
    }));
    muzzle.scale.set(3, 3, 1);
    muzzle.visible = false;
    scene.add(muzzle);
    muzzleLight = new THREE.PointLight(0xffc46b, 0, 30, 1.8);
    scene.add(muzzleLight);
    MV.ui.addFeed('Welcome to Maravilla. Press M for missions.', '#ffd166');
    MV.ui.addFeed('WASD drive / walk · E enter car · Q weapons · P phone', '#9fb4ff');
    setInterval(function () {
      tickerIdx = (tickerIdx + 1) % tickerItems.length;
      MV.ui.setTicker(tickerItems[tickerIdx]);
    }, 6000);
    MV.ui.setTicker(tickerItems[0]);
    animate();
    window.__mv = hooks();
    window.__mv.ready = true;
  }

  function onResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  }

  function buildHeli() {
    heli = new THREE.Group();
    var body = new THREE.Mesh(new THREE.BoxGeometry(4, 1.6, 8),
      new THREE.MeshStandardMaterial({ color: 0x0e1a2e, metalness: 0.7, roughness: 0.4 }));
    heli.add(body);
    var tail = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.8, 6),
      new THREE.MeshStandardMaterial({ color: 0x0e1a2e, metalness: 0.7, roughness: 0.4 }));
    tail.position.set(0, 0.3, -6);
    heli.add(tail);
    var rotor = new THREE.Mesh(new THREE.BoxGeometry(12, 0.1, 1),
      new THREE.MeshStandardMaterial({ color: 0x222222, metalness: 0.8, roughness: 0.3 }));
    rotor.position.y = 1.2;
    heli.add(rotor);
    heli.userData.rotor = rotor;
    var lamp = new THREE.Mesh(new THREE.SphereGeometry(0.4, 8, 8),
      new THREE.MeshStandardMaterial({ color: 0x111111, emissive: 0xff2222, emissiveIntensity: 3 }));
    lamp.position.set(0, -1, 3);
    heli.add(lamp);
    heli.visible = false;
    scene.add(heli);
    heliLight = new THREE.SpotLight(0xfff2c0, 0, 120, 0.35, 0.4, 1.2);
    scene.add(heliLight);
    scene.add(heliLight.target);
  }

  function bindInput() {
    window.addEventListener('keydown', function (e) {
      var k = e.key.toLowerCase();
      keys[k] = true;
      if ([' ', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'].indexOf(k) >= 0) e.preventDefault();
      if (state !== 'play') return;
      if (k === 'e') toggleCar();
      if (k === 'q') toggleWheel();
      if (k === 'p') openPhone();
      if (k === 'r') { MV.audio.ensure(); MV.ui.addFeed('Radio: ' + MV.audio.nextStation(), '#9fb4ff'); }
      if (k === 'm') openPause('story');
      if (k === 't') quickSave();
      if (k === 'escape') openPause('map');
      if (k >= '1' && k <= '6') selectWeapon(parseInt(k, 10) - 1);
    });
    window.addEventListener('keyup', function (e) { keys[e.key.toLowerCase()] = false; });
    window.addEventListener('mousedown', function (e) {
      if (state !== 'play') return;
      if (e.target && e.target.closest && e.target.closest('.overlay, button, .wslot')) return;
      fireWeapon();
    });
    var startBtn = document.getElementById('start-btn');
    if (startBtn) startBtn.addEventListener('click', function () { MV.audio.ensure(); startGame(); });
    var resumeBtn = document.getElementById('resume-btn');
    if (resumeBtn) resumeBtn.addEventListener('click', function () { closePause(); });
    var slots = document.querySelectorAll('#save-slots button');
    for (var i = 0; i < slots.length; i++) {
      (function (idx) {
        slots[idx].addEventListener('click', function () {
          var s = loadSlot(idx);
          if (s) { startGame(); MV.ui.addFeed('Save slot ' + (idx + 1) + ' loaded.', '#7ee081'); }
          else MV.ui.addFeed('Save slot ' + (idx + 1) + ' is empty.', '#ff9a5c');
        });
      })(i);
    }
    var tabs = document.querySelectorAll('.ptab');
    for (var j = 0; j < tabs.length; j++) {
      (function (tab) {
        tab.addEventListener('click', function () { setPauseTab(tab.getAttribute('data-tab')); });
      })(tabs[j]);
    }
    var closePhoneBtn = document.getElementById('phone-close');
    if (closePhoneBtn) closePhoneBtn.addEventListener('click', closePhone);
    var closeWheelBtn = document.getElementById('wheel-close');
    if (closeWheelBtn) closeWheelBtn.addEventListener('click', toggleWheel);
    var wheelSlots = document.querySelectorAll('#wheel .wslot');
    for (var w = 0; w < wheelSlots.length; w++) {
      (function (idx) {
        wheelSlots[w].addEventListener('click', function () { selectWeapon(idx); toggleWheel(); });
      })(w);
    }
  }

  function startGame() {
    state = 'play';
    var menu = document.getElementById('menu');
    if (menu) menu.style.display = 'none';
    MV.audio.ensure();
  }
  function openPause(tab) {
    state = 'pause';
    var p = document.getElementById('pause');
    if (p) p.style.display = 'block';
    setPauseTab(tab || 'map');
  }
  function setPauseTab(tab) {
    pauseTab = tab;
    var tabs = document.querySelectorAll('.ptab');
    for (var i = 0; i < tabs.length; i++) tabs[i].classList.toggle('active', tabs[i].getAttribute('data-tab') === tab);
    MV.ui.renderPauseTab(tab, game());
  }
  function closePause() {
    state = 'play';
    var p = document.getElementById('pause');
    if (p) p.style.display = 'none';
  }
  function openPhone() {
    state = 'phone';
    MV.ui.openPhone(phoneMessages);
  }
  function closePhone() {
    state = 'play';
    MV.ui.closePhone();
  }
  function toggleWheel() {
    var w = document.getElementById('wheel');
    if (!w) return;
    if (state === 'wheel') { state = 'play'; w.style.display = 'none'; return; }
    if (state !== 'play') return;
    state = 'wheel';
    var M = MV.missions.state;
    var html = '';
    for (var i = 0; i < M.weaponOrder.length; i++) {
      var wn = M.weaponOrder[i], info = M.weapons[wn];
      html += '<div class="wslot' + (wn === M.selectedWeapon ? ' sel' : '') + (info.owned ? '' : ' locked') + '"><b>' + (i + 1) + '</b> ' + wn.toUpperCase() + '<span>' + (info.owned ? (info.ammo < 0 ? '∞' : info.ammo) : 'LOCKED') + '</span></div>';
    }
    w.querySelector('.wheel-slots').innerHTML = html;
    w.style.display = 'block';
  }
  function selectWeapon(idx) {
    var M = MV.missions.state;
    var w = M.weaponOrder[idx];
    if (!w || !M.weapons[w].owned) return;
    M.selectedWeapon = w;
    MV.audio.click();
  }

  function playerCar() {
    var p = MV.entities.player;
    return p.inCar;
  }
  function playerPos() {
    var p = MV.entities.player;
    if (p.inCar) return { x: p.inCar.x, z: p.inCar.z };
    return { x: p.x, z: p.z };
  }
  function placePlayerCar(x, z, heading) {
    var p = MV.entities.player;
    var car = p.inCar;
    if (!car) {
      car = MV.entities.createCar({ x: x, z: z, heading: heading, color: 0x2a0a2a, luxury: true, type: 'player', maxSpeed: 58, accel: 20 });
      car.isPlayerCar = true;
      p.inCar = car;
      p.onFoot = false;
      p.mesh.visible = false;
    } else {
      car.x = x; car.z = z; car.heading = heading; car.speed = 0;
    }
    return car;
  }

  function toggleCar() {
    var p = MV.entities.player;
    if (p.inCar) {
      var car = p.inCar;
      car.isPlayerCar = false;
      car.speed *= 0.2;
      p.x = car.x - Math.sin(car.heading) * 3.4;
      p.z = car.z - Math.cos(car.heading) * 3.4;
      var corr = MV.entities.collideCircle(p.x, p.z, 0.6);
      p.x = corr.x; p.z = corr.z;
      p.heading = car.heading;
      p.inCar = null;
      p.onFoot = true;
      p.mesh.visible = true;
      p.mesh.position.set(p.x, 0, p.z);
      return;
    }
    var best = null, bd = 5.5;
    var cars = MV.entities.cars;
    for (var i = 0; i < cars.length; i++) {
      var c = cars[i];
      if (c.dead || c.isPlayerCar) continue;
      if (c.type === 'rival' || c.type === 'cop') continue;
      var d = U.dist2(p.x, p.z, c.x, c.z);
      if (d < bd) { bd = d; best = c; }
    }
    if (!best) return;
    if (best.type === 'traffic') MV.missions.addWanted(1, game());
    best.parked = false;
    best.isPlayerCar = true;
    best.maxSpeed = Math.max(best.maxSpeed, 40);
    p.inCar = best;
    p.onFoot = false;
    p.mesh.visible = false;
    MV.audio.click();
  }

  function fireWeapon() {
    var M = MV.missions.state;
    var w = M.selectedWeapon, info = M.weapons[w];
    if (!info.owned) return;
    if (info.ammo === 0) { MV.audio.click(); MV.ui.showHint('Out of ammo — visit a safehouse to restock.'); return; }
    if (info.ammo > 0) info.ammo--;
    var p = MV.entities.player;
    var ox = p.inCar ? p.inCar.x : p.x;
    var oz = p.inCar ? p.inCar.z : p.z;
    var heading = p.inCar ? p.inCar.heading : p.heading;
    var fx = Math.sin(heading), fz = Math.cos(heading);
    var range = w === 'launcher' ? 60 : w === 'rifle' ? 90 : w === 'shotgun' ? 26 : 55;
    var dmg = w === 'launcher' ? 100 : w === 'rifle' ? 45 : w === 'shotgun' ? 34 : w === 'smg' ? 12 : w === 'pistol' ? 22 : 15;
    /* Muzzle flash at the gun. */
    var mx = ox + fx * 2, mz = oz + fz * 2;
    muzzle.position.set(mx, 1.6, mz);
    muzzle.visible = true;
    muzzleLight.position.set(mx, 2, mz);
    muzzleLight.intensity = 3;
    setTimeout(function () { muzzle.visible = false; muzzleLight.intensity = 0; }, 120);
    MV.audio.shot();
    /* Find nearest target in a cone ahead. */
    var best = null, bd = range, bestKind = '';
    function consider(x, z, obj, kind) {
      var dx = x - ox, dz = z - oz;
      var d = Math.sqrt(dx * dx + dz * dz);
      if (d > range || d < 1) return;
      var dot = (dx * fx + dz * fz) / d;
      if (dot < 0.82) return;
      if (d < bd) { bd = d; best = obj; bestKind = kind; }
    }
    for (var i = 0; i < MV.entities.peds.length; i++) { var pd = MV.entities.peds[i]; if (!pd.dead) consider(pd.x, pd.z, pd, 'ped'); }
    for (var j = 0; j < MV.entities.cops.length; j++) { var cp = MV.entities.cops[j]; if (!cp.dead) consider(cp.x, cp.z, cp, 'cop'); }
    for (var k = 0; k < MV.entities.cars.length; k++) {
      var cr = MV.entities.cars[k];
      if (!cr.dead && !cr.isPlayerCar) consider(cr.x, cr.z, cr, 'car');
    }
    var hx = ox + fx * bd, hz = oz + fz * bd;
    addTracer(mx, 1.6, mz, hx, 1.4, hz);
    if (w === 'launcher') {
      MV.entities.explode(hx, hz, true);
      damageAt(hx, hz, 14, 100);
      return;
    }
    if (!best) return;
    if (bestKind === 'ped') {
      best.dead = true;
      best.mesh.rotation.x = -Math.PI / 2;
      best.mesh.position.y = 0.3;
      M.kills++;
      MV.missions.addWanted(1, game());
      MV.ui.addFeed('Pedestrian down. The city saw that.', '#ff9a5c');
      setTimeout(function () { scene.remove(best.mesh); }, 4000);
    } else if (bestKind === 'cop') {
      best.dead = true;
      if (best.onFoot) { best.mesh.rotation.x = -Math.PI / 2; best.mesh.position.y = 0.3; }
      else { MV.entities.explode(best.x, best.z, false); MV.entities.removeCar(best); }
      M.kills++;
      MV.missions.addWanted(1, game());
    } else if (bestKind === 'car') {
      best.health -= dmg;
      shake = Math.min(1, shake + 0.3);
      if (best.health <= 0 && !best.dead) {
        best.dead = true;
        MV.entities.explode(best.x, best.z, true);
        MV.entities.removeCar(best);
        MV.missions.addWanted(1, game());
      }
    }
  }

  function damageAt(x, z, radius, dmg) {
    for (var i = 0; i < MV.entities.cars.length; i++) {
      var c = MV.entities.cars[i];
      if (c.dead || c.isPlayerCar) continue;
      if (U.dist2(x, z, c.x, c.z) < radius) {
        c.health -= dmg;
        if (c.health <= 0) { c.dead = true; MV.entities.explode(c.x, c.z, true); MV.entities.removeCar(c); }
      }
    }
  }

  function addTracer(x1, y1, z1, x2, y2, z2) {
    var geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array([x1, y1, z1, x2, y2, z2]), 3));
    var line = new THREE.Line(geo, new THREE.LineBasicMaterial({ color: 0xffe9a0, transparent: true, opacity: 0.9 }));
    scene.add(line);
    tracers.push({ line: line, life: 0.14 });
  }

  function updateTracers(dt) {
    for (var i = tracers.length - 1; i >= 0; i--) {
      tracers[i].life -= dt;
      tracers[i].line.material.opacity = Math.max(0, tracers[i].life / 0.14);
      if (tracers[i].life <= 0) { scene.remove(tracers[i].line); tracers.splice(i, 1); }
    }
  }

  function onWantedChange(wanted) {
    MV.audio.siren(wanted >= 2);
    /* Foot cops: one per star up to 3. */
    var p = MV.entities.player;
    var footCops = MV.entities.cops.filter(function (c) { return c.onFoot && !c.dead; }).length;
    var wantFoot = Math.min(wanted, 3);
    var pos = playerPos();
    while (footCops < wantFoot) {
      var a = Math.random() * Math.PI * 2;
      MV.entities.spawnCop(scene, pos.x + Math.cos(a) * 40, pos.z + Math.sin(a) * 40, false);
      footCops++;
    }
    /* Patrol cars at wanted >= 2. */
    var patrol = MV.entities.cops.filter(function (c) { return !c.onFoot && !c.dead; }).length;
    var wantPatrol = wanted >= 2 ? Math.min(wanted - 1, 2) : 0;
    while (patrol < wantPatrol) {
      var a2 = Math.random() * Math.PI * 2;
      MV.entities.spawnCop(scene, pos.x + Math.cos(a2) * 60, pos.z + Math.sin(a2) * 60, true);
      patrol++;
    }
    /* Roadblock at wanted >= 3 (once per escalation). */
    if (wanted >= 3 && roadblockCars.length === 0) {
      var rp = U.nearestRoadPoint(pos.x + 60, pos.z + 60);
      var rb1 = MV.entities.createCar({ x: rp.x - 4, z: rp.z, heading: Math.PI / 2, color: 0x0e1a2e, type: 'cop', maxSpeed: 0, accel: 0 });
      var rb2 = MV.entities.createCar({ x: rp.x + 4, z: rp.z, heading: Math.PI / 2, color: 0x0e1a2e, type: 'cop', maxSpeed: 0, accel: 0 });
      roadblockCars = [rb1, rb2];
      MV.ui.addFeed('ROADBLOCK ahead — the net is closing.', '#ff4040');
    }
    if (wanted === 0 && roadblockCars.length) {
      for (var i = 0; i < roadblockCars.length; i++) MV.entities.removeCar(roadblockCars[i]);
      roadblockCars = [];
    }
    updateDispatch();
  }

  function updateDispatch() {
    var M = MV.missions.state;
    var units = [];
    var n = Math.min(6, 2 + M.wanted * 1);
    for (var i = 0; i < n; i++) {
      var cs = CALLSIGNS[i % CALLSIGNS.length];
      units.push({
        callsign: cs.callsign, role: cs.role,
        label: M.wanted > 0 ? CRIMES[(i + M.wanted) % CRIMES.length] : 'Routine patrol'
      });
    }
    MV.ui.updateDispatch(units);
  }

  function updatePlayer(dt) {
    var p = MV.entities.player;
    var M = MV.missions.state;
    if (p.inCar) {
      var car = p.inCar;
      var input = readDriveInput();
      if (autopilot && autopilotRoute) {
        var res = MV.entities.pursue(car, autopilotRoute, autopilotRoute.idx || 0, 20, car.maxSpeed);
        autopilotRoute.idx = res.next;
        input = { throttle: res.throttle, steer: res.steer, brake: res.brake, nitro: false, reverse: false };
        /* Anti-stuck: if the car is wedged (speed ~0 while trying to drive),
           reverse out for a second instead of grinding against the wall. */
        if (reverseT > 0) {
          reverseT -= dt;
          input = { throttle: 0, steer: -res.steer, brake: 0, nitro: false, reverse: true };
        } else {
          if (Math.abs(car.speed) < 2 && res.throttle) stuckT += dt; else stuckT = 0;
          if (stuckT > 1.2) { reverseT = 1.0; stuckT = 0; }
        }
      }
      var nitro = keys['shift'] && M.upgrades.nitro > 0;
      input.nitro = nitro;
      var engineBoost = 1 + M.upgrades.engine * 0.08;
      var savedMax = car.maxSpeed;
      car.maxSpeed = car.baseMax || car.maxSpeed;
      car.baseMax = car.maxSpeed;
      car.maxSpeed = savedMax * engineBoost;
      MV.entities.updateCar(car, dt, input);
      car.maxSpeed = savedMax;
      MV.audio.setEngine(Math.abs(car.speed) / car.maxSpeed, true);
      /* Ramp jumps. */
      for (var i = 0; i < worldData.ramps.length; i++) {
        var r = worldData.ramps[i];
        if (car.air === 0 && Math.abs(car.speed) > 20 && U.dist2(car.x, car.z, r.x, r.z) < 5) {
          car.vy = 9; car.air = 0.5;
          MV.ui.addFeed('STUNT JUMP!', '#ffd166');
          M.jumps++;
        }
      }
      return;
    }
    /* On foot. */
    var sp = keys['shift'] ? 9 : 5.5;
    var mx = 0, mz = 0;
    if (keys['w'] || keys['arrowup']) { mz += 1; }
    if (keys['s'] || keys['arrowdown']) { mz -= 1; }
    if (keys['a'] || keys['arrowleft']) { mx -= 1; }
    if (keys['d'] || keys['arrowright']) { mx += 1; }
    var camFwd = new THREE.Vector3();
    camera.getWorldDirection(camFwd);
    camFwd.y = 0; camFwd.normalize();
    var camRight = new THREE.Vector3().crossVectors(camFwd, new THREE.Vector3(0, 1, 0)).negate();
    var vx = camFwd.x * mz + camRight.x * mx;
    var vz = camFwd.z * mz + camRight.z * mx;
    var vl = Math.sqrt(vx * vx + vz * vz);
    if (vl > 0.01) {
      vx /= vl; vz /= vl;
      p.heading = U.angleLerp(p.heading, Math.atan2(vx, vz), dt * 10);
      p.x += vx * sp * dt;
      p.z += vz * sp * dt;
      p.walkPhase += dt * sp * 2;
      var sw = Math.sin(p.walkPhase) * 0.4;
      p.mesh.userData.legs[0].rotation.x = sw;
      p.mesh.userData.legs[1].rotation.x = -sw;
    }
    var corr = MV.entities.collideCircle(p.x, p.z, 0.6);
    p.x = corr.x; p.z = corr.z;
    p.mesh.position.set(p.x, 0, p.z);
    p.mesh.rotation.y = p.heading;
    MV.audio.setEngine(0, false);
  }

  function readDriveInput() {
    return {
      throttle: (keys['w'] || keys['arrowup']) ? 1 : 0,
      brake: (keys['s'] || keys['arrowdown']) ? 1 : 0,
      reverse: (keys['s'] || keys['arrowdown']) ? 1 : 0,
      steer: ((keys['a'] || keys['arrowleft']) ? -1 : 0) + ((keys['d'] || keys['arrowright']) ? 1 : 0),
      nitro: false
    };
  }

  function updateCamera(dt) {
    var p = MV.entities.player;
    var target = p.inCar ? p.inCar : p;
    var heading = p.inCar ? p.inCar.heading : p.heading;
    var speed = p.inCar ? Math.abs(p.inCar.speed) : 0;
    var dist = p.inCar ? 15 + speed * 0.05 : 7;
    var height = p.inCar ? 5.6 + speed * 0.02 : 3.2;
    var fx = Math.sin(heading), fz = Math.cos(heading);
    var dx = target.x - fx * dist, dz = target.z - fz * dist;
    camPos.x = U.lerp(camPos.x, dx, 1 - Math.pow(0.001, dt));
    camPos.y = U.lerp(camPos.y, height, 1 - Math.pow(0.01, dt));
    camPos.z = U.lerp(camPos.z, dz, 1 - Math.pow(0.001, dt));
    /* Never let the camera sit inside a building: push it out, and lift it. */
    var corr = MV.entities.collideCircle(camPos.x, camPos.z, 2.5);
    if (corr.x !== camPos.x || corr.z !== camPos.z) {
      camPos.x = corr.x; camPos.z = corr.z;
      camPos.y = Math.max(camPos.y, 7);
    }
    if (shake > 0) {
      shake = Math.max(0, shake - dt * 2);
      camPos.x += (Math.random() - 0.5) * shake * 0.6;
      camPos.y += (Math.random() - 0.5) * shake * 0.4;
    }
    camLook.set(target.x + fx * 8, 1.2, target.z + fz * 8);
    camera.position.copy(camPos);
    camera.lookAt(camLook);
    var targetFov = 62 + (speed / 52) * 13;
    if (Math.abs(camera.fov - targetFov) > 0.1) {
      camera.fov = U.lerp(camera.fov, targetFov, dt * 3);
      camera.updateProjectionMatrix();
    }
  }

  /* Snap the chase camera directly behind the target (used by shot setups). */
  function snapCamera() {
    var p = MV.entities.player;
    var target = p.inCar ? p.inCar : p;
    var heading = p.inCar ? p.inCar.heading : p.heading;
    var speed = p.inCar ? Math.abs(p.inCar.speed) : 0;
    var dist = p.inCar ? 15 + speed * 0.05 : 7;
    var height = p.inCar ? 5.6 + speed * 0.02 : 3.2;
    var fx = Math.sin(heading), fz = Math.cos(heading);
    camPos.set(target.x - fx * dist, height, target.z - fz * dist);
    var corr = MV.entities.collideCircle(camPos.x, camPos.z, 2.5);
    if (corr.x !== camPos.x || corr.z !== camPos.z) {
      camPos.x = corr.x; camPos.z = corr.z; camPos.y = Math.max(camPos.y, 7);
    }
    camLook.set(target.x + fx * 8, 1.2, target.z + fz * 8);
    camera.position.copy(camPos);
    camera.lookAt(camLook);
  }

  function updatePickups() {
    var M = MV.missions.state;
    var pos = playerPos();
    var cols = worldData.collectibles;
    for (var i = 0; i < cols.length; i++) {
      var c = cols[i];
      if (c.taken) continue;
      if (U.dist2(pos.x, pos.z, c.x, c.z) < 3.2) {
        c.taken = true;
        c.mesh.visible = false;
        M.collectibles++;
        M.cash += 50;
        var d = U.districtAt(pos.x, pos.z);
        M.standing[d.id] = Math.min(100, M.standing[d.id] + 2);
        MV.audio.pickup();
        MV.ui.addFeed('Prototype part recovered (' + M.collectibles + '/20) +$50', '#ffd166');
      }
    }
    /* Safehouses: restock + save. */
    for (var j = 0; j < worldData.safehouses.length; j++) {
      var s = worldData.safehouses[j];
      if (U.dist2(pos.x, pos.z, s.x, s.z) < 6) {
        if (!s._inside) {
          s._inside = true;
          var w = M.weapons;
          if (w.pistol.owned) w.pistol.ammo = Math.max(w.pistol.ammo, 60);
          if (w.smg.owned) w.smg.ammo = Math.max(w.smg.ammo, 120);
          if (w.shotgun.owned) w.shotgun.ammo = Math.max(w.shotgun.ammo, 24);
          if (w.rifle.owned) w.rifle.ammo = Math.max(w.rifle.ammo, 90);
          if (w.launcher.owned) w.launcher.ammo = Math.max(w.launcher.ammo, 6);
          quickSave();
          MV.ui.addFeed('Safehouse: ' + s.name + ' — game saved, ammo restocked.', '#7ee081');
        }
      } else s._inside = false;
    }
  }

  function updateBusted(dt) {
    var M = MV.missions.state;
    if (M.wanted <= 0) { bustedTimer = 0; return; }
    var p = MV.entities.player;
    if (p.inCar) { bustedTimer = 0; return; }
    var near = false;
    for (var i = 0; i < MV.entities.cops.length; i++) {
      var c = MV.entities.cops[i];
      if (c.dead || !c.onFoot) continue;
      if (U.dist2(p.x, p.z, c.x, c.z) < 2.6) { near = true; break; }
    }
    if (near) {
      bustedTimer += dt;
      if (bustedTimer > 2) {
        bustedTimer = 0;
        M.busted++;
        M.cash = Math.max(0, M.cash - 100);
        M.wanted = 0; M.heat = 0;
        onWantedChange(0);
        MV.missions.failMission(game());
        p.x = -250; p.z = 50; p.health = 100;
        p.mesh.position.set(p.x, 0, p.z);
        MV.ui.showBanner('BUSTED', 'The law caught up. -$100. The crew bails you out.', '#ff4040');
      }
    } else bustedTimer = Math.max(0, bustedTimer - dt);
  }

  function updateHeli(dt) {
    var M = MV.missions.state;
    if (M.wanted >= 4) {
      heli.visible = true;
      var pos = playerPos();
      var a = t * 0.25;
      heli.position.set(pos.x + Math.cos(a) * 42, 55, pos.z + Math.sin(a) * 42);
      heli.rotation.y = -a;
      heli.userData.rotor.rotation.y += dt * 22;
      heliLight.position.copy(heli.position);
      heliLight.target.position.set(pos.x, 0, pos.z);
      heliLight.intensity = 2.2;
    } else {
      heli.visible = false;
      heliLight.intensity = 0;
    }
  }

  function updateRoute() {
    var tgt = MV.missions.currentTarget(game());
    if (!tgt || tgt.radius >= 900) { MV.ui.setRoute([]); return; }
    var pos = playerPos();
    MV.ui.setRoute(U.routePoints(pos.x, pos.z, tgt.x, tgt.z));
  }

  function saveData() {
    var M = MV.missions.state;
    var p = MV.entities.player;
    return {
      cash: M.cash, day: M.day, clockMin: M.clockMin, completed: M.completed.slice(),
      standing: Object.assign({}, M.standing), collectibles: M.collectibles, jumps: M.jumps,
      fares: M.fares, jobsDone: M.jobsDone, racesWon: M.racesWon, weapons: JSON.parse(JSON.stringify(M.weapons)),
      upgrades: Object.assign({}, M.upgrades), x: p.x, z: p.z, current: M.current
    };
  }
  function quickSave() {
    try { localStorage.setItem('mv-save-v1', JSON.stringify(saveData())); } catch (e) {}
  }
  function loadSlot(idx) {
    try {
      var raw = localStorage.getItem('mv-save-v1');
      if (!raw) return false;
      var d = JSON.parse(raw);
      var M = MV.missions.state;
      M.cash = d.cash; M.day = d.day; M.clockMin = d.clockMin; M.completed = d.completed;
      M.standing = d.standing; M.collectibles = d.collectibles; M.jumps = d.jumps;
      M.fares = d.fares; M.jobsDone = d.jobsDone; M.racesWon = d.racesWon;
      M.weapons = d.weapons; M.upgrades = d.upgrades;
      var p = MV.entities.player;
      p.x = d.x; p.z = d.z;
      p.mesh.position.set(p.x, 0, p.z);
      return true;
    } catch (e) { return false; }
  }

  function game() {
    return {
      playerCar: playerCar, playerPos: playerPos, placePlayerCar: placePlayerCar,
      onWantedChange: onWantedChange, startGame: startGame
    };
  }

  function animate() {
    requestAnimationFrame(animate);
    var dt = Math.min(clock.getDelta(), 0.05) * timeScale;
    t += dt;
    totalFrames++;
    fpsFrames++; fpsTime += dt;
    if (fpsTime >= 1) { fps = Math.round(fpsFrames / fpsTime); fpsFrames = 0; fpsTime = 0; }
    MV.world.tick(dt, t);
    /* Substep the simulation so a large timeScale never tunnels through walls. */
    var steps = Math.max(1, Math.ceil(dt / 0.05));
    var sdt = dt / steps;
    for (var s = 0; s < steps; s++) tick(sdt);
    if (state === 'play') {
      updateCamera(dt);
      MV.ui.update(game());
    } else if (state === 'menu') {
      var a = t * 0.04;
      camera.position.set(Math.cos(a) * 280, 95, Math.sin(a) * 280);
      camera.lookAt(0, 12, -80);
      MV.ui.update(game());
    }
    if (!headless) renderer.render(scene, camera);
  }

  function tick(sdt) {
    if (state === 'play') {
      updatePlayer(sdt);
      MV.entities.updateTraffic(sdt, playerPos());
      MV.entities.updatePeds(sdt, t, playerPos());
      MV.entities.updateCops(sdt, playerPos(), MV.missions.state.wanted);
      MV.entities.separateCars();
      MV.entities.updateExplosions(sdt);
      MV.missions.update(sdt, game());
      updatePickups();
      updateBusted(sdt);
      updateHeli(sdt);
      updateRoute();
      updateTracers(sdt);
    } else if (state === 'menu') {
      MV.entities.updatePeds(sdt, t, null);
      MV.entities.updateTraffic(sdt, { x: 0, z: 0 });
    }
  }

  /* ---- Test hooks (used by the playtest harness + screenshot capture). ---- */
  function hooks() {
    return {
      ready: false, errors: errors,
      state: function () {
        var M = MV.missions.state;
        var p = MV.entities.player;
        var car = p.inCar;
        return {
          state: state, cash: M.cash, day: M.day, wanted: M.wanted,
          currentMission: M.current, stage: M.stageIdx, missionTime: M.missionTime,
          completed: M.completed.slice(), collectibles: M.collectibles, jumps: M.jumps,
          fares: M.fares, jobsDone: M.jobsDone, racesWon: M.racesWon,
          player: { x: +p.x.toFixed(1), z: +p.z.toFixed(1), health: p.health, inCar: !!car },
          car: car ? { x: +car.x.toFixed(1), z: +car.z.toFixed(1), speed: +car.speed.toFixed(1), kmh: Math.round(Math.abs(car.speed) * 3.6), heading: +car.heading.toFixed(2) } : null,
          race: M.race ? { playerLap: M.race.playerLap, playerWp: M.race.playerWp, playerFinished: M.race.playerFinished, rivalsFinished: M.race.rivals.filter(function (r) { return r.finished; }).length } : null,
          fps: fps, t: +t.toFixed(1)
        };
      },
      startGame: startGame,
      startMission: function (i) {
        var def = MV.missions.startMission(i, game());
        if (def) {
          MV.ui.showDialogue(MV.missions.CREW.filter(function (c) { return c.id === def.giver; })[0].name, def.dialogue[0]);
          MV.ui.addFeed('Mission started: ' + def.title, '#ffd166');
        }
        return !!def;
      },
      setAutopilot: function (on, route) {
        autopilot = !!on;
        autopilotRoute = route || null;
        if (autopilotRoute) autopilotRoute.idx = 0;
        if (!autopilot) { stuckT = 0; reverseT = 0; }
      },
      setTimeScale: function (s) { timeScale = Math.max(0.25, Math.min(8, s || 1)); },
      frames: function () { return totalFrames; },
      teleport: function (x, z) {
        var p = MV.entities.player;
        if (p.inCar) { p.inCar.x = x; p.inCar.z = z; p.inCar.speed = 0; }
        else { p.x = x; p.z = z; p.mesh.position.set(x, 0, z); }
      },
      placePlayerCar: placePlayerCar,
      fire: fireWeapon,
      auditTargets: MV.missions.auditTargets,
      setWanted: function (n) { MV.missions.state.wanted = n; MV.missions.state.heat = 100; onWantedChange(n); },
      addCash: function (n) { MV.missions.state.cash += n; },
      shot: function (n) { return setupShot(n); },
      save: quickSave,
      load: function () { return loadSlot(0); },
      saveData: saveData,
      setState: function (s) { state = s; },
      version: 'maravilla-r3c'
    };
  }

  function setupShot(n) {
    var p = MV.entities.player;
    if (n === 1) {
      /* Cover: luxury car on the palm boulevard, casino + marina behind. */
      var car = placePlayerCar(200, -140, Math.PI);
      car.speed = 12;
      MV.missions.state.cash = 12450;
      snapCamera();
      return true;
    }
    if (n === 2) {
      /* Drive: high speed on avenue 0, speedometer live. */
      var car2 = placePlayerCar(0, 240, Math.PI);
      car2.speed = 46;
      autopilot = true;
      autopilotRoute = [{ x: 0, z: 240 }, { x: 0, z: -350 }];
      autopilotRoute.idx = 0;
      snapCamera();
      return true;
    }
    if (n === 3) {
      /* Shootout: on foot, neon street, cops closing in, weapon out. */
      if (p.inCar) toggleCar();
      p.x = 50; p.z = -100; p.heading = Math.PI / 2;
      p.mesh.position.set(p.x, 0, p.z);
      MV.missions.state.selectedWeapon = 'pistol';
      MV.missions.state.wanted = 3;
      onWantedChange(3);
      for (var i = 0; i < MV.entities.cops.length; i++) {
        var c = MV.entities.cops[i];
        if (c.onFoot) { c.x = p.x + 8 + i * 3; c.z = p.z + 6; }
      }
      fireWeapon();
      snapCamera();
      return true;
    }
    if (n === 4) {
      /* Mission: Neon Run start line — player + 3 rivals, checkpoint beacon ahead. */
      MV.missions.startMission(4, game());
      snapCamera();
      return true;
    }
    return false;
  }

  return { init: init };
})();
