import { err, isRecord, ok, type Result } from './result.ts'

/**
 * One fixed clock for every project.
 *
 * 1,440,000 ticks per second represents every timebase this product handles
 * exactly, with whole numbers:
 *
 *   30 fps        -> 48,000 ticks per frame
 *   30000/1001    -> 48,048 ticks per frame   (so-called 29.97)
 *   24 / 25 / 50 / 60 fps -> exact
 *   48,000 Hz audio -> 30 ticks per sample
 *   1 millisecond -> 1,440 ticks             (so v1 data migrates losslessly)
 *
 * Because the timescale never varies, comparing two times is comparing two
 * integers. There is no cross-multiplication, no overflow path, and no
 * rounding policy inside the domain. Media whose native timebase does not
 * divide this number is converted once, at import, by the asset adapter, which
 * records the residual error on the asset.
 */
export const PROJECT_TIMESCALE = 1_440_000

/** 24 hours. Far below Number.MAX_SAFE_INTEGER (about 9.0e15). */
export const MAX_PROJECT_TICKS = PROJECT_TIMESCALE * 60 * 60 * 24

export const TICKS_PER_MILLISECOND = PROJECT_TIMESCALE / 1000

export type MediaTime = Readonly<{
  ticks: number
  timescale: typeof PROJECT_TIMESCALE
}>

export type TimeRange = Readonly<{
  start: MediaTime
  duration: MediaTime
}>

export type TimeIssueCode =
  | 'TYPE_INVALID'
  | 'FIELD_REQUIRED'
  | 'FIELD_UNKNOWN'
  | 'TICKS_NOT_INTEGER'
  | 'TICKS_NEGATIVE'
  | 'TICKS_TOO_LARGE'
  | 'TIMESCALE_UNSUPPORTED'
  | 'DURATION_NOT_POSITIVE'

export type TimeError = {
  readonly code: 'TIME_INVALID'
  readonly issues: readonly { readonly path: string; readonly code: TimeIssueCode }[]
}

const timeError = (path: string, code: TimeIssueCode): TimeError => ({
  code: 'TIME_INVALID',
  issues: [{ path, code }],
})

/** Construct a time from ticks. Throws only on programmer error. */
export const mediaTime = (ticks: number): MediaTime => {
  const validated = validateMediaTime({ ticks, timescale: PROJECT_TIMESCALE })
  if (!validated.ok) {
    throw new RangeError(`Invalid media time: ${validated.error.issues[0]?.code ?? 'UNKNOWN'}`)
  }
  return validated.value
}

export const ZERO_TIME: MediaTime = Object.freeze({ ticks: 0, timescale: PROJECT_TIMESCALE })

export const validateMediaTime = (input: unknown, path = '$'): Result<MediaTime, TimeError> => {
  if (!isRecord(input)) return err(timeError(path, 'TYPE_INVALID'))
  const keys = Object.keys(input)
  if (!Object.hasOwn(input, 'ticks')) return err(timeError(`${path}.ticks`, 'FIELD_REQUIRED'))
  if (!Object.hasOwn(input, 'timescale')) return err(timeError(`${path}.timescale`, 'FIELD_REQUIRED'))
  if (keys.length !== 2) {
    const unknown = keys.find((key) => key !== 'ticks' && key !== 'timescale') ?? ''
    return err(timeError(`${path}.${unknown}`, 'FIELD_UNKNOWN'))
  }
  if (input.timescale !== PROJECT_TIMESCALE) {
    return err(timeError(`${path}.timescale`, 'TIMESCALE_UNSUPPORTED'))
  }
  const ticks = input.ticks
  if (typeof ticks !== 'number' || !Number.isFinite(ticks)) {
    return err(timeError(`${path}.ticks`, 'TYPE_INVALID'))
  }
  if (!Number.isSafeInteger(ticks)) return err(timeError(`${path}.ticks`, 'TICKS_NOT_INTEGER'))
  if (ticks < 0) return err(timeError(`${path}.ticks`, 'TICKS_NEGATIVE'))
  if (ticks > MAX_PROJECT_TICKS) return err(timeError(`${path}.ticks`, 'TICKS_TOO_LARGE'))
  return ok(Object.freeze({ ticks, timescale: PROJECT_TIMESCALE }))
}

export const validateTimeRange = (
  input: unknown,
  path = '$',
  options: { readonly allowZeroDuration?: boolean } = {},
): Result<TimeRange, TimeError> => {
  if (!isRecord(input)) return err(timeError(path, 'TYPE_INVALID'))
  const keys = Object.keys(input)
  if (!Object.hasOwn(input, 'start')) return err(timeError(`${path}.start`, 'FIELD_REQUIRED'))
  if (!Object.hasOwn(input, 'duration')) return err(timeError(`${path}.duration`, 'FIELD_REQUIRED'))
  if (keys.length !== 2) {
    const unknown = keys.find((key) => key !== 'start' && key !== 'duration') ?? ''
    return err(timeError(`${path}.${unknown}`, 'FIELD_UNKNOWN'))
  }
  const start = validateMediaTime(input.start, `${path}.start`)
  if (!start.ok) return start
  const duration = validateMediaTime(input.duration, `${path}.duration`)
  if (!duration.ok) return duration
  if (!options.allowZeroDuration && duration.value.ticks <= 0) {
    return err(timeError(`${path}.duration`, 'DURATION_NOT_POSITIVE'))
  }
  if (start.value.ticks + duration.value.ticks > MAX_PROJECT_TICKS) {
    return err(timeError(`${path}.duration`, 'TICKS_TOO_LARGE'))
  }
  return ok(Object.freeze({ start: start.value, duration: duration.value }))
}

export const compareMediaTime = (a: MediaTime, b: MediaTime): -1 | 0 | 1 =>
  a.ticks < b.ticks ? -1 : a.ticks > b.ticks ? 1 : 0

export const addMediaTime = (a: MediaTime, b: MediaTime): MediaTime => mediaTime(a.ticks + b.ticks)

export const subtractMediaTime = (a: MediaTime, b: MediaTime): MediaTime => mediaTime(a.ticks - b.ticks)

/** Exclusive end of a half-open range: `[start, start + duration)`. */
export const rangeEnd = (range: TimeRange): MediaTime =>
  mediaTime(range.start.ticks + range.duration.ticks)

/** Half-open containment. The end instant is deliberately outside the range. */
export const rangeContains = (range: TimeRange, time: MediaTime): boolean =>
  time.ticks >= range.start.ticks && time.ticks < range.start.ticks + range.duration.ticks

export const rangesOverlap = (a: TimeRange, b: TimeRange): boolean =>
  a.start.ticks < b.start.ticks + b.duration.ticks && b.start.ticks < a.start.ticks + a.duration.ticks

/** `[a.start, a.end) ⊆ [b.start, b.end)`. */
export const rangeWithin = (inner: TimeRange, outer: TimeRange): boolean =>
  inner.start.ticks >= outer.start.ticks &&
  inner.start.ticks + inner.duration.ticks <= outer.start.ticks + outer.duration.ticks

/**
 * Exact for every whole millisecond, because PROJECT_TIMESCALE / 1000 = 1440.
 * This is what makes the v1 project migration lossless.
 */
export const mediaTimeFromMilliseconds = (milliseconds: number): Result<MediaTime, TimeError> => {
  if (typeof milliseconds !== 'number' || !Number.isFinite(milliseconds)) {
    return err(timeError('$', 'TYPE_INVALID'))
  }
  if (!Number.isInteger(milliseconds)) return err(timeError('$', 'TICKS_NOT_INTEGER'))
  return validateMediaTime({ ticks: milliseconds * TICKS_PER_MILLISECOND, timescale: PROJECT_TIMESCALE })
}

export type TimeConversion = Readonly<{
  time: MediaTime
  /** Signed seconds lost by rounding. Exactly 0 for every exact timebase. */
  residualSeconds: number
}>

/**
 * The single rounding boundary in the system. Only adapters that read real
 * media call this; the domain never rounds.
 */
export const mediaTimeFromSeconds = (seconds: number): Result<TimeConversion, TimeError> => {
  if (typeof seconds !== 'number' || !Number.isFinite(seconds)) {
    return err(timeError('$', 'TYPE_INVALID'))
  }
  const ticks = Math.round(seconds * PROJECT_TIMESCALE)
  const validated = validateMediaTime({ ticks, timescale: PROJECT_TIMESCALE })
  if (!validated.ok) return validated
  return ok(Object.freeze({
    time: validated.value,
    residualSeconds: seconds - ticks / PROJECT_TIMESCALE,
  }))
}

/** Exact when `PROJECT_TIMESCALE * denominator` divides evenly by `numerator`. */
export const mediaTimeFromFrames = (
  frameCount: number,
  frameRate: Readonly<{ numerator: number; denominator: number }>,
): Result<TimeConversion, TimeError> => {
  if (!Number.isSafeInteger(frameCount) || frameCount < 0) return err(timeError('$', 'TICKS_NOT_INTEGER'))
  if (!Number.isSafeInteger(frameRate.numerator) || frameRate.numerator <= 0) {
    return err(timeError('$.numerator', 'TYPE_INVALID'))
  }
  if (!Number.isSafeInteger(frameRate.denominator) || frameRate.denominator <= 0) {
    return err(timeError('$.denominator', 'TYPE_INVALID'))
  }
  const exactTicks = (frameCount * PROJECT_TIMESCALE * frameRate.denominator) / frameRate.numerator
  const ticks = Math.round(exactTicks)
  const validated = validateMediaTime({ ticks, timescale: PROJECT_TIMESCALE })
  if (!validated.ok) return validated
  return ok(Object.freeze({
    time: validated.value,
    residualSeconds: (exactTicks - ticks) / PROJECT_TIMESCALE,
  }))
}

/** Derived view for display only. Never serialize the result. */
export const toSeconds = (time: MediaTime): number => time.ticks / PROJECT_TIMESCALE

/** Derived view for display and for legacy millisecond boundaries. */
export const toMilliseconds = (time: MediaTime): number => time.ticks / TICKS_PER_MILLISECOND
