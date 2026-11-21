'use strict';
/* MARAVILLA — entities: player, cars, traffic, race rivals, peds, cops, physics, camera, explosions. */
var MV = window.MV || (window.MV = {});

MV.entities = (function () {
  var U = MV.util;
  var colliders = [];
  var cars = [];
  var peds = [];
  var cops = [];
  var explosions = [];
  var player = null;
  var sceneRef = null;
  var rng = U.mulberry32(4242);

  var CAR_COLORS = [0x8a1622, 0x1a5fb4, 0xd4af37, 0x2e8b57, 0xe8e8e8, 0x111111, 0xff6a00, 0x7a2ea6, 0x35d6ff, 0xc0c8d0];
  var LUX_COLORS = [0x2a0a2a, 0x0a1a3a, 0xd4af37, 0x8a1622, 0x101010];

  function collideCircle(x, z, r) {
    /* Circle vs building AABBs: push out position-only. Returns corrected {x,z}. */
    for (var i = 0; i < colliders.length; i++) {
      var c = colliders[i];
      var nx = U.clamp(x, c.x1, c.x2), nz = U.clamp(z, c.z1, c.z2);
      var dx = x - nx, dz = z - nz;
      var d2 = dx * dx + dz * dz;
      if (d2 < r * r) {
        if (d2 > 0.0001) {
          var d = Math.sqrt(d2);
          x = nx + (dx / d) * r; z = nz + (dz / d) * r;
        } else {
          /* Center inside box: push out along the smallest penetration axis. */
          var pl = x - c.x1, pr = c.x2 - x, pt = z - c.z1, pb = c.z2 - z;
          var m = Math.min(pl, pr, pt, pb);
          if (m === pl) x = c.x1 - r; else if (m === pr) x = c.x2 + r;
          else if (m === pt) z = c.z1 - r; else z = c.z2 + r;
        }
      }
    }
    x = U.clamp(x, -U.WORLD + 5, U.WORLD - 5);
    z = U.clamp(z, -U.WORLD + 5, U.WORLD - 5);
    return { x: x, z: z };
  }

  function makeCarMesh(color, luxury, isCop) {
    var g = new THREE.Group();
    var paint = new THREE.MeshPhysicalMaterial({
      color: color, metalness: 0.9, roughness: 0.16,
      clearcoat: 1, clearcoatRoughness: 0.08
    });
    var glass = new THREE.MeshPhysicalMaterial({ color: 0x0e1622, metalness: 0.9, roughness: 0.08, clearcoat: 1 });
    var chrome = new THREE.MeshStandardMaterial({ color: 0xd8d8d8, metalness: 1, roughness: 0.08 });
    var body = new THREE.Mesh(new THREE.BoxGeometry(2.1, 0.72, 4.7), paint);
    body.position.y = 0.62; body.castShadow = true;
    g.add(body);
    var nose = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.4, 0.8), paint);
    nose.position.set(0, 0.5, 2.5); nose.castShadow = true;
    g.add(nose);
    var cabin = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.62, 2.4), glass);
    cabin.position.set(0, 1.22, -0.3); cabin.castShadow = true;
    g.add(cabin);
    var trim = new THREE.Mesh(new THREE.BoxGeometry(2.14, 0.08, 4.72), chrome);
    trim.position.y = 0.98;
    g.add(trim);
    if (luxury) {
      var spoiler = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.08, 0.5), chrome);
      spoiler.position.set(0, 1.25, -2.35);
      g.add(spoiler);
      var skirt = new THREE.Mesh(new THREE.BoxGeometry(2.16, 0.22, 4.4),
        new THREE.MeshStandardMaterial({ color: 0x0a0a0a, metalness: 0.8, roughness: 0.3 }));
      skirt.position.y = 0.32;
      g.add(skirt);
    }
    if (isCop) {
      var bar = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.22, 0.5),
        new THREE.MeshStandardMaterial({ color: 0x111111, emissive: 0x2244ff, emissiveIntensity: 1.6 }));
      bar.position.set(0, 1.62, -0.3);
      g.add(bar);
      g.userData.lightBar = bar;
    }
    /* Wheels. */
    var wheelGeo = new THREE.CylinderGeometry(0.42, 0.42, 0.34, 12);
    var wheelMat = new THREE.MeshStandardMaterial({ color: 0x0c0c0c, roughness: 0.9 });
    var hubMat = new THREE.MeshStandardMaterial({ color: 0xc8c8c8, metalness: 1, roughness: 0.15 });
    var wheels = [];
    var wpos = [[-0.95, 1.55], [0.95, 1.55], [-0.95, -1.55], [0.95, -1.55]];
    for (var i = 0; i < 4; i++) {
      var wg = new THREE.Group();
      var tire = new THREE.Mesh(wheelGeo, wheelMat);
      tire.rotation.z = Math.PI / 2;
      tire.castShadow = true;
      wg.add(tire);
      var hub = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.36, 8), hubMat);
      hub.rotation.z = Math.PI / 2;
      wg.add(hub);
      wg.position.set(wpos[i][0], 0.42, wpos[i][1]);
      g.add(wg);
      wheels.push(wg);
    }
    /* Headlights + taillights with glow. */
    function lamp(color, x, z, s) {
      var m = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.2, 0.1),
        new THREE.MeshStandardMaterial({ color: 0x111111, emissive: color, emissiveIntensity: 3 }));
      m.position.set(x, 0.66, z);
      g.add(m);
      var sp = new THREE.Sprite(new THREE.SpriteMaterial({
        map: U.glowTexture(color === 0xfff2c0 ? 'rgba(255,242,192,1)' : 'rgba(255,40,60,1)'),
        transparent: true, blending: THREE.AdditiveBlending, depthWrite: false
      }));
      sp.scale.set(s, s, 1);
      sp.position.set(x, 0.66, z + (z > 0 ? 0.25 : -0.25));
      g.add(sp);
    }
    lamp(0xfff2c0, -0.7, 2.92, 2.6); lamp(0xfff2c0, 0.7, 2.92, 2.6);
    lamp(0xff283c, -0.7, -2.4, 2.0); lamp(0xff283c, 0.7, -2.4, 2.0);
    g.userData.wheels = wheels;
    return g;
  }

  function makePersonMesh(jacket, pants, skin) {
    var g = new THREE.Group();
    var jm = new THREE.MeshStandardMaterial({ color: jacket, roughness: 0.8 });
    var pm = new THREE.MeshStandardMaterial({ color: pants, roughness: 0.85 });
    var sm = new THREE.MeshStandardMaterial({ color: skin, roughness: 0.7 });
    var torso = new THREE.Mesh(new THREE.BoxGeometry(0.72, 0.9, 0.42), jm);
    torso.position.y = 1.25; torso.castShadow = true;
    g.add(torso);
    var head = new THREE.Mesh(new THREE.SphereGeometry(0.3, 10, 8), sm);
    head.position.y = 1.95; head.castShadow = true;
    g.add(head);
    var hair = new THREE.Mesh(new THREE.SphereGeometry(0.31, 10, 8, 0, Math.PI * 2, 0, 1.4),
      new THREE.MeshStandardMaterial({ color: 0x1a1210, roughness: 0.95 }));
    hair.position.y = 2.0;
    g.add(hair);
    var legL = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.85, 0.3), pm);
    legL.position.set(-0.2, 0.43, 0);
    g.add(legL);
    var legR = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.85, 0.3), pm);
    legR.position.set(0.2, 0.43, 0);
    g.add(legR);
    var armL = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.8, 0.24), jm);
    armL.position.set(-0.48, 1.25, 0);
    g.add(armL);
    var armR = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.8, 0.24), jm);
    armR.position.set(0.48, 1.25, 0);
    g.add(armR);
    g.userData.legs = [legL, legR]; g.userData.arms = [armL, armR];
    return g;
  }

  function createCar(opts) {
    var mesh = makeCarMesh(opts.color, !!opts.luxury, opts.type === 'cop');
    mesh.position.set(opts.x, 0, opts.z);
    mesh.rotation.y = opts.heading || 0;
    sceneRef.add(mesh);
    var car = {
      mesh: mesh, x: opts.x, z: opts.z, heading: opts.heading || 0,
      speed: 0, maxSpeed: opts.maxSpeed || 30, accel: opts.accel || 15,
      health: opts.health || 100, type: opts.type || 'traffic',
      color: opts.color, luxury: !!opts.luxury, vy: 0, air: 0,
      route: opts.route || null, routeIdx: 0, targetSpeed: 0,
      dead: false, nitro: opts.nitro || 0, isPlayerCar: false
    };
    cars.push(car);
    return car;
  }

  function removeCar(car) {
    var i = cars.indexOf(car);
    if (i >= 0) cars.splice(i, 1);
    sceneRef.remove(car.mesh);
  }

  /* Pure pursuit toward a waypoint list. Returns {throttle, steer, brake}. */
  function pursue(car, waypoints, idx, lookahead, maxSpeed) {
    var wp = waypoints[idx % waypoints.length];
    var dx = wp.x - car.x, dz = wp.z - car.z;
    var d = Math.sqrt(dx * dx + dz * dz);
    if (d < 6) return { next: (idx + 1) % waypoints.length, throttle: 1, steer: 0, brake: 0 };
    var targetAngle = Math.atan2(dx, dz);
    var diff = U.angleDiff(car.heading, targetAngle);
    var steer = U.clamp(diff * 1.8, -1, 1);
    var wantSpeed = maxSpeed;
    /* Speed while turning: a 90-degree turn on a 14-wide road needs a
       ~7-unit turn radius, i.e. ~9 u/s. At 12 u/s the radius is ~10 and
       the arc already clips the building block at the corner; at 23 u/s
       (the old 45% cap) the radius was ~23 and the car wedged against a
       building for seconds (race probe: stuck at (-108,78), speed 0.1). */
    if (Math.abs(diff) > 0.9) wantSpeed = 9;
    else if (Math.abs(diff) > 0.55) wantSpeed = 14;
    else if (Math.abs(diff) > 0.3) wantSpeed = 20;
    /* Corner look-ahead: if the route turns sharply AT this waypoint, brake
       down before it. A 90-degree turn on a 14-wide road needs ~12 u/s
       (turn radius ~10); at full speed the car overshoots into the block
       and wedges against a building — the exact failure the race probe
       showed (stuck at (-78.9,-127.8), speed ~1, for 18 s). */
    var n = waypoints.length;
    if (n >= 3) {
      var prev = waypoints[(idx - 1 + n) % n];
      var next = waypoints[(idx + 1) % n];
      var inAng = Math.atan2(wp.x - prev.x, wp.z - prev.z);
      var outAng = Math.atan2(next.x - wp.x, next.z - wp.z);
      var turn = Math.abs(U.angleDiff(inAng, outAng));
      if (turn > 0.5 && d < 50) {
        var cap = 10 + (d / 50) * 10;
        if (cap < wantSpeed) wantSpeed = cap;
      }
    }
    var throttle = car.speed < wantSpeed ? 1 : 0;
    var brake = car.speed > wantSpeed + 3 ? 1 : 0;
    return { next: idx, throttle: throttle, steer: steer, brake: brake };
  }

  function updateCar(car, dt, input) {
    if (car.dead) return;
    var steerMax = 0.55 + 1.35 / (1 + Math.abs(car.speed) * 0.09);
    if (input.steer) car.heading += input.steer * steerMax * dt * (car.speed >= 0 ? 1 : -1) * U.clamp(Math.abs(car.speed) / 6, 0, 1);
    if (input.throttle) car.speed += car.accel * dt * (input.nitro ? 1.7 : 1);
    if (input.brake) car.speed -= 34 * dt;
    if (input.reverse) car.speed -= 12 * dt;
    if (!input.throttle && !input.reverse) car.speed -= Math.sign(car.speed) * Math.min(Math.abs(car.speed), 8 * dt);
    car.speed = U.clamp(car.speed, -12, car.maxSpeed * (input.nitro ? 1.25 : 1));
    var fx = Math.sin(car.heading), fz = Math.cos(car.heading);
    car.x += fx * car.speed * dt;
    car.z += fz * car.speed * dt;
    /* Ramp jump. */
    if (car.air > 0) {
      car.vy -= 22 * dt;
      car.air += car.vy * dt;
      if (car.air <= 0) { car.air = 0; car.vy = 0; }
    }
    var corr = collideCircle(car.x, car.z, 2.3);
    if (corr.x !== car.x || corr.z !== car.z) {
      car.x = corr.x; car.z = corr.z;
      car.speed *= 0.55;
    }
    car.mesh.position.set(car.x, car.air, car.z);
    car.mesh.rotation.y = car.heading;
    var tilt = -input.steer * U.clamp(Math.abs(car.speed) / 40, 0, 1) * 0.06;
    car.mesh.rotation.z = tilt;
    car.mesh.rotation.x = input.throttle ? -0.02 : 0;
    var spin = car.speed * dt / 0.42;
    var wheels = car.mesh.userData.wheels;
    for (var i = 0; i < wheels.length; i++) wheels[i].rotation.x += spin;
  }

  function separateCars() {
    /* Position-only push-apart: never scale speeds per frame. */
    for (var i = 0; i < cars.length; i++) {
      for (var j = i + 1; j < cars.length; j++) {
        var a = cars[i], b = cars[j];
        if (a.dead || b.dead) continue;
        var dx = b.x - a.x, dz = b.z - a.z;
        var d2 = dx * dx + dz * dz;
        var min = 4.6;
        if (d2 < min * min && d2 > 0.0001) {
          var d = Math.sqrt(d2);
          var push = (min - d) / 2;
          var nx = dx / d, nz = dz / d;
          a.x -= nx * push; a.z -= nz * push;
          b.x += nx * push; b.z += nz * push;
        }
      }
    }
  }

  function explode(x, z, big) {
    var g = new THREE.Group();
    var flash = new THREE.Sprite(new THREE.SpriteMaterial({
      map: U.glowTexture('rgba(255,160,40,1)'), transparent: true,
      blending: THREE.AdditiveBlending, depthWrite: false
    }));
    flash.scale.set(big ? 26 : 14, big ? 26 : 14, 1);
    flash.position.set(x, 2, z);
    g.add(flash);
    sceneRef.add(g);
    var n = big ? 60 : 30;
    var pos = new Float32Array(n * 3);
    var vel = [];
    for (var i = 0; i < n; i++) {
      pos[i * 3] = x; pos[i * 3 + 1] = 1 + Math.random() * 2; pos[i * 3 + 2] = z;
      var a = Math.random() * Math.PI * 2, s = 4 + Math.random() * 14;
      vel.push([Math.cos(a) * s, 3 + Math.random() * 9, Math.sin(a) * s]);
    }
    var pg = new THREE.BufferGeometry();
    pg.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    var pts = new THREE.Points(pg, new THREE.PointsMaterial({
      color: 0xffa028, size: 0.9, transparent: true, opacity: 1, blending: THREE.AdditiveBlending, depthWrite: false
    }));
    sceneRef.add(pts);
    explosions.push({ group: g, pts: pts, vel: vel, life: 1.1, maxLife: 1.1 });
    MV.audio.explosion();
  }

  function updateExplosions(dt) {
    for (var i = explosions.length - 1; i >= 0; i--) {
      var e = explosions[i];
      e.life -= dt;
      var pos = e.pts.geometry.attributes.position;
      for (var j = 0; j < pos.count; j++) {
        pos.setX(j, pos.getX(j) + e.vel[j][0] * dt);
        pos.setY(j, Math.max(0.2, pos.getY(j) + e.vel[j][1] * dt));
        pos.setZ(j, pos.getZ(j) + e.vel[j][2] * dt);
        e.vel[j][1] -= 12 * dt;
      }
      pos.needsUpdate = true;
      e.pts.material.opacity = Math.max(0, e.life / e.maxLife);
      e.group.children[0].scale.setScalar(Math.max(0.1, 14 * (e.life / e.maxLife) + 4));
      if (e.life <= 0) {
        sceneRef.remove(e.group); sceneRef.remove(e.pts);
        explosions.splice(i, 1);
      }
    }
  }

  function spawnPeds(scene, count) {
    var jackets = [0x8a1622, 0x1a5fb4, 0xd4af37, 0x2e8b57, 0x7a2ea6, 0xe8e8e8, 0x333333, 0xff6a00];
    var skins = [0xc9a186, 0x8a5a3b, 0xe8b98a, 0x6a3a22];
    for (var i = 0; i < count; i++) {
      var x = (rng() * 2 - 1) * 380, z = (rng() * 2 - 1) * 380;
      var rp = U.nearestRoadPoint(x, z);
      var mesh = makePersonMesh(jackets[i % jackets.length], 0x22242e, skins[i % skins.length]);
      mesh.position.set(rp.x + 9, 0, rp.z);
      scene.add(mesh);
      peds.push({
        mesh: mesh, x: rp.x + 9, z: rp.z, heading: rng() * Math.PI * 2,
        speed: 1 + rng() * 1.2, walkPhase: rng() * 6, fleeing: false,
        target: null
      });
    }
  }

  function updatePeds(dt, t, threat) {
    for (var i = 0; i < peds.length; i++) {
      var p = peds[i];
      if (!p.target || U.dist2(p.x, p.z, p.target.x, p.target.z) < 4) {
        var rp = U.nearestRoadPoint(p.x + (rng() - 0.5) * 120, p.z + (rng() - 0.5) * 120);
        p.target = { x: rp.x + (rng() < 0.5 ? 9 : -9), z: rp.z };
      }
      var dx = p.target.x - p.x, dz = p.target.z - p.z;
      var d = Math.sqrt(dx * dx + dz * dz) || 1;
      var sp = p.speed * (p.fleeing ? 3.2 : 1);
      p.heading = U.angleLerp(p.heading, Math.atan2(dx, dz), dt * 4);
      p.x += Math.sin(p.heading) * sp * dt;
      p.z += Math.cos(p.heading) * sp * dt;
      var corr = collideCircle(p.x, p.z, 0.6);
      p.x = corr.x; p.z = corr.z;
      p.mesh.position.set(p.x, 0, p.z);
      p.mesh.rotation.y = p.heading;
      p.walkPhase += dt * sp * 3;
      var sw = Math.sin(p.walkPhase) * 0.35;
      p.mesh.userData.legs[0].rotation.x = sw;
      p.mesh.userData.legs[1].rotation.x = -sw;
      p.mesh.userData.arms[0].rotation.x = -sw * 0.7;
      p.mesh.userData.arms[1].rotation.x = sw * 0.7;
      if (threat) {
        var td = U.dist2(p.x, p.z, threat.x, threat.z);
        p.fleeing = td < 26;
      }
    }
  }

  function spawnCop(scene, x, z, inCar) {
    var cop;
    if (inCar) {
      cop = createCar({ x: x, z: z, heading: 0, color: 0x0e1a2e, type: 'cop', maxSpeed: 44, accel: 17 });
      cop.isCop = true;
    } else {
      var mesh = makePersonMesh(0x0e1a2e, 0x0e1a2e, 0xc9a186);
      mesh.position.set(x, 0, z);
      scene.add(mesh);
      cop = { mesh: mesh, x: x, z: z, heading: 0, speed: 0, onFoot: true, dead: false };
      cops.push(cop);
      return cop;
    }
    cops.push(cop);
    return cop;
  }

  function updateCops(dt, target, wanted) {
    for (var i = cops.length - 1; i >= 0; i--) {
      var c = cops[i];
      if (c.dead) continue;
      if (c.onFoot) {
        var dx = target.x - c.x, dz = target.z - c.z;
        var d = Math.sqrt(dx * dx + dz * dz) || 1;
        var sp = wanted >= 3 ? 7.5 : 6;
        c.heading = U.angleLerp(c.heading, Math.atan2(dx, dz), dt * 5);
        c.x += Math.sin(c.heading) * sp * dt;
        c.z += Math.cos(c.heading) * sp * dt;
        var corr = collideCircle(c.x, c.z, 0.6);
        c.x = corr.x; c.z = corr.z;
        c.mesh.position.set(c.x, 0, c.z);
        c.mesh.rotation.y = c.heading;
        c.speed = sp;
      } else {
        /* Patrol car: pursue the target. */
        var res = pursue(c, [{ x: target.x, z: target.z }], 0, 10, 44);
        updateCar(c, dt, { throttle: res.throttle, steer: res.steer, brake: res.brake, nitro: false, reverse: false });
      }
    }
  }

  function init(scene, cols) {
    sceneRef = scene;
    colliders = cols;
    player = {
      mesh: makePersonMesh(0x8a1622, 0x22242e, 0xc9a186),
      x: 0, z: 120, heading: Math.PI, speed: 0,
      health: 100, armour: 50, inCar: null, onFoot: true, walkPhase: 0
    };
    player.mesh.position.set(0, 0, 120);
    scene.add(player.mesh);
    spawnPeds(scene, 70);
    /* Parked cars around the city (stealable). */
    var parked = [
      [6, 108, 0x1a5fb4, false], [-6, 140, 0xd4af37, true], [106, -56, 0x2a0a2a, true],
      [-106, 44, 0xe8e8e8, false], [206, 96, 0x8a1622, true], [-206, -96, 0x111111, false],
      [56, -106, 0xff6a00, false], [-56, 206, 0x7a2ea6, true], [306, -56, 0x0a1a3a, true],
      [96, 306, 0x2e8b57, false], [100, -50, 0x8a8f96, false]
    ];
    for (var i = 0; i < parked.length; i++) {
      var pk = parked[i];
      var car = createCar({ x: pk[0], z: pk[1], heading: (i % 2 ? 0 : Math.PI / 2), color: pk[2], luxury: pk[3], type: 'parked', maxSpeed: 40, accel: 14 });
      car.parked = true;
    }
    /* Traffic. */
    var routes = [];
    for (var r = 0; r < 4; r++) {
      var ax = U.AVENUES[1 + r], az = U.STREETS[1 + r];
      routes.push([{ x: ax, z: -350 }, { x: ax, z: 350 }]);
      routes.push([{ x: -350, z: az }, { x: 350, z: az }]);
    }
    for (var t = 0; t < 20; t++) {
      var rt = routes[t % routes.length];
      var sx = rt[0].x + (rng() - 0.5) * 4, sz = rt[0].z + rng() * 700;
      if (rt[0].x === rt[1].x) sz = -350 + rng() * 700; else sx = -350 + rng() * 700;
      var tc = createCar({
        x: sx, z: sz, heading: rng() * Math.PI * 2,
        color: CAR_COLORS[t % CAR_COLORS.length], type: 'traffic',
        maxSpeed: 11 + rng() * 6, accel: 10, route: rt, routeIdx: 0
      });
      tc.targetSpeed = tc.maxSpeed;
    }
    return player;
  }

  var raceActive = false;
  /* The Neon Run course: the rectangle on avenues/streets ±100. */
  function onRaceCourse(x, z) {
    var ax = Math.abs(x), az = Math.abs(z);
    if (ax >= 92 && ax <= 108 && az <= 108) return true;
    if (az >= 92 && az <= 108 && ax <= 108) return true;
    return false;
  }
  function offCourseRoadPoint(cx, cz, spread) {
    for (var i = 0; i < 10; i++) {
      var rp = U.nearestRoadPoint(cx + (rng() - 0.5) * spread, cz + (rng() - 0.5) * spread);
      if (!onRaceCourse(rp.x, rp.z)) return rp;
    }
    return null;
  }
  function setRaceActive(on) { raceActive = !!on; }
  function clearRaceCourse() {
    /* Move every traffic car off the race course so the race is decided by
       driving, not by getting stuck behind a 12 u/s taxi on the racing line. */
    for (var i = 0; i < cars.length; i++) {
      var c = cars[i];
      if (c.type !== 'traffic' || c.dead) continue;
      if (onRaceCourse(c.x, c.z)) {
        var rp = offCourseRoadPoint(c.x, c.z, 400);
        if (rp) { c.x = rp.x; c.z = rp.z; c.route = U.routePoints(rp.x, rp.z, rp.x + 150, rp.z); c.routeIdx = 0; }
      }
    }
  }

  function updateTraffic(dt, focus) {
    for (var i = 0; i < cars.length; i++) {
      var c = cars[i];
      if (c.type !== 'traffic' || c.dead) continue;
      /* During a race, keep the course clear the whole time — a slow
         car wandering onto the racing line decides the race by luck. */
      if (raceActive && onRaceCourse(c.x, c.z)) {
        var rp2 = offCourseRoadPoint(c.x, c.z, 400);
        if (rp2) { c.x = rp2.x; c.z = rp2.z; c.route = U.routePoints(rp2.x, rp2.z, rp2.x + 150, rp2.z); c.routeIdx = 0; }
        continue;
      }
      var res = pursue(c, c.route, c.routeIdx, 12, c.maxSpeed);
      c.routeIdx = res.next;
      updateCar(c, dt, { throttle: res.throttle, steer: res.steer, brake: res.brake, nitro: false, reverse: false });
      /* Keep traffic near the action: respawn far cars closer. */
      if (focus && U.dist2(c.x, c.z, focus.x, focus.z) > 320) {
        var rp = U.nearestRoadPoint(focus.x + (rng() - 0.5) * 200, focus.z + (rng() - 0.5) * 200);
        if (raceActive) {
          var alt = offCourseRoadPoint(focus.x, focus.z, 200);
          if (alt) rp = alt;
        }
        c.x = rp.x; c.z = rp.z;
      }
    }
  }

  return {
    init: init, createCar: createCar, removeCar: removeCar, updateCar: updateCar,
    pursue: pursue, separateCars: separateCars, collideCircle: collideCircle,
    explode: explode, updateExplosions: updateExplosions,
    updatePeds: updatePeds, spawnCop: spawnCop, updateCops: updateCops,
    updateTraffic: updateTraffic, makeCarMesh: makeCarMesh, makePersonMesh: makePersonMesh,
    setRaceActive: setRaceActive, clearRaceCourse: clearRaceCourse,
    get cars() { return cars; }, get peds() { return peds; }, get cops() { return cops; },
    get player() { return player; }, CAR_COLORS: CAR_COLORS, LUX_COLORS: LUX_COLORS
  };
})();
