import { describe, expect, it } from 'vitest'
import { buildRandomCaveFloor, START_FROM_ABOVE, START_FROM_BELOW } from '../src/generator/floors/randomCaveFloor'
import type { FloorSpec } from '../src/generator/floors/randomCaveFloor'
import { floorTheme } from '../src/generator/catalog/depth'
import { checkScenario, exitTargets, levelStarts } from '../src/generator/check'
import { Hw2Level, P } from '../src/generator/hw2/model'
import { readLevel } from '../src/generator/hw2/levelReader'
import { renderLevel } from '../src/generator/hw2/levelWriter'
import { HW2_ROOT, campaignFile } from './hw2Install'

const spec: FloorSpec = {
  depth: 2,
  theme: floorTheme('cave_dark')!,
  roomSet: 'cave_light',
  size: 'medium',
  tier: 'adept',
  race: 'wolf_black',
  lootChance: 0.75,
  up: { level: 'levels/t/floor_01.lvl', startId: START_FROM_BELOW },
  down: { level: 'levels/t/floor_03.lvl', startId: START_FROM_ABOVE },
  setFlags: ['rl_t_band_1'],
  announce: { text: 'Dark cave' }
}

function stub(start: string): Hw2Level {
  const l = new Hw2Level(null)
  l.addScript('LevelStart', 0, 0, start === '' ? [] : [P.str('StartID', start)])
  return l
}

describe('random-cave floor', () => {
  const floor = buildRandomCaveFloor(spec)

  it('targets both neighbours and passes the scenario checks', () => {
    const targets = exitTargets(floor).map((t) => `${t.level}#${t.startId}`).sort()
    expect(targets).toEqual(['levels/t/floor_01.lvl#random_secondary-instance', 'levels/t/floor_03.lvl#random-instance'])
    expect([...levelStarts(floor)].sort()).toEqual([START_FROM_ABOVE, START_FROM_BELOW].sort())
    const problems = checkScenario([
      { path: 'levels/t/floor_02.lvl', level: floor },
      { path: 'levels/t/floor_01.lvl', level: stub(START_FROM_BELOW) },
      { path: 'levels/t/floor_03.lvl', level: stub(START_FROM_ABOVE) }
    ])
    expect(problems).toEqual([])
  })

  it('reports a missing destination start', () => {
    const problems = checkScenario([
      { path: 'levels/t/floor_02.lvl', level: floor },
      { path: 'levels/t/floor_01.lvl', level: stub('') },
      { path: 'levels/t/floor_03.lvl', level: stub(START_FROM_ABOVE) }
    ])
    expect(problems).toHaveLength(1)
    expect(problems[0]).toMatch(/floor_01\.lvl start "random_secondary-instance"/)
  })

  it('emits the chosen room, theme, tier, race and loot caps', () => {
    const p = (cls: string, name: string) =>
      floor.scripts.filter((s) => s.cls === cls).map((s) => s.params.find((x) => x.name === name)?.value)
    expect(p('SpawnPrefab', 'Prefab')).toEqual(['levels/_random/cave_light/___random_medium_caller.pfb'])
    expect(p('GlobalEvent', 'EventName')).toEqual(['theme_cave_dark', 'tier_adept'])
    expect(p('PlaceEnemies', 'Race')).toEqual(['wolf_black'])
    expect(p('MinMaxRandomCount', 'MaxNumToExecute')).toEqual([3, 2])
    expect(p('SetFlag', 'Flag')).toEqual(['rl_t_band_1'])
    expect(floor.gameMode).toEqual({ cls: 'DungeonGameMode', defaultRegion: 'level_mysterious' })
  })

  it('round-trips through the writer', () => {
    const text = renderLevel(floor)
    const back = readLevel(text)
    expect(back.unknownParams).toEqual([])
    expect(renderLevel(back.level)).toBe(text)
  })
})

describe.skipIf(HW2_ROOT === null)('against the stock chained cave', () => {
  it('uses the same node vocabulary as blackbarrow/cave_a_2', () => {
    const stock = readLevel(campaignFile('levels/blackbarrow/cave_a_2.lvl')).level
    const ours = buildRandomCaveFloor(spec)
    const classes = (l: Hw2Level) => new Set(l.scripts.map((s) => s.cls))
    // everything we emit is something the stock floor uses (bar our extras)
    const extras = new Set(['SetFlag', 'AnnounceText'])
    for (const c of classes(ours)) if (!extras.has(c)) expect(classes(stock)).toContain(c)
    expect(ours.prefabs).toEqual(stock.prefabs)
    expect(ours.environment).toBe(stock.environment)
    // the stock secondary exit is retargeted the same way
    expect(exitTargets(stock).map((t) => t.startId).sort()).toEqual([START_FROM_ABOVE, START_FROM_BELOW].sort())
  })
})
