'use strict';
/* MARAVILLA — city, districts, marina, casino, fountain plaza. Procedural, offline, premium dusk look. */
var MV = window.MV || (window.MV = {});

MV.world = (function () {
  var U = MV.util;
  var colliders = [];
  var collectibles = [];
  var ramps = [];
  var safehouses = [];
  var animated = { water: [], fountainPts: null, neon: [], yachts: [], trafficLights: [] };
  var marinaBasin = { x1: 320, z1: -410, x2: 410, z2: -320 };

  var rng = U.mulberry32(20261121);

  function box(w, h, d, mat, x, y, z, castShadow) {
    var m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    m.position.set(x, y, z);
    m.castShadow = !!castShadow;
    m.receiveShadow = true;
    return m;
  }
  function addCollider(x1, z1, x2, z2) { colliders.push({ x1: x1, z1: z1, x2: x2, z2: z2 }); }

  function roadTexture() {
    var c = U.makeCanvas(128, 512, function (g, w, h) {
      g.fillStyle = '#15161d'; g.fillRect(0, 0, w, h);
      for (var i = 0; i < 500; i++) {
        g.fillStyle = 'rgba(255,255,255,' + (Math.random() * 0.03) + ')';
        g.fillRect(Math.random() * w, Math.random() * h, 2, 2);
      }
      g.fillStyle = 'rgba(230,230,230,0.85)';
      g.fillRect(4, 0, 3, h); g.fillRect(w - 7, 0, 3, h);
      g.fillStyle = 'rgba(255,196,80,0.9)';
      for (var y = 0; y < h; y += 64) g.fillRect(w / 2 - 2, y + 8, 4, 34);
    });
    var t = new THREE.CanvasTexture(c);
    t.wrapS = THREE.RepeatWrapping; t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(1, 7);
    t.anisotropy = 4;
    return t;
  }

  function buildSky(scene) {
    var geo = new THREE.SphereGeometry(950, 24, 16);
    var mat = new THREE.ShaderMaterial({
      side: THREE.BackSide, depthWrite: false, fog: false,
      uniforms: {
        top: { value: new THREE.Color(0x120e33) },
        mid: { value: new THREE.Color(0x8a2f6e) },
        bot: { value: new THREE.Color(0xff8a3d) }
      },
      vertexShader: 'varying vec3 vP; void main(){ vP = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
      fragmentShader: 'varying vec3 vP; uniform vec3 top; uniform vec3 mid; uniform vec3 bot;' +
        'void main(){ float h = normalize(vP).y; vec3 c = h > 0.25 ? mix(mid, top, smoothstep(0.25, 0.8, h)) : mix(bot, mid, smoothstep(-0.05, 0.25, h));' +
        ' gl_FragColor = vec4(c, 1.0); }'
    });
    scene.add(new THREE.Mesh(geo, mat));
    /* Sun disc low on the western horizon. */
    var sunTex = U.glowTexture('rgba(255,150,60,1)');
    var sun = new THREE.Sprite(new THREE.SpriteMaterial({ map: sunTex, color: 0xffb36b, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, fog: false }));
    sun.position.set(-880, 60, -120); sun.scale.set(320, 320, 1);
    scene.add(sun);
    /* Stars up high. */
    var n = 420, pos = new Float32Array(n * 3);
    for (var i = 0; i < n; i++) {
      var a = rng() * Math.PI * 2, e = 0.35 + rng() * 1.1, r = 900;
      pos[i * 3] = Math.cos(a) * Math.cos(e) * r;
      pos[i * 3 + 1] = Math.sin(e) * r;
      pos[i * 3 + 2] = Math.sin(a) * Math.cos(e) * r;
    }
    var sg = new THREE.BufferGeometry();
    sg.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    scene.add(new THREE.Points(sg, new THREE.PointsMaterial({ color: 0xcdd8ff, size: 2.2, sizeAttenuation: false, fog: false, transparent: true, opacity: 0.8 })));
  }

  function buildLights(scene) {
    var hemi = new THREE.HemisphereLight(0x7a5cff, 0x2a1e2e, 0.55);
    scene.add(hemi);
    var sun = new THREE.DirectionalLight(0xff9a3c, 1.5);
    sun.position.set(-320, 190, -140);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.camera.left = -450; sun.shadow.camera.right = 450;
    sun.shadow.camera.top = 450; sun.shadow.camera.bottom = -450;
    sun.shadow.camera.far = 1200; sun.shadow.bias = -0.0006;
    scene.add(sun);
    var amb = new THREE.AmbientLight(0x402a55, 0.5);
    scene.add(amb);
    function point(color, x, y, z, intensity, dist) {
      var p = new THREE.PointLight(color, intensity, dist, 1.6);
      p.position.set(x, y, z);
      scene.add(p);
      return p;
    }
    point(0xff2e88, 250, 40, -250, 1.4, 260);   /* casino magenta */
    point(0xffc46b, 150, 14, -250, 1.1, 180);   /* fountain gold */
    point(0x35d6ff, 365, 16, -365, 1.0, 220);   /* marina cyan */
    point(0xc98cff, 0, 30, 0, 1.0, 300);        /* downtown plaza violet */
    point(0xff9a5c, -250, 12, 250, 0.8, 200);   /* old town warm */
  }

  function buildGround(scene) {
    var ground = new THREE.Mesh(new THREE.PlaneGeometry(1100, 1100),
      new THREE.MeshStandardMaterial({ color: 0x232733, roughness: 0.9, metalness: 0.05 }));
    ground.rotation.x = -Math.PI / 2; ground.position.y = -0.05;
    ground.receiveShadow = true;
    scene.add(ground);
    /* District tint washes. */
    var tints = [
      [0x2a2a4a, 0, 0, 300, 300], [0x3a2f1e, 250, -250, 220, 220],
      [0x1e3324, -250, -250, 220, 220], [0x33241a, -250, 250, 220, 220],
      [0x242a30, 250, 250, 220, 220]
    ];
    for (var i = 0; i < tints.length; i++) {
      var t = tints[i];
      var p = new THREE.Mesh(new THREE.PlaneGeometry(t[3], t[4]),
        new THREE.MeshStandardMaterial({ color: t[0], roughness: 1 }));
      p.rotation.x = -Math.PI / 2; p.position.set(t[1], 0, t[2]);
      p.receiveShadow = true;
      scene.add(p);
    }
    /* Beach sand + sea. */
    var sand = new THREE.Mesh(new THREE.PlaneGeometry(900, 110),
      new THREE.MeshStandardMaterial({ color: 0x8a7a5c, roughness: 1 }));
    sand.rotation.x = -Math.PI / 2; sand.position.set(0, 0.02, 355);
    sand.receiveShadow = true;
    scene.add(sand);
    var seaTex = U.waterTexture();
    var sea = new THREE.Mesh(new THREE.PlaneGeometry(900, 30),
      new THREE.MeshStandardMaterial({ color: 0x0e6a7a, roughness: 0.12, metalness: 0.85, map: seaTex }));
    sea.rotation.x = -Math.PI / 2; sea.position.set(0, 0.06, 415);
    scene.add(sea);
    animated.water.push(sea.material);
  }

  function buildRoads(scene) {
    var rt = roadTexture();
    var mat = new THREE.MeshStandardMaterial({ map: rt, roughness: 0.32, metalness: 0.45, color: 0xffffff });
    var swMat = new THREE.MeshStandardMaterial({ color: 0x33394d, roughness: 0.95 });
    var i, r;
    for (i = 0; i < U.AVENUES.length; i++) {
      var x = U.AVENUES[i];
      r = new THREE.Mesh(new THREE.PlaneGeometry(14, 850), mat);
      r.rotation.x = -Math.PI / 2; r.rotation.z = Math.PI / 2;
      r.position.set(x, 0.02, 0); r.receiveShadow = true;
      scene.add(r);
      for (var s = -1; s <= 1; s += 2) {
        var sw = new THREE.Mesh(new THREE.PlaneGeometry(4, 850), swMat);
        sw.rotation.x = -Math.PI / 2; sw.position.set(x + s * 9, 0.05, 0);
        sw.receiveShadow = true; scene.add(sw);
      }
    }
    for (i = 0; i < U.STREETS.length; i++) {
      var z = U.STREETS[i];
      r = new THREE.Mesh(new THREE.PlaneGeometry(14, 850), mat);
      r.rotation.x = -Math.PI / 2;
      r.position.set(0, 0.025, z); r.receiveShadow = true;
      scene.add(r);
      for (var s2 = -1; s2 <= 1; s2 += 2) {
        var sw2 = new THREE.Mesh(new THREE.PlaneGeometry(850, 4), swMat);
        sw2.rotation.x = -Math.PI / 2; sw2.position.set(0, 0.055, z + s2 * 9);
        sw2.receiveShadow = true; scene.add(sw2);
      }
    }
    /* Wet reflection streaks under lamps: fake neon bounce on asphalt. */
    var streakCols = [0xff9a3c, 0xff2e88, 0x35d6ff, 0xffc46b];
    for (i = 0; i < 46; i++) {
      var onAve = rng() < 0.5;
      var px = onAve ? U.AVENUES[Math.floor(rng() * U.AVENUES.length)] + (rng() - 0.5) * 6 : (rng() * 2 - 1) * 380;
      var pz = onAve ? (rng() * 2 - 1) * 380 : U.STREETS[Math.floor(rng() * U.STREETS.length)] + (rng() - 0.5) * 6;
      var col = streakCols[Math.floor(rng() * streakCols.length)];
      var sm = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 9 + rng() * 8),
        new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.10 + rng() * 0.08, blending: THREE.AdditiveBlending, depthWrite: false }));
      sm.rotation.x = -Math.PI / 2;
      sm.rotation.z = onAve ? 0 : Math.PI / 2;
      sm.position.set(px, 0.04, pz);
      scene.add(sm);
    }
  }

  function glowSprite(color, scale) {
    var s = new THREE.Sprite(new THREE.SpriteMaterial({
      map: U.glowTexture(color), color: 0xffffff, transparent: true,
      blending: THREE.AdditiveBlending, depthWrite: false
    }));
    s.scale.set(scale, scale, 1);
    return s;
  }

  function makeLamp(scene, x, z) {
    var g = new THREE.Group();
    var pole = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.18, 7, 6),
      new THREE.MeshStandardMaterial({ color: 0x1c1e26, roughness: 0.5, metalness: 0.7 }));
    pole.position.y = 3.5; pole.castShadow = true;
    g.add(pole);
    var head = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.3, 0.5),
      new THREE.MeshStandardMaterial({ color: 0x111111, emissive: 0xffc46b, emissiveIntensity: 2.2 }));
    head.position.set(0.5, 7, 0);
    g.add(head);
    var gl = glowSprite('rgba(255,196,110,1)', 7);
    gl.position.set(0.5, 6.8, 0);
    g.add(gl);
    g.position.set(x, 0, z);
    scene.add(g);
  }

  function makePalm(scene, x, z, s) {
    var g = new THREE.Group();
    var trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.22 * s, 0.34 * s, 7 * s, 7),
      new THREE.MeshStandardMaterial({ color: 0x6b4a2f, roughness: 0.9 }));
    trunk.position.y = 3.5 * s; trunk.castShadow = true;
    g.add(trunk);
    var frondMat = new THREE.MeshStandardMaterial({ color: 0x2e8b57, roughness: 0.8, side: THREE.DoubleSide });
    for (var i = 0; i < 6; i++) {
      var f = new THREE.Mesh(new THREE.ConeGeometry(0.9 * s, 4.4 * s, 4), frondMat);
      var a = (i / 6) * Math.PI * 2;
      f.position.set(Math.cos(a) * 1.5 * s, 7.2 * s, Math.sin(a) * 1.5 * s);
      f.rotation.z = Math.cos(a) * 1.15;
      f.rotation.x = -Math.sin(a) * 1.15;
      f.scale.set(1, 1, 0.22);
      f.castShadow = true;
      g.add(f);
    }
    g.position.set(x, 0, z);
    scene.add(g);
  }

  function neonSign(scene, text, color, w, x, y, z, ry) {
    var tex = U.neonTexture(text, color);
    var m = new THREE.Mesh(new THREE.PlaneGeometry(w, w / 4),
      new THREE.MeshBasicMaterial({ map: tex, transparent: true, side: THREE.DoubleSide }));
    m.position.set(x, y, z); m.rotation.y = ry || 0;
    scene.add(m);
    var gl = glowSprite(color, w * 1.4);
    gl.position.set(x, y, z);
    scene.add(gl);
    animated.neon.push(m.material);
    return m;
  }

  function buildBuildings(scene) {
    var blocks = [-250, -150, -50, 50, 150, 250];
    var roofMat = new THREE.MeshStandardMaterial({ color: 0x2a2e3a, roughness: 0.9 });
    var glassMat = new THREE.MeshPhysicalMaterial({ color: 0x2e4a72, metalness: 0.9, roughness: 0.08, clearcoat: 1, clearcoatRoughness: 0.06 });
    for (var bi = 0; bi < blocks.length; bi++) {
      for (var bj = 0; bj < blocks.length; bj++) {
        var cx = blocks[bi], cz = blocks[bj];
        var d = U.districtAt(cx, cz);
        if (cx === 250 && cz === -250) continue; /* casino */
        if (cx === 150 && cz === -250) continue; /* fountain plaza */
        var n, hMin, hMax, palette;
        if (d.id === 'downtown') { n = 2; hMin = 55; hMax = 115; palette = ['#161d2c', '#1d1626', '#121e24']; }
        else if (d.id === 'velvet') { n = 2; hMin = 34; hMax = 72; palette = ['#1d2638', '#261f33', '#16242e']; }
        else if (d.id === 'hills') { n = 3; hMin = 8; hMax = 15; palette = ['#33261d', '#2a1f1c', '#1f261f']; }
        else if (d.id === 'oldtown') { n = 3; hMin = 12; hMax = 26; palette = ['#2a211a', '#211d24', '#241a14']; }
        else if (d.id === 'industrial') { n = 2; hMin = 13; hMax = 22; palette = ['#1e2126', '#241f1c', '#1a1d20']; }
        else { n = 2; hMin = 9; hMax = 17; palette = ['#20242e', '#28222c', '#182428']; }
        for (var k = 0; k < n; k++) {
          var w = 22 + rng() * 22, dep = 22 + rng() * 22;
          var h = hMin + rng() * (hMax - hMin);
          var ox = (rng() - 0.5) * (86 - w - 8), oz = (rng() - 0.5) * (86 - dep - 8);
          var bx = cx + ox, bz = cz + oz;
          var base = palette[Math.floor(rng() * palette.length)];
          var lit = d.id === 'velvet' || d.id === 'downtown' ? 0.55 : 0.4;
          var tex = U.facadeTexture(rng, base, lit, Math.max(6, Math.floor(h / 3.2)), Math.max(4, Math.floor(w / 2.6)));
          var side = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.55, metalness: 0.25, emissive: 0xffffff, emissiveMap: tex, emissiveIntensity: 0.55, envMapIntensity: 0.35 });
          var mats = [side, side, roofMat, roofMat, side, side];
          var b = new THREE.Mesh(new THREE.BoxGeometry(w, h, dep), mats);
          b.position.set(bx, h / 2, bz);
          b.castShadow = true; b.receiveShadow = true;
          scene.add(b);
          addCollider(bx - w / 2 - 1, bz - dep / 2 - 1, bx + w / 2 + 1, bz + dep / 2 + 1);
          /* Roof props. */
          if (rng() < 0.6) {
            var ac = box(4, 1.6, 4, roofMat, bx + (rng() - 0.5) * w * 0.4, h + 0.8, bz + (rng() - 0.5) * dep * 0.4, false);
            scene.add(ac);
          }
          if (h > 50 && rng() < 0.5) {
            var ant = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 9, 5),
              new THREE.MeshStandardMaterial({ color: 0x888888, metalness: 0.9, roughness: 0.3 }));
            ant.position.set(bx, h + 4.5, bz);
            scene.add(ant);
            var tip = glowSprite('rgba(255,60,80,1)', 3);
            tip.position.set(bx, h + 9, bz);
            scene.add(tip);
          }
          /* Glass crown on velvet towers. */
          if (d.id === 'velvet' && rng() < 0.5) {
            var crown = box(w * 0.7, 2.2, dep * 0.7, glassMat, bx, h + 1.1, bz, false);
            scene.add(crown);
          }
        }
      }
    }
    /* Neon signs on downtown + velvet faces. */
    var signs = [
      ['VELVET', '#ff2e88', 150, 26, -149, 0], ['NEON 99', '#35d6ff', 50, 34, -149, 0],
      ['HOTEL LUNA', '#ffc46b', -50, 22, -149, 0], ['PIER 9', '#5cd6ff', 250, 18, -149, 0],
      ['BAR MARAVILLA', '#ff9a5c', -150, 16, -149, 0], ['24H GARAGE', '#7ee081', 100, 14, 149, Math.PI],
      ['CASINO', '#ff2e88', 210, 30, -150, Math.PI / 2], ['LUXE', '#ffd166', 150, 40, -190, Math.PI / 2]
    ];
    for (var s = 0; s < signs.length; s++) {
      var sg = signs[s];
      neonSign(scene, sg[0], sg[1], 26, sg[2], sg[3], sg[4], sg[5]);
    }
    /* Billboards. */
    var ads = [
      [['MARAVILLA', 'ONE LAST SCORE'], '#2a0a3a', '#ff2e88', '#ffd166', 0, 40, -250],
      [['VELVET BAY', 'LIVE LUXURY'], '#0a2a3a', '#35d6ff', '#ffffff', 250, 30, 50],
      [['GRAND CASINO', 'WIN BIG TONIGHT'], '#3a1a0a', '#ff9a3c', '#ffd166', -250, 26, -50],
      [['NEON 99 FM', 'THE CITY NEVER SLEEPS'], '#1a0a2a', '#c98cff', '#ffffff', 50, 34, 250]
    ];
    for (var a = 0; a < ads.length; a++) {
      var ad = ads[a];
      var tex = U.adTexture(ad[0], ad[1], ad[2], ad[3]);
      var pole = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.6, 16, 6),
        new THREE.MeshStandardMaterial({ color: 0x222222, roughness: 0.6, metalness: 0.6 }));
      pole.position.set(ad[4], 8, ad[5]); scene.add(pole);
      var board = new THREE.Mesh(new THREE.PlaneGeometry(26, 13),
        new THREE.MeshStandardMaterial({ map: tex, emissive: 0xffffff, emissiveMap: tex, emissiveIntensity: 0.7, side: THREE.DoubleSide }));
      board.position.set(ad[4], 24, ad[5]);
      board.rotation.y = rng() * Math.PI;
      scene.add(board);
      var bgl = glowSprite('rgba(255,255,255,1)', 20);
      bgl.position.copy(board.position);
      scene.add(bgl);
    }
  }

  function buildCasino(scene) {
    var g = new THREE.Group();
    var glass = new THREE.MeshPhysicalMaterial({ color: 0x2e4a72, metalness: 0.92, roughness: 0.07, clearcoat: 1, clearcoatRoughness: 0.05 });
    var gold = new THREE.MeshStandardMaterial({ color: 0xd4af37, metalness: 1, roughness: 0.18, emissive: 0x664411, emissiveIntensity: 0.4 });
    var tower = box(34, 92, 34, glass, 0, 46, 0, true);
    g.add(tower);
    var trim1 = box(36, 2, 36, gold, 0, 30, 0, false);
    g.add(trim1);
    var trim2 = box(36, 2, 36, gold, 0, 62, 0, false);
    g.add(trim2);
    /* Neon crown. */
    var crownMat = new THREE.MeshStandardMaterial({ color: 0x1a0a22, emissive: 0xff2e88, emissiveIntensity: 2.4 });
    var crown = box(38, 3.4, 38, crownMat, 0, 93.5, 0, false);
    g.add(crown);
    var crownTop = box(30, 2, 30, new THREE.MeshStandardMaterial({ color: 0x111111, emissive: 0xffc46b, emissiveIntensity: 1.8 }), 0, 96.5, 0, false);
    g.add(crownTop);
    /* Entrance canopy + valet. */
    var canopy = box(20, 1.2, 10, gold, 0, 6, 20, false);
    g.add(canopy);
    var door = box(10, 8, 1, new THREE.MeshStandardMaterial({ color: 0x0a0a12, roughness: 0.1, metalness: 0.8, emissive: 0xffc46b, emissiveIntensity: 0.5 }), 0, 4, 17.2, false);
    g.add(door);
    g.position.set(250, 0, -250);
    scene.add(g);
    addCollider(250 - 20, -250 - 20, 250 + 20, -250 + 20);
    neonSign(scene, 'GRAND MARAVILLA', '#ff2e88', 34, 250, 78, -231, 0);
    neonSign(scene, 'CASINO', '#ffd166', 22, 250, 60, -231, 0);
  }

  function buildMarina(scene) {
    var b = marinaBasin;
    var waterTex = U.waterTexture();
    var water = new THREE.Mesh(new THREE.PlaneGeometry(b.x2 - b.x1, b.z2 - b.z1),
      new THREE.MeshStandardMaterial({ color: 0x0e7a8a, roughness: 0.1, metalness: 0.85, map: waterTex }));
    water.rotation.x = -Math.PI / 2;
    water.position.set((b.x1 + b.x2) / 2, 0.1, (b.z1 + b.z2) / 2);
    scene.add(water);
    animated.water.push(water.material);
    /* Quay stone around the basin. */
    var quay = new THREE.Mesh(new THREE.PlaneGeometry(120, 120),
      new THREE.MeshStandardMaterial({ color: 0x4a4438, roughness: 0.95 }));
    quay.rotation.x = -Math.PI / 2;
    quay.position.set(365, 0.03, -365);
    quay.receiveShadow = true;
    scene.add(quay);
    addCollider(b.x1 - 2, b.z1 - 2, b.x2 + 2, b.z2 + 2);
    /* Yachts. */
    var yachtDefs = [[345, -340, 0.4], [380, -385, -0.7], [335, -390, 1.2]];
    for (var i = 0; i < yachtDefs.length; i++) {
      var yd = yachtDefs[i];
      var y = new THREE.Group();
      var hullMat = new THREE.MeshPhysicalMaterial({ color: 0xf5f2ea, metalness: 0.6, roughness: 0.15, clearcoat: 1 });
      var hull = box(14, 2.2, 4.2, hullMat, 0, 1.1, 0, true);
      y.add(hull);
      var bow = box(4, 1.6, 3.6, hullMat, 8, 1, 0, false);
      bow.rotation.y = 0.35;
      y.add(bow);
      var cabin = box(7, 2.4, 3.4, new THREE.MeshPhysicalMaterial({ color: 0x223344, metalness: 0.85, roughness: 0.1, clearcoat: 1 }), -1, 3.2, 0, true);
      y.add(cabin);
      var mast = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.16, 11, 6),
        new THREE.MeshStandardMaterial({ color: 0xcccccc, metalness: 0.9, roughness: 0.25 }));
      mast.position.set(1, 8, 0);
      y.add(mast);
      var sail = new THREE.Mesh(new THREE.PlaneGeometry(5, 7),
        new THREE.MeshStandardMaterial({ color: 0xffffff, side: THREE.DoubleSide, roughness: 0.6 }));
      sail.position.set(3.4, 7.5, 0);
      y.add(sail);
      var gl = glowSprite('rgba(255,220,140,1)', 8);
      gl.position.set(0, 4, 0);
      y.add(gl);
      y.position.set(yd[0], 0, yd[1]);
      y.rotation.y = yd[2];
      scene.add(y);
      animated.yachts.push(y);
    }
    /* Dock lamps + palms along the quay. */
    for (var lx = 322; lx <= 408; lx += 22) { makeLamp(scene, lx, -316); }
    for (var pz = -330; pz >= -400; pz -= 24) { makePalm(scene, 316, pz, 1.1); }
    neonSign(scene, 'VELVET BAY MARINA', '#35d6ff', 30, 365, 22, -312, 0);
  }

  function buildPlaza(scene) {
    /* Fountain plaza at block (150,-250). */
    var cx = 150, cz = -250;
    var plaza = new THREE.Mesh(new THREE.CircleGeometry(40, 28),
      new THREE.MeshStandardMaterial({ color: 0x8a7f6a, roughness: 0.85 }));
    plaza.rotation.x = -Math.PI / 2;
    plaza.position.set(cx, 0.04, cz);
    plaza.receiveShadow = true;
    scene.add(plaza);
    var basin = new THREE.Mesh(new THREE.CylinderGeometry(12, 13, 1.4, 24),
      new THREE.MeshStandardMaterial({ color: 0x9a8f7a, roughness: 0.7 }));
    basin.position.set(cx, 0.7, cz);
    basin.castShadow = true; basin.receiveShadow = true;
    scene.add(basin);
    var wtex = U.waterTexture();
    var wdisc = new THREE.Mesh(new THREE.CircleGeometry(11.4, 24),
      new THREE.MeshStandardMaterial({ color: 0x2fb6c9, roughness: 0.08, metalness: 0.8, map: wtex }));
    wdisc.rotation.x = -Math.PI / 2;
    wdisc.position.set(cx, 1.35, cz);
    scene.add(wdisc);
    animated.water.push(wdisc.material);
    addCollider(cx - 13, cz - 13, cx + 13, cz + 13);
    /* Gold statue in the middle. */
    var gold = new THREE.MeshStandardMaterial({ color: 0xd4af37, metalness: 1, roughness: 0.22 });
    var ped = box(2.4, 3.4, 2.4, new THREE.MeshStandardMaterial({ color: 0x6a6258, roughness: 0.8 }), cx, 3, cz, true);
    scene.add(ped);
    var fig = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 1.1, 4.4, 8), gold);
    fig.position.set(cx, 6.6, cz); fig.castShadow = true;
    scene.add(fig);
    var head = new THREE.Mesh(new THREE.SphereGeometry(0.8, 12, 10), gold);
    head.position.set(cx, 9.6, cz);
    scene.add(head);
    var arm = box(3.4, 0.5, 0.5, gold, cx + 1.6, 8.4, cz, false);
    arm.rotation.z = 0.9;
    scene.add(arm);
    /* Fountain sparkles. */
    var n = 90, pos = new Float32Array(n * 3);
    for (var i = 0; i < n; i++) {
      var a = rng() * Math.PI * 2, r = 2 + rng() * 8;
      pos[i * 3] = cx + Math.cos(a) * r;
      pos[i * 3 + 1] = 1.5 + rng() * 7;
      pos[i * 3 + 2] = cz + Math.sin(a) * r;
    }
    var pg = new THREE.BufferGeometry();
    pg.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    var pts = new THREE.Points(pg, new THREE.PointsMaterial({
      color: 0x9fe8ff, size: 0.55, transparent: true, opacity: 0.9,
      blending: THREE.AdditiveBlending, depthWrite: false
    }));
    scene.add(pts);
    animated.fountainPts = pts;
    /* Benches, planters, palms, lamps. */
    for (var b = 0; b < 8; b++) {
      var a2 = (b / 8) * Math.PI * 2;
      var bx = cx + Math.cos(a2) * 26, bz = cz + Math.sin(a2) * 26;
      var bench = box(4, 0.5, 1.4, new THREE.MeshStandardMaterial({ color: 0x5a4632, roughness: 0.85 }), bx, 0.7, bz, false);
      bench.rotation.y = -a2 + Math.PI / 2;
      scene.add(bench);
      makePalm(scene, cx + Math.cos(a2 + 0.35) * 33, cz + Math.sin(a2 + 0.35) * 33, 1.15);
    }
    for (var l = 0; l < 6; l++) {
      var a3 = (l / 6) * Math.PI * 2;
      makeLamp(scene, cx + Math.cos(a3) * 36, cz + Math.sin(a3) * 36);
    }
    neonSign(scene, 'PLAZA MARAVILLA', '#ffd166', 30, 150, 20, -212, 0);
  }

  function buildProps(scene) {
    /* Palm boulevard along avenue 200, z -300..-100. */
    for (var z = -290; z <= -110; z += 30) {
      makePalm(scene, 192, z, 1.2);
      makePalm(scene, 208, z + 15, 1.0);
    }
    /* Beach palms + boardwalk lamps. */
    for (var x = -380; x <= 380; x += 40) {
      makePalm(scene, x, 330, 1.1);
      if (Math.abs(x) % 80 < 40) makeLamp(scene, x + 10, 296);
    }
    /* Avenue lamps. */
    for (var i = 0; i < U.AVENUES.length; i++) {
      for (var zz = -380; zz <= 380; zz += 100) {
        makeLamp(scene, U.AVENUES[i] + 9, zz);
      }
    }
    /* Traffic lights at 6 intersections. */
    var ints = [[-100, -100], [100, -100], [-100, 100], [100, 100], [0, -200], [200, 0]];
    for (var t = 0; t < ints.length; t++) {
      var ix = ints[t][0], iz = ints[t][1];
      var pole = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.18, 6.4, 6),
        new THREE.MeshStandardMaterial({ color: 0x1c1e26, metalness: 0.7, roughness: 0.5 }));
      pole.position.set(ix + 8.5, 3.2, iz + 8.5);
      scene.add(pole);
      var housing = box(1, 2.6, 0.7, new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.4 }), ix + 8.5, 6.8, iz + 8.5, false);
      scene.add(housing);
      var red = new THREE.Mesh(new THREE.SphereGeometry(0.28, 8, 8),
        new THREE.MeshStandardMaterial({ color: 0x330000, emissive: 0xff2222, emissiveIntensity: 2 }));
      red.position.set(ix + 8.5, 7.5, iz + 8.9);
      scene.add(red);
      var green = new THREE.Mesh(new THREE.SphereGeometry(0.28, 8, 8),
        new THREE.MeshStandardMaterial({ color: 0x003300, emissive: 0x22ff66, emissiveIntensity: 0.2 }));
      green.position.set(ix + 8.5, 6.3, iz + 8.9);
      scene.add(green);
      animated.trafficLights.push({ red: red, green: green, phase: t * 1.3 });
    }
    /* Street furniture near downtown spawn (dense on-foot shots). */
    var rng2 = U.mulberry32(777);
    for (var p = 0; p < 26; p++) {
      var px = -140 + rng2() * 280, pz = -140 + rng2() * 280;
      var pr = U.nearestRoadPoint(px, pz);
      var kind = p % 4;
      if (kind === 0) {
        var hyd = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.4, 1, 8),
          new THREE.MeshStandardMaterial({ color: 0xc22e2e, roughness: 0.5 }));
        hyd.position.set(pr.x + 9, 0.5, pr.z + (rng2() - 0.5) * 6);
        scene.add(hyd);
      } else if (kind === 1) {
        var crate = box(1.6, 1.6, 1.6, new THREE.MeshStandardMaterial({ color: 0x6a5a34, roughness: 0.9 }), pr.x + 9, 0.8, pr.z, true);
        scene.add(crate);
      } else if (kind === 2) {
        var planter = box(2.2, 1, 1.2, new THREE.MeshStandardMaterial({ color: 0x3a3f4a, roughness: 0.9 }), pr.x + 9, 0.5, pr.z, false);
        scene.add(planter);
        var bush = new THREE.Mesh(new THREE.SphereGeometry(0.9, 8, 6),
          new THREE.MeshStandardMaterial({ color: 0x2e7d46, roughness: 0.9 }));
        bush.position.set(pr.x + 9, 1.4, pr.z);
        scene.add(bush);
      } else {
        var dump = box(3, 1.8, 1.6, new THREE.MeshStandardMaterial({ color: 0x2a4a3a, roughness: 0.7, metalness: 0.4 }), pr.x - 9, 0.9, pr.z, true);
        scene.add(dump);
        addCollider(pr.x - 10.5, pr.z - 1, pr.x - 7.5, pr.z + 1);
      }
    }
  }

  function buildCollectibles(scene) {
    var spots = [
      [0, 50], [100, 150], [-100, -150], [200, -50], [-200, 50],
      [0, -250], [150, -250], [250, -150], [-250, -250], [250, 50],
      [-150, 250], [50, 250], [-50, -50], [150, 50], [-200, -250],
      [300, 100], [0, 300], [100, -300], [-300, 0], [365, -330]
    ];
    for (var i = 0; i < spots.length; i++) {
      var s = spots[i];
      var g = new THREE.Group();
      var orb = new THREE.Mesh(new THREE.IcosahedronGeometry(0.9, 0),
        new THREE.MeshStandardMaterial({ color: 0xffd166, emissive: 0xffb020, emissiveIntensity: 2.2, metalness: 0.8, roughness: 0.2 }));
      g.add(orb);
      var gl = glowSprite('rgba(255,190,60,1)', 5);
      g.add(gl);
      g.position.set(s[0], 2.2, s[1]);
      scene.add(g);
      collectibles.push({ x: s[0], z: s[1], mesh: g, taken: false, phase: i * 0.7 });
    }
  }

  function buildRamps(scene) {
    var defs = [
      [0, 50, 0], [200, -150, Math.PI / 2], [-100, 250, Math.PI],
      [100, -250, -Math.PI / 2], [-200, 100, 0]
    ];
    var stripeTex = U.canvasTexture(U.makeCanvas(128, 64, function (g, w, h) {
      g.fillStyle = '#d8b400'; g.fillRect(0, 0, w, h);
      g.fillStyle = '#161616';
      for (var x = -h; x < w; x += 32) {
        g.beginPath(); g.moveTo(x, h); g.lineTo(x + 16, 0); g.lineTo(x + 32, 0); g.lineTo(x + 16, h); g.fill();
      }
    }), 1, 1);
    for (var i = 0; i < defs.length; i++) {
      var d = defs[i];
      var ramp = new THREE.Mesh(new THREE.BoxGeometry(4.5, 0.7, 9),
        new THREE.MeshStandardMaterial({ map: stripeTex, roughness: 0.6 }));
      ramp.position.set(d[0], 1.1, d[1]);
      ramp.rotation.y = d[2];
      ramp.rotation.x = -0.42;
      ramp.castShadow = true; ramp.receiveShadow = true;
      scene.add(ramp);
      ramps.push({ x: d[0], z: d[1], dir: d[2], mesh: ramp });
    }
  }

  function buildSafehouses(scene) {
    var defs = [
      [-250, 50, 'PALMA HILLS HOUSE'], [50, -250, 'DOWNTOWN LOFT'], [250, 250, 'IRONWORKS GARAGE']
    ];
    for (var i = 0; i < defs.length; i++) {
      var d = defs[i];
      var beacon = new THREE.Mesh(new THREE.CylinderGeometry(2.2, 2.2, 26, 12, 1, true),
        new THREE.MeshBasicMaterial({ color: 0x37e08a, transparent: true, opacity: 0.16, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, depthWrite: false }));
      beacon.position.set(d[0], 13, d[1]);
      scene.add(beacon);
      neonSign(scene, 'SAFEHOUSE', '#37e08a', 16, d[0], 8, d[1], 0);
      safehouses.push({ x: d[0], z: d[1], name: d[2], beacon: beacon });
    }
  }

  function build(renderer, scene) {
    var pmrem = new THREE.PMREMGenerator(renderer);
    var envScene = new THREE.Scene();
    envScene.background = new THREE.Color(0x1a1030);
    var top = new THREE.Mesh(new THREE.PlaneGeometry(20, 20),
      new THREE.MeshBasicMaterial({ color: 0x8a2f6e }));
    top.position.y = 9; top.rotation.x = Math.PI / 2;
    envScene.add(top);
    var warm = new THREE.Mesh(new THREE.PlaneGeometry(20, 6),
      new THREE.MeshBasicMaterial({ color: 0xff8a3d }));
    warm.position.set(0, 2, -9);
    envScene.add(warm);
    var cool = new THREE.Mesh(new THREE.PlaneGeometry(20, 6),
      new THREE.MeshBasicMaterial({ color: 0x35d6ff }));
    cool.position.set(0, 2, 9); cool.rotation.y = Math.PI;
    envScene.add(cool);
    scene.environment = pmrem.fromScene(envScene, 0.04).texture;
    pmrem.dispose();

    buildSky(scene);
    buildLights(scene);
    buildGround(scene);
    buildRoads(scene);
    buildBuildings(scene);
    buildCasino(scene);
    buildMarina(scene);
    buildPlaza(scene);
    buildProps(scene);
    buildCollectibles(scene);
    buildRamps(scene);
    buildSafehouses(scene);
    return { colliders: colliders, collectibles: collectibles, ramps: ramps, safehouses: safehouses, marinaBasin: marinaBasin };
  }

  function tick(dt, t) {
    for (var i = 0; i < animated.water.length; i++) {
      var m = animated.water[i];
      if (m.map) { m.map.offset.x = (t * 0.01) % 1; m.map.offset.y = (t * 0.006) % 1; }
    }
    if (animated.fountainPts) {
      var pos = animated.fountainPts.geometry.attributes.position;
      for (var j = 0; j < pos.count; j++) {
        var y = pos.getY(j) - dt * 6;
        if (y < 1.4) y = 8.5;
        pos.setY(j, y);
      }
      pos.needsUpdate = true;
    }
    for (var k = 0; k < animated.yachts.length; k++) {
      var y = animated.yachts[k];
      y.position.y = Math.sin(t * 0.7 + k * 2) * 0.25;
      y.rotation.z = Math.sin(t * 0.5 + k) * 0.02;
    }
    for (var n = 0; n < animated.neon.length; n++) {
      animated.neon[n].opacity = 0.9 + Math.sin(t * 3 + n * 1.7) * 0.1;
    }
    for (var c = 0; c < collectibles.length; c++) {
      var col = collectibles[c];
      if (col.taken) continue;
      col.mesh.position.y = 2.2 + Math.sin(t * 2 + col.phase) * 0.4;
      col.mesh.rotation.y += dt * 1.5;
    }
    for (var tl = 0; tl < animated.trafficLights.length; tl++) {
      var L = animated.trafficLights[tl];
      var ph = (t * 0.25 + L.phase) % 2;
      var greenOn = ph < 1;
      L.red.material.emissiveIntensity = greenOn ? 0.15 : 2.4;
      L.green.material.emissiveIntensity = greenOn ? 2.4 : 0.15;
    }
  }

  return { build: build, tick: tick, colliders: colliders, collectibles: collectibles, ramps: ramps, safehouses: safehouses, marinaBasin: marinaBasin };
})();
