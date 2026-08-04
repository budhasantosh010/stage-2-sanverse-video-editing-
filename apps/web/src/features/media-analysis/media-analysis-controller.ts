import { createBoundedCache, type BoundedCache } from './bounded-cache'
import {
  AnalysisRefusalError,
  isMissingRefusal,
  type AnalysisRefusal,
  type DerivedMediaResource,
  type MediaAnalysisClient,
} from './media-analysis-client'
import { mediaAnalysisKeyId, type MediaAnalysisKeyV1 } from './media-analysis-key'

/**
 * The ONE thing in the browser that decides what derived media is fetched, when,
 * how much at a time, and what is kept.
 *
 * ## Why there is exactly one of these
 *
 * If every clip fetched its own thumbnails, a hundred clips would open a hundred
 * connections, the same moment of the same recording would be asked for by every
 * clip that shows it, and nothing could ever be cancelled — because no single
 * piece of code would know that the user had scrolled away.
 *
 * So the timeline says, in one sentence, WHAT IT WANTS RIGHT NOW, and this
 * decides everything else:
 *
 * ```
 *   timeline: "I want these 180 things, in this order of importance."
 *        │
 *        ├─ 120 are already made        → answered instantly, no request
 *        ├─  20 are already being made  → joined, no second request
 *        ├─   6 start now               → the most important six
 *        ├─  34 wait their turn
 *        └─ anything in flight that is NOT on the list is stopped
 * ```
 *
 * ## What it will never do
 *
 * It never touches the project. Nothing here creates an operation, a change set,
 * a revision, or an entry in Undo. A thumbnail is not an edit, and a user who
 * pressed Undo expecting to take back a cut must never take back a picture.
 */

/**
 * How many things may be asked for at once.
 *
 * Six, which is what a browser allows to one address over an ordinary
 * connection anyway. Asking for more does not make anything arrive sooner — the
 * extra requests simply queue inside the browser instead of here, where they
 * could not be cancelled or reordered.
 */
export const MAX_IN_FLIGHT_REQUESTS = 6

/** How many finished pictures are held. See `bounded-cache.ts` for why a count. */
export const MAX_CACHED_PICTURES = 600
/** Blocks of loudness numbers. Each is a few hundred small numbers. */
export const MAX_CACHED_PEAK_BLOCKS = 1_200

/**
 * How important one piece of derived media is. Smaller is sooner.
 *
 * The order is the order a person notices things in: what they have selected,
 * then what they can see, then what is about to come into view.
 */
export const ANALYSIS_PRIORITY = Object.freeze({
  selected: 0,
  visible: 1,
  nearOverscan: 2,
  farOverscan: 3,
})

export type WantedAnalysis = Readonly<{
  key: MediaAnalysisKeyV1
  priority: number
}>

export type MediaAnalysisDiagnostics = Readonly<{
  pictureCacheSize: number
  peakCacheSize: number
  inFlight: number
  queued: number
  disposedPictures: number
  abortedRequests: number
  completedRequests: number
  failedRequests: number
  generation: number
}>

export type MediaAnalysisController = Readonly<{
  /**
   * Replace the whole list of what the timeline currently wants.
   *
   * One call, one authority. Anything being fetched that is not on the new list
   * is stopped; anything already made stays made.
   */
  setWanted(projectId: string, wanted: readonly WantedAnalysis[]): void
  /** What is known about one piece right now. Pure: never starts work. */
  picture(keyId: string): DerivedMediaResource<ImageBitmap>
  peaks(keyId: string): DerivedMediaResource<readonly number[]>
  /** Ask again for something that failed. */
  retry(keyId: string): void
  subscribe(listener: () => void): () => void
  /** Increments whenever anything changes, for `useSyncExternalStore`. */
  version(): number
  diagnostics(): MediaAnalysisDiagnostics
  /** Everything released: bitmaps closed, requests aborted, caches emptied. */
  dispose(): void
}>

type Pending = Readonly<{
  key: MediaAnalysisKeyV1
  priority: number
}>

type Failure = Readonly<{ refusal: AnalysisRefusal; missing: boolean }>

export const createMediaAnalysisController = (options: Readonly<{
  client: MediaAnalysisClient
  maxInFlight?: number
  maxPictures?: number
  maxPeakBlocks?: number
}>): MediaAnalysisController => {
  const maxInFlight = Math.max(1, options.maxInFlight ?? MAX_IN_FLIGHT_REQUESTS)
  let disposedPictures = 0
  let abortedRequests = 0
  let completedRequests = 0
  let failedRequests = 0
  let generation = 0
  let version = 0
  let projectId: string | null = null

  // An ImageBitmap holds memory the browser only frees when told, so every one
  // that leaves the cache is closed on the way out. Counting them is what makes
  // "nothing leaked" something that can be asserted rather than hoped.
  const pictures: BoundedCache<ImageBitmap> = createBoundedCache<ImageBitmap>({
    maxEntries: options.maxPictures ?? MAX_CACHED_PICTURES,
    dispose: (bitmap) => {
      disposedPictures += 1
      bitmap.close?.()
    },
  })
  const peakBlocks: BoundedCache<readonly number[]> = createBoundedCache<readonly number[]>({
    maxEntries: options.maxPeakBlocks ?? MAX_CACHED_PEAK_BLOCKS,
  })

  const inFlight = new Map<string, AbortController>()
  const queue = new Map<string, Pending>()
  const failures = new Map<string, Failure>()
  const listeners = new Set<() => void>()

  const announce = (): void => {
    version += 1
    for (const listener of listeners) listener()
  }

  const isPicture = (key: MediaAnalysisKeyV1): boolean => key.kind !== 'waveform-block'

  const has = (key: MediaAnalysisKeyV1, keyId: string): boolean =>
    isPicture(key) ? pictures.has(keyId) : peakBlocks.has(keyId)

  const start = (keyId: string, pending: Pending): void => {
    const currentProject = projectId
    if (currentProject === null) return
    const startedGeneration = generation
    const controller = new AbortController()
    inFlight.set(keyId, controller)

    const finish = (apply: () => void): void => {
      inFlight.delete(keyId)
      // A result that arrived after the project changed underneath it belongs to
      // a project that is no longer open. Applying it would put one project's
      // pictures on another's timeline.
      if (projectId !== currentProject) return
      apply()
      pump()
      announce()
    }

    const work = isPicture(pending.key)
      ? options.client.picture(currentProject, pending.key, controller.signal)
        .then((bitmap) => finish(() => {
          if (generation !== startedGeneration && !queue.has(keyId) && !pictures.has(keyId)) {
            // Nothing wants it any more and nothing has it: close it rather
            // than caching a picture of somewhere the user has scrolled past.
            disposedPictures += 1
            bitmap.close?.()
            return
          }
          completedRequests += 1
          failures.delete(keyId)
          pictures.set(keyId, bitmap)
        }))
      : options.client.peaks(currentProject, pending.key, controller.signal)
        .then((values) => finish(() => {
          completedRequests += 1
          failures.delete(keyId)
          peakBlocks.set(keyId, values)
        }))

    void work.catch((error: unknown) => {
      finish(() => {
        if (controller.signal.aborted) {
          abortedRequests += 1
          return
        }
        failedRequests += 1
        const refusal: AnalysisRefusal = error instanceof AnalysisRefusalError
          ? error.refusal
          : Object.freeze({ code: 'DECODER_FAILED', message: 'That preview could not be made.' })
        failures.set(keyId, Object.freeze({ refusal, missing: isMissingRefusal(refusal.code) }))
      })
    })
  }

  /** Fill every free slot with the most important thing still waiting. */
  const pump = (): void => {
    if (inFlight.size >= maxInFlight || queue.size === 0) return
    const ordered = [...queue.entries()].sort((left, right) => left[1].priority - right[1].priority)
    for (const [keyId, pending] of ordered) {
      if (inFlight.size >= maxInFlight) return
      queue.delete(keyId)
      if (has(pending.key, keyId) || inFlight.has(keyId)) continue
      start(keyId, pending)
    }
  }

  const clearCaches = (): void => {
    pictures.clear()
    peakBlocks.clear()
    failures.clear()
    queue.clear()
  }

  const abortAll = (): void => {
    for (const controller of inFlight.values()) {
      abortedRequests += 1
      controller.abort()
    }
    inFlight.clear()
  }

  return Object.freeze({
    setWanted(nextProjectId, wanted) {
      if (nextProjectId !== projectId) {
        // A different project shares nothing with this one. Everything held is
        // released rather than lingering as memory for a project nobody is
        // looking at.
        abortAll()
        clearCaches()
        projectId = nextProjectId
      }
      generation += 1

      const wantedIds = new Set<string>()
      queue.clear()
      for (const entry of wanted) {
        const keyId = mediaAnalysisKeyId(entry.key)
        wantedIds.add(keyId)
        if (has(entry.key, keyId)) continue
        if (inFlight.has(keyId)) continue
        // A failure is remembered so the same doomed request is not made a
        // hundred times a second while the clip stays on screen. `retry` is the
        // deliberate way back.
        if (failures.has(keyId)) continue
        const existing = queue.get(keyId)
        if (existing === undefined || entry.priority < existing.priority) {
          queue.set(keyId, Object.freeze({ key: entry.key, priority: entry.priority }))
        }
      }

      // Anything still being fetched that nobody wants any more is stopped. This
      // is what keeps a fast scroll from finishing hundreds of requests for
      // parts of the timeline that went past long ago.
      for (const [keyId, controller] of [...inFlight.entries()]) {
        if (wantedIds.has(keyId)) continue
        abortedRequests += 1
        controller.abort()
        inFlight.delete(keyId)
      }

      pump()
      announce()
    },

    picture(keyId) {
      const ready = pictures.get(keyId)
      if (ready !== undefined) return Object.freeze({ status: 'ready' as const, value: ready })
      const failure = failures.get(keyId)
      if (failure) {
        return failure.missing
          ? Object.freeze({ status: 'missing' as const })
          : Object.freeze({ status: 'error' as const, refusal: failure.refusal })
      }
      if (inFlight.has(keyId) || queue.has(keyId)) return Object.freeze({ status: 'loading' as const })
      return Object.freeze({ status: 'idle' as const })
    },

    peaks(keyId) {
      const ready = peakBlocks.get(keyId)
      if (ready !== undefined) return Object.freeze({ status: 'ready' as const, value: ready })
      const failure = failures.get(keyId)
      if (failure) {
        return failure.missing
          ? Object.freeze({ status: 'missing' as const })
          : Object.freeze({ status: 'error' as const, refusal: failure.refusal })
      }
      if (inFlight.has(keyId) || queue.has(keyId)) return Object.freeze({ status: 'loading' as const })
      return Object.freeze({ status: 'idle' as const })
    },

    retry(keyId) {
      if (!failures.delete(keyId)) return
      announce()
    },

    subscribe(listener) {
      listeners.add(listener)
      return () => { listeners.delete(listener) }
    },

    version: () => version,

    diagnostics: () => Object.freeze({
      pictureCacheSize: pictures.size,
      peakCacheSize: peakBlocks.size,
      inFlight: inFlight.size,
      queued: queue.size,
      disposedPictures,
      abortedRequests,
      completedRequests,
      failedRequests,
      generation,
    }),

    dispose() {
      abortAll()
      clearCaches()
      listeners.clear()
      projectId = null
      version += 1
    },
  })
}
