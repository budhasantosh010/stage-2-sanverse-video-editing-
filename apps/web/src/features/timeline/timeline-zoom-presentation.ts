import type { TimelineTrackId } from '@sanverse/edit-domain'

import {
  DEFAULT_PIXELS_PER_SECOND,
  MAX_PIXELS_PER_SECOND,
  MIN_PIXELS_PER_SECOND,
  clampPixelsPerSecond,
} from './timeline-viewport-state'

export const TIMELINE_ZOOM_PRESENTATION_SCHEMA_VERSION = 'sanverse.timeline-zoom-presentation/v1' as const
export const MIN_VERTICAL_ZOOM_BASIS_POINTS = 6_000
export const MAX_VERTICAL_ZOOM_BASIS_POINTS = 20_000
export const DEFAULT_VERTICAL_ZOOM_BASIS_POINTS = 10_000
export const VERTICAL_ZOOM_STEP_BASIS_POINTS = 1_000

export type TimelineVerticalZoomV1 = Readonly<{
  scaleBasisPoints: number
}>

export type TimelineZoomPresentationV1 = Readonly<{
  schemaVersion: typeof TIMELINE_ZOOM_PRESENTATION_SCHEMA_VERSION
  horizontalPixelsPerSecond: number
  vertical: TimelineVerticalZoomV1
}>

/**
 * Perceptual horizontal levels. Adjacent thumbs feel evenly spaced even though
 * the whole useful range spans two orders of magnitude.
 */
export const HORIZONTAL_ZOOM_LEVELS = Object.freeze([
  10, 12.5, 16, 20, 25, 32, 40, 50, 64, 80, 100, 125, 160, 200, 250, 320,
  400, 500, 640, 800, 1_000,
] as const)

export const clampVerticalZoomBasisPoints = (value: number): number => {
  if (!Number.isFinite(value)) return DEFAULT_VERTICAL_ZOOM_BASIS_POINTS
  const stepped = Math.round(value / VERTICAL_ZOOM_STEP_BASIS_POINTS) * VERTICAL_ZOOM_STEP_BASIS_POINTS
  return Math.min(MAX_VERTICAL_ZOOM_BASIS_POINTS, Math.max(MIN_VERTICAL_ZOOM_BASIS_POINTS, stepped))
}

export const verticalZoom = (scaleBasisPoints: number): TimelineVerticalZoomV1 => Object.freeze({
  scaleBasisPoints: clampVerticalZoomBasisPoints(scaleBasisPoints),
})

export const DEFAULT_TIMELINE_ZOOM_PRESENTATION: TimelineZoomPresentationV1 = Object.freeze({
  schemaVersion: TIMELINE_ZOOM_PRESENTATION_SCHEMA_VERSION,
  horizontalPixelsPerSecond: DEFAULT_PIXELS_PER_SECOND,
  vertical: verticalZoom(DEFAULT_VERTICAL_ZOOM_BASIS_POINTS),
})

export const horizontalZoomLevelIndex = (pixelsPerSecond: number): number => {
  const bounded = clampPixelsPerSecond(pixelsPerSecond)
  let closest = 0
  let distance = Number.POSITIVE_INFINITY
  HORIZONTAL_ZOOM_LEVELS.forEach((level, index) => {
    const nextDistance = Math.abs(Math.log(bounded) - Math.log(level))
    if (nextDistance < distance) {
      distance = nextDistance
      closest = index
    }
  })
  return closest
}

export const horizontalZoomAtLevel = (index: number): number => {
  if (!Number.isFinite(index)) return DEFAULT_PIXELS_PER_SECOND
  const bounded = Math.min(HORIZONTAL_ZOOM_LEVELS.length - 1, Math.max(0, Math.round(index)))
  return HORIZONTAL_ZOOM_LEVELS[bounded]
}

export const nextHorizontalZoom = (pixelsPerSecond: number, direction: -1 | 1): number => {
  const index = horizontalZoomLevelIndex(pixelsPerSecond)
  return horizontalZoomAtLevel(index + direction)
}

const storageKey = (projectId: string): string => `sanverse.timeline-zoom-presentation.${projectId}`

export const parseTimelineZoomPresentation = (raw: unknown): TimelineZoomPresentationV1 => {
  if (typeof raw !== 'string' || raw.length === 0) return DEFAULT_TIMELINE_ZOOM_PRESENTATION
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    return DEFAULT_TIMELINE_ZOOM_PRESENTATION
  }
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    return DEFAULT_TIMELINE_ZOOM_PRESENTATION
  }
  const record = parsed as Record<string, unknown>
  if (record.schemaVersion !== TIMELINE_ZOOM_PRESENTATION_SCHEMA_VERSION) {
    return DEFAULT_TIMELINE_ZOOM_PRESENTATION
  }
  const keys = Object.keys(record)
  if (keys.length !== 3 || !keys.every((key) => ['schemaVersion', 'horizontalPixelsPerSecond', 'vertical'].includes(key))) {
    return DEFAULT_TIMELINE_ZOOM_PRESENTATION
  }
  if (typeof record.horizontalPixelsPerSecond !== 'number' || !Number.isFinite(record.horizontalPixelsPerSecond)) {
    return DEFAULT_TIMELINE_ZOOM_PRESENTATION
  }
  if (typeof record.vertical !== 'object' || record.vertical === null || Array.isArray(record.vertical)) {
    return DEFAULT_TIMELINE_ZOOM_PRESENTATION
  }
  const verticalRecord = record.vertical as Record<string, unknown>
  if (Object.keys(verticalRecord).length !== 1 || typeof verticalRecord.scaleBasisPoints !== 'number' || !Number.isFinite(verticalRecord.scaleBasisPoints)) {
    return DEFAULT_TIMELINE_ZOOM_PRESENTATION
  }
  return Object.freeze({
    schemaVersion: TIMELINE_ZOOM_PRESENTATION_SCHEMA_VERSION,
    horizontalPixelsPerSecond: clampPixelsPerSecond(record.horizontalPixelsPerSecond),
    vertical: verticalZoom(verticalRecord.scaleBasisPoints),
  })
}

export const readTimelineZoomPresentation = (projectId: string): TimelineZoomPresentationV1 => {
  try {
    return parseTimelineZoomPresentation(globalThis.localStorage?.getItem(storageKey(projectId)))
  } catch {
    return DEFAULT_TIMELINE_ZOOM_PRESENTATION
  }
}

export const writeTimelineZoomPresentation = (
  projectId: string,
  state: TimelineZoomPresentationV1,
): void => {
  const normalized = Object.freeze({
    schemaVersion: TIMELINE_ZOOM_PRESENTATION_SCHEMA_VERSION,
    horizontalPixelsPerSecond: clampPixelsPerSecond(state.horizontalPixelsPerSecond),
    vertical: verticalZoom(state.vertical.scaleBasisPoints),
  })
  try {
    globalThis.localStorage?.setItem(storageKey(projectId), JSON.stringify(normalized))
  } catch {
    // This is a screen preference. Storage failure must never block the project.
  }
}

export type TimelineTrackLayoutEntry = Readonly<{
  trackId: TimelineTrackId
  topPx: number
  heightPx: number
}>

export const calculateVerticalZoomScroll = (input: Readonly<{
  previousTrackLayout: readonly TimelineTrackLayoutEntry[]
  nextTrackLayout: readonly TimelineTrackLayoutEntry[]
  previousScrollTop: number
  viewportHeight: number
  anchorTrackId: TimelineTrackId | null
  anchorViewportY: number
}>): number => {
  const viewportHeight = Math.max(0, Number.isFinite(input.viewportHeight) ? input.viewportHeight : 0)
  const previousScrollTop = Math.max(0, Number.isFinite(input.previousScrollTop) ? input.previousScrollTop : 0)
  const anchorViewportY = Math.min(
    viewportHeight,
    Math.max(0, Number.isFinite(input.anchorViewportY) ? input.anchorViewportY : viewportHeight / 2),
  )
  const previousHeight = input.previousTrackLayout.reduce((maximum, entry) =>
    Math.max(maximum, entry.topPx + entry.heightPx), 0)
  const nextHeight = input.nextTrackLayout.reduce((maximum, entry) =>
    Math.max(maximum, entry.topPx + entry.heightPx), 0)

  let nextAnchorContentY: number
  const previousTrack = input.anchorTrackId
    ? input.previousTrackLayout.find((entry) => entry.trackId === input.anchorTrackId)
    : undefined
  const nextTrack = input.anchorTrackId
    ? input.nextTrackLayout.find((entry) => entry.trackId === input.anchorTrackId)
    : undefined

  if (previousTrack && nextTrack) {
    const previousAnchorContentY = previousScrollTop + anchorViewportY
    const relative = previousTrack.heightPx <= 0
      ? 0.5
      : Math.min(1, Math.max(0, (previousAnchorContentY - previousTrack.topPx) / previousTrack.heightPx))
    nextAnchorContentY = nextTrack.topPx + nextTrack.heightPx * relative
  } else {
    const previousAnchorContentY = previousScrollTop + anchorViewportY
    const ratio = previousHeight <= 0 ? 0 : previousAnchorContentY / previousHeight
    nextAnchorContentY = ratio * nextHeight
  }

  const maximumScroll = Math.max(0, nextHeight - viewportHeight)
  return Math.min(maximumScroll, Math.max(0, nextAnchorContentY - anchorViewportY))
}

export const horizontalZoomAtMinimum = (pixelsPerSecond: number): boolean =>
  clampPixelsPerSecond(pixelsPerSecond) <= MIN_PIXELS_PER_SECOND

export const horizontalZoomAtMaximum = (pixelsPerSecond: number): boolean =>
  clampPixelsPerSecond(pixelsPerSecond) >= MAX_PIXELS_PER_SECOND
