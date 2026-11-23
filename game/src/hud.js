// HUD: gold-trimmed panels, minimap with route line + north + district
// labels, labelled health/armour bars with numbers, real km/h speedometer,
// dispatch panel (6 rows, unique callsigns), crew cards with portraits,
// NEXT JOB header with stage pips, and a message feed that never overlaps
// the rank line.
import { DISTRICTS, WEAPONS, RADIO, RANKS } from './config.js';
import { rankFor, nextRank, districtAt } from './state.js';
import { currentStanding } from './districts.js';
import { missionObjective } from './missions.js';
import { crewStatus } from './phone.js';
import { portraitURL } from './portraits.js';
import { clockText } from './render.js';
import { dispatchRows } from './police.js';

function $(id) { return document.getElementById(id); }

export function createHud(state, deps) {
  const feed = $('message-feed');
  const messages = [];
  let lastDialogue = 0;

  function say(text) {
    messages.unshift(text);
    if (messages.length > 5) messages.pop();
    state.messages = [...messages];
    if (feed) feed.innerHTML = messages.map((m) => `<div class="msg">${escapeHtml(m)}</div>`).join('');
  }

  function escapeHtml(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  function showDialogue(who, text) {
    const chip = $('dialogue');
    if (!chip) return;
    const person = who === 'milo'
      ? { id: 'milo', name: 'Milo Vane', skin: 0xd8a077, hair: 0x241608, hairStyle: 'swept', shirt: 0xb8860b }
      : who === 'anselm'
        ? { id: 'anselm', name: 'Detective Anselm', skin: 0xe8b98a, hair: 0x8a8a8a, hairStyle: 'short', shirt: 0x2a3a5a }
        : deps.crew.find((c) => c.id === who) || { id: who, name: who, skin: 0xd8a077, hair: 0x222222, hairStyle: 'short', shirt: 0x333333 };
    $('dialogue-portrait').src = portraitURL(person);
    $('dialogue-name').textContent = person.name;
    $('dialogue-text').textContent = text;
    chip.classList.remove('hidden');
    lastDialogue = performance.now();
  }

  function drawMinimap(state, ctx) {
    const cv = $('minimap');
    if (!cv) return;
    const g = cv.getContext('2d');
    const W = cv.width, H = cv.height;
    const scale = W / 620;
    const toX = (x) => (x + 310) * scale;
    const toZ = (z) => (z + 310) * scale;
    g.fillStyle = '#0e2438'; g.fillRect(0, 0, W, H);
    g.fillStyle = '#274e63'; g.fillRect(0, 0, 26 * scale * 4, H); // sea on the west
    g.fillStyle = '#2a3a2a'; g.fillRect(0, 0, W, H);
    g.fillStyle = '#0e3a5a'; g.fillRect(0, 0, 58 * scale, H);
    g.fillStyle = '#c8b078'; g.fillRect(0, H - 18 * scale, W, 18 * scale);
    // District blocks
    for (const d of DISTRICTS) {
      g.fillStyle = '#' + d.color.toString(16).padStart(6, '0');
      g.globalAlpha = 0.55;
      g.fillRect(toX(d.x0), toZ(d.z0), (d.x1 - d.x0) * scale, (d.z1 - d.z0) * scale);
      g.globalAlpha = 1;
    }
    // Roads
    g.strokeStyle = '#5a5a68'; g.lineWidth = 1.5;
    for (let i = -4; i <= 4; i++) {
      const c = i * 60;
      g.beginPath(); g.moveTo(toX(c), 0); g.lineTo(toX(c), H); g.stroke();
      g.beginPath(); g.moveTo(0, toZ(c)); g.lineTo(W, toZ(c)); g.stroke();
    }
    // District labels
    g.fillStyle = 'rgba(255,255,255,0.75)';
    g.font = '7px sans-serif'; g.textAlign = 'center';
    for (const d of DISTRICTS) {
      g.fillText(d.short.toUpperCase(), toX((d.x0 + d.x1) / 2), toZ((d.z0 + d.z1) / 2));
    }
    // Route line: L-shaped along roads from player to the marker.
    const marker = ctx.marker;
    const px = state.car ? state.car.x : state.player.x;
    const pz = state.car ? state.car.z : state.player.z;
    if (marker) {
      g.strokeStyle = '#ffd76a'; g.lineWidth = 2; g.setLineDash([5, 3]);
      g.beginPath();
      g.moveTo(toX(px), toZ(pz));
      g.lineTo(toX(marker.x), toZ(pz));
      g.lineTo(toX(marker.x), toZ(marker.z));
      g.stroke();
      g.setLineDash([]);
      // Mission diamond
      g.fillStyle = '#ffd76a';
      g.save(); g.translate(toX(marker.x), toZ(marker.z)); g.rotate(Math.PI / 4);
      g.fillRect(-4, -4, 8, 8); g.restore();
      g.strokeStyle = '#7a5a10'; g.strokeRect(toX(marker.x) - 5, toZ(marker.z) - 5, 10, 10);
    }
    // Cops (only when Iris marks them, or always at wanted 3+)
    if (state.flags.copsMarked || state.wanted >= 3) {
      g.fillStyle = '#ff4040';
      for (const u of deps.police.units) {
        g.beginPath(); g.arc(toX(u.x), toZ(u.z), 2.5, 0, Math.PI * 2); g.fill();
      }
    }
    // Player arrow
    const heading = state.car ? state.car.heading : state.player.heading;
    g.save();
    g.translate(toX(px), toZ(pz));
    g.rotate(Math.atan2(Math.sin(heading), Math.cos(heading)) * 0 + heading);
    g.fillStyle = '#ffffff';
    g.beginPath(); g.moveTo(0, -6); g.lineTo(4.5, 5); g.lineTo(0, 2.5); g.lineTo(-4.5, 5); g.closePath(); g.fill();
    g.restore();
    // North marker
    g.fillStyle = '#ffd76a'; g.font = 'bold 10px sans-serif'; g.textAlign = 'left';
    g.fillText('N ↑', 6, 12);
  }

  function renderWeaponBar(state) {
    const bar = $('weapon-bar');
    if (!bar) return;
    bar.innerHTML = WEAPONS.map((w, i) => {
      const owned = state.weapons[w.id].owned;
      const wState = state.weapons[w.id];
      const sel = state.weapon === w.id;
      const ammo = w.mag === Infinity ? '∞' : `${wState.mag} / ${wState.reserve}`;
      const label = owned ? ammo : `LOCKED · $${w.price}`;
      return `<div class="wslot${sel ? ' sel' : ''}${owned ? '' : ' locked'}">
        <div class="wglyph">${w.glyph}</div>
        <div class="wname">${w.name}</div>
        <div class="wammo">${label}</div>
        <div class="wkey">${i + 1}</div></div>`;
    }).join('');
  }

  function renderCrewCards(state) {
    const el = $('crew-cards');
    if (!el) return;
    el.innerHTML = crewStatus(state).map((m) => `
      <div class="crew-card${m.ready ? '' : ' cooling'}">
        <img class="crew-face" src="${portraitURL(m)}" alt="${m.name}">
        <div class="crew-name">${m.name}</div>
        <div class="crew-role">${m.role}</div>
        <div class="crew-call">[${m.key}] ${m.call}</div>
        <div class="crew-state">${m.ready ? (m.cost ? '$' + m.cost : 'FREE') + ' · READY' : Math.ceil(m.cooldown) + 's'}</div>
      </div>`).join('');
  }

  function renderDispatch(state) {
    const el = $('dispatch');
    if (!el) return;
    const { rows, total, crime } = dispatchRows(deps.police, state);
    const rowsHtml = rows.length === 0
      ? '<div class="drow">No active units — lay low.</div>'
      : rows.map((r) => `<div class="drow"><span class="dcall">${r.callsign}</span> <span class="drole">${r.role}</span> <span class="ddist">${r.dist} m</span></div>`).join('');
    el.innerHTML = `<div class="dtitle">DISPATCH ${state.wanted > 0 ? '— ' + total + ' UNITS' : ''}</div>
      <div class="dwanted">WANTED FOR: ${crime}</div>${rowsHtml}
      <div class="dticker">${escapeHtml(state.dispatchTicker)}</div>`;
  }

  let lastHud = 0;
  function update(state, ctx, dt) {
    const now = performance.now();
    if (now - lastHud < 90) return;
    lastHud = now;
    // Top-left: district, money, rank, RP.
    const st = currentStanding(state);
    $('district-line').textContent = `${st.tier.label} · ${st.value}/100`;
    $('district-name').textContent = st.district.name;
    $('district-fill').style.width = st.value + '%';
    $('money').textContent = '$' + state.money.toLocaleString();
    $('rank-name').textContent = rankFor(state.rp) + ' · ' + state.rp + ' RP';
    const nxt = nextRank(state.rp);
    $('rp-fill').style.width = nxt ? Math.min(100, (state.rp / nxt.rp) * 100) + '%' : '100%';
    $('respect-line').textContent = 'RESPECT ' + state.respect;
    // Clock + day + radio
    $('clock').textContent = 'DAY ' + state.day + '  ' + clockText(state);
    $('radio-line').textContent = RADIO[state.radio].name;
    // Health / armour with numbers
    $('health-fill').style.width = state.health + '%';
    $('health-num').textContent = Math.round(state.health) + ' / 100';
    $('armour-fill').style.width = state.armour + '%';
    $('armour-num').textContent = Math.round(state.armour) + ' / 100';
    // Speed: real km/h from actual velocity
    const speedMs = state.car ? Math.abs(state.car.speed) : state.player.speed || 0;
    $('speed-num').textContent = Math.round(speedMs * 3.6);
    $('speed-damage').textContent = state.car ? 'DAMAGE ' + Math.round(state.car.damage) + '%' : '';
    // Wanted stars
    $('wanted').innerHTML = [1, 2, 3, 4, 5].map((i) => `<span class="star${i <= state.wanted ? ' on' : ''}">★</span>`).join('');
    // Mission header with stage pips
    const obj = missionObjective(state);
    const mh = $('mission-header');
    if (obj) {
      const pips = Array.from({ length: obj.total }, (_, i) => `<span class="pip${i < obj.stage ? ' done' : i === obj.stage ? ' cur' : ''}">●</span>`).join('');
      mh.innerHTML = obj.started
        ? `MISSION ${obj.missionNumber} · ${obj.title} — STAGE ${obj.stage + 1}/${obj.total}: ${obj.stageName} ${pips}<br><span class="next">NEXT: ${escapeHtml(obj.next)}</span><br><span class="tagline">MARAVILLA · 10 story missions · 5 vehicles · 5-star wanted · open coastal city</span>`
        : `NEXT JOB: ${obj.title} ${pips}<br><span class="next">NEXT: ${escapeHtml(obj.next)}</span><br><span class="tagline">MARAVILLA · 10 story missions · 5 vehicles · 5-star wanted · open coastal city</span>`;
    } else {
      mh.innerHTML = 'ALL MISSIONS COMPLETE — Maravilla is yours.';
    }
    renderWeaponBar(state);
    renderCrewCards(state);
    renderDispatch(state);
    drawMinimap(state, ctx);
    // Race / taxi overlays
    const raceEl = $('race-hud');
    if (state.race && !state.race.done) {
      raceEl.classList.remove('hidden');
      $('race-line').textContent = `POSITION ${state.race.position || 1}/4 · CHECKPOINT ${state.race.cp}/${3 + 1} · ${Math.max(0, Math.ceil(state.race.limit - state.race.time))}s`;
    } else raceEl.classList.add('hidden');
    const taxiEl = $('taxi-hud');
    if (state.taxi) {
      taxiEl.classList.remove('hidden');
      $('taxi-line').textContent = state.taxi.phase === 'pickup' ? 'TAXI — pick up the passenger' : `TAXI — drop off · ${Math.max(0, Math.ceil(state.taxi.limit - state.taxi.time))}s left`;
    } else taxiEl.classList.add('hidden');
    // Dialogue auto-hide (pinned while a staged shot is running, so the
    // mission shot keeps Vera's line on screen).
    if (!state.flags.shot && now - lastDialogue > 9000) $('dialogue').classList.add('hidden');
  }

  return { say, showDialogue, update, renderWeaponBar, renderCrewCards };
}
