// audio.js — procedural radio and sound effects. Everything is
// synthesised live with WebAudio: three invented stations with their own
// melodies, tempos, and instruments, plus one-shot effects for shots,
// explosions, horns, pickups, the phone, and mission stings. There are no
// audio files and no network requests. The AudioContext is created lazily
// and resumed on the first user gesture; every call is guarded, so a
// suspended or missing context can never crash the game.

function clamp(v, lo, hi) {
  return v < lo ? lo : v > hi ? hi : v;
}

// Deterministic PRNG for small musical variations (fills, hat accents).
function mulberry32(seed) {
  let a = seed >>> 0;
  return function next() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function midiToFreq(midi) {
  return 440 * Math.pow(2, (midi - 69) / 12);
}

// 0 means a rest. Sixteen steps per bar, four bars per loop.
export const STATIONS = [
  {
    id: 'faro-rock',
    name: 'Faro Rock 101',
    bpm: 132,
    leadWave: 'square',
    bassWave: 'sawtooth',
    leadGain: 0.05,
    bassGain: 0.07,
    // A minor pentatonic, driving and bright.
    lead: [
      69, 0, 72, 0, 74, 0, 72, 0, 76, 0, 74, 72, 0, 69, 0, 0,
      69, 0, 72, 0, 74, 76, 0, 74, 72, 0, 69, 0, 67, 0, 0, 0,
      69, 0, 72, 0, 74, 0, 72, 0, 76, 79, 76, 74, 72, 74, 0, 0,
      76, 0, 74, 72, 74, 0, 72, 0, 69, 0, 67, 0, 64, 0, 0, 0,
    ],
    bass: [
      45, 0, 45, 0, 45, 0, 48, 0, 45, 0, 45, 0, 43, 0, 43, 0,
      45, 0, 45, 0, 45, 0, 48, 0, 50, 0, 48, 0, 45, 0, 43, 0,
      45, 0, 45, 0, 45, 0, 48, 0, 45, 0, 45, 0, 43, 0, 43, 0,
      41, 0, 41, 0, 43, 0, 45, 0, 48, 0, 50, 0, 52, 0, 52, 0,
    ],
  },
  {
    id: 'maravilla-nights',
    name: 'Maravilla Nights',
    bpm: 96,
    leadWave: 'triangle',
    bassWave: 'sine',
    leadGain: 0.06,
    bassGain: 0.08,
    // D minor seven, smooth and late-night.
    lead: [
      62, 0, 0, 65, 0, 0, 69, 0, 0, 0, 67, 0, 65, 0, 0, 0,
      62, 0, 0, 65, 0, 0, 69, 0, 72, 0, 0, 69, 0, 0, 67, 0,
      65, 0, 0, 69, 0, 0, 72, 0, 0, 0, 74, 0, 72, 0, 69, 0,
      67, 0, 0, 65, 0, 0, 62, 0, 0, 0, 60, 0, 0, 0, 0, 0,
    ],
    bass: [
      38, 0, 0, 0, 0, 0, 38, 0, 41, 0, 0, 0, 0, 0, 41, 0,
      38, 0, 0, 0, 0, 0, 38, 0, 41, 0, 0, 0, 0, 0, 45, 0,
      38, 0, 0, 0, 0, 0, 38, 0, 43, 0, 0, 0, 0, 0, 43, 0,
      41, 0, 0, 0, 0, 0, 41, 0, 38, 0, 0, 0, 36, 0, 36, 0,
    ],
  },
  {
    id: 'sol-fm',
    name: 'Sol FM',
    bpm: 112,
    leadWave: 'triangle',
    bassWave: 'triangle',
    leadGain: 0.06,
    bassGain: 0.07,
    // C major, sunny and bouncy.
    lead: [
      72, 0, 76, 0, 79, 0, 76, 0, 72, 0, 74, 0, 76, 0, 0, 0,
      77, 0, 76, 0, 74, 0, 76, 0, 79, 0, 76, 0, 74, 72, 0, 0,
      72, 0, 76, 0, 79, 0, 81, 0, 79, 76, 0, 74, 0, 76, 0, 0,
      79, 0, 76, 0, 74, 0, 72, 0, 74, 0, 76, 0, 79, 0, 0, 0,
    ],
    bass: [
      48, 0, 0, 48, 0, 0, 55, 0, 48, 0, 0, 48, 0, 0, 53, 0,
      48, 0, 0, 48, 0, 0, 55, 0, 50, 0, 0, 50, 0, 0, 52, 0,
      48, 0, 0, 48, 0, 0, 55, 0, 48, 0, 0, 48, 0, 0, 53, 0,
      50, 0, 0, 50, 0, 0, 52, 0, 55, 0, 0, 55, 0, 0, 55, 0,
    ],
  },
];

export const STATION_NAMES = STATIONS.map((s) => s.name);

export function createAudio(state, bus) {
  const rng = mulberry32(0x41554449); // 'AUDI'
  let ctx = null;
  let master = null;
  let musicGain = null;
  let sfxGain = null;
  let noiseBuffer = null;
  let schedulerTimer = null;
  let step = 0;
  let nextStepTime = 0;
  let sirenTimer = 0;
  let sirenHigh = false;

  function radioState() {
    if (!state.radio) state.radio = { station: 0, muted: false };
    if (typeof state.radio.station !== 'number') state.radio.station = 0;
    if (typeof state.radio.muted !== 'boolean') state.radio.muted = false;
    return state.radio;
  }

  function isMuted() {
    return radioState().muted || (state.flags ? state.flags.muted === true : false);
  }

  function currentStation() {
    const r = radioState();
    return STATIONS[clamp(r.station, 0, STATIONS.length - 1)];
  }

  function ensureContext() {
    if (ctx) return ctx;
    try {
      const AC =
        typeof window !== 'undefined'
          ? window.AudioContext || window.webkitAudioContext
          : null;
      if (!AC) return null;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = isMuted() ? 0 : 0.9;
      master.connect(ctx.destination);
      musicGain = ctx.createGain();
      musicGain.gain.value = 0.5;
      musicGain.connect(master);
      sfxGain = ctx.createGain();
      sfxGain.gain.value = 0.9;
      sfxGain.connect(master);
      const len = ctx.sampleRate;
      noiseBuffer = ctx.createBuffer(1, len, ctx.sampleRate);
      const data = noiseBuffer.getChannelData(0);
      for (let i = 0; i < len; i += 1) data[i] = rng() * 2 - 1;
      startScheduler();
    } catch (err) {
      ctx = null;
    }
    return ctx;
  }

  // Call from any user gesture (click, keydown). Safe to call often.
  function resume() {
    try {
      const c = ensureContext();
      if (c && c.state === 'suspended') {
        const p = c.resume();
        if (p && typeof p.catch === 'function') p.catch(() => {});
      }
    } catch (err) {
      // Audio must never break the game.
    }
  }

  function scheduleStep(stepIndex, time) {
    if (!ctx) return;
    try {
      const station = currentStation();
      const total = station.lead.length;
      const i = stepIndex % total;
      const leadNote = station.lead[i];
      const bassNote = station.bass[i];
      const stepDur = 60 / station.bpm / 4;
      if (leadNote > 0) {
        playTone(midiToFreq(leadNote), time, stepDur * 0.9, station.leadWave, station.leadGain, musicGain);
      }
      if (bassNote > 0) {
        playTone(midiToFreq(bassNote), time, stepDur * 0.95, station.bassWave, station.bassGain, musicGain);
      }
      // Hat tick on the off-beats, slightly varied so it breathes.
      if (i % 4 === 2 && rng() < 0.8) {
        playNoise(time, 0.03, 0.015, 6000);
      }
    } catch (err) {
      // A missed note is not worth an exception.
    }
  }

  function startScheduler() {
    if (schedulerTimer !== null || !ctx) return;
    nextStepTime = ctx.currentTime + 0.05;
    step = 0;
    schedulerTimer = setInterval(() => {
      try {
        if (!ctx || ctx.state !== 'running') return;
        const station = currentStation();
        const stepDur = 60 / station.bpm / 4;
        while (nextStepTime < ctx.currentTime + 0.18) {
          scheduleStep(step, nextStepTime);
          nextStepTime += stepDur;
          step += 1;
        }
      } catch (err) {
        // Scheduler must never throw.
      }
    }, 60);
  }

  function playTone(freq, time, dur, wave, gainValue, dest) {
    if (!ctx) return;
    try {
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = wave;
      osc.frequency.setValueAtTime(freq, time);
      g.gain.setValueAtTime(0, time);
      g.gain.linearRampToValueAtTime(gainValue, time + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, time + dur);
      osc.connect(g);
      g.connect(dest || sfxGain);
      osc.start(time);
      osc.stop(time + dur + 0.05);
    } catch (err) {
      // Ignore audio errors.
    }
  }

  function playNoise(time, dur, gainValue, filterFreq) {
    if (!ctx || !noiseBuffer) return;
    try {
      const src = ctx.createBufferSource();
      src.buffer = noiseBuffer;
      src.loop = true;
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(filterFreq || 1200, time);
      const g = ctx.createGain();
      g.gain.setValueAtTime(gainValue, time);
      g.gain.exponentialRampToValueAtTime(0.0001, time + dur);
      src.connect(filter);
      filter.connect(g);
      g.connect(sfxGain);
      src.start(time);
      src.stop(time + dur + 0.05);
    } catch (err) {
      // Ignore audio errors.
    }
  }

  function playSfx(name, opts) {
    if (isMuted()) return;
    try {
      const c = ensureContext();
      if (!c || c.state !== 'running') return;
      const t = c.currentTime + 0.01;
      if (name === 'shot') {
        playNoise(t, 0.09, 0.25, 3000);
        playTone(170, t, 0.08, 'square', 0.12, sfxGain);
      } else if (name === 'explosion') {
        playNoise(t, 0.8, 0.5, 900);
        playTone(120, t, 0.7, 'sine', 0.35, sfxGain);
        playTone(55, t + 0.05, 0.6, 'sine', 0.3, sfxGain);
      } else if (name === 'horn') {
        playTone(370, t, 0.35, 'sawtooth', 0.1, sfxGain);
        playTone(466, t, 0.35, 'sawtooth', 0.1, sfxGain);
      } else if (name === 'pickup') {
        playTone(660, t, 0.09, 'sine', 0.15, sfxGain);
        playTone(990, t + 0.09, 0.14, 'sine', 0.15, sfxGain);
      } else if (name === 'phone-ring') {
        playTone(1250, t, 0.12, 'sine', 0.12, sfxGain);
        playTone(1500, t + 0.16, 0.12, 'sine', 0.12, sfxGain);
      } else if (name === 'mission-sting') {
        const notes = [72, 76, 79, 84];
        notes.forEach((n, i) => playTone(midiToFreq(n), t + i * 0.11, 0.22, 'triangle', 0.14, sfxGain));
      } else if (name === 'reload') {
        playTone(1200, t, 0.04, 'square', 0.08, sfxGain);
        playTone(900, t + 0.12, 0.04, 'square', 0.08, sfxGain);
      } else if (name === 'busted') {
        playTone(392, t, 0.25, 'sawtooth', 0.12, sfxGain);
        playTone(311, t + 0.25, 0.4, 'sawtooth', 0.12, sfxGain);
      } else if (name === 'siren-blip') {
        playTone(sirenHigh ? 950 : 700, t, 0.35, 'sine', 0.05, sfxGain);
        sirenHigh = !sirenHigh;
      }
    } catch (err) {
      // Sound effects must never crash the game.
    }
  }

  function setStation(index) {
    const r = radioState();
    r.station = clamp(index, 0, STATIONS.length - 1);
    if (bus) bus.emit('radio-changed', { station: r.station, name: STATIONS[r.station].name });
    return STATIONS[r.station].name;
  }

  function nextStation() {
    const r = radioState();
    return setStation((r.station + 1) % STATIONS.length);
  }

  function setMuted(muted) {
    const r = radioState();
    r.muted = !!muted;
    if (state.flags) state.flags.muted = r.muted;
    try {
      if (master && ctx) master.gain.setValueAtTime(r.muted ? 0 : 0.9, ctx.currentTime);
    } catch (err) {
      // Ignore.
    }
    if (bus) bus.emit('mute-changed', { muted: r.muted });
    return r.muted;
  }

  function toggleMute() {
    return setMuted(!isMuted());
  }

  function update(dt) {
    if (!dt || dt <= 0) return;
    // A soft two-tone siren while the heat is on, driven by game time.
    const level = state.wanted ? state.wanted.level || 0 : 0;
    if (level > 0 && !isMuted()) {
      sirenTimer -= dt;
      if (sirenTimer <= 0) {
        sirenTimer = 0.9;
        playSfx('siren-blip');
      }
    } else {
      sirenTimer = 0;
    }
  }

  function handleKey(code) {
    if (code === 'KeyC') {
      const name = nextStation();
      if (bus) bus.emit('message', { text: 'Radio: ' + name });
      return true;
    }
    if (code === 'KeyM') {
      const muted = toggleMute();
      if (bus) bus.emit('message', { text: muted ? 'Radio muted.' : 'Radio on: ' + currentStation().name });
      return true;
    }
    return false;
  }

  if (bus) {
    bus.on('shot-fired', () => playSfx('shot'));
    bus.on('explosion', () => playSfx('explosion'));
    bus.on('pickup', () => playSfx('pickup'));
    bus.on('phone-used', () => playSfx('phone-ring'));
    bus.on('phone-opened', () => playSfx('phone-ring'));
    bus.on('mission-complete', () => playSfx('mission-sting'));
    bus.on('horn', () => playSfx('horn'));
    bus.on('honk', () => playSfx('horn'));
    bus.on('reload-started', () => playSfx('reload'));
    bus.on('busted', () => playSfx('busted'));
    bus.on('user-gesture', () => resume());
  }

  // Resume on the first gesture even without the bus: main.js can call
  // resume() from its own keydown / pointerdown handlers.
  return {
    update,
    resume,
    ensureContext,
    setStation,
    nextStation,
    setMuted,
    toggleMute,
    isMuted,
    currentStation,
    stationName() {
      return currentStation().name;
    },
    playSfx,
    handleKey,
    stations: STATIONS,
  };
}
