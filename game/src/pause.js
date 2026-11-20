// pause.js — the 5-tab pause menu for MARAVILLA: MAP / MISSIONS / STATS /
// CREW / SAVE. Opened with P or Esc. Written from the prose design spec.

import { saveSlot, loadSlot, listSlots, loadLeaderboard } from './save.js';
import { MISSIONS } from './missions.js';

const TABS = ['MAP', 'MISSIONS', 'STATS', 'CREW', 'SAVE'];

const CREW_INFO = [
  { id: 'luz', name: 'Mama Luz', role: 'Fixer — points at the next job', key: 'B' },
  { id: 'celia', name: 'Celia Reyes', role: 'Driver / hacker — scrubs 2 stars of heat, $150', key: 'Z' },
  { id: 'tito', name: 'Tito Fuentes', role: 'Mechanic — repairs the ride, $100', key: 'X' },
  { id: 'marlon', name: 'Big Marlon', role: 'Muscle — clears nearby cops, $200', key: 'V' },
];

function esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function fmtMoney(n) {
  return `$${Number(n || 0).toLocaleString('en-US')}`;
}

function fmtTime(seconds) {
  const s = Math.floor(seconds || 0);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
}

function fmtClock(minutes) {
  const m = Math.floor(minutes || 0) % 1440;
  const hh = Math.floor(m / 60);
  const mm = m % 60;
  return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
}

export function createPause(state, bus) {
  const emit = (name, data) => {
    if (bus && typeof bus.emit === 'function') bus.emit(name, data);
  };

  let open = false;
  let tab = 'MAP';
  let menuEl = null;
  let bodyEl = null;

  function isOpen() {
    return open;
  }

  function findEls() {
    if (!menuEl && typeof document !== 'undefined') {
      menuEl = document.getElementById('pause-menu');
      bodyEl = menuEl ? menuEl.querySelector('.pause-body') : null;
    }
    return !!menuEl;
  }

  function setPaused(value) {
    if (!state.flags) state.flags = {};
    state.flags.paused = value;
    emit(value ? 'game:paused' : 'game:resumed', {});
  }

  function openMenu(initialTab) {
    findEls();
    open = true;
    if (initialTab && TABS.includes(initialTab)) tab = initialTab;
    setPaused(true);
    render();
    if (menuEl) menuEl.style.display = 'block';
    emit('pause:opened', { tab });
  }

  function closeMenu() {
    open = false;
    setPaused(false);
    if (menuEl) menuEl.style.display = 'none';
    emit('pause:closed', {});
  }

  function toggle() {
    if (open) closeMenu();
    else openMenu();
  }

  function setTab(next) {
    if (!TABS.includes(next)) return;
    tab = next;
    render();
    emit('pause:tab', { tab });
  }

  // --- Tab renderers ------------------------------------------------------
  function renderMap() {
    const p = state.player || {};
    const districts = (state.districts && state.districts.standing) || {};
    const rows = Object.keys(districts)
      .map((d) => `<tr><td>${esc(d)}</td><td>${districts[d]}</td></tr>`)
      .join('');
    const obj = (state.missions && state.missions.objective) || '—';
    return `
      <h3>MAP — MARAVILLA</h3>
      <p>Position: ${Math.round(p.x || 0)}, ${Math.round(p.z || 0)} &nbsp;|&nbsp; Day ${(state.clock && state.clock.day) || 1}, ${fmtClock(state.clock && state.clock.minutes)}</p>
      <p>Current objective: <strong>${esc(obj)}</strong></p>
      <p class="muted">Open the minimap on the HUD for the live route line. Districts and standing:</p>
      <table class="pause-table"><tr><th>District</th><th>Standing</th></tr>${rows}</table>`;
  }

  function renderMissions() {
    const done = (state.missions && state.missions.done) || [];
    const ratings = (state.missions && state.missions.ratings) || {};
    const current = (state.missions && state.missions.current) || 0;
    const items = MISSIONS.map((m, i) => {
      const isDone = done.includes(m.id);
      const isCurrent = i === current && !isDone;
      const mark = isDone ? `DONE — rating ${ratings[m.id] || '—'}` : isCurrent ? 'CURRENT' : 'LOCKED';
      return `<tr><td>${m.id}</td><td>${esc(m.title)}</td><td>${esc(m.giver)}</td><td>Act ${m.act}</td><td>${mark}</td><td>${fmtMoney(m.reward.money)} / ${m.reward.rp} RP</td></tr>`;
    }).join('');
    return `
      <h3>MISSIONS</h3>
      <table class="pause-table">
        <tr><th>#</th><th>Title</th><th>Giver</th><th>Act</th><th>Status</th><th>Reward</th></tr>
        ${items}
      </table>
      <p class="muted">Finish a mission to unlock the next one. Ratings: G (gold), S (silver), B (bronze).</p>`;
  }

  function renderStats() {
    const s = state.stats || {};
    const p = state.player || {};
    const c = state.collectibles || {};
    const nextRank = nextRankInfo(s.rp || 0);
    // Completion: missions 50%, geckos 20%, jumps 10%, exports 10%, safehouse 10%.
    const completion = (
      ((s.missionsDone || 0) / 10) * 50 +
      (((c.geckosFound || []).length) / 20) * 20 +
      (((c.jumpsDone || []).length) / 5) * 10 +
      (((c.exportsDone || []).length) / 5) * 10 +
      (c.safehouseOwned ? 10 : 0)
    ).toFixed(1);
    const rows = [
      ['Rank', `${s.rank || 'ROOKIE'} (${s.rp || 0} RP${nextRank ? ` — ${nextRank.need} RP to ${nextRank.name}` : ' — top rank'})`],
      ['Respect', String(s.respect || 0)],
      ['Completion', `${completion}%`],
      ['Missions completed', String(s.missionsDone || 0)],
      ['Money earned (career)', fmtMoney(s.moneyEarned || 0)],
      ['Money on hand', fmtMoney(p.money || 0)],
      ['Distance driven', `${((s.distanceDriven || 0) / 1000).toFixed(1)} km`],
      ['Cars stolen', String(s.carsStolen || 0)],
      ['Cops escaped', String(s.copsEscaped || 0)],
      ['Taken out', String(s.kills || 0)],
      ['Longest jump', `${(s.longestJump || 0).toFixed(1)} m`],
      ['Time played', fmtTime(s.timePlayed || 0)],
      ['Golden Geckos', `${(c.geckosFound || []).length} / 20`],
      ['Stunt jumps', `${(c.jumpsDone || []).length} / 5`],
      ['Exports delivered', `${(c.exportsDone || []).length} / 5`],
      ['Safehouse', c.safehouseOwned ? 'Casa Verde — owned' : 'Casa Verde — not owned ($2,000)'],
    ];
    const body = rows.map(([k, v]) => `<tr><td>${esc(k)}</td><td><strong>${esc(v)}</strong></td></tr>`).join('');
    return `<h3>CAREER STATS</h3><table class="pause-table">${body}</table>`;
  }

  function nextRankInfo(rp) {
    const ladder = [
      { at: 500, name: 'HUSTLER' },
      { at: 1200, name: 'FIXER' },
      { at: 2400, name: 'SHOT CALLER' },
      { at: 4500, name: 'LEYENDA' },
    ];
    for (const r of ladder) {
      if (rp < r.at) return { name: r.name, need: r.at - rp };
    }
    return null;
  }

  function renderCrew() {
    const cooldowns = (state.crew && (state.crew.cooldowns || state.crew.cooldown)) || {};
    const cards = CREW_INFO.map((c) => {
      const cd = cooldowns[c.id] || 0;
      const status = cd > 0 ? `Cooling down (${Math.ceil(cd)}s)` : 'Ready';
      return `<tr><td>${esc(c.name)}</td><td>${esc(c.role)}</td><td>[${c.key}]</td><td>${status}</td></tr>`;
    }).join('');
    return `
      <h3>CREW</h3>
      <table class="pause-table">
        <tr><th>Name</th><th>Role</th><th>Call</th><th>Status</th></tr>
        ${cards}
      </table>
      <p class="muted">Call the crew from the phone (F) or with the quick-call keys on the HUD cards. Detective El Gato is closing in — the crew is the only family Rook has left.</p>`;
  }

  function renderSave() {
    const slots = listSlots();
    const board = loadLeaderboard();
    const slotRows = slots
      .map((s) => `<tr><td>Slot ${s.slot}</td><td>${esc(s.label)}</td><td>${s.filled ? fmtMoney(s.money) : '—'}</td><td>${s.filled ? esc(s.rank) : '—'}</td></tr>`)
      .join('');
    const boardRows = board.length
      ? board.map((e, i) => `<tr><td>${i + 1}</td><td>${esc(e.name)}</td><td>${e.rp} RP</td><td>${fmtMoney(e.money)}</td><td>${e.missionsDone} missions</td></tr>`).join('')
      : '<tr><td colspan="5">No scores yet — finish a mission to set one.</td></tr>';
    return `
      <h3>SAVE / LOAD</h3>
      <table class="pause-table">
        <tr><th>Slot</th><th>Save</th><th>Money</th><th>Rank</th></tr>
        ${slotRows}
      </table>
      <p>
        <button data-save-slot="1">Save 1</button>
        <button data-save-slot="2">Save 2</button>
        <button data-save-slot="3">Save 3</button>
        <button data-load-slot="1">Load 1</button>
        <button data-load-slot="2">Load 2</button>
        <button data-load-slot="3">Load 3</button>
      </p>
      <h3>LOCAL LEADERBOARD — TOP 5</h3>
      <table class="pause-table">
        <tr><th>#</th><th>Name</th><th>RP</th><th>Money</th><th>Missions</th></tr>
        ${boardRows}
      </table>`;
  }

  function render() {
    if (!findEls()) return;
    if (!bodyEl) {
      bodyEl = menuEl.querySelector('.pause-body');
      if (!bodyEl) return;
    }
    const tabsHtml = TABS.map((t) => `<button data-tab="${t}" class="${t === tab ? 'active' : ''}">${t}</button>`).join('');
    let tabsEl = menuEl.querySelector('.pause-tabs');
    if (!tabsEl) {
      tabsEl = document.createElement('div');
      tabsEl.className = 'pause-tabs';
      // .pause-body lives inside .overlay-card, not directly under
      // #pause-menu, so insert the tab bar before it in its own parent;
      // menuEl.insertBefore would throw NotFoundError here.
      const parent = bodyEl.parentElement || menuEl;
      parent.insertBefore(tabsEl, bodyEl);
    }
    tabsEl.innerHTML = tabsHtml;
    tabsEl.querySelectorAll('[data-tab]').forEach((b) => {
      b.addEventListener('click', () => setTab(b.getAttribute('data-tab')));
    });
    let html = '';
    if (tab === 'MAP') html = renderMap();
    else if (tab === 'MISSIONS') html = renderMissions();
    else if (tab === 'STATS') html = renderStats();
    else if (tab === 'CREW') html = renderCrew();
    else html = renderSave();
    bodyEl.innerHTML = html;
    bodyEl.querySelectorAll('[data-save-slot]').forEach((b) => {
      b.addEventListener('click', () => {
        const snap = saveSlot(Number(b.getAttribute('data-save-slot')), state);
        emit('message', { text: snap ? `Saved to slot ${snap.slot}.` : 'Save failed — storage unavailable.' });
        render();
      });
    });
    bodyEl.querySelectorAll('[data-load-slot]').forEach((b) => {
      b.addEventListener('click', () => {
        const ok = loadSlot(Number(b.getAttribute('data-load-slot')), state);
        emit('message', { text: ok ? 'Save loaded.' : 'That slot is empty.' });
        if (ok) emit('save:loaded', {});
        render();
      });
    });
  }

  // Keyboard: P or Esc toggles. Number keys 1-5 switch tabs while open.
  function handleKey(code) {
    if (code === 'KeyP' || code === 'Escape') {
      toggle();
      return true;
    }
    if (open) {
      const idx = ['Digit1', 'Digit2', 'Digit3', 'Digit4', 'Digit5'].indexOf(code);
      if (idx >= 0) {
        setTab(TABS[idx]);
        return true;
      }
    }
    return false;
  }

  return {
    TABS,
    CREW_INFO,
    openMenu,
    closeMenu,
    toggle,
    setTab,
    render,
    handleKey,
    get isOpen() {
      return open;
    },
    get tab() {
      return tab;
    },
  };
}
