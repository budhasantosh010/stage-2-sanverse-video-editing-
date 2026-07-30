import type { TimelineViewportState } from '../../features/timeline'
import { formatTimelineTime } from './timeline-ruler-model'

export type TimelineToolbarProps = Readonly<{
  durationTicks: number
  timescale: number
  viewport: TimelineViewportState
  selectedSummary: string | null
  busy: boolean
  onZoomOut(): void
  onZoomIn(): void
  onFit(): void
}>

export function TimelineToolbar({
  durationTicks,
  timescale,
  viewport,
  selectedSummary,
  busy,
  onZoomOut,
  onZoomIn,
  onFit,
}: TimelineToolbarProps) {
  return (
    <div className="timeline-v1__toolbar" aria-label="Timeline controls">
      <div className="timeline-v1__toolbar-title">
        <strong>Timeline</strong>
        <span>{formatTimelineTime(durationTicks, timescale)} total</span>
      </div>
      <div className="timeline-v1__zoom-controls" role="group" aria-label="Timeline zoom">
        <button type="button" onClick={onZoomOut} aria-label="Zoom timeline out">−</button>
        <output aria-label="Timeline zoom level">{Math.round(viewport.pixelsPerSecond)} px/s</output>
        <button type="button" onClick={onZoomIn} aria-label="Zoom timeline in">+</button>
        <button type="button" onClick={onFit}>Fit</button>
      </div>
      <p className="timeline-v1__selection-summary" title={selectedSummary ?? undefined}>
        {busy ? 'Project edits are temporarily paused.' : selectedSummary ?? 'Select an item to see its actions.'}
      </p>
    </div>
  )
}
