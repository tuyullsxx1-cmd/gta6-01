# MARAVILLA — One Last Score

[![make.fun · gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![rank](https://make.fun/badge/gta6-01/tuyullsxx1-cmd/gta6-01/rank.svg)](https://make.fun/bounty/gta6-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![reward](https://make.fun/badge/gta6-01/tuyullsxx1-cmd/gta6-01/reward.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)

An open-world crime game for the make.fun gta6-01 bounty: a complete 3D city you can
explore on foot and by car, with a story, a crew, the law on your tail, and one last score.

## Story

Milo Vane, a driver fresh off the boat with nothing but fast hands and a faster car, comes
to Maravilla to pull one last score with his crew: Juno Park (driver), Theo Ashford
(mechanic), Iris Calloway (lookout) and Bram Okafor (muscle). The fixer Vera Solano sets
up the jobs. Detective Anselm is closing in.

Ten story missions in three acts take Milo from a first meet at Downtown Plaza, through a
rival crew and Anselm's net, to the vault of the Grand Maravilla casino.

## Features

- **Open world** — Maravilla, a 600×600 m coastal city in six districts (Marina Alba,
  El Faro, Centro Alba, Paseo del Mar, Miramar, Estadio Sol), with a marina full of yachts,
  a lighthouse, a stadium, a night market, a beach and the neon-crowned Grand Maravilla casino.
- **Driving** — arcade physics, carjacking, 7 drivable vehicles (5 cars, a van, a motorbike,
  a sports car), nitro, handbrake, horn, a real km/h speedometer and damage that can end
  in explosions.
- **Wanted level 1–5** — foot cops, patrol cars that ram, roadblocks at 3★, a helicopter at
  4★, and a dispatch panel with unique callsigns, live distances, a ticker and a WANTED FOR label.
- **District standing** — LOYAL / WARM / NEUTRAL / COLD / HOSTILE, with real effects: the
  same crime is wanted 3 in a loyal district and wanted 5 in a hostile one; loyal districts
  hide you, cut prices and pay more for jobs.
- **Combat** — a 6-weapon wheel (fists, pistol, SMG, shotgun, rifle, launcher), a persistent
  weapon bar with ammo and LOCKED states, ray-cast shooting, health and ammo pickups.
- **Missions** — 10 named story missions with dialogue and G/S/B ratings, plus 3 street
  races with checkpoints and taxi fares that pay real money.
- **Crew phone** — call Vera, Juno, Theo, Iris and Bram (F / Z / X / V / B) with cooldowns
  and drawn portraits.
- **Garage** — engine, armour and nitro upgrades; repairs.
- **Side activities** — 20 Golden Sun collectibles, 5 stunt jumps, district jobs, a 5-car
  export list and a $2,000 safehouse that heals and saves.
- **Progression** — respect, ranks (ROOKIE → HUSTLER → FIXER → SHOT CALLER → LEYENDA),
  3 save slots, a local top-5 leaderboard and a 5-tab pause menu (MAP / MISSIONS / STATS / CREW / SAVE).
- **Radio** — three procedural WebAudio stations (Radio Sol 98.4, Neon Night 91.7, Mar FM 104.2).
- **Visuals** — golden-hour sun with long shadows, blue-hour neon, wet asphalt with neon
  reflections, clearcoat car paint, rounded multi-part characters with walk cycles, dense
  street life (72 pedestrians, 22 traffic cars), lit windows and signs that always sit on
  a building face or a pole.

## Controls

| Key | Action |
|---|---|
| WASD | Walk / drive |
| Mouse drag / wheel | Look around / zoom |
| Enter | Start |
| E | Enter or exit a car (carjack) |
| Shift | Run on foot / nitro in a car |
| Space | Jump on foot / handbrake in a car |
| H | Horn |
| Tab | Weapon wheel |
| 1–6 / Q | Select / cycle weapon |
| Click | Shoot |
| R | Reload |
| F | Phone (Vera) |
| Z / X / V / B | Quick-call Juno / Theo / Iris / Bram |
| G | Garage (at the garage, on foot) |
| C / M | Change radio station / mute |
| P / Esc | Pause |

## Run

```sh
node serve.ts
# open http://localhost:8080
```

No build step, no network requests at runtime. Hand in with `MAKEFUN_OUTPUT_DIR=out node main.ts`.

## Structure

- `main.ts` — Node 22 stdlib-only hand-in program (copies game/ + screenshots/, writes dossier.json)
- `serve.ts` — local static server for playtesting
- `shots.json` — the four staged screenshots
- `vendor/makefun-game.ts` — the kit's dossier library
- `game/index.html` — UI shell: HUD, minimap, title, pause and end screens
- `game/vendor/three.module.min.js` — three.js r160 (vendored)
- `game/src/` — one module per job: main, state, config, render, city, vehicles,
  traffic, driving, player, police, weapons, missions, phone, districts, garage, hud,
  audio, save, side, pause, portraits, shots, input, events, random

## Screenshots

1. `1-cover.png` — Neon cover: night avenue at speed
2. `2-marina.png` — Marina Alba at blue hour
3. `3-plaza.png` — Golden-hour casino plaza
4. `4-mission.png` — Mission moment on foot with Vera
