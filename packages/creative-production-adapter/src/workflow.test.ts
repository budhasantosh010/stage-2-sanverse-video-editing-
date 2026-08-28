import { describe, expect, it } from 'vitest'
import { testProject } from '@sanverse/edit-domain/test-fixtures'
import { buildKineticHeadlineCandidateV16 } from './production-adapter.ts'
import { createCreativeProductionWorkflowV16 } from './workflow.ts'

const candidate = () => {
  const result = buildKineticHeadlineCandidateV16({ project: testProject(), compositionTicks: 1_440_000, headline: 'Build videos faster' })
  if (!result.ok) throw new Error(result.refusal.message)
  return result.value
}

describe('Creative production closed-loop workflow V1.6', () => {
  it('keeps deterministic QA separate from exact revision approvals through Storyboard, Animatic, Motion Forge and Motion Review', async () => {
    const workflow = createCreativeProductionWorkflowV16(candidate())
    expect(workflow.initialize()).toMatchObject({ ok: true })
    expect(workflow.advanceAfterStoryboardApproval()).toMatchObject({ ok: false })
    expect(workflow.approve('storyboard', '2026-08-28T10:00:00.000Z')).toMatchObject({ ok: true })
    expect(workflow.advanceAfterStoryboardApproval()).toMatchObject({ ok: true })
    expect(workflow.approve('animatic', '2026-08-28T10:01:00.000Z')).toMatchObject({ ok: true })
    expect(workflow.advanceAfterAnimaticApproval()).toMatchObject({ ok: true })
    expect(await workflow.prepareMotionReview()).toMatchObject({ ok: true })
    const beforeMotionApproval = workflow.state()
    expect(beforeMotionApproval.motionDraft?.status).not.toBe('owner-approved')
    expect(beforeMotionApproval.visualEvidence?.canonicalReviewRef).toContain('production-preview://')
    expect(workflow.approve('motion', '2026-08-28T10:02:00.000Z')).toMatchObject({ ok: true })
    expect(workflow.state().motionDraft?.status).toBe('owner-approved')
  })
})
