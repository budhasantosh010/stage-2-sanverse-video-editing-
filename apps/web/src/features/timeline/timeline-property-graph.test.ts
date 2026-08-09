import { describe, expect, it } from 'vitest'
import { DEFAULT_VISUAL_PROPERTIES, mediaTime, type EditorAnimationTrackStateV1, type VisualPropertyTrack } from '@sanverse/edit-domain'
import { DEFAULT_TIMELINE_ANIMATION_PRESENTATION, type TimelineAnimationSubjectV1 } from './timeline-animation-presentation'
import {
  GRAPH_SAMPLE_MAX,
  editorGraphBezierHandlePoint,
  editorGraphBezierValueFromPoint,
  editorGraphPath,
  editorGraphPoint,
  editorGraphRange,
  editorGraphTimeAtX,
  editorGraphValueAtY,
} from './timeline-property-graph'

const track: VisualPropertyTrack = Object.freeze({
  property: 'scale',
  keyframes: Object.freeze([
    Object.freeze({ at: mediaTime(0), value: 1, easing: Object.freeze({ kind: 'linear' as const }) }),
    Object.freeze({ at: mediaTime(100), value: 2, easing: Object.freeze({ kind: 'linear' as const }) }),
  ]),
})
const state: EditorAnimationTrackStateV1 = Object.freeze({
  targetKind: 'title',
  durationTicks: 100,
  transform: DEFAULT_VISUAL_PROPERTIES.transform,
  crop: DEFAULT_VISUAL_PROPERTIES.crop,
  tracks: Object.freeze([track]),
})
const subject: TimelineAnimationSubjectV1 = Object.freeze({
  itemId: 'title_1',
  laneId: 'overlay',
  label: 'Title',
  target: Object.freeze({ kind: 'visual-properties' as const, visualId: 'title_1' }),
  state,
  timeContext: Object.freeze({ kind: 'visual-properties' as const, compositionStartTicks: 0, durationTicks: 100 }),
  sourceAnchored: false,
})

describe('editor property graph math', () => {
  it('keeps graph viewport presentation outside project values and invertibly maps points', () => {
    const range = editorGraphRange({ subject, state, property: 'scale', viewport: DEFAULT_TIMELINE_ANIMATION_PRESENTATION.graphViewport })
    const point = editorGraphPoint({ ticks: 50, value: 10, width: 800, height: 240, range })
    expect(editorGraphTimeAtX({ x: point.x, width: 800, range })).toBe(50)
    expect(editorGraphValueAtY({ y: point.y, height: 240, range })).toBeCloseTo(10, 8)
  })

  it('samples the real shared evaluator with a hard ceiling', () => {
    const range = editorGraphRange({ subject, state, property: 'scale', viewport: DEFAULT_TIMELINE_ANIMATION_PRESENTATION.graphViewport })
    const path = editorGraphPath({ track, width: 20_000, height: 300, range })
    expect(path.sampleCount).toBe(GRAPH_SAMPLE_MAX)
    expect(path.d.startsWith('M ')).toBe(true)
    expect(path.d.includes('L ')).toBe(true)
  })

  it('round-trips cubic-bezier handle coordinates and refuses equal-value screen spans', () => {
    const left = Object.freeze({ x: 10, y: 200 })
    const right = Object.freeze({ x: 210, y: 100 })
    const handle = editorGraphBezierHandlePoint({ left, right, x: 0.25, y: 1.4 })
    expect(editorGraphBezierValueFromPoint({ point: handle, left, right })).toEqual({ x: 0.25, y: 1.4 })
    expect(editorGraphBezierValueFromPoint({ point: handle, left, right: { x: 210, y: 200 } })).toBeNull()
  })
})
