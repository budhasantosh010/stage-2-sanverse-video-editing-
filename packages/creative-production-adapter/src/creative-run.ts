import type { MotionOpportunityMapV1 } from './opportunity-planner.ts'
import type { PersistedCreativeSceneBatchV1 } from './multi-scene-workflow.ts'
import type { SourceTranscriptV1, SourceUnderstandingPacketV1 } from './external-orchestration.ts'

export const CREATIVE_RUN_SCHEMA_V1 = 'sanverse.creative-run/v1' as const
export const CREATIVE_REVIEW_SCHEMA_V1 = 'sanverse.creative-review/v1' as const

export type CreativeRunStageV1 =
  | 'source-analysis'
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

export type CreativeReviewScopeV1 = 'storyboard' | 'animatic' | 'motion'
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

export interface CreativeReviewV1 {
  readonly schemaVersion: typeof CREATIVE_REVIEW_SCHEMA_V1
  readonly reviewId: string
  readonly runId: string
  readonly sceneId: string
  readonly scope: CreativeReviewScopeV1
  readonly requestRef: string
  readonly subjectId: string
  readonly subjectRevision: number
  readonly evidenceHash: string
  readonly status: CreativeReviewStatusV1
  readonly revisionNote?: string
  readonly approvalRef?: string
  readonly artifacts: readonly CreativeReviewArtifactV1[]
  readonly createdAt: string
  readonly updatedAt: string
}

export interface CreativeRunV1 {
  readonly schemaVersion: typeof CREATIVE_RUN_SCHEMA_V1
  readonly runId: string
  readonly projectId: string
  readonly baseProjectRevision: number
  readonly sourceAssetId: string
  readonly stage: CreativeRunStageV1
  readonly createdAt: string
  readonly updatedAt: string
  readonly transcript?: SourceTranscriptV1
  readonly sourceUnderstanding?: SourceUnderstandingPacketV1
  readonly opportunityMap?: MotionOpportunityMapV1
  readonly sceneBatch?: PersistedCreativeSceneBatchV1
  readonly sceneIds: readonly string[]
  readonly reviews: readonly CreativeReviewV1[]
  readonly appliedChangeSetId?: string
  readonly exportJobId?: string
  readonly extensions: Readonly<Record<string, unknown>>
}

export interface CreativeRunSummaryV1 {
  readonly runId: string
  readonly projectId: string
  readonly stage: CreativeRunStageV1
  readonly sceneCount: number
  readonly pendingReviewCount: number
  readonly updatedAt: string
}

export type CreativeRunValidationResultV1 =
  | Readonly<{ ok: true; value: CreativeRunV1 }>
  | Readonly<{ ok: false; code: 'CREATIVE_RUN_REHYDRATION_FAILED'; message: string }>

const record = (value: unknown): value is Record<string, unknown> => Boolean(value) && typeof value === 'object' && !Array.isArray(value)
const bounded = (value: unknown, max = 4096): value is string => typeof value === 'string' && value.trim().length > 0 && value.length <= max
const runIdPattern = /^run_[a-z0-9]{8,64}$/u
const projectIdPattern = /^project_[a-z0-9]{16,64}$/u
const reviewIdPattern = /^review_[a-z0-9]{8,64}$/u
const sceneIdPattern = /^creative_scene_[a-z0-9]{8,64}$/u
const stages = new Set<CreativeRunStageV1>(['source-analysis','opportunity-planning','storyboard','storyboard-review','animatic','animatic-review','motion','motion-review','ready-for-apply','applied','exporting','complete','cancelled'])
const scopes = new Set<CreativeReviewScopeV1>(['storyboard','animatic','motion'])
const statuses = new Set<CreativeReviewStatusV1>(['pending','approved','revision-requested','rejected'])

export const summarizeCreativeRunV1 = (run: CreativeRunV1): CreativeRunSummaryV1 => Object.freeze({
  runId: run.runId,
  projectId: run.projectId,
  stage: run.stage,
  sceneCount: run.sceneIds.length,
  pendingReviewCount: run.reviews.filter((review) => review.status === 'pending' || review.status === 'revision-requested').length,
  updatedAt: run.updatedAt,
})

export const validateCreativeRunV1 = (value: unknown): CreativeRunValidationResultV1 => {
  if (!record(value) || value.schemaVersion !== CREATIVE_RUN_SCHEMA_V1) return Object.freeze({ ok: false, code: 'CREATIVE_RUN_REHYDRATION_FAILED', message: 'Creative Run schemaVersion is invalid.' })
  const run = value as unknown as CreativeRunV1
  if (!runIdPattern.test(run.runId ?? '') || !projectIdPattern.test(run.projectId ?? '') || !Number.isSafeInteger(run.baseProjectRevision) || run.baseProjectRevision < 0 || !bounded(run.sourceAssetId, 128) || !stages.has(run.stage)) return Object.freeze({ ok: false, code: 'CREATIVE_RUN_REHYDRATION_FAILED', message: 'Creative Run identity, project revision, source, or stage is invalid.' })
  if (!bounded(run.createdAt, 64) || !bounded(run.updatedAt, 64) || !Array.isArray(run.sceneIds) || run.sceneIds.some((id) => !sceneIdPattern.test(id)) || new Set(run.sceneIds).size !== run.sceneIds.length) return Object.freeze({ ok: false, code: 'CREATIVE_RUN_REHYDRATION_FAILED', message: 'Creative Run timestamps or scene identity list is invalid.' })
  if (!Array.isArray(run.reviews) || !record(run.extensions)) return Object.freeze({ ok: false, code: 'CREATIVE_RUN_REHYDRATION_FAILED', message: 'Creative Run review/extensions shape is invalid.' })
  for (const rawReview of run.reviews) {
    if (!record(rawReview)) return Object.freeze({ ok: false, code: 'CREATIVE_RUN_REHYDRATION_FAILED', message: 'Creative Run contains an invalid review record.' })
    const review = rawReview as unknown as CreativeReviewV1
    if (review.schemaVersion !== CREATIVE_REVIEW_SCHEMA_V1 || !reviewIdPattern.test(String(review.reviewId ?? '')) || review.runId !== run.runId || !sceneIdPattern.test(String(review.sceneId ?? '')) || !scopes.has(review.scope) || !bounded(review.subjectId, 240) || !Number.isSafeInteger(review.subjectRevision) || review.subjectRevision < 1 || !/^[a-f0-9]{64}$/u.test(String(review.evidenceHash ?? '')) || !statuses.has(review.status) || !Array.isArray(review.artifacts)) return Object.freeze({ ok: false, code: 'CREATIVE_RUN_REHYDRATION_FAILED', message: 'Creative Run contains an invalid review record.' })
    if (review.approvalRef !== undefined && !/^approvalref_[a-z0-9:_-]{8,180}$/u.test(review.approvalRef)) return Object.freeze({ ok: false, code: 'CREATIVE_RUN_REHYDRATION_FAILED', message: 'Creative Run contains an invalid approval reference.' })
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
  if (run.opportunityMap && (run.opportunityMap.projectId !== run.projectId || run.opportunityMap.projectRevision !== run.baseProjectRevision)) return Object.freeze({ ok: false, code: 'CREATIVE_RUN_REHYDRATION_FAILED', message: 'Creative Run opportunity map belongs to another project revision.' })
  return Object.freeze({ ok: true as const, value: Object.freeze(run) })
}
