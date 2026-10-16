import { Hw2Level, P, TILE } from '../hw2/model'
import type { Hw2Script, Hw2Unit, StateValue } from '../hw2/model'
import { TileLayers } from '../hw2/tiles'
import { placeWalls } from '../hw2/walls'
import { HW2_UNIT_SET, shopRef, tilesetSize } from '../catalog/assets'
import { TIERS } from '../catalog/depth'
import type { Tier } from '../catalog/depth'
import { TOWN_SHOPS } from '../catalog/townShops'
import type { ExitTarget } from '../floors/randomCaveFloor'

/**
 * The town hub: a walled outdoor plaza (`WorldGameMode` + `outside.env`, so the
 * engine's day/night cycle and weather run here — only `outside.env` levels
 * cycle, WeatherManager.as) with:
 *
 * - shop stalls: a counter, a sensor, `UseTrigger(Icon Shop)` → a `CheckFlag`
 *   chain from the highest tier down → `ShopArea{Shop}` of that tier's stock
 *   shop (`catalog/townShops.ts`), so stalls restock with better gear as the
 *   party unlocks deeper bands;
 * - a well: `UseTrigger` → `PotionRefill`;
 * - one dungeon entrance per band (`exit_hole` + `AllPlayersLevelExit`); band 0
 *   is open, deeper ones are enabled on entry when their Run flag is set;
 * - the default start (new game), the `town-return` start every way home
 *   lands on, and a Town respawn point there (death brings you home).
 *
 * Grid in 16-px tiles, origin top-left at pixel (0,0). Pure, no RNG.
 */

export const TOWN_RETURN_START = 'town-return'

export interface TownBand {
  /** 0-based band */
  index: number
  tier: Tier
  label: string
  /** null = open from the start */
  flag: string | null
  /** floating text at a sealed entrance */
  sealedHint?: string
  entry: ExitTarget
}

export interface TownSpec {
  bands: TownBand[]
  /** Run flag that unlocks each tier's shop stock; null = from the start */
  tierFlags: Partial<Record<Tier, string | null>>
  wallSet?: string
  ground?: string
  plaza?: string
}

const W = 48
const H = 32
const DEFAULT_WALLS = 'hedge_trimmed'
const DEFAULT_GROUND = 'tilesets/grass_1_default.tileset'
const DEFAULT_PLAZA = 'tilesets/stone_cobble.tileset'
const COUNTER = 'doodads/generic/counter_wood.unit'
const WELL = 'doodads/generic/well.unit'
const HOLE = 'doodads/generic/exit_hole.unit'
const LIGHT = 'effects/lights/light_L.png'

/** `UseTrigger.Icon` (IUsable.as) */
const ICON_GENERIC = 1
const ICON_SHOP = 4
const ICON_EXIT = 6
/** `SetRespawnPoint.SpawnpointType`: Town */
const RESPAWN_TOWN = 1
/** `GameEventTrigger.Event`: LevelEntered */
const EVENT_LEVEL_ENTERED = 9
/** `ShowFloatingText.FloatingType` used by the stock cave entrances */
const FLOAT_HINT = 10

const px = (tiles: number): number => tiles * TILE

export function buildTown(spec: TownSpec): Hw2Level {
  const lvl = new Hw2Level('effects/env/outside.env')
  lvl.gameMode = { cls: 'WorldGameMode', defaultRegion: 'his_town_haart' }
  const wallSet = spec.wallSet ?? DEFAULT_WALLS

  // --- ground: grass everywhere (grown under the wall ring), cobbles in the plaza
  const tiles = new TileLayers(tilesetSize)
  const all: Array<[number, number]> = []
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) all.push([x, y])
  tiles.paint16(spec.ground ?? DEFAULT_GROUND, all, [1, 1, 1, 1])
  const plaza: Array<[number, number]> = []
  for (let y = 4; y < H - 4; y++) for (let x = 4; x < W - 4; x++) plaza.push([x, y])
  tiles.paint16(spec.plaza ?? DEFAULT_PLAZA, plaza)
  lvl.tileCells = tiles.cells()

  // --- starts, respawn ---------------------------------------------------------
  const spawnX = px(W / 2)
  const spawnY = px(H - 9)
  lvl.addScript('LevelStart', spawnX, spawnY)
  lvl.addScript('LevelStart', spawnX, spawnY + 32, [P.str('StartID', TOWN_RETURN_START)], { label: TOWN_RETURN_START })
  const entered = lvl.addScript('GameEventTrigger', spawnX - 96, spawnY, [P.int('Event', EVENT_LEVEL_ENTERED)])
  const respawn = lvl.addScript('SetRespawnPoint', spawnX - 96, spawnY + 48, [
    P.str('SpawnId', TOWN_RETURN_START),
    P.int('SpawnpointType', RESPAWN_TOWN),
    P.str('Name', 'Town')
  ])
  lvl.link(entered, respawn)

  // --- shop stalls along the north side -----------------------------------------
  const unlocked = TIERS.filter((t) => spec.tierFlags[t] !== undefined)
  TOWN_SHOPS.forEach((cat, i) => {
    const cx = px(6 + i * 7)
    const cy = px(7)
    lvl.addUnit(COUNTER, cx, cy, { start: { kind: 'string', value: 'h_open' } })
    addLight(lvl, cx, cy + 8, [0.55, 0.42, 0.25, 0])
    const sensor = lvl.addCircleSensor(cx, cy + 28, 20)
    const use = lvl.addScript('UseTrigger', cx, cy + 56, [P.ids('Areas', [sensor.id]), P.int('Icon', ICON_SHOP)], { label: cat.title })
    // built lowest tier first: each higher tier's CheckFlag falls back
    // (OnFalse) to the chain below it, so the head checks the highest tier
    let next: Hw2Script | null = null
    for (const tier of unlocked) {
      const shop = lvl.addScript('ShopArea', cx + 32, cy + 56 + 48 * TIERS.indexOf(tier), [
        P.str('Shop', shopRef(cat.byTier[tier])),
        P.str('Title', cat.title),
        P.str('Description', cat.description),
        P.target('#Player', use.id, 'User')
      ])
      const flag = spec.tierFlags[tier]
      if (flag === null || flag === undefined) {
        next = shop
        continue
      }
      const check: Hw2Script = lvl.addScript('CheckFlag', cx - 32, cy + 56 + 48 * TIERS.indexOf(tier), [
        P.str('Flag', flag),
        P.ids('OnTrue', [shop.id]),
        ...(next !== null ? [P.ids('OnFalse', [next.id])] : [])
      ])
      next = check
    }
    // `next` is the chain head: the highest tier's check (or the only shop)
    if (next !== null) lvl.link(use, next)
  })

  // --- the well: refill potions ---------------------------------------------------
  const wellX = px(W / 2)
  const wellY = px(H / 2 - 2)
  lvl.addUnit(WELL, wellX, wellY)
  const wellSensor = lvl.addCircleSensor(wellX, wellY + 20, 28)
  const wellUse = lvl.addScript('UseTrigger', wellX + 48, wellY, [P.ids('Areas', [wellSensor.id]), P.int('Icon', ICON_GENERIC)], { label: 'refill potions' })
  const refill = lvl.addScript('PotionRefill', wellX + 48, wellY + 48, [P.int('State', 1), P.target('#PlayerTarget', wellUse.id, 'User')])
  lvl.link(wellUse, refill)
  addLight(lvl, wellX, wellY, [0.35, 0.4, 0.5, 0])

  // --- dungeon entrances along the south side ---------------------------------------
  const n = spec.bands.length
  spec.bands.forEach((band, i) => {
    const hx = Math.round(px(W / 2) + (i - (n - 1) / 2) * 96)
    const hy = px(H - 5)
    lvl.addUnit(HOLE, hx, hy, { start: { kind: 'string', value: 'hole_rope' } })
    addLight(lvl, hx, hy - 8, band.flag === null ? [0.5, 0.35, 0.2, 0] : [0.3, 0.3, 0.45, 0])
    const sensor = lvl.addCircleSensor(hx, hy, 12)
    const exit = lvl.addScript(
      'AllPlayersLevelExit',
      hx,
      hy + 48,
      [P.ids('Areas', [sensor.id]), P.str('Level', band.entry.level), P.str('StartID', band.entry.startId)],
      { enabled: band.flag === null, label: band.label }
    )
    // a hint on approach; sealed bands say so
    const near = lvl.addCircleSensor(hx, hy, 40)
    const approach = lvl.addScript('AreaTrigger', hx + 48, hy, [P.ids('Areas', [near.id])])
    const open = lvl.addScript('ShowFloatingText', hx, hy - 24, [P.str('Text', band.label), P.int('FloatingType', FLOAT_HINT)])
    if (band.flag === null) {
      lvl.link(approach, open)
      return
    }
    const sealed = lvl.addScript('ShowFloatingText', hx, hy - 24, [P.str('Text', band.sealedHint ?? `${band.label}: sealed`), P.int('FloatingType', FLOAT_HINT)])
    const hint = lvl.addScript('CheckFlag', hx + 96, hy, [P.str('Flag', band.flag), P.ids('OnTrue', [open.id]), P.ids('OnFalse', [sealed.id])])
    lvl.link(approach, hint)
    const enable = lvl.addScript('ToggleScripts', hx - 48, hy + 96, [P.int('State', 1), P.ids('Scripts', [exit.id])])
    const unlock = lvl.addScript('CheckFlag', hx - 96, hy + 96, [P.str('Flag', band.flag), P.ids('OnTrue', [enable.id])])
    lvl.link(entered, unlock)
  })

  // --- wall ring (ids last: nothing references a wall) ------------------------------
  const grid = { width: W, height: H, solid: () => false, reserved: () => false }
  for (const w of placeWalls(grid, wallSet, (p) => HW2_UNIT_SET.has(p))) lvl.addUnit(w.path, w.x, w.y)
  return lvl
}

function addLight(lvl: Hw2Level, x: number, y: number, color: [number, number, number, number]): Hw2Unit {
  const state: Record<string, StateValue> = {
    'cast-shadows': { kind: 'int', value: 0 },
    size: { kind: 'float', value: 200 },
    color: { kind: 'vec4', value: color },
    overlay: { kind: 'bool', value: false },
    overbright: { kind: 'float', value: 1 }
  }
  return lvl.addUnit(LIGHT, x, y, state)
}
