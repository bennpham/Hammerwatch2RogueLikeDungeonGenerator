// Generate a scenario without the app:
//   npm run gen -- [--seed N] [--floors N] [--per-band N] [--no-persist]
//                  [--params parameters.txt] [--out DIR]
// Writes the unpacked scenario folder to DIR (default ./out-scenarios/<id>).
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { DEFAULT_PARAMETERS, generateScenario, parseParametersTxt } from '../../src/generator'
import type { ScenarioParameters } from '../../src/generator'

const args = process.argv.slice(2)
const opt = (name: string): string | undefined => {
  const i = args.indexOf(`--${name}`)
  return i >= 0 ? args[i + 1] : undefined
}

let params: ScenarioParameters = { ...DEFAULT_PARAMETERS }
const paramsFile = opt('params')
if (paramsFile !== undefined) {
  const parsed = parseParametersTxt(readFileSync(paramsFile, 'utf-8'))
  for (const w of parsed.warnings) console.warn(`${paramsFile}: ${w}`)
  params = parsed.params
}
if (opt('floors') !== undefined) params.floors = Number(opt('floors'))
if (opt('per-band') !== undefined) params.floorsPerBand = Number(opt('per-band'))
if (args.includes('--no-persist')) params.persistentCharacters = false
const seed = opt('seed') === undefined ? undefined : Number(opt('seed'))

const result = generateScenario(params, seed)
if (!result.ok) {
  for (const e of result.errors) console.error(e)
  process.exit(1)
}
const out = resolve(opt('out') ?? join('out-scenarios', result.scenarioId))
for (const f of result.files) {
  const p = join(out, f.path)
  mkdirSync(dirname(p), { recursive: true })
  writeFileSync(p, f.encoding === 'base64' ? Buffer.from(f.content, 'base64') : f.content)
}
console.log(`${result.scenarioId} (seed ${result.seed}) → ${out}`)
for (const f of result.floors) {
  console.log(`  depth ${String(f.depth).padStart(2)}  band ${f.band}  ${f.tier.padEnd(10)} ${f.theme.padEnd(10)} ${f.roomSet}/${f.size.padEnd(6)} ${f.race}`)
}
