// Procedural WebAudio: no audio files, no network. Radio is three invented
// stations from config (tiny oscillator step-sequencers), plus engine hum,
// horn, gunshots, explosions, pickups and a mission sting. Everything is
// created lazily on first use (after the player presses Enter) and every
// method is a no-op — never a throw — when AudioContext is unavailable
// (headless Chrome has no audio). Mute is M, radio station is C (held-edge);
// input.js never maps ACTION_RADIO, so C is the documented radio key.

import { RADIO } from './config.js';

// Per-station step patterns (8th notes). root is in Hz (RADIO[].root).
const PATTERNS = [
  // RADIO SOL — latin pop: warm pad chords + bass.
  { wave: 'triangle', arp: [1, 1.5, 2, 1.5], bass: [1, 1, 0.75, 1.33], vol: 0.10, pad: true },
  // OLA FM — chillwave: slow sine arpeggio.
  { wave: 'sine', arp: [2, 2.52, 3, 2.52, 4, 3, 2.52, 2], bass: [1, 0.5, 0.75, 0.5], vol: 0.09, pad: false },
  // FARO ROCK — fast square arpeggio + driving bass.
  { wave: 'square', arp: [1, 1.5, 2, 3, 2, 1.5], bass: [1, 1, 1.5, 1], vol: 0.06, pad: false },
];

export function createAudio(ctx) {
  const state = ctx ? ctx.state : null;
  const input = ctx ? ctx.input : null;
  let ac = null;
  let master = null;
  let radioGain = null;
  let engineOsc = null;
  let engineGain = null;
  let enabled = false;
  let tried = false;
  let step = 0;
  let nextNote = 0;
  let prevM = false;
  let prevC = false;

  function ensure() {
    if (enabled) return true;
    if (tried) return false;
    tried = true;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      ac = new AC();
      master = ac.createGain();
      master.gain.value = state && state.muted ? 0 : 0.5;
      master.connect(ac.destination);
      radioGain = ac.createGain();
      radioGain.gain.value = 0.6;
      radioGain.connect(master);
      engineOsc = ac.createOscillator();
      engineOsc.type = 'sawtooth';
      engineOsc.frequency.value = 55;
      engineGain = ac.createGain();
      engineGain.gain.value = 0;
      engineOsc.connect(engineGain);
      engineGain.connect(master);
      engineOsc.start();
      enabled = true;
      return true;
    } catch (e) {
      return false;
    }
  }

  function resume() {
    try {
      if (ac && ac.state === 'suspended') ac.resume().catch(() => {});
    } catch (e) { /* no-op */ }
  }

  function tone(freq, dur, type = 'sine', vol = 0.2, when = 0, slideTo = null) {
    if (!enabled) return;
    try {
      const t0 = ac.currentTime + when;
      const o = ac.createOscillator();
      const g = ac.createGain();
      o.type = type;
      o.frequency.setValueAtTime(Math.max(20, freq), t0);
      if (slideTo) o.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), t0 + dur);
      g.gain.setValueAtTime(0, t0);
      g.gain.linearRampToValueAtTime(vol, t0 + 0.01);
      g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
      o.connect(g);
      g.connect(master);
      o.start(t0);
      o.stop(t0 + dur + 0.05);
    } catch (e) { /* no-op */ }
  }

  function noiseBurst(dur, vol = 0.3, filterFreq = 1200) {
    if (!enabled) return;
    try {
      const len = Math.floor(ac.sampleRate * dur);
      const buf = ac.createBuffer(1, len, ac.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < len; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
      const src = ac.createBufferSource();
      src.buffer = buf;
      const filter = ac.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = filterFreq;
      const g = ac.createGain();
      g.gain.value = vol;
      src.connect(filter);
      filter.connect(g);
      g.connect(master);
      src.start();
    } catch (e) { /* no-op */ }
  }

  function scheduleRadioStep(station, when) {
    if (!enabled) return;
    try {
      const st = RADIO[station] || RADIO[0];
      const pat = PATTERNS[station] || PATTERNS[0];
      const root = st.root || 55;
      const arpNote = pat.arp[step % pat.arp.length] * root * 2;
      const bassNote = pat.bass[step % pat.bass.length] * root;
      const t0 = when;
      const mk = (freq, type, vol, dur) => {
        const o = ac.createOscillator();
        const g = ac.createGain();
        o.type = type;
        o.frequency.value = freq;
        g.gain.setValueAtTime(0, t0);
        g.gain.linearRampToValueAtTime(vol, t0 + 0.02);
        g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
        o.connect(g);
        g.connect(radioGain);
        o.start(t0);
        o.stop(t0 + dur + 0.05);
      };
      mk(arpNote, pat.wave, pat.vol, 0.28);
      if (step % 2 === 0) mk(bassNote, 'sine', 0.14, 0.4);
      if (pat.pad && step % 4 === 0) {
        mk(root * 2, 'triangle', 0.05, 0.9);
        mk(root * 3, 'triangle', 0.03, 0.9);
      }
    } catch (e) { /* no-op */ }
  }

  function radioNext() {
    if (!state) return '';
    state.radio.station = (state.radio.station + 1) % RADIO.length;
    step = 0;
    return (RADIO[state.radio.station] || {}).name || '';
  }

  function setMuted(m) {
    if (state) state.muted = !!m;
    try {
      if (master) master.gain.value = m ? 0 : 0.5;
    } catch (e) { /* no-op */ }
  }

  function update(dt) {
    // M mute / C radio-next, held-edge so they never fight takeActions().
    if (input) {
      const mHeld = input.held('KeyM');
      if (mHeld && !prevM) setMuted(!(state && state.muted));
      prevM = mHeld;
      const cHeld = input.held('KeyC');
      if (cHeld && !prevC) radioNext();
      prevC = cHeld;
    }
    if (!state || state.screen !== 'play') return;
    if (!state.radio.on || state.muted) return;
    if (!ensure()) return;
    resume();
    try {
      const st = RADIO[state.radio.station] || RADIO[0];
      const beat = 60 / (st.bpm || 100) / 2; // 8th notes
      if (nextNote < ac.currentTime) nextNote = ac.currentTime + 0.05;
      while (nextNote < ac.currentTime + 0.15) {
        scheduleRadioStep(state.radio.station, nextNote);
        step += 1;
        nextNote += beat;
      }
    } catch (e) { /* no-op */ }
  }

  function horn() {
    if (!ensure()) return;
    resume();
    tone(370, 0.35, 'square', 0.12);
    tone(466, 0.35, 'square', 0.12);
  }

  function shoot(weaponId) {
    if (!ensure()) return;
    resume();
    try {
      if (weaponId === 'shotgun') { noiseBurst(0.22, 0.5, 900); tone(180, 0.15, 'square', 0.2, 0, 60); }
      else if (weaponId === 'smg') { tone(900, 0.06, 'square', 0.16, 0, 220); noiseBurst(0.05, 0.18, 2400); }
      else if (weaponId === 'rifle') { noiseBurst(0.18, 0.45, 1600); tone(700, 0.12, 'square', 0.2, 0, 140); }
      else { tone(800, 0.09, 'square', 0.18, 0, 180); noiseBurst(0.06, 0.2, 2000); }
    } catch (e) { /* no-op */ }
  }

  function explosion() {
    if (!ensure()) return;
    resume();
    noiseBurst(0.8, 0.6, 700);
    tone(120, 0.7, 'sine', 0.4, 0, 30);
  }

  function pickup() {
    if (!ensure()) return;
    resume();
    tone(660, 0.09, 'sine', 0.2);
    tone(880, 0.14, 'sine', 0.2, 0.09);
  }

  function missionSting() {
    if (!ensure()) return;
    resume();
    [523, 659, 784, 1046].forEach((f, i) => tone(f, 0.22, 'triangle', 0.18, i * 0.09));
  }

  // Generic one-shot dispatcher for systems that call audio.play(name):
  // 'shot' (generic gunshot), 'click' (UI blip), 'swing' (melee whoosh).
  function play(name) {
    if (!ensure()) return;
    resume();
    try {
      if (name === 'shot') shoot('pistol');
      else if (name === 'swing') { noiseBurst(0.12, 0.15, 3000); tone(300, 0.12, 'sine', 0.1, 0, 90); }
      else tone(660, 0.06, 'sine', 0.12); // 'click' and anything else
    } catch (e) { /* no-op */ }
  }

  function engine(on, speed01) {
    if (!enabled) return;
    try {
      if (!engineOsc || !engineGain) return;
      const target = on ? 0.035 + Math.min(1, speed01 || 0) * 0.045 : 0;
      engineGain.gain.setTargetAtTime(target, ac.currentTime, 0.08);
      engineOsc.frequency.setTargetAtTime(55 + Math.min(1, speed01 || 0) * 165, ac.currentTime, 0.08);
    } catch (e) { /* no-op */ }
  }

  return {
    update, horn, shoot, explosion, pickup, missionSting, radioNext, setMuted, engine, play,
    get enabled() { return enabled; },
  };
}
