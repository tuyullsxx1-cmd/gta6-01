// phone.js — Rook's phone and the crew. Key F opens the phone panel;
// the same four abilities sit on HUD cards with quick-call keys.
// Every call checks its cooldown and its price first, then applies the
// effect and confirms it on the message feed.
//
//   Mama Luz (B) — points at the next job. Free, 20s cooldown.
//   Celia Reyes (Z) — scrubs 2 wanted stars. $150, 60s cooldown.
//   Tito Fuentes (X) — repairs the ride. $100, 45s cooldown.
//   Big Marlon (V) — clears nearby cops. $200, 90s cooldown.

function clamp(v, lo, hi) {
  return v < lo ? lo : v > hi ? hi : v;
}

export const CREW = [
  {
    id: 'luz',
    name: 'Mama Luz',
    role: 'Fixer',
    key: 'KeyB',
    keyLabel: 'B',
    cost: 0,
    cooldown: 20,
    blurb: 'Knows every job in Maravilla before it happens.',
    ability: 'Next job',
  },
  {
    id: 'celia',
    name: 'Celia Reyes',
    role: 'Driver / Hacker',
    key: 'KeyZ',
    keyLabel: 'Z',
    cost: 150,
    cooldown: 60,
    blurb: 'Wipes the heat off the grid, two stars at a time.',
    ability: 'Scrub heat −2 stars',
  },
  {
    id: 'tito',
    name: 'Tito Fuentes',
    role: 'Mechanic',
    key: 'KeyX',
    keyLabel: 'X',
    cost: 100,
    cooldown: 45,
    blurb: 'Can make a wrecked ride purr again over the phone.',
    ability: 'Repair ride',
  },
  {
    id: 'marlon',
    name: 'Big Marlon',
    role: 'Muscle',
    key: 'KeyV',
    keyLabel: 'V',
    cost: 200,
    cooldown: 90,
    blurb: 'Has a word with the cops. They listen.',
    ability: 'Clear nearby cops',
  },
];

function ensureCrew(state) {
  if (!state.crew) state.crew = { cooldowns: {} };
  if (!state.crew.cooldowns || typeof state.crew.cooldowns !== 'object') state.crew.cooldowns = {};
  for (const member of CREW) {
    if (typeof state.crew.cooldowns[member.id] !== 'number') state.crew.cooldowns[member.id] = 0;
  }
  return state.crew.cooldowns;
}

function wantedHeatLevel(heat) {
  if (heat <= 0) return 0;
  if (heat <= 15) return 1;
  if (heat <= 35) return 2;
  if (heat <= 55) return 3;
  if (heat <= 75) return 4;
  return 5;
}

export function createPhone(state, bus) {
  const cooldowns = ensureCrew(state);
  let phoneOpen = false;
  // The driving module keeps state.player.currentCar as a car id string,
  // so track the live car object from the bus instead — Tito's repair
  // needs the real object to reset its damage.
  let currentCarObj = null;
  if (bus && typeof bus.on === 'function') {
    bus.on('entered-car', (d) => {
      if (d && d.car) currentCarObj = d.car;
    });
    bus.on('exited-car', () => {
      currentCarObj = null;
    });
  }

  function say(text) {
    if (bus) bus.emit('message', { text });
  }

  function open() {
    phoneOpen = true;
    if (state.flags) state.flags.phoneOpen = true;
    if (bus) {
      bus.emit('phone-opened', {});
      bus.emit('phone-ring', {});
    }
    return true;
  }

  function close() {
    phoneOpen = false;
    if (state.flags) state.flags.phoneOpen = false;
    if (bus) bus.emit('phone-closed', {});
  }

  function toggle() {
    if (phoneOpen) close();
    else open();
    return phoneOpen;
  }

  function cooldownLeft(id) {
    return Math.max(0, Math.ceil(cooldowns[id] || 0));
  }

  function applyEffect(member) {
    if (member.id === 'luz') {
      // Mama Luz points at the next job: the missions module owns the
      // objective, so this is a request it answers plus a feed note.
      if (bus) bus.emit('next-job-requested', { from: 'luz' });
      const objective = state.missions && state.missions.objective ? state.missions.objective : null;
      say(
        objective
          ? 'Mama Luz: next job is ' + objective + '. Get moving, Rook.'
          : 'Mama Luz: check the map, Rook — the next job is marked.',
      );
      return { ok: true };
    }
    if (member.id === 'celia') {
      if (!state.wanted) state.wanted = { level: 0, heat: 0, crime: '' };
      const before = state.wanted.level;
      state.wanted.heat = clamp((state.wanted.heat || 0) - 40, 0, 100);
      state.wanted.level = wantedHeatLevel(state.wanted.heat);
      if (state.wanted.heat === 0) state.wanted.crime = '';
      if (bus) {
        bus.emit('heat-scrubbed', { stars: 2, before, after: state.wanted.level });
        bus.emit('wanted-changed', { level: state.wanted.level, heat: state.wanted.heat, crime: state.wanted.crime });
      }
      say('Celia: heat scrubbed. You are down to ' + state.wanted.level + ' star' + (state.wanted.level === 1 ? '' : 's') + '.');
      return { ok: true };
    }
    if (member.id === 'tito') {
      const car = currentCarObj;
      if (car) {
        car.damage = 0;
        car.burning = false;
        car.burnTime = 0;
        if (car.fireLight && car.fireLight.parent) car.fireLight.parent.remove(car.fireLight);
        car.fireLight = null;
      }
      if (bus) bus.emit('ride-repaired', { car: car && car.id ? car.id : null });
      say('Tito: ride’s patched up. Good as new — well, nearly.');
      return { ok: true };
    }
    if (member.id === 'marlon') {
      if (bus) bus.emit('clear-cops', { radius: 60, from: 'marlon' });
      say('Big Marlon: handled. The cops near you are walking away.');
      return { ok: true };
    }
    return { ok: false, reason: 'unknown crew member' };
  }

  function call(id) {
    const member = CREW.find((m) => m.id === id);
    if (!member) return { ok: false, reason: 'unknown crew member' };
    const left = cooldownLeft(id);
    if (left > 0) {
      say(member.name + ' is busy — try again in ' + left + 's.');
      return { ok: false, reason: 'cooldown', secondsLeft: left };
    }
    const player = state.player || {};
    const money = typeof player.money === 'number' ? player.money : 0;
    if (member.cost > 0 && money < member.cost) {
      say('Not enough cash for ' + member.name + ' — needs $' + member.cost + '.');
      return { ok: false, reason: 'not enough cash', cost: member.cost };
    }
    if (member.id === 'celia' && (!state.wanted || (state.wanted.level || 0) === 0)) {
      say('Celia: you are clean right now. Save the money, Rook.');
      return { ok: false, reason: 'no heat to scrub' };
    }
    if (member.id === 'tito' && (!player.currentCar || player.onFoot !== false)) {
      say('Tito: get in a car first, then I will fix it.');
      return { ok: false, reason: 'not in a car' };
    }
    if (member.cost > 0) player.money = money - member.cost;
    cooldowns[id] = member.cooldown;
    const result = applyEffect(member);
    if (bus) {
      bus.emit('phone-used', { id, name: member.name, cost: member.cost });
      bus.emit('crew-called', { id, name: member.name });
    }
    return result;
  }

  function getAbilities() {
    const player = state.player || {};
    const money = typeof player.money === 'number' ? player.money : 0;
    return CREW.map((m) => ({
      id: m.id,
      name: m.name,
      role: m.role,
      keyLabel: m.keyLabel,
      cost: m.cost,
      cooldown: m.cooldown,
      cooldownLeft: cooldownLeft(m.id),
      affordable: money >= m.cost,
      ability: m.ability,
      blurb: m.blurb,
    }));
  }

  function update(dt) {
    if (!dt || dt <= 0) return;
    for (const member of CREW) {
      if (cooldowns[member.id] > 0) cooldowns[member.id] = Math.max(0, cooldowns[member.id] - dt);
    }
  }

  function handleKey(code) {
    if (code === 'KeyF') {
      toggle();
      return true;
    }
    if (code === 'Escape' && phoneOpen) {
      close();
      return true;
    }
    const member = CREW.find((m) => m.key === code);
    if (member) {
      call(member.id);
      return true;
    }
    return false;
  }

  return {
    update,
    open,
    close,
    toggle,
    isOpen() {
      return phoneOpen;
    },
    call,
    callLuz() {
      return call('luz');
    },
    callCelia() {
      return call('celia');
    },
    callTito() {
      return call('tito');
    },
    callMarlon() {
      return call('marlon');
    },
    cooldownLeft,
    getAbilities,
    crewList: CREW,
    handleKey,
  };
}
