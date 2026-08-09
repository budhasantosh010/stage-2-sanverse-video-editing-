import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import {
  DEFAULT_VISUAL_PROPERTIES,
  mediaTime,
  PROJECT_TIMESCALE,
  type EditorAnimationTrackStateV1,
  type EditorKeyframeSelectionV1,
} from '@sanverse/edit-domain'
import type { TimelineAnimationSubjectV1 } from '../../features/timeline'
import { InspectorSelectedKeyframe } from './InspectorSelectedKeyframe'

const S = PROJECT_TIMESCALE
const target = Object.freeze({ kind: 'visual-properties' as const, visualId: 'title_inspector_t4' })
const state: EditorAnimationTrackStateV1 = Object.freeze({
  targetKind: 'title',
  durationTicks: 4 * S,
  transform: DEFAULT_VISUAL_PROPERTIES.transform,
  crop: DEFAULT_VISUAL_PROPERTIES.crop,
  tracks: Object.freeze([Object.freeze({
    property: 'scale' as const,
    keyframes: Object.freeze([
      Object.freeze({ at: mediaTime(0), value: 1, easing: Object.freeze({ kind: 'linear' as const }) }),
      Object.freeze({ at: mediaTime(2 * S), value: 1.2, easing: Object.freeze({ kind: 'linear' as const }) }),
      Object.freeze({ at: mediaTime(4 * S), value: 1, easing: Object.freeze({ kind: 'linear' as const }) }),
    ]),
  })]),
})
const subject: TimelineAnimationSubjectV1 = Object.freeze({
  itemId: 'title_inspector_t4', laneId: 'overlay', label: 'Title', target, state,
  timeContext: Object.freeze({ kind: 'visual-properties' as const, compositionStartTicks: 0, durationTicks: 4 * S }),
  sourceAnchored: false,
})
const selection: EditorKeyframeSelectionV1 = Object.freeze({
  addresses: Object.freeze([Object.freeze({ target, property: 'scale' as const, canonicalAtTicks: 2 * S })]),
  anchor: Object.freeze({ target, property: 'scale' as const, canonicalAtTicks: 2 * S }),
})

describe('T4 Inspector keyframe synchronization', () => {
  it('shows the same selected keyframe and commits through the shared planner', () => {
    const onCommit = vi.fn()
    render(<InspectorSelectedKeyframe subject={subject} selection={selection} busy={false} onCommit={onCommit} onNotice={() => undefined} />)
    expect(screen.getByText('Selected keyframe')).toBeInTheDocument()
    expect(screen.getByText('Scale')).toBeInTheDocument()
    const value = screen.getByLabelText('Scale selected keyframe value')
    expect(value).toHaveValue(1.2)
    fireEvent.change(value, { target: { value: '1.45' } })
    fireEvent.click(screen.getByRole('button', { name: 'Apply selected keyframe' }))
    expect(onCommit).toHaveBeenCalledTimes(1)
    const next = onCommit.mock.calls[0][0] as EditorAnimationTrackStateV1
    expect(next.tracks[0].keyframes[1].value).toBe(1.45)
    expect(next.transform).toEqual(state.transform)
    expect(next.crop).toEqual(state.crop)
  })

  it('renders nothing for multi-selection so Inspector never invents an ambiguous value', () => {
    const multi: EditorKeyframeSelectionV1 = Object.freeze({
      addresses: Object.freeze([
        Object.freeze({ target, property: 'scale' as const, canonicalAtTicks: 0 }),
        Object.freeze({ target, property: 'scale' as const, canonicalAtTicks: 2 * S }),
      ]),
      anchor: Object.freeze({ target, property: 'scale' as const, canonicalAtTicks: 0 }),
    })
    const { container } = render(<InspectorSelectedKeyframe subject={subject} selection={multi} busy={false} onCommit={() => undefined} onNotice={() => undefined} />)
    expect(container).toBeEmptyDOMElement()
  })
})
