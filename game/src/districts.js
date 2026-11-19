// Maravilla — district standing: six named districts, one standing value
// each (0..100, 50 = neutral). Standing rises +8 when a mission finishes
// in a district and falls -3 when the player causes heat there. Standing
// is not a number on a screen any more: it changes the game in the
// district the player is standing in (police.js and the garage/gunshop
// read state.standingFx every frame):
//   LOYAL (>=80): locals hide you — heat rises slower, fades faster,
//     cops are slower, prices 10% off.
//   WARM (60-79): same, smaller.
//   COLD (25-39): snitches — heat rises faster, fades slower, cops
//     faster, prices 10% up, district jobs pay less.
//   HOSTILE (<25): everyone is watching — heat rises much faster, fades
//     much slower, cops faster, prices 20% up, district jobs closed.
// The HUD shows the effect line under the district bar.

import { districtAt } from './config.js';

const FX = [
  { min: 80, wantedGain: 0.75, decayMult: 1.5, copSpeed: 0.9, priceMult: 0.9, jobMult: 1.25,
    label: 'LOYAL — LOCALS HIDE YOU · heat fades faster · 10% off · jobs pay +25%' },
  { min: 60, wantedGain: 0.9, decayMult: 1.25, copSpeed: 0.95, priceMult: 0.95, jobMult: 1.1,
    label: 'WARM — EYES ELSEWHERE · heat fades a little faster · 5% off' },
  { min: 40, wantedGain: 1, decayMult: 1, copSpeed: 1, priceMult: 1, jobMult: 1,
    label: 'NEUTRAL GROUND' },
  { min: 25, wantedGain: 1.15, decayMult: 0.85, copSpeed: 1.05, priceMult: 1.1, jobMult: 0.85,
    label: 'COLD — SNITCHES ABOUT · heat sticks · prices +10%' },
  { min: 0, wantedGain: 1.3, decayMult: 0.7, copSpeed: 1.1, priceMult: 1.2, jobMult: 0,
    label: 'HOSTILE — EVERYONE IS WATCHING · heat rises fast · jobs closed · prices +20%' },
];

export function createDistricts(ctx) {
  const { state, events } = ctx;

  function bump(name, amount) {
    if (!(name in state.districtStanding)) return;
    const cur = state.districtStanding[name];
    state.districtStanding[name] = Math.max(0, Math.min(100, cur + amount));
  }

  if (events) {
    // Use the LIVE player position here, not state.district: districts
    // update() runs after missions in the frame, so state.district is
    // still the previous frame's district when a mission completes.
    events.on('mission', (d) => {
      if (d && d.stage === 'complete') {
        bump(districtAt(state.player.x, state.player.z), 8);
      }
    });
    events.on('crime', () => {
      bump(districtAt(state.player.x, state.player.z), -3);
    });
  }

  function update() {
    state.district = districtAt(state.player.x, state.player.z);
    const v = state.districtStanding[state.district] ?? 50;
    const fx = FX.find((f) => v >= f.min) || FX[2];
    state.standingFx = {
      wantedGain: fx.wantedGain, decayMult: fx.decayMult,
      copSpeed: fx.copSpeed, priceMult: fx.priceMult, jobMult: fx.jobMult,
      label: fx.label,
    };
  }

  return { update };
}
