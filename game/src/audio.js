'use strict';
/* MARAVILLA — WebAudio: engine hum, 3 synth radio stations, SFX. All no-ops if audio is unavailable. */
var MV = window.MV || (window.MV = {});

MV.audio = (function () {
  var ctx = null, master = null, musicGain = null, sfxGain = null;
  var engineOsc = null, engineGain = null, engineFilter = null;
  var sirenOsc = null, sirenGain = null, sirenTimer = 0;
  var station = 0, musicTimer = null, step = 0, muted = false;
  var STATIONS = [
    { name: 'VELVET FM', tag: 'smooth dusk grooves', bpm: 92, root: 220, scale: [0, 3, 5, 7, 10], wave: 'triangle' },
    { name: 'NEON 99', tag: 'midnight drive energy', bpm: 124, root: 196, scale: [0, 2, 3, 7, 9], wave: 'sawtooth' },
    { name: 'TALK MARAVILLA', tag: 'the city talks back', bpm: 100, root: 262, scale: [0, 4, 7, 12], wave: 'sine' }
  ];

  function ensure() {
    if (ctx) { if (ctx.state === 'suspended') ctx.resume().catch(function () {}); return true; }
    try {
      var AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      ctx = new AC();
      master = ctx.createGain(); master.gain.value = muted ? 0 : 0.55; master.connect(ctx.destination);
      musicGain = ctx.createGain(); musicGain.gain.value = 0.16; musicGain.connect(master);
      sfxGain = ctx.createGain(); sfxGain.gain.value = 0.5; sfxGain.connect(master);
      engineOsc = ctx.createOscillator(); engineOsc.type = 'sawtooth'; engineOsc.frequency.value = 42;
      engineFilter = ctx.createBiquadFilter(); engineFilter.type = 'lowpass'; engineFilter.frequency.value = 320;
      engineGain = ctx.createGain(); engineGain.gain.value = 0;
      engineOsc.connect(engineFilter); engineFilter.connect(engineGain); engineGain.connect(master);
      engineOsc.start();
      startStation();
      return true;
    } catch (e) { ctx = null; return false; }
  }
  function setMuted(m) { muted = m; if (master && ctx) master.gain.value = m ? 0 : 0.55; }
  function isMuted() { return muted; }

  function midi(n) { return 440 * Math.pow(2, (n - 69) / 12); }
  function noteAt(time, midiNote, dur, wave, gain, dest) {
    var o = ctx.createOscillator(), g = ctx.createGain();
    o.type = wave; o.frequency.value = midi(midiNote);
    g.gain.setValueAtTime(0, time);
    g.gain.linearRampToValueAtTime(gain, time + 0.02);
    g.gain.exponentialRampToValueAtTime(0.001, time + dur);
    o.connect(g); g.connect(dest || musicGain);
    o.start(time); o.stop(time + dur + 0.05);
  }
  function startStation() {
    if (!ctx || musicTimer) return;
    var st = STATIONS[station];
    var spb = 60 / st.bpm / 2;
    step = 0;
    musicTimer = setInterval(function () {
      if (!ctx || ctx.state !== 'running') return;
      var t = ctx.currentTime + 0.06;
      var scale = st.scale, deg = scale[step % scale.length];
      var rootMidi = 69 + Math.round(12 * Math.log2(st.root / 440));
      if (step % 2 === 0) noteAt(t, rootMidi + deg, spb * 1.8, st.wave, 0.5);
      if (step % 8 === 4) noteAt(t, rootMidi - 12, spb * 3, 'sine', 0.7);
      if (step % 4 === 2) noteAt(t, rootMidi + 12 + scale[(step + 2) % scale.length], spb, 'sine', 0.25);
      step++;
    }, spb * 1000);
  }
  function setStation(i) {
    station = ((i % STATIONS.length) + STATIONS.length) % STATIONS.length;
    if (musicTimer) { clearInterval(musicTimer); musicTimer = null; }
    startStation();
    return STATIONS[station];
  }
  function stationName() { return STATIONS[station].name; }
  function nextStation() { return setStation(station + 1); }

  function setEngine(speed01, on) {
    if (!ctx || !engineOsc) return;
    var f = 42 + speed01 * 130;
    engineOsc.frequency.setTargetAtTime(f, ctx.currentTime, 0.08);
    engineGain.gain.setTargetAtTime(on ? 0.05 + speed01 * 0.06 : 0, ctx.currentTime, 0.1);
    engineFilter.frequency.setTargetAtTime(300 + speed01 * 900, ctx.currentTime, 0.1);
  }
  function blip(freq, dur, wave, gain) {
    if (!ctx) return;
    try {
      var t = ctx.currentTime;
      noteAt(t, 69 + Math.round(12 * Math.log2(freq / 440)), dur, wave || 'square', gain || 0.4, sfxGain);
    } catch (e) {}
  }
  function noiseBurst(dur, gain, low) {
    if (!ctx) return;
    try {
      var len = Math.floor(ctx.sampleRate * dur);
      var buf = ctx.createBuffer(1, len, ctx.sampleRate);
      var d = buf.getChannelData(0);
      for (var i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
      var src = ctx.createBufferSource(); src.buffer = buf;
      var flt = ctx.createBiquadFilter(); flt.type = 'lowpass'; flt.frequency.value = low || 900;
      var g = ctx.createGain(); g.gain.value = gain || 0.5;
      src.connect(flt); flt.connect(g); g.connect(sfxGain);
      src.start();
    } catch (e) {}
  }
  function shot() { noiseBurst(0.12, 0.5, 2400); blip(180, 0.08, 'square', 0.3); }
  function explosion() {
    noiseBurst(0.9, 0.9, 420);
    if (!ctx) return;
    try {
      var o = ctx.createOscillator(), g = ctx.createGain();
      o.type = 'sine'; o.frequency.setValueAtTime(90, ctx.currentTime);
      o.frequency.exponentialRampToValueAtTime(28, ctx.currentTime + 0.8);
      g.gain.setValueAtTime(0.8, ctx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.9);
      o.connect(g); g.connect(sfxGain); o.start(); o.stop(ctx.currentTime + 0.95);
    } catch (e) {}
  }
  function pickup() { blip(660, 0.09, 'sine', 0.4); setTimeout(function () { blip(990, 0.12, 'sine', 0.4); }, 90); }
  function click() { blip(520, 0.05, 'square', 0.25); }
  function cash() { blip(880, 0.08, 'sine', 0.35); setTimeout(function () { blip(1320, 0.14, 'sine', 0.35); }, 100); }
  function siren(on) {
    if (!ctx) return;
    if (on && !sirenOsc) {
      try {
        sirenOsc = ctx.createOscillator(); sirenOsc.type = 'sine';
        sirenGain = ctx.createGain(); sirenGain.gain.value = 0.05;
        sirenOsc.connect(sirenGain); sirenGain.connect(master);
        sirenOsc.start();
        sirenTimer = setInterval(function () {
          if (!sirenOsc) return;
          sirenOsc.frequency.setTargetAtTime(sirenOsc.frequency.value > 800 ? 620 : 940, ctx.currentTime, 0.05);
        }, 420);
      } catch (e) { sirenOsc = null; }
    } else if (!on && sirenOsc) {
      clearInterval(sirenTimer);
      try { sirenOsc.stop(); } catch (e) {}
      sirenOsc = null;
    }
  }

  return {
    ensure: ensure, setMuted: setMuted, isMuted: isMuted,
    setEngine: setEngine, nextStation: nextStation, stationName: stationName,
    shot: shot, explosion: explosion, pickup: pickup, click: click, cash: cash, siren: siren
  };
})();
