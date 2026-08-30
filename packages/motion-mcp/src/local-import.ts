import { createReadStream } from 'node:fs'
import { lstat, opendir, readFile, realpath, stat } from 'node:fs/promises'
import { basename, delimiter, extname, isAbsolute, relative, resolve, sep } from 'node:path'

export type LocalImportErrorCodeV1 =
  | 'WORKSPACE_ROOT_INVALID'
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

export type WorkspaceInputKindV1 = 'video' | 'transcript' | 'image'
export interface WorkspaceInputV1 {
  readonly relativePath: string
  readonly kind: WorkspaceInputKindV1
  readonly byteLength: number
}

export interface WorkspaceTextFileV1 {
  readonly relativePath: string
  readonly format: 'plain' | 'srt' | 'vtt'
  readonly contents: string
}

const unc = (value: string): boolean => process.platform === 'win32' && /^\\\\/u.test(value)
const comparable = (value: string): string => process.platform === 'win32' ? resolve(value).toLowerCase() : resolve(value)
const samePath = (left: string, right: string): boolean => comparable(left) === comparable(right)
const within = (root: string, candidate: string): boolean => {
  const offset = relative(root, candidate)
  return offset === '' || (!offset.startsWith(`..${sep}`) && offset !== '..' && !isAbsolute(offset))
}

export const parseImportRootsV1 = (env: NodeJS.ProcessEnv = process.env): readonly string[] => {
  const configured = (env.SANVERSE_MCP_IMPORT_ROOTS ?? env.SANVERSE_MCP_IMPORT_ROOT ?? '').trim()
  if (!configured) return Object.freeze([])
  return Object.freeze(configured.split(delimiter).map((item) => item.trim()).filter(Boolean))
}

export async function resolveLocalWorkspaceRootV1(workspaceRoot: string): Promise<string> {
  if (typeof workspaceRoot !== 'string' || !workspaceRoot.trim() || workspaceRoot.length > 4096 || !isAbsolute(workspaceRoot) || unc(workspaceRoot)) {
    throw new LocalImportErrorV1('WORKSPACE_ROOT_INVALID', 'The local coding-agent workspace is not a valid absolute local directory.')
  }
  const requested = resolve(workspaceRoot)
  const rootLstat = await lstat(requested).catch(() => null)
  if (!rootLstat?.isDirectory() || rootLstat.isSymbolicLink()) {
    throw new LocalImportErrorV1('WORKSPACE_ROOT_INVALID', 'The local coding-agent workspace must be an existing regular directory, not a symlink or junction.')
  }
  const actual = await realpath(requested).catch(() => null)
  if (!actual || !samePath(actual, requested)) {
    throw new LocalImportErrorV1('WORKSPACE_ROOT_INVALID', 'The local coding-agent workspace resolves through a symlink or junction and cannot be used as an import boundary.')
  }
  return actual
}

/**
 * Resolve one import path without granting the MCP arbitrary filesystem read.
 *
 * The configured roots and the candidate file must both resolve to their own
 * literal paths. A symlink/junction is rejected even when its target happens to
 * remain inside the root: the owner permitted a concrete directory tree, not a
 * second name that can later be retargeted elsewhere.
 */
export async function resolvePermittedImportFileV1(input: Readonly<{
  localPath: string
  roots: readonly string[]
  relativeTo?: string
}>): Promise<PermittedImportFileV1> {
  if (typeof input.localPath !== 'string' || !input.localPath.trim() || input.localPath.length > 4096 || unc(input.localPath)) {
    throw new LocalImportErrorV1('IMPORT_PATH_INVALID', 'The import path is invalid.')
  }
  if (input.roots.length === 0) throw new LocalImportErrorV1('IMPORT_ROOT_NOT_ALLOWED', 'No Sanverse MCP import root is configured.')

  const relativeBase = input.relativeTo ? await resolveLocalWorkspaceRootV1(input.relativeTo) : process.cwd()
  const requested = isAbsolute(input.localPath) ? resolve(input.localPath) : resolve(relativeBase, input.localPath)
  if (!isAbsolute(requested) || unc(requested)) throw new LocalImportErrorV1('IMPORT_PATH_INVALID', 'The import path must resolve to a local absolute path.')

  let fileStat
  try { fileStat = await lstat(requested) } catch { throw new LocalImportErrorV1('IMPORT_FILE_NOT_FOUND', 'The import file does not exist.') }
  if (fileStat.isSymbolicLink()) throw new LocalImportErrorV1('IMPORT_SYMLINK_ESCAPE', 'Symbolic links and junctions are not valid import files.')
  if (!fileStat.isFile()) throw new LocalImportErrorV1('IMPORT_PATH_INVALID', 'The import target must be a regular file.')
  const actual = await realpath(requested).catch(() => { throw new LocalImportErrorV1('IMPORT_FILE_NOT_FOUND', 'The import file could not be resolved.') })
  if (!samePath(actual, requested)) throw new LocalImportErrorV1('IMPORT_SYMLINK_ESCAPE', 'The import path resolves through a symbolic link or junction.')

  for (const configuredRoot of input.roots) {
    if (!configuredRoot || unc(configuredRoot)) continue
    const rootActual = await resolveLocalWorkspaceRootV1(configuredRoot).catch(() => null)
    if (!rootActual || !within(rootActual, actual)) continue
    const info = await stat(actual)
    return Object.freeze({ absolutePath: actual, safeRelativePath: relative(rootActual, actual), basename: basename(actual), byteLength: info.size })
  }
  throw new LocalImportErrorV1('IMPORT_ROOT_NOT_ALLOWED', 'The import file is outside every configured Sanverse MCP import root.')
}

const ignoredDirectoryNames = new Set(['.git', '.hg', '.svn', '.sanverse-data', 'node_modules', 'dist', 'build', 'coverage', 'tmp', 'temp'])
const inputKind = (path: string): WorkspaceInputKindV1 | null => {
  const extension = extname(path).toLowerCase()
  if (extension === '.mp4') return 'video'
  if (extension === '.srt' || extension === '.vtt' || extension === '.txt') return 'transcript'
  if (extension === '.png' || extension === '.jpg' || extension === '.jpeg' || extension === '.webp') return 'image'
  return null
}

export async function listPermittedWorkspaceInputsV1(input: Readonly<{
  workspaceRoot: string
  maxFiles?: number
  maxDepth?: number
}>): Promise<readonly WorkspaceInputV1[]> {
  const root = await resolveLocalWorkspaceRootV1(input.workspaceRoot)
  const maxFiles = input.maxFiles ?? 256
  const maxDepth = input.maxDepth ?? 6
  if (!Number.isSafeInteger(maxFiles) || maxFiles < 1 || maxFiles > 2048) throw new RangeError('maxFiles must be between 1 and 2048.')
  if (!Number.isSafeInteger(maxDepth) || maxDepth < 0 || maxDepth > 12) throw new RangeError('maxDepth must be between 0 and 12.')
  const found: WorkspaceInputV1[] = []

  const walk = async (directory: string, depth: number): Promise<void> => {
    if (found.length >= maxFiles || depth > maxDepth) return
    const entries = await opendir(directory)
    for await (const entry of entries) {
      if (found.length >= maxFiles) break
      if (entry.name.startsWith('.')) continue
      const candidate = resolve(directory, entry.name)
      const entryLstat = await lstat(candidate).catch(() => null)
      if (!entryLstat || entryLstat.isSymbolicLink()) continue
      const actual = await realpath(candidate).catch(() => null)
      if (!actual || !samePath(actual, candidate) || !within(root, actual)) continue
      if (entryLstat.isDirectory()) {
        if (!ignoredDirectoryNames.has(entry.name.toLowerCase()) && depth < maxDepth) await walk(actual, depth + 1)
        continue
      }
      if (!entryLstat.isFile()) continue
      const kind = inputKind(actual)
      if (!kind) continue
      found.push(Object.freeze({ relativePath: relative(root, actual), kind, byteLength: entryLstat.size }))
    }
  }

  await walk(root, 0)
  return Object.freeze(found.sort((left, right) => left.relativePath.localeCompare(right.relativePath)))
}

export async function readPermittedWorkspaceTextFileV1(input: Readonly<{
  localPath: string
  workspaceRoot: string
  maxBytes?: number
}>): Promise<WorkspaceTextFileV1> {
  const root = await resolveLocalWorkspaceRootV1(input.workspaceRoot)
  const file = await resolvePermittedImportFileV1({ localPath: input.localPath, roots: [root], relativeTo: root })
  const maxBytes = input.maxBytes ?? 2_000_000
  if (!Number.isSafeInteger(maxBytes) || maxBytes < 1 || maxBytes > 8_000_000) throw new RangeError('maxBytes must be between 1 and 8000000.')
  if (file.byteLength > maxBytes) throw new LocalImportErrorV1('IMPORT_MEDIA_UNSUPPORTED', 'The workspace transcript file is too large.')
  const extension = extname(file.safeRelativePath).toLowerCase()
  const format = extension === '.srt' ? 'srt' as const : extension === '.vtt' ? 'vtt' as const : extension === '.txt' ? 'plain' as const : null
  if (!format) throw new LocalImportErrorV1('IMPORT_MEDIA_UNSUPPORTED', 'Only .srt, .vtt, and .txt workspace transcript files are supported.')
  const contents = await readFile(file.absolutePath, 'utf8').catch(() => { throw new LocalImportErrorV1('IMPORT_FILE_NOT_FOUND', 'The workspace transcript file could not be read.') })
  return Object.freeze({ relativePath: file.safeRelativePath, format, contents })
}

export async function importLocalVideoThroughProductionApiV1(input: Readonly<{
  localPath: string
  roots: readonly string[]
  apiUrl: string
  relativeTo?: string
}>): Promise<Readonly<{ manifest: Record<string, unknown>; safeRelativePath: string }>> {
  const file = await resolvePermittedImportFileV1({ localPath: input.localPath, roots: input.roots, ...(input.relativeTo ? { relativeTo: input.relativeTo } : {}) })
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
