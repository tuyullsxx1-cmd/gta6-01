// Phone and crew calls: Vera points at the next job; Juno scrubs heat;
// Theo repairs; Iris marks the cops; Bram clears them. Same abilities on
// HUD quick-call keys Z / X / V / B, with cooldowns.
import { CREW } from './config.js';
import { currentMission } from './missions.js';
import { clearCops } from './police.js';

export const CREW_CALLS = {
  vera: { key: 'F', cost: 0, cooldown: 5 },
  juno: { key: 'Z', cost: 150, cooldown: 25 },
  theo: { key: 'X', cost: 100, cooldown: 20 },
  iris: { key: 'V', cost: 0, cooldown: 20 },
  bram: { key: 'B', cost: 200, cooldown: 30 },
};

export function crewStatus(state) {
  return CREW.map((m) => {
    const call = CREW_CALLS[m.id];
    const cd = state.phoneCooldowns[m.id] || 0;
    return { ...m, cost: call.cost, key: call.key, ready: cd <= 0 && state.money >= call.cost, cooldown: cd };
  });
}

export function callCrew(state, id, ctx) {
  const m = CREW.find((c) => c.id === id);
  const call = CREW_CALLS[id];
  if (!m || !call) return { ok: false, why: 'unknown crew' };
  if ((state.phoneCooldowns[id] || 0) > 0) return { ok: false, why: 'cooling down' };
  if (state.money < call.cost) return { ok: false, why: 'not enough money' };
  state.money -= call.cost;
  state.phoneCooldowns[id] = call.cooldown;
  const bus = ctx.bus;
  if (id === 'vera') {
    const next = currentMission(state);
    const text = next
      ? `Next job: ${next.title} — ${next.stages[0].objective}`
      : 'No jobs left. Maravilla is yours, Milo.';
    bus.emit('dialogue', { who: 'vera', text });
    bus.emit('message', { text });
  } else if (id === 'juno') {
    state.wanted = Math.max(0, state.wanted - 2);
    state.heat = Math.max(0, state.heat - 40);
    bus.emit('dialogue', { who: 'juno', text: 'Heat scrubbed. Two stars gone — drive like you mean it.' });
  } else if (id === 'theo') {
    if (state.car) state.car.damage = 0;
    bus.emit('dialogue', { who: 'theo', text: 'Ride is patched. She purrs again.' });
  } else if (id === 'iris') {
    state.flags.copsMarked = true;
    bus.emit('dialogue', { who: 'iris', text: 'Every cop in the district is marked on your map. Move smart.' });
  } else if (id === 'bram') {
    clearCops(ctx.police, state);
    bus.emit('dialogue', { who: 'bram', text: 'Cops are gone. I had a word with them.' });
  }
  return { ok: true };
}

export function tickCooldowns(state, dt) {
  for (const k of Object.keys(state.phoneCooldowns)) {
    state.phoneCooldowns[k] = Math.max(0, state.phoneCooldowns[k] - dt);
  }
}
