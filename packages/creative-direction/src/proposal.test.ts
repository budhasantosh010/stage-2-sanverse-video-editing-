import { describe, expect, it } from 'vitest'
import {
  FixtureCreativePlanner,
  PRODUCT_LAUNCH_CREATIVE_DIRECTION_FIXTURE,
  PRODUCT_LAUNCH_FIXTURE_CATALOG,
  validateCreativeEditProposal,
} from './index.ts'

describe('Plan B0 Creative Edit Proposal and planner boundary', () => {
  it('produces a deterministic offline proposal without an external AI client', async () => {
    const planner = new FixtureCreativePlanner()
    const input = { document: PRODUCT_LAUNCH_CREATIVE_DIRECTION_FIXTURE, catalog: PRODUCT_LAUNCH_FIXTURE_CATALOG }
    const first = await planner.propose(input)
    const second = await planner.propose(input)
    expect(JSON.stringify(first)).toBe(JSON.stringify(second))
    expect(first.id).toBe('proposal:fixture-product-launch-v1')
    expect(first.placements).toHaveLength(9)
    expect(first.styleAssignments).toHaveLength(1)
    expect(first.motionAssignments).toHaveLength(1)
    expect(first.footageTreatments).toHaveLength(1)
    expect(first.constraints).toHaveLength(2)
    expect(first.unresolvedDirectiveIds).toEqual(['note:simplify-middle'])
  })

  it('maps semantic graphic intents to typed component choices without CSS or DOM instructions', async () => {
    const proposal = await new FixtureCreativePlanner().propose({ document: PRODUCT_LAUNCH_CREATIVE_DIRECTION_FIXTURE, catalog: PRODUCT_LAUNCH_FIXTURE_CATALOG })
    const byIntent = new Map(proposal.placements.map((placement) => [placement.communicationIntent, placement.selectedComponentId] as const))
    expect(byIntent.get('conversation-notification-stack')).toBe('sanverse.conversation-toast-stack')
    expect(byIntent.get('semantic-highlight-statement')).toBe('sanverse.kinetic-headline')
    expect(byIntent.get('floating-prompt-composer')).toBe('sanverse.floating-prompt-composer')
    expect(byIntent.get('product-ui-story')).toBe('sanverse.product-ui-story-scene')
    expect(byIntent.get('scoped-access-comparison')).toBe('sanverse.scoped-access-comparison')
    expect(JSON.stringify(proposal)).not.toMatch(/css|dom|html|selector/iu)
  })

  it('preserves stable B1 observation references from a directive into its proposal placement', async () => {
    const sourceObservationId = 'semantic:transcript:1:percentage:0'
    const document = Object.freeze({
      ...PRODUCT_LAUNCH_CREATIVE_DIRECTION_FIXTURE,
      directives: Object.freeze(PRODUCT_LAUNCH_CREATIVE_DIRECTION_FIXTURE.directives.map((directive) => directive.id === 'graphic:semantic-highlight' ? Object.freeze({ ...directive, sourceObservationIds: Object.freeze([sourceObservationId]) }) : directive)),
    })
    const proposal = await new FixtureCreativePlanner().propose({ document, catalog: PRODUCT_LAUNCH_FIXTURE_CATALOG })
    expect(proposal.placements.find((placement) => placement.sourceDirectiveId === 'graphic:semantic-highlight')?.sourceObservationIds).toEqual([sourceObservationId])
  })

  it('targets every overlapping placement from the long-form motion directive', async () => {
    const proposal = await new FixtureCreativePlanner().propose({ document: PRODUCT_LAUNCH_CREATIVE_DIRECTION_FIXTURE, catalog: PRODUCT_LAUNCH_FIXTURE_CATALOG })
    expect(proposal.motionAssignments[0]?.targetPlacementIds).toEqual(proposal.placements.map((placement) => placement.id))
  })

  it('round-trips through JSON and remains valid', async () => {
    const proposal = await new FixtureCreativePlanner().propose({ document: PRODUCT_LAUNCH_CREATIVE_DIRECTION_FIXTURE, catalog: PRODUCT_LAUNCH_FIXTURE_CATALOG })
    const parsed = JSON.parse(JSON.stringify(proposal))
    const result = validateCreativeEditProposal(parsed, { durationTicks: PRODUCT_LAUNCH_CREATIVE_DIRECTION_FIXTURE.durationTicks, document: PRODUCT_LAUNCH_CREATIVE_DIRECTION_FIXTURE, catalog: PRODUCT_LAUNCH_FIXTURE_CATALOG })
    expect(result.ok).toBe(true)
  })

  it('rejects a resolved component that is absent from the supplied Plan-A catalog', async () => {
    const proposal = await new FixtureCreativePlanner().propose({ document: PRODUCT_LAUNCH_CREATIVE_DIRECTION_FIXTURE, catalog: PRODUCT_LAUNCH_FIXTURE_CATALOG })
    const result = validateCreativeEditProposal(proposal, {
      durationTicks: PRODUCT_LAUNCH_CREATIVE_DIRECTION_FIXTURE.durationTicks,
      document: PRODUCT_LAUNCH_CREATIVE_DIRECTION_FIXTURE,
      catalog: { componentIds: ['sanverse.kinetic-headline'], stylePackIds: PRODUCT_LAUNCH_FIXTURE_CATALOG.stylePackIds },
    })
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.issues.some((entry) => entry.code === 'REFERENCE_INVALID' && entry.path.includes('selectedComponentId'))).toBe(true)
  })

  it('can remain unresolved when a semantic choice is not available yet', async () => {
    const proposal = await new FixtureCreativePlanner().propose({ document: PRODUCT_LAUNCH_CREATIVE_DIRECTION_FIXTURE, catalog: { componentIds: ['sanverse.kinetic-headline', 'sanverse.lower-third-title'], stylePackIds: ['sanverse.style.clean'] } })
    expect(proposal.placements.find((placement) => placement.communicationIntent === 'floating-prompt-composer')?.selectedComponentId).toBeNull()
    expect(validateCreativeEditProposal(proposal, { durationTicks: PRODUCT_LAUNCH_CREATIVE_DIRECTION_FIXTURE.durationTicks, document: PRODUCT_LAUNCH_CREATIVE_DIRECTION_FIXTURE, catalog: { componentIds: ['sanverse.kinetic-headline', 'sanverse.lower-third-title'], stylePackIds: ['sanverse.style.clean'] } }).ok).toBe(true)
  })
})
