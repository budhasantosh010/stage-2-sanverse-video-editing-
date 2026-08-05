import { describe, expect, it } from 'vitest'

import {
  TIMELINE_GROUPS_PRIMITIVE_ID,
  TIMELINE_MARKERS_PRIMITIVE_ID,
  TRACK_OUTPUT_PRIMITIVE_ID,
} from '@sanverse/edit-domain/capabilities'
import { acceptChangeSet, type EditProject } from '@sanverse/edit-domain'
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

  it('still answers for a project that cannot be compiled', () => {
    // No plan to compare, so it falls back to the revision — the old behaviour.
    // The export is refused a moment later by the code that can say why.
    const broken = { ...testMultiAssetProject(), composition: { ...testMultiAssetProject().composition, tracks: [] } } as EditProject
    expect(typeof exportIdempotencyKey(broken)).toBe('string')
    expect(exportIdempotencyKey(broken)).toHaveLength(64)
  })
})
