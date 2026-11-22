// District standing: LOYAL / WARM / NEUTRAL / COLD / HOSTILE, with real
// effects on heat, fade, cop speed, prices and job pay. Missions lift a
// district by 8; crimes lower it by 3 (see police.addHeat).
import { DISTRICTS, DISTRICT_TIERS } from './config.js';
import { districtAt, tierFor } from './state.js';

export function standingOf(state, x, z) {
  const d = districtAt(x, z);
  const value = state.standing[d.id];
  return { district: d, value, tier: tierFor(value, DISTRICT_TIERS) };
}

export function currentStanding(state) {
  const p = state.car ? { x: state.car.x, z: state.car.z } : { x: state.player.x, z: state.player.z };
  return standingOf(state, p.x, p.z);
}

export function priceFor(state, base, x, z) {
  const { tier } = standingOf(state, x, z);
  return Math.round(base * tier.priceMul);
}

export function payFor(state, base, x, z) {
  const { tier } = standingOf(state, x, z);
  return Math.round(base * tier.payMul);
}

export function jobsOpen(state, districtId) {
  return tierFor(state.standing[districtId], DISTRICT_TIERS).jobsOpen;
}

export function allStandings(state) {
  return DISTRICTS.map((d) => ({ ...d, value: state.standing[d.id], tier: tierFor(state.standing[d.id], DISTRICT_TIERS) }));
}
