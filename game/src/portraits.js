// portraits.js — canvas-drawn crew portraits for MARAVILLA.
// Every face is drawn with canvas 2D shapes only: no images, no network.
// drawPortrait(name) returns a <canvas> the HUD and the dialogue chip use.
// Each character has a distinct face, hair, clothes and palette.

const SIZE = 96;

const CHARACTERS = {
  'Mama Luz': {
    skin: '#c98d5f',
    hair: '#e8e4da',
    hairStyle: 'bun',
    top: '#7a2e3a',
    accent: '#d9a441',
    trait: 'shawl',
    ageLines: true,
  },
  'Celia Reyes': {
    skin: '#d9a077',
    hair: '#2b1a12',
    hairStyle: 'bob',
    top: '#1f4d6b',
    accent: '#37c8d9',
    trait: 'headset',
    ageLines: false,
  },
  'Tito Fuentes': {
    skin: '#b97e4e',
    hair: '#14100c',
    hairStyle: 'flatcap',
    top: '#3f5a34',
    accent: '#e07830',
    trait: 'beard',
    ageLines: false,
  },
  'Big Marlon': {
    skin: '#8a5a34',
    hair: '#0d0b09',
    hairStyle: 'buzz',
    top: '#5a1f1f',
    accent: '#e8c33a',
    trait: 'chain',
    ageLines: false,
  },
  'Rico Vega': {
    skin: '#caa06e',
    hair: '#1c1410',
    hairStyle: 'slick',
    top: '#274060',
    accent: '#f2f2f2',
    trait: 'scar',
    ageLines: false,
  },
  'Detective El Gato': {
    skin: '#d3a583',
    hair: '#4a4a4a',
    hairStyle: 'sidepart',
    top: '#2e2e33',
    accent: '#c8a24a',
    trait: 'shades',
    ageLines: true,
  },
};

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function drawHair(ctx, style, hair, cx) {
  ctx.fillStyle = hair;
  if (style === 'bun') {
    // Silver hair pulled back with a bun on top.
    ctx.beginPath();
    ctx.arc(cx, 26, 15, Math.PI, 0);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(cx, 12, 7, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(cx - 15, 30, 5, 0, Math.PI * 2);
    ctx.arc(cx + 15, 30, 5, 0, Math.PI * 2);
    ctx.fill();
  } else if (style === 'bob') {
    ctx.beginPath();
    ctx.arc(cx, 30, 17, Math.PI, 0);
    ctx.fill();
    ctx.fillRect(cx - 17, 28, 7, 16);
    ctx.fillRect(cx + 10, 28, 7, 16);
  } else if (style === 'flatcap') {
    // Flat cap with a small brim.
    ctx.beginPath();
    ctx.ellipse(cx, 24, 17, 8, 0, Math.PI, 0);
    ctx.fill();
    ctx.fillRect(cx - 17, 20, 36, 4);
    ctx.fillRect(cx - 20, 22, 40, 3);
  } else if (style === 'buzz') {
    ctx.beginPath();
    ctx.arc(cx, 28, 15, Math.PI, 0);
    ctx.fill();
  } else if (style === 'slick') {
    ctx.beginPath();
    ctx.arc(cx, 26, 15, Math.PI, 0);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(cx - 15, 26);
    ctx.quadraticCurveTo(cx - 6, 12, cx + 14, 20);
    ctx.lineTo(cx + 15, 26);
    ctx.closePath();
    ctx.fill();
  } else {
    // sidepart: grey, swept to one side.
    ctx.beginPath();
    ctx.arc(cx, 27, 15, Math.PI, 0);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(cx - 15, 26);
    ctx.quadraticCurveTo(cx, 10, cx + 15, 24);
    ctx.lineTo(cx + 15, 27);
    ctx.closePath();
    ctx.fill();
  }
}

function drawTrait(ctx, trait, c, cx) {
  if (trait === 'shawl') {
    ctx.fillStyle = c.accent;
    ctx.beginPath();
    ctx.moveTo(cx - 22, 78);
    ctx.quadraticCurveTo(cx, 62, cx + 22, 78);
    ctx.lineTo(cx + 14, 96);
    ctx.lineTo(cx - 14, 96);
    ctx.closePath();
    ctx.fill();
  } else if (trait === 'headset') {
    ctx.strokeStyle = c.accent;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(cx, 34, 17, Math.PI * 1.1, Math.PI * 1.9);
    ctx.stroke();
    ctx.fillStyle = c.accent;
    ctx.beginPath();
    ctx.arc(cx - 16, 44, 4, 0, Math.PI * 2);
    ctx.arc(cx + 16, 44, 4, 0, Math.PI * 2);
    ctx.fill();
  } else if (trait === 'beard') {
    ctx.fillStyle = c.hair;
    ctx.beginPath();
    ctx.ellipse(cx, 56, 12, 9, 0, 0, Math.PI);
    ctx.fill();
    // Moustache.
    ctx.beginPath();
    ctx.ellipse(cx - 5, 50, 5, 2.5, 0, 0, Math.PI * 2);
    ctx.ellipse(cx + 5, 50, 5, 2.5, 0, 0, Math.PI * 2);
    ctx.fill();
  } else if (trait === 'chain') {
    ctx.strokeStyle = c.accent;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(cx, 74, 12, 0.3, Math.PI - 0.3);
    ctx.stroke();
    ctx.fillStyle = c.accent;
    ctx.beginPath();
    ctx.arc(cx, 86, 3, 0, Math.PI * 2);
    ctx.fill();
  } else if (trait === 'scar') {
    ctx.strokeStyle = '#8a4a3a';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(cx - 8, 36);
    ctx.lineTo(cx - 4, 46);
    ctx.stroke();
  } else if (trait === 'shades') {
    ctx.fillStyle = '#111114';
    roundRect(ctx, cx - 14, 36, 12, 7, 3);
    ctx.fill();
    roundRect(ctx, cx + 2, 36, 12, 7, 3);
    ctx.fill();
    ctx.strokeStyle = '#111114';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(cx - 2, 39);
    ctx.lineTo(cx + 2, 39);
    ctx.stroke();
  }
}

export function drawPortrait(name, size) {
  const s = size || SIZE;
  const canvas = document.createElement('canvas');
  canvas.width = s;
  canvas.height = s;
  canvas.setAttribute('data-character', name);
  const ctx = canvas.getContext('2d');
  const c = CHARACTERS[name] || CHARACTERS['Rico Vega'];
  const cx = s / 2;
  const scale = s / SIZE;

  // Background: warm sunset gradient in the character's accent.
  const bg = ctx.createLinearGradient(0, 0, 0, s);
  bg.addColorStop(0, '#f7b733');
  bg.addColorStop(0.55, '#e8703a');
  bg.addColorStop(1, '#7a2e3a');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, s, s);
  // Sun disc behind the head.
  ctx.fillStyle = 'rgba(255, 240, 180, 0.55)';
  ctx.beginPath();
  ctx.arc(cx + 18 * scale, 20 * scale, 12 * scale, 0, Math.PI * 2);
  ctx.fill();

  ctx.save();
  ctx.scale(scale, scale);

  // Shoulders / clothes.
  ctx.fillStyle = c.top;
  ctx.beginPath();
  ctx.moveTo(cx - 30, 96);
  ctx.quadraticCurveTo(cx - 26, 70, cx - 12, 66);
  ctx.lineTo(cx + 12, 66);
  ctx.quadraticCurveTo(cx + 26, 70, cx + 30, 96);
  ctx.closePath();
  ctx.fill();
  // Collar accent.
  ctx.strokeStyle = c.accent;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(cx - 8, 68);
  ctx.lineTo(cx, 76);
  ctx.lineTo(cx + 8, 68);
  ctx.stroke();

  // Neck and face.
  ctx.fillStyle = c.skin;
  ctx.fillRect(cx - 6, 58, 12, 12);
  ctx.beginPath();
  ctx.ellipse(cx, 42, 15, 18, 0, 0, Math.PI * 2);
  ctx.fill();
  // Ears.
  ctx.beginPath();
  ctx.arc(cx - 15, 42, 3.5, 0, Math.PI * 2);
  ctx.arc(cx + 15, 42, 3.5, 0, Math.PI * 2);
  ctx.fill();

  drawHair(ctx, c.hairStyle, c.hair, cx);

  // Brows.
  ctx.strokeStyle = c.hair;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(cx - 10, 36);
  ctx.lineTo(cx - 4, 35);
  ctx.moveTo(cx + 4, 35);
  ctx.lineTo(cx + 10, 36);
  ctx.stroke();

  // Eyes (hidden behind shades for El Gato).
  if (c.trait !== 'shades') {
    ctx.fillStyle = '#1a1a1a';
    ctx.beginPath();
    ctx.arc(cx - 6, 40, 1.8, 0, Math.PI * 2);
    ctx.arc(cx + 6, 40, 1.8, 0, Math.PI * 2);
    ctx.fill();
  }

  // Nose and mouth.
  ctx.strokeStyle = 'rgba(0,0,0,0.35)';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(cx, 42);
  ctx.lineTo(cx - 1, 48);
  ctx.stroke();
  ctx.strokeStyle = '#7a3a2a';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(cx - 4, 53);
  ctx.quadraticCurveTo(cx, 56, cx + 4, 53);
  ctx.stroke();

  if (c.ageLines) {
    ctx.strokeStyle = 'rgba(0,0,0,0.25)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(cx - 11, 44);
    ctx.lineTo(cx - 8, 46);
    ctx.moveTo(cx + 8, 46);
    ctx.lineTo(cx + 11, 44);
    ctx.stroke();
  }

  drawTrait(ctx, c.trait, c, cx);

  ctx.restore();

  // Thin frame.
  ctx.strokeStyle = 'rgba(255,255,255,0.65)';
  ctx.lineWidth = 2;
  ctx.strokeRect(1, 1, s - 2, s - 2);
  return canvas;
}

export function portraitNames() {
  return Object.keys(CHARACTERS);
}

export function portraitDataUrl(name, size) {
  return drawPortrait(name, size).toDataURL('image/png');
}
