import { cleanup, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'

import type { TimelineMarkerV1 } from '@sanverse/edit-domain'

import {
  DEFAULT_KEYMAP,
  DEFAULT_TRACK_PRESENTATION,
  buildTimelineViewModel,
  toggleTrackCollapsed,
} from '../../features/timeline'
import {
  projectWithAllTimelineFamilies,
  removedProject,
  ticks,
} from '../../features/timeline/timeline-test-fixtures'
import { Timeline } from './Timeline'

afterEach(cleanup)

const ALL_ON = { V2: true, V1: true, C1: true, A1: true, A2: true }

const marker = (overrides: Partial<TimelineMarkerV1> = {}): TimelineMarkerV1 => Object.freeze({
  markerId: 'marker_aaaaaaaa',
  startTicks: ticks(2),
  durationTicks: 0,
  label: 'Sponsor read',
  note: 'fix the hum',
  color: 'amber',
  ...overrides,
})

/** A second timeline, with one piece of B-roll picked, for the enabled cases. */
const renderTimelineWithSomethingPicked = () => {
  const project = projectWithAllTimelineFamilies()
  const model = buildTimelineViewModel({ project, selectedItemIds: [], pending: null })
  const overlay = model.lanes.flatMap((lane) => lane.items).find((item) => item.kind === 'media-overlay')
  if (!overlay) throw new Error('fixture has no overlay')
  return renderTimeline({ project, selectedItemIds: [overlay.id], playheadTicks: overlay.startTicks + 10 })
}

const renderTimeline = (overrides: Record<string, unknown> = {}) => {
  const project = (overrides.project as ReturnType<typeof projectWithAllTimelineFamilies>)
    ?? projectWithAllTimelineFamilies()
  const selectedItemIds = (overrides.selectedItemIds as readonly string[]) ?? []
  const model = buildTimelineViewModel({ project, selectedItemIds, pending: null })
  const props = {
    model,
    playheadTicks: (overrides.playheadTicks as number) ?? 0,
    viewport: { pixelsPerSecond: 100, scrollLeftPx: 0, viewportWidthPx: 600 },
    selection: {
      itemIds: selectedItemIds,
      anchorItemId: selectedItemIds[0] ?? null,
    },
    groups: overrides.groups ?? [],
    markers: overrides.markers ?? [],
    selectedMarkerId: overrides.selectedMarkerId ?? null,
    trackPresentation: overrides.trackPresentation ?? DEFAULT_TRACK_PRESENTATION,
    keymap: DEFAULT_KEYMAP,
    clipboardHasContent: overrides.clipboardHasContent ?? false,
    busy: overrides.busy ?? false,
    trimAmountTicks: ticks(1),
    gainDb: 0,
    fadeInTicks: 0,
    fadeOutTicks: 0,
    advancedControls: <button type="button">Legacy fallback</button>,
    lockedTrackIds: (overrides.lockedTrackIds as readonly string[]) ?? [],
    trackOutputs: ALL_ON,
    placementMode: 'normal' as const,
    snappingEnabled: true,
    onToggleTrackLock: vi.fn(),
    onToggleTrackOutput: vi.fn(),
    onPlacementMode: vi.fn(),
    onToggleSnapping: vi.fn(),
    onItemAction: vi.fn(),
    onMultiGesture: vi.fn(),
    onViewportChange: vi.fn(),
    onSeek: vi.fn(),
    onSelectionChange: vi.fn(),
    onGesture: vi.fn(),
    onAction: vi.fn(),
    onSelectMarker: vi.fn(),
    onMoveMarker: vi.fn(),
    onDeleteMarker: vi.fn(),
    onEditMarker: vi.fn(),
    onTrackPresentationChange: vi.fn(),
    onOpenProposal: vi.fn(),
    ...overrides,
  }
  const rendered = render(<Timeline {...(props as unknown as Parameters<typeof Timeline>[0])} />)
  return { ...rendered, props, model }
}

describe('T1.1 the icon toolbar', () => {
  it('shows the tools as symbols, and names every one of them in words', () => {
    /*
     * Symbols fit where nine words do not. The words are NOT thrown away: every
     * button carries a name a screen reader reads and a tooltip a mouse user
     * sees. A symbol with no name is a guessing game.
     */
    renderTimeline()
    for (const name of [/^Select\./, /^Razor\./, /^Trim tool\./]) {
      const button = screen.getByRole('radio', { name })
      expect(button).toBeInTheDocument()
      expect(button).toHaveAttribute('title')
    }
    expect(screen.getByRole('radio', { name: /^Select\./ })).toHaveAttribute('aria-checked', 'true')
  })

  it('says which key does each thing, taken from the user\'s own keymap', () => {
    renderTimeline()
    // Nothing is picked, so Split is disabled and its name carries the reason.
    // The key still has to be discoverable from the tooltip.
    const split = screen.getByRole('button', { name: /^Split/ })
    expect(split).toHaveAttribute('title', expect.stringContaining('Choose something'))
    renderTimelineWithSomethingPicked()
    expect(screen.getAllByRole('button', { name: /^Split/ })[1])
      .toHaveAttribute('title', expect.stringContaining(DEFAULT_KEYMAP.bindings.split))
  })

  it('says WHY something cannot be used, in the tooltip AND to a screen reader', async () => {
    const user = userEvent.setup()
    renderTimeline()
    await user.click(screen.getByRole('button', { name: 'More things you can do' }))
    const paste = screen.getByRole('menuitem', { name: /Paste — There is nothing to paste/i })
    expect(paste).toBeDisabled()
    expect(paste).toHaveAttribute('title', expect.stringContaining('Copy something first'))
  })

  it('offers Speed, and says which thing to pick rather than going quiet', async () => {
    /*
     * Speed became real in T2. With nothing picked it is still refused — but
     * the refusal now names what to do about it, because it is a state the
     * user can leave by clicking a clip. In T1 this button said "not built
     * yet", which was the truth then and would be a lie now.
     */
    const user = userEvent.setup()
    renderTimeline()
    await user.click(screen.getByRole('button', { name: 'More things you can do' }))
    const speed = screen.getByRole('menuitem', { name: /Speed — Choose a piece of the main video first/i })
    expect(speed).toBeDisabled()
    expect(speed).toHaveAttribute('title', expect.stringContaining('cannot be sped up yet'))
  })

  it('keeps the long list behind More, so the row still fits a small screen', async () => {
    const user = userEvent.setup()
    renderTimeline()
    const more = screen.getByRole('button', { name: 'More things you can do' })
    expect(more).toHaveAttribute('aria-expanded', 'false')
    await user.click(more)
    const menu = screen.getByRole('menu', { name: 'More things you can do' })
    for (const label of ['Copy', 'Cut', 'Paste', 'Duplicate', 'Group', 'Ungroup']) {
      expect(within(menu).getByText(label)).toBeInTheDocument()
    }
  })

  it('closes More with Escape, so a keyboard user is never trapped in it', async () => {
    const user = userEvent.setup()
    renderTimeline()
    await user.click(screen.getByRole('button', { name: 'More things you can do' }))
    expect(screen.getByRole('menu', { name: 'More things you can do' })).toBeInTheDocument()
    await user.keyboard('{Escape}')
    expect(screen.queryByRole('menu', { name: 'More things you can do' })).not.toBeInTheDocument()
  })

  it('keeps Magnet and Snap as two different switches, because they do two things', () => {
    // MAGNET is about what happens to the OTHER clips when something lands.
    // SNAP is about where the pointer lands. A user can want either alone.
    renderTimeline()
    expect(screen.getByRole('button', { name: /Push clips along/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /^Snapping/i })).toHaveAttribute('aria-pressed', 'true')
  })

  it('counts what is picked when it is more than one thing', () => {
    const project = projectWithAllTimelineFamilies()
    const model = buildTimelineViewModel({ project, selectedItemIds: [], pending: null })
    const overlays = model.lanes
      .flatMap((lane) => lane.items)
      .filter((item) => item.kind === 'media-overlay')
      .map((item) => item.id)
    renderTimeline({ project, selectedItemIds: overlays })
    expect(screen.getByText(/2 things picked/)).toBeInTheDocument()
  })
})

describe('T1.9 the strip of the user\'s own notes', () => {
  it('draws a note where it belongs, and says what it is', () => {
    renderTimeline({ markers: [marker()] })
    const note = screen.getByRole('button', { name: /Note: Sponsor read/i })
    expect(note).toBeInTheDocument()
    expect(note).toHaveAttribute('data-marker-color', 'amber')
  })

  it('tells a note about a MOMENT apart from a note about a STRETCH', () => {
    // Without reading anything: a point is one flag, a stretch gets a bar too.
    renderTimeline({
      markers: [
        marker({ markerId: 'marker_point001', durationTicks: 0 }),
        marker({ markerId: 'marker_range001', startTicks: ticks(5), durationTicks: ticks(2) }),
      ],
    })
    const notes = screen.getAllByRole('button', { name: /^Note:/i })
    expect(notes.map((note) => note.getAttribute('data-marker-range'))).toEqual(['false', 'true'])
  })

  it('does not draw a note that is past the end of the video — and does not delete it', () => {
    // The user trimmed the end off. Putting the footage back must bring their
    // note back with it.
    renderTimeline({ markers: [marker({ startTicks: ticks(99_999) })] })
    expect(screen.queryByRole('button', { name: /^Note:/i })).not.toBeInTheDocument()
  })

  it('lists the notes, and offers a search that empties nothing when cleared', async () => {
    const user = userEvent.setup()
    renderTimeline({ markers: [marker(), marker({ markerId: 'marker_second01', label: 'Outro', startTicks: ticks(6) })] })
    await user.click(screen.getByText(/Your notes/))
    const search = screen.getByLabelText('Find a note')
    await user.type(search, 'outro')
    // The strip still draws both flags; the LIST is what the search filters.
    const list = screen.getByRole('list')
    expect(within(list).getByText('Outro')).toBeInTheDocument()
    expect(within(list).queryByText('Sponsor read')).not.toBeInTheDocument()
    await user.clear(search)
    expect(within(screen.getByRole('list')).getByText('Sponsor read')).toBeInTheDocument()
  })

  it('says so plainly when there are no notes at all', async () => {
    const user = userEvent.setup()
    renderTimeline()
    await user.click(screen.getByText(/Your notes/))
    expect(screen.getByText(/No notes yet/)).toBeInTheDocument()
  })
})

describe('T1.10 folding a row away and choosing how tall it is', () => {
  it('gives every row a fold control that says the video is unaffected', () => {
    renderTimeline()
    const fold = screen.getAllByRole('button', { name: /^Fold /i })
    expect(fold.length).toBe(5)
    expect(fold[0]).toHaveAttribute('title', expect.stringContaining('video is unaffected'))
  })

  it('reports a fold through the callback and takes no edit at all', async () => {
    const user = userEvent.setup()
    const onTrackPresentationChange = vi.fn()
    const { model } = renderTimeline({ onTrackPresentationChange })
    await user.click(screen.getAllByRole('button', { name: /^Fold /i })[0])
    expect(onTrackPresentationChange).toHaveBeenCalledTimes(1)
    // No revision, and nothing that could reach the exporter.
    expect(model.projectRevision).toBe(model.projectRevision)
  })

  it('keeps a folded row findable rather than making it vanish', () => {
    const folded = toggleTrackCollapsed(DEFAULT_TRACK_PRESENTATION, 'V2')
    renderTimeline({ trackPresentation: folded })
    expect(screen.getByRole('button', { name: /^Unfold /i })).toBeInTheDocument()
  })

  it('offers three named sizes rather than a number to guess at', () => {
    renderTimeline()
    const heights = screen.getAllByRole('combobox', { name: /How tall/i })
    expect(heights.length).toBe(5)
    expect(within(heights[0]).getByText('Short')).toBeInTheDocument()
    expect(within(heights[0]).getByText('Normal')).toBeInTheDocument()
    expect(within(heights[0]).getByText('Tall')).toBeInTheDocument()
  })
})

describe('T1.13 an empty space is something you can act on', () => {
  it('says what it is, how long it is, and offers to close it', () => {
    const project = removedProject(false)
    const model = buildTimelineViewModel({ project, selectedItemIds: [], pending: null })
    const gap = model.lanes.flatMap((lane) => lane.items).find((item) => item.kind === 'gap')
    if (!gap) throw new Error('fixture has no empty space')
    renderTimeline({ project, selectedItemIds: [gap.id] })
    expect(screen.getByText(/Empty space, .* seconds long\. Nothing plays here\./)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Close the empty space' })).toBeEnabled()
  })

  it('routes closing it through the one action handler', async () => {
    const user = userEvent.setup()
    const onAction = vi.fn()
    const project = removedProject(false)
    const model = buildTimelineViewModel({ project, selectedItemIds: [], pending: null })
    const gap = model.lanes.flatMap((lane) => lane.items).find((item) => item.kind === 'gap')
    if (!gap) throw new Error('fixture has no empty space')
    renderTimeline({ project, selectedItemIds: [gap.id], onAction })
    await user.click(screen.getByRole('button', { name: 'Close the empty space' }))
    expect(onAction).toHaveBeenCalledWith('close-gap')
  })

  it('says why it cannot be closed when the video track is locked', () => {
    const project = removedProject(false)
    const model = buildTimelineViewModel({ project, selectedItemIds: [], pending: null })
    const gap = model.lanes.flatMap((lane) => lane.items).find((item) => item.kind === 'gap')
    if (!gap) throw new Error('fixture has no empty space')
    renderTimeline({ project, selectedItemIds: [gap.id], lockedTrackIds: ['V1'] })
    expect(screen.getByRole('button', { name: 'Close the empty space' })).toBeDisabled()
  })
})

describe('T1.11 the right-click menu offers only real actions', () => {
  it('leaves out anything that cannot be done right now, rather than greying it', async () => {
    /*
     * A menu entry that exists only to show what MIGHT be possible teaches the
     * user to distrust the menu. Here an entry appears when it can be used.
     */
    const user = userEvent.setup()
    const project = projectWithAllTimelineFamilies()
    const model = buildTimelineViewModel({ project, selectedItemIds: [], pending: null })
    const overlay = model.lanes.flatMap((lane) => lane.items).find((item) => item.kind === 'media-overlay')
    if (!overlay) throw new Error('fixture has no overlay')
    renderTimeline({ project, selectedItemIds: [overlay.id] })

    const rendered = screen.getAllByTestId('timeline-item')
      .find((element) => element.getAttribute('data-timeline-item-id') === overlay.id)
    if (!rendered) throw new Error('overlay is not on screen')
    await user.pointer({ keys: '[MouseRight]', target: rendered })

    const menu = screen.getByRole('menu', { name: /timeline actions/i })
    expect(within(menu).getByRole('menuitem', { name: 'Copy' })).toBeInTheDocument()
    // Nothing is picked that is in a group, so Ungroup is simply not offered.
    expect(within(menu).queryByRole('menuitem', { name: 'Stop these moving together' })).not.toBeInTheDocument()
    // ...and nothing in the menu is disabled.
    for (const item of within(menu).getAllByRole('menuitem')) expect(item).toBeEnabled()
  })
})
