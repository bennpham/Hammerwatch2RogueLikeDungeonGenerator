import { app } from 'electron'
import { existsSync, readFileSync, writeFileSync } from 'fs'
import { join } from 'path'
import type { AppSettings } from '../shared/ipc'
import { findHw2Install } from './packer'

const DEFAULT_SETTINGS: AppSettings = {
  hammerwatchPath: '',
  keepSource: false
}

function settingsPath(): string {
  return join(app.getPath('userData'), 'settings.json')
}

export function loadSettings(): AppSettings {
  let settings: AppSettings = { ...DEFAULT_SETTINGS }
  try {
    if (existsSync(settingsPath())) settings = { ...DEFAULT_SETTINGS, ...JSON.parse(readFileSync(settingsPath(), 'utf-8')) }
  } catch {
    // corrupt settings fall back to defaults
  }
  // no folder chosen yet: look in the usual Steam places
  if (settings.hammerwatchPath === '') settings.hammerwatchPath = findHw2Install() ?? ''
  return settings
}

export function saveSettings(settings: AppSettings): void {
  writeFileSync(settingsPath(), JSON.stringify(settings, null, 2))
}

/** A parameters.txt in the app's userData folder or the working folder seeds the startup parameters. */
export function findParametersOverride(): string | null {
  for (const p of [join(app.getPath('userData'), 'parameters.txt'), join(process.cwd(), 'parameters.txt')]) {
    if (!existsSync(p)) continue
    try {
      return readFileSync(p, 'utf-8')
    } catch {
      return null
    }
  }
  return null
}
