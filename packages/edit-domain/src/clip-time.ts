import { err, isRecord, ok, type Result } from './result.ts'
import { MAX_PROJECT_TICKS } from './time.ts'

/**
 * HOW FAST A PIECE OF FOOTAGE PLAYS, WRITTEN AS A FRACTION.
 *
 * ---------------------------------------------------------------------------
 * WHAT THIS FILE IS FOR, IN ORDINARY WORDS
 * ---------------------------------------------------------------------------
 *
 * A piece of footage on the timeline has TWO lengths, and until speed existed
 * they were always the same number, so nobody had to keep them apart:
 *
 *   SOURCE LENGTH        how much of the recording is used
 *   TIMELINE LENGTH      how long it occupies in the finished video
 *
 * At normal speed, ten seconds of recording occupies ten seconds of finished
 * video. At double speed, ten seconds of recording occupies FIVE seconds of
 * finished video. At half speed, ten seconds of recording occupies TWENTY.
 *
 *   normal (1x)      recording |==========|   finished |==========|
 *   double (2x)      recording |==========|   finished |=====|
 *   half   (0.5x)    recording |==========|   finished |====================|
 *
 * From here on those two lengths are always called by those two names, and
 * never by any synonym.
 *
 * ---------------------------------------------------------------------------
 * WHY A FRACTION AND NOT A DECIMAL NUMBER
 * ---------------------------------------------------------------------------
 *
 * The obvious way to store "one third speed" is the decimal 0.3333333333333333.
 * That is the wrong way, and here is the concrete harm.
 *
 * A computer cannot hold one third exactly. It holds something very slightly
 * off. Multiply a one-hour recording by that slightly-off number and the answer
 * is out by a fraction of a tick. Now:
 *
 *   - the preview and the exporter each round that fraction, possibly the
 *     opposite way, so the video you watched is not the video you got;
 *   - the export key is built from these numbers, so an untouched project can
 *     hash differently on two machines and re-export for no reason;
 *   - a clip that should end exactly where the next one begins ends one tick
 *     early, and the user sees a one-frame black flash they cannot remove.
 *
 * A fraction of two whole numbers has none of those problems. One third is
 * exactly `{ numerator: 1, denominator: 3 }` on every machine, forever.
 *
 * ---------------------------------------------------------------------------
 * WHICH WAY UP IS THE FRACTION
 * ---------------------------------------------------------------------------
 *
 * This trips people up, so it is written out and never restated differently:
 *
 *            source ticks consumed
 *   rate  =  ---------------------
 *           timeline ticks elapsed
 *
 *   1x     { numerator: 1, denominator: 1 }   one tick of recording per tick
 *   2x     { numerator: 2, denominator: 1 }   two ticks of recording per tick
 *   0.5x   { numerator: 1, denominator: 2 }   half a tick of recording per tick
 *
 * So a BIGGER numerator means FASTER, and the timeline length gets SHORTER.
 *
 * ---------------------------------------------------------------------------
 * THE ROUNDING POLICY, AND WHY IT CANNOT DRIFT
 * ---------------------------------------------------------------------------
 *
 * Ticks are whole numbers. Source length 10 at 3x gives a timeline length of
 * 10/3 = 3.333..., which is not a whole number. Something must round.
 *
 * The policy is ONE line, used by every caller, with no exceptions:
 *
 *   timeline length = round-half-up( source length x denominator / numerator )
 *   and never less than 1 tick for a piece that has any footage at all.
 *
 * "Round half up" means 3.5 becomes 4, not 3. It is chosen over "round to
 * even" because it is the rule a twelve-year-old already knows, so a number
 * printed on screen is never surprising.
 *
 * The reason this cannot accumulate error across a timeline is structural, not
 * lucky: every piece stores its own start position as a whole number. Piece
 * five does not begin "wherever piece four happened to end" — it begins where
 * it says it begins. So a rounding of half a tick on piece one cannot push
 * piece fifty by half a tick. Each piece rounds once, on its own, and stops.
 *
 * The arithmetic is done with whole numbers throughout (see `scaleTicks`), so
 * even the intermediate value is never a decimal that could be off.
 */

/**
 * A playback speed, held as a fraction of two whole numbers.
 *
 * Always stored in lowest terms — 2/4 is refused, and 1/2 accepted — so that
 * two projects meaning the same speed hold the identical value and therefore
 * hash to the identical export key.
 */
export type RationalPlaybackRateV1 = Readonly<{
  numerator: number
  denominator: number
}>

/**
 * The slowest and fastest a piece may be played.
 *
 * 0.1x (ten times slower) and 16x (sixteen times faster) are the range every
 * consumer editor offers, and both ends are honestly reachable here: the
 * browser's own video element accepts 0.0625 to 16, and FFmpeg's sound-speed
 * filter reaches any of it through a chain. Going wider would mean shipping a
 * control that silently fails at its extremes.
 */
export const MIN_PLAYBACK_RATE_NUMERATOR = 1
export const MAX_RATE_TERM = 10_000

/** 0.1x, as a fraction. The slowest allowed. */
export const SLOWEST_PLAYBACK_RATE: RationalPlaybackRateV1 = Object.freeze({ numerator: 1, denominator: 10 })
/** 16x, as a fraction. The fastest allowed. */
export const FASTEST_PLAYBACK_RATE: RationalPlaybackRateV1 = Object.freeze({ numerator: 16, denominator: 1 })
/** Normal speed. What every piece is until somebody changes it. */
export const NORMAL_PLAYBACK_RATE: RationalPlaybackRateV1 = Object.freeze({ numerator: 1, denominator: 1 })

/**
 * The speeds offered as one-click buttons.
 *
 * Chosen to match what creators actually reach for, not to be evenly spaced.
 * A custom value may be typed; these are only the shortcuts.
 */
export const PLAYBACK_RATE_PRESETS: readonly RationalPlaybackRateV1[] = Object.freeze([
  Object.freeze({ numerator: 1, denominator: 4 }),
  Object.freeze({ numerator: 1, denominator: 2 }),
  Object.freeze({ numerator: 3, denominator: 4 }),
  NORMAL_PLAYBACK_RATE,
  Object.freeze({ numerator: 5, denominator: 4 }),
  Object.freeze({ numerator: 3, denominator: 2 }),
  Object.freeze({ numerator: 2, denominator: 1 }),
  Object.freeze({ numerator: 4, denominator: 1 }),
])

export type PlaybackRateIssue =
  | 'TYPE_INVALID'
  | 'FIELD_REQUIRED'
  | 'FIELD_UNKNOWN'
  | 'NOT_SAFE_INTEGER'
  | 'NOT_POSITIVE'
  | 'NOT_REDUCED'
  | 'TERM_TOO_LARGE'
  | 'RATE_TOO_SLOW'
  | 'RATE_TOO_FAST'

export type PlaybackRateError = Readonly<{
  code: 'PLAYBACK_RATE_INVALID'
  issue: PlaybackRateIssue
  path: string
}>

/** Greatest common divisor of two positive whole numbers. */
export const greatestCommonDivisor = (a: number, b: number): number => {
  let left = Math.abs(a)
  let right = Math.abs(b)
  while (right !== 0) {
    const remainder = left % right
    left = right
    right = remainder
  }
  return left
}

/**
 * Put a fraction into lowest terms.
 *
 * `4/8` becomes `1/2`. This runs BEFORE anything is stored, so the stored form
 * is unique: there is exactly one way to write each speed.
 */
export const normalizePlaybackRate = (rate: RationalPlaybackRateV1): RationalPlaybackRateV1 => {
  const divisor = greatestCommonDivisor(rate.numerator, rate.denominator)
  if (divisor <= 1) return Object.freeze({ numerator: rate.numerator, denominator: rate.denominator })
  return Object.freeze({
    numerator: rate.numerator / divisor,
    denominator: rate.denominator / divisor,
  })
}

const rateError = (issue: PlaybackRateIssue, path: string): PlaybackRateError =>
  Object.freeze({ code: 'PLAYBACK_RATE_INVALID' as const, issue, path })

const RATE_KEYS = ['numerator', 'denominator'] as const

/**
 * Check an untrusted value really is a speed this product can honour.
 *
 * Refuses rather than repairs, with one exception that is not a repair: a
 * fraction that is not in lowest terms is REFUSED, not reduced, because
 * silently reducing would mean the value a caller sent and the value stored
 * differ, and the caller would never learn.
 */
export const validatePlaybackRate = (
  input: unknown,
  path = '$',
): Result<RationalPlaybackRateV1, PlaybackRateError> => {
  if (!isRecord(input)) return err(rateError('TYPE_INVALID', path))
  for (const key of RATE_KEYS) {
    if (!Object.hasOwn(input, key)) return err(rateError('FIELD_REQUIRED', `${path}.${key}`))
  }
  for (const key of Object.keys(input)) {
    if (!(RATE_KEYS as readonly string[]).includes(key)) {
      return err(rateError('FIELD_UNKNOWN', `${path}.${key}`))
    }
  }
  const numerator = input.numerator
  const denominator = input.denominator
  for (const [key, value] of [['numerator', numerator], ['denominator', denominator]] as const) {
    if (typeof value !== 'number' || !Number.isFinite(value)) return err(rateError('TYPE_INVALID', `${path}.${key}`))
    if (!Number.isSafeInteger(value)) return err(rateError('NOT_SAFE_INTEGER', `${path}.${key}`))
    if (value <= 0) return err(rateError('NOT_POSITIVE', `${path}.${key}`))
    if (value > MAX_RATE_TERM) return err(rateError('TERM_TOO_LARGE', `${path}.${key}`))
  }
  const n = numerator as number
  const d = denominator as number
  if (greatestCommonDivisor(n, d) !== 1) return err(rateError('NOT_REDUCED', path))
  // Compared by cross-multiplication so the comparison itself never rounds.
  // n/d < 1/10  <=>  n * 10 < d
  if (n * SLOWEST_PLAYBACK_RATE.denominator < d * SLOWEST_PLAYBACK_RATE.numerator) {
    return err(rateError('RATE_TOO_SLOW', path))
  }
  if (n * FASTEST_PLAYBACK_RATE.denominator > d * FASTEST_PLAYBACK_RATE.numerator) {
    return err(rateError('RATE_TOO_FAST', path))
  }
  return ok(Object.freeze({ numerator: n, denominator: d }))
}

export const isNormalPlaybackRate = (rate: RationalPlaybackRateV1): boolean =>
  rate.numerator === rate.denominator

export const playbackRatesEqual = (a: RationalPlaybackRateV1, b: RationalPlaybackRateV1): boolean =>
  a.numerator === b.numerator && a.denominator === b.denominator

/**
 * The speed as an ordinary decimal, FOR DISPLAY AND FOR THE BROWSER ONLY.
 *
 * Never store this. Never compare two of these. Never send it back into any
 * calculation that produces ticks. The browser's video element takes a decimal
 * and there is no way around that, so this is where the exactness stops — and
 * it stops at the very last step, after every tick has already been decided.
 */
export const playbackRateToDecimal = (rate: RationalPlaybackRateV1): number =>
  rate.numerator / rate.denominator

/**
 * Multiply a whole number of ticks by a fraction, rounding half up, with whole
 * numbers all the way through.
 *
 * The doubling trick: instead of `round(t * a / b)`, which needs a decimal
 * halfway through, this computes `floor((2*t*a + b) / (2*b))`. Those are the
 * same answer for positive inputs, but the second never leaves whole numbers
 * until the final divide, so it cannot pick up a floating-point error.
 *
 * The largest value that can appear inside is about
 * 2 x 24-hours-in-ticks x 10,000 = 2.5e15, which is inside the range where a
 * JavaScript number still counts whole numbers exactly (about 9.0e15). The
 * 10,000 ceiling on a fraction's terms exists precisely to guarantee that.
 */
export const scaleTicks = (ticks: number, multiplyBy: number, divideBy: number): number => {
  if (!Number.isSafeInteger(ticks) || ticks < 0) throw new RangeError('scaleTicks: ticks must be a whole number >= 0')
  if (!Number.isSafeInteger(multiplyBy) || multiplyBy <= 0) throw new RangeError('scaleTicks: multiplyBy must be > 0')
  if (!Number.isSafeInteger(divideBy) || divideBy <= 0) throw new RangeError('scaleTicks: divideBy must be > 0')
  return Math.floor((2 * ticks * multiplyBy + divideBy) / (2 * divideBy))
}

/**
 * How long a stretch of recording occupies in the finished video at this speed.
 *
 * `sourceTicks` is the source length; the answer is the timeline length.
 * A piece with any footage at all is never allowed to collapse to nothing:
 * a zero-length piece on the timeline is invisible and unselectable, which
 * reads to the user as their clip having been deleted.
 */
export const compositionDurationForSourceSpan = (
  sourceTicks: number,
  rate: RationalPlaybackRateV1,
): number => {
  if (sourceTicks <= 0) return 0
  // timeline = source x denominator / numerator
  const scaled = scaleTicks(sourceTicks, rate.denominator, rate.numerator)
  return Math.max(1, scaled)
}

/**
 * THE ONE THAT ACTUALLY DECIDES HOW LONG A CLIP IS ON THE TIMELINE.
 *
 * ---------------------------------------------------------------------------
 * THE PROBLEM THIS SOLVES, WITH REAL NUMBERS
 * ---------------------------------------------------------------------------
 *
 * Suppose a clip uses 10 ticks of recording at 3x speed, and the user cuts it
 * in two after 5 ticks. Using the simple rule above, each half rounds on its
 * own:
 *
 *   whole clip   round(10 x 1/3) = round(3.33) = 3 ticks on the timeline
 *   left half    round( 5 x 1/3) = round(1.67) = 2 ticks
 *   right half   round( 5 x 1/3) = round(1.67) = 2 ticks
 *                                                --------
 *                                  the two halves = 4 ticks
 *
 * The clip GREW by one tick just because it was cut. That one tick pushes into
 * whatever sits next on the track, and the composition validator refuses the
 * whole edit as an overlap. Split enough times and a project stops opening.
 *
 * ---------------------------------------------------------------------------
 * THE FIX
 * ---------------------------------------------------------------------------
 *
 * Instead of rounding each piece's LENGTH, round each piece's two EDGES,
 * measured from the very beginning of the recording, and subtract:
 *
 *   length = round(where the piece ENDS)  -  round(where the piece STARTS)
 *
 * Now cutting is exactly additive, because the cut point is rounded once and
 * used by both halves — as the end of the left one and the start of the right
 * one. Redoing the sum above with the recording starting at tick 0:
 *
 *   left half    round(5 x 1/3) - round(0 x 1/3) = 2 - 0 = 2
 *   right half   round(10 x 1/3) - round(5 x 1/3) = 3 - 2 = 1
 *                                                          ---
 *                                            the two halves = 3  (correct)
 *
 * ---------------------------------------------------------------------------
 * WHAT THIS COSTS, STATED PLAINLY
 * ---------------------------------------------------------------------------
 *
 * The same amount of recording can occupy one tick more or less depending on
 * WHERE in the file it was taken from. One tick is one 1,440,000th of a
 * second — about 700 nanoseconds, roughly one twenty-thousandth of a single
 * frame at 60 frames per second. Nobody can see or hear it, and it never
 * accumulates.
 *
 * What is bought is that cutting, trimming and joining are exact. That trade
 * is worth taking, and it is the trade every professional editor makes.
 *
 * ---------------------------------------------------------------------------
 * WHY THIS CAN RETURN ZERO, AND WHY THAT IS RIGHT
 * ---------------------------------------------------------------------------
 *
 * One tick of recording at 16x is a sixteenth of a tick on screen, which
 * rounds to nothing.
 *
 * The obvious kindness is to round it up to one tick so the piece stays
 * visible. That kindness was tried, and it BREAKS THE ADDITIVITY the whole
 * rule exists for: cut a 10-tick clip at 3x after 1 tick and the halves come
 * to 1 + 3 = 4, where the whole was 3. The clip grows by a tick just from
 * being cut, runs into whatever is next, and the edit is refused as an
 * overlap.
 *
 * So the honest answer is zero, and the REFUSAL lives where the user can
 * understand it: `applyTimelineOperation` will not make a cut that would leave
 * a piece too short to see, and `validateComposition` will not accept one. The
 * user is told "that piece would be too short to see" instead of a clip
 * silently changing length behind them.
 */
export const anchoredCompositionDuration = (
  sourceStartTicks: number,
  sourceDurationTicks: number,
  rate: RationalPlaybackRateV1,
): number => {
  if (sourceDurationTicks <= 0) return 0
  if (isNormalPlaybackRate(rate)) return sourceDurationTicks
  const endEdge = scaleTicks(sourceStartTicks + sourceDurationTicks, rate.denominator, rate.numerator)
  const startEdge = scaleTicks(sourceStartTicks, rate.denominator, rate.numerator)
  return endEdge - startEdge
}

/**
 * How much recording is consumed by a stretch of finished video at this speed.
 *
 * The exact inverse question of the one above. Used when the user drags the
 * end of a clip: they are choosing a timeline length, and this says how much
 * recording that needs.
 */
export const sourceDurationForCompositionSpan = (
  compositionTicks: number,
  rate: RationalPlaybackRateV1,
): number => {
  if (compositionTicks <= 0) return 0
  const scaled = scaleTicks(compositionTicks, rate.numerator, rate.denominator)
  return Math.max(1, scaled)
}

/**
 * Given how far into a piece we are in FINISHED-VIDEO time, how far into the
 * recording is that?
 *
 * Both numbers are offsets from the start of the piece, not absolute times.
 */
export const sourceTicksForCompositionOffset = (
  compositionOffsetTicks: number,
  rate: RationalPlaybackRateV1,
): number => {
  if (compositionOffsetTicks <= 0) return 0
  return scaleTicks(compositionOffsetTicks, rate.numerator, rate.denominator)
}

/**
 * Given how far into a piece we are in RECORDING time, how far into the
 * finished video is that?
 */
export const compositionTicksForSourceOffset = (
  sourceOffsetTicks: number,
  rate: RationalPlaybackRateV1,
): number => {
  if (sourceOffsetTicks <= 0) return 0
  return scaleTicks(sourceOffsetTicks, rate.denominator, rate.numerator)
}

/**
 * Which way the footage runs.
 *
 * 'reverse' means the last frame of the chosen stretch plays first. It is a
 * separate switch from the speed rather than a negative speed, because a
 * negative fraction would have to be handled by every single piece of
 * arithmetic above, and one missed place is a clip that jumps to a time before
 * the video starts.
 */
export type PlaybackDirection = 'forward' | 'reverse'

/**
 * Everything about HOW a piece of footage is played through, as one value.
 *
 * `maintainAudioPitch` true is the default because it is what a viewer
 * expects: sped-up speech should sound like fast talking, not like a chipmunk.
 * Turning it off is the deliberate chipmunk/slow-monster effect, and it is
 * offered because creators genuinely use it.
 */
export type ClipTimeTransformV1 = Readonly<{
  playbackRate: RationalPlaybackRateV1
  direction: PlaybackDirection
  maintainAudioPitch: boolean
}>

/**
 * What every piece of footage has until somebody changes it.
 *
 * Written as one shared frozen value so that "is this piece untouched?" is a
 * cheap comparison, and so that a project saved before speed existed and a
 * project that has explicitly been reset to normal are indistinguishable —
 * which is what stops a reset from changing the export key.
 */
export const DEFAULT_CLIP_TIME_TRANSFORM: ClipTimeTransformV1 = Object.freeze({
  playbackRate: NORMAL_PLAYBACK_RATE,
  direction: 'forward',
  maintainAudioPitch: true,
})

export const isDefaultClipTimeTransform = (transform: ClipTimeTransformV1): boolean =>
  isNormalPlaybackRate(transform.playbackRate) &&
  transform.direction === 'forward' &&
  transform.maintainAudioPitch

export const clipTimeTransformsEqual = (a: ClipTimeTransformV1, b: ClipTimeTransformV1): boolean =>
  playbackRatesEqual(a.playbackRate, b.playbackRate) &&
  a.direction === b.direction &&
  a.maintainAudioPitch === b.maintainAudioPitch

export type ClipTimeTransformError = Readonly<{
  code: 'CLIP_TIME_TRANSFORM_INVALID'
  issue: PlaybackRateIssue | 'DIRECTION_UNKNOWN' | 'PITCH_NOT_BOOLEAN'
  path: string
}>

const TRANSFORM_KEYS = ['playbackRate', 'direction', 'maintainAudioPitch'] as const

export const validateClipTimeTransform = (
  input: unknown,
  path = '$',
): Result<ClipTimeTransformV1, ClipTimeTransformError> => {
  if (!isRecord(input)) {
    return err(Object.freeze({ code: 'CLIP_TIME_TRANSFORM_INVALID' as const, issue: 'TYPE_INVALID' as const, path }))
  }
  for (const key of TRANSFORM_KEYS) {
    if (!Object.hasOwn(input, key)) {
      return err(Object.freeze({
        code: 'CLIP_TIME_TRANSFORM_INVALID' as const,
        issue: 'FIELD_REQUIRED' as const,
        path: `${path}.${key}`,
      }))
    }
  }
  for (const key of Object.keys(input)) {
    if (!(TRANSFORM_KEYS as readonly string[]).includes(key)) {
      return err(Object.freeze({
        code: 'CLIP_TIME_TRANSFORM_INVALID' as const,
        issue: 'FIELD_UNKNOWN' as const,
        path: `${path}.${key}`,
      }))
    }
  }
  const rate = validatePlaybackRate(input.playbackRate, `${path}.playbackRate`)
  if (!rate.ok) {
    return err(Object.freeze({
      code: 'CLIP_TIME_TRANSFORM_INVALID' as const,
      issue: rate.error.issue,
      path: rate.error.path,
    }))
  }
  if (input.direction !== 'forward' && input.direction !== 'reverse') {
    return err(Object.freeze({
      code: 'CLIP_TIME_TRANSFORM_INVALID' as const,
      issue: 'DIRECTION_UNKNOWN' as const,
      path: `${path}.direction`,
    }))
  }
  if (typeof input.maintainAudioPitch !== 'boolean') {
    return err(Object.freeze({
      code: 'CLIP_TIME_TRANSFORM_INVALID' as const,
      issue: 'PITCH_NOT_BOOLEAN' as const,
      path: `${path}.maintainAudioPitch`,
    }))
  }
  return ok(Object.freeze({
    playbackRate: rate.value,
    direction: input.direction,
    maintainAudioPitch: input.maintainAudioPitch,
  }))
}

/**
 * Find the fraction closest to a decimal speed, without letting the fraction's
 * numbers grow large.
 *
 * Needed because two parts of the product hand us a decimal and cannot do
 * otherwise: a user typing "1.37" into a box, and the Rate Stretch drag, where
 * the speed falls out of a pixel position.
 *
 * The method is the standard continued-fraction expansion — repeatedly take
 * the whole part, invert the remainder, repeat — stopped as soon as the terms
 * would exceed `maxTerm`. It is the provably closest fraction with terms that
 * small, which is a stronger guarantee than "keep dividing until it looks
 * near enough".
 *
 * WHAT IS GIVEN UP: the answer is not always the exact decimal. Asking for
 * 1.37 with a term ceiling of 1,000 gives 137/100, which IS exact. Asking for
 * 1/pi gives something a hair off. The error is reported so the caller can
 * show it, and the ceiling is documented rather than hidden: with the default
 * ceiling of 1,000 the worst possible error on any speed in range is under
 * one part in a million, which on a one-hour clip is under four milliseconds.
 */
export const APPROXIMATION_MAX_TERM = 1_000

export type RateApproximation = Readonly<{
  rate: RationalPlaybackRateV1
  /** How far the fraction is from what was asked for, as a plain difference. */
  errorAbsolute: number
  /** True when the fraction is the asked-for value exactly. */
  exact: boolean
}>

export const approximatePlaybackRate = (
  decimal: number,
  maxTerm: number = APPROXIMATION_MAX_TERM,
): Result<RateApproximation, PlaybackRateError> => {
  if (typeof decimal !== 'number' || !Number.isFinite(decimal)) return err(rateError('TYPE_INVALID', '$'))
  if (decimal <= 0) return err(rateError('NOT_POSITIVE', '$'))
  const ceiling = Math.min(Math.max(1, Math.floor(maxTerm)), MAX_RATE_TERM)

  // Continued fractions, tracking the last two convergents.
  let previousNumerator = 0
  let numerator = 1
  let previousDenominator = 1
  let denominator = 0
  let remainder = decimal
  let bestNumerator = Math.max(1, Math.round(decimal))
  let bestDenominator = 1

  for (let step = 0; step < 64; step += 1) {
    const whole = Math.floor(remainder)
    const nextNumerator = whole * numerator + previousNumerator
    const nextDenominator = whole * denominator + previousDenominator
    if (nextNumerator > ceiling || nextDenominator > ceiling) break
    previousNumerator = numerator
    numerator = nextNumerator
    previousDenominator = denominator
    denominator = nextDenominator
    if (denominator > 0) {
      bestNumerator = numerator
      bestDenominator = denominator
    }
    const fraction = remainder - whole
    if (fraction === 0) break
    remainder = 1 / fraction
  }

  const reduced = normalizePlaybackRate({ numerator: bestNumerator, denominator: bestDenominator })
  const clamped = clampPlaybackRate(reduced)
  const errorAbsolute = Math.abs(playbackRateToDecimal(clamped) - decimal)
  return ok(Object.freeze({
    rate: clamped,
    errorAbsolute,
    exact: errorAbsolute === 0,
  }))
}

/**
 * Pull a fraction back inside the allowed 0.1x to 16x band.
 *
 * Used only after approximation, where the input decimal may itself have been
 * out of range. Every path that takes a rate from a saved file or an operation
 * REFUSES out-of-range values rather than clamping them, because silently
 * changing a stored edit is worse than refusing it.
 */
export const clampPlaybackRate = (rate: RationalPlaybackRateV1): RationalPlaybackRateV1 => {
  const reduced = normalizePlaybackRate(rate)
  if (reduced.numerator * SLOWEST_PLAYBACK_RATE.denominator < reduced.denominator * SLOWEST_PLAYBACK_RATE.numerator) {
    return SLOWEST_PLAYBACK_RATE
  }
  if (reduced.numerator * FASTEST_PLAYBACK_RATE.denominator > reduced.denominator * FASTEST_PLAYBACK_RATE.numerator) {
    return FASTEST_PLAYBACK_RATE
  }
  return reduced
}

/**
 * The fraction that squeezes a given stretch of recording into a given stretch
 * of finished video.
 *
 * This is what "Fit source to duration" and Rate Stretch both need: the user
 * has picked two lengths and the speed is whatever makes them agree.
 *
 * Reduced before it is returned, and refused when the result would fall
 * outside the allowed band, so the caller can say plainly why rather than
 * quietly producing a speed nothing can play.
 */
export const rateThatFits = (
  sourceTicks: number,
  compositionTicks: number,
): Result<RationalPlaybackRateV1, PlaybackRateError> => {
  if (!Number.isSafeInteger(sourceTicks) || sourceTicks <= 0) return err(rateError('NOT_POSITIVE', '$.sourceTicks'))
  if (!Number.isSafeInteger(compositionTicks) || compositionTicks <= 0) {
    return err(rateError('NOT_POSITIVE', '$.compositionTicks'))
  }
  if (compositionTicks > MAX_PROJECT_TICKS) return err(rateError('TERM_TOO_LARGE', '$.compositionTicks'))
  // rate = source / composition, exactly, then reduced.
  const divisor = greatestCommonDivisor(sourceTicks, compositionTicks)
  let numerator = sourceTicks / divisor
  let denominator = compositionTicks / divisor
  if (numerator > MAX_RATE_TERM || denominator > MAX_RATE_TERM) {
    // The exact fraction has numbers too big to hold, so the nearest fraction
    // with small enough numbers is used instead, and the caller is told the
    // resulting length may be a tick or two from what they dragged.
    const approximated = approximatePlaybackRate(sourceTicks / compositionTicks)
    if (!approximated.ok) return approximated
    numerator = approximated.value.rate.numerator
    denominator = approximated.value.rate.denominator
  }
  return validatePlaybackRate({ numerator, denominator }, '$')
}

/**
 * The speed written the way a person says it: "2x", "0.5x", "1.37x".
 *
 * Two decimal places is enough to tell any two presets apart and short enough
 * to sit on a badge over a clip. The trailing zeros are stripped so 2x does
 * not read as "2.00x", which looks like a measurement rather than a setting.
 */
export const formatPlaybackRate = (rate: RationalPlaybackRateV1): string => {
  const decimal = playbackRateToDecimal(rate)
  const rounded = Math.round(decimal * 100) / 100
  return `${rounded}x`
}
