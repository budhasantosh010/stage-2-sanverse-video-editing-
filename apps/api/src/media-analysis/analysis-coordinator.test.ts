import { describe, expect, it, vi } from 'vitest'

import { AnalysisError } from './analysis-request.ts'
import {
  createAnalysisCoordinator,
  DEFAULT_ANALYSIS_LIMITS,
  resolveAnalysisLimits,
} from './analysis-coordinator.ts'

/**
 * Gate D — that decoding cannot flood the machine.
 *
 * The failure this guards against is not "slow". It is a laptop that stops
 * responding because a timeline asked for a hundred thumbnails at once and a
 * hundred programs started together.
 */

/** A job that can be finished on command, so concurrency can be observed. */
const controllable = () => {
  let release: () => void = () => undefined
  let fail: (error: unknown) => void = () => undefined
  const promise = new Promise<string>((resolve, reject) => {
    release = () => resolve('done')
    fail = reject
  })
  return { promise, release, fail }
}

const settle = () => new Promise((resolve) => setTimeout(resolve, 0))

describe('how much decoding may happen at once', () => {
  it('runs at most two pictures together and queues the rest', async () => {
    const coordinator = createAnalysisCoordinator({ ...DEFAULT_ANALYSIS_LIMITS })
    const jobs = [controllable(), controllable(), controllable(), controllable()]
    let started = 0

    const running = jobs.map((job, index) => coordinator.run({
      lane: 'frame',
      jobId: `job-${index}`,
      work: async () => { started += 1; return job.promise },
    }))

    await settle()
    expect(started).toBe(2)
    expect(coordinator.diagnostics().activeFrames).toBe(2)
    expect(coordinator.diagnostics().queued).toBe(2)

    jobs[0].release()
    await settle()
    expect(started).toBe(3)

    jobs[1].release(); jobs[2].release(); jobs[3].release()
    await Promise.all(running)
    expect(coordinator.diagnostics().activeFrames).toBe(0)
  })

  it('counts sound separately, so pictures cannot be starved out', async () => {
    const coordinator = createAnalysisCoordinator({ ...DEFAULT_ANALYSIS_LIMITS })
    const sound = [controllable(), controllable()]
    const picture = controllable()
    let soundStarted = 0
    let pictureStarted = 0

    const running = [
      coordinator.run({ lane: 'waveform', jobId: 's0', work: async () => { soundStarted += 1; return sound[0].promise } }),
      coordinator.run({ lane: 'waveform', jobId: 's1', work: async () => { soundStarted += 1; return sound[1].promise } }),
      coordinator.run({ lane: 'frame', jobId: 'p0', work: async () => { pictureStarted += 1; return picture.promise } }),
    ]

    await settle()
    expect(soundStarted).toBe(1)
    // The picture starts even though the sound lane is full: that is the whole
    // point of two limits rather than one.
    expect(pictureStarted).toBe(1)

    sound[0].release(); sound[1].release(); picture.release()
    await Promise.all(running)
  })

  it('runs prepared video artifacts one-at-a-time without blocking frames or waveforms', async () => {
    const coordinator = createAnalysisCoordinator({ ...DEFAULT_ANALYSIS_LIMITS })
    const videos = [controllable(), controllable()]
    const picture = controllable()
    const sound = controllable()
    let videoStarted = 0
    let pictureStarted = 0
    let soundStarted = 0

    const running = [
      coordinator.run({ lane: 'video', jobId: 'v0', work: async () => { videoStarted += 1; return videos[0].promise } }),
      coordinator.run({ lane: 'video', jobId: 'v1', work: async () => { videoStarted += 1; return videos[1].promise } }),
      coordinator.run({ lane: 'frame', jobId: 'p0', work: async () => { pictureStarted += 1; return picture.promise } }),
      coordinator.run({ lane: 'waveform', jobId: 's0', work: async () => { soundStarted += 1; return sound.promise } }),
    ]

    await settle()
    expect(videoStarted).toBe(1)
    expect(pictureStarted).toBe(1)
    expect(soundStarted).toBe(1)
    expect(coordinator.diagnostics()).toMatchObject({ activeVideos: 1, activeFrames: 1, activeWaveforms: 1 })

    videos[0].release()
    await settle()
    expect(videoStarted).toBe(2)
    videos[1].release(); picture.release(); sound.release()
    await Promise.all(running)
    expect(coordinator.diagnostics().activeVideos).toBe(0)
  })

  it('turns ten requests for the same thing into one job', async () => {
    const coordinator = createAnalysisCoordinator({ ...DEFAULT_ANALYSIS_LIMITS })
    const job = controllable()
    const work = vi.fn(async () => job.promise)

    const running = Array.from({ length: 10 }, () =>
      coordinator.run({ lane: 'frame', jobId: 'same', work }))
    await settle()

    expect(work).toHaveBeenCalledTimes(1)
    expect(coordinator.diagnostics().sharedJobs).toBe(1)

    job.release()
    expect(await Promise.all(running)).toEqual(Array.from({ length: 10 }, () => 'done'))
  })

  it('refuses truthfully rather than building an unbounded backlog', async () => {
    const coordinator = createAnalysisCoordinator({ ...DEFAULT_ANALYSIS_LIMITS, maxQueued: 2 })
    const jobs = Array.from({ length: 6 }, () => controllable())
    const running = jobs.map((job, index) => coordinator.run({
      lane: 'frame',
      jobId: `job-${index}`,
      work: async () => job.promise,
    }).catch((error: unknown) => error))

    await settle()
    const settled = await Promise.all(running.slice(4).map(async (entry) => entry))
    // Two running, two queued, and the rest told plainly that the editor is busy.
    for (const outcome of settled) {
      expect(outcome).toBeInstanceOf(AnalysisError)
      expect((outcome as AnalysisError).code).toBe('ANALYSIS_LIMIT_EXCEEDED')
    }
    for (const job of jobs) job.release()
    await Promise.allSettled(running)
  })

  it('stops work when the last person waiting for it goes away', async () => {
    const coordinator = createAnalysisCoordinator({ ...DEFAULT_ANALYSIS_LIMITS })
    const caller = new AbortController()
    const seen: { signal: AbortSignal | null } = { signal: null }
    const job = controllable()

    const running = coordinator.run({
      lane: 'frame',
      jobId: 'abandoned',
      signal: caller.signal,
      work: async (signal) => { seen.signal = signal; return job.promise },
    }).catch(() => 'stopped')

    await settle()
    expect(seen.signal?.aborted).toBe(false)
    caller.abort()
    await settle()
    // Nobody is going to look at the answer, so the decoder is stopped rather
    // than finishing into nothing.
    expect(seen.signal?.aborted).toBe(true)
    job.release()
    await running
  })

  it('keeps working while somebody else still wants the same thing', async () => {
    const coordinator = createAnalysisCoordinator({ ...DEFAULT_ANALYSIS_LIMITS })
    const leaving = new AbortController()
    const seen: { signal: AbortSignal | null } = { signal: null }
    const job = controllable()
    const work = async (signal: AbortSignal) => { seen.signal = signal; return job.promise }

    const first = coordinator.run({ lane: 'frame', jobId: 'shared', signal: leaving.signal, work })
      .catch(() => 'stopped')
    const second = coordinator.run({ lane: 'frame', jobId: 'shared', work })

    await settle()
    leaving.abort()
    await settle()
    expect(seen.signal?.aborted).toBe(false)

    job.release()
    expect(await second).toBe('done')
    await first
  })

  it('kills a decoder that is stuck rather than holding it forever', async () => {
    vi.useFakeTimers()
    try {
      const coordinator = createAnalysisCoordinator({ ...DEFAULT_ANALYSIS_LIMITS, timeoutMs: 1_000 })
      const seen: { signal: AbortSignal | null } = { signal: null }
      const stuck = coordinator.run({
        lane: 'frame',
        jobId: 'stuck',
        work: async (signal) => {
          seen.signal = signal
          return new Promise<string>((resolve) => {
            signal.addEventListener('abort', () => resolve('killed'), { once: true })
          })
        },
      })
      await vi.advanceTimersByTimeAsync(0)
      expect(seen.signal?.aborted).toBe(false)
      await vi.advanceTimersByTimeAsync(1_001)
      expect(seen.signal?.aborted).toBe(true)
      expect(await stuck).toBe('killed')
    } finally {
      vi.useRealTimers()
    }
  })

  it('frees its slot even when the work fails', async () => {
    const coordinator = createAnalysisCoordinator({ ...DEFAULT_ANALYSIS_LIMITS })
    await expect(coordinator.run({
      lane: 'frame',
      jobId: 'broken',
      work: async () => { throw new Error('decoder died') },
    })).rejects.toThrow('decoder died')
    // A failure that leaked its slot would shrink the pool by one every time
    // until nothing could ever be decoded again.
    expect(coordinator.diagnostics().activeFrames).toBe(0)
    expect(coordinator.diagnostics().sharedJobs).toBe(0)
  })
})

describe('limits read from the environment', () => {
  it('uses the conservative defaults when nothing is configured', () => {
    expect(resolveAnalysisLimits({})).toEqual(DEFAULT_ANALYSIS_LIMITS)
  })

  it('accepts a deliberate raise on a stronger machine', () => {
    expect(resolveAnalysisLimits({ SANVERSE_ANALYSIS_MAX_FRAMES: '8' }).maxConcurrentFrames).toBe(8)
  })

  it('refuses a typo instead of quietly using the default', () => {
    // A typo that silently halved the editor's speed would be a fault nobody
    // could explain afterwards.
    expect(() => resolveAnalysisLimits({ SANVERSE_ANALYSIS_MAX_FRAMES: 'two' })).toThrow()
    expect(() => resolveAnalysisLimits({ SANVERSE_ANALYSIS_MAX_FRAMES: '0' })).toThrow()
    expect(() => resolveAnalysisLimits({ SANVERSE_ANALYSIS_TIMEOUT_MS: '10' })).toThrow()
  })
})
