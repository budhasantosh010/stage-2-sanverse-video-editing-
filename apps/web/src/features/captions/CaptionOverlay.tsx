import type { CSSProperties } from 'react'
import type { CaptionOverlayNode } from '@sanverse/render-contract'

import { captionLineTopPx } from '../render-plan/render-plan-preview'
import './CaptionOverlay.css'

export type CaptionOverlayProps = {
  node: CaptionOverlayNode
  compositionWidth: number
  compositionHeight: number
  /** Display pixels per composition pixel. */
  scale: number
  visualStyle?: CSSProperties
}

/**
 * One caption on screen.
 *
 * Simpler than the nameplate overlay in one important way: nothing is measured.
 * A nameplate is anchored to a point the user chose, so its box has to know its
 * own width before it can be placed. A caption is always centred and always
 * sits in the bottom strip, so CSS centring and the shared vertical arithmetic
 * are enough — and because neither renderer measures anything, neither can
 * measure it differently.
 */
export function CaptionOverlay({ node, compositionWidth, compositionHeight, scale, visualStyle }: CaptionOverlayProps) {
  if (scale <= 0) return null

  return (
    <div className="caption-overlay" data-testid="caption-overlay" data-node-id={node.nodeId} style={visualStyle}>
      {node.lines.map((line, lineIndex) => (
        <div
          key={`${node.nodeId}:${lineIndex}`}
          className="caption-overlay__line"
          style={{
            top: `${captionLineTopPx(
              node.styleId,
              lineIndex,
              node.lines.length,
              compositionWidth,
              compositionHeight,
              scale,
            )}px`,
          }}
        >
          {line}
        </div>
      ))}
    </div>
  )
}
