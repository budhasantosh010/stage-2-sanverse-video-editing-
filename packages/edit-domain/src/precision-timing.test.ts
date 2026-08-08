import { describe, expect, it } from 'vitest'

import { PRECISION_TIMING_PRIMITIVE_ID } from './capabilities.ts'
import { clipCompositionDurationTicks, type Clip } from './composition.ts'
import { mediaTime } from './time.ts'
import { applyTimelineOperation, OPERATION_SCHEMA_VERSION, validateTimelineOperation } from './timeline-operations.ts'
import { ms, testAsset, testProject } from './test-fixtures.ts'

const threeClipFixture = () => {
  const asset = testAsset({ duration: ms(60_000) })
  const project = testProject(asset)
  const template = project.composition.tracks[0].clips[0]
  const clip = (clipId: string, sourceStartMs: number, compositionStartMs: number): Clip => Object.freeze({
    ...template,
    clipId,
    sourceRange: Object.freeze({ start: ms(sourceStartMs), duration: ms(10_000) }),
    compositionStart: ms(compositionStartMs),
  })
  const clips = Object.freeze([
    clip('clip_aaaaaaaa', 5_000, 0),
    clip('clip_bbbbbbbb', 20_000, 10_000),
    clip('clip_cccccccc', 35_000, 20_000),
  ])
  return {
    asset,
    composition: Object.freeze({
      ...project.composition,
      tracks: Object.freeze([Object.freeze({ ...project.composition.tracks[0], clips })]),
    }),
  }
}

const operation = (changes: readonly unknown[], clipId = 'clip_aaaaaaaa') => ({
  schemaVersion: OPERATION_SCHEMA_VERSION,
  operationId: 'operation_precision01',
  capabilityId: PRECISION_TIMING_PRIMITIVE_ID,
  kind: 'set-primary-clip-timings',
  clipId,
  changes,
  extensions: {},
})

describe('set-primary-clip-timings', () => {
  it('validates and applies several final timing states simultaneously', () => {
    const fixture = threeClipFixture()
    const input = operation([
      {
        clipId: 'clip_aaaaaaaa',
        sourceRange: { start: ms(5_000), duration: ms(11_000) },
        compositionStart: ms(0),
        linkedAudio: null,
      },
      {
        clipId: 'clip_bbbbbbbb',
        sourceRange: { start: ms(21_000), duration: ms(9_000) },
        compositionStart: ms(11_000),
        linkedAudio: null,
      },
    ])
    const checked = validateTimelineOperation(input)
    expect(checked.ok).toBe(true)
    if (!checked.ok) return
    const applied = applyTimelineOperation(fixture.composition, checked.value, [fixture.asset])
    expect(applied.ok).toBe(true)
    if (!applied.ok) return
    const track = applied.value.tracks[0]
    expect(track.clips.map((clip) => [clip.clipId, clip.compositionStart.ticks, clipCompositionDurationTicks(clip)])).toEqual([
      ['clip_aaaaaaaa', ms(0).ticks, ms(11_000).ticks],
      ['clip_bbbbbbbb', ms(11_000).ticks, ms(9_000).ticks],
      ['clip_cccccccc', ms(20_000).ticks, ms(10_000).ticks],
    ])
  })

  it('is closed: duplicate clip ids, unknown fields and a missing anchor are refused', () => {
    const duplicate = validateTimelineOperation(operation([
      { clipId: 'clip_aaaaaaaa', sourceRange: { start: ms(5_000), duration: ms(10_000) }, compositionStart: ms(0), linkedAudio: null },
      { clipId: 'clip_aaaaaaaa', sourceRange: { start: ms(5_000), duration: ms(10_000) }, compositionStart: ms(0), linkedAudio: null },
    ]))
    expect(duplicate.ok).toBe(false)

    const unknown = validateTimelineOperation(operation([
      { clipId: 'clip_aaaaaaaa', sourceRange: { start: ms(5_000), duration: ms(10_000) }, compositionStart: ms(0), linkedAudio: null, surprise: true },
    ]))
    expect(unknown.ok).toBe(false)

    const missingAnchor = validateTimelineOperation(operation([
      { clipId: 'clip_bbbbbbbb', sourceRange: { start: ms(20_000), duration: ms(10_000) }, compositionStart: ms(10_000), linkedAudio: null },
    ]))
    expect(missingAnchor.ok).toBe(false)
  })

  it('validates the final composition once and refuses an overlapping result atomically', () => {
    const fixture = threeClipFixture()
    const checked = validateTimelineOperation(operation([
      {
        clipId: 'clip_aaaaaaaa',
        sourceRange: { start: ms(5_000), duration: ms(12_000) },
        compositionStart: ms(0),
        linkedAudio: null,
      },
    ]))
    expect(checked.ok).toBe(true)
    if (!checked.ok) return
    const applied = applyTimelineOperation(fixture.composition, checked.value, [fixture.asset])
    expect(applied.ok).toBe(false)
    if (applied.ok) return
    expect(applied.error.reason).toBe('RESULT_INVALID')
    expect(fixture.composition.tracks[0].clips[0].sourceRange.duration.ticks).toBe(ms(10_000).ticks)
  })

  it('may shift a freeze downstream but never rewrite its held source instant', () => {
    const fixture = threeClipFixture()
    const base = fixture.composition.tracks[0].clips[1]
    const freeze: Clip = Object.freeze({
      ...base,
      clipId: 'clip_bbbbbbbb',
      sourceRange: Object.freeze({ start: ms(22_000), duration: mediaTime(1) }),
      compositionStart: ms(10_000),
      segmentKind: 'freeze',
      freezeDuration: ms(1_000),
      linkedAudio: null,
      timeTransform: Object.freeze({ playbackRate: Object.freeze({ numerator: 1, denominator: 1 }), direction: 'forward', maintainAudioPitch: true }),
    })
    const composition = Object.freeze({
      ...fixture.composition,
      tracks: Object.freeze([Object.freeze({
        ...fixture.composition.tracks[0],
        clips: Object.freeze([fixture.composition.tracks[0].clips[0], freeze, Object.freeze({ ...fixture.composition.tracks[0].clips[2], compositionStart: ms(11_000) })]),
      })]),
    })
    const shift = validateTimelineOperation(operation([
      { clipId: 'clip_bbbbbbbb', sourceRange: freeze.sourceRange, compositionStart: ms(11_000), linkedAudio: null },
      { clipId: 'clip_cccccccc', sourceRange: composition.tracks[0].clips[2].sourceRange, compositionStart: ms(12_000), linkedAudio: null },
    ], 'clip_bbbbbbbb'))
    expect(shift.ok).toBe(true)
    if (!shift.ok) return
    expect(applyTimelineOperation(composition, shift.value, [fixture.asset]).ok).toBe(true)

    const rewrite = validateTimelineOperation(operation([
      { clipId: 'clip_bbbbbbbb', sourceRange: { start: ms(23_000), duration: mediaTime(1) }, compositionStart: ms(10_000), linkedAudio: null },
    ], 'clip_bbbbbbbb'))
    expect(rewrite.ok).toBe(true)
    if (!rewrite.ok) return
    const result = applyTimelineOperation(composition, rewrite.value, [fixture.asset])
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error.reason).toBe('FREEZE_OPERATION_UNSUPPORTED')
  })
})
