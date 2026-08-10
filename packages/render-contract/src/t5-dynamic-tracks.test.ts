import { describe, expect, it } from 'vitest'

import {
  OPERATION_SCHEMA_VERSION,
  acceptChangeSet,
  activeTimelineTrackState,
  createIdFactory,
  type EditOperation,
  type EditProject,
} from '@sanverse/edit-domain'
import {
  TIMELINE_TRACKS_PRIMITIVE_ID,
  TRACK_OUTPUT_PRIMITIVE_ID,
} from '@sanverse/edit-domain/capabilities'
import {
  changeSetOf,
  testCaptions,
  testMediaOverlay,
  testMultiAssetProject,
  testMusic,
} from '@sanverse/edit-domain/test-fixtures'
import {
  timelineTrackAssignmentKey,
  tracksOfKind,
} from '@sanverse/edit-domain/timeline-tracks'

import { compileProjectToRenderPlan } from './compile-project'

const accept = (project: EditProject, id: string, operations: readonly EditOperation[]): EditProject => {
  const result = acceptChangeSet(project, changeSetOf(id, project.revision, operations))
  if (!result.ok) throw new Error(JSON.stringify(result.error))
  return result.value
}

const compile = (project: EditProject) => {
  const result = compileProjectToRenderPlan(project)
  if (!result.ok) throw new Error(JSON.stringify(result.error))
  return result.value
}

const addTrack = (
  project: EditProject,
  id: string,
  kind: 'video' | 'audio' | 'caption',
): Readonly<{ project: EditProject; trackId: string }> => {
  const ids = createIdFactory(id)
  const sameKind = tracksOfKind(activeTimelineTrackState(project), kind)
  const operation = Object.freeze({
    schemaVersion: OPERATION_SCHEMA_VERSION,
    operationId: ids.operation(0),
    kind: 'add-timeline-track' as const,
    capabilityId: TIMELINE_TRACKS_PRIMITIVE_ID,
    track: Object.freeze({
      trackId: ids.entity('track', 0),
      kind,
      role: kind === 'video' ? 'generic-video' as const : kind === 'audio' ? 'generic-audio' as const : 'captions' as const,
      name: null,
      syncLockEnabled: true,
      outputEnabled: true,
      audioState: kind === 'audio' ? Object.freeze({ muted: false, solo: false, gainDb: 0, pan: 0 }) : null,
    }),
    insertIndex: sameKind.length,
    extensions: Object.freeze({}),
  }) as EditOperation
  return Object.freeze({ project: accept(project, id, [operation]), trackId: ids.entity('track', 0) })
}

const assignment = (
  id: string,
  slot: number,
  family: 'visual' | 'audio' | 'caption',
  identity: string,
  trackId: string,
): EditOperation => {
  const ids = createIdFactory(id)
  return Object.freeze({
    schemaVersion: OPERATION_SCHEMA_VERSION,
    operationId: ids.operation(slot),
    kind: 'assign-timeline-item-track' as const,
    capabilityId: TIMELINE_TRACKS_PRIMITIVE_ID,
    itemId: timelineTrackAssignmentKey(family, identity),
    trackId,
    extensions: Object.freeze({}),
  }) as EditOperation
}

describe('T5 stable tracks reach the render plan', () => {
  it('hides only the visual assigned to a stable video track whose output is off', () => {
    let project = testMultiAssetProject()
    const added = addTrack(project, 'changeset_t5renderadd1', 'video')
    project = added.project
    const id = 'changeset_t5renderb01'
    const visual = testMediaOverlay({ operationId: createIdFactory(id).operation(0), overlayId: 'broll_t5render1' }) as EditOperation
    project = accept(project, id, [visual, assignment(id, 1, 'visual', 'broll_t5render1', added.trackId)])
    expect(compile(project).overlays.some((node) => node.nodeId.startsWith('broll_t5render1'))).toBe(true)

    const offId = 'changeset_t5renderoff'
    project = accept(project, offId, [Object.freeze({
      schemaVersion: OPERATION_SCHEMA_VERSION,
      operationId: createIdFactory(offId).operation(0),
      kind: 'set-track-output' as const,
      capabilityId: TRACK_OUTPUT_PRIMITIVE_ID,
      trackId: added.trackId,
      outputEnabled: false,
      extensions: Object.freeze({}),
    }) as EditOperation])
    expect(compile(project).overlays.some((node) => node.nodeId.startsWith('broll_t5render1'))).toBe(false)
  })

  it('uses stable video track order as visual stacking order, not operation or DOM order', () => {
    let project = testMultiAssetProject()
    const a = addTrack(project, 'changeset_t5stackadd1', 'video')
    project = a.project
    const b = addTrack(project, 'changeset_t5stackadd2', 'video')
    project = b.project

    const firstId = 'changeset_t5stackvis1'
    const first = testMediaOverlay({ operationId: createIdFactory(firstId).operation(0), overlayId: 'broll_t5stacka' }) as EditOperation
    project = accept(project, firstId, [first, assignment(firstId, 1, 'visual', 'broll_t5stacka', a.trackId)])
    const secondId = 'changeset_t5stackvis2'
    const second = testMediaOverlay({ operationId: createIdFactory(secondId).operation(0), overlayId: 'broll_t5stackb' }) as EditOperation
    project = accept(project, secondId, [second, assignment(secondId, 1, 'visual', 'broll_t5stackb', b.trackId)])

    expect(compile(project).overlays.filter((node) => node.kind === 'media-overlay').map((node) => node.nodeId)).toEqual([
      'broll_t5stacka',
      'broll_t5stackb',
    ])

    const reorderId = 'changeset_t5stackmove'
    project = accept(project, reorderId, [Object.freeze({
      schemaVersion: OPERATION_SCHEMA_VERSION,
      operationId: createIdFactory(reorderId).operation(0),
      kind: 'reorder-timeline-track' as const,
      capabilityId: TIMELINE_TRACKS_PRIMITIVE_ID,
      trackId: b.trackId,
      toIndex: tracksOfKind(activeTimelineTrackState(project), 'video').findIndex((track) => track.trackId === a.trackId),
      extensions: Object.freeze({}),
    }) as EditOperation])

    expect(compile(project).overlays.filter((node) => node.kind === 'media-overlay').map((node) => node.nodeId)).toEqual([
      'broll_t5stackb',
      'broll_t5stacka',
    ])
  })

  it('bakes audio-track gain and pan into music and solo suppresses non-solo dialogue/music', () => {
    let project = testMultiAssetProject()
    const added = addTrack(project, 'changeset_t5audioadd1', 'audio')
    project = added.project

    const defaultMusicId = 'changeset_t5musicdef1'
    project = accept(project, defaultMusicId, [testMusic({
      operationId: createIdFactory(defaultMusicId).operation(0),
      musicId: 'music_t5default',
    }) as EditOperation])

    const genericMusicId = 'changeset_t5musicgen1'
    const genericMusic = testMusic({
      operationId: createIdFactory(genericMusicId).operation(0),
      musicId: 'music_t5generic',
      gainDb: -12,
    }) as EditOperation
    project = accept(project, genericMusicId, [genericMusic, assignment(genericMusicId, 1, 'audio', 'music_t5generic', added.trackId)])

    const mixId = 'changeset_t5mixrender'
    project = accept(project, mixId, [Object.freeze({
      schemaVersion: OPERATION_SCHEMA_VERSION,
      operationId: createIdFactory(mixId).operation(0),
      kind: 'set-track-audio-state' as const,
      capabilityId: TIMELINE_TRACKS_PRIMITIVE_ID,
      trackId: added.trackId,
      audioState: Object.freeze({ muted: false, solo: true, gainDb: -6, pan: 5000 }),
      extensions: Object.freeze({}),
    }) as EditOperation])

    const plan = compile(project)
    expect(plan.music).toHaveLength(1)
    expect(plan.music[0]).toMatchObject({ nodeId: 'music_t5generic', gainDb: -18, pan: 5000 })
    expect(plan.segments.every((segment) => segment.audioEnabled === false)).toBe(true)
  })

  it('mute and output both silence a stable audio track in the shared render plan', () => {
    let project = testMultiAssetProject()
    const added = addTrack(project, 'changeset_t5muteadd1', 'audio')
    project = added.project
    const musicId = 'changeset_t5mutemusic'
    project = accept(project, musicId, [
      testMusic({ operationId: createIdFactory(musicId).operation(0), musicId: 'music_t5mute' }) as EditOperation,
      assignment(musicId, 1, 'audio', 'music_t5mute', added.trackId),
    ])

    const muteId = 'changeset_t5mutestate'
    project = accept(project, muteId, [Object.freeze({
      schemaVersion: OPERATION_SCHEMA_VERSION,
      operationId: createIdFactory(muteId).operation(0),
      kind: 'set-track-audio-state' as const,
      capabilityId: TIMELINE_TRACKS_PRIMITIVE_ID,
      trackId: added.trackId,
      audioState: Object.freeze({ muted: true, solo: false, gainDb: 0, pan: 0 }),
      extensions: Object.freeze({}),
    }) as EditOperation])
    expect(compile(project).music).toEqual([])
  })

  it('routes separate caption sets through stable caption tracks so one track can be hidden without hiding the other', () => {
    let project = testMultiAssetProject()
    const added = addTrack(project, 'changeset_t5capadd01', 'caption')
    project = added.project

    const firstId = 'changeset_t5capset01'
    project = accept(project, firstId, [testCaptions({
      operationId: createIdFactory(firstId).operation(0),
      captionSetId: 'captions_t5first1',
    }) as EditOperation])

    const secondId = 'changeset_t5capset02'
    project = accept(project, secondId, [
      testCaptions({
        operationId: createIdFactory(secondId).operation(0),
        captionSetId: 'captions_t5second',
      }) as EditOperation,
      assignment(secondId, 1, 'caption', 'captions_t5second', added.trackId),
    ])
    const before = compile(project)
    expect(before.overlays.some((node) => node.nodeId.startsWith('captions_t5first1.'))).toBe(true)
    expect(before.overlays.some((node) => node.nodeId.startsWith('captions_t5second.'))).toBe(true)

    const offId = 'changeset_t5capoff001'
    project = accept(project, offId, [Object.freeze({
      schemaVersion: OPERATION_SCHEMA_VERSION,
      operationId: createIdFactory(offId).operation(0),
      kind: 'set-track-output' as const,
      capabilityId: TRACK_OUTPUT_PRIMITIVE_ID,
      trackId: added.trackId,
      outputEnabled: false,
      extensions: Object.freeze({}),
    }) as EditOperation])
    const after = compile(project)
    expect(after.overlays.some((node) => node.nodeId.startsWith('captions_t5first1.'))).toBe(true)
    expect(after.overlays.some((node) => node.nodeId.startsWith('captions_t5second.'))).toBe(false)
  })

  it('stays valid at the required stress shape of 20 video, 24 audio and all 8 caption tracks', () => {
    let project = testMultiAssetProject()
    while (tracksOfKind(activeTimelineTrackState(project), 'video').length < 20) {
      const index = tracksOfKind(activeTimelineTrackState(project), 'video').length
      project = addTrack(project, `changeset_t5stressv${String(index).padStart(2, '0')}`, 'video').project
    }
    while (tracksOfKind(activeTimelineTrackState(project), 'audio').length < 24) {
      const index = tracksOfKind(activeTimelineTrackState(project), 'audio').length
      project = addTrack(project, `changeset_t5stressa${String(index).padStart(2, '0')}`, 'audio').project
    }
    while (tracksOfKind(activeTimelineTrackState(project), 'caption').length < 8) {
      const index = tracksOfKind(activeTimelineTrackState(project), 'caption').length
      project = addTrack(project, `changeset_t5stressc${String(index).padStart(2, '0')}`, 'caption').project
    }
    const state = activeTimelineTrackState(project)
    expect(tracksOfKind(state, 'video')).toHaveLength(20)
    expect(tracksOfKind(state, 'audio')).toHaveLength(24)
    expect(tracksOfKind(state, 'caption')).toHaveLength(8)
    expect(compile(project).segments.length).toBeGreaterThan(0)
  })

  it('rename and Sync Lock do not change picture/audio instructions beyond the unavoidable project revision', () => {
    let project = testMultiAssetProject()
    const added = addTrack(project, 'changeset_t5metadd01', 'video')
    project = added.project
    const before = compile(project)
    const metadataId = 'changeset_t5metadata'
    project = accept(project, metadataId, [
      Object.freeze({
        schemaVersion: OPERATION_SCHEMA_VERSION,
        operationId: createIdFactory(metadataId).operation(0),
        kind: 'rename-timeline-track' as const,
        capabilityId: TIMELINE_TRACKS_PRIMITIVE_ID,
        trackId: added.trackId,
        name: 'Cutaways',
        extensions: Object.freeze({}),
      }) as EditOperation,
      Object.freeze({
        schemaVersion: OPERATION_SCHEMA_VERSION,
        operationId: createIdFactory(metadataId).operation(1),
        kind: 'set-track-sync-lock' as const,
        capabilityId: TIMELINE_TRACKS_PRIMITIVE_ID,
        trackId: added.trackId,
        enabled: false,
        extensions: Object.freeze({}),
      }) as EditOperation,
    ])
    const after = compile(project)
    const stripRevision = <T extends { projectRevision: number }>(plan: T) => ({ ...plan, projectRevision: 0 })
    expect(stripRevision(after)).toEqual(stripRevision(before))
  })
})
