import { BrowserWindow, dialog, ipcMain } from 'electron'
import type { OpenDialogOptions, SaveDialogOptions } from 'electron'
import { readFile, writeFile } from 'fs/promises'
import { join } from 'path'
import JSZip from 'jszip'
import { DEFAULT_PARAMETERS, FLOOR_THEMES, TIERS, generateScenario, parseParametersTxt, serializeParametersTxt } from '../generator'
import type { GeneratedFile, ScenarioParameters } from '../generator'
import { racesForTier } from '../generator/catalog/depth'
import type { ActionResult, AppSettings, GenerateResponse, InitialState } from '../shared/ipc'
import { installScenario, writeScenario } from './packer'
import { findParametersOverride, loadSettings, saveSettings } from './settings'

/** The last generated scenario, kept in the main process for install/export. */
let last: { scenarioId: string; files: GeneratedFile[] } | null = null

const NOTHING = 'Generate a scenario first.'

export function registerIpcHandlers(getWindow: () => BrowserWindow | null): void {
  let settings: AppSettings = loadSettings()
  const openDialog = (opts: OpenDialogOptions) => {
    const win = getWindow()
    return win ? dialog.showOpenDialog(win, opts) : dialog.showOpenDialog(opts)
  }
  const saveDialog = (opts: SaveDialogOptions) => {
    const win = getWindow()
    return win ? dialog.showSaveDialog(win, opts) : dialog.showSaveDialog(opts)
  }

  ipcMain.handle('app:init', (): InitialState => {
    const override = findParametersOverride()
    return {
      settings,
      defaults: DEFAULT_PARAMETERS,
      parametersOverride: override === null ? null : parseParametersTxt(override).params,
      catalog: {
        themes: FLOOR_THEMES.map((t) => ({ id: t.id, label: t.label })),
        tiers: [...TIERS],
        races: Object.fromEntries(TIERS.map((t) => [t, racesForTier(t)]))
      }
    }
  })

  ipcMain.handle('dungeon:generate', (_e, params: ScenarioParameters, seed?: number): GenerateResponse => {
    const r = generateScenario(params, seed)
    if (!r.ok) {
      last = null
      return r
    }
    last = { scenarioId: r.scenarioId, files: r.files }
    return { ok: true, scenarioId: r.scenarioId, seed: r.seed, floors: r.floors, fileCount: r.files.length }
  })

  ipcMain.handle('dungeon:install', async (): Promise<ActionResult> => {
    if (last === null) return { ok: false, message: NOTHING }
    return installScenario(settings.hammerwatchPath, last.scenarioId, last.files, settings.keepSource)
  })

  ipcMain.handle('dungeon:export-folder', async (): Promise<ActionResult> => {
    if (last === null) return { ok: false, message: NOTHING }
    const pick = await openDialog({ properties: ['openDirectory', 'createDirectory'] })
    if (pick.canceled || pick.filePaths.length === 0) return { ok: false, message: 'Export cancelled.' }
    const target = join(pick.filePaths[0], last.scenarioId)
    await writeScenario(target, last.files)
    return { ok: true, message: `Exported to ${target}. Copy it into Hammerwatch 2/scenarios and run PACKAGER.exe -l ${last.scenarioId}.`, outputPath: target }
  })

  ipcMain.handle('dungeon:export-zip', async (): Promise<ActionResult> => {
    if (last === null) return { ok: false, message: NOTHING }
    const pick = await saveDialog({ defaultPath: `${last.scenarioId}.zip`, filters: [{ name: 'Zip', extensions: ['zip'] }] })
    if (pick.canceled || pick.filePath === undefined) return { ok: false, message: 'Export cancelled.' }
    const zip = new JSZip()
    for (const f of last.files) {
      zip.file(`${last.scenarioId}/${f.path}`, f.content, f.encoding === 'base64' ? { base64: true } : {})
    }
    await writeFile(pick.filePath, await zip.generateAsync({ type: 'nodebuffer' }))
    return { ok: true, message: `Saved ${pick.filePath}.`, outputPath: pick.filePath }
  })

  ipcMain.handle('settings:pick-path', async (): Promise<string | null> => {
    const pick = await openDialog({ title: 'Hammerwatch 2 folder', properties: ['openDirectory'] })
    return pick.canceled || pick.filePaths.length === 0 ? null : pick.filePaths[0]
  })

  ipcMain.handle('settings:save', (_e, next: AppSettings): void => {
    settings = { ...settings, ...next }
    saveSettings(settings)
  })

  ipcMain.handle('params:import', async () => {
    const pick = await openDialog({ filters: [{ name: 'Parameters', extensions: ['txt'] }], properties: ['openFile'] })
    if (pick.canceled || pick.filePaths.length === 0) return null
    return parseParametersTxt(await readFile(pick.filePaths[0], 'utf-8'))
  })

  ipcMain.handle('params:export', async (_e, params: ScenarioParameters): Promise<ActionResult> => {
    const pick = await saveDialog({ defaultPath: 'parameters.txt', filters: [{ name: 'Parameters', extensions: ['txt'] }] })
    if (pick.canceled || pick.filePath === undefined) return { ok: false, message: 'Export cancelled.' }
    await writeFile(pick.filePath, serializeParametersTxt(params), 'utf-8')
    return { ok: true, message: `Saved ${pick.filePath}.`, outputPath: pick.filePath }
  })
}
