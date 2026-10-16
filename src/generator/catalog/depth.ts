import { HW2_ENEMY_RACES, HW2_RANDOM_ROOMS } from './hw2Assets.generated'

/**
 * Depth progression: what each dungeon floor is made of.
 *
 * Hammerwatch 2 enemies have FIXED stats per unit and a fixed tier
 * (apprentice → master); the player's XP from an enemy shrinks once they
 * out-level its tier. So "harder floors" means picking races of a higher tier,
 * and announcing that tier to the level (`GlobalEvent tier_<tier>`, which the
 * stock loot/chest prefabs listen to). [VERIFIED] every stock random cave fires
 * one `tier_*` and one `theme_*` event.
 */

export const TIERS = ['apprentice', 'adept', 'expert', 'master'] as const
export type Tier = (typeof TIERS)[number]

export type RoomSize = 'small' | 'medium' | 'large'

/**
 * A floor look: the `theme_*` event that re-skins the room pieces, the room
 * sets (`levels/_random/<set>/`) it may draw from, and the level's region and
 * lighting. Only pairings the stock campaign uses are listed:
 *
 * - `theme_cave_light` with cave_light rooms (fallowfields, lockdey, hammer_island caves)
 * - `theme_cave_dark` with cave_dark and cave_light rooms (blackbarrow, mistdeep)
 * - `theme_prison` with prison rooms (hammer_island/prison_2, region `prison2`)
 */
export interface FloorTheme {
  id: string
  label: string
  themeEvent: string
  roomSets: string[]
  region: string
  environment: string
}

export const FLOOR_THEMES: readonly FloorTheme[] = [
  {
    id: 'cave_light',
    label: 'Light cave',
    themeEvent: 'theme_cave_light',
    roomSets: ['cave_light'],
    region: 'level_mysterious',
    environment: 'effects/env/grotto.env'
  },
  {
    id: 'cave_dark',
    label: 'Dark cave',
    themeEvent: 'theme_cave_dark',
    roomSets: ['cave_dark', 'cave_light'],
    region: 'level_mysterious',
    environment: 'effects/env/grotto.env'
  },
  {
    id: 'prison',
    label: 'Prison',
    themeEvent: 'theme_prison',
    roomSets: ['prison'],
    region: 'prison2',
    environment: 'effects/env/grotto.env'
  }
]

export function floorTheme(id: string): FloorTheme | undefined {
  return FLOOR_THEMES.find((t) => t.id === id)
}

/** The room caller for a set and size, or undefined when the set has no rooms of that size. */
export function roomCaller(set: string, size: RoomSize): string | undefined {
  return HW2_RANDOM_ROOMS[set]?.[size]?.caller
}

/** Sizes a theme can produce (the union over its room sets). */
export function themeSizes(theme: FloorTheme): RoomSize[] {
  const out: RoomSize[] = []
  for (const size of ['small', 'medium', 'large'] as const) {
    if (theme.roomSets.some((s) => roomCaller(s, size) !== undefined)) out.push(size)
  }
  return out
}

/**
 * Races per tier, from the scanned schemes (a race's tier is the lowest tier
 * among its units; elites ride along). Every race has `few/several/pack/lots`
 * schemes, which is what random rooms' `EnemyPlacement` nodes ask for.
 */
export function racesForTier(tier: Tier): string[] {
  return Object.keys(HW2_ENEMY_RACES)
    .filter((r) => HW2_ENEMY_RACES[r].tier === tier)
    .sort()
}

export function raceTier(race: string): Tier | null {
  const t = HW2_ENEMY_RACES[race]?.tier
  return (TIERS as readonly string[]).includes(t ?? '') ? (t as Tier) : null
}

/** The tier of a band: one tier step per band from `startTier`, capped at master. */
export function tierForBand(band: number, startTier: Tier): Tier {
  const i = Math.min(TIERS.indexOf(startTier) + band, TIERS.length - 1)
  return TIERS[i]
}

/** Room size for a floor's position within its band: grows small → large. */
export function sizeForBandPosition(pos: number, bandSize: number, available: RoomSize[]): RoomSize {
  if (available.length === 1) return available[0]
  const t = bandSize <= 1 ? 1 : pos / (bandSize - 1)
  return available[Math.min(available.length - 1, Math.floor(t * available.length))]
}
