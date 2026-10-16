import { DEFAULT_PARAMETERS } from './parameters'
import type { ScenarioParameters } from './parameters'
import { TIERS } from '../catalog/depth'
import type { Tier } from '../catalog/depth'

/**
 * `parameters.txt`: one `key=value` per line, `#` comments, unknown keys
 * reported rather than fatal. Lists are comma-separated.
 *
 *   name=Rogue-Like Depths
 *   floors=12
 *   floorsPerBand=3
 *   startTier=apprentice
 *   themes=cave_light,cave_dark,prison
 *   races.adept=wolf_black,boar
 *   lootChance=0.75
 *   persistentCharacters=true
 *   maxPlayers=4
 */

export interface ParseResult {
  params: ScenarioParameters
  warnings: string[]
}

const list = (v: string): string[] =>
  v
    .split(',')
    .map((s) => s.trim())
    .filter((s) => s !== '')

export function parseParametersTxt(text: string, base: ScenarioParameters = DEFAULT_PARAMETERS): ParseResult {
  const params: ScenarioParameters = { ...base, themes: [...base.themes], races: { ...base.races } }
  const warnings: string[] = []
  text.split(/\r?\n/).forEach((raw, i) => {
    const line = raw.replace(/#.*$/, '').trim()
    if (line === '') return
    const eq = line.indexOf('=')
    if (eq < 0) {
      warnings.push(`line ${i + 1}: expected key=value`)
      return
    }
    const key = line.slice(0, eq).trim()
    const value = line.slice(eq + 1).trim()
    const num = Number(value)
    switch (key) {
      case 'name':
        params.name = value
        break
      case 'floors':
      case 'floorsPerBand':
      case 'maxPlayers':
      case 'lootChance':
        if (Number.isNaN(num)) warnings.push(`line ${i + 1}: ${key} is not a number`)
        else params[key] = num
        break
      case 'startTier':
        if ((TIERS as readonly string[]).includes(value)) params.startTier = value as Tier
        else warnings.push(`line ${i + 1}: unknown tier "${value}"`)
        break
      case 'themes':
        params.themes = list(value)
        break
      case 'persistentCharacters':
        params.persistentCharacters = /^(1|true|yes|on)$/i.test(value)
        break
      default: {
        const m = /^races\.(\w+)$/.exec(key)
        if (m !== null && (TIERS as readonly string[]).includes(m[1])) params.races[m[1] as Tier] = list(value)
        else warnings.push(`line ${i + 1}: unknown key "${key}"`)
      }
    }
  })
  return { params, warnings }
}

export function serializeParametersTxt(p: ScenarioParameters): string {
  const lines = [
    '# Hammerwatch 2 Rogue-Like Dungeon Generator parameters',
    `name=${p.name}`,
    `floors=${p.floors}`,
    `floorsPerBand=${p.floorsPerBand}`,
    `startTier=${p.startTier}`,
    `themes=${p.themes.join(',')}`,
    ...TIERS.map((t) => `races.${t}=${(p.races[t] ?? []).join(',')}`),
    `lootChance=${p.lootChance}`,
    `persistentCharacters=${p.persistentCharacters}`,
    `maxPlayers=${p.maxPlayers}`
  ]
  return lines.join('\n') + '\n'
}
