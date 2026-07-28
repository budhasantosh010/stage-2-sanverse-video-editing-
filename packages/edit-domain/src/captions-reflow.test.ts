import { describe, expect, it } from 'vitest'

import { placeSourceSpan, toSeconds } from './project.ts'
import {
  acceptChangeSet,
  activeCaptionSets,
  blockedChangeSets,
  effectiveComposition,
  type EditProject,
} from './project.ts'
import {
  TEST_CLIP_ID,
  changeSetOf,
  ms,
  testCaptions,
  testProject,
  testRemove,
  testSplit,
} from './test-fixtures.ts'

/**
 * What happens to captions when the video underneath them is cut.
 *
 * This is the behaviour ADR-005 buys, and the reason captions are anchored to
 * the original footage rather than to the finished video. Nothing here
 * recomputes a caption's timing: the timings never change. What changes is
 * where that stretch of footage now sits, and the captions follow it.
 */

const accept = (project: EditProject, changeSet: ReturnType<typeof changeSetOf>): EditProject => {
  const result = acceptChangeSet(project, changeSet)
  if (!result.ok) throw new Error(`accept failed: ${JSON.stringify(result.error)}`)
  return result.value
}

/** Where a cue actually appears in the finished video, in seconds. */
const screenTimes = (project: EditProject): { cueId: string; start: number; duration: number }[] => {
  const composition = effectiveComposition(project)
  const placed: { cueId: string; start: number; duration: number }[] = []
  for (const set of activeCaptionSets(project)) {
    for (const cue of set.cues) {
      for (const placement of placeSourceSpan(composition, set.assetId, cue.sourceInterval)) {
        if (!placement.clip.enabled) continue
        placed.push({
          cueId: cue.cueId,
          start: toSeconds(placement.compositionRange.start),
          duration: toSeconds(placement.compositionRange.duration),
        })
      }
    }
  }
  return placed.sort((left, right) => left.start - right.start)
}

describe('captions when the footage is cut', () => {
  it('shows every cue at its spoken moment when nothing has been cut', () => {
    const project = accept(testProject(), changeSetOf('changeset_cap00001', 0, [testCaptions()]))
    expect(screenTimes(project)).toEqual([
      { cueId: 'cue_0001', start: 1, duration: 1 },
      { cueId: 'cue_0002', start: 3, duration: 1 },
      { cueId: 'cue_0003', start: 5, duration: 1 },
    ])
  })

  it('moves every surviving caption when the opening is removed', () => {
    // Captions at source 1-2s, 3-4s and 5-6s. Remove source 0-2s.
    // Cue 1 is inside the removed part and vanishes; the other two move back 2s.
    let project = accept(testProject(), changeSetOf('changeset_cap00001', 0, [testCaptions()]))
    project = accept(project, changeSetOf('changeset_split001', project.revision, [
      testSplit({ atClipTime: ms(2_000), newClipId: 'clip_bbbbbbbb' }),
    ]))
    project = accept(project, changeSetOf('changeset_remove01', project.revision, [
      testRemove({ clipId: TEST_CLIP_ID, ripple: true }),
    ]))

    expect(screenTimes(project)).toEqual([
      { cueId: 'cue_0002', start: 1, duration: 1 },
      { cueId: 'cue_0003', start: 3, duration: 1 },
    ])
  })

  it('drops only the cues whose footage is gone, never the whole set', () => {
    // This is the difference from a nameplate. Losing 1 caption of 3 must not
    // hide the other 2, or a single cut would silently strip a whole video.
    let project = accept(testProject(), changeSetOf('changeset_cap00001', 0, [testCaptions()]))
    project = accept(project, changeSetOf('changeset_split001', project.revision, [
      testSplit({ atClipTime: ms(2_000), newClipId: 'clip_bbbbbbbb' }),
    ]))
    project = accept(project, changeSetOf('changeset_remove01', project.revision, [
      testRemove({ clipId: TEST_CLIP_ID, ripple: true }),
    ]))

    expect(blockedChangeSets(project)).toHaveLength(0)
    expect(activeCaptionSets(project)[0].cues).toHaveLength(3)
    expect(screenTimes(project).map((entry) => entry.cueId)).toEqual(['cue_0002', 'cue_0003'])
  })

  it('shows a caption on both sides when a cut passes through the middle of it', () => {
    // One cue covering source 1-2s, cut at source 1.5s. It must stay unbroken.
    let project = accept(testProject(), changeSetOf('changeset_cap00001', 0, [
      testCaptions({
        cues: [{ cueId: 'cue_0001', sourceInterval: { start: ms(1_000), duration: ms(1_000) }, lines: ['spanning'] }],
      }),
    ]))
    project = accept(project, changeSetOf('changeset_split001', project.revision, [
      testSplit({ atClipTime: ms(1_500), newClipId: 'clip_bbbbbbbb' }),
    ]))

    const placed = screenTimes(project)
    expect(placed).toHaveLength(2)
    expect(placed[0]).toEqual({ cueId: 'cue_0001', start: 1, duration: 0.5 })
    expect(placed[1]).toEqual({ cueId: 'cue_0001', start: 1.5, duration: 0.5 })
    // They touch exactly, so on screen it looks like one unbroken caption.
    expect(placed[0].start + placed[0].duration).toBe(placed[1].start)
  })

  it('blocks the set, and says so, only when nothing at all survives', () => {
    // Every cue lives in source 1-6s. Remove source 0-10s and there is nothing
    // left to show, which is the one case where a warning is actionable.
    let project = accept(testProject(), changeSetOf('changeset_cap00001', 0, [testCaptions()]))
    project = accept(project, changeSetOf('changeset_split001', project.revision, [
      testSplit({ atClipTime: ms(10_000), newClipId: 'clip_bbbbbbbb' }),
    ]))
    project = accept(project, changeSetOf('changeset_remove01', project.revision, [
      testRemove({ clipId: TEST_CLIP_ID, ripple: true }),
    ]))

    const blocked = blockedChangeSets(project)
    expect(blocked).toHaveLength(1)
    expect(blocked[0].blockedReason).toBe('ALL_CUES_REMOVED')
    expect(activeCaptionSets(project)).toEqual([])
    expect(screenTimes(project)).toEqual([])
  })

  it('never invents a new home for a caption whose footage was deleted', () => {
    let project = accept(testProject(), changeSetOf('changeset_cap00001', 0, [testCaptions()]))
    const before = activeCaptionSets(project)[0].cues.map((cue) => cue.sourceInterval.start.ticks)
    project = accept(project, changeSetOf('changeset_split001', project.revision, [
      testSplit({ atClipTime: ms(2_000), newClipId: 'clip_bbbbbbbb' }),
    ]))
    project = accept(project, changeSetOf('changeset_remove01', project.revision, [
      testRemove({ clipId: TEST_CLIP_ID, ripple: true }),
    ]))

    // The stored timings are identical. Nothing was relocated; the footage moved.
    const after = activeCaptionSets(project)[0].cues.map((cue) => cue.sourceInterval.start.ticks)
    expect(after).toEqual(before)
  })

  it('brings every caption back when the cut is undone', () => {
    let project = accept(testProject(), changeSetOf('changeset_cap00001', 0, [testCaptions()]))
    const original = screenTimes(project)
    project = accept(project, changeSetOf('changeset_split001', project.revision, [
      testSplit({ atClipTime: ms(2_000), newClipId: 'clip_bbbbbbbb' }),
    ]))
    project = accept(project, changeSetOf('changeset_remove01', project.revision, [
      testRemove({ clipId: TEST_CLIP_ID, ripple: true }),
    ]))
    expect(screenTimes(project)).toHaveLength(2)

    const undone = { ...project, changeSets: project.changeSets.slice(0, 1) }
    expect(screenTimes(undone as EditProject)).toEqual(original)
  })
})
