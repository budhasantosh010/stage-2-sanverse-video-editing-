import { describe, expect, it } from 'vitest'
import { createProject, mediaTime, type EditProject } from '@sanverse/edit-domain'
import { createCreativeProductionExternalOrchestrationSessionV1 } from './external-orchestration.ts'

const makeProject = (): EditProject => {
  const projectId = 'project_3333333333333333'
  const made = createProject({
    projectId,
    asset: Object.freeze({
      schemaVersion: 'sanverse.asset/media/v1' as const,
      mediaKind: 'video' as const,
      assetId: 'asset_333333333333',
      storageRef: `project:${projectId}/source`,
      sha256: 'c'.repeat(64),
      byteLength: 4096,
      duration: mediaTime(28_800_000),
      width: 1920,
      height: 1080,
      frameRate: Object.freeze({ numerator: 30, denominator: 1 }),
      hasAudio: true,
      durationResidualSeconds: 0,
    }),
    compositionId: 'composition_333333333333',
    trackId: 'track_333333333333',
    clipId: 'clip_333333333333',
  })
  if (!made.ok) throw new Error(JSON.stringify(made.error))
  return made.value
}

const transcriptText = Array.from({ length: 10 }, (_, index) => {
  const start = index * 2
  const end = start + 2
  const ss = String(start).padStart(2, '0')
  const ee = String(end).padStart(2, '0')
  const text = [
    'Revenue grew 82 percent.',
    'Why did this happen?',
    'Plan A versus Plan B.',
    'First, connect the source.',
    'Security and permission boundaries matter.',
    'The biggest feature is shared context.',
    'This saves time automatically.',
    'Three things decide the result.',
    'Download the report now.',
    'The final headline explains the takeaway.',
  ][index]!
  return `${index + 1}\n00:00:${ss},000 --> 00:00:${ee},000\n${text}`
}).join('\n\n')

const value = <T = any>(result: any): T => {
  expect(result.ok, result.refusal?.message).toBe(true)
  return result.value as T
}

const invoke = async (session: Awaited<ReturnType<typeof createCreativeProductionExternalOrchestrationSessionV1>>, id: string, input: unknown = {}) => session.registry.invoke(id, input)

describe('external raw-video orchestration session — opportunity/batch owner gates', () => {
  it('exposes deterministic planning + 10-scene batch tools and advances only through host-resolved opaque approvals', async () => {
    const project = makeProject()
    const approvalsSeen: string[] = []
    const session = await createCreativeProductionExternalOrchestrationSessionV1({
      sessionLabel: 'batch3',
      listProjects: async () => Object.freeze([{ id: project.projectId }]),
      readProject: async () => project,
      importSourceVideo: async () => { throw new Error('unused') },
      sha256Text: async (text) => `sha256:${text.length}`,
      resolveOwnerApprovalRef: async ({ approvalRef, request }) => {
        approvalsSeen.push(approvalRef)
        if (approvalRef !== `approvalref_${request.requestRef}`) return null
        return Object.freeze({
          schemaVersion: 'sanverse.owner-approval/v1' as const,
          id: `approval:${request.requestRef}`,
          scope: request.scope,
          subjectId: request.subjectId,
          subjectRevision: request.subjectRevision,
          status: 'owner-approved' as const,
          approvedAt: '2026-08-29T13:00:00.000Z',
        })
      },
    })

    const ids = session.registry.list().map((tool) => tool.id)
    expect(ids).toEqual(expect.arrayContaining([
      'motion.plan_opportunities',
      'motion.get_opportunity_map',
      'motion.create_scene_sandbox',
      'motion.create_scene_batch',
      'motion.get_scene_batch',
      'motion.advance_scene_batch',
      'production.get_owner_review_status',
    ]))

    value(await invoke(session, 'production.select_project', { projectId: project.projectId }))
    const transcript = value<any>(await invoke(session, 'source.attach_transcript', { format: 'srt', contents: transcriptText, transactionId: 'transcript_batch3_0001' }))
    const packet = value<any>(await invoke(session, 'source.analyze_video', { transcriptRef: transcript.transcriptRef }))
    const map = value<any>(await invoke(session, 'motion.plan_opportunities', { sourcePacketRef: packet.id, transcriptRef: transcript.transcriptRef, targetCount: 10 }))
    expect(map.opportunities).toHaveLength(10)
    expect(value<any>(await invoke(session, 'motion.get_opportunity_map', { opportunityMapId: map.id })).id).toBe(map.id)

    const batch = value<any>(await invoke(session, 'motion.create_scene_batch', { opportunityMapId: map.id, transactionId: 'scene_batch3_0001' }))
    expect(batch.scenes).toHaveLength(10)
    expect(batch.readyForProductionApply).toBe(false)
    expect(await invoke(session, 'motion.advance_scene_batch', { batchId: batch.id, action: 'advance', scope: 'animatic' })).toMatchObject({ ok: false, refusal: { code: 'STORYBOARD_APPROVAL_REQUIRED' } })

    const approveStage = async (scope: 'storyboard'|'animatic'|'motion') => {
      const review = value<any>(await invoke(session, 'motion.advance_scene_batch', { batchId: batch.id, action: 'request-review', scope }))
      expect(review.reviewRequests).toHaveLength(10)
      for (const request of review.reviewRequests) {
        const fake = await invoke(session, 'motion.advance_scene_batch', {
          batchId: batch.id,
          action: 'resolve-approval',
          requestRef: request.requestRef,
          approvalRef: 'approvalref_not-host-issued',
          ownerApproval: { subjectId: request.subjectId, subjectRevision: request.subjectRevision },
        })
        expect(fake).toMatchObject({ ok: true, value: { approved: false } })
        const exact = value<any>(await invoke(session, 'motion.advance_scene_batch', {
          batchId: batch.id,
          action: 'resolve-approval',
          requestRef: request.requestRef,
          approvalRef: `approvalref_${request.requestRef}`,
        }))
        expect(exact.approved).toBe(true)
      }
    }

    await approveStage('storyboard')
    value(await invoke(session, 'motion.advance_scene_batch', { batchId: batch.id, action: 'advance', scope: 'animatic' }))
    await approveStage('animatic')
    value(await invoke(session, 'motion.advance_scene_batch', { batchId: batch.id, action: 'advance', scope: 'motion' }))
    await approveStage('motion')

    const final = value<any>(await invoke(session, 'production.get_owner_review_status', { batchId: batch.id }))
    expect(final.readyForProductionApply).toBe(true)
    expect(final.pendingApprovalRequests).toHaveLength(0)
    expect(approvalsSeen.some((ref) => ref === 'approvalref_not-host-issued')).toBe(true)
  })

  it('refuses stale/cross-scene/wildcard approval resolution even when the host resolver returns material', async () => {
    const project = makeProject()
    const session = await createCreativeProductionExternalOrchestrationSessionV1({
      sessionLabel: 'batch3-stale',
      listProjects: async () => Object.freeze([{ id: project.projectId }]),
      readProject: async () => project,
      importSourceVideo: async () => { throw new Error('unused') },
      sha256Text: async (text) => `sha256:${text.length}`,
      resolveOwnerApprovalRef: async ({ request }) => Object.freeze({
        schemaVersion: 'sanverse.owner-approval/v1' as const,
        id: 'approval:*',
        scope: request.scope,
        subjectId: request.subjectId,
        subjectRevision: request.subjectRevision,
        status: 'owner-approved' as const,
        approvedAt: '2026-08-29T13:00:00.000Z',
      }),
    })
    value(await invoke(session, 'production.select_project', { projectId: project.projectId }))
    const transcript = value<any>(await invoke(session, 'source.attach_transcript', { format: 'srt', contents: transcriptText, transactionId: 'transcript_batch3_0002' }))
    const packet = value<any>(await invoke(session, 'source.analyze_video', { transcriptRef: transcript.transcriptRef }))
    const map = value<any>(await invoke(session, 'motion.plan_opportunities', { sourcePacketRef: packet.id, targetCount: 2 }))
    const batch = value<any>(await invoke(session, 'motion.create_scene_batch', { opportunityMapId: map.id, transactionId: 'scene_batch3_0002' }))
    const review = value<any>(await invoke(session, 'motion.advance_scene_batch', { batchId: batch.id, action: 'request-review', scope: 'storyboard' }))
    const first = review.reviewRequests[0]
    const workflow = session.getSceneBatch(batch.id)!.getWorkflow(first.sceneId)!
    const sandboxRevision = workflow.state().storyboardSandbox!.sandboxRevision
    expect(session.getSceneBatch(batch.id)!.reviseSceneOpacity(first.sceneId, 0.6, sandboxRevision).ok).toBe(true)
    expect(await invoke(session, 'motion.advance_scene_batch', { batchId: batch.id, action: 'resolve-approval', requestRef: first.requestRef, approvalRef: `approvalref_${first.requestRef}` })).toMatchObject({ ok: false, refusal: { code: 'APPROVAL_STALE' } })

    const refreshed = value<any>(await invoke(session, 'motion.advance_scene_batch', { batchId: batch.id, action: 'request-review', scope: 'storyboard' }))
    const next = refreshed.reviewRequests.find((item: any) => item.sceneId === first.sceneId)
    expect(await invoke(session, 'motion.advance_scene_batch', { batchId: batch.id, action: 'resolve-approval', requestRef: next.requestRef, approvalRef: `approvalref_${next.requestRef}` })).toMatchObject({ ok: false, refusal: { code: 'APPROVAL_STALE' } })
  })
})
