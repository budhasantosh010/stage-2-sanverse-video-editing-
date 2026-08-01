import { useEffect, useRef, type Dispatch, type PointerEvent as ReactPointerEvent, type SetStateAction } from 'react'
import type { MediaTime } from '@sanverse/edit-domain'

import {
  updateFootageMotionValueAtSourceTime,
  type FootageMotionDraft,
  type SupportedFootageMotionProperty,
} from './FootageMotionInspector'
import './PrimaryFootageCanvasControls.css'

type GestureKind = 'move' | 'scale' | 'rotate' | 'crop-left' | 'crop-right' | 'crop-top' | 'crop-bottom'

type ActiveGesture = Readonly<{
  kind: GestureKind
  pointerId: number
  startX: number
  startY: number
  initial: FootageMotionDraft
  latest: FootageMotionDraft
  sourceTime: MediaTime
}>

export type PrimaryFootageCanvasControlsProps = Readonly<{
  draft: FootageMotionDraft
  sourceTime: MediaTime
  setDraft: Dispatch<SetStateAction<FootageMotionDraft | null>>
  busy: boolean
  narrow: boolean
  cropMode: boolean
  onCropModeChange(next: boolean): void
  onCommit(draft: FootageMotionDraft): void
  onPausePlayback(): void
  onFocusInspector(): void
}>

const clamp = (value: number, minimum: number, maximum: number) => Math.min(maximum, Math.max(minimum, value))

const updateFromPointer = (
  gesture: ActiveGesture,
  clientX: number,
  clientY: number,
  width: number,
  height: number,
  shiftKey: boolean,
): FootageMotionDraft => {
  let dx = (clientX - gesture.startX) / Math.max(1, width)
  let dy = (clientY - gesture.startY) / Math.max(1, height)
  const initial = gesture.initial
  const update = (
    source: FootageMotionDraft,
    property: SupportedFootageMotionProperty,
    value: number,
  ) => updateFootageMotionValueAtSourceTime(source, property, value, gesture.sourceTime)
  switch (gesture.kind) {
    case 'move': {
      if (shiftKey) {
        if (Math.abs(dx) >= Math.abs(dy)) dy = 0
        else dx = 0
      }
      const movedX = update(initial, 'translate-x', clamp(initial.transform.translateX + dx, -2, 2))
      return update(movedX, 'translate-y', clamp(initial.transform.translateY + dy, -2, 2))
    }
    case 'scale': {
      const delta = Math.max(dx, dy) * 2
      return update(initial, 'scale', clamp(initial.transform.scale + delta, 0.01, 20))
    }
    case 'rotate': {
      const degrees = clamp(initial.transform.rotationDegrees + (clientX - gesture.startX) * 0.5, -3_600, 3_600)
      return update(initial, 'rotation', shiftKey ? Math.round(degrees / 15) * 15 : degrees)
    }
    case 'crop-left':
      return update(initial, 'crop-left', clamp(
        initial.crop.left + dx / Math.max(initial.transform.scale, 0.01),
        0,
        0.99 - initial.crop.right,
      ))
    case 'crop-right':
      return update(initial, 'crop-right', clamp(
        initial.crop.right - dx / Math.max(initial.transform.scale, 0.01),
        0,
        0.99 - initial.crop.left,
      ))
    case 'crop-top':
      return update(initial, 'crop-top', clamp(
        initial.crop.top + dy / Math.max(initial.transform.scale, 0.01),
        0,
        0.99 - initial.crop.bottom,
      ))
    case 'crop-bottom':
      return update(initial, 'crop-bottom', clamp(
        initial.crop.bottom - dy / Math.max(initial.transform.scale, 0.01),
        0,
        0.99 - initial.crop.top,
      ))
    default:
      return initial
  }
}

export function PrimaryFootageCanvasControls({
  draft,
  sourceTime,
  setDraft,
  busy,
  narrow,
  cropMode,
  onCropModeChange,
  onCommit,
  onPausePlayback,
  onFocusInspector,
}: PrimaryFootageCanvasControlsProps) {
  const rootRef = useRef<HTMLDivElement>(null)
  const gestureRef = useRef<ActiveGesture | null>(null)

  useEffect(() => {
    const move = (event: PointerEvent) => {
      const gesture = gestureRef.current
      const root = rootRef.current
      if (!gesture || !root || event.pointerId !== gesture.pointerId) return
      const rect = root.getBoundingClientRect()
      const next = updateFromPointer(
        gesture,
        event.clientX,
        event.clientY,
        rect.width,
        rect.height,
        event.shiftKey,
      )
      gestureRef.current = Object.freeze({ ...gesture, latest: next })
      setDraft(next)
    }
    const finish = (event: PointerEvent) => {
      const gesture = gestureRef.current
      if (
        !gesture ||
        (Number.isFinite(gesture.pointerId) && Number.isFinite(event.pointerId) && event.pointerId !== gesture.pointerId)
      ) return
      gestureRef.current = null
      onCommit(gesture.latest)
    }
    const restoreWithoutCommit = () => {
      const gesture = gestureRef.current
      if (!gesture) return
      gestureRef.current = null
      setDraft(gesture.initial)
      onFocusInspector()
    }
    const cancelPointer = (event: PointerEvent) => {
      const gesture = gestureRef.current
      if (
        !gesture ||
        (Number.isFinite(gesture.pointerId) && Number.isFinite(event.pointerId) && event.pointerId !== gesture.pointerId)
      ) return
      restoreWithoutCommit()
    }
    const cancelKeyboard = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || !gestureRef.current) return
      event.preventDefault()
      restoreWithoutCommit()
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', finish)
    window.addEventListener('pointercancel', cancelPointer)
    window.addEventListener('keydown', cancelKeyboard)
    return () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', finish)
      window.removeEventListener('pointercancel', cancelPointer)
      window.removeEventListener('keydown', cancelKeyboard)
    }
  }, [onCommit, onFocusInspector, setDraft])

  const begin = (kind: GestureKind) => (event: ReactPointerEvent<HTMLElement>) => {
    if (busy || narrow) return
    event.preventDefault()
    event.stopPropagation()
    onPausePlayback()
    event.currentTarget.setPointerCapture?.(event.pointerId)
    gestureRef.current = Object.freeze({
      kind,
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      initial: draft,
      latest: draft,
      sourceTime,
    })
  }

  const nudge = (event: React.KeyboardEvent<HTMLButtonElement>) => {
    if (busy || narrow || !['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) return
    event.preventDefault()
    const step = event.shiftKey ? 0.05 : 0.01
    const movedX = updateFootageMotionValueAtSourceTime(
      draft,
      'translate-x',
      clamp(draft.transform.translateX + (event.key === 'ArrowLeft' ? -step : event.key === 'ArrowRight' ? step : 0), -2, 2),
      sourceTime,
    )
    const next = updateFootageMotionValueAtSourceTime(
      movedX,
      'translate-y',
      clamp(draft.transform.translateY + (event.key === 'ArrowUp' ? -step : event.key === 'ArrowDown' ? step : 0), -2, 2),
      sourceTime,
    )
    setDraft(next)
    onCommit(next)
  }

  const planeStyle = {
    left: `${50 + draft.transform.translateX * 100}%`,
    top: `${50 + draft.transform.translateY * 100}%`,
    width: `${draft.transform.scale * 100}%`,
    height: `${draft.transform.scale * 100}%`,
    transform: `translate(-50%, -50%) rotate(${draft.transform.rotationDegrees}deg)`,
    clipPath: `inset(${draft.crop.top * 100}% ${draft.crop.right * 100}% ${draft.crop.bottom * 100}% ${draft.crop.left * 100}%)`,
  }

  return (
    <div ref={rootRef} className="footage-canvas" data-testid="primary-footage-canvas-controls">
      <div className="footage-canvas__safe" aria-hidden="true" />
      {narrow ? (
        <p className="footage-canvas__mobile-note" role="status">Precise footage handles are available on a wider screen. Motion values remain readable in Inspector.</p>
      ) : (
        <>
          <button
            type="button"
            className="footage-canvas__plane"
            style={planeStyle}
            aria-label="Move primary footage. Use arrow keys to nudge; hold Shift for a larger step."
            disabled={busy}
            onPointerDown={begin('move')}
            onKeyDown={nudge}
          />
          <button type="button" className="footage-canvas__handle footage-canvas__handle--scale" style={{ left: `${50 + (draft.transform.translateX + draft.transform.scale / 2) * 100}%`, top: `${50 + (draft.transform.translateY + draft.transform.scale / 2) * 100}%` }} aria-label="Scale primary footage" disabled={busy} onPointerDown={begin('scale')} />
          <button type="button" className="footage-canvas__handle footage-canvas__handle--rotate" style={{ left: `${50 + draft.transform.translateX * 100}%`, top: `${50 + (draft.transform.translateY - draft.transform.scale / 2) * 100}%` }} aria-label="Rotate primary footage" disabled={busy} onPointerDown={begin('rotate')} />
          {cropMode ? (
            <>
              <button type="button" className="footage-canvas__crop footage-canvas__crop--left" aria-label="Crop primary footage from left" disabled={busy} onPointerDown={begin('crop-left')} />
              <button type="button" className="footage-canvas__crop footage-canvas__crop--right" aria-label="Crop primary footage from right" disabled={busy} onPointerDown={begin('crop-right')} />
              <button type="button" className="footage-canvas__crop footage-canvas__crop--top" aria-label="Crop primary footage from top" disabled={busy} onPointerDown={begin('crop-top')} />
              <button type="button" className="footage-canvas__crop footage-canvas__crop--bottom" aria-label="Crop primary footage from bottom" disabled={busy} onPointerDown={begin('crop-bottom')} />
            </>
          ) : null}
          <button type="button" className="footage-canvas__crop-toggle" aria-pressed={cropMode} onClick={() => onCropModeChange(!cropMode)} disabled={busy}>
            {cropMode ? 'Finish crop' : 'Crop footage'}
          </button>
        </>
      )}
    </div>
  )
}
