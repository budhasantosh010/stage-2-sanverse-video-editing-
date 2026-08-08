import { describe, expect, it } from 'vitest'

import { frameDeltaToTicks, parsePrecisionTimeInput, resolvePrecisionTimeInput, ticksToFrameCount } from './timeline-precision-timecode'

const T = 1_440_000

describe('numeric precision time', () => {
  it('parses absolute project timecode into exact ticks', () => {
    const result = parsePrecisionTimeInput({ text: '00:01:13:12', timescale: T, frameRate: { numerator: 30, denominator: 1 } })
    expect(result).toEqual({ ok: true, relative: false, ticks: (73 * T) + frameDeltaToTicks(12, T, { numerator: 30, denominator: 1 }), frames: null })
  })

  it('parses positive and negative relative frame deltas', () => {
    expect(parsePrecisionTimeInput({ text: '+12f', timescale: T, frameRate: { numerator: 30, denominator: 1 } })).toEqual({ ok: true, relative: true, ticks: 576_000, frames: 12 })
    expect(parsePrecisionTimeInput({ text: '-8f', timescale: T, frameRate: { numerator: 30, denominator: 1 } })).toEqual({ ok: true, relative: true, ticks: -384_000, frames: -8 })
  })

  it('parses relative timecode without storing floating seconds', () => {
    expect(parsePrecisionTimeInput({ text: '+00:00:01:00', timescale: T, frameRate: { numerator: 30, denominator: 1 } })).toEqual({ ok: true, relative: true, ticks: T, frames: null })
  })

  it('supports rational frame rates deterministically', () => {
    const rate = { numerator: 30_000, denominator: 1001 }
    const ticks = frameDeltaToTicks(100, T, rate)
    expect(ticks).toBe(4_804_800)
    expect(ticksToFrameCount(ticks, T, rate)).toBe(100)
  })

  it('resolves relative input against an exact integer base', () => {
    expect(resolvePrecisionTimeInput({
      text: '+12f', baseTicks: 10 * T, minTicks: 0, maxTicks: 20 * T,
      timescale: T, frameRate: { numerator: 30, denominator: 1 },
    })).toEqual({ ok: true, relative: true, ticks: 10 * T + 576_000, frames: 12 })
  })

  it('returns plain refusals for invalid timecode and out-of-range results', () => {
    const invalid = parsePrecisionTimeInput({ text: '00:99:00:00', timescale: T, frameRate: { numerator: 30, denominator: 1 } })
    expect(invalid.ok).toBe(false)
    if (!invalid.ok) expect(invalid.message).not.toMatch(/VALUE_|INVALID_/)

    const outside = resolvePrecisionTimeInput({
      text: '-8f', baseTicks: 0, minTicks: 0, maxTicks: 20 * T,
      timescale: T, frameRate: { numerator: 30, denominator: 1 },
    })
    expect(outside.ok).toBe(false)
  })

  it('refuses a frame number outside the project frame rate', () => {
    const result = parsePrecisionTimeInput({ text: '00:00:01:30', timescale: T, frameRate: { numerator: 30, denominator: 1 } })
    expect(result.ok).toBe(false)
  })
})
