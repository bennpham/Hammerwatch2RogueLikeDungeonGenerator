#!/usr/bin/env node
// Snapshot the Hammerwatch 2 asset data the generator may emit or choose from,
// so tests and the validator can prove every path a generated level references
// exists in the game — without the game installed.
//
//   node scripts/scan-hw2-assets.mjs            # rewrite src/generator/catalog/hw2Assets.generated.ts
//   node scripts/scan-hw2-assets.mjs --check    # exit 1 if the snapshot is stale
//
// Reads `<HW2>/unpacked_assets_<build>/` (newest build); set HW2_ROOT to point
// at another install. Only paths and small facts are stored — never game data.
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const here = path.dirname(fileURLToPath(import.meta.url))
const outFile = path.join(here, '..', 'src', 'generator', 'catalog', 'hw2Assets.generated.ts')

function findInstall() {
  const candidates = [process.env.HW2_ROOT]
  for (const drive of 'CDEFGH') {
    for (const sub of ['Program Files (x86)/Steam', 'Program Files/Steam', 'SteamLibrary', 'Steam']) {
      candidates.push(`${drive}:/${sub}/steamapps/common/Hammerwatch 2`)
    }
  }
  for (const dir of candidates) {
    if (!dir || !fs.existsSync(path.join(dir, 'HW2.exe'))) continue
    const builds = fs
      .readdirSync(dir)
      .filter((d) => /^unpacked_assets_\d+$/.test(d))
      .sort((a, b) => Number(b.split('_').pop()) - Number(a.split('_').pop()))
    if (builds.length > 0) return path.join(dir, builds[0])
  }
  return null
}

const assets = findInstall()
if (!assets) {
  console.error('Hammerwatch 2 unpacked assets not found; set HW2_ROOT (run PACKAGER "Extract base resources" first)')
  process.exit(1)
}

function walk(rel, out = []) {
  const abs = path.join(assets, rel)
  if (!fs.existsSync(abs)) return out
  for (const e of fs.readdirSync(abs, { withFileTypes: true })) {
    const r = rel === '' ? e.name : `${rel}/${e.name}`
    if (e.isDirectory()) walk(r, out)
    else out.push(r)
  }
  return out
}
const read = (rel) => fs.readFileSync(path.join(assets, rel), 'utf8')
const exists = (rel) => fs.existsSync(path.join(assets, rel))
const sorted = (xs) => [...xs].sort()
const TIERS = ['apprentice', 'adept', 'expert', 'master']

// --- paths -----------------------------------------------------------------
const units = new Set()
for (const dir of ['actors', 'items', 'doodads', 'special', 'effects', 'prefabs', 'players']) {
  for (const f of walk(dir)) if (f.endsWith('.unit')) units.add(f)
}
const lights = walk('effects/lights').filter((f) => f.endsWith('.png'))
const tilesets = {}
for (const f of walk('tilesets')) {
  if (!f.endsWith('.tileset')) continue
  const m = /<tileset[^>]*\bsize="(\d+)"/.exec(read(f))
  tilesets[f] = m ? Number(m[1]) : 16
}
const envs = walk('effects').filter((f) => f.endsWith('.env'))
const prefabs = [...walk('prefabs'), ...walk('levels')].filter((f) => f.endsWith('.pfb'))

// --- enemy races (actors/enemies.sval schemes `<race>_<type>`) ---------------
// A unit's tier is a literal `<string name="tier">` in the unit or one of the
// files it %includes (one level deep is enough for every enemy unit).
function unitTier(rel) {
  if (!exists(rel)) return null
  const text = read(rel)
  const direct = /<string name="tier">(\w+)<\/string>/.exec(text)
  if (direct) return direct[1]
  for (const m of text.matchAll(/%include "([^"]+)"/g)) {
    if (!exists(m[1])) continue
    const t = /<string name="tier">(\w+)<\/string>/.exec(read(m[1]))
    if (t) return t[1]
  }
  return null
}
const SCHEME_TYPES = ['few', 'several', 'pack', 'lots', 'superior']
const races = {}
const enemyIncludes = [...read('actors/enemies.sval').matchAll(/%include "([^"]+)"/g)].map((m) => m[1])
for (const inc of enemyIncludes) {
  const text = read(inc)
  for (const block of text.split(/<dict>/).slice(1)) {
    const id = /<string name="id">([^<]+)<\/string>/.exec(block)?.[1]
    if (!id) continue
    const type = SCHEME_TYPES.find((t) => id.endsWith(`_${t}`))
    if (!type) continue
    const race = id.slice(0, -type.length - 1)
    const r = (races[race] ??= { types: new Set(), units: new Set(), source: inc })
    r.types.add(type)
    for (const m of block.matchAll(/<string>(actors\/[^<]+\.unit)<\/string>/g)) r.units.add(m[1])
  }
}
const raceOut = {}
for (const race of sorted(Object.keys(races))) {
  const r = races[race]
  const tiers = {}
  for (const u of r.units) {
    const t = unitTier(u)
    if (t) tiers[t] = (tiers[t] ?? 0) + 1
  }
  // the race's tier is the lowest tier among its units (elites ride along)
  const tier = TIERS.find((t) => tiers[t]) ?? null
  raceOut[race] = { tier, types: SCHEME_TYPES.filter((t) => r.types.has(t)), units: sorted(r.units) }
}

// --- random-cave rooms (levels/_random/<theme>/___random_<size>_caller.pfb) --
const randomRooms = {}
for (const theme of fs.readdirSync(path.join(assets, 'levels', '_random')).sort()) {
  for (const size of ['small', 'medium', 'large']) {
    const caller = `levels/_random/${theme}/___random_${size}_caller.pfb`
    if (!exists(caller)) continue
    const rooms = [...read(caller).matchAll(/<string name="Prefab">([^<]+)<\/string>/g)].map((m) => m[1])
    ;(randomRooms[theme] ??= {})[size] = { caller, rooms: rooms.length }
  }
}

// --- shops (tweak/shop/shops.sval includes) ---------------------------------
const shops = {}
for (const inc of [...read('tweak/shop/shops.sval').matchAll(/%include "([^"]+)"/g)].map((m) => m[1])) {
  if (!exists(inc)) continue
  for (const block of read(inc).split(/<dict>\s*<string name="id">/).slice(1)) {
    const id = block.slice(0, block.indexOf('<'))
    const loot = [...((/<array name="loot">([\s\S]*?)<\/array>/.exec(block)?.[1]) ?? '').matchAll(/<string>([^<]+)<\/string>/g)].map(
      (m) => m[1]
    )
    const items = [...block.matchAll(/%block item (\S+)/g)].map((m) => m[1])
    shops[id] = { loot: [...new Set(loot)], items }
  }
}

// --- regions (tweak/regions.sval) --------------------------------------------
const regions = {}
const regionText = read('tweak/regions.sval')
for (const m of regionText.matchAll(/^\s*%block location (\S+) "([^"]*)" "([^"]*)" (\d+) (\d+)(?: (\w+))?/gm)) {
  regions[m[1]] = { name: m[2], music: Number(m[4]), tier: m[6] ?? null }
}
for (const m of regionText.matchAll(/<dict>\s*<string name="id">([^<]+)<\/string>\s*<string name="name">([^<]+)<\/string>\s*<int name="music">(\d+)<\/int>/g)) {
  regions[m[1]] ??= { name: m[2], music: Number(m[3]), tier: null }
}

// --- emit ----------------------------------------------------------------------
const list = (xs) => (xs.length === 0 ? '[]' : `[\n${xs.map((x) => `  ${JSON.stringify(x)}`).join(',\n')}\n]`)
const obj = (o) =>
  `{\n${Object.keys(o)
    .sort()
    .map((k) => `  ${JSON.stringify(k)}: ${JSON.stringify(o[k])}`)
    .join(',\n')}\n}`
const body =
  '// GENERATED by scripts/scan-hw2-assets.mjs from a Hammerwatch 2 install\n' +
  `// (${path.basename(assets)}). Do not edit by hand — rerun the script.\n` +
  '// Every asset path the generator emits must appear here (tests enforce it).\n\n' +
  `export const HW2_ASSETS_SOURCE = ${JSON.stringify(path.basename(assets))}\n\n` +
  `export const HW2_UNITS: readonly string[] = ${list(sorted(units))}\n\n` +
  `export const HW2_LIGHTS: readonly string[] = ${list(sorted(lights))}\n\n` +
  `export const HW2_TILESET_SIZES: Readonly<Record<string, number>> = ${obj(tilesets)}\n\n` +
  `export const HW2_ENVIRONMENTS: readonly string[] = ${list(sorted(envs))}\n\n` +
  `export const HW2_PREFABS: readonly string[] = ${list(sorted(prefabs))}\n\n` +
  '/** Enemy races from actors/enemies.sval: scheme types present, unit paths, lowest unit tier. */\n' +
  `export const HW2_ENEMY_RACES: Readonly<Record<string, { tier: string | null; types: string[]; units: string[] }>> = ${obj(raceOut)}\n\n` +
  '/** Random-cave room callers per theme and size, with how many rooms each picks from. */\n' +
  `export const HW2_RANDOM_ROOMS: Readonly<Record<string, Record<string, { caller: string; rooms: number }>>> = ${obj(randomRooms)}\n\n` +
  '/** Shops from tweak/shop/shops.sval: stock loot tables and fixed items. */\n' +
  `export const HW2_SHOPS: Readonly<Record<string, { loot: string[]; items: string[] }>> = ${obj(shops)}\n\n` +
  '/** Regions from tweak/regions.sval (DefaultRegion ids): music id and optional tier. */\n' +
  `export const HW2_REGIONS: Readonly<Record<string, { name: string; music: number; tier: string | null }>> = ${obj(regions)}\n`

if (process.argv.includes('--check')) {
  const cur = fs.existsSync(outFile) ? fs.readFileSync(outFile, 'utf8') : ''
  if (cur !== body) {
    console.error('hw2Assets.generated.ts is stale — run npm run scan')
    process.exit(1)
  }
  console.log('hw2Assets.generated.ts is current')
} else {
  fs.mkdirSync(path.dirname(outFile), { recursive: true })
  fs.writeFileSync(outFile, body)
  console.log(
    `wrote ${path.relative(process.cwd(), outFile)}: ${units.size} units, ${lights.length} lights, ` +
      `${Object.keys(tilesets).length} tilesets, ${envs.length} envs, ${prefabs.length} prefabs, ` +
      `${Object.keys(raceOut).length} races, ${Object.keys(shops).length} shops, ${Object.keys(regions).length} regions`
  )
}
