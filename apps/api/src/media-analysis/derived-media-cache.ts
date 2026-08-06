import { randomBytes } from 'node:crypto'
import { lstat, mkdir, open, readdir, realpath, rename, rm, stat, utimes } from 'node:fs/promises'
import { join, resolve } from 'node:path'

import { AnalysisError, type AnalysisRequest, analysisCacheName } from './analysis-request.ts'

/**
 * Where finished thumbnails and waveforms are kept between requests.
 *
 * ## What this folder is, in one sentence
 *
 * A throwaway pile of pictures and numbers that can be deleted at any moment
 * with no effect whatsoever on the user's work.
 *
 * ```
 *   .sanverse-data/projects/<projectId>/
 *   ├── source.mp4            THE USER'S FOOTAGE          — never touched
 *   ├── edit-project.json     THE USER'S EDIT             — never touched
 *   ├── assets/               THE USER'S OTHER FILES      — never touched
 *   ├── exports/              FINISHED VIDEOS             — never touched
 *   └── derived-media/v1/     ← this. Delete it whenever you like.
 *       ├── frames/
 *       ├── images/
 *       └── waveforms/
 * ```
 *
 * It is deliberately NOT part of the project, NOT part of accepted history, and
 * NOT part of the key that decides whether an export can be reused. Deleting it
 * costs a few seconds of re-decoding the next time the timeline is scrolled, and
 * nothing else. That is the whole safety argument: if it is ever wrong, it can
 * be thrown away.
 *
 * ## Why not reuse the export cache
 *
 * The export cache answers "has this exact project already been rendered?" and
 * its answer is a finished video the user may download. Mixing thousands of
 * thumbnails into it would mean a full export cache could be pushed out by
 * scrolling, and a corrupt thumbnail would sit in the same place as a finished
 * film. Two different lifetimes, two different folders.
 *
 * ## The one number that bounds it
 *
 * A per-project ceiling on how many files may live here. When it is passed, the
 * ones that have gone longest without being wanted are removed — the same rule
 * as the browser's memory cache, for the same reason. Without it, a user who
 * scrubs through a sixty-minute project every day would fill their disk with
 * pictures nobody will look at again.
 */

export const DERIVED_MEDIA_DIRECTORY = join('derived-media', 'v1')

export type DerivedMediaKindFolder = 'frames' | 'images' | 'waveforms' | 'analysis'

const FOLDER_BY_KIND: Readonly<Record<AnalysisRequest['kind'], DerivedMediaKindFolder>> = Object.freeze({
  'filmstrip-frame': 'frames',
  'image-thumbnail': 'images',
  'waveform-block': 'waveforms',
  'audio-normalization': 'analysis',
})

export type DerivedMediaCacheOptions = Readonly<{
  /**
   * Most files kept per project.
   *
   * 4,000 at roughly 8 KB a thumbnail is about 32 MB per project — smaller than
   * a single minute of the footage it describes.
   */
  maxEntries?: number
  /** Cleanup runs after this many writes, not on every one. */
  sweepEveryWrites?: number
}>

export const DEFAULT_MAX_DERIVED_ENTRIES = 4_000
export const DEFAULT_SWEEP_EVERY_WRITES = 200

/** What a cached answer is: the bytes, and what to call them on the wire. */
export type DerivedArtifact = Readonly<{
  bytes: Buffer
  contentType: string
}>

export type DerivedMediaCache = Readonly<{
  read(projectId: string, request: AnalysisRequest): Promise<DerivedArtifact | null>
  write(projectId: string, request: AnalysisRequest, artifact: DerivedArtifact): Promise<void>
  /** Everything for one project. Used when a project is removed. */
  clearProject(projectId: string): Promise<void>
  /** Development diagnostics only. */
  count(projectId: string): Promise<number>
}>

/** The biggest a single cached answer may be, so a corrupt file cannot be read whole. */
const MAX_ARTIFACT_BYTES = 4 * 1024 * 1024

export const createDerivedMediaCache = (
  resolveProjectDirectory: (projectId: string) => Promise<string>,
  options: DerivedMediaCacheOptions = {},
): DerivedMediaCache => {
  const maxEntries = Math.max(16, Math.floor(options.maxEntries ?? DEFAULT_MAX_DERIVED_ENTRIES))
  const sweepEvery = Math.max(1, Math.floor(options.sweepEveryWrites ?? DEFAULT_SWEEP_EVERY_WRITES))
  const writesSinceSweep = new Map<string, number>()

  const root = async (projectId: string): Promise<string> => {
    const projectDirectory = await resolveProjectDirectory(projectId)
    const path = join(projectDirectory, DERIVED_MEDIA_DIRECTORY)
    await mkdir(path, { recursive: true })
    // The same check the exporter's folder gets: if something replaced this
    // directory with a link, writing through it would write somewhere else.
    const actual = await realpath(path)
    if (resolve(actual) !== resolve(path)) {
      throw new AnalysisError('ANALYSIS_CACHE_CORRUPT', 'The preview store is not in a safe place.', 500)
    }
    return path
  }

  const folderFor = async (projectId: string, request: AnalysisRequest): Promise<string> => {
    const path = join(await root(projectId), FOLDER_BY_KIND[request.kind])
    await mkdir(path, { recursive: true })
    return path
  }

  /**
   * Throw away the least-recently-wanted files until the project is under its
   * ceiling.
   *
   * "Least recently wanted" is read from the file's own modified time, which is
   * touched every time an answer is served from here. So a thumbnail that is on
   * screen every day stays, and one visited once a month goes first.
   */
  const sweep = async (projectId: string): Promise<void> => {
    const base = await root(projectId)
    const files: { path: string; at: number }[] = []
    for (const folder of Object.values(FOLDER_BY_KIND)) {
      const directory = join(base, folder)
      const entries = await readdir(directory, { withFileTypes: true }).catch(() => [])
      for (const entry of entries) {
        if (!entry.isFile()) continue
        const path = join(directory, entry.name)
        // Strays from an interrupted write are never candidates for keeping.
        if (!/^[a-f0-9]{64}(\.webp|\.jpg|\.json)$/.test(entry.name)) {
          await rm(path, { force: true }).catch(() => undefined)
          continue
        }
        const info = await stat(path).catch(() => null)
        if (info) files.push({ path, at: info.mtimeMs })
      }
    }
    if (files.length <= maxEntries) return
    files.sort((left, right) => left.at - right.at)
    const doomed = files.slice(0, files.length - maxEntries)
    for (const file of doomed) await rm(file.path, { force: true }).catch(() => undefined)
  }

  return Object.freeze({
    async read(projectId, request) {
      const directory = await folderFor(projectId, request)
      const extension = request.kind === 'waveform-block' || request.kind === 'audio-normalization' ? '.json' : '.webp'
      const path = join(directory, `${analysisCacheName(request)}${extension}`)
      let handle
      try {
        const info = await lstat(path)
        // A link, a directory, an empty file, or one too big to be what we wrote
        // is not a cache hit — it is damage. It is removed and made again rather
        // than being served or being left to fail the same way forever.
        if (!info.isFile() || info.size <= 0 || info.size > MAX_ARTIFACT_BYTES || info.nlink !== 1) {
          await rm(path, { force: true }).catch(() => undefined)
          return null
        }
        handle = await open(path, 'r')
        const bytes = await handle.readFile()
        if (bytes.byteLength === 0) {
          await rm(path, { force: true }).catch(() => undefined)
          return null
        }
        if (request.kind === 'waveform-block' || request.kind === 'audio-normalization') {
          // Numbers that no longer parse are corruption, not an answer.
          try { JSON.parse(bytes.toString('utf8')) }
          catch {
            await rm(path, { force: true }).catch(() => undefined)
            return null
          }
        }
        // Touched so the sweep above can tell what is still being used.
        const now = new Date()
        await utimes(path, now, now).catch(() => undefined)
        return Object.freeze({
          bytes,
          contentType: request.kind === 'waveform-block' || request.kind === 'audio-normalization'
            ? 'application/json; charset=utf-8'
            : 'image/webp',
        })
      } catch (error) {
        if (error instanceof AnalysisError) throw error
        return null
      } finally {
        await handle?.close().catch(() => undefined)
      }
    },

    async write(projectId, request, artifact) {
      if (artifact.bytes.byteLength <= 0 || artifact.bytes.byteLength > MAX_ARTIFACT_BYTES) return
      const directory = await folderFor(projectId, request)
      const extension = request.kind === 'waveform-block' || request.kind === 'audio-normalization' ? '.json' : '.webp'
      const finalPath = join(directory, `${analysisCacheName(request)}${extension}`)
      const temporaryPath = join(directory, `.tmp-${randomBytes(12).toString('hex')}`)
      let handle
      try {
        // Written under a name nothing reads, flushed, then renamed. A crash
        // halfway through leaves a stray temporary file the sweep removes — it
        // can never leave a half-written picture under the real name, which
        // would be served forever as if it were whole.
        handle = await open(temporaryPath, 'wx', 0o600)
        await handle.writeFile(artifact.bytes)
        await handle.sync()
        await handle.close()
        handle = undefined
        await rename(temporaryPath, finalPath)
      } catch {
        await handle?.close().catch(() => undefined)
        await rm(temporaryPath, { force: true }).catch(() => undefined)
        // A cache that cannot be written is a slower editor, never a broken one.
        return
      }
      const written = (writesSinceSweep.get(projectId) ?? 0) + 1
      if (written >= sweepEvery) {
        writesSinceSweep.set(projectId, 0)
        await sweep(projectId).catch(() => undefined)
      } else {
        writesSinceSweep.set(projectId, written)
      }
    },

    async clearProject(projectId) {
      const projectDirectory = await resolveProjectDirectory(projectId).catch(() => null)
      if (projectDirectory === null) return
      writesSinceSweep.delete(projectId)
      await rm(join(projectDirectory, DERIVED_MEDIA_DIRECTORY), { recursive: true, force: true }).catch(() => undefined)
    },

    async count(projectId) {
      const base = await root(projectId).catch(() => null)
      if (base === null) return 0
      let total = 0
      for (const folder of Object.values(FOLDER_BY_KIND)) {
        const entries = await readdir(join(base, folder), { withFileTypes: true }).catch(() => [])
        total += entries.filter((entry) => entry.isFile() && !entry.name.startsWith('.tmp-')).length
      }
      return total
    },
  })
}
