// Maravilla — Celia's Garage: upgrade and take out the cars you own.
// G opens it while on foot near the garage. Engine +15% top speed per
// level (max 3, $800), armour +50 max health per level (max 3, $600),
// nitro — hold Shift while driving for a boost ($1000, one-time). Taking a
// car out spawns it on the road by the garage. Communicates only via
// state.* and events; never imports another system.

import { CITY, VEHICLES } from './config.js';

const ENGINE_PRICE = 800;
const ARMOUR_PRICE = 600;
const NITRO_PRICE = 1000;
const MAX_LEVEL = 3;

export function createGarage(ctx) {
  const { state, events } = ctx;
  const p = state.player;
  let open = false;
  let el = null;
  let listEl = null;

  function msg(text, kind = 'info') {
    if (ctx.hud && ctx.hud.message) { ctx.hud.message(text, kind); return; }
    if (state.messages) state.messages.push({ text, at: state.time, kind });
  }

  function upg(defId) {
    if (!state.garageUpgrades[defId]) {
      state.garageUpgrades[defId] = { engine: 0, armour: 0, nitro: false };
    }
    return state.garageUpgrades[defId];
  }

  function nearGarage() {
    const g = CITY.places.garage;
    return Math.hypot(p.x - g.x, p.z - g.z) < 10;
  }

  function build() {
    if (el || typeof document === 'undefined') return;
    el = document.createElement('div');
    el.id = 'garage';
    el.style.display = 'none';
    el.innerHTML = '<div class="garage-title">CELIA’S GARAGE</div><div class="garage-list"></div>'
      + '<div class="garage-hint">Click to buy or take out · G closes</div>';
    listEl = el.querySelector('.garage-list');
    document.body.appendChild(el);
  }

  function refresh() {
    if (!el || !listEl) return;
    // District standing moves prices: loyal streets get a discount.
    const mult = (state.standingFx && state.standingFx.priceMult) || 1;
    const price = (b) => Math.round((b * mult) / 10) * 10;
    listEl.innerHTML = '';
    if (state.garage.length === 0) {
      listEl.innerHTML = '<div class="garage-empty">No cars yet. Finish missions to earn them.</div>';
      return;
    }
    state.garage.forEach((defId, idx) => {
      const def = VEHICLES[defId];
      if (!def) return;
      const u = upg(defId);
      const row = document.createElement('div');
      row.className = 'garage-row';
      const inWorld = state.vehicles.some((v) => v.defId === defId && v.kind !== 'cop');
      row.innerHTML = `<b>${def.name}</b><span class="garage-sub">${def.kind} · top ${def.topSpeed} m/s</span>`;
      const mkBtn = (label, disabled, fn) => {
        const b = document.createElement('button');
        b.className = 'garage-btn';
        b.textContent = label;
        b.disabled = !!disabled;
        b.addEventListener('click', () => { fn(); refresh(); });
        row.appendChild(b);
        return b;
      };
      mkBtn(u.engine >= MAX_LEVEL ? `Engine MAX` : `Engine Lv ${u.engine + 1} — $${price(ENGINE_PRICE)}`,
        u.engine >= MAX_LEVEL || p.money < price(ENGINE_PRICE), () => {
          p.money -= price(ENGINE_PRICE);
          u.engine += 1;
          msg(`${def.name} engine upgraded to Lv ${u.engine} (+15% top speed).`, 'good');
          if (events) events.emit('garage', { defId, upgrade: 'engine', level: u.engine });
        });
      mkBtn(u.armour >= MAX_LEVEL ? `Armour MAX` : `Armour Lv ${u.armour + 1} — $${price(ARMOUR_PRICE)}`,
        u.armour >= MAX_LEVEL || p.money < price(ARMOUR_PRICE), () => {
          p.money -= price(ARMOUR_PRICE);
          u.armour += 1;
          msg(`${def.name} armour upgraded to Lv ${u.armour} (+50 health).`, 'good');
          if (events) events.emit('garage', { defId, upgrade: 'armour', level: u.armour });
        });
      mkBtn(u.nitro ? 'Nitro installed' : `Nitro — $${price(NITRO_PRICE)}`,
        u.nitro || p.money < price(NITRO_PRICE), () => {
          p.money -= price(NITRO_PRICE);
          u.nitro = true;
          msg(`${def.name} has nitro — hold Shift while driving.`, 'good');
          if (events) events.emit('garage', { defId, upgrade: 'nitro' });
        });
      mkBtn(inWorld ? 'Already out' : 'Take out',
        inWorld, () => {
          if (ctx.vehicles && ctx.vehicles.spawnVehicle) {
            ctx.vehicles.spawnVehicle(defId, -150, -60, Math.PI / 2, { kind: 'parked' });
            msg(`The ${def.name} is waiting on the road by the garage.`, 'good');
          } else {
            msg('Garage is closed right now.', 'bad');
          }
        });
      listEl.appendChild(row);
    });
    // --- For sale: anything with a price that you do not own yet. The
    // Picuda 250 bike and the Tormenta S only ever come from here.
    const forSale = Object.entries(VEHICLES)
      .filter(([id, d]) => d.price > 0 && d.kind !== 'cop' && !state.garage.includes(id));
    if (forSale.length > 0) {
      const head = document.createElement('div');
      head.className = 'garage-title';
      head.style.fontSize = '15px';
      head.textContent = 'FOR SALE';
      listEl.appendChild(head);
      for (const [defId, def] of forSale) {
        const row = document.createElement('div');
        row.className = 'garage-row';
        row.innerHTML = `<b>${def.name}</b><span class="garage-sub">${def.kind} · top ${def.topSpeed} m/s · $${price(def.price).toLocaleString('en-US')}</span>`;
        const b = document.createElement('button');
        b.className = 'garage-btn';
        b.textContent = `Buy — $${price(def.price).toLocaleString('en-US')}`;
        b.disabled = p.money < price(def.price);
        b.addEventListener('click', () => {
          if (p.money < price(def.price)) return;
          p.money -= price(def.price);
          state.garage.push(defId);
          msg(`You bought the ${def.name}. It's in the garage.`, 'good');
          if (events) events.emit('garage', { defId, upgrade: 'bought' });
          refresh();
        });
        row.appendChild(b);
        listEl.appendChild(row);
      }
    }
    const money = document.createElement('div');
    money.className = 'garage-money';
    money.textContent = `Cash: $${p.money}`;
    listEl.appendChild(money);
  }

  function openGarage() {
    if (state.screen !== 'play' || !p.onFoot) return;
    if (!nearGarage()) {
      msg('Get closer to Celia’s Garage to use it.', 'info');
      return;
    }
    build();
    if (!el) return;
    open = true;
    el.style.display = 'block';
    refresh();
  }

  function closeGarage() {
    open = false;
    if (el) el.style.display = 'none';
  }

  if (typeof window !== 'undefined') {
    window.addEventListener('keydown', (event) => {
      if (event.repeat) return;
      if (event.code === 'KeyG' && state.screen === 'play' && p.onFoot) {
        if (open) closeGarage();
        else openGarage();
        return;
      }
      if (open && event.code === 'Escape') closeGarage();
    });
  }

  function update(dt) {
    if (open) refresh();
  }

  return {
    update,
    open: openGarage,
    close: closeGarage,
    nearGarage,
    get isOpen() { return open; },
  };
}
