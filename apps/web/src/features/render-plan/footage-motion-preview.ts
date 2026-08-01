import {
  evaluateFootageMotionAt,
  mediaTime,
  type EvaluatedFootageMotion,
} from '@sanverse/edit-domain'
import type { RenderPlan, SourceSegmentNode } from '@sanverse/render-contract'

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
}>

/**
 * Draw the transformed primary picture from the one real video element.
 *
 * The video remains the playback/native-control authority. This canvas is only
 * a renderer-neutral picture projection layered above it while motion is active.
 */
export const drawFootageMotionFrame = (input: DrawFootageMotionInput): boolean => {
  const active = footageMotionAtCompositionTime(
    input.plan,
    input.compositionTicks,
    input.reducedMotion ?? false,
  )
  if (!active || input.video.videoWidth <= 0 || input.video.videoHeight <= 0) {
    input.canvas.hidden = true
    return false
  }

  const width = input.plan.width
  const height = input.plan.height
  if (input.canvas.width !== width) input.canvas.width = width
  if (input.canvas.height !== height) input.canvas.height = height
  const context = input.canvas.getContext('2d')
  if (!context) {
    input.canvas.hidden = true
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
  input.canvas.hidden = false
  return true
}
