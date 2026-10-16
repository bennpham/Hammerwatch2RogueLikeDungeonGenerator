# Hammerwatch 2 Discovery Log

Facts about Hammerwatch 2 (build 137) that this generator relies on. Each entry is tagged:
- **[VERIFIED]**: checked against stock files or run.
- **[IN-GAME]**: confirmed by playing.
- **[ASSUMED]**: not yet checked; it needs a boot-checklist row.

Paths:
- `HW2/` = `<Steam>/steamapps/common/Hammerwatch 2/`
- `A/` = `HW2/unpacked_assets_137/` (base resources, unpacked from `HW2/res/assets.bin`)
- `C/` = `HW2/scenarios/hammerwatch2-arpg/` (the unpacked official campaign; identical to `scenarios/hammerwatch2/levels`)

---

## 1. Packaging

- **[VERIFIED 2026-10-16]** `PACKAGER.exe -l <id>` (cwd = `HW2/`) packs `scenarios/<id>/` into `scenarios/<id>.hsc`.
  - It **exits 127 even on success**, the same as AE.
  - It logs a harmless `[ERR] Failed to parse XML tree: "" (source: scenarios/<id>/resources.xml)`.
  - Its progress lines are `1 / 1: levels/...`, `Sorting...`, `Hashing...`, `Writing...`.
  - Judge success by the produced file, which starts with `HW2S`.
  - The probe was a copy of cave_a.lvl plus a minimal info.xml; it gave a 1957-byte `.hsc`.
- **[VERIFIED 2026-10-16]** A full generated scenario (town + 12 floors, seed 4242) packs cleanly. PACKAGER parses every level (`1 / 13: levels/rl_4242/floor_03.lvl` …) and logs no errors except the resources.xml line. It needs Steam running and logged in ("You must have the steam application running").
- **[VERIFIED]** PACKAGER compiles `info.xml` into the header (it logs "serialized scenario info as info.sval"). **Do not write `info.sval`.**
- **[VERIFIED]** `.hsc` layout:
  - `HW2S` + version byte (03) + 4-byte hash + u32 header length;
  - the binary SValue of info;
  - u32 length + logos.png;
  - entries: `u32 pathLen, path, u8 type, u32 rawSize, u32 lz4Size, LZ4 block`. Type 01 is raw text, type 03 is binary SValue (levels, converted textures).
- **[VERIFIED]** The game only logs `.hsc` scenarios (`HW2.exe.log`). PACKAGER's tree has Packed/Unpacked categories, and loose folders in `scenarios/` are its "Unpack scenario" output.
- **[ASSUMED]** As in AE, leaving the source folder next to the `.hsc` may make the game list the scenario twice. The installer removes the folder, or moves it to `HW2/editor/generated/<id>/`.
- Resource mods are `.bin` files with an `HW2R` header. Scenario ids and level paths are global, so namespace levels as `levels/<id>/…`.

## 2. info.xml

`C/info.xml`:
```xml
<info>
	<name>.scenario.hw2arpg.name</name>
	<description>.scenario.hw2.desc</description>
	<players min="1" max="4" />
	<saving>all</saving>
	<start><level name=".location.his" lvl="levels/hammer_island/prison_hw.lvl" /></start>
	<modifiers><modifier forced="true" id="PERSISTENT_CHARS" /></modifiers>
	<includes><include name="hammerwatch2" levels="true" modifiers="true" /></includes>
</info>
```
- `<saving>all</saving>` compiles to `Saving 2`. If omitted it is 1.
- `<tag>` is free text (mods use `HW2 tag`).
- Modifier entries take `name`, `tooltip` and `id`. With `forced="true"` the modifier is always on and cannot be unticked.
- Tranquility Shores ships the stock switches explicitly:
```xml
<modifier name=".menu.switches.limited_regen.name" id="NO_HP_REGEN" tooltip=".menu.switches.limited_regen.desc"/>
<modifier name=".menu.switches.extra_regen.name"   id="EXTRA_REGEN" tooltip=".menu.switches.extra_regen.desc"/>
<modifier name=".menu.switches.extra_damage.name"  id="EXTRA_DAMAGE" tooltip=".menu.switches.extra_damage.desc"/>
<modifier name=".menu.switches.equipment_loss.name" id="EQUIPMENT_LOSS" tooltip=".menu.switches.equipment_loss.desc"/>
```

### Persistent characters
- **[VERIFIED]** Each modifier id becomes the script define `MOD_<ID>`.
- **[VERIFIED]** `A/scripts/GameModes/HW2GameMode.as:78` runs `%if MOD_PERSISTENT_CHARS PersistentSaves::SetOverrideDataSource(1000000)`.
- **[VERIFIED]** `BaseGameMode.as:1737` loads players from `PersistentSaves::GetSharedData`.
- **[VERIFIED]** The official ARPG writes `saves/persistent/1000000*.hps` (Steam cloud: `userdata/<id>/1538970/remote/saves/persistent/`). Tranquility Shores has its own pool (599335218); it ships custom scripts.
- **[ASSUMED]** A scenario that uses the stock game modes with `PERSISTENT_CHARS` forced shares pool 1000000, the official ARPG characters. This is checklist row P1.
- Without the modifier, characters are saved inside the scenario save (fresh characters per save).

## 3. Level format (.lvl / .pfb)

Plain-text SVAL, the same dialect as AE: tab indent, LF line endings, booleans written `t`/`f`.

**Root keys, in order:**
- `game-mode` dict:
  - `Class`: `DungeonGameMode` (indoors, line of sight), `WorldGameMode` (outdoor region), `BossLevel` (legacy alias of Dungeon), `MainMenu`, `StaticLevel`, `TestLevel`.
  - `DefaultRegion`: an id from `A/tweak/regions.sval`. It sets music, ambience, tier, dig table and weather tags.
  - Optional: `AllowSave`, `SlideShow`, `WorldMap`, `ShowPosOnWorldMap`, `WM*`.
- `version` = 1.
- `lighting` dict: `environment` = `effects/env/*.env`.
- `tiles`: array of 512-px chunks `{vec2 pos, datasets:[{tileset, bytes data-rle, optional bytes color-data}]}`.
- `units`: dict of arrays keyed by unit path (or `:Physics_Rectangle` / `:Physics_Circle` / `:Physics_Freeform`, or a light such as `effects/lights/light_L.png`). Entries are `vec2, int id` pairs, or `array[vec2, int id, dict state]`.
- `statics` (optional): id-less units.
- `scripts`: `[Class, id, vec3, enabled, triggerTimes(-1=inf), executeOnStart, label?, {params}?, [targetId, delayMs]…?]`.
- `prefabs`: alternating `string path`, `vec3 pos`.

**Ids:**
- **[VERIFIED]** Units and scripts share one id space. `Areas` and other id arrays resolve against both.

**Script result feeds:**
- Written as `<array name="#Scripts"><int>2</int><string>Query</string></array>` (also `AllSpawned`, `LastSpawned`, `User`).

**Tile RLE** **[VERIFIED]**:
- A chunk is centred on `pos`, which is a multiple of 512. It covers `pos-256 .. pos+256`.
- It holds (512/size)² cells, row-major. `size` comes from `<tileset size="…">`.
- Each byte is a signed int8: `+n` is n painted cells, `-n` (`256-n`) is n empty cells, capped at ±126.
- Checks: `7e7e04` = a full 32-px chunk; `aa04f404f404f401fe018a` sums to 256.
- This is identical to AE (ported `tiles.ts`). AE picks tile variants and borders itself.

**Sensors:**
- `:Physics_Rectangle{active, jam-through, sensor, shot-through, aim-through: t; size}`, centred on its position.
- `:Physics_Circle{…; radius}`.

**Lights:**
- `effects/lights/light_L.png` with `cast-shadows` (int), `size` (float), `color` (vec4), `overlay` (bool), `overbright` (float).

## 4. The game's own random caves (M1 floor template)

`C/levels/lockdey/cave_a.lvl` (≈9 KB) has **no tiles and no units**. Its contents:
- `game-mode {DungeonGameMode, DefaultRegion}`.
- `SpawnPrefab` (execOnStart) of `levels/_random/<theme>/___random_<size>_caller.pfb`. Each caller is a `PrefabPicker` (execOnStart) over `PickedPrefab{Prefab}` nodes for complete rooms `levels/_random/<theme>/<size>/__<theme>_random_<size>_<x>.pfb`.
  - Themes and sizes: cave_light s/m/l, cave_dark s/m/l, cave_silt s, prison m.
- Rooms carry `EnemyPlacement{Type: few|several|pack|lots}` nodes.
- `PlaceEnemies{Race, Radius 9999}` fills those placements from `A/actors/enemies.sval` schemes named `<race>_<type>`.
- `GlobalEvent tier_<tier>` and `theme_<theme>`.
- Exit retargeting: `QueryWorldScriptsRange{Type: AllPlayersLevelExit, IncludeDisabled}` → `SetScriptParamString{Param: Level|StartID, Value, #Scripts:[queryId, Query]}`.
- Prefabs `prefabs/system/level_setup.pfb` (startup event chain `_autostart`, `start_initiate`, `start_theme`, `start_variation`, `start_enemies`, `start_items`, `start_option`, `start_crystal`) and `prefabs/system/randomcave_exit_setup.pfb` (4 `AllPlayersLevelExit`, `level_exit_{n,e,s,w}_enable` triggers, `LevelStart "random-instance"`).

### 4b. Chained random floors: `C/levels/blackbarrow/cave_a.lvl` → `cave_a_2` → `cave_a_3` [VERIFIED structure]
This is the template for our dungeon floors. It extends cave_a above with the following.

**Room size**
- Three `ScriptLink`s labelled `small`, `med` and `large` each fire a `SpawnPrefab` of a caller (`levels/_random/<theme>/___random_<size>_caller.pfb`).
- The one with `executeOnStart=t` decides the size.
- Each caller's SpawnPrefab then fires a `ToggleScripts` (`s`, `m`, `x`) that enables the size's loot and secret `RandomChance` nodes.

**Main exits** (the four at the arrival point, from `randomcave_exit_setup.pfb`)
- `GameEventTrigger{Event 9}` (triggerTimes 1) fires two `SetScriptParamString` nodes on `QueryWorldScriptsRange{Type AllPlayersLevelExit, IncludeDisabled}`:
  - `Level` = the previous floor (or the region);
  - `StartID` = `random_secondary-instance` (the previous floor's secondary arrival) or `<cave>-region`.
- `_autostart` → `ExecuteScriptsGlobal{ScriptComment level_exit_<n|e|s|w>_enable, Type GlobalEventRanged}` enables them.

**Secondary exit (deeper)**
- Every room has `___randomcave_second_exit_<dir>.pfb` spots. They are hidden by default: `_autostart` → "no exit" `DestroyUnits`.
- `ScriptLink 22` (execOnStart, 150 ms delay) → `ExecuteScriptsGlobal{ScriptComment autoscript_random_content}` → a `ScriptLink` labelled `autoscript_random_content`, which fires:
  - `RandomCount{#ToExecute:[QueryWorldScriptsRange{ScriptComment show_secondary_exit, RequireComment t}, Query]}`, which reveals ONE secondary exit;
  - `SetScriptParamString{Param Level, Value next floor, #Scripts:[Query{ScriptComment secondary_entrance_exit}]}`;
  - `SetScriptParamString{Param StartID, Value random-instance, …same query}`.
- The revealed exit also enables `LevelStart{StartID random_secondary-instance}`, where players arrive when they come back up.
- The prefab also has a heart-key door: `DoorHelper{KeyItemID key_heart}` over `#Doors` = the `AllSpawned` of a `SpawnUnit _door_1a_v`. Revealing the exit only *enables* that SpawnUnit and nothing fires it, so no door spawns and the exit is open. [VERIFIED by reading the graph; IN-GAME check F3] Heart keys are a quest item (flag `item_key_heart`) that no loot table drops, and `Door.TryUse` consumes one when `RemoveKeyOnUse` is on (the default). Never fire `autoscript_spawn_secondary_door_*`.

**Loot**
- `start_items` → `RandomChance(0.75)` → `MinMaxRandomCount{MaxNumToExecute 5|3, #ToExecute:[Query{ScriptComment spawn_level_random_reward, Type ScriptLink}]}`.
- `start_option` → the same for `prefab_secret` (`Type GlobalEventTrigger`).
- `cave_a_3` uses chance 1, which gives more loot on the final floor.

**Stock pairings** of theme event and room set [VERIFIED, survey of every stock random cave]:
- `theme_cave_light` with cave_light rooms.
- `theme_cave_dark` with cave_dark or cave_light rooms.
- `theme_prison` with prison medium rooms (region `prison2`).
- Always `effects/env/grotto.env`; region `level_mysterious` except prison.
- Tier events seen: `tier_apprentice`, `tier_adept`, `tier_expert`.

**Enums**
- `GameEventTrigger.Event`: 9 = `LevelEntered`, 5 = `FlagSet`.
- `SetFlag.State` (`FlagBank.as`): Off 0, Level 1, Run 2, Town 3, TownAll 4, HostTown 5.
- `UseTrigger.Icon` (`IUsable.as`): None, Generic, Cross, Key, Shop 4, Speech, Exit 6, …
- `SetRespawnPoint.SpawnpointType`: Town 1, Safe 2, Unsafe 3.
- `PotionRefill.State`: All 1, Inventory 2, Equipped 3.

**Other nodes**
- `DestroyUnitsRange{UnitType doodads/lamps/torch_default.unit, Radius 4000}` ("notorches").
- `ScriptLink` → `ExecuteScriptsGlobal{ScriptComment autoscript_random_content}` also wakes `GlobalEventRanged spawnbatspawner` (cave_a).

## 5. Theme prefab pieces (M2)

- `A/prefabs/__levels/theme_<theme>/` contains `flat_128/256`, `lane_h|v_128/256_*`, `crn_*_256`, `x_256/512*`, `wall_*_256`, `divider_*`, `secret_small_*`, `storage_small_*`, `exit_<dir>_<up|dn>`, `dst_*`, `__randomcave_*_exit_*`.
- Each piece holds real tiles, walls and lights. `*_system.pfb` picks a variant.
- `__base/__all_<piece>.pfb` swaps the theme on `GlobalEventTrigger theme_<x>`.
- Stock levels drop these into hand-drawn layouts (wolfcave places ≈375).

## 6. Enemies, tiers, XP

- Stats are fixed per unit (`A/actors/_actor_stats.inc`: `HP_*`, `XP_*`). Each unit has a `tier` (apprentice, adept, expert, master).
- `mp-scale-fact` scales by player count.
- XP is scaled down when the player out-levels the enemy's tier (`A/scripts/Data/Player.as` `GetExperienceTierScale`).
- Depth scaling = choosing race and tier per floor.
- Spawn schemes: `A/actors/enemies.sval` plus `.inc` files, ids `<race>_<few|several|pack|lots|superior>`.

## 7. Leveling

`A/scripts/Data/Player.as`:
- XP to the next level = 1000·lvl^2.
- Max level 50. Tiers at level 5, 15 and 30.
- 5 stat points per level.
- Hard and Serious difficulty multiply XP by 0.75.

Tier upgrades are bought from trainer NPCs through quests (`A/tweak/quests/quests_tiers.inc`).

## 8. Shops

- `A/tweak/shop/shops.sval` includes about 40 `shop_<npc>.inc` files with ids `<npc>_shop`.
- The `ShopArea` world script (`A/scripts/WorldScript/GUI/ShopArea.as`) opens a shop by `Shop` = `tweak/shop/shops.sval:<id>`.
- Store NPC units (`A/actors/npcs/stores/`) open shops through dialog (`tweak/quests/quests_stores.inc` → `AddShopPrompt`) and follow hour-based `Schedule` place names.

## 9. Day/night, death

- `A/scripts/Modules/WeatherManager.as`: one real hour = one game day.
- Only `effects/env/outside.env` levels cycle (`A/effects/env/__cycle.sval`). Dungeons use fixed env files.
- No lives. Death respawns the player at `SetRespawnPoint` and advances the clock 6–8 hours (`A/scripts/Data/Misc.as:58`).

## 10. Level transitions

- `LevelStart{StartID}` registers a spawn; no StartID means the default start.
- `AllPlayersLevelExit{Areas, Level, StartID, TimeTravelHours, ResetLevel}` and `LevelExit{Level, StartID}`.
- The destination spawns players at the matching `LevelStart`.
