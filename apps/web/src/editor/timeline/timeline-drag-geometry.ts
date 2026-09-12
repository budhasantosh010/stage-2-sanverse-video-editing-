export type DragPoint = Readonly<{ x: number; y: number }>
export type DragBounds = Readonly<{ left: number; right: number; top: number; bottom: number }>
const inside = (point: DragPoint, bounds: DragBounds): boolean =>
  bounds.right > bounds.left && bounds.bottom > bounds.top &&
  point.x >= bounds.left && point.x <= bounds.right && point.y >= bounds.top && point.y <= bounds.bottom

/** Pixels per frame, bounded by time rather than pointer-event frequency. */
export function dragEdgeScroll(point: DragPoint, bounds: DragBounds, elapsedMs: number): DragPoint {
  if (!inside(point, bounds) || !Number.isFinite(elapsedMs)) return { x: 0, y: 0 }
  const step = Math.min(32, Math.max(0, elapsedMs)) * 0.72
  const axis = (value: number, start: number, end: number) => {
    const zone = Math.min(40, (end - start) / 4)
    const pressure = value < start + zone ? -(1 - (value - start) / zone)
      : value > end - zone ? 1 - (end - value) / zone : 0
    return Math.round(pressure * Math.abs(pressure) * step * 1000) / 1000
  }
  return { x: axis(point.x, bounds.left, bounds.right), y: axis(point.y, bounds.top, bounds.bottom) }
}
export function dragTrackAt(point: DragPoint, viewport: DragBounds, tracks: readonly (DragBounds & { trackId: string })[]): string | null {
  if (!inside(point, viewport)) return null
  return tracks.find(track => point.y >= track.top && point.y < track.bottom)?.trackId ?? null
}
