// Maravilla — One Last Score (Node 22, standard library only): an open-world
// crime game for make.fun gta6-01, plain static files a desktop browser loads
// offline. The game is this directory's game/ folder (game/index.html and its
// ES modules, three.js r160 vendored under game/vendor/, no library and no
// network request at runtime), and this program hands it in: it copies game/
// and screenshots/ from beside this file to /output and writes
// /output/dossier.json, the summary the judge reads, with the vendored
// make.fun library.
//
// The game itself: Rico "Rook" Vega, fresh out of a five-year stretch, comes
// home to Maravilla — a sun-drenched fictional coastal city of palm avenues,
// a lighthouse, a stadium, and a pier — to pull one last score with his crew:
// Mama Luz the fixer, Celia Reyes the driver and hacker, Tito Fuentes the
// mechanic, and Big Marlon the muscle, while Detective El Gato and Maravilla
// PD close in. Ten named story missions with dialogue in three acts with
// gold/silver/bronze ratings, three street races, taxi fares, carjacking and
// a garage that sells and tunes seven vehicles including a motorbike, a
// six-weapon wheel with a gunshop, health packs, a five-star wanted system
// with roadblocks and a police helicopter, a phone full of crew abilities,
// district standing across six named districts that changes the game
// (heat, cop speed, prices, jobs), a police dispatch panel naming every
// unit by callsign, rank + RP progression, staged missions with a real
// lose-the-cops escape, side activities (Golden Gecko collectibles, stunt
// jumps, district jobs, a vehicle export list, a buyable safehouse),
// respect and leaderboards, three invented radio stations, a day-night
// cycle with a day counter, and a living city of traffic and pedestrians
// across six visually distinct districts. No Rockstar names, logos, artwork,
// characters or music — everything in Maravilla is original.
//
// Serve it locally with `node serve.ts`, then open http://localhost:8080.
// Outside the grader's container, MAKEFUN_OUTPUT_DIR stands in for /output:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts

import { cpSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const here = fileURLToPath(new URL('.', import.meta.url));
const out = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

mkdirSync(out, { recursive: true });
cpSync(join(here, 'game'), join(out, 'game'), { recursive: true });
mkdirSync(join(out, 'screenshots'), { recursive: true });
if (existsSync(join(here, 'screenshots'))) cpSync(join(here, 'screenshots'), join(out, 'screenshots'), { recursive: true });

// The scorer's own caps (reference/gate.json): only text_max_bytes shapes the bytes; the others refuse an entry the
// scorer would refuse (more than 4 screenshots or one over 256 KiB; more than 993 files in game/ or 48 MiB of game
// files, in all, or a path under game/ over 1000 bytes: game/ counts beside /output's own 1000-entry cap, its
// screenshots/ and dossier.json).
writeFileSync(
  join(out, 'dossier.json'),
  buildDossier(out, {
    text_max_bytes: 163840,
    screenshots: { max: 4, max_bytes: 262144 },
    game_max_files: 993,
    game_max_bytes: 50331648,
    game_path_max_bytes: 1000,
  }),
);
