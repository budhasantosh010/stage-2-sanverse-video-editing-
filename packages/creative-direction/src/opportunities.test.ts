import { describe, expect, it } from 'vitest'
import { createMotionOpportunityV1, validateMotionOpportunityV1 } from './opportunities.ts'

const opportunity = () => ({
  id: 'opportunity:68-percent',
  sourceStartTick: 5_760_000,
  sourceEndTick: 11_520_000,
  communicationGoal: 'Explain the observed 68 percent statistic',
  recommendedPresentationMode: 'overlay' as const,
  recommendedSourceTreatment: 'dim' as const,
  recommendedBackgroundTreatment: 'source-video' as const,
  preserveSourceAudio: true,
  preserveSourceVideo: true,
  suggestedPlacement: 'sanverse.donut-breakdown',
  rationale: 'The source contains a high-confidence numeric claim that benefits from a concise visual breakdown.',
  confidence: 0.93,
  requiredCapabilities: Object.freeze<string[]>([]),
})

describe('B3 MotionOpportunityV1', () => {
  it('preserves exact source ticks and closed presentation/treatment vocabulary', () => {
    const value = createMotionOpportunityV1(opportunity())
    expect(value.sourceStartTick).toBe(5_760_000)
    expect(value.sourceEndTick).toBe(11_520_000)
    expect(value.recommendedPresentationMode).toBe('overlay')
  })

  it('fails closed for invalid ranges, modes and confidence instead of guessing', () => {
    expect(validateMotionOpportunityV1({ ...opportunity(), sourceEndTick: 1 })).toMatchObject({ ok: false })
    expect(validateMotionOpportunityV1({ ...opportunity(), recommendedPresentationMode: 'magic' })).toMatchObject({ ok: false })
    expect(validateMotionOpportunityV1({ ...opportunity(), confidence: 1.2 })).toMatchObject({ ok: false })
  })
})
