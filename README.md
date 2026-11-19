# MARAVILLA — One Last Score

![gta6-01](https://make.fun/badge/gta6-01.svg)
![rank](https://make.fun/badge/gta6-01/tuyullsxx1-cmd/gta6-01/rank.svg)
![reward](https://make.fun/badge/gta6-01/tuyullsxx1-cmd/gta6-01/reward.svg)

An open-world crime game for [make.fun gta6-01](https://make.fun/bounty/gta6-01) — a complete 3D game that runs offline in a browser. No Rockstar names, logos, artwork, characters or music: everything in Maravilla is original.

## The story

Rico "Rook" Vega comes home to Maravilla — a sun-drenched fictional coastal city of palm avenues, a lighthouse, a stadium and a pier — after a five-year stretch, to pull one last score with his crew: **Mama Luz** the fixer, **Celia Reyes** the driver and hacker, **Tito Fuentes** the mechanic, and **Big Marlon** the muscle. Detective **El Gato** and Maravilla PD are closing in.

## What is in the game

- **Open world** — a 3D coastal city (three.js r160, vendored) with a day-night cycle, golden-hour sun, traffic AI, pedestrians, street props, landmarks (Faro de Maravilla lighthouse, Estadio Sol, Hotel Miramar, the pier, Banco Alba, Marina Alba).
- **10 story missions** in 3 acts with names, dialogue (with drawn crew portraits) and G/S/B ratings, plus 3 street races and taxi fares. Every mission is staged — the HUD shows `MISSION N · TITLE — STAGE x/y: NAME · NEXT: …`, and the escape in HOT PURSUIT only counts once the heat is actually gone.
- **Driving** — arcade physics, carjacking, 7 drivable vehicles (5 cars, a van, the Picuda 250 motorbike), speed on the HUD, handbrake, horn, nitro. Patrol cars that ram you damage your ride, and the HUD shows the damage (`Vagabundo — 62% DENTED`).
- **Combat** — weapon wheel (Tab) with 6 weapons (fists, pistol, SMG, shotgun, rifle, Trueno RPG) plus a persistent weapon bar with icons, ammo and LOCKED states, ray-cast shooting, health packs, ammo boxes.
- **Wanted 1–5 stars** — police dispatch escalates: foot cops, patrol cars, roadblocks at 3+, helicopter at 4+. Heat decays when you lay low. The dispatch panel names every unit by callsign with its role and live distance (`TIBURON-3 · RAMMING · 14 m`).
- **District standing** — six named districts (Marina Alba, El Faro, Centro Alba, Paseo del Mar, Miramar, Estadio Sol) each track how the city feels about you; finishing a mission there lifts it, causing heat there changes it — and standing changes the game: loyal districts hide you (heat rises slower, fades faster, cops slower, prices 10% off, jobs pay +25%), hostile ones do the opposite and close their job boards. Every district has its own look: stilt houses, boats, terracotta roofs, night-market stalls, surfboards, stadium flags.
- **Garage upgrades** — engine, armour and nitro per owned car at Celia's Garage.
- **Phone** (F) — call the crew: Mama Luz points at the next job, Celia scrubs heat, Tito repairs your ride, Big Marlon clears the cops around you. The same four abilities sit on HUD cards with quick-call keys Z / X / V / B.
- **HUD** — minimap with mission markers, health/armour, money, speed, wanted stars, radio station, clock, district standing, dispatch panel, crew cards.
- **Radio** — three invented stations (Faro Rock 101, Maravilla Nights, Sol FM) of procedural WebAudio music; C changes station, M mutes.
- **Side activities** — 20 Golden Geckos to collect, 5 stunt jumps, repeatable district jobs, a 5-car export list, and the Casa Verde safehouse (buy it, rest there to heal and save).
- **Progression** — respect, rank + RP (ROOKIE → HUSTLER → FIXER → SHOT CALLER → LEYENDA), money, a career stats page, 3 save slots, local top-5 leaderboard.
- **Exploding cars** — shoot or crash a car until it burns, then it blows, and the blast can chain to nearby cars.

## Controls

| Key | Action |
| --- | --- |
| WASD / mouse drag | Walk, look around (wheel zooms) |
| Enter | Start |
| E | Enter / exit a car |
| Shift | Run on foot / nitro in a car (if upgraded) |
| Space | Jump on foot / handbrake in a car |
| H | Horn |
| Tab / 1–5 / Q | Weapon wheel / select weapon / cycle |
| Click | Shoot |
| R | Reload |
| F | Phone (crew abilities) |
| Z / X / V / B | Quick-call Celia / Tito / Big Marlon / Mama Luz from the HUD |
| G | Garage (at Celia's Garage, on foot) |
| C | Next radio station |
| M | Mute |
| P / Esc | Pause |

## Run it

```bash
node serve.ts
# open http://localhost:8080
```

Or open `game/index.html` directly in a browser. The game makes zero network requests.

## Structure

```
game/
  index.html        UI shell: HUD, minimap, title/pause/end screens
  vendor/three.module.min.js   three.js r160, vendored
  src/
    main.js         boot, the loop, camera orbit, screenshot staging
    state.js        the whole game state
    config.js       constants
    render.js       three.js renderer, lighting, day-night, camera rig
    city.js         the city: districts, buildings, roads, props
    vehicles.js     car factory, parked cars, damage + explosions
    traffic.js      traffic cars, pedestrians, traffic lights
    driving.js      arcade driving physics, carjacking
    player.js       on-foot movement, health, respawn
    police.js       wanted levels, cops, roadblocks, helicopter
    weapons.js      weapon wheel, shooting, pickups
    missions.js     10 story missions (staged), races, taxi fares
    phone.js        crew calls + HUD quick-call keys
    districts.js    district standing (six districts)
    garage.js       upgrades, take-out
    hud.js          minimap, health/armour/money/speed/wanted, dispatch
                    panel, crew cards, rank + RP, district standing
    audio.js        procedural radio + sound effects
    save.js         3 save slots + leaderboard
    side.js         Golden Geckos, stunt jumps, district jobs, exports, safehouse
    pause.js        tabbed pause menu (MAP / MISSIONS / STATS / CREW / SAVE)
    portraits.js    canvas-drawn crew portraits
    shots.js        staged screenshots (?shot=start|drive|chase|mission)
    input.js        keyboard/mouse
    events.js       event bus
    random.js       seeded RNG
```

## Screenshots

`?shot=start&seed=1` (city at golden hour), `?shot=drive&seed=1` (driving on Paseo del Mar), `?shot=chase&seed=1` (three-star chase), `?shot=mission&seed=1` (mission one at the garage).
