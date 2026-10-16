import { execFileSync } from 'child_process'
import { describe, expect, it } from 'vitest'
import { hw2AssetExists, shopExists, tilesetSize } from '../src/generator/catalog/assets'
import { FLOOR_THEMES, TIERS, racesForTier, roomCaller, sizeForBandPosition, themeSizes, tierForBand } from '../src/generator/catalog/depth'
import { regionExists } from '../src/generator/catalog/assets'
import { HW2_ROOT } from './hw2Install'

describe('asset snapshot', () => {
  it('knows the stock pieces the floors and town use', () => {
    expect(hw2AssetExists('prefabs/system/level_setup.pfb')).toBe(true)
    expect(hw2AssetExists('prefabs/system/randomcave_exit_setup.pfb')).toBe(true)
    expect(hw2AssetExists('effects/env/grotto.env')).toBe(true)
    expect(hw2AssetExists('effects/lights/light_L.png')).toBe(true)
    expect(hw2AssetExists(':Physics_Rectangle')).toBe(true)
    expect(hw2AssetExists('doodads/walls/stone_4/h_32.unit')).toBe(true)
    expect(hw2AssetExists('doodads/walls/stone_4/nope.unit')).toBe(false)
    expect(tilesetSize('tilesets/wood_3_32_worn.tileset')).toBe(32)
    expect(shopExists('aaron_shop')).toBe(true)
  })

  it('has races for every tier', () => {
    for (const t of TIERS) expect(racesForTier(t).length).toBeGreaterThan(0)
  })

  it('every floor theme resolves to rooms, a region and an env', () => {
    for (const t of FLOOR_THEMES) {
      expect(themeSizes(t).length).toBeGreaterThan(0)
      expect(regionExists(t.region)).toBe(true)
      expect(hw2AssetExists(t.environment)).toBe(true)
      for (const size of themeSizes(t)) {
        const caller = t.roomSets.map((s) => roomCaller(s, size)).find((c) => c !== undefined)!
        expect(hw2AssetExists(caller)).toBe(true)
      }
    }
  })

  it('steps tiers per band and grows rooms within a band', () => {
    expect(tierForBand(0, 'apprentice')).toBe('apprentice')
    expect(tierForBand(2, 'apprentice')).toBe('expert')
    expect(tierForBand(9, 'adept')).toBe('master')
    expect([0, 1, 2].map((p) => sizeForBandPosition(p, 3, ['small', 'medium', 'large']))).toEqual(['small', 'medium', 'large'])
    expect(sizeForBandPosition(0, 3, ['medium'])).toBe('medium')
  })
})

describe.skipIf(HW2_ROOT === null)('scanner', () => {
  it('snapshot matches the installed game', () => {
    expect(() => execFileSync(process.execPath, ['scripts/scan-hw2-assets.mjs', '--check'], { stdio: 'pipe' })).not.toThrow()
  })
})
