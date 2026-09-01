import {
  buildVideoCreativeLanguageDraftV1,
  type ApprovedStyleLockV1,
  type BrandContextV1,
  type CreativeDirectionProposalV1,
} from '@sanverse/creative-direction'
import type { MotionOpportunityMapV1 } from './opportunity-planner.ts'
import type { PersistedCreativeSceneBatchV1 } from './multi-scene-workflow.ts'
import type { SourceTranscriptV1, SourceUnderstandingPacketV1 } from './external-orchestration.ts'

export const LEGACY_CREATIVE_RUN_SCHEMA_V1 = 'sanverse.creative-run/v1' as const
export const CREATIVE_RUN_SCHEMA_V2 = 'sanverse.creative-run/v2' as const
/** Compatibility export used by the orchestration layer while the package moves to V2. */
export const CREATIVE_RUN_SCHEMA_V1 = CREATIVE_RUN_SCHEMA_V2
export const CREATIVE_REVIEW_SCHEMA_V1 = 'sanverse.creative-review/v1' as const

export type CreativeRunStageV2 =
  | 'source-analysis'
  | 'creative-direction'
  | 'creative-direction-review'
  | 'opportunity-planning'
  | 'storyboard'
  | 'storyboard-review'
  | 'animatic'
  | 'animatic-review'
  | 'motion'
  | 'motion-review'
  | 'ready-for-apply'
  | 'applied'
  | 'exporting'
  | 'complete'
  | 'cancelled'
export type CreativeRunStageV1 = CreativeRunStageV2

export type CreativeReviewScopeV1 = 'creative-direction' | 'storyboard' | 'animatic' | 'motion'
export type CreativeReviewStatusV1 = 'pending' | 'approved' | 'revision-requested' | 'rejected'

export interface CreativeReviewArtifactV1 {
  readonly artifactId: string
  readonly kind: 'image' | 'video' | 'contact-sheet'
  readonly label: string
  readonly mimeType: 'image/png' | 'image/jpeg' | 'image/webp' | 'video/mp4'
  readonly byteLength: number
  readonly sha256: string
  readonly resourceUri?: string
  readonly safeUrl?: string
}

export interface SceneReviewContextV1 {
  readonly kind?: 'scene'
  readonly sceneId: string
  readonly communicationGoal: string
  readonly componentId: string
  readonly componentVersion: number
  readonly storyboardRevision?: number
  readonly sandboxRevision?: number
  readonly sourceStartTick: number
  readonly sourceEndTick: number
  readonly states: readonly Readonly<{
    stateId: string
    semanticPurpose: string
    localTick: number
    sourceFrameTick: number
    presentationMode: string
    sourceTreatment: string
    backgroundTreatment: string
    focusChanged: boolean
    presentationModeChanged: boolean
    sourceTreatmentChanged: boolean
    backgroundTreatmentChanged: boolean
    addedNodeIds: readonly string[]
    removedNodeIds: readonly string[]
    changedNodes: readonly Readonly<{ nodeId: string; changedProperties: readonly string[]; changes?: readonly Readonly<{ property: string; from: string; to: string }>[] }>[]
  }>[]
  readonly qaFindings: readonly Readonly<{ code: string; severity: string; message: string }>[]
  readonly recentTransactions: readonly Readonly<{ transactionId: string; operationTypes: readonly string[] }>[]
}

export interface CreativeDirectionReviewContextV1 {
  readonly kind: 'creative-direction'
  readonly proposalId: string
  readonly revision: number
  readonly sourcePacketId: string
  readonly brandContextId?: string
  readonly paletteRoles: Readonly<{ background: string; surface: string; text: string; accent: string }>
  readonly typography: Readonly<{ typeFamily?: string; language: string }>
  readonly surface: Readonly<{ radius: number; stroke: number; shadow: number; depth: number; texture: string }>
  readonly composition: Readonly<{ density: string; alignment: string; safeArea: number; negativeSpacePreference: string; subjectPriority: string }>
  readonly motion: Readonly<{ rhythm: string; primaryEase: string; secondaryEase: string; overshootMax: number; travelDistance: number; staggerRhythm: number; holdDiscipline: string; cameraAggressiveness: number; effectIntensity: number }>
  readonly creativeLanguage: Readonly<{ preferredPresentationModes: readonly string[]; transitionVocabulary: readonly string[]; surfaceLanguage: string; cameraPolicy: string }>
  readonly reasons: readonly string[]
}

export type CreativeReviewContextV1 = SceneReviewContextV1 | CreativeDirectionReviewContextV1

export interface CreativeReviewV1 {
  readonly schemaVersion: typeof CREATIVE_REVIEW_SCHEMA_V1
  readonly reviewId: string
  readonly runId: string
  readonly sceneId?: string
  readonly scope: CreativeReviewScopeV1
  readonly requestRef: string
  readonly subjectId: string
  readonly subjectRevision: number
  readonly evidenceHash: string
  readonly status: CreativeReviewStatusV1
  readonly revisionNote?: string
  readonly approvalRef?: string
  readonly context?: CreativeReviewContextV1
  readonly artifacts: readonly CreativeReviewArtifactV1[]
  readonly createdAt: string
  readonly updatedAt: string
}

export interface CreativeRunV2 {
  readonly schemaVersion: typeof CREATIVE_RUN_SCHEMA_V2
  readonly runId: string
  readonly projectId: string
  readonly baseProjectRevision: number
  readonly sourceAssetId: string
  readonly stage: CreativeRunStageV2
  readonly createdAt: string
  readonly updatedAt: string
  readonly transcript?: SourceTranscriptV1
  readonly sourceUnderstanding?: SourceUnderstandingPacketV1
  readonly brandContext?: BrandContextV1
  readonly creativeDirectionProposal?: CreativeDirectionProposalV1
  readonly approvedStyleLock?: ApprovedStyleLockV1
  readonly opportunityMap?: MotionOpportunityMapV1
  readonly sceneBatch?: PersistedCreativeSceneBatchV1
  readonly sceneIds: readonly string[]
  readonly reviews: readonly CreativeReviewV1[]
  readonly appliedChangeSetId?: string
  readonly exportJobId?: string
  readonly extensions: Readonly<Record<string, unknown>>
}
/** Compatibility type name for existing adapter imports. */
export type CreativeRunV1 = CreativeRunV2

export interface CreativeRunSummaryV1 {
  readonly runId: string
  readonly projectId: string
  readonly stage: CreativeRunStageV2
  readonly sceneCount: number
  readonly pendingReviewCount: number
  readonly updatedAt: string
}

export type CreativeRunValidationResultV1 =
  | Readonly<{ ok: true; value: CreativeRunV2 }>
  | Readonly<{ ok: false; code: 'CREATIVE_RUN_REHYDRATION_FAILED'; message: string }>

const record = (value: unknown): value is Record<string, unknown> => Boolean(value) && typeof value === 'object' && !Array.isArray(value)
const bounded = (value: unknown, max = 4096): value is string => typeof value === 'string' && value.trim().length > 0 && value.length <= max
const runIdPattern = /^run_[a-z0-9]{8,64}$/u
const projectIdPattern = /^project_[a-z0-9]{16,64}$/u
const reviewIdPattern = /^review_[a-z0-9]{8,64}$/u
const sceneIdPattern = /^creative_scene_[a-z0-9]{8,64}$/u
const stages = new Set<CreativeRunStageV2>(['source-analysis','creative-direction','creative-direction-review','opportunity-planning','storyboard','storyboard-review','animatic','animatic-review','motion','motion-review','ready-for-apply','applied','exporting','complete','cancelled'])
const scopes = new Set<CreativeReviewScopeV1>(['creative-direction','storyboard','animatic','motion'])
const statuses = new Set<CreativeReviewStatusV1>(['pending','approved','revision-requested','rejected'])

export const summarizeCreativeRunV1 = (run: CreativeRunV2): CreativeRunSummaryV1 => Object.freeze({
  runId: run.runId,
  projectId: run.projectId,
  stage: run.stage,
  sceneCount: run.sceneIds.length,
  pendingReviewCount: run.reviews.filter((review) => review.status === 'pending' || review.status === 'revision-requested').length,
  updatedAt: run.updatedAt,
})

const draftFromLegacyMap = (map: any): CreativeDirectionProposalV1 | undefined => {
  if (!record(map) || !record(map.styleRecommendation)) return undefined
  const language = record(map.creativeLanguage) ? map.creativeLanguage : undefined
  const draft = language
    ? Object.freeze({
        schemaVersion: 'sanverse.video-creative-language-draft/v1' as const,
        preferredPresentationModes: Object.freeze(Array.isArray(language.preferredPresentationModes) ? [...language.preferredPresentationModes] : ['overlay','full-screen-motion','picture-in-picture']),
        typographyLanguage: ['editorial','interface','expressive'].includes(String(language.typographyLanguage)) ? language.typographyLanguage : 'editorial',
        surfaceLanguage: ['flat','soft-depth','high-depth'].includes(String(language.surfaceLanguage)) ? language.surfaceLanguage : 'soft-depth',
        motionRhythm: ['calm','balanced','energetic'].includes(String(language.motionRhythm)) ? language.motionRhythm : 'balanced',
        transitionVocabulary: Object.freeze(Array.isArray(language.transitionVocabulary) ? [...language.transitionVocabulary] : ['cut','fade','scale']),
        densityPolicy: ['low','medium','high'].includes(String(language.densityPolicy)) ? language.densityPolicy : 'medium',
        cameraPolicy: ['static','restrained','expressive'].includes(String(language.cameraPolicy)) ? language.cameraPolicy : 'restrained',
        paletteRoles: Object.freeze(Array.isArray(language.paletteRoles) ? [...language.paletteRoles] : ['background','surface','text','accent']),
        easingFamily: Object.freeze(Array.isArray(language.easingFamily) ? [...language.easingFamily] : ['soft']),
        overshootMax: typeof language.overshootMax === 'number' ? language.overshootMax : 0.12,
        allowedExceptions: Object.freeze(Array.isArray(language.allowedExceptions) ? [...language.allowedExceptions] : []),
      }) as CreativeDirectionProposalV1['creativeLanguageDraft']
    : buildVideoCreativeLanguageDraftV1(map.styleRecommendation as never)
  return Object.freeze({
    schemaVersion: 'sanverse.creative-direction-proposal/v1',
    proposalId: `direction_${String(map.id ?? 'legacy').replace(/[^a-z0-9]/giu, '').toLowerCase().slice(-24).padStart(8, '0')}`,
    projectId: String(map.projectId ?? ''),
    projectRevision: Number(map.projectRevision ?? 0),
    sourcePacketId: String(map.sourcePacketId ?? ''),
    revision: 1,
    status: 'awaiting-owner',
    styleRecommendation: map.styleRecommendation as unknown as CreativeDirectionProposalV1['styleRecommendation'],
    creativeLanguageDraft: draft,
    reasons: Object.freeze(Array.isArray((map.styleRecommendation as any).reasons) ? [...(map.styleRecommendation as any).reasons] : ['Migrated from a legacy automatically generated style recommendation; owner certification is required.']),
  })
}

export const migrateCreativeRunV1ToV2 = (value: unknown): CreativeRunV2 | null => {
  if (!record(value) || value.schemaVersion !== LEGACY_CREATIVE_RUN_SCHEMA_V1) return null
  const legacy = value as any
  const proposal = draftFromLegacyMap(legacy.opportunityMap)
  const hasDownstream = Boolean(legacy.opportunityMap) || Boolean(legacy.sceneBatch) || Array.isArray(legacy.sceneIds) && legacy.sceneIds.length > 0 || Array.isArray(legacy.reviews) && legacy.reviews.length > 0
  const legacyPreDirectionState = hasDownstream ? Object.freeze({
    ...(legacy.opportunityMap ? { opportunityMap: legacy.opportunityMap } : {}),
    ...(legacy.sceneBatch ? { sceneBatch: legacy.sceneBatch } : {}),
    sceneIds: Object.freeze(Array.isArray(legacy.sceneIds) ? [...legacy.sceneIds] : []),
    reviews: Object.freeze(Array.isArray(legacy.reviews) ? [...legacy.reviews] : []),
  }) : undefined
  const { opportunityMap: _legacyOpportunityMap, sceneBatch: _legacySceneBatch, sceneIds: _legacySceneIds, reviews: _legacyReviews, ...base } = legacy
  void _legacyOpportunityMap; void _legacySceneBatch; void _legacySceneIds; void _legacyReviews
  return Object.freeze({
    ...base,
    schemaVersion: CREATIVE_RUN_SCHEMA_V2,
    stage: proposal ? 'creative-direction-review' : legacy.sourceUnderstanding ? 'creative-direction' : 'source-analysis',
    ...(proposal ? { creativeDirectionProposal: proposal } : {}),
    approvedStyleLock: undefined,
    opportunityMap: undefined,
    sceneBatch: undefined,
    sceneIds: Object.freeze([]),
    reviews: Object.freeze([]),
    extensions: Object.freeze({ ...(record(legacy.extensions) ? legacy.extensions : {}), migratedFromCreativeRunV1: true, ...(hasDownstream ? { creativeDirectionCertificationRequired: true, legacyPreDirectionState } : {}) }),
  }) as CreativeRunV2
}

export const validateCreativeRunV1 = (input: unknown): CreativeRunValidationResultV1 => {
  const value = record(input) && input.schemaVersion === LEGACY_CREATIVE_RUN_SCHEMA_V1 ? migrateCreativeRunV1ToV2(input) : input
  if (!record(value) || value.schemaVersion !== CREATIVE_RUN_SCHEMA_V2) return Object.freeze({ ok: false, code: 'CREATIVE_RUN_REHYDRATION_FAILED', message: 'Creative Run schemaVersion is invalid.' })
  const run = value as unknown as CreativeRunV2
  if (!runIdPattern.test(run.runId ?? '') || !projectIdPattern.test(run.projectId ?? '') || !Number.isSafeInteger(run.baseProjectRevision) || run.baseProjectRevision < 0 || !bounded(run.sourceAssetId, 128) || !stages.has(run.stage)) return Object.freeze({ ok: false, code: 'CREATIVE_RUN_REHYDRATION_FAILED', message: 'Creative Run identity, project revision, source, or stage is invalid.' })
  if (!bounded(run.createdAt, 64) || !bounded(run.updatedAt, 64) || !Array.isArray(run.sceneIds) || run.sceneIds.some((id) => !sceneIdPattern.test(id)) || new Set(run.sceneIds).size !== run.sceneIds.length) return Object.freeze({ ok: false, code: 'CREATIVE_RUN_REHYDRATION_FAILED', message: 'Creative Run timestamps or scene identity list is invalid.' })
  if (!Array.isArray(run.reviews) || !record(run.extensions)) return Object.freeze({ ok: false, code: 'CREATIVE_RUN_REHYDRATION_FAILED', message: 'Creative Run review/extensions shape is invalid.' })
  for (const rawReview of run.reviews) {
    if (!record(rawReview)) return Object.freeze({ ok: false, code: 'CREATIVE_RUN_REHYDRATION_FAILED', message: 'Creative Run contains an invalid review record.' })
    const review = rawReview as unknown as CreativeReviewV1
    const directionReview = review.scope === 'creative-direction'
    if (review.schemaVersion !== CREATIVE_REVIEW_SCHEMA_V1 || !reviewIdPattern.test(String(review.reviewId ?? '')) || review.runId !== run.runId || (!directionReview && !sceneIdPattern.test(String(review.sceneId ?? ''))) || !scopes.has(review.scope) || !bounded(review.subjectId, 240) || !Number.isSafeInteger(review.subjectRevision) || review.subjectRevision < 1 || !/^[a-f0-9]{64}$/u.test(String(review.evidenceHash ?? '')) || !statuses.has(review.status) || !Array.isArray(review.artifacts)) return Object.freeze({ ok: false, code: 'CREATIVE_RUN_REHYDRATION_FAILED', message: 'Creative Run contains an invalid review record.' })
    if (review.approvalRef !== undefined && !/^approvalref_[a-z0-9:_-]{8,180}$/u.test(review.approvalRef)) return Object.freeze({ ok: false, code: 'CREATIVE_RUN_REHYDRATION_FAILED', message: 'Creative Run contains an invalid approval reference.' })
    if (review.context !== undefined) {
      if (!record(review.context)) return Object.freeze({ ok: false, code: 'CREATIVE_RUN_REHYDRATION_FAILED', message: 'Creative Run contains invalid review context.' })
      if (directionReview) {
        const context = review.context as CreativeDirectionReviewContextV1
        if (context.kind !== 'creative-direction' || context.proposalId !== review.subjectId || context.revision !== review.subjectRevision || !bounded(context.sourcePacketId, 128) || !Array.isArray(context.reasons)) return Object.freeze({ ok: false, code: 'CREATIVE_RUN_REHYDRATION_FAILED', message: 'Creative Direction review context is invalid.' })
      } else {
        const context = review.context as SceneReviewContextV1
        if (context.sceneId !== review.sceneId || !bounded(context.communicationGoal, 1000) || !bounded(context.componentId, 180) || !Number.isSafeInteger(context.componentVersion) || context.componentVersion < 1 || !Number.isSafeInteger(context.sourceStartTick) || !Number.isSafeInteger(context.sourceEndTick) || context.sourceStartTick < 0 || context.sourceEndTick < context.sourceStartTick || !Array.isArray(context.states) || !Array.isArray(context.qaFindings) || !Array.isArray(context.recentTransactions)) return Object.freeze({ ok: false, code: 'CREATIVE_RUN_REHYDRATION_FAILED', message: 'Creative Run contains invalid scene review context.' })
      }
      if (new TextEncoder().encode(JSON.stringify(review.context)).byteLength > 256 * 1024) return Object.freeze({ ok: false, code: 'CREATIVE_RUN_REHYDRATION_FAILED', message: 'Creative review context exceeds its bounded persistence contract.' })
    }
    for (const rawArtifact of review.artifacts) {
      if (!record(rawArtifact)) return Object.freeze({ ok: false, code: 'CREATIVE_RUN_REHYDRATION_FAILED', message: 'Creative Run contains invalid review artifact metadata.' })
      const artifact = rawArtifact as unknown as CreativeReviewArtifactV1
      if (!bounded(artifact.artifactId, 180) || !bounded(artifact.label, 160) || !['image/png','image/jpeg','image/webp','video/mp4'].includes(artifact.mimeType) || !Number.isSafeInteger(artifact.byteLength) || artifact.byteLength < 0 || !/^[a-f0-9]{64}$/u.test(String(artifact.sha256 ?? ''))) return Object.freeze({ ok: false, code: 'CREATIVE_RUN_REHYDRATION_FAILED', message: 'Creative Run contains invalid review artifact metadata.' })
    }
  }
  const encoded = new TextEncoder().encode(JSON.stringify(run))
  if (encoded.byteLength > 16 * 1024 * 1024) return Object.freeze({ ok: false, code: 'CREATIVE_RUN_REHYDRATION_FAILED', message: 'Creative Run exceeds the bounded 16 MiB persistence contract.' })
  if (run.sceneBatch && (run.sceneBatch.projectId !== run.projectId || run.sceneBatch.projectRevision !== run.baseProjectRevision || run.sceneBatch.workflows.some((workflow) => !run.sceneIds.includes(workflow.sceneId)))) return Object.freeze({ ok: false, code: 'CREATIVE_RUN_REHYDRATION_FAILED', message: 'Creative Run scene batch does not match the persisted run/project identity.' })
  if (run.transcript && (run.transcript.projectId !== run.projectId || run.transcript.sourceAssetId !== run.sourceAssetId)) return Object.freeze({ ok: false, code: 'CREATIVE_RUN_REHYDRATION_FAILED', message: 'Creative Run transcript belongs to another project/source.' })
  if (run.sourceUnderstanding && (run.sourceUnderstanding.projectId !== run.projectId || run.sourceUnderstanding.sourceAssetId !== run.sourceAssetId)) return Object.freeze({ ok: false, code: 'CREATIVE_RUN_REHYDRATION_FAILED', message: 'Creative Run source understanding belongs to another project/source.' })
  if (run.brandContext && (run.brandContext.projectId !== run.projectId || run.brandContext.sourceAssetId !== run.sourceAssetId)) return Object.freeze({ ok: false, code: 'CREATIVE_RUN_REHYDRATION_FAILED', message: 'Creative Run Brand Context belongs to another project/source.' })
  if (run.creativeDirectionProposal && (run.creativeDirectionProposal.projectId !== run.projectId || run.creativeDirectionProposal.projectRevision !== run.baseProjectRevision || run.creativeDirectionProposal.sourcePacketId !== run.sourceUnderstanding?.id)) return Object.freeze({ ok: false, code: 'CREATIVE_RUN_REHYDRATION_FAILED', message: 'Creative Direction proposal belongs to another project/source packet.' })
  if (run.approvedStyleLock && (run.approvedStyleLock.projectId !== run.projectId || run.approvedStyleLock.sourcePacketId !== run.sourceUnderstanding?.id || run.approvedStyleLock.proposalId !== run.creativeDirectionProposal?.proposalId || run.approvedStyleLock.proposalRevision !== run.creativeDirectionProposal?.revision)) return Object.freeze({ ok: false, code: 'CREATIVE_RUN_REHYDRATION_FAILED', message: 'Approved Style Lock does not match the current Creative Direction authority.' })
  if (run.opportunityMap && (run.opportunityMap.projectId !== run.projectId || run.opportunityMap.projectRevision !== run.baseProjectRevision)) return Object.freeze({ ok: false, code: 'CREATIVE_RUN_REHYDRATION_FAILED', message: 'Creative Run opportunity map belongs to another project revision.' })
  return Object.freeze({ ok: true as const, value: Object.freeze(run) })
}
