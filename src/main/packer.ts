import { execFile } from 'child_process'
import { closeSync, existsSync, openSync, readFileSync, readSync } from 'fs'
import { mkdir, rename, rm, writeFile } from 'fs/promises'
import { homedir } from 'os'
import { dirname, join } from 'path'
import type { GeneratedFile } from '../generator'
import type { ActionResult } from '../shared/ipc'

/**
 * Installing a generated scenario into Hammerwatch 2. Ported from the AE
 * generator's packer; Node-only (no Electron) so the CLI can use it too.
 */

/** The game's folder name under a Steam library's steamapps/common. */
export const HW2_DIR_NAME = 'Hammerwatch 2'

/** The first four bytes of every packed HW2 scenario. [VERIFIED] */
export const HSC_MAGIC = 'HW2S'

/** Write the scenario files into a target folder, creating subfolders. */
export async function writeScenario(targetDir: string, files: GeneratedFile[]): Promise<void> {
  for (const file of files) {
    const fullPath = join(targetDir, file.path)
    await mkdir(dirname(fullPath), { recursive: true })
    // the generator is pure and hands back strings only; binaries arrive base64
    await writeFile(
      fullPath,
      file.encoding === 'base64' ? Buffer.from(file.content, 'base64') : file.content,
      file.encoding === 'base64' ? undefined : 'utf-8'
    )
  }
}

/** Whether `dir` looks like a Hammerwatch 2 install. */
export function isHw2Install(dir: string, exists: (p: string) => boolean = existsSync): boolean {
  return dir !== '' && exists(join(dir, 'HW2.exe')) && exists(join(dir, 'PACKAGER.exe'))
}

function safeRead(p: string): string | null {
  try {
    return readFileSync(p, 'utf-8')
  } catch {
    return null
  }
}

/** Steam library roots: the usual spots on every drive plus every library `libraryfolders.vdf` lists. */
export function steamLibraryCandidates(
  platform: NodeJS.Platform = process.platform,
  read: (p: string) => string | null = safeRead
): string[] {
  const roots: string[] = []
  if (platform === 'win32') {
    for (const drive of 'CDEFGHIJKLMNOPQRSTUVWXYZ') {
      for (const sub of ['Program Files (x86)/Steam', 'Program Files/Steam', 'SteamLibrary', 'Steam', 'Games/Steam', 'Games/SteamLibrary']) {
        roots.push(`${drive}:/${sub}`)
      }
    }
  } else {
    const home = homedir()
    roots.push(join(home, '.steam/steam'), join(home, '.local/share/Steam'), join(home, 'Library/Application Support/Steam'))
  }
  for (const root of [...roots]) {
    const vdf = read(join(root, 'steamapps', 'libraryfolders.vdf'))
    if (vdf === null) continue
    for (const m of vdf.matchAll(/"path"\s+"([^"]+)"/g)) roots.push(m[1].replace(/\\\\/g, '/'))
  }
  return [...new Set(roots)]
}

/** The Hammerwatch 2 install folder, or null when none of the usual places has one. */
export function findHw2Install(
  exists: (p: string) => boolean = existsSync,
  libraries: string[] = steamLibraryCandidates()
): string | null {
  for (const lib of libraries) {
    const dir = join(lib, 'steamapps', 'common', HW2_DIR_NAME)
    if (isHw2Install(dir, exists)) return dir
  }
  return null
}

/** Whether `file` starts with the packed-scenario magic. */
export function hasHscMagic(file: string): boolean {
  try {
    const fd = openSync(file, 'r')
    const head = Buffer.alloc(4)
    readSync(fd, head, 0, 4, 0)
    closeSync(fd)
    return head.toString('latin1') === HSC_MAGIC
  } catch {
    return false
  }
}

/** Where an installed scenario's unpacked source is kept with `keepSource` (outside `scenarios/`). */
export function keptSourceDir(hw2Path: string, scenarioId: string): string {
  return join(hw2Path, 'generated_sources', scenarioId)
}

/**
 * Install a generated scenario:
 *
 *   1. write it to `<HW2>/scenarios/<id>/` (info.xml, logos.png, levels/<id>/*.lvl);
 *   2. run `PACKAGER.exe -l <id>` from the HW2 folder, which packs it into
 *      `<HW2>/scenarios/<id>.hsc`;
 *   3. check the .hsc starts with `HW2S`;
 *   4. take the source folder out of `scenarios/` so the game does not list
 *      it twice — moved to `<HW2>/generated_sources/<id>/` with `keepSource`,
 *      deleted otherwise.
 *
 * PACKAGER exits 127 even after writing a good .hsc and logs an error for the
 * optional resources.xml [VERIFIED 2026-10-16], so the produced file, not the
 * exit code, is the test.
 */
export async function installScenario(hw2Path: string, scenarioId: string, files: GeneratedFile[], keepSource: boolean): Promise<ActionResult> {
  if (!hw2Path) return { ok: false, message: 'Set your Hammerwatch 2 folder first.' }
  if (!existsSync(hw2Path)) return { ok: false, message: `Hammerwatch 2 folder not found: ${hw2Path}` }
  const packager = join(hw2Path, 'PACKAGER.exe')
  if (!existsSync(packager)) {
    return { ok: false, message: `PACKAGER.exe not found at ${packager}. Check this is the Hammerwatch 2 folder, or use "Export folder" and pack it yourself.` }
  }

  const scenariosDir = join(hw2Path, 'scenarios')
  const sourceDir = join(scenariosDir, scenarioId)
  const packed = join(scenariosDir, `${scenarioId}.hsc`)
  await rm(sourceDir, { recursive: true, force: true })
  await rm(packed, { force: true })
  await writeScenario(sourceDir, files)

  const isWindows = process.platform === 'win32'
  const command = isWindows ? packager : 'wine'
  const args = isWindows ? ['-l', scenarioId] : [packager, '-l', scenarioId]
  const run = await new Promise<{ spawned: boolean; output: string }>((resolve) => {
    execFile(command, args, { cwd: hw2Path, timeout: 180_000 }, (error, stdout, stderr) => {
      const notFound = error !== null && (error as NodeJS.ErrnoException).code === 'ENOENT'
      resolve({ spawned: !notFound, output: `${stdout}${stderr}`.trim() })
    })
  })
  if (!run.spawned) {
    const hint = isWindows ? '' : ' PACKAGER.exe is a Windows tool — install wine, or export the folder and pack on Windows.'
    return { ok: false, message: `Could not run PACKAGER.exe.${hint} The unpacked scenario was left at ${sourceDir}.` }
  }
  if (!existsSync(packed)) {
    const tail = run.output
      .split(/\r?\n/)
      .filter((l) => /\[(ERR|WRN)\]/.test(l) && !l.includes('resources.xml'))
      .slice(-5)
      .join('\n')
    const steam = /steam application running/i.test(run.output) ? ' PACKAGER needs Steam running and logged in.' : ''
    return { ok: false, message: `PACKAGER ran but ${scenarioId}.hsc was not produced.${steam} The scenario folder is at ${sourceDir}.${tail ? `\n${tail}` : ''}` }
  }
  if (!hasHscMagic(packed)) {
    return { ok: false, message: `${packed} is not a packed scenario (no ${HSC_MAGIC} header). The scenario folder is at ${sourceDir}.` }
  }

  if (keepSource) {
    const kept = keptSourceDir(hw2Path, scenarioId)
    await rm(kept, { recursive: true, force: true })
    await mkdir(dirname(kept), { recursive: true })
    await rename(sourceDir, kept)
  } else {
    await rm(sourceDir, { recursive: true, force: true })
  }
  return {
    ok: true,
    message: `Installed ${scenarioId}.hsc — start it from the scenario list in Hammerwatch 2.`,
    outputPath: packed
  }
}
