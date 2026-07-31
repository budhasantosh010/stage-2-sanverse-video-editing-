import type { PointerEvent as ReactPointerEvent } from 'react'
import type { CanvasCropEdge } from './canvas-contract'

export function CanvasCropOverlay({
  crop,
  label,
  onStart,
}: Readonly<{
  crop: Readonly<{ top: number; right: number; bottom: number; left: number }>
  label: string
  onStart(edge: CanvasCropEdge, event: ReactPointerEvent<HTMLButtonElement>): void
}>) {
  return (
    <div className="canvas-crop-overlay" data-testid="canvas-crop-overlay">
      <div className="canvas-crop-overlay__shade canvas-crop-overlay__shade--top" style={{ height: `${crop.top * 100}%` }} />
      <div className="canvas-crop-overlay__shade canvas-crop-overlay__shade--right" style={{ width: `${crop.right * 100}%` }} />
      <div className="canvas-crop-overlay__shade canvas-crop-overlay__shade--bottom" style={{ height: `${crop.bottom * 100}%` }} />
      <div className="canvas-crop-overlay__shade canvas-crop-overlay__shade--left" style={{ width: `${crop.left * 100}%` }} />
      {(['top', 'right', 'bottom', 'left'] as const).map((edge) => (
        <button
          key={edge}
          type="button"
          className={`canvas-crop-handle canvas-crop-handle--${edge}`}
          aria-label={`Crop ${label} from ${edge} edge`}
          onPointerDown={(event) => onStart(edge, event)}
        />
      ))}
      <output className="canvas-crop-overlay__values" aria-live="polite">
        {`Top ${Math.round(crop.top * 100)}%, right ${Math.round(crop.right * 100)}%, bottom ${Math.round(crop.bottom * 100)}%, left ${Math.round(crop.left * 100)}%`}
      </output>
    </div>
  )
}
