import { PLACEMENT_MODES, type PlacementMode, type TimelineViewportState } from '../../features/timeline'
import { formatTimelineTime } from './timeline-ruler-model'

/**
 * The Timeline's controls.
 *
 * Every button here does something. There is no control that looks available
 * and then does nothing, and no mode that quietly behaves like a different mode
 * — a user who picks "Insert" and gets "Normal" loses the clip they meant to
 * push along, and does not find out until the export.
 *
 * When something cannot be done right now, the button is disabled AND says why
 * in words, on hover and to a screen reader. "Split" greyed out with no reason
 * is the product refusing to explain itself.
 */

export type TimelineToolbarAction =
  | 'split'
  | 'lift'
  | 'ripple-delete'

export type TimelineToolbarProps = Readonly<{
  durationTicks: number
  timescale: number
  viewport: TimelineViewportState
  selectedSummary: string | null
  /** Null when the action is available; otherwise the reason it is not, in words. */
  disabledReasons: Readonly<Record<TimelineToolbarAction, string | null>>
  snappingEnabled: boolean
  placementMode: PlacementMode
  busy: boolean
  onAction(action: TimelineToolbarAction): void
  onToggleSnapping(): void
  onPlacementMode(mode: PlacementMode): void
  onZoomOut(): void
  onZoomIn(): void
  onFit(): void
}>

const MODE_LABELS: Readonly<Record<PlacementMode, string>> = Object.freeze({
  normal: 'Normal',
  insert: 'Insert',
  overwrite: 'Overwrite',
  append: 'Append',
})

const MODE_HINTS: Readonly<Record<PlacementMode, string>> = Object.freeze({
  normal: 'Put it where you drop it, and refuse if something is already there.',
  insert: 'Put it where you drop it and push everything after it along.',
  overwrite: 'Put it where you drop it and cut back whatever it lands on.',
  append: 'Put it after the last thing on that track.',
})

const ACTION_LABELS: Readonly<Record<TimelineToolbarAction, string>> = Object.freeze({
  split: 'Split',
  lift: 'Delete',
  'ripple-delete': 'Ripple delete',
})

const ACTION_KEYS: Readonly<Record<TimelineToolbarAction, string>> = Object.freeze({
  split: 'Ctrl+B',
  lift: 'Delete',
  'ripple-delete': 'Shift+Delete',
})

export function TimelineToolbar({
  durationTicks,
  timescale,
  viewport,
  selectedSummary,
  disabledReasons,
  snappingEnabled,
  placementMode,
  busy,
  onAction,
  onToggleSnapping,
  onPlacementMode,
  onZoomOut,
  onZoomIn,
  onFit,
}: TimelineToolbarProps) {
  return (
    <div className="timeline-v1__toolbar" aria-label="Timeline controls">
      <div className="timeline-v1__toolbar-group" role="group" aria-label="Edit">
        {(Object.keys(ACTION_LABELS) as TimelineToolbarAction[]).map((action) => {
          const reason = busy ? 'Project edits are paused right now.' : disabledReasons[action]
          return (
            <button
              key={action}
              type="button"
              className="timeline-v1__toolbar-button"
              disabled={reason !== null}
              // The reason travels with the control rather than sitting in a
              // status line somewhere else on the page, so it is still there
              // for somebody using a screen reader or a keyboard.
              title={reason ?? `${ACTION_LABELS[action]} (${ACTION_KEYS[action]})`}
              aria-label={reason ? `${ACTION_LABELS[action]} — ${reason}` : ACTION_LABELS[action]}
              data-timeline-action={action}
              onClick={() => onAction(action)}
            >
              {ACTION_LABELS[action]}
            </button>
          )
        })}
      </div>

      <div className="timeline-v1__toolbar-group" role="group" aria-label="How a drop lands">
        {PLACEMENT_MODES.map((mode) => (
          <button
            key={mode}
            type="button"
            className="timeline-v1__toolbar-button"
            aria-pressed={placementMode === mode}
            data-placement-mode={mode}
            title={MODE_HINTS[mode]}
            onClick={() => onPlacementMode(mode)}
          >
            {MODE_LABELS[mode]}
          </button>
        ))}
      </div>

      <div className="timeline-v1__toolbar-group" role="group" aria-label="Snapping">
        <button
          type="button"
          className="timeline-v1__toolbar-button"
          aria-pressed={snappingEnabled}
          data-timeline-snapping
          title="Snap to the edges of nearby items and to the playhead (S). Hold Shift while dragging to ignore it."
          onClick={onToggleSnapping}
        >
          Snapping
        </button>
      </div>

      <div className="timeline-v1__zoom-controls" role="group" aria-label="Timeline zoom">
        <button type="button" onClick={onZoomOut} aria-label="Zoom timeline out" title="Zoom out (−)">−</button>
        <output aria-label="Timeline zoom level">{Math.round(viewport.pixelsPerSecond)} px/s</output>
        <button type="button" onClick={onZoomIn} aria-label="Zoom timeline in" title="Zoom in (+)">+</button>
        <button type="button" onClick={onFit} title="Fit the whole video on screen">Fit</button>
      </div>

      <p className="timeline-v1__selection-summary" title={selectedSummary ?? undefined}>
        <span className="timeline-v1__toolbar-duration">{formatTimelineTime(durationTicks, timescale)}</span>
        {busy ? ' · edits paused' : selectedSummary ? ` · ${selectedSummary}` : ''}
      </p>
    </div>
  )
}
