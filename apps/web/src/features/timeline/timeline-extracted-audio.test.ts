import { describe, expect, it } from 'vitest'
import { acceptChangeSet, activeTimelineTrackState, createIdFactory, effectiveComposition } from '@sanverse/edit-domain'
import { changeSetOf, testProject, TEST_CLIP_ID } from '@sanverse/edit-domain/test-fixtures'
import { buildTimelineViewModel } from './timeline-view-model'
import { planTimelineBodyDrag } from './timeline-body-drag-plan'
import { adaptTimelineGesture } from './timeline-gesture-adapter'
import { placeSourceSpan, mediaTime } from '@sanverse/edit-domain'
import { resolvePrimarySource } from '../render-plan/primary-source'
import { planExtractAudio } from './timeline-extract-audio'
import { planStandardTrim } from './timeline-precision-trim'
import { describeOperation } from '../history/describe-operation'

describe('extracted audio timeline', () => {
  it('plans extraction and a dedicated audio track as one history entry', () => {
    const base = testProject()
    const plan = planExtractAudio({ project: base, clipId: TEST_CLIP_ID,
      lockedTrackIds: [], pendingProposalExists: false, exportInProgress: false,
      ids: createIdFactory('changeset_extract02') })
    if (!plan.ok) throw new Error(plan.refusal.message)
    expect(plan.operations.map(operation => operation.kind)).toEqual(['add-timeline-track', 'extract-clip-audio'])
    expect(describeOperation(plan.operations[1])).toBe('Extracted sound from picture')
    const extracted = acceptChangeSet(base, changeSetOf('changeset_extract02', base.revision, plan.operations))
    if (!extracted.ok) throw new Error(JSON.stringify(extracted.error))
    const sound = effectiveComposition(extracted.value).tracks.find(track => track.kind === 'audio')!.clips[0]
    const trim = planStandardTrim({ project: extracted.value, operationId: 'operation_precision01',
      clipId: sound.clipId, edge: 'end', deltaTicks: -1440000 })
    if (!trim.ok) throw new Error(JSON.stringify(trim))
    const model = buildTimelineViewModel({ project: extracted.value, selectedItemIds: [], pending: null })
    const destinationTrackId = activeTimelineTrackState(extracted.value).tracks.find(track => track.role === 'music')!.trackId
    const move = planTimelineBodyDrag({ project: extracted.value, model,
      request: { itemId: `clip:${sound.clipId}`, destinationTrackId, toStartTicks: 1440000 },
      lockedTrackIds: [], pendingProposalExists: false, exportInProgress: false,
      expectedRevision: extracted.value.revision, ids: createIdFactory('changeset_movetrack') })
    if (!move.ok) throw new Error(move.refusal.message)
    expect(acceptChangeSet(extracted.value, changeSetOf('changeset_movetrack', extracted.value.revision, move.operations)).ok).toBe(true)
    expect(planExtractAudio({ project: base, clipId: TEST_CLIP_ID,
      lockedTrackIds: [effectiveComposition(base).tracks[0].trackId], pendingProposalExists: false,
      exportInProgress: false, ids: createIdFactory('changeset_extract03') }).ok).toBe(false)
  })
  it('shows a separately selectable sound clip and moves it without its picture', () => {
    const base = testProject()
    const trackId = activeTimelineTrackState(base).tracks.find(track => track.role === 'music')!.trackId
    const accepted = acceptChangeSet(base, changeSetOf('changeset_extract01', base.revision, [{
      schemaVersion: 'sanverse.operation/v3', operationId: 'operation_extract01',
      capabilityId: 'sanverse.timeline.extract-audio.primitive/v1', kind: 'extract-clip-audio',
      clipId: TEST_CLIP_ID, newClipId: 'clip_extracted01', trackId, extensions: {},
    }]))
    if (!accepted.ok) throw new Error(JSON.stringify(accepted.error))
    const project = accepted.value
    for (const gesture of [
      { type: 'set-audio' as const, clipId: 'clip_extracted01', gainDb: -6, fadeInTicks: 0, fadeOutTicks: 0 },
      { type: 'trim-end' as const, clipId: 'clip_extracted01', deltaTicks: 1440000 },
      { type: 'split' as const, clipId: 'clip_extracted01', atTicks: 14400000 },
      { type: 'remove-gap' as const, clipId: 'clip_extracted01', atTicks: 14400000 },
    ]) {
      const adapted = adaptTimelineGesture({ project, gesture,
        createOperationId: () => 'operation_audioedit', createClipId: () => 'clip_audiosplit',
        pendingProposalExists: false, exportInProgress: false })
      if (!adapted.ok) throw new Error(adapted.error.message)
      expect(adapted.value).toMatchObject({ clipId: 'clip_extracted01' })
    }
    const sound = effectiveComposition(project).tracks.find(track => track.kind === 'audio')!.clips[0]
    expect(placeSourceSpan(effectiveComposition(project), sound.assetId, { start: mediaTime(0), duration: mediaTime(1440000) })).toHaveLength(1)
    const model = buildTimelineViewModel({ project, selectedItemIds: [], pending: null })
    const items = model.lanes.flatMap(lane => lane.items)
    expect(items.find(item => item.id === `dialogue:${TEST_CLIP_ID}`)).toBeUndefined()
    expect(items.find(item => item.id === 'clip:clip_extracted01')).toMatchObject({
      trackId, clipId: 'clip_extracted01', linkedClipId: null, sourceStartTicks: 0,
    })
    const plan = planTimelineBodyDrag({ project, model,
      request: { itemId: 'clip:clip_extracted01', destinationTrackId: trackId, toStartTicks: 1440000 },
      lockedTrackIds: [], pendingProposalExists: false, exportInProgress: false,
      expectedRevision: project.revision, ids: createIdFactory('changeset_moveaudio'),
    })
    if (!plan.ok) throw new Error(plan.refusal.message)
    const moved = acceptChangeSet(project, changeSetOf('changeset_moveaudio', project.revision, plan.operations))
    if (!moved.ok) throw new Error(JSON.stringify(moved.error))
    const composition = effectiveComposition(moved.value)
    expect(composition.tracks.find(track => track.kind === 'video')!.clips[0].compositionStart.ticks).toBe(0)
    expect(composition.tracks.find(track => track.kind === 'audio')!.clips[0].compositionStart.ticks).toBe(1440000)
    const removed = adaptTimelineGesture({ project: moved.value,
      gesture: { type: 'remove-gap', clipId: TEST_CLIP_ID, atTicks: 1440000 },
      createOperationId: () => 'operation_removevideo', createClipId: () => 'clip_unused',
      pendingProposalExists: false, exportInProgress: false })
    if (!removed.ok) throw new Error(removed.error.message)
    const onlySound = acceptChangeSet(moved.value, changeSetOf('changeset_removevideo', moved.value.revision, [removed.value]))
    if (!onlySound.ok) throw new Error(JSON.stringify(onlySound.error))
    expect(resolvePrimarySource(onlySound.value, 2880000).kind).toBe('gap')
  })
})
