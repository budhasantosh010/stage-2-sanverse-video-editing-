import { describe, expect, it } from 'vitest'
import { SANVERSE_TICKS_PER_SECOND } from '@sanverse/motion-primitives'
import {
  RATIO_COMPOSITIONS,
  evaluateDeterminism,
  evaluateMarkupDeterminism,
  renderComponentMarkup,
  validateDefinition,
  validateFixture,
} from '@sanverse/motion-testing'
import {
  CHECKLIST_CARD_DEFINITION,
  ChecklistCardModule,
  DEFAULT_CHECKLIST_CARD_PROPS,
  DEFAULT_CHECKLIST_CARD_STYLE,
  checklistCardStyleFromPack,
  evaluateChecklistCardState,
  validateChecklistCardFit,
  validateChecklistCardProps,
} from './checklist-card.tsx'
import { CHECKLIST_CARD_FIXTURES } from '../fixtures/checklist-card.ts'
import { CREATOR_ENERGETIC_STYLE, SANVERSE_CLEAN_STYLE } from '../style-packs.ts'

const durationTicks = SANVERSE_TICKS_PER_SECOND * 5
const context = (
  localTicks: number,
  ratio: keyof typeof RATIO_COMPOSITIONS = '16:9',
  reducedMotion = false,
) => ({
  localTicks,
  durationTicks,
  ticksPerSecond: SANVERSE_TICKS_PER_SECOND,
  composition: RATIO_COMPOSITIONS[ratio],
  reducedMotion,
})

const sixItems = {
  eyebrow: 'FINAL PASS',
  title: 'Six checks before export',
  items: [
    { id: 'hook', label: 'Hook earns attention immediately', state: 'complete' as const },
    { id: 'audio', label: 'Voice is clear and balanced', state: 'complete' as const },
    { id: 'captions', label: 'Captions are readable and timed', state: 'complete' as const },
    { id: 'visuals', label: 'Visuals support each main idea', state: 'complete' as const },
    { id: 'pace', label: 'Pacing keeps the explanation moving', state: 'pending' as const },
    { id: 'cta', label: 'Final call to action is specific', state: 'pending' as const },
  ],
  footer: '4 of 6 ready',
} as const

describe('Checklist Card contract', () => {
  it('declares valid metadata and the A2 fixture matrix', () => {
    expect(validateDefinition(CHECKLIST_CARD_DEFINITION)).toEqual([])
    expect(CHECKLIST_CARD_FIXTURES).toHaveLength(14)
    for (const fixture of CHECKLIST_CARD_FIXTURES) expect(validateFixture(fixture)).toEqual([])
  })

  it('refuses zero items and more than six items', () => {
    expect(validateChecklistCardProps({ ...DEFAULT_CHECKLIST_CARD_PROPS, items: [] }).ok).toBe(false)
    expect(validateChecklistCardProps({
      ...DEFAULT_CHECKLIST_CARD_PROPS,
      items: Array.from({ length: 7 }, (_, index) => ({ id: `item_${index}`, label: `Item ${index}`, state: 'pending' })),
    }).ok).toBe(false)
  })

  it('refuses duplicate ids and overlong row text', () => {
    expect(validateChecklistCardProps({
      ...DEFAULT_CHECKLIST_CARD_PROPS,
      items: [
        { id: 'same', label: 'One', state: 'complete' },
        { id: 'same', label: 'Two', state: 'pending' },
      ],
    }).ok).toBe(false)
    expect(validateChecklistCardProps({
      ...DEFAULT_CHECKLIST_CARD_PROPS,
      items: [{ id: 'long', label: 'X'.repeat(73), state: 'pending' }],
    }).ok).toBe(false)
  })
})

describe('Checklist Card responsive fit', () => {
  it.each(['16:9', '9:16', '1:1', '4:5'] as const)('%s keeps default title and rows inside declared bounds', (ratio) => {
    const fit = validateChecklistCardFit(DEFAULT_CHECKLIST_CARD_PROPS, context(2_500_000, ratio))
    expect(fit.ok).toBe(true)
    if (!fit.ok) return
    expect(fit.value.cardHeight).toBeLessThanOrEqual(fit.value.maxHeight)
    expect(fit.value.title.fontSize).toBeGreaterThanOrEqual(fit.value.title.minimumFontSize)
    expect(fit.value.title.lines.every((line) => line.estimatedWidth <= fit.value.contentWidth)).toBe(true)
    for (const itemPlan of fit.value.items) {
      expect(itemPlan.fontSize).toBeGreaterThanOrEqual(itemPlan.minimumFontSize)
      expect(itemPlan.lines.every((line) => line.estimatedWidth <= fit.value.rowTextWidth)).toBe(true)
    }
  })

  it.each(['16:9', '9:16', '1:1', '4:5'] as const)('%s fits the declared maximum six normal rows', (ratio) => {
    const fit = validateChecklistCardFit(sixItems, context(2_500_000, ratio))
    expect(fit.ok).toBe(true)
    if (!fit.ok) return
    expect(fit.value.items).toHaveLength(6)
    expect(fit.value.cardHeight).toBeLessThanOrEqual(fit.value.maxHeight)
  })

  it('refuses an impossible unbreakable row instead of clipping it', () => {
    const props = {
      ...DEFAULT_CHECKLIST_CARD_PROPS,
      items: [{ id: 'impossible', label: 'X'.repeat(72), state: 'pending' as const }],
    }
    const fit = validateChecklistCardFit(props, context(2_500_000, '9:16'))
    expect(fit.ok).toBe(false)
    if (fit.ok) return
    expect(fit.issues[0]).toMatchObject({ path: '$.items[0].label', code: 'CONTENT_IMPOSSIBLE' })
  })
})

describe('Checklist Card exact-time motion', () => {
  it('revisits the same tick identically after forward and backward seeks', () => {
    const tick = 2_232_000
    const report = evaluateDeterminism(
      (localTicks) => evaluateChecklistCardState(DEFAULT_CHECKLIST_CARD_PROPS, DEFAULT_CHECKLIST_CARD_STYLE, context(localTicks)),
      [0, tick, 5_000_000, 800_000, tick, 6_500_000, tick],
    )
    expect(report.ok).toBe(true)
  })

  it('renders identical markup for repeated exact ticks', () => {
    const report = evaluateMarkupDeterminism(
      ChecklistCardModule,
      DEFAULT_CHECKLIST_CARD_PROPS,
      DEFAULT_CHECKLIST_CARD_STYLE,
      { durationTicks, ticksPerSecond: SANVERSE_TICKS_PER_SECOND, composition: RATIO_COMPOSITIONS['16:9'], reducedMotion: false },
      [0, 2_232_000, 5_100_000, 2_232_000],
    )
    expect(report.ok).toBe(true)
  })

  it('draws complete checks while pending rows remain unchecked', () => {
    const settled = evaluateChecklistCardState(DEFAULT_CHECKLIST_CARD_PROPS, DEFAULT_CHECKLIST_CARD_STYLE, context(Math.round(durationTicks * 0.70)))
    expect(settled.rows[0]?.checkProgress).toBeGreaterThan(0.99)
    expect(settled.rows[1]?.checkProgress).toBeGreaterThan(0.99)
    expect(settled.rows[2]?.checkProgress).toBe(0)
  })

  it('removes row translation and spring scale under reduced motion', () => {
    const reduced = evaluateChecklistCardState(DEFAULT_CHECKLIST_CARD_PROPS, DEFAULT_CHECKLIST_CARD_STYLE, context(Math.round(durationTicks * 0.20), '16:9', true))
    expect(reduced.rows.every((row) => row.translateX === 0 && row.checkScale === 1)).toBe(true)
    expect(reduced.rows.some((row) => row.opacity > 0)).toBe(true)
  })

  it('renders explicit rows, item text and SVG check path', () => {
    const markup = renderComponentMarkup(
      ChecklistCardModule,
      DEFAULT_CHECKLIST_CARD_PROPS,
      DEFAULT_CHECKLIST_CARD_STYLE,
      context(Math.round(durationTicks * 0.70)),
    )
    expect(markup).toContain('data-motion-root="checklist-card"')
    expect(markup).toContain('data-motion-row="0"')
    expect(markup).toContain('data-motion-text="checklist-item-0"')
    expect(markup).toContain('stroke-dasharray="1"')
  })

  it('changes style through tokens without replacing the component implementation', () => {
    const clean = checklistCardStyleFromPack(SANVERSE_CLEAN_STYLE)
    const energetic = checklistCardStyleFromPack(CREATOR_ENERGETIC_STYLE)
    expect(clean.accentColor).not.toBe(energetic.accentColor)
    expect(clean.motionIntensity).toBeLessThan(energetic.motionIntensity)
    expect(ChecklistCardModule.Component).toBeDefined()
  })
})
