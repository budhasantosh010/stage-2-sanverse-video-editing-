import { useEffect, useRef } from 'react'

import type { TimelineGesture, TimelineItemView } from '../../features/timeline'

export type TimelineContextMenuProps = Readonly<{
  item: TimelineItemView
  x: number
  y: number
  playheadTicks: number
  busy: boolean
  onGesture(gesture: TimelineGesture): void
  onSeek(ticks: number): void
  onOpenProposal(): void
  onClose(): void
}>

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
