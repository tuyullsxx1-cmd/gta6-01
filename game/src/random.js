// random.js — seeded deterministic RNG.
// All gameplay randomness comes from here. No Math.random, no Date.
// Mulberry32: small, fast, and fully deterministic for a given seed.

export function createRng(seed) {
  // Normalise any seed into a 32-bit unsigned integer.
  let s = (seed >>> 0) || 0x9e3779b9;

  function next() {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  // Float in [a, b).
  function range(a, b) {
    return a + (b - a) * next();
  }

  // Integer in [a, b] inclusive.
  function int(a, b) {
    return Math.floor(range(a, b + 1));
  }

  // Random element of a non-empty list.
  function pick(list) {
    if (!list || list.length === 0) return undefined;
    return list[Math.floor(next() * list.length)];
  }

  // Fisher-Yates shuffle of a copy; the input list is never mutated.
  function shuffle(list) {
    const out = list.slice();
    for (let i = out.length - 1; i > 0; i--) {
      const j = Math.floor(next() * (i + 1));
      const tmp = out[i];
      out[i] = out[j];
      out[j] = tmp;
    }
    return out;
  }

  // Chance roll: true with probability p (0..1).
  function chance(p) {
    return next() < p;
  }

  return { next, range, int, pick, shuffle, chance };
}

export default createRng;
