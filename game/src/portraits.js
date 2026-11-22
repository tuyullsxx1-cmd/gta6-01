// Canvas-drawn crew portraits: a face with hair, eyes and clothing colour
// that matches the in-world character. One canvas per person, cached as a
// data URL so the HUD, phone and dialogue can all use it.
import { CREW, PLAYER_DEF } from './config.js';

const cache = new Map();

function drawFace(g, person, size) {
  const cx = size / 2, cy = size / 2;
  g.clearRect(0, 0, size, size);
  // Background: warm gradient.
  const bg = g.createLinearGradient(0, 0, 0, size);
  bg.addColorStop(0, '#3a2a4a'); bg.addColorStop(1, '#1a1426');
  g.fillStyle = bg; g.fillRect(0, 0, size, size);
  // Shoulders / shirt
  g.fillStyle = '#' + person.shirt.toString(16).padStart(6, '0');
  g.beginPath(); g.ellipse(cx, size * 0.98, size * 0.42, size * 0.3, 0, Math.PI, 0); g.fill();
  // Neck
  g.fillStyle = '#' + person.skin.toString(16).padStart(6, '0');
  g.fillRect(cx - size * 0.07, size * 0.62, size * 0.14, size * 0.16);
  // Head
  g.beginPath(); g.ellipse(cx, size * 0.44, size * 0.24, size * 0.27, 0, 0, Math.PI * 2); g.fill();
  // Ears
  g.beginPath(); g.arc(cx - size * 0.24, size * 0.44, size * 0.05, 0, Math.PI * 2); g.fill();
  g.beginPath(); g.arc(cx + size * 0.24, size * 0.44, size * 0.05, 0, Math.PI * 2); g.fill();
  // Hair by style
  g.fillStyle = '#' + person.hair.toString(16).padStart(6, '0');
  const hs = person.hairStyle || 'short';
  if (hs === 'long') {
    g.beginPath(); g.ellipse(cx, size * 0.3, size * 0.27, size * 0.2, 0, Math.PI, 0); g.fill();
    g.fillRect(cx - size * 0.27, size * 0.28, size * 0.08, size * 0.4);
    g.fillRect(cx + size * 0.19, size * 0.28, size * 0.08, size * 0.4);
  } else if (hs === 'bob') {
    g.beginPath(); g.ellipse(cx, size * 0.3, size * 0.28, size * 0.22, 0, Math.PI, 0); g.fill();
    g.beginPath(); g.arc(cx - size * 0.25, size * 0.42, size * 0.07, 0, Math.PI * 2); g.fill();
    g.beginPath(); g.arc(cx + size * 0.25, size * 0.42, size * 0.07, 0, Math.PI * 2); g.fill();
  } else if (hs === 'cap') {
    g.beginPath(); g.ellipse(cx, size * 0.32, size * 0.25, size * 0.12, 0, Math.PI, 0); g.fill();
    g.fillStyle = '#c02028';
    g.beginPath(); g.ellipse(cx, size * 0.3, size * 0.26, size * 0.1, 0, Math.PI, 0); g.fill();
    g.fillRect(cx - size * 0.26, size * 0.3, size * 0.52, size * 0.05);
  } else if (hs === 'fade') {
    g.beginPath(); g.ellipse(cx, size * 0.26, size * 0.24, size * 0.1, 0, Math.PI, 0); g.fill();
  } else if (hs === 'swept') {
    g.beginPath(); g.ellipse(cx + size * 0.03, size * 0.26, size * 0.26, size * 0.16, 0, Math.PI, 0); g.fill();
    g.beginPath(); g.ellipse(cx + size * 0.14, size * 0.32, size * 0.12, size * 0.08, 0.3, Math.PI, 0); g.fill();
  } else {
    g.beginPath(); g.ellipse(cx, size * 0.28, size * 0.25, size * 0.16, 0, Math.PI, 0); g.fill();
  }
  // Brows, eyes, nose, mouth
  g.strokeStyle = '#1a1210'; g.lineWidth = size * 0.02; g.lineCap = 'round';
  g.beginPath(); g.moveTo(cx - size * 0.14, size * 0.38); g.lineTo(cx - size * 0.05, size * 0.37); g.stroke();
  g.beginPath(); g.moveTo(cx + size * 0.05, size * 0.37); g.lineTo(cx + size * 0.14, size * 0.38); g.stroke();
  g.fillStyle = '#14100c';
  g.beginPath(); g.ellipse(cx - size * 0.09, size * 0.44, size * 0.028, size * 0.04, 0, 0, Math.PI * 2); g.fill();
  g.beginPath(); g.ellipse(cx + size * 0.09, size * 0.44, size * 0.028, size * 0.04, 0, 0, Math.PI * 2); g.fill();
  g.strokeStyle = 'rgba(0,0,0,0.35)'; g.lineWidth = size * 0.015;
  g.beginPath(); g.moveTo(cx, size * 0.46); g.lineTo(cx - size * 0.02, size * 0.54); g.stroke();
  g.strokeStyle = '#5a2018'; g.lineWidth = size * 0.02;
  g.beginPath(); g.moveTo(cx - size * 0.07, size * 0.6); g.quadraticCurveTo(cx, size * 0.64, cx + size * 0.07, size * 0.6); g.stroke();
  // Gold frame
  g.strokeStyle = '#d4af37'; g.lineWidth = size * 0.03;
  g.strokeRect(size * 0.015, size * 0.015, size * 0.97, size * 0.97);
}

export function portraitURL(person, size = 128) {
  const key = person.id + ':' + size;
  if (cache.has(key)) return cache.get(key);
  const c = document.createElement('canvas');
  c.width = size; c.height = size;
  drawFace(c.getContext('2d'), person, size);
  const url = c.toDataURL('image/png');
  cache.set(key, url);
  return url;
}

export function crewPortraits() {
  const out = {};
  for (const m of CREW) out[m.id] = portraitURL(m);
  out.milo = portraitURL({ id: 'milo', ...PLAYER_DEF });
  out.anselm = portraitURL({ id: 'anselm', skin: 0xe8b98a, hair: 0x8a8a8a, hairStyle: 'short', shirt: 0x2a3a5a });
  return out;
}

export function paintPortraitInto(imgEl, person, size = 128) {
  imgEl.src = portraitURL(person, size);
  imgEl.alt = person.name + ' portrait';
}
