import { describe, expect, it } from 'vitest'

import { compositionDuration, findClip, type Clip, type Composition } from './composition'
import { applyTimelineOperation, validateTimelineOperation, type TimelineOperation } from './timeline-operations'
import {
  TEST_CLIP_ID,
  ms,
  testAsset,
  testProject,
  testRemove,
  testReorder,
  testSetAudio,
  testSetEnabled,
  testSplit,
  testTrim,
} from './test-fixtures'

const asset = testAsset()
const base = testProject(asset).composition

const apply = (composition: Composition, operation: TimelineOperation) =>
  applyTimelineOperation(composition, operation, [asset])

const mustApply = (composition: Composition, operation: TimelineOperation): Composition => {
  const result = apply(composition, operation)
  if (!result.ok) throw new Error(`apply failed: ${JSON.stringify(result.error)}`)
  return result.value
}

const clipsOf = (composition: Composition): readonly Clip[] =>
  [...composition.tracks.flatMap((track) => track.clips)].sort(
    (left, right) => left.compositionStart.ticks - right.compositionStart.ticks,
  )

describe('splitting a piece of footage', () => {
  it('produces two pieces that meet exactly, with no gap and no overlap', () => {
    const next = mustApply(base, testSplit({ atClipTime: ms(10_000) }))
    const clips = clipsOf(next)
    expect(clips).toHaveLength(2)
    expect(clips[0].sourceRange.duration).toEqual(ms(10_000))
    expect(clips[1].compositionStart).toEqual(ms(10_000))
    expect(clips[1].sourceRange.start).toEqual(ms(10_000))
    expect(clips[1].sourceRange.duration).toEqual(ms(20_000))
    // The finished video is exactly as long as it was: a cut that changes the
    // length without being asked to is a cut the user did not make.
    expect(compositionDuration(next)).toEqual(compositionDuration(base))
  })

  it('leaves the left half holding the original identifier', () => {
    // Everything anchored to that piece keeps pointing at something real.
    const next = mustApply(base, testSplit())
    expect(findClip(next, TEST_CLIP_ID)?.sourceRange.start).toEqual(ms(0))
  })

  it('refuses a cut at the very start or the very end', () => {
    // Both would produce a piece of zero length, which is not a cut at all.
    expect(apply(base, testSplit({ atClipTime: ms(0) }))).toMatchObject({ ok: false })
    expect(apply(base, testSplit({ atClipTime: ms(30_000) }))).toMatchObject({
      ok: false,
      error: { reason: 'SPLIT_TIME_OUTSIDE_CLIP' },
    })
  })

  it('refuses to reuse an identifier that already exists', () => {
    const once = mustApply(base, testSplit({ newClipId: 'clip_bbbbbbbb' }))
    const again = apply(
      once,
      testSplit({ operationId: 'operation_split002', atClipTime: ms(5_000), newClipId: 'clip_bbbbbbbb' }),
    )
    expect(again).toMatchObject({ ok: false, error: { reason: 'CLIP_ID_IN_USE' } })
  })

  it('shortens a ramp that no longer fits the piece it sits on', () => {
    const withFades = mustApply(base, testSetAudio({ fadeIn: ms(4_000), fadeOut: ms(4_000) }))
    const split = mustApply(withFades, testSplit({ atClipTime: ms(2_000) }))
    const clips = clipsOf(split)
    // The head ramp was 4 s but its piece is now 2 s long. Refusing the cut
    // over a fade set minutes earlier would be baffling, so the ramp is
    // shortened — and only the ramp, never the timing of the cut.
    expect(clips[0].fadeIn).toEqual(ms(2_000))
    expect(clips[0].fadeOut).toEqual(ms(0))
    expect(clips[1].fadeIn).toEqual(ms(0))
    expect(clips[1].fadeOut).toEqual(ms(4_000))
  })
})

describe('trimming a piece of footage', () => {
  it('closes the gap when asked to ripple', () => {
    const split = mustApply(base, testSplit({ atClipTime: ms(10_000) }))
    const trimmed = mustApply(split, testTrim({ trimStart: ms(2_000), trimEnd: ms(0), ripple: true }))
    const clips = clipsOf(trimmed)
    expect(clips[0].compositionStart).toEqual(ms(0))
    expect(clips[0].sourceRange.start).toEqual(ms(2_000))
    expect(clips[0].sourceRange.duration).toEqual(ms(8_000))
    // Everything after it moved earlier by exactly what was removed.
    expect(clips[1].compositionStart).toEqual(ms(8_000))
    expect(compositionDuration(trimmed)).toEqual(ms(28_000))
  })

  it('leaves a hole when not asked to ripple', () => {
    const split = mustApply(base, testSplit({ atClipTime: ms(10_000) }))
    const trimmed = mustApply(split, testTrim({ trimStart: ms(2_000), trimEnd: ms(0), ripple: false }))
    const clips = clipsOf(trimmed)
    expect(clips[0].compositionStart).toEqual(ms(2_000))
    expect(clips[1].compositionStart).toEqual(ms(10_000))
    expect(compositionDuration(trimmed)).toEqual(ms(30_000))
  })

  it('refuses a trim that would leave nothing behind', () => {
    expect(apply(base, testTrim({ trimStart: ms(15_000), trimEnd: ms(15_000) }))).toMatchObject({
      ok: false,
      error: { reason: 'TRIM_LEAVES_NOTHING' },
    })
  })

  it('refuses a trim that removes nothing at all', () => {
    // It would still consume a revision and an Undo step, which reads to the
    // user as a button that did nothing.
    expect(validateTimelineOperation(testTrim({ trimStart: ms(0), trimEnd: ms(0) }))).toMatchObject({ ok: false })
  })
})

describe('removing a piece of footage', () => {
  it('closes the gap when asked to ripple', () => {
    const split = mustApply(base, testSplit({ atClipTime: ms(10_000) }))
    const removed = mustApply(split, testRemove({ clipId: TEST_CLIP_ID, ripple: true }))
    const clips = clipsOf(removed)
    expect(clips).toHaveLength(1)
    expect(clips[0].compositionStart).toEqual(ms(0))
    expect(compositionDuration(removed)).toEqual(ms(20_000))
  })

  it('leaves a hole when not asked to ripple', () => {
    const split = mustApply(base, testSplit({ atClipTime: ms(10_000) }))
    const removed = mustApply(split, testRemove({ clipId: TEST_CLIP_ID, ripple: false }))
    const clips = clipsOf(removed)
    expect(clips).toHaveLength(1)
    expect(clips[0].compositionStart).toEqual(ms(10_000))
    expect(compositionDuration(removed)).toEqual(ms(30_000))
  })

  it('refuses to remove the last piece, leaving no video at all', () => {
    expect(apply(base, testRemove())).toMatchObject({
      ok: false,
      error: { reason: 'COMPOSITION_WOULD_BE_EMPTY' },
    })
  })
})

describe('changing the running order', () => {
  it('re-lays the track end to end in the new order', () => {
    const split = mustApply(base, testSplit({ atClipTime: ms(10_000) }))
    const reordered = mustApply(split, testReorder({ clipId: TEST_CLIP_ID, toIndex: 1 }))
    const clips = clipsOf(reordered)
    expect(clips[0].clipId).toBe('clip_bbbbbbbb')
    expect(clips[0].compositionStart).toEqual(ms(0))
    expect(clips[0].sourceRange.duration).toEqual(ms(20_000))
    expect(clips[1].clipId).toBe(TEST_CLIP_ID)
    expect(clips[1].compositionStart).toEqual(ms(20_000))
    expect(compositionDuration(reordered)).toEqual(ms(30_000))
  })

  it('refuses to reorder a track that has holes in it', () => {
    // Whether the holes should travel with the pieces or stay put has no single
    // obvious answer, so this refuses rather than picking one silently.
    const split = mustApply(base, testSplit({ atClipTime: ms(10_000) }))
    // Trimming the head off the SECOND piece without rippling opens a hole
    // between the two.
    const gapped = mustApply(
      split,
      testTrim({ clipId: 'clip_bbbbbbbb', trimStart: ms(2_000), trimEnd: ms(0), ripple: false }),
    )
    expect(apply(gapped, testReorder({ clipId: TEST_CLIP_ID, toIndex: 1 }))).toMatchObject({
      ok: false,
      error: { reason: 'TRACK_HAS_GAPS' },
    })
  })

  it('refuses a position past the end of the running order', () => {
    const split = mustApply(base, testSplit({ atClipTime: ms(10_000) }))
    expect(apply(split, testReorder({ toIndex: 5 }))).toMatchObject({
      ok: false,
      error: { reason: 'INDEX_OUT_OF_RANGE' },
    })
  })
})

describe('hiding a piece and changing its sound', () => {
  it('hides a piece without moving anything else', () => {
    const split = mustApply(base, testSplit({ atClipTime: ms(10_000) }))
    const hidden = mustApply(split, testSetEnabled({ clipId: TEST_CLIP_ID, enabled: false }))
    const clips = clipsOf(hidden)
    expect(clips[0].enabled).toBe(false)
    // Switching it back on must restore the exact video the user saw, so the
    // pieces after it do not move while it is hidden.
    expect(clips[1].compositionStart).toEqual(ms(10_000))
    expect(compositionDuration(hidden)).toEqual(ms(30_000))
  })

  it('refuses to hide the only piece that is still showing', () => {
    expect(apply(base, testSetEnabled({ enabled: false }))).toMatchObject({
      ok: false,
      error: { reason: 'COMPOSITION_WOULD_BE_EMPTY' },
    })
  })

  it('records loudness and ramps on the piece itself', () => {
    const next = mustApply(base, testSetAudio({ gainDb: -6, fadeIn: ms(500), fadeOut: ms(1_000) }))
    const clip = findClip(next, TEST_CLIP_ID)
    expect(clip?.gainDb).toBe(-6)
    expect(clip?.fadeIn).toEqual(ms(500))
    expect(clip?.fadeOut).toEqual(ms(1_000))
  })

  it('refuses ramps that are longer together than the piece they sit on', () => {
    expect(apply(base, testSetAudio({ fadeIn: ms(20_000), fadeOut: ms(20_000) }))).toMatchObject({
      ok: false,
      error: { reason: 'FADE_LONGER_THAN_CLIP' },
    })
  })

  it('refuses a loudness change outside the safe band', () => {
    expect(validateTimelineOperation(testSetAudio({ gainDb: -100 }))).toMatchObject({ ok: false })
    expect(validateTimelineOperation(testSetAudio({ gainDb: 40 }))).toMatchObject({ ok: false })
  })
})

describe('the shape of a timeline operation', () => {
  it('refuses an unknown field rather than dropping it', () => {
    expect(validateTimelineOperation({ ...testSplit(), speed: 2 })).toMatchObject({ ok: false })
  })

  it('refuses a capability that cannot produce this kind of edit', () => {
    expect(
      validateTimelineOperation(testSplit({ capabilityId: 'sanverse.nameplate.component/v1' })),
    ).toMatchObject({ ok: false })
  })

  it('refuses an operation from a different schema version', () => {
    expect(
      validateTimelineOperation({ ...testSplit(), schemaVersion: 'sanverse.operation/v2' }),
    ).toMatchObject({ ok: false })
  })

  it('leaves the original composition untouched on every path', () => {
    const before = JSON.stringify(base)
    mustApply(base, testSplit())
    apply(base, testRemove())
    expect(JSON.stringify(base)).toBe(before)
  })
})
