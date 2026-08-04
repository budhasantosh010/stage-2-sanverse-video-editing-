import { describe, expect, it, vi } from 'vitest'

import { PROJECT_TIMESCALE } from '@sanverse/edit-domain'

import {
  AnalysisRefusalError,
  type MediaAnalysisClient,
} from './media-analysis-client'
import {
  ANALYSIS_PRIORITY,
  createMediaAnalysisController,
} from './media-analysis-controller'
import {
  filmstripFrameKey,
  mediaAnalysisKeyId,
  waveformBlockKey,
  type MediaAnalysisKeyV1,
} from './media-analysis-key'

/**
 * Gate D — that the browser cannot flood itself, and cannot leak.
 *
 * Every failure here is one a user would experience as "the editor is stuck":
 * hundreds of requests fired at once, work continuing for parts of the timeline
 * scrolled past long ago, and memory that never comes back.
 */

const T = PROJECT_TIMESCALE
const A = 'a'.repeat(16)
const PROJECT = 'project_aaaaaaaaaaaaaaaa'

/** A picture that can say whether it was released. */
const fakeBitmap = (): ImageBitmap & { closed: boolean } => {
  const bitmap = {
    width: 64,
    height: 36,
    closed: false,
    close() { bitmap.closed = true },
  }
  return bitmap as unknown as ImageBitmap & { closed: boolean }
}

const frameKey = (sourceTicks: number, assetId = 'asset_aaaaaaaa'): MediaAnalysisKeyV1 =>
  filmstripFrameKey({ assetId, assetVersion: A, sourceTicks, widthPx: 64 })

/** A client whose answers arrive only when the test says so. */
const controllableClient = () => {
  const pending = new Map<string, { resolve: (value: never) => void; reject: (error: unknown) => void; signal: AbortSignal }>()
  const asked: string[] = []
  const client: MediaAnalysisClient = {
    picture: (_projectId, key, signal) => new Promise((resolve, reject) => {
      const id = mediaAnalysisKeyId(key)
      asked.push(id)
      pending.set(id, { resolve: resolve as (value: never) => void, reject, signal })
    }),
    peaks: (_projectId, key, signal) => new Promise((resolve, reject) => {
      const id = mediaAnalysisKeyId(key)
      asked.push(id)
      pending.set(id, { resolve: resolve as (value: never) => void, reject, signal })
    }),
  }
  return { client, pending, asked }
}

const settle = () => new Promise((resolve) => setTimeout(resolve, 0))

describe('asking for only what is wanted', () => {
  it('starts no more than six at once, whatever it is handed', async () => {
    const { client, asked } = controllableClient()
    const controller = createMediaAnalysisController({ client })

    controller.setWanted(PROJECT, Array.from({ length: 50 }, (_unused, index) => ({
      key: frameKey(index * T),
      priority: ANALYSIS_PRIORITY.visible,
    })))
    await settle()

    expect(asked).toHaveLength(6)
    expect(controller.diagnostics().inFlight).toBe(6)
    expect(controller.diagnostics().queued).toBe(44)
  })

  it('starts the most important first', async () => {
    const { client, asked } = controllableClient()
    const controller = createMediaAnalysisController({ client, maxInFlight: 2 })

    controller.setWanted(PROJECT, [
      { key: frameKey(9 * T), priority: ANALYSIS_PRIORITY.farOverscan },
      { key: frameKey(1 * T), priority: ANALYSIS_PRIORITY.selected },
      { key: frameKey(5 * T), priority: ANALYSIS_PRIORITY.visible },
    ])
    await settle()

    expect(asked).toEqual([
      mediaAnalysisKeyId(frameKey(1 * T)),
      mediaAnalysisKeyId(frameKey(5 * T)),
    ])
  })

  it('asks once for something two clips both want', async () => {
    const { client, asked } = controllableClient()
    const controller = createMediaAnalysisController({ client })
    const shared = frameKey(4 * T)
    controller.setWanted(PROJECT, [
      { key: shared, priority: ANALYSIS_PRIORITY.visible },
      { key: shared, priority: ANALYSIS_PRIORITY.visible },
    ])
    await settle()
    expect(asked).toHaveLength(1)
  })

  it('never asks again for something it already has', async () => {
    const { client, pending, asked } = controllableClient()
    const controller = createMediaAnalysisController({ client })
    const key = frameKey(0)

    controller.setWanted(PROJECT, [{ key, priority: ANALYSIS_PRIORITY.visible }])
    await settle()
    pending.get(mediaAnalysisKeyId(key))?.resolve(fakeBitmap() as never)
    await settle()

    controller.setWanted(PROJECT, [{ key, priority: ANALYSIS_PRIORITY.visible }])
    await settle()
    expect(asked).toHaveLength(1)
    expect(controller.picture(mediaAnalysisKeyId(key)).status).toBe('ready')
  })
})

describe('when the user scrolls away', () => {
  it('stops work nobody is waiting for any more', async () => {
    const { client, pending } = controllableClient()
    const controller = createMediaAnalysisController({ client })
    const gone = frameKey(0)
    const stillWanted = frameKey(T)

    controller.setWanted(PROJECT, [
      { key: gone, priority: ANALYSIS_PRIORITY.visible },
      { key: stillWanted, priority: ANALYSIS_PRIORITY.visible },
    ])
    await settle()

    controller.setWanted(PROJECT, [{ key: stillWanted, priority: ANALYSIS_PRIORITY.visible }])
    await settle()

    expect(pending.get(mediaAnalysisKeyId(gone))?.signal.aborted).toBe(true)
    expect(pending.get(mediaAnalysisKeyId(stillWanted))?.signal.aborted).toBe(false)
    expect(controller.diagnostics().abortedRequests).toBe(1)
  })

  it('keeps everything it has already made, rather than starting over', async () => {
    const { client, pending } = controllableClient()
    const controller = createMediaAnalysisController({ client })
    const key = frameKey(0)

    controller.setWanted(PROJECT, [{ key, priority: ANALYSIS_PRIORITY.visible }])
    await settle()
    pending.get(mediaAnalysisKeyId(key))?.resolve(fakeBitmap() as never)
    await settle()

    // Scrolled somewhere else entirely.
    controller.setWanted(PROJECT, [{ key: frameKey(600 * T), priority: ANALYSIS_PRIORITY.visible }])
    await settle()
    // …and back. Nothing was thrown away.
    expect(controller.picture(mediaAnalysisKeyId(key)).status).toBe('ready')
  })

  it('ignores an answer that arrives for a project nobody is looking at', async () => {
    const { client, pending } = controllableClient()
    const controller = createMediaAnalysisController({ client })
    const key = frameKey(0)

    controller.setWanted(PROJECT, [{ key, priority: ANALYSIS_PRIORITY.visible }])
    await settle()

    controller.setWanted('project_bbbbbbbbbbbbbbbb', [])
    pending.get(mediaAnalysisKeyId(key))?.resolve(fakeBitmap() as never)
    await settle()

    // One project's pictures must never appear on another's timeline.
    expect(controller.picture(mediaAnalysisKeyId(key)).status).toBe('idle')
    expect(controller.diagnostics().pictureCacheSize).toBe(0)
  })
})

describe('holding on to nothing it should not', () => {
  it('closes every picture it drops, because a bitmap is not reclaimed on its own', async () => {
    const { client, pending } = controllableClient()
    const controller = createMediaAnalysisController({ client, maxPictures: 2, maxInFlight: 6 })
    const bitmaps: Array<ReturnType<typeof fakeBitmap>> = []

    for (let index = 0; index < 5; index += 1) {
      const key = frameKey(index * T)
      controller.setWanted(PROJECT, [{ key, priority: ANALYSIS_PRIORITY.visible }])
      await settle()
      const bitmap = fakeBitmap()
      bitmaps.push(bitmap)
      pending.get(mediaAnalysisKeyId(key))?.resolve(bitmap as never)
      await settle()
    }

    expect(controller.diagnostics().pictureCacheSize).toBe(2)
    expect(controller.diagnostics().disposedPictures).toBe(3)
    expect(bitmaps.slice(0, 3).every((bitmap) => bitmap.closed)).toBe(true)
    expect(bitmaps.slice(3).every((bitmap) => bitmap.closed)).toBe(false)
  })

  it('closes everything and stops everything when the screen goes away', async () => {
    const { client, pending } = controllableClient()
    const controller = createMediaAnalysisController({ client })
    const held = frameKey(0)
    const inFlight = frameKey(T)

    controller.setWanted(PROJECT, [
      { key: held, priority: ANALYSIS_PRIORITY.visible },
      { key: inFlight, priority: ANALYSIS_PRIORITY.visible },
    ])
    await settle()
    const bitmap = fakeBitmap()
    pending.get(mediaAnalysisKeyId(held))?.resolve(bitmap as never)
    await settle()

    controller.dispose()
    expect(bitmap.closed).toBe(true)
    expect(pending.get(mediaAnalysisKeyId(inFlight))?.signal.aborted).toBe(true)
    expect(controller.diagnostics().pictureCacheSize).toBe(0)
  })

  it('drops everything when a different project is opened', async () => {
    const { client, pending } = controllableClient()
    const controller = createMediaAnalysisController({ client })
    const key = frameKey(0)
    controller.setWanted(PROJECT, [{ key, priority: ANALYSIS_PRIORITY.visible }])
    await settle()
    const bitmap = fakeBitmap()
    pending.get(mediaAnalysisKeyId(key))?.resolve(bitmap as never)
    await settle()

    controller.setWanted('project_bbbbbbbbbbbbbbbb', [])
    expect(bitmap.closed).toBe(true)
    expect(controller.diagnostics().pictureCacheSize).toBe(0)
  })
})

describe('when something cannot be made', () => {
  it('says the file is missing, which is different from saying it failed', async () => {
    const { client, pending } = controllableClient()
    const controller = createMediaAnalysisController({ client })
    const key = frameKey(0)
    controller.setWanted(PROJECT, [{ key, priority: ANALYSIS_PRIORITY.visible }])
    await settle()
    pending.get(mediaAnalysisKeyId(key))?.reject(new AnalysisRefusalError({
      code: 'ASSET_MISSING', message: 'That file is no longer where the project left it.',
    }))
    await settle()
    expect(controller.picture(mediaAnalysisKeyId(key)).status).toBe('missing')
  })

  it('says a decoder failure is a failure, so trying again makes sense', async () => {
    const { client, pending } = controllableClient()
    const controller = createMediaAnalysisController({ client })
    const key = frameKey(0)
    controller.setWanted(PROJECT, [{ key, priority: ANALYSIS_PRIORITY.visible }])
    await settle()
    pending.get(mediaAnalysisKeyId(key))?.reject(new AnalysisRefusalError({
      code: 'DECODER_FAILED', message: 'That part of the file could not be read.',
    }))
    await settle()
    const state = controller.picture(mediaAnalysisKeyId(key))
    expect(state.status).toBe('error')
    expect(state.status === 'error' && state.refusal.code).toBe('DECODER_FAILED')
  })

  it('does not ask again and again for something that just failed', async () => {
    const { client, pending, asked } = controllableClient()
    const controller = createMediaAnalysisController({ client })
    const key = frameKey(0)
    controller.setWanted(PROJECT, [{ key, priority: ANALYSIS_PRIORITY.visible }])
    await settle()
    pending.get(mediaAnalysisKeyId(key))?.reject(new AnalysisRefusalError({
      code: 'DECODER_FAILED', message: 'no',
    }))
    await settle()

    for (let attempt = 0; attempt < 5; attempt += 1) {
      controller.setWanted(PROJECT, [{ key, priority: ANALYSIS_PRIORITY.visible }])
      await settle()
    }
    // Once, not six times. A doomed request repeated on every scroll is how a
    // broken file makes the whole editor slow.
    expect(asked).toHaveLength(1)
  })

  it('tries again when asked to', async () => {
    const { client, pending, asked } = controllableClient()
    const controller = createMediaAnalysisController({ client })
    const key = frameKey(0)
    const keyId = mediaAnalysisKeyId(key)
    controller.setWanted(PROJECT, [{ key, priority: ANALYSIS_PRIORITY.visible }])
    await settle()
    pending.get(keyId)?.reject(new AnalysisRefusalError({ code: 'DECODER_FAILED', message: 'no' }))
    await settle()

    controller.retry(keyId)
    controller.setWanted(PROJECT, [{ key, priority: ANALYSIS_PRIORITY.visible }])
    await settle()
    expect(asked).toHaveLength(2)
  })
})

describe('telling the screen something changed', () => {
  it('wakes anything watching when an answer arrives', async () => {
    const { client, pending } = controllableClient()
    const controller = createMediaAnalysisController({ client })
    const listener = vi.fn()
    const stop = controller.subscribe(listener)

    const key = frameKey(0)
    controller.setWanted(PROJECT, [{ key, priority: ANALYSIS_PRIORITY.visible }])
    await settle()
    const before = controller.version()
    pending.get(mediaAnalysisKeyId(key))?.resolve(fakeBitmap() as never)
    await settle()

    expect(listener).toHaveBeenCalled()
    expect(controller.version()).toBeGreaterThan(before)
    stop()
  })

  it('stops telling anything that has gone away', async () => {
    const { client } = controllableClient()
    const controller = createMediaAnalysisController({ client })
    const listener = vi.fn()
    controller.subscribe(listener)()
    controller.setWanted(PROJECT, [])
    expect(listener).not.toHaveBeenCalled()
  })
})

describe('loudness numbers travel the same road', () => {
  it('is held and reported just like a picture', async () => {
    const { client, pending } = controllableClient()
    const controller = createMediaAnalysisController({ client })
    const key = waveformBlockKey({ assetId: 'asset_music001', assetVersion: A, sourceTicks: 0, peaksPerBlock: 64 })
    const keyId = mediaAnalysisKeyId(key)

    controller.setWanted(PROJECT, [{ key, priority: ANALYSIS_PRIORITY.visible }])
    await settle()
    expect(controller.peaks(keyId).status).toBe('loading')
    pending.get(keyId)?.resolve([0, 0.5, 1] as never)
    await settle()
    const state = controller.peaks(keyId)
    expect(state.status === 'ready' && state.value).toEqual([0, 0.5, 1])
    expect(controller.diagnostics().peakCacheSize).toBe(1)
  })
})
