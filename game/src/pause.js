// Maravilla — the pause menu: MAP / MISSIONS / STATS / CREW / SAVE tabs.
// main.js shows/hides it when the screen flips to/from 'paused' (systems
// do not update while paused, so this module owns its own DOM + listeners
// and refreshes on show and on every tab click). Communicates only via
// state.* and the save/phone/missions systems on ctx.

import { CITY, DISTRICTS, MISSION_NAMES, ACTS, MISSION_PARS, CREW } from './config.js';
import { portraitUrl } from './portraits.js';

const TABS = ['MAP', 'MISSIONS', 'STATS', 'CREW', 'SAVE'];

export function createPause(ctx) {
  const { state } = ctx;
  let el = null;
  let activeTab = 'MAP';
  let shown = false;

  function msg(text, kind = 'info') {
    if (ctx.hud && ctx.hud.message) { ctx.hud.message(text, kind); return; }
    if (state.messages) state.messages.push({ text, at: state.time, kind });
  }

  function build() {
    if (el || typeof document === 'undefined') return;
    el = document.createElement('div');
    el.id = 'pause-menu';
    el.style.display = 'none';
    el.innerHTML = '<div class="pause-title">PAUSED — MARAVILLA</div>'
      + '<div class="pause-tabs"></div>'
      + '<div class="pause-body"></div>'
      + '<div class="pause-hint">Click a tab or press 1–5 · P resumes</div>';
    const tabsEl = el.querySelector('.pause-tabs');
    TABS.forEach((t, i) => {
      const b = document.createElement('button');
      b.className = 'pause-tab';
      b.textContent = `${i + 1} · ${t}`;
      b.addEventListener('click', () => { activeTab = t; refresh(); });
      tabsEl.appendChild(b);
    });
    document.body.appendChild(el);
    if (typeof window !== 'undefined') {
      window.addEventListener('keydown', (event) => {
        if (!shown || event.repeat) return;
        const n = ['Digit1', 'Digit2', 'Digit3', 'Digit4', 'Digit5'].indexOf(event.code);
        if (n >= 0) { activeTab = TABS[n]; refresh(); }
      });
    }
  }

  function fmtTime(sec) {
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${m}:${String(s).padStart(2, '0')}`;
  }

  function drawMap(canvas) {
    const g = canvas.getContext('2d');
    const S = canvas.width;
    const scale = S / 620;
    const toX = (x) => S / 2 + x * scale;
    const toY = (z) => S / 2 + z * scale;
    g.clearRect(0, 0, S, S);
    g.fillStyle = '#0d2f45';
    g.fillRect(0, 0, S, S);
    g.fillStyle = '#123a5c';
    g.fillRect(toX(300), 0, S - toX(300), S);
    g.fillStyle = '#c9b078';
    g.fillRect(toX(264), 0, toX(300) - toX(264), S);
    g.fillStyle = '#232a33';
    g.fillRect(toX(-300), toY(-300), 600 * scale, 600 * scale);
    g.strokeStyle = '#4a545e';
    g.lineWidth = Math.max(2, CITY.roadWidth * scale);
    for (const c of CITY.roads) {
      g.beginPath(); g.moveTo(toX(c), 0); g.lineTo(toX(c), S); g.stroke();
      g.beginPath(); g.moveTo(0, toY(c)); g.lineTo(S, toY(c)); g.stroke();
    }
    g.fillStyle = '#cfd6de';
    g.font = `bold ${Math.max(10, S / 42)}px system-ui, sans-serif`;
    g.textAlign = 'center';
    for (const d of DISTRICTS) {
      const cx = (d.minX + d.maxX) / 2;
      const cz = (d.minZ + d.maxZ) / 2;
      g.fillText(d.name.toUpperCase(), toX(cx), toY(cz));
    }
    // Places.
    g.fillStyle = '#ffd98a';
    g.font = '11px system-ui, sans-serif';
    for (const [key, pl] of Object.entries(CITY.places)) {
      g.beginPath(); g.arc(toX(pl.x), toY(pl.z), 3, 0, Math.PI * 2); g.fill();
      g.fillText(pl.name, toX(pl.x), toY(pl.z) - 6);
    }
    // Route to the mission marker.
    const marker = state.mission && state.mission.marker;
    if (marker) {
      g.strokeStyle = '#ffd94d';
      g.lineWidth = 2;
      g.setLineDash([6, 5]);
      g.beginPath();
      g.moveTo(toX(state.player.x), toY(state.player.z));
      g.lineTo(toX(marker.x), toY(marker.z));
      g.stroke();
      g.setLineDash([]);
      g.fillStyle = '#ffd94d';
      g.beginPath();
      g.moveTo(toX(marker.x), toY(marker.z) - 8);
      g.lineTo(toX(marker.x) + 7, toY(marker.z));
      g.lineTo(toX(marker.x), toY(marker.z) + 8);
      g.lineTo(toX(marker.x) - 7, toY(marker.z));
      g.closePath(); g.fill();
    }
    // Player.
    g.fillStyle = '#7be495';
    g.beginPath(); g.arc(toX(state.player.x), toY(state.player.z), 5, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#ffd94d';
    g.font = 'bold 12px system-ui, sans-serif';
    g.fillText('N', S / 2, 14);
  }

  function missionsHtml() {
    let html = '';
    for (const act of ACTS) {
      const done = act.missions.filter((i) => state.missionsDone.includes(i)).length;
      html += `<div class="pause-act"><b>${act.name}</b> — ${done}/${act.missions.length} done`
        + `<div class="pause-act-blurb">${act.blurb}</div>`;
      for (const i of act.missions) {
        const locked = i > state.nextMission;
        const isCurrent = i === state.nextMission && !state.missionsDone.includes(i);
        const rating = state.ratings[i];
        const status = state.missionsDone.includes(i)
          ? `DONE · rating ${rating || '—'}`
          : (isCurrent ? 'AVAILABLE — go to the yellow marker' : 'LOCKED — finish the earlier jobs first');
        html += `<div class="pause-mission ${locked ? 'locked' : ''}">`
          + `<b>${i + 1}. ${MISSION_NAMES[i]}</b> — ${status}`
          + `<span class="pause-sub">$${[400, 900, 700, 800, 1000, 1100, 1400, 1500, 1800, 5000][i]} · par ${fmtTime(MISSION_PARS[i])}</span></div>`;
      }
      html += '</div>';
    }
    return html;
  }

  function statsHtml() {
    const s = state.stats;
    const acc = s.shotsFired > 0 ? Math.round((s.hits / s.shotsFired) * 100) : 0;
    const rows = [
      ['Missions done', `${s.missionsDone} / 10`],
      ['Races won', `${s.racesWon}`],
      ['Taxi fares', `${s.taxiFares}`],
      ['Golden Geckos found', `${s.collectibles} / 20`],
      ['Stunt jumps landed', `${s.jumps} / 5`],
      ['District jobs done', `${s.jobs}`],
      ['Exports delivered', `${s.exports} / 5`],
      ['Money earned', `$${s.moneyEarned.toLocaleString('en-US')}`],
      ['Cash on hand', `$${Math.floor(state.player.money).toLocaleString('en-US')}`],
      ['Distance driven', `${(s.distanceDriven / 1000).toFixed(1)} km`],
      ['Cars stolen', `${s.carsStolen}`],
      ['Shots / hits', `${s.shotsFired} / ${s.hits} (${acc}%)`],
      ['Time played', fmtTime(s.timePlayed)],
      ['Day', `${state.day}`],
      ['Rank', `${state.player.rp} RP`],
    ];
    return '<div class="pause-stats">' + rows.map(([k, v]) => `<div class="pause-stat"><span>${k}</span><b>${v}</b></div>`).join('') + '</div>';
  }

  function crewHtml() {
    const crew = ctx.phone && ctx.phone.crewStatus ? ctx.phone.crewStatus() : [];
    let html = '<div class="pause-crew">';
    for (const r of crew) {
      html += `<div class="pause-crew-row"><img class="crew-portrait" src="${portraitUrl(r.id)}" alt="">`
        + `<div><b>${r.name}</b> <span class="phone-role">${r.role}</span><br>`
        + `<span class="phone-ability">${r.short}${r.cost ? ` · $${r.cost}` : ''}</span> — ${r.state}</div></div>`;
    }
    const c = CREW.player;
    html += `<div class="pause-crew-row"><img class="crew-portrait" src="${portraitUrl('player')}" alt="">`
      + `<div><b>${c.name}</b> <span class="phone-role">${c.role}</span><br>`
      + `<span class="phone-ability">You. The one doing the driving.</span></div></div>`;
    return html + '</div>';
  }

  function saveHtml() {
    const save = ctx.save;
    if (!save) return '<p>No save system.</p>';
    let html = `<p>Autosave writes to slot ${save.currentSlot}. Saving also happens on mission complete and on pause.</p>`;
    for (let slot = 1; slot <= 3; slot += 1) {
      const info = save.slotInfo(slot);
      const isCurrent = slot === save.currentSlot;
      html += `<div class="pause-slot"><b>SLOT ${slot}${isCurrent ? ' · CURRENT' : ''}</b> — `
        + (info
          ? `saved ${new Date(info.savedAt).toLocaleString('en-US')} · $${info.money} · ${info.missionsDone.length}/10 missions`
          : 'empty')
        + ` <button class="garage-btn" data-save="${slot}">Save here</button>`
        + (info ? ` <button class="garage-btn" data-load="${slot}">Load</button>`
          + ` <button class="garage-btn" data-del="${slot}">Delete</button>` : '')
        + '</div>';
    }
    return html;
  }

  function refresh() {
    if (!el) return;
    const tabs = el.querySelectorAll('.pause-tab');
    tabs.forEach((b, i) => b.classList.toggle('active', TABS[i] === activeTab));
    const body = el.querySelector('.pause-body');
    if (activeTab === 'MAP') {
      body.innerHTML = '<canvas id="pause-map" width="420" height="420"></canvas>'
        + `<p class="pause-sub">${state.district} — ${state.districtStanding[state.district] ?? 50} standing · ${state.objective || ''}</p>`;
      drawMap(body.querySelector('#pause-map'));
    } else if (activeTab === 'MISSIONS') {
      body.innerHTML = missionsHtml();
    } else if (activeTab === 'STATS') {
      body.innerHTML = statsHtml();
    } else if (activeTab === 'CREW') {
      body.innerHTML = crewHtml();
    } else if (activeTab === 'SAVE') {
      body.innerHTML = saveHtml();
      body.querySelectorAll('[data-save]').forEach((b) => b.addEventListener('click', () => {
        const slot = Number(b.dataset.save);
        if (ctx.save.setSlot(slot)) {
          if (ctx.save.save()) msg(`Saved to slot ${slot}.`, 'good');
          refresh();
        }
      }));
      body.querySelectorAll('[data-load]').forEach((b) => b.addEventListener('click', () => {
        const slot = Number(b.dataset.load);
        if (ctx.save.loadFrom(slot)) {
          ctx.save.setSlot(slot);
          msg(`Loaded slot ${slot}.`, 'good');
          refresh();
        } else {
          msg(`Slot ${slot} is empty.`, 'bad');
        }
      }));
      body.querySelectorAll('[data-del]').forEach((b) => b.addEventListener('click', () => {
        ctx.save.deleteSlot(Number(b.dataset.del));
        refresh();
      }));
    }
  }

  function show() {
    build();
    if (!el) return;
    if (!shown) {
      shown = true;
      el.style.display = 'block';
      refresh(); // refresh once per open; tab clicks refresh again
    }
  }

  function hide() {
    shown = false;
    if (el) el.style.display = 'none';
  }

  function update(dt) {
    // Runs while playing (systems do not update while paused; main.js
    // drives show()/hide() instead). Track time played for career stats.
    if (state.screen === 'play') state.stats.timePlayed += dt;
  }

  return { update, show, hide, get isShown() { return shown; } };
}
