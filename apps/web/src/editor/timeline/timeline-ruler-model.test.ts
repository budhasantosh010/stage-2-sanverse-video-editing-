import { describe, expect, it } from 'vitest'

import { buildTimelineRulerModel, formatTimelineTime, timelinePointerToTicks } from './timeline-ruler-model'

const S = 1_440_000

const model = (overrides: Partial<Parameters<typeof buildTimelineRulerModel>[0]> = {}) =>
  buildTimelineRulerModel({
    visibleStartTicks: 0,
    visibleEndTicks: 30 * S,
    durationTicks: 30 * S,
    timescale: S,
    pixelsPerSecond: 100,
    viewportWidthPx: 800,
    scrollLeftPx: 0,
    ...overrides,
  })

describe('timeline ruler model', () => {
  it('uses wider intervals when zoomed out and tighter intervals when zoomed in', () => {
    expect(model({ pixelsPerSecond: 10 }).majorIntervalTicks)
      .toBeGreaterThan(model({ pixelsPerSecond: 1_000 }).majorIntervalTicks)
  })

  it('creates minor ticks that are smaller than major ticks', () => {
    const ruler = model()
    expect(ruler.minorIntervalTicks).toBeGreaterThan(0)
    expect(ruler.minorIntervalTicks).toBeLessThan(ruler.majorIntervalTicks)
  })

  it('formats stable wall-clock labels from exact ticks', () => {
    expect(formatTimelineTime(5 * S, S)).toBe('00:05')
    expect(formatTimelineTime(5.25 * S, S, true)).toBe('00:05.250')
    expect(formatTimelineTime(3_661.5 * S, S, true)).toBe('01:01:01.500')
  })

  it('clips ticks to the visible viewport and project duration', () => {
    const ruler = model({
      visibleStartTicks: 10 * S,
      visibleEndTicks: 20 * S,
      scrollLeftPx: 1_000,
    })
    expect(ruler.ticks.every((tick) => tick.ticks >= 10 * S && tick.ticks <= 20 * S)).toBe(true)
    expect(ruler.ticks.every((tick) => tick.xPx >= -1 && tick.xPx <= 801)).toBe(true)
  })

  it('returns an empty model for zero duration or width', () => {
    expect(model({ durationTicks: 0 }).ticks).toEqual([])
    expect(model({ viewportWidthPx: 0 }).ticks).toEqual([])
  })

  it('supports very long projects without unsafe tick values', () => {
    const ruler = model({
      durationTicks: 12 * 60 * 60 * S,
      visibleStartTicks: 11 * 60 * 60 * S,
      visibleEndTicks: 11 * 60 * 60 * S + 60 * S,
      pixelsPerSecond: 20,
      scrollLeftPx: 11 * 60 * 60 * 20,
    })
    expect(ruler.ticks.length).toBeGreaterThan(0)
    expect(ruler.ticks.every((tick) => Number.isSafeInteger(tick.ticks))).toBe(true)
  })

  it('uses integer tick placement at high and low zoom', () => {
    for (const zoom of [10, 1_000]) {
      expect(model({ pixelsPerSecond: zoom }).ticks.every((tick) => Number.isSafeInteger(tick.ticks))).toBe(true)
    }
  })

  it('never duplicates two labels at the same pixel position', () => {
    const labels = model({ pixelsPerSecond: 1_000 }).ticks.filter((tick) => tick.label)
    expect(new Set(labels.map((tick) => Math.round(tick.xPx * 1_000))).size).toBe(labels.length)
  })

  it('maps pointer position plus scroll to clamped project ticks', () => {
    expect(timelinePointerToTicks({
      clientX: 350,
      viewportLeftPx: 100,
      scrollLeftPx: 250,
      pixelsPerSecond: 100,
      timescale: S,
      durationTicks: 30 * S,
    })).toBe(5 * S)
    expect(timelinePointerToTicks({
      clientX: 10_000,
      viewportLeftPx: 0,
      scrollLeftPx: 0,
      pixelsPerSecond: 100,
      timescale: S,
      durationTicks: 30 * S,
    })).toBe(30 * S)
  })
})
