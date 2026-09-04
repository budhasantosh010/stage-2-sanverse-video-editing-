import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import {
  DEFAULT_KEYMAP,
  DEFAULT_TRACK_PRESENTATION,
  buildTimelineViewModel,
  type PrecisionTrimPlan,
  type PrecisionTrimRequestV1,
  type TimelineGesture,
  type TimelineSelectionV2,
  type TimelineViewportState,
} from '../../features/timeline'
import {
  createIds,
  largeTimelineProject,
  nameplate,
  projectWithAllTimelineFamilies,
  splitProject,
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
  selection?: TimelineSelectionV2
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
  onPrecisionPreview?: (request: PrecisionTrimRequestV1) => PrecisionTrimPlan
  onPrecisionCommit?: (plan: Extract<PrecisionTrimPlan, { ok: true }>) => void
  shuttleState?: Readonly<{ direction: -1 | 0 | 1; rate: 0 | 1 | 2 | 4 | 8 }>
  onShuttleKey?: (key: 'J' | 'K' | 'L') => void
  freezeClipLabel?: string | null
  freezeUnavailableReason?: string | null
  onFreezeApply?: (durationTicks: number) => void
}> = {}) => {
  const selection = input.selection ?? {
    itemIds: input.selectedItemId ? [input.selectedItemId] : [],
    anchorItemId: input.selectedItemId ?? null,
  }
  const selectedIds = selection.itemIds
  const model = input.model ?? buildTimelineViewModel({
    project: projectWithAllTimelineFamilies(),
    selectedItemIds: selectedIds,
    pending: null,
  })
  const props = {
    model,
    playheadTicks: input.playheadTicks ?? 0,
    viewport: input.currentViewport ?? viewport(),
    selection,
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
    freezeClipLabel: input.freezeClipLabel ?? null,
    freezeUnavailableReason: input.freezeUnavailableReason ?? null,
    onFreezeApply: input.onFreezeApply ?? vi.fn(),
    onSpeedPreview: () => '',
    onSpeedChoose: vi.fn(),
    onPrecisionPreview: input.onPrecisionPreview,
    onPrecisionCommit: input.onPrecisionCommit,
    shuttleState: input.shuttleState,
    onShuttleKey: input.onShuttleKey,
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

  it('selects a main-video clip on pointer down so a loading filmstrip cannot swallow the first click', () => {
    const base = projectWithAllTimelineFamilies()
    const firstClipId = base.composition.tracks[0].clips[0].clipId
    const selectedItemId = `clip:${firstClipId}`
    const model = buildTimelineViewModel({ project: base, selectedItemIds: [], pending: null })
    const onSelect = vi.fn()
    renderTimeline({ model, onSelect })

    const pointerDown = new Event('pointerdown', { bubbles: true, cancelable: true })
    Object.defineProperties(pointerDown, {
      button: { configurable: true, value: 0 },
      pointerId: { configurable: true, value: 7 },
      clientX: { configurable: true, value: 200 },
      ctrlKey: { configurable: true, value: false },
      metaKey: { configurable: true, value: false },
      shiftKey: { configurable: true, value: false },
    })
    fireEvent(screen.getByRole('button', { name: /clip, video/i }), pointerDown)

    expect(onSelect).toHaveBeenCalledWith(
      expect.objectContaining({ anchorItemId: selectedItemId }),
    )
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

  it('routes the enabled Razor tool through the exact same split authority as the keyboard', () => {
    const base = projectWithAllTimelineFamilies()
    const firstClipId = base.composition.tracks[0].clips[0].clipId
    const selectedItemId = `clip:${firstClipId}`
    const model = buildTimelineViewModel({ project: base, selectedItemIds: [selectedItemId], pending: null })
    const onGesture = vi.fn()
    const onSelect = vi.fn()
    const { container } = renderTimeline({ model, selectedItemId, onGesture, onSelect })
    const viewportElement = container.querySelector<HTMLElement>('[data-timeline-viewport]')
    if (!viewportElement) throw new Error('timeline viewport missing')
    vi.spyOn(viewportElement, 'getBoundingClientRect').mockReturnValue({
      x: 0, y: 0, left: 0, top: 0, right: 600, bottom: 300, width: 600, height: 300,
      toJSON: () => ({}),
    })

    fireEvent.click(screen.getByRole('radio', { name: /^Razor\./ }))
    const clip = screen.getByRole('button', { name: /clip, video/i })
    fireEvent.click(clip, { clientX: 500 })

    expect(onSelect).toHaveBeenCalledWith(expect.objectContaining({ anchorItemId: selectedItemId }))
    expect(onGesture).toHaveBeenCalledWith({ type: 'split', atTicks: ticks(5) })
  })

  it('uses Escape first to return a special tool to Select without throwing away selection', () => {
    const base = projectWithAllTimelineFamilies()
    const firstClipId = base.composition.tracks[0].clips[0].clipId
    const selectedItemId = `clip:${firstClipId}`
    const model = buildTimelineViewModel({ project: base, selectedItemIds: [selectedItemId], pending: null })
    const onSelect = vi.fn()
    renderTimeline({ model, selectedItemId, onSelect })
    const timeline = screen.getByRole('region', { name: 'Project timeline' })

    fireEvent.click(screen.getByRole('radio', { name: /^Razor\./ }))
    expect(screen.getByRole('radio', { name: /^Razor\./ })).toBeChecked()
    fireEvent.keyDown(timeline, { key: 'Escape' })

    expect(screen.getByRole('radio', { name: /^Select\./ })).toBeChecked()
    expect(onSelect).not.toHaveBeenCalledWith(expect.objectContaining({ itemIds: [] }))
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

  it('deletes one footage section when its automatically linked dialogue is also selected', () => {
    const project = projectWithAllTimelineFamilies()
    const unselected = buildTimelineViewModel({ project, selectedItemIds: [], pending: null })
    const video = unselected.lanes.find((lane) => lane.kind === 'video')?.items.find((item) => item.kind === 'clip')
    const dialogue = unselected.lanes.find((lane) => lane.kind === 'dialogue')?.items.find((item) => item.linkedClipId === video?.clipId)
    if (!video || !dialogue) throw new Error('linked footage fixture missing')
    const selection: TimelineSelectionV2 = Object.freeze({
      itemIds: Object.freeze([video.id, dialogue.id]),
      anchorItemId: video.id,
    })
    const model = buildTimelineViewModel({ project, selectedItemIds: selection.itemIds, pending: null })
    const onGesture = vi.fn()
    const onAction = vi.fn()
    renderTimeline({ model, selection, onGesture, onAction, playheadTicks: ticks(5) })

    fireEvent.click(screen.getByRole('button', { name: /^Delete$/ }))

    expect(onGesture).toHaveBeenCalledWith(expect.objectContaining({ type: 'remove-gap' }))
    expect(onAction).not.toHaveBeenCalledWith('lift')
  })

  it('disables impossible clip reorders instead of exposing dead enabled controls', () => {
    const project = splitProject(projectWithAllTimelineFamilies(), 10, createIds(100))
    const unselectedModel = buildTimelineViewModel({ project, selectedItemIds: [], pending: null })
    const videoItems = unselectedModel.lanes
      .find((lane) => lane.kind === 'video')
      ?.items.filter((item) => item.kind === 'clip') ?? []
    expect(videoItems).toHaveLength(2)

    const firstId = videoItems[0].id
    const firstModel = buildTimelineViewModel({ project, selectedItemIds: [firstId], pending: null })
    const first = renderTimeline({ model: firstModel, selectedItemId: firstId })
    expect(screen.getByRole('button', { name: 'Move earlier' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Move earlier' })).toHaveAttribute(
      'title',
      'This is already the first section.',
    )
    expect(screen.getByRole('button', { name: 'Move later' })).toBeEnabled()
    first.unmount()

    const lastId = videoItems[1].id
    const lastModel = buildTimelineViewModel({ project, selectedItemIds: [lastId], pending: null })
    renderTimeline({ model: lastModel, selectedItemId: lastId })
    expect(screen.getByRole('button', { name: 'Move earlier' })).toBeEnabled()
    expect(screen.getByRole('button', { name: 'Move later' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Move later' })).toHaveAttribute(
      'title',
      'This is already the last section.',
    )
  })

  it('reorders primary footage by dragging it across another section', () => {
    const project = splitProject(projectWithAllTimelineFamilies(), 10, createIds(300))
    const unselectedModel = buildTimelineViewModel({ project, selectedItemIds: [], pending: null })
    const videoItems = unselectedModel.lanes
      .find((lane) => lane.kind === 'video')
      ?.items.filter((item) => item.kind === 'clip') ?? []
    const first = videoItems[0]
    if (!first?.clipId) throw new Error('first primary clip fixture missing')
    const onGesture = vi.fn()
    const { container } = renderTimeline({ model: unselectedModel, onGesture })
    const viewportElement = container.querySelector<HTMLElement>('[data-timeline-viewport]')
    if (!viewportElement) throw new Error('timeline viewport missing')
    vi.spyOn(viewportElement, 'getBoundingClientRect').mockReturnValue({
      x: 0, y: 0, left: 0, top: 0, right: 600, bottom: 300, width: 600, height: 300,
      toJSON: () => ({}),
    })
    const clip = screen.getAllByRole('button', { name: /clip, video/i })[0]
    Object.defineProperties(clip, {
      setPointerCapture: { configurable: true, value: vi.fn() },
      hasPointerCapture: { configurable: true, value: () => true },
      releasePointerCapture: { configurable: true, value: vi.fn() },
    })
    const pointer = (type: string, clientX: number) => {
      const event = new Event(type, { bubbles: true, cancelable: true })
      Object.defineProperties(event, {
        button: { configurable: true, value: 0 },
        pointerId: { configurable: true, value: 11 },
        clientX: { configurable: true, value: clientX },
        ctrlKey: { configurable: true, value: false },
        metaKey: { configurable: true, value: false },
        shiftKey: { configurable: true, value: false },
      })
      fireEvent(clip, event)
    }

    pointer('pointerdown', 200)
    pointer('pointermove', 2_500)
    pointer('pointerup', 2_500)

    expect(onGesture).toHaveBeenCalledWith({
      type: 'move-to-index',
      clipId: first.clipId,
      toIndex: 1,
    })
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

  it('opens the Hold frame panel from More', () => {
    const base = projectWithAllTimelineFamilies()
    const firstClipId = base.composition.tracks[0].clips[0].clipId
    const selectedItemId = `clip:${firstClipId}`
    const model = buildTimelineViewModel({ project: base, selectedItemIds: [selectedItemId], pending: null })
    const onAction = vi.fn()
    renderTimeline({ model, selectedItemId, playheadTicks: ticks(5), onAction, freezeClipLabel: 'Video' })

    fireEvent.click(screen.getByRole('button', { name: 'More things you can do' }))
    const hold = screen.getByRole('menuitem', { name: /^Hold frame$/i })
    expect(hold).toBeEnabled()
    fireEvent.click(hold)

    expect(screen.getByRole('group', { name: 'Hold frame' })).toBeInTheDocument()
    expect(screen.getByLabelText('Hold frame duration seconds')).toBeInTheDocument()
    expect(onAction).not.toHaveBeenCalledWith('freeze')
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

  it('keeps detailed zoom controls behind one compact button until requested', () => {
    const { container } = renderTimeline()
    const zoom = container.querySelector<HTMLDetailsElement>('.timeline-v1__zoom-controls')
    if (!zoom) throw new Error('timeline zoom controls missing')

    expect(zoom.open).toBe(false)
    fireEvent.click(within(zoom).getByText('Timeline Zoom'))
    expect(zoom.open).toBe(true)
    expect(within(zoom).getByRole('slider', { name: 'Timeline horizontal zoom' })).toBeVisible()
  })

  it('places selected-item actions before the tracks so they do not disappear below the timeline', () => {
    const base = projectWithAllTimelineFamilies()
    const firstClipId = base.composition.tracks[0].clips[0].clipId
    const selectedItemId = `clip:${firstClipId}`
    const model = buildTimelineViewModel({ project: base, selectedItemIds: [selectedItemId], pending: null })
    const { container } = renderTimeline({ model, selectedItemId })
    const actions = container.querySelector('.timeline-v1__context-actions')
    const tracks = container.querySelector('.timeline-v1__viewport-grid')
    if (!actions || !tracks) throw new Error('timeline actions or tracks missing')

    expect(Boolean(actions.compareDocumentPosition(tracks) & Node.DOCUMENT_POSITION_FOLLOWING)).toBe(true)
  })

  it('makes the T3 precision-tool keyboard shortcuts change the real Trim tool mode', () => {
    renderTimeline()
    const timeline = screen.getByRole('region', { name: 'Project timeline' })

    fireEvent.keyDown(timeline, { key: 'r' })
    expect(screen.getByRole('radio', { name: /Trim tool\. Active: Roll/i })).toBeChecked()

    fireEvent.keyDown(timeline, { key: 'y' })
    expect(screen.getByRole('radio', { name: /Trim tool\. Active: Slip/i })).toBeChecked()

    fireEvent.keyDown(timeline, { key: 'r', shiftKey: true })
    expect(screen.getByRole('radio', { name: /Trim tool\. Active: Rate Stretch/i })).toBeChecked()
  })

  it('drives Dynamic Trim from the one J/K/L playhead and accepts only on Enter', () => {
    const project = splitProject(projectWithAllTimelineFamilies(), 10, createIds(100))
    const model = buildTimelineViewModel({ project, selectedItemIds: [], pending: null })
    const onSeek = vi.fn()
    const onShuttleKey = vi.fn()
    const onPrecisionCommit = vi.fn()
    const onPrecisionPreview = vi.fn((request: PrecisionTrimRequestV1): PrecisionTrimPlan => Object.freeze({
      ok: true as const,
      operation: Object.freeze({}) as never,
      operations: Object.freeze([]),
      feedback: Object.freeze({
        mode: 'roll' as const,
        requestedDeltaTicks: request.deltaTicks,
        appliedDeltaTicks: request.deltaTicks,
        changes: Object.freeze([]),
        affectedClipIds: Object.freeze([]),
        selectedStartTicks: ticks(10),
        selectedDurationTicks: ticks(10),
        selectedSourceInTicks: ticks(0),
        selectedSourceOutTicks: ticks(10),
      }),
      description: 'Roll preview',
    }))
    const rendered = renderTimeline({
      model,
      playheadTicks: 0,
      currentViewport: viewport({ pixelsPerSecond: 30, viewportWidthPx: 600 }),
      onSeek,
      onShuttleKey,
      onPrecisionPreview,
      onPrecisionCommit,
    })
    const timeline = screen.getByRole('region', { name: 'Project timeline' })

    fireEvent.keyDown(timeline, { key: 'r' })
    fireEvent.click(screen.getByRole('button', { name: /Edit point at/i }))
    fireEvent.keyDown(timeline, { key: 'd' })

    expect(onSeek).toHaveBeenLastCalledWith(ticks(10))
    expect(onShuttleKey).toHaveBeenCalledWith('K')
    expect(onPrecisionCommit).not.toHaveBeenCalled()

    fireEvent.keyDown(timeline, { key: 'l' })
    expect(onShuttleKey).toHaveBeenLastCalledWith('L')

    rendered.rerender(<Timeline {...rendered.props} playheadTicks={ticks(10.5)} />)
    expect(onPrecisionPreview).toHaveBeenCalledWith(expect.objectContaining({
      mode: 'roll',
      deltaTicks: ticks(0.5),
    }))
    expect(onPrecisionCommit).not.toHaveBeenCalled()

    fireEvent.keyDown(screen.getByRole('region', { name: 'Project timeline' }), { key: 'Enter' })
    expect(onPrecisionCommit).toHaveBeenCalledTimes(1)
    expect(onShuttleKey).toHaveBeenLastCalledWith('K')
  })

  it('shows the active tool in words and keeps the selected track obvious', () => {
    const base = projectWithAllTimelineFamilies()
    const firstClipId = base.composition.tracks[0].clips[0].clipId
    const selectedItemId = `clip:${firstClipId}`
    const model = buildTimelineViewModel({ project: base, selectedItemIds: [selectedItemId], pending: null })
    const selectedLane = model.lanes.find((lane) => lane.items.some((item) => item.id === selectedItemId))
    if (!selectedLane) throw new Error('selected lane missing')
    const { container } = renderTimeline({ model, selectedItemId })

    expect(screen.getByText('Tool: Select')).toBeInTheDocument()
    expect(container.querySelector(`[data-lane-id="${selectedLane.id}"]`)).toHaveAttribute('data-track-selected', 'yes')
    expect(container.querySelector(`[data-track-id="${selectedLane.trackId}"]`)).toHaveAttribute('data-track-selected', 'yes')

    fireEvent.click(screen.getByRole('radio', { name: /^Razor\./ }))
    expect(screen.getByText('Tool: Razor')).toBeInTheDocument()
  })

  it('synchronizes vertical Timeline scrolling with the track headers', () => {
    const { container } = renderTimeline()
    const viewportElement = container.querySelector<HTMLElement>('[data-timeline-viewport]')
    const headers = container.querySelector<HTMLElement>('.timeline-v1__headers')
    if (!viewportElement || !headers) throw new Error('timeline scroll surfaces missing')

    Object.defineProperty(viewportElement, 'scrollTop', { value: 96, writable: true, configurable: true })
    fireEvent.scroll(viewportElement)
    expect(headers.scrollTop).toBe(96)
  })

  it('uses actionable copy instead of a dead Empty label', () => {
    const base = projectWithAllTimelineFamilies()
    const model = buildTimelineViewModel({ project: base, selectedItemIds: [], pending: null })
    const firstLane = model.lanes[0]
    const emptyModel = Object.freeze({
      ...model,
      lanes: Object.freeze(model.lanes.map((lane) => lane.id === firstLane.id ? Object.freeze({ ...lane, items: Object.freeze([]) }) : lane)),
    })

    renderTimeline({ model: emptyModel })
    expect(screen.getByText('Drop video or an image here.')).toBeInTheDocument()
    expect(screen.queryByText(/^Empty$/)).not.toBeInTheDocument()
  })
})
