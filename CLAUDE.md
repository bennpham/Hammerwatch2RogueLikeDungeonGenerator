# Hammerwatch 2 Rogue-Like Dungeon Generator

An Electron, React and TypeScript app that generates rogue-like **Hammerwatch 2** scenarios. Each scenario is a town hub plus a chain of random dungeon floors whose enemies scale with depth. It is packed into a `.hsc` with the game's own `PACKAGER.exe`.

The sibling project `bennpham/HammerwatchAERogueLikeDungeonGenerator` does the same for Hammerwatch Anniversary Edition, and much of this code is ported from it. Keep the two similar where the engines agree: SVAL, tile RLE and walls are the same engine.

## Commands
- `npm run dev`: run the app.
- `npm run typecheck && npm test`: what CI runs.
- `npm run scan`: rebuild `src/generator/catalog/hw2Assets.generated.ts` from `<HW2>/unpacked_assets_*`. Add `--check` to check that the snapshot is current.
- `npm run gen -- --seed 42 [--out dir] [--install]`: generate headless.
- `HW2_ROOT=<install>`: lets stock-file tests run. They are skipped when the game is not installed. `HW2_PACK=1` also runs a real PACKAGER pack.

## Layout
- `src/generator/`: **pure**. No fs, no Electron, no DOM. `generateScenario(params, seed)` returns `{files}`.
  - `hw2/`: SVAL reader and writer, level model and writer and reader, tile RLE, walls, `info.xml`, logo.
  - `catalog/`: scanned asset snapshot (`*.generated.ts`, never hand-edited), `assets.ts` lookups, `depth.ts` (tier, race, region and theme per floor).
  - `floors/`: dungeon floor builders. `randomCaveFloor.ts` reuses the game's own random-cave rooms.
  - `town/`: the hub level.
  - `config/`: parameters, validation, `parameters.txt` IO.
  - `check.ts`: structural checks on every emitted level.
- `src/main/`: Electron main (IPC, settings, `packer.ts` = install and PACKAGER).
- `src/renderer/`: React UI.
- `scripts/`: the scanner and dev scripts (`node scripts/run-ts.mjs scripts/dev/<x>.ts`).
- `.claude/skills/hammerwatch2-modding/`: **the format bible**. Read `references/DISCOVERY-LOG.md` before touching level output, and add to it when you learn something.
- `docs/BOOT-CHECKLIST.md`: in-game verification rows. `docs/NEW-MECHANICS.md`: mechanics not built yet.

## Invariants
1. **Deterministic**: the same parameters and seed give byte-identical files. All randomness goes through `core/rand.ts`.
2. **Bounded loops**: every retry loop has a cap.
3. **Validate, don't crash**: bad parameters return `{ok:false, errors}`.
4. **Every floor is finishable**: every exit's `Level` and `StartID` has a matching `LevelStart` (`check.ts`).
5. **Every emitted asset path exists in the snapshot**: units, prefabs, tilesets, env files and shop ids.
6. **One id counter per level**, shared by units and scripts.
7. Never write `info.sval`. PACKAGER compiles it from `info.xml`.
8. Never copy game files into the repo. Overrides are produced from the user's own install at install time.

## Git
Work on `main`. Make **one commit per feature**. `main` is the default branch on GitHub.
