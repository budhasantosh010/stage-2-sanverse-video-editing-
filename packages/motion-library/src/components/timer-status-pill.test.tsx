import { describe, expect, it } from 'vitest'
import { SANVERSE_TICKS_PER_SECOND } from '@sanverse/motion-primitives'
import { RATIO_COMPOSITIONS, evaluateDeterminism, evaluateMarkupDeterminism, renderComponentMarkup, validateDefinition, validateFixture } from '@sanverse/motion-testing'
import {
  DEFAULT_TIMER_STATUS_PILL_PROPS,
  DEFAULT_TIMER_STATUS_PILL_STYLE,
  TIMER_STATUS_PILL_DEFINITION,
  TimerStatusPillModule,
  evaluateTimerStatusPillState,
  timerStatusPillStyleFromPack,
  validateTimerStatusPillFit,
  validateTimerStatusPillProps,
} from './timer-status-pill.tsx'
import { TIMER_STATUS_PILL_FIXTURES } from '../fixtures/timer-status-pill.ts'
import { CREATOR_ENERGETIC_STYLE, SANVERSE_CLEAN_STYLE } from '../style-packs.ts'

const durationTicks = SANVERSE_TICKS_PER_SECOND * 5
const context = (localTicks: number, ratio: keyof typeof RATIO_COMPOSITIONS = '16:9', reducedMotion = false) => ({
  localTicks,
  durationTicks,
  ticksPerSecond: SANVERSE_TICKS_PER_SECOND,
  composition: RATIO_COMPOSITIONS[ratio],
  reducedMotion,
})
const atProgress = (progress: number, ratio: keyof typeof RATIO_COMPOSITIONS = '16:9', reducedMotion = false) => context(Math.round(durationTicks * progress), ratio, reducedMotion)

describe('Timer / Status Pill contract', () => {
  it('declares valid metadata and fixtures', () => {
    expect(validateDefinition(TIMER_STATUS_PILL_DEFINITION)).toEqual([])
    expect(TIMER_STATUS_PILL_FIXTURES).toHaveLength(14)
    for (const fixture of TIMER_STATUS_PILL_FIXTURES) expect(validateFixture(fixture)).toEqual([])
  })

  it('refuses invalid semantic timer ranges and modes', () => {
    for (const totalSeconds of [0, -1, 360_000, 1.5]) {
      expect(validateTimerStatusPillProps({ ...DEFAULT_TIMER_STATUS_PILL_PROPS, totalSeconds }).ok).toBe(false)
    }
    expect(validateTimerStatusPillProps({ ...DEFAULT_TIMER_STATUS_PILL_PROPS, mode: 'reverse' }).ok).toBe(false)
  })

  it('refuses overlong label/status/caption', () => {
    expect(validateTimerStatusPillProps({ ...DEFAULT_TIMER_STATUS_PILL_PROPS, label: 'L'.repeat(33) }).ok).toBe(false)
    expect(validateTimerStatusPillProps({ ...DEFAULT_TIMER_STATUS_PILL_PROPS, status: 'S'.repeat(25) }).ok).toBe(false)
    expect(validateTimerStatusPillProps({ ...DEFAULT_TIMER_STATUS_PILL_PROPS, caption: 'C'.repeat(57) }).ok).toBe(false)
  })
})

describe('Timer / Status Pill responsive fit', () => {
  it.each(['16:9', '9:16', '1:1', '4:5'] as const)('%s fits timer, labels and status above minimum sizes', (ratio) => {
    const fit = validateTimerStatusPillFit(DEFAULT_TIMER_STATUS_PILL_PROPS, atProgress(0.5, ratio))
    expect(fit.ok).toBe(true)
    if (!fit.ok) return
    expect(fit.value.pillHeight).toBeLessThanOrEqual(fit.value.maxHeight)
    expect(fit.value.label.fontSize).toBeGreaterThanOrEqual(fit.value.label.minimumFontSize)
    expect(fit.value.status.fontSize).toBeGreaterThanOrEqual(fit.value.status.minimumFontSize)
    expect(fit.value.timerFontSize).toBeGreaterThanOrEqual(fit.value.timerMinimumFontSize)
  })

  it('uses wide layout only when the composition is wide enough', () => {
    expect(validateTimerStatusPillFit(DEFAULT_TIMER_STATUS_PILL_PROPS, atProgress(0.5, '16:9'))).toMatchObject({ ok: true, value: { kind: 'wide' } })
    for (const ratio of ['9:16', '1:1', '4:5'] as const) expect(validateTimerStatusPillFit(DEFAULT_TIMER_STATUS_PILL_PROPS, atProgress(0.5, ratio))).toMatchObject({ ok: true, value: { kind: 'compact' } })
  })

  it('fits maximum supported 99:59:59 clock in portrait', () => {
    const props = { ...DEFAULT_TIMER_STATUS_PILL_PROPS, totalSeconds: 359_999, alwaysShowHours: true }
    const fit = validateTimerStatusPillFit(props, atProgress(0.5, '9:16'))
    expect(fit.ok).toBe(true)
    if (!fit.ok) return
    expect(fit.value.timerFontSize).toBeGreaterThanOrEqual(fit.value.timerMinimumFontSize)
  })

  it('refuses an impossible unbreakable label on a genuinely constrained portrait composition', () => {
    const constrained = {
      ...atProgress(0.5, '9:16'),
      composition: { width: 320, height: 568, fpsNumerator: 30, fpsDenominator: 1 },
    }
    const fit = validateTimerStatusPillFit({ ...DEFAULT_TIMER_STATUS_PILL_PROPS, label: 'X'.repeat(32) }, constrained)
    expect(fit.ok).toBe(false)
    if (fit.ok) return
    expect(fit.issues[0]).toMatchObject({ path: '$.label', code: 'CONTENT_IMPOSSIBLE' })
  })
})

describe('Timer / Status Pill direct-seek semantics', () => {
  it('maps timer-start, halfway and timer-end to exact countdown values', () => {
    expect(evaluateTimerStatusPillState(DEFAULT_TIMER_STATUS_PILL_PROPS, DEFAULT_TIMER_STATUS_PILL_STYLE, atProgress(0.12)).displayedClock).toBe('1:30')
    expect(evaluateTimerStatusPillState(DEFAULT_TIMER_STATUS_PILL_PROPS, DEFAULT_TIMER_STATUS_PILL_STYLE, atProgress(0.42)).displayedClock).toBe('0:45')
    expect(evaluateTimerStatusPillState(DEFAULT_TIMER_STATUS_PILL_PROPS, DEFAULT_TIMER_STATUS_PILL_STYLE, atProgress(0.72)).displayedClock).toBe('0:00')
  })

  it('maps the same exact points for countup without history', () => {
    const props = { ...DEFAULT_TIMER_STATUS_PILL_PROPS, mode: 'countup' as const }
    expect(evaluateTimerStatusPillState(props, DEFAULT_TIMER_STATUS_PILL_STYLE, atProgress(0.12)).displayedClock).toBe('0:00')
    expect(evaluateTimerStatusPillState(props, DEFAULT_TIMER_STATUS_PILL_STYLE, atProgress(0.42)).displayedClock).toBe('0:45')
    expect(evaluateTimerStatusPillState(props, DEFAULT_TIMER_STATUS_PILL_STYLE, atProgress(0.72)).displayedClock).toBe('1:30')
  })

  it('returns identical state at a tick revisited after arbitrary forward/backward seeks', () => {
    const tick = Math.round(durationTicks * 0.42)
    const report = evaluateDeterminism(
      (localTicks) => evaluateTimerStatusPillState(DEFAULT_TIMER_STATUS_PILL_PROPS, DEFAULT_TIMER_STATUS_PILL_STYLE, context(localTicks)),
      [0, tick, Math.round(durationTicks * 0.8), Math.round(durationTicks * 0.2), tick, durationTicks, tick],
    )
    expect(report.ok).toBe(true)
  })

  it('renders identical markup at repeated exact ticks', () => {
    const tick = Math.round(durationTicks * 0.42)
    const report = evaluateMarkupDeterminism(
      TimerStatusPillModule,
      DEFAULT_TIMER_STATUS_PILL_PROPS,
      DEFAULT_TIMER_STATUS_PILL_STYLE,
      { durationTicks, ticksPerSecond: SANVERSE_TICKS_PER_SECOND, composition: RATIO_COMPOSITIONS['16:9'], reducedMotion: false },
      [0, tick, Math.round(durationTicks * 0.9), tick],
    )
    expect(report.ok).toBe(true)
  })

  it('reduced motion preserves semantic clock while removing movement/pulse scale', () => {
    const normal = evaluateTimerStatusPillState(DEFAULT_TIMER_STATUS_PILL_PROPS, DEFAULT_TIMER_STATUS_PILL_STYLE, atProgress(0.42))
    const reduced = evaluateTimerStatusPillState(DEFAULT_TIMER_STATUS_PILL_PROPS, DEFAULT_TIMER_STATUS_PILL_STYLE, atProgress(0.42, '16:9', true))
    expect(reduced.displayedClock).toBe(normal.displayedClock)
    expect(reduced.timerProgress).toBe(normal.timerProgress)
    expect(reduced.translateY).toBe(0)
    expect(reduced.scale).toBe(1)
    expect(reduced.statusDotScale).toBe(1)
  })

  it('renders clock, progress ring and status marker', () => {
    const markup = renderComponentMarkup(TimerStatusPillModule, DEFAULT_TIMER_STATUS_PILL_PROPS, DEFAULT_TIMER_STATUS_PILL_STYLE, atProgress(0.42))
    expect(markup).toContain('data-motion-root="timer-status-pill"')
    expect(markup).toContain('data-motion-clock="true"')
    expect(markup).toContain('data-motion-progress-ring="true"')
    expect(markup).toContain('data-motion-text="timer-status"')
  })

  it('uses shared style tokens without replacing the component', () => {
    const clean = timerStatusPillStyleFromPack(SANVERSE_CLEAN_STYLE)
    const energetic = timerStatusPillStyleFromPack(CREATOR_ENERGETIC_STYLE)
    expect(clean.accentColor).not.toBe(energetic.accentColor)
    expect(clean.motionIntensity).toBeLessThan(energetic.motionIntensity)
    expect(TimerStatusPillModule.Component).toBeDefined()
  })
})
