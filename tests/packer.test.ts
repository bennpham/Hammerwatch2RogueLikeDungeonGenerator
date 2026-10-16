import { existsSync, mkdtempSync, readFileSync, rmSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { describe, expect, it } from 'vitest'
import { findHw2Install, hasHscMagic, installScenario, isHw2Install, steamLibraryCandidates, writeScenario } from '../src/main/packer'
import { DEFAULT_PARAMETERS, generateScenario } from '../src/generator'
import { HW2_ROOT } from './hw2Install'

describe('packer', () => {
  it('recognises an install by HW2.exe and PACKAGER.exe', () => {
    const has = new Set(['G/HW2.exe', 'G/PACKAGER.exe'].map((p) => join(p)))
    expect(isHw2Install('G', (p) => has.has(p))).toBe(true)
    expect(isHw2Install('G', () => false)).toBe(false)
    expect(isHw2Install('', () => true)).toBe(false)
  })

  it('reads extra Steam libraries from libraryfolders.vdf', () => {
    const vdf = '"libraryfolders" { "1" { "path" "E:\\Games\\Steam" } }'
    const roots = steamLibraryCandidates('win32', (p) => (p.startsWith('C:') && p.endsWith('libraryfolders.vdf') ? vdf : null))
    expect(roots).toContain('E:/Games/Steam')
    expect(findHw2Install(() => false, roots)).toBeNull()
  })

  it('writes text and base64 files', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'hw2gen-'))
    try {
      await writeScenario(dir, [
        { path: 'a/b.txt', content: 'hi' },
        { path: 'c.bin', content: Buffer.from('HW2S').toString('base64'), encoding: 'base64' }
      ])
      expect(readFileSync(join(dir, 'a/b.txt'), 'utf-8')).toBe('hi')
      expect(hasHscMagic(join(dir, 'c.bin'))).toBe(true)
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })
})

// a real PACKAGER run writes into the game's scenarios folder: opt-in only
describe.skipIf(HW2_ROOT === null || process.env['HW2_PACK'] !== '1')('PACKAGER', () => {
  it('packs a generated scenario into an .hsc', async () => {
    const r = generateScenario({ ...DEFAULT_PARAMETERS, floors: 2, floorsPerBand: 2 }, 900001)
    if (!r.ok) throw new Error(r.errors.join('\n'))
    const res = await installScenario(HW2_ROOT!, r.scenarioId, r.files, false)
    try {
      expect(res.ok, res.message).toBe(true)
      expect(hasHscMagic(res.outputPath!)).toBe(true)
      expect(existsSync(join(HW2_ROOT!, 'scenarios', r.scenarioId))).toBe(false)
    } finally {
      rmSync(join(HW2_ROOT!, 'scenarios', `${r.scenarioId}.hsc`), { force: true })
    }
  }, 200_000)
})
