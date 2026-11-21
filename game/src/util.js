'use strict';
/* MARAVILLA — One Last Score. Shared utilities: seeded RNG, road grid, districts, canvas textures. */
var MV = window.MV || (window.MV = {});

MV.util = (function () {
  function mulberry32(a) {
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }
  function lerp(a, b, t) { return a + (b - a) * t; }
  function dist2(x1, z1, x2, z2) { var dx = x2 - x1, dz = z2 - z1; return Math.sqrt(dx * dx + dz * dz); }
  function angleDiff(a, b) {
    var d = (b - a) % (Math.PI * 2);
    if (d > Math.PI) d -= Math.PI * 2;
    if (d < -Math.PI) d += Math.PI * 2;
    return d;
  }
  function angleLerp(a, b, t) { return a + angleDiff(a, b) * clamp(t, 0, 1); }

  /* ---- Road grid: avenues run along z, streets along x. Road half-width 7. ---- */
  var AVENUES = [-300, -200, -100, 0, 100, 200, 300];
  var STREETS = [-300, -200, -100, 0, 100, 200, 300];
  var ROAD_HALF = 7;
  var WORLD = 420;

  function isOnRoad(x, z) {
    for (var i = 0; i < AVENUES.length; i++) if (Math.abs(x - AVENUES[i]) <= ROAD_HALF) return true;
    for (var j = 0; j < STREETS.length; j++) if (Math.abs(z - STREETS[j]) <= ROAD_HALF) return true;
    return false;
  }
  function nearestAvenue(x) {
    var best = AVENUES[0], bd = 1e9;
    for (var i = 0; i < AVENUES.length; i++) { var d = Math.abs(x - AVENUES[i]); if (d < bd) { bd = d; best = AVENUES[i]; } }
    return best;
  }
  function nearestStreet(z) {
    var best = STREETS[0], bd = 1e9;
    for (var i = 0; i < STREETS.length; i++) { var d = Math.abs(z - STREETS[i]); if (d < bd) { bd = d; best = STREETS[i]; } }
    return best;
  }
  /* Snap any point onto the nearest road centre line. */
  function nearestRoadPoint(x, z) {
    var ax = nearestAvenue(x), sz = nearestStreet(z);
    var dx = Math.abs(x - ax), dz = Math.abs(z - sz);
    if (dx <= dz) return { x: ax, z: clamp(z, -WORLD, WORLD) };
    return { x: clamp(x, -WORLD, WORLD), z: sz };
  }
  /* L-path route between two road points: only when BOTH legs lie on roads,
     else route via the nearest intersection. Returns array of {x,z}. */
  function routePoints(x1, z1, x2, z2) {
    var a = nearestRoadPoint(x1, z1), b = nearestRoadPoint(x2, z2);
    var corner1 = { x: b.x, z: a.z }, corner2 = { x: a.x, z: b.z };
    var leg1ok = isOnRoad(corner1.x, a.z) && isOnRoad(b.x, corner1.z);
    var leg2ok = isOnRoad(corner2.x, a.z) && isOnRoad(b.x, corner2.z);
    if (leg1ok) return [a, corner1, b];
    if (leg2ok) return [a, corner2, b];
    var ix = nearestAvenue(b.x), iz = nearestStreet(a.z);
    return [a, { x: ix, z: a.z }, { x: ix, z: iz }, { x: b.x, z: iz }, b];
  }

  /* ---- Districts ---- */
  var DISTRICTS = [
    { id: 'downtown', name: 'Downtown', color: '#c98cff' },
    { id: 'velvet', name: 'Velvet Bay', color: '#ffd166' },
    { id: 'hills', name: 'Palma Hills', color: '#7ee081' },
    { id: 'oldtown', name: 'Old Town', color: '#ff9a5c' },
    { id: 'industrial', name: 'Ironworks', color: '#9aa5b1' },
    { id: 'beach', name: 'Boardwalk', color: '#5cd6ff' }
  ];
  function districtAt(x, z) {
    if (z > 300) return DISTRICTS[5];
    if (x > 150 && z < -150) return DISTRICTS[1];
    if (x < -150 && z < -150) return DISTRICTS[2];
    if (x < -150 && z > 150) return DISTRICTS[3];
    if (x > 150 && z > 150) return DISTRICTS[4];
    return DISTRICTS[0];
  }

  /* ---- Canvas texture helpers ---- */
  function makeCanvas(w, h, draw) {
    var c = document.createElement('canvas');
    c.width = w; c.height = h;
    draw(c.getContext('2d'), w, h);
    return c;
  }
  function canvasTexture(canvas, rx, ry) {
    var t = new THREE.CanvasTexture(canvas);
    t.wrapS = THREE.RepeatWrapping; t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(rx || 1, ry || 1);
    t.anisotropy = 4;
    return t;
  }
  /* Building facade: dark glass + lit/unlit window grid. */
  function facadeTexture(rng, base, litRatio, floors, cols) {
    var c = makeCanvas(128, 256, function (g, w, h) {
      g.fillStyle = base; g.fillRect(0, 0, w, h);
      var cw = w / cols, ch = h / floors;
      for (var f = 0; f < floors; f++) {
        for (var cc = 0; cc < cols; cc++) {
          var lit = rng() < litRatio;
          if (lit) {
            var warm = rng() < 0.7;
            g.fillStyle = warm ? 'rgba(255,196,110,0.95)' : 'rgba(140,220,255,0.9)';
          } else {
            g.fillStyle = 'rgba(16,20,34,0.95)';
          }
          g.fillRect(cc * cw + 2, f * ch + 3, cw - 4, ch - 6);
        }
      }
    });
    var t = new THREE.CanvasTexture(c);
    t.anisotropy = 4;
    return t;
  }
  /* Soft radial glow sprite texture. Accepts '#rrggbb' or 'rgb/rgba(r,g,b[,a])'. */
  function glowTexture(color) {
    var rgb = null;
    var m = /#([0-9a-fA-F]{2})([0-9a-fA-F]{2})([0-9a-fA-F]{2})/.exec(color);
    if (m) rgb = [parseInt(m[1], 16), parseInt(m[2], 16), parseInt(m[3], 16)];
    if (!rgb) {
      var m2 = /(\d+)[,\s]+(\d+)[,\s]+(\d+)/.exec(color);
      rgb = m2 ? [+m2[1], +m2[2], +m2[3]] : [255, 255, 255];
    }
    var base = 'rgba(' + rgb[0] + ',' + rgb[1] + ',' + rgb[2] + ',';
    var c = makeCanvas(128, 128, function (g, w, h) {
      var gr = g.createRadialGradient(64, 64, 2, 64, 64, 62);
      gr.addColorStop(0, base + '1)');
      gr.addColorStop(0.35, base + '0.45)');
      gr.addColorStop(1, base + '0)');
      g.fillStyle = gr; g.fillRect(0, 0, w, h);
    });
    return new THREE.CanvasTexture(c);
  }
  /* Neon sign texture: glowing text on transparent dark. */
  function neonTexture(text, color, font) {
    var c = makeCanvas(512, 128, function (g, w, h) {
      g.clearRect(0, 0, w, h);
      g.font = (font || 'bold 64px Arial');
      g.textAlign = 'center'; g.textBaseline = 'middle';
      g.shadowColor = color; g.shadowBlur = 28;
      g.fillStyle = color;
      g.fillText(text, w / 2, h / 2);
      g.shadowBlur = 8;
      g.fillStyle = '#ffffff';
      g.fillText(text, w / 2, h / 2);
    });
    return new THREE.CanvasTexture(c);
  }
  /* Billboard ad texture. */
  function adTexture(lines, bg1, bg2, accent) {
    var c = makeCanvas(512, 256, function (g, w, h) {
      var gr = g.createLinearGradient(0, 0, w, h);
      gr.addColorStop(0, bg1); gr.addColorStop(1, bg2);
      g.fillStyle = gr; g.fillRect(0, 0, w, h);
      g.textAlign = 'center';
      g.fillStyle = accent;
      g.font = 'bold 54px Arial';
      g.fillText(lines[0], w / 2, 96);
      g.fillStyle = '#ffffff';
      g.font = 'bold 30px Arial';
      g.fillText(lines[1] || '', w / 2, 160);
      g.fillStyle = accent;
      g.fillRect(156, 190, 200, 6);
    });
    return new THREE.CanvasTexture(c);
  }
  /* Water normal-ish noise texture (scrolled for sparkle). */
  function waterTexture() {
    var c = makeCanvas(256, 256, function (g, w, h) {
      g.fillStyle = '#0e4a5e'; g.fillRect(0, 0, w, h);
      var rng = mulberry32(1234);
      for (var i = 0; i < 900; i++) {
        var v = 60 + Math.floor(rng() * 90);
        g.fillStyle = 'rgba(' + v + ',' + (v + 60) + ',' + (v + 90) + ',' + (0.25 + rng() * 0.4) + ')';
        g.fillRect(rng() * w, rng() * h, 1 + rng() * 3, 1 + rng() * 2);
      }
    });
    var t = new THREE.CanvasTexture(c);
    t.wrapS = THREE.RepeatWrapping; t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(6, 6);
    return t;
  }

  return {
    mulberry32: mulberry32, clamp: clamp, lerp: lerp, dist2: dist2,
    angleDiff: angleDiff, angleLerp: angleLerp,
    AVENUES: AVENUES, STREETS: STREETS, ROAD_HALF: ROAD_HALF, WORLD: WORLD,
    isOnRoad: isOnRoad, nearestAvenue: nearestAvenue, nearestStreet: nearestStreet,
    nearestRoadPoint: nearestRoadPoint, routePoints: routePoints,
    DISTRICTS: DISTRICTS, districtAt: districtAt,
    makeCanvas: makeCanvas, canvasTexture: canvasTexture,
    facadeTexture: facadeTexture, glowTexture: glowTexture,
    neonTexture: neonTexture, adTexture: adTexture, waterTexture: waterTexture
  };
})();
