export const MIN_PIXELS_PER_SECOND = 10
export const MAX_PIXELS_PER_SECOND = 1_000
export const DEFAULT_PIXELS_PER_SECOND = 100

export type TimelineViewportState = Readonly<{
  pixelsPerSecond: number
  scrollLeftPx: number
  viewportWidthPx: number
}>

export type VisibleTickRange = Readonly<{
  startTicks: number
  endTicks: number
}>

const finiteOr = (value: number, fallback: number): number =>
  Number.isFinite(value) ? value : fallback

const nonNegative = (value: number): number => Math.max(0, finiteOr(value, 0))

const safeInteger = (value: number, rounding: 'floor' | 'ceil' | 'nearest'): number => {
  if (!Number.isFinite(value)) return value > 0 ? Number.MAX_SAFE_INTEGER : 0
  const rounded = rounding === 'floor'
    ? Math.floor(value)
    : rounding === 'ceil'
      ? Math.ceil(value)
      : Math.round(value)
  return Math.min(Number.MAX_SAFE_INTEGER, Math.max(0, rounded))
}

export const clampPixelsPerSecond = (value: number): number =>
  Math.min(MAX_PIXELS_PER_SECOND, Math.max(MIN_PIXELS_PER_SECOND, finiteOr(value, DEFAULT_PIXELS_PER_SECOND)))

/** Finished-video ticks to presentation pixels. */
export const ticksToPixels = (
  ticks: number,
  timescale: number,
  pixelsPerSecond: number,
): number => {
  if (!Number.isFinite(ticks) || ticks <= 0) return 0
  if (!Number.isFinite(timescale) || timescale <= 0) return 0
  const pixels = (ticks / timescale) * clampPixelsPerSecond(pixelsPerSecond)
  return Number.isFinite(pixels) ? Math.min(Number.MAX_SAFE_INTEGER, Math.max(0, pixels)) : Number.MAX_SAFE_INTEGER
}

/**
 * Presentation pixels to the nearest canonical tick.
 *
 * Seeking uses nearest-tick rounding. Visible-range boundaries use floor/ceil
 * separately below so virtualization never drops a partly visible item.
 */
export const pixelsToTicks = (
  pixels: number,
  timescale: number,
  pixelsPerSecond: number,
): number => {
  if (!Number.isFinite(pixels) || pixels <= 0) return 0
  if (!Number.isFinite(timescale) || timescale <= 0) return 0
  const ticks = (pixels / clampPixelsPerSecond(pixelsPerSecond)) * timescale
  return safeInteger(ticks, 'nearest')
}

export const timelineContentWidthPx = (
  durationTicks: number,
  timescale: number,
  pixelsPerSecond: number,
): number => ticksToPixels(durationTicks, timescale, pixelsPerSecond)

export const fitTimelineToViewport = (input: Readonly<{
  durationTicks: number
  timescale: number
  viewportWidthPx: number
  horizontalPaddingPx: number
}>): number => {
  const width = nonNegative(input.viewportWidthPx)
  const padding = nonNegative(input.horizontalPaddingPx)
  if (!Number.isFinite(input.durationTicks) || input.durationTicks <= 0) return DEFAULT_PIXELS_PER_SECOND
  if (!Number.isFinite(input.timescale) || input.timescale <= 0) return DEFAULT_PIXELS_PER_SECOND
  const usableWidth = Math.max(0, width - padding * 2)
  if (usableWidth <= 0) return MIN_PIXELS_PER_SECOND
  const durationSeconds = input.durationTicks / input.timescale
  if (!Number.isFinite(durationSeconds) || durationSeconds <= 0) return DEFAULT_PIXELS_PER_SECOND
  return clampPixelsPerSecond(usableWidth / durationSeconds)
}

export const clampTimelineScroll = (input: Readonly<{
  scrollLeftPx: number
  contentWidthPx: number
  viewportWidthPx: number
}>): number => {
  const contentWidth = nonNegative(input.contentWidthPx)
  const viewportWidth = nonNegative(input.viewportWidthPx)
  const maximum = Math.max(0, contentWidth - viewportWidth)
  return Math.min(maximum, nonNegative(input.scrollLeftPx))
}

export const visibleTickRange = (input: Readonly<{
  viewport: TimelineViewportState
  durationTicks: number
  timescale: number
}>): VisibleTickRange => {
  const duration = safeInteger(input.durationTicks, 'floor')
  if (duration === 0 || !Number.isFinite(input.timescale) || input.timescale <= 0) {
    return Object.freeze({ startTicks: 0, endTicks: 0 })
  }
  const pixelsPerSecond = clampPixelsPerSecond(input.viewport.pixelsPerSecond)
  const contentWidth = timelineContentWidthPx(duration, input.timescale, pixelsPerSecond)
  const viewportWidth = nonNegative(input.viewport.viewportWidthPx)
  const scrollLeft = clampTimelineScroll({
    scrollLeftPx: input.viewport.scrollLeftPx,
    contentWidthPx: contentWidth,
    viewportWidthPx: viewportWidth,
  })
  const start = (scrollLeft / pixelsPerSecond) * input.timescale
  const end = ((scrollLeft + viewportWidth) / pixelsPerSecond) * input.timescale
  return Object.freeze({
    startTicks: Math.min(duration, safeInteger(start, 'floor')),
    endTicks: Math.min(duration, safeInteger(end, 'ceil')),
  })
}

/**
 * Zoom while keeping the same timeline instant under the pointer/playhead.
 * Scroll is clamped only after the anchor-preserving position is calculated.
 */
export const zoomTimelineAtAnchor = (input: Readonly<{
  viewport: TimelineViewportState
  nextPixelsPerSecond: number
  anchorViewportX: number
  durationTicks: number
  timescale: number
}>): TimelineViewportState => {
  const viewportWidth = nonNegative(input.viewport.viewportWidthPx)
  const currentPixelsPerSecond = clampPixelsPerSecond(input.viewport.pixelsPerSecond)
  const nextPixelsPerSecond = clampPixelsPerSecond(input.nextPixelsPerSecond)
  const duration = safeInteger(input.durationTicks, 'floor')
  const anchorX = Math.min(viewportWidth, nonNegative(input.anchorViewportX))

  if (duration === 0 || !Number.isFinite(input.timescale) || input.timescale <= 0) {
    return Object.freeze({ pixelsPerSecond: nextPixelsPerSecond, scrollLeftPx: 0, viewportWidthPx: viewportWidth })
  }

  const currentContentWidth = timelineContentWidthPx(duration, input.timescale, currentPixelsPerSecond)
  const currentScroll = clampTimelineScroll({
    scrollLeftPx: input.viewport.scrollLeftPx,
    contentWidthPx: currentContentWidth,
    viewportWidthPx: viewportWidth,
  })
  const anchorSeconds = (currentScroll + anchorX) / currentPixelsPerSecond
  const nextContentWidth = timelineContentWidthPx(duration, input.timescale, nextPixelsPerSecond)
  const nextScroll = clampTimelineScroll({
    scrollLeftPx: anchorSeconds * nextPixelsPerSecond - anchorX,
    contentWidthPx: nextContentWidth,
    viewportWidthPx: viewportWidth,
  })

  return Object.freeze({
    pixelsPerSecond: nextPixelsPerSecond,
    scrollLeftPx: nextScroll,
    viewportWidthPx: viewportWidth,
  })
}

/** Half-open intersection: touching at one item's exclusive end is not visible. */
export const itemIntersectsVisibleRange = (input: Readonly<{
  itemStartTicks: number
  itemDurationTicks: number
  visibleStartTicks: number
  visibleEndTicks: number
}>): boolean => {
  const { itemStartTicks, itemDurationTicks, visibleStartTicks, visibleEndTicks } = input
  if (
    !Number.isSafeInteger(itemStartTicks) ||
    !Number.isSafeInteger(itemDurationTicks) ||
    !Number.isSafeInteger(visibleStartTicks) ||
    !Number.isSafeInteger(visibleEndTicks) ||
    itemStartTicks < 0 ||
    itemDurationTicks <= 0 ||
    visibleStartTicks < 0 ||
    visibleEndTicks < visibleStartTicks
  ) {
    return false
  }
  const itemEndTicks = itemStartTicks + itemDurationTicks
  if (!Number.isSafeInteger(itemEndTicks)) return false
  return itemStartTicks < visibleEndTicks && visibleStartTicks < itemEndTicks
}
