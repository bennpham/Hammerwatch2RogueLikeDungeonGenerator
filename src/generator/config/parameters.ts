import { FLOOR_THEMES, TIERS, racesForTier } from '../catalog/depth'
import type { Tier } from '../catalog/depth'
import { raceExists } from '../catalog/assets'

/**
 * Everything a user can set. `parameters.txt` (config/configFile.ts) and the
 * app's form both map onto this; `validateParameters` is the single gate.
 */
export interface ScenarioParameters {
  /** shown in the scenario list */
  name: string
  /** total dungeon floors */
  floors: number
  /** floors per band: each band is one tier step, and its last floor leads back to town */
  floorsPerBand: number
  /** tier of band 0 */
  startTier: Tier
  /** floor themes to draw from (`catalog/depth.ts` FLOOR_THEMES ids), one per band */
  themes: string[]
  /** enemy races per tier; a tier left empty uses every scanned race of that tier */
  races: Record<Tier, string[]>
  /** chance a floor's reward and secret spots fire (stock 0.75); band-end floors always fire */
  lootChance: number
  /** force PERSISTENT_CHARS: play (and farm) the official ARPG's characters */
  persistentCharacters: boolean
  /**
   * `<players max>` in info.xml; the lobby enforces it (LobbyMenu.as) and no
   * script caps it. Official campaign: 4; mods ship 6 (Tranquility Shores)
   * and 16 (the developers' example_scenario).
   */
  maxPlayers: number
}

export const DEFAULT_PARAMETERS: ScenarioParameters = {
  name: 'Rogue-Like Depths',
  floors: 12,
  floorsPerBand: 3,
  startTier: 'apprentice',
  themes: FLOOR_THEMES.map((t) => t.id),
  races: {
    apprentice: [],
    adept: [],
    expert: [],
    master: []
  },
  lootChance: 0.75,
  persistentCharacters: true,
  maxPlayers: 4
}

export const LIMITS = {
  floors: [1, 60],
  floorsPerBand: [1, 10],
  maxPlayers: [1, 16]
} as const

export type ValidationResult = { ok: true } | { ok: false; errors: string[] }

/** Races for a tier after the user's override. */
export function racePool(params: ScenarioParameters, tier: Tier): string[] {
  const chosen = params.races[tier] ?? []
  return chosen.length > 0 ? chosen : racesForTier(tier)
}

export function validateParameters(p: ScenarioParameters): ValidationResult {
  const errors: string[] = []
  const intIn = (name: keyof typeof LIMITS, v: number): void => {
    const [lo, hi] = LIMITS[name]
    if (!Number.isInteger(v) || v < lo || v > hi) errors.push(`${name} must be a whole number from ${lo} to ${hi} (got ${v})`)
  }
  if (p.name.trim() === '') errors.push('name must not be empty')
  intIn('floors', p.floors)
  intIn('floorsPerBand', p.floorsPerBand)
  intIn('maxPlayers', p.maxPlayers)
  if (!TIERS.includes(p.startTier)) errors.push(`startTier must be one of ${TIERS.join(', ')}`)
  if (p.themes.length === 0) errors.push('pick at least one floor theme')
  for (const t of p.themes) if (!FLOOR_THEMES.some((f) => f.id === t)) errors.push(`unknown floor theme "${t}"`)
  for (const tier of TIERS) {
    for (const r of p.races[tier] ?? []) if (!raceExists(r)) errors.push(`unknown enemy race "${r}" (${tier})`)
    if (racePool(p, tier).length === 0) errors.push(`no enemy races for tier ${tier}`)
  }
  if (!(p.lootChance >= 0 && p.lootChance <= 1)) errors.push('lootChance must be between 0 and 1')
  return errors.length === 0 ? { ok: true } : { ok: false, errors }
}
