import { describe, expect, it } from 'vitest'
import { DEFAULT_PARAMETERS, generateScenario, parseParametersTxt, serializeParametersTxt } from '../src/generator'
import type { ScenarioParameters } from '../src/generator'
import { planCampaign } from '../src/generator/campaign'
import { readLevel } from '../src/generator/hw2/levelReader'
import { checkScenario, exitTargets } from '../src/generator/check'

function gen(params: Partial<ScenarioParameters> = {}, seed = 42) {
  const r = generateScenario({ ...DEFAULT_PARAMETERS, ...params }, seed)
  if (!r.ok) throw new Error(r.errors.join('\n'))
  return r
}

describe('generateScenario', () => {
  it('is deterministic per seed', () => {
    expect(gen({}, 7).files).toEqual(gen({}, 7).files)
    expect(gen({}, 7).files).not.toEqual(gen({}, 8).files)
  })

  it('writes info.xml, a logo, the town and every floor — never info.sval', () => {
    const r = gen({ floors: 5, floorsPerBand: 2 })
    const paths = r.files.map((f) => f.path)
    expect(paths).toEqual([
      'info.xml',
      'logos.png',
      'levels/rl_42/town.lvl',
      'levels/rl_42/floor_01.lvl',
      'levels/rl_42/floor_02.lvl',
      'levels/rl_42/floor_03.lvl',
      'levels/rl_42/floor_04.lvl',
      'levels/rl_42/floor_05.lvl'
    ])
    expect(paths).not.toContain('info.sval')
    expect(r.files.find((f) => f.path === 'logos.png')!.encoding).toBe('base64')
  })

  it('passes the scenario checks for many seeds and shapes', () => {
    for (const [floors, per] of [
      [1, 1],
      [3, 3],
      [10, 3],
      [12, 4],
      [20, 2]
    ]) {
      for (const seed of [0, 1, 99, 123456]) {
        const r = gen({ floors, floorsPerBand: per }, seed)
        const levels = r.files.filter((f) => f.path.endsWith('.lvl')).map((f) => ({ path: f.path, level: readLevel(f.content).level }))
        expect(checkScenario(levels), `${floors}/${per} seed ${seed}`).toEqual([])
      }
    }
  })

  it('chains floors within a band and returns home at band ends', () => {
    const plan = planCampaign({ ...DEFAULT_PARAMETERS, floors: 6, floorsPerBand: 3 }, 'rl_1', 1)
    const town = 'levels/rl_1/town.lvl'
    const f = (d: number) => plan.floors[d - 1].spec
    expect(f(1).up.level).toBe(town)
    expect(f(1).down).toEqual({ level: 'levels/rl_1/floor_02.lvl', startId: 'random-instance' })
    expect(f(2).up).toEqual({ level: 'levels/rl_1/floor_01.lvl', startId: 'random_secondary-instance' })
    expect(f(3).down.level).toBe(town)
    expect(f(3).setFlags).toEqual(['rl_1_band_1'])
    expect(f(4).up.level).toBe(town)
    expect(f(6).down.level).toBe(town)
    expect(f(6).setFlags).toBeUndefined()
    expect(plan.floors.map((x) => x.spec.tier)).toEqual(['apprentice', 'apprentice', 'apprentice', 'adept', 'adept', 'adept'])
    expect(plan.floors.map((x) => x.spec.size)).toEqual(
      plan.floors.map((x) => (x.spec.theme.id === 'prison' ? 'medium' : ['small', 'medium', 'large'][(x.depth - 1) % 3]))
    )
    expect(plan.town.bands.map((b) => b.flag)).toEqual([null, 'rl_1_band_1'])
    expect(plan.town.tierFlags).toEqual({ apprentice: null, adept: 'rl_1_band_1' })
  })

  it('town entrances lead to each band start', () => {
    const r = gen({ floors: 9, floorsPerBand: 3 })
    const town = readLevel(r.files.find((x) => x.path.endsWith('town.lvl'))!.content).level
    expect(exitTargets(town).map((t) => t.level)).toEqual(['levels/rl_42/floor_01.lvl', 'levels/rl_42/floor_04.lvl', 'levels/rl_42/floor_07.lvl'])
  })

  it('toggles persistent characters in info.xml', () => {
    const on = gen({ persistentCharacters: true }).files[0].content
    const off = gen({ persistentCharacters: false }).files[0].content
    expect(on).toContain('<modifier forced="true" id="PERSISTENT_CHARS" />')
    expect(off).not.toContain('PERSISTENT_CHARS')
    for (const x of [on, off]) {
      expect(x).toContain('<start>')
      expect(x).toContain('lvl="levels/rl_42/town.lvl"')
      expect(x).toContain('id="EQUIPMENT_LOSS"')
    }
  })

  it('rejects bad parameters instead of crashing', () => {
    const r = generateScenario({ ...DEFAULT_PARAMETERS, floors: 0, themes: ['lava'], races: { ...DEFAULT_PARAMETERS.races, adept: ['dragon'] } }, 1)
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.errors.join('\n')).toMatch(/floors[\s\S]*lava[\s\S]*dragon/)
  })

  it('round-trips parameters.txt', () => {
    const p: ScenarioParameters = { ...DEFAULT_PARAMETERS, floors: 7, themes: ['prison'], races: { ...DEFAULT_PARAMETERS.races, adept: ['boar', 'thief'] }, persistentCharacters: false }
    const back = parseParametersTxt(serializeParametersTxt(p))
    expect(back.warnings).toEqual([])
    expect(back.params).toEqual(p)
    expect(parseParametersTxt('floors=x\nbogus=1\n').warnings).toHaveLength(2)
  })
})
