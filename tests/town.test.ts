import { describe, expect, it } from 'vitest'
import { buildTown, townLayout, TOWN_RETURN_START } from '../src/generator/town/buildTown'
import { TOWN_SHOPS } from '../src/generator/catalog/townShops'
import { TIERS } from '../src/generator/catalog/depth'
import { shopExists } from '../src/generator/catalog/assets'
import { checkScenario, levelStarts } from '../src/generator/check'
import { Hw2Level, P } from '../src/generator/hw2/model'
import { readLevel } from '../src/generator/hw2/levelReader'
import { renderLevel } from '../src/generator/hw2/levelWriter'
import { START_FROM_ABOVE } from '../src/generator/floors/randomCaveFloor'

const town = buildTown({
  bands: [
    { index: 0, tier: 'apprentice', label: 'Depth 1', flag: null, entry: { level: 'levels/t/floor_01.lvl', startId: START_FROM_ABOVE } },
    { index: 1, tier: 'adept', label: 'Depth 4', flag: 'rl_t_band_1', entry: { level: 'levels/t/floor_04.lvl', startId: START_FROM_ABOVE } }
  ],
  tierFlags: { apprentice: null, adept: 'rl_t_band_1' }
})

function stub(): Hw2Level {
  const l = new Hw2Level(null)
  l.addScript('LevelStart', 0, 0, [P.str('StartID', START_FROM_ABOVE)])
  return l
}

describe('town', () => {
  it('every stall shop id exists in the game', () => {
    for (const cat of TOWN_SHOPS) for (const t of TIERS) expect(shopExists(cat.byTier[t]), `${cat.id}/${t}`).toBe(true)
  })

  it('passes the scenario checks with its band entrances', () => {
    expect(
      checkScenario([
        { path: 'levels/t/town.lvl', level: town },
        { path: 'levels/t/floor_01.lvl', level: stub() },
        { path: 'levels/t/floor_04.lvl', level: stub() }
      ])
    ).toEqual([])
    expect([...levelStarts(town)].sort()).toEqual(['', TOWN_RETURN_START])
  })

  it('is an outdoor level with a closed wall ring and ground tiles', () => {
    expect(town.gameMode).toEqual({ cls: 'WorldGameMode', defaultRegion: 'his_town_haart' })
    expect(town.environment).toBe('effects/env/outside.env')
    const walls = town.units.filter((u) => u.path.startsWith('doodads/walls/'))
    expect(walls.filter((u) => u.path.endsWith('/crn_nw.unit'))).toHaveLength(1)
    expect(walls.length).toBeGreaterThan(40)
    expect(town.tileCells.length).toBeGreaterThan(0)
  })

  it('stalls fall back from the highest unlocked tier', () => {
    const shops = town.scripts.filter((s) => s.cls === 'ShopArea')
    expect(shops).toHaveLength(TOWN_SHOPS.length * 2)
    const checks = town.scripts.filter((s) => s.cls === 'CheckFlag' && s.params.some((p) => p.name === 'OnFalse'))
    // one adept check per stall, falling back to the apprentice shop
    expect(checks.length).toBeGreaterThanOrEqual(TOWN_SHOPS.length)
  })

  it('only the first band is open at the start', () => {
    const exits = town.scripts.filter((s) => s.cls === 'AllPlayersLevelExit')
    expect(exits.map((e) => e.enabled)).toEqual([true, false])
  })

  it('keeps every entrance inside the walls, however many bands', () => {
    for (let n = 1; n <= 20; n++) {
      const { width, height, entrances } = townLayout(n)
      expect(entrances).toHaveLength(n)
      for (const [x, y] of entrances) {
        // at least 4 tiles of plaza between an entrance and the hedge
        expect(x, `${n} bands`).toBeGreaterThanOrEqual(4 * 16)
        expect(x).toBeLessThanOrEqual((width - 4) * 16)
        expect(y).toBeLessThanOrEqual((height - 4) * 16)
      }
      expect(new Set(entrances.map((e) => e.join(','))).size).toBe(n)
    }
  })

  it('round-trips through the writer', () => {
    const text = renderLevel(town)
    expect(renderLevel(readLevel(text).level)).toBe(text)
  })
})
