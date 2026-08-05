import { describe, expect, it } from 'vitest'

import {
  acceptChangeSet,
  activeTimelineGroups,
  activeTimelineMarkers,
  createIdFactory,
  undoChangeSet,
  type EditOperation,
  type EditProject,
} from '@sanverse/edit-domain'

import {
  planAddMarker,
  planDeleteMarker,
  planGroupItems,
  planRemoveGroupRecord,
  planUngroupItem,
  planUpdateMarker,
  type AnnotationPlan,
} from './timeline-annotation-edits'
import { projectWithAllTimelineFamilies, ticks } from './timeline-test-fixtures'

let changeSetCounter = 0
const nextChangeSetId = () => `changeset_note${String(++changeSetCounter).padStart(5, '0')}`

const common = (project: EditProject, changeSetId: string) => ({
  project,
  pendingProposalExists: false,
  exportInProgress: false,
  expectedRevision: project.revision,
  ids: createIdFactory(changeSetId),
})

const apply = (project: EditProject, plan: AnnotationPlan, changeSetId: string): EditProject => {
  if (!plan.ok) throw new Error(`refused: ${plan.refusal.message}`)
  const accepted = acceptChangeSet(project, {
    schemaVersion: 'sanverse.change-set/v1',
    changeSetId,
    baseRevision: project.revision,
    operations: plan.operations as readonly EditOperation[],
    provenance: { source: 'direct', requestId: null },
    extensions: {},
  } as never)
  if (!accepted.ok) throw new Error(`accept failed: ${JSON.stringify(accepted.error)}`)
  return accepted.value
}

const withOneMarker = (): { project: EditProject; markerId: string } => {
  const base = projectWithAllTimelineFamilies()
  const id = nextChangeSetId()
  const project = apply(base, planAddMarker({
    ...common(base, id),
    startTicks: ticks(2),
    label: 'Fix the audio here',
    note: 'the hum starts around now',
    color: 'amber',
  }), id)
  return { project, markerId: activeTimelineMarkers(project)[0].markerId }
}

describe('T1.9 leaving a note', () => {
  it('adds one note, as ONE change set and ONE Undo', () => {
    const { project } = withOneMarker()
    expect(activeTimelineMarkers(project)).toHaveLength(1)
    const undone = undoChangeSet(project)
    expect(undone.ok).toBe(true)
    if (!undone.ok) return
    expect(activeTimelineMarkers(undone.value)).toHaveLength(0)
  })

  it('keeps every earlier note when a new one is added', () => {
    // The whole list is sent each time, so the last one wins outright and there
    // is no way to end up in a state nobody chose.
    const { project } = withOneMarker()
    const id = nextChangeSetId()
    const twoNotes = apply(project, planAddMarker({
      ...common(project, id),
      startTicks: ticks(5),
      label: 'Second',
    }), id)
    expect(activeTimelineMarkers(twoNotes)).toHaveLength(2)
  })

  it('tidies text the user typed rather than refusing it', () => {
    /*
     * The domain REFUSES control characters, which is right — it must not
     * quietly store something different from what it was given. But a user
     * typing into a box is not sending an operation. Tidying here, once, at the
     * point where typing becomes an edit, is what stops a pasted line break
     * turning into a refusal nobody can explain.
     */
    const base = projectWithAllTimelineFamilies()
    const id = nextChangeSetId()
    const hidden = String.fromCharCode(0)
    const project = apply(base, planAddMarker({
      ...common(base, id),
      startTicks: 0,
      label: `take${hidden} one\nsecond line`,
      note: `line one\nline two${hidden}`,
    }), id)
    const marker = activeTimelineMarkers(project)[0]
    // A label is one line on a timeline, so its newline becomes a space.
    expect(marker.label).toBe('take one second line')
    // A note is where a paragraph goes, so its newline is kept.
    expect(marker.note).toBe('line one\nline two')
  })

  it('starts a note plain when no colour was asked for', () => {
    const base = projectWithAllTimelineFamilies()
    const id = nextChangeSetId()
    const project = apply(base, planAddMarker({ ...common(base, id), startTicks: 0, label: 'x' }), id)
    expect(activeTimelineMarkers(project)[0].color).toBe('neutral')
    expect(activeTimelineMarkers(project)[0].durationTicks).toBe(0)
  })
})

describe('T1.9 changing and deleting a note', () => {
  it('moves a note without changing what it says', () => {
    const { project, markerId } = withOneMarker()
    const id = nextChangeSetId()
    const moved = apply(project, planUpdateMarker({
      ...common(project, id),
      markerId,
      changes: { startTicks: ticks(7) },
    }), id)
    const marker = activeTimelineMarkers(moved)[0]
    expect(marker.startTicks).toBe(ticks(7))
    expect(marker.label).toBe('Fix the audio here')
    expect(marker.note).toBe('the hum starts around now')
  })

  it('changes what a note says without moving it', () => {
    const { project, markerId } = withOneMarker()
    const id = nextChangeSetId()
    const edited = apply(project, planUpdateMarker({
      ...common(project, id),
      markerId,
      changes: { label: 'Renamed', color: 'green' },
    }), id)
    const marker = activeTimelineMarkers(edited)[0]
    expect(marker.label).toBe('Renamed')
    expect(marker.color).toBe('green')
    expect(marker.startTicks).toBe(ticks(2))
  })

  it('deletes one note and leaves the others alone', () => {
    const { project, markerId } = withOneMarker()
    const addId = nextChangeSetId()
    const two = apply(project, planAddMarker({
      ...common(project, addId), startTicks: ticks(9), label: 'Keep me',
    }), addId)
    const deleteId = nextChangeSetId()
    const one = apply(two, planDeleteMarker({ ...common(two, deleteId), markerId }), deleteId)
    expect(activeTimelineMarkers(one).map((marker) => marker.label)).toEqual(['Keep me'])
  })

  it('says so plainly when the note is already gone', () => {
    const { project } = withOneMarker()
    const id = nextChangeSetId()
    const result = planDeleteMarker({ ...common(project, id), markerId: 'marker_notthere1' })
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.refusal.message).toMatch(/no longer on the timeline/i)
    expect(result.refusal.message).not.toMatch(/[A-Z]{2,}_[A-Z]/)
  })

  it('refuses while a suggestion is on screen, or an export is running', () => {
    const { project, markerId } = withOneMarker()
    const id = nextChangeSetId()
    expect(planDeleteMarker({
      ...common(project, id), markerId, pendingProposalExists: true,
    }).ok).toBe(false)
    expect(planDeleteMarker({
      ...common(project, id), markerId, exportInProgress: true,
    }).ok).toBe(false)
  })
})

describe('T1.6 making things move together', () => {
  const members = ['overlay:broll_00000005:0', 'music:music_00000007:0']

  it('groups two things as ONE change set, and Undo takes it back', () => {
    const base = projectWithAllTimelineFamilies()
    const id = nextChangeSetId()
    const project = apply(base, planGroupItems({ ...common(base, id), itemIds: members }), id)
    expect(activeTimelineGroups(project)).toHaveLength(1)
    const undone = undoChangeSet(project)
    if (!undone.ok) throw new Error('undo failed')
    expect(activeTimelineGroups(undone.value)).toHaveLength(0)
  })

  it('refuses a group of one, and says what to do', () => {
    const base = projectWithAllTimelineFamilies()
    const id = nextChangeSetId()
    const result = planGroupItems({ ...common(base, id), itemIds: [members[0]] })
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.refusal.message).toMatch(/at least two/i)
  })

  it('takes a thing out of its old group rather than refusing', () => {
    /*
     * A thing cannot be in two groups. Refusing here would mean the user has to
     * remember which of forty clips is already grouped before grouping anything.
     */
    const base = projectWithAllTimelineFamilies()
    const firstId = nextChangeSetId()
    const first = apply(base, planGroupItems({ ...common(base, firstId), itemIds: members }), firstId)
    const secondId = nextChangeSetId()
    const second = apply(first, planGroupItems({
      ...common(first, secondId),
      itemIds: [members[0], 'overlay:broll_00000006:0'],
    }), secondId)
    const groups = activeTimelineGroups(second)
    // The old group had two members and lost one, so it is not a group any more.
    expect(groups).toHaveLength(1)
    expect(groups[0].memberItemIds).toContain(members[0])
  })

  it('ungroups everything the picked item belonged to', () => {
    const base = projectWithAllTimelineFamilies()
    const groupId = nextChangeSetId()
    const grouped = apply(base, planGroupItems({ ...common(base, groupId), itemIds: members }), groupId)
    const ungroupId = nextChangeSetId()
    const ungrouped = apply(grouped, planUngroupItem({
      ...common(grouped, ungroupId), itemId: members[0],
    }), ungroupId)
    expect(activeTimelineGroups(ungrouped)).toHaveLength(0)
  })

  it('says so plainly when the thing is not in a group', () => {
    const base = projectWithAllTimelineFamilies()
    const id = nextChangeSetId()
    const result = planUngroupItem({ ...common(base, id), itemId: members[0] })
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.refusal.message).toMatch(/not part of a group/i)
  })

  it('does nothing at all when a deletion leaves the groups unchanged', () => {
    // Returning null rather than an empty change set is what stops a delete
    // producing a pointless second revision.
    const base = projectWithAllTimelineFamilies()
    expect(planRemoveGroupRecord({
      ...common(base, nextChangeSetId()),
      removedItemIds: ['overlay:broll_nothere:0'],
    })).toBeNull()
  })

  it('tidies away a group that a deletion left with fewer than two members', () => {
    const base = projectWithAllTimelineFamilies()
    const groupId = nextChangeSetId()
    const grouped = apply(base, planGroupItems({ ...common(base, groupId), itemIds: members }), groupId)
    const tidyId = nextChangeSetId()
    const plan = planRemoveGroupRecord({
      ...common(grouped, tidyId),
      removedItemIds: [members[0]],
    })
    expect(plan).not.toBeNull()
    if (!plan) return
    const tidied = apply(grouped, plan, tidyId)
    expect(activeTimelineGroups(tidied)).toHaveLength(0)
  })
})

describe('T1.6 / T1.9 neither of these can change the video', () => {
  it('never produces an operation that touches the composition', () => {
    /*
     * The structural guarantee. Markers and groups produce exactly one kind of
     * operation each, and neither appears in the render plan — which is what
     * makes writing a note leave a finished export alone.
     */
    const base = projectWithAllTimelineFamilies()
    const markerId = nextChangeSetId()
    const markerPlan = planAddMarker({ ...common(base, markerId), startTicks: 0, label: 'x' })
    const groupId = nextChangeSetId()
    const groupPlan = planGroupItems({
      ...common(base, groupId),
      itemIds: ['overlay:broll_00000005:0', 'music:music_00000007:0'],
    })
    expect(markerPlan.ok && groupPlan.ok).toBe(true)
    if (!markerPlan.ok || !groupPlan.ok) return
    expect(markerPlan.operations.map((operation) => operation.kind)).toEqual(['set-timeline-markers'])
    expect(groupPlan.operations.map((operation) => operation.kind)).toEqual(['set-timeline-groups'])
  })
})
