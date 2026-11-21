[![make.fun · gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![make.fun · gta6-01 rank](https://make.fun/badge/gta6-01/rank.svg)](https://make.fun/bounty/gta6-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![make.fun · gta6-01 reward](https://make.fun/badge/gta6-01/reward.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)

# MARAVILLA — One Last Score

A 3D open-world crime game set in the fictional coastal city of **Maravilla**. You are **Milo Vane**, a driver fresh off the boat with nothing but fast hands and a faster car. Ten story missions across three acts — from a first meet at Downtown Plaza to the vault of the Grand Maravilla casino — with a crew that has your back: **Juno Park** (driver), **Theo Ashford** (mechanic), **Iris Calloway** (lookout), and **Bram Okafor** (muscle).

## What is in the game

- **Real driving** — stealable cars with arcade physics, a live km/h speedometer, low chase camera with speed FOV kick, and a street race you win by actually driving.
- **A living city** — six districts (Downtown, Velvet Bay, Palma Hills, Old Town, Ironworks, Boardwalk), 20+ traffic cars, 70 pedestrians, day/night clock with a DAY counter.
- **Luxury dusk look** — blue-hour sky, golden-hour sun, marina with yachts, glass casino tower with a neon crown, fountain plaza, palm boulevard, wet asphalt with neon reflections, clearcoat car paint, gold-trimmed HUD.
- **Systems** — wanted levels 1–5 (foot cops, patrol cars, roadblocks, helicopter), dispatch panel with unique callsigns and a crime ticker, six weapon slots with a wheel and persistent slot bar, district standing with real consequences, 20 collectibles, 5 stunt jumps, an export list, safehouses with quick-save, garage upgrades, a motorbike, 3 save slots, and a tabbed pause menu (MAP / STORY / STATS / CREW) with career stats.
- **Story** — 10 missions in 3 acts with stages, dialogue, payouts, and Gold / Silver / Bronze ratings, ending in the vault job at the Grand Maravilla.
- **Sound** — WebAudio engine hum, three synth radio stations, and full SFX. Everything is procedural and offline; the game loads nothing over the network.

## How to play

Open `game/index.html` in a browser (or serve the `game/` folder). Click **START**.

| Key | Action |
| --- | --- |
| WASD / Arrows | Drive & walk |
| E | Enter / exit car |
| Mouse click | Shoot |
| Q | Weapon wheel |
| 1–6 | Select weapon |
| Shift | Nitro / sprint |
| R | Cycle radio station |
| P | Phone |
| M | Missions |
| T | Quick save |
| Esc | Pause (MAP / STORY / STATS / CREW) |

## Tech

Three.js (vendored, offline) + plain JavaScript. No build step, no network at runtime. `main.ts` builds the deterministic `makefun/dossier/v1` dossier from `game/` and `screenshots/` — run `node main.ts` to reproduce it byte-for-byte.

## License

MIT — see `LICENSE`.
