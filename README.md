# Hammerwatch 2 Rogue-Like Dungeon Generator

Generates rogue-like **Hammerwatch 2** scenarios: a town hub with shops, then a chain of random dungeon floors whose enemies get tougher as you go deeper. The result is packed into a `.hsc` with the game's own `PACKAGER.exe` and appears in the game's scenario list.

> Hammerwatch 2 is an action RPG (levels, XP, tiers, gear, shops, day/night) and has no lives. When you die you respawn and the world clock moves forward. This generator leaves those rules alone and builds dungeons around them.

## What a generated scenario contains
- **Town**: a walled plaza. Stalls open stock shops picked for the tier you have reached. There is a potion refill point, a respawn point, the descent into the dungeon, and portals to deeper bands you have already reached.
- **Floors**: the game's own random-cave system, the same one the official random caves use. Each floor chooses:
  - a room theme and size (cave light, cave dark, cave silt, prison);
  - an enemy race for its tier (apprentice → adept → expert → master);
  - a loot amount.
  Each floor's hidden deeper exit leads on to the next floor. Its entrance leads back up.
- **Bands**: every few floors the exit takes you back to town, and the band's portal there unlocks.
- **Persistent characters** (checkbox, on by default): uses the same character pool as the official ARPG, so you can farm existing characters. Turn it off to always start fresh.

## Use
1. `npm install`, then `npm run dev`.
2. Point the app at your Hammerwatch 2 folder (found automatically in the usual Steam places).
3. Set a seed (optional), the number of floors and the band size. Choose persistence, then click **Generate**.
4. Click **Install to Hammerwatch 2**. The app writes `scenarios/<id>/` and runs `PACKAGER.exe -l <id>`, which produces `scenarios/<id>.hsc`. You can also export the folder or a zip and pack it yourself.

To run without the UI: `npm run gen -- --seed 42 --floors 9 --install`.

## Development
See [CLAUDE.md](CLAUDE.md) and [the HW2 modding skill](.claude/skills/hammerwatch2-modding/references/DISCOVERY-LOG.md).
- If `npm run dev` fails with `Cannot read properties of undefined (reading 'whenReady')`, your shell has `ELECTRON_RUN_AS_NODE=1` set (VS Code's integrated terminal can set it). Unset it first.
- In-game checks are tracked in [docs/BOOT-CHECKLIST.md](docs/BOOT-CHECKLIST.md).
- Mechanics planned but not built (quests, trainers, bosses, own layouts…) are in [docs/NEW-MECHANICS.md](docs/NEW-MECHANICS.md).

## Hammerwatch 2 facts this relies on
- Levels are plain-text SVAL XML. `.hsc` is the packed binary that `PACKAGER.exe -l <id>` writes; it exits with code 127 even when it succeeds.
- `PERSISTENT_CHARS`, forced, shares the official ARPG's persistent character pool.
- Only levels using `outside.env` get the day/night cycle.
