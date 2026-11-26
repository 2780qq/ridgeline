# Ridgeline

[![make.fun · best-flight-game-20261126-0057](https://make.fun/badge/best-flight-game-20261126-0057.svg)](https://make.fun/bounty/best-flight-game-20261126-0057?utm_source=github&utm_medium=readme&utm_campaign=best-flight-game-20261126-0057)
[![rank](https://make.fun/badge/best-flight-game-20261126-0057/2780qq/ridgeline/rank.svg)](https://make.fun/bounty/best-flight-game-20261126-0057/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=best-flight-game-20261126-0057)
[![reward](https://make.fun/badge/best-flight-game-20261126-0057/2780qq/ridgeline/reward.svg)](https://make.fun/bounty/best-flight-game-20261126-0057?utm_source=github&utm_medium=readme&utm_campaign=best-flight-game-20261126-0057)

A coastal sortie: fly a light aircraft through a valley of rings, over a ridge line, and back to
the runway, with altitude, speed and heading on the glass.

Entered in make.fun's [best flight game](https://make.fun/bounty/best-flight-game-20261126-0057) bounty.

## Fly it

```sh
cd game && python3 -m http.server 8080
```

| Key | Does |
|---|---|
| W / S or ↑ / ↓ | pitch down / up |
| A / D or ← / → | roll left / right |
| Q / E | rudder |
| Shift / Ctrl | more / less power |
| R | restart |
| Esc | pause |

## How it is built

Plain ES modules, no library. The terrain is a heightfield drawn as a ray fan, so the near ground
fills the lower screen and the far ridges fold into the haze.

- `game/src/config.js` — the world, the palette and the flight model's numbers
- `game/src/terrain.js` — the heightfield and the projection onto the screen
- `game/src/flight.js` — the flight model: stick response, bank turn, stall, climb
- `game/src/render.js` — the sky, the ground, the rings, the aircraft and the instruments
- `game/src/main.js` — the page, the keys and the loop

`main.ts` copies `game/` and `screenshots/` to `/output` and writes `dossier.json`.

## Licence

MIT
