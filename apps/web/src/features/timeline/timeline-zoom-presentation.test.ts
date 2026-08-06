import { beforeEach, describe, expect, it } from 'vitest'

import type { TimelineTrackId } from '@sanverse/edit-domain'

import {
  DEFAULT_TIMELINE_ZOOM_PRESENTATION,
  DEFAULT_VERTICAL_ZOOM_BASIS_POINTS,
  MAX_VERTICAL_ZOOM_BASIS_POINTS,
  MIN_VERTICAL_ZOOM_BASIS_POINTS,
  TIMELINE_ZOOM_PRESENTATION_SCHEMA_VERSION,
  calculateVerticalZoomScroll,
  clampVerticalZoomBasisPoints,
  horizontalZoomAtLevel,
  horizontalZoomLevelIndex,
  nextHorizontalZoom,
  parseTimelineZoomPresentation,
  readTimelineZoomPresentation,
  verticalZoom,
  writeTimelineZoomPresentation,
  type TimelineTrackLayoutEntry,
} from './timeline-zoom-presentation'
import {
  DEFAULT_TRACK_PRESENTATION,
  effectiveTrackHeightPx,
  setTrackHeight,
  toggleTrackCollapsed,
} from './timeline-track-presentation'

const layout = (heights: readonly [TimelineTrackId, number][]): readonly TimelineTrackLayoutEntry[] => {
  let top = 0
  return heights.map(([trackId, heightPx]) => {
    const entry = Object.freeze({ trackId, topPx: top, heightPx })
    top += heightPx
    return entry
  })
}

describe('dual-axis zoom presentation', () => {
  beforeEach(() => localStorage.clear())

  it('uses perceptual horizontal levels and stays inside the existing scale bounds', () => {
    expect(horizontalZoomAtLevel(0)).toBe(10)
    expect(horizontalZoomAtLevel(Number.MAX_SAFE_INTEGER)).toBe(1_000)
    expect(horizontalZoomLevelIndex(100)).toBeGreaterThan(0)
    expect(nextHorizontalZoom(100, 1)).toBe(125)
    expect(nextHorizontalZoom(100, -1)).toBe(80)
  })

  it('validates and steps vertical zoom from 60 through 200 percent', () => {
    expect(clampVerticalZoomBasisPoints(1)).toBe(MIN_VERTICAL_ZOOM_BASIS_POINTS)
    expect(clampVerticalZoomBasisPoints(14_499)).toBe(14_000)
    expect(clampVerticalZoomBasisPoints(14_501)).toBe(15_000)
    expect(clampVerticalZoomBasisPoints(99_999)).toBe(MAX_VERTICAL_ZOOM_BASIS_POINTS)
  })

  it('multiplies expanded base heights while preserving custom heights and collapsed strips', () => {
    const custom = setTrackHeight(DEFAULT_TRACK_PRESENTATION, 'V1', 73)
    expect(effectiveTrackHeightPx(custom, verticalZoom(15_000), 'V1', 56)).toBe(110)
    expect(effectiveTrackHeightPx(custom, verticalZoom(DEFAULT_VERTICAL_ZOOM_BASIS_POINTS), 'V1', 56)).toBe(73)

    const collapsed = toggleTrackCollapsed(custom, 'V1')
    expect(effectiveTrackHeightPx(collapsed, verticalZoom(20_000), 'V1', 56)).toBe(14)
  })

  it('preserves the selected track center and clamps top/bottom scroll', () => {
    const previous = layout([['V2', 50], ['V1', 70], ['C1', 40], ['A1', 60], ['A2', 60]])
    const next = layout([['V2', 75], ['V1', 105], ['C1', 60], ['A1', 90], ['A2', 90]])
    const previousScrollTop = 40
    const anchorViewportY = previous[3].topPx + previous[3].heightPx / 2 - previousScrollTop
    const nextScroll = calculateVerticalZoomScroll({
      previousTrackLayout: previous,
      nextTrackLayout: next,
      previousScrollTop,
      viewportHeight: 180,
      anchorTrackId: 'A1',
      anchorViewportY,
    })
    const afterCenter = next[3].topPx + next[3].heightPx / 2 - nextScroll
    expect(afterCenter).toBeCloseTo(anchorViewportY, 6)

    expect(calculateVerticalZoomScroll({
      previousTrackLayout: previous,
      nextTrackLayout: next,
      previousScrollTop: 0,
      viewportHeight: 1_000,
      anchorTrackId: null,
      anchorViewportY: 500,
    })).toBe(0)
  })

  it('persists only the two zoom values and refuses corrupt or future shapes', () => {
    writeTimelineZoomPresentation('project_zoom', Object.freeze({
      schemaVersion: TIMELINE_ZOOM_PRESENTATION_SCHEMA_VERSION,
      horizontalPixelsPerSecond: 320,
      vertical: verticalZoom(15_000),
    }))
    expect(readTimelineZoomPresentation('project_zoom')).toEqual({
      schemaVersion: TIMELINE_ZOOM_PRESENTATION_SCHEMA_VERSION,
      horizontalPixelsPerSecond: 320,
      vertical: { scaleBasisPoints: 15_000 },
    })

    expect(parseTimelineZoomPresentation('{"schemaVersion":"future"}')).toEqual(DEFAULT_TIMELINE_ZOOM_PRESENTATION)
    expect(parseTimelineZoomPresentation(JSON.stringify({
      schemaVersion: TIMELINE_ZOOM_PRESENTATION_SCHEMA_VERSION,
      horizontalPixelsPerSecond: 100,
      vertical: { scaleBasisPoints: 10_000 },
      projectRevision: 99,
    }))).toEqual(DEFAULT_TIMELINE_ZOOM_PRESENTATION)
  })
})
