---
name: hammerwatch2-modding
description: Hammerwatch 2 level/scenario format knowledge — SVAL .lvl/.pfb structure, world-script nodes, random-cave prefab system, packaging (.hsc via PACKAGER -l), info.xml modifiers and persistent characters. Use before writing or changing anything the generator emits for Hammerwatch 2.
---

# Hammerwatch 2 modding

Read `references/DISCOVERY-LOG.md` first. It records every format fact this project relies on, each tagged VERIFIED, IN-GAME or ASSUMED.

## Where to look in a Hammerwatch 2 install
- `unpacked_assets_137/`: base resources. Includes scripts (`scripts/WorldScript/**` defines every world-script node and its `[Editable]` params), units, prefabs, tilesets and tweak data.
- `scenarios/hammerwatch2-arpg/levels/`: the unpacked official campaign levels (plain XML).
  - `lockdey/cave_a.lvl` is the minimal random cave.
  - `blackbarrow/cave_a(_2,_3).lvl` is a chained multi-floor random cave. It is the template for our floors.
- `scenarios/example_scenario/`: a minimal mod with a custom NPC, shop, quest and `.lang`.

## Rules of thumb
- Never guess a script node's params. Read its `.as` file, or find a stock level that uses it, and copy the shape.
- Every asset path must exist in the scanned snapshot (`src/generator/catalog/hw2Assets.generated.ts`).
- Units and scripts share one id space per level.
- When something new is confirmed in-game, tick its `docs/BOOT-CHECKLIST.md` row and change its log tag to IN-GAME.

## Compact dump of a level's scripts
```sh
tr -d '\t' < level.lvl | paste -sd '' | sed 's/<array><string>/\n&/g' \
 | sed 's/<\/\?\(bool\|int\|string\|vec3\|vec2\|float\)>/ /g; s/<dict>/{/g; s/<\/dict>/}/g; s/<array>/[/g; s/<\/array>/]/g; s/<[a-z0-9]* name="\([^"]*\)">/\1=/g; s/<\/[a-z0-9]*>//g'
```
