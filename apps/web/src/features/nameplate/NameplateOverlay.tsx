import { useLayoutEffect, useRef, useState } from 'react'
import type { TextOverlayNode } from '@sanverse/render-contract'

import { previewPlacement } from '../render-plan/render-plan-preview'
import './NameplateOverlay.css'

export type NameplateOverlayProps = {
  node: TextOverlayNode
  compositionWidth: number
  compositionHeight: number
  /** Display pixels per composition pixel. */
  scale: number
}

/**
 * Draws one nameplate over the video preview.
 *
 * The box measures itself and then asks the shared placement rule where to go,
 * which is exactly what FFmpeg does with `text_w` and `text_h` at export time.
 * Neither renderer predicts the other's text width; both apply the identical
 * rule to their own real measurement.
 */
export function NameplateOverlay({ node, compositionWidth, compositionHeight, scale }: NameplateOverlayProps) {
  const boxRef = useRef<HTMLDivElement>(null)
  const [placement, setPlacement] = useState<{ left: number; top: number } | null>(null)

  useLayoutEffect(() => {
    const box = boxRef.current
    if (!box || scale <= 0) {
      setPlacement(null)
      return
    }

    const measure = () => {
      const rect = box.getBoundingClientRect()
      if (rect.width === 0 && rect.height === 0) return
      setPlacement(previewPlacement({
        node,
        compositionWidth,
        compositionHeight,
        measuredWidth: rect.width,
        measuredHeight: rect.height,
        scale,
      }))
    }

    measure()
    if (typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(measure)
    observer.observe(box)
    return () => observer.disconnect()
  }, [node, compositionWidth, compositionHeight, scale])

  return (
    <div
      ref={boxRef}
      className="nameplate-overlay"
      data-testid="nameplate-overlay"
      data-node-id={node.nodeId}
      style={{
        left: placement ? `${placement.left}px` : '0px',
        top: placement ? `${placement.top}px` : '0px',
        // Hidden until measured, so it is never briefly seen in the wrong place.
        visibility: placement ? 'visible' : 'hidden',
      }}
    >
      <strong>{node.primaryText}</strong>
      {node.secondaryText ? <span>{node.secondaryText}</span> : null}
    </div>
  )
}
