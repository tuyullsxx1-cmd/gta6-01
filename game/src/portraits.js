// Portraits: original crew faces drawn in code on a canvas (no copied
// images, offline, stdlib only). Each portrait is a 96x96 data URL used by
// the crew cards, the phone rows and the dialogue speaker chip.

const BG = {
  luz: '#7a2e3a', celia: '#1c4a3a', tito: '#4a3a1c', marlon: '#2c313a',
  gato: '#1c2733', player: '#8a3c0e',
};
const SKIN = {
  luz: '#d9a066', celia: '#e8b88a', tito: '#c98d64', marlon: '#8a5a3a',
  gato: '#e8b88a', player: '#c98d64',
};

const cache = new Map();

function drawFace(g, id) {
  // Background + shoulders.
  g.fillStyle = BG[id] || '#333';
  g.fillRect(0, 0, 96, 96);
  g.fillStyle = 'rgba(255,255,255,0.08)';
  g.fillRect(0, 0, 96, 20);
  // Shoulders / jacket.
  const jacket = {
    luz: '#a83a4a', celia: '#2e8a5a', tito: '#5a6a7a', marlon: '#1c2733',
    gato: '#2c3542', player: '#ff7a1a',
  }[id] || '#555';
  g.fillStyle = jacket;
  g.beginPath();
  g.moveTo(8, 96);
  g.quadraticCurveTo(48, 62, 88, 96);
  g.closePath();
  g.fill();
  // Neck + face.
  g.fillStyle = SKIN[id] || '#c98d64';
  g.fillRect(42, 58, 12, 14);
  g.beginPath();
  g.arc(48, 44, 20, 0, Math.PI * 2);
  g.fill();
  // Hair / headwear per person.
  if (id === 'luz') {
    // Grey bun + shawl collar.
    g.fillStyle = '#d8d8d8';
    g.beginPath(); g.arc(48, 24, 9, 0, Math.PI * 2); g.fill();
    g.beginPath(); g.arc(48, 28, 20, Math.PI, 0); g.fill();
    g.fillStyle = '#ffd98a';
    g.beginPath(); g.moveTo(30, 78); g.lineTo(48, 66); g.lineTo(66, 78); g.lineTo(66, 96); g.lineTo(30, 96); g.closePath(); g.fill();
  } else if (id === 'celia') {
    // Dark bob + headset.
    g.fillStyle = '#1c1c22';
    g.beginPath(); g.arc(48, 36, 21, Math.PI, 0); g.fill();
    g.fillRect(26, 34, 8, 22);
    g.fillRect(62, 34, 8, 22);
    g.fillStyle = '#3f6fb5';
    g.fillRect(24, 40, 4, 8);
    g.fillRect(68, 40, 4, 8);
    g.fillStyle = '#3f6fb5';
    g.fillRect(24, 36, 48, 3);
  } else if (id === 'tito') {
    // Cap + moustache.
    g.fillStyle = '#3f6fb5';
    g.beginPath(); g.arc(48, 32, 20, Math.PI, 0); g.fill();
    g.fillRect(28, 30, 40, 6);
    g.fillStyle = '#2c313a';
    g.fillRect(40, 56, 16, 4);
  } else if (id === 'marlon') {
    // Beard + gold chain.
    g.fillStyle = '#1c1c22';
    g.beginPath(); g.arc(48, 52, 19, 0, Math.PI); g.fill();
    g.fillStyle = '#ffd94d';
    g.beginPath(); g.moveTo(36, 82); g.lineTo(48, 90); g.lineTo(60, 82); g.lineTo(60, 86); g.lineTo(48, 94); g.lineTo(36, 86); g.closePath(); g.fill();
  } else if (id === 'gato') {
    // Fedora + sunglasses + tie.
    g.fillStyle = '#2c313a';
    g.fillRect(28, 22, 40, 6);
    g.fillRect(34, 10, 28, 14);
    g.fillStyle = '#111';
    g.fillRect(32, 40, 12, 6);
    g.fillRect(52, 40, 12, 6);
    g.fillRect(44, 42, 4, 2);
    g.fillStyle = '#d84040';
    g.beginPath(); g.moveTo(48, 74); g.lineTo(54, 82); g.lineTo(48, 96); g.lineTo(42, 82); g.closePath(); g.fill();
  } else {
    // Rook: orange cap (matches his jacket) + stubble.
    g.fillStyle = '#ff7a1a';
    g.beginPath(); g.arc(48, 32, 20, Math.PI, 0); g.fill();
    g.fillRect(28, 30, 40, 5);
    g.fillStyle = 'rgba(0,0,0,0.25)';
    g.beginPath(); g.arc(48, 56, 16, 0.15 * Math.PI, 0.85 * Math.PI); g.fill();
  }
  // Eyes + mouth (all).
  g.fillStyle = '#1c2733';
  g.beginPath(); g.arc(41, 42, 2.2, 0, Math.PI * 2); g.fill();
  g.beginPath(); g.arc(55, 42, 2.2, 0, Math.PI * 2); g.fill();
  g.strokeStyle = '#7a4a2a';
  g.lineWidth = 2;
  g.beginPath();
  if (id === 'gato') { g.moveTo(42, 58); g.lineTo(54, 58); }
  else { g.arc(48, 54, 6, 0.15 * Math.PI, 0.85 * Math.PI); }
  g.stroke();
}

/** Data URL for a crew portrait (luz, celia, tito, marlon, gato, player). */
export function portraitUrl(id) {
  if (cache.has(id)) return cache.get(id);
  if (typeof document === 'undefined') return '';
  const canvas = document.createElement('canvas');
  canvas.width = 96;
  canvas.height = 96;
  const g = canvas.getContext('2d');
  drawFace(g, id);
  const url = canvas.toDataURL('image/png');
  cache.set(id, url);
  return url;
}

/** Map a subtitle speaker name to a portrait id. */
export function speakerPortrait(name) {
  const n = (name || '').toLowerCase();
  if (n.includes('luz')) return 'luz';
  if (n.includes('celia')) return 'celia';
  if (n.includes('tito')) return 'tito';
  if (n.includes('marlon')) return 'marlon';
  if (n.includes('gato')) return 'gato';
  if (n.includes('rook') || n.includes('rico') || n.includes('vega')) return 'player';
  return null;
}
