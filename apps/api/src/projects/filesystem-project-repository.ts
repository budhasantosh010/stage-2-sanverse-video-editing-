import { chmod, lstat, mkdir, open, readFile, realpath, rename, rm, stat } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'

import {
  EXPORT_ID_PATTERN,
  PROJECT_ID_PATTERN,
  type MediaRange,
  type OpenMediaResult,
  type ProjectManifest,
  type ProjectRepository,
  type StagedSource,
} from './project-repository.ts'

type RepositoryErrorCode = 'INVALID_PROJECT_ID' | 'INVALID_EXPORT_ID' | 'PROJECT_COLLISION' | 'PROJECT_NOT_FOUND' | 'EXPORT_NOT_FOUND' | 'INVALID_RANGE'

class RepositoryError extends Error {
  readonly code: RepositoryErrorCode

  constructor(code: RepositoryErrorCode, message: string) {
    super(message)
    this.code = code
    this.name = 'RepositoryError'
  }
}

function assertProjectId(projectId: string): void {
  if (!PROJECT_ID_PATTERN.test(projectId)) {
    throw new RepositoryError('INVALID_PROJECT_ID', 'Invalid project ID.')
  }
}

function assertExportId(exportId: string): void {
  if (!EXPORT_ID_PATTERN.test(exportId)) {
    throw new RepositoryError('INVALID_EXPORT_ID', 'Invalid export ID.')
  }
}

function isCode(error: unknown, ...codes: string[]): boolean {
  return typeof error === 'object' && error !== null && 'code' in error && codes.includes(String(error.code))
}

async function syncDirectory(path: string): Promise<void> {
  let handle
  try {
    handle = await open(path, 'r')
    await handle.sync()
  } catch (error) {
    // Windows can reject directory fsync even though file fsync and atomic rename succeeded.
    if (!isCode(error, 'EINVAL', 'EPERM', 'EBADF', 'EISDIR')) throw error
  } finally {
    await handle?.close()
  }
}

type PartialWriteHandle = {
  write(buffer: Uint8Array, offset: number, length: number, position?: number | null): Promise<{ bytesWritten: number }>
}

export async function writeAll(handle: PartialWriteHandle, chunk: Uint8Array): Promise<void> {
  let offset = 0
  while (offset < chunk.byteLength) {
    const remaining = chunk.byteLength - offset
    const { bytesWritten } = await handle.write(chunk, offset, remaining, null)
    if (!Number.isSafeInteger(bytesWritten) || bytesWritten <= 0 || bytesWritten > remaining) {
      throw new Error('Source media write made no progress.')
    }
    offset += bytesWritten
  }
}

export function createFilesystemProjectRepository(dataRoot: string): ProjectRepository {
  const root = resolve(dataRoot)
  const projectsRoot = join(root, 'projects')

  async function ensureRoot(): Promise<void> {
    await mkdir(projectsRoot, { recursive: true })
    const actual = await realpath(projectsRoot)
    if (resolve(actual) !== resolve(projectsRoot)) {
      throw new Error('The project storage root must not be a symbolic link.')
    }
  }

  function projectPath(projectId: string): string {
    assertProjectId(projectId)
    return join(projectsRoot, projectId)
  }

  function stagePath(projectId: string): string {
    assertProjectId(projectId)
    return join(projectsRoot, `.staging-${projectId}`)
  }

  async function resolvePublishedMedia(projectId: string): Promise<{ sourcePath: string; size: number }> {
    await ensureRoot()
    const projectDir = projectPath(projectId)
    const sourcePath = join(projectDir, 'source.mp4')
    const manifestPath = join(projectDir, 'project.json')
    try {
      const [sourceInfo, manifestInfo] = await Promise.all([stat(sourcePath), stat(manifestPath)])
      if (!sourceInfo.isFile() || !manifestInfo.isFile()) throw new RepositoryError('PROJECT_NOT_FOUND', 'Project media is unavailable.')
      const [actualSource, actualManifest] = await Promise.all([realpath(sourcePath), realpath(manifestPath)])
      if (resolve(actualSource) !== resolve(sourcePath) || resolve(actualManifest) !== resolve(manifestPath)) {
        throw new RepositoryError('PROJECT_NOT_FOUND', 'Project media path is not safe.')
      }
      await readFile(manifestPath, 'utf8')
      return { sourcePath, size: sourceInfo.size }
    } catch (error) {
      if (error instanceof RepositoryError) throw error
      if (isCode(error, 'ENOENT', 'ENOTDIR')) throw new RepositoryError('PROJECT_NOT_FOUND', 'Project media was not found.')
      throw error
    }
  }

  async function exportRoot(projectId: string): Promise<{ sourcePath: string; projectDir: string; exportsDir: string }> {
    const { sourcePath } = await resolvePublishedMedia(projectId)
    const projectDir = dirname(sourcePath)
    const exportsDir = join(projectDir, 'exports')
    await mkdir(exportsDir, { recursive: true })
    const actual = await realpath(exportsDir)
    if (resolve(actual) !== resolve(exportsDir)) throw new RepositoryError('EXPORT_NOT_FOUND', 'The export storage path is not safe.')
    return { sourcePath, projectDir, exportsDir }
  }

  async function resolvePublishedExport(projectId: string, exportId: string): Promise<{ path: string; size: number }> {
    assertExportId(exportId)
    const { exportsDir } = await exportRoot(projectId)
    const path = join(exportsDir, `${exportId}.mp4`)
    try {
      const info = await lstat(path)
      const actual = await realpath(path)
      if (!info.isFile() || info.size <= 0 || info.nlink !== 1 || resolve(actual) !== resolve(path)) {
        throw new RepositoryError('EXPORT_NOT_FOUND', 'Export media is unavailable.')
      }
      return { path, size: info.size }
    } catch (error) {
      if (error instanceof RepositoryError) throw error
      if (isCode(error, 'ENOENT', 'ENOTDIR')) throw new RepositoryError('EXPORT_NOT_FOUND', 'Export media was not found.')
      throw error
    }
  }

  async function openControlledFile(
    path: string,
    notFoundCode: 'PROJECT_NOT_FOUND' | 'EXPORT_NOT_FOUND',
    notFoundMessage: string,
    range?: MediaRange,
  ): Promise<OpenMediaResult> {
    let handle
    try {
      const before = await lstat(path)
      const actualBefore = await realpath(path)
      if (!before.isFile() || before.size <= 0 || before.nlink !== 1 || resolve(actualBefore) !== resolve(path)) {
        throw new RepositoryError(notFoundCode, notFoundMessage)
      }

      handle = await open(path, 'r')
      const opened = await handle.stat()
      const after = await lstat(path)
      const actualAfter = await realpath(path)
      const identityAvailable = (value: typeof opened) =>
        (typeof value.dev === 'bigint' || Number.isSafeInteger(value.dev)) &&
        (typeof value.ino === 'bigint' ? value.ino !== 0n : Number.isSafeInteger(value.ino) && value.ino > 0)
      const sameIdentity = (left: typeof opened, right: typeof opened) =>
        identityAvailable(left) && identityAvailable(right) && left.dev === right.dev && left.ino === right.ino

      if (
        !opened.isFile() || opened.size <= 0 || opened.nlink !== 1 ||
        !after.isFile() || after.size <= 0 || after.nlink !== 1 ||
        resolve(actualAfter) !== resolve(path) ||
        !sameIdentity(before, opened) || !sameIdentity(opened, after)
      ) {
        throw new RepositoryError(notFoundCode, notFoundMessage)
      }

      const size = opened.size
      const start = range?.start ?? 0
      const end = range?.end ?? size - 1
      if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start < 0 || end < start || start >= size || end >= size) {
        throw new RepositoryError('INVALID_RANGE', 'Requested byte range is not satisfiable.')
      }

      const openedHandle = handle
      handle = undefined
      const body = {
        async *[Symbol.asyncIterator](): AsyncGenerator<Uint8Array> {
          const stream = openedHandle.createReadStream({ start, end, autoClose: false })
          try {
            for await (const chunk of stream) yield chunk
          } finally {
            stream.destroy()
            await openedHandle.close().catch(() => undefined)
          }
        },
      }
      return { body, size, start, end }
    } catch (error) {
      await handle?.close().catch(() => undefined)
      if (error instanceof RepositoryError) throw error
      if (isCode(error, 'ENOENT', 'ENOTDIR')) throw new RepositoryError(notFoundCode, notFoundMessage)
      throw error
    }
  }

  return {
    async stageSource({ projectId, body }): Promise<StagedSource> {
      await ensureRoot()
      const finalDir = projectPath(projectId)
      const stagingDir = stagePath(projectId)
      try {
        await lstat(finalDir)
        throw new RepositoryError('PROJECT_COLLISION', 'Project ID already exists.')
      } catch (error) {
        if (!isCode(error, 'ENOENT')) throw error
      }
      try {
        await mkdir(stagingDir, { recursive: false })
      } catch (error) {
        if (isCode(error, 'EEXIST')) throw new RepositoryError('PROJECT_COLLISION', 'Project ID is already being created.')
        throw error
      }

      const sourcePath = join(stagingDir, 'source.mp4')
      let byteLength = 0
      let handle
      try {
        handle = await open(sourcePath, 'wx', 0o600)
        for await (const chunk of body) {
          await writeAll(handle, chunk)
          byteLength += chunk.byteLength
        }
        await handle.sync()
        await handle.close()
        handle = undefined
        await chmod(sourcePath, 0o444)
        await syncDirectory(stagingDir)
        return { projectId, token: stagingDir, byteLength }
      } catch (error) {
        await handle?.close().catch(() => undefined)
        await rm(stagingDir, { recursive: true, force: true }).catch(() => undefined)
        throw error
      }
    },

    async publishProject(stage, manifest): Promise<void> {
      assertProjectId(stage.projectId)
      const expectedStage = stagePath(stage.projectId)
      if (resolve(stage.token) !== resolve(expectedStage)) throw new Error('Invalid staging token.')
      const manifestPath = join(expectedStage, 'project.json')
      let handle
      try {
        handle = await open(manifestPath, 'wx', 0o600)
        await handle.writeFile(`${JSON.stringify(manifest, null, 2)}\n`, 'utf8')
        await handle.sync()
        await handle.close()
        handle = undefined
        await chmod(manifestPath, 0o444)
        await syncDirectory(expectedStage)
        await rename(expectedStage, projectPath(stage.projectId))
        await syncDirectory(projectsRoot)
      } catch (error) {
        await handle?.close().catch(() => undefined)
        if (isCode(error, 'EEXIST', 'ENOTEMPTY')) throw new RepositoryError('PROJECT_COLLISION', 'Project ID was published concurrently.')
        throw error
      }
    },

    async abortStage(stage): Promise<void> {
      assertProjectId(stage.projectId)
      const expectedStage = stagePath(stage.projectId)
      if (resolve(stage.token) !== resolve(expectedStage)) return
      await rm(expectedStage, { recursive: true, force: true })
    },

    async inspectMedia(projectId: string): Promise<{ size: number }> {
      const media = await resolvePublishedMedia(projectId)
      return { size: media.size }
    },

    async openMedia(projectId: string, range?: MediaRange): Promise<OpenMediaResult> {
      const { sourcePath } = await resolvePublishedMedia(projectId)
      return openControlledFile(sourcePath, 'PROJECT_NOT_FOUND', 'Project media is unavailable.', range)
    },

    async allocateExport(projectId: string, exportId: string) {
      assertExportId(exportId)
      const { sourcePath, projectDir, exportsDir } = await exportRoot(projectId)
      return { sourcePath, outputPath: join(exportsDir, `${exportId}.mp4`), trustedWorkDir: projectDir }
    },

    async inspectExport(projectId: string, exportId: string) {
      const output = await resolvePublishedExport(projectId, exportId)
      return { size: output.size }
    },

    async openExport(projectId: string, exportId: string, range?: MediaRange) {
      const output = await resolvePublishedExport(projectId, exportId)
      return openControlledFile(output.path, 'EXPORT_NOT_FOUND', 'Export media is unavailable.', range)
    },
  }
}
