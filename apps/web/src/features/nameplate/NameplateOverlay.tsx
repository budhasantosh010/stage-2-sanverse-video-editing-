import { useLayoutEffect, useRef, useState } from 'react'
import type { TextOverlayNode } from '@sanverse/render-contract'

import { previewPlacement, secondaryLineOffset } from '../render-plan/render-plan-preview'
import { resolveNameplateMetrics } from '@sanverse/render-contract/nameplate-style'
import './NameplateOverlay.css'

export type NameplateOverlayProps = {
  node: TextOverlayNode
  compositionWidth: number
  compositionHeight: number
  /** Display pixels per composition pixel. */
  scale: number
}

type LineProps = NameplateOverlayProps & {
  text: string
  className: string
  /** This line's em-box height in composition pixels: its font size. */
  lineHeight: number
  /** Extra composition pixels below the anchored position, for the second line. */
  offset: number
}

/**
 * One drawn line of a nameplate.
 *
 * Each line is a separate box, anchored independently, because that is exactly
 * what FFmpeg's drawtext does at export time. Drawing one box around both lines
 * in the preview would look tidier and would be a lie.
 *
 * The box measures itself and then applies the shared placement rule to its own
 * real size — the same thing FFmpeg does with `text_w` and `text_h`. Neither
 * renderer has to predict the other's text width.
 */
function NameplateLine({ node, compositionWidth, compositionHeight, scale, text, className, lineHeight, offset }: LineProps) {
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
      const anchored = previewPlacement({
        node,
        compositionWidth,
        compositionHeight,
        measuredWidth: rect.width,
        lineHeight,
        scale,
      })
      setPlacement({ left: anchored.left, top: anchored.top + offset * scale })
    }

    measure()
    if (typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(measure)
    observer.observe(box)
    return () => observer.disconnect()
  }, [node, compositionWidth, compositionHeight, scale, text, lineHeight, offset])

  return (
    <div
      ref={boxRef}
      className={className}
      style={{
        left: placement ? `${placement.left}px` : '0px',
        top: placement ? `${placement.top}px` : '0px',
        // Hidden until measured, so it is never briefly seen in the wrong place.
        visibility: placement ? 'visible' : 'hidden',
      }}
    >
      {text}
    </div>
  )
}

export function NameplateOverlay(props: NameplateOverlayProps) {
  const { node, compositionWidth, compositionHeight, scale } = props
  const offset = secondaryLineOffset(compositionWidth, compositionHeight)
  const metrics = resolveNameplateMetrics(compositionWidth, compositionHeight)

  return (
    <div className="nameplate-overlay" data-testid="nameplate-overlay" data-node-id={node.nodeId}>
      <NameplateLine
        {...props}
        text={node.primaryText}
        className="nameplate-overlay__primary"
        lineHeight={metrics.primaryFontSize}
        offset={0}
      />
      {node.secondaryText ? (
        <NameplateLine
          {...props}
          text={node.secondaryText}
          className="nameplate-overlay__secondary"
          lineHeight={metrics.secondaryFontSize}
          offset={offset}
        />
      ) : null}
    </div>
  )
}
