# New mechanics: research notes (not built yet)

Hammerwatch 2 systems the generator does not emit yet. Each entry covers what the game already has, how we could drive it from a generated scenario, and how feasible that looks. Paths are relative to `unpacked_assets_137/`.

**Built so far (M1):**
- a town with shops and a potion refill
- random-cave floors with depth-scaled enemies and tiers
- town returns and a respawn point
- optional persistent characters

---

## Quests (deferred until further discovery)
**What exists**
- Quests and dialog are written as AngelScript-style calls in `tweak/quests/*.inc`: `CreateQuest`, `AddMissionKillEnemyTag`, `AddMissionCollectItem`, `AddRewardGold`, `AddRewardExperience`, `AddRewardEquipment`, `AddShopPrompt`, …
- A `.mas` macro script (`tweak/quests/world.mas`, which includes `scripts/Quests/GenerationHelper.inc`) compiles them into `quests_world.sval` and `dialog_world.sval`.
- Runtime code is in `scripts/Quests/` (missions: CheckFlag, CheckQuestState, CollectGold, CollectItem, KillEnemy).
- Levels drive quests with the `SetQuest` and `CheckQuest` nodes.

**How we'd use it**
- Write a scenario-local `tweak/quests/rl_world.mas` + `rl_quests.inc` + a `.lang` file, following `scenarios/example_scenario/tweak/quests/k_world.mas`.
- Give the town a quest-giver NPC whose dialog is `temp/rl_dialog.sval:<npc>`.
- Generated bounties: "Kill N <race> on depth X" uses `AddMissionKillEnemyTag` with the race's tag (enemy units carry `tags` such as `wolf`, `beast`). "Reach depth N" uses a `SetFlag` on that floor plus a `CheckFlag` mission.

**Feasibility:** medium. The format is documented by example. The risk is the `.mas` → `.sval` generation step at pack time: does PACKAGER run `.mas`? `example_scenario` ships the `.mas`, which suggests the game compiles it at load. This needs an in-game check.

## Trainers / tier upgrades
**What exists**
- `tweak/quests/quests_tiers.inc`: trainer NPCs sell tier upgrades through dialog when you meet the level, gold and current-tier requirements (`AddRewardTierUpgrade`).
- NPC units are in `actors/npcs/trainers/`.

**How we'd use it**
- Place a stock trainer NPC unit in the town. Its dialog is in base `dialog_world.sval`, which should resolve in any scenario because base resources are always loaded.
- Risk: the NPCs' hour-based `Schedule` names places (`NPCPlaceArea`) that our town doesn't have.

**Feasibility:** high if the schedule falls back to standing still. Otherwise add `NPCPlaceArea` nodes whose names match the schedule entries.

## Store NPCs instead of ShopArea stalls
**What exists:** `actors/npcs/stores/npc_*.unit` open their shop from dialog (`quests_stores.inc` → `AddShopPrompt`).

**Status:** M1 uses `ShopArea` nodes on stalls, which is deterministic and needs no dialog. Swapping in NPCs has the same schedule risk as trainers.

## Bosses
**What exists**
- `actors/bosses/*` (archibald_steelwill, barrington, blight_the_horrible, commodore_sinkage, dace_arden, doombringer, judge_supreme, malgar, shock_widow).
- `BossBar*` GUI nodes, `UnitDestroyedTrigger`, and the `BossLevel` game mode.
- Stock boss levels: `scenarios/hammerwatch2-arpg/levels/**/_boss_*.lvl`.

**How we'd use it**
- Port the AE generator's arena and wave rigs (`boss/arena.ts`, `boss/waves.ts`): an arena floor every K floors, the boss spawned with `SpawnUnit`, and the exit unsealed on `UnitDestroyedTrigger`.
- Many bosses have scripted phases that depend on their own level's nodes. Survey each `_boss_*.lvl` first.

**Feasibility:** medium. Start with bosses whose levels use only a `SpawnUnit` and a boss bar.

## Own dungeon layouts (M2)
- Port AE `map/` (rooms, passages, reachability) and `aeWalls.ts`. HW2 wall pieces have the same anchors (`v_32` collides `0 16 16 32`), and tiles use the same RLE.
- Decorate with `prefabs/__levels/theme_<theme>/*` pieces.
- Put `EnemyPlacement` nodes in rooms and one `PlaceEnemies` per floor.

**Feasibility:** high (planned).

## Day/night in dungeons
- Only `effects/env/outside.env` levels cycle (`scripts/Modules/WeatherManager.as`).
- Night events exist: `CheckTimeOfDay`, `GameTimeTrigger`, and `prefabs/enemies/undead_night_raise*.pfb`.
- We could add night-only spawns to outdoor floors.

**Feasibility:** high for outdoor floors. Not applicable indoors.

## Crafting, sleeping, travel
- Crafting: the `CraftingArea` node or the dialog `AddCraftPrompt`.
- Sleeping: `AllPlayersSleep{GoldCostBase, GoldCostPerHour, SpawnPointID, Areas}` (tavern sleep spots) gives the town a rest point.
- Travel: `AllPlayersTravel{TravelAgencyID}` with `tweak/travel.sval`. Not needed for a single-hub scenario.

**Feasibility:** high for sleeping and crafting (one node plus a sensor each).

## Secrets and keys
- Random rooms already contain `secret_small_*` pieces and `prefab_secret` triggers. The floor template fires a random number of them (`MinMaxRandomCount`).
- The secondary exit is behind a heart-key `DoorHelper`. If heart keys turn out not to spawn reliably (checklist F3), drop a key near the arrival point with `GivePlayerItem` or `SpawnItem`.

## Difficulty switches
- The stock switches NO_HP_REGEN, EXTRA_REGEN, EXTRA_DAMAGE and EQUIPMENT_LOSS are offered.
- Per-unit `%if DIFF_HARD` stat blocks follow the game's own difficulty setting.
- A "hardcore" variant could force `EQUIPMENT_LOSS`.
