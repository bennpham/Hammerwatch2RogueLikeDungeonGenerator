/**
 * In-memory Hammerwatch 2 level (or prefab), filled by the generator and
 * serialised by `levelWriter.ts`. Ported from the AE generator's `ae/model.ts`.
 *
 * Every id in a level — unit or script — comes from ONE counter
 * (`Hw2Level.newId`): the game resolves a script's `Areas`, `Units`, `#Scripts`…
 * arrays against units and scripts alike, so the two must never collide.
 *
 * Coordinates are pixels; generator grids work in 16-px tiles and multiply by
 * `TILE` at the boundary.
 */

/** Pixels per generator tile. */
export const TILE = 16

/** One typed value in a unit's per-instance state dict. */
export type StateValue =
  | { kind: 'bool'; value: boolean }
  | { kind: 'int'; value: number }
  | { kind: 'float'; value: number }
  | { kind: 'string'; value: string }
  | { kind: 'vec2'; value: [number, number] }
  /** light colours (`effects/lights/*.png` units) */
  | { kind: 'vec4'; value: [number, number, number, number] }

/**
 * The level's `game-mode` dict. `Class` is the game mode script class
 * (`DungeonGameMode` indoors with line of sight, `WorldGameMode` outdoors);
 * `DefaultRegion` an id from `tweak/regions.sval` (music, ambience, tier,
 * weather tags). [VERIFIED] against the stock campaign levels.
 */
export interface GameModeDef {
  cls: string
  defaultRegion?: string
  allowSave?: boolean
}

/**
 * One named value in a script's parameter dict.
 *
 * - `ids`: an array of unit/script ids (`Areas`, `Units`, `Doors`, `OnTrue`…)
 * - `target`: a feed from another script's output, `[script id, event]`
 *   (`#PlayerTarget` = `[useTriggerId, "User"]`)
 * - `sources`: several such feeds, `[[id, source], …]` (`#Units` from a
 *   SpawnUnit's `AllSpawned`)
 * - `strings`: an array of strings
 */
export type Param =
  | { kind: 'string'; name: string; value: string }
  | { kind: 'int'; name: string; value: number }
  | { kind: 'float'; name: string; value: number }
  | { kind: 'bool'; name: string; value: boolean }
  | { kind: 'ids'; name: string; value: number[] }
  | { kind: 'target'; name: string; value: [number, string] }
  | { kind: 'sources'; name: string; value: Array<[number, string]> }
  | { kind: 'strings'; name: string; value: string[] }

export interface Hw2Unit {
  /** asset path, e.g. `doodads/walls/prison/h_32.unit`, or `:Physics_Rectangle` */
  path: string
  x: number
  y: number
  id: number
  /** per-instance settings (layer, start scene, physics size…) */
  state?: Record<string, StateValue>
}

export interface Hw2Script {
  /** WorldScript class, e.g. `UseTrigger`, `LevelExit` */
  cls: string
  id: number
  x: number
  y: number
  enabled: boolean
  /** -1 = unlimited */
  triggerTimes: number
  executeOnStart: boolean
  /** optional editor comment; also what a template's slot lookup keys on */
  label?: string
  params: Param[]
  /** scripts this one fires when it runs: `[target id, delay ms]` */
  connections: Array<[number, number]>
}

/**
 * A unit the editor saves without an id, under the level's `statics` section
 * (props and pickups placed by hand that no script names): its path, its
 * position and optionally a state dict (e.g. `layer`).
 */
export interface Hw2Static {
  path: string
  x: number
  y: number
  state?: Record<string, StateValue>
}

export interface Hw2Prefab {
  path: string
  x: number
  y: number
}

/** One 512-px tile cell: `pos` is its centre, datasets bottom layer first. */
export interface Hw2TileCell {
  x: number
  y: number
  datasets: Array<{ tileset: string; rle: string }>
}

export class Hw2Level {
  /** null for a prefab, which carries no game-mode dict */
  gameMode: GameModeDef | null = { cls: 'DungeonGameMode' }
  environment: string | null
  tileCells: Hw2TileCell[] = []
  units: Hw2Unit[] = []
  scripts: Hw2Script[] = []
  prefabs: Hw2Prefab[] = []
  /** id-less units (the `statics` section); written back as they were read */
  statics: Hw2Static[] = []
  private nextId: number

  constructor(environment: string | null, firstId = 1) {
    this.environment = environment
    this.nextId = firstId
  }

  newId(): number {
    return this.nextId++
  }

  /** the id the next `newId()` will return — for tests and id-budget checks */
  peekId(): number {
    return this.nextId
  }

  addUnit(path: string, x: number, y: number, state?: Record<string, StateValue>): Hw2Unit {
    const u: Hw2Unit = { path, x, y, id: this.newId() }
    if (state !== undefined && Object.keys(state).length > 0) u.state = state
    this.units.push(u)
    return u
  }

  addScript(
    cls: string,
    x: number,
    y: number,
    params: Param[] = [],
    opts: Partial<Pick<Hw2Script, 'enabled' | 'triggerTimes' | 'executeOnStart' | 'label'>> = {}
  ): Hw2Script {
    const s: Hw2Script = {
      cls,
      id: this.newId(),
      x,
      y,
      enabled: opts.enabled ?? true,
      triggerTimes: opts.triggerTimes ?? -1,
      executeOnStart: opts.executeOnStart ?? false,
      params,
      connections: []
    }
    if (opts.label !== undefined) s.label = opts.label
    this.scripts.push(s)
    return s
  }

  /** `from` fires `to` after `delayMs` */
  link(from: Hw2Script, to: Hw2Script | number, delayMs = 0): void {
    from.connections.push([typeof to === 'number' ? to : to.id, delayMs])
  }

  /**
   * A sensor shape for triggers (`Areas`). Rectangles are anchored at their
   * centre, which is how the stock exit sensors sit on their doors (`randomcave_exit_setup.pfb`).
   */
  addRectSensor(cx: number, cy: number, w: number, h: number): Hw2Unit {
    return this.addUnit(':Physics_Rectangle', cx, cy, {
      ...sensorFlags(),
      size: { kind: 'vec2', value: [w, h] }
    })
  }

  addCircleSensor(cx: number, cy: number, radius: number): Hw2Unit {
    return this.addUnit(':Physics_Circle', cx, cy, {
      ...sensorFlags(),
      radius: { kind: 'float', value: radius }
    })
  }

  scriptById(id: number): Hw2Script | undefined {
    return this.scripts.find((s) => s.id === id)
  }
}

function sensorFlags(): Record<string, StateValue> {
  return {
    active: { kind: 'bool', value: true },
    'jam-through': { kind: 'bool', value: true },
    sensor: { kind: 'bool', value: true },
    'shot-through': { kind: 'bool', value: true },
    'aim-through': { kind: 'bool', value: true }
  }
}

// Param shorthands — keep call sites readable.
export const P = {
  str: (name: string, value: string): Param => ({ kind: 'string', name, value }),
  int: (name: string, value: number): Param => ({ kind: 'int', name, value }),
  float: (name: string, value: number): Param => ({ kind: 'float', name, value }),
  bool: (name: string, value: boolean): Param => ({ kind: 'bool', name, value }),
  ids: (name: string, value: number[]): Param => ({ kind: 'ids', name, value }),
  target: (name: string, id: number, event: string): Param => ({ kind: 'target', name, value: [id, event] }),
  sources: (name: string, value: Array<[number, string]>): Param => ({ kind: 'sources', name, value }),
  strings: (name: string, value: string[]): Param => ({ kind: 'strings', name, value })
}
