import { describe, expect, it } from 'vitest'

import { PROJECT_TIMESCALE } from '@sanverse/edit-domain'

import {
  DEFAULT_PIXELS_PER_SECOND,
  MAX_PIXELS_PER_SECOND,
  MIN_PIXELS_PER_SECOND,
  calculateHorizontalZoomScroll,
  clampPixelsPerSecond,
  clampTimelineScroll,
  fitTimelineToViewport,
  itemIntersectsVisibleRange,
  pixelsToTicks,
  ticksToPixels,
  timelineContentWidthPx,
  visibleTickRange,
  zoomTimelineAtAnchor,
} from './timeline-viewport-state'

const S = PROJECT_TIMESCALE

describe('timeline viewport conversion', () => {
  it('maps zero ticks to zero pixels', () => {
    expect(ticksToPixels(0, S, 100)).toBe(0)
  })

  it('round-trips ticks through pixels using nearest-tick seek rounding', () => {
    const ticks = 12 * S + 345
    const pixels = ticksToPixels(ticks, S, 137)
    expect(pixelsToTicks(pixels, S, 137)).toBe(ticks)
  })

  it('clamps minimum and maximum zoom', () => {
    expect(clampPixelsPerSecond(-100)).toBe(MIN_PIXELS_PER_SECOND)
    expect(clampPixelsPerSecond(100_000)).toBe(MAX_PIXELS_PER_SECOND)
  })

  it('fails safely for negative, NaN, Infinity, and zero timescale', () => {
    expect(ticksToPixels(-1, S, 100)).toBe(0)
    expect(ticksToPixels(Number.NaN, S, 100)).toBe(0)
    expect(ticksToPixels(Number.POSITIVE_INFINITY, S, 100)).toBe(0)
    expect(ticksToPixels(S, 0, 100)).toBe(0)
    expect(pixelsToTicks(Number.NaN, S, 100)).toBe(0)
    expect(pixelsToTicks(100, 0, 100)).toBe(0)
  })
})

describe('fit and scroll', () => {
  it('fits a 30-second project inside the usable viewport', () => {
    const pixelsPerSecond = fitTimelineToViewport({
      durationTicks: 30 * S,
      timescale: S,
      viewportWidthPx: 960,
      horizontalPaddingPx: 30,
    })
    expect(pixelsPerSecond).toBe(30)
    expect(timelineContentWidthPx(30 * S, S, pixelsPerSecond)).toBe(900)
  })

  it('uses the safe default for a zero-duration project', () => {
    expect(fitTimelineToViewport({
      durationTicks: 0,
      timescale: S,
      viewportWidthPx: 960,
      horizontalPaddingPx: 30,
    })).toBe(DEFAULT_PIXELS_PER_SECOND)
  })

  it('uses minimum zoom when the viewport has no usable width', () => {
    expect(fitTimelineToViewport({
      durationTicks: 30 * S,
      timescale: S,
      viewportWidthPx: 0,
      horizontalPaddingPx: 30,
    })).toBe(MIN_PIXELS_PER_SECOND)
  })

  it('clamps scroll to zero and to the content end', () => {
    expect(clampTimelineScroll({ scrollLeftPx: -20, contentWidthPx: 1000, viewportWidthPx: 300 })).toBe(0)
    expect(clampTimelineScroll({ scrollLeftPx: 900, contentWidthPx: 1000, viewportWidthPx: 300 })).toBe(700)
  })
})

describe('visible range and anchored zoom', () => {
  it('keeps the visible range inside project bounds', () => {
    const range = visibleTickRange({
      viewport: { pixelsPerSecond: 100, scrollLeftPx: 10_000, viewportWidthPx: 500 },
      durationTicks: 30 * S,
      timescale: S,
    })
    expect(range.startTicks).toBe(25 * S)
    expect(range.endTicks).toBe(30 * S)
  })

  it('keeps center time stable while zooming around center', () => {
    const before = { pixelsPerSecond: 100, scrollLeftPx: 500, viewportWidthPx: 1000 }
    const anchorX = 500
    const beforeSeconds = (before.scrollLeftPx + anchorX) / before.pixelsPerSecond
    const after = zoomTimelineAtAnchor({
      viewport: before,
      nextPixelsPerSecond: 200,
      anchorViewportX: anchorX,
      durationTicks: 60 * S,
      timescale: S,
    })
    const afterSeconds = (after.scrollLeftPx + anchorX) / after.pixelsPerSecond
    expect(afterSeconds).toBeCloseTo(beforeSeconds, 10)
  })

  it('keeps pointer time stable while zooming around an off-center pointer', () => {
    const before = { pixelsPerSecond: 80, scrollLeftPx: 240, viewportWidthPx: 900 }
    const anchorX = 135
    const beforeSeconds = (before.scrollLeftPx + anchorX) / before.pixelsPerSecond
    const after = zoomTimelineAtAnchor({
      viewport: before,
      nextPixelsPerSecond: 320,
      anchorViewportX: anchorX,
      durationTicks: 120 * S,
      timescale: S,
    })
    const afterSeconds = (after.scrollLeftPx + anchorX) / after.pixelsPerSecond
    expect(afterSeconds).toBeCloseTo(beforeSeconds, 10)
  })

  it('preserves an exact playhead X in the middle of a one-hour project', () => {
    const duration = 60 * 60 * S
    const anchorTicks = 35 * 60 * S + 12_345
    const anchorViewportX = 417
    const nextScroll = calculateHorizontalZoomScroll({
      previousPixelsPerSecond: 50,
      nextPixelsPerSecond: 320,
      previousScrollLeft: ticksToPixels(anchorTicks, S, 50) - anchorViewportX,
      viewportWidth: 1_000,
      anchorTicks,
      anchorViewportX,
      compositionDurationTicks: duration,
    })
    const afterAnchor = pixelsToTicks(nextScroll + anchorViewportX, S, 320)
    expect(Math.abs(afterAnchor - anchorTicks)).toBeLessThanOrEqual(1)
  })

  it('preserves a center fallback anchor when the playhead is outside the viewport', () => {
    const duration = 3_600 * S
    const anchorTicks = 1_800 * S
    const nextScroll = calculateHorizontalZoomScroll({
      previousPixelsPerSecond: 100,
      nextPixelsPerSecond: 25,
      previousScrollLeft: ticksToPixels(anchorTicks, S, 100) - 450,
      viewportWidth: 900,
      anchorTicks,
      anchorViewportX: 450,
      compositionDurationTicks: duration,
    })
    expect(pixelsToTicks(nextScroll + 450, S, 25)).toBe(anchorTicks)
  })

  it('clamps anchored zoom at the start, end, and when the project is shorter than the viewport', () => {
    expect(calculateHorizontalZoomScroll({
      previousPixelsPerSecond: 100,
      nextPixelsPerSecond: 200,
      previousScrollLeft: 0,
      viewportWidth: 800,
      anchorTicks: 0,
      anchorViewportX: 400,
      compositionDurationTicks: 60 * S,
    })).toBe(0)

    expect(calculateHorizontalZoomScroll({
      previousPixelsPerSecond: 100,
      nextPixelsPerSecond: 200,
      previousScrollLeft: 5_000,
      viewportWidth: 800,
      anchorTicks: 60 * S,
      anchorViewportX: 400,
      compositionDurationTicks: 60 * S,
    })).toBe(11_200)

    expect(calculateHorizontalZoomScroll({
      previousPixelsPerSecond: 100,
      nextPixelsPerSecond: 10,
      previousScrollLeft: 100,
      viewportWidth: 800,
      anchorTicks: 10 * S,
      anchorViewportX: 400,
      compositionDurationTicks: 20 * S,
    })).toBe(0)
  })

  it('handles zero-duration zoom without NaN or scroll', () => {
    expect(zoomTimelineAtAnchor({
      viewport: { pixelsPerSecond: 100, scrollLeftPx: 50, viewportWidthPx: 0 },
      nextPixelsPerSecond: 200,
      anchorViewportX: 20,
      durationTicks: 0,
      timescale: S,
    })).toEqual({ pixelsPerSecond: 200, scrollLeftPx: 0, viewportWidthPx: 0 })
  })

  it('handles a long project without exceeding safe integer ticks', () => {
    const duration = 24 * 60 * 60 * S
    const range = visibleTickRange({
      viewport: { pixelsPerSecond: MAX_PIXELS_PER_SECOND, scrollLeftPx: Number.MAX_SAFE_INTEGER, viewportWidthPx: 1920 },
      durationTicks: duration,
      timescale: S,
    })
    expect(Number.isSafeInteger(range.startTicks)).toBe(true)
    expect(Number.isSafeInteger(range.endTicks)).toBe(true)
    expect(range.endTicks).toBeLessThanOrEqual(duration)
  })
})

describe('half-open item intersection', () => {
  it('includes a partial overlap', () => {
    expect(itemIntersectsVisibleRange({
      itemStartTicks: 10,
      itemDurationTicks: 10,
      visibleStartTicks: 15,
      visibleEndTicks: 25,
    })).toBe(true)
  })

  it('excludes a range that only touches the exclusive end', () => {
    expect(itemIntersectsVisibleRange({
      itemStartTicks: 10,
      itemDurationTicks: 10,
      visibleStartTicks: 20,
      visibleEndTicks: 30,
    })).toBe(false)
  })

  it('returns false for invalid numeric input', () => {
    expect(itemIntersectsVisibleRange({
      itemStartTicks: 0,
      itemDurationTicks: 0,
      visibleStartTicks: 0,
      visibleEndTicks: 1,
    })).toBe(false)
  })
})
