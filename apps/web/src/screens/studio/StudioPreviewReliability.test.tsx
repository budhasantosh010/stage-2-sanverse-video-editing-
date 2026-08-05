import type { ComponentProps } from 'react'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { acceptChangeSet, type EditOperation, type EditProject } from '@sanverse/edit-domain'

import { StudioScreen } from './StudioScreen'
import { ms, testChangeSet, testProject } from '../../test-fixtures'
import { HAVE_CURRENT_DATA, HAVE_METADATA, HAVE_NOTHING } from '../../features/render-plan/media-readiness'

/**
 * Gate A — the recorded failure, held down by tests.
 *
 * The owner recorded base footage going black while the monitor controls and an
 * accepted overlay stayed visible, with nothing on screen explaining it. These
 * tests assert the three things that must now always be true:
 *
 *   1. the deliberate black layer appears ONLY for a canonical timeline gap;
 *   2. an overlay never replaces the base video;
 *   3. every non-ready state says which of the four it is.
 */

const domRect = (x: number, y: number, width: number, height: number): DOMRect => ({
  x, y, left: x, top: y, right: x + width, bottom: y + height, width, height,
  toJSON: () => ({}),
} as DOMRect)

function projectWithVisibleNameplate(): EditProject {
  const base = testProject()
  const accepted = acceptChangeSet(base, testChangeSet(base.revision, 'changeset_preview1', {
    operationId: 'operation_preview1',
    sourceInterval: { start: ms(0), duration: ms(5_000) },
  }))
  if (!accepted.ok) throw new Error(JSON.stringify(accepted.error))
  return accepted.value
}

function renderPreviewStudio(overrides: Partial<ComponentProps<typeof StudioScreen>> = {}) {
  const props: ComponentProps<typeof StudioScreen> = {
    embedded: true,
    workspace: 'studio',
    project: {
      id: 'project_1234567890abcdef',
      name: 'cleaned-interview.mp4',
      mediaUrl: 'blob:cleaned-interview',
      draftRequest: '',
    },
    proposal: null,
    conversation: { status: 'ready', lastMessage: '', question: null, notice: null },
    editProject: projectWithVisibleNameplate(),
    editError: null,
    onProposal: vi.fn(),
    onDiscardProposal: vi.fn(),
    onAcceptProposal: vi.fn(),
    onRepairProposal: vi.fn(),
    onTimelineEdit: vi.fn(),
    onCreateOverlay: vi.fn(async (_operation: EditOperation): Promise<string | null> => null),
    onApplyOperations: vi.fn(async (): Promise<string | null> => null),
    onUploadAsset: vi.fn(async () => 'not used'),
    assetUrl: (assetId: string) => `/api/projects/p/assets/${assetId}/media`,
    onAddCaptions: vi.fn(async () => null),
    onSendMessage: vi.fn(),
    onUndo: vi.fn(),
    onRedo: vi.fn(),
    exportState: { status: 'idle' },
    saveState: { status: 'saved' as const, persistedRevision: 0 },
    onExport: vi.fn(),
    onBack: vi.fn(),
    ...overrides,
  }
  return { ...render(<StudioScreen {...props} />), props }
}

/** Put the element into a state where a real frame is available. */
function makeReady(video: HTMLVideoElement, readyState = HAVE_CURRENT_DATA, seeking = false) {
  Object.defineProperties(video, {
    videoWidth: { configurable: true, value: 1920 },
    videoHeight: { configurable: true, value: 1080 },
    readyState: { configurable: true, value: readyState },
    seeking: { configurable: true, value: seeking },
    currentSrc: { configurable: true, value: 'blob:cleaned-interview' },
  })
  vi.spyOn(video, 'getBoundingClientRect').mockReturnValue(domRect(100, 50, 400, 400))
}

const status = () => screen.queryByTestId('base-frame-status')
const gapLayer = () => screen.queryByTestId('video-hole')

describe('Studio preview reliability', () => {
  beforeEach(() => {
    vi.stubGlobal('ResizeObserver', class { observe() {} disconnect() {} })
    vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => {})
    vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue(undefined)
  })

  afterEach(() => {
    cleanup()
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

  it('says loading before a frame exists, and says nothing once one does', () => {
    const { container } = renderPreviewStudio()
    const video = container.querySelector('video') as HTMLVideoElement

    makeReady(video, HAVE_NOTHING)
    fireEvent.loadStart(video)
    expect(status()).toHaveTextContent(/loading frame/i)
    // Never a gap: no media yet is not a statement about the timeline.
    expect(gapLayer()).toBeNull()

    makeReady(video, HAVE_CURRENT_DATA)
    fireEvent.loadedData(video)
    expect(status()).toBeNull()
    expect(gapLayer()).toBeNull()
  })

  it('reports knowing the size but having no frame as loading, not as ready', () => {
    // videoWidth is populated at HAVE_METADATA. Treating that as "there is a
    // picture" is what revealed an empty black canvas over healthy footage.
    const { container } = renderPreviewStudio()
    const video = container.querySelector('video') as HTMLVideoElement
    makeReady(video, HAVE_METADATA)
    fireEvent.loadedMetadata(video)
    expect(status()).toHaveTextContent(/loading frame/i)
    expect(status()).toHaveAttribute('data-state', 'loading')
  })

  it('keeps the previous frame and says seeking when readiness dips after playback', () => {
    const { container } = renderPreviewStudio()
    const video = container.querySelector('video') as HTMLVideoElement
    makeReady(video, HAVE_CURRENT_DATA)
    fireEvent.loadedData(video)
    expect(status()).toBeNull()

    makeReady(video, HAVE_METADATA, true)
    fireEvent.seeking(video)
    expect(status()).toHaveTextContent(/seeking/i)
    // Crucially not a gap, and crucially not black.
    expect(gapLayer()).toBeNull()

    makeReady(video, HAVE_CURRENT_DATA, false)
    fireEvent.seeked(video)
    expect(status()).toBeNull()
  })

  it('shows the accepted overlay and the base video at the same time', () => {
    const { container } = renderPreviewStudio()
    const video = container.querySelector('video') as HTMLVideoElement
    makeReady(video)
    fireEvent.loadedData(video)
    fireEvent.timeUpdate(video)

    const layer = screen.getByTestId('video-content-layer')
    expect(layer.querySelector('[data-node-id]')).not.toBeNull()
    // The overlay is present AND the base picture is untouched: not black, not
    // covered, and not reported as an error.
    expect(gapLayer()).toBeNull()
    expect(status()).toBeNull()
    expect(video.style.opacity === '' || Number(video.style.opacity) > 0).toBe(true)
  })

  it('survives ten play, pause, seek and resize cycles without a black frame', () => {
    const { container } = renderPreviewStudio()
    const video = container.querySelector('video') as HTMLVideoElement
    makeReady(video)
    fireEvent.loadedData(video)

    for (let cycle = 0; cycle < 10; cycle += 1) {
      fireEvent.play(video)
      fireEvent.playing(video)
      fireEvent.timeUpdate(video)
      fireEvent.pause(video)

      makeReady(video, HAVE_METADATA, true)
      fireEvent.seeking(video)
      expect(gapLayer()).toBeNull()
      expect(status()).toHaveTextContent(/seeking/i)

      makeReady(video, HAVE_CURRENT_DATA, false)
      fireEvent.seeked(video)

      window.dispatchEvent(new Event('resize'))
      fireEvent(video, new Event('resize'))

      // A resize is presentation only. It must never blank the picture, and it
      // must never be mistaken for a timeline gap.
      expect(gapLayer()).toBeNull()
      expect(status()).toBeNull()
    }

    // Exactly one video, and the same DOM node throughout.
    expect(container.querySelectorAll('video')).toHaveLength(1)
    expect(container.querySelector('video')).toBe(video)
  })

  it('explains a real media error rather than showing unexplained black', () => {
    const { container } = renderPreviewStudio()
    const video = container.querySelector('video') as HTMLVideoElement
    makeReady(video)
    fireEvent.loadedData(video)
    expect(status()).toBeNull()

    fireEvent.error(video)
    expect(status()).toHaveTextContent(/preview unavailable/i)
    expect(status()).toHaveAttribute('data-state', 'error')
    // An error is not dressed up as an intentional gap.
    expect(gapLayer()).toBeNull()
  })
})
