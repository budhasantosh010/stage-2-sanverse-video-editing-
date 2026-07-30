import { useEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react'

import { formatTimelineTime } from './timeline-ruler-model'
import type { TimelineSnapResult } from './timeline-snap'

export type TimelinePlayheadProps = Readonly<{
  playheadTicks: number
  durationTicks: number
  timescale: number
  leftPx: number
  disabled: boolean
  pointerTime(clientX: number): TimelineSnapResult
  onSnapGuide(ticks: number | null): void
  onSeek(ticks: number): void
}>

export function TimelinePlayhead({
  playheadTicks,
  durationTicks,
  timescale,
  leftPx,
  disabled,
  pointerTime,
  onSnapGuide,
  onSeek,
}: TimelinePlayheadProps) {
  const [dragTicks, setDragTicks] = useState<number | null>(null)
  const dragStartTicksRef = useRef(playheadTicks)
  const pointerIdRef = useRef<number | null>(null)
  const frameRef = useRef<number | null>(null)
  const pendingSeekRef = useRef<number | null>(null)
  const effectiveTicks = dragTicks ?? playheadTicks

  const flushSeek = () => {
    frameRef.current = null
    const pending = pendingSeekRef.current
    pendingSeekRef.current = null
    if (pending !== null) onSeek(pending)
  }

  const scheduleSeek = (ticks: number) => {
    pendingSeekRef.current = ticks
    if (frameRef.current === null) frameRef.current = requestAnimationFrame(flushSeek)
  }

  const cancelDrag = (restore: boolean) => {
    if (frameRef.current !== null) cancelAnimationFrame(frameRef.current)
    frameRef.current = null
    pendingSeekRef.current = null
    pointerIdRef.current = null
    setDragTicks(null)
    onSnapGuide(null)
    if (restore) onSeek(dragStartTicksRef.current)
  }

  useEffect(() => () => {
    if (frameRef.current !== null) cancelAnimationFrame(frameRef.current)
  }, [])

  const moveToPointer = (event: PointerEvent<HTMLButtonElement>) => {
    if (pointerIdRef.current !== event.pointerId) return
    const resolved = pointerTime(event.clientX)
    setDragTicks(resolved.ticks)
    onSnapGuide(resolved.snappedToTicks)
    scheduleSeek(resolved.ticks)
  }

  const finish = (event: PointerEvent<HTMLButtonElement>) => {
    if (pointerIdRef.current !== event.pointerId) return
    const resolved = pointerTime(event.clientX)
    if (frameRef.current !== null) cancelAnimationFrame(frameRef.current)
    frameRef.current = null
    pendingSeekRef.current = null
    pointerIdRef.current = null
    setDragTicks(null)
    onSnapGuide(null)
    onSeek(resolved.ticks)
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }
  }

  const onKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    const small = Math.max(1, Math.round(timescale / 10))
    const large = Math.max(small, Math.round(timescale))
    let next: number | null = null
    if (event.key === 'ArrowLeft') next = effectiveTicks - (event.shiftKey ? large : small)
    if (event.key === 'ArrowRight') next = effectiveTicks + (event.shiftKey ? large : small)
    if (event.key === 'Home') next = 0
    if (event.key === 'End') next = durationTicks
    if (event.key === 'Escape' && pointerIdRef.current !== null) {
      event.preventDefault()
      cancelDrag(true)
      return
    }
    if (next === null) return
    event.preventDefault()
    onSeek(Math.min(durationTicks, Math.max(0, next)))
  }

  return (
    <div
      className="timeline-v1__playhead"
      style={{ left: `${leftPx}px` }}
      data-testid="timeline-playhead"
      data-ticks={effectiveTicks}
    >
      <button
        type="button"
        className="timeline-v1__playhead-handle"
        aria-label="Timeline playhead"
        role="slider"
        aria-valuemin={0}
        aria-valuemax={durationTicks}
        aria-valuenow={effectiveTicks}
        aria-valuetext={formatTimelineTime(effectiveTicks, timescale, true)}
        disabled={disabled}
        onKeyDown={onKeyDown}
        onPointerDown={(event) => {
          if (disabled || event.button !== 0) return
          dragStartTicksRef.current = playheadTicks
          pointerIdRef.current = event.pointerId
          event.currentTarget.setPointerCapture(event.pointerId)
          const resolved = pointerTime(event.clientX)
          setDragTicks(resolved.ticks)
          onSnapGuide(resolved.snappedToTicks)
          scheduleSeek(resolved.ticks)
        }}
        onPointerMove={moveToPointer}
        onPointerUp={finish}
        onPointerCancel={() => cancelDrag(true)}
        onLostPointerCapture={() => {
          if (pointerIdRef.current !== null) cancelDrag(false)
        }}
      >
        <span aria-hidden="true" />
      </button>
    </div>
  )
}
