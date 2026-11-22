// Pause menu: five tabs MAP / MISSIONS / STATS / CREW / SAVE, plus the
// title screen, the end screen and the garage/phone overlays.
import { MISSIONS } from './missions.js';
import { RANKS } from './config.js';
import { rankFor } from './state.js';
import { crewStatus } from './phone.js';
import { portraitURL } from './portraits.js';
import { slotInfo } from './save.js';
import { allStandings } from './districts.js';
import { EXPORT_LIST } from './side.js';

export function createPause(state, deps) {
  const menu = document.getElementById('pause-menu');
  const tabs = ['MAP', 'MISSIONS', 'STATS', 'CREW', 'SAVE'];

  function open(tab = 'MAP') {
    state.paused = true;
    state.pauseTab = tab;
    menu.classList.remove('hidden');
    render();
  }
  function close() {
    state.paused = false;
    menu.classList.add('hidden');
  }
  function toggle() { state.paused ? close() : open(state.pauseTab); }

  function render() {
    const body = document.getElementById('pause-body');
    const tab = state.pauseTab;
    document.querySelectorAll('#pause-tabs button').forEach((b) => {
      b.classList.toggle('active', b.dataset.tab === tab);
    });
    if (tab === 'MAP') {
      body.innerHTML = `<h3>MARAVILLA — CITY MAP</h3>
        <p>Six districts. Gold diamond: your objective. White arrow: you.</p>
        ${allStandings(state).map((d) => `<div class="srow"><span>${d.name}</span><span>${d.tier.label} · ${d.value}</span></div>`).join('')}
        <p>Landmarks: Faro de Maravilla lighthouse · Estadio Sol · Hotel Miramar · the pier · Banco Alba · Marina Alba · Grand Maravilla casino.</p>`;
    } else if (tab === 'MISSIONS') {
      body.innerHTML = `<h3>STORY — 3 ACTS</h3>` + MISSIONS.map((m, i) => {
        const done = state.missionDone.includes(m.id);
        const cur = i === state.missionIndex && !done;
        const rating = state.ratings[m.id] || '';
        return `<div class="srow"><span>ACT ${m.act} · M${i + 1} ${m.title}</span><span>${done ? 'DONE ' + rating : cur ? 'NEXT' : 'LOCKED'}</span></div>`;
      }).join('') + `<p>Races: Neon Mile · Estadio Sprint · Paseo Dash. Taxi fares pay real money.</p>`;
    } else if (tab === 'STATS') {
      const s = state.stats;
      body.innerHTML = `<h3>CAREER STATS</h3>
        <div class="srow"><span>Rank</span><span>${rankFor(state.rp)} (${state.rp} RP)</span></div>
        <div class="srow"><span>Money</span><span>$${state.money.toLocaleString()}</span></div>
        <div class="srow"><span>Distance driven</span><span>${s.km.toFixed(1)} km</span></div>
        <div class="srow"><span>Cars taken</span><span>${s.stolen}</span></div>
        <div class="srow"><span>Cops escaped</span><span>${s.escaped}</span></div>
        <div class="srow"><span>Opponents taken out</span><span>${s.takenOut}</span></div>
        <div class="srow"><span>Longest jump</span><span>${s.longestJump} m</span></div>
        <div class="srow"><span>Golden Suns</span><span>${state.collectibles.length}/20</span></div>
        <div class="srow"><span>Stunt jumps</span><span>${state.jumpsDone.length}/5</span></div>
        <div class="srow"><span>Exports</span><span>${state.exportsDone.length}/5 — ${EXPORT_LIST.map((e) => e.name).join(', ')}</span></div>
        <div class="srow"><span>District jobs</span><span>${state.jobsDone}</span></div>
        <div class="srow"><span>Safehouse</span><span>${state.safehouse ? 'Owned — Miramar villa' : 'Not owned ($2,000)'}</span></div>`;
    } else if (tab === 'CREW') {
      body.innerHTML = `<h3>CREW</h3>` + crewStatus(state).map((m) => `
        <div class="srow"><img class="crew-face small" src="${portraitURL(m)}" alt="${m.name}">
        <span><b>${m.name}</b> — ${m.role}<br><i>${m.desc}</i></span>
        <span>[${m.key}] ${m.call} ${m.cost ? '$' + m.cost : ''}</span></div>`).join('') +
        `<p>Milo Vane — driver, fresh off the boat. Fixer: Vera Solano. Detective Anselm is closing in.</p>`;
    } else if (tab === 'SAVE') {
      body.innerHTML = `<h3>SAVE — 3 SLOTS</h3>` + [1, 2, 3].map((slot) => {
        const info = slotInfo(slot);
        return `<div class="srow"><span>SLOT ${slot}</span><span>${info ? `Day ${info.day} · $${info.money} · ${info.rp} RP · ${info.savedAt.slice(0, 10)}` : 'Empty'}</span>
        <span><button data-save="${slot}">SAVE</button> <button data-load="${slot}">LOAD</button></span></div>`;
      }).join('') + `<h3>LOCAL TOP 5</h3>` + [...state.leaderboard].sort((a, b) => b.score - a.score).slice(0, 5).map((e, i) => `<div class="srow"><span>${i + 1}. ${e.name}</span><span>${e.score} RP</span></div>`).join('');
      body.querySelectorAll('[data-save]').forEach((b) => b.addEventListener('click', () => { deps.saveSlot(state, Number(b.dataset.save)); render(); }));
      body.querySelectorAll('[data-load]').forEach((b) => b.addEventListener('click', () => { deps.loadSlot(state, Number(b.dataset.load)); render(); }));
    }
  }

  document.querySelectorAll('#pause-tabs button').forEach((b) => {
    b.addEventListener('click', () => { state.pauseTab = b.dataset.tab; render(); });
  });
  document.getElementById('resume-btn').addEventListener('click', close);
  document.getElementById('quit-btn').addEventListener('click', () => { location.reload(); });

  return { open, close, toggle, render };
}
