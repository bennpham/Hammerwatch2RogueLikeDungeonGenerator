import { planCampaign } from './campaign'
import type { CampaignPlan } from './campaign'
import { checkScenario } from './check'
import type { LevelFile } from './check'
import { validateParameters } from './config/parameters'
import type { ScenarioParameters } from './config/parameters'
import { buildRandomCaveFloor } from './floors/randomCaveFloor'
import { renderLevel } from './hw2/levelWriter'
import { scenarioLogoBase64 } from './hw2/logo'
import { renderInfoXml } from './hw2/scenario'
import { buildTown } from './town/buildTown'

export type { ScenarioParameters } from './config/parameters'
export { DEFAULT_PARAMETERS, validateParameters } from './config/parameters'
export { parseParametersTxt, serializeParametersTxt } from './config/configFile'
export { FLOOR_THEMES, TIERS } from './catalog/depth'

/** A file of the scenario folder, scenario-relative. Binary files arrive base64. */
export interface GeneratedFile {
  path: string
  content: string
  encoding?: 'utf-8' | 'base64'
}

export interface FloorSummary {
  depth: number
  band: number
  tier: string
  theme: string
  roomSet: string
  size: string
  race: string
}

export type GenerateResult =
  | { ok: true; scenarioId: string; seed: number; files: GeneratedFile[]; floors: FloorSummary[] }
  | { ok: false; errors: string[] }

export function scenarioIdFor(seed: number): string {
  return `rl_${seed}`
}

/**
 * Generate a whole scenario. Pure and deterministic: the same parameters and
 * seed give byte-identical files. With no seed one is drawn.
 */
export function generateScenario(params: ScenarioParameters, seed?: number): GenerateResult {
  const valid = validateParameters(params)
  if (!valid.ok) return valid
  const s = seed ?? Math.floor(Math.random() * 2 ** 31)
  if (!Number.isInteger(s) || s < 0) return { ok: false, errors: [`seed must be a non-negative whole number (got ${s})`] }

  const scenarioId = scenarioIdFor(s)
  const plan: CampaignPlan = planCampaign(params, scenarioId, s)
  const levels: LevelFile[] = [
    { path: plan.townPath, level: buildTown(plan.town) },
    ...plan.floors.map((f) => ({ path: f.path, level: buildRandomCaveFloor(f.spec) }))
  ]
  // a structural problem is a generator bug, not a user error — refuse to ship it
  const problems = checkScenario(levels)
  if (problems.length > 0) return { ok: false, errors: problems.map((p) => `internal: ${p}`) }

  const floors: FloorSummary[] = plan.floors.map((f) => ({
    depth: f.depth,
    band: f.band,
    tier: f.spec.tier,
    theme: f.spec.theme.id,
    roomSet: f.spec.roomSet,
    size: f.spec.size,
    race: f.spec.race
  }))
  const bands = plan.town.bands.length
  const files: GeneratedFile[] = [
    {
      path: 'info.xml',
      content: renderInfoXml({
        name: `${params.name} #${s}`,
        description:
          `${params.floors} random floors in ${bands} band${bands === 1 ? '' : 's'} of ${params.floorsPerBand}, ` +
          `${plan.town.bands[0].tier} to ${plan.town.bands[bands - 1].tier}. Seed ${s}.`,
        starts: [
          { name: 'Town', level: plan.townPath },
          { name: 'Depth 1 (straight into the dungeon)', level: plan.floors[0].path }
        ],
        persistentCharacters: params.persistentCharacters,
        maxPlayers: params.maxPlayers
      })
    },
    { path: 'logos.png', content: scenarioLogoBase64(s), encoding: 'base64' },
    ...levels.map((l) => ({ path: l.path, content: renderLevel(l.level) }))
  ]
  return { ok: true, scenarioId, seed: s, files, floors }
}
