import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import {
  DEFAULT_VISUAL_PROPERTIES,
  mediaTime,
  PROJECT_TIMESCALE,
  type EditorAnimationTrackStateV1,
  type EditorKeyframeSelectionV1,
  type VisualPropertyTrack,
} from '@sanverse/edit-domain'
import {
  DEFAULT_TIMELINE_ANIMATION_PRESENTATION,
  type TimelineAnimationSubjectV1,
} from '../../features/timeline'
import { TimelinePropertyGraphView } from './TimelinePropertyGraphView'

const S = PROJECT_TIMESCALE
const target = Object.freeze({ kind: 'visual-properties' as const, visualId: 'title_graph01' })
const track: VisualPropertyTrack = Object.freeze({
  property: 'scale',
  keyframes: Object.freeze([
    Object.freeze({ at: mediaTime(0), value: 1, easing: Object.freeze({ kind: 'linear' as const }) }),
    Object.freeze({ at: mediaTime(2 * S), value: 1.4, easing: Object.freeze({ kind: 'cubic-bezier' as const, x1: 0.25, y1: 0.1, x2: 0.25, y2: 1 }) }),
    Object.freeze({ at: mediaTime(4 * S), value: 1, easing: Object.freeze({ kind: 'linear' as const }) }),
  ]),
})
const state: EditorAnimationTrackStateV1 = Object.freeze({
  targetKind: 'title',
  durationTicks: 4 * S,
  transform: DEFAULT_VISUAL_PROPERTIES.transform,
  crop: DEFAULT_VISUAL_PROPERTIES.crop,
  tracks: Object.freeze([track]),
})
const subject: TimelineAnimationSubjectV1 = Object.freeze({
  itemId: 'title_graph01',
  laneId: 'overlay',
  label: 'Graph title',
  target,
  state,
  timeContext: Object.freeze({ kind: 'visual-properties' as const, compositionStartTicks: 0, durationTicks: 4 * S }),
  sourceAnchored: false,
})
const selected: EditorKeyframeSelectionV1 = Object.freeze({
  addresses: Object.freeze([Object.freeze({ target, property: 'scale' as const, canonicalAtTicks: 0 })]),
  anchor: Object.freeze({ target, property: 'scale' as const, canonicalAtTicks: 0 }),
})
const presentation = Object.freeze({
  ...DEFAULT_TIMELINE_ANIMATION_PRESENTATION,
  graphOpen: true,
  activeProperty: 'scale' as const,
})

const renderGraph = (overrides: Partial<React.ComponentProps<typeof TimelinePropertyGraphView>> = {}) => {
  const onPresentationChange = vi.fn()
  const onSelectionChange = vi.fn()
  const onDraft = vi.fn()
  const onCommit = vi.fn()
  const onNotice = vi.fn()
  render(<TimelinePropertyGraphView
    subject={subject}
    presentation={presentation}
    selection={selected}
    busy={false}
    onPresentationChange={onPresentationChange}
    onSelectionChange={onSelectionChange}
    onDraft={onDraft}
    onCommit={onCommit}
    onNotice={onNotice}
    {...overrides}
  />)
  return { onPresentationChange, onSelectionChange, onDraft, onCommit, onNotice }
}

describe('EditorPropertyGraphView', () => {
  it('opens as a Timeline-local graph with one active property and bounded shared-evaluator sampling', () => {
    renderGraph()
    expect(screen.getByRole('region', { name: 'Editor property graph' })).toHaveAttribute('data-graph-samples')
    expect(screen.getByLabelText('Graph property')).toHaveValue('scale')
    expect(screen.getByRole('img', { name: 'Scale animation curve' })).toBeInTheDocument()
    const samples = Number(screen.getByRole('region', { name: 'Editor property graph' }).getAttribute('data-graph-samples'))
    expect(samples).toBeGreaterThan(0)
    expect(samples).toBeLessThanOrEqual(640)
  })

  it('changes graph viewport presentation without creating an accepted edit', () => {
    const callbacks = renderGraph()
    fireEvent.click(screen.getByRole('button', { name: 'Fit All' }))
    fireEvent.change(screen.getByLabelText('Graph horizontal zoom'), { target: { value: '2' } })
    fireEvent.change(screen.getByLabelText('Graph vertical zoom'), { target: { value: '1.5' } })
    expect(callbacks.onPresentationChange).toHaveBeenCalledTimes(3)
    expect(callbacks.onCommit).not.toHaveBeenCalled()
  })

  it('uses the existing easing planner and one full-state commit', () => {
    const callbacks = renderGraph()
    fireEvent.click(screen.getByRole('button', { name: 'Ease Out' }))
    expect(callbacks.onCommit).toHaveBeenCalledTimes(1)
    const next = callbacks.onCommit.mock.calls[0][0] as EditorAnimationTrackStateV1
    expect(next.tracks[0].keyframes[0].easing).toEqual({ kind: 'cubic-bezier', x1: 0, y1: 0, x2: 0.58, y2: 1 })
  })

  it('uses the one shared keyframe selection without creating an edit on selection', () => {
    const callbacks = renderGraph()
    const point = screen.getByRole('button', { name: 'Scale keyframe at 0 ticks' })
    fireEvent.click(point)
    expect(callbacks.onSelectionChange).toHaveBeenCalledTimes(1)
    expect(callbacks.onDraft).not.toHaveBeenCalled()
    expect(callbacks.onCommit).not.toHaveBeenCalled()
  })

  it('disables outgoing interpolation on the final keyframe', () => {
    const finalSelection: EditorKeyframeSelectionV1 = Object.freeze({
      addresses: Object.freeze([Object.freeze({ target, property: 'scale' as const, canonicalAtTicks: 4 * S })]),
      anchor: Object.freeze({ target, property: 'scale' as const, canonicalAtTicks: 4 * S }),
    })
    renderGraph({ selection: finalSelection })
    expect(screen.getByRole('button', { name: 'Linear' })).toBeDisabled()
    expect(screen.getByText(/Final keyframe has no outgoing interpolation/)).toBeInTheDocument()
  })
})
