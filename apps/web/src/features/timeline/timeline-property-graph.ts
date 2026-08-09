import {
  animationCapabilityForProperty,
  evaluatePropertyTrack,
  type EditorAnimationPropertyIdV1,
  type EditorAnimationTrackStateV1,
  type VisualPropertyTrack,
} from '@sanverse/edit-domain'
import type { TimelineAnimationGraphViewportV1, TimelineAnimationSubjectV1 } from './timeline-animation-presentation'

export const GRAPH_PAD_X = 34
export const GRAPH_PAD_Y = 22
export const GRAPH_SAMPLE_MIN = 48
export const GRAPH_SAMPLE_MAX = 640

export type EditorGraphRangeV1 = Readonly<{
  timeMin: number
  timeMax: number
  valueMin: number
  valueMax: number
}>

export type EditorGraphPointV1 = Readonly<{ x: number; y: number }>

export const clampGraphValue = (value: number, minimum: number, maximum: number): number =>
  Math.min(maximum, Math.max(minimum, value))

export const editorGraphRange = (input: Readonly<{
  subject: TimelineAnimationSubjectV1
  state: EditorAnimationTrackStateV1
  property: EditorAnimationPropertyIdV1
  viewport: TimelineAnimationGraphViewportV1
}>): EditorGraphRangeV1 => {
  const capability = animationCapabilityForProperty(input.state.targetKind, input.property, input.state)
  const duration = Math.max(1, input.state.durationTicks)
  const minimum = capability?.minimum ?? 0
  const maximum = capability?.maximum ?? 1
  const baseRange = Math.max(0.000001, maximum - minimum)
  const timeSpan = duration / input.viewport.zoomX
  const rawTimeCenter = duration / 2 + input.viewport.panX
  const timeMin = clampGraphValue(rawTimeCenter - timeSpan / 2, 0, Math.max(0, duration - timeSpan))
  const valueSpan = baseRange / input.viewport.zoomY
  const valueCenter = (minimum + maximum) / 2 + input.viewport.panY
  const valueMin = valueCenter - valueSpan / 2
  return Object.freeze({
    timeMin,
    timeMax: timeMin + timeSpan,
    valueMin,
    valueMax: valueMin + valueSpan,
  })
}

export const editorGraphPoint = (input: Readonly<{
  ticks: number
  value: number
  width: number
  height: number
  range: EditorGraphRangeV1
}>): EditorGraphPointV1 => {
  const innerWidth = Math.max(1, input.width - GRAPH_PAD_X * 2)
  const innerHeight = Math.max(1, input.height - GRAPH_PAD_Y * 2)
  return Object.freeze({
    x: GRAPH_PAD_X + (input.ticks - input.range.timeMin) / Math.max(1, input.range.timeMax - input.range.timeMin) * innerWidth,
    y: GRAPH_PAD_Y + (input.range.valueMax - input.value) / Math.max(0.000001, input.range.valueMax - input.range.valueMin) * innerHeight,
  })
}

export const editorGraphTimeAtX = (input: Readonly<{
  x: number
  width: number
  range: EditorGraphRangeV1
}>): number => {
  const innerWidth = Math.max(1, input.width - GRAPH_PAD_X * 2)
  const progress = (input.x - GRAPH_PAD_X) / innerWidth
  return Math.round(input.range.timeMin + progress * (input.range.timeMax - input.range.timeMin))
}

export const editorGraphValueAtY = (input: Readonly<{
  y: number
  height: number
  range: EditorGraphRangeV1
}>): number => {
  const innerHeight = Math.max(1, input.height - GRAPH_PAD_Y * 2)
  const progress = (input.y - GRAPH_PAD_Y) / innerHeight
  return input.range.valueMax - progress * (input.range.valueMax - input.range.valueMin)
}

export const editorGraphPath = (input: Readonly<{
  track: VisualPropertyTrack
  width: number
  height: number
  range: EditorGraphRangeV1
}>): Readonly<{ d: string; sampleCount: number }> => {
  const sampleCount = Math.min(GRAPH_SAMPLE_MAX, Math.max(GRAPH_SAMPLE_MIN, Math.ceil(input.width * 1.5)))
  const commands: string[] = []
  for (let index = 0; index < sampleCount; index += 1) {
    const progress = sampleCount <= 1 ? 0 : index / (sampleCount - 1)
    const ticks = Math.round(input.range.timeMin + progress * (input.range.timeMax - input.range.timeMin))
    const point = editorGraphPoint({
      ticks,
      value: evaluatePropertyTrack(input.track, ticks),
      width: input.width,
      height: input.height,
      range: input.range,
    })
    commands.push(`${index === 0 ? 'M' : 'L'} ${point.x.toFixed(2)} ${point.y.toFixed(2)}`)
  }
  return Object.freeze({ d: commands.join(' '), sampleCount })
}

export const editorGraphBezierHandlePoint = (input: Readonly<{
  left: EditorGraphPointV1
  right: EditorGraphPointV1
  x: number
  y: number
}>): EditorGraphPointV1 => Object.freeze({
  x: input.left.x + input.x * (input.right.x - input.left.x),
  y: input.left.y + input.y * (input.right.y - input.left.y),
})

export const editorGraphBezierValueFromPoint = (input: Readonly<{
  point: EditorGraphPointV1
  left: EditorGraphPointV1
  right: EditorGraphPointV1
}>): Readonly<{ x: number; y: number } | null> => {
  const width = input.right.x - input.left.x
  const height = input.right.y - input.left.y
  if (Math.abs(width) < 0.001 || Math.abs(height) < 0.001) return null
  return Object.freeze({
    x: clampGraphValue((input.point.x - input.left.x) / width, 0, 1),
    y: clampGraphValue((input.point.y - input.left.y) / height, -2, 2),
  })
}
