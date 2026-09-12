import { describe, expect, it } from 'vitest'
import { acceptChangeSet, activeTimelineTrackState, type EditProject } from '@sanverse/edit-domain'
import { MOVE_PRIMARY_CLIP_PRIMITIVE_ID, TRACK_OUTPUT_PRIMITIVE_ID } from '@sanverse/edit-domain/capabilities'
import { changeSetOf, ms, TEST_CLIP_ID, testMultiAssetProject, testTitle, testOperation, testMediaOverlay } from '@sanverse/edit-domain/test-fixtures'
import { compileProjectToRenderPlan } from '@sanverse/render-contract/compile-project'
import { resolvePrimarySource } from './primary-source'

const accept = (project: EditProject, id: string, operations: unknown[]) => {
  const result = acceptChangeSet(project, changeSetOf(id, project.revision, operations as never))
  if (!result.ok) throw new Error(JSON.stringify(result.error))
  return result.value
}
const fixture = () => {
  const original = testMultiAssetProject()
  const state = activeTimelineTrackState(original)
  const destination = state.tracks.find(t => t.role === 'overlay-video')!.trackId
  const primary = state.tracks.find(t => t.role === 'primary-video')!.trackId
  const moved = accept(original, 'changeset_transferpreview', [{
    schemaVersion: 'sanverse.operation/v3', operationId: 'operation_transferpreview',
    kind: 'move-primary-clip', capabilityId: MOVE_PRIMARY_CLIP_PRIMITIVE_ID,
    clipId: TEST_CLIP_ID, compositionStart: ms(0), destinationTrackId: destination, extensions: {},
  }])
  return { original, moved, destination, primary }
}
const output = (project: EditProject, trackId: string) => accept(project, 'changeset_transferoutput', [{
  schemaVersion: 'sanverse.operation/v3', operationId: 'operation_transferoutput',
  kind: 'set-track-output', capabilityId: TRACK_OUTPUT_PRIMITIVE_ID, trackId, outputEnabled: false, extensions: {},
}])
const compile = (project: EditProject) => {
  const result = compileProjectToRenderPlan(project)
  if (!result.ok) throw new Error(JSON.stringify(result.error))
  return result.value
}

describe('transferred primary preview/export agreement', () => {
  it('uses the layered contract automatically for transferred footage in both renderers', () => {
    const { original, moved } = fixture()
    expect(compile(original).schemaVersion).toBe('sanverse.render-plan/v9')
    expect(compile(moved).schemaVersion).toBe('sanverse.render-plan/v10')
    expect(compile(moved).pictureLayers?.flatMap(layer => layer.nodeIds)).toContain(TEST_CLIP_ID)
  })
  it.each([['title', testTitle()], ['nameplate', testOperation()], ['B-roll', testMediaOverlay()]] as const)('preserves rendered %s above same-track transferred footage', (_name, operation) => {
    const { original, moved } = fixture()
    const before = accept(original, 'changeset_visualparity', [operation])
    const after = accept(moved, 'changeset_visualparity', [operation])
    expect(compile(after).segments).toEqual(compile(before).segments)
    expect(compile(after).overlays).toEqual(compile(before).overlays)
    expect(compile(after).overlays.length).toBeGreaterThan(0)
  })
  it('preserves compiled source, timing, motion and linked audio after a vertical-only transfer', () => {
    const { original, moved } = fixture()
    expect(compile(moved).segments).toEqual(compile(original).segments)
    expect(compile(moved).durationTicks).toBe(compile(original).durationTicks)
    expect(resolvePrimarySource(moved, ms(1_000).ticks)).toEqual(resolvePrimarySource(original, ms(1_000).ticks))
  })
  it('does not hide transferred footage when the now-empty V1 output is disabled', () => {
    const { moved, primary } = fixture()
    const hidden = output(moved, primary)
    expect(compile(hidden).segments[0].videoEnabled).toBe(true)
    expect(resolvePrimarySource(hidden, ms(1_000).ticks).kind).toBe('active')
  })
  it('hides transferred footage when its actual destination output is disabled, retaining linked audio', () => {
    const { moved, destination } = fixture()
    const hidden = output(moved, destination)
    expect(compile(hidden).segments[0]).toMatchObject({ videoEnabled: false, audioEnabled: true })
    expect(resolvePrimarySource(hidden, ms(1_000).ticks).kind).toBe('gap')
  })
})
