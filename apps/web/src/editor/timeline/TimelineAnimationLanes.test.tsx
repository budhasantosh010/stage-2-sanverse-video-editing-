import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import {
  DEFAULT_VISUAL_PROPERTIES,
  EMPTY_EDITOR_KEYFRAME_SELECTION,
  mediaTime,
  PROJECT_TIMESCALE,
  type EditorAnimationTrackStateV1,
  type EditorKeyframeClipboardV1,
  type VisualPropertyTrack,
} from '@sanverse/edit-domain'
import {
  DEFAULT_TIMELINE_ANIMATION_PRESENTATION,
  animationPresentationForTarget,
  type TimelineAnimationSubjectV1,
} from '../../features/timeline'
import { TimelineAnimationLanes } from './TimelineAnimationLanes'

const S = PROJECT_TIMESCALE
const target = Object.freeze({ kind: 'visual-properties' as const, visualId: 'title_animation01' })
const scaleTrack = (): VisualPropertyTrack => Object.freeze({
  property: 'scale',
  keyframes: Object.freeze([
    Object.freeze({ at: mediaTime(0), value: 1, easing: Object.freeze({ kind: 'linear' as const }) }),
    Object.freeze({ at: mediaTime(2 * S), value: 1.2, easing: Object.freeze({ kind: 'linear' as const }) }),
    Object.freeze({ at: mediaTime(4 * S), value: 1, easing: Object.freeze({ kind: 'linear' as const }) }),
  ]),
})
const state = (tracks: readonly VisualPropertyTrack[] = [scaleTrack()]): EditorAnimationTrackStateV1 => Object.freeze({
  targetKind: 'title',
  durationTicks: 4 * S,
  transform: DEFAULT_VISUAL_PROPERTIES.transform,
  crop: DEFAULT_VISUAL_PROPERTIES.crop,
  tracks: Object.freeze(tracks),
})
const subject = (nextState = state()): TimelineAnimationSubjectV1 => Object.freeze({
  itemId: 'title_animation01',
  laneId: 'overlay',
  label: 'Title',
  target,
  state: nextState,
  timeContext: Object.freeze({ kind: 'visual-properties' as const, compositionStartTicks: 5 * S, durationTicks: 4 * S }),
  sourceAnchored: false,
})
const presentation = animationPresentationForTarget(Object.freeze({
  ...DEFAULT_TIMELINE_ANIMATION_PRESENTATION,
  activeProperty: 'scale' as const,
}), target, true)

const renderLanes = (overrides: Partial<React.ComponentProps<typeof TimelineAnimationLanes>> = {}) => {
  const onCommit = vi.fn()
  const onDraft = vi.fn()
  const onSelectionChange = vi.fn()
  const onClipboardChange = vi.fn()
  const onPresentationChange = vi.fn()
  const onNotice = vi.fn()
  render(<TimelineAnimationLanes
    subject={subject()}
    presentation={presentation}
    selection={EMPTY_EDITOR_KEYFRAME_SELECTION}
    clipboard={null}
    visibleRange={Object.freeze({ startTicks: 0, endTicks: 20 * S })}
    overscanTicks={S}
    pixelsPerSecond={100}
    timescale={S}
    playheadTicks={6 * S}
    frameTicks={S / 30}
    frameRate={Object.freeze({ numerator: 30, denominator: 1 })}
    compositionDurationTicks={20 * S}
    busy={false}
    onPresentationChange={onPresentationChange}
    onSelectionChange={onSelectionChange}
    onClipboardChange={onClipboardChange}
    onDraft={onDraft}
    onCommit={onCommit}
    onSeek={vi.fn()}
    onNotice={onNotice}
    {...overrides}
  />)
  return { onCommit, onDraft, onSelectionChange, onClipboardChange, onPresentationChange, onNotice }
}

describe('T4 animation property lanes', () => {
  it('renders only animated properties by default and all truthful properties on request', () => {
    const { rerender } = render(<TimelineAnimationLanes
      subject={subject()}
      presentation={presentation}
      selection={EMPTY_EDITOR_KEYFRAME_SELECTION}
      clipboard={null}
      visibleRange={{ startTicks: 0, endTicks: 20 * S }}
      overscanTicks={S}
      pixelsPerSecond={100}
      timescale={S}
      playheadTicks={6 * S}
      frameTicks={S / 30}
      frameRate={{ numerator: 30, denominator: 1 }}
      compositionDurationTicks={20 * S}
      busy={false}
      onPresentationChange={() => undefined}
      onSelectionChange={() => undefined}
      onClipboardChange={() => undefined}
      onDraft={() => undefined}
      onCommit={() => undefined}
      onSeek={() => undefined}
      onNotice={() => undefined}
    />)
    expect(screen.getByRole('button', { name: 'Scale' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Rotation' })).not.toBeInTheDocument()
    rerender(<TimelineAnimationLanes
      subject={subject()}
      presentation={{ ...presentation, visibleMode: 'all' }}
      selection={EMPTY_EDITOR_KEYFRAME_SELECTION}
      clipboard={null}
      visibleRange={{ startTicks: 0, endTicks: 20 * S }}
      overscanTicks={S}
      pixelsPerSecond={100}
      timescale={S}
      playheadTicks={6 * S}
      frameTicks={S / 30}
      frameRate={{ numerator: 30, denominator: 1 }}
      compositionDurationTicks={20 * S}
      busy={false}
      onPresentationChange={() => undefined}
      onSelectionChange={() => undefined}
      onClipboardChange={() => undefined}
      onDraft={() => undefined}
      onCommit={() => undefined}
      onSeek={() => undefined}
      onNotice={() => undefined}
    />)
    expect(screen.getByRole('button', { name: 'Rotation' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Opacity' })).toBeInTheDocument()
  })

  it('creates keyframes through the planner and commits exactly once', () => {
    const empty = state([])
    const { onCommit } = renderLanes({
      subject: subject(empty),
      presentation: { ...presentation, visibleMode: 'all' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Add Keyframe at Playhead' }))
    expect(onCommit).toHaveBeenCalledTimes(1)
    const next = onCommit.mock.calls[0][0] as EditorAnimationTrackStateV1
    expect(next.tracks[0].property).toBe('scale')
    expect(next.tracks[0].keyframes.map((frame) => frame.at.ticks)).toEqual([0, S, 4 * S])
    expect(next.tracks[0].keyframes.map((frame) => frame.value)).toEqual([1, 1, 1])
  })

  it('selects a diamond without an edit and keyboard nudge creates one atomic commit', () => {
    const first = renderLanes()
    const diamond = screen.getByRole('button', { name: /Scale keyframe, 2880000 ticks/i })
    fireEvent.click(diamond)
    expect(first.onSelectionChange).toHaveBeenCalled()
    expect(first.onCommit).not.toHaveBeenCalled()

    const selected = Object.freeze({
      addresses: Object.freeze([Object.freeze({ target, property: 'scale' as const, canonicalAtTicks: 2 * S })]),
      anchor: Object.freeze({ target, property: 'scale' as const, canonicalAtTicks: 2 * S }),
    })
    first.onCommit.mockClear()
    cleanup()
    const second = renderLanes({ selection: selected })
    const selectedDiamond = screen.getByRole('button', { name: /Scale keyframe, 2880000 ticks/i })
    fireEvent.keyDown(selectedDiamond, { key: 'ArrowRight' })
    expect(second.onCommit).toHaveBeenCalledTimes(1)
    const next = second.onCommit.mock.calls[0][0] as EditorAnimationTrackStateV1
    expect(next.tracks[0].keyframes[1].at.ticks).toBe(2 * S + S / 30)
  })

  it('keeps pointer movement detached and commits once on release', () => {
    const selected = Object.freeze({
      addresses: Object.freeze([Object.freeze({ target, property: 'scale' as const, canonicalAtTicks: 2 * S })]),
      anchor: Object.freeze({ target, property: 'scale' as const, canonicalAtTicks: 2 * S }),
    })
    const callbacks = renderLanes({ selection: selected })
    const diamond = screen.getByRole('button', { name: /Scale keyframe, 2880000 ticks/i })
    fireEvent.pointerDown(diamond, { pointerId: 7, clientX: 200, clientY: 20 })
    fireEvent.pointerMove(diamond, { pointerId: 7, clientX: 240, clientY: 20 })
    expect(callbacks.onDraft).toHaveBeenCalled()
    expect(callbacks.onCommit).not.toHaveBeenCalled()
    fireEvent.pointerUp(diamond, { pointerId: 7, clientX: 240, clientY: 20 })
    expect(callbacks.onCommit).toHaveBeenCalledTimes(1)
  })

  it('copies a closed keyframe clipboard and refuses incompatible paste through disabled state', () => {
    const selected = Object.freeze({
      addresses: Object.freeze([Object.freeze({ target, property: 'scale' as const, canonicalAtTicks: 2 * S })]),
      anchor: Object.freeze({ target, property: 'scale' as const, canonicalAtTicks: 2 * S }),
    })
    const callbacks = renderLanes({ selection: selected })
    fireEvent.click(screen.getByRole('button', { name: 'Copy' }))
    expect(callbacks.onClipboardChange).toHaveBeenCalledTimes(1)
    const clipboard = callbacks.onClipboardChange.mock.calls[0][0] as EditorKeyframeClipboardV1
    expect(clipboard.schemaVersion).toBe('sanverse.editor-keyframe-clipboard/v1')
    expect(JSON.stringify(clipboard)).not.toMatch(/project|operation|motionId|file|url/i)
  })

  it('shows compact numeric editing for one selected keyframe and applies through one commit', () => {
    const selected = Object.freeze({
      addresses: Object.freeze([Object.freeze({ target, property: 'scale' as const, canonicalAtTicks: 2 * S })]),
      anchor: Object.freeze({ target, property: 'scale' as const, canonicalAtTicks: 2 * S }),
    })
    const callbacks = renderLanes({ selection: selected })
    const value = screen.getByLabelText('Scale keyframe value')
    fireEvent.change(value, { target: { value: '1.35' } })
    fireEvent.click(screen.getByRole('button', { name: 'Apply Keyframe' }))
    expect(callbacks.onCommit).toHaveBeenCalledTimes(1)
    const next = callbacks.onCommit.mock.calls[0][0] as EditorAnimationTrackStateV1
    expect(next.tracks[0].keyframes.find((frame) => frame.at.ticks === 2 * S)?.value).toBe(1.35)
  })
})
