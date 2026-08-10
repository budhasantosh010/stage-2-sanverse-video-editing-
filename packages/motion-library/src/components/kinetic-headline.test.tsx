import { describe, expect, it } from 'vitest'
import { deriveTimelineTracks } from '@sanverse/motion-graph'
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
  DEFAULT_KINETIC_HEADLINE_PROPS,
  DEFAULT_KINETIC_HEADLINE_STYLE,
  KINETIC_HEADLINE_DEFINITION,
  KineticHeadlineModule,
  evaluateKineticHeadlineState,
  kineticHeadlineStyleFromPack,
  validateKineticHeadlineFit,
  validateKineticHeadlineProps,
} from './kinetic-headline.tsx'
import { KINETIC_HEADLINE_FIXTURES } from '../fixtures/kinetic-headline.ts'
import { CREATOR_ENERGETIC_STYLE, SANVERSE_CLEAN_STYLE } from '../style-packs.ts'

const durationTicks = SANVERSE_TICKS_PER_SECOND * 3
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

describe('Kinetic Headline contract', () => {
  it('refuses empty text and invalid emphasis indices', () => {
    expect(validateKineticHeadlineProps({ ...DEFAULT_KINETIC_HEADLINE_PROPS, text: '   ' }).ok).toBe(false)
    expect(validateKineticHeadlineProps({ text: 'AI makes AI easier', emphasisIndices: [2], alignment: 'center', maxLines: 2 }).ok).toBe(true)
    expect(validateKineticHeadlineProps({ text: 'AI makes AI easier', emphasisIndices: [4], alignment: 'center', maxLines: 2 }).ok).toBe(false)
    expect(validateKineticHeadlineProps({ ...DEFAULT_KINETIC_HEADLINE_PROPS, emphasisTreatment: 'highlight-box' }).ok).toBe(true)
    expect(validateKineticHeadlineProps({ ...DEFAULT_KINETIC_HEADLINE_PROPS, emphasisTreatment: 'unknown' }).ok).toBe(false)
  })

  it('adds a C2-keyframed semantic highlight variant without changing the default headline contract', () => {
    const props = { ...DEFAULT_KINETIC_HEADLINE_PROPS, text: 'Tag Northstar in', emphasisIndices: [1], emphasisTreatment: 'highlight-box' as const }
    const scene = KineticHeadlineModule.createScene(props, DEFAULT_KINETIC_HEADLINE_STYLE, context(0))
    const emphasizedTracks = deriveTimelineTracks(scene).filter((track) => track.nodeId.includes('northstar') && track.animationKind === 'keyframes')
    expect(emphasizedTracks.some((track) => track.property === 'opacity')).toBe(true)
    expect(emphasizedTracks.some((track) => track.property === 'transform.scaleX')).toBe(true)
    const markup = renderComponentMarkup(KineticHeadlineModule, props, DEFAULT_KINETIC_HEADLINE_STYLE, context(Math.round(durationTicks * .4)))
    expect(markup).toContain('data-motion-emphasis="true"')
    expect(markup).toContain('background:')
  })

  it('declares valid metadata and the fixture matrix', () => {
    expect(validateDefinition(KINETIC_HEADLINE_DEFINITION)).toEqual([])
    expect(KINETIC_HEADLINE_FIXTURES).toHaveLength(14)
    for (const fixture of KINETIC_HEADLINE_FIXTURES) expect(validateFixture(fixture)).toEqual([])
  })
})

describe('Kinetic Headline deterministic text fit', () => {
  it.each(['16:9', '9:16', '1:1', '4:5'] as const)('%s keeps every planned line inside content width', (ratio) => {
    const fit = validateKineticHeadlineFit(DEFAULT_KINETIC_HEADLINE_PROPS, context(1_296_000, ratio))
    expect(fit.ok).toBe(true)
    if (!fit.ok) return
    expect(fit.value.fontSize).toBeGreaterThanOrEqual(fit.value.minimumFontSize)
    expect(fit.value.lines.length).toBeLessThanOrEqual(DEFAULT_KINETIC_HEADLINE_PROPS.maxLines)
    expect(fit.value.lines.every((line) => line.estimatedWidth <= fit.value.maxWidth)).toBe(true)
  })

  it('uses explicit portrait and square line plans rather than browser text wrapping', () => {
    const portrait = validateKineticHeadlineFit(DEFAULT_KINETIC_HEADLINE_PROPS, context(1_296_000, '9:16'))
    const square = validateKineticHeadlineFit(DEFAULT_KINETIC_HEADLINE_PROPS, context(1_296_000, '1:1'))
    expect(portrait.ok && portrait.value.lines.length).toBe(2)
    expect(square.ok && square.value.lines.length).toBe(2)
  })

  it('fits mixed Unicode copy without non-finite measurements', () => {
    const props = { text: '创作 أسرع — build 10× faster 🚀', emphasisIndices: [3, 4], alignment: 'center' as const, maxLines: 3 as const }
    const fit = validateKineticHeadlineFit(props, context(1_296_000, '9:16'))
    expect(fit.ok).toBe(true)
    if (!fit.ok) return
    expect(fit.value.lines.every((line) => Number.isFinite(line.estimatedWidth))).toBe(true)
  })

  it('refuses an unbreakable token that cannot fit at the minimum readable size', () => {
    const props = { text: 'X'.repeat(120), emphasisIndices: [] as readonly number[], alignment: 'center' as const, maxLines: 3 as const }
    const fit = validateKineticHeadlineFit(props, context(1_296_000, '9:16'))
    expect(fit.ok).toBe(false)
    if (fit.ok) return
    expect(fit.issues[0]).toMatchObject({ path: '$.text', code: 'CONTENT_IMPOSSIBLE' })
    expect(fit.issues[0]?.message).toMatch(/too wide/i)
  })

  it('refuses copy that cannot obey maxLines without shrinking below minimum', () => {
    const props = {
      text: 'one two three four five six seven eight nine ten eleven twelve thirteen fourteen fifteen sixteen seventeen eighteen',
      emphasisIndices: [] as readonly number[],
      alignment: 'center' as const,
      maxLines: 1 as const,
    }
    const fit = validateKineticHeadlineFit(props, context(1_296_000, '16:9'))
    expect(fit.ok).toBe(false)
    if (fit.ok) return
    expect(fit.issues[0]?.code).toBe('CONTENT_IMPOSSIBLE')
    expect(fit.issues[0]?.message).toMatch(/needs|lines/i)
  })

  it('returns the exact same line plan on repeated calls', () => {
    const first = validateKineticHeadlineFit(DEFAULT_KINETIC_HEADLINE_PROPS, context(1_296_000, '4:5'))
    const second = validateKineticHeadlineFit(DEFAULT_KINETIC_HEADLINE_PROPS, context(1_296_000, '4:5'))
    expect(second).toEqual(first)
  })
})

describe('Kinetic Headline exact-time behavior', () => {
  it('is identical when a tick is revisited after forward/backward seeks', () => {
    const repeatedTick = 720_000
    const report = evaluateDeterminism(
      (localTicks) => evaluateKineticHeadlineState(DEFAULT_KINETIC_HEADLINE_PROPS, DEFAULT_KINETIC_HEADLINE_STYLE, context(localTicks)),
      [0, repeatedTick, 2_500_000, 300_000, repeatedTick, 4_000_000, repeatedTick],
    )
    expect(report.ok).toBe(true)
  })

  it('renders identical markup for repeated exact ticks', () => {
    const report = evaluateMarkupDeterminism(
      KineticHeadlineModule,
      DEFAULT_KINETIC_HEADLINE_PROPS,
      DEFAULT_KINETIC_HEADLINE_STYLE,
      { durationTicks, ticksPerSecond: SANVERSE_TICKS_PER_SECOND, composition: RATIO_COMPOSITIONS['16:9'], reducedMotion: false },
      [0, 720_000, 3_000_000, 720_000],
    )
    expect(report.ok).toBe(true)
  })

  it('renders the deterministic line plan into explicit line nodes', () => {
    const markup = renderComponentMarkup(
      KineticHeadlineModule,
      DEFAULT_KINETIC_HEADLINE_PROPS,
      DEFAULT_KINETIC_HEADLINE_STYLE,
      context(1_296_000, '9:16'),
    )
    expect(markup).toContain('data-motion-line="0"')
    expect(markup).toContain('data-motion-line="1"')
    expect(markup).toContain('data-motion-font-size=')
  })

  it('reflows for composition shape', () => {
    expect(evaluateKineticHeadlineState(DEFAULT_KINETIC_HEADLINE_PROPS, DEFAULT_KINETIC_HEADLINE_STYLE, context(2_000_000, '16:9')).layout.kind).toBe('landscape')
    expect(evaluateKineticHeadlineState(DEFAULT_KINETIC_HEADLINE_PROPS, DEFAULT_KINETIC_HEADLINE_STYLE, context(2_000_000, '9:16')).layout.kind).toBe('portrait')
    expect(evaluateKineticHeadlineState(DEFAULT_KINETIC_HEADLINE_PROPS, DEFAULT_KINETIC_HEADLINE_STYLE, context(2_000_000, '1:1')).layout.kind).toBe('square')
  })

  it('removes translation/spring scaling in reduced motion', () => {
    const state = evaluateKineticHeadlineState(DEFAULT_KINETIC_HEADLINE_PROPS, DEFAULT_KINETIC_HEADLINE_STYLE, context(500_000, '16:9', true))
    expect(state.words.every((word) => word.translateY === 0 && word.scale === 1)).toBe(true)
    expect(state.words.some((word) => word.opacity > 0)).toBe(true)
  })

  it('switches style packs through one shared component implementation', () => {
    const clean = kineticHeadlineStyleFromPack(SANVERSE_CLEAN_STYLE)
    const energetic = kineticHeadlineStyleFromPack(CREATOR_ENERGETIC_STYLE)
    expect(clean.accentColor).not.toBe(energetic.accentColor)
    expect(clean.motionIntensity).toBeLessThan(energetic.motionIntensity)
    expect(KineticHeadlineModule.Component).toBeDefined()
  })
})
