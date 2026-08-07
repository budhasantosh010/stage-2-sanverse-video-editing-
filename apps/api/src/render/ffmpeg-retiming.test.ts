import { describe, expect, it } from 'vitest'

import type { RenderPlan } from '@sanverse/render-contract'

import {
  atempoChain,
  audioSpeedSteps,
  panFilter,
  segmentIsRetimed,
  segmentIsReversed,
  segmentKeepsPitch,
  segmentRate,
  segmentSourceDurationTicks,
  transitionColorForStyle,
  videoSpeedSteps,
} from './ffmpeg-retiming.ts'

const S = 1_440_000
const SAMPLE_RATE = 48_000

type Segment = RenderPlan['segments'][number]

const segment = (extra: Partial<Segment> = {}): Segment => Object.freeze({
  nodeId: 'clip_retime001',
  kind: 'source-segment',
  interval: { start: { ticks: 0, timescale: S }, duration: { ticks: 5 * S, timescale: S } },
  assetId: 'asset_retime001',
  sourceStartTicks: 0,
  videoEnabled: true,
  audioEnabled: true,
  footageMotions: [],
  gainDb: 0,
  fadeInTicks: 0,
  fadeOutTicks: 0,
  videoFadeInTicks: 0,
  videoFadeOutTicks: 0,
  transitionAudioFadeInTicks: 0,
  transitionAudioFadeOutTicks: 0,
  ...extra,
}) as Segment

describe('a plan that says nothing about speed means exactly what it always meant', () => {
  it('takes as much recording as the piece lasts on screen', () => {
    expect(segmentSourceDurationTicks(segment())).toBe(5 * S)
  })

  it('reads as normal speed, forwards, pitch kept, black transitions, centred sound', () => {
    const plain = segment()
    expect(segmentRate(plain)).toEqual({ numerator: 1, denominator: 1 })
    expect(segmentIsReversed(plain)).toBe(false)
    expect(segmentKeepsPitch(plain)).toBe(true)
    expect(segmentIsRetimed(plain)).toBe(false)
    expect(transitionColorForStyle('dip-to-black')).toBe('black')
    expect(panFilter(0)).toBeNull()
  })

  it('adds no picture or sound instructions at all', () => {
    expect(videoSpeedSteps(segment())).toEqual([])
    expect(audioSpeedSteps(segment(), SAMPLE_RATE)).toEqual([])
  })

  it('ignores a speed with only half a fraction, rather than guessing the rest', () => {
    const half = segment({ playbackRateNumerator: 2 } as Partial<Segment>)
    expect(segmentRate(half)).toEqual({ numerator: 1, denominator: 1 })
  })
})

describe('the picture, at a different speed', () => {
  it('halves every frame timestamp at 2x', () => {
    const fast = segment({ playbackRateNumerator: 2, playbackRateDenominator: 1 } as Partial<Segment>)
    expect(videoSpeedSteps(fast)).toEqual(['setpts=0.5*PTS'])
  })

  it('doubles every frame timestamp at half speed', () => {
    const slow = segment({ playbackRateNumerator: 1, playbackRateDenominator: 2 } as Partial<Segment>)
    expect(videoSpeedSteps(slow)).toEqual(['setpts=2*PTS'])
  })

  it('reverses BEFORE it changes the speed, never after', () => {
    // The other order reverses timestamps that have already been stretched,
    // and the last frame lands at the wrong instant.
    const both = segment({
      direction: 'reverse',
      playbackRateNumerator: 2,
      playbackRateDenominator: 1,
    } as Partial<Segment>)
    expect(videoSpeedSteps(both)).toEqual(['reverse', 'setpts=0.5*PTS'])
  })

  it('writes the same text every time, so the same project exports the same file', () => {
    const third = segment({ playbackRateNumerator: 1, playbackRateDenominator: 3 } as Partial<Segment>)
    expect(videoSpeedSteps(third)).toEqual(videoSpeedSteps(third))
    expect(videoSpeedSteps(third)[0]).toBe('setpts=3*PTS')
  })
})

describe('the sound, keeping its pitch', () => {
  it('uses one step for a speed the filter accepts on its own', () => {
    const fast = segment({ playbackRateNumerator: 2, playbackRateDenominator: 1 } as Partial<Segment>)
    expect(audioSpeedSteps(fast, SAMPLE_RATE)).toEqual(['atempo=2'])
  })

  it('builds a chain for a speed outside what one step allows', () => {
    // 4x is beyond atempo's single-step ceiling of 2, so it becomes 2 x 2.
    expect(atempoChain(4, 1)).toEqual([2, 2])
    // 16x is 2 x 2 x 2 x 2.
    expect(atempoChain(16, 1)).toEqual([2, 2, 2, 2])
    // 0.1x is 0.5 x 0.5 x 0.5 x 0.8. Three halvings, not two: stopping after
    // two would leave 0.4 as the final factor, which is BELOW the 0.5 the
    // filter accepts and would be rejected by FFmpeg at export time.
    expect(atempoChain(1, 10)).toEqual([0.5, 0.5, 0.5, 0.8])
  })

  it('multiplies out to EXACTLY the speed asked for, at every speed tried', () => {
    for (const [numerator, denominator] of [
      [1, 10], [1, 4], [1, 2], [3, 4], [1, 1], [5, 4], [3, 2], [2, 1], [3, 1], [4, 1], [7, 2], [16, 1],
    ] as const) {
      const product = atempoChain(numerator, denominator).reduce((total, factor) => total * factor, 1)
      expect(product, `${numerator}/${denominator}`).toBeCloseTo(numerator / denominator, 10)
    }
  })

  it('keeps every step inside the range the filter accepts', () => {
    for (const [numerator, denominator] of [[1, 10], [16, 1], [1, 8], [9, 1]] as const) {
      for (const factor of atempoChain(numerator, denominator)) {
        expect(factor, `${numerator}/${denominator}`).toBeGreaterThanOrEqual(0.5)
        expect(factor, `${numerator}/${denominator}`).toBeLessThanOrEqual(2)
      }
    }
  })

  it('emits nothing at all for normal speed', () => {
    expect(atempoChain(1, 1)).toEqual([])
  })

  it('leaves out a step that would do nothing', () => {
    // 2x is exactly one doubling, so there is no leftover factor of 1.
    expect(atempoChain(2, 1)).toEqual([2])
    expect(atempoChain(1, 2)).toEqual([0.5])
  })
})

describe('the sound, deliberately going squeaky', () => {
  it('lies about the recording rate and then puts it back', () => {
    const fast = segment({
      playbackRateNumerator: 2,
      playbackRateDenominator: 1,
      maintainAudioPitch: false,
    } as Partial<Segment>)
    expect(audioSpeedSteps(fast, SAMPLE_RATE)).toEqual(['asetrate=96000', 'aresample=48000'])
  })

  it('goes lower and slower the other way', () => {
    const slow = segment({
      playbackRateNumerator: 1,
      playbackRateDenominator: 2,
      maintainAudioPitch: false,
    } as Partial<Segment>)
    expect(audioSpeedSteps(slow, SAMPLE_RATE)).toEqual(['asetrate=24000', 'aresample=48000'])
  })

  it('never mixes the two methods', () => {
    const squeaky = segment({
      playbackRateNumerator: 4,
      playbackRateDenominator: 1,
      maintainAudioPitch: false,
    } as Partial<Segment>)
    expect(audioSpeedSteps(squeaky, SAMPLE_RATE).some((step) => step.startsWith('atempo'))).toBe(false)
  })

  it('reverses the sound before changing its speed, same as the picture', () => {
    const both = segment({
      direction: 'reverse',
      playbackRateNumerator: 2,
      playbackRateDenominator: 1,
    } as Partial<Segment>)
    expect(audioSpeedSteps(both, SAMPLE_RATE)[0]).toBe('areverse')
  })
})

describe('left and right', () => {
  it('draws nothing at all when the sound is centred', () => {
    expect(panFilter(0)).toBeNull()
  })

  it('sends everything to one speaker at the far ends', () => {
    expect(panFilter(-10_000)).toBe('pan=stereo|c0=1*c0|c1=0*c1')
    expect(panFilter(10_000)).toBe('pan=stereo|c0=0*c0|c1=1*c1')
  })

  it('keeps the total loudness the same all the way across', () => {
    // Constant power: the two gains squared always add up to one. A straight
    // line instead would make anything centred about three decibels quieter,
    // which listeners hear as the sound ducking as it passes the middle.
    for (const position of [-10_000, -7_500, -5_000, -2_500, 2_500, 5_000, 7_500, 10_000]) {
      const filter = panFilter(position)
      expect(filter, String(position)).not.toBeNull()
      const [, left, right] = /c0=([\d.]+)\*c0\|c1=([\d.]+)\*c1/.exec(filter!) ?? []
      const power = Number(left) ** 2 + Number(right) ** 2
      expect(power, String(position)).toBeCloseTo(1, 6)
    }
  })

  it('pulls a position outside the range back to the end', () => {
    expect(panFilter(-99_999)).toBe(panFilter(-10_000))
    expect(panFilter(99_999)).toBe(panFilter(10_000))
  })

  it('ignores a position that is not a number', () => {
    expect(panFilter(Number.NaN)).toBeNull()
  })
})

describe('what colour a v8 transition edge fades through', () => {
  it('derives colour from the closed transition style instead of a segment-local field', () => {
    expect(transitionColorForStyle('dip-to-black')).toBe('black')
    expect(transitionColorForStyle('dip-to-white')).toBe('white')
  })
})
