import { useState } from 'react'

import { MARKER_COLORS, searchMarkers, type MarkerColor, type TimelineMarkerV1 } from '@sanverse/edit-domain'
import { ticksToPixels } from '../../features/timeline'
import { formatTimelineTime } from './timeline-ruler-model'

/**
 * The user's own notes, drawn along the top of the timeline.
 *
 * ## Why they get their own strip and not a track
 *
 * A note is not a thing in the video. It has no sound, no picture and no place
 * in the export. Putting it on one of the five tracks would say the opposite —
 * and worse, it would take up a row that has real work to do.
 *
 * So the notes live in a thin strip above the ruler, where they can be seen
 * against every track at once, which is what a note about a moment is for.
 *
 * ```
 *   ▼ Sponsor read      ▼──────▼ fix the audio
 *   ├────────────────────────────────────────────  ruler
 *   │ V2  ...
 *   │ V1  ...
 * ```
 *
 * A point note is one flag. A note about a stretch is two flags with a bar
 * between them, so the difference is visible without reading anything.
 */

export type TimelineMarkersProps = Readonly<{
  markers: readonly TimelineMarkerV1[]
  timescale: number
  pixelsPerSecond: number
  durationTicks: number
  selectedMarkerId: string | null
  busy: boolean
  onSelectMarker(markerId: string | null): void
  onSeek(ticks: number): void
  onMoveMarker(markerId: string, toStartTicks: number): void
  onDeleteMarker(markerId: string): void
  onEditMarker(markerId: string, changes: Readonly<{ label?: string; note?: string; color?: MarkerColor }>): void
  /** Turns a pointer position into a moment, already snapped. */
  pointerTicks(clientX: number): number
}>

const COLOR_LABELS: Readonly<Record<MarkerColor, string>> = Object.freeze({
  neutral: 'Plain',
  red: 'Red',
  amber: 'Amber',
  green: 'Green',
  blue: 'Blue',
  violet: 'Violet',
})

export function TimelineMarkers({
  markers,
  timescale,
  pixelsPerSecond,
  durationTicks,
  selectedMarkerId,
  busy,
  onSelectMarker,
  onSeek,
  onMoveMarker,
  onDeleteMarker,
  onEditMarker,
  pointerTicks,
}: TimelineMarkersProps) {
  const [dragging, setDragging] = useState<Readonly<{ markerId: string; toTicks: number }> | null>(null)
  const [query, setQuery] = useState('')

  const found = searchMarkers(markers, query)
  const selected = markers.find((marker) => marker.markerId === selectedMarkerId) ?? null

  return (
    <>
      <div
        className="timeline-v1__marker-strip"
        data-testid="timeline-marker-strip"
        aria-label="Your notes"
        role="group"
      >
        {markers.map((marker) => {
          // A note past the end of the video is not drawn. It is not deleted
          // either: the user trimmed the end off, and putting the footage back
          // must bring their note back with it.
          if (marker.startTicks > durationTicks) return null
          const isDragging = dragging?.markerId === marker.markerId
          const at = isDragging ? dragging.toTicks : marker.startTicks
          const leftPx = ticksToPixels(at, timescale, pixelsPerSecond)
          const widthPx = marker.durationTicks > 0
            ? Math.max(2, ticksToPixels(marker.durationTicks, timescale, pixelsPerSecond))
            : 0
          return (
            <button
              key={marker.markerId}
              type="button"
              className="timeline-v1__marker"
              data-marker-id={marker.markerId}
              data-marker-color={marker.color}
              data-marker-range={marker.durationTicks > 0 ? 'true' : 'false'}
              aria-pressed={selectedMarkerId === marker.markerId}
              style={{ left: `${leftPx}px`, width: widthPx > 0 ? `${widthPx}px` : undefined }}
              title={`${marker.label || 'Note'} · ${formatTimelineTime(marker.startTicks, timescale)}${
                marker.note ? ` — ${marker.note}` : ''
              }`}
              aria-label={`Note: ${marker.label || 'no name'}, at ${formatTimelineTime(marker.startTicks, timescale)}${
                marker.durationTicks > 0 ? `, lasting ${(marker.durationTicks / timescale).toFixed(1)} seconds` : ''
              }`}
              onPointerDown={(event) => {
                if (busy) return
                onSelectMarker(marker.markerId)
                onSeek(marker.startTicks)
                // Holding on to the pointer is what lets a drag continue when
                // the hand strays off the flag. It is not worth failing over:
                // if the browser will not give it, the drag still works, it
                // just stops when the pointer leaves. Without the guard, a
                // press with no live pointer throws where the user sees nothing.
                try {
                  event.currentTarget.setPointerCapture(event.pointerId)
                } catch {
                  // Nothing to do. The drag below does not depend on it.
                }
                setDragging({ markerId: marker.markerId, toTicks: marker.startTicks })
              }}
              onPointerMove={(event) => {
                // Moving the pointer is presentation only. No operation, no
                // revision, no Undo entry — the flag simply follows the hand.
                if (!isDragging) return
                setDragging({ markerId: marker.markerId, toTicks: pointerTicks(event.clientX) })
              }}
              onPointerUp={(event) => {
                if (!isDragging) return
                try {
                  event.currentTarget.releasePointerCapture(event.pointerId)
                } catch {
                  // It was never taken. See the note above.
                }
                const to = dragging.toTicks
                setDragging(null)
                // One whole gesture, decided on release. A request per pointer
                // move would be a hundred edits and a hundred Undos for one drag.
                if (to !== marker.startTicks) onMoveMarker(marker.markerId, to)
              }}
              onPointerCancel={() => setDragging(null)}
            >
              <span className="timeline-v1__marker-flag" aria-hidden="true" />
              <span className="timeline-v1__marker-label">{marker.label}</span>
            </button>
          )
        })}
      </div>

      <details className="timeline-v1__marker-list">
        <summary>
          Your notes{markers.length > 0 ? ` (${markers.length})` : ''}
        </summary>

        <div className="timeline-v1__marker-search">
          <label htmlFor="timeline-marker-search">Find a note</label>
          <input
            id="timeline-marker-search"
            type="search"
            value={query}
            data-text-entry
            placeholder="Type part of a note"
            onChange={(event) => setQuery(event.target.value)}
          />
        </div>

        {markers.length === 0 ? (
          <p className="timeline-v1__marker-empty">
            No notes yet. Press the flag in the toolbar to leave one where the playhead is.
          </p>
        ) : found.length === 0 ? (
          <p className="timeline-v1__marker-empty">Nothing matches “{query}”.</p>
        ) : (
          <ul className="timeline-v1__marker-items">
            {found.map((marker) => (
              <li key={marker.markerId} data-marker-row={marker.markerId}>
                <button
                  type="button"
                  className="timeline-v1__marker-goto"
                  onClick={() => {
                    onSelectMarker(marker.markerId)
                    onSeek(marker.startTicks)
                  }}
                >
                  <span className="timeline-v1__marker-time">
                    {formatTimelineTime(marker.startTicks, timescale)}
                  </span>
                  <span className="timeline-v1__marker-name">{marker.label || 'Note'}</span>
                  {marker.note ? <span className="timeline-v1__marker-note">{marker.note}</span> : null}
                </button>
                <button
                  type="button"
                  className="timeline-v1__marker-delete"
                  disabled={busy}
                  title={busy ? 'Project edits are paused right now.' : 'Delete this note'}
                  aria-label={`Delete the note ${marker.label || 'with no name'}`}
                  onClick={() => onDeleteMarker(marker.markerId)}
                >
                  Delete
                </button>
              </li>
            ))}
          </ul>
        )}

        {selected ? (
          <div className="timeline-v1__marker-editor" aria-label="The note you have picked">
            <label htmlFor="timeline-marker-label">What to call it</label>
            <input
              id="timeline-marker-label"
              type="text"
              value={selected.label}
              data-text-entry
              disabled={busy}
              onChange={(event) => onEditMarker(selected.markerId, { label: event.target.value })}
            />
            <label htmlFor="timeline-marker-note">Anything else to remember</label>
            <textarea
              id="timeline-marker-note"
              value={selected.note}
              rows={2}
              data-text-entry
              disabled={busy}
              onChange={(event) => onEditMarker(selected.markerId, { note: event.target.value })}
            />
            <fieldset className="timeline-v1__marker-colors">
              <legend>Colour</legend>
              {MARKER_COLORS.map((color) => (
                <button
                  key={color}
                  type="button"
                  data-marker-color-choice={color}
                  aria-pressed={selected.color === color}
                  disabled={busy}
                  title={COLOR_LABELS[color]}
                  aria-label={COLOR_LABELS[color]}
                  onClick={() => onEditMarker(selected.markerId, { color })}
                >
                  <span aria-hidden="true" />
                </button>
              ))}
            </fieldset>
          </div>
        ) : null}
      </details>
    </>
  )
}
