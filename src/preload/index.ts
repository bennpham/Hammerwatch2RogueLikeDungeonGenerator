import { contextBridge, ipcRenderer } from 'electron'
import type { RendererApi } from '../shared/ipc'

const api: RendererApi = {
  ping: () => ipcRenderer.invoke('app:ping')
}

contextBridge.exposeInMainWorld('api', api)
