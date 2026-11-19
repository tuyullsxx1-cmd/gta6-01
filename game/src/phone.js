// Maravilla — the phone: call the crew for help. F opens it; 1-4 dial.
// Each ability costs money and has a cooldown. The game keeps running while
// the phone is open. Communicates only via state.* and events; never
// imports another system.

import { CREW } from './config.js';
import { portraitUrl } from './portraits.js';

const CALLS = [
  {
    id: 'luz', key: 'Digit1', quickKey: 'KeyB', cost: 0, cooldown: 0,
    title: 'Get the next job',
    desc: 'Mama Luz lines up the next mission.',
    short: 'NEXT JOB',
  },
  {
    id: 'celia', key: 'Digit2', quickKey: 'KeyZ', cost: 150, cooldown: 60,
    title: 'Scrub the heat — $150',
    desc: 'Celia spoofs the dispatch feed. Wanted −2 stars.',
    short: 'SCRUB HEAT',
  },
  {
    id: 'tito', key: 'Digit3', quickKey: 'KeyX', cost: 100, cooldown: 30,
    title: 'Patch the ride — $100',
    desc: 'Tito talks you through a field repair. Car back to full health.',
    short: 'PATCH RIDE',
  },
  {
    id: 'marlon', key: 'Digit4', quickKey: 'KeyV', cost: 200, cooldown: 90,
    title: 'Clear the street — $200',
    desc: 'Big Marlon leans on the beat cops. Foot cops within 30 m walk away.',
    short: 'CLEAR STREET',
  },
];

export function createPhone(ctx) {
  const { state, events } = ctx;
  const p = state.player;
  let open = false;
  let el = null;
  let rows = [];
  let cooldowns = { celia: 0, tito: 0, marlon: 0 };

  function msg(text, kind = 'info') {
    if (ctx.hud && ctx.hud.message) { ctx.hud.message(text, kind); return; }
    if (state.messages) state.messages.push({ text, at: state.time, kind });
  }

  function build() {
    if (el || typeof document === 'undefined') return;
    el = document.createElement('div');
    el.id = 'phone';
    el.style.display = 'none';
    el.innerHTML = '<div class="phone-title">ROOK’S PHONE</div><div class="phone-list"></div>'
      + '<div class="phone-hint">Press 1–4 to call · F closes · Z / X / V / B quick-call from the HUD</div>';
    const list = el.querySelector('.phone-list');
    CALLS.forEach((c) => {
      const crew = CREW[c.id];
      const row = document.createElement('div');
      row.className = 'phone-row';
      row.dataset.crew = c.id;
      row.innerHTML = `<span style="display:flex;align-items:center;gap:8px"><img class="crew-portrait" src="${portraitUrl(c.id)}" alt=""><b>${crew.name}</b></span><span class="phone-role">${crew.role}</span>`
        + `<span class="phone-ability">${c.title}</span><span class="phone-desc">${c.desc}</span>`
        + '<span class="phone-cd"></span>';
      row.addEventListener('click', () => callCrew(c.id));
      list.appendChild(row);
      rows.push(row);
    });
    document.body.appendChild(el);
  }

  function refresh() {
    if (!el) return;
    rows.forEach((row, i) => {
      const call = CALLS[i];
      if (!call) return;
      const cd = row.querySelector('.phone-cd');
      const left = Math.ceil(cooldowns[call.id] || 0);
      const broke = call.cost > 0 && p.money < call.cost;
      if (cd) cd.textContent = left > 0 ? `Ready in ${left}s` : (broke ? 'Not enough cash' : 'Ready');
      row.classList.toggle('disabled', left > 0 || broke);
    });
  }

  function openPhone() {
    if (state.screen !== 'play') return;
    build();
    if (!el) return;
    open = true;
    el.style.display = 'block';
    refresh();
  }

  function closePhone() {
    open = false;
    if (el) el.style.display = 'none';
  }

  function callCrew(id, opts = {}) {
    const call = CALLS.find((c) => c.id === id);
    if (!call) return false;
    // Quick-calls (Z/X/V/B from the HUD cards) work without opening the
    // phone; the phone rows still need it open.
    if (!opts.quick && !open) return false;
    if ((cooldowns[id] || 0) > 0) {
      msg(`${CREW[id].name} is busy — ${Math.ceil(cooldowns[id])}s left.`, 'bad');
      return false;
    }
    if (p.money < call.cost) {
      msg(`Not enough cash for ${CREW[id].name} ($${call.cost}).`, 'bad');
      return false;
    }
    if (id === 'luz') {
      if (state.mission) { msg('Finish the current job first, Rook.', 'bad'); return false; }
      if (state.nextMission >= 10) { msg('No more jobs, Rook. The city is yours.', 'info'); return false; }
      if (ctx.missions && ctx.missions.startMission) {
        if (!ctx.missions.startMission(state.nextMission)) return false;
      } else {
        msg('Mama Luz: Come see me at the garage, Rook.', 'info');
        return false;
      }
      msg('Mama Luz lined up the next job.', 'good');
    } else if (id === 'celia') {
      if (p.wanted <= 0) { msg('No heat to scrub right now.', 'info'); return false; }
      p.money -= call.cost;
      if (ctx.police && ctx.police.addWanted) ctx.police.addWanted(-2);
      else p.wanted = Math.max(0, p.wanted - 2);
      msg('Celia: Dispatch feed spoofed. Two stars gone.', 'good');
    } else if (id === 'tito') {
      const veh = p.vehicleId !== null
        ? state.vehicles.find((v) => v.id === p.vehicleId) : null;
      const near = veh || state.vehicles.find(
        (v) => Math.hypot(v.x - p.x, v.z - p.z) < 6,
      );
      if (!near) { msg('No car close enough for Tito to patch.', 'bad'); return false; }
      p.money -= call.cost;
      const upg = (state.garageUpgrades && state.garageUpgrades[near.defId]) || {};
      near.health = 100 + 50 * (upg.armour || 0);
      near._burning = false;
      msg('Tito: She’s patched up. Good as new.', 'good');
    } else if (id === 'marlon') {
      const near = state.cops.filter(
        (c) => c.kind === 'foot' && Math.hypot(c.x - p.x, c.z - p.z) < 30,
      );
      if (near.length === 0) { msg('No beat cops close enough to lean on.', 'info'); return false; }
      p.money -= call.cost;
      for (const cop of near) {
        const i = state.cops.indexOf(cop);
        if (i >= 0) state.cops.splice(i, 1);
        if (cop.mesh && ctx.scene) ctx.scene.remove(cop.mesh);
      }
      msg(`Big Marlon cleared ${near.length} cop${near.length > 1 ? 's' : ''} off the street.`, 'good');
    }
    if (call.cooldown > 0) cooldowns[id] = call.cooldown;
    if (ctx.audio && ctx.audio.play) ctx.audio.play('click');
    if (events) events.emit('phone-call', { crew: id });
    refresh();
    return true;
  }

  if (typeof window !== 'undefined') {
    window.addEventListener('keydown', (event) => {
      if (event.repeat) return;
      if (event.code === 'KeyF' && state.screen === 'play') {
        if (open) closePhone();
        else openPhone();
        return;
      }
      // Quick-calls straight from the HUD cards (phone closed).
      if (!open && state.screen === 'play') {
        const quick = CALLS.find((c) => c.quickKey === event.code);
        if (quick) callCrew(quick.id, { quick: true });
        return;
      }
      if (!open) return;
      if (event.code === 'Escape') { closePhone(); return; }
      const call = CALLS.find((c) => c.key === event.code);
      if (call) callCrew(call.id);
    });
  }

  /** Crew-card state for the HUD: one row per crew member. */
  function crewStatus() {
    return CALLS.map((c) => {
      const crew = CREW[c.id];
      const left = Math.ceil(cooldowns[c.id] || 0);
      const broke = c.cost > 0 && p.money < c.cost;
      return {
        id: c.id, name: crew.name, role: crew.role, short: c.short,
        cost: c.cost, quickKey: c.quickKey.replace('Key', ''),
        cooldownLeft: left, affordable: !broke,
        state: left > 0 ? `Ready in ${left}s` : (broke ? `Need $${c.cost}` : 'Ready'),
      };
    });
  }

  function update(dt) {
    for (const k of Object.keys(cooldowns)) {
      if (cooldowns[k] > 0) cooldowns[k] = Math.max(0, cooldowns[k] - dt);
    }
    if (open) refresh();
  }

  return {
    update,
    open: openPhone,
    close: closePhone,
    callCrew,
    crewStatus,
    get isOpen() { return open; },
  };
}
