import { contextBridge, ipcRenderer } from 'electron'
import type { AppSettings, RendererApi } from '../shared/ipc'
import type { ScenarioParameters } from '../generator'

const api: RendererApi = {
  getInitialState: () => ipcRenderer.invoke('app:init'),
  generate: (params: ScenarioParameters, seed?: number) => ipcRenderer.invoke('dungeon:generate', params, seed),
  installToHammerwatch: () => ipcRenderer.invoke('dungeon:install'),
  exportFolder: () => ipcRenderer.invoke('dungeon:export-folder'),
  exportZip: () => ipcRenderer.invoke('dungeon:export-zip'),
  pickHammerwatchPath: () => ipcRenderer.invoke('settings:pick-path'),
  saveSettings: (settings: AppSettings) => ipcRenderer.invoke('settings:save', settings),
  importParametersTxt: () => ipcRenderer.invoke('params:import'),
  exportParametersTxt: (params: ScenarioParameters) => ipcRenderer.invoke('params:export', params)
}

contextBridge.exposeInMainWorld('api', api)
