import { useRef, type KeyboardEvent, type PointerEvent } from 'react'

import type { PrecisionTrimPlan, PrecisionTrimRequestV1 } from '../../features/timeline'
import type { TimelineSnapResult } from './timeline-snap'

export type TimelinePrecisionHandleProps = Readonly<{
  kind: 'edge' | 'body'
  edge?: 'start' | 'end'
  label: string
  disabled: boolean
  itemStartTicks: number
  itemDurationTicks: number
  frameTicks: number
  pointerTicks(clientX: number): number
  pointerTime(clientX: number, excludedTicks?: readonly number[], bypassSnapping?: boolean): TimelineSnapResult
  requestForDelta(deltaTicks: number): PrecisionTrimRequestV1
  previewFor(request: PrecisionTrimRequestV1): PrecisionTrimPlan
  onSnapGuide(ticks: number | null): void
  onDraft(plan: PrecisionTrimPlan | null): void
  onCommit(plan: Extract<PrecisionTrimPlan, { ok: true }>): void
}>

type ActiveGesture = Readonly<{
  pointerId: number
  originTicks: number
  latest: PrecisionTrimPlan | null
}>

/**
 * One detached precision gesture. Pointer movement only asks the planner what
 * would happen. Release commits the exact successful object the planner drew.
 * Escape/pointercancel discard the draft and create no operation.
 */
export function TimelinePrecisionHandle({
  kind,
  edge = 'end',
  label,
  disabled,
  itemStartTicks,
  itemDurationTicks,
  frameTicks,
  pointerTicks,
  pointerTime,
  requestForDelta,
  previewFor,
  onSnapGuide,
  onDraft,
  onCommit,
}: TimelinePrecisionHandleProps) {
  const activeRef = useRef<ActiveGesture | null>(null)
  const itemEndTicks = itemStartTicks + itemDurationTicks

  const resolve = (clientX: number, bypassSnapping: boolean, originTicks: number): Readonly<{
    deltaTicks: number
    snappedToTicks: number | null
    plan: PrecisionTrimPlan | null
  }> => {
    const excluded = kind === 'edge' ? [edge === 'start' ? itemStartTicks : itemEndTicks] : []
    const snapped = pointerTime(clientX, excluded, bypassSnapping)
    const currentTicks = kind === 'edge' ? snapped.ticks : pointerTicks(clientX)
    const anchorTicks = kind === 'edge'
      ? (edge === 'start' ? itemStartTicks : itemEndTicks)
      : originTicks
    const deltaTicks = Math.round(currentTicks - anchorTicks)
    const plan = deltaTicks === 0 ? null : previewFor(requestForDelta(deltaTicks))
    return Object.freeze({ deltaTicks, snappedToTicks: kind === 'edge' ? snapped.snappedToTicks : null, plan })
  }

  const cancel = () => {
    activeRef.current = null
    onSnapGuide(null)
    onDraft(null)
  }

  const commitDelta = (deltaTicks: number) => {
    if (deltaTicks === 0) return
    const plan = previewFor(requestForDelta(deltaTicks))
    onDraft(plan)
    if (plan.ok) onCommit(plan)
    onDraft(null)
  }

  const onKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (event.key === 'Escape') {
      event.preventDefault()
      cancel()
      return
    }
    if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
      event.preventDefault()
      const direction = event.key === 'ArrowLeft' ? -1 : 1
      commitDelta(direction * frameTicks * (event.shiftKey ? 10 : 1))
    }
  }

  return (
    <button
      type="button"
      className={`timeline-v1__precision-handle timeline-v1__precision-handle--${kind}${kind === 'edge' ? ` timeline-v1__precision-handle--${edge}` : ''}`}
      aria-label={label}
      title={`${label}. Drag to preview; release to apply. Arrow keys move one frame; Shift moves ten. Escape cancels.`}
      disabled={disabled}
      onKeyDown={onKeyDown}
      onPointerDown={(event: PointerEvent<HTMLButtonElement>) => {
        if (disabled || event.button !== 0) return
        event.preventDefault()
        event.stopPropagation()
        const originTicks = kind === 'body'
          ? pointerTicks(event.clientX)
          : (edge === 'start' ? itemStartTicks : itemEndTicks)
        const resolved = resolve(event.clientX, event.shiftKey, originTicks)
        activeRef.current = Object.freeze({ pointerId: event.pointerId, originTicks, latest: resolved.plan })
        try { event.currentTarget.setPointerCapture(event.pointerId) } catch { /* synthetic/headless pointer */ }
        onSnapGuide(resolved.snappedToTicks)
        onDraft(resolved.plan)
      }}
      onPointerMove={(event) => {
        const active = activeRef.current
        if (!active || active.pointerId !== event.pointerId) return
        const resolved = resolve(event.clientX, event.shiftKey, active.originTicks)
        activeRef.current = Object.freeze({ ...active, latest: resolved.plan })
        onSnapGuide(resolved.snappedToTicks)
        onDraft(resolved.plan)
      }}
      onPointerUp={(event) => {
        const active = activeRef.current
        if (!active || active.pointerId !== event.pointerId) return
        event.preventDefault()
        event.stopPropagation()
        const resolved = resolve(event.clientX, event.shiftKey, active.originTicks)
        activeRef.current = null
        onSnapGuide(null)
        onDraft(null)
        if (resolved.plan?.ok) onCommit(resolved.plan)
        try {
          if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId)
        } catch { /* synthetic/headless pointer */ }
      }}
      onPointerCancel={cancel}
      onLostPointerCapture={() => {
        if (activeRef.current !== null) cancel()
      }}
    >
      <span aria-hidden="true">{kind === 'body' ? '↔' : ''}</span>
    </button>
  )
}
