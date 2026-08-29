import { createReadStream } from 'node:fs'
import { lstat, realpath, stat } from 'node:fs/promises'
import { basename, delimiter, isAbsolute, parse, relative, resolve, sep } from 'node:path'

export type LocalImportErrorCodeV1 =
  | 'IMPORT_ROOT_NOT_ALLOWED'
  | 'IMPORT_PATH_INVALID'
  | 'IMPORT_SYMLINK_ESCAPE'
  | 'IMPORT_FILE_NOT_FOUND'
  | 'IMPORT_MEDIA_UNSUPPORTED'

export class LocalImportErrorV1 extends Error {
  readonly code: LocalImportErrorCodeV1
  constructor(code: LocalImportErrorCodeV1, message: string) { super(message); this.code = code; this.name = 'LocalImportErrorV1' }
}

export interface PermittedImportFileV1 {
  readonly absolutePath: string
  readonly safeRelativePath: string
  readonly basename: string
  readonly byteLength: number
}

const unc = (value: string): boolean => process.platform === 'win32' && /^\\\\/u.test(value)
const within = (root: string, candidate: string): boolean => {
  const offset = relative(root, candidate)
  return offset === '' || (!offset.startsWith(`..${sep}`) && offset !== '..' && !isAbsolute(offset))
}

export const parseImportRootsV1 = (env: NodeJS.ProcessEnv = process.env): readonly string[] => {
  const configured = (env.SANVERSE_MCP_IMPORT_ROOTS ?? env.SANVERSE_MCP_IMPORT_ROOT ?? '').trim()
  if (!configured) return Object.freeze([])
  return Object.freeze(configured.split(delimiter).map((item) => item.trim()).filter(Boolean))
}

/**
 * Resolve one import path without granting the MCP arbitrary filesystem read.
 *
 * The configured roots and the candidate file must both resolve to their own
 * literal paths. A symlink/junction is rejected even when its target happens to
 * remain inside the root: the owner permitted a concrete directory tree, not a
 * second name that can later be retargeted elsewhere.
 */
export async function resolvePermittedImportFileV1(input: Readonly<{ localPath: string; roots: readonly string[] }>): Promise<PermittedImportFileV1> {
  if (typeof input.localPath !== 'string' || !input.localPath.trim() || input.localPath.length > 4096 || unc(input.localPath)) {
    throw new LocalImportErrorV1('IMPORT_PATH_INVALID', 'The import path is invalid.')
  }
  if (input.roots.length === 0) throw new LocalImportErrorV1('IMPORT_ROOT_NOT_ALLOWED', 'No Sanverse MCP import root is configured.')
  const requested = resolve(input.localPath)
  if (!isAbsolute(requested) || unc(requested)) throw new LocalImportErrorV1('IMPORT_PATH_INVALID', 'The import path must resolve to a local absolute path.')

  let fileStat
  try { fileStat = await lstat(requested) } catch { throw new LocalImportErrorV1('IMPORT_FILE_NOT_FOUND', 'The import file does not exist.') }
  if (fileStat.isSymbolicLink()) throw new LocalImportErrorV1('IMPORT_SYMLINK_ESCAPE', 'Symbolic links and junctions are not valid import files.')
  if (!fileStat.isFile()) throw new LocalImportErrorV1('IMPORT_PATH_INVALID', 'The import target must be a regular file.')
  const actual = await realpath(requested).catch(() => { throw new LocalImportErrorV1('IMPORT_FILE_NOT_FOUND', 'The import file could not be resolved.') })
  if (resolve(actual) !== requested) throw new LocalImportErrorV1('IMPORT_SYMLINK_ESCAPE', 'The import path resolves through a symbolic link or junction.')

  for (const configuredRoot of input.roots) {
    if (!configuredRoot || unc(configuredRoot)) continue
    const rootRequested = resolve(configuredRoot)
    const rootLstat = await lstat(rootRequested).catch(() => null)
    if (!rootLstat?.isDirectory() || rootLstat.isSymbolicLink()) continue
    const rootActual = await realpath(rootRequested).catch(() => null)
    if (!rootActual || resolve(rootActual) !== rootRequested) continue
    if (!within(rootActual, actual)) continue
    const info = await stat(actual)
    return Object.freeze({ absolutePath: actual, safeRelativePath: relative(rootActual, actual), basename: basename(actual), byteLength: info.size })
  }
  throw new LocalImportErrorV1('IMPORT_ROOT_NOT_ALLOWED', 'The import file is outside every configured Sanverse MCP import root.')
}

export async function importLocalVideoThroughProductionApiV1(input: Readonly<{
  localPath: string
  roots: readonly string[]
  apiUrl: string
}>): Promise<Readonly<{ manifest: Record<string, unknown>; safeRelativePath: string }>> {
  const file = await resolvePermittedImportFileV1({ localPath: input.localPath, roots: input.roots })
  const response = await fetch(`${input.apiUrl.replace(/\/$/u, '')}/api/projects`, {
    method: 'POST',
    headers: {
      'X-Sanverse-Filename': encodeURIComponent(file.basename),
      'Content-Type': 'application/octet-stream',
      'Content-Length': String(file.byteLength),
    },
    body: createReadStream(file.absolutePath) as never,
    duplex: 'half',
  } as unknown as RequestInit & { duplex: 'half' })
  if (!response.ok) {
    const detail = await response.text().catch(() => '')
    throw new LocalImportErrorV1('IMPORT_MEDIA_UNSUPPORTED', `Production intake refused the source video (${response.status})${detail ? ': ' + detail.slice(0, 180) : '.'}`)
  }
  return Object.freeze({ manifest: await response.json() as Record<string, unknown>, safeRelativePath: file.safeRelativePath })
}
