import { describe, expect, it } from 'vitest'
import { acceptChangeSet, createIdFactory, effectiveComposition } from '@sanverse/edit-domain'
import { changeSetOf } from '@sanverse/edit-domain/test-fixtures'
import { testProject } from '../../test-fixtures'
import { buildTimelineViewModel } from './timeline-view-model'
import { createIds, splitProject, ticks, projectWithAllTimelineFamilies } from './timeline-test-fixtures'
import { planAddTimelineTrack } from './timeline-track-controls'
import { planTimelineBodyDrag } from './timeline-body-drag-plan'

const plan = (project: ReturnType<typeof testProject>, kind: 'video' | 'dialogue', start: number, destination?: string, lockedTrackIds: string[] = []) => {
  const model = buildTimelineViewModel({ project, selectedItemIds: [], pending: null })
  const lane = model.lanes.find((entry) => entry.kind === kind)!
  const item = lane.items.find((entry) => entry.kind !== 'gap')!
  return planTimelineBodyDrag({ project, model, request: { itemId: item.id, destinationTrackId: destination ?? lane.trackId, toStartTicks: ticks(start) }, lockedTrackIds, pendingProposalExists: false, exportInProgress: false, expectedRevision: project.revision, ids: createIdFactory('changeset_dragtest01') })
}

describe('timeline body drag authority', () => {
  it('accepts vertical transfer over source-track footage but still refuses occupied destination intervals', () => {
    const project = splitProject(testProject(), 10, createIds())
    const model = buildTimelineViewModel({ project, selectedItemIds: [], pending: null })
    const upper = model.lanes.find(lane => lane.kind === 'overlay')!.trackId
    const result = plan(project, 'video', 12, upper)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    const accepted = acceptChangeSet(project, changeSetOf('changeset_dragtest01', project.revision, result.operations))
    if (!accepted.ok) throw new Error(JSON.stringify(accepted.error))
    const after = buildTimelineViewModel({ project: accepted.value, selectedItemIds: [], pending: null })
    const remaining = after.lanes.filter(lane => lane.trackId !== upper).flatMap(lane => lane.items).find(item => item.kind === 'clip')!
    expect(planTimelineBodyDrag({ project: accepted.value, model: after,
      request: { itemId: remaining.id, destinationTrackId: upper, toStartTicks: ticks(12) },
      lockedTrackIds: [], pendingProposalExists: false, exportInProgress: false,
      expectedRevision: accepted.value.revision, ids: createIdFactory('changeset_collide01'),
    })).toMatchObject({ ok: false })
  })
  it('refuses music over a video track instead of accepting a truthy refusal object', () => {
    const project = projectWithAllTimelineFamilies()
    const model = buildTimelineViewModel({ project, selectedItemIds: [], pending: null })
    const item = model.lanes.flatMap((lane) => lane.items).find((entry) => entry.kind === 'music')!
    const destination = model.lanes.find((lane) => lane.kind === 'overlay')!
    const result = planTimelineBodyDrag({ project, model, request: { itemId: item.id, destinationTrackId: destination.trackId, toStartTicks: item.startTicks }, lockedTrackIds: [], pendingProposalExists: false, exportInProgress: false, expectedRevision: project.revision, ids: createIdFactory('changeset_dragtest02') })
    expect(result).toMatchObject({ ok: false, refusal: { code: 'TRACK_INCOMPATIBLE' } })
  })
  it('moves music in both axes as one accepted change set and keeps its stable identity', () => {
    let project = projectWithAllTimelineFamilies()
    const added = planAddTimelineTrack({ project, kind: 'audio', ids: createIdFactory('changeset_dragtrack01') })
    if (!added.ok) throw new Error(added.refusal.message)
    const accepted = acceptChangeSet(project, changeSetOf('changeset_dragtrack01', project.revision, added.operations))
    if (!accepted.ok) throw new Error(JSON.stringify(accepted.error))
    project = accepted.value
    const model = buildTimelineViewModel({ project, selectedItemIds: [], pending: null })
    const item = model.lanes.flatMap((lane) => lane.items).find((entry) => entry.kind === 'music')!
    const destination = model.lanes.filter((lane) => lane.trackKind === 'audio' && lane.trackRole !== 'dialogue').at(-1)!
    const result = planTimelineBodyDrag({ project, model, request: { itemId: item.id, destinationTrackId: destination.trackId, toStartTicks: item.startTicks + ticks(1) }, lockedTrackIds: [], pendingProposalExists: false, exportInProgress: false, expectedRevision: project.revision, ids: createIdFactory('changeset_dragmove01') })
    if (!result.ok) throw new Error(result.refusal.message)
    expect(result.operations).toHaveLength(2)
    const moved = acceptChangeSet(project, changeSetOf('changeset_dragmove01', project.revision, result.operations))
    if (!moved.ok) throw new Error(JSON.stringify(moved.error))
    const after = buildTimelineViewModel({ project: moved.value, selectedItemIds: [], pending: null }).lanes.flatMap((lane) => lane.items).find((entry) => entry.id === item.id)
    expect(after).toMatchObject({ startTicks: item.startTicks + ticks(1), trackId: destination.trackId })
    expect(moved.value.revision).toBe(project.revision + 1)
  })
  it('moves a lone primary clip into empty space with the existing move operation', () => {
    expect(plan(testProject(), 'video', 2)).toMatchObject({ ok: true, operations: [{ kind: 'move-primary-clip', compositionStart: { ticks: ticks(2) } }] })
  })
  it('dragging dialogue moves its linked footage once, not through multi-selection', () => {
    const project = testProject()
    expect(plan(project, 'dialogue', 2)).toEqual(plan(project, 'video', 2))
  })
  it('uses the established reorder operation over another gapless section', () => {
    const project = splitProject(testProject(), 10, createIds())
    expect(plan(project, 'video', 18)).toMatchObject({ ok: true, operations: [{ kind: 'reorder-clip', toIndex: 1 }] })
  })
  it('checks a reorder at its actual landing rather than its raw pointer interval', () => {
    const ids = createIds()
    let project = splitProject(splitProject(testProject(), 10, ids), 20, ids)
    const before = buildTimelineViewModel({ project, selectedItemIds: [], pending: null })
    const top = before.lanes.find(lane => lane.kind === 'overlay')!.trackId
    const last = before.lanes.find(lane => lane.kind === 'video')!.items.find(item => item.startTicks === ticks(20))!
    const transfer = planTimelineBodyDrag({ project, model: before,
      request: { itemId: last.id, destinationTrackId: top, toStartTicks: ticks(20) },
      lockedTrackIds: [], pendingProposalExists: false, exportInProgress: false,
      expectedRevision: project.revision, ids: createIdFactory('changeset_reorderlayer01') })
    if (!transfer.ok) throw new Error(transfer.refusal.message)
    const transferred = acceptChangeSet(project, changeSetOf('changeset_reorderlayer01', project.revision, transfer.operations))
    if (!transferred.ok) throw new Error(JSON.stringify(transferred.error))
    project = transferred.value
    // Pointer suggests [18,28), touching V2 [20,30). Actual reorder lands
    // in [10,20), so V2 must not prevent this ordinary sequence reorder.
    const model = buildTimelineViewModel({ project, selectedItemIds: [], pending: null })
    const lane = model.lanes.find(entry => entry.trackId === before.lanes.find(entry => entry.kind === 'video')!.trackId)!
    const first = lane.items.find(item => item.kind === 'clip')!
    const result = planTimelineBodyDrag({ project, model,
      request: { itemId: first.id, destinationTrackId: lane.trackId, toStartTicks: ticks(18) },
      lockedTrackIds: [], pendingProposalExists: false, exportInProgress: false,
      expectedRevision: project.revision, ids: createIdFactory('changeset_reorderlayer02') })
    expect(result).toMatchObject({ ok: true, landingStartTicks: ticks(10), operations: [{ kind: 'reorder-clip', toIndex: 1 }] })
    if (!result.ok) return
    const accepted = acceptChangeSet(project, changeSetOf('changeset_reorderlayer02', project.revision, result.operations))
    expect(accepted.ok).toBe(true)
    if (!accepted.ok) return
    const moved = effectiveComposition(accepted.value)
    expect(moved.tracks.find(track => track.trackId === top)!.clips[0].compositionStart.ticks).toBe(ticks(20))
  })
  it('transfers primary footage to an empty video track without changing clip identity', () => {
    const project = testProject()
    const model = buildTimelineViewModel({ project, selectedItemIds: [], pending: null })
    const track = model.lanes.find((lane) => lane.kind === 'overlay')!.trackId
    const result = plan(project, 'video', 2, track)
    expect(result).toMatchObject({ ok: true, operations: [{ kind: 'move-primary-clip', destinationTrackId: track }] })
    if (!result.ok) return
    const accepted = acceptChangeSet(project, changeSetOf('changeset_dragtest01', project.revision, result.operations))
    if (!accepted.ok) throw new Error(JSON.stringify(accepted.error))
    const original = effectiveComposition(project).tracks[0].clips[0]
    const moved = effectiveComposition(accepted.value).tracks.find(entry => entry.trackId === track)!.clips[0]
    expect(moved).toEqual({ ...original, compositionStart: { ...original.compositionStart, ticks: ticks(2) } })
    expect(effectiveComposition(project).tracks[0].clips[0].compositionStart.ticks).toBe(0)
  })
  it('locking dialogue prevents moving its linked video', () => {
    const project = testProject()
    const model = buildTimelineViewModel({ project, selectedItemIds: [], pending: null })
    const track = model.lanes.find((lane) => lane.kind === 'dialogue')!.trackId
    expect(plan(project, 'video', 2, undefined, [track])).toMatchObject({ ok: false, refusal: { code: 'TRACK_LOCKED' } })
  })
  it('does not interpret a dialogue-to-video drag as a picture track transfer', () => {
    const project = testProject()
    const model = buildTimelineViewModel({ project, selectedItemIds: [], pending: null })
    const destination = model.lanes.find(lane => lane.kind === 'overlay')!.trackId
    expect(plan(project, 'dialogue', 0, destination)).toMatchObject({ ok: false, refusal: { code: 'TRACK_INCOMPATIBLE' } })
  })
  it('does not blanket-refuse a video transfer beneath same-track authored visuals', () => {
    const project = projectWithAllTimelineFamilies()
    const model = buildTimelineViewModel({ project, selectedItemIds: [], pending: null })
    const destination = model.lanes.find(lane => lane.kind === 'overlay')!.trackId
    expect(plan(project, 'video', 0, destination)).toMatchObject({ ok: true })
  })
})
