import { describe, expect, it } from 'vitest'

import { PROJECT_TIMESCALE, toSeconds } from '../time.ts'
import type { CaptionCueDraft } from './segment-transcript.ts'
import { DEFAULT_REPAIR, cuesAreDisjoint, repairCueTimings } from './repair-cues.ts'

const time = (seconds: number) => ({ ticks: Math.round(seconds * PROJECT_TIMESCALE), timescale: PROJECT_TIMESCALE })

const cue = (start: number, duration: number, text = 'hello'): CaptionCueDraft => ({
  sourceInterval: { start: time(start), duration: time(duration) },
  lines: [text],
})

const options = (sourceSeconds: number) => ({
  ...DEFAULT_REPAIR,
  sourceDurationTicks: Math.round(sourceSeconds * PROJECT_TIMESCALE),
})

describe('repairCueTimings', () => {
  it('leaves well-spaced cues untouched and reports nothing', () => {
    const result = repairCueTimings([cue(0, 2), cue(3, 2)], options(10))
    expect(result.adjustments).toEqual([])
    expect(result.cues).toHaveLength(2)
    expect(toSeconds(result.cues[1].sourceInterval.duration)).toBeCloseTo(2, 6)
  })

  it('pulls back a cue that would sit on top of the next one', () => {
    const result = repairCueTimings([cue(0, 5), cue(2, 2)], options(10))
    expect(result.cues).toHaveLength(2)
    // 2.0 start minus the 0.08s gap.
    expect(toSeconds(result.cues[0].sourceInterval.duration)).toBeCloseTo(1.92, 6)
    expect(result.adjustments.some((entry) => entry.reason === 'SHORTENED_TO_AVOID_OVERLAP')).toBe(true)
  })

  it('leaves a visible gap so one cue does not flicker into the next', () => {
    const result = repairCueTimings([cue(0, 3), cue(3, 2)], options(10))
    const firstEnd = result.cues[0].sourceInterval.start.ticks + result.cues[0].sourceInterval.duration.ticks
    const secondStart = result.cues[1].sourceInterval.start.ticks
    expect(secondStart - firstEnd).toBeGreaterThanOrEqual(DEFAULT_REPAIR.minGapTicks)
  })

  it('lengthens a cue that is too brief to read', () => {
    const result = repairCueTimings([cue(0, 0.4)], options(10))
    expect(toSeconds(result.cues[0].sourceInterval.duration)).toBeCloseTo(1.0, 6)
    expect(result.adjustments.some((entry) => entry.reason === 'LENGTHENED_TO_MINIMUM')).toBe(true)
  })

  it('shortens a cue that would outstay the maximum', () => {
    const result = repairCueTimings([cue(0, 20)], options(60))
    expect(toSeconds(result.cues[0].sourceInterval.duration)).toBeCloseTo(6, 6)
    expect(result.adjustments.some((entry) => entry.reason === 'SHORTENED_TO_MAXIMUM')).toBe(true)
  })

  it('never lets a cue run past the end of the footage', () => {
    const result = repairCueTimings([cue(8, 5)], options(10))
    const end = result.cues[0].sourceInterval.start.ticks + result.cues[0].sourceInterval.duration.ticks
    expect(end).toBeLessThanOrEqual(options(10).sourceDurationTicks)
    expect(result.adjustments.some((entry) => entry.reason === 'CLAMPED_TO_FOOTAGE_END')).toBe(true)
  })

  it('drops a cue starting after the footage ends, and says so', () => {
    const result = repairCueTimings([cue(0, 2), cue(30, 2)], options(10))
    expect(result.cues).toHaveLength(1)
    expect(result.adjustments.some((entry) => entry.reason === 'DROPPED_OUTSIDE_FOOTAGE')).toBe(true)
  })

  it('drops a cue squeezed below the readable floor rather than drawing a flash', () => {
    // Two cues 0.05s apart: after the gap there is no room left at all.
    const result = repairCueTimings([cue(0, 1), cue(0.05, 1)], options(10))
    expect(result.cues).toHaveLength(1)
    expect(result.adjustments.some((entry) => entry.reason === 'DROPPED_TOO_SHORT')).toBe(true)
  })

  it('reports every change against the position it was handed in', () => {
    const result = repairCueTimings([cue(0, 20), cue(30, 1)], options(10))
    for (const adjustment of result.adjustments) {
      expect(adjustment.index).toBeGreaterThanOrEqual(0)
      expect(adjustment.index).toBeLessThan(2)
    }
  })

  it('always produces cues that are never on screen together', () => {
    const messy = [cue(0, 9), cue(1, 9), cue(2, 9), cue(3, 9), cue(4, 9)]
    const result = repairCueTimings(messy, options(30))
    expect(cuesAreDisjoint(result.cues)).toBe(true)
  })

  it('sorts out-of-order input without losing anything that fits', () => {
    const result = repairCueTimings([cue(6, 2, 'third'), cue(0, 2, 'first'), cue(3, 2, 'second')], options(10))
    expect(result.cues.map((entry) => entry.lines[0])).toEqual(['first', 'second', 'third'])
  })

  it('is deterministic across repeated runs', () => {
    const messy = [cue(0, 9), cue(1, 9), cue(2, 9)]
    const first = JSON.stringify(repairCueTimings(messy, options(30)))
    for (let attempt = 0; attempt < 10; attempt += 1) {
      expect(JSON.stringify(repairCueTimings(messy, options(30)))).toBe(first)
    }
  })
})
