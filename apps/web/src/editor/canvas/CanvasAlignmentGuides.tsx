import type { CanvasGuide } from './canvas-contract'

export function CanvasAlignmentGuides({ guides }: Readonly<{ guides: readonly CanvasGuide[] }>) {
  return (
    <div className="canvas-alignment-guides" aria-hidden="true">
      {guides.map((guide, index) => (
        <span
          key={`${guide.axis}:${guide.positionPx}:${index}`}
          className={`canvas-alignment-guide canvas-alignment-guide--${guide.axis}`}
          style={guide.axis === 'x' ? { left: `${guide.positionPx}px` } : { top: `${guide.positionPx}px` }}
        >
          <span>{guide.label}</span>
        </span>
      ))}
    </div>
  )
}
