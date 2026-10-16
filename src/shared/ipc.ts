/** Contract between the Electron main process and the renderer. */
export interface RendererApi {
  ping(): Promise<string>
}
