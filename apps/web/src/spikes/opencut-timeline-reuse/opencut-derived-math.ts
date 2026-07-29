/**
 * Disposable P0-R spike math.
 *
 * Adapted from OpenCut Classic at commit
 * cf5e79e919144200294fb9fed22a222592a0aeea:
 * - apps/web/src/timeline/scale.ts
 * - apps/web/src/timeline/pixel-utils.ts
 * - apps/web/src/timeline/zoom-utils.ts
 *
 * OpenCut is MIT licensed. See the repository-root THIRD_PARTY_NOTICES.md.
 * Modifications: accept Sanverse's explicit timescale, remove OpenCut WASM and
 * browser-global dependencies, and cap this disposable spike's zoom range.
 */

export const BASE_TIMELINE_PIXELS_PER_SECOND = 50
export const TIMELINE_ZOOM_MAX = 16

export const timelineTicksToPixels = ({
  ticks,
  timescale,
  zoomLevel,
}: {
  ticks: number
  timescale: number
  zoomLevel: number
}): number => (ticks / timescale) * BASE_TIMELINE_PIXELS_PER_SECOND * zoomLevel

export const getTimelineZoomMin = ({
  durationTicks,
  timescale,
  containerWidth,
}: {
  durationTicks: number
  timescale: number
  containerWidth: number
}): number => {
  const safeDurationSeconds = Math.max(durationTicks / timescale, 1)
  const availableWidth = containerWidth * 0.25
  return Math.min(
    TIMELINE_ZOOM_MAX,
    availableWidth / (safeDurationSeconds * BASE_TIMELINE_PIXELS_PER_SECOND),
  )
}

export const sliderToZoom = ({
  sliderPosition,
  minZoom,
}: {
  sliderPosition: number
  minZoom: number
}): number => {
  const clampedPosition = Math.max(0, Math.min(1, sliderPosition))
  return minZoom * (TIMELINE_ZOOM_MAX / minZoom) ** clampedPosition
}
