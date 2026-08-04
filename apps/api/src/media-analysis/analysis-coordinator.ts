import { AnalysisError } from './analysis-request.ts'

/**
 * The one place that decides how much decoding may happen at once.
 *
 * ## The failure this exists to prevent
 *
 * A timeline showing a hundred pieces of footage asks for a hundred thumbnails
 * in the same instant. Without this, that is a hundred FFmpeg programs starting
 * together. On an ordinary laptop that is not "slow" — it is a machine that
 * stops responding, with the user's own video playback starving alongside it.
 *
 * So work goes through one door:
 *
 * ```
 *   100 requests arrive at once
 *        │
 *        ├─ 40 of them are asking for something ALREADY BEING MADE
 *        │     → they wait on that same job. No second program starts.
 *        │
 *        ├─ 60 distinct jobs
 *        │     → at most 2 pictures and 1 stretch of sound run at a time
 *        │     → the rest wait in a queue with a ceiling
 *        │
 *        └─ if the queue is already full
 *              → a truthful refusal, not an unbounded backlog
 * ```
 *
 * ## Why two separate limits
 *
 * Pulling one frame out of a video is a seek and a decode: short, and mostly
 * disk. Decoding a stretch of sound reads more of the file and does more work
 * per second of media. Giving them one shared limit would let three sound jobs
 * fill the machine while no picture appeared at all — the timeline would look
 * broken while it was in fact busy.
 *
 * ## Why nothing is left running
 *
 * Every job carries a stop signal. It is pulled when the last thing waiting on
 * that job goes away — the user scrolled past, or closed the tab — and again
 * after a fixed time, so a decoder stuck on a damaged file is killed rather than
 * held forever.
 */

export type AnalysisLane = 'frame' | 'waveform'

export type AnalysisCoordinatorLimits = Readonly<{
  /** Pictures being made at once. Images count here too: same short job. */
  maxConcurrentFrames: number
  /** Stretches of sound being decoded at once. */
  maxConcurrentWaveforms: number
  /** Jobs allowed to be waiting. Past this the answer is a refusal. */
  maxQueued: number
  /** How long one job may take before it is killed. */
  timeoutMs: number
}>

export const DEFAULT_ANALYSIS_LIMITS: AnalysisCoordinatorLimits = Object.freeze({
  maxConcurrentFrames: 2,
  maxConcurrentWaveforms: 1,
  maxQueued: 64,
  timeoutMs: 20_000,
})

/**
 * Limits read from the environment, refusing anything that is not a sensible
 * whole number rather than falling back silently.
 *
 * A machine with sixteen cores can raise these. A typo must not quietly halve
 * the editor's speed and leave nobody able to explain why.
 */
export const resolveAnalysisLimits = (
  environment: Readonly<Record<string, string | undefined>>,
): AnalysisCoordinatorLimits => {
  const read = (name: string, fallback: number, low: number, high: number): number => {
    const raw = environment[name]
    if (raw === undefined) return fallback
    const parsed = Number(raw)
    if (!Number.isSafeInteger(parsed) || parsed < low || parsed > high) {
      throw new Error(`${name} must be a whole number between ${low} and ${high}.`)
    }
    return parsed
  }
  return Object.freeze({
    maxConcurrentFrames: read('SANVERSE_ANALYSIS_MAX_FRAMES', DEFAULT_ANALYSIS_LIMITS.maxConcurrentFrames, 1, 16),
    maxConcurrentWaveforms: read('SANVERSE_ANALYSIS_MAX_WAVEFORMS', DEFAULT_ANALYSIS_LIMITS.maxConcurrentWaveforms, 1, 8),
    maxQueued: read('SANVERSE_ANALYSIS_MAX_QUEUED', DEFAULT_ANALYSIS_LIMITS.maxQueued, 1, 1024),
    timeoutMs: read('SANVERSE_ANALYSIS_TIMEOUT_MS', DEFAULT_ANALYSIS_LIMITS.timeoutMs, 1_000, 120_000),
  })
}

export type AnalysisDiagnostics = Readonly<{
  activeFrames: number
  activeWaveforms: number
  queued: number
  sharedJobs: number
}>

export type AnalysisCoordinator = Readonly<{
  run<T>(input: Readonly<{
    lane: AnalysisLane
    jobId: string
    signal?: AbortSignal
    work: (signal: AbortSignal) => Promise<T>
  }>): Promise<T>
  diagnostics(): AnalysisDiagnostics
}>

type Job = {
  readonly controller: AbortController
  readonly promise: Promise<unknown>
  waiters: number
}

export const createAnalysisCoordinator = (
  limits: AnalysisCoordinatorLimits = DEFAULT_ANALYSIS_LIMITS,
): AnalysisCoordinator => {
  const jobs = new Map<string, Job>()
  const active: Record<AnalysisLane, number> = { frame: 0, waveform: 0 }
  const waiting: Record<AnalysisLane, (() => void)[]> = { frame: [], waveform: [] }
  let queued = 0

  const ceiling = (lane: AnalysisLane): number =>
    lane === 'frame' ? limits.maxConcurrentFrames : limits.maxConcurrentWaveforms

  const acquire = async (lane: AnalysisLane): Promise<void> => {
    if (active[lane] < ceiling(lane)) {
      active[lane] += 1
      return
    }
    if (queued >= limits.maxQueued) {
      throw new AnalysisError(
        'ANALYSIS_LIMIT_EXCEEDED',
        'The editor is already making as many previews as it can. Try again in a moment.',
        429,
      )
    }
    queued += 1
    try {
      await new Promise<void>((release) => { waiting[lane].push(release) })
    } finally {
      queued -= 1
    }
    active[lane] += 1
  }

  const release = (lane: AnalysisLane): void => {
    active[lane] = Math.max(0, active[lane] - 1)
    const next = waiting[lane].shift()
    if (next) next()
  }

  const start = <T>(lane: AnalysisLane, jobId: string, work: (signal: AbortSignal) => Promise<T>): Job => {
    const controller = new AbortController()
    const promise = (async (): Promise<T> => {
      await acquire(lane)
      // A stuck decoder is killed rather than held. The timer is cleared in the
      // finally below, so a job that finished normally never leaves a timer
      // behind that would fire into nothing.
      const timer = setTimeout(() => controller.abort(), limits.timeoutMs)
      try {
        if (controller.signal.aborted) {
          throw new AnalysisError('ANALYSIS_CANCELLED', 'That preview was no longer needed.', 499)
        }
        return await work(controller.signal)
      } finally {
        clearTimeout(timer)
        release(lane)
        jobs.delete(jobId)
      }
    })()
    // Nothing else may be attached to this promise here: an unhandled rejection
    // is silenced by giving it a no-op catch, and every real waiter attaches its
    // own handler below.
    promise.catch(() => undefined)
    return { controller, promise, waiters: 0 }
  }

  return Object.freeze({
    async run<T>(input: Readonly<{
      lane: AnalysisLane
      jobId: string
      signal?: AbortSignal
      work: (signal: AbortSignal) => Promise<T>
    }>): Promise<T> {
      // Ten clips showing the same moment of the same recording are ONE job.
      // This is what makes a split cost nothing and a shot used twice cost once.
      const existing = jobs.get(input.jobId)
      const job = existing ?? start(input.lane, input.jobId, input.work)
      if (!existing) jobs.set(input.jobId, job)
      job.waiters += 1

      const forget = () => {
        job.waiters -= 1
        // The last person who wanted this has gone. Nobody is going to look at
        // the answer, so the work is stopped instead of finishing into nothing.
        if (job.waiters <= 0 && jobs.get(input.jobId) === job) job.controller.abort()
      }
      const onCallerAbort = () => forget()
      input.signal?.addEventListener('abort', onCallerAbort, { once: true })

      try {
        if (input.signal?.aborted) {
          forget()
          throw new AnalysisError('ANALYSIS_CANCELLED', 'That preview was no longer needed.', 499)
        }
        return await (job.promise as Promise<T>)
      } finally {
        input.signal?.removeEventListener('abort', onCallerAbort)
        if (!input.signal?.aborted) job.waiters -= 1
      }
    },

    diagnostics: (): AnalysisDiagnostics => Object.freeze({
      activeFrames: active.frame,
      activeWaveforms: active.waveform,
      queued,
      sharedJobs: jobs.size,
    }),
  })
}
