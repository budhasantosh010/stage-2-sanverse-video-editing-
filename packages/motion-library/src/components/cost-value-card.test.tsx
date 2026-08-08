import { describe, expect, it } from 'vitest'
import { SANVERSE_TICKS_PER_SECOND } from '@sanverse/motion-primitives'
import { RATIO_COMPOSITIONS, evaluateDeterminism, evaluateMarkupDeterminism, renderComponentMarkup, validateDefinition, validateFixture } from '@sanverse/motion-testing'
import {
  COST_VALUE_CARD_DEFINITION,
  CostValueCardModule,
  DEFAULT_COST_VALUE_CARD_PROPS,
  DEFAULT_COST_VALUE_CARD_STYLE,
  costValueCardStyleFromPack,
  evaluateCostValueCardState,
  validateCostValueCardFit,
  validateCostValueCardProps,
} from './cost-value-card.tsx'
import { COST_VALUE_CARD_FIXTURES } from '../fixtures/cost-value-card.ts'
import { CREATOR_ENERGETIC_STYLE, SANVERSE_CLEAN_STYLE } from '../style-packs.ts'

const durationTicks = SANVERSE_TICKS_PER_SECOND * 5
const context = (localTicks: number, ratio: keyof typeof RATIO_COMPOSITIONS = '16:9', reducedMotion = false) => ({ localTicks, durationTicks, ticksPerSecond: SANVERSE_TICKS_PER_SECOND, composition: RATIO_COMPOSITIONS[ratio], reducedMotion })

describe('Cost / Value Card contract', () => {
  it('declares valid metadata and fixtures', () => {
    expect(validateDefinition(COST_VALUE_CARD_DEFINITION)).toEqual([])
    expect(COST_VALUE_CARD_FIXTURES).toHaveLength(14)
    for (const fixture of COST_VALUE_CARD_FIXTURES) expect(validateFixture(fixture)).toEqual([])
  })

  it('refuses non-finite, negative and out-of-range values', () => {
    for (const value of [Number.NaN, -1, 1_000_000_000_001]) {
      expect(validateCostValueCardProps({ ...DEFAULT_COST_VALUE_CARD_PROPS, cost: { ...DEFAULT_COST_VALUE_CARD_PROPS.cost, value } }).ok).toBe(false)
    }
  })

  it('refuses overlong labels and prefixes', () => {
    expect(validateCostValueCardProps({ ...DEFAULT_COST_VALUE_CARD_PROPS, cost: { ...DEFAULT_COST_VALUE_CARD_PROPS.cost, label: 'L'.repeat(49) } }).ok).toBe(false)
    expect(validateCostValueCardProps({ ...DEFAULT_COST_VALUE_CARD_PROPS, value: { ...DEFAULT_COST_VALUE_CARD_PROPS.value, prefix: 'ABCDE' } }).ok).toBe(false)
  })
})

describe('Cost / Value Card responsive fit', () => {
  it.each(['16:9', '9:16', '1:1', '4:5'] as const)('%s fits all declared text above minimum sizes', (ratio) => {
    const fit = validateCostValueCardFit(DEFAULT_COST_VALUE_CARD_PROPS, context(2_500_000, ratio))
    expect(fit.ok).toBe(true)
    if (!fit.ok) return
    expect(fit.value.cardHeight).toBeLessThanOrEqual(fit.value.maxHeight)
    for (const plan of [fit.value.title, fit.value.costLabel, fit.value.valueLabel, fit.value.costNumber, fit.value.valueNumber]) {
      expect(plan.fontSize).toBeGreaterThanOrEqual(plan.minimumFontSize)
    }
    expect(fit.value.costLabel.lines.every((line) => line.estimatedWidth <= fit.value.metricInnerWidth)).toBe(true)
    expect(fit.value.valueLabel.lines.every((line) => line.estimatedWidth <= fit.value.metricInnerWidth)).toBe(true)
    expect(fit.value.costNumber.lines.every((line) => line.estimatedWidth <= fit.value.metricInnerWidth)).toBe(true)
    expect(fit.value.valueNumber.lines.every((line) => line.estimatedWidth <= fit.value.metricInnerWidth)).toBe(true)
  })

  it('uses horizontal layout only when the composition has enough width', () => {
    expect(validateCostValueCardFit(DEFAULT_COST_VALUE_CARD_PROPS, context(2_500_000, '16:9'))).toMatchObject({ ok: true, value: { kind: 'horizontal' } })
    for (const ratio of ['9:16', '1:1', '4:5'] as const) expect(validateCostValueCardFit(DEFAULT_COST_VALUE_CARD_PROPS, context(2_500_000, ratio))).toMatchObject({ ok: true, value: { kind: 'stacked' } })
  })

  it('refuses an impossible unbreakable title', () => {
    const fit = validateCostValueCardFit({ ...DEFAULT_COST_VALUE_CARD_PROPS, title: 'X'.repeat(80) }, context(2_500_000, '9:16'))
    expect(fit.ok).toBe(false)
    if (fit.ok) return
    expect(fit.issues[0]).toMatchObject({ path: '$.title', code: 'CONTENT_IMPOSSIBLE' })
  })
})

describe('Cost / Value Card exact-time motion', () => {
  it('is identical when the same tick is revisited after arbitrary seeks', () => {
    const tick = 2_400_000
    const report = evaluateDeterminism((localTicks) => evaluateCostValueCardState(DEFAULT_COST_VALUE_CARD_PROPS, DEFAULT_COST_VALUE_CARD_STYLE, context(localTicks)), [0, tick, 5_400_000, 500_000, tick, 6_500_000, tick])
    expect(report.ok).toBe(true)
  })

  it('renders identical markup at repeated exact ticks', () => {
    const report = evaluateMarkupDeterminism(CostValueCardModule, DEFAULT_COST_VALUE_CARD_PROPS, DEFAULT_COST_VALUE_CARD_STYLE, { durationTicks, ticksPerSecond: SANVERSE_TICKS_PER_SECOND, composition: RATIO_COMPOSITIONS['16:9'], reducedMotion: false }, [0, 2_400_000, 5_000_000, 2_400_000])
    expect(report.ok).toBe(true)
  })

  it('counts deterministically to the target values by settled state', () => {
    const early = evaluateCostValueCardState(DEFAULT_COST_VALUE_CARD_PROPS, DEFAULT_COST_VALUE_CARD_STYLE, context(Math.round(durationTicks * 0.36)))
    expect(early.displayedCostValue).toBeGreaterThan(0)
    expect(early.displayedCostValue).toBeLessThanOrEqual(DEFAULT_COST_VALUE_CARD_PROPS.cost.value)
    const settled = evaluateCostValueCardState(DEFAULT_COST_VALUE_CARD_PROPS, DEFAULT_COST_VALUE_CARD_STYLE, context(Math.round(durationTicks * 0.70)))
    expect(settled.displayedCostValue).toBe(DEFAULT_COST_VALUE_CARD_PROPS.cost.value)
    expect(settled.displayedValueValue).toBe(DEFAULT_COST_VALUE_CARD_PROPS.value.value)
  })

  it('reduced motion removes directional movement and shows final values', () => {
    const reduced = evaluateCostValueCardState(DEFAULT_COST_VALUE_CARD_PROPS, DEFAULT_COST_VALUE_CARD_STYLE, context(Math.round(durationTicks * 0.15), '16:9', true))
    expect(reduced.costTranslate).toBe(0)
    expect(reduced.valueTranslate).toBe(0)
    expect(reduced.arrowScale).toBe(1)
    expect(reduced.displayedCostValue).toBe(DEFAULT_COST_VALUE_CARD_PROPS.cost.value)
    expect(reduced.displayedValueValue).toBe(DEFAULT_COST_VALUE_CARD_PROPS.value.value)
  })

  it('renders cost/value metrics, numbers and directional arrow', () => {
    const markup = renderComponentMarkup(CostValueCardModule, DEFAULT_COST_VALUE_CARD_PROPS, DEFAULT_COST_VALUE_CARD_STYLE, context(Math.round(durationTicks * 0.70)))
    expect(markup).toContain('data-motion-root="cost-value-card"')
    expect(markup).toContain('data-motion-metric="cost"')
    expect(markup).toContain('data-motion-metric="value"')
    expect(markup).toContain('data-motion-number="cost"')
    expect(markup).toContain('data-motion-arrow="true"')
  })

  it('uses shared style tokens without changing the component implementation', () => {
    const clean = costValueCardStyleFromPack(SANVERSE_CLEAN_STYLE)
    const energetic = costValueCardStyleFromPack(CREATOR_ENERGETIC_STYLE)
    expect(clean.accentColor).not.toBe(energetic.accentColor)
    expect(clean.motionIntensity).toBeLessThan(energetic.motionIntensity)
    expect(CostValueCardModule.Component).toBeDefined()
  })
})
