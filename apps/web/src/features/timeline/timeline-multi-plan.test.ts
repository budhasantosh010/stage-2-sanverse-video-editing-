import { describe, expect, it } from 'vitest'

import { acceptChangeSet, createIdFactory, type EditProject } from '@sanverse/edit-domain'

import { laneSpans } from './timeline-item-operations'
import { planMultiItemGesture, previewMultiItemGesture, type MultiItemGesture } from './timeline-multi-plan'
import { buildTimelineViewModel } from './timeline-view-model'
import { allTimelineItems } from './timeline-selection-v2'
import { projectWithAllTimelineFamilies, ticks } from './timeline-test-fixtures'

const CHANGE_SET_ID = 'changeset_multi0001'

/*
 * The two pieces of B-roll, and nothing else.
 *
 * The music in this fixture runs to the very end of the video, so moving it
 * even slightly later genuinely pushes it past the end — a correct refusal, and
 * not what these tests are about. It gets its own case at the bottom.
 */
const overlayItemIds = (project: EditProject): readonly string[] => {
  const model = buildTimelineViewModel({ project, selectedItemIds: [], pending: null })
  return allTimelineItems(model)
    .filter((item) => item.kind === 'media-overlay')
    .map((item) => item.id)
}

const musicItemIds = (project: EditProject): readonly string[] => {
  const model = buildTimelineViewModel({ project, selectedItemIds: [], pending: null })
  return allTimelineItems(model).filter((item) => item.kind === 'music').map((item) => item.id)
}

const plan = (
  project: EditProject,
  itemIds: readonly string[],
  gesture: MultiItemGesture,
  overrides: Partial<Parameters<typeof planMultiItemGesture>[0]> = {},
) => planMultiItemGesture({
  project,
  itemIds,
  gesture,
  lockedTrackIds: [],
  pendingProposalExists: false,
  exportInProgress: false,
  expectedRevision: project.revision,
  ids: createIdFactory(CHANGE_SET_ID),
  ...overrides,
})

describe('T1.4 moving several things at once', () => {
  it('produces ONE set of operations for the whole gesture', () => {
    /*
     * The rule this whole file exists to keep. Four clips dragged and then one
     * Undo must put all four back — not the fourth back and three still moved.
     */
    const project = projectWithAllTimelineFamilies()
    const ids = overlayItemIds(project)
    const result = plan(project, ids, { type: 'move', deltaTicks: ticks(0.5) })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.operations.length).toBeGreaterThan(0)
    // One change set carries all of them; nothing here can produce two.
    const accepted = acceptChangeSet(project, {
      schemaVersion: 'sanverse.change-set/v1',
      changeSetId: CHANGE_SET_ID,
      baseRevision: project.revision,
      operations: result.operations,
      provenance: { source: 'direct', requestId: null },
      extensions: {},
    } as never)
    expect(accepted.ok).toBe(true)
    if (!accepted.ok) return
    expect(accepted.value.revision).toBe(project.revision + 1)
  })

  it('keeps the spacing between the things that moved', () => {
    const project = projectWithAllTimelineFamilies()
    const ids = overlayItemIds(project)
    const before = plan(project, ids, { type: 'move', deltaTicks: 0 })
    const after = plan(project, ids, { type: 'move', deltaTicks: ticks(0.5) })
    expect(before.ok && after.ok).toBe(true)
    if (!before.ok || !after.ok) return
    const gap = (feedback: typeof before.feedback) =>
      feedback.placements.map((placement) => placement.startTicks).sort((a, b) => a - b)
    const beforeGaps = gap(before.feedback)
    const afterGaps = gap(after.feedback)
    for (let index = 0; index < beforeGaps.length; index += 1) {
      expect(afterGaps[index] - beforeGaps[index]).toBe(ticks(0.5))
    }
  })

  it('refuses the whole gesture when ONE of them cannot make the move', () => {
    // All-or-nothing. Moving the ones that fit would change the very spacing the
    // user picked several of them to preserve.
    const project = projectWithAllTimelineFamilies()
    const ids = overlayItemIds(project)
    const result = plan(project, ids, { type: 'move', deltaTicks: -ticks(9_999) })
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.refusal.code).toBe('OUT_OF_RANGE')
    expect(result.refusal.message).toMatch(/outside the video/i)
  })

  it('judges collisions against what is NOT moving', () => {
    /*
     * Without this, two clips swapping places would each be told the other is
     * in the way, and a whole row shuffled along by one second would refuse on
     * its own tail.
     */
    const project = projectWithAllTimelineFamilies()
    const ids = overlayItemIds(project)
    const nudged = plan(project, ids, { type: 'move', deltaTicks: ticks(0.25) })
    expect(nudged.ok).toBe(true)
  })

  it('counts one underlying clip once, however many rectangles it shows as', () => {
    // A B-roll clip cut in half shows as two. Planning it twice would move it
    // by double the distance.
    const project = projectWithAllTimelineFamilies()
    const ids = overlayItemIds(project)
    const result = plan(project, [...ids, ...ids], { type: 'move', deltaTicks: ticks(0.25) })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.feedback.itemCount).toBe(new Set(ids).size)
  })
})

describe('T1.5 trimming several things at once', () => {
  it('moves every right edge by the same amount', () => {
    const project = projectWithAllTimelineFamilies()
    const ids = overlayItemIds(project)
    const result = plan(project, ids, { type: 'trim-end', deltaTicks: -ticks(0.5) })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    const spans = laneSpans(project, 'V2')
    for (const placement of result.feedback.placements) {
      const original = spans.find((span) =>
        span.startTicks === placement.startTicks)
      if (!original) continue
      expect(original.durationTicks - placement.durationTicks).toBe(ticks(0.5))
    }
  })

  it('refuses when the SHORTEST of them would become too short', () => {
    // The shortest decides. Trimming the others and leaving that one would
    // change the spacing the user picked them to keep.
    const project = projectWithAllTimelineFamilies()
    const ids = overlayItemIds(project)
    const result = plan(project, ids, { type: 'trim-end', deltaTicks: -ticks(500) })
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(['TOO_SHORT', 'OUT_OF_RANGE']).toContain(result.refusal.code)
    expect(result.refusal.message).toMatch(/nothing was changed|outside the video/i)
  })
})

describe('T1.4 music that already fills the video', () => {
  it('refuses to push music past the end, and says so plainly', () => {
    /*
     * This fixture's music runs to the very end. Nudging it later would run it
     * off the end of the video, so it is refused — for the whole gesture, not
     * just for the music. That is the all-or-nothing rule doing its job.
     */
    const project = projectWithAllTimelineFamilies()
    const result = plan(project, musicItemIds(project), { type: 'move', deltaTicks: ticks(0.5) })
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.refusal.message).toMatch(/outside the video/i)
  })

  it('lets the same music be trimmed shorter, because that fits', () => {
    const project = projectWithAllTimelineFamilies()
    const result = plan(project, musicItemIds(project), { type: 'trim-end', deltaTicks: -ticks(1) })
    expect(result.ok).toBe(true)
  })
})

describe('T1.4 what it refuses to touch, and why it says so', () => {
  it('refuses pieces of the main video, and names the alternative', () => {
    /*
     * V1 footage is not laid on top of anything — it IS the video, and moving a
     * piece of it changes what every later clip sits on. That belongs to the
     * precision-trim work, where ripple and roll are designed properly.
     */
    const project = projectWithAllTimelineFamilies()
    const model = buildTimelineViewModel({ project, selectedItemIds: [], pending: null })
    const clip = allTimelineItems(model).find((item) => item.kind === 'clip')
    if (!clip) throw new Error('fixture has no clip')
    const result = plan(project, [clip.id], { type: 'move', deltaTicks: ticks(1) })
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.refusal.message).toMatch(/split, trim|one at a time/i)
  })

  it('refuses a locked track and names which padlock to open', () => {
    const project = projectWithAllTimelineFamilies()
    const ids = overlayItemIds(project)
    const result = plan(project, ids, { type: 'move', deltaTicks: ticks(0.25) }, {
      lockedTrackIds: ['V2'],
    })
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.refusal.code).toBe('TRACK_LOCKED')
    expect(result.refusal.message).toContain('V2')
  })

  it('refuses while a suggestion is on screen, and while an export is running', () => {
    const project = projectWithAllTimelineFamilies()
    const ids = overlayItemIds(project)
    expect(plan(project, ids, { type: 'move', deltaTicks: 0 }, { pendingProposalExists: true }).ok).toBe(false)
    expect(plan(project, ids, { type: 'move', deltaTicks: 0 }, { exportInProgress: true }).ok).toBe(false)
  })

  it('refuses when the project moved underneath the drag', () => {
    const project = projectWithAllTimelineFamilies()
    const ids = overlayItemIds(project)
    const result = plan(project, ids, { type: 'move', deltaTicks: 0 }, {
      expectedRevision: project.revision - 1,
    })
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.refusal.code).toBe('PROJECT_STALE')
  })

  it('refuses an empty selection rather than doing nothing quietly', () => {
    const project = projectWithAllTimelineFamilies()
    expect(plan(project, [], { type: 'move', deltaTicks: 0 }).ok).toBe(false)
  })

  it('never says a reason code out loud', () => {
    const project = projectWithAllTimelineFamilies()
    const ids = overlayItemIds(project)
    const result = plan(project, ids, { type: 'move', deltaTicks: -ticks(9_999) })
    if (result.ok) return
    expect(result.refusal.message).not.toMatch(/[A-Z]{2,}_[A-Z]/)
  })
})

describe('T1.12 the ghost and the edit are the same answer', () => {
  it('previews exactly what it will do, from the same planner', () => {
    /*
     * Gate T0 was caused by two pieces of code answering the same question
     * separately. This is that lesson applied before the bug: the ghost the
     * user watches IS the plan, not a second guess at it.
     */
    const project = projectWithAllTimelineFamilies()
    const ids = overlayItemIds(project)
    const gesture: MultiItemGesture = { type: 'move', deltaTicks: ticks(0.25) }
    const preview = previewMultiItemGesture({
      project,
      itemIds: ids,
      gesture,
      lockedTrackIds: [],
      pendingProposalExists: false,
      exportInProgress: false,
      expectedRevision: project.revision,
      ids: createIdFactory(CHANGE_SET_ID),
    })
    const committed = plan(project, ids, gesture)
    expect(preview.ok).toBe(committed.ok)
    if (!preview.ok || !committed.ok) return
    expect(preview.feedback).toEqual(committed.feedback)
  })

  it('shows a refusal BEFORE the user lets go, in the same words', () => {
    const project = projectWithAllTimelineFamilies()
    const ids = overlayItemIds(project)
    const gesture: MultiItemGesture = { type: 'move', deltaTicks: -ticks(9_999) }
    const preview = previewMultiItemGesture({
      project,
      itemIds: ids,
      gesture,
      lockedTrackIds: [],
      pendingProposalExists: false,
      exportInProgress: false,
      expectedRevision: project.revision,
      ids: createIdFactory(CHANGE_SET_ID),
    })
    const committed = plan(project, ids, gesture)
    expect(preview.ok).toBe(false)
    expect(committed.ok).toBe(false)
    if (preview.ok || committed.ok) return
    expect(preview.refusal).toEqual(committed.refusal)
  })
})
