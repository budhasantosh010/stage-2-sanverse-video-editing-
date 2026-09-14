import { describe, expect, it } from 'vitest'
import { acceptChangeSet, activeTimelineTrackState } from '@sanverse/edit-domain'
import { changeSetOf, testProject, TEST_CLIP_ID } from '../../edit-domain/src/test-fixtures.ts'
import { compileProjectToRenderPlan } from './compile-project.ts'
import { pictureNodesAt } from './picture-layers.ts'

describe('extracted audio render authority', () => {
  it('renders one independent audio source without a second picture or duplicate linked sound', () => {
    const project = testProject()
    const result = acceptChangeSet(project, changeSetOf('changeset_extract01', project.revision, [{
      schemaVersion: 'sanverse.operation/v3', operationId: 'operation_extract01',
      capabilityId: 'sanverse.timeline.extract-audio.primitive/v1', kind: 'extract-clip-audio',
      clipId: TEST_CLIP_ID, newClipId: 'clip_extracted01',
      trackId: activeTimelineTrackState(project).tracks.find(track => track.role === 'music')!.trackId,
      extensions: {},
    }]))
    if (!result.ok) throw new Error(JSON.stringify(result.error))
    const compiled = compileProjectToRenderPlan(result.value)
    expect(compiled.ok).toBe(true)
    if (!compiled.ok) throw new Error(JSON.stringify(compiled.error))
    const plan = compiled.value
    expect(plan.segments.filter(segment => segment.audioEnabled).map(segment => segment.nodeId)).toEqual(['clip_extracted01'])
    expect(pictureNodesAt(plan, 1440000).map(node => node.nodeId)).toEqual([TEST_CLIP_ID])
    expect(plan.sources).toHaveLength(1)
    expect(plan.sources[0].mediaKind).toBe('video')
  })
})
