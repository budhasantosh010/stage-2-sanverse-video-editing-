import { describe, expect, it } from 'vitest'
import { createMotionScene } from '@sanverse/motion-graph'
import { nodeBase } from '@sanverse/motion-graph'
import { createStoryboardV1, validateOwnerApprovalV1, validateStoryboardV1 } from './contracts.ts'

const graphState = createMotionScene({
  componentId: 'sanverse.storyboard-proof', componentVersion: 1, rootNodeId: 'hero.root', supportedAspectRatios: ['16:9'], semanticParts: Object.freeze([]), exposures: Object.freeze([]),
  layout: Object.freeze({ mode: 'responsive' as const, ownership: Object.freeze([]), formatOverrides: Object.freeze([]) }),
  nodes: Object.freeze({ 'hero.root': Object.freeze({ ...nodeBase('hero.root','Root',null), type: 'group' as const, childIds: Object.freeze([]) }) }),
})

const storyboard = createStoryboardV1({
  id: 'storyboard:proof', sourceRevision: 1,
  setup: { schemaVersion: 'sanverse.storyboard-presentation-setup/v1', sourceRegion: { startTick: 0, endTick: 1_440_000 }, communicationGoal: 'Explain one fact', presentationMode: 'overlay', sourceTreatment: 'normal', backgroundTreatment: 'source-video', preserveSourceAudio: true, preserveSourceVideo: true, requiredCapabilities: Object.freeze([]) },
  states: Object.freeze([{ schemaVersion: 'sanverse.key-visual-state/v1', id: 'state:opening', semanticPurpose: 'opening', approximateTick: 0, presentationMode: 'overlay', sourceTreatment: 'normal', backgroundTreatment: 'source-video', focusNodeIds: Object.freeze(['hero.root']), graphState }]),
  status: 'draft', revision: 1,
})

describe('A3 storyboard contracts', () => {
  it('uses canonical MotionSceneV1 graph snapshots and preserves semantic IDs', () => {
    expect(validateStoryboardV1(storyboard)).toMatchObject({ ok: true })
    expect(storyboard.states[0]?.graphState.nodes['hero.root']?.id).toBe('hero.root')
  })
  it('requires owner approval to target an exact subject revision and accepts every supported owner scope', () => {
    for (const scope of ['creative-direction','storyboard','animatic','motion'] as const) {
      expect(validateOwnerApprovalV1({ schemaVersion: 'sanverse.owner-approval/v1', id: `approval:${scope}`, scope, subjectId: storyboard.id, subjectRevision: 1, status: 'owner-approved', approvedAt: '2026-08-26T00:00:00.000Z' })).toMatchObject({ ok: true })
    }
    expect(validateOwnerApprovalV1({ schemaVersion: 'sanverse.owner-approval/v1', id: 'approval:1', scope: 'storyboard', subjectId: storyboard.id, subjectRevision: 0, status: 'owner-approved', approvedAt: '2026-08-26T00:00:00.000Z' })).toMatchObject({ ok: false })
    expect(validateOwnerApprovalV1({ schemaVersion: 'sanverse.owner-approval/v1', id: 'approval:1', scope: 'unknown', subjectId: storyboard.id, subjectRevision: 1, status: 'owner-approved', approvedAt: '2026-08-26T00:00:00.000Z' })).toMatchObject({ ok: false })
  })
})
