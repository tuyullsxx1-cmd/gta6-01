# MARAVILLA — One Last Score

[![make.fun · gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![rank](https://make.fun/badge/gta6-01/tuyullsxx1-cmd/gta6-01/rank.svg)](https://make.fun/bounty/gta6-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![reward](https://make.fun/badge/gta6-01/tuyullsxx1-cmd/gta6-01/reward.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)

An open-world crime game in the spirit of GTA 6, built for the make.fun
gta6-01 bounty. It runs entirely offline in a desktop browser: one static
`game/` folder, no build step, no network requests, all art drawn with
three.js geometry and canvas 2D, all music synthesised live with WebAudio.

## Story

Rico “Rook” Vega comes home to Maravilla after a five-year stretch, to pull
one last score with his crew: Mama Luz the fixer, Celia Reyes the driver and
hacker, Tito Fuentes the mechanic, and Big Marlon the muscle. Detective El
Gato and Maravilla PD are closing in. Maravilla is a fictional sun-drenched
coastal city — palm avenues, a lighthouse, a stadium, a pier, six districts
that each remember how you treated them.

## Features

- A 600×600 m open city to explore on foot and by car: Marina Alba, El Faro,
  Centro Alba, Paseo del Mar, Miramar and Estadio Sol, with landmarks,
  night-market stalls, stilt houses, boats and surfboards.
- 64 pedestrians — clustered at the night market, the beach and the pier — and
  20 traffic cars with simple AI, traffic lights and horns.
- 7 drivable vehicles — five cars, a van, the Picuda 250 motorbike and the
  Tormenta S sports car — with carjacking, arcade physics, nitro, handbrake
  and damage that can end in a burning, chain-reacting explosion.
- A 5-star wanted system: foot cops, patrol cars, ramming units, roadblocks
  from 3 stars and a helicopter from 4, with a live dispatch panel naming
  every unit by callsign, role and distance.
- 10 named story missions in 3 acts with dialogue and G/S/B ratings, each
  paying out in dollars shown in the mission header and on completion, plus
  3 timed street races and taxi fares.
- A weapon wheel with 6 weapons (fists, pistol, SMG, shotgun, rifle and the
  Trueno RPG), ray-cast shooting and pickups.
- District standing on a LOYAL–HOSTILE scale that changes heat, prices, cop
  speed and job pay — the same crime earns wanted 3 in a loyal district and
  wanted 5 in a hostile one.
- Celia’s Garage (engine, armour and nitro upgrades), the phone and its four
  crew abilities, three procedural radio stations, 20 Golden Geckos, 5 stunt
  jumps, district jobs, a 5-car export list and the Casa Verde safehouse.
- Respect, ranks from ROOKIE to LEYENDA, a detailed career stats page (cars
  stolen, cops escaped, longest jump, completion %), 3 save slots
  and a local top-5 leaderboard, all behind a 5-tab pause menu.
- A HUD with minimap and route line, health and armour bars, money, speed,
  wanted stars, radio, a DAY clock, district standing, dispatch, crew cards
  and a NEXT JOB header with stage pips.

## Controls

| Key | Action |
| --- | --- |
| W A S D | Walk / drive |
| Mouse drag / wheel | Look around / zoom |
| Enter | Start |
| E | Enter or exit a car · carjack · do the mission action |
| Shift | Run on foot · nitro in a car (when upgraded) |
| Space | Jump on foot · handbrake in a car |
| H | Horn |
| Tab | Weapon wheel |
| 1–6 / Q | Select weapon / cycle weapons |
| Click | Shoot |
| R | Reload |
| F | Phone |
| Z / X / V / B | Call Celia / Tito / Big Marlon / Mama Luz |
| G | Garage (at Celia’s Garage, on foot) |
| C / M | Change radio station / mute |
| P / Esc | Pause |

## Run it

```sh
node serve.ts
# open http://localhost:8080/game/index.html
```

Or serve `game/` with any static file server. The game needs no build step
and makes zero network requests.

To hand the entry in (what the grader runs):

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
```

`main.ts` copies `game/` and `screenshots/` into the output directory and
writes `dossier.json` there. Two runs produce byte-identical output.

## Structure

- `main.ts` — Node 22 entrypoint: copies the game and screenshots, writes the dossier.
- `serve.ts` — small static file server for local play.
- `shots.json` — the four staged screenshots and their fixed seeds.
- `vendor/makefun-game.ts` — the kit’s dossier library, unchanged.
- `game/index.html` — the UI shell: canvas, HUD, title, pause and end screens.
- `game/vendor/three.module.min.js` — three.js r160, vendored.
- `game/src/` — 25 modules, one job each:
  `main` boot and loop · `state` game state · `config` fixed data ·
  `render` three.js renderer and camera · `city` districts and landmarks ·
  `vehicles` car factory, damage and explosions · `traffic` cars and
  pedestrians · `driving` arcade physics and carjacking · `player`
  on-foot movement and health · `police` wanted levels and pursuit ·
  `weapons` wheel, shooting and pickups · `missions` story, races, taxi ·
  `phone` crew calls · `districts` standing · `garage` upgrades ·
  `audio` procedural radio and effects · `save` slots and leaderboard ·
  `side` geckos, jumps, jobs, exports, safehouse · `pause` tabbed menu ·
  `portraits` canvas-drawn crew faces · `hud` minimap and panels ·
  `shots` staged screenshots · `input` keyboard and mouse ·
  `events` event bus · `random` seeded RNG.

## Screenshots

Four staged shots, each 1280×800, taken from the game itself
(`shots.json` holds the query strings and fixed seeds):

1. `1-start.jpg` — the title screen over Maravilla at golden hour.
2. `2-drive.jpg` — driving down Paseo del Mar, car big and centre-frame.
3. `3-chase.jpg` — a three-star chase: patrol cars, a roadblock, dispatch live.
4. `4-mission.jpg` — mission 1, FIRST KEYS, at the garage with the crew briefing.
