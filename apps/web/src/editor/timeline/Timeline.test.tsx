import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import {
  DEFAULT_KEYMAP,
  DEFAULT_TRACK_PRESENTATION,
  buildTimelineViewModel,
  type TimelineGesture,
  type TimelineSelectionV2,
  type TimelineViewportState,
} from '../../features/timeline'
import {
  createIds,
  largeTimelineProject,
  nameplate,
  projectWithAllTimelineFamilies,
  ticks,
} from '../../features/timeline/timeline-test-fixtures'
import { Timeline } from './Timeline'

afterEach(cleanup)

const viewport = (overrides: Partial<TimelineViewportState> = {}): TimelineViewportState => Object.freeze({
  pixelsPerSecond: 100,
  scrollLeftPx: 0,
  viewportWidthPx: 600,
  ...overrides,
})

const renderTimeline = (input: Readonly<{
  model?: ReturnType<typeof buildTimelineViewModel>
  selectedItemId?: string | null
  playheadTicks?: number
  currentViewport?: TimelineViewportState
  onViewportChange?: (value: TimelineViewportState) => void
  onSeek?: (value: number) => void
  onSelect?: (value: TimelineSelectionV2) => void
  onGesture?: (value: TimelineGesture) => void
  onOpenProposal?: () => void
  lockedTrackIds?: readonly string[]
  trackOutputs?: Readonly<Record<'V2' | 'V1' | 'C1' | 'A1' | 'A2', boolean>>
  onToggleTrackLock?: (trackId: string) => void
  onToggleTrackOutput?: (trackId: string) => void
  onPlacementMode?: (mode: string) => void
  onToggleSnapping?: () => void
  onItemAction?: (itemId: string, action: unknown) => void
  onMultiGesture?: (gesture: unknown) => void
  onAction?: (action: unknown) => void
}> = {}) => {
  const selectedIds = input.selectedItemId ? [input.selectedItemId] : []
  const model = input.model ?? buildTimelineViewModel({
    project: projectWithAllTimelineFamilies(),
    selectedItemIds: selectedIds,
    pending: null,
  })
  const props = {
    model,
    playheadTicks: input.playheadTicks ?? 0,
    viewport: input.currentViewport ?? viewport(),
    selection: {
      itemIds: selectedIds,
      anchorItemId: input.selectedItemId ?? null,
    },
    groups: [],
    markers: [],
    selectedMarkerId: null,
    trackPresentation: DEFAULT_TRACK_PRESENTATION,
    keymap: DEFAULT_KEYMAP,
    clipboardHasContent: false,
    busy: false,
    trimAmountTicks: ticks(1),
    gainDb: 0,
    fadeInTicks: 0,
    fadeOutTicks: 0,
    advancedControls: <button type="button">Legacy fallback</button>,
    lockedTrackIds: input.lockedTrackIds ?? [],
    trackOutputs: input.trackOutputs ?? { V2: true, V1: true, C1: true, A1: true, A2: true },
    placementMode: 'normal' as const,
    snappingEnabled: true,
    onToggleTrackLock: input.onToggleTrackLock ?? vi.fn(),
    onToggleTrackOutput: input.onToggleTrackOutput ?? vi.fn(),
    onPlacementMode: input.onPlacementMode ?? vi.fn(),
    onToggleSnapping: input.onToggleSnapping ?? vi.fn(),
    onItemAction: input.onItemAction ?? vi.fn(),
    onViewportChange: input.onViewportChange ?? vi.fn(),
    onSeek: input.onSeek ?? vi.fn(),
    onSelectionChange: input.onSelect ?? vi.fn(),
    onMultiGesture: input.onMultiGesture ?? vi.fn(),
    onAction: input.onAction ?? vi.fn(),
    speedSubject: null,
    onSpeedPreview: () => '',
    onSpeedChoose: vi.fn(),
    onSelectMarker: vi.fn(),
    onMoveMarker: vi.fn(),
    onDeleteMarker: vi.fn(),
    onEditMarker: vi.fn(),
    onTrackPresentationChange: vi.fn(),
    onGesture: input.onGesture ?? vi.fn(),
    onOpenProposal: input.onOpenProposal ?? vi.fn(),
  }
  return { ...render(<Timeline {...props} />), props }
}

describe('Timeline V1', () => {
  it('renders the five semantic lanes and truthful committed families from the P1-A model', () => {
    renderTimeline()

    const timeline = screen.getByRole('region', { name: 'Project timeline' })
    expect(within(timeline).getByRole('group', { name: /V2 overlay lane/i })).toBeInTheDocument()
    expect(within(timeline).getByRole('group', { name: /V1 video lane/i })).toBeInTheDocument()
    expect(within(timeline).getByRole('group', { name: /C1 caption lane/i })).toBeInTheDocument()
    expect(within(timeline).getByRole('group', { name: /A1 dialogue lane/i })).toBeInTheDocument()
    expect(within(timeline).getByRole('group', { name: /A2 music lane/i })).toBeInTheDocument()
    expect(within(timeline).getByRole('button', { name: /title/i })).toHaveAttribute('data-lane-kind', 'overlay')
    expect(within(timeline).getByRole('button', { name: /dialogue/i })).toHaveAttribute('data-lane-kind', 'dialogue')
    expect(within(timeline).getByRole('button', { name: /music/i })).toHaveAttribute('data-lane-kind', 'music')
  })

  it('uses one canonical ruler click to request a composition-time seek', () => {
    const onSeek = vi.fn()
    const { container } = renderTimeline({ onSeek })
    const viewportElement = container.querySelector<HTMLElement>('[data-timeline-viewport]')
    if (!viewportElement) throw new Error('timeline viewport missing')
    vi.spyOn(viewportElement, 'getBoundingClientRect').mockReturnValue({
      x: 100, y: 0, left: 100, top: 0, right: 700, bottom: 300, width: 600, height: 300,
      toJSON: () => ({}),
    })

    fireEvent.click(screen.getByTestId('timeline-ruler'), { clientX: 350 })

    expect(onSeek).toHaveBeenCalledWith(ticks(2.5))
  })

  it('selects an item, seeks to it, and emits a semantic split gesture from the keyboard', () => {
    const base = projectWithAllTimelineFamilies()
    const firstClipId = base.composition.tracks[0].clips[0].clipId
    const selectedItemId = `clip:${firstClipId}`
    const model = buildTimelineViewModel({ project: base, selectedItemIds: selectedItemId === null ? [] : [selectedItemId], pending: null })
    const onGesture = vi.fn()
    const onSeek = vi.fn()
    const onSelect = vi.fn()
    renderTimeline({ model, selectedItemId, playheadTicks: ticks(5), onGesture, onSeek, onSelect })

    const clip = screen.getByRole('button', { name: /clip, video/i })
    fireEvent.click(clip, { clientX: 200 })
    /*
     * Selection is a LIST now, not one name — and clicking a piece of the main
     * video also picks the sound that was recorded WITH it. Nobody chose that
     * link; it is a fact about the recording. Leaving the sound behind would let
     * somebody silence themselves without ever being told.
     */
    expect(onSelect).toHaveBeenCalledWith(
      expect.objectContaining({ anchorItemId: selectedItemId }),
    )
    const picked = onSelect.mock.calls[0][0] as { itemIds: readonly string[] }
    expect(picked.itemIds).toContain(selectedItemId)
    expect(onSeek).toHaveBeenCalled()

    // Split moved from plain `S` to Ctrl+B, because `S` now toggles snapping
    // and one key with two meanings makes a user distrust their own hands.
    fireEvent.keyDown(screen.getByRole('region', { name: 'Project timeline' }), { key: 'b', ctrlKey: true })
    expect(onGesture).toHaveBeenCalledWith({ type: 'split', atTicks: ticks(5) })
  })

  it('leaves plain S for snapping, and never splits with it', () => {
    const base = projectWithAllTimelineFamilies()
    const firstClipId = base.composition.tracks[0].clips[0].clipId
    const selectedItemId = `clip:${firstClipId}`
    const model = buildTimelineViewModel({ project: base, selectedItemIds: selectedItemId === null ? [] : [selectedItemId], pending: null })
    const onGesture = vi.fn()
    const onToggleSnapping = vi.fn()
    renderTimeline({ model, selectedItemId, playheadTicks: ticks(5), onGesture, onToggleSnapping })

    fireEvent.keyDown(screen.getByRole('region', { name: 'Project timeline' }), { key: 's' })
    expect(onToggleSnapping).toHaveBeenCalledOnce()
    expect(onGesture).not.toHaveBeenCalled()
  })

  it('deletes with Delete and closes the gap with Shift+Delete, as two distinct actions', () => {
    // The old design focused a confirmation button because "remove" and
    // "remove and close the gap" were one control with two outcomes. They are
    // now two keys and two toolbar buttons, so there is nothing left to confirm
    // — and every delete here is one Undo away from being back.
    const base = projectWithAllTimelineFamilies()
    const firstClipId = base.composition.tracks[0].clips[0].clipId
    const selectedItemId = `clip:${firstClipId}`
    const model = buildTimelineViewModel({ project: base, selectedItemIds: selectedItemId === null ? [] : [selectedItemId], pending: null })
    const onGesture = vi.fn()
    const onSelect = vi.fn()
    renderTimeline({ model, selectedItemId, playheadTicks: ticks(5), onGesture, onSelect })

    const timeline = screen.getByRole('region', { name: 'Project timeline' })
    fireEvent.keyDown(timeline, { key: 'Delete' })
    expect(onGesture).toHaveBeenCalledWith(expect.objectContaining({ type: 'remove-gap' }))

    onGesture.mockClear()
    fireEvent.keyDown(timeline, { key: 'Delete', shiftKey: true })
    expect(onGesture).toHaveBeenCalledWith(expect.objectContaining({ type: 'remove-ripple' }))

    fireEvent.keyDown(timeline, { key: 'Escape' })
    expect(onSelect).toHaveBeenCalledWith(expect.objectContaining({ itemIds: [] }))
  })

  it('moves the playhead by one tenth of a second from the keyboard', () => {
    const onSeek = vi.fn()
    renderTimeline({ playheadTicks: ticks(5), onSeek })

    fireEvent.keyDown(screen.getByRole('slider', { name: 'Timeline playhead' }), { key: 'ArrowRight' })

    expect(onSeek).toHaveBeenCalledWith(ticks(5.1))
  })

  it('opens a real right-click context menu and emits the same semantic gesture path', () => {
    const base = projectWithAllTimelineFamilies()
    const firstClipId = base.composition.tracks[0].clips[0].clipId
    const onGesture = vi.fn()
    const onSelect = vi.fn()
    renderTimeline({ onGesture, onSelect, playheadTicks: ticks(5) })

    const clip = screen.getByRole('button', { name: /clip, video/i })
    fireEvent.contextMenu(clip, { clientX: 300, clientY: 220 })

    expect(onSelect).toHaveBeenCalledWith(
      expect.objectContaining({ anchorItemId: `clip:${firstClipId}` }),
    )
    const menu = screen.getByRole('menu', { name: /timeline actions/i })
    expect(within(menu).getByRole('menuitem', { name: /remove \+ close gap/i })).toBeInTheDocument()
    fireEvent.click(within(menu).getByRole('menuitem', { name: /hide section/i }))
    expect(onGesture).toHaveBeenCalledWith({ type: 'set-enabled', clipId: firstClipId, enabled: false })
    expect(screen.queryByRole('menu')).not.toBeInTheDocument()
  })

  it('opens the same context menu from Shift+F10 for keyboard users', () => {
    renderTimeline()
    const clip = screen.getByRole('button', { name: /clip, video/i })
    fireEvent.keyDown(clip, { key: 'F10', shiftKey: true })

    expect(screen.getByRole('menu', { name: /timeline actions/i })).toBeInTheDocument()
    expect(screen.getByRole('menuitem', { name: /go to item/i })).toHaveFocus()
  })

  it('shows a detached proposal ghost without adding it to committed history', () => {
    const project = projectWithAllTimelineFamilies()
    const operation = nameplate(createIds(500).operation(), 4, 2, 'Pending founder')
    const model = buildTimelineViewModel({
      project,
      selectedItemIds: [],
      pending: {
        proposalId: 'proposal_pending_founder',
        baseRevision: project.revision,
        operations: [operation],
      },
    })
    const onOpenProposal = vi.fn()
    renderTimeline({ model, onOpenProposal })

    const ghost = screen.getByRole('button', { name: /pending founder.*proposed/i })
    expect(ghost).toHaveAttribute('data-state', 'proposed')
    fireEvent.click(ghost)
    expect(onOpenProposal).toHaveBeenCalledOnce()
  })

  it('renders only visible and overscanned items for the representative 171-item project', () => {
    const project = largeTimelineProject()
    const model = buildTimelineViewModel({ project, selectedItemIds: [], pending: null })
    const totalItems = model.lanes.reduce((count, lane) => count + lane.items.length, 0)
    renderTimeline({ model, currentViewport: viewport({ viewportWidthPx: 600, pixelsPerSecond: 100 }) })

    const renderedItems = screen.getAllByTestId('timeline-item')
    expect(totalItems).toBeGreaterThan(150)
    expect(renderedItems.length).toBeGreaterThan(0)
    expect(renderedItems.length).toBeLessThan(totalItems / 2)
  })

  it('keeps zoom and fit as presentation-state requests, never project edits', () => {
    const onViewportChange = vi.fn()
    const onGesture = vi.fn()
    renderTimeline({ onViewportChange, onGesture })
    onViewportChange.mockClear()

    fireEvent.click(screen.getByRole('button', { name: 'Zoom Timeline in' }))
    fireEvent.click(screen.getByRole('button', { name: 'Fit Timeline horizontally' }))

    expect(onViewportChange).toHaveBeenCalledTimes(2)
    expect(onGesture).not.toHaveBeenCalled()
  })
})
