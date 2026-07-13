import { describe, expect, it } from 'vitest'

import { capturePointTarget, formatPointTargetTime, getRenderedVideoContentBox } from './point-target'

const elementBox = { left: 100, top: 50, width: 400, height: 400 }

describe('getRenderedVideoContentBox', () => {
  it('centers landscape video inside vertical letterboxing', () => {
    expect(getRenderedVideoContentBox(elementBox, 1920, 1080)).toEqual({
      left: 100,
      top: 137.5,
      width: 400,
      height: 225,
    })
  })

  it('centers portrait video inside horizontal letterboxing', () => {
    expect(getRenderedVideoContentBox(elementBox, 1080, 1920)).toEqual({
      left: 187.5,
      top: 50,
      width: 225,
      height: 400,
    })
  })
})

describe('capturePointTarget', () => {
  it('normalizes a click against rendered video content and captures milliseconds', () => {
    expect(
      capturePointTarget({
        clientX: 300,
        clientY: 250,
        elementBox,
        videoWidth: 1920,
        videoHeight: 1080,
        currentTimeSeconds: 12.4,
      }),
    ).toEqual({ ok: true, value: { x: 0.5, y: 0.5, timeMs: 12400 } })
  })

  it('rejects clicks in letterboxing instead of turning them into edge coordinates', () => {
    expect(
      capturePointTarget({
        clientX: 300,
        clientY: 80,
        elementBox,
        videoWidth: 1920,
        videoHeight: 1080,
        currentTimeSeconds: 12.4,
      }),
    ).toEqual({ ok: false, error: 'Choose a point inside the visible video.' })
  })

  it.each([Number.NaN, Number.POSITIVE_INFINITY, Number.MAX_VALUE, -0.01])(
    'rejects invalid playback time %s',
    (currentTimeSeconds) => {
      expect(
        capturePointTarget({
          clientX: 300,
          clientY: 250,
          elementBox,
          videoWidth: 1920,
          videoHeight: 1080,
          currentTimeSeconds,
        }),
      ).toEqual({ ok: false, error: 'The current video time is unavailable.' })
    },
  )

  it('rejects unavailable intrinsic media dimensions', () => {
    expect(
      capturePointTarget({
        clientX: 300,
        clientY: 250,
        elementBox,
        videoWidth: 0,
        videoHeight: 0,
        currentTimeSeconds: 0,
      }),
    ).toEqual({ ok: false, error: 'The visible video bounds are unavailable.' })
  })
})

describe('formatPointTargetTime', () => {
  it('formats captured milliseconds for a plain-language target summary', () => {
    expect(formatPointTargetTime(12_400)).toBe('00:12.400')
    expect(formatPointTargetTime(3_612_045)).toBe('1:00:12.045')
  })

  it('safely formats non-finite input as the start of the video', () => {
    expect(formatPointTargetTime(Number.NaN)).toBe('00:00.000')
    expect(formatPointTargetTime(Number.POSITIVE_INFINITY)).toBe('00:00.000')
  })
})
