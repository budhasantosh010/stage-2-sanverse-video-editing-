import { describe, expect, it } from 'vitest'

import {
  acceptChangeSet,
  deserializeProject,
  effectiveFootageMotions,
  evaluateProject,
  redoChangeSet,
  serializeProject,
  setChangeSetActive,
  undoChangeSet,
  validateOperationAgainstComposition,
} from './project.ts'
import {
  DEFAULT_EVALUATED_FOOTAGE_MOTION,
  evaluateFootageMotionAt,
  foldFootageMotionOperations,
  footageMotionsOverlap,
  resetFootageMotionOperation,
  validateFootageMotionOperation,
} from './footage-motion.ts'
import { placeSourceSpan } from './composition.ts'
import {
  changeSetOf,
  ms,
  testFootageMotion,
  testImageAsset,
  testMultiAssetProject,
  testProject,
  testRemove,
  testReorder,
  testSplit,
  testTrim,
  TEST_ASSET_ID,
  TEST_CLIP_ID,
  TEST_IMAGE_ASSET_ID,
} from './test-fixtures.ts'
import { addAsset } from './project.ts'

const accept = (
  project: ReturnType<typeof testProject>,
  changeSetId: string,
  operations: Parameters<typeof changeSetOf>[2],
) => {
  const result = acceptChangeSet(project, changeSetOf(changeSetId, project.revision, operations))
  if (!result.ok) throw new Error(JSON.stringify(result.error))
  return result.value
}

describe('P1-F.0 source-anchored footage-motion operation', () => {
  it('validates and deep-freezes a complete static motion operation', () => {
    const input = testFootageMotion()
    const validated = validateFootageMotionOperation(input)
    expect(validated.ok).toBe(true)
    if (!validated.ok) return
    expect(validated.value).toEqual(input)
    expect(Object.isFrozen(validated.value)).toBe(true)
    expect(Object.isFrozen(validated.value.transform)).toBe(true)
    expect(Object.isFrozen(validated.value.crop)).toBe(true)
    expect(Object.isFrozen(validated.value.tracks)).toBe(true)
  })

  it('validates bounded animated pan, zoom, rotation, and crop tracks', () => {
    const animated = testFootageMotion({
      tracks: [
        {
          property: 'scale',
          keyframes: [
            { at: ms(0), value: 1, easing: { kind: 'cubic-bezier', x1: 0.2, y1: 0, x2: 0, y2: 1 } },
            { at: ms(4_000), value: 1.25, easing: { kind: 'linear' } },
          ],
        },
        {
          property: 'translate-x',
          keyframes: [
            { at: ms(0), value: 0, easing: { kind: 'spring', mass: 1, stiffness: 180, damping: 12, velocity: 0 } },
            { at: ms(4_000), value: -0.2, easing: { kind: 'linear' } },
          ],
        },
        {
          property: 'rotation',
          keyframes: [
            { at: ms(0), value: 0, easing: { kind: 'bounce', intensity: 0.4 } },
            { at: ms(4_000), value: 4, easing: { kind: 'linear' } },
          ],
        },
        {
          property: 'crop-left',
          keyframes: [
            { at: ms(0), value: 0, easing: { kind: 'linear' } },
            { at: ms(4_000), value: 0.1, easing: { kind: 'linear' } },
          ],
        },
      ],
    })
    expect(validateFootageMotionOperation(animated).ok).toBe(true)
  })

  it.each([
    ['invalid operation ID', { operationId: 'bad' }],
    ['invalid motion ID', { motionId: 'bad' }],
    ['unknown capability', { capabilityId: 'sanverse.unknown/v1' }],
    ['zero duration', { sourceInterval: { start: ms(5_000), duration: ms(0) } }],
    ['non-opaque primary footage', { transform: { ...testFootageMotion().transform, opacity: 0.5 } }],
    ['out-of-range crop', { crop: { top: 0.7, right: 0, bottom: 0.4, left: 0 } }],
  ])('refuses %s', (_label, overrides) => {
    expect(validateFootageMotionOperation(testFootageMotion(overrides as never)).ok).toBe(false)
  })

  it('refuses unknown fields', () => {
    expect(validateFootageMotionOperation({ ...testFootageMotion(), surprise: true }).ok).toBe(false)
  })

  it('refuses opacity tracks, duplicate tracks, unsorted keyframes, out-of-interval keyframes, and invalid easing', () => {
    const frame = (atMs: number, value: number, easing: unknown = { kind: 'linear' }) => ({
      at: ms(atMs),
      value,
      easing,
    })
    const cases = [
      [{ property: 'opacity', keyframes: [frame(0, 1), frame(4_000, 1)] }],
      [
        { property: 'scale', keyframes: [frame(0, 1), frame(4_000, 1.2)] },
        { property: 'scale', keyframes: [frame(0, 1), frame(4_000, 1.3)] },
      ],
      [{ property: 'scale', keyframes: [frame(2_000, 1), frame(1_000, 1.2)] }],
      [{ property: 'scale', keyframes: [frame(0, 1), frame(4_001, 1.2)] }],
      [{ property: 'scale', keyframes: [frame(0, 1, { kind: 'warp' }), frame(4_000, 1.2)] }],
    ]
    cases.forEach((tracks) => {
      expect(validateFootageMotionOperation(testFootageMotion({ tracks: tracks as never })).ok).toBe(false)
    })
  })

  it('refuses unknown, wrong-kind, out-of-asset, and removed source context', () => {
    const project = testMultiAssetProject()
    const evaluation = evaluateProject(project)
    expect(validateOperationAgainstComposition(
      testFootageMotion({ assetId: 'asset_missing' }),
      evaluation.composition,
      project.assets,
    ).ok).toBe(false)
    expect(validateOperationAgainstComposition(
      testFootageMotion({ assetId: TEST_IMAGE_ASSET_ID }),
      evaluation.composition,
      project.assets,
    ).ok).toBe(false)
    expect(validateOperationAgainstComposition(
      testFootageMotion({ sourceInterval: { start: ms(29_000), duration: ms(2_000) } }),
      evaluation.composition,
      project.assets,
    ).ok).toBe(false)

    const split = accept(testProject(), 'changeset_split0001', [testSplit({ atClipTime: ms(4_000) })])
    const removed = accept(split, 'changeset_remove001', [testRemove({ ripple: true })])
    expect(validateOperationAgainstComposition(
      testFootageMotion({ sourceInterval: { start: ms(1_000), duration: ms(2_000) } }),
      evaluateProject(removed).composition,
      removed.assets,
    ).ok).toBe(false)
  })
})

describe('P1-F.0 deterministic folding, overlap, evaluation, and history', () => {
  it('uses the latest full-state repair per motion ID without mutating inputs', () => {
    const first = testFootageMotion()
    const repaired = testFootageMotion({
      operationId: 'operation_motion002',
      transform: { ...first.transform, scale: 1.1 },
    })
    const other = testFootageMotion({
      operationId: 'operation_motion003',
      motionId: 'motion_bbbbbbbb',
      sourceInterval: { start: ms(10_000), duration: ms(2_000) },
    })
    const input = Object.freeze([first, other, repaired])
    const before = JSON.stringify(input)
    expect(foldFootageMotionOperations(input)).toEqual([other, repaired])
    expect(JSON.stringify(input)).toBe(before)
  })

  it('treats touching half-open intervals as disjoint and real overlap as conflict', () => {
    const first = testFootageMotion()
    const touching = testFootageMotion({
      operationId: 'operation_motion002',
      motionId: 'motion_bbbbbbbb',
      sourceInterval: { start: ms(9_000), duration: ms(2_000) },
    })
    const overlapping = testFootageMotion({
      operationId: 'operation_motion003',
      motionId: 'motion_cccccccc',
      sourceInterval: { start: ms(8_999), duration: ms(2_000) },
    })
    expect(footageMotionsOverlap(first, touching)).toBe(false)
    expect(footageMotionsOverlap(first, overlapping)).toBe(true)
  })

  it('refuses a different overlapping motion but accepts a same-ID repair', () => {
    const first = accept(testProject(), 'changeset_motion001', [testFootageMotion()])
    const overlap = acceptChangeSet(first, changeSetOf('changeset_motion002', first.revision, [
      testFootageMotion({
        operationId: 'operation_motion002',
        motionId: 'motion_bbbbbbbb',
        sourceInterval: { start: ms(7_000), duration: ms(2_000) },
      }),
    ]))
    expect(overlap.ok).toBe(false)

    const repaired = accept(first, 'changeset_motion003', [testFootageMotion({
      operationId: 'operation_motion003',
      transform: { ...testFootageMotion().transform, scale: 1.1 },
    })])
    expect(effectiveFootageMotions(repaired)).toHaveLength(1)
    expect(effectiveFootageMotions(repaired)[0].transform.scale).toBe(1.1)
  })

  it('removes effective motion through one full-state default repair and Undo restores it', () => {
    const first = accept(testProject(), 'changeset_motion001', [testFootageMotion()])
    const reset = resetFootageMotionOperation({
      operationId: 'operation_motion002',
      motionId: 'motion_aaaaaaaa',
      assetId: TEST_ASSET_ID,
      sourceInterval: testFootageMotion().sourceInterval,
    })
    const removed = accept(first, 'changeset_motion002', [reset])
    expect(effectiveFootageMotions(removed)).toEqual([])
    const undone = undoChangeSet(removed)
    expect(undone.ok).toBe(true)
    if (!undone.ok) return
    expect(effectiveFootageMotions(undone.value)[0].transform.scale).toBe(1.2)
    const redone = redoChangeSet(undone.value)
    expect(redone.ok).toBe(true)
    if (redone.ok) expect(effectiveFootageMotions(redone.value)).toEqual([])
  })

  it('excludes inactive and newly blocked motion records', () => {
    const first = accept(testProject(), 'changeset_motion001', [testFootageMotion()])
    const inactive = setChangeSetActive(first, 'changeset_motion001', false)
    expect(inactive.ok).toBe(true)
    if (inactive.ok) expect(effectiveFootageMotions(inactive.value)).toEqual([])

    const split = accept(first, 'changeset_split0001', [testSplit({ atClipTime: ms(10_000) })])
    const removed = accept(split, 'changeset_remove001', [testRemove({ ripple: true })])
    expect(effectiveFootageMotions(removed)).toEqual([])
    expect(evaluateProject(removed).records[0].blockedReason).toBe('SOURCE_SPAN_REMOVED')
  })

  it('evaluates exact source-relative boundaries and returns defaults outside the interval', () => {
    const motion = testFootageMotion({
      transform: { ...testFootageMotion().transform, scale: 1 },
      tracks: [{
        property: 'scale',
        keyframes: [
          { at: ms(0), value: 1, easing: { kind: 'linear' } },
          { at: ms(4_000), value: 1.4, easing: { kind: 'linear' } },
        ],
      }],
    })
    expect(evaluateFootageMotionAt({ motion, sourceTime: ms(4_999) })).toBe(DEFAULT_EVALUATED_FOOTAGE_MOTION)
    expect(evaluateFootageMotionAt({ motion, sourceTime: ms(5_000) }).transform.scale).toBe(1)
    expect(evaluateFootageMotionAt({ motion, sourceTime: ms(7_000) }).transform.scale).toBeCloseTo(1.2)
    expect(evaluateFootageMotionAt({ motion, sourceTime: ms(8_999) }).transform.scale).toBeGreaterThan(1.39)
    expect(evaluateFootageMotionAt({ motion, sourceTime: ms(9_000) })).toBe(DEFAULT_EVALUATED_FOOTAGE_MOTION)
  })

  it('round-trips accepted motion and refuses stale acceptance without changing an existing project first', () => {
    const project = testProject()
    const snapshot = JSON.stringify(project)
    expect(effectiveFootageMotions(project)).toEqual([])
    expect(JSON.stringify(project)).toBe(snapshot)

    const accepted = accept(project, 'changeset_motion001', [testFootageMotion()])
    const serialized = serializeProject(accepted)
    expect(serialized.ok).toBe(true)
    if (!serialized.ok) return
    const restored = deserializeProject(serialized.value)
    expect(restored.ok).toBe(true)
    if (restored.ok) expect(effectiveFootageMotions(restored.value)).toEqual(effectiveFootageMotions(accepted))

    const stale = acceptChangeSet(accepted, changeSetOf('changeset_stale0001', 0, [
      testFootageMotion({ operationId: 'operation_motion002' }),
    ]))
    expect(stale.ok).toBe(false)
    if (!stale.ok) expect(stale.error.code).toBe('REVISION_CONFLICT')
  })
})

describe('P1-F.0 source-anchor consequences', () => {
  it('survives a split and maps each surviving half exactly once', () => {
    const motionFirst = accept(testProject(), 'changeset_motion001', [testFootageMotion({
      sourceInterval: { start: ms(8_000), duration: ms(4_000) },
    })])
    const split = accept(motionFirst, 'changeset_split0001', [testSplit({ atClipTime: ms(10_000) })])
    const evaluation = evaluateProject(split)
    const placements = placeSourceSpan(
      evaluation.composition,
      TEST_ASSET_ID,
      effectiveFootageMotions(split)[0].sourceInterval,
    )
    expect(placements.map((placement) => ({
      sourceStart: placement.sourceRange.start.ticks,
      duration: placement.sourceRange.duration.ticks,
      compositionStart: placement.compositionRange.start.ticks,
    }))).toEqual([
      { sourceStart: ms(8_000).ticks, duration: ms(2_000).ticks, compositionStart: ms(8_000).ticks },
      { sourceStart: ms(10_000).ticks, duration: ms(2_000).ticks, compositionStart: ms(10_000).ticks },
    ])
  })

  it('assigns an exact split-boundary motion only to the right half', () => {
    const motionFirst = accept(testProject(), 'changeset_motion001', [testFootageMotion({
      sourceInterval: { start: ms(10_000), duration: ms(2_000) },
    })])
    const split = accept(motionFirst, 'changeset_split0001', [testSplit({ atClipTime: ms(10_000) })])
    const placements = placeSourceSpan(
      evaluateProject(split).composition,
      TEST_ASSET_ID,
      effectiveFootageMotions(split)[0].sourceInterval,
    )
    expect(placements).toHaveLength(1)
    expect(placements[0].clip.clipId).not.toBe(TEST_CLIP_ID)
    expect(placements[0].compositionRange.start.ticks).toBe(ms(10_000).ticks)
  })

  it('moves earlier after trim-before and preserves source-relative evaluation after trim-through', () => {
    const motionFirst = accept(testProject(), 'changeset_motion001', [testFootageMotion()])
    const trimmedBefore = accept(motionFirst, 'changeset_trim0001', [testTrim({ trimStart: ms(2_000), ripple: true })])
    let placements = placeSourceSpan(
      evaluateProject(trimmedBefore).composition,
      TEST_ASSET_ID,
      effectiveFootageMotions(trimmedBefore)[0].sourceInterval,
    )
    expect(placements[0].compositionRange.start.ticks).toBe(ms(3_000).ticks)
    expect(placements[0].sourceRange.start.ticks).toBe(ms(5_000).ticks)

    const through = accept(motionFirst, 'changeset_trim0002', [testTrim({ trimStart: ms(6_000), ripple: true })])
    placements = placeSourceSpan(
      evaluateProject(through).composition,
      TEST_ASSET_ID,
      effectiveFootageMotions(through)[0].sourceInterval,
    )
    expect(placements[0].sourceRange.start.ticks).toBe(ms(6_000).ticks)
    expect(placements[0].sourceRange.duration.ticks).toBe(ms(3_000).ticks)
    expect(placements[0].compositionRange.start.ticks).toBe(0)
  })

  it('does not appear over a gap and ripple removal shifts later source motion with footage', () => {
    const base = accept(testProject(), 'changeset_motion001', [testFootageMotion()])
    const split = accept(base, 'changeset_split0001', [testSplit({ atClipTime: ms(4_000) })])

    const gap = accept(split, 'changeset_remove001', [testRemove({ ripple: false })])
    let placements = placeSourceSpan(
      evaluateProject(gap).composition,
      TEST_ASSET_ID,
      effectiveFootageMotions(gap)[0].sourceInterval,
    )
    expect(placements[0].compositionRange.start.ticks).toBe(ms(5_000).ticks)
    expect(evaluateProject(gap).composition.tracks[0].clips[0].compositionStart.ticks).toBe(ms(4_000).ticks)

    const ripple = accept(split, 'changeset_remove002', [testRemove({
      operationId: 'operation_remove02',
      ripple: true,
    })])
    placements = placeSourceSpan(
      evaluateProject(ripple).composition,
      TEST_ASSET_ID,
      effectiveFootageMotions(ripple)[0].sourceInterval,
    )
    expect(placements[0].compositionRange.start.ticks).toBe(ms(1_000).ticks)
  })

  it('follows source content after reorder and applies to repeated source placements deterministically', () => {
    const base = accept(testProject(), 'changeset_motion001', [testFootageMotion()])
    const split = accept(base, 'changeset_split0001', [testSplit({ atClipTime: ms(10_000) })])
    const reordered = accept(split, 'changeset_reorder1', [testReorder({
      operationId: 'operation_reorder2',
      clipId: 'clip_bbbbbbbb',
      toIndex: 0,
    })])
    let placements = placeSourceSpan(
      evaluateProject(reordered).composition,
      TEST_ASSET_ID,
      effectiveFootageMotions(reordered)[0].sourceInterval,
    )
    expect(placements[0].compositionRange.start.ticks).toBe(ms(25_000).ticks)

    const composition = evaluateProject(testProject()).composition
    const original = composition.tracks[0].clips[0]
    const repeatedComposition = {
      ...composition,
      tracks: [{
        ...composition.tracks[0],
        clips: [
          { ...original, sourceRange: { start: ms(5_000), duration: ms(4_000) }, compositionStart: ms(0) },
          {
            ...original,
            clipId: 'clip_bbbbbbbb',
            sourceRange: { start: ms(5_000), duration: ms(4_000) },
            compositionStart: ms(4_000),
          },
        ],
      }],
    }
    placements = placeSourceSpan(repeatedComposition, TEST_ASSET_ID, testFootageMotion().sourceInterval)
    expect(placements.map((placement) => placement.compositionRange.start.ticks)).toEqual([
      ms(0).ticks,
      ms(4_000).ticks,
    ])
  })

  it('preserves compatibility when a project contains unrelated extra assets', () => {
    const project = testProject()
    const withImage = addAsset(project, testImageAsset())
    expect(withImage.ok).toBe(true)
    if (!withImage.ok) return
    expect(effectiveFootageMotions(withImage.value)).toEqual([])
    expect(evaluateProject(withImage.value).composition).toEqual(evaluateProject(project).composition)
  })
})
