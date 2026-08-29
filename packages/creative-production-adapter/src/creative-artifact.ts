import { validateMotionScene } from '@sanverse/motion-graph'
import {
  CREATIVE_SCENE_ARTIFACT_SCHEMA_V1,
  validateCreativeSceneArtifactV1,
  type CreativeArtifactResultV1,
  type CreativeSceneArtifactV1,
} from '@sanverse/render-contract/creative-scene-artifact'
import type { CreativeSceneWorkflowV1 } from './multi-scene-workflow.ts'

export {
  CREATIVE_SCENE_ARTIFACT_SCHEMA_V1,
  canonicalCreativeArtifactJsonV1,
  validateCreativeSceneArtifactV1,
  type CreativeArtifactResultV1,
  type CreativeSceneArtifactV1,
} from '@sanverse/render-contract/creative-scene-artifact'

export const buildCreativeSceneArtifactV1 = (workflow: CreativeSceneWorkflowV1): CreativeArtifactResultV1<CreativeSceneArtifactV1> => {
  const state = workflow.state()
  const motion = state.motionDraft
  if (!motion || motion.status !== 'owner-approved' || !motion.ownerApprovalId) return Object.freeze({ ok: false, refusal: Object.freeze({ code: 'MOTION_APPROVAL_REQUIRED', message: 'The exact current Motion revision must have host-recorded owner approval before an immutable production artifact can be created.' }) })
  if (!state.motionQa?.ok) return Object.freeze({ ok: false, refusal: Object.freeze({ code: 'MOTION_QA_REQUIRED', message: 'Current Motion structural QA must pass before artifact creation.' }) })
  if (!state.visualEvidence) return Object.freeze({ ok: false, refusal: Object.freeze({ code: 'VISUAL_EVIDENCE_REQUIRED', message: 'Canonical review evidence is required before artifact creation.' }) })
  if (!state.motionPlan) return Object.freeze({ ok: false, refusal: Object.freeze({ code: 'MOTION_PLAN_REQUIRED', message: 'The approved Motion draft has no Motion Plan lineage.' }) })
  const graph = validateMotionScene(motion.scene)
  if (!graph.ok) return Object.freeze({ ok: false, refusal: Object.freeze({ code: 'CREATIVE_ARTIFACT_INVALID', message: 'The approved Motion Scene no longer validates against the canonical Motion Graph contract.' }) })
  const planned = workflow.planned
  const candidate = workflow.candidate
  const selectedRanking = planned.capabilityRankings.find((item) => item.capabilityId === candidate.componentId) ?? planned.capabilityRankings[0]
  const artifact: CreativeSceneArtifactV1 = Object.freeze({
    schemaVersion: CREATIVE_SCENE_ARTIFACT_SCHEMA_V1,
    projectId: candidate.source.projectId,
    productionBaseRevision: candidate.source.projectRevision,
    sceneId: candidate.id,
    opportunityId: candidate.opportunityId,
    componentId: candidate.componentId,
    componentVersion: candidate.componentVersion,
    source: Object.freeze({
      assetId: candidate.source.assetId,
      sourceStartTick: candidate.source.sourceStartTicks,
      sourceEndTick: candidate.source.sourceEndTicks,
      durationTicks: candidate.source.durationTicks,
      width: candidate.renderContext.composition.width,
      height: candidate.renderContext.composition.height,
      fpsNumerator: candidate.renderContext.composition.fpsNumerator,
      fpsDenominator: candidate.renderContext.composition.fpsDenominator,
    }),
    presentation: Object.freeze({
      mode: planned.opportunity.recommendedPresentationMode,
      sourceTreatment: planned.opportunity.recommendedSourceTreatment,
      backgroundTreatment: planned.opportunity.recommendedBackgroundTreatment,
      preserveSourceAudio: planned.opportunity.preserveSourceAudio,
      preserveSourceVideo: planned.opportunity.preserveSourceVideo,
    }),
    component: Object.freeze({ props: candidate.props, style: candidate.style }),
    motion: Object.freeze({
      motionPlanId: state.motionPlan.id,
      motionDraftId: motion.id,
      motionDraftRevision: motion.revision,
      motionOwnerApprovalId: motion.ownerApprovalId,
      scene: graph.value,
      selectedNodeId: candidate.selectedNodeId,
      semanticNodeIds: Object.freeze([...candidate.semanticNodeIds]),
    }),
    governance: Object.freeze({
      styleLockId: workflow.styleLockId,
      creativeLanguageId: workflow.creativeLanguageId,
      cohesionScore: selectedRanking?.cohesionScore ?? 0,
      requiredCapabilities: Object.freeze([...planned.opportunity.requiredCapabilities]),
      structuralQaPassed: true as const,
      reviewEvidence: Object.freeze({ ...state.visualEvidence }),
    }),
  })
  return validateCreativeSceneArtifactV1(artifact)
}
