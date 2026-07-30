import { useMemo } from 'react'

import type { TimelineViewportState, VisibleTickRange } from '../../features/timeline'
import { buildTimelineRulerModel, timelinePointerToTicks } from './timeline-ruler-model'

export type TimelineRulerProps = Readonly<{
  durationTicks: number
  timescale: number
  viewport: TimelineViewportState
  visibleRange: VisibleTickRange
  onSeek(ticks: number): void
}>

export function TimelineRuler({
  durationTicks,
  timescale,
  viewport,
  visibleRange,
  onSeek,
}: TimelineRulerProps) {
  const model = useMemo(() => buildTimelineRulerModel({
    visibleStartTicks: visibleRange.startTicks,
    visibleEndTicks: visibleRange.endTicks,
    durationTicks,
    timescale,
    pixelsPerSecond: viewport.pixelsPerSecond,
    viewportWidthPx: viewport.viewportWidthPx,
    scrollLeftPx: viewport.scrollLeftPx,
  }), [durationTicks, timescale, viewport, visibleRange])

  return (
    <div
      className="timeline-v1__ruler"
      aria-label="Timeline ruler"
      data-testid="timeline-ruler"
      onClick={(event) => {
        const viewportElement = event.currentTarget.closest<HTMLElement>('[data-timeline-viewport]')
        if (!viewportElement) return
        onSeek(timelinePointerToTicks({
          clientX: event.clientX,
          viewportLeftPx: viewportElement.getBoundingClientRect().left,
          scrollLeftPx: viewportElement.scrollLeft,
          pixelsPerSecond: viewport.pixelsPerSecond,
          timescale,
          durationTicks,
        }))
      }}
    >
      {model.ticks.map((tick) => (
        <span
          key={`${tick.ticks}:${tick.major ? 'major' : 'minor'}`}
          className={tick.major ? 'timeline-v1__ruler-tick timeline-v1__ruler-tick--major' : 'timeline-v1__ruler-tick'}
          style={{ left: `${tick.xPx + viewport.scrollLeftPx}px` }}
          aria-hidden="true"
        >
          {tick.label ? <span>{tick.label}</span> : null}
        </span>
      ))}
    </div>
  )
}
