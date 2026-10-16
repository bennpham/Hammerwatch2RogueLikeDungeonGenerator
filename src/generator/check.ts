import type { Hw2Level, Param } from './hw2/model'
import { hw2AssetExists, raceExists } from './catalog/assets'
import { HW2_SHOPS } from './catalog/hw2Assets.generated'
import { START_FROM_ABOVE, START_FROM_BELOW } from './floors/randomCaveFloor'

/**
 * Structural checks on a generated scenario: the invariants in CLAUDE.md that
 * a level file cannot show by itself. Returns human-readable problems; empty
 * means the scenario is sound.
 *
 * - ids unique per level; every id a param or connection names exists
 * - every asset path (units, prefabs, env, tilesets, SpawnPrefab/SpawnUnit
 *   params, PlaceEnemies races, ShopArea shops) is in the snapshot
 * - every exit's (Level, StartID) lands on a LevelStart of a scenario level
 */

export interface LevelFile {
  /** scenario-relative path, e.g. `levels/rl_42/floor_01.lvl` */
  path: string
  level: Hw2Level
}

/** Starts a stock prefab registers in the level that places it. */
const PREFAB_STARTS: Record<string, string[]> = {
  // `random_secondary-instance` lives in the room's secondary exit and is
  // enabled when that exit is revealed (DISCOVERY-LOG §4b)
  'prefabs/system/randomcave_exit_setup.pfb': [START_FROM_ABOVE, START_FROM_BELOW]
}

function param(params: Param[], name: string): Param | undefined {
  return params.find((p) => p.name === name)
}

function str(params: Param[], name: string): string | undefined {
  const p = param(params, name)
  return p?.kind === 'string' ? p.value : undefined
}

/** Every (Level, StartID) an exit in this level can send the party to. */
export function exitTargets(level: Hw2Level): Array<{ level: string; startId: string; from: string }> {
  const out: Array<{ level: string; startId: string; from: string }> = []
  for (const s of level.scripts) {
    if (s.cls === 'AllPlayersLevelExit' || s.cls === 'LevelExit') {
      const lvl = str(s.params, 'Level')
      if (lvl !== undefined) out.push({ level: lvl, startId: str(s.params, 'StartID') ?? '', from: `${s.cls}#${s.id}` })
    }
  }
  // retargeted exits: a Level and a StartID SetScriptParamString on the same query
  const byQuery = new Map<number, { level?: string; startId?: string; from: string }>()
  for (const s of level.scripts) {
    if (s.cls !== 'SetScriptParamString') continue
    const feed = param(s.params, '#Scripts')
    if (feed?.kind !== 'target') continue
    const entry = byQuery.get(feed.value[0]) ?? { from: `SetScriptParamString#${s.id}` }
    const which = str(s.params, 'Param')
    if (which === 'Level') entry.level = str(s.params, 'Value')
    if (which === 'StartID') entry.startId = str(s.params, 'Value')
    byQuery.set(feed.value[0], entry)
  }
  for (const e of byQuery.values()) {
    if (e.level !== undefined) out.push({ level: e.level, startId: e.startId ?? '', from: e.from })
  }
  return out
}

/** StartIDs a party can arrive at in this level (`''` = the default start). */
export function levelStarts(level: Hw2Level): Set<string> {
  const out = new Set<string>()
  for (const s of level.scripts) if (s.cls === 'LevelStart') out.add(str(s.params, 'StartID') ?? '')
  for (const p of level.prefabs) for (const id of PREFAB_STARTS[p.path] ?? []) out.add(id)
  return out
}

function checkLevel(file: LevelFile, problems: string[]): void {
  const { level, path } = file
  const at = (msg: string): void => {
    problems.push(`${path}: ${msg}`)
  }
  const ids = new Set<number>()
  for (const u of level.units) {
    if (ids.has(u.id)) at(`duplicate id ${u.id}`)
    ids.add(u.id)
    if (!hw2AssetExists(u.path)) at(`unknown unit ${u.path}`)
  }
  for (const s of level.scripts) {
    if (ids.has(s.id)) at(`duplicate id ${s.id}`)
    ids.add(s.id)
  }
  if (level.environment !== null && !hw2AssetExists(level.environment)) at(`unknown env ${level.environment}`)
  for (const p of level.prefabs) if (!hw2AssetExists(p.path)) at(`unknown prefab ${p.path}`)
  for (const c of level.tileCells) for (const d of c.datasets) if (!hw2AssetExists(d.tileset)) at(`unknown tileset ${d.tileset}`)

  for (const s of level.scripts) {
    const where = `${s.cls}#${s.id}`
    for (const [target] of s.connections) if (!ids.has(target)) at(`${where} links to missing id ${target}`)
    for (const p of s.params) {
      const refs = p.kind === 'ids' ? p.value : p.kind === 'target' ? [p.value[0]] : p.kind === 'sources' ? p.value.map((v) => v[0]) : []
      for (const r of refs) if (!ids.has(r)) at(`${where}.${p.name} names missing id ${r}`)
    }
    const prefab = s.cls === 'SpawnPrefab' ? str(s.params, 'Prefab') : undefined
    if (prefab !== undefined && !hw2AssetExists(prefab)) at(`${where} spawns unknown prefab ${prefab}`)
    const unit = s.cls === 'SpawnUnit' ? str(s.params, 'UnitType') : undefined
    if (unit !== undefined && !hw2AssetExists(unit)) at(`${where} spawns unknown unit ${unit}`)
    const race = s.cls === 'PlaceEnemies' ? str(s.params, 'Race') : undefined
    if (race !== undefined && !raceExists(race)) at(`${where} places unknown race ${race}`)
    const shop = s.cls === 'ShopArea' ? str(s.params, 'Shop') : undefined
    if (shop !== undefined) {
      const m = /^tweak\/shop\/shops\.sval:(.+)$/.exec(shop)
      if (m === null || !(m[1] in HW2_SHOPS)) at(`${where} opens unknown shop ${shop}`)
    }
  }
}

export function checkScenario(files: LevelFile[]): string[] {
  const problems: string[] = []
  const byPath = new Map(files.map((f) => [f.path, f]))
  for (const f of files) checkLevel(f, problems)
  for (const f of files) {
    for (const t of exitTargets(f.level)) {
      const dest = byPath.get(t.level)
      if (dest === undefined) {
        problems.push(`${f.path}: ${t.from} leads to ${t.level}, which is not in the scenario`)
        continue
      }
      if (!levelStarts(dest.level).has(t.startId)) {
        problems.push(`${f.path}: ${t.from} leads to ${t.level} start "${t.startId}", which has no LevelStart`)
      }
    }
  }
  return problems
}
