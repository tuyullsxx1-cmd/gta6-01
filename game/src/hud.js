// HUD: syncs the existing DOM (ids from index.html) from state every frame,
// throttled to ~10 Hz for text, and draws the minimap on #minimap.
// Listens to the event bus for 'message', 'mission' and 'subtitle'.
// No new DOM ids are created.

import { CITY, RADIO, VEHICLES, WEAPONS, WEAPON_ORDER, WEAPON_SHOP, DISTRICTS, MISSION_NAMES, ACTS, districtLabel, rankFor } from './config.js';
import { portraitUrl, speakerPortrait } from './portraits.js';

// Tiny geometric SVG icons for the weapon bar (no emoji, no images).
const WEAPON_ICONS = {
  fists: '<svg viewBox="0 0 24 24" width="22" height="22"><circle cx="8" cy="12" r="5" fill="currentColor"/><circle cx="16" cy="12" r="5" fill="currentColor"/></svg>',
  pistol: '<svg viewBox="0 0 24 24" width="22" height="22"><path d="M3 5h16v4H11v9H7v-9H3z" fill="currentColor"/></svg>',
  smg: '<svg viewBox="0 0 24 24" width="22" height="22"><rect x="3" y="8" width="16" height="5" fill="currentColor"/><rect x="10" y="13" width="3" height="7" fill="currentColor"/><rect x="16" y="8" width="3" height="3" fill="currentColor"/></svg>',
  shotgun: '<svg viewBox="0 0 24 24" width="22" height="22"><rect x="2" y="10" width="20" height="3" fill="currentColor"/><rect x="12" y="13" width="4" height="5" fill="currentColor"/></svg>',
  rifle: '<svg viewBox="0 0 24 24" width="22" height="22"><rect x="2" y="10" width="20" height="2.5" fill="currentColor"/><rect x="12" y="6" width="5" height="3" fill="currentColor"/><rect x="14" y="12.5" width="3" height="6" fill="currentColor"/></svg>',
  launcher: '<svg viewBox="0 0 24 24" width="22" height="22"><rect x="2" y="10" width="17" height="4" rx="2" fill="currentColor"/><path d="M19 8l5 4-5 4z" fill="currentColor"/></svg>',
};

export function createHud(ctx) {
  const { state, events } = ctx;
  const $ = (id) => document.getElementById(id);
  const els = {
    health: $('health-fill'), armour: $('armour-fill'),
    healthNum: $('health-num'), armourNum: $('armour-num'),
    money: $('money'), respect: $('respect'),
    district: $('district'), districtFill: $('district-fill'), districtFx: $('district-fx'),
    dispatch: $('dispatch'), crewCards: $('crew-cards'),
    missionStage: $('mission-stage'),
    clock: $('clock'), radio: $('radio'), stars: $('stars'),
    speed: $('speed'), speedUnit: $('speed-unit'), vehicleName: $('vehicle-name'),
    weaponName: $('weapon-name'), weaponAmmo: $('weapon-ammo'),
    weaponBar: $('weapon-bar'),
    objective: $('objective'), feed: $('message-feed'),
    banner: $('mission-banner'), bannerTitle: $('mission-title'), bannerSub: $('mission-sub'),
    subtitle: $('subtitle'), minimap: $('minimap'), crosshair: $('crosshair'),
  };
  const mapCtx = els.minimap ? els.minimap.getContext('2d') : null;

  let textTimer = 0;
  let bannerUntil = -1;
  let subtitleUntil = -1;

  function renderFeed() {
    if (!els.feed) return;
    els.feed.innerHTML = '';
    for (const m of state.messages.slice(0, 5)) {
      const div = document.createElement('div');
      div.textContent = m.text;
      const age = state.time - m.at;
      div.style.opacity = String(Math.max(0.25, 1 - age / 12));
      if (m.kind === 'bad') div.style.color = '#ff9a9a';
      else if (m.kind === 'good') div.style.color = '#7be495';
      els.feed.appendChild(div);
    }
  }

  function message(text, kind = 'info') {
    state.messages.unshift({ text, at: state.time, kind });
    if (state.messages.length > 5) state.messages.length = 5;
    renderFeed();
  }

  function banner(title, sub = '') {
    if (!els.banner) return;
    if (els.bannerTitle) els.bannerTitle.textContent = title;
    if (els.bannerSub) els.bannerSub.textContent = sub;
    els.banner.style.display = 'block';
    bannerUntil = state.time + 4;
  }

  function subtitle(text, seconds = 3) {
    if (!els.subtitle) return;
    // "Celia: ..." renders with a speaker chip + drawn portrait; anything
    // else is plain text.
    const m = /^([A-Za-z' ]+):\s([\s\S]*)$/.exec(text);
    if (m) {
      const pid = speakerPortrait(m[1]);
      const img = pid ? `<img class="sp-portrait" src="${portraitUrl(pid)}" alt="">` : '';
      els.subtitle.innerHTML = `${img}<span class="sp-chip">${m[1]}</span> ${m[2]}`;
    } else {
      els.subtitle.textContent = text;
    }
    els.subtitle.style.display = 'block';
    subtitleUntil = state.time + seconds;
  }

  function setObjective(text) {
    state.objective = text;
    if (els.objective) els.objective.textContent = text;
  }

  function drawMinimap() {
    if (!mapCtx || !els.minimap) return;
    const S = 190;
    const scale = S / 620; // world -310..310 -> 0..190
    const toX = (x) => S / 2 + x * scale;
    const toY = (z) => S / 2 + z * scale;
    const g = mapCtx;
    g.clearRect(0, 0, S, S);
    // Sea + sand on the east edge.
    g.fillStyle = '#0d2f45';
    g.fillRect(0, 0, S, S);
    g.fillStyle = '#123a5c';
    g.fillRect(toX(300), 0, S - toX(300), S);
    g.fillStyle = '#c9b078';
    g.fillRect(toX(264), 0, toX(300) - toX(264), S);
    // City blocks.
    g.fillStyle = '#232a33';
    g.fillRect(toX(-300), toY(-300), 600 * scale, 600 * scale);
    // Roads.
    g.strokeStyle = '#4a545e';
    g.lineWidth = Math.max(2, CITY.roadWidth * scale);
    for (const c of CITY.roads) {
      g.beginPath(); g.moveTo(toX(c), 0); g.lineTo(toX(c), S); g.stroke();
      g.beginPath(); g.moveTo(0, toY(c)); g.lineTo(S, toY(c)); g.stroke();
    }
    // District labels (short names at district centres).
    g.fillStyle = 'rgba(207,214,222,0.75)';
    g.font = 'bold 8px system-ui, sans-serif';
    g.textAlign = 'center';
    for (const d of DISTRICTS) {
      const cx = (d.minX + d.maxX) / 2;
      const cz = (d.minZ + d.maxZ) / 2;
      const short = d.name.split(' ')[0].toUpperCase();
      g.fillText(short, toX(cx), toY(cz));
    }
    // Route line: player -> mission marker (dashed gold), so the minimap
    // reads as a road map, not a dot grid.
    const marker = state.mission && state.mission.marker;
    if (marker) {
      g.strokeStyle = '#ffd94d';
      g.lineWidth = 2;
      g.setLineDash([5, 4]);
      g.beginPath();
      g.moveTo(toX(state.player.x), toY(state.player.z));
      g.lineTo(toX(marker.x), toY(marker.z));
      g.stroke();
      g.setLineDash([]);
    }
    // N indicator.
    g.fillStyle = '#ffd94d';
    g.font = 'bold 11px system-ui, sans-serif';
    g.textAlign = 'center';
    g.fillText('N', S / 2, 12);
    g.beginPath();
    g.moveTo(S / 2, 15); g.lineTo(S / 2 - 4, 22); g.lineTo(S / 2 + 4, 22);
    g.closePath(); g.fill();
    // Mission marker (yellow diamond).
    if (marker) {
      const mx = toX(marker.x);
      const my = toY(marker.z);
      g.fillStyle = '#ffd94d';
      g.beginPath();
      g.moveTo(mx, my - 7); g.lineTo(mx + 6, my); g.lineTo(mx, my + 7); g.lineTo(mx - 6, my);
      g.closePath(); g.fill();
    }
    // Cop dots (only while wanted).
    if (state.player.wanted > 0) {
      g.fillStyle = '#4fa8e8';
      for (const cop of state.cops) {
        g.beginPath(); g.arc(toX(cop.x), toY(cop.z), 3, 0, Math.PI * 2); g.fill();
      }
    }
    // Player arrow, rotated with heading (heading 0 = +z = canvas down).
    const px = toX(state.player.x);
    const py = toY(state.player.z);
    g.save();
    g.translate(px, py);
    g.rotate(Math.PI - state.player.heading);
    g.fillStyle = state.player.vehicleId !== null ? '#7be495' : '#ffffff';
    g.beginPath();
    g.moveTo(0, -8); g.lineTo(5.5, 6); g.lineTo(-5.5, 6);
    g.closePath(); g.fill();
    g.restore();
  }

  /** Maravilla PD dispatch: every active unit by callsign + role + live
   * distance, nearest first, up to 6 rows + a "+N more" line, the crime
   * that brought the heat, and a live ticker of the latest dispatch. */
  function renderDispatch() {
    if (!els.dispatch) return;
    const p = state.player;
    if (state.screen !== 'play' || p.wanted <= 0) {
      if (els.dispatch.style.display !== 'none') els.dispatch.style.display = 'none';
      return;
    }
    const units = [];
    for (const cop of state.cops) {
      units.push({
        call: cop.callsign || cop.id, role: cop.role || cop.kind,
        d: Math.hypot(cop.x - p.x, cop.z - p.z),
      });
    }
    const rbs = (ctx.police && ctx.police.roadblocks) || [];
    for (const rb of rbs) {
      units.push({
        call: rb.callsign || rb.id, role: rb.role || 'ROADBLOCK',
        d: Math.hypot(rb.x - p.x, rb.z - p.z),
      });
    }
    if (state.heli) {
      units.push({
        call: state.heli.callsign || 'AIR-1', role: state.heli.role || 'AIR UNIT',
        d: Math.hypot(state.heli.x - p.x, state.heli.z - p.z),
      });
    }
    units.sort((a, b) => a.d - b.d);
    const shown = units.slice(0, 6);
    let html = `<div class="dp-title">MPD RESPONSE — ${units.length} UNIT${units.length > 1 ? 'S' : ''}</div>`;
    if (state.crimeLabel) html += `<div class="dp-crime">WANTED FOR: ${state.crimeLabel}</div>`;
    for (const u of shown) {
      html += `<div class="dp-row"><span class="dp-call">${u.call}</span>`
        + `<span class="dp-role">${u.role}</span><span class="dp-dist">${Math.round(u.d)} m</span></div>`;
    }
    if (units.length > shown.length) {
      html += `<div class="dp-more">+${units.length - shown.length} more</div>`;
    }
    const latest = state.messages[0];
    if (latest) html += `<div class="dp-ticker">DISPATCH: ${latest.text}</div>`;
    els.dispatch.innerHTML = html;
    els.dispatch.style.display = 'block';
  }

  /** Persistent weapon slot bar: every slot, icon, ammo, LOCKED state.
   * Always visible in play (unlike the Tab wheel). Click a slot to select
   * it (locked ones explain themselves). */
  let weaponBarBuilt = false;
  function renderWeaponBar() {
    if (!els.weaponBar) return;
    if (state.screen !== 'play') {
      if (els.weaponBar.style.display !== 'none') els.weaponBar.style.display = 'none';
      return;
    }
    if (!weaponBarBuilt) {
      weaponBarBuilt = true;
      els.weaponBar.innerHTML = '';
      for (const id of WEAPON_ORDER) {
        const slot = document.createElement('div');
        slot.className = 'wb-slot';
        slot.dataset.weapon = id;
        slot.innerHTML = `<span class="wb-icon">${WEAPON_ICONS[id] || ''}</span>`
          + `<span class="wb-name">${(WEAPONS[id] || {}).name || id}</span>`
          + `<span class="wb-ammo"></span><span class="wb-lock"></span>`;
        slot.addEventListener('click', () => {
          if (ctx.weapons && ctx.weapons.selectWeapon) ctx.weapons.selectWeapon(id);
        });
        els.weaponBar.appendChild(slot);
      }
      els.weaponBar.style.pointerEvents = 'auto';
    }
    const owned = state.player.weaponsOwned || ['fists', 'pistol'];
    for (const slot of els.weaponBar.children) {
      const id = slot.dataset.weapon;
      const w = WEAPONS[id];
      const isOwned = owned.includes(id);
      const isCurrent = state.player.weapon === id;
      slot.classList.toggle('current', isCurrent);
      slot.classList.toggle('locked', !isOwned);
      const ammoEl = slot.querySelector('.wb-ammo');
      if (ammoEl) {
        ammoEl.textContent = !isOwned ? '' : (Number.isFinite(w.mag)
          ? `${state.player.mag[id] || 0}/${state.player.ammo[id] || 0}` : '∞');
      }
      const lockEl = slot.querySelector('.wb-lock');
      if (lockEl) {
        lockEl.textContent = isOwned ? '' : `LOCKED${WEAPON_SHOP[id] ? ` · $${WEAPON_SHOP[id].price}` : ''}`;
      }
    }
    els.weaponBar.style.display = 'flex';
  }

  /** Crew ability cards: visible without opening the phone, with the
   * quick-call key (Z/X/V/B), cooldown state, and a drawn portrait. */
  function renderCrewCards() {
    if (!els.crewCards) return;
    if (state.screen !== 'play' || !ctx.phone || !ctx.phone.crewStatus) {
      if (els.crewCards.style.display !== 'none') els.crewCards.style.display = 'none';
      return;
    }
    let html = '';
    for (const r of ctx.phone.crewStatus()) {
      const nm = r.id === 'marlon' ? 'MARLON' : r.name.split(' ')[0].toUpperCase();
      const cls = r.cooldownLeft > 0 ? 'cd' : (!r.affordable ? 'broke' : '');
      html += `<div class="crew-card"><img class="crew-portrait" src="${portraitUrl(r.id)}" alt="">`
        + `<span class="crew-key">${r.quickKey}</span>`
        + `<span class="crew-name">${nm}</span>`
        + `<span class="crew-ability">${r.short}${r.cost ? ` · $${r.cost}` : ''}</span>`
        + `<span class="crew-state ${cls}">${r.state}</span></div>`;
    }
    els.crewCards.innerHTML = html;
    els.crewCards.style.display = 'flex';
  }

  /** Staged mission line: MISSION N · TITLE — STAGE x/y: NAME · NEXT: ...
   * Between missions it shows the NEXT JOB instead, with stage pips for
   * all ten missions (filled = done, current = gold). */
  function renderMissionStage() {
    if (!els.missionStage) return;
    if (state.screen !== 'play') {
      if (els.missionStage.style.display !== 'none') els.missionStage.style.display = 'none';
      return;
    }
    const m = state.mission;
    if (!m) {
      if (state.nextMission >= MISSION_NAMES.length) {
        els.missionStage.innerHTML = '<b>THE LAST SCORE IS DONE — MARAVILLA IS YOURS</b>';
        els.missionStage.style.display = 'block';
        return;
      }
      const act = ACTS.find((a) => a.missions.includes(state.nextMission));
      const pips = MISSION_NAMES.map((_, i) => {
        if (state.missionsDone.includes(i)) return '●';
        if (i === state.nextMission) return '◉';
        return '○';
      }).join(' ');
      els.missionStage.innerHTML = `<b>NEXT JOB: ${MISSION_NAMES[state.nextMission]}</b>`
        + `<br><span>${act ? `${act.name} · ` : ''}Go to the yellow marker · ${pips}</span>`;
      els.missionStage.style.display = 'block';
      return;
    }
    const defs = ctx.missions && ctx.missions.definitions;
    const def = defs && defs[m.id];
    if (!def) {
      if (els.missionStage.style.display !== 'none') els.missionStage.style.display = 'none';
      return;
    }
    const total = def.stages.length;
    const cur = def.stages[m.stage] || def.stages[0];
    const next = m.stage + 1 < total ? def.stages[m.stage + 1].name : 'FINISH';
    const pips = def.stages.map((_, i) => (i < m.stage ? '●' : (i === m.stage ? '◉' : '○'))).join(' ');
    els.missionStage.innerHTML = `<b>MISSION ${m.id + 1} · ${m.title} — STAGE ${m.stage + 1}/${total}: ${cur.name || ''}</b>`
      + `<br><span>NEXT: ${next} · ${pips}</span>`;
    els.missionStage.style.display = 'block';
  }

  function vehicleLabel(veh) {
    const name = (VEHICLES[veh.defId] || {}).name || veh.defId;
    const upg = (state.garageUpgrades && state.garageUpgrades[veh.defId]) || {};
    const maxHp = 100 + 50 * (upg.armour || 0);
    const dmg = Math.max(0, Math.round((1 - (veh.health ?? maxHp) / maxHp) * 100));
    return dmg > 0 ? `${name} — ${dmg}% DENTED` : name;
  }

  function syncText() {
    const p = state.player;
    if (els.health) els.health.style.width = `${Math.max(0, Math.min(100, p.health))}%`;
    if (els.armour) els.armour.style.width = `${Math.max(0, Math.min(100, p.armour))}%`;
    if (els.healthNum) els.healthNum.textContent = String(Math.round(Math.max(0, p.health)));
    if (els.armourNum) els.armourNum.textContent = String(Math.round(Math.max(0, p.armour)));
    if (els.money) els.money.textContent = `$${Math.floor(p.money).toLocaleString('en-US')}`;
    // Rank + RP replaces the single respect number.
    if (els.respect) {
      const r = rankFor(p.rp || 0);
      els.respect.textContent = r.next
        ? `RANK ${r.tier} — ${r.title} · ${Math.floor(p.rp || 0).toLocaleString('en-US')}/${r.next.min.toLocaleString('en-US')} RP`
        : `RANK ${r.tier} — ${r.title} · ${Math.floor(p.rp || 0).toLocaleString('en-US')} RP`;
    }
    // District standing for the district the player is standing in.
    const dName = state.district || 'Maravilla';
    const dVal = (state.districtStanding && state.districtStanding[dName] != null)
      ? state.districtStanding[dName] : 50;
    if (els.district) els.district.textContent = `${dName.toUpperCase()} — ${districtLabel(dVal)} · ${dVal}`;
    if (els.districtFill) els.districtFill.style.width = `${dVal}%`;
    if (els.districtFx) {
      const fx = state.standingFx || {};
      els.districtFx.textContent = fx.label || '';
    }
    const totalMin = Math.floor((state.dayTime % 1) * 24 * 60);
    const hh = String(Math.floor(totalMin / 60)).padStart(2, '0');
    const mm = String(totalMin % 60).padStart(2, '0');
    if (els.clock) els.clock.textContent = `DAY ${state.day || 1} · ${hh}:${mm}`;
    if (els.radio) {
      els.radio.textContent = state.radio.on
        ? (RADIO[state.radio.station] || RADIO[0]).name
        : 'RADIO OFF';
    }
    if (els.stars) {
      els.stars.textContent = '★'.repeat(Math.max(0, Math.min(5, p.wanted)))
        + '☆'.repeat(5 - Math.max(0, Math.min(5, p.wanted)));
    }
    const driving = p.vehicleId !== null;
    const veh = driving ? state.vehicles.find((v) => v.id === p.vehicleId) : null;
    if (els.speed) els.speed.textContent = String(Math.round(Math.abs(driving ? p.speed : 0) * 3.6));
    if (els.vehicleName) {
      els.vehicleName.textContent = veh ? vehicleLabel(veh) : '';
    }
    const w = WEAPONS[p.weapon] || WEAPONS.fists;
    if (els.weaponName) els.weaponName.textContent = w.name;
    if (els.weaponAmmo) {
      els.weaponAmmo.textContent = p.weapon === 'fists'
        ? ''
        : `${p.mag[p.weapon] ?? 0} / ${p.ammo[p.weapon] ?? 0}`;
    }
    if (els.objective && els.objective.textContent !== state.objective) {
      els.objective.textContent = state.objective;
    }
    if (els.crosshair) {
      els.crosshair.style.display = (!driving && p.weapon !== 'fists') ? 'block' : 'none';
    }
    if (els.banner && bannerUntil >= 0 && state.time > bannerUntil) {
      els.banner.style.display = 'none';
      bannerUntil = -1;
    }
    if (els.subtitle && subtitleUntil >= 0 && state.time > subtitleUntil) {
      els.subtitle.style.display = 'none';
      subtitleUntil = -1;
    }
    renderFeed();
    drawMinimap();
    renderDispatch();
    renderCrewCards();
    renderMissionStage();
    renderWeaponBar();
  }

  if (events) {
    events.on('message', (d) => { if (d) message(d.text, d.kind || 'info'); });
    events.on('mission', (d) => {
      if (!d) return;
      if (d.title) banner(d.title, d.sub || '');
      if (d.objective) setObjective(d.objective);
      if (d.text) message(d.text, d.kind || 'info');
    });
    events.on('subtitle', (d) => { if (d) subtitle(d.text, d.seconds || 3); });
  }

  function update(dt) {
    textTimer -= dt;
    if (textTimer <= 0) {
      textTimer = 0.1;
      syncText();
    }
  }

  return { update, message, banner, setObjective, subtitle, syncText, drawMinimap };
}
