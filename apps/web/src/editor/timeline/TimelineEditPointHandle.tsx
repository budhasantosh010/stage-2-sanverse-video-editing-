import { useRef, useState, type MouseEvent, type PointerEvent } from 'react'

import { ticksToPixels, type PrecisionTrimPlan, type PrecisionTrimRequestV1, type TimelineEditPointRefV1 } from '../../features/timeline'
import { formatTimelineTime } from './timeline-ruler-model'
import type { TimelineSnapResult } from './timeline-snap'

export type TimelineEditPointHandleProps = Readonly<{
  editPoint: TimelineEditPointRefV1
  leftClipId: string
  rightClipId: string
  timescale: number
  pixelsPerSecond: number
  selected: boolean
  disabled: boolean
  frameTicks: number
  pointerTime(clientX: number, excludedTicks?: readonly number[], bypassSnapping?: boolean): TimelineSnapResult
  previewFor(request: PrecisionTrimRequestV1): PrecisionTrimPlan
  onDraft?(plan: PrecisionTrimPlan | null): void
  onSelect(editPoint: TimelineEditPointRefV1, modifiers: Readonly<{ ctrlKey: boolean; metaKey: boolean; shiftKey: boolean }>): void
  onSnapGuide(ticks: number | null): void
  onCommit(plan: Extract<PrecisionTrimPlan, { ok: true }>): void
}>

export function TimelineEditPointHandle({
  editPoint,
  leftClipId,
  rightClipId,
  timescale,
  pixelsPerSecond,
  selected,
  disabled,
  frameTicks,
  pointerTime,
  previewFor,
  onDraft = () => undefined,
  onSelect,
  onSnapGuide,
  onCommit,
}: TimelineEditPointHandleProps) {
  const pointerIdRef = useRef<number | null>(null)
  // Pointer down selects before the browser's synthetic click fires. Suppress
  // that follow-up click so Ctrl/Cmd-add does not immediately toggle the point
  // back out of the multi-edit selection.
  const suppressPointerClickRef = useRef(false)
  const [draft, setDraft] = useState<PrecisionTrimPlan | null>(null)
  const leftPx = ticksToPixels(editPoint.compositionTicks, timescale, pixelsPerSecond)
  const request = (deltaTicks: number): PrecisionTrimRequestV1 => Object.freeze({
    mode: 'roll' as const,
    leftClipId,
    rightClipId,
    deltaTicks,
  })
  const resolve = (clientX: number, bypassSnapping = false) => {
    const result = pointerTime(clientX, [editPoint.compositionTicks], bypassSnapping)
    const deltaTicks = result.ticks - editPoint.compositionTicks
    return Object.freeze({
      result,
      plan: deltaTicks === 0 ? null : previewFor(request(deltaTicks)),
    })
  }
  const setDraftPlan = (plan: PrecisionTrimPlan | null) => {
    setDraft(plan)
    onDraft(plan)
  }
  const cancel = () => {
    pointerIdRef.current = null
    setDraftPlan(null)
    onSnapGuide(null)
  }
  const commitDelta = (deltaTicks: number) => {
    if (deltaTicks === 0) return
    const plan = previewFor(request(deltaTicks))
    setDraftPlan(plan)
    if (plan.ok) onCommit(plan)
    setDraft(null)
  }

  return (
    <>
      <button
        type="button"
        className="timeline-v1__edit-point"
        style={{ left: `${leftPx}px` }}
        data-edit-point-ticks={editPoint.compositionTicks}
        aria-pressed={selected}
        aria-label={`Edit point at ${formatTimelineTime(editPoint.compositionTicks, timescale, true)}. Roll tool.`}
        title="Roll edit point. Drag to preview; release to apply. Ctrl/Cmd-click adds another edit point."
        disabled={disabled}
        onClick={(event: MouseEvent<HTMLButtonElement>) => {
          event.stopPropagation()
          if (suppressPointerClickRef.current) {
            suppressPointerClickRef.current = false
            return
          }
          onSelect(editPoint, { ctrlKey: event.ctrlKey, metaKey: event.metaKey, shiftKey: event.shiftKey })
        }}
        onKeyDown={(event) => {
          if (event.key === 'Escape') {
            event.preventDefault()
            cancel()
          } else if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
            event.preventDefault()
            commitDelta((event.key === 'ArrowLeft' ? -1 : 1) * frameTicks * (event.shiftKey ? 10 : 1))
          }
        }}
        onPointerDown={(event: PointerEvent<HTMLButtonElement>) => {
          if (disabled || event.button !== 0) return
          event.stopPropagation()
          pointerIdRef.current = event.pointerId
          suppressPointerClickRef.current = true
          onSelect(editPoint, { ctrlKey: event.ctrlKey, metaKey: event.metaKey, shiftKey: event.shiftKey })
          try { event.currentTarget.setPointerCapture(event.pointerId) } catch { /* headless synthetic pointer */ }
          const resolved = resolve(event.clientX, event.shiftKey)
          setDraft(resolved.plan)
          onSnapGuide(resolved.result.snappedToTicks)
        }}
        onPointerMove={(event) => {
          if (pointerIdRef.current !== event.pointerId) return
          const resolved = resolve(event.clientX, event.shiftKey)
          setDraft(resolved.plan)
          onSnapGuide(resolved.result.snappedToTicks)
        }}
        onPointerUp={(event) => {
          if (pointerIdRef.current !== event.pointerId) return
          event.stopPropagation()
          const resolved = resolve(event.clientX, event.shiftKey)
          pointerIdRef.current = null
          setDraftPlan(null)
          onSnapGuide(null)
          if (resolved.plan?.ok) onCommit(resolved.plan)
          try {
            if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId)
          } catch { /* headless synthetic pointer */ }
        }}
        onPointerCancel={cancel}
        onLostPointerCapture={() => { if (pointerIdRef.current !== null) cancel() }}
      >
        <span aria-hidden="true" />
      </button>
      {draft ? (
        <output
          className={`timeline-v1__edit-point-feedback${draft.ok ? '' : ' timeline-v1__edit-point-feedback--refused'}`}
          style={{ left: `${leftPx}px` }}
          aria-live="polite"
        >
          {draft.ok ? `Δ ${formatTimelineTime(Math.abs(draft.feedback.appliedDeltaTicks), timescale, true)}` : draft.refusal.message}
        </output>
      ) : null}
    </>
  )
}
