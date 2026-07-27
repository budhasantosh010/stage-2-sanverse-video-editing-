import { describe, expect, it } from 'vitest'

import {
  acceptChangeSet,
  activeOperations,
  blockedChangeSets,
  compositionDuration,
  effectiveComposition,
  placeSourceSpan,
  setChangeSetActive,
  undoChangeSet,
  type EditProject,
} from './project'
import {
  TEST_ASSET_ID,
  TEST_CLIP_ID,
  changeSetOf,
  ms,
  testOperation,
  testProject,
  testRemove,
  testSplit,
  testTrim,
} from './test-fixtures'

/**
 * These are the tests that decide whether cutting is safe.
 *
 * A nameplate is pinned to a moment of the ORIGINAL footage. Every case below
 * asks the same question in a different way: after the footage is cut, is the
 * nameplate still on the thing the user pointed at?
 */

const accept = (project: EditProject, changeSetId: string, operations: Parameters<typeof changeSetOf>[2]) => {
  const result = acceptChangeSet(project, changeSetOf(changeSetId, project.revision, operations))
  if (!result.ok) throw new Error(`accept failed: ${JSON.stringify(result.error)}`)
  return result.value
}

/** Where the fixture nameplate (footage 2 s to 7 s) currently appears on screen. */
const nameplatePlacements = (project: EditProject) =>
  placeSourceSpan(effectiveComposition(project), TEST_ASSET_ID, {
    start: ms(2_000),
    duration: ms(5_000),
  })

describe('an edit anchored to the footage survives cutting', () => {
  it('moves with the footage when the head is trimmed away', () => {
    const withPlate = accept(testProject(), 'changeset_aaaaaaaa', [testOperation()])
    expect(nameplatePlacements(withPlate)[0].compositionRange.start).toEqual(ms(2_000))

    const trimmed = accept(withPlate, 'changeset_bbbbbbbb', [
      testTrim({ trimStart: ms(1_000), trimEnd: ms(0), ripple: true }),
    ])

    // One second of footage was removed from the front, so the same face is now
    // one second earlier in the finished video — and the nameplate is with it.
    const placements = nameplatePlacements(trimmed)
    expect(placements).toHaveLength(1)
    expect(placements[0].compositionRange.start).toEqual(ms(1_000))
    expect(placements[0].compositionRange.duration).toEqual(ms(5_000))
    // Had it been stored against the finished video instead, it would still say
    // 2 s — which is now a different moment of the recording, with no warning.
  })

  it('appears on both sides when a cut passes through the middle of it', () => {
    const withPlate = accept(testProject(), 'changeset_aaaaaaaa', [testOperation()])
    const split = accept(withPlate, 'changeset_bbbbbbbb', [testSplit({ atClipTime: ms(4_000) })])

    const placements = nameplatePlacements(split)
    expect(placements).toHaveLength(2)
    expect(placements[0].compositionRange.start).toEqual(ms(2_000))
    expect(placements[0].compositionRange.duration).toEqual(ms(2_000))
    expect(placements[1].compositionRange.start).toEqual(ms(4_000))
    expect(placements[1].compositionRange.duration).toEqual(ms(3_000))
    // The two halves meet exactly, so on screen it is still one unbroken plate.
  })

  it('is reported as blocked, never relocated, when its footage is deleted', () => {
    const withPlate = accept(testProject(), 'changeset_aaaaaaaa', [testOperation()])
    const split = accept(withPlate, 'changeset_bbbbbbbb', [testSplit({ atClipTime: ms(10_000) })])
    const cut = accept(split, 'changeset_cccccccc', [testRemove({ clipId: TEST_CLIP_ID, ripple: true })])

    // The first ten seconds are gone, and the nameplate lived at 2 s to 7 s.
    expect(nameplatePlacements(cut)).toHaveLength(0)
    const blocked = blockedChangeSets(cut)
    expect(blocked).toHaveLength(1)
    expect(blocked[0].changeSet.changeSetId).toBe('changeset_aaaaaaaa')
    expect(blocked[0].blockedReason).toBe('SOURCE_SPAN_REMOVED')
    // It contributes nothing to the export, but it is still in the history, so
    // the user can see it and decide, rather than finding it silently gone.
    expect(cut.changeSets).toHaveLength(3)
    expect(activeOperations(cut).some((operation) => operation.kind === 'add-nameplate')).toBe(false)
  })

  it('comes back exactly as it was when the cut is switched off again', () => {
    const withPlate = accept(testProject(), 'changeset_aaaaaaaa', [testOperation()])
    const split = accept(withPlate, 'changeset_bbbbbbbb', [testSplit({ atClipTime: ms(10_000) })])
    const cut = accept(split, 'changeset_cccccccc', [testRemove({ clipId: TEST_CLIP_ID, ripple: true })])

    const restored = setChangeSetActive(cut, 'changeset_cccccccc', false)
    if (!restored.ok) throw new Error('setup failed')

    expect(compositionDuration(effectiveComposition(restored.value))).toEqual(ms(30_000))
    expect(nameplatePlacements(restored.value)[0].compositionRange.start).toEqual(ms(2_000))
    expect(blockedChangeSets(restored.value)).toHaveLength(0)
  })
})

describe('a cut is an ordinary approved change', () => {
  it('is exactly one Undo, even when it changed the whole running order', () => {
    const split = accept(testProject(), 'changeset_aaaaaaaa', [testSplit({ atClipTime: ms(10_000) })])
    const cut = accept(split, 'changeset_bbbbbbbb', [testRemove({ clipId: TEST_CLIP_ID, ripple: true })])
    expect(compositionDuration(effectiveComposition(cut))).toEqual(ms(20_000))

    const undone = undoChangeSet(cut)
    if (!undone.ok) throw new Error('setup failed')
    expect(compositionDuration(effectiveComposition(undone.value))).toEqual(ms(30_000))
  })

  it('is all or nothing: a change set holding one impossible cut applies none of it', () => {
    const split = accept(testProject(), 'changeset_aaaaaaaa', [testSplit({ atClipTime: ms(10_000) })])
    const result = acceptChangeSet(
      split,
      changeSetOf('changeset_bbbbbbbb', split.revision, [
        testTrim({ operationId: 'operation_good0001', trimStart: ms(1_000), trimEnd: ms(0), ripple: true }),
        // 60 seconds cannot be removed from a 10-second piece.
        testTrim({ operationId: 'operation_bad00001', trimStart: ms(60_000), trimEnd: ms(0), ripple: true }),
      ]),
    )
    expect(result).toMatchObject({ ok: false })
    // The good half of the pair did not sneak through.
    expect(compositionDuration(effectiveComposition(split))).toEqual(ms(30_000))
  })

  it('refuses a cut that cannot be applied instead of saving it as broken', () => {
    // "Saved, but doing nothing" is the most confusing state a non-editor can
    // be left in, so acceptance is proved by actually replaying the edit.
    const result = acceptChangeSet(
      testProject(),
      changeSetOf('changeset_aaaaaaaa', 0, [testSplit({ atClipTime: ms(90_000) })]),
    )
    expect(result).toMatchObject({ ok: false })
  })

  it('keeps the imported footage untouched no matter how much is cut', () => {
    const split = accept(testProject(), 'changeset_aaaaaaaa', [testSplit({ atClipTime: ms(10_000) })])
    const cut = accept(split, 'changeset_bbbbbbbb', [testRemove({ clipId: TEST_CLIP_ID, ripple: true })])
    // The stored starting point never changes; only the replay result does.
    expect(compositionDuration(cut.composition)).toEqual(ms(30_000))
    expect(cut.composition.tracks[0].clips).toHaveLength(1)
  })
})
