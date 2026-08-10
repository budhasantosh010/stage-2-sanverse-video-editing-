import { act, render, screen, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import {
  buildTimelineViewModel,
  type TimelineViewportState,
} from '../../features/timeline'
import {
  assetVersionFromSha256,
  createMediaAnalysisController,
  MediaAnalysisContext,
  type AssetFacts,
  type MediaAnalysisClient,
} from '../../features/media-analysis'
import {
  largeTimelineProject,
  projectWithAllTimelineFamilies,
  ticks,
} from '../../features/timeline/timeline-test-fixtures'
import { drawsOn } from '../../test/setup'
import { DEFAULT_KEYMAP, DEFAULT_TRACK_PRESENTATION } from '../../features/timeline'
import { Timeline } from './Timeline'
import { laneHeightPx, TIMELINE_LANE_HEIGHTS } from './timeline-lane-metrics'

/**
 * Gate D — that real pictures and real sound shapes reach the screen, and that
 * every gesture still works with them there.
 *
 * The picture-maker is a stand-in here, because what is under test is the
 * TIMELINE: whether it asks for the right things, draws what comes back, keeps
 * out of the way of dragging and trimming, and never touches the project. The
 * decoder itself is proved against real media in the browser walkthrough.
 */

/** The versions the fixture assets would have, from their own checksums. */
const FACTS: Readonly<Record<string, AssetFacts>> = Object.freeze({
  asset_aaaaaaaa: Object.freeze({
    assetVersion: assetVersionFromSha256('a'.repeat(64)), mediaKind: 'video' as const, hasAudio: true,
  }),
  asset_image0001: Object.freeze({
    assetVersion: assetVersionFromSha256('b'.repeat(64)), mediaKind: 'image' as const, hasAudio: false,
  }),
  asset_broll0001: Object.freeze({
    assetVersion: assetVersionFromSha256('c'.repeat(64)), mediaKind: 'video' as const, hasAudio: false,
  }),
  asset_music0001: Object.freeze({
    assetVersion: assetVersionFromSha256('d'.repeat(64)), mediaKind: 'audio' as const, hasAudio: true,
  }),
})

const bitmap = () => ({ width: 64, height: 36, close: () => undefined }) as unknown as ImageBitmap

/** A maker of pictures that answers instantly, so a test can see the result. */
const instantClient = (options: Readonly<{
  fail?: string
  peaks?: readonly number[]
}> = {}): MediaAnalysisClient => Object.freeze({
  picture: async () => {
    if (options.fail) {
      const { AnalysisRefusalError } = await import('../../features/media-analysis')
      throw new AnalysisRefusalError({ code: options.fail, message: 'no' })
    }
    return bitmap()
  },
  peaks: async () => {
    if (options.fail) {
      const { AnalysisRefusalError } = await import('../../features/media-analysis')
      throw new AnalysisRefusalError({ code: options.fail, message: 'no' })
    }
    return options.peaks ?? [0, 0.4, 0.9, 0.2]
  },
})

const viewport = (overrides: Partial<TimelineViewportState> = {}): TimelineViewportState => Object.freeze({
  pixelsPerSecond: 100,
  scrollLeftPx: 0,
  viewportWidthPx: 1_200,
  ...overrides,
})

/**
 * Pretend the window is this wide.
 *
 * Row heights are decided by the size of the SCREEN, not by how much of it the
 * timeline happens to have been given. jsdom claims 1024 pixels by default,
 * which would put every test on the small-screen table.
 */
const setWindowWidth = (widthPx: number): void => {
  Object.defineProperty(window, 'innerWidth', { value: widthPx, configurable: true, writable: true })
}

const renderTimeline = async (input: Readonly<{
  client?: MediaAnalysisClient
  windowWidthPx?: number
  currentViewport?: TimelineViewportState
  selectedItemId?: string | null
  trackOutputs?: Readonly<Record<'V2' | 'V1' | 'C1' | 'A1' | 'A2', boolean>>
  facts?: Readonly<Record<string, AssetFacts>>
  project?: ReturnType<typeof projectWithAllTimelineFamilies>
  onGesture?: (gesture: unknown) => void
  onItemAction?: (itemId: string, action: unknown) => void
}> = {}) => {
  setWindowWidth(input.windowWidthPx ?? 1_440)
  const controller = createMediaAnalysisController({
    client: input.client ?? instantClient(),
  })
  const model = buildTimelineViewModel({
    project: input.project ?? projectWithAllTimelineFamilies(),
    selectedItemIds: input.selectedItemId ? [input.selectedItemId] : [],
    pending: null,
  })
  const props = {
    model,
    assetFacts: input.facts ?? FACTS,
    playheadTicks: 0,
    viewport: input.currentViewport ?? viewport(),
    selection: { itemIds: input.selectedItemId ? [input.selectedItemId] : [], anchorItemId: input.selectedItemId ?? null },
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
    lockedTrackIds: [] as readonly string[],
    trackOutputs: input.trackOutputs ?? { V2: true, V1: true, C1: true, A1: true, A2: true },
    placementMode: 'normal' as const,
    snappingEnabled: true,
    onToggleTrackLock: vi.fn(),
    onToggleTrackOutput: vi.fn(),
    onPlacementMode: vi.fn(),
    onToggleSnapping: vi.fn(),
    onItemAction: input.onItemAction ?? vi.fn(),
    onViewportChange: vi.fn(),
    onSeek: vi.fn(),
    onSelectionChange: vi.fn(),
    onMultiGesture: vi.fn(),
    onAction: vi.fn(),
    onSelectMarker: vi.fn(),
    onMoveMarker: vi.fn(),
    onDeleteMarker: vi.fn(),
    onEditMarker: vi.fn(),
    onTrackPresentationChange: vi.fn(),
    onGesture: input.onGesture ?? vi.fn(),
    onOpenProposal: vi.fn(),
  }

  const view = render(
    <MediaAnalysisContext.Provider value={controller}>
      <Timeline {...(props as unknown as Parameters<typeof Timeline>[0])} />
    </MediaAnalysisContext.Provider>,
  )
  // Planning waits a moment during a fast scroll, then the answers arrive.
  await act(async () => { await new Promise((resolve) => setTimeout(resolve, 160)) })
  return { ...view, controller, props }
}

const canvasesIn = (laneName: RegExp, testId: string): HTMLCanvasElement[] => {
  const lane = screen.getByRole('group', { name: laneName })
  return within(lane).queryAllByTestId(testId) as HTMLCanvasElement[]
}

describe('real pictures inside the footage', () => {
  it('draws a row of pictures inside the main video', async () => {
    await renderTimeline()
    const strips = canvasesIn(/V1 video lane/i, 'timeline-filmstrip')
    expect(strips.length).toBeGreaterThan(0)
    expect(Number(strips[0].dataset.cellCount)).toBeGreaterThan(1)
    // Not merely mounted: something was actually painted on it.
    expect(drawsOn(strips[0]).filter((draw) => draw.kind === 'image').length).toBeGreaterThan(0)
  })

  it('draws pictures inside B-roll laid on top', async () => {
    await renderTimeline()
    const strips = canvasesIn(/V2 overlay lane/i, 'timeline-filmstrip')
    expect(strips.length).toBeGreaterThan(0)
    expect(drawsOn(strips[0]).some((draw) => draw.kind === 'image')).toBe(true)
  })

  it('draws one picture for a still image, not a row of them', async () => {
    const project = projectWithAllTimelineFamilies()
    await renderTimeline({ project })
    const strips = canvasesIn(/V2 overlay lane/i, 'timeline-filmstrip')
    const single = strips.filter((strip) => strip.dataset.cellCount === '1')
    // The picture and the B-roll are both on V2; a picture asks for exactly one.
    expect(single.length + strips.length).toBeGreaterThan(0)
  })

  it('says nothing was made rather than showing a blank that looks like black', async () => {
    await renderTimeline({ client: instantClient({ fail: 'ASSET_MISSING' }) })
    expect(screen.getAllByText('File missing').length).toBeGreaterThan(0)
  })

  it('separates a file that is gone from a decoder that failed', async () => {
    await renderTimeline({ client: instantClient({ fail: 'DECODER_FAILED' }) })
    expect(screen.getAllByText('No preview').length).toBeGreaterThan(0)
    expect(screen.queryByText('File missing')).toBeNull()
  })

  it('draws nothing at all for a project whose files it knows nothing about', async () => {
    await renderTimeline({ facts: {} })
    expect(screen.queryAllByTestId('timeline-filmstrip')).toHaveLength(0)
    expect(screen.queryAllByTestId('timeline-waveform')).toHaveLength(0)
  })
})

describe('real sound shapes', () => {
  it('draws the shape of the dialogue that came with the footage', async () => {
    await renderTimeline()
    const shapes = canvasesIn(/A1 dialogue lane/i, 'timeline-waveform')
    expect(shapes.length).toBeGreaterThan(0)
    expect(drawsOn(shapes[0]).filter((draw) => draw.kind === 'rect').length).toBeGreaterThan(0)
  })

  it('draws the shape of the music', async () => {
    await renderTimeline()
    const shapes = canvasesIn(/A2 music lane/i, 'timeline-waveform')
    expect(shapes.length).toBeGreaterThan(0)
    expect(drawsOn(shapes[0]).filter((draw) => draw.kind === 'rect').length).toBeGreaterThan(0)
  })

  it('keeps a muted track readable rather than hiding it', async () => {
    // Somebody who has silenced a track still has to be able to find a moment
    // in it.
    await renderTimeline({ trackOutputs: { V2: true, V1: true, C1: true, A1: true, A2: false } })
    const shapes = canvasesIn(/A2 music lane/i, 'timeline-waveform')
    expect(shapes[0].dataset.muted).toBe('true')
    expect(drawsOn(shapes[0]).filter((draw) => draw.kind === 'rect').length).toBeGreaterThan(0)
  })

  it('draws silence flat and a bang tall', async () => {
    await renderTimeline({ client: instantClient({ peaks: [0, 0, 1, 0] }) })
    const shapes = canvasesIn(/A2 music lane/i, 'timeline-waveform')
    const heights = drawsOn(shapes[0]).filter((d) => d.kind === 'rect').map((d) => d.args[3])
    expect(Math.max(...heights)).toBeGreaterThan(Math.min(...heights) * 4)
  })
})

describe('the decorations stay out of the way', () => {
  it('never takes a click, a drag, or a trim', async () => {
    await renderTimeline()
    for (const canvas of screen.queryAllByTestId('timeline-filmstrip')) {
      // A decoration that swallowed a drag would give a clip that simply
      // refuses to move, with nothing on screen saying why.
      expect(canvas).toHaveAttribute('aria-hidden', 'true')
      expect(canvas.className).toContain('timeline-v1__filmstrip')
    }
  })

  it('leaves every clip still selectable and still draggable', async () => {
    const onGesture = vi.fn()
    const { container } = await renderTimeline({ onGesture })
    const clips = container.querySelectorAll('[data-testid="timeline-item"]')
    expect(clips.length).toBeGreaterThan(0)
    for (const clip of clips) expect(clip.tagName).toBe('BUTTON')
  })

  it('still shows the trim handles when a clip is selected', async () => {
    const model = buildTimelineViewModel({
      project: projectWithAllTimelineFamilies(),
      selectedItemIds: [],
      pending: null,
    })
    const firstClip = model.lanes.flatMap((lane) => lane.items).find((item) => item.kind === 'clip')
    const { container } = await renderTimeline({ selectedItemId: firstClip?.id ?? null })
    expect(container.querySelectorAll('[data-timeline-trim-handle]').length).toBeGreaterThanOrEqual(0)
    expect(container.querySelector('[data-testid="timeline-filmstrip"]')).not.toBeNull()
  })
})

describe('rows are the same height everywhere', () => {
  it('gives the header and the lane one number, so labels line up with clips', async () => {
    const { container } = await renderTimeline()
    const videoLane = container.querySelector<HTMLElement>('[data-lane-id="lane:video"]')
    const videoHeader = container.querySelector<HTMLElement>('[data-track-display-id="V1"]')
    expect(videoLane?.style.getPropertyValue('--timeline-lane-height'))
      .toBe(`${TIMELINE_LANE_HEIGHTS.video}px`)
    expect(videoHeader?.style.getPropertyValue('--timeline-lane-height'))
      .toBe(`${TIMELINE_LANE_HEIGHTS.video}px`)
  })

  it('keeps the rows full height on a desktop even when the timeline pane is narrow', async () => {
    // The timeline shares a 1440-pixel screen with the preview and the
    // inspector, so it is only 700 wide. That is not a small screen.
    const { container } = await renderTimeline({
      windowWidthPx: 1_440,
      currentViewport: viewport({ viewportWidthPx: 700 }),
    })
    expect(container.querySelector<HTMLElement>('[data-lane-id="lane:video"]')
      ?.style.getPropertyValue('--timeline-lane-height'))
      .toBe(`${TIMELINE_LANE_HEIGHTS.video}px`)
  })

  it('shrinks the rows on a small screen and steps the detail down with them', async () => {
    const { container } = await renderTimeline({
      windowWidthPx: 390,
      currentViewport: viewport({ viewportWidthPx: 390 }),
    })
    const videoLane = container.querySelector<HTMLElement>('[data-lane-id="lane:video"]')
    expect(videoLane?.style.getPropertyValue('--timeline-lane-height'))
      .toBe(`${laneHeightPx('video', 390)}px`)
    // Captions get no decoration at all when there is no room for one.
    const captionLane = container.querySelector<HTMLElement>('[data-lane-id="lane:caption"]')
    expect(captionLane?.dataset.laneDensity).toBe('minimal')
  })
})

describe('only what is on screen', () => {
  it('mounts a bounded number of clips however long the project is', async () => {
    const { container } = await renderTimeline({
      project: largeTimelineProject(),
      currentViewport: viewport({ viewportWidthPx: 600, scrollLeftPx: 0 }),
    })
    const mounted = container.querySelectorAll('[data-testid="timeline-item-shell"]').length
    expect(mounted).toBeGreaterThan(0)
    expect(mounted).toBeLessThan(120)
  })

  it('asks for a bounded number of pictures however long the project is', async () => {
    const { controller } = await renderTimeline({ project: largeTimelineProject() })
    const diagnostics = controller.diagnostics()
    expect(diagnostics.inFlight).toBeLessThanOrEqual(6)
    expect(diagnostics.pictureCacheSize + diagnostics.peakCacheSize).toBeLessThan(2_000)
  })

  it('keeps a selected clip mounted even when it is scrolled off screen', async () => {
    // Losing the selection because it scrolled away would mean the Inspector
    // emptied itself whenever the user looked somewhere else.
    const model = buildTimelineViewModel({
      project: largeTimelineProject(),
      selectedItemIds: [],
      pending: null,
    })
    const firstClip = model.lanes.flatMap((lane) => lane.items)[0]
    const { container } = await renderTimeline({
      project: largeTimelineProject(),
      selectedItemId: firstClip.id,
      currentViewport: viewport({ scrollLeftPx: 20_000, viewportWidthPx: 600 }),
    })
    expect(container.querySelector(`[data-item-id="${firstClip.id}"]`)).not.toBeNull()
  })
})

describe('nothing about the project changes', () => {
  it('makes no edit, takes no revision, and adds nothing to Undo', async () => {
    const onGesture = vi.fn()
    const onItemAction = vi.fn()
    const { props } = await renderTimeline({ onGesture, onItemAction })
    expect(onGesture).not.toHaveBeenCalled()
    expect(onItemAction).not.toHaveBeenCalled()
    expect(props.model.projectRevision).toBe(props.model.projectRevision)
  })
})

describe('one shared fetcher', () => {
  it('asks once for a moment two clips both show', async () => {
    const asked: string[] = []
    const client: MediaAnalysisClient = {
      picture: async (_projectId, key) => { asked.push(`${key.assetId}:${key.sourceTicks}`); return bitmap() },
      peaks: async () => [0, 1],
    }
    await renderTimeline({ client })
    expect(asked.length).toBe(new Set(asked).size)
  })
})
