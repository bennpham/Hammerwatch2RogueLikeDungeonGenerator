import { existsSync, readFileSync } from 'fs'
import { join } from 'path'

/**
 * The local Hammerwatch 2 install for stock-file tests: `HW2_ROOT`, else the
 * default Steam path. Suites that need it use `describe.skipIf(!HW2_ROOT)` so
 * CI (no game) still passes.
 */
const DEFAULT_ROOT = 'D:/Program Files (x86)/Steam/steamapps/common/Hammerwatch 2'

function findRoot(): string | null {
  const env = process.env['HW2_ROOT']
  for (const dir of [env, DEFAULT_ROOT, 'C:/Program Files (x86)/Steam/steamapps/common/Hammerwatch 2']) {
    if (dir && existsSync(join(dir, 'HW2.exe'))) return dir
  }
  return null
}

export const HW2_ROOT = findRoot()

/** The unpacked official campaign (`scenarios/hammerwatch2-arpg`). */
export function campaignFile(rel: string): string {
  return readFileSync(join(HW2_ROOT!, 'scenarios', 'hammerwatch2-arpg', rel), 'utf-8')
}

/** A base resource from the newest `unpacked_assets_*`. */
export function assetFile(rel: string): string {
  return readFileSync(join(HW2_ROOT!, 'unpacked_assets_137', rel), 'utf-8')
}
