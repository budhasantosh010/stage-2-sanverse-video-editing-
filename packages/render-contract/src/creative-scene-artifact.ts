import { validateMotionScene, type MotionSceneV1 } from '@sanverse/motion-graph'
import type { MotionPresentationModeV1 } from '@sanverse/motion-contract'

export const CREATIVE_SCENE_ARTIFACT_SCHEMA_V1 = 'sanverse.creative-scene-artifact/v1' as const

export interface CreativeSceneArtifactV1 {
  readonly schemaVersion: typeof CREATIVE_SCENE_ARTIFACT_SCHEMA_V1
  readonly projectId: string
  readonly productionBaseRevision: number
  readonly sceneId: string
  readonly opportunityId: string
  readonly componentId: string
  readonly componentVersion: number
  readonly source: Readonly<{
    assetId: string
    sourceStartTick: number
    sourceEndTick: number
    durationTicks: number
    width: number
    height: number
    fpsNumerator: number
    fpsDenominator: number
  }>
  readonly presentation: Readonly<{
    mode: MotionPresentationModeV1
    sourceTreatment: string
    backgroundTreatment: string
    preserveSourceAudio: boolean
    preserveSourceVideo: boolean
  }>
  readonly component: Readonly<{ props: unknown; style: unknown }>
  readonly motion: Readonly<{
    motionPlanId: string
    motionDraftId: string
    motionDraftRevision: number
    motionOwnerApprovalId: string | null
    scene: MotionSceneV1
    selectedNodeId: string
    semanticNodeIds: readonly string[]
  }>
  readonly governance: Readonly<{
    artifactPurpose: 'production' | 'review'
    styleLockId: string
    styleLockContentHash: string
    creativeDirectionRevision: number
    creativeLanguageId: string
    cohesionScore: number
    requiredCapabilities: readonly string[]
    structuralQaPassed: true
    reviewEvidence: Readonly<{
      canonicalReviewRef: string
      posterRef: string
      criticalFrameRefs: readonly string[]
      kvsAnchorFrameRefs: readonly string[]
      entrancePayoffExitFrameRefs: readonly string[]
      sourceCompositeFrameRefs: readonly string[]
    }>
  }>
}

export type CreativeArtifactResultV1<T> =
  | Readonly<{ ok: true; value: T }>
  | Readonly<{ ok: false; refusal: Readonly<{ code: string; message: string }> }>

const isRecord = (value: unknown): value is Record<string, unknown> => Boolean(value) && typeof value === 'object' && !Array.isArray(value)
const bounded = (value: unknown, max = 4096): value is string => typeof value === 'string' && value.length > 0 && value.length <= max

const canonicalize = (value: unknown): unknown => {
  if (Array.isArray(value)) return value.map(canonicalize)
  if (!isRecord(value)) return value
  return Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonicalize(value[key])]))
}

export const canonicalCreativeArtifactJsonV1 = (artifact: CreativeSceneArtifactV1): string => JSON.stringify(canonicalize(artifact))

export const validateCreativeSceneArtifactV1 = (value: unknown): CreativeArtifactResultV1<CreativeSceneArtifactV1> => {
  if (!isRecord(value) || value.schemaVersion !== CREATIVE_SCENE_ARTIFACT_SCHEMA_V1) return Object.freeze({ ok: false, refusal: Object.freeze({ code: 'CREATIVE_ARTIFACT_INVALID', message: 'Creative artifact schemaVersion is invalid.' }) })
  const artifact = value as unknown as CreativeSceneArtifactV1
  if (!bounded(artifact.projectId, 96) || !/^project_[a-z0-9]{16,64}$/u.test(artifact.projectId) || !Number.isSafeInteger(artifact.productionBaseRevision) || artifact.productionBaseRevision < 0) return Object.freeze({ ok: false, refusal: Object.freeze({ code: 'CREATIVE_ARTIFACT_INVALID', message: 'Creative artifact project identity/revision is invalid.' }) })
  if (!bounded(artifact.sceneId, 96) || !/^creative_scene_[a-z0-9]{8,64}$/u.test(artifact.sceneId) || !bounded(artifact.opportunityId, 128) || !bounded(artifact.componentId, 240) || !Number.isSafeInteger(artifact.componentVersion) || artifact.componentVersion < 1) return Object.freeze({ ok: false, refusal: Object.freeze({ code: 'CREATIVE_ARTIFACT_INVALID', message: 'Creative artifact scene/component identity is invalid.' }) })
  if (!isRecord(artifact.source) || !bounded(artifact.source.assetId, 128) || !Number.isSafeInteger(artifact.source.sourceStartTick) || !Number.isSafeInteger(artifact.source.sourceEndTick) || artifact.source.sourceStartTick < 0 || artifact.source.sourceEndTick <= artifact.source.sourceStartTick || artifact.source.durationTicks !== artifact.source.sourceEndTick - artifact.source.sourceStartTick || !Number.isSafeInteger(artifact.source.width) || artifact.source.width <= 0 || !Number.isSafeInteger(artifact.source.height) || artifact.source.height <= 0 || !Number.isSafeInteger(artifact.source.fpsNumerator) || artifact.source.fpsNumerator <= 0 || !Number.isSafeInteger(artifact.source.fpsDenominator) || artifact.source.fpsDenominator <= 0) return Object.freeze({ ok: false, refusal: Object.freeze({ code: 'CREATIVE_ARTIFACT_INVALID', message: 'Creative artifact source range/dimensions are invalid.' }) })
  if (!isRecord(artifact.presentation) || !['overlay','split','picture-in-picture','full-screen-motion','tracked-attached','surface-embedded','subject-environment','bridge-takeover'].includes(artifact.presentation.mode) || typeof artifact.presentation.preserveSourceAudio !== 'boolean' || typeof artifact.presentation.preserveSourceVideo !== 'boolean' || !bounded(artifact.presentation.sourceTreatment, 128) || !bounded(artifact.presentation.backgroundTreatment, 128)) return Object.freeze({ ok: false, refusal: Object.freeze({ code: 'CREATIVE_ARTIFACT_INVALID', message: 'Creative artifact presentation contract is invalid.' }) })
  if (!isRecord(artifact.component) || !Object.hasOwn(artifact.component, 'props') || !Object.hasOwn(artifact.component, 'style')) return Object.freeze({ ok: false, refusal: Object.freeze({ code: 'CREATIVE_ARTIFACT_INVALID', message: 'Creative artifact component props/style are missing.' }) })
  if (!isRecord(artifact.motion) || !bounded(artifact.motion.motionPlanId, 240) || !bounded(artifact.motion.motionDraftId, 240) || !Number.isSafeInteger(artifact.motion.motionDraftRevision) || artifact.motion.motionDraftRevision < 1 || (artifact.motion.motionOwnerApprovalId !== null && !bounded(artifact.motion.motionOwnerApprovalId, 240)) || !bounded(artifact.motion.selectedNodeId, 240) || !Array.isArray(artifact.motion.semanticNodeIds)) return Object.freeze({ ok: false, refusal: Object.freeze({ code: 'CREATIVE_ARTIFACT_INVALID', message: 'Creative artifact Motion approval/identity is invalid.' }) })
  const scene = validateMotionScene(artifact.motion.scene)
  if (!scene.ok || !scene.value.nodes[artifact.motion.selectedNodeId] || artifact.motion.semanticNodeIds.some((id) => typeof id !== 'string' || !scene.value.nodes[id])) return Object.freeze({ ok: false, refusal: Object.freeze({ code: 'CREATIVE_ARTIFACT_INVALID', message: 'Creative artifact Motion Scene or semantic node references are invalid.' }) })
  if (!isRecord(artifact.governance) || (artifact.governance.artifactPurpose !== undefined && artifact.governance.artifactPurpose !== 'production' && artifact.governance.artifactPurpose !== 'review') || artifact.governance.structuralQaPassed !== true || !bounded(artifact.governance.styleLockId, 240) || typeof artifact.governance.styleLockContentHash !== 'string' || !/^[a-f0-9]{64}$/u.test(artifact.governance.styleLockContentHash) || !Number.isSafeInteger(artifact.governance.creativeDirectionRevision) || artifact.governance.creativeDirectionRevision < 1 || !bounded(artifact.governance.creativeLanguageId, 240) || typeof artifact.governance.cohesionScore !== 'number' || !Number.isFinite(artifact.governance.cohesionScore) || !Array.isArray(artifact.governance.requiredCapabilities) || artifact.governance.requiredCapabilities.some((item) => !bounded(item, 240)) || !isRecord(artifact.governance.reviewEvidence) || !bounded(artifact.governance.reviewEvidence.canonicalReviewRef, 2048)) return Object.freeze({ ok: false, refusal: Object.freeze({ code: 'CREATIVE_ARTIFACT_INVALID', message: 'Creative artifact governance/review evidence is invalid.' }) })
  const artifactPurpose = artifact.governance.artifactPurpose ?? 'production'
  if (artifactPurpose === 'production' && !bounded(artifact.motion.motionOwnerApprovalId, 240)) return Object.freeze({ ok: false, refusal: Object.freeze({ code: 'CREATIVE_ARTIFACT_INVALID', message: 'Production Creative artifacts require exact Motion owner-approval lineage.' }) })
  const canonical = canonicalCreativeArtifactJsonV1(artifact)
  if (new TextEncoder().encode(canonical).byteLength > 2 * 1024 * 1024) return Object.freeze({ ok: false, refusal: Object.freeze({ code: 'CREATIVE_ARTIFACT_INVALID', message: 'Creative artifact exceeds the bounded 2 MiB contract.' }) })
  return Object.freeze({ ok: true as const, value: Object.freeze({ ...artifact, motion: Object.freeze({ ...artifact.motion, scene: scene.value }) }) })
}
