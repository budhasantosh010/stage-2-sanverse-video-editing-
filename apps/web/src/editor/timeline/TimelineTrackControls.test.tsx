import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'

import { buildTimelineViewModel } from '../../features/timeline'
import { projectWithAllTimelineFamilies } from '../../features/timeline/timeline-test-fixtures'
import { Timeline } from './Timeline'

/**
 * Gate C1.5, C1.6, C1.7, C1.8 — the toolbar and the two track switches.
 *
 * The thing being proved here is that nothing on screen lies: no button that
 * looks available and does nothing, no greyed-out control with no reason, and
 * no padlock that quietly changes the video.
 */

const ALL_ON = Object.freeze({ V2: true, V1: true, C1: true, A1: true, A2: true })

afterEach(cleanup)

const renderTimeline = (overrides: Record<string, unknown> = {}) => {
  const model = buildTimelineViewModel({
    project: projectWithAllTimelineFamilies(),
    selectedItemId: null,
    pending: null,
  })
  const props = {
    model,
    playheadTicks: 0,
    viewport: { pixelsPerSecond: 100, scrollLeftPx: 0, viewportWidthPx: 600 },
    selectedItemId: null,
    busy: false,
    trimAmountTicks: 1_440_000,
    gainDb: 0,
    fadeInTicks: 0,
    fadeOutTicks: 0,
    advancedControls: <button type="button">Legacy fallback</button>,
    lockedTrackIds: [] as readonly string[],
    trackOutputs: ALL_ON,
    placementMode: 'normal' as const,
    snappingEnabled: true,
    onToggleTrackLock: vi.fn(),
    onToggleTrackOutput: vi.fn(),
    onPlacementMode: vi.fn(),
    onToggleSnapping: vi.fn(),
    onItemAction: vi.fn(),
    onViewportChange: vi.fn(),
    onSeek: vi.fn(),
    onSelect: vi.fn(),
    onGesture: vi.fn(),
    onOpenProposal: vi.fn(),
    ...overrides,
  }
  const rendered = render(<Timeline {...(props as unknown as Parameters<typeof Timeline>[0])} />)
  return { container: rendered.container, props }
}

describe('the Timeline toolbar', () => {
  it('offers only actions that do something, and no placeholder', () => {
    renderTimeline()
    const timeline = screen.getByRole('region', { name: 'Project timeline' })
    for (const label of ['Split', 'Ripple delete', 'Normal', 'Insert', 'Overwrite', 'Append', 'Snapping']) {
      expect(within(timeline).getByRole('button', { name: new RegExp(label, 'i') })).toBeInTheDocument()
    }
    // Delete is matched by its own marker rather than by name, because
    // "Ripple delete" contains the word too.
    expect(timeline.querySelector('[data-timeline-action="lift"]')).toBeInTheDocument()
  })

  it('says WHY an action cannot be used, rather than greying it out in silence', () => {
    renderTimeline()
    const split = screen.getByRole('button', { name: /Split — Choose something on the timeline first/i })
    expect(split).toBeDisabled()
    expect(split).toHaveAttribute('title', expect.stringContaining('Choose something'))
  })

  it('names the locked track in the reason, so the user knows which padlock to open', () => {
    const model = buildTimelineViewModel({
      project: projectWithAllTimelineFamilies(),
      selectedItemId: null,
      pending: null,
    })
    const clip = model.lanes.flatMap((lane) => lane.items).find((item) => item.kind === 'clip')
    const selectedItemId = clip?.id ?? null
    renderTimeline({
      selectedItemId,
      model: buildTimelineViewModel({
        project: projectWithAllTimelineFamilies(),
        selectedItemId,
        pending: null,
      }),
      lockedTrackIds: ['V1'],
    })
    const lift = document.querySelector('[data-timeline-action="lift"]')
    expect(lift).toBeDisabled()
    expect(lift).toHaveAttribute('aria-label', expect.stringContaining('V1 is locked'))
  })

  it('shows which placement mode is chosen without relying on colour', () => {
    renderTimeline({ placementMode: 'insert' })
    expect(screen.getByRole('button', { name: 'Insert' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: 'Normal' })).toHaveAttribute('aria-pressed', 'false')
  })

  it('never lets a mode be chosen that would quietly behave like another', () => {
    const { props } = renderTimeline()
    fireEvent.click(screen.getByRole('button', { name: 'Overwrite' }))
    // The mode is reported upwards; the planner decides what Overwrite means
    // and refuses when it cannot do it. Nothing is silently downgraded here.
    expect(props.onPlacementMode).toHaveBeenCalledWith('overwrite')
  })
})

describe('the two track switches', () => {
  it('gives every track a padlock and an output switch', () => {
    renderTimeline()
    for (const track of ['V2', 'V1', 'C1', 'A1', 'A2']) {
      expect(screen.getByRole('button', { name: new RegExp(`Lock ${track}`, 'i') })).toBeInTheDocument()
    }
    expect(screen.getByRole('button', { name: /Hide V1/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Mute A1/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Mute A2/i })).toBeInTheDocument()
  })

  it('says out loud that a padlock does not change the video', () => {
    // This is the whole reason lock and output are two switches. A user who
    // believed a padlock removed the track would export something wrong.
    renderTimeline()
    expect(screen.getByRole('button', { name: /Lock V2/i }))
      .toHaveAttribute('aria-label', expect.stringContaining('never changes your video'))
  })

  it('says out loud that the output switch DOES change the video', () => {
    renderTimeline()
    expect(screen.getByRole('button', { name: /Mute A2/i }))
      .toHaveAttribute('title', expect.stringContaining('changes what you export'))
  })

  it('reports a lock and an output change through two different callbacks', () => {
    const { props } = renderTimeline()
    fireEvent.click(screen.getByRole('button', { name: /Lock A2/i }))
    expect(props.onToggleTrackLock).toHaveBeenCalledWith('A2')
    expect(props.onToggleTrackOutput).not.toHaveBeenCalled()

    fireEvent.click(screen.getByRole('button', { name: /Mute A2/i }))
    expect(props.onToggleTrackOutput).toHaveBeenCalledWith('A2')
  })

  it('marks a locked track and a hidden track in the header, not by colour alone', () => {
    const { container } = renderTimeline({
      lockedTrackIds: ['V2'],
      trackOutputs: { ...ALL_ON, A2: false },
    })
    expect(container.querySelector('[data-track-id="V2"]')).toHaveAttribute('data-track-locked', 'yes')
    expect(container.querySelector('[data-track-id="A2"]')).toHaveAttribute('data-track-output', 'off')
    // A locked track stays fully visible: locking is not hiding.
    expect(container.querySelector('[data-track-id="V2"]')).toHaveAttribute('data-track-output', 'on')
  })

  it('offers the padlock even while edits are paused, because it is not an edit', () => {
    renderTimeline({ busy: true })
    expect(screen.getByRole('button', { name: /Lock V1/i })).not.toBeDisabled()
    expect(screen.getByRole('button', { name: /Hide V1/i })).toBeDisabled()
  })
})
