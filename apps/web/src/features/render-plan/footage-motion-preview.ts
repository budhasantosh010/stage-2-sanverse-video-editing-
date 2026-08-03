import {
  evaluateFootageMotionAt,
  mediaTime,
  type EvaluatedFootageMotion,
} from '@sanverse/edit-domain'
import type { RenderPlan, SourceSegmentNode } from '@sanverse/render-contract'

import { hasDecodableFrame } from './media-readiness'
import { motionCanvasFrameToken } from './motion-frame-token'

export type ActiveFootageMotion = Readonly<{
  segment: SourceSegmentNode
  sourceTicks: number
  motion: SourceSegmentNode['footageMotions'][number]
  evaluated: EvaluatedFootageMotion
}>

/** Resolve composition time through the current source segment into source time. */
export const footageMotionAtCompositionTime = (
  plan: RenderPlan,
  compositionTicks: number,
  reducedMotion = false,
): ActiveFootageMotion | null => {
  const segment = plan.segments.find((candidate) =>
    compositionTicks >= candidate.interval.start.ticks &&
    compositionTicks < candidate.interval.start.ticks + candidate.interval.duration.ticks,
  )
  if (!segment) return null
  const sourceTicks = segment.sourceStartTicks + compositionTicks - segment.interval.start.ticks
  const motion = segment.footageMotions.find((candidate) =>
    sourceTicks >= candidate.sourceInterval.start.ticks &&
    sourceTicks < candidate.sourceInterval.start.ticks + candidate.sourceInterval.duration.ticks,
  )
  if (!motion) return null
  return Object.freeze({
    segment,
    sourceTicks,
    motion,
    evaluated: evaluateFootageMotionAt({ motion, sourceTime: mediaTime(sourceTicks), reducedMotion }),
  })
}

export type DrawFootageMotionInput = Readonly<{
  canvas: HTMLCanvasElement
  video: HTMLVideoElement
  plan: RenderPlan
  compositionTicks: number
  reducedMotion?: boolean
  /**
   * Bumped whenever the canvas geometry changes — a panel resize, fullscreen.
   *
   * It is part of the frame's identity, so a frame drawn at the old size stops
   * matching what the next render asks for and is redrawn before being trusted.
   */
  geometryVersion?: number
}>

/**
 * What to do with the motion canvas this instant.
 *
 * - `draw`   a real frame can be read out of the video right now
 * - `retain` no frame is readable, but the canvas already holds a real one;
 *            keep showing it rather than blanking mid-seek
 * - `hide`   nothing real has ever been drawn, or motion no longer applies;
 *            step out of the way and let the native video be the base layer
 *
 * Separated from the drawing so the rule can be tested without a canvas, and
 * so the diagnostics can report which branch fired.
 */
export type FootageMotionDrawDecision = 'draw' | 'retain' | 'hide'

export const footageMotionDrawDecision = (input: Readonly<{
  motionActive: boolean
  videoWidth: number
  videoHeight: number
  readyState: number
  hasDrawnValidFrame: boolean
}>): FootageMotionDrawDecision => {
  if (!input.motionActive) return 'hide'
  if (hasDecodableFrame(input)) return 'draw'
  return input.hasDrawnValidFrame ? 'retain' : 'hide'
}

/**
 * Which canvases currently hold a real frame, and of which source.
 *
 * Held per element rather than in React state because it must survive every
 * re-render, and keyed by source so that loading a different project cannot
 * leave the previous project's last frame on screen as if it were current.
 */
type DrawnFrame = Readonly<{ sourceKey: string; frameToken: string | null }>

const drawnFrames = new WeakMap<HTMLCanvasElement, DrawnFrame>()

const sourceKeyOf = (video: HTMLVideoElement): string => video.currentSrc || video.src || ''

/** Forget any frame recorded for this canvas — used when the source changes. */
export const forgetFootageMotionFrame = (canvas: HTMLCanvasElement): void => {
  drawnFrames.delete(canvas)
}

/**
 * The token of the frame this canvas is actually holding, or `null` if it holds
 * nothing real. The monitor's base-layer resolver compares this against the
 * token it is asking for, and shows the canvas only when they are equal.
 */
export const footageMotionDrawnToken = (canvas: HTMLCanvasElement): string | null =>
  drawnFrames.get(canvas)?.frameToken ?? null

/**
 * Draw the transformed primary picture from the one real video element.
 *
 * The video remains the playback/native-control authority. This canvas is only
 * a renderer-neutral picture projection layered above it while motion is active.
 *
 * It used to reveal itself whenever a motion existed at this moment, guarded
 * only by `videoWidth > 0`. That width is populated at HAVE_METADATA — before
 * any frame is decodable — so during load and during every seek the canvas
 * filled itself black, drew nothing, and was shown on top of a perfectly good
 * video. Base footage went black while the overlays and controls stayed visible.
 *
 * **This function no longer decides visibility at all.** It draws, and it
 * records what it drew. `resolveMonitorBaseLayer` is the only thing that can
 * show or hide the canvas. Two places deciding visibility is how the previous
 * version ended up setting an attribute the stylesheet silently ignored.
 *
 * Returns whether a fresh frame was drawn this call.
 */
export const drawFootageMotionFrame = (input: DrawFootageMotionInput): boolean => {
  const active = footageMotionAtCompositionTime(
    input.plan,
    input.compositionTicks,
    input.reducedMotion ?? false,
  )
  const sourceKey = sourceKeyOf(input.video)
  const hasDrawnValidFrame = drawnFrames.get(input.canvas)?.sourceKey === sourceKey && sourceKey !== ''
  const decision = footageMotionDrawDecision({
    motionActive: active !== null,
    videoWidth: input.video.videoWidth,
    videoHeight: input.video.videoHeight,
    readyState: input.video.readyState,
    hasDrawnValidFrame,
  })
  if (decision === 'retain') return false
  if (decision === 'hide' || !active) {
    drawnFrames.delete(input.canvas)
    return false
  }

  const width = input.plan.width
  const height = input.plan.height
  if (input.canvas.width !== width) input.canvas.width = width
  if (input.canvas.height !== height) input.canvas.height = height
  const context = input.canvas.getContext('2d')
  if (!context) {
    drawnFrames.delete(input.canvas)
    return false
  }

  const { transform, crop } = active.evaluated
  const sourceWidth = input.video.videoWidth
  const sourceHeight = input.video.videoHeight
  const sourceAspect = sourceWidth / sourceHeight
  const frameAspect = width / height
  const fittedWidth = sourceAspect >= frameAspect ? width : height * sourceAspect
  const fittedHeight = sourceAspect >= frameAspect ? width / sourceAspect : height
  const planeLeft = -fittedWidth / 2
  const planeTop = -fittedHeight / 2

  const sx = crop.left * sourceWidth
  const sy = crop.top * sourceHeight
  const sw = Math.max(1, (1 - crop.left - crop.right) * sourceWidth)
  const sh = Math.max(1, (1 - crop.top - crop.bottom) * sourceHeight)
  const dx = planeLeft + crop.left * fittedWidth
  const dy = planeTop + crop.top * fittedHeight
  const dw = Math.max(1, (1 - crop.left - crop.right) * fittedWidth)
  const dh = Math.max(1, (1 - crop.top - crop.bottom) * fittedHeight)

  try {
    context.save()
    context.setTransform(1, 0, 0, 1, 0, 0)
    context.clearRect(0, 0, width, height)
    context.fillStyle = '#000'
    context.fillRect(0, 0, width, height)
    context.translate(
      width / 2 + transform.translateX * width,
      height / 2 + transform.translateY * height,
    )
    context.rotate(transform.rotationDegrees * Math.PI / 180)
    context.scale(transform.scale, transform.scale)
    context.drawImage(input.video, sx, sy, sw, sh, dx, dy, dw, dh)
    context.restore()
  } catch {
    // A decoder can still refuse a frame it claimed to have. Stepping aside for
    // the native video is honest; leaving a half-cleared canvas on screen and
    // calling it the footage is not.
    context.restore()
    drawnFrames.delete(input.canvas)
    return false
  }
  // The token is minted HERE, from the same values the draw actually used, so
  // the string the canvas reports can never describe a frame it did not draw.
  // The monitor mints its request with the same helper, so equal strings mean
  // equal pictures by construction rather than by careful coincidence.
  drawnFrames.set(input.canvas, Object.freeze({
    sourceKey,
    frameToken: motionCanvasFrameToken({
      assetId: active.segment.assetId,
      sourceTicks: active.sourceTicks,
      compositionTicks: input.compositionTicks,
      motionId: active.motion.motionId,
      geometryVersion: input.geometryVersion ?? 0,
    }),
  }))
  return true
}
