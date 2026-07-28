import type {
  CalloutOverlayNode,
  MediaOverlayNode,
  TitleOverlayNode,
} from '@sanverse/render-contract'

import {
  calloutBoxStyle,
  mediaOverlayBox,
  titleLineTopPx,
} from '../render-plan/render-plan-preview'
import './OverlayLayers.css'

type Shared = {
  compositionWidth: number
  compositionHeight: number
  /** Display pixels per composition pixel. */
  scale: number
}

/**
 * A title on screen.
 *
 * Like a caption and unlike a nameplate, nothing here is measured: a title is
 * always centred across the picture, so CSS centring and the shared vertical
 * arithmetic are enough. Neither renderer measures anything, so neither can
 * measure it differently.
 */
export function TitleOverlay({ node, compositionWidth, compositionHeight, scale }: Shared & { node: TitleOverlayNode }) {
  if (scale <= 0) return null
  const hasSubhead = node.subhead.length > 0
  const top = (lineIndex: number) =>
    titleLineTopPx(node.styleId, lineIndex, hasSubhead, node.placement, compositionWidth, compositionHeight, scale)

  return (
    <div className="title-overlay" data-testid="title-overlay" data-node-id={node.nodeId}>
      <div className="title-overlay__headline" style={{ top: `${top(0)}px` }}>
        {node.headline}
      </div>
      {hasSubhead ? (
        <div className="title-overlay__subhead" style={{ top: `${top(1)}px` }}>
          {node.subhead}
        </div>
      ) : null}
    </div>
  )
}

/**
 * A callout: a rectangle around part of the picture, with an optional label.
 *
 * The rectangle's border is drawn INSIDE its own box, matching FFmpeg's
 * `drawbox` with a thickness, which also grows inward from the stated
 * rectangle. `box-sizing: border-box` is what makes CSS behave the same way.
 */
export function CalloutOverlay({
  node,
  compositionWidth,
  compositionHeight,
  scale,
}: Shared & { node: CalloutOverlayNode }) {
  if (scale <= 0) return null
  const box = calloutBoxStyle(node, compositionWidth, compositionHeight, scale)

  return (
    <div className="callout-overlay" data-testid="callout-overlay" data-node-id={node.nodeId}>
      <div
        className="callout-overlay__box"
        style={{
          left: `${box.left}px`,
          top: `${box.top}px`,
          width: `${box.width}px`,
          height: `${box.height}px`,
          borderWidth: `${box.borderWidth}px`,
          borderColor: box.borderColor,
        }}
      />
      {node.label.length > 0 ? (
        <div
          className="callout-overlay__label"
          style={{
            left: `${box.left + box.borderWidth}px`,
            top: `${box.labelTop}px`,
            fontSize: `${box.labelFontSize}px`,
            padding: `${box.labelPadding}px`,
            color: box.labelColor,
            background: box.labelBackground,
          }}
        >
          {node.label}
        </div>
      ) : null}
    </div>
  )
}

export type MediaOverlayProps = Shared & {
  node: MediaOverlayNode
  /** A browser-playable URL for the B-roll clip or picture, or null if unknown. */
  sourceUrl: string | null
  /** Whether the source is a still picture rather than a clip. */
  isStill: boolean
  /** Where the finished video is currently playing, in project ticks. */
  ticks: number
}

/**
 * A B-roll clip or a picture laid on top of the footage.
 *
 * `object-fit: contain` is the browser's name for exactly what the exporter
 * does with `scale=…:force_original_aspect_ratio=decrease`: fit the clip inside
 * the box, keep its own shape, and centre what is left over. Stretching to fill
 * would distort the clip, and nobody notices until the export.
 *
 * A B-roll VIDEO is seeked rather than played on its own clock, so scrubbing the
 * main video scrubs the overlay with it. That is the only way the preview can
 * show the same frame the export will contain at that instant.
 */
export function MediaOverlay({
  node,
  sourceUrl,
  isStill,
  ticks,
  compositionWidth,
  compositionHeight,
  scale,
}: MediaOverlayProps) {
  if (scale <= 0 || sourceUrl === null) return null
  const box = mediaOverlayBox(node, compositionWidth, compositionHeight, scale)
  const style = {
    left: `${box.left}px`,
    top: `${box.top}px`,
    width: `${box.width}px`,
    height: `${box.height}px`,
    opacity: box.opacity,
  }

  if (isStill) {
    return (
      <img
        className="media-overlay"
        data-testid="media-overlay"
        data-node-id={node.nodeId}
        src={sourceUrl}
        alt=""
        style={style}
      />
    )
  }

  const intoClipTicks = node.sourceStartTicks + (ticks - node.interval.start.ticks)
  return (
    <video
      className="media-overlay"
      data-testid="media-overlay"
      data-node-id={node.nodeId}
      src={sourceUrl}
      style={style}
      muted={!node.useOverlayAudio}
      playsInline
      ref={(element) => {
        if (!element) return
        const seconds = intoClipTicks / 1_440_000
        // Only seek when the two clocks have actually drifted, or every frame
        // of playback would restart the decoder and the overlay would stutter.
        if (Math.abs(element.currentTime - seconds) > 0.08) element.currentTime = seconds
      }}
    />
  )
}
