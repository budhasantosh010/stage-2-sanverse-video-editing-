import { describe, expect, it } from 'vitest'

import {
  acceptChangeSet,
  blockedChangeSets,
  effectiveComposition,
  effectiveFootageMotions,
  redoChangeSet,
  serializeProject,
  setChangeSetActive,
  undoChangeSet,
  validateProject,
  type EditProject,
} from './project.ts'
import { clipAtCompositionTime, placeSourceSpan } from './composition.ts'
import { DEFAULT_VISUAL_PROPERTIES } from './visual-properties.ts'
import {
  TEST_ASSET_ID,
  TEST_CLIP_ID,
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
} from './test-fixtures.ts'
import { addAsset } from './project.ts'

function accept(project: EditProject, changeSetId: string, operation: Parameters<typeof changeSetOf>[2][number]) {
  const result = acceptChangeSet(project, changeSetOf(changeSetId, project.revision, [operation]))
  if (!result.ok) throw new Error(JSON.stringify(result.error))
  return result.value
}

describe('primary footage motion project consequences', () => {
  it('accepts one motion, exposes it through project evaluation, and preserves the input project', () => {
    const project = testProject()
    const before = JSON.stringify(project)
    const accepted = accept(project, 'changeset_motion01', testFootageMotion())

    expect(JSON.stringify(project)).toBe(before)
    expect(effectiveFootageMotions(accepted)).toHaveLength(1)
    expect(effectiveFootageMotions(accepted)[0].motionId).toBe('motion_aaaaaaaa')
  })

  it('refuses unknown, non-video, out-of-asset, and non-surviving source intervals', () => {
    let multi = testMultiAssetProject()
    const unknown = acceptChangeSet(multi, changeSetOf('changeset_motion01', multi.revision, [
      testFootageMotion({ assetId: 'asset_eeeeeeee' }),
    ]))
    const image = acceptChangeSet(multi, changeSetOf('changeset_motion02', multi.revision, [
      testFootageMotion({ assetId: testImageAsset().assetId }),
    ]))
    const outside = acceptChangeSet(multi, changeSetOf('changeset_motion03', multi.revision, [
      testFootageMotion({ sourceInterval: { start: ms(29_000), duration: ms(2_000) } }),
    ]))

    multi = accept(multi, 'changeset_split001', testSplit({ atClipTime: ms(10_000) }))
    multi = accept(multi, 'changeset_trim0001', testTrim({
      clipId: TEST_CLIP_ID,
      trimStart: ms(0),
      trimEnd: ms(5_000),
      ripple: true,
    }))
    const removedSpan = acceptChangeSet(multi, changeSetOf('changeset_motion04', multi.revision, [
      testFootageMotion({ sourceInterval: { start: ms(7_000), duration: ms(2_000) } }),
    ]))

    expect(unknown.ok).toBe(false)
    expect(image.ok).toBe(false)
    expect(outside.ok).toBe(false)
    expect(removedSpan.ok).toBe(false)
  })

  it('refuses overlap between different motion IDs but accepts a same-ID full-state repair', () => {
    let project = accept(testProject(), 'changeset_motion01', testFootageMotion())
    const overlap = acceptChangeSet(project, changeSetOf('changeset_motion02', project.revision, [
      testFootageMotion({
        operationId: 'operation_motion002',
        motionId: 'motion_bbbbbbbb',
        sourceInterval: { start: ms(8_000), duration: ms(2_000) },
      }),
    ]))
    expect(overlap.ok).toBe(false)

    project = accept(project, 'changeset_motion03', testFootageMotion({
      operationId: 'operation_motion003',
      sourceInterval: { start: ms(4_000), duration: ms(7_000) },
      transform: { ...DEFAULT_VISUAL_PROPERTIES.transform, scale: 1.35 },
    }))
    expect(effectiveFootageMotions(project)).toHaveLength(1)
    expect(effectiveFootageMotions(project)[0].transform.scale).toBe(1.35)
  })

  it('survives a split with exact half-open placement and no duplicate canonical motion', () => {
    let project = accept(testProject(), 'changeset_motion01', testFootageMotion({
      sourceInterval: { start: ms(5_000), duration: ms(5_000) },
    }))
    project = accept(project, 'changeset_split001', testSplit({ atClipTime: ms(7_000) }))

    const composition = effectiveComposition(project)
    const placements = placeSourceSpan(composition, TEST_ASSET_ID, effectiveFootageMotions(project)[0].sourceInterval)
    expect(effectiveFootageMotions(project)).toHaveLength(1)
    expect(placements).toHaveLength(2)
    expect(placements.map((placement) => placement.sourceRange)).toEqual([
      { start: ms(5_000), duration: ms(2_000) },
      { start: ms(7_000), duration: ms(3_000) },
    ])
    expect(placements[0].compositionRange.start.ticks + placements[0].compositionRange.duration.ticks)
      .toBe(placements[1].compositionRange.start.ticks)
  })

  it('moves earlier after a front trim and preserves source-relative timing through a trim', () => {
    let project = accept(testProject(), 'changeset_motion01', testFootageMotion())
    project = accept(project, 'changeset_trim0001', testTrim({ trimStart: ms(2_000), trimEnd: ms(0), ripple: true }))
    let placement = placeSourceSpan(
      effectiveComposition(project),
      TEST_ASSET_ID,
      effectiveFootageMotions(project)[0].sourceInterval,
    )[0]
    expect(placement.compositionRange.start).toEqual(ms(3_000))
    expect(placement.sourceRange.start).toEqual(ms(5_000))

    let through = accept(testProject(), 'changeset_motion02', testFootageMotion())
    through = accept(through, 'changeset_trim0002', testTrim({
      trimStart: ms(7_000),
      trimEnd: ms(0),
      ripple: true,
    }))
    placement = placeSourceSpan(
      effectiveComposition(through),
      TEST_ASSET_ID,
      effectiveFootageMotions(through)[0].sourceInterval,
    )[0]
    expect(placement.sourceRange).toEqual({ start: ms(7_000), duration: ms(2_000) })
    expect(placement.compositionRange.start).toEqual(ms(0))
  })

  it('blocks motion when all of its source footage is removed and never draws it over a gap', () => {
    let project = accept(testProject(), 'changeset_motion01', testFootageMotion())
    project = accept(project, 'changeset_split001', testSplit({ atClipTime: ms(5_000), newClipId: 'clip_bbbbbbbb' }))
    project = accept(project, 'changeset_split002', testSplit({
      operationId: 'operation_split002',
      clipId: 'clip_bbbbbbbb',
      atClipTime: ms(5_000),
      newClipId: 'clip_cccccccc',
    }))
    project = accept(project, 'changeset_remove01', testRemove({ clipId: 'clip_bbbbbbbb', ripple: false }))

    expect(effectiveFootageMotions(project)).toEqual([])
    expect(blockedChangeSets(project).some((record) => record.blockedReason === 'SOURCE_SPAN_REMOVED')).toBe(true)
    expect(clipAtCompositionTime(effectiveComposition(project), ms(7_000))).toBeUndefined()
  })

  it('shifts later surviving motion with ripple removal and follows source through reorder', () => {
    let project = accept(testProject(), 'changeset_motion01', testFootageMotion({
      sourceInterval: { start: ms(12_000), duration: ms(3_000) },
    }))
    project = accept(project, 'changeset_split001', testSplit({ atClipTime: ms(10_000), newClipId: 'clip_bbbbbbbb' }))
    project = accept(project, 'changeset_reorder1', testReorder({ clipId: 'clip_bbbbbbbb', toIndex: 0 }))
    let placement = placeSourceSpan(
      effectiveComposition(project), TEST_ASSET_ID, effectiveFootageMotions(project)[0].sourceInterval,
    )[0]
    expect(placement.compositionRange.start).toEqual(ms(2_000))

    let ripple = accept(testProject(), 'changeset_motion02', testFootageMotion({
      sourceInterval: { start: ms(12_000), duration: ms(3_000) },
    }))
    ripple = accept(ripple, 'changeset_split002', testSplit({ atClipTime: ms(5_000), newClipId: 'clip_bbbbbbbb' }))
    ripple = accept(ripple, 'changeset_remove02', testRemove({ clipId: TEST_CLIP_ID, ripple: true }))
    placement = placeSourceSpan(
      effectiveComposition(ripple), TEST_ASSET_ID, effectiveFootageMotions(ripple)[0].sourceInterval,
    )[0]
    expect(placement.compositionRange.start).toEqual(ms(7_000))
  })

  it('Undo, Redo, and selective deactivation restore the exact prior motion state', () => {
    let project = accept(testProject(), 'changeset_motion01', testFootageMotion())
    project = accept(project, 'changeset_motion02', testFootageMotion({
      operationId: 'operation_motion002',
      transform: { ...DEFAULT_VISUAL_PROPERTIES.transform, scale: 1.4 },
    }))
    expect(effectiveFootageMotions(project)[0].transform.scale).toBe(1.4)

    const undone = undoChangeSet(project)
    expect(undone.ok).toBe(true)
    if (!undone.ok) return
    expect(effectiveFootageMotions(undone.value)[0].transform.scale).toBe(1.2)

    const redone = redoChangeSet(undone.value)
    expect(redone.ok).toBe(true)
    if (!redone.ok) return
    expect(effectiveFootageMotions(redone.value)[0].transform.scale).toBe(1.4)

    const deactivated = setChangeSetActive(redone.value, 'changeset_motion02', false)
    expect(deactivated.ok).toBe(true)
    if (!deactivated.ok) return
    expect(effectiveFootageMotions(deactivated.value)[0].transform.scale).toBe(1.2)
  })

  it('applies the same source-anchored motion to repeated placements deterministically', () => {
    const base = testProject()
    const original = base.composition.tracks[0].clips[0]
    const repeated: EditProject = {
      ...base,
      composition: {
        ...base.composition,
        tracks: [{
          ...base.composition.tracks[0],
          clips: [
            { ...original, sourceRange: { start: ms(0), duration: ms(10_000) } },
            {
              ...original,
              clipId: 'clip_bbbbbbbb',
              sourceRange: { start: ms(0), duration: ms(10_000) },
              compositionStart: ms(10_000),
            },
          ],
        }],
      },
    }
    const validated = validateProject(repeated)
    expect(validated.ok).toBe(true)
    if (!validated.ok) return
    const project = accept(validated.value, 'changeset_motion01', testFootageMotion({
      sourceInterval: { start: ms(2_000), duration: ms(2_000) },
    }))
    const placements = placeSourceSpan(
      effectiveComposition(project), TEST_ASSET_ID, effectiveFootageMotions(project)[0].sourceInterval,
    )
    expect(placements.map((placement) => placement.compositionRange.start)).toEqual([ms(2_000), ms(12_000)])
  })

  it('loads and serializes an existing P1-E.1 project unchanged when no motion exists', () => {
    const project = testProject()
    const validated = validateProject(project)
    expect(validated.ok).toBe(true)
    expect(effectiveFootageMotions(project)).toEqual([])
    const serialized = serializeProject(project)
    expect(serialized.ok).toBe(true)
    if (!serialized.ok) return
    expect(JSON.parse(serialized.value)).toEqual(project)
  })
})
