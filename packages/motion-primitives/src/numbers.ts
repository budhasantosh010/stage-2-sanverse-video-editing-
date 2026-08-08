import { clamp01, lerp } from './math.ts'

export type NumberRounding = 'none' | 'integer' | 'tenths' | 'hundredths'

export const interpolateNumber = (
  start: number,
  end: number,
  progress: number,
  rounding: NumberRounding = 'none',
): number => {
  if (!Number.isFinite(start) || !Number.isFinite(end)) throw new RangeError('start and end must be finite numbers.')
  const value = lerp(start, end, clamp01(progress))
  if (rounding === 'integer') return Math.round(value)
  if (rounding === 'tenths') return Math.round(value * 10) / 10
  if (rounding === 'hundredths') return Math.round(value * 100) / 100
  return value
}

const trimTrailingZeros = (value: string): string => value.replace(/\.0+$/u, '').replace(/(\.\d*?[1-9])0+$/u, '$1')

export const formatCompactNumber = (
  value: number,
  maximumFractionDigits = 1,
): string => {
  if (!Number.isFinite(value)) throw new RangeError('value must be finite.')
  if (!Number.isSafeInteger(maximumFractionDigits) || maximumFractionDigits < 0 || maximumFractionDigits > 3) {
    throw new RangeError('maximumFractionDigits must be an integer inside [0, 3].')
  }
  const sign = value < 0 ? '-' : ''
  const absolute = Math.abs(value)
  const groups = [
    { threshold: 1_000_000_000, suffix: 'B' },
    { threshold: 1_000_000, suffix: 'M' },
    { threshold: 1_000, suffix: 'K' },
  ] as const
  for (const group of groups) {
    if (absolute >= group.threshold) {
      const scaled = absolute / group.threshold
      return `${sign}${trimTrailingZeros(scaled.toFixed(maximumFractionDigits))}${group.suffix}`
    }
  }
  const rounded = maximumFractionDigits === 0
    ? Math.round(absolute).toString()
    : trimTrailingZeros(absolute.toFixed(maximumFractionDigits))
  return `${sign}${rounded}`
}

export const formatSignedDelta = (
  value: number,
  maximumFractionDigits = 1,
): string => `${value >= 0 ? '+' : ''}${formatCompactNumber(value, maximumFractionDigits)}`

export const formatClockSeconds = (
  totalSeconds: number,
  options: Readonly<{ alwaysShowHours?: boolean }> = {},
): string => {
  if (!Number.isSafeInteger(totalSeconds) || totalSeconds < 0) {
    throw new RangeError('totalSeconds must be a non-negative safe integer.')
  }
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60
  const pad2 = (value: number) => value.toString().padStart(2, '0')
  if (hours > 0 || options.alwaysShowHours) return `${hours}:${pad2(minutes)}:${pad2(seconds)}`
  return `${minutes}:${pad2(seconds)}`
}
