import { useMemo, useRef } from 'react'

import type { TimelineGesture, TimelineItemView } from '../../features/timeline'
import { formatTimelineTime } from './timeline-ruler-model'

export type TimelineContextActionsProps = Readonly<{
  selectedItem: TimelineItemView | null
  playheadTicks: number
  timescale: number
  busy: boolean
  trimAmountTicks: number
  gainDb: number
  fadeInTicks: number
  fadeOutTicks: number
  onGesture(gesture: TimelineGesture): void
  onSeek(ticks: number): void
  onOpenProposal(): void
  /** Closing a hole. Null when it can be done; otherwise the reason it cannot. */
  closeGapDisabledReason: string | null
  onCloseGap(): void
  onOpenAdvancedControls(): void
}>

export function TimelineContextActions({
  selectedItem,
  playheadTicks,
  timescale,
  busy,
  trimAmountTicks,
  gainDb,
  fadeInTicks,
  fadeOutTicks,
  onGesture,
  onSeek,
  onOpenProposal,
  closeGapDisabledReason,
  onCloseGap,
  onOpenAdvancedControls,
}: TimelineContextActionsProps) {
  const firstRemovalButtonRef = useRef<HTMLButtonElement>(null)
  const clipId = selectedItem?.clipId ?? selectedItem?.linkedClipId ?? null
  const isEditableClip = Boolean(selectedItem && clipId && selectedItem.state === 'committed' && selectedItem.kind === 'clip')
  const isVideoClip = selectedItem?.clipId !== null
  const playheadInsideSelected = Boolean(
    selectedItem &&
    selectedItem.kind === 'clip' &&
    playheadTicks > selectedItem.startTicks &&
    playheadTicks < selectedItem.startTicks + selectedItem.durationTicks,
  )
  const summary = useMemo(() => {
    if (!selectedItem) return 'No timeline item selected.'
    return `${selectedItem.label} · ${formatTimelineTime(selectedItem.startTicks, timescale, true)} · ${formatTimelineTime(selectedItem.durationTicks, timescale, true)}`
  }, [selectedItem, timescale])

  return (
    <div
      className="timeline-v1__context"
      aria-label="Selected timeline item actions"
      data-removal-focus-target
      onKeyDown={(event) => {
        if ((event.key === 'Delete' || event.key === 'Backspace') && firstRemovalButtonRef.current) {
          event.preventDefault()
          firstRemovalButtonRef.current.focus()
        }
      }}
    >
      <p>{summary}</p>
      {!selectedItem ? null : selectedItem.state === 'proposed' ? (
        <div className="timeline-v1__context-actions">
          <button type="button" onClick={() => onSeek(selectedItem.startTicks)}>Go to proposal</button>
          <button type="button" onClick={onOpenProposal}>Open proposal</button>
        </div>
      ) : selectedItem.state === 'blocked' ? (
        <p className="timeline-v1__context-warning">This item needs attention before it can be edited.</p>
      ) : selectedItem.kind === 'gap' ? (
        /*
          A hole is nothing, and it says so. It never claims to be a clip and it
          never shows a filmstrip. But it is now something the user can act on:
          before this, closing a hole meant hunting for the clip after it and
          using a control that talked about that clip instead.
        */
        <div className="timeline-v1__context-actions">
          <p className="timeline-v1__context-note">
            Empty space, {(selectedItem.durationTicks / timescale).toFixed(1)} seconds long. Nothing plays here.
          </p>
          <button
            type="button"
            data-timeline-close-gap
            disabled={busy || closeGapDisabledReason !== null}
            title={closeGapDisabledReason ?? 'Pull everything after this back, so the space is gone.'}
            onClick={onCloseGap}
          >
            Close the empty space
          </button>
        </div>
      ) : isEditableClip && clipId ? (
        <div className="timeline-v1__context-actions">
          {isVideoClip ? (
            <button
              type="button"
              disabled={busy || !playheadInsideSelected}
              title={playheadInsideSelected ? undefined : 'Move the playhead inside this section before splitting.'}
              onClick={() => onGesture({ type: 'split', atTicks: playheadTicks })}
            >
              Split at playhead
            </button>
          ) : null}
          <button type="button" disabled={busy} onClick={() => onGesture({ type: 'trim-start', clipId, deltaTicks: trimAmountTicks })}>Trim start</button>
          <button type="button" disabled={busy} onClick={() => onGesture({ type: 'trim-end', clipId, deltaTicks: trimAmountTicks })}>Trim end</button>
          <button ref={firstRemovalButtonRef} data-timeline-removal-action type="button" disabled={busy} onClick={() => onGesture({ type: 'remove-ripple', atTicks: selectedItem.startTicks })}>Remove + close gap</button>
          <button type="button" disabled={busy} onClick={() => onGesture({ type: 'remove-gap', atTicks: selectedItem.startTicks })}>Remove + leave gap</button>
          <button type="button" disabled={busy} onClick={() => onGesture({ type: 'set-enabled', clipId, enabled: !selectedItem.enabled })}>{selectedItem.enabled ? 'Hide section' : 'Show section'}</button>
          <button type="button" disabled={busy} onClick={() => onGesture({ type: 'move-earlier', clipId })}>Move earlier</button>
          <button type="button" disabled={busy} onClick={() => onGesture({ type: 'move-later', clipId })}>Move later</button>
          <button type="button" disabled={busy} onClick={() => onGesture({ type: 'set-audio', clipId, gainDb, fadeInTicks, fadeOutTicks })}>Audio settings</button>
        </div>
      ) : (
        <div className="timeline-v1__context-actions">
          <button type="button" onClick={() => onSeek(selectedItem.startTicks)}>Go to item</button>
          <button type="button" onClick={onOpenAdvancedControls}>Open available controls</button>
        </div>
      )}
    </div>
  )
}
