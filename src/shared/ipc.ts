import type { FloorSummary, ScenarioParameters } from '../generator'

/** Contract between the Electron main process and the renderer. */

export interface AppSettings {
  /** Hammerwatch 2 install folder */
  hammerwatchPath: string
  /** keep the unpacked source (outside scenarios/) after installing */
  keepSource: boolean
}

export interface ActionResult {
  ok: boolean
  message: string
  outputPath?: string
}

export interface CatalogInfo {
  themes: Array<{ id: string; label: string }>
  tiers: string[]
  /** scanned races per tier */
  races: Record<string, string[]>
}

export interface InitialState {
  settings: AppSettings
  defaults: ScenarioParameters
  /** a parameters.txt found in userData or the working folder, if any */
  parametersOverride: ScenarioParameters | null
  catalog: CatalogInfo
}

export type GenerateResponse =
  | { ok: true; scenarioId: string; seed: number; floors: FloorSummary[]; fileCount: number }
  | { ok: false; errors: string[] }

export interface RendererApi {
  getInitialState(): Promise<InitialState>
  generate(params: ScenarioParameters, seed?: number): Promise<GenerateResponse>
  installToHammerwatch(): Promise<ActionResult>
  exportFolder(): Promise<ActionResult>
  exportZip(): Promise<ActionResult>
  pickHammerwatchPath(): Promise<string | null>
  saveSettings(settings: AppSettings): Promise<void>
  importParametersTxt(): Promise<{ params: ScenarioParameters; warnings: string[] } | null>
  exportParametersTxt(params: ScenarioParameters): Promise<ActionResult>
}
