import { describe, expect, it } from 'vitest'
import { SANVERSE_TICKS_PER_SECOND } from '@sanverse/motion-primitives'
import { advancePlaybackTicks, clampExactTick, resolveInitialTick, stepFrame } from './transport.ts'

const composition = { width: 1920, height: 1080, fpsNumerator: 30, fpsDenominator: 1 } as const
const durationTicks = SANVERSE_TICKS_PER_SECOND * 3

describe('Motion Lab exact-tick transport', () => {
  it('converts wall-clock elapsed time into exact integer ticks', () => {
    expect(advancePlaybackTicks({ anchorTicks: 0, elapsedMilliseconds: 500, speed: 1, durationTicks, loop: false })).toEqual({
      ticks: 720_000,
      ended: false,
    })
  })

  it('loops by exact duration ticks', () => {
    expect(advancePlaybackTicks({ anchorTicks: durationTicks - 100, elapsedMilliseconds: 1, speed: 1, durationTicks, loop: true }).ticks).toBe(1_340)
  })

  it('ends exactly on duration without loop', () => {
    expect(advancePlaybackTicks({ anchorTicks: durationTicks - 10, elapsedMilliseconds: 100, speed: 2, durationTicks, loop: false })).toEqual({
      ticks: durationTicks,
      ended: true,
    })
  })

  it('frame-steps using composition FPS and canonical ticks', () => {
    expect(stepFrame(0, 1, composition, durationTicks)).toBe(48_000)
    expect(stepFrame(48_000, -1, composition, durationTicks)).toBe(0)
  })

  it('clamps typed exact ticks safely', () => {
    expect(clampExactTick(-50, durationTicks)).toBe(0)
    expect(clampExactTick(durationTicks + 50, durationTicks)).toBe(durationTicks)
    expect(clampExactTick(123.6, durationTicks)).toBe(124)
  })

  it('does not confuse a missing tick query with an explicit zero tick', () => {
    expect(resolveInitialTick(null, durationTicks, 0.62)).toBe(Math.round(durationTicks * 0.62))
    expect(resolveInitialTick('0', durationTicks, 0.62)).toBe(0)
    expect(resolveInitialTick('not-a-number', durationTicks, 0.62)).toBe(Math.round(durationTicks * 0.62))
  })
})
