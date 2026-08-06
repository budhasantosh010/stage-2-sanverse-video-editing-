import { describe, expect, it } from 'vitest'

import {
  APPROXIMATION_MAX_TERM,
  DEFAULT_CLIP_TIME_TRANSFORM,
  FASTEST_PLAYBACK_RATE,
  MAX_RATE_TERM,
  NORMAL_PLAYBACK_RATE,
  PLAYBACK_RATE_PRESETS,
  SLOWEST_PLAYBACK_RATE,
  anchoredCompositionDuration,
  approximatePlaybackRate,
  clampPlaybackRate,
  clipTimeTransformsEqual,
  compositionDurationForSourceSpan,
  compositionTicksForSourceOffset,
  formatPlaybackRate,
  greatestCommonDivisor,
  isDefaultClipTimeTransform,
  normalizePlaybackRate,
  playbackRateToDecimal,
  rateThatFits,
  scaleTicks,
  sourceDurationForCompositionSpan,
  sourceTicksForCompositionOffset,
  validateClipTimeTransform,
  validatePlaybackRate,
} from './clip-time.ts'

const S = 1_440_000
const rate = (numerator: number, denominator: number) => ({ numerator, denominator })

describe('a speed is a fraction of two whole numbers', () => {
  it('reduces a fraction to its lowest terms', () => {
    expect(normalizePlaybackRate(rate(4, 8))).toEqual(rate(1, 2))
    expect(normalizePlaybackRate(rate(6, 3))).toEqual(rate(2, 1))
    expect(normalizePlaybackRate(rate(7, 5))).toEqual(rate(7, 5))
  })

  it('accepts a fraction already in lowest terms', () => {
    const checked = validatePlaybackRate(rate(3, 2))
    expect(checked.ok).toBe(true)
  })

  it('REFUSES a fraction that is not reduced, rather than quietly reducing it', () => {
    // Silently reducing would mean the value sent and the value stored differ,
    // and the caller would never find out.
    const checked = validatePlaybackRate(rate(2, 4))
    expect(checked.ok).toBe(false)
    if (!checked.ok) expect(checked.error.issue).toBe('NOT_REDUCED')
  })

  it('refuses zero, negatives, decimals and things that are not numbers', () => {
    for (const bad of [rate(0, 1), rate(1, 0), rate(-1, 2), rate(1.5, 2), rate(Number.NaN, 1)]) {
      expect(validatePlaybackRate(bad).ok).toBe(false)
    }
    expect(validatePlaybackRate(2).ok).toBe(false)
    expect(validatePlaybackRate(null).ok).toBe(false)
  })

  it('refuses an unknown key and a missing key', () => {
    expect(validatePlaybackRate({ numerator: 1, denominator: 1, extra: 3 }).ok).toBe(false)
    expect(validatePlaybackRate({ numerator: 1 }).ok).toBe(false)
  })

  it('refuses terms too large to hold exactly', () => {
    const checked = validatePlaybackRate(rate(MAX_RATE_TERM + 1, 1))
    expect(checked.ok).toBe(false)
    if (!checked.ok) expect(checked.error.issue).toBe('TERM_TOO_LARGE')
  })

  it('refuses anything slower than 0.1x or faster than 16x, by name', () => {
    const tooSlow = validatePlaybackRate(rate(1, 11))
    expect(tooSlow.ok).toBe(false)
    if (!tooSlow.ok) expect(tooSlow.error.issue).toBe('RATE_TOO_SLOW')
    const tooFast = validatePlaybackRate(rate(17, 1))
    expect(tooFast.ok).toBe(false)
    if (!tooFast.ok) expect(tooFast.error.issue).toBe('RATE_TOO_FAST')
  })

  it('accepts both ends of the range exactly', () => {
    expect(validatePlaybackRate(SLOWEST_PLAYBACK_RATE).ok).toBe(true)
    expect(validatePlaybackRate(FASTEST_PLAYBACK_RATE).ok).toBe(true)
  })

  it('accepts every preset offered in the panel', () => {
    for (const preset of PLAYBACK_RATE_PRESETS) {
      expect(validatePlaybackRate(preset).ok, formatPlaybackRate(preset)).toBe(true)
    }
  })

  it('finds the greatest common divisor', () => {
    expect(greatestCommonDivisor(12, 18)).toBe(6)
    expect(greatestCommonDivisor(7, 13)).toBe(1)
    expect(greatestCommonDivisor(5, 0)).toBe(5)
  })
})

describe('turning a length at one speed into a length at another', () => {
  it('leaves a normal-speed piece exactly as it was, to the tick', () => {
    expect(compositionDurationForSourceSpan(10 * S, NORMAL_PLAYBACK_RATE)).toBe(10 * S)
    expect(anchoredCompositionDuration(7 * S, 10 * S, NORMAL_PLAYBACK_RATE)).toBe(10 * S)
  })

  it('halves the on-screen length at double speed', () => {
    expect(compositionDurationForSourceSpan(10 * S, rate(2, 1))).toBe(5 * S)
  })

  it('doubles the on-screen length at half speed', () => {
    expect(compositionDurationForSourceSpan(10 * S, rate(1, 2))).toBe(20 * S)
  })

  it('works out how much recording a stretch of finished video needs', () => {
    expect(sourceDurationForCompositionSpan(5 * S, rate(2, 1))).toBe(10 * S)
    expect(sourceDurationForCompositionSpan(20 * S, rate(1, 2))).toBe(10 * S)
  })

  it('reports honestly that a sub-tick piece would occupy nothing on screen', () => {
    // One tick of recording at 16x is a sixteenth of a tick on screen. Rounding
    // that up to keep the piece visible was tried and it breaks the additivity
    // the anchored rule exists for, so the truthful zero is returned and the
    // REFUSAL lives in the operation, where the user can read it.
    expect(anchoredCompositionDuration(0, 1, rate(16, 1))).toBe(0)
    // The standalone helper, used by planners rather than by stored clips,
    // still guarantees at least a tick, because a planner asking "how long
    // would this be?" needs a length it can draw.
    expect(compositionDurationForSourceSpan(1, rate(16, 1))).toBe(1)
  })

  it('gives nothing back for nothing', () => {
    expect(compositionDurationForSourceSpan(0, rate(2, 1))).toBe(0)
    expect(anchoredCompositionDuration(0, 0, rate(2, 1))).toBe(0)
  })
})

describe('the rounding policy cannot drift', () => {
  it('rounds half up, on whole numbers all the way', () => {
    // 5 x 1/2 = 2.5 exactly, and half up gives 3.
    expect(scaleTicks(5, 1, 2)).toBe(3)
    expect(scaleTicks(7, 1, 2)).toBe(4)
    expect(scaleTicks(10, 1, 3)).toBe(3)
  })

  it('refuses arguments that are not whole positive numbers', () => {
    expect(() => scaleTicks(-1, 1, 1)).toThrow(RangeError)
    expect(() => scaleTicks(1, 0, 1)).toThrow(RangeError)
    expect(() => scaleTicks(1, 1, 0)).toThrow(RangeError)
    expect(() => scaleTicks(1.5, 1, 1)).toThrow(RangeError)
  })

  it('makes a cut EXACTLY additive: the two halves add up to the whole', () => {
    // This is the property the whole anchored rule exists for. Rounding each
    // half's length on its own makes a 10-tick clip at 3x become 4 ticks after
    // one cut, which overlaps whatever sits next and refuses the edit.
    const speed = rate(3, 1)
    for (const sourceStart of [0, 1, 2, 17, 1_000, 999_983]) {
      for (const total of [10, 31, 100, 7 * S + 13]) {
        const whole = anchoredCompositionDuration(sourceStart, total, speed)
        for (const at of [1, 3, Math.floor(total / 2), total - 1]) {
          const left = anchoredCompositionDuration(sourceStart, at, speed)
          const right = anchoredCompositionDuration(sourceStart + at, total - at, speed)
          expect(left + right, `start ${sourceStart} total ${total} cut at ${at}`).toBe(whole)
        }
      }
    }
  })

  it('stays additive across MANY cuts, for many different speeds', () => {
    for (const speed of [rate(1, 3), rate(2, 3), rate(3, 2), rate(7, 5), rate(16, 1), rate(1, 10)]) {
      const sourceStart = 12_345
      const total = 3 * S + 777
      const whole = anchoredCompositionDuration(sourceStart, total, speed)
      const cuts = [0, 101, 5_003, 900_000, 2 * S, total]
      let sum = 0
      for (let index = 1; index < cuts.length; index += 1) {
        sum += anchoredCompositionDuration(sourceStart + cuts[index - 1], cuts[index] - cuts[index - 1], speed)
      }
      expect(sum, formatPlaybackRate(speed)).toBe(whole)
    }
  })
})

describe('mapping a point on screen to a point in the recording, and back', () => {
  it('is the identity at normal speed', () => {
    expect(sourceTicksForCompositionOffset(4 * S, NORMAL_PLAYBACK_RATE)).toBe(4 * S)
    expect(compositionTicksForSourceOffset(4 * S, NORMAL_PLAYBACK_RATE)).toBe(4 * S)
  })

  it('four seconds into a 2x piece is eight seconds into the recording', () => {
    expect(sourceTicksForCompositionOffset(4 * S, rate(2, 1))).toBe(8 * S)
    expect(compositionTicksForSourceOffset(8 * S, rate(2, 1))).toBe(4 * S)
  })

  it('four seconds into a half-speed piece is two seconds into the recording', () => {
    expect(sourceTicksForCompositionOffset(4 * S, rate(1, 2))).toBe(2 * S)
    expect(compositionTicksForSourceOffset(2 * S, rate(1, 2))).toBe(4 * S)
  })

  it('goes there and back again within one tick OF RECORDING, at every speed tried', () => {
    // The bound is one tick of RECORDING expressed in screen time, not one
    // tick of screen time. At 0.1x, one tick of recording is ten ticks on
    // screen, so ten screen ticks all point at the same recorded moment and
    // the round trip cannot be finer than that. That is arithmetic, not a
    // defect: it is the same reason a video cannot show half a frame.
    for (const speed of [rate(1, 10), rate(1, 4), rate(1, 2), rate(3, 4), rate(5, 4), rate(3, 2), rate(2, 1), rate(4, 1), rate(16, 1)]) {
      const oneSourceTickOnScreen = Math.ceil(speed.denominator / speed.numerator)
      for (const screen of [1, 999, 48_048, S, 3 * S + 7]) {
        const source = sourceTicksForCompositionOffset(screen, speed)
        const backAgain = compositionTicksForSourceOffset(source, speed)
        expect(
          Math.abs(backAgain - screen),
          `${formatPlaybackRate(speed)} at ${screen}`,
        ).toBeLessThanOrEqual(oneSourceTickOnScreen)
      }
    }
  })

  it('answers zero for zero and for anything before the start', () => {
    expect(sourceTicksForCompositionOffset(0, rate(2, 1))).toBe(0)
    expect(sourceTicksForCompositionOffset(-5, rate(2, 1))).toBe(0)
    expect(compositionTicksForSourceOffset(-5, rate(2, 1))).toBe(0)
  })
})

describe('finding the fraction that fits two lengths together', () => {
  it('gives the exact fraction when one exists', () => {
    const fitted = rateThatFits(10 * S, 5 * S)
    expect(fitted.ok).toBe(true)
    if (fitted.ok) expect(fitted.value).toEqual(rate(2, 1))
  })

  it('reduces the answer, so the same intent always stores the same value', () => {
    const fitted = rateThatFits(4 * S, 8 * S)
    expect(fitted.ok).toBe(true)
    if (fitted.ok) expect(fitted.value).toEqual(rate(1, 2))
  })

  it('refuses a length of zero or less', () => {
    expect(rateThatFits(0, S).ok).toBe(false)
    expect(rateThatFits(S, 0).ok).toBe(false)
    expect(rateThatFits(S, -1).ok).toBe(false)
  })

  it('refuses when the required speed falls outside 0.1x to 16x', () => {
    // 20 seconds of recording squeezed into one second is 20x.
    expect(rateThatFits(20 * S, 1 * S).ok).toBe(false)
    // One second stretched over 20 is 0.05x.
    expect(rateThatFits(1 * S, 20 * S).ok).toBe(false)
  })

  it('lands within a tick or two even when the exact fraction is unholdable', () => {
    // Two large awkward numbers whose exact fraction needs terms far above the
    // ceiling, so the closest small fraction is used and the error is tiny.
    const sourceTicks = 3_456_789
    const targetTicks = 2_345_677
    const fitted = rateThatFits(sourceTicks, targetTicks)
    expect(fitted.ok).toBe(true)
    if (!fitted.ok) return
    const produced = anchoredCompositionDuration(0, sourceTicks, fitted.value)
    expect(Math.abs(produced - targetTicks)).toBeLessThan(targetTicks / 100_000)
  })
})

describe('turning a typed decimal into a fraction', () => {
  it('is exact for the decimals people actually type', () => {
    for (const [typed, expected] of [
      [2, rate(2, 1)],
      [0.5, rate(1, 2)],
      [1.5, rate(3, 2)],
      [0.25, rate(1, 4)],
      [1.37, rate(137, 100)],
    ] as const) {
      const approximated = approximatePlaybackRate(typed)
      expect(approximated.ok).toBe(true)
      if (!approximated.ok) continue
      expect(approximated.value.rate, String(typed)).toEqual(expected)
      expect(approximated.value.exact, String(typed)).toBe(true)
    }
  })

  it('gets very close, and says so, when the decimal has no small fraction', () => {
    const approximated = approximatePlaybackRate(1 / Math.PI + 1)
    expect(approximated.ok).toBe(true)
    if (!approximated.ok) return
    expect(approximated.value.exact).toBe(false)
    expect(approximated.value.errorAbsolute).toBeLessThan(1 / 1_000_000)
    expect(approximated.value.rate.numerator).toBeLessThanOrEqual(APPROXIMATION_MAX_TERM)
    expect(approximated.value.rate.denominator).toBeLessThanOrEqual(APPROXIMATION_MAX_TERM)
  })

  it('pulls a decimal outside the range back to the nearest end', () => {
    const tooFast = approximatePlaybackRate(50)
    expect(tooFast.ok).toBe(true)
    if (tooFast.ok) expect(tooFast.value.rate).toEqual(FASTEST_PLAYBACK_RATE)
    const tooSlow = approximatePlaybackRate(0.01)
    expect(tooSlow.ok).toBe(true)
    if (tooSlow.ok) expect(tooSlow.value.rate).toEqual(SLOWEST_PLAYBACK_RATE)
  })

  it('refuses zero, negatives and things that are not numbers', () => {
    expect(approximatePlaybackRate(0).ok).toBe(false)
    expect(approximatePlaybackRate(-2).ok).toBe(false)
    expect(approximatePlaybackRate(Number.NaN).ok).toBe(false)
    expect(approximatePlaybackRate(Number.POSITIVE_INFINITY).ok).toBe(false)
  })

  it('clamps a fraction to the allowed band without changing one inside it', () => {
    expect(clampPlaybackRate(rate(100, 1))).toEqual(FASTEST_PLAYBACK_RATE)
    expect(clampPlaybackRate(rate(1, 100))).toEqual(SLOWEST_PLAYBACK_RATE)
    expect(clampPlaybackRate(rate(3, 2))).toEqual(rate(3, 2))
  })
})

describe('how a speed is written for a person to read', () => {
  it('drops the trailing zeros so a setting does not look like a measurement', () => {
    expect(formatPlaybackRate(rate(2, 1))).toBe('2x')
    expect(formatPlaybackRate(rate(1, 2))).toBe('0.5x')
    expect(formatPlaybackRate(rate(3, 4))).toBe('0.75x')
    expect(formatPlaybackRate(rate(1, 1))).toBe('1x')
    expect(formatPlaybackRate(rate(1, 3))).toBe('0.33x')
  })

  it('gives a decimal only at the very last step, for the browser', () => {
    expect(playbackRateToDecimal(rate(1, 2))).toBe(0.5)
    expect(playbackRateToDecimal(rate(2, 1))).toBe(2)
  })
})

describe('the whole time setting for one piece', () => {
  it('starts as normal speed, forwards, with pitch kept', () => {
    expect(DEFAULT_CLIP_TIME_TRANSFORM.playbackRate).toEqual(NORMAL_PLAYBACK_RATE)
    expect(DEFAULT_CLIP_TIME_TRANSFORM.direction).toBe('forward')
    expect(DEFAULT_CLIP_TIME_TRANSFORM.maintainAudioPitch).toBe(true)
    expect(isDefaultClipTimeTransform(DEFAULT_CLIP_TIME_TRANSFORM)).toBe(true)
  })

  it('knows a piece that was reset to normal is the same as one never touched', () => {
    // This is what stops "reset to normal" from changing the export key and
    // throwing away a finished video for nothing.
    const reset = { playbackRate: rate(1, 1), direction: 'forward' as const, maintainAudioPitch: true }
    expect(isDefaultClipTimeTransform(reset)).toBe(true)
    expect(clipTimeTransformsEqual(reset, DEFAULT_CLIP_TIME_TRANSFORM)).toBe(true)
  })

  it('counts pitch-off on its own as a real change', () => {
    expect(isDefaultClipTimeTransform({
      playbackRate: rate(1, 1),
      direction: 'forward',
      maintainAudioPitch: false,
    })).toBe(false)
  })

  it('accepts a complete, valid setting', () => {
    const checked = validateClipTimeTransform({
      playbackRate: rate(2, 1),
      direction: 'reverse',
      maintainAudioPitch: false,
    })
    expect(checked.ok).toBe(true)
  })

  it('refuses a missing field, an unknown field, and a direction nobody defined', () => {
    expect(validateClipTimeTransform({ playbackRate: rate(1, 1), direction: 'forward' }).ok).toBe(false)
    expect(validateClipTimeTransform({
      playbackRate: rate(1, 1), direction: 'forward', maintainAudioPitch: true, extra: 1,
    }).ok).toBe(false)
    const wrongDirection = validateClipTimeTransform({
      playbackRate: rate(1, 1), direction: 'sideways', maintainAudioPitch: true,
    })
    expect(wrongDirection.ok).toBe(false)
    if (!wrongDirection.ok) expect(wrongDirection.error.issue).toBe('DIRECTION_UNKNOWN')
  })

  it('refuses a pitch switch that is not a yes or a no', () => {
    const checked = validateClipTimeTransform({
      playbackRate: rate(1, 1), direction: 'forward', maintainAudioPitch: 'yes',
    })
    expect(checked.ok).toBe(false)
    if (!checked.ok) expect(checked.error.issue).toBe('PITCH_NOT_BOOLEAN')
  })

  it('reports the bad rate at its own path, not at the top', () => {
    const checked = validateClipTimeTransform(
      { playbackRate: rate(0, 1), direction: 'forward', maintainAudioPitch: true },
      '$.clip',
    )
    expect(checked.ok).toBe(false)
    if (!checked.ok) expect(checked.error.path).toBe('$.clip.playbackRate.numerator')
  })
})
