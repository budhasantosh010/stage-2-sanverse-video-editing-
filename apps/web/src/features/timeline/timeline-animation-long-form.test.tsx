import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import {
  DEFAULT_VISUAL_PROPERTIES,
  EMPTY_EDITOR_KEYFRAME_SELECTION,
  mediaTime,
  PROJECT_TIMESCALE,
  type EditorAnimationTrackStateV1,
  type VisualPropertyTrack,
} from '@sanverse/edit-domain'
import { TimelineAnimationLanes } from '../../editor/timeline/TimelineAnimationLanes'
import {
  DEFAULT_TIMELINE_ANIMATION_PRESENTATION,
  animationPresentationForTarget,
  editorGraphPath,
  editorGraphRange,
  type TimelineAnimationSubjectV1,
} from './index'

const S = PROJECT_TIMESCALE
const HOUR = 3_600 * S

const denseTrack = (count: 2 | 8 | 32 | 64): VisualPropertyTrack => Object.freeze({
  property: 'scale',
  keyframes: Object.freeze(Array.from({ length: count }, (_, index) => Object.freeze({
    at: mediaTime(Math.round(index / (count - 1) * HOUR)),
    value: 1 + (index % 5) * 0.05,
    easing: index % 3 === 0
      ? Object.freeze({ kind: 'spring' as const, mass: 1, stiffness: 170, damping: 26, velocity: 0 })
      : Object.freeze({ kind: 'linear' as const }),
  }))),
})

const makeSubject = (index: number, count: 2 | 8 | 32 | 64 = 64): TimelineAnimationSubjectV1 => {
  const target = Object.freeze({ kind: 'visual-properties' as const, visualId: `title_long_${index}` })
  const state: EditorAnimationTrackStateV1 = Object.freeze({
    targetKind: 'title',
    durationTicks: HOUR,
    transform: DEFAULT_VISUAL_PROPERTIES.transform,
    crop: DEFAULT_VISUAL_PROPERTIES.crop,
    tracks: Object.freeze([denseTrack(count)]),
  })
  return Object.freeze({
    itemId: `title_long_${index}`,
    laneId: 'overlay',
    label: `Animated target ${index}`,
    target,
    state,
    timeContext: Object.freeze({ kind: 'visual-properties' as const, compositionStartTicks: 0, durationTicks: HOUR }),
    sourceAnchored: false,
  })
}

describe('T4 sixty-minute animation bounds', () => {
  it('represents 250 placements / 50 animated targets without building whole-project animation DOM', () => {
    const placements = Array.from({ length: 250 }, (_, index) => Object.freeze({ id: `clip_${index}`, animated: index < 50 }))
    const animatedSubjects = placements.filter((item) => item.animated).map((_, index) => makeSubject(index, ([2, 8, 32, 64] as const)[index % 4]))
    expect(placements).toHaveLength(250)
    expect(animatedSubjects).toHaveLength(50)
    expect(animatedSubjects.reduce((sum, subject) => sum + subject.state.tracks[0].keyframes.length, 0)).toBeGreaterThan(1_000)

    const active = animatedSubjects[49]
    const presentation = animationPresentationForTarget(Object.freeze({ ...DEFAULT_TIMELINE_ANIMATION_PRESENTATION, activeProperty: 'scale' as const }), active.target, true)
    render(<TimelineAnimationLanes
      subject={active}
      presentation={presentation}
      selection={EMPTY_EDITOR_KEYFRAME_SELECTION}
      clipboard={null}
      visibleRange={{ startTicks: 1_800 * S, endTicks: 1_860 * S }}
      overscanTicks={15 * S}
      pixelsPerSecond={4}
      timescale={S}
      playheadTicks={1_830 * S}
      frameTicks={S / 30}
      frameRate={{ numerator: 30, denominator: 1 }}
      compositionDurationTicks={HOUR}
      busy={false}
      onPresentationChange={vi.fn()}
      onSelectionChange={vi.fn()}
      onClipboardChange={vi.fn()}
      onDraft={vi.fn()}
      onCommit={vi.fn()}
      onSeek={vi.fn()}
      onNotice={vi.fn()}
    />)
    const mountedDiamonds = screen.queryAllByRole('button', { name: /Scale keyframe/ })
    expect(mountedDiamonds.length).toBeLessThanOrEqual(4)
    expect(screen.getByRole('region', { name: 'Animated target 49 animation properties' })).toBeInTheDocument()
    expect(screen.queryByRole('region', { name: 'Animated target 0 animation properties' })).not.toBeInTheDocument()
  })

  it.each([2, 8, 32, 64] as const)('keeps a %i-keyframe graph bounded by the hard sample ceiling', (count) => {
    const subject = makeSubject(count, count)
    const range = editorGraphRange({ subject, state: subject.state, property: 'scale', viewport: DEFAULT_TIMELINE_ANIMATION_PRESENTATION.graphViewport })
    const graph = editorGraphPath({ track: subject.state.tracks[0], width: 4_000, height: 300, range })
    expect(graph.sampleCount).toBeLessThanOrEqual(640)
    expect(graph.sampleCount).toBeGreaterThan(0)
  })

  it('does not require media-analysis, server, object URL, AudioContext, or video creation for pure animation projection', () => {
    const originalCreateObjectURL = URL.createObjectURL
    const createObjectURL = vi.fn()
    Object.defineProperty(URL, 'createObjectURL', { configurable: true, writable: true, value: createObjectURL })
    const fetchSpy = vi.spyOn(globalThis, 'fetch')
    const subject = makeSubject(1)
    const range = editorGraphRange({ subject, state: subject.state, property: 'scale', viewport: DEFAULT_TIMELINE_ANIMATION_PRESENTATION.graphViewport })
    editorGraphPath({ track: subject.state.tracks[0], width: 1_000, height: 220, range })
    expect(createObjectURL).not.toHaveBeenCalled()
    expect(fetchSpy).not.toHaveBeenCalled()
    Object.defineProperty(URL, 'createObjectURL', { configurable: true, writable: true, value: originalCreateObjectURL })
    fetchSpy.mockRestore()
  })
})
