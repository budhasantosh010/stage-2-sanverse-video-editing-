import { createHash, randomBytes } from 'node:crypto'
import { chmod, lstat, mkdir, open, readFile, readdir, realpath, rename, rm, stat } from 'node:fs/promises'
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

/** Asset ids come from the server, never from a user, and are checked anyway. */
const ASSET_ID_PATTERN = /^asset_[a-z0-9]{8,64}$/

function assertAssetId(assetId: string): void {
  if (!ASSET_ID_PATTERN.test(assetId)) throw new Error('Invalid asset ID.')
}

function assertExportId(exportId: string): void {
  if (!EXPORT_ID_PATTERN.test(exportId)) {
    throw new RepositoryError('INVALID_EXPORT_ID', 'Invalid export ID.')
  }
}

function isCode(error: unknown, ...codes: string[]): boolean {
  return typeof error === 'object' && error !== null && 'code' in error && codes.includes(String(error.code))
}

function parseManifest(value: unknown, projectId: string): ProjectManifest {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new RepositoryError('PROJECT_NOT_FOUND', 'Project metadata is invalid.')
  }
  const manifest = value as Record<string, unknown>
  if (
    Object.keys(manifest).length !== 6 ||
    manifest.id !== projectId ||
    typeof manifest.originalFilename !== 'string' || manifest.originalFilename.length === 0 ||
    typeof manifest.createdAt !== 'string' || Number.isNaN(Date.parse(manifest.createdAt)) ||
    typeof manifest.sizeBytes !== 'number' || !Number.isSafeInteger(manifest.sizeBytes) || manifest.sizeBytes <= 0 ||
    typeof manifest.sha256 !== 'string' || !/^[a-f0-9]{64}$/.test(manifest.sha256) ||
    manifest.mediaUrl !== `/api/projects/${projectId}/media`
  ) {
    throw new RepositoryError('PROJECT_NOT_FOUND', 'Project metadata is invalid.')
  }
  return Object.freeze(manifest as ProjectManifest)
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

  async function readPublishedManifest(projectId: string): Promise<ProjectManifest> {
    const { sourcePath, size } = await resolvePublishedMedia(projectId)
    const manifestPath = join(dirname(sourcePath), 'project.json')
    let parsed: unknown
    try {
      parsed = JSON.parse(await readFile(manifestPath, 'utf8'))
    } catch {
      throw new RepositoryError('PROJECT_NOT_FOUND', 'Project metadata is invalid.')
    }
    const manifest = parseManifest(parsed, projectId)
    if (manifest.sizeBytes !== size) throw new RepositoryError('PROJECT_NOT_FOUND', 'Project metadata does not match its source media.')
    return manifest
  }

  async function readControlledProjectState(projectId: string): Promise<string | null> {
    const { sourcePath } = await resolvePublishedMedia(projectId)
    const statePath = join(dirname(sourcePath), 'edit-project.json')
    let handle
    try {
      const before = await lstat(statePath, { bigint: true })
      const actualBefore = await realpath(statePath)
      if (!before.isFile() || before.size <= 0n || before.nlink !== 1n || resolve(actualBefore) !== resolve(statePath)) {
        throw new RepositoryError('PROJECT_NOT_FOUND', 'Saved project state is unavailable.')
      }
      handle = await open(statePath, 'r')
      const opened = await handle.stat({ bigint: true })
      const after = await lstat(statePath, { bigint: true })
      const actualAfter = await realpath(statePath)
      const sameIdentity = before.dev === opened.dev && before.ino === opened.ino && opened.dev === after.dev && opened.ino === after.ino
      if (!opened.isFile() || opened.size <= 0n || opened.nlink !== 1n || !sameIdentity || resolve(actualAfter) !== resolve(statePath)) {
        throw new RepositoryError('PROJECT_NOT_FOUND', 'Saved project state is unavailable.')
      }
      return await handle.readFile('utf8')
    } catch (error) {
      if (isCode(error, 'ENOENT', 'ENOTDIR')) return null
      throw error
    } finally {
      await handle?.close().catch(() => undefined)
    }
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
      const before = await lstat(path, { bigint: true })
      const actualBefore = await realpath(path)
      if (!before.isFile() || before.size <= 0n || before.nlink !== 1n || resolve(actualBefore) !== resolve(path)) {
        throw new RepositoryError(notFoundCode, notFoundMessage)
      }

      handle = await open(path, 'r')
      const opened = await handle.stat({ bigint: true })
      const after = await lstat(path, { bigint: true })
      const actualAfter = await realpath(path)
      const identityAvailable = (value: typeof opened) =>
        (typeof value.dev === 'bigint' || Number.isSafeInteger(value.dev)) &&
        (typeof value.ino === 'bigint' ? value.ino !== 0n : Number.isSafeInteger(value.ino) && value.ino > 0)
      const sameIdentity = (left: typeof opened, right: typeof opened) =>
        identityAvailable(left) && identityAvailable(right) && left.dev === right.dev && left.ino === right.ino

      if (
        !opened.isFile() || opened.size <= 0n || opened.nlink !== 1n ||
        !after.isFile() || after.size <= 0n || after.nlink !== 1n ||
        resolve(actualAfter) !== resolve(path) ||
        !sameIdentity(before, opened) || !sameIdentity(opened, after)
      ) {
        throw new RepositoryError(notFoundCode, notFoundMessage)
      }

      const size = Number(opened.size)
      const start = range?.start ?? 0
      const end = range?.end ?? size - 1
      if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start < 0 || end < start || start >= size || end >= size) {
        throw new RepositoryError('INVALID_RANGE', 'Requested byte range is not satisfiable.')
      }

      const openedHandle = handle
      handle = undefined
      let closePromise: Promise<void> | undefined
      const close = (): Promise<void> => {
        closePromise ??= openedHandle.close()
        return closePromise
      }
      const body = {
        async *[Symbol.asyncIterator](): AsyncGenerator<Uint8Array> {
          const stream = openedHandle.createReadStream({ start, end, autoClose: false })
          try {
            for await (const chunk of stream) yield chunk
          } finally {
            stream.destroy()
            await close()
          }
        },
      }
      return { body, close, size, start, end }
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

    async listProjects(): Promise<readonly ProjectManifest[]> {
      await ensureRoot()
      const entries = await readdir(projectsRoot, { withFileTypes: true })
      const candidates = entries
        .filter((entry) => entry.isDirectory() && PROJECT_ID_PATTERN.test(entry.name))
        .map((entry) => readPublishedManifest(entry.name))
      const settled = await Promise.allSettled(candidates)
      return Object.freeze(settled
        .filter((result): result is PromiseFulfilledResult<ProjectManifest> => result.status === 'fulfilled')
        .map((result) => result.value)
        .sort((left, right) => right.createdAt.localeCompare(left.createdAt) || right.id.localeCompare(left.id)))
    },

    async readProject(projectId: string): Promise<ProjectManifest> {
      assertProjectId(projectId)
      return readPublishedManifest(projectId)
    },

    async readProjectState(projectId: string): Promise<string | null> {
      assertProjectId(projectId)
      return readControlledProjectState(projectId)
    },

    async resolveMediaPaths(projectId: string) {
      assertProjectId(projectId)
      const { sourcePath } = await resolvePublishedMedia(projectId)
      return { sourcePath, trustedWorkDir: dirname(sourcePath) }
    },

    /**
     * Add one extra file to a project that already exists.
     *
     * Written to a temporary name first and renamed into place only once the
     * whole body has arrived and been flushed to disk. A half-written B-roll
     * clip can therefore never be visible under its real name — the project
     * either has the whole file or does not have it at all.
     *
     * The file is stored with NO extension. FFmpeg and the browser both detect
     * the format from the bytes, so nothing downstream depends on a name a user
     * chose, and a name a user chose can never be read as an instruction.
     */
    async stageAsset({ projectId, assetId, body }) {
      assertProjectId(projectId)
      assertAssetId(assetId)
      const { sourcePath } = await resolvePublishedMedia(projectId)
      const projectDir = dirname(sourcePath)
      const assetsDir = join(projectDir, 'assets')
      await mkdir(assetsDir, { recursive: true })
      const actualAssetsDir = await realpath(assetsDir)
      if (resolve(actualAssetsDir) !== resolve(assetsDir)) {
        throw new RepositoryError('PROJECT_NOT_FOUND', 'The asset storage path is not safe.')
      }

      const finalPath = join(assetsDir, assetId)
      try {
        await lstat(finalPath)
        throw new RepositoryError('PROJECT_COLLISION', 'That asset already exists.')
      } catch (error) {
        if (error instanceof RepositoryError) throw error
        if (!isCode(error, 'ENOENT')) throw error
      }

      const temporaryPath = join(assetsDir, `.asset-${randomBytes(12).toString('hex')}.tmp`)
      const hash = createHash('sha256')
      let byteLength = 0
      let handle
      try {
        handle = await open(temporaryPath, 'wx', 0o600)
        for await (const chunk of body) {
          await writeAll(handle, chunk)
          hash.update(chunk)
          byteLength += chunk.byteLength
        }
        await handle.sync()
        await handle.close()
        handle = undefined
        if (byteLength <= 0) throw new RepositoryError('PROJECT_NOT_FOUND', 'The uploaded file was empty.')
        await chmod(temporaryPath, 0o444)
        await rename(temporaryPath, finalPath)
        await syncDirectory(assetsDir)
        return {
          path: finalPath,
          byteLength,
          sha256: hash.digest('hex'),
          trustedWorkDir: projectDir,
        }
      } catch (error) {
        await handle?.close().catch(() => undefined)
        await rm(temporaryPath, { force: true }).catch(() => undefined)
        throw error
      }
    },

    async resolveAssetPath(projectId: string, assetId: string) {
      assertProjectId(projectId)
      assertAssetId(assetId)
      const { sourcePath } = await resolvePublishedMedia(projectId)
      const assetPath = join(dirname(sourcePath), 'assets', assetId)
      const actual = await realpath(assetPath).catch(() => {
        throw new RepositoryError('PROJECT_NOT_FOUND', 'That file is no longer available.')
      })
      // The canonical path must still be the one we asked for, so a link
      // planted in the assets folder cannot make the exporter read elsewhere.
      if (resolve(actual) !== resolve(assetPath)) {
        throw new RepositoryError('PROJECT_NOT_FOUND', 'That file path is not safe.')
      }
      return assetPath
    },

    async openAsset(projectId: string, assetId: string, range?: MediaRange) {
      const assetPath = await this.resolveAssetPath(projectId, assetId)
      return openControlledFile(assetPath, 'PROJECT_NOT_FOUND', 'That file is unavailable.', range)
    },

    async saveProjectState(projectId: string, serializedProject: string): Promise<void> {
      assertProjectId(projectId)
      if (typeof serializedProject !== 'string' || serializedProject.length === 0 || Buffer.byteLength(serializedProject, 'utf8') > 1024 * 1024) {
        throw new Error('Serialized project state must be non-empty bounded JSON text.')
      }
      const { sourcePath } = await resolvePublishedMedia(projectId)
      const projectDir = dirname(sourcePath)
      const statePath = join(projectDir, 'edit-project.json')
      const temporaryPath = join(projectDir, `.edit-project-${randomBytes(12).toString('hex')}.tmp`)
      let handle
      try {
        handle = await open(temporaryPath, 'wx', 0o600)
        await handle.writeFile(serializedProject, 'utf8')
        await handle.sync()
        await handle.close()
        handle = undefined
        await rename(temporaryPath, statePath)
        await syncDirectory(projectDir)
      } catch (error) {
        await handle?.close().catch(() => undefined)
        await rm(temporaryPath, { force: true }).catch(() => undefined)
        throw error
      }
    },

    async allocateExport(projectId: string, exportId: string) {
      assertExportId(exportId)
      const { sourcePath, projectDir, exportsDir } = await exportRoot(projectId)
      return { sourcePath, outputPath: join(exportsDir, `${exportId}.mp4`), trustedWorkDir: projectDir }
    },

    async listExports(projectId: string) {
      const { exportsDir } = await exportRoot(projectId)
      const entries = await readdir(exportsDir, { withFileTypes: true })
      const exports = await Promise.all(entries
        .filter((entry) => entry.isFile() && /^export_[a-z0-9]{16,64}\.mp4$/.test(entry.name))
        .map(async (entry) => {
          const exportId = entry.name.slice(0, -4)
          const published = await resolvePublishedExport(projectId, exportId)
          const info = await stat(published.path)
          return { exportId, size: published.size, modifiedAt: info.mtime.toISOString() }
        }))
      return exports.sort((left, right) => right.modifiedAt.localeCompare(left.modifiedAt))
    },

    async deleteExport(projectId: string, exportId: string) {
      const published = await resolvePublishedExport(projectId, exportId)
      await rm(published.path)
      await syncDirectory(dirname(published.path))
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
