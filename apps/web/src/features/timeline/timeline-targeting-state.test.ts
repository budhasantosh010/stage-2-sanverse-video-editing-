import { describe, expect, it } from 'vitest'

import {
  acceptChangeSet,
  activeTimelineTrackState,
  createIdFactory,
  type EditOperation,
  type EditProject,
} from '@sanverse/edit-domain'
import { TIMELINE_TRACKS_PRIMITIVE_ID } from '@sanverse/edit-domain/capabilities'
import { changeSetOf, testMediaOverlay, testProject } from '@sanverse/edit-domain/test-fixtures'
import { tracksOfKind } from '@sanverse/edit-domain/timeline-tracks'

import {
  EMPTY_TIMELINE_TARGETING,
  TIMELINE_TARGETING_SCHEMA_VERSION,
  augmentOperationsForTimelineTargeting,
  parseTimelineTargetingState,
  reconcileTimelineTargetingState,
  resolveTimelineDestinationTrack,
  toggleTimelineTrackTarget,
} from './timeline-targeting-state'

const accept = (project: EditProject, id: string, operations: readonly EditOperation[]): EditProject => {
  const result = acceptChangeSet(project, changeSetOf(id, project.revision, operations))
  if (!result.ok) throw new Error(JSON.stringify(result.error))
  return result.value
}

const addVideoTrack = (project: EditProject, id: string): EditProject => {
  const ids = createIdFactory(id)
  const operation = Object.freeze({
    schemaVersion: 'sanverse.operation/v3' as const,
    operationId: ids.operation(0),
    kind: 'add-timeline-track' as const,
    capabilityId: TIMELINE_TRACKS_PRIMITIVE_ID,
    track: Object.freeze({
      trackId: ids.entity('track', 0),
      kind: 'video' as const,
      role: 'generic-video' as const,
      name: null,
      syncLockEnabled: true,
      outputEnabled: true,
      audioState: null,
    }),
    insertIndex: activeTimelineTrackState(project).tracks.filter((track) => track.kind === 'video').length,
    extensions: Object.freeze({}),
  }) as EditOperation
  return accept(project, id, [operation])
}

describe('T5 targeting workspace state', () => {
  it('fails closed to empty on corrupt or old data', () => {
    expect(parseTimelineTargetingState('{nope')).toEqual(EMPTY_TIMELINE_TARGETING)
    expect(parseTimelineTargetingState(JSON.stringify({ schemaVersion: 'old', targetedVideoTrackIds: ['track_aaaaaaaa'] }))).toEqual(EMPTY_TIMELINE_TARGETING)
  })

  it('keeps only stable ids and deduplicates them', () => {
    expect(parseTimelineTargetingState(JSON.stringify({
      schemaVersion: TIMELINE_TARGETING_SCHEMA_VERSION,
      targetedVideoTrackIds: ['track_aaaaaaaa', 'V2', 'track_aaaaaaaa'],
      targetedAudioTrackIds: ['track_bbbbbbbb'],
      targetedCaptionTrackIds: [],
    }))).toEqual({
      schemaVersion: TIMELINE_TARGETING_SCHEMA_VERSION,
      targetedVideoTrackIds: ['track_aaaaaaaa'],
      targetedAudioTrackIds: ['track_bbbbbbbb'],
      targetedCaptionTrackIds: [],
    })
  })

  it('reconciles stale and wrong-kind targets away', () => {
    const state = activeTimelineTrackState(testProject())
    const primary = tracksOfKind(state, 'video')[0]
    const targeting = {
      schemaVersion: TIMELINE_TARGETING_SCHEMA_VERSION,
      targetedVideoTrackIds: [primary.trackId, 'track_missing01'],
      targetedAudioTrackIds: [primary.trackId],
      targetedCaptionTrackIds: [],
    } as const
    expect(reconcileTimelineTargetingState(targeting, state)).toEqual({
      schemaVersion: TIMELINE_TARGETING_SCHEMA_VERSION,
      targetedVideoTrackIds: [primary.trackId],
      targetedAudioTrackIds: [],
      targetedCaptionTrackIds: [],
    })
  })

  it('explicit pointer destination wins over targeting, and targeting wins over the legacy default', () => {
    let project = addVideoTrack(testProject(), 'changeset_t5targeta')
    project = addVideoTrack(project, 'changeset_t5targetb')
    const state = activeTimelineTrackState(project)
    const videos = tracksOfKind(state, 'video').filter((track) => track.role !== 'primary-video')
    const targeted = toggleTimelineTrackTarget(EMPTY_TIMELINE_TARGETING, videos[0])
    expect(resolveTimelineDestinationTrack({ trackState: state, targeting: targeted, family: 'visual' })?.trackId).toBe(videos[0].trackId)
    expect(resolveTimelineDestinationTrack({ trackState: state, targeting: targeted, family: 'visual', explicitTrackId: videos[1].trackId })?.trackId).toBe(videos[1].trackId)
    expect(resolveTimelineDestinationTrack({ trackState: state, targeting: EMPTY_TIMELINE_TARGETING, family: 'visual' })?.role).toBe('overlay-video')
  })

  it('targeting alone changes no project revision and augments an untargeted authored visual exactly once', () => {
    const project = addVideoTrack(testProject(), 'changeset_t5targetc')
    const state = activeTimelineTrackState(project)
    const destination = tracksOfKind(state, 'video').find((track) => track.role === 'generic-video')!
    const targeting = toggleTimelineTrackTarget(EMPTY_TIMELINE_TARGETING, destination)
    expect(project.revision).toBe(1)

    const operation = testMediaOverlay({ operationId: 'operation_target01', overlayId: 'broll_target01' }) as EditOperation
    const augmented = augmentOperationsForTimelineTargeting({
      project,
      operations: [operation],
      targeting,
      ids: createIdFactory('changeset_t5targetd'),
      operationSlotOffset: 1,
    })
    expect(augmented.map((item) => item.kind)).toEqual(['add-media-overlay', 'assign-timeline-item-track'])
    const assignment = augmented[1] as Extract<EditOperation, { kind: 'assign-timeline-item-track' }>
    expect(assignment.trackId).toBe(destination.trackId)
    expect(project.revision).toBe(1)
  })

  it('never overrides an explicit assignment already present in the same atomic edit', () => {
    let project = addVideoTrack(testProject(), 'changeset_t5targete')
    project = addVideoTrack(project, 'changeset_t5targetf')
    const state = activeTimelineTrackState(project)
    const videos = tracksOfKind(state, 'video').filter((track) => track.role !== 'primary-video')
    const targeting = toggleTimelineTrackTarget(EMPTY_TIMELINE_TARGETING, videos[0])
    const ids = createIdFactory('changeset_t5targetg')
    const visual = testMediaOverlay({ operationId: ids.operation(0), overlayId: 'broll_target02' }) as EditOperation
    const explicit = Object.freeze({
      schemaVersion: 'sanverse.operation/v3' as const,
      operationId: ids.operation(1),
      kind: 'assign-timeline-item-track' as const,
      capabilityId: TIMELINE_TRACKS_PRIMITIVE_ID,
      itemId: 'visual:broll_target02',
      trackId: videos[1].trackId,
      extensions: Object.freeze({}),
    }) as EditOperation
    const augmented = augmentOperationsForTimelineTargeting({ project, operations: [visual, explicit], targeting, ids, operationSlotOffset: 2 })
    expect(augmented).toHaveLength(2)
    expect((augmented[1] as Extract<EditOperation, { kind: 'assign-timeline-item-track' }>).trackId).toBe(videos[1].trackId)
  })
})
