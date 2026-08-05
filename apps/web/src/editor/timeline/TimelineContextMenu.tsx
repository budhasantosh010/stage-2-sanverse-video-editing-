import { useEffect, useRef } from 'react'

import type { TimelineGesture, TimelineItemView } from '../../features/timeline'
import type { TimelineToolbarAction } from './TimelineToolbar'

export type TimelineContextMenuProps = Readonly<{
  item: TimelineItemView
  x: number
  y: number
  playheadTicks: number
  busy: boolean
  /**
   * Why each action cannot be used, in words — the SAME answers the toolbar
   * uses, passed in rather than worked out again here.
   *
   * Two copies of "can this be done right now" is how a menu ends up offering
   * something the button correctly refuses. The user presses it, nothing
   * happens, and they conclude the product is broken.
   */
  disabledReasons: Readonly<Record<TimelineToolbarAction, string | null>>
  onAction(action: TimelineToolbarAction): void
  onGesture(gesture: TimelineGesture): void
  onSeek(ticks: number): void
  onOpenProposal(): void
  onClose(): void
}>

/**
 * The actions offered on any item, in the order a person reaches for them.
 *
 * Deliberately short. A context menu with twenty entries is a menu nobody
 * reads; the toolbar and the keyboard are where the long list lives.
 */
const ITEM_ACTIONS: readonly Readonly<{ action: TimelineToolbarAction; label: string }>[] = Object.freeze([
  { action: 'copy', label: 'Copy' },
  { action: 'cut', label: 'Cut' },
  { action: 'duplicate', label: 'Make another one, right after' },
  { action: 'group', label: 'Make these move together' },
  { action: 'ungroup', label: 'Stop these moving together' },
  { action: 'close-gap', label: 'Close the empty space' },
  { action: 'transition', label: 'Fade between this clip and the next' },
])

const safeInteriorTick = (item: TimelineItemView): number =>
  Math.min(
    item.startTicks + item.durationTicks - 1,
    item.startTicks + Math.max(1, Math.floor(item.durationTicks / 2)),
  )

export function TimelineContextMenu({
  item,
  x,
  y,
  playheadTicks,
  busy,
  disabledReasons,
  onAction,
  onGesture,
  onSeek,
  onOpenProposal,
  onClose,
}: TimelineContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null)
  const clipId = item.clipId ?? item.linkedClipId
  const editableClip = item.kind === 'clip' && item.state === 'committed' && clipId !== null
  const playheadInside = editableClip && playheadTicks > item.startTicks && playheadTicks < item.startTicks + item.durationTicks

  useEffect(() => {
    menuRef.current?.querySelector<HTMLButtonElement>('[role="menuitem"]')?.focus()
  }, [])

  const run = (action: () => void) => {
    action()
    onClose()
  }

  return (
    <div
      ref={menuRef}
      className="timeline-v1__context-menu"
      role="menu"
      aria-label={`${item.label} timeline actions`}
      style={{ left: `${x}px`, top: `${y}px` }}
      onClick={(event) => event.stopPropagation()}
      onContextMenu={(event) => event.preventDefault()}
      onKeyDown={(event) => {
        if (event.key === 'Escape') {
          event.preventDefault()
          onClose()
        }
      }}
    >
      <strong>{item.label}</strong>
      <button role="menuitem" type="button" onClick={() => run(() => onSeek(safeInteriorTick(item)))}>
        Go to item
      </button>
      {item.state === 'proposed' ? (
        <button role="menuitem" type="button" onClick={() => run(onOpenProposal)}>
          Open proposal
        </button>
      ) : null}
      {/*
        Every entry below is a real action. There are no greyed-out rows that
        exist only to show what MIGHT be possible one day: an entry appears when
        it can be used, and carries its reason when it cannot.
      */}
      {ITEM_ACTIONS.map(({ action, label }) => {
        const reason = busy ? 'Project edits are paused right now.' : disabledReasons[action]
        if (reason !== null) return null
        return (
          <button
            key={action}
            role="menuitem"
            type="button"
            data-context-action={action}
            onClick={() => run(() => onAction(action))}
          >
            {label}
          </button>
        )
      })}
      {editableClip && clipId ? (
        <>
          <button
            role="menuitem"
            type="button"
            disabled={busy || !playheadInside}
            onClick={() => run(() => onGesture({ type: 'split', atTicks: playheadTicks }))}
          >
            Split at playhead
          </button>
          <button
            role="menuitem"
            type="button"
            disabled={busy}
            onClick={() => run(() => onGesture({ type: 'remove-ripple', atTicks: safeInteriorTick(item) }))}
          >
            Remove + close gap
          </button>
          <button
            role="menuitem"
            type="button"
            disabled={busy}
            onClick={() => run(() => onGesture({ type: 'remove-gap', atTicks: safeInteriorTick(item) }))}
          >
            Remove + leave gap
          </button>
          <button
            role="menuitem"
            type="button"
            disabled={busy}
            onClick={() => run(() => onGesture({ type: 'set-enabled', clipId, enabled: !item.enabled }))}
          >
            {item.enabled ? 'Hide section' : 'Show section'}
          </button>
        </>
      ) : null}
    </div>
  )
}
