import { describe, expect, it } from 'vitest'
import { MOVE_PRIMARY_CLIP_PRIMITIVE_ID, TIMELINE_TRACKS_PRIMITIVE_ID } from './capabilities.ts'
import { acceptChangeSet, activeTimelineTrackState, effectiveComposition, redoChangeSet, undoChangeSet } from './project.ts'
import { changeSetOf, ms, TEST_CLIP_ID, TEST_TRACK_ID, testMultiAssetProject, testSplit, testMediaOverlay, testOperation } from './test-fixtures.ts'

const project = () => testMultiAssetProject()
const destination = () => activeTimelineTrackState(project()).tracks.find(t => t.role === 'overlay-video')!.trackId
const move = (trackId = destination(), extra: Record<string, unknown> = {}) => ({
  schemaVersion: 'sanverse.operation/v3', operationId: 'operation_transfer01',
  kind: 'move-primary-clip', capabilityId: MOVE_PRIMARY_CLIP_PRIMITIVE_ID,
  clipId: TEST_CLIP_ID, compositionStart: ms(0), destinationTrackId: trackId, extensions: {}, ...extra,
})
const transfer = () => acceptChangeSet(project(), changeSetOf('changeset_transfer01', project().revision, [move()] as never))

describe('primary track transfer', () => {
  it('moves the same clip to an existing video track as one reversible edit', () => {
    const before = project()
    const result = transfer()
    if (!result.ok) throw new Error(JSON.stringify(result.error))
    const composition = effectiveComposition(result.value)
    expect(composition.tracks.find(t => t.trackId === TEST_TRACK_ID)!.clips).toHaveLength(0)
    expect(composition.tracks.find(t => t.trackId === destination())!.clips).toEqual(before.composition.tracks[0].clips)
    const undo = undoChangeSet(result.value)
    expect(undo.ok).toBe(true)
    if (!undo.ok) return
    expect(effectiveComposition(undo.value)).toEqual(effectiveComposition(before))
    const redo = redoChangeSet(undo.value)
    expect(redo.ok).toBe(true)
    if (redo.ok) expect(effectiveComposition(redo.value)).toEqual(composition)
  })
  it('refuses missing or audio destinations without changing the input', () => {
    const before = project()
    for (const id of ['track_missing001', activeTimelineTrackState(before).tracks.find(t => t.kind === 'audio')!.trackId]) {
      expect(acceptChangeSet(before, changeSetOf('changeset_transfer01', before.revision, [move(id)] as never)).ok).toBe(false)
    }
    expect(effectiveComposition(before)).toEqual(before.composition)
  })
  it('refuses deleting a track that still owns primary footage', () => {
    const moved = transfer()
    if (!moved.ok) throw new Error(JSON.stringify(moved.error))
    const result = acceptChangeSet(moved.value, changeSetOf('changeset_deletetrack1', moved.value.revision, [{
      schemaVersion: 'sanverse.operation/v3', operationId: 'operation_deletetrack1',
      kind: 'remove-timeline-track', capabilityId: TIMELINE_TRACKS_PRIMITIVE_ID,
      trackId: destination(), extensions: {},
    }] as never))
    expect(result.ok).toBe(false)
  })
  it('accepts cross-layer overlap and preserves it through Undo/Redo', () => {
    const before = project()
    const split = acceptChangeSet(before, changeSetOf('changeset_splittransfer', before.revision, [testSplit({ atClipTime: ms(10_000), newClipId: 'clip_transferred02' })]))
    if (!split.ok) throw new Error(JSON.stringify(split.error))
    const moved = acceptChangeSet(split.value, changeSetOf('changeset_transfer01', split.value.revision, [move(destination(), { clipId: 'clip_transferred02', compositionStart: ms(10_000) })] as never))
    if (!moved.ok) throw new Error(JSON.stringify(moved.error))
    const result = acceptChangeSet(moved.value, changeSetOf('changeset_collision01', moved.value.revision, [{
      ...move(TEST_TRACK_ID, { operationId: 'operation_collision01', compositionStart: ms(5_000) }),
    }] as never))
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(effectiveComposition(result.value).tracks.flatMap(track => track.clips).map(clip => clip.compositionStart.ticks)).toEqual([ms(5000).ticks, ms(10000).ticks])
    const undone = undoChangeSet(result.value)
    if (!undone.ok) throw new Error('Undo failed')
    expect(effectiveComposition(undone.value)).toEqual(effectiveComposition(moved.value))
    const redone = redoChangeSet(undone.value)
    if (!redone.ok) throw new Error('Redo failed')
    expect(effectiveComposition(redone.value)).toEqual(effectiveComposition(result.value))
  })
  it('allows visuals on the same video track above transferred footage', () => {
    const moved = transfer()
    if (!moved.ok) throw new Error(JSON.stringify(moved.error))
    const result = acceptChangeSet(moved.value, changeSetOf('changeset_transferbroll', moved.value.revision, [testMediaOverlay()]))
    expect(result.ok).toBe(true)
  })
  it('accepts lower-track visuals with the layered render order', () => {
    const before = project()
    const created = acceptChangeSet(before, changeSetOf('changeset_uppertrack', before.revision, [{
      schemaVersion: 'sanverse.operation/v3', operationId: 'operation_uppertrack',
      capabilityId: TIMELINE_TRACKS_PRIMITIVE_ID, kind: 'add-timeline-track',
      track: { trackId: 'track_uppervideo', kind: 'video', role: 'generic-video', name: null, syncLockEnabled: true, outputEnabled: true, audioState: null },
      insertIndex: 2, extensions: {},
    }] as never))
    if (!created.ok) throw new Error(JSON.stringify(created.error))
    const moved = acceptChangeSet(created.value, changeSetOf('changeset_uppermove', created.value.revision, [move('track_uppervideo')] as never))
    if (!moved.ok) throw new Error(JSON.stringify(moved.error))
    const result = acceptChangeSet(moved.value, changeSetOf('changeset_lowernameplate', moved.value.revision, [testOperation()]))
    expect(result.ok).toBe(true)
  })
})
