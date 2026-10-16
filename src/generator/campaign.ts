import { Rand } from './core/rand'
import { floorTheme, roomCaller, sizeForBandPosition, themeSizes, tierForBand } from './catalog/depth'
import type { FloorTheme, RoomSize, Tier } from './catalog/depth'
import { racePool } from './config/parameters'
import type { ScenarioParameters } from './config/parameters'
import { START_FROM_ABOVE, START_FROM_BELOW } from './floors/randomCaveFloor'
import type { ExitTarget, FloorSpec } from './floors/randomCaveFloor'
import { TOWN_RETURN_START } from './town/buildTown'
import type { TownBand, TownSpec } from './town/buildTown'

/**
 * The campaign's shape — which floor leads where — decided before any level
 * is built. Pure function of (params, seed).
 *
 *   town ──band 0 entrance──▶ F1 ⇄ F2 ⇄ F3 ──(band end)──▶ town
 *   town ──band 1 entrance──▶ F4 ⇄ F5 ⇄ F6 ──▶ town …
 *
 * - A floor's deeper (secondary) exit leads to the next floor's
 *   `random-instance`; the last floor of a band, and the final floor, lead
 *   home to `town-return` instead.
 * - A floor's arrival exits lead back up to the previous floor's
 *   `random_secondary-instance`; on a band's first floor, home.
 * - Reaching a band's last floor sets the NEXT band's Run flag, which opens
 *   that band's town entrance and the next tier's shop stock.
 */

export interface CampaignFloor {
  depth: number
  band: number
  path: string
  spec: FloorSpec
}

export interface CampaignPlan {
  scenarioId: string
  townPath: string
  town: TownSpec
  floors: CampaignFloor[]
}

export function levelDir(scenarioId: string): string {
  return `levels/${scenarioId}`
}

export function floorPath(scenarioId: string, depth: number): string {
  return `${levelDir(scenarioId)}/floor_${String(depth).padStart(2, '0')}.lvl`
}

export function bandFlag(scenarioId: string, band: number): string {
  return `${scenarioId}_band_${band}`
}

function pick<T>(rand: Rand, xs: readonly T[]): T {
  return xs[rand.nextInt(xs.length)]
}

export function planCampaign(params: ScenarioParameters, scenarioId: string, seed: number): CampaignPlan {
  const rand = new Rand(seed)
  const townPath = `${levelDir(scenarioId)}/town.lvl`
  const home: ExitTarget = { level: townPath, startId: TOWN_RETURN_START }
  const per = params.floorsPerBand
  const bandCount = Math.ceil(params.floors / per)

  const floors: CampaignFloor[] = []
  const bands: TownBand[] = []
  const tierFlags: Partial<Record<Tier, string | null>> = {}
  let lastTheme: string | null = null

  for (let b = 0; b < bandCount; b++) {
    const tier = tierForBand(b, params.startTier)
    const first = b * per + 1
    const len = Math.min(per, params.floors - b * per)
    const flag = b === 0 ? null : bandFlag(scenarioId, b)
    if (!(tier in tierFlags)) tierFlags[tier] = flag

    // a different look per band when there is a choice
    const choices = params.themes.length > 1 ? params.themes.filter((t) => t !== lastTheme) : params.themes
    const theme: FloorTheme = floorTheme(pick(rand, choices))!
    lastTheme = theme.id

    bands.push({
      index: b,
      tier,
      label: `Depth ${first} (${tier})`,
      flag,
      sealedHint: flag === null ? undefined : `Sealed: reach depth ${first - 1} to open the way to depth ${first}`,
      entry: { level: floorPath(scenarioId, first), startId: START_FROM_ABOVE }
    })

    for (let pos = 0; pos < len; pos++) {
      const depth = first + pos
      const size: RoomSize = sizeForBandPosition(pos, len, themeSizes(theme))
      const sets = theme.roomSets.filter((s) => roomCaller(s, size) !== undefined)
      const bandEnd = pos === len - 1
      const final = depth === params.floors
      const spec: FloorSpec = {
        depth,
        theme,
        roomSet: pick(rand, sets),
        size,
        tier,
        race: pick(rand, racePool(params, tier)),
        lootChance: bandEnd ? 1 : params.lootChance,
        up: pos === 0 ? home : { level: floorPath(scenarioId, depth - 1), startId: START_FROM_BELOW },
        down: bandEnd ? home : { level: floorPath(scenarioId, depth + 1), startId: START_FROM_ABOVE },
        announce: {
          text: final ? `${capitalize(tier)} · ${theme.label} · the final depth` : `${capitalize(tier)} · ${theme.label}`
        }
      }
      if (bandEnd && !final) spec.setFlags = [bandFlag(scenarioId, b + 1)]
      floors.push({ depth, band: b, path: floorPath(scenarioId, depth), spec })
    }
  }

  return { scenarioId, townPath, town: { bands, tierFlags }, floors }
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1)
}
