import { describe, expect, it } from 'vitest'

import { PROJECT_TIMESCALE } from '@sanverse/edit-domain'

import {
  clipDerivedMedia,
  derivedMediaKeys,
  laneDensityForHeight,
  MAX_TIMELINE_ANALYSIS_REQUESTS,
  MIN_CLIP_WIDTH_FOR_PICTURES_PX,
  peaksPerBlockFor,
  planTimelineAnalysis,
  type DerivedMediaClip,
} from './timeline-derived-media'
import { derivedMediaClipFor, type AssetFacts } from './timeline-item-clip'
import { mediaAnalysisKeyId } from './media-analysis-key'
import {
  LONG_FORM_IMAGE_ITEMS,
  LONG_FORM_MUSIC_ITEMS,
  longFormDialogueClips,
  longFormImageClips,
  longFormMusicClips,
  longFormOverwriteFragmentAt,
  longFormPrimaryClips,
  longFormSplitAt,
  longFormTotalTicks,
} from './long-form-fixture'
import type { TimelineItemView } from '../timeline/timeline-contract'

/**
 * Gate D — that the timeline asks for the RIGHT pictures, and a bounded number
 * of them.
 *
 * The rule under test throughout: a thumbnail shows the moment of the RECORDING
 * that is on screen at that point of the finished video. Get it wrong and every
 * filmstrip in a cut project is off by however much was trimmed — and it looks
 * plausible, so nobody notices until they cut using it.
 */

const T = PROJECT_TIMESCALE
const A = 'a'.repeat(16)

const videoClip = (overrides: Partial<DerivedMediaClip> = {}): DerivedMediaClip => Object.freeze({
  itemId: 'clip:one',
  assetId: 'asset_aaaaaaaa',
  assetVersion: A,
  mediaKind: 'video' as const,
  startTicks: 0,
  durationTicks: 8 * T,
  sourceStartTicks: 0,
  drawSound: false,
  ...overrides,
})

const plan = (clip: DerivedMediaClip, pixelsPerSecond = 100) =>
  clipDerivedMedia({ clip, timescale: T, pixelsPerSecond, density: 'full' })

const keyIds = (clip: DerivedMediaClip, pixelsPerSecond = 100): readonly string[] =>
  derivedMediaKeys(plan(clip, pixelsPerSecond)).map(mediaAnalysisKeyId)

describe('which pictures one piece of footage needs', () => {
  it('takes them from the recording, offset by however much was trimmed', () => {
    const untrimmed = plan(videoClip())
    const trimmed = plan(videoClip({ sourceStartTicks: 4 * T }))
    expect(untrimmed.kind).toBe('filmstrip')
    if (untrimmed.kind !== 'filmstrip' || trimmed.kind !== 'filmstrip') return
    expect(untrimmed.cells[0].key.sourceTicks).toBe(0)
    // Four seconds in, so the first picture is second four of the recording.
    expect(trimmed.cells[0].key.sourceTicks).toBe(4 * T)
  })

  it('does not change at all when a clip is simply moved', () => {
    // Moving changes where a clip sits, not what it shows. If the name changed
    // here, every drag would throw away the whole filmstrip and re-decode it.
    expect(keyIds(videoClip({ startTicks: 0 })))
      .toEqual(keyIds(videoClip({ startTicks: 42 * T })))
  })

  it('lets both halves of a split reuse everything but the new cut point', () => {
    const whole = new Set(keyIds(videoClip()))
    const left = keyIds(videoClip({ itemId: 'a', durationTicks: 3 * T }))
    const right = keyIds(videoClip({ itemId: 'b', startTicks: 3 * T, durationTicks: 5 * T, sourceStartTicks: 3 * T }))
    const fresh = [...left, ...right].filter((keyId) => !whole.has(keyId))
    // The right half's own new starting moment is genuinely new; everything
    // else it shows, the whole clip already had. That is what makes a split
    // cost one decode instead of a fresh filmstrip.
    expect(fresh).toHaveLength(0)
  })

  it('costs one new picture when a clip is cut at an unaligned moment', () => {
    const whole = new Set(keyIds(videoClip()))
    // Cut at 2.5 seconds. The pictures are 0.75 s apart, so 2.5 s is not one of
    // the moments the whole clip was already showing.
    const cutAt = 2 * T + T / 2
    const left = keyIds(videoClip({ itemId: 'a', durationTicks: cutAt }))
    const right = keyIds(videoClip({
      itemId: 'b', startTicks: cutAt, durationTicks: 8 * T - cutAt, sourceStartTicks: cutAt,
    }))
    const fresh = [...left, ...right].filter((keyId) => !whole.has(keyId))
    expect(fresh).toHaveLength(1)
  })

  it('lets the same shot used twice cost one decode', () => {
    const first = videoClip({ itemId: 'one', startTicks: 0 })
    const second = videoClip({ itemId: 'two', startTicks: 30 * T })
    const wanted = planTimelineAnalysis({
      clips: [
        { clip: first, density: 'full', priority: 1 },
        { clip: second, density: 'full', priority: 1 },
      ],
      timescale: T,
      pixelsPerSecond: 100,
    })
    expect(wanted.wanted).toHaveLength(keyIds(first).length)
  })

  it('never draws a picture past the end of the clip it belongs to', () => {
    const media = plan(videoClip({ durationTicks: 3 * T + T / 2 }))
    if (media.kind !== 'filmstrip') throw new Error('expected a filmstrip')
    const last = media.cells[media.cells.length - 1]
    expect(last.offsetPx + last.widthPx).toBeLessThanOrEqual((3.5 * T / T) * 100 + 0.001)
  })

  it('asks for nothing at all when a clip is too narrow to read', () => {
    // At the widest zoom-out, one unreadable smudge per clip would be 250
    // decodes to show 250 smudges.
    const tiny = clipDerivedMedia({
      clip: videoClip({ durationTicks: T / 10 }),
      timescale: T,
      pixelsPerSecond: 100,
      density: 'full',
    })
    expect(tiny.kind).toBe('none')
    expect((T / 10 / T) * 100).toBeLessThan(MIN_CLIP_WIDTH_FOR_PICTURES_PX)
  })

  it('asks for nothing when the row is too short to show anything', () => {
    expect(clipDerivedMedia({ clip: videoClip(), timescale: T, pixelsPerSecond: 100, density: 'minimal' }).kind)
      .toBe('none')
  })

  it('asks for fewer, wider pictures when the row is short', () => {
    const full = clipDerivedMedia({ clip: videoClip(), timescale: T, pixelsPerSecond: 100, density: 'full' })
    const compact = clipDerivedMedia({ clip: videoClip(), timescale: T, pixelsPerSecond: 100, density: 'compact' })
    if (full.kind !== 'filmstrip' || compact.kind !== 'filmstrip') throw new Error('expected filmstrips')
    expect(compact.cells.length).toBeLessThan(full.cells.length)
  })

  it('has a ceiling per clip and says when it bites', () => {
    const media = clipDerivedMedia({
      clip: videoClip({ durationTicks: 600 * T }),
      timescale: T,
      pixelsPerSecond: 400,
      density: 'full',
      maxCellsPerClip: 10,
    })
    if (media.kind !== 'filmstrip') throw new Error('expected a filmstrip')
    expect(media.cells).toHaveLength(10)
    expect(media.truncated).toBe(true)
  })

  it('reuses the same pictures across a small zoom change', () => {
    // Widths and spacing are both snapped to a grid, so nudging the zoom does
    // not invalidate everything on screen.
    expect(keyIds(videoClip(), 100)).toEqual(keyIds(videoClip(), 102))
  })

  it('keeps sharing most pictures even across a big zoom change', () => {
    // The spacing does change at some point — it has to, or zooming in would
    // never show more detail. What matters is that it lands back on the same
    // ladder of moments, so half of what is already made is still useful.
    const near = new Set(keyIds(videoClip(), 100))
    const far = keyIds(videoClip(), 200)
    const shared = far.filter((keyId) => near.has(keyId))
    expect(shared.length).toBeGreaterThanOrEqual(Math.floor(near.size / 2))
  })
})

describe('which pictures a still picture needs', () => {
  it('needs exactly one, with no moment in its name', () => {
    const media = clipDerivedMedia({
      clip: videoClip({ mediaKind: 'image', sourceStartTicks: 0 }),
      timescale: T,
      pixelsPerSecond: 100,
      density: 'full',
    })
    expect(media.kind).toBe('image')
    if (media.kind !== 'image') return
    expect(media.key.sourceTicks).toBe(0)
  })

  it('shares one decode between the same picture used many times', () => {
    const used = Array.from({ length: 5 }, (_unused, index) => ({
      clip: videoClip({ itemId: `p${index}`, mediaKind: 'image' as const, startTicks: index * 10 * T }),
      density: 'full' as const,
      priority: 1,
    }))
    expect(planTimelineAnalysis({ clips: used, timescale: T, pixelsPerSecond: 100 }).wanted).toHaveLength(1)
  })
})

describe('which loudness numbers a piece of sound needs', () => {
  const sound = (overrides: Partial<DerivedMediaClip> = {}) =>
    plan(videoClip({ drawSound: true, mediaKind: 'audio', ...overrides }))

  it('covers the stretch of the file the clip actually shows', () => {
    const media = sound({ sourceStartTicks: 4 * T, durationTicks: 3 * T })
    expect(media.kind).toBe('waveform')
    if (media.kind !== 'waveform') return
    expect(media.fromTicks).toBe(4 * T)
    expect(media.toTicks).toBe(7 * T)
    expect(media.blocks.map((block) => block.blockStartTicks)).toEqual([4 * T, 5 * T, 6 * T])
  })

  it('draws a trimmed piece of music from its own later start, not from zero', () => {
    const trimmed = sound({ sourceStartTicks: 45 * T, durationTicks: 2 * T })
    if (trimmed.kind !== 'waveform') throw new Error('expected a waveform')
    expect(trimmed.blocks[0].blockStartTicks).toBe(45 * T)
  })

  it('lets two halves of a split piece of music share their blocks', () => {
    const whole = sound({ sourceStartTicks: 10 * T, durationTicks: 8 * T })
    const left = sound({ sourceStartTicks: 10 * T, durationTicks: 4 * T })
    const right = sound({ sourceStartTicks: 14 * T, durationTicks: 4 * T })
    if (whole.kind !== 'waveform' || left.kind !== 'waveform' || right.kind !== 'waveform') {
      throw new Error('expected waveforms')
    }
    const held = new Set(whole.blocks.map((block) => block.keyId))
    for (const block of [...left.blocks, ...right.blocks]) expect(held.has(block.keyId)).toBe(true)
  })

  it('does not change when a piece of music is simply moved', () => {
    const before = sound({ startTicks: 0, sourceStartTicks: 6 * T })
    const after = sound({ startTicks: 99 * T, sourceStartTicks: 6 * T })
    if (before.kind !== 'waveform' || after.kind !== 'waveform') throw new Error('expected waveforms')
    expect(after.blocks.map((b) => b.keyId)).toEqual(before.blocks.map((b) => b.keyId))
  })

  it('asks for coarser detail when zoomed out, snapped so it can be reused', () => {
    expect(peaksPerBlockFor(20)).toBe(16)
    expect(peaksPerBlockFor(200)).toBe(128)
    expect(peaksPerBlockFor(10_000)).toBe(256)
    // Snapped: two nearby zoom levels ask for the same detail.
    expect(peaksPerBlockFor(100)).toBe(peaksPerBlockFor(120))
  })
})

describe('how much room a row has', () => {
  it('draws everything only when there is room for it', () => {
    expect(laneDensityForHeight(58)).toBe('full')
    expect(laneDensityForHeight(40)).toBe('full')
    expect(laneDensityForHeight(32)).toBe('compact')
    expect(laneDensityForHeight(24)).toBe('minimal')
  })
})

describe('turning one row of the timeline into a plain question', () => {
  const facts: Readonly<Record<string, AssetFacts>> = Object.freeze({
    asset_video001: Object.freeze({ assetVersion: A, mediaKind: 'video' as const, hasAudio: true }),
    asset_silent01: Object.freeze({ assetVersion: A, mediaKind: 'video' as const, hasAudio: false }),
    asset_photo001: Object.freeze({ assetVersion: A, mediaKind: 'image' as const, hasAudio: false }),
  })

  const item = (overrides: Partial<TimelineItemView> = {}): TimelineItemView => Object.freeze({
    id: 'clip:one', laneId: 'lane:video', kind: 'clip', state: 'committed',
    label: 'Footage', detail: null, startTicks: 0, durationTicks: 8 * T,
    enabled: true, selected: false, blockedReason: null,
    clipId: 'clip_one', linkedClipId: null, assetId: 'asset_video001',
    operationId: null, changeSetId: null, captionSetId: null, cueId: null, visualId: null,
    sourceStartTicks: 2 * T, sourceDurationTicks: 8 * T,
    gainDb: null, fadeInTicks: null, fadeOutTicks: null,
    proposalId: null, proposalBaseRevision: null,
    ...overrides,
  }) as TimelineItemView

  it('gives the dialogue row the same moment of the same file as the picture', () => {
    // Cut the picture and the sound is cut with it. A waveform taking its
    // moment from anywhere else drifts apart on the first trim.
    const picture = derivedMediaClipFor(item(), 'video', facts)
    const sound = derivedMediaClipFor(item(), 'dialogue', facts)
    expect(sound?.sourceStartTicks).toBe(picture?.sourceStartTicks)
    expect(sound?.drawSound).toBe(true)
    expect(picture?.drawSound).toBe(false)
  })

  it('draws nothing for typed words, because there is no file behind them', () => {
    expect(derivedMediaClipFor(item({ kind: 'title', assetId: null }), 'overlay', facts)).toBeNull()
    expect(derivedMediaClipFor(item({ kind: 'caption' }), 'caption', facts)).toBeNull()
  })

  it('draws nothing for a proposal nobody has accepted yet', () => {
    expect(derivedMediaClipFor(item({ state: 'proposed' }), 'video', facts)).toBeNull()
  })

  it('draws no sound shape for footage that has none', () => {
    expect(derivedMediaClipFor(item({ assetId: 'asset_silent01' }), 'dialogue', facts)).toBeNull()
  })

  it('draws nothing for a file the project no longer describes', () => {
    expect(derivedMediaClipFor(item({ assetId: 'asset_unknown9' }), 'video', facts)).toBeNull()
  })

  it('gives a picture no moment even if the row carries one', () => {
    const picture = derivedMediaClipFor(
      item({ kind: 'media-overlay', assetId: 'asset_photo001', sourceStartTicks: 9 * T }),
      'overlay',
      facts,
    )
    expect(picture?.sourceStartTicks).toBe(0)
  })
})

describe('a whole sixty-minute timeline', () => {
  const window = (clips: readonly DerivedMediaClip[]) => planTimelineAnalysis({
    clips: clips.map((clip) => ({ clip, density: 'full' as const, priority: 1 })),
    timescale: T,
    pixelsPerSecond: 100,
  })

  const asVideo = (clips: ReturnType<typeof longFormPrimaryClips>): readonly DerivedMediaClip[] =>
    clips.map((clip) => Object.freeze({
      itemId: clip.clipId,
      assetId: clip.assetId,
      assetVersion: clip.assetVersion,
      mediaKind: 'video' as const,
      startTicks: clip.startTicks,
      durationTicks: clip.durationTicks,
      sourceStartTicks: clip.sourceStartTicks,
      drawSound: false,
    }))

  const asSound = (clips: ReturnType<typeof longFormPrimaryClips>): readonly DerivedMediaClip[] =>
    asVideo(clips).map((clip) => Object.freeze({ ...clip, mediaKind: 'audio' as const, drawSound: true }))

  it('is a real long project with sound, pictures and music in it', () => {
    expect(longFormPrimaryClips()).toHaveLength(250)
    expect(longFormDialogueClips()).toHaveLength(250)
    expect(longFormMusicClips()).toHaveLength(LONG_FORM_MUSIC_ITEMS)
    expect(longFormImageClips()).toHaveLength(LONG_FORM_IMAGE_ITEMS)
    expect(longFormTotalTicks()).toBeGreaterThan(55 * 60 * T)
  })

  it('never asks for more than its ceiling, and says when the ceiling bites', () => {
    const everything = window([
      ...asVideo(longFormPrimaryClips()),
      ...asSound(longFormDialogueClips()),
    ])
    expect(everything.wanted.length).toBeLessThanOrEqual(MAX_TIMELINE_ANALYSIS_REQUESTS)
    expect(everything.truncated).toBe(true)
  })

  it('costs a split at most one extra decode, not a whole new filmstrip', () => {
    const before = window(asVideo(longFormPrimaryClips().slice(0, 20)))
    const after = window(asVideo(longFormSplitAt(longFormPrimaryClips(), 5).slice(0, 21)))
    expect(after.wanted.length).toBeLessThanOrEqual(before.wanted.length + 1)
  })

  it('costs an overwrite fragment nothing it did not already have', () => {
    const original = longFormPrimaryClips().slice(0, 12)
    const fragmented = longFormOverwriteFragmentAt(longFormPrimaryClips(), 3).slice(0, 13)
    const held = new Set(window(asVideo(original)).wanted.map((entry) => mediaAnalysisKeyId(entry.key)))
    const after = window(asVideo(fragmented)).wanted.map((entry) => mediaAnalysisKeyId(entry.key))
    const fresh = after.filter((keyId) => !held.has(keyId))
    // Only the fragment's own new starting moment can be new.
    expect(fresh.length).toBeLessThanOrEqual(2)
  })

  it('is bounded whether the project uses one recording or twelve', () => {
    const twelve = asVideo(longFormPrimaryClips().slice(0, 30))
    const one = twelve.map((clip) => Object.freeze({ ...clip, assetId: 'asset_only00', assetVersion: A }))
    // Reusing one recording can only ever cost LESS, because two clips showing
    // the same moment of the same file are one piece of work. What must hold is
    // that neither case can run away.
    expect(window(one).wanted.length).toBeLessThanOrEqual(window(twelve).wanted.length)
    expect(window(twelve).wanted.length).toBeLessThanOrEqual(MAX_TIMELINE_ANALYSIS_REQUESTS)
  })

  it('asks for the most important things first when the ceiling bites', () => {
    const clips = asVideo(longFormPrimaryClips())
    const chosen = 100
    const planned = planTimelineAnalysis({
      clips: clips.map((clip, index) => ({
        clip,
        density: 'full' as const,
        priority: index === chosen ? 0 : 3,
      })),
      timescale: T,
      pixelsPerSecond: 100,
      maxRequests: 20,
    })
    expect(planned.truncated).toBe(true)
    // Everything the selected clip needs is in the plan, and it got there
    // before any of the 249 others.
    const selectedKeys = new Set(
      derivedMediaKeys(clipDerivedMedia({
        clip: clips[chosen], timescale: T, pixelsPerSecond: 100, density: 'full',
      })).map(mediaAnalysisKeyId),
    )
    const included = planned.wanted.map((entry) => mediaAnalysisKeyId(entry.key))
    for (const keyId of selectedKeys) expect(included).toContain(keyId)
    expect(planned.wanted.slice(0, selectedKeys.size).every((entry) => entry.priority === 0)).toBe(true)
  })

  it('costs a missing recording nothing but its own pictures', () => {
    const clips = asVideo(longFormPrimaryClips().slice(0, 10))
    const withGone = clips.map((clip, index) =>
      index === 3 ? Object.freeze({ ...clip, assetVersion: '' }) : clip)
    const planned = window(withGone)
    expect(planned.wanted.length).toBeGreaterThan(0)
    expect(planned.wanted.every((entry) => entry.key.assetVersion.length === 16)).toBe(true)
  })
})
