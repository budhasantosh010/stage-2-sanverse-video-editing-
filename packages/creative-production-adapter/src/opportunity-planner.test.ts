import { describe, expect, it } from 'vitest'
import { createProject, mediaTime, type EditProject } from '@sanverse/edit-domain'
import type { MotionOpportunityV1 } from '@sanverse/creative-direction'
import { planMotionOpportunitiesV1 } from './opportunity-planner.ts'
import { createCreativeSceneBatchV1 } from './multi-scene-workflow.ts'
import type { SourceTranscriptV1, SourceUnderstandingPacketV1 } from './external-orchestration.ts'

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
      duration: mediaTime(28_800_000),
      width: 1920,
      height: 1080,
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

const transcript = (p: EditProject): SourceTranscriptV1 => Object.freeze({
  schemaVersion: 'sanverse.source-transcript/v1',
  id: 'transcript_12345678',
  projectId: p.projectId,
  sourceAssetId: p.assets[0]!.assetId,
  sourceRevision: p.revision,
  sha256: 'b'.repeat(64),
  format: 'srt',
  analysisOnly: true,
  cues: Object.freeze(Array.from({ length: 10 }, (_, index) => Object.freeze({
    id: `transcript_12345678:cue:${index + 1}`,
    startTick: index * 2_880_000,
    endTick: (index + 1) * 2_880_000,
    text: [
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
    ][index]!,
  }))),
})

const packet = (p: EditProject, t: SourceTranscriptV1): SourceUnderstandingPacketV1 => {
  const kinds = ['percentage','question','comparison','process','security','feature','benefit','list','cta',undefined] as const
  return Object.freeze({
    schemaVersion: 'sanverse.source-understanding-packet/v1',
    id: 'sourcepkt_12345678',
    projectId: p.projectId,
    projectRevision: p.revision,
    sourceAssetId: p.assets[0]!.assetId,
    sourceDurationTicks: 28_800_000,
    transcriptRef: t.id,
    sourceSegments: Object.freeze(t.cues.map((cue) => Object.freeze({ id: `segment:${cue.id}`, startTick: cue.startTick, endTick: cue.endTick, transcriptCueIds: Object.freeze([cue.id]), observationIds: Object.freeze([]), confidence: 1 }))),
    observations: Object.freeze(t.cues.flatMap((cue, index) => {
      const semanticKind = kinds[index]
      const semantic = semanticKind ? [Object.freeze({ id: `semantic:${index}`, kind: 'semantic-moment' as const, startTick: cue.startTick, endTick: cue.endTick, confidence: 0.9, semanticKind, transcriptCueIds: Object.freeze([cue.id]) })] : []
      return [...semantic, Object.freeze({ id: `speech:${index}`, kind: 'speech-present' as const, startTick: cue.startTick, endTick: cue.endTick, confidence: 1, transcriptCueIds: Object.freeze([cue.id]) })]
    })),
    capabilities: Object.freeze(['transcript-segmentation','deterministic-transcript-semantics','source-metadata']),
    limitations: Object.freeze([]),
    evidenceHash: 'c'.repeat(64),
  })
}

const ownerApproval = (request: Readonly<{ requestRef: string; scope: 'storyboard'|'animatic'|'motion'; subjectId: string; subjectRevision: number }>) => Object.freeze({
  schemaVersion: 'sanverse.owner-approval/v1' as const,
  id: `approval:${request.requestRef}`,
  scope: request.scope,
  subjectId: request.subjectId,
  subjectRevision: request.subjectRevision,
  status: 'owner-approved' as const,
  approvedAt: '2026-08-29T12:00:00.000Z',
})

describe('raw-video opportunity planning + multi-scene workflow', () => {
  it('uses source evidence plus the real B2 Motion Library and existing recipe catalog to deterministically plan ten non-overlapping opportunities', () => {
    const p = project(), t = transcript(p), source = packet(p, t)
    const planned = planMotionOpportunitiesV1({ packet: source, transcript: t, targetCount: 10 })
    expect(planned.ok).toBe(true)
    if (!planned.ok) return
    expect(planned.value.opportunities).toHaveLength(10)
    expect(planned.value.planningRules).toMatchObject({ capabilityCatalogSource: 'b2-motion-library', recipeCatalogSource: 'edit-domain-component-recipes', overlapPolicy: 'non-overlapping-half-open' })
    expect(planned.value.styleRecommendation.schemaVersion).toBe('sanverse.style-lock-recommendation/v1')
    expect(planned.value.creativeLanguage.schemaVersion).toBe('sanverse.video-creative-language/v1')
    expect(planned.value.opportunities.some((entry) => entry.opportunity.communicationGoal === 'percentage')).toBe(true)
    expect(planned.value.opportunities.some((entry) => entry.opportunity.communicationGoal === 'comparison')).toBe(true)
    for (const [index, entry] of planned.value.opportunities.entries()) {
      expect(entry.selectedCapabilityId).toMatch(/^sanverse\./u)
      expect(entry.capabilityRankings.length).toBeGreaterThan(0)
      expect(entry.capabilityRankings[0]!.combinedScore).toBeGreaterThanOrEqual(entry.capabilityRankings.at(-1)!.combinedScore)
      expect(entry.recipeMatches.length).toBeGreaterThan(0)
      expect(entry.evidence.sourcePacketId).toBe(source.id)
      if (index > 0) expect(planned.value.opportunities[index - 1]!.opportunity.sourceEndTick).toBeLessThanOrEqual(entry.opportunity.sourceStartTick)
    }
    const again = planMotionOpportunitiesV1({ packet: source, transcript: t, targetCount: 10 })
    expect(again).toEqual(planned)
  })

  it('validates agent-proposed candidate bounds/count/overlap instead of silently resolving invalid proposals', () => {
    const p = project(), t = transcript(p), source = packet(p, t)
    const base = planMotionOpportunitiesV1({ packet: source, transcript: t, targetCount: 10 })
    if (!base.ok) throw new Error(base.refusal.message)
    const candidates = base.value.opportunities.map((entry) => entry.opportunity)
    const overlapped: MotionOpportunityV1[] = candidates.map((candidate, index) => index === 1 ? Object.freeze({ ...candidate, sourceStartTick: candidates[0]!.sourceStartTick + 100 }) : candidate)
    expect(planMotionOpportunitiesV1({ packet: source, transcript: t, targetCount: 10, agentCandidates: overlapped })).toMatchObject({ ok: false, refusal: { code: 'OPPORTUNITY_OVERLAP' } })
    expect(planMotionOpportunitiesV1({ packet: source, transcript: t, targetCount: 10, agentCandidates: candidates.slice(0, 9) })).toMatchObject({ ok: false, refusal: { code: 'OPPORTUNITY_COUNT_MISMATCH' } })
  })

  it('builds ten isolated canonical Motion Scene storyboards without owner approval and exposes exact-revision batch state', () => {
    const p = project(), t = transcript(p), source = packet(p, t)
    const planned = planMotionOpportunitiesV1({ packet: source, transcript: t, targetCount: 10 })
    if (!planned.ok) throw new Error(planned.refusal.message)
    const batch = createCreativeSceneBatchV1({ project: p, opportunityMap: planned.value })
    expect(batch.ok).toBe(true)
    if (!batch.ok) return
    const state = batch.value.snapshot()
    expect(state.scenes).toHaveLength(10)
    expect(state.scenes.every((scene) => scene.storyboard?.revision === 1)).toBe(true)
    expect(state.scenes.every((scene) => scene.storyboard?.status !== 'owner-approved')).toBe(true)
    expect(new Set(state.scenes.map((scene) => scene.sceneId)).size).toBe(10)
    expect(state.readyForProductionApply).toBe(false)
  })

  it('enforces host-resolved exact-revision Storyboard→Animatic→Motion owner gates for all scenes', async () => {
    const p = project(), t = transcript(p), source = packet(p, t)
    const planned = planMotionOpportunitiesV1({ packet: source, transcript: t, targetCount: 10 })
    if (!planned.ok) throw new Error(planned.refusal.message)
    const made = createCreativeSceneBatchV1({ project: p, opportunityMap: planned.value })
    if (!made.ok) throw new Error(made.refusal.message)
    const batch = made.value

    const early = await batch.advanceAll('animatic')
    expect(early.ok).toBe(false)

    const storyboardReview = batch.requestOwnerReviews('storyboard', '2026-08-29T10:00:00.000Z')
    expect(storyboardReview.ok, storyboardReview.message).toBe(true)
    expect(storyboardReview.requests).toHaveLength(10)
    const first = storyboardReview.requests![0]!
    const crossScene = storyboardReview.requests![1]!
    const wrong = await batch.resolveOwnerApproval(first.requestRef, async () => ownerApproval(crossScene))
    expect(wrong.ok).toBe(false)
    for (const request of storyboardReview.requests!) expect(await batch.resolveOwnerApproval(request.requestRef, async (exact) => ownerApproval(exact))).toMatchObject({ ok: true, approved: true })

    expect((await batch.advanceAll('animatic')).ok).toBe(true)
    const animaticReview = batch.requestOwnerReviews('animatic', '2026-08-29T10:10:00.000Z')
    expect(animaticReview.requests).toHaveLength(10)
    for (const request of animaticReview.requests!) expect(await batch.resolveOwnerApproval(request.requestRef, async (exact) => ownerApproval(exact))).toMatchObject({ ok: true, approved: true })

    expect((await batch.advanceAll('motion')).ok).toBe(true)
    const motionReview = batch.requestOwnerReviews('motion', '2026-08-29T10:20:00.000Z')
    expect(motionReview.requests).toHaveLength(10)
    for (const request of motionReview.requests!) expect(await batch.resolveOwnerApproval(request.requestRef, async (exact) => ownerApproval(exact))).toMatchObject({ ok: true, approved: true })
    expect(batch.snapshot().readyForProductionApply).toBe(true)
  })

  it('invalidates an issued approval request when the affected storyboard revision changes and refuses wildcard approval material', async () => {
    const p = project(), t = transcript(p), source = packet(p, t)
    const planned = planMotionOpportunitiesV1({ packet: source, transcript: t, targetCount: 2 })
    if (!planned.ok) throw new Error(planned.refusal.message)
    const made = createCreativeSceneBatchV1({ project: p, opportunityMap: planned.value })
    if (!made.ok) throw new Error(made.refusal.message)
    const batch = made.value
    const review = batch.requestOwnerReviews('storyboard', '2026-08-29T11:00:00.000Z')
    const first = review.requests![0]!
    const scene = batch.snapshot().scenes.find((item) => item.sceneId === first.sceneId)!
    expect(batch.reviseSceneOpacity(first.sceneId, 0.72, scene.storyboard!.sandboxRevision).ok).toBe(true)
    expect(await batch.resolveOwnerApproval(first.requestRef, async (exact) => ownerApproval(exact))).toMatchObject({ ok: false })

    const refreshed = batch.requestOwnerReviews('storyboard', '2026-08-29T11:01:00.000Z')
    const next = refreshed.requests!.find((item) => item.sceneId === first.sceneId)!
    const wildcard = await batch.resolveOwnerApproval(next.requestRef, async (exact) => Object.freeze({ ...ownerApproval(exact), id: 'approval:*' }))
    expect(wildcard).toMatchObject({ ok: false })
  })
})
