import { describe, expect, it } from 'vitest'
import { createMotionScene, nodeBase } from '@sanverse/motion-graph'
import { validateCreativeSceneArtifactV1, type CreativeSceneArtifactV1 } from './creative-scene-artifact.ts'

const fixture = (purpose: 'production' | 'review', approvalId: string | null): CreativeSceneArtifactV1 => {
  const root = Object.freeze({ ...nodeBase('creative.root', 'Root', null), type: 'group' as const, childIds: Object.freeze([]) })
  const scene = createMotionScene({
    componentId: 'sanverse.review-proof', componentVersion: 1, rootNodeId: root.id, nodes: Object.freeze({ [root.id]: root }),
    semanticParts: Object.freeze([{ id: 'root-part', label: 'Root', role: 'content-group' as const, nodeIds: Object.freeze([root.id]) }]),
    exposures: Object.freeze([]), layout: Object.freeze({ mode: 'responsive' as const, ownership: Object.freeze([]), formatOverrides: Object.freeze([]) }),
    supportedAspectRatios: Object.freeze(['16:9'] as const),
  })
  return Object.freeze({
    schemaVersion: 'sanverse.creative-scene-artifact/v1', projectId: 'project_1234567890abcdef', productionBaseRevision: 0,
    sceneId: 'creative_scene_review123', opportunityId: 'opportunity_review123', componentId: scene.componentId, componentVersion: scene.componentVersion,
    source: Object.freeze({ assetId: 'asset_1234567890ab', sourceStartTick: 0, sourceEndTick: 1_440_000, durationTicks: 1_440_000, width: 1920, height: 1080, fpsNumerator: 30, fpsDenominator: 1 }),
    presentation: Object.freeze({ mode: 'overlay' as const, sourceTreatment: 'normal', backgroundTreatment: 'source-video', preserveSourceAudio: true, preserveSourceVideo: true }),
    component: Object.freeze({ props: Object.freeze({ text: 'Review proof' }), style: Object.freeze({}) }),
    motion: Object.freeze({ motionPlanId: 'motion-plan:review', motionDraftId: 'motion-draft:review', motionDraftRevision: 1, motionOwnerApprovalId: approvalId, scene, selectedNodeId: root.id, semanticNodeIds: Object.freeze([root.id]) }),
    governance: Object.freeze({
      artifactPurpose: purpose, styleLockId: 'style-lock:review', creativeLanguageId: 'creative-language:review', cohesionScore: 1, requiredCapabilities: Object.freeze([]), structuralQaPassed: true as const,
      reviewEvidence: Object.freeze({ canonicalReviewRef: 'review-only://proof', posterRef: 'review-only://proof/poster', criticalFrameRefs: Object.freeze([]), kvsAnchorFrameRefs: Object.freeze([]), entrancePayoffExitFrameRefs: Object.freeze([]), sourceCompositeFrameRefs: Object.freeze([]) }),
    }),
  })
}

describe('Creative scene artifact purpose gates', () => {
  it('permits review-only artifacts without Motion approval but keeps production fail-closed', () => {
    expect(validateCreativeSceneArtifactV1(fixture('review', null))).toMatchObject({ ok: true })
    expect(validateCreativeSceneArtifactV1(fixture('production', null))).toMatchObject({ ok: false, refusal: { code: 'CREATIVE_ARTIFACT_INVALID', message: 'Production Creative artifacts require exact Motion owner-approval lineage.' } })
    expect(validateCreativeSceneArtifactV1(fixture('production', 'approval_review123'))).toMatchObject({ ok: true })
  })
})
