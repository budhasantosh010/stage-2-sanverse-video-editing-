import { describe, expect, it } from 'vitest'

import {
  DEFAULT_VISUAL_PROPERTIES,
  acceptChangeSet,
  activeTimelineTrackState,
  activeVisualProperties,
  createIdFactory,
  type EditOperation,
  type EditProject,
} from '@sanverse/edit-domain'
import {
  changeSetOf,
  testCaptions,
  testMediaOverlay,
  testMultiAssetProject,
  testMusic,
  testProject,
  testSplit,
  testTitle,
  testTrim,
} from '@sanverse/edit-domain/test-fixtures'
import { trackById, tracksOfKind } from '@sanverse/edit-domain/timeline-tracks'

import { buildTimelineViewModel } from './timeline-view-model'
import {
  augmentOperationsForSyncLock,
  familyAndIdentityForTimelineItem,
  planAddTimelineTrack,
  planAssignTimelineItemTrack,
  planDeleteTimelineTrack,
  planMoveItemToTopTrack,
  planOperationsForSyncLock,
  planRenameTimelineTrack,
  planReorderTimelineTrack,
  planSetTrackAudioState,
  planSetTrackSyncLock,
  resolveRippleAffectedTracks,
  selectTrackDirection,
} from './timeline-track-controls'

const accept = (project: EditProject, id: string, operations: readonly EditOperation[]): EditProject => {
  const result = acceptChangeSet(project, changeSetOf(id, project.revision, operations))
  if (!result.ok) throw new Error(JSON.stringify(result.error))
  return result.value
}

const model = (project: EditProject) => buildTimelineViewModel({
  project,
  selectedItemIds: [],
  pending: null,
})

const planOps = (plan: ReturnType<typeof planAddTimelineTrack>): readonly EditOperation[] => {
  if (!plan.ok) throw new Error(plan.refusal.message)
  return plan.operations
}

describe('T5 advanced track controls', () => {
  it('adds stable generic video/audio/caption tracks inside the closed limits', () => {
    let project = testProject()
    for (const [kind, id] of [['video', 'changeset_t5addvideo'], ['audio', 'changeset_t5addaudio'], ['caption', 'changeset_t5addcapt']] as const) {
      const plan = planAddTimelineTrack({ project, kind, ids: createIdFactory(id) })
      expect(plan.ok).toBe(true)
      project = accept(project, id, planOps(plan))
    }
    const state = activeTimelineTrackState(project)
    expect(tracksOfKind(state, 'video')).toHaveLength(3)
    expect(tracksOfKind(state, 'audio')).toHaveLength(3)
    expect(tracksOfKind(state, 'caption')).toHaveLength(2)
    expect(state.tracks.every((track) => track.trackId.startsWith('track_'))).toBe(true)
  })

  it('renames metadata without changing the stable id and reorders generic video only', () => {
    let project = testProject()
    const addId = 'changeset_t5renadd01'
    const add = planAddTimelineTrack({ project, kind: 'video', ids: createIdFactory(addId) })
    project = accept(project, addId, planOps(add))
    const added = tracksOfKind(activeTimelineTrackState(project), 'video').at(-1)!

    const renameId = 'changeset_t5rename01'
    const rename = planRenameTimelineTrack({ project, trackId: added.trackId, name: '  Camera B  ', lockedTrackIds: [], ids: createIdFactory(renameId) })
    if (!rename.ok) throw new Error(rename.refusal.message)
    project = accept(project, renameId, rename.operations)
    expect(trackById(activeTimelineTrackState(project), added.trackId)?.name).toBe('Camera B')

    const reorderId = 'changeset_t5reorder1'
    const reorder = planReorderTimelineTrack({ project, trackId: added.trackId, toIndex: 1, lockedTrackIds: [], ids: createIdFactory(reorderId) })
    if (!reorder.ok) throw new Error(reorder.refusal.message)
    project = accept(project, reorderId, reorder.operations)
    expect(tracksOfKind(activeTimelineTrackState(project), 'video')[1].trackId).toBe(added.trackId)
  })

  it('refuses direct changes on locked tracks while Sync Lock remains accepted project policy', () => {
    let project = testProject()
    const overlay = activeTimelineTrackState(project).tracks.find((track) => track.role === 'overlay-video')!
    const lockedRename = planRenameTimelineTrack({
      project,
      trackId: overlay.trackId,
      name: 'Graphics',
      lockedTrackIds: [overlay.trackId],
      ids: createIdFactory('changeset_t5locked01'),
    })
    expect(lockedRename.ok).toBe(false)
    if (!lockedRename.ok) expect(lockedRename.refusal.code).toBe('TRACK_LOCKED')

    const syncId = 'changeset_t5sync001'
    const sync = planSetTrackSyncLock({ project, trackId: overlay.trackId, enabled: false, ids: createIdFactory(syncId) })
    if (!sync.ok) throw new Error(sync.refusal.message)
    project = accept(project, syncId, sync.operations)
    expect(trackById(activeTimelineTrackState(project), overlay.trackId)?.syncLockEnabled).toBe(false)
  })

  it('stores one truthful audio mute/solo/gain/pan state on an audio track', () => {
    let project = testProject()
    const music = activeTimelineTrackState(project).tracks.find((track) => track.role === 'music')!
    const id = 'changeset_t5mix0001'
    const plan = planSetTrackAudioState({
      project,
      trackId: music.trackId,
      audioState: { muted: true, solo: true, gainDb: -7.5, pan: 2500 },
      lockedTrackIds: [],
      ids: createIdFactory(id),
    })
    if (!plan.ok) throw new Error(plan.refusal.message)
    project = accept(project, id, plan.operations)
    expect(trackById(activeTimelineTrackState(project), music.trackId)?.audioState).toEqual({
      muted: true,
      solo: true,
      gainDb: -7.5,
      pan: 2500,
    })
  })

  it('moves one logical visual between stable tracks and keeps split placements together', () => {
    let project = testMultiAssetProject()
    project = accept(project, 'changeset_t5broll01', [testMediaOverlay() as EditOperation])
    project = accept(project, 'changeset_t5split001', [testSplit() as EditOperation])
    const addId = 'changeset_t5destadd1'
    project = accept(project, addId, planOps(planAddTimelineTrack({ project, kind: 'video', ids: createIdFactory(addId) })))
    const before = model(project)
    const item = before.lanes.find((lane) => lane.id === 'lane:overlay')!.items.find((candidate) => candidate.kind === 'media-overlay')!
    const family = familyAndIdentityForTimelineItem(item)!
    const destination = tracksOfKind(activeTimelineTrackState(project), 'video').at(-1)!
    const moveId = 'changeset_t5moveitem'
    const plan = planAssignTimelineItemTrack({
      project,
      item,
      family: family.family as 'visual',
      identity: family.identity,
      destinationTrackId: destination.trackId,
      lockedTrackIds: [],
      ids: createIdFactory(moveId),
    })
    if (!plan.ok) throw new Error(plan.refusal.message)
    project = accept(project, moveId, plan.operations)
    const after = model(project)
    expect(after.lanes.find((lane) => lane.trackId === destination.trackId)?.items.filter((candidate) => candidate.kind === 'media-overlay').length).toBeGreaterThan(0)
    expect(after.lanes.find((lane) => lane.id === 'lane:overlay')?.items.filter((candidate) => candidate.kind === 'media-overlay')).toEqual([])
  })

  it('moving and reordering an animated visual changes only track assignment, never T4 keyframes or visual identity', () => {
    let project = testMultiAssetProject()
    project = accept(project, 'changeset_t5animbase', [
      testTitle({ titleId: 'title_animt501', operationId: 'operation_t5title01' }) as EditOperation,
      Object.freeze({
        schemaVersion: 'sanverse.operation/v3',
        operationId: 'operation_t5visual1',
        kind: 'set-visual-properties',
        capabilityId: 'sanverse.visual.properties.primitive/v1',
        visualId: 'title_animt501',
        ...DEFAULT_VISUAL_PROPERTIES,
        tracks: Object.freeze([Object.freeze({
          property: 'scale' as const,
          keyframes: Object.freeze([
            Object.freeze({ at: { ticks: 0, timescale: 1_440_000 as const }, value: 1, easing: Object.freeze({ kind: 'linear' as const }) }),
            Object.freeze({ at: { ticks: 1_440_000, timescale: 1_440_000 as const }, value: 1.4, easing: Object.freeze({ kind: 'linear' as const }) }),
          ]),
        })]),
        extensions: Object.freeze({}),
      }) as EditOperation,
    ])
    const animationBefore = JSON.stringify(activeVisualProperties(project))
    const addId = 'changeset_t5animadd1'
    project = accept(project, addId, planOps(planAddTimelineTrack({ project, kind: 'video', ids: createIdFactory(addId) })))
    const item = model(project).lanes.flatMap((lane) => lane.items).find((candidate) => candidate.visualId === 'title_animt501')!
    const destination = tracksOfKind(activeTimelineTrackState(project), 'video').at(-1)!
    const moveId = 'changeset_t5animmove'
    const move = planAssignTimelineItemTrack({
      project,
      item,
      family: 'visual',
      identity: 'title_animt501',
      destinationTrackId: destination.trackId,
      lockedTrackIds: [],
      ids: createIdFactory(moveId),
    })
    if (!move.ok) throw new Error(move.refusal.message)
    project = accept(project, moveId, move.operations)
    const reorderId = 'changeset_t5animreor'
    const reorder = planReorderTimelineTrack({ project, trackId: destination.trackId, toIndex: 1, lockedTrackIds: [], ids: createIdFactory(reorderId) })
    if (!reorder.ok) throw new Error(reorder.refusal.message)
    project = accept(project, reorderId, reorder.operations)

    const moved = model(project).lanes.flatMap((lane) => lane.items).find((candidate) => candidate.visualId === 'title_animt501')!
    expect(moved.trackId).toBe(destination.trackId)
    expect(moved.visualId).toBe('title_animt501')
    expect(JSON.stringify(activeVisualProperties(project))).toBe(animationBefore)
    expect(activeVisualProperties(project)[0].tracks[0].keyframes).toEqual([
      { at: { ticks: 0, timescale: 1_440_000 }, value: 1, easing: { kind: 'linear' } },
      { at: { ticks: 1_440_000, timescale: 1_440_000 }, value: 1.4, easing: { kind: 'linear' } },
    ])
  })

  it('Place On Top chooses the nearest collision-free compatible video track, or creates one atomically', () => {
    let project = testMultiAssetProject()
    project = accept(project, 'changeset_t5topbroll', [testMediaOverlay() as EditOperation])
    const currentModel = model(project)
    const item = currentModel.lanes.find((lane) => lane.id === 'lane:overlay')!.items.find((candidate) => candidate.kind === 'media-overlay')!
    const id = 'changeset_t5topnew01'
    const planned = planMoveItemToTopTrack({
      project,
      model: currentModel,
      itemId: item.id,
      lockedTrackIds: [],
      ids: createIdFactory(id),
      createIfNeeded: true,
    })
    if (!planned.ok) throw new Error(planned.refusal.message)
    expect(planned.operations.map((operation) => operation.kind)).toEqual(['add-timeline-track', 'assign-timeline-item-track'])
    project = accept(project, id, planned.operations)
    expect(model(project).lanes.some((lane) => lane.trackRole === 'generic-video' && lane.items.some((candidate) => candidate.kind === 'media-overlay'))).toBe(true)
  })

  it('deletes an empty generic track but requires explicit contents deletion for non-empty tracks', () => {
    let project = testProject()
    const addId = 'changeset_t5deladd01'
    project = accept(project, addId, planOps(planAddTimelineTrack({ project, kind: 'audio', ids: createIdFactory(addId) })))
    const generic = tracksOfKind(activeTimelineTrackState(project), 'audio').at(-1)!
    const deleteId = 'changeset_t5delempty'
    const deletion = planDeleteTimelineTrack({ project, model: model(project), trackId: generic.trackId, mode: 'empty-only', lockedTrackIds: [], ids: createIdFactory(deleteId) })
    if (!deletion.ok) throw new Error(deletion.refusal.message)
    project = accept(project, deleteId, deletion.operations)
    expect(trackById(activeTimelineTrackState(project), generic.trackId)).toBeNull()
  })

  it('Track Select Forward/Backward is selection-only and deterministic', () => {
    let project = testMultiAssetProject()
    project = accept(project, 'changeset_t5music001', [testMusic() as EditOperation])
    const view = model(project)
    const musicTrack = view.lanes.find((lane) => lane.trackRole === 'music')!
    const forward = selectTrackDirection({ model: view, trackIds: [musicTrack.trackId], direction: 'forward', playheadTicks: 0 })
    expect(forward.itemIds).toEqual(['music:music_0001:0'])
    const backward = selectTrackDirection({ model: view, trackIds: [musicTrack.trackId], direction: 'backward', playheadTicks: 30_000_000 })
    expect(backward.itemIds).toEqual(['music:music_0001:0'])
    expect(project.revision).toBe(project.revision)
  })

  it('Sync Lock includes primary + dialogue together and defaults music out', () => {
    const state = activeTimelineTrackState(testProject())
    const primary = state.tracks.find((track) => track.role === 'primary-video')!
    const dialogue = state.tracks.find((track) => track.role === 'dialogue')!
    const music = state.tracks.find((track) => track.role === 'music')!
    const affected = resolveRippleAffectedTracks(state, primary.trackId)
    expect(affected).toContain(primary.trackId)
    expect(affected).toContain(dialogue.trackId)
    expect(affected).not.toContain(music.trackId)
  })

  it('does not invent a music ripple when A2 Sync Lock is off', () => {
    let project = testMultiAssetProject()
    project = accept(project, 'changeset_t5syncmusic', [testMusic({ compositionStart: { ticks: 20_000_000, timescale: 1_440_000 } }) as EditOperation])
    const ids = createIdFactory('changeset_t5probe001')
    const operations = augmentOperationsForSyncLock({
      project,
      operations: [Object.freeze({ ...testSplit(), operationId: ids.operation(0) }) as EditOperation],
      ids,
      operationSlotOffset: 1,
    })
    expect(operations).toHaveLength(1)
  })

  it('moves composition-anchored music on a one-clip ripple when its stable track Sync Lock is on', () => {
    let project = testMultiAssetProject()
    project = accept(project, 'changeset_t5musbase1', [testMusic({ compositionStart: { ticks: 20 * 1_440_000, timescale: 1_440_000 } }) as EditOperation])
    const musicTrack = activeTimelineTrackState(project).tracks.find((track) => track.role === 'music')!
    const syncId = 'changeset_t5muslock1'
    const sync = planSetTrackSyncLock({ project, trackId: musicTrack.trackId, enabled: true, ids: createIdFactory(syncId) })
    if (!sync.ok) throw new Error(sync.refusal.message)
    project = accept(project, syncId, sync.operations)

    const changeSetId = 'changeset_t5musripp1'
    const ids = createIdFactory(changeSetId)
    const planned = planOperationsForSyncLock({
      project,
      operations: [Object.freeze({ ...testTrim({ trimStart: { ticks: 1_440_000, timescale: 1_440_000 }, ripple: true }), operationId: ids.operation(0) }) as EditOperation],
      ids,
      operationSlotOffset: 1,
    })
    expect(planned.ok).toBe(true)
    if (!planned.ok) return
    expect(planned.operations.map((operation) => operation.kind)).toEqual(['trim-clip', 'set-music'])
    const musicUpdate = planned.operations.find((operation) => operation.kind === 'set-music')
    expect(musicUpdate && musicUpdate.kind === 'set-music' ? musicUpdate.compositionStart.ticks : null)
      .toBe(19 * 1_440_000)
    const after = accept(project, changeSetId, planned.operations)
    expect(model(after).lanes.find((lane) => lane.trackId === musicTrack.trackId)!.items.find((item) => item.kind === 'music')!.startTicks)
      .toBe(19 * 1_440_000)
  })

  it('keeps a Sync-Lock-off source-anchored visual at its old composition time with one atomic compensation', () => {
    let project = testMultiAssetProject()
    project = accept(project, 'changeset_t5vis0001', [testMediaOverlay() as EditOperation])
    const overlayTrack = activeTimelineTrackState(project).tracks.find((track) => track.role === 'overlay-video')!
    const syncId = 'changeset_t5visoff01'
    const sync = planSetTrackSyncLock({ project, trackId: overlayTrack.trackId, enabled: false, ids: createIdFactory(syncId) })
    if (!sync.ok) throw new Error(sync.refusal.message)
    project = accept(project, syncId, sync.operations)
    const beforeItem = model(project).lanes.find((lane) => lane.trackId === overlayTrack.trackId)!.items.find((item) => item.kind === 'media-overlay')!

    const changeSetId = 'changeset_t5visripple'
    const ids = createIdFactory(changeSetId)
    const planned = planOperationsForSyncLock({
      project,
      operations: [Object.freeze({ ...testTrim({ trimStart: { ticks: 1_440_000, timescale: 1_440_000 }, ripple: true }), operationId: ids.operation(0) }) as EditOperation],
      ids,
      operationSlotOffset: 1,
    })
    expect(planned.ok).toBe(true)
    if (!planned.ok) return
    expect(planned.operations.map((operation) => operation.kind)).toEqual(['trim-clip', 'set-media-overlay'])
    const after = accept(project, changeSetId, planned.operations)
    const afterItem = model(after).lanes.find((lane) => lane.trackId === overlayTrack.trackId)!.items.find((item) => item.kind === 'media-overlay')!
    expect(afterItem.startTicks).toBe(beforeItem.startTicks)
    expect(afterItem.durationTicks).toBe(beforeItem.durationTicks)
  })

  it('keeps every cue on a Sync-Lock-off caption track at the old composition times', () => {
    let project = testMultiAssetProject()
    project = accept(project, 'changeset_t5captions', [testCaptions() as EditOperation])
    const captionTrack = activeTimelineTrackState(project).tracks.find((track) => track.role === 'captions')!
    const syncId = 'changeset_t5capoff01'
    const sync = planSetTrackSyncLock({ project, trackId: captionTrack.trackId, enabled: false, ids: createIdFactory(syncId) })
    if (!sync.ok) throw new Error(sync.refusal.message)
    project = accept(project, syncId, sync.operations)
    const beforeStarts = model(project).lanes.find((lane) => lane.trackId === captionTrack.trackId)!.items
      .filter((item) => item.kind === 'caption').map((item) => item.startTicks)

    const changeSetId = 'changeset_t5capripple'
    const ids = createIdFactory(changeSetId)
    const planned = planOperationsForSyncLock({
      project,
      operations: [Object.freeze({ ...testTrim({ trimStart: { ticks: 1_440_000, timescale: 1_440_000 }, ripple: true }), operationId: ids.operation(0) }) as EditOperation],
      ids,
      operationSlotOffset: 1,
    })
    expect(planned.ok).toBe(true)
    if (!planned.ok) return
    expect(planned.operations.filter((operation) => operation.kind === 'set-caption-cue')).toHaveLength(3)
    const after = accept(project, changeSetId, planned.operations)
    const afterStarts = model(after).lanes.find((lane) => lane.trackId === captionTrack.trackId)!.items
      .filter((item) => item.kind === 'caption').map((item) => item.startTicks)
    expect(afterStarts).toEqual(beforeStarts)
  })

  it('lets source-anchored rows follow the footage when Sync Lock is on', () => {
    let project = testMultiAssetProject()
    project = accept(project, 'changeset_t5vis0002', [testMediaOverlay() as EditOperation, testCaptions() as EditOperation])
    const before = model(project)
    const oldOverlayStart = before.lanes.flatMap((lane) => lane.items).find((item) => item.kind === 'media-overlay')!.startTicks
    const oldCaptionStarts = before.lanes.flatMap((lane) => lane.items).filter((item) => item.kind === 'caption').map((item) => item.startTicks)
    const changeSetId = 'changeset_t5follow001'
    const ids = createIdFactory(changeSetId)
    const planned = planOperationsForSyncLock({
      project,
      operations: [Object.freeze({ ...testTrim({ trimStart: { ticks: 1_440_000, timescale: 1_440_000 }, ripple: true }), operationId: ids.operation(0) }) as EditOperation],
      ids,
      operationSlotOffset: 1,
    })
    expect(planned.ok).toBe(true)
    if (!planned.ok) return
    expect(planned.operations).toHaveLength(1)
    const after = model(accept(project, changeSetId, planned.operations))
    const newOverlayStart = after.lanes.flatMap((lane) => lane.items).find((item) => item.kind === 'media-overlay')!.startTicks
    const newCaptionStarts = after.lanes.flatMap((lane) => lane.items).filter((item) => item.kind === 'caption').map((item) => item.startTicks)
    expect(newOverlayStart).toBeLessThan(oldOverlayStart)
    expect(newCaptionStarts.some((start, index) => start < oldCaptionStarts[index])).toBe(true)
  })
})
