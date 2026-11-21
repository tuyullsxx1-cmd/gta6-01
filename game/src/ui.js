'use strict';
/* MARAVILLA — HUD, minimap, dispatch, phone, pause tabs, weapon bar, crew portraits, feed. */
var MV = window.MV || (window.MV = {});

MV.ui = (function () {
  var U = MV.util;
  var el = {};
  var feedItems = [];
  var tickerText = '';
  var minimapRoute = [];
  var portraitCache = {};

  function $(id) { return document.getElementById(id); }

  function init() {
    var ids = ['hud', 'health-fill', 'health-num', 'armour-fill', 'armour-num', 'cash', 'clock', 'day',
      'district', 'wanted', 'speed', 'speed-unit', 'weapon-bar', 'dispatch-rows', 'ticker',
      'minimap', 'mission-title', 'mission-objective', 'mission-pips', 'mission-next',
      'feed', 'radio', 'banner', 'banner-title', 'banner-sub', 'dialogue', 'dialogue-name',
      'dialogue-text', 'pause', 'pause-map', 'pause-story', 'pause-stats', 'pause-crew',
      'phone', 'phone-body', 'wheel', 'menu', 'save-slots', 'crosshair', 'hint'];
    for (var i = 0; i < ids.length; i++) el[ids[i]] = $(ids[i]);
  }

  function fmtClock(min) {
    var h = Math.floor(min / 60) % 24, m = Math.floor(min % 60);
    return (h < 10 ? '0' : '') + h + ':' + (m < 10 ? '0' : '') + m;
  }

  function update(game) {
    var M = MV.missions.state;
    var p = MV.entities.player;
    if (el['health-fill']) {
      el['health-fill'].style.width = p.health + '%';
      el['health-num'].textContent = Math.round(p.health);
      el['armour-fill'].style.width = p.armour + '%';
      el['armour-num'].textContent = Math.round(p.armour);
      el['cash'].textContent = '$' + M.cash.toLocaleString('en-US');
      el['clock'].textContent = fmtClock(M.clockMin);
      el['day'].textContent = 'DAY ' + M.day;
      var d = U.districtAt(p.x, p.z);
      el['district'].textContent = d.name.toUpperCase();
      el['district'].style.color = d.color;
      var stars = '';
      for (var s = 0; s < 5; s++) stars += s < M.wanted ? '★' : '☆';
      el['wanted'].textContent = stars;
      el['wanted'].style.color = M.wanted > 0 ? '#ff4040' : '#666';
      var car = game.playerCar();
      var kmh = car ? Math.round(Math.abs(car.speed) * 3.6) : 0;
      el['speed'].textContent = kmh;
      el['speed-unit'].textContent = car ? 'km/h' : 'ON FOOT';
      el['radio'].textContent = '♪ ' + MV.audio.stationName();
    }
    updateMission(game);
    updateWeaponBar();
    drawMinimap(game);
  }

  function updateMission(game) {
    var M = MV.missions.state;
    var def = MV.missions.currentDef();
    if (!def) {
      el['mission-title'].textContent = 'MARAVILLA — FREE ROAM';
      el['mission-objective'].textContent = M.nextLine || 'Press M for missions. Find work, earn cash, own the city.';
      el['mission-pips'].textContent = '';
      el['mission-next'].textContent = M.nextLine || '';
      return;
    }
    var st = MV.missions.currentStage();
    el['mission-title'].textContent = 'ACT ' + def.act + ' — ' + def.title.toUpperCase();
    var obj = st.objective;
    if (st.taxi && M.taxi) obj += '  (' + M.taxi.faresDone + '/3)';
    if (st.jobs) obj += '  (' + M.jobsDone + '/2)';
    if (st.collect) obj += '  (' + M.collectibles + '/5)';
    if (st.race && M.race) obj += '  — LAP ' + (M.race.playerLap + 1) + '/' + 2;
    el['mission-objective'].textContent = obj;
    var pips = '';
    for (var i = 0; i < def.stages.length; i++) pips += i < M.stageIdx ? '● ' : (i === M.stageIdx ? '◉ ' : '○ ');
    el['mission-pips'].textContent = pips;
    el['mission-next'].textContent = 'NEXT: ' + (M.nextLine || st.next || '');
  }

  var WEAPON_LABELS = { fists: 'FISTS', pistol: 'PISTOL', smg: 'SMG', shotgun: 'SHOTGUN', rifle: 'RIFLE', launcher: 'LAUNCHER' };
  function updateWeaponBar() {
    var M = MV.missions.state;
    if (!el['weapon-bar']) return;
    var html = '';
    for (var i = 0; i < M.weaponOrder.length; i++) {
      var w = M.weaponOrder[i], info = M.weapons[w];
      var sel = w === M.selectedWeapon ? ' sel' : '';
      var lock = info.owned ? '' : ' locked';
      var ammo = info.owned ? (info.ammo < 0 ? '∞' : info.ammo) : 'LOCKED';
      html += '<div class="wslot' + sel + lock + '"><b>' + (i + 1) + '</b> ' + WEAPON_LABELS[w] + ' <span>' + ammo + '</span></div>';
    }
    if (el['weapon-bar']._html !== html) { el['weapon-bar'].innerHTML = html; el['weapon-bar']._html = html; }
  }

  function updateDispatch(units) {
    if (!el['dispatch-rows']) return;
    var html = '';
    for (var i = 0; i < units.length; i++) {
      var u = units[i];
      html += '<div class="drow"><span class="callsign">' + u.callsign + '</span><span class="drole">' + u.role + '</span><span class="dlabel">' + u.label + '</span></div>';
    }
    if (el['dispatch-rows']._html !== html) { el['dispatch-rows'].innerHTML = html; el['dispatch-rows']._html = html; }
    if (el['ticker']) el['ticker'].textContent = tickerText;
  }
  function setTicker(t) { tickerText = t; }

  function addFeed(text, color) {
    feedItems.unshift({ text: text, color: color || '#ddd', t: Date.now() });
    if (feedItems.length > 5) feedItems.pop();
    if (!el['feed']) return;
    var html = '';
    for (var i = 0; i < feedItems.length; i++) {
      html += '<div style="color:' + feedItems[i].color + '">' + feedItems[i].text + '</div>';
    }
    el['feed'].innerHTML = html;
  }

  function showBanner(title, sub, color) {
    if (!el['banner']) return;
    el['banner-title'].textContent = title;
    el['banner-sub'].textContent = sub || '';
    el['banner'].style.borderColor = color || '#d4af37';
    el['banner'].style.display = 'block';
    setTimeout(function () { if (el['banner']) el['banner'].style.display = 'none'; }, 4200);
  }
  function showDialogue(name, text) {
    if (!el['dialogue']) return;
    el['dialogue-name'].textContent = name;
    el['dialogue-text'].textContent = text;
    el['dialogue'].style.display = 'block';
    clearTimeout(showDialogue._t);
    showDialogue._t = setTimeout(function () { if (el['dialogue']) el['dialogue'].style.display = 'none'; }, 6000);
  }
  function showHint(text) {
    if (!el['hint']) return;
    el['hint'].textContent = text;
    el['hint'].style.display = 'block';
    clearTimeout(showHint._t);
    showHint._t = setTimeout(function () { if (el['hint']) el['hint'].style.display = 'none'; }, 4000);
  }

  function drawMinimap(game) {
    var cv = el['minimap'];
    if (!cv) return;
    var g = cv.getContext('2d');
    var W = cv.width, H = cv.height;
    var scale = W / 900;
    function X(x) { return (x + 450) * scale; }
    function Z(z) { return (z + 450) * scale; }
    g.fillStyle = 'rgba(10,10,18,0.85)';
    g.fillRect(0, 0, W, H);
    /* District labels. */
    g.font = '9px Arial'; g.textAlign = 'center';
    var labels = [[0, 0, 'DOWNTOWN'], [250, -250, 'VELVET BAY'], [-250, -250, 'PALMA HILLS'], [-250, 250, 'OLD TOWN'], [250, 250, 'IRONWORKS'], [0, 360, 'BOARDWALK']];
    for (var l = 0; l < labels.length; l++) {
      g.fillStyle = 'rgba(200,200,220,0.55)';
      g.fillText(labels[l][2], X(labels[l][0]), Z(labels[l][1]));
    }
    /* Roads. */
    g.strokeStyle = 'rgba(220,220,240,0.75)';
    g.lineWidth = 2;
    for (var i = 0; i < U.AVENUES.length; i++) {
      g.beginPath(); g.moveTo(X(U.AVENUES[i]), 0); g.lineTo(X(U.AVENUES[i]), H); g.stroke();
    }
    for (var j = 0; j < U.STREETS.length; j++) {
      g.beginPath(); g.moveTo(0, Z(U.STREETS[j])); g.lineTo(W, Z(U.STREETS[j])); g.stroke();
    }
    /* Marina water. */
    g.fillStyle = 'rgba(53,214,255,0.5)';
    g.fillRect(X(320), Z(-410), (410 - 320) * scale, (-320 + 410) * scale);
    /* Route line. */
    if (minimapRoute.length > 1) {
      g.strokeStyle = '#ffd166'; g.lineWidth = 2.5;
      g.beginPath();
      g.moveTo(X(minimapRoute[0].x), Z(minimapRoute[0].z));
      for (var r = 1; r < minimapRoute.length; r++) g.lineTo(X(minimapRoute[r].x), Z(minimapRoute[r].z));
      g.stroke();
    }
    /* Mission target. */
    var tgt = MV.missions.currentTarget(game);
    if (tgt && tgt.radius < 900) {
      g.fillStyle = '#ffd166';
      g.beginPath(); g.arc(X(tgt.x), Z(tgt.z), 5, 0, Math.PI * 2); g.fill();
      g.strokeStyle = '#ffd166'; g.lineWidth = 1.5;
      g.beginPath(); g.arc(X(tgt.x), Z(tgt.z), 9, 0, Math.PI * 2); g.stroke();
    }
    /* Collectibles nearby. */
    g.fillStyle = '#ffb020';
    var cols = MV.world.collectibles;
    for (var c = 0; c < cols.length; c++) {
      if (cols[c].taken) continue;
      g.fillRect(X(cols[c].x) - 1.5, Z(cols[c].z) - 1.5, 3, 3);
    }
    /* Cops. */
    g.fillStyle = '#ff4040';
    var cops = MV.entities.cops;
    for (var k = 0; k < cops.length; k++) {
      g.beginPath(); g.arc(X(cops[k].x), Z(cops[k].z), 2.5, 0, Math.PI * 2); g.fill();
    }
    /* Player arrow. */
    var p = MV.entities.player;
    var heading = p.inCar && p.inCar ? p.inCar.heading : p.heading;
    g.save();
    g.translate(X(p.x), Z(p.z));
    g.rotate(Math.atan2(Math.sin(heading), Math.cos(heading)) + Math.PI);
    g.fillStyle = '#ffffff';
    g.beginPath(); g.moveTo(0, -7); g.lineTo(5, 6); g.lineTo(-5, 6); g.closePath(); g.fill();
    g.restore();
    /* North. */
    g.fillStyle = '#ffffff'; g.font = 'bold 11px Arial'; g.textAlign = 'left';
    g.fillText('N', 6, 14);
    g.beginPath(); g.moveTo(10, 26); g.lineTo(10, 18); g.strokeStyle = '#fff'; g.stroke();
  }
  function setRoute(points) { minimapRoute = points || []; }

  /* ---- Crew portraits: procedural canvas faces. ---- */
  function portrait(person) {
    if (portraitCache[person.id]) return portraitCache[person.id];
    var c = U.makeCanvas(160, 200, function (g, w, h) {
      var grad = g.createLinearGradient(0, 0, 0, h);
      grad.addColorStop(0, '#2a1a3a'); grad.addColorStop(1, '#120e22');
      g.fillStyle = grad; g.fillRect(0, 0, w, h);
      /* Shoulders / jacket. */
      g.fillStyle = person.color;
      g.beginPath(); g.moveTo(20, 200); g.quadraticCurveTo(80, 130, 140, 200); g.closePath(); g.fill();
      g.fillStyle = 'rgba(0,0,0,0.35)';
      g.fillRect(76, 150, 8, 50);
      /* Neck + face. */
      g.fillStyle = person.skin;
      g.fillRect(70, 108, 20, 34);
      g.beginPath(); g.ellipse(80, 78, 34, 42, 0, 0, Math.PI * 2); g.fill();
      /* Hair. */
      g.fillStyle = person.hair;
      g.beginPath(); g.ellipse(80, 52, 36, 26, 0, Math.PI, 0); g.fill();
      if (person.id === 'juno') { g.fillRect(44, 40, 72, 18); }
      if (person.id === 'iris') { g.fillRect(40, 46, 14, 60); g.fillRect(106, 46, 14, 60); }
      if (person.id === 'bram') { g.beginPath(); g.ellipse(80, 46, 34, 14, 0, Math.PI, 0); g.fill(); }
      /* Eyes, brows, smile. */
      g.fillStyle = '#14100c';
      g.beginPath(); g.ellipse(66, 76, 5, 3, 0, 0, Math.PI * 2); g.fill();
      g.beginPath(); g.ellipse(94, 76, 5, 3, 0, 0, Math.PI * 2); g.fill();
      g.strokeStyle = '#14100c'; g.lineWidth = 3;
      g.beginPath(); g.moveTo(58, 64); g.lineTo(74, 62); g.stroke();
      g.beginPath(); g.moveTo(86, 62); g.lineTo(102, 64); g.stroke();
      g.strokeStyle = '#7a3a22'; g.lineWidth = 2.5;
      g.beginPath(); g.moveTo(68, 98); g.quadraticCurveTo(80, 106, 92, 98); g.stroke();
      /* Gold rim. */
      g.strokeStyle = '#d4af37'; g.lineWidth = 4;
      g.strokeRect(2, 2, w - 4, h - 4);
    });
    var url = c.toDataURL('image/png');
    portraitCache[person.id] = url;
    return url;
  }
  function miloPortrait() {
    if (portraitCache.milo) return portraitCache.milo;
    var url = portrait({ id: 'milo', color: '#8a1622', skin: '#c9a186', hair: '#1a1210' });
    portraitCache.milo = url;
    return url;
  }

  function renderPauseTab(tab, game) {
    var M = MV.missions.state;
    if (tab === 'map') {
      el['pause-map'].style.display = 'block';
      el['pause-story'].style.display = 'none';
      el['pause-stats'].style.display = 'none';
      el['pause-crew'].style.display = 'none';
      drawMinimap(game);
    } else if (tab === 'story') {
      el['pause-map'].style.display = 'none';
      el['pause-story'].style.display = 'block';
      el['pause-stats'].style.display = 'none';
      el['pause-crew'].style.display = 'none';
      var html = '';
      for (var i = 0; i < MV.missions.DEFS.length; i++) {
        var d = MV.missions.DEFS[i];
        var st = M.completed.indexOf(i) >= 0 ? 'DONE ✓' : (M.current === i ? 'ACTIVE' : (i === 0 || M.completed.indexOf(i - 1) >= 0 ? 'AVAILABLE' : 'LOCKED'));
        html += '<div class="srow"><b>ACT ' + d.act + ' — ' + d.title + '</b><span>' + st + '</span><i>$' + d.payout + '</i></div>';
      }
      el['pause-story'].innerHTML = html;
    } else if (tab === 'stats') {
      el['pause-map'].style.display = 'none';
      el['pause-story'].style.display = 'none';
      el['pause-stats'].style.display = 'block';
      el['pause-crew'].style.display = 'none';
      var cashEarned = M.cash - 250 + M.completed.length * 0;
      el['pause-stats'].innerHTML =
        '<div class="srow"><b>Cash</b><span>$' + M.cash + '</span></div>' +
        '<div class="srow"><b>Missions completed</b><span>' + M.completed.length + ' / 10</span></div>' +
        '<div class="srow"><b>Races won</b><span>' + M.racesWon + '</span></div>' +
        '<div class="srow"><b>Taxi fares</b><span>' + M.fares + '</span></div>' +
        '<div class="srow"><b>District jobs</b><span>' + M.jobsDone + '</span></div>' +
        '<div class="srow"><b>Collectibles</b><span>' + M.collectibles + ' / 20</span></div>' +
        '<div class="srow"><b>Stunt jumps</b><span>' + M.jumps + ' / 5</span></div>' +
        '<div class="srow"><b>Day</b><span>' + M.day + '</span></div>' +
        '<div class="srow"><b>Standing</b><span>Downtown ' + M.standing.downtown + ' · Velvet ' + M.standing.velvet + ' · Hills ' + M.standing.hills + '</span></div>';
    } else if (tab === 'crew') {
      el['pause-map'].style.display = 'none';
      el['pause-story'].style.display = 'none';
      el['pause-stats'].style.display = 'none';
      el['pause-crew'].style.display = 'block';
      var ch = '<div class="crewcard"><img src="' + miloPortrait() + '"><div><b>MILO VANE</b><i>Protagonist</i><p>New in town. Fast hands, faster car. The crew\u2019s last hope — and its biggest gamble.</p></div></div>';
      for (var i = 0; i < MV.missions.CREW.length; i++) {
        var cr = MV.missions.CREW[i];
        ch += '<div class="crewcard"><img src="' + portrait(cr) + '"><div><b>' + cr.name.toUpperCase() + '</b><i>' + cr.role + '</i><p>' + cr.bio + '</p></div></div>';
      }
      el['pause-crew'].innerHTML = ch;
    }
  }

  function openPhone(messages) {
    if (!el['phone']) return;
    var html = '';
    for (var i = 0; i < messages.length; i++) {
      html += '<div class="msg"><b>' + messages[i].from + '</b><p>' + messages[i].text + '</p></div>';
    }
    el['phone-body'].innerHTML = html;
    el['phone'].style.display = 'block';
  }
  function closePhone() { if (el['phone']) el['phone'].style.display = 'none'; }

  return {
    init: init, update: update, updateDispatch: updateDispatch, setTicker: setTicker,
    addFeed: addFeed, showBanner: showBanner, showDialogue: showDialogue, showHint: showHint,
    drawMinimap: drawMinimap, setRoute: setRoute, portrait: portrait, miloPortrait: miloPortrait,
    renderPauseTab: renderPauseTab, openPhone: openPhone, closePhone: closePhone, el: el
  };
})();
