// Standalone equivalent of the Vitest regression, for worker-loader failures.
import assert from 'node:assert/strict'
import { acceptChangeSet, createIdFactory, effectiveComposition, undoChangeSet, redoChangeSet } from '@sanverse/edit-domain'
import { changeSetOf } from '@sanverse/edit-domain/test-fixtures'
import { testProject } from '../../../apps/web/src/test-fixtures'
import { createIds, splitProject, ticks } from '../../../apps/web/src/features/timeline/timeline-test-fixtures'
import { buildTimelineViewModel } from '../../../apps/web/src/features/timeline/timeline-view-model'
import { planTimelineBodyDrag } from '../../../apps/web/src/features/timeline/timeline-body-drag-plan'

const ids = createIds()
let project = splitProject(splitProject(testProject(), 10, ids), 20, ids)
let model = buildTimelineViewModel({ project, selectedItemIds: [], pending: null })
const source = model.lanes.find(lane => lane.kind === 'video')!
const destination = model.lanes.find(lane => lane.kind === 'overlay')!
const last = source.items.find(item => item.startTicks === ticks(20))!
const drag = (itemId: string, destinationTrackId: string, seconds: number, id: string) => planTimelineBodyDrag({
  project, model, request: { itemId, destinationTrackId, toStartTicks: ticks(seconds) },
  lockedTrackIds: [], pendingProposalExists: false, exportInProgress: false,
  expectedRevision: project.revision, ids: createIdFactory(id),
})
const transfer = drag(last.id, destination.trackId, 20, 'changeset_smoketransfer')
assert.equal(transfer.ok, true)
if (!transfer.ok) throw new Error(transfer.refusal.message)
const moved = acceptChangeSet(project, changeSetOf('changeset_smoketransfer', project.revision, transfer.operations))
assert.equal(moved.ok, true)
if (!moved.ok) throw new Error(JSON.stringify(moved.error))
project = moved.value
model = buildTimelineViewModel({ project, selectedItemIds: [], pending: null })
const result = drag(source.items.find(item => item.kind === 'clip')!.id, source.trackId, 18, 'changeset_smokereorder')
const collision = drag(source.items.find(item => item.kind === 'clip')!.id, source.trackId, 21, 'changeset_smokecollision')
assert.equal(collision.ok, false, 'A literal move into V2 must still be refused')
assert.equal(result.ok, true, JSON.stringify(result))
if (!result.ok) throw new Error(result.refusal.message)
assert.equal(result.landingStartTicks, ticks(10))
assert.equal(result.operations[0].kind, 'reorder-clip')
const accepted = acceptChangeSet(project, changeSetOf('changeset_smokereorder', project.revision, result.operations))
assert.equal(accepted.ok, true)
if (!accepted.ok) throw new Error(JSON.stringify(accepted.error))
assert.equal(effectiveComposition(accepted.value).tracks.find(track => track.trackId === destination.trackId)!.clips[0].compositionStart.ticks, ticks(20))
assert.equal(accepted.value.revision, project.revision + 1)
const undone = undoChangeSet(accepted.value)
assert.equal(undone.ok, true)
if (!undone.ok) throw new Error(JSON.stringify(undone.error))
assert.deepEqual(effectiveComposition(undone.value), effectiveComposition(project))
const redone = redoChangeSet(undone.value)
assert.equal(redone.ok, true)
if (!redone.ok) throw new Error(JSON.stringify(redone.error))
assert.deepEqual(effectiveComposition(redone.value), effectiveComposition(accepted.value))
console.log('PASS: valid reorder lands at 10s, V2 stays at 20s, actual collision refused, one revision, Undo/Redo exact')
