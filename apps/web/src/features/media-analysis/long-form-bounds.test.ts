import { describe, expect, it, vi } from 'vitest'

import { PROJECT_TIMESCALE } from '@sanverse/edit-domain'

import { createBoundedCache } from './bounded-cache'
import {
  MAX_FILMSTRIP_REQUESTS_PER_PLAN,
  distinctFilmstripWork,
  planFilmstrip,
  sourceTicksWithinClip,
} from './filmstrip-plan'
import {
  FILMSTRIP_GRID_TICKS,
  filmstripFrameKey,
  mediaAnalysisKeyId,
  waveformBlockKey,
} from './media-analysis-key'
import {
  MAX_PEAKS_PER_BLOCK,
  computePeaks,
  planWaveformBlocks,
  slicePeaks,
} from './waveform-peaks'
import {
  LONG_FORM_OVERLAY_ITEMS,
  LONG_FORM_PRIMARY_CLIPS,
  longFormOverlayClips,
  longFormPrimaryClips,
  longFormTotalTicks,
  longFormWithMissingSource,
} from './long-form-fixture'

/**
 * Gate D — that a sixty-minute project stays bounded.
 *
 * The failures that matter only appear on long projects, which are the ones a
 * user has already put hours into. These assert the ceilings hold there.
 */

const T = PROJECT_TIMESCALE

describe('naming a piece of derived media', () => {
  it('names it by the file and the moment, and by nothing about the timeline', () => {
    // This is what lets a clip be dragged, trimmed or split without throwing
    // away a single thumbnail.
    const a = filmstripFrameKey({ assetId: 'asset_a', assetVersion: 'aaaaaaaaaaaaaaaa', sourceTicks: 5 * T, widthPx: 64 })
    const b = filmstripFrameKey({ assetId: 'asset_a', assetVersion: 'aaaaaaaaaaaaaaaa', sourceTicks: 5 * T, widthPx: 64 })
    expect(mediaAnalysisKeyId(a)).toBe(mediaAnalysisKeyId(b))
    expect(Object.keys(a).sort()).toEqual(
      ['assetId', 'assetVersion', 'kind', 'resolution', 'schemaVersion', 'sourceTicks', 'spanTicks'],
    )
  })

  it('snaps the moment to a grid, so zooming reuses what is already decoded', () => {
    const first = filmstripFrameKey({ assetId: 'asset_a', assetVersion: 'aaaaaaaaaaaaaaaa', sourceTicks: 5 * T + 17, widthPx: 64 })
    const second = filmstripFrameKey({ assetId: 'asset_a', assetVersion: 'aaaaaaaaaaaaaaaa', sourceTicks: 5 * T + 9_000, widthPx: 64 })
    expect(first.sourceTicks % FILMSTRIP_GRID_TICKS).toBe(0)
    expect(mediaAnalysisKeyId(first)).toBe(mediaAnalysisKeyId(second))
  })

  it('snaps the width too, so resizing the window is not a full re-decode', () => {
    expect(filmstripFrameKey({ assetId: 'a', assetVersion: 'aaaaaaaaaaaaaaaa', sourceTicks: 0, widthPx: 61 }).resolution)
      .toBe(filmstripFrameKey({ assetId: 'a', assetVersion: 'aaaaaaaaaaaaaaaa', sourceTicks: 0, widthPx: 66 }).resolution)
  })

  it('keeps two different recordings apart even at the same moment', () => {
    expect(mediaAnalysisKeyId(filmstripFrameKey({ assetId: 'asset_a', assetVersion: 'aaaaaaaaaaaaaaaa', sourceTicks: T, widthPx: 64 })))
      .not.toBe(mediaAnalysisKeyId(filmstripFrameKey({ assetId: 'asset_b', assetVersion: 'bbbbbbbbbbbbbbbb', sourceTicks: T, widthPx: 64 })))
  })

  it('gives waveform blocks a length, and frames none', () => {
    expect(waveformBlockKey({ assetId: 'a', assetVersion: 'aaaaaaaaaaaaaaaa', sourceTicks: 3 * T + 5, peaksPerBlock: 64 }).spanTicks).toBe(T)
    expect(filmstripFrameKey({ assetId: 'a', assetVersion: 'aaaaaaaaaaaaaaaa', sourceTicks: 0, widthPx: 64 }).spanTicks).toBe(0)
  })
})

describe('a cache that cannot grow without limit', () => {
  it('never holds more than it was told to', () => {
    const cache = createBoundedCache<number>({ maxEntries: 50 })
    for (let index = 0; index < 5_000; index += 1) cache.set(`k${index}`, index)
    expect(cache.size).toBe(50)
  })

  it('throws away what has gone longest without being looked at', () => {
    const cache = createBoundedCache<number>({ maxEntries: 3 })
    cache.set('a', 1); cache.set('b', 2); cache.set('c', 3)
    cache.get('a')          // 'a' is wanted again, so 'b' is now the oldest
    cache.set('d', 4)
    expect(cache.has('b')).toBe(false)
    expect(cache.has('a')).toBe(true)
    expect(cache.keys()).toEqual(['c', 'a', 'd'])
  })

  it('releases everything it drops, because a bitmap is not reclaimed on its own', () => {
    const disposed: number[] = []
    const cache = createBoundedCache<number>({ maxEntries: 2, dispose: (v) => disposed.push(v) })
    cache.set('a', 1); cache.set('b', 2); cache.set('c', 3)
    expect(disposed).toEqual([1])
    cache.set('b', 20)
    expect(disposed).toEqual([1, 2])
    cache.delete('c')
    expect(disposed).toEqual([1, 2, 3])
    cache.clear()
    expect(disposed).toEqual([1, 2, 3, 20])
    expect(cache.size).toBe(0)
  })

  it('leaks nothing across a whole sixty-minute scroll', () => {
    const dispose = vi.fn()
    const cache = createBoundedCache<string>({ maxEntries: 200, dispose })
    const clips = longFormPrimaryClips()
    let produced = 0
    for (let start = 0; start < longFormTotalTicks(); start += 30 * T) {
      const plan = planFilmstrip({
        clips,
        visibleStartTicks: start,
        visibleEndTicks: start + 30 * T,
        thumbnailWidthPx: 48,
        pixelsPerSecond: 100,
        timescale: T,
      })
      for (const request of plan.requests) {
        if (!cache.has(request.keyId)) { cache.set(request.keyId, request.keyId); produced += 1 }
      }
    }
    expect(cache.size).toBeLessThanOrEqual(200)
    // Everything ever produced is either still held or was explicitly released.
    expect(dispose.mock.calls.length + cache.size).toBe(produced)
  })
})

describe('planning a filmstrip for a sixty-minute project', () => {
  const clips = longFormPrimaryClips()

  it('is a real long project, not a toy one', () => {
    expect(clips).toHaveLength(LONG_FORM_PRIMARY_CLIPS)
    expect(longFormOverlayClips()).toHaveLength(LONG_FORM_OVERLAY_ITEMS)
    expect(longFormTotalTicks()).toBeGreaterThan(55 * 60 * T)
  })

  it('asks only for what is on screen, however long the project is', () => {
    const plan = planFilmstrip({
      clips,
      visibleStartTicks: 20 * 60 * T,
      visibleEndTicks: 20 * 60 * T + 30 * T,
      thumbnailWidthPx: 48,
      pixelsPerSecond: 100,
      timescale: T,
    })
    // 30 seconds at 100px/s is 3,000px; a 48px thumbnail covers 0.48 s.
    expect(plan.requests.length).toBeLessThanOrEqual(70)
    expect(plan.requests.length).toBeGreaterThan(40)
    expect(plan.truncated).toBe(false)
  })

  it('shows the frame that is actually on screen, not the one at that timeline moment', () => {
    // The failure this catches looks plausible: every thumbnail in a cut
    // project is off by however much was trimmed, and nobody notices until
    // they cut using it.
    const clip = { clipId: 'clip_x', assetId: 'asset_x', assetVersion: 'xxxxxxxxxxxxxxxx', startTicks: 10 * T, durationTicks: 6 * T, sourceStartTicks: 4 * T }
    expect(sourceTicksWithinClip(clip, 12 * T)).toBe(6 * T)
    expect(sourceTicksWithinClip(clip, 9 * T)).toBeNull()
    expect(sourceTicksWithinClip(clip, 16 * T)).toBeNull()
  })

  it('never asks for more than its ceiling, and says so when the ceiling bites', () => {
    const plan = planFilmstrip({
      clips,
      visibleStartTicks: 0,
      visibleEndTicks: longFormTotalTicks(),
      thumbnailWidthPx: 48,
      pixelsPerSecond: 100,
      timescale: T,
    })
    expect(plan.requests.length).toBeLessThanOrEqual(MAX_FILMSTRIP_REQUESTS_PER_PLAN)
    // Saying so matters: a filmstrip quietly missing most of itself reads as
    // "covered everything" when it did not.
    expect(plan.truncated).toBe(true)
  })

  it('does the same amount of work whether the project is one recording or twelve', () => {
    const oneRecording = clips.map((clip) => ({ ...clip, assetId: 'asset_only' }))
    const window = { visibleStartTicks: 10 * 60 * T, visibleEndTicks: 10 * 60 * T + 30 * T, thumbnailWidthPx: 48, pixelsPerSecond: 100, timescale: T }
    expect(planFilmstrip({ clips: oneRecording, ...window }).requests.length)
      .toBe(planFilmstrip({ clips, ...window }).requests.length)
  })

  it('shares one piece of work between two halves of a split', () => {
    const whole = { clipId: 'c1', assetId: 'asset_x', assetVersion: 'xxxxxxxxxxxxxxxx', startTicks: 0, durationTicks: 8 * T, sourceStartTicks: 0 }
    const left = { ...whole, durationTicks: 4 * T }
    const right = { clipId: 'c2', assetId: 'asset_x', assetVersion: 'xxxxxxxxxxxxxxxx', startTicks: 4 * T, durationTicks: 4 * T, sourceStartTicks: 4 * T }
    const window = { visibleStartTicks: 0, visibleEndTicks: 8 * T, thumbnailWidthPx: 48, pixelsPerSecond: 100, timescale: T }

    const before = planFilmstrip({ clips: [whole], ...window })
    const after = planFilmstrip({ clips: [left, right], ...window })
    /*
      Splitting costs almost nothing, and the "almost" is honest.

      Thumbnails are laid out from each clip's OWN start so they do not slide
      while the timeline scrolls. That means the right half starts its own row,
      which can land one thumbnail on a moment the whole clip never asked for.
      Because the MOMENTS are snapped to a quarter-second grid, everything else
      is shared — so a split is one extra decode, not a whole new filmstrip.
    */
    expect(distinctFilmstripWork(after)).toBeLessThanOrEqual(distinctFilmstripWork(before) + 1)
    expect(distinctFilmstripWork(after)).toBeGreaterThanOrEqual(distinctFilmstripWork(before))
  })

  it('keeps the thumbnails still while the timeline scrolls', () => {
    // Laid out from the clip's own start, so the picture under the pointer does
    // not change when the window moves.
    const window = { clips, thumbnailWidthPx: 48, pixelsPerSecond: 100, timescale: T }
    const first = planFilmstrip({ ...window, visibleStartTicks: 100 * T, visibleEndTicks: 130 * T })
    const second = planFilmstrip({ ...window, visibleStartTicks: 103 * T, visibleEndTicks: 133 * T })
    const overlap = new Set(second.requests.map((r) => `${r.keyId}@${r.compositionTicks}`))
    const kept = first.requests.filter((r) =>
      r.compositionTicks >= 103 * T && overlap.has(`${r.keyId}@${r.compositionTicks}`))
    expect(kept.length).toBeGreaterThan(20)
  })

  it('carries on when one recording file is gone', () => {
    // A missing file must cost the project nothing but its own thumbnails.
    const plan = planFilmstrip({
      clips: longFormWithMissingSource(),
      visibleStartTicks: 0,
      visibleEndTicks: 5 * 60 * T,
      thumbnailWidthPx: 48,
      pixelsPerSecond: 100,
      timescale: T,
    })
    expect(plan.requests.length).toBeGreaterThan(0)
    expect(plan.requests.every((r) => typeof r.keyId === 'string')).toBe(true)
  })
})

describe('summarising sound', () => {
  const samples = (length: number, at: number, value: number) => {
    const data = new Float32Array(length)
    data[at] = value
    return data
  }

  it('takes the loudest in each bucket, so a single bang is never lost', () => {
    // Taking every Nth sample instead would miss it entirely, and the waveform
    // would show a quiet passage where there was a snare drum.
    const peaks = computePeaks(samples(4_800, 2_401, 0.9), 10)
    expect(Math.max(...peaks)).toBeCloseTo(0.9, 5)
    expect(peaks[5]).toBeCloseTo(0.9, 5)
  })

  it('never draws past the top of its lane', () => {
    expect(Math.max(...computePeaks(samples(100, 5, 4), 4))).toBe(1)
  })

  it('is bounded however many peaks are asked for', () => {
    expect(computePeaks(samples(100_000, 1, 1), 100_000)).toHaveLength(MAX_PEAKS_PER_BLOCK)
  })

  it('covers every sample, so nothing at the end is silently dropped', () => {
    const peaks = computePeaks(samples(1_000, 999, 0.8), 8)
    expect(peaks[peaks.length - 1]).toBeCloseTo(0.8, 5)
  })

  it('slices a block so trimmed music draws its own shape, not the song from zero', () => {
    const block = Object.freeze([0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7])
    const half = slicePeaks(block, { blockStartTicks: 0, blockSpanTicks: T, fromTicks: T / 2, toTicks: T })
    expect(half).toEqual([0.4, 0.5, 0.6, 0.7])
  })

  it('asks for only the blocks a stretch needs, and never more than its ceiling', () => {
    const short = planWaveformBlocks({ fromTicks: 4 * T, toTicks: 9 * T, blockSpanTicks: T })
    expect(short.blockStartTicks).toEqual([4 * T, 5 * T, 6 * T, 7 * T, 8 * T])
    expect(short.truncated).toBe(false)

    const hour = planWaveformBlocks({ fromTicks: 0, toTicks: 60 * 60 * T, blockSpanTicks: T })
    expect(hour.blockStartTicks.length).toBeLessThanOrEqual(120)
    expect(hour.truncated).toBe(true)
  })

  it('starts blocks on a grid, so two clips of one song share them', () => {
    const first = planWaveformBlocks({ fromTicks: 4 * T + 17, toTicks: 6 * T, blockSpanTicks: T })
    const second = planWaveformBlocks({ fromTicks: 4 * T + 900_000, toTicks: 6 * T, blockSpanTicks: T })
    expect(first.blockStartTicks[0]).toBe(4 * T)
    expect(second.blockStartTicks[0]).toBe(4 * T)
  })
})
