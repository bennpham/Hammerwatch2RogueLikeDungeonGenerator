import { Hw2Level, P } from '../hw2/model'
import type { Hw2Script } from '../hw2/model'
import type { FloorTheme, RoomSize, Tier } from '../catalog/depth'
import { roomCaller } from '../catalog/depth'

/**
 * One dungeon floor built on the game's own random-cave system — a
 * parameterised copy of the stock chained caves
 * `levels/blackbarrow/cave_a.lvl` → `cave_a_2` → `cave_a_3`
 * (DISCOVERY-LOG §4b). The level holds no tiles or units of its own:
 *
 * - a `SpawnPrefab` of `levels/_random/<set>/___random_<size>_caller.pfb`,
 *   whose `PrefabPicker` drops one complete room at the origin; the room
 *   brings walls, tiles, lights, `EnemyPlacement`s, reward and secret spots,
 *   and hidden secondary exits;
 * - `GlobalEvent theme_*` (re-skins the room's pieces) and `tier_*`;
 * - `PlaceEnemies{Race}` filling every placement from `actors/enemies.sval`;
 * - the MAIN exits (four sensors at the arrival point, from
 *   `prefabs/system/randomcave_exit_setup.pfb`), retargeted on
 *   `LevelEntered` to `spec.up`;
 * - the SECONDARY exit: one random `show_secondary_exit` is revealed and
 *   every `secondary_entrance_exit` retargeted to `spec.down`;
 * - loot and secrets fired in random amounts from the room's
 *   `spawn_level_random_reward` / `prefab_secret` spots.
 *
 * Players arrive from above at `random-instance` (the exit setup's
 * LevelStart) and from below at `random_secondary-instance` (enabled when
 * the secondary exit is revealed).
 *
 * Positions copy the stock file; they only matter in the editor.
 */

export const START_FROM_ABOVE = 'random-instance'
export const START_FROM_BELOW = 'random_secondary-instance'

export interface ExitTarget {
  level: string
  startId: string
}

export interface FloorSpec {
  /** 1-based depth, for the arrival announcement */
  depth: number
  theme: FloorTheme
  /** room set (`levels/_random/<set>/`) — one of `theme.roomSets` */
  roomSet: string
  size: RoomSize
  tier: Tier
  race: string
  /** chance the room's reward and secret spots fire at all (stock: 0.75, 1 on a cave's last floor) */
  lootChance: number
  /** where the arrival-point exits lead (back up) */
  up: ExitTarget
  /** where the revealed secondary exit leads (deeper, or home) */
  down: ExitTarget
  /** Run flags set when the party enters (town portal unlocks) */
  setFlags?: string[]
  /** shown on entry; `title` defaults to `Depth N` */
  announce?: { title?: string; text: string }
}

/** Stock caps per size on how many reward / secret spots fire (`MinMaxRandomCount`). */
const LOOT_CAPS: Record<RoomSize, { rewards: number; secrets: number }> = {
  small: { rewards: 1, secrets: 1 },
  medium: { rewards: 3, secrets: 2 },
  large: { rewards: 5, secrets: 3 }
}

/** `SetFlag.State`: Run = kept for the whole save (FlagBank.as). */
const FLAG_RUN = 2
/** `GameEventTrigger.Event`: LevelEntered. */
const EVENT_LEVEL_ENTERED = 9

export function buildRandomCaveFloor(spec: FloorSpec): Hw2Level {
  const caller = roomCaller(spec.roomSet, spec.size)
  if (caller === undefined) throw new Error(`no ${spec.size} rooms in set ${spec.roomSet}`)

  const lvl = new Hw2Level(spec.theme.environment)
  lvl.gameMode = { cls: 'DungeonGameMode', defaultRegion: spec.theme.region }
  const on = (event: string, x: number, y: number): Hw2Script =>
    lvl.addScript('GlobalEventTrigger', x, y, [P.str('EventName', event)], { label: event })

  // --- startup chain (level_setup.pfb fires these events in order) ---------
  // the room ships wall torches; stock random caves remove them (lit by the env instead)
  const autostart = on('_autostart', 0, -48)
  const noTorches = lvl.addScript(
    'DestroyUnitsRange',
    0,
    16,
    [P.str('UnitType', 'doodads/lamps/torch_default.unit'), P.int('Radius', 4000)],
    { label: 'notorches' }
  )
  lvl.link(autostart, noTorches)

  const theme = lvl.addScript('GlobalEvent', 384, -512, [P.str('EventName', spec.theme.themeEvent)], { label: spec.theme.themeEvent })
  lvl.link(on('start_theme', 384, -608), theme)

  const tier = lvl.addScript('GlobalEvent', -128, -512, [P.str('EventName', `tier_${spec.tier}`)], { label: `tier_${spec.tier}` })
  lvl.link(on('start_variation', -128, -608), tier)

  const place = lvl.addScript('PlaceEnemies', -384, -512, [P.int('Radius', 9999), P.str('Race', spec.race)])
  lvl.link(on('start_enemies', -384, -608), place)

  // --- the room ---------------------------------------------------------------
  const sizeLink = lvl.addScript('ScriptLink', 0, 176, [], { executeOnStart: true, label: spec.size })
  const spawnRoom = lvl.addScript('SpawnPrefab', 0, 0, [P.str('Prefab', caller)], { label: spec.size })
  lvl.link(sizeLink, spawnRoom)

  // --- loot & secrets: enabled once the room exists, fired on start_items / start_option
  const caps = LOOT_CAPS[spec.size]
  const rewardSpots = lvl.addScript(
    'QueryWorldScriptsRange',
    -544,
    -512,
    [P.int('Radius', 9999), P.str('ScriptComment', 'spawn_level_random_reward'), P.bool('RequireComment', true), P.str('Type', 'ScriptLink')],
    { label: 'spawn_level_random_reward' }
  )
  const secretSpots = lvl.addScript(
    'QueryWorldScriptsRange',
    224,
    -512,
    [P.int('Radius', 9999), P.str('ScriptComment', 'prefab_secret'), P.bool('RequireComment', true), P.str('Type', 'GlobalEventTrigger')],
    { label: 'prefab_secret' }
  )
  const rewardCount = lvl.addScript('MinMaxRandomCount', -512, -576, [
    P.int('MinNumToExecute', 0),
    P.int('MaxNumToExecute', caps.rewards),
    P.target('#ToExecute', rewardSpots.id, 'Query')
  ])
  const secretCount = lvl.addScript('MinMaxRandomCount', 256, -576, [
    P.int('MinNumToExecute', 0),
    P.int('MaxNumToExecute', caps.secrets),
    P.target('#ToExecute', secretSpots.id, 'Query')
  ])
  const rewardChance = lvl.addScript('RandomChance', -512, -608, [P.float('ChanceToExecute', spec.lootChance), P.ids('OnTrue', [rewardCount.id])], {
    enabled: false
  })
  const secretChance = lvl.addScript('RandomChance', 256, -608, [P.float('ChanceToExecute', spec.lootChance), P.ids('OnTrue', [secretCount.id])], {
    enabled: false
  })
  const enableLoot = lvl.addScript('ToggleScripts', 176, 0, [P.ids('Scripts', [rewardChance.id, secretChance.id])], { label: spec.size[0] })
  lvl.link(spawnRoom, enableLoot)
  lvl.link(on('start_items', -640, -608), rewardChance)
  lvl.link(on('start_option', 128, -608), secretChance)

  // --- main exits (arrival point): enable all four, point them back up -------
  const enableAll = on('_autostart', 896, -608)
  for (const [dir, x, y] of [
    ['s', 960, -544],
    ['e', 832, -544],
    ['w', 832, -480],
    ['n', 960, -480]
  ] as const) {
    const ex = lvl.addScript('ExecuteScriptsGlobal', x, y, [P.str('ScriptComment', `level_exit_${dir}_enable`), P.str('Type', 'GlobalEventRanged')], {
      label: `level_exit_${dir}_enable`
    })
    lvl.link(enableAll, ex)
  }
  const mainExits = lvl.addScript('QueryWorldScriptsRange', -80, 0, [P.int('Radius', 9999), P.str('Type', 'AllPlayersLevelExit'), P.bool('IncludeDisabled', true)])
  const upLevel = lvl.addScript('SetScriptParamString', -208, -16, [P.str('Param', 'Level'), P.str('Value', spec.up.level), P.target('#Scripts', mainExits.id, 'Query')], {
    label: 'exit out to level'
  })
  const upStart = lvl.addScript('SetScriptParamString', -208, 32, [P.str('Param', 'StartID'), P.str('Value', spec.up.startId), P.target('#Scripts', mainExits.id, 'Query')], {
    label: 'exit out id'
  })
  const entered = lvl.addScript('GameEventTrigger', -304, 16, [P.int('Event', EVENT_LEVEL_ENTERED)], { triggerTimes: 1 })
  lvl.link(entered, upLevel)
  lvl.link(entered, upStart)

  // --- secondary exit: reveal one, point every one deeper ---------------------
  const showable = lvl.addScript('QueryWorldScriptsRange', 272, -128, [P.str('ScriptComment', 'show_secondary_exit'), P.bool('RequireComment', true), P.int('Radius', 9999)])
  const downExits = lvl.addScript('QueryWorldScriptsRange', 352, -128, [P.str('ScriptComment', 'secondary_entrance_exit'), P.bool('RequireComment', true), P.int('Radius', 9999)])
  const reveal = lvl.addScript('RandomCount', 272, -224, [P.target('#ToExecute', showable.id, 'Query')])
  const downLevel = lvl.addScript('SetScriptParamString', 352, -272, [P.str('Value', spec.down.level), P.str('Param', 'Level'), P.target('#Scripts', downExits.id, 'Query')], {
    label: 'second level'
  })
  const downStart = lvl.addScript('SetScriptParamString', 352, -224, [P.str('Param', 'StartID'), P.str('Value', spec.down.startId), P.target('#Scripts', downExits.id, 'Query')], {
    label: 'start id of second level'
  })
  const randomContent = lvl.addScript('ScriptLink', 272, -272, [], { label: 'autoscript_random_content' })
  lvl.link(randomContent, reveal)
  lvl.link(randomContent, downLevel)
  lvl.link(randomContent, downStart)
  // fires every `autoscript_random_content` script — ours above and the room's own
  const runRandomContent = lvl.addScript('ExecuteScriptsGlobal', 400, -384, [P.str('ScriptComment', 'autoscript_random_content')])
  const kick = lvl.addScript('ScriptLink', 512, -384, [], { executeOnStart: true })
  lvl.link(kick, runRandomContent, 150)

  // --- extras: progress flags and the arrival banner ---------------------------
  if ((spec.setFlags?.length ?? 0) > 0 || spec.announce !== undefined) {
    const arrived = lvl.addScript('GameEventTrigger', -304, 96, [P.int('Event', EVENT_LEVEL_ENTERED)], { triggerTimes: 1 })
    let y = 96
    for (const flag of spec.setFlags ?? []) {
      const set = lvl.addScript('SetFlag', -208, y, [P.str('Flag', flag), P.int('State', FLAG_RUN)], { label: flag })
      lvl.link(arrived, set)
      y += 48
    }
    if (spec.announce !== undefined) {
      const text = lvl.addScript('AnnounceText', -208, y, [P.str('Title', spec.announce.title ?? `Depth ${spec.depth}`), P.str('Text', spec.announce.text)])
      lvl.link(arrived, text, 500)
    }
  }

  lvl.prefabs.push({ path: 'prefabs/system/level_setup.pfb', x: 0, y: -544 }, { path: 'prefabs/system/randomcave_exit_setup.pfb', x: 0, y: 0 })
  return lvl
}
