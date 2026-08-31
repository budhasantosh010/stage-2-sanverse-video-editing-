import { createHash } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import { createProject, mediaTime, type EditProject } from '@sanverse/edit-domain'
import type { ToolExecutionContextV1 } from '@sanverse/motion-agent-tools'
import type { OwnerApprovalV1 } from '@sanverse/motion-storyboard'
import { createCreativeProductionExternalOrchestrationSessionV1 } from './external-orchestration.ts'
import type { CreativeReviewV1, CreativeRunV1 } from './creative-run.ts'
import type { HostApprovalRequestV1 } from './multi-scene-workflow.ts'

const project = (): EditProject => {
  const projectId = 'project_1234567890abcdef'
  const made = createProject({
    projectId,
    asset: Object.freeze({
      schemaVersion: 'sanverse.asset/media/v1' as const,
      mediaKind: 'video' as const,
      assetId: 'asset_1234567890ab',
      storageRef: `project:${projectId}/source`,
      sha256: 'a'.repeat(64),
      byteLength: 4096,
      duration: mediaTime(17_280_000),
      width: 1280,
      height: 720,
      frameRate: Object.freeze({ numerator: 30, denominator: 1 }),
      hasAudio: true,
      durationResidualSeconds: 0,
    }),
    compositionId: 'composition_1234567890ab',
    trackId: 'track_1234567890ab',
    clipId: 'clip_1234567890ab',
  })
  if (!made.ok) throw new Error(JSON.stringify(made.error))
  return made.value
}

const sha256 = async (text: string): Promise<string> => createHash('sha256').update(text).digest('hex')
const artifactSha = createHash('sha256').update('review-frame').digest('hex')

const materializeReview = async ({ review }: Readonly<{ review: CreativeReviewV1 }>): Promise<CreativeReviewV1> => Object.freeze({
  ...review,
  evidenceHash: createHash('sha256').update(`${review.reviewId}:${review.subjectId}:${review.subjectRevision}:review-frame`).digest('hex'),
  artifacts: Object.freeze([Object.freeze({
    artifactId: `frame-${review.reviewId}.png`,
    kind: 'image' as const,
    label: 'Review frame',
    mimeType: 'image/png' as const,
    byteLength: 12,
    sha256: artifactSha,
  })]),
})

const ownerApproval = (request: HostApprovalRequestV1): OwnerApprovalV1 => Object.freeze({
  schemaVersion: 'sanverse.owner-approval/v1' as const,
  id: `approval:${request.requestRef}`,
  scope: request.scope,
  subjectId: request.subjectId,
  subjectRevision: request.subjectRevision,
  status: 'owner-approved' as const,
  approvedAt: '2026-08-31T07:30:00.000Z',
})

const invoke = async (
  session: Awaited<ReturnType<typeof createCreativeProductionExternalOrchestrationSessionV1>>,
  id: string,
  input: unknown = {},
  context: ToolExecutionContextV1 = Object.freeze({}),
) => session.registry.invoke(id, input, context)

const ports = (current: EditProject, runs: Map<string, CreativeRunV1>) => ({
  listProjects: async () => Object.freeze([{ id: current.projectId }]),
  readProject: async () => current,
  importSourceVideo: async () => { throw new Error('unused') },
  listCreativeRuns: async (projectId: string) => Object.freeze([...runs.values()].filter((run) => run.projectId === projectId)),
  readCreativeRun: async ({ projectId, runId }: Readonly<{ projectId: string; runId: string }>) => runs.get(runId)?.projectId === projectId ? runs.get(runId)! : null,
  writeCreativeRun: async (run: CreativeRunV1) => { runs.set(run.runId, structuredClone(run)) },
  materializeReviewEvidence: materializeReview as never,
  sha256Text: sha256,
  issueOwnerApprovalRef: async (request: HostApprovalRequestV1) => Object.freeze({ approvalRef: `approvalref_${request.requestRef}` }),
  resolveOwnerApprovalRef: async ({ approvalRef, request }: Readonly<{ approvalRef: string; request: HostApprovalRequestV1 }>) => approvalRef === `approvalref_${request.requestRef}` ? ownerApproval(request) : null,
})

describe('durable Creative Run reconnect + localized review decisions', () => {
  it('rehydrates the exact pending Storyboard review in a fresh session and rejects client-only approval', async () => {
    const current = project()
    const runs = new Map<string, CreativeRunV1>()
    const first = await createCreativeProductionExternalOrchestrationSessionV1({ sessionLabel: 'creative-run-first', ...ports(current, runs) })

    expect((await invoke(first, 'production.select_project', { projectId: current.projectId })).ok).toBe(true)
    const created = await invoke(first, 'creative.create_run', { transactionId: 'creative_run_reconnect_001' }) as any
    expect(created.ok).toBe(true)
    const runId = created.value.runId as string
    const transcript = await invoke(first, 'source.attach_transcript', { format: 'plain', contents: 'Revenue grew 82 percent. Compare both options and explain the takeaway.', transactionId: 'transcript_reconnect_001' }) as any
    const analyzed = await invoke(first, 'source.analyze_video', { transcriptRef: transcript.value.transcriptRef }) as any
    const planned = await invoke(first, 'motion.plan_opportunities', { sourcePacketRef: analyzed.value.id, maxCount: 2 }) as any
    expect(planned.value.selectedCount).toBe(2)
    const batch = await invoke(first, 'motion.create_scene_batch', { opportunityMapId: planned.value.id, transactionId: 'scene_batch_reconnect_001' }) as any
    expect(batch.value.scenes).toHaveLength(2)
    const prepared = await invoke(first, 'creative.prepare_review', { scope: 'storyboard' }) as any
    expect(prepared.ok).toBe(true)
    expect(prepared.value.reviews).toHaveLength(2)
    const review = prepared.value.reviews[0] as CreativeReviewV1
    const persistedBeforeReconnect = structuredClone(runs.get(runId)!)

    const second = await createCreativeProductionExternalOrchestrationSessionV1({ sessionLabel: 'creative-run-second', ...ports(current, runs) })
    expect((await invoke(second, 'production.select_project', { projectId: current.projectId })).ok).toBe(true)
    const resumed = await invoke(second, 'creative.resume_run', { runId }) as any
    expect(resumed.ok).toBe(true)
    expect(resumed.value.sceneIds).toEqual(persistedBeforeReconnect.sceneIds)
    expect(resumed.value.sceneBatch).toEqual(persistedBeforeReconnect.sceneBatch)
    expect(resumed.value.reviews).toEqual(persistedBeforeReconnect.reviews)

    const restoredReview = await invoke(second, 'creative.get_review', { reviewId: review.reviewId }) as any
    expect(restoredReview).toMatchObject({ ok: true, value: { runId, review: { reviewId: review.reviewId, evidenceHash: review.evidenceHash, subjectId: review.subjectId, subjectRevision: review.subjectRevision, status: 'pending' } } })

    const forged = await invoke(second, 'creative.decide_review', { reviewId: review.reviewId, decision: 'approve', hostReviewDecision: { reviewId: review.reviewId } }) as any
    expect(forged).toMatchObject({ ok: false, refusal: { code: 'OWNER_CONFIRMATION_REQUIRED' } })
    expect(runs.get(runId)!.reviews.find((item) => item.reviewId === review.reviewId)?.status).toBe('pending')
  })

  it('rejects only one reviewed scene after exact host confirmation and keeps its sibling intact', async () => {
    const current = project()
    const runs = new Map<string, CreativeRunV1>()
    const session = await createCreativeProductionExternalOrchestrationSessionV1({ sessionLabel: 'creative-run-reject', ...ports(current, runs) })
    await invoke(session, 'production.select_project', { projectId: current.projectId })
    const created = await invoke(session, 'creative.create_run', { transactionId: 'creative_run_reject_001' }) as any
    const runId = created.value.runId as string
    const transcript = await invoke(session, 'source.attach_transcript', { format: 'plain', contents: 'Revenue grew 82 percent. Compare both options and explain the takeaway.', transactionId: 'transcript_reject_001' }) as any
    const analyzed = await invoke(session, 'source.analyze_video', { transcriptRef: transcript.value.transcriptRef }) as any
    const planned = await invoke(session, 'motion.plan_opportunities', { sourcePacketRef: analyzed.value.id, maxCount: 2 }) as any
    await invoke(session, 'motion.create_scene_batch', { opportunityMapId: planned.value.id, transactionId: 'scene_batch_reject_001' })
    const prepared = await invoke(session, 'creative.prepare_review', { scope: 'storyboard' }) as any
    const [rejectedReview, siblingReview] = prepared.value.reviews as CreativeReviewV1[]

    const hostContext: ToolExecutionContextV1 = Object.freeze({
      hostReviewDecision: Object.freeze({
        reviewId: rejectedReview.reviewId,
        decision: 'reject' as const,
        evidenceHash: rejectedReview.evidenceHash,
        subjectId: rejectedReview.subjectId,
        subjectRevision: rejectedReview.subjectRevision,
        confirmedAt: '2026-08-31T07:31:00.000Z',
      }),
    })
    const rejected = await invoke(session, 'creative.decide_review', { reviewId: rejectedReview.reviewId, decision: 'reject' }, hostContext) as any
    expect(rejected.ok).toBe(true)
    expect(rejected.value.decision).toBe('rejected')

    const persisted = runs.get(runId)!
    expect(persisted.sceneIds).toHaveLength(1)
    expect(persisted.sceneIds).toEqual([siblingReview.sceneId])
    expect(persisted.sceneBatch?.workflows).toHaveLength(1)
    expect(persisted.sceneBatch?.workflows[0]!.sceneId).toBe(siblingReview.sceneId)
    expect(persisted.reviews.find((item) => item.reviewId === rejectedReview.reviewId)?.status).toBe('rejected')
    expect(persisted.reviews.find((item) => item.reviewId === siblingReview.reviewId)?.status).toBe('pending')
  })
})
