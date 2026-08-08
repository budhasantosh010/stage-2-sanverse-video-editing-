import { describe, expect, it } from 'vitest'
import { formatClockSeconds, formatCompactNumber, formatSignedDelta, interpolateNumber } from './numbers.ts'

describe('deterministic numeric primitives', () => {
  it('interpolates directly from progress without previous-frame state', () => {
    expect(interpolateNumber(0, 100, 0.25, 'integer')).toBe(25)
    expect(interpolateNumber(100, 0, 0.25, 'integer')).toBe(75)
    const repeated = interpolateNumber(1200, 24_000, 0.4375, 'tenths')
    interpolateNumber(1200, 24_000, 0.9, 'tenths')
    expect(interpolateNumber(1200, 24_000, 0.4375, 'tenths')).toBe(repeated)
  })

  it('clamps progress at exact boundaries', () => {
    expect(interpolateNumber(5, 10, -2, 'integer')).toBe(5)
    expect(interpolateNumber(5, 10, 3, 'integer')).toBe(10)
  })

  it('formats compact magnitudes without locale dependence', () => {
    expect(formatCompactNumber(999, 1)).toBe('999')
    expect(formatCompactNumber(1_200, 1)).toBe('1.2K')
    expect(formatCompactNumber(24_000, 1)).toBe('24K')
    expect(formatCompactNumber(1_250_000, 2)).toBe('1.25M')
    expect(formatCompactNumber(2_000_000_000, 1)).toBe('2B')
  })

  it('preserves sign and trims trailing zeros', () => {
    expect(formatCompactNumber(-1_500, 2)).toBe('-1.5K')
    expect(formatSignedDelta(12_000, 1)).toBe('+12K')
    expect(formatSignedDelta(-500, 1)).toBe('-500')
  })

  it('formats exact clock seconds without locale or wall-clock state', () => {
    expect(formatClockSeconds(0)).toBe('0:00')
    expect(formatClockSeconds(65)).toBe('1:05')
    expect(formatClockSeconds(3_661)).toBe('1:01:01')
    expect(formatClockSeconds(65, { alwaysShowHours: true })).toBe('0:01:05')
    expect(formatClockSeconds(65)).toBe(formatClockSeconds(65))
  })

  it('refuses non-finite values, invalid precision and invalid clock seconds', () => {
    expect(() => formatCompactNumber(Number.NaN)).toThrow(/finite/)
    expect(() => formatCompactNumber(100, 4)).toThrow(/inside/)
    expect(() => formatClockSeconds(-1)).toThrow(/non-negative/)
    expect(() => formatClockSeconds(1.5)).toThrow(/safe integer/)
  })
})
