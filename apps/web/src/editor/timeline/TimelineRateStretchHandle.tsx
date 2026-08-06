import { useRef, type KeyboardEvent, type PointerEvent as ReactPointerEvent } from 'react'

import type { TimelineSnapResult } from './timeline-snap'

export type RateStretchPreview = Readonly<{
  ok: boolean
  message: string
}>

export function TimelineRateStretchHandle({
  itemStartTicks,
  itemDurationTicks,
  disabled,
  pointerTime,
  previewFor,
  onSnapGuide,
  onDraft,
  onCommit,
}: Readonly<{
  itemStartTicks: number
  itemDurationTicks: number
  disabled: boolean
  pointerTime(clientX: number, excludedTicks?: readonly number[], bypassSnapping?: boolean): TimelineSnapResult
  previewFor(targetDurationTicks: number): RateStretchPreview
  onSnapGuide(ticks: number | null): void
  onDraft(targetDurationTicks: number | null, preview: RateStretchPreview | null): void
  onCommit(targetDurationTicks: number): void
}>) {
  const gesture = useRef<Readonly<{ pointerId: number; originalDurationTicks: number }> | null>(null)
  const latest = useRef(itemDurationTicks)

  const targetAt = (event: ReactPointerEvent<HTMLButtonElement>): number => {
    const snapped = pointerTime(
      event.clientX,
      [itemStartTicks, itemStartTicks + itemDurationTicks],
      event.shiftKey,
    )
    onSnapGuide(snapped.snappedToTicks)
    return Math.max(1, snapped.ticks - itemStartTicks)
  }

  const cancel = (target: HTMLButtonElement | null, pointerId: number | null) => {
    if (target && pointerId !== null && target.hasPointerCapture(pointerId)) target.releasePointerCapture(pointerId)
    gesture.current = null
    latest.current = itemDurationTicks
    onSnapGuide(null)
    onDraft(null, null)
  }

  const pointerDown = (event: ReactPointerEvent<HTMLButtonElement>) => {
    if (disabled || event.button !== 0) return
    gesture.current = Object.freeze({ pointerId: event.pointerId, originalDurationTicks: itemDurationTicks })
    latest.current = itemDurationTicks
    event.currentTarget.setPointerCapture(event.pointerId)
    event.currentTarget.focus()
  }

  const pointerMove = (event: ReactPointerEvent<HTMLButtonElement>) => {
    const active = gesture.current
    if (!active || active.pointerId !== event.pointerId) return
    const target = targetAt(event)
    latest.current = target
    onDraft(target, previewFor(target))
  }

  const pointerUp = (event: ReactPointerEvent<HTMLButtonElement>) => {
    const active = gesture.current
    if (!active || active.pointerId !== event.pointerId) return
    const target = latest.current
    const shouldCommit = target !== active.originalDurationTicks && previewFor(target).ok
    cancel(event.currentTarget, event.pointerId)
    if (shouldCommit) onCommit(target)
  }

  const keyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (event.key !== 'Escape' || !gesture.current) return
    event.preventDefault()
    event.stopPropagation()
    cancel(event.currentTarget, gesture.current.pointerId)
  }

  return (
    <button
      type="button"
      className="timeline-v1__rate-stretch-handle"
      aria-label="Rate Stretch clip duration"
      title="Rate Stretch: drag to change duration and derive speed"
      disabled={disabled}
      onPointerDown={pointerDown}
      onPointerMove={pointerMove}
      onPointerUp={pointerUp}
      onPointerCancel={(event) => cancel(event.currentTarget, event.pointerId)}
      onKeyDown={keyDown}
    >
      <span aria-hidden="true" />
    </button>
  )
}
