import { describe, expect, it } from 'vitest'

import {
  CLIP_TIME_TRANSFORM_PRIMITIVE_ID,
  TIMELINE_GROUPS_PRIMITIVE_ID,
  TIMELINE_MARKERS_PRIMITIVE_ID,
  TRACK_OUTPUT_PRIMITIVE_ID,
} from '@sanverse/edit-domain/capabilities'
import {
  DEFAULT_VISUAL_PROPERTIES,
  FOOTAGE_MOTION_CAPABILITY_ID,
  acceptChangeSet,
  mediaTime,
  type EditProject,
} from '@sanverse/edit-domain'
import { changeSetOf, testMultiAssetProject, testSplit } from '@sanverse/edit-domain/test-fixtures'

import { exportIdempotencyKey } from './export-identity.ts'

const accept = (
  project: EditProject,
  changeSetId: string,
  operations: readonly unknown[],
): EditProject => {
  const result = acceptChangeSet(project, changeSetOf(changeSetId, project.revision, operations as never))
  if (!result.ok) throw new Error(`accept failed: ${JSON.stringify(result.error)}`)
  return result.value
}

const markersOperation = (operationId: string): Record<string, unknown> => ({
  schemaVersion: 'sanverse.operation/v3',
  operationId,
  kind: 'set-timeline-markers',
  capabilityId: TIMELINE_MARKERS_PRIMITIVE_ID,
  markers: [{
    markerId: 'marker_aaaaaaaa',
    startTicks: 1_440_000,
    durationTicks: 0,
    label: 'Fix the audio here',
    note: 'the hum starts around now',
    color: 'amber',
  }],
  extensions: {},
})

const groupsOperation = (operationId: string): Record<string, unknown> => ({
  schemaVersion: 'sanverse.operation/v3',
  operationId,
  kind: 'set-timeline-groups',
  capabilityId: TIMELINE_GROUPS_PRIMITIVE_ID,
  groups: [{ groupId: 'group_aaaaaaaa', memberItemIds: ['clip:clip_one', 'music:music_two:0'] }],
  extensions: {},
})

const trackOutputOperation = (
  operationId: string,
  outputEnabled: boolean,
): Record<string, unknown> => ({
  schemaVersion: 'sanverse.operation/v3',
  operationId,
  kind: 'set-track-output',
  capabilityId: TRACK_OUTPUT_PRIMITIVE_ID,
  trackId: 'A1',
  outputEnabled,
  extensions: {},
})

describe('T1 — an export is identified by what it will produce', () => {
  it('gives the same project the same answer twice', () => {
    // If this ever wobbled, every export would be built twice.
    const project = testMultiAssetProject()
    expect(exportIdempotencyKey(project)).toBe(exportIdempotencyKey(project))
  })

  it('does NOT change when the user writes a marker', () => {
    const before = testMultiAssetProject()
    const after = accept(before, 'changeset_marker01', [markersOperation('operation_marker01')])
    // The revision definitely moved — this is a real, undoable edit.
    expect(after.revision).toBeGreaterThan(before.revision)
    // ...and the finished video is identical, so the finished export is kept.
    expect(exportIdempotencyKey(after)).toBe(exportIdempotencyKey(before))
  })

  it('does NOT change when the user groups two things together', () => {
    const before = testMultiAssetProject()
    const after = accept(before, 'changeset_group001', [groupsOperation('operation_group001')])
    expect(after.revision).toBeGreaterThan(before.revision)
    expect(exportIdempotencyKey(after)).toBe(exportIdempotencyKey(before))
  })

  it('does NOT change when a track is switched off and straight back on', () => {
    // Two real edits, two revisions, and a video identical to the one before
    // them. Under the old rule this threw away a finished export for nothing.
    const before = testMultiAssetProject()
    const off = accept(before, 'changeset_output001', [trackOutputOperation('operation_output01', false)])
    const backOn = accept(off, 'changeset_output002', [trackOutputOperation('operation_output02', true)])
    expect(backOn.revision).toBe(before.revision + 2)
    expect(exportIdempotencyKey(backOn)).toBe(exportIdempotencyKey(before))
  })

  it('DOES change when a track is switched off and left off', () => {
    // The safety check on the test above: the key is not simply ignoring
    // track-output operations.
    const before = testMultiAssetProject()
    const off = accept(before, 'changeset_output001', [trackOutputOperation('operation_output01', false)])
    expect(exportIdempotencyKey(off)).not.toBe(exportIdempotencyKey(before))
  })

  it('does NOT change when an EMPTY track is switched off', () => {
    /*
     * Found while writing the test above, and worth keeping.
     *
     * This project has nothing on A2, so muting A2 produces the identical video.
     * Under the old rule it made a new key and rebuilt the file for nothing.
     * Now it correctly shares the finished export — the key answers "what will
     * come out", and the answer genuinely has not changed.
     */
    const before = testMultiAssetProject()
    const off = accept(before, 'changeset_output003', [{
      ...trackOutputOperation('operation_output03', false),
      trackId: 'A2',
    }])
    expect(off.revision).toBeGreaterThan(before.revision)
    expect(exportIdempotencyKey(off)).toBe(exportIdempotencyKey(before))
  })

  it('DOES change when the video itself is cut', () => {
    const before = testMultiAssetProject()
    const after = accept(before, 'changeset_split001', [
      testSplit({ operationId: 'operation_split001' }) as never,
    ])
    expect(exportIdempotencyKey(after)).not.toBe(exportIdempotencyKey(before))
  })

  it('gives two different projects different answers even with identical edits', () => {
    // Otherwise one user could be handed another user's finished file.
    const a = testMultiAssetProject()
    const b = { ...a, projectId: 'project_bbbbbbbbbbbbbbbb' } as EditProject
    expect(exportIdempotencyKey(a)).not.toBe(exportIdempotencyKey(b))
  })

  it('DOES change when a piece is given a different speed', () => {
    // Speed reaches the finished video, so it must produce a new export. The
    // opposite failure — handing back the old file — would give the user a
    // video at the speed they had already rejected.
    const before = testMultiAssetProject()
    const clipId = before.composition.tracks.flatMap((track) => track.clips)[0].clipId
    const after = accept(before, 'changeset_speedkey1', [{
      schemaVersion: 'sanverse.operation/v3',
      operationId: 'operation_speedkey1',
      kind: 'set-clip-time-transform',
      capabilityId: CLIP_TIME_TRANSFORM_PRIMITIVE_ID,
      clipId,
      playbackRate: { numerator: 2, denominator: 1 },
      direction: 'forward',
      maintainAudioPitch: true,
      durationPolicy: 'ripple',
      extensions: {},
    }])
    expect(exportIdempotencyKey(after)).not.toBe(exportIdempotencyKey(before))
  })

  it('DOES change when only the pitch switch is flipped', () => {
    // Same speed, same length, same frames — but the sound is different, and a
    // user who turned the squeaky effect on must not be handed the old file.
    const before = testMultiAssetProject()
    const clipId = before.composition.tracks.flatMap((track) => track.clips)[0].clipId
    const keepPitch = accept(before, 'changeset_pitchkey1', [{
      schemaVersion: 'sanverse.operation/v3',
      operationId: 'operation_pitchkey1',
      kind: 'set-clip-time-transform',
      capabilityId: CLIP_TIME_TRANSFORM_PRIMITIVE_ID,
      clipId,
      playbackRate: { numerator: 2, denominator: 1 },
      direction: 'forward',
      maintainAudioPitch: true,
      durationPolicy: 'ripple',
      extensions: {},
    }])
    const squeaky = accept(keepPitch, 'changeset_pitchkey2', [{
      schemaVersion: 'sanverse.operation/v3',
      operationId: 'operation_pitchkey2',
      kind: 'set-clip-time-transform',
      capabilityId: CLIP_TIME_TRANSFORM_PRIMITIVE_ID,
      clipId,
      playbackRate: { numerator: 2, denominator: 1 },
      direction: 'forward',
      maintainAudioPitch: false,
      durationPolicy: 'ripple',
      extensions: {},
    }])
    expect(exportIdempotencyKey(squeaky)).not.toBe(exportIdempotencyKey(keepPitch))
  })

  it('does NOT change when a piece is put back to the speed it already had', () => {
    // A reset to normal on a piece that was never retimed produces the exact
    // plan it already had, so the finished export is still correct and is
    // handed straight back. Refused upstream as "nothing would change", but
    // proved here at the identity itself.
    const before = testMultiAssetProject()
    const clipId = before.composition.tracks.flatMap((track) => track.clips)[0].clipId
    const after = accept(before, 'changeset_resetkey1', [{
      schemaVersion: 'sanverse.operation/v3',
      operationId: 'operation_resetkey1',
      kind: 'set-clip-time-transform',
      capabilityId: CLIP_TIME_TRANSFORM_PRIMITIVE_ID,
      clipId,
      playbackRate: { numerator: 1, denominator: 1 },
      direction: 'forward',
      maintainAudioPitch: true,
      durationPolicy: 'ripple',
      extensions: {},
    }])
    expect(exportIdempotencyKey(after)).toBe(exportIdempotencyKey(before))
  })

  it('T4 changes export identity when a rendered keyframe value/time/easing changes', () => {
    const before = testMultiAssetProject()
    const clip = before.composition.tracks.flatMap((track) => track.clips).find((candidate) => candidate.segmentKind === 'video')!
    const baseMotion = {
      schemaVersion: 'sanverse.operation/v3',
      operationId: 'operation_t4motionkey1',
      kind: 'set-footage-motion',
      capabilityId: FOOTAGE_MOTION_CAPABILITY_ID,
      motionId: 'motion_t4export01',
      assetId: clip.assetId,
      sourceInterval: clip.sourceRange,
      transform: DEFAULT_VISUAL_PROPERTIES.transform,
      crop: DEFAULT_VISUAL_PROPERTIES.crop,
      tracks: [{
        property: 'scale',
        keyframes: [
          { at: mediaTime(0), value: 1, easing: { kind: 'linear' } },
          { at: clip.sourceRange.duration, value: 1.2, easing: { kind: 'linear' } },
        ],
      }],
      extensions: {},
    }
    const animated = accept(before, 'changeset_t4motionkey1', [baseMotion])
    const changedValue = accept(animated, 'changeset_t4motionkey2', [{
      ...baseMotion,
      operationId: 'operation_t4motionkey2',
      tracks: [{ ...baseMotion.tracks[0], keyframes: [baseMotion.tracks[0].keyframes[0], { ...baseMotion.tracks[0].keyframes[1], value: 1.4 }] }],
    }])
    const changedTime = accept(changedValue, 'changeset_t4motionkey3', [{
      ...baseMotion,
      operationId: 'operation_t4motionkey3',
      tracks: [{
        ...baseMotion.tracks[0],
        keyframes: [
          baseMotion.tracks[0].keyframes[0],
          { at: mediaTime(Math.max(1, clip.sourceRange.duration.ticks - 1)), value: 1.4, easing: { kind: 'linear' } },
        ],
      }],
    }])
    const changedEasing = accept(changedTime, 'changeset_t4motionkey4', [{
      ...baseMotion,
      operationId: 'operation_t4motionkey4',
      tracks: [{
        ...baseMotion.tracks[0],
        keyframes: [
          { ...baseMotion.tracks[0].keyframes[0], easing: { kind: 'cubic-bezier', x1: 0.42, y1: 0, x2: 0.58, y2: 1 } },
          { at: mediaTime(Math.max(1, clip.sourceRange.duration.ticks - 1)), value: 1.4, easing: { kind: 'linear' } },
        ],
      }],
    }])
    expect(exportIdempotencyKey(animated)).not.toBe(exportIdempotencyKey(before))
    expect(exportIdempotencyKey(changedValue)).not.toBe(exportIdempotencyKey(animated))
    expect(exportIdempotencyKey(changedTime)).not.toBe(exportIdempotencyKey(changedValue))
    expect(exportIdempotencyKey(changedEasing)).not.toBe(exportIdempotencyKey(changedTime))
  })

  it('still answers for a project that cannot be compiled', () => {
    // No plan to compare, so it falls back to the revision — the old behaviour.
    // The export is refused a moment later by the code that can say why.
    const broken = { ...testMultiAssetProject(), composition: { ...testMultiAssetProject().composition, tracks: [] } } as EditProject
    expect(typeof exportIdempotencyKey(broken)).toBe('string')
    expect(exportIdempotencyKey(broken)).toHaveLength(64)
  })
})
