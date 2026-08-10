import { DEFAULT_MOTION_BEZIER_HANDLES, evaluateKeyframedValue, motionBezierHandleIssue } from './animation.ts'
import { projectMotionDopeSheet, motionTimelineTargetKey } from './dope-sheet.ts'
import { readMotionAnimatableTarget } from './animatable-targets.ts'
import type { MotionGraphOperationV1 } from './operations.ts'
import type { MotionBezierHandlesV1, MotionKeyframeTargetV1, MotionKeyframeV1 } from './properties.ts'
import type { MotionSceneV1 } from './scene.ts'

export interface MotionCurveValueRangeV1 {
  readonly minimum: number
  readonly maximum: number
}

export interface MotionCurveKeyframeProjectionV1 {
  readonly selectionId: string
  readonly keyframeId: string
  readonly tick: number
  readonly value: number
  readonly interpolation: MotionKeyframeV1<number>['interpolation']
  readonly bezier?: MotionBezierHandlesV1
}

export interface MotionCurveTrackProjectionV1 {
  readonly trackId: string
  readonly target: MotionKeyframeTargetV1
  readonly nodeId: string
  readonly nodeName: string
  readonly label: string
  readonly property: string
  readonly animationKind: 'motion' | 'keyframes' | 'binding'
  readonly editable: boolean
  readonly readOnlyReason: string | null
  readonly keyframes: readonly MotionCurveKeyframeProjectionV1[]
  readonly valueRange: MotionCurveValueRangeV1
  readonly constraintMinimum?: number
  readonly constraintMaximum?: number
}

export interface MotionCurveProjectionV1 {
  readonly tracks: readonly MotionCurveTrackProjectionV1[]
  readonly tracksById: Readonly<Record<string, MotionCurveTrackProjectionV1>>
  readonly totalTracks: number
  readonly totalKeyframes: number
}

const finiteNumbers = (values: readonly number[]): readonly number[] => values.filter(Number.isFinite)

export const fitMotionCurveValueRange = (values: readonly number[], paddingRatio = .12): MotionCurveValueRangeV1 => {
  const finite = finiteNumbers(values)
  if (finite.length === 0) return Object.freeze({ minimum: 0, maximum: 1 })
  let minimum = finite[0]!, maximum = finite[0]!
  for (let index = 1; index < finite.length; index += 1) {
    const value = finite[index]!
    if (value < minimum) minimum = value
    if (value > maximum) maximum = value
  }
  const span = maximum - minimum
  const padding = span > 1e-9 ? Math.max(span * paddingRatio, 1e-6) : Math.max(Math.abs(minimum) * paddingRatio, .5)
  return Object.freeze({ minimum: minimum - padding, maximum: maximum + padding })
}

export const projectMotionCurves = (scene: MotionSceneV1): MotionCurveProjectionV1 => {
  const dopeSheet = projectMotionDopeSheet(scene)
  const tracks: MotionCurveTrackProjectionV1[] = []
  const tracksById: Record<string, MotionCurveTrackProjectionV1> = {}
  let totalKeyframes = 0
  for (const layer of dopeSheet.layers) for (const track of layer.tracks) {
    if (track.propertyType !== 'number') continue
    const record = readMotionAnimatableTarget(scene, track.target)
    if (record.capability.valueType !== 'number') continue
    const numericKeys = track.keyframeRefs.filter((keyframe): keyframe is typeof keyframe & { readonly value: number } => typeof keyframe.value === 'number').map((keyframe): MotionCurveKeyframeProjectionV1 => Object.freeze({
      selectionId: keyframe.selectionId,
      keyframeId: keyframe.keyframeId,
      tick: keyframe.tick,
      value: keyframe.value,
      interpolation: keyframe.interpolation,
      ...(keyframe.bezier ? { bezier: keyframe.bezier } : {}),
    }))
    const editable = track.animationKind === 'keyframes' && numericKeys.length > 0
    const readOnlyReason = editable ? null : track.animationKind === 'motion' ? 'Driven by motion driver. Convert/bake is required before curve editing.' : 'This numeric track is not keyframed.'
    const projected: MotionCurveTrackProjectionV1 = Object.freeze({
      trackId: track.trackId,
      target: track.target,
      nodeId: track.nodeId,
      nodeName: track.nodeName,
      label: track.label,
      property: track.property,
      animationKind: track.animationKind,
      editable,
      readOnlyReason,
      keyframes: Object.freeze(numericKeys),
      valueRange: fitMotionCurveValueRange(numericKeys.map((keyframe) => keyframe.value)),
      ...(record.capability.minimum !== undefined ? { constraintMinimum: record.capability.minimum } : {}),
      ...(record.capability.maximum !== undefined ? { constraintMaximum: record.capability.maximum } : {}),
    })
    tracks.push(projected)
    tracksById[projected.trackId] = projected
    totalKeyframes += projected.keyframes.length
  }
  return Object.freeze({ tracks: Object.freeze(tracks), tracksById: Object.freeze(tracksById), totalTracks: tracks.length, totalKeyframes })
}

export interface MotionCurveSampleV1 { readonly tick: number; readonly value: number }

export const sampleMotionCurveTrack = (scene: MotionSceneV1, trackId: string, samplesPerSegment = 24): readonly MotionCurveSampleV1[] => {
  if (!Number.isSafeInteger(samplesPerSegment) || samplesPerSegment < 1 || samplesPerSegment > 256) throw new RangeError('samplesPerSegment must be an integer inside [1,256].')
  const projection = projectMotionCurves(scene)
  const track = projection.tracksById[trackId]
  if (!track) throw new RangeError(`Unknown numeric curve track: ${trackId}`)
  const record = readMotionAnimatableTarget(scene, track.target)
  if (record.animatable.kind !== 'keyframes') return Object.freeze([])
  if (record.animatable.keyframes.some((keyframe) => typeof keyframe.value !== 'number')) throw new RangeError(`Curve track ${trackId} must contain numeric keyframes.`)
  const keys = record.animatable.keyframes as readonly MotionKeyframeV1<number>[]
  if (keys.length === 0) return Object.freeze([])
  if (keys.length === 1) return Object.freeze([Object.freeze({ tick: keys[0]!.tick, value: keys[0]!.value })])
  const points: MotionCurveSampleV1[] = []
  for (let index = 0; index < keys.length - 1; index += 1) {
    const left = keys[index]!, right = keys[index + 1]!
    for (let sampleIndex = index === 0 ? 0 : 1; sampleIndex <= samplesPerSegment; sampleIndex += 1) {
      const tick = Math.round(left.tick + (right.tick - left.tick) * sampleIndex / samplesPerSegment)
      points.push(Object.freeze({ tick, value: evaluateKeyframedValue(record.animatable as never, tick) as number }))
    }
  }
  return Object.freeze(points)
}

export interface MotionCurvePlotViewportV1 {
  readonly startTicks: number
  readonly endTicks: number
  readonly valueRange: MotionCurveValueRangeV1
  readonly width: number
  readonly height: number
}

const plotX = (tick: number, viewport: MotionCurvePlotViewportV1): number => ((tick - viewport.startTicks) / Math.max(1, viewport.endTicks - viewport.startTicks)) * viewport.width
const plotY = (value: number, viewport: MotionCurvePlotViewportV1): number => viewport.height - ((value - viewport.valueRange.minimum) / Math.max(1e-9, viewport.valueRange.maximum - viewport.valueRange.minimum)) * viewport.height
const pathNumber = (value: number): string => Number(value.toFixed(3)).toString()

/** Builds the SVG value graph from the same normalized segment handles C2 evaluates. */
export const buildMotionCurveSvgPath = (track: MotionCurveTrackProjectionV1, viewport: MotionCurvePlotViewportV1): string => {
  if (!Number.isFinite(viewport.width) || !Number.isFinite(viewport.height) || viewport.width <= 0 || viewport.height <= 0 || !Number.isSafeInteger(viewport.startTicks) || !Number.isSafeInteger(viewport.endTicks) || viewport.endTicks <= viewport.startTicks) throw new RangeError('Curve viewport must have finite positive geometry and exact increasing ticks.')
  if (track.keyframes.length === 0) return ''
  const keys = track.keyframes
  let path = `M ${pathNumber(plotX(keys[0]!.tick, viewport))} ${pathNumber(plotY(keys[0]!.value, viewport))}`
  for (let index = 0; index < keys.length - 1; index += 1) {
    const left = keys[index]!, right = keys[index + 1]!
    const rightX = plotX(right.tick, viewport), rightY = plotY(right.value, viewport)
    if (left.interpolation === 'hold') {
      path += ` L ${pathNumber(rightX)} ${pathNumber(plotY(left.value, viewport))} L ${pathNumber(rightX)} ${pathNumber(rightY)}`
      continue
    }
    if (left.interpolation === 'linear') {
      path += ` L ${pathNumber(rightX)} ${pathNumber(rightY)}`
      continue
    }
    const leftBezier = left.bezier ?? DEFAULT_MOTION_BEZIER_HANDLES
    const rightBezier = right.bezier ?? DEFAULT_MOTION_BEZIER_HANDLES
    const deltaTick = right.tick - left.tick, deltaValue = right.value - left.value
    const c1Tick = left.tick + deltaTick * leftBezier.outX, c1Value = left.value + deltaValue * leftBezier.outY
    const c2Tick = left.tick + deltaTick * rightBezier.inX, c2Value = left.value + deltaValue * rightBezier.inY
    path += ` C ${pathNumber(plotX(c1Tick, viewport))} ${pathNumber(plotY(c1Value, viewport))} ${pathNumber(plotX(c2Tick, viewport))} ${pathNumber(plotY(c2Value, viewport))} ${pathNumber(rightX)} ${pathNumber(rightY)}`
  }
  return path
}

export type MotionCurvePresetIdV1 = 'linear' | 'bezier' | 'flat' | 'auto' | 'soft' | 'smooth' | 'snappy' | 'heavy' | 'ease-in' | 'ease-out' | 'ease-in-out' | 'overshoot'

export interface MotionCurvePresetShapeV1 {
  readonly interpolation: 'linear' | 'bezier'
  readonly outX?: number
  readonly outY?: number
  readonly inX?: number
  readonly inY?: number
}

export const motionCurvePresetShape = (preset: MotionCurvePresetIdV1): MotionCurvePresetShapeV1 => {
  if (preset === 'linear') return Object.freeze({ interpolation: 'linear' })
  if (preset === 'bezier') return Object.freeze({ interpolation: 'bezier', outX: DEFAULT_MOTION_BEZIER_HANDLES.outX, outY: DEFAULT_MOTION_BEZIER_HANDLES.outY, inX: DEFAULT_MOTION_BEZIER_HANDLES.inX, inY: DEFAULT_MOTION_BEZIER_HANDLES.inY })
  if (preset === 'flat') return Object.freeze({ interpolation: 'bezier', outX: .33, outY: 0, inX: .67, inY: 1 })
  if (preset === 'auto' || preset === 'smooth') return Object.freeze({ interpolation: 'bezier', outX: .33, outY: .08, inX: .67, inY: .92 })
  if (preset === 'soft') return Object.freeze({ interpolation: 'bezier', outX: .25, outY: .12, inX: .72, inY: .92 })
  if (preset === 'snappy') return Object.freeze({ interpolation: 'bezier', outX: .18, outY: .88, inX: .32, inY: 1 })
  if (preset === 'heavy') return Object.freeze({ interpolation: 'bezier', outX: .58, outY: .02, inX: .82, inY: .42 })
  if (preset === 'ease-in') return Object.freeze({ interpolation: 'bezier', outX: .42, outY: 0, inX: 1, inY: 1 })
  if (preset === 'ease-out') return Object.freeze({ interpolation: 'bezier', outX: 0, outY: 0, inX: .58, inY: 1 })
  if (preset === 'ease-in-out') return Object.freeze({ interpolation: 'bezier', outX: .42, outY: 0, inX: .58, inY: 1 })
  return Object.freeze({ interpolation: 'bezier', outX: .2, outY: 1.35, inX: .55, inY: 1.08 })
}

export const motionCurveTargetAllowsOvershoot = (scene: MotionSceneV1, target: MotionKeyframeTargetV1): boolean => {
  const record = readMotionAnimatableTarget(scene, target)
  if (target.kind === 'node') return ['transform.positionX', 'transform.positionY', 'transform.scaleX', 'transform.scaleY', 'transform.rotationDeg'].includes(target.property)
  return record.capability.minimum === undefined && record.capability.maximum === undefined
}

const withOutgoing = (base: MotionBezierHandlesV1 | undefined, shape: MotionCurvePresetShapeV1): MotionBezierHandlesV1 => Object.freeze({
  ...(base ?? DEFAULT_MOTION_BEZIER_HANDLES),
  outX: shape.outX ?? DEFAULT_MOTION_BEZIER_HANDLES.outX,
  outY: shape.outY ?? DEFAULT_MOTION_BEZIER_HANDLES.outY,
})
const withIncoming = (base: MotionBezierHandlesV1 | undefined, shape: MotionCurvePresetShapeV1): MotionBezierHandlesV1 => Object.freeze({
  ...(base ?? DEFAULT_MOTION_BEZIER_HANDLES),
  inX: shape.inX ?? DEFAULT_MOTION_BEZIER_HANDLES.inX,
  inY: shape.inY ?? DEFAULT_MOTION_BEZIER_HANDLES.inY,
})

export const buildMotionCurvePresetOperations = (input: Readonly<{
  scene: MotionSceneV1
  trackId: string
  leftKeyframeId: string
  preset: MotionCurvePresetIdV1
  nextOperationId: (prefix: string) => string
}>): readonly MotionGraphOperationV1[] => {
  const projection = projectMotionCurves(input.scene)
  const track = projection.tracksById[input.trackId]
  if (!track) throw new RangeError(`Unknown numeric curve track: ${input.trackId}`)
  if (!track.editable) throw new RangeError(track.readOnlyReason ?? 'Curve track is not editable.')
  const leftIndex = track.keyframes.findIndex((keyframe) => keyframe.keyframeId === input.leftKeyframeId)
  if (leftIndex < 0 || leftIndex >= track.keyframes.length - 1) throw new RangeError('Curve preset needs a left keyframe with a following segment.')
  if (input.preset === 'overshoot' && !motionCurveTargetAllowsOvershoot(input.scene, track.target)) throw new RangeError(`Overshoot is not valid for constrained property ${track.label}.`)
  const left = track.keyframes[leftIndex]!, right = track.keyframes[leftIndex + 1]!
  const shape = motionCurvePresetShape(input.preset)
  const operations: MotionGraphOperationV1[] = [Object.freeze({ operationId: input.nextOperationId('c5-interpolation'), type: 'set-keyframe-interpolation', target: track.target, keyframeId: left.keyframeId, interpolation: shape.interpolation })]
  if (shape.interpolation === 'linear') {
    operations.push(Object.freeze({ operationId: input.nextOperationId('c5-clear-left-bezier'), type: 'set-keyframe-bezier', target: track.target, keyframeId: left.keyframeId, bezier: null }))
    return Object.freeze(operations)
  }
  const leftBezier = withOutgoing(left.bezier, shape), rightBezier = withIncoming(right.bezier, shape)
  const leftIssue = motionBezierHandleIssue(leftBezier), rightIssue = motionBezierHandleIssue(rightBezier)
  if (leftIssue || rightIssue) throw new RangeError(leftIssue ?? rightIssue ?? 'Invalid curve preset.')
  operations.push(
    Object.freeze({ operationId: input.nextOperationId('c5-left-bezier'), type: 'set-keyframe-bezier', target: track.target, keyframeId: left.keyframeId, bezier: leftBezier }),
    Object.freeze({ operationId: input.nextOperationId('c5-right-bezier'), type: 'set-keyframe-bezier', target: track.target, keyframeId: right.keyframeId, bezier: rightBezier }),
  )
  return Object.freeze(operations)
}

export const buildMotionCurveBezierOperation = (input: Readonly<{
  scene: MotionSceneV1
  trackId: string
  keyframeId: string
  bezier: MotionBezierHandlesV1
  nextOperationId: (prefix: string) => string
}>): MotionGraphOperationV1 => {
  const projection = projectMotionCurves(input.scene)
  const track = projection.tracksById[input.trackId]
  if (!track || !track.editable) throw new RangeError(track?.readOnlyReason ?? `Unknown editable curve track: ${input.trackId}`)
  if (!track.keyframes.some((candidate) => candidate.keyframeId === input.keyframeId)) throw new RangeError(`Unknown curve keyframe: ${input.keyframeId}`)
  const issue = motionBezierHandleIssue(input.bezier)
  if (issue) throw new RangeError(issue)
  return Object.freeze({ operationId: input.nextOperationId('c5-bezier'), type: 'set-keyframe-bezier', target: track.target, keyframeId: input.keyframeId, bezier: Object.freeze({ ...input.bezier }) })
}

export const buildMotionCurveHandleOperation = (input: Readonly<{
  scene: MotionSceneV1
  trackId: string
  keyframeId: string
  handle: keyof MotionBezierHandlesV1
  value: number
  nextOperationId: (prefix: string) => string
}>): MotionGraphOperationV1 => {
  if (!Number.isFinite(input.value)) throw new RangeError('Curve handle value must be finite.')
  const projection = projectMotionCurves(input.scene)
  const track = projection.tracksById[input.trackId]
  if (!track || !track.editable) throw new RangeError(track?.readOnlyReason ?? `Unknown editable curve track: ${input.trackId}`)
  const keyframe = track.keyframes.find((candidate) => candidate.keyframeId === input.keyframeId)
  if (!keyframe) throw new RangeError(`Unknown curve keyframe: ${input.keyframeId}`)
  const bezier = Object.freeze({ ...(keyframe.bezier ?? DEFAULT_MOTION_BEZIER_HANDLES), [input.handle]: input.value })
  const issue = motionBezierHandleIssue(bezier)
  if (issue) throw new RangeError(issue)
  return Object.freeze({ operationId: input.nextOperationId('c5-handle'), type: 'set-keyframe-bezier', target: track.target, keyframeId: keyframe.keyframeId, bezier })
}

export const motionCurveTrackIdForTarget = (target: MotionKeyframeTargetV1): string => motionTimelineTargetKey(target)
