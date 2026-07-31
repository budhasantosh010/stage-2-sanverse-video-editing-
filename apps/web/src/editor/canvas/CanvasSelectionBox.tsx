import type { KeyboardEvent, PointerEvent as ReactPointerEvent } from 'react'
import type {
  CanvasCropEdge,
  CanvasRect,
  CanvasResizeCorner,
  CanvasVisualSelection,
} from './canvas-contract'
import { CanvasCropOverlay } from './CanvasCropOverlay'

export function CanvasSelectionBox({
  rect,
  selection,
  cropMode,
  narrow,
  rotationDegrees,
  crop,
  onStartMove,
  onStartResize,
  onStartRotate,
  onStartCrop,
  onKeyDown,
}: Readonly<{
  rect: CanvasRect
  selection: CanvasVisualSelection
  cropMode: boolean
  narrow: boolean
  rotationDegrees: number
  crop: Readonly<{ top: number; right: number; bottom: number; left: number }>
  onStartMove(event: ReactPointerEvent<HTMLButtonElement>): void
  onStartResize(corner: CanvasResizeCorner, event: ReactPointerEvent<HTMLButtonElement>): void
  onStartRotate(event: ReactPointerEvent<HTMLButtonElement>): void
  onStartCrop(edge: CanvasCropEdge, event: ReactPointerEvent<HTMLButtonElement>): void
  onKeyDown(event: KeyboardEvent<HTMLButtonElement>): void
}>) {
  return (
    <div
      className={`canvas-selection-box${selection.state === 'proposed' ? ' canvas-selection-box--proposed' : ''}${cropMode ? ' canvas-selection-box--crop' : ''}`}
      data-testid="canvas-selection-box"
      style={{ left: `${rect.x}px`, top: `${rect.y}px`, width: `${rect.width}px`, height: `${rect.height}px` }}
    >
      <button
        type="button"
        className="canvas-selection-box__move"
        aria-label={`Move ${selection.label}. Position ${Math.round(selection.visualProperties.transform.translateX * 100)} percent across and ${Math.round(selection.visualProperties.transform.translateY * 100)} percent down.`}
        onPointerDown={onStartMove}
        onKeyDown={onKeyDown}
      />
      {!narrow && !cropMode && selection.state === 'committed' && selection.supportsResize ? (
        (['top-left', 'top-right', 'bottom-right', 'bottom-left'] as const).map((corner) => (
          <button
            key={corner}
            type="button"
            className={`canvas-resize-handle canvas-resize-handle--${corner}`}
            aria-label={`Resize ${selection.label} from ${corner.replace('-', ' ')}`}
            onPointerDown={(event) => onStartResize(corner, event)}
          />
        ))
      ) : null}
      {!narrow && !cropMode && selection.state === 'committed' && selection.supportsRotation ? (
        <>
          <span className="canvas-rotation-stem" aria-hidden="true" />
          <button
            type="button"
            className="canvas-rotation-handle"
            aria-label={`Rotate ${selection.label}`}
            onPointerDown={onStartRotate}
          />
          <output className="canvas-rotation-value" aria-live="polite">{Math.round(rotationDegrees)}°</output>
        </>
      ) : null}
      {cropMode && selection.supportsCrop ? (
        <CanvasCropOverlay crop={crop} label={selection.label} onStart={onStartCrop} />
      ) : null}
    </div>
  )
}
