import { useRef, type KeyboardEvent, type PointerEvent } from 'react'

import type { TimelineSnapResult } from './timeline-snap'

export type TimelineTrimHandleProps = Readonly<{
  edge: 'start' | 'end'
  disabled: boolean
  itemStartTicks: number
  itemDurationTicks: number
  pointerTime(clientX: number, excludedTicks?: readonly number[]): TimelineSnapResult
  onSnapGuide(ticks: number | null): void
  onPreview(deltaTicks: number | null): void
  onCommit(deltaTicks: number): void
}>

export function TimelineTrimHandle({
  edge,
  disabled,
  itemStartTicks,
  itemDurationTicks,
  pointerTime,
  onSnapGuide,
  onPreview,
  onCommit,
}: TimelineTrimHandleProps) {
  const pointerIdRef = useRef<number | null>(null)
  const itemEnd = itemStartTicks + itemDurationTicks

  const resolvedFor = (clientX: number): Readonly<{ deltaTicks: number; snappedToTicks: number | null }> => {
    const resolved = pointerTime(clientX, [edge === 'start' ? itemStartTicks : itemEnd])
    const raw = edge === 'start' ? resolved.ticks - itemStartTicks : itemEnd - resolved.ticks
    return Object.freeze({
      deltaTicks: Math.min(itemDurationTicks - 1, Math.max(0, Math.round(raw))),
      snappedToTicks: resolved.snappedToTicks,
    })
  }

  const cancel = () => {
    pointerIdRef.current = null
    onSnapGuide(null)
    onPreview(null)
  }

  const onKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (event.key === 'Escape') {
      event.preventDefault()
      cancel()
    }
  }

  const onPointerMove = (event: PointerEvent<HTMLButtonElement>) => {
    if (pointerIdRef.current !== event.pointerId) return
    const resolved = resolvedFor(event.clientX)
    onSnapGuide(resolved.snappedToTicks)
    onPreview(resolved.deltaTicks)
  }

  return (
    <button
      type="button"
      className={`timeline-v1__trim-handle timeline-v1__trim-handle--${edge}`}
      aria-label={`Trim ${edge}`}
      disabled={disabled}
      onKeyDown={onKeyDown}
      onPointerDown={(event) => {
        if (disabled || event.button !== 0) return
        event.stopPropagation()
        pointerIdRef.current = event.pointerId
        event.currentTarget.setPointerCapture(event.pointerId)
        const resolved = resolvedFor(event.clientX)
        onSnapGuide(resolved.snappedToTicks)
        onPreview(resolved.deltaTicks)
      }}
      onPointerMove={onPointerMove}
      onPointerUp={(event) => {
        if (pointerIdRef.current !== event.pointerId) return
        event.stopPropagation()
        const resolved = resolvedFor(event.clientX)
        pointerIdRef.current = null
        onSnapGuide(null)
        onPreview(null)
        if (resolved.deltaTicks > 0) onCommit(resolved.deltaTicks)
        if (event.currentTarget.hasPointerCapture(event.pointerId)) {
          event.currentTarget.releasePointerCapture(event.pointerId)
        }
      }}
      onPointerCancel={cancel}
      onLostPointerCapture={() => {
        if (pointerIdRef.current !== null) cancel()
      }}
    >
      <span aria-hidden="true" />
    </button>
  )
}
