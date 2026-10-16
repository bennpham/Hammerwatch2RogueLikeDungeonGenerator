import {
  HW2_ENEMY_RACES,
  HW2_ENVIRONMENTS,
  HW2_LIGHTS,
  HW2_PREFABS,
  HW2_REGIONS,
  HW2_SHOPS,
  HW2_TILESET_SIZES,
  HW2_UNITS
} from './hw2Assets.generated'

/** Every unit path the snapshot knows, for O(1) existence checks. */
export const HW2_UNIT_SET: ReadonlySet<string> = new Set(HW2_UNITS)

const PREFAB_SET: ReadonlySet<string> = new Set(HW2_PREFABS)
const ENV_SET: ReadonlySet<string> = new Set(HW2_ENVIRONMENTS)
const LIGHT_SET: ReadonlySet<string> = new Set(HW2_LIGHTS)

/** Tile size in px of a tileset (16 when the snapshot does not know it). */
export function tilesetSize(tileset: string): number {
  return HW2_TILESET_SIZES[tileset] ?? 16
}

/**
 * Whether an asset path the generator emits exists in the installed game, per
 * the snapshot (`scripts/scan-hw2-assets.mjs`). Pseudo-units (`:Physics_*`) are
 * engine built-ins and always exist; lights are `.png` units.
 */
export function hw2AssetExists(path: string): boolean {
  if (path.startsWith(':')) return true
  if (path.endsWith('.tileset')) return path in HW2_TILESET_SIZES
  if (path.endsWith('.env')) return ENV_SET.has(path)
  if (path.endsWith('.pfb')) return PREFAB_SET.has(path)
  if (path.endsWith('.png')) return LIGHT_SET.has(path)
  return HW2_UNIT_SET.has(path)
}

export function shopExists(id: string): boolean {
  return id in HW2_SHOPS
}

export function regionExists(id: string): boolean {
  return id in HW2_REGIONS
}

export function raceExists(id: string): boolean {
  return id in HW2_ENEMY_RACES
}

/** `ShopArea.Shop` value for a stock shop id. */
export function shopRef(id: string): string {
  return `tweak/shop/shops.sval:${id}`
}
