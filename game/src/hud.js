// hud.js — the MARAVILLA heads-up display: minimap, bars, dispatch panel,
// crew cards, NEXT JOB header, message feed, weapon bar, rank line.
// Written from the prose design spec. Updates every HUD DOM id in the
// shared contract. The message feed is kept above the rank line, and the
// dialogue box is kept above the weapon bar — never covering it.

import { drawPortrait } from './portraits.js';

const RADIO_STATIONS = ['Faro Rock 101', 'Maravilla Nights', 'Sol FM'];

const WEAPONS = [
  { id: 'fists', name: 'Fists', price: 0, key: '1' },
  { id: 'pistol', name: 'Pistol', price: 0, key: '2' },
  { id: 'smg', name: 'SMG', price: 900, key: '3' },
  { id: 'shotgun', name: 'Shotgun', price: 1100, key: '4' },
  { id: 'rifle', name: 'Rifle', price: 1600, key: '5' },
  { id: 'rpg', name: 'Trueno RPG', price: 2500, key: '6' },
];

const CREW_CARDS = [
  { id: 'luz', name: 'Mama Luz', role: 'Next job', key: 'B', cost: 0 },
  { id: 'celia', name: 'Celia Reyes', role: 'Scrub heat −2★', key: 'Z', cost: 150 },
  { id: 'tito', name: 'Tito Fuentes', role: 'Repair ride', key: 'X', cost: 100 },
  { id: 'marlon', name: 'Big Marlon', role: 'Clear cops', key: 'V', cost: 200 },
];

// District zones (metres), matching the city module's DISTRICT_RECTS —
// the built world's rects are authoritative, so the HUD label, the
// minimap blocks and the standing bar all agree with where the player is.
const DISTRICT_ZONES = [
  { name: 'Marina Alba', x0: -300, x1: -100, z0: -300, z1: 0, label: { x: -200, z: -150 } },
  { name: 'Centro Alba', x0: -100, x1: 100, z0: -300, z1: 0, label: { x: 0, z: -150 } },
  { name: 'El Faro', x0: 100, x1: 300, z0: -300, z1: 0, label: { x: 200, z: -150 } },
  { name: 'Paseo del Mar', x0: -300, x1: -100, z0: 0, z1: 300, label: { x: -200, z: 150 } },
  { name: 'Estadio Sol', x0: -100, x1: 100, z0: 0, z1: 300, label: { x: 0, z: 150 } },
  { name: 'Miramar', x0: 100, x1: 300, z0: 0, z1: 300, label: { x: 200, z: 150 } },
];

const RANKS = [
  { at: 4500, name: 'LEYENDA' },
  { at: 2400, name: 'SHOT CALLER' },
  { at: 1200, name: 'FIXER' },
  { at: 500, name: 'HUSTLER' },
  { at: 0, name: 'ROOKIE' },
];

function districtAt(x, z) {
  for (const d of DISTRICT_ZONES) {
    if (x >= d.x0 && x < d.x1 && z >= d.z0 && z < d.z1) return d.name;
  }
  return 'Centro Alba';
}

function tierOf(standing) {
  if (standing >= 75) return 'LOYAL';
  if (standing >= 50) return 'WARM';
  if (standing >= 25) return 'NEUTRAL';
  if (standing >= 0) return 'COLD';
  return 'HOSTILE';
}

function fmtClock(minutes) {
  const m = Math.floor(minutes || 0) % 1440;
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
}

function el(id) {
  if (typeof document === 'undefined') return null;
  return document.getElementById(id);
}

function setText(id, text) {
  const n = el(id);
  if (n) n.textContent = text;
}

function setWidth(id, pct) {
  const n = el(id);
  if (n) n.style.width = `${Math.max(0, Math.min(100, pct))}%`;
}

// --- Drawn weapon icons (canvas 2D shapes only) ---------------------------
function weaponIcon(weaponId) {
  const c = document.createElement('canvas');
  c.width = 44;
  c.height = 32;
  const ctx = c.getContext('2d');
  ctx.strokeStyle = '#f2e8c9';
  ctx.fillStyle = '#f2e8c9';
  ctx.lineWidth = 3;
  ctx.lineCap = 'round';
  if (weaponId === 'fists') {
    ctx.beginPath();
    ctx.arc(15, 16, 8, 0, Math.PI * 2);
    ctx.arc(29, 16, 8, 0, Math.PI * 2);
    ctx.stroke();
  } else if (weaponId === 'pistol') {
    ctx.fillRect(8, 10, 24, 6);
    ctx.fillRect(26, 16, 5, 10);
    ctx.fillRect(10, 16, 4, 6);
  } else if (weaponId === 'smg') {
    ctx.fillRect(6, 11, 26, 5);
    ctx.fillRect(24, 16, 4, 9);
    ctx.fillRect(12, 16, 3, 7);
    ctx.fillRect(30, 12, 8, 3);
  } else if (weaponId === 'shotgun') {
    ctx.fillRect(4, 12, 34, 4);
    ctx.fillRect(6, 17, 30, 3);
    ctx.fillRect(26, 20, 5, 7);
  } else if (weaponId === 'rifle') {
    ctx.fillRect(4, 12, 36, 4);
    ctx.fillRect(14, 16, 3, 6);
    ctx.fillRect(28, 16, 4, 8);
    ctx.fillRect(36, 13, 5, 2);
  } else {
    // Trueno RPG: long tube with a cone warhead.
    ctx.fillRect(4, 13, 28, 6);
    ctx.beginPath();
    ctx.moveTo(32, 10);
    ctx.lineTo(42, 16);
    ctx.lineTo(32, 22);
    ctx.closePath();
    ctx.fill();
    ctx.fillRect(10, 19, 4, 7);
  }
  return c;
}

// --- Minimap ---------------------------------------------------------------
function drawMinimap(state) {
  const canvas = el('minimap');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const w = canvas.width || 180;
  const h = canvas.height || 180;
  const toMap = (x, z) => ({
    x: ((x + 300) / 600) * w,
    y: ((z + 300) / 600) * h,
  });

  // Sea and land.
  ctx.fillStyle = '#16324a';
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = '#2a2f33';
  ctx.fillRect(0, 0, w, h);

  // District blocks.
  const colors = ['#3a4a5a', '#5a4632', '#4a3a4a', '#2f4a3a', '#54452a', '#3a3a4a'];
  DISTRICT_ZONES.forEach((d, i) => {
    const a = toMap(d.x0, d.z0);
    const b = toMap(d.x1, d.z1);
    ctx.fillStyle = colors[i % colors.length];
    ctx.fillRect(a.x, a.y, b.x - a.x, b.y - a.y);
  });

  // Roads: a simple grid.
  ctx.strokeStyle = '#6a6a5a';
  ctx.lineWidth = 2;
  for (let i = -200; i <= 200; i += 100) {
    const a = toMap(i, -300);
    const b = toMap(i, 300);
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
    const c = toMap(-300, i);
    const d = toMap(300, i);
    ctx.beginPath();
    ctx.moveTo(c.x, c.y);
    ctx.lineTo(d.x, d.y);
    ctx.stroke();
  }

  // Route line to the objective.
  const p = state.player || {};
  const obj = state.missions && state.missions.objectivePos;
  if (obj && state.missions.markerVisible !== false) {
    const from = toMap(p.x || 0, p.z || 0);
    const to = toMap(obj.x, obj.z);
    ctx.strokeStyle = '#ffd23a';
    ctx.lineWidth = 2;
    ctx.setLineDash([5, 4]);
    ctx.beginPath();
    ctx.moveTo(from.x, from.y);
    ctx.lineTo(to.x, to.y);
    ctx.stroke();
    ctx.setLineDash([]);
    // Objective marker: a diamond.
    ctx.fillStyle = '#ffd23a';
    ctx.beginPath();
    ctx.moveTo(to.x, to.y - 7);
    ctx.lineTo(to.x + 6, to.y);
    ctx.lineTo(to.x, to.y + 7);
    ctx.lineTo(to.x - 6, to.y);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = '#111';
    ctx.lineWidth = 1;
    ctx.stroke();
  }

  // Player arrow (rotates with heading).
  const pp = toMap(p.x || 0, p.z || 0);
  const heading = p.heading || 0;
  ctx.save();
  ctx.translate(pp.x, pp.y);
  ctx.rotate(heading);
  ctx.fillStyle = '#37e08b';
  ctx.beginPath();
  ctx.moveTo(0, -7);
  ctx.lineTo(5, 6);
  ctx.lineTo(0, 3);
  ctx.lineTo(-5, 6);
  ctx.closePath();
  ctx.fill();
  ctx.restore();

  // District labels.
  ctx.fillStyle = 'rgba(255,255,255,0.75)';
  ctx.font = '8px sans-serif';
  ctx.textAlign = 'center';
  for (const d of DISTRICT_ZONES) {
    const pos = toMap(d.label.x, d.label.z);
    ctx.fillText(d.name.toUpperCase(), pos.x, pos.y);
  }

  // North marker.
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 11px sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('N ↑', 6, 14);
}

// --- Message feed ------------------------------------------------------------
const MAX_FEED = 5;

export function createHud(state, bus) {
  const feed = [];
  let crewBuilt = false;
  let weaponBuilt = false;
  let feedGuarded = false;

  // Keep the message feed above the rank line in the DOM so it can never
  // overlap it, whatever the shell's CSS does.
  function guardFeedOrder() {
    if (feedGuarded) return;
    feedGuarded = true;
    const feedEl = el('message-feed');
    const rankEl = el('rank-line');
    if (feedEl && rankEl && feedEl.parentElement === rankEl.parentElement) {
      feedEl.parentElement.insertBefore(feedEl, rankEl);
    }
    // The dialogue box must sit above the weapon bar, never covering it.
    const dlg = el('dialogue-box');
    const bar = el('weapon-bar');
    if (dlg && bar) {
      dlg.style.bottom = '150px';
      dlg.style.zIndex = '30';
      bar.style.zIndex = '20';
    }
  }

  function pushMessage(text) {
    feed.push(text);
    while (feed.length > MAX_FEED) feed.shift();
    const feedEl = el('message-feed');
    if (!feedEl) return;
    feedEl.innerHTML = feed.map((m) => `<div class="feed-line">${m}</div>`).join('');
  }

  function updateBars() {
    const p = state.player || {};
    const health = Math.max(0, Math.min(100, p.health ?? 100));
    const armour = Math.max(0, Math.min(100, p.armour ?? 25));
    setWidth('health-fill', health);
    setText('health-num', String(Math.round(health)));
    setWidth('armour-fill', armour);
    setText('armour-num', String(Math.round(armour)));
    setText('money', `$${Number(p.money || 0).toLocaleString('en-US')}`);
    const speed = Math.round(p.speedKmh || 0);
    setText('speed-num', String(speed));
    setText('speed-label', p.onFoot ? 'km/h on foot' : 'km/h');
  }

  function updateWanted() {
    const level = (state.wanted && state.wanted.level) || 0;
    const stars = el('wanted-stars');
    if (stars) {
      stars.textContent = '★'.repeat(level) + '☆'.repeat(5 - level);
      stars.classList.toggle('hot', level >= 3);
    }
  }

  function updateClockRadio() {
    const clock = state.clock || {};
    setText('clock-label', fmtClock(clock.minutes));
    setText('day-label', `DAY ${clock.day || 1}`);
    const radio = state.radio || {};
    const station = RADIO_STATIONS[radio.station ?? 0] || RADIO_STATIONS[0];
    setText('radio-label', radio.muted ? `${station} (muted)` : station);
  }

  function updateDistrict() {
    const p = state.player || {};
    const name = districtAt(p.x || 0, p.z || 0);
    const standing = (state.districts && state.districts.standing && state.districts.standing[name]) ?? 50;
    const tier = tierOf(standing);
    setText('district-label', `${name} — ${tier}`);
    setWidth('district-bar', ((standing + 100) / 200) * 100);
    const note = el('district-note');
    if (note) {
      if (tier === 'LOYAL') note.textContent = 'Loyal: heat fades fast, prices 10% off, jobs pay +25%.';
      else if (tier === 'HOSTILE') note.textContent = 'Hostile: job board closed, heat rises fast. Lay low.';
      else note.textContent = `Standing ${standing} — missions here lift it, crimes lower it.`;
    }
  }

  function updateDispatch() {
    const rowsEl = el('dispatch-rows');
    const panel = el('dispatch-panel');
    if (!rowsEl) return;
    const d = state.dispatch || {};
    const units = Array.isArray(d.units) ? d.units : [];
    const wanted = (state.wanted && state.wanted.level) || 0;
    if (panel) panel.style.display = wanted > 0 || units.length > 0 ? 'block' : 'none';
    const rows = units.slice(0, 6).map((u) => {
      const dist = Math.round(u.distanceM ?? u.distance ?? 0);
      return `<div class="dispatch-row"><span class="callsign">${u.callsign || 'UNIT'}</span><span class="role">${u.role || 'Pursuit'}</span><span class="dist">${dist}m</span></div>`;
    });
    while (rows.length < 6) rows.push('<div class="dispatch-row empty"><span>—</span><span>No unit</span><span></span></div>');
    rowsEl.innerHTML = rows.join('');
    setText('dispatch-ticker', d.ticker || (wanted > 0 ? 'All units: suspect last seen in the city centre.' : 'Maravilla PD — all quiet.'));
    setText('dispatch-crime', (state.wanted && state.wanted.crime) || (wanted > 0 ? 'WANTED' : 'No active warrant'));
  }

  function buildCrewCards() {
    const wrap = el('crew-cards');
    if (!wrap) return;
    wrap.innerHTML = '';
    for (const c of CREW_CARDS) {
      const card = document.createElement('div');
      card.className = 'crew-card';
      card.id = `crew-${c.id}`;
      const portrait = drawPortrait(c.name, 48);
      const label = document.createElement('div');
      label.className = 'crew-label';
      label.innerHTML = `<strong>${c.name}</strong><span>${c.role}</span><span class="crew-key">[${c.key}]${c.cost ? ` $${c.cost}` : ''}</span><span class="crew-cd"></span>`;
      card.appendChild(portrait);
      card.appendChild(label);
      wrap.appendChild(card);
    }
    crewBuilt = true;
  }

  function updateCrewCards() {
    if (!crewBuilt) buildCrewCards();
    const cooldowns = (state.crew && (state.crew.cooldowns || state.crew.cooldown)) || {};
    for (const c of CREW_CARDS) {
      const card = el(`crew-${c.id}`);
      if (!card) continue;
      const cd = cooldowns[c.id] || 0;
      const cdEl = card.querySelector('.crew-cd');
      if (cdEl) cdEl.textContent = cd > 0 ? `Cooling down ${Math.ceil(cd)}s` : 'Ready';
      card.classList.toggle('cooling', cd > 0);
    }
  }

  function updateNextJob() {
    const m = state.missions || {};
    const payout = m.payout ? ` · PAYOUT $${Number(m.payout).toLocaleString('en-US')}` : '';
    setText('mission-title', m.title ? `MISSION ${(m.current ?? 0) + 1} — ${m.title}${payout}` : 'NO ACTIVE MISSION');
    const pips = el('stage-pips');
    if (pips) {
      const total = m.stageTotal || 0;
      const cur = m.stage || 0;
      let html = '';
      for (let i = 0; i < total; i += 1) {
        html += `<span class="pip ${i < cur ? 'done' : i === cur ? 'current' : ''}">●</span>`;
      }
      pips.innerHTML = html;
    }
    const next = el('next-objective');
    if (next) {
      const stageName = m.stageName ? ` — ${m.stageName}` : '';
      const total = m.stageTotal || 0;
      next.textContent = total
        ? `STAGE ${(m.stage || 0) + 1}/${total}${stageName} — NEXT: ${m.objective || ''}`
        : (m.objective || '');
    }
    const header = el('next-job');
    if (header) header.style.display = m.title ? 'block' : 'none';
  }

  function buildWeaponBar() {
    const bar = el('weapon-bar');
    if (!bar) return;
    bar.innerHTML = '';
    WEAPONS.forEach((w, i) => {
      const slot = document.createElement('div');
      slot.className = 'weapon-slot';
      slot.id = `weapon-slot-${i}`;
      slot.appendChild(weaponIcon(w.id));
      const label = document.createElement('div');
      label.className = 'weapon-label';
      label.innerHTML = `<span class="weapon-name">${w.name}</span><span class="weapon-ammo"></span><span class="weapon-state"></span>`;
      slot.appendChild(label);
      bar.appendChild(slot);
    });
    weaponBuilt = true;
  }

  function updateWeaponBar() {
    if (!weaponBuilt) buildWeaponBar();
    const w = state.weapons || {};
    const owned = new Set(w.owned || ['fists', 'pistol']);
    const ammo = w.ammo || {};
    const current = w.current ?? 0;
    WEAPONS.forEach((def, i) => {
      const slot = el(`weapon-slot-${i}`);
      if (!slot) return;
      const isOwned = owned.has(def.id);
      const isCurrent = i === current;
      slot.classList.toggle('locked', !isOwned);
      slot.classList.toggle('current', isCurrent);
      const ammoEl = slot.querySelector('.weapon-ammo');
      if (ammoEl) {
        if (def.id === 'fists') ammoEl.textContent = '∞';
        else if (!isOwned) ammoEl.textContent = '';
        else {
          const mag = ammo[def.id] != null ? ammo[def.id].mag : 12;
          const reserve = ammo[def.id] != null ? ammo[def.id].reserve : 60;
          ammoEl.textContent = `${mag} / ${reserve}`;
        }
      }
      const stateEl = slot.querySelector('.weapon-state');
      if (stateEl) stateEl.textContent = !isOwned ? `LOCKED — $${def.price}` : isCurrent ? 'EQUIPPED' : `[${def.key}]`;
    });
  }

  function updateRank() {
    const s = state.stats || {};
    const rp = s.rp || 0;
    let rank = 'ROOKIE';
    let next = null;
    for (const r of RANKS) {
      if (rp >= r.at) {
        rank = r.name;
        break;
      }
    }
    for (const r of RANKS) {
      if (rp < r.at) next = r;
    }
    const need = next ? ` — ${next.at - rp} RP to ${next.name}` : ' — top rank';
    setText('rank-line', `${rank} — ${rp} RP${need} — Respect ${s.respect || 0}`);
  }

  function showDialogue(lines) {
    const box = el('dialogue-box');
    if (!box || !lines || !lines.length) return;
    // Sit above the weapon bar, never covering it.
    box.style.bottom = '150px';
    box.style.display = 'block';
    const first = lines[0];
    box.innerHTML = '';
    const portrait = drawPortrait(first.speaker, 64);
    const text = document.createElement('div');
    text.className = 'dialogue-text';
    text.innerHTML = `<strong>${first.speaker}</strong><p>${first.text}</p><span class="dialogue-hint">Click / E to continue (${lines.length} lines)</span>`;
    box.appendChild(portrait);
    box.appendChild(text);
    let idx = 0;
    const advance = () => {
      idx += 1;
      if (idx >= lines.length) {
        box.style.display = 'none';
        box.removeEventListener('click', advance);
        if (state.flags) state.flags.dialogue = null;
        return;
      }
      const line = lines[idx];
      box.innerHTML = '';
      box.appendChild(drawPortrait(line.speaker, 64));
      const t = document.createElement('div');
      t.className = 'dialogue-text';
      t.innerHTML = `<strong>${line.speaker}</strong><p>${line.text}</p><span class="dialogue-hint">Click / E to continue</span>`;
      box.appendChild(t);
    };
    box.addEventListener('click', advance);
    if (state.flags) state.flags.dialogue = lines;
  }

  function update() {
    guardFeedOrder();
    updateBars();
    updateWanted();
    updateClockRadio();
    updateDistrict();
    updateDispatch();
    updateCrewCards();
    updateNextJob();
    updateWeaponBar();
    updateRank();
    drawMinimap(state);
  }

  if (bus && typeof bus.on === 'function') {
    bus.on('message', (d) => {
      if (d && d.text) pushMessage(d.text);
    });
    bus.on('dialogue:show', (d) => {
      if (d && d.lines) showDialogue(d.lines);
    });
    bus.on('mission:started', (d) => {
      if (d) pushMessage(`Mission started: ${d.title}`);
    });
    bus.on('mission:complete', (d) => {
      if (d) pushMessage(`Mission complete: ${d.title} — rating ${d.rating} (+$${d.money}, +${d.rp} RP)`);
    });
  }

  // Initial build so every panel exists before the first frame.
  buildCrewCards();
  buildWeaponBar();
  update();

  return {
    update,
    pushMessage,
    showDialogue,
    drawMinimap,
    WEAPONS,
    CREW_CARDS,
    districtAt,
  };
}
