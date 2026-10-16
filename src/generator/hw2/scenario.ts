import { escapeXml } from './sval'

/**
 * Scenario metadata: `info.xml`, which PACKAGER.exe compiles into the `.hsc`
 * header (it logs "serialized scenario info as info.sval"), so the generator
 * must NOT write an `info.sval` of its own. [VERIFIED 2026-10-16, PACKAGER -l]
 *
 * Modifiers ("switches" in the lobby):
 * - `PERSISTENT_CHARS`, forced, when persistence is on: every
 *   `%if MOD_PERSISTENT_CHARS` in the stock scripts turns on, and
 *   HW2GameMode points the character store at pool 1000000 — the one the
 *   official ARPG uses — so existing characters can be played (checklist P1).
 *   Off, characters live in this scenario's own save.
 * - the four stock difficulty switches, exactly as Tranquility Shores ships
 *   them (their names are base-game language keys).
 *
 * Hammerwatch 2 has no lives system, so there is nothing to force there.
 */

export interface ModifierDef {
  id: string
  name?: string
  tooltip?: string
  forced?: boolean
}

export const STOCK_SWITCHES: readonly ModifierDef[] = [
  { name: '.menu.switches.limited_regen.name', id: 'NO_HP_REGEN', tooltip: '.menu.switches.limited_regen.desc' },
  { name: '.menu.switches.extra_regen.name', id: 'EXTRA_REGEN', tooltip: '.menu.switches.extra_regen.desc' },
  { name: '.menu.switches.extra_damage.name', id: 'EXTRA_DAMAGE', tooltip: '.menu.switches.extra_damage.desc' },
  { name: '.menu.switches.equipment_loss.name', id: 'EQUIPMENT_LOSS', tooltip: '.menu.switches.equipment_loss.desc' }
]

export const PERSISTENT_CHARS: ModifierDef = { id: 'PERSISTENT_CHARS', forced: true }

export interface ScenarioInfo {
  name: string
  description: string
  /** scenario-relative path of the level a new game opens */
  startLevel: string
  startName: string
  persistentCharacters: boolean
  minPlayers?: number
  maxPlayers?: number
}

export const DEFAULT_MAX_PLAYERS = 4

export function renderInfoXml(info: ScenarioInfo): string {
  const lines = [
    '<info>',
    `\t<name>${escapeXml(info.name)}</name>`,
    '\t<tag>Rogue-like</tag>',
    `\t<description>${escapeXml(info.description)}</description>`,
    '',
    `\t<players min="${info.minPlayers ?? 1}" max="${info.maxPlayers ?? DEFAULT_MAX_PLAYERS}" />`,
    '\t<saving>all</saving>',
    '',
    '\t<start>',
    `\t\t<level name="${escapeXml(info.startName)}" lvl="${escapeXml(info.startLevel)}" />`,
    '\t</start>',
    '',
    '\t<modifiers>'
  ]
  const mods = info.persistentCharacters ? [PERSISTENT_CHARS, ...STOCK_SWITCHES] : STOCK_SWITCHES
  for (const m of mods) {
    let attrs = ''
    if (m.forced === true) attrs += ' forced="true"'
    if (m.name !== undefined) attrs += ` name="${escapeXml(m.name)}"`
    attrs += ` id="${m.id}"`
    if (m.tooltip !== undefined) attrs += ` tooltip="${escapeXml(m.tooltip)}"`
    lines.push(`\t\t<modifier${attrs} />`)
  }
  lines.push('\t</modifiers>', '</info>', '')
  return lines.join('\n')
}

/**
 * A scenario id safe for a folder name, a PACKAGER argument and the shared
 * `levels/<id>/` namespace (level paths are global across every scenario and
 * the base game, so each scenario keeps its levels under its own folder).
 */
export function scenarioSlug(name: string): string {
  const s = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
  return s === '' ? 'scenario' : s
}
