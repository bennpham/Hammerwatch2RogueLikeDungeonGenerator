import { describe, expect, it } from 'vitest'
import { decodeRle, encodeRle, rleLength, TileLayers } from '../src/generator/hw2/tiles'
import { readLevel } from '../src/generator/hw2/levelReader'
import { renderLevel } from '../src/generator/hw2/levelWriter'
import { Hw2Level, P } from '../src/generator/hw2/model'
import { HW2_ROOT, assetFile, campaignFile } from './hw2Install'

describe('tile RLE', () => {
  it('reproduces stock HW2 chunk strings', () => {
    // a full 32-px chunk (256 cells) and superbia_passage_1's wood floor
    for (const hex of ['7e7e04', 'aa04f404f404f401fe018a']) {
      expect(rleLength(hex)).toBe(256)
      expect(encodeRle(decodeRle(hex, 16))).toBe(hex)
    }
  })

  it('centres 512-px chunks on their pos', () => {
    const layers = new TileLayers(() => 16)
    // tile (0,0) lies in the chunk centred on (0,0); tile (16,0) at x=256 is in the next one
    layers.paint16('tilesets/x.tileset', [
      [0, 0],
      [16, 0]
    ])
    const cells = layers.cells()
    expect(cells.map((c) => [c.x, c.y])).toEqual([
      [0, 0],
      [512, 0]
    ])
  })
})

describe('level writer/reader', () => {
  it('round-trips a generated level', () => {
    const lvl = new Hw2Level('effects/env/grotto.env')
    lvl.gameMode = { cls: 'DungeonGameMode', defaultRegion: 'level_mysterious' }
    const area = lvl.addRectSensor(0, -32, 32, 32)
    lvl.addUnit('effects/lights/light_L.png', 0, 0, {
      size: { kind: 'float', value: 300 },
      color: { kind: 'vec4', value: [0.5, 0.25, 0.125, 0] }
    })
    const exit = lvl.addScript('AllPlayersLevelExit', 0, -48, [P.ids('Areas', [area.id]), P.str('Level', 'levels/x/a.lvl')])
    const query = lvl.addScript('QueryWorldScriptsRange', 10, 0, [P.int('Radius', 9999), P.str('Type', 'AllPlayersLevelExit')])
    const set = lvl.addScript('SetScriptParamString', 20, 0, [P.target('#Scripts', query.id, 'Query')], { label: 'exit out' })
    lvl.link(set, exit, 50)
    lvl.prefabs.push({ path: 'prefabs/system/level_setup.pfb', x: 0, y: -544 })
    const text = renderLevel(lvl)
    const back = readLevel(text)
    expect(back.unknownParams).toEqual([])
    expect(renderLevel(back.level)).toBe(text)
    expect(back.level.gameMode).toEqual({ cls: 'DungeonGameMode', defaultRegion: 'level_mysterious' })
  })
})

describe.skipIf(HW2_ROOT === null)('stock HW2 levels', () => {
  const stock: Array<[string, () => string]> = [
    ['lockdey/cave_a.lvl', () => campaignFile('levels/lockdey/cave_a.lvl')],
    ['blackbarrow/cave_a_2.lvl', () => campaignFile('levels/blackbarrow/cave_a_2.lvl')],
    ['superbia_passage_1.lvl', () => campaignFile('levels/fallowfields/superbia/superbia_passage_1.lvl')],
    ['randomcave_exit_setup.pfb', () => assetFile('prefabs/system/randomcave_exit_setup.pfb')],
    ['random room pfb', () => assetFile('levels/_random/cave_light/medium/__cave_light_random_medium_a.pfb')]
  ]
  for (const [name, load] of stock) {
    it(`reads and re-writes ${name} stably`, () => {
      const first = readLevel(load())
      const text = renderLevel(first.level)
      const second = readLevel(text)
      expect(renderLevel(second.level)).toBe(text)
      expect(second.level.scripts.length).toBe(first.level.scripts.length)
      expect(second.level.units.length).toBe(first.level.units.length)
    })
  }

  it('reads the random-cave template the floors are built on', () => {
    const { level, unknownParams } = readLevel(campaignFile('levels/blackbarrow/cave_a.lvl'))
    expect(unknownParams).toEqual([])
    expect(level.gameMode).toEqual({ cls: 'DungeonGameMode', defaultRegion: 'level_mysterious' })
    expect(level.environment).toBe('effects/env/grotto.env')
    expect(level.prefabs.map((p) => p.path)).toEqual(['prefabs/system/level_setup.pfb', 'prefabs/system/randomcave_exit_setup.pfb'])
    const place = level.scripts.find((s) => s.cls === 'PlaceEnemies')!
    expect(place.params).toContainEqual({ kind: 'string', name: 'Race', value: 'wolf_demon' })
  })
})
