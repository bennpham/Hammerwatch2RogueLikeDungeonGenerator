// Generate a scenario without the app:
//   npm run gen -- [--seed N] [--floors N] [--per-band N] [--no-persist]
//                  [--params parameters.txt] [--out DIR] [--install [--hw2 DIR] [--keep-source]]
// Writes the unpacked scenario folder to DIR (default ./out-scenarios/<id>);
// --install instead packs it into <HW2>/scenarios/<id>.hsc with PACKAGER.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { DEFAULT_PARAMETERS, generateScenario, parseParametersTxt } from '../../src/generator'
import type { ScenarioParameters } from '../../src/generator'
import { findHw2Install, installScenario } from '../../src/main/packer'

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
if (args.includes('--install')) {
  const hw2 = opt('hw2') ?? findHw2Install()
  if (hw2 === null) {
    console.error('Hammerwatch 2 not found; pass --hw2 <folder>')
    process.exit(1)
  }
  const r = await installScenario(hw2, result.scenarioId, result.files, args.includes('--keep-source'))
  console.log(r.message)
  if (!r.ok) process.exit(1)
} else {
  const out = resolve(opt('out') ?? join('out-scenarios', result.scenarioId))
  for (const f of result.files) {
    const p = join(out, f.path)
    mkdirSync(dirname(p), { recursive: true })
    writeFileSync(p, f.encoding === 'base64' ? Buffer.from(f.content, 'base64') : f.content)
  }
  console.log(`${result.scenarioId} (seed ${result.seed}) → ${out}`)
}
for (const f of result.floors) {
  console.log(`  depth ${String(f.depth).padStart(2)}  band ${f.band}  ${f.tier.padEnd(10)} ${f.theme.padEnd(10)} ${f.roomSet}/${f.size.padEnd(6)} ${f.race}`)
}
