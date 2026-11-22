// Procedural WebAudio radio: three invented stations, no audio files.
// Each station is a small step sequencer over its own scale and waveform.
import { RADIO } from './config.js';

export function createAudio() {
  let ctx = null;
  let timer = null;
  let step = 0;
  let muted = false;
  let station = 0;
  let started = false;

  function ensure() {
    if (!ctx) {
      try { ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { ctx = null; }
    }
    if (ctx && ctx.state === 'suspended') ctx.resume();
    return ctx;
  }

  function note(freq, dur, wave, gainVal, when = 0) {
    if (!ctx || muted) return;
    const t = ctx.currentTime + when;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = wave; o.frequency.value = freq;
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(gainVal, t + 0.02);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g); g.connect(ctx.destination);
    o.start(t); o.stop(t + dur + 0.05);
  }

  function tick() {
    const st = RADIO[station];
    const scale = st.scale;
    const beat = 60 / st.bpm / 2;
    const deg = scale[step % scale.length] + 12 * Math.floor((step / scale.length) % 2);
    const freq = st.root * Math.pow(2, deg / 12);
    if (step % 2 === 0) note(freq, beat * 1.8, st.wave, 0.11);
    if (step % 4 === 0) note(st.root / 2, beat * 3.5, 'sine', 0.16);
    if (step % 8 === 6) note(freq * 2, beat, 'square', 0.04);
    step += 1;
  }

  return {
    unlock() { ensure(); if (!started) { started = true; const st = RADIO[station]; timer = setInterval(tick, (60 / st.bpm / 2) * 1000); } },
    setStation(i) {
      station = ((i % RADIO.length) + RADIO.length) % RADIO.length;
      step = 0;
      if (timer) { clearInterval(timer); const st = RADIO[station]; timer = setInterval(tick, (60 / st.bpm / 2) * 1000); }
      return RADIO[station];
    },
    nextStation() { return this.setStation(station + 1); },
    station() { return RADIO[station]; },
    setMuted(m) { muted = m; },
    isMuted() { return muted; },
    sfx(kind) {
      if (!ctx || muted) return;
      ensure();
      if (kind === 'shot') note(180 + Math.random() * 60, 0.12, 'square', 0.2);
      else if (kind === 'explosion') { note(60, 0.7, 'sawtooth', 0.3); note(40, 0.9, 'sine', 0.3); }
      else if (kind === 'horn') note(330, 0.25, 'square', 0.12);
      else if (kind === 'pickup') { note(660, 0.12, 'sine', 0.15); note(880, 0.18, 'sine', 0.15, 0.08); }
      else if (kind === 'mission') { note(523, 0.15, 'triangle', 0.15); note(659, 0.15, 'triangle', 0.15, 0.12); note(784, 0.3, 'triangle', 0.15, 0.24); }
    },
  };
}
