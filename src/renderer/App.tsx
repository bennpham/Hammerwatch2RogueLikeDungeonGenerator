import { useEffect, useState } from 'react'
import type { ScenarioParameters } from '../generator'
import type { ActionResult, AppSettings, CatalogInfo, GenerateResponse } from '../shared/ipc'

type Tier = ScenarioParameters['startTier']

export function App(): React.JSX.Element {
  const [settings, setSettings] = useState<AppSettings | null>(null)
  const [catalog, setCatalog] = useState<CatalogInfo | null>(null)
  const [params, setParams] = useState<ScenarioParameters | null>(null)
  const [seed, setSeed] = useState('')
  const [result, setResult] = useState<GenerateResponse | null>(null)
  const [message, setMessage] = useState<ActionResult | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    window.api.getInitialState().then((s) => {
      setSettings(s.settings)
      setCatalog(s.catalog)
      setParams(s.parametersOverride ?? s.defaults)
    })
  }, [])

  if (settings === null || catalog === null || params === null) return <main className="app">Loading…</main>

  const set = <K extends keyof ScenarioParameters>(key: K, value: ScenarioParameters[K]): void => {
    setParams({ ...params, [key]: value })
    setResult(null)
  }
  const saveSettings = (next: AppSettings): void => {
    setSettings(next)
    void window.api.saveSettings(next)
  }
  const run = async (action: () => Promise<ActionResult>): Promise<void> => {
    setBusy(true)
    try {
      setMessage(await action())
    } finally {
      setBusy(false)
    }
  }

  const generate = async (): Promise<void> => {
    setBusy(true)
    setMessage(null)
    try {
      const s = seed.trim() === '' ? undefined : Number(seed)
      const r = await window.api.generate(params, s)
      setResult(r)
      if (r.ok) setSeed(String(r.seed))
    } finally {
      setBusy(false)
    }
  }

  const toggleTheme = (id: string): void =>
    set('themes', params.themes.includes(id) ? params.themes.filter((t) => t !== id) : [...params.themes, id])
  const toggleRace = (tier: Tier, race: string): void => {
    const cur = params.races[tier] ?? []
    set('races', { ...params.races, [tier]: cur.includes(race) ? cur.filter((r) => r !== race) : [...cur, race] })
  }

  const generated = result?.ok === true

  return (
    <main className="app">
      <header>
        <h1>Hammerwatch 2 Dungeon Generator</h1>
        <p className="muted">A town hub and a chain of random floors that get tougher as you go deeper.</p>
      </header>

      <section className="card">
        <h2>Hammerwatch 2</h2>
        <div className="row">
          <input
            className="grow"
            value={settings.hammerwatchPath}
            placeholder="…/steamapps/common/Hammerwatch 2"
            onChange={(e) => saveSettings({ ...settings, hammerwatchPath: e.target.value })}
          />
          <button
            onClick={async () => {
              const p = await window.api.pickHammerwatchPath()
              if (p !== null) saveSettings({ ...settings, hammerwatchPath: p })
            }}
          >
            Browse…
          </button>
        </div>
        <label className="check">
          <input type="checkbox" checked={settings.keepSource} onChange={(e) => saveSettings({ ...settings, keepSource: e.target.checked })} />
          Keep the unpacked source after installing (in <code>generated_sources/</code>)
        </label>
      </section>

      <div className="columns">
        <section className="card">
          <h2>Scenario</h2>
          <div className="grid">
            <label>
              Name
              <input value={params.name} onChange={(e) => set('name', e.target.value)} />
            </label>
            <label>
              Seed <span className="muted">(blank = random)</span>
              <input value={seed} inputMode="numeric" onChange={(e) => setSeed(e.target.value.replace(/[^0-9]/g, ''))} />
            </label>
            <label>
              Floors
              <input type="number" min={1} max={60} value={params.floors} onChange={(e) => set('floors', Number(e.target.value))} />
            </label>
            <label>
              Floors per band <span className="muted">(then back to town)</span>
              <input type="number" min={1} max={10} value={params.floorsPerBand} onChange={(e) => set('floorsPerBand', Number(e.target.value))} />
            </label>
            <label>
              Starting tier
              <select value={params.startTier} onChange={(e) => set('startTier', e.target.value as Tier)}>
                {catalog.tiers.map((t) => (
                  <option key={t}>{t}</option>
                ))}
              </select>
            </label>
            <label>
              Max players
              <input type="number" min={1} max={4} value={params.maxPlayers} onChange={(e) => set('maxPlayers', Number(e.target.value))} />
            </label>
            <label>
              Loot chance per floor: {Math.round(params.lootChance * 100)}%
              <input type="range" min={0} max={1} step={0.05} value={params.lootChance} onChange={(e) => set('lootChance', Number(e.target.value))} />
            </label>
          </div>
          <label className="check strong">
            <input type="checkbox" checked={params.persistentCharacters} onChange={(e) => set('persistentCharacters', e.target.checked)} />
            Persistent characters
          </label>
          <p className="muted small">
            On: play (and farm) the characters you use in the official campaign. Off: every save starts with a fresh character.
          </p>

          <h3>Floor themes</h3>
          <div className="chips">
            {catalog.themes.map((t) => (
              <label key={t.id} className="check">
                <input type="checkbox" checked={params.themes.includes(t.id)} onChange={() => toggleTheme(t.id)} />
                {t.label}
              </label>
            ))}
          </div>
        </section>

        <section className="card">
          <h2>Enemies by tier</h2>
          <p className="muted small">Each band is one tier deeper. Tick races to restrict a tier; leave a tier blank to use all of them.</p>
          {catalog.tiers.map((tier) => (
            <div key={tier} className="tier">
              <h3>{tier}</h3>
              <div className="chips">
                {(catalog.races[tier] ?? []).map((race) => (
                  <label key={race} className="check">
                    <input type="checkbox" checked={(params.races[tier as Tier] ?? []).includes(race)} onChange={() => toggleRace(tier as Tier, race)} />
                    {race.replace(/_/g, ' ')}
                  </label>
                ))}
              </div>
            </div>
          ))}
        </section>
      </div>

      <section className="card actions">
        <button className="primary" disabled={busy} onClick={generate}>
          Generate
        </button>
        <button disabled={busy || !generated} onClick={() => run(window.api.installToHammerwatch)}>
          Install to Hammerwatch 2
        </button>
        <button disabled={busy || !generated} onClick={() => run(window.api.exportFolder)}>
          Export folder…
        </button>
        <button disabled={busy || !generated} onClick={() => run(window.api.exportZip)}>
          Export zip…
        </button>
        <span className="grow" />
        <button
          disabled={busy}
          onClick={async () => {
            const r = await window.api.importParametersTxt()
            if (r === null) return
            setParams(r.params)
            setResult(null)
            setMessage({ ok: r.warnings.length === 0, message: r.warnings.length === 0 ? 'Parameters loaded.' : r.warnings.join('\n') })
          }}
        >
          Load parameters.txt…
        </button>
        <button disabled={busy} onClick={() => run(() => window.api.exportParametersTxt(params))}>
          Save parameters.txt…
        </button>
      </section>

      {message !== null && <pre className={`message ${message.ok ? 'ok' : 'err'}`}>{message.message}</pre>}

      {result !== null && !result.ok && <pre className="message err">{result.errors.join('\n')}</pre>}

      {result !== null && result.ok && (
        <section className="card">
          <h2>
            {result.scenarioId} <span className="muted">· seed {result.seed} · {result.fileCount} files</span>
          </h2>
          <table>
            <thead>
              <tr>
                <th>Depth</th>
                <th>Band</th>
                <th>Tier</th>
                <th>Theme</th>
                <th>Room</th>
                <th>Enemies</th>
              </tr>
            </thead>
            <tbody>
              {result.floors.map((f) => (
                <tr key={f.depth}>
                  <td>{f.depth}</td>
                  <td>{f.band + 1}</td>
                  <td>{f.tier}</td>
                  <td>{catalog.themes.find((t) => t.id === f.theme)?.label ?? f.theme}</td>
                  <td>
                    {f.roomSet.replace(/_/g, ' ')} · {f.size}
                  </td>
                  <td>{f.race.replace(/_/g, ' ')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}
    </main>
  )
}
