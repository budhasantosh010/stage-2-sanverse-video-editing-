import { describe, expect, it } from 'vitest'

import {
  MAX_PROJECT_TICKS,
  PROJECT_TIMESCALE,
  TICKS_PER_MILLISECOND,
  compareMediaTime,
  mediaTimeFromFrames,
  mediaTimeFromMilliseconds,
  mediaTimeFromSeconds,
  rangeContains,
  rangeEnd,
  rangeWithin,
  rangesOverlap,
  toMilliseconds,
  validateMediaTime,
  validateTimeRange,
} from './time'

describe('the fixed project clock', () => {
  it('represents every timebase this product handles with whole numbers', () => {
    // 30 fps
    expect(mediaTimeFromFrames(1, { numerator: 30, denominator: 1 })).toEqual({
      ok: true,
      value: { time: { ticks: 48_000, timescale: PROJECT_TIMESCALE }, residualSeconds: 0 },
    })
    // 29.97 fps, the one that breaks decimal representations
    expect(mediaTimeFromFrames(1, { numerator: 30_000, denominator: 1001 })).toEqual({
      ok: true,
      value: { time: { ticks: 48_048, timescale: PROJECT_TIMESCALE }, residualSeconds: 0 },
    })
    // 48 kHz audio
    expect(mediaTimeFromFrames(1, { numerator: 48_000, denominator: 1 })).toEqual({
      ok: true,
      value: { time: { ticks: 30, timescale: PROJECT_TIMESCALE }, residualSeconds: 0 },
    })
    for (const rate of [24, 25, 50, 60]) {
      const frame = mediaTimeFromFrames(1, { numerator: rate, denominator: 1 })
      expect(frame).toMatchObject({ ok: true })
      if (frame.ok) expect(frame.value.residualSeconds).toBe(0)
    }
  })

  it('accumulates 29.97 fps for an hour with zero drift', () => {
    const oneHourOfFrames = 107_892 // 3600 s at 30000/1001
    const total = mediaTimeFromFrames(oneHourOfFrames, { numerator: 30_000, denominator: 1001 })
    expect(total).toMatchObject({ ok: true })
    if (!total.ok) return
    expect(total.value.residualSeconds).toBe(0)
    expect(total.value.time.ticks).toBe(oneHourOfFrames * 48_048)
    expect(Number.isSafeInteger(total.value.time.ticks)).toBe(true)
  })

  it('converts whole milliseconds exactly, which is what makes v1 migration lossless', () => {
    expect(TICKS_PER_MILLISECOND).toBe(1_440)
    expect(mediaTimeFromMilliseconds(5_000)).toEqual({
      ok: true,
      value: { ticks: 7_200_000, timescale: PROJECT_TIMESCALE },
    })
    const roundTrip = mediaTimeFromMilliseconds(1_234)
    if (!roundTrip.ok) throw new Error('setup failed')
    expect(toMilliseconds(roundTrip.value)).toBe(1_234)
  })

  it('reports the residual when real media does not divide evenly', () => {
    const converted = mediaTimeFromSeconds(1 / 3)
    expect(converted).toMatchObject({ ok: true })
    if (!converted.ok) return
    expect(Number.isSafeInteger(converted.value.time.ticks)).toBe(true)
    expect(Math.abs(converted.value.residualSeconds)).toBeLessThan(1 / PROJECT_TIMESCALE)
  })

  it('keeps a full day of ticks inside the safe integer range', () => {
    expect(Number.isSafeInteger(MAX_PROJECT_TICKS)).toBe(true)
    expect(MAX_PROJECT_TICKS).toBeLessThan(Number.MAX_SAFE_INTEGER / 1_000)
  })

  it('rejects any timescale other than the project clock', () => {
    expect(validateMediaTime({ ticks: 1, timescale: 90_000 })).toEqual({
      ok: false,
      error: { code: 'TIME_INVALID', issues: [{ path: '$.timescale', code: 'TIMESCALE_UNSUPPORTED' }] },
    })
  })

  it('rejects fractional, negative, and absurd tick counts', () => {
    expect(validateMediaTime({ ticks: 1.5, timescale: PROJECT_TIMESCALE })).toMatchObject({ ok: false })
    expect(validateMediaTime({ ticks: -1, timescale: PROJECT_TIMESCALE })).toMatchObject({ ok: false })
    expect(validateMediaTime({ ticks: MAX_PROJECT_TICKS + 1, timescale: PROJECT_TIMESCALE })).toMatchObject({ ok: false })
    expect(validateMediaTime({ ticks: 1, timescale: PROJECT_TIMESCALE, extra: 1 })).toMatchObject({ ok: false })
  })
})

describe('half-open ranges', () => {
  const range = (startMs: number, durationMs: number) => {
    const result = validateTimeRange({
      start: { ticks: startMs * TICKS_PER_MILLISECOND, timescale: PROJECT_TIMESCALE },
      duration: { ticks: durationMs * TICKS_PER_MILLISECOND, timescale: PROJECT_TIMESCALE },
    })
    if (!result.ok) throw new Error('setup failed')
    return result.value
  }

  it('includes the start instant and excludes the end instant', () => {
    const window = range(5_000, 3_000)
    expect(rangeContains(window, window.start)).toBe(true)
    expect(rangeContains(window, rangeEnd(window))).toBe(false)
  })

  it('lets neighbouring ranges touch without overlapping', () => {
    // This is the property that stops back-to-back clips from either
    // overlapping by one frame or leaving a one-frame gap.
    expect(rangesOverlap(range(0, 5_000), range(5_000, 5_000))).toBe(false)
    expect(rangesOverlap(range(0, 5_001), range(5_000, 5_000))).toBe(true)
  })

  it('checks containment for the whole span, not just the start', () => {
    expect(rangeWithin(range(1_000, 2_000), range(0, 30_000))).toBe(true)
    expect(rangeWithin(range(29_000, 2_000), range(0, 30_000))).toBe(false)
  })

  it('rejects a zero duration unless explicitly allowed', () => {
    const zero = {
      start: { ticks: 0, timescale: PROJECT_TIMESCALE },
      duration: { ticks: 0, timescale: PROJECT_TIMESCALE },
    }
    expect(validateTimeRange(zero)).toMatchObject({ ok: false })
    expect(validateTimeRange(zero, '$', { allowZeroDuration: true })).toMatchObject({ ok: true })
  })

  it('compares two times as plain integers', () => {
    const a = { ticks: 10, timescale: PROJECT_TIMESCALE } as const
    const b = { ticks: 20, timescale: PROJECT_TIMESCALE } as const
    expect(compareMediaTime(a, b)).toBe(-1)
    expect(compareMediaTime(b, a)).toBe(1)
    expect(compareMediaTime(a, a)).toBe(0)
  })
})
