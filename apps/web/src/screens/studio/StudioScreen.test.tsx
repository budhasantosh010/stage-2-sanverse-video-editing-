import type { ComponentProps } from 'react'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { acceptChangeSet, undoChangeSet, type EditProject } from '@sanverse/edit-domain'

import { StudioScreen } from './StudioScreen'
import { TEST_CLIP_ID, ms, testChangeSet, testOperation, testProject } from '../../test-fixtures'

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

let resizeObserverCallback: ResizeObserverCallback | null = null
let videoFrameCallback: VideoFrameRequestCallback | null = null
let cancelVideoFrameCallback: ReturnType<typeof vi.fn>

beforeEach(() => {
  resizeObserverCallback = null
  videoFrameCallback = null
  cancelVideoFrameCallback = vi.fn()
  vi.stubGlobal(
    'ResizeObserver',
    class ResizeObserverMock {
      constructor(callback: ResizeObserverCallback) {
        resizeObserverCallback = callback
      }

      observe() {}
      unobserve() {}
      disconnect() {}
    },
  )

  Object.defineProperties(HTMLVideoElement.prototype, {
    requestVideoFrameCallback: {
      configurable: true,
      value: vi.fn((callback: VideoFrameRequestCallback) => {
        videoFrameCallback = callback
        return 7
      }),
    },
    cancelVideoFrameCallback: {
      configurable: true,
      value: cancelVideoFrameCallback,
    },
  })
})

afterEach(() => {
  delete (HTMLVideoElement.prototype as Partial<HTMLVideoElement>).requestVideoFrameCallback
  delete (HTMLVideoElement.prototype as Partial<HTMLVideoElement>).cancelVideoFrameCallback
  vi.unstubAllGlobals()
})

function prepareVideoForPointing(video: HTMLVideoElement, currentTime = 12.4) {
  Object.defineProperties(video, {
    videoWidth: { configurable: true, value: 1920 },
    videoHeight: { configurable: true, value: 1080 },
    currentTime: { configurable: true, value: currentTime, writable: true },
  })
  vi.spyOn(video, 'getBoundingClientRect').mockReturnValue({
    x: 100,
    y: 50,
    left: 100,
    top: 50,
    right: 500,
    bottom: 450,
    width: 400,
    height: 400,
    toJSON: () => ({}),
  })
}

function renderStudio(overrides: Partial<ComponentProps<typeof StudioScreen>> = {}) {
  const props: ComponentProps<typeof StudioScreen> = {
    project: {
      id: 'project_1234567890abcdef',
      name: 'cleaned-interview.mp4',
      mediaUrl: 'blob:cleaned-interview',
      draftRequest: 'Tighten the opening pause.',
    },
    proposal: null,
    conversation: { status: 'ready', lastMessage: '', question: null, notice: null },
    editProject: testProject(),
    editError: null,
    onProposal: vi.fn(),
    onDiscardProposal: vi.fn(),
    onAcceptProposal: vi.fn(),
    onRepairProposal: vi.fn(),
    onTimelineEdit: vi.fn(),
    onCreateOverlay: vi.fn(async () => null),
    onUploadAsset: vi.fn(async () => 'not used'),
    assetUrl: (assetId: string) => `/api/projects/p/assets/${assetId}/media`,
    onAddCaptions: vi.fn(async () => null),
    onSendMessage: vi.fn(),
    onUndo: vi.fn(),
    onRedo: vi.fn(),
    exportState: { status: 'idle' },
    saveState: 'idle',
    onExport: vi.fn(),
    onBack: vi.fn(),
    ...overrides,
  }

  const view = render(<StudioScreen {...props} />)

  return { ...view, props }
}

/** A hand-made pending proposal, as the app state would hold it. */
const directProposal = (operation = nameplate) => ({
  operation,
  origin: { source: 'direct' as const, requestId: null, explanation: null, note: null },
})

const nameplate = testOperation({
  operationId: 'operation_studio01',
  sourceInterval: { start: ms(12_400), duration: ms(5_000) },
})

/** A project with one accepted nameplate visible from 12.4s to 17.4s. */
function projectWithNameplate(
  changeSetId = 'changeset_studio01',
  overrides: Parameters<typeof testOperation>[0] = {},
): EditProject {
  const base = testProject()
  const accepted = acceptChangeSet(base, testChangeSet(base.revision, changeSetId, {
    sourceInterval: { start: ms(12_400), duration: ms(5_000) },
    ...overrides,
  }))
  if (!accepted.ok) throw new Error(`fixture failed: ${JSON.stringify(accepted.error)}`)
  return accepted.value
}

describe('StudioScreen', () => {
  it('shows the selected filename and a real controlled video preview', () => {
    const { container } = renderStudio()

    expect(screen.getByText('cleaned-interview.mp4')).toBeInTheDocument()
    const video = container.querySelector('video')
    expect(video).toHaveAttribute('src', 'blob:cleaned-interview')
    expect(video).toHaveAttribute('controls')
    expect(video).not.toHaveAttribute('autoplay')
    expect(video).toHaveTextContent(/browser does not support video playback/i)
  })

  it('shows a recoverable message without blaming the video when playback fails', async () => {
    const user = userEvent.setup()
    const onBack = vi.fn()
    const { container } = renderStudio({ onBack })
    const video = container.querySelector('video')

    expect(video).not.toBeNull()
    fireEvent.error(video as HTMLVideoElement)

    expect(screen.getByRole('alert')).toHaveTextContent(
      /could not be played.*unavailable.*reload.*go back/i,
    )

    await user.click(screen.getByRole('button', { name: /back to home/i }))
    expect(onBack).toHaveBeenCalledOnce()
  })

  it('labels a non-empty request as a draft that has not been executed', () => {
    renderStudio()

    expect(screen.getByText(/draft — not executed/i)).toBeInTheDocument()
    expect(screen.getByText('Tighten the opening pause.')).toBeInTheDocument()
  })

  it('shows an honest prompt placeholder when no draft was supplied', () => {
    renderStudio({
      project: {
        id: 'project_1234567890abcdef',
        name: 'cleaned-interview.mp4',
        mediaUrl: 'blob:cleaned-interview',
        draftRequest: '   ',
      },
    })

    expect(screen.getByText(/no draft request yet/i)).toBeInTheDocument()
  })

  it('keeps export unavailable without accepted edits, but the assistant is open for business', () => {
    renderStudio()

    const exportButton = screen.getByRole('button', { name: /export unavailable/i })
    const chat = screen.getByRole('textbox', { name: /ask for an edit/i })
    const accept = screen.getByRole('button', { name: /accept proposal unavailable/i })

    expect(exportButton).toBeDisabled()
    expect(accept).toBeDisabled()
    expect(chat).toBeEnabled()
    expect(exportButton).toHaveAccessibleDescription(/accept at least one edit/i)
  })

  it('closes the assistant while a proposal is pending, so only one thing is decided at a time', () => {
    renderStudio({ proposal: directProposal() })

    expect(screen.getByRole('textbox', { name: /ask for an edit/i })).toBeDisabled()
    expect(screen.getByRole('button', { name: /^send$/i })).toBeDisabled()
  })

  it('sends what the user typed together with where they are in the video', async () => {
    const user = userEvent.setup()
    const onSendMessage = vi.fn()
    renderStudio({ onSendMessage })

    await user.type(screen.getByRole('textbox', { name: /ask for an edit/i }), 'put my name here')
    await user.click(screen.getByRole('button', { name: /^send$/i }))

    expect(onSendMessage).toHaveBeenCalledOnce()
    const [message, context] = onSendMessage.mock.calls[0]
    expect(message).toBe('put my name here')
    expect(context.clipId).toBe(TEST_CLIP_ID)
    expect(context.compositionWidth).toBe(1920)
    // Nobody pointed, so the assistant is told that plainly instead of being
    // given a made-up position.
    expect(context.point).toBeNull()
  })

  it('shows the assistant question instead of guessing', () => {
    renderStudio({
      conversation: {
        status: 'clarification',
        lastMessage: 'add a nameplate',
        question: 'What should the text say?',
        notice: null,
      },
    })

    expect(screen.getByText('What should the text say?')).toBeInTheDocument()
  })

  it('says plainly when an edit is not supported yet', () => {
    renderStudio({
      conversation: {
        status: 'unsupported',
        lastMessage: 'add background music',
        question: null,
        notice: 'This version can add text to your video. It cannot do that yet.',
      },
    })

    expect(screen.getByText(/cannot do that yet/i)).toBeInTheDocument()
  })

  it('marks an assistant proposal as coming from the assistant', () => {
    renderStudio({
      proposal: {
        operation: nameplate,
        origin: { source: 'ai', requestId: 'request_aaaaaaaa', explanation: 'Shows "Santosh".', note: 'Placed where you pointed.' },
      },
    })

    expect(screen.getByText(/suggested by the assistant/i)).toBeInTheDocument()
    expect(screen.getByText(/placed where you pointed/i)).toBeInTheDocument()
  })

  it('repairs a pending proposal by hand without asking the assistant again', async () => {
    const user = userEvent.setup()
    const onRepairProposal = vi.fn()
    const onSendMessage = vi.fn()
    renderStudio({ proposal: directProposal(), onRepairProposal, onSendMessage })

    const primary = screen.getByLabelText(/main text/i)
    await user.clear(primary)
    await user.type(primary, 'Santosh Budha')
    await user.tab()

    expect(onRepairProposal).toHaveBeenCalledWith({ primaryText: 'Santosh Budha' })
    expect(onSendMessage).not.toHaveBeenCalled()
  })

  it('presents export progress, recoverable failure, and a downloadable result', async () => {
    const user = userEvent.setup()
    const accepted = projectWithNameplate()
    const onExport = vi.fn()
    const { rerender, props } = renderStudio({ editProject: accepted, onExport })

    await user.click(screen.getByRole('button', { name: /export video/i }))
    expect(onExport).toHaveBeenCalledOnce()

    rerender(<StudioScreen {...props} editProject={accepted} exportState={{ status: 'rendering' }} />)
    expect(screen.getByRole('status', { name: /export status/i })).toHaveTextContent(/rendering/i)
    expect(screen.getByRole('button', { name: /exporting video/i })).toBeDisabled()

    rerender(<StudioScreen {...props} editProject={accepted} exportState={{ status: 'error', message: 'We could not export the video. Your accepted edits are still safe.' }} />)
    expect(screen.getByRole('alert')).toHaveTextContent(/accepted edits are still safe/i)
    expect(screen.getByRole('button', { name: /export video/i })).toBeEnabled()
    await user.click(screen.getByRole('button', { name: /retry export/i }))
    expect(onExport).toHaveBeenCalledTimes(2)

    rerender(<StudioScreen {...props} editProject={accepted} exportState={{ status: 'ready', result: {
      id: 'export_1234567890abcdef',
      mediaUrl: '/api/projects/project_1234567890abcdef/exports/export_1234567890abcdef/media',
      sha256: 'b'.repeat(64), width: 1920, height: 1080, durationMs: 60_000, hasAudio: true,
    } }} />)
    expect(screen.getByRole('link', { name: /download mp4/i })).toHaveAttribute('href', '/api/projects/project_1234567890abcdef/exports/export_1234567890abcdef/media')
  })

  it('shows whether canonical edit history is saving, saved, or unsafe to leave', () => {
    const { rerender, props } = renderStudio({ saveState: 'saving' })
    expect(screen.getByRole('status', { name: /project save status/i })).toHaveTextContent(/saving/i)

    rerender(<StudioScreen {...props} saveState="saved" />)
    expect(screen.getByRole('status', { name: /project save status/i })).toHaveTextContent(/saved locally/i)

    rerender(<StudioScreen {...props} saveState="error" />)
    expect(screen.getByRole('alert')).toHaveTextContent(/could not be saved locally/i)
  })

  it('returns Home exactly once from the Back action', async () => {
    const user = userEvent.setup()
    const onBack = vi.fn()
    renderStudio({ onBack })

    await user.click(screen.getByRole('button', { name: /back to home/i }))

    expect(onBack).toHaveBeenCalledOnce()
  })

  it('names the three primary Studio regions for assistive technology', () => {
    renderStudio()

    expect(screen.getByRole('region', { name: 'Video canvas' })).toBeInTheDocument()
    expect(screen.getByRole('complementary', { name: 'Conversation' })).toBeInTheDocument()
    expect(screen.getByRole('region', { name: 'Simple time strip' })).toBeInTheDocument()
    expect(screen.getByText(/point targeting and text proposals available/i)).toBeInTheDocument()
  })

  it('never reports that a draft or edit was executed successfully', () => {
    renderStudio()

    expect(screen.queryByText(/executed successfully/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/edit (?:was )?applied/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/export (?:is )?ready/i)).not.toBeInTheDocument()
  })

  it('offers Point mode without blocking ordinary video controls', () => {
    const { container } = renderStudio()

    expect(screen.getByRole('button', { name: /enter point mode/i })).toBeEnabled()
    expect(container.querySelector('video')).toHaveAttribute('controls')
    expect(screen.queryByRole('button', { name: /choose a point on the visible video/i })).not.toBeInTheDocument()
  })

  it('pauses playback and exposes a temporary accessible pointer layer in Point mode', async () => {
    const user = userEvent.setup()
    const { container } = renderStudio()
    const video = container.querySelector('video') as HTMLVideoElement
    const pause = vi.spyOn(video, 'pause').mockImplementation(() => undefined)

    await user.click(screen.getByRole('button', { name: /enter point mode/i }))

    expect(pause).toHaveBeenCalledOnce()
    expect(screen.getByRole('button', { name: /choose a point on the visible video/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /cancel point mode/i })).toBeEnabled()
    expect(screen.getByRole('status', { name: /point guidance/i })).toHaveTextContent(/click or use arrow keys/i)
  })

  it('captures one point, displays its marker and time, then restores normal playback mode', async () => {
    const user = userEvent.setup()
    const { container } = renderStudio()
    const video = container.querySelector('video') as HTMLVideoElement
    vi.spyOn(video, 'pause').mockImplementation(() => undefined)
    prepareVideoForPointing(video)

    await user.click(screen.getByRole('button', { name: /enter point mode/i }))
    fireEvent.click(screen.getByRole('button', { name: /choose a point on the visible video/i }), {
      clientX: 300,
      clientY: 250,
    })

    expect(screen.getByRole('img', { name: /selected point/i })).toHaveStyle({ left: '50%', top: '50%' })
    expect(screen.getByText('Here · 00:12.400')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /choose a point on the visible video/i })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: /enter point mode/i })).toBeEnabled()
    expect(video).toHaveAttribute('controls')
  })

  it('remaps a captured normalized target when the video element changes size', async () => {
    const user = userEvent.setup()
    const { container } = renderStudio()
    const video = container.querySelector('video') as HTMLVideoElement
    vi.spyOn(video, 'pause').mockImplementation(() => undefined)
    prepareVideoForPointing(video)

    await user.click(screen.getByRole('button', { name: /enter point mode/i }))
    fireEvent.click(screen.getByRole('button', { name: /choose a point on the visible video/i }), {
      clientX: 200,
      clientY: 193.75,
    })

    const marker = screen.getByRole('img', { name: /selected point/i })
    expect(marker).toHaveStyle({ left: '25%', top: '35.9375%' })

    vi.spyOn(video, 'getBoundingClientRect').mockReturnValue({
      x: 100,
      y: 50,
      left: 100,
      top: 50,
      right: 700,
      bottom: 350,
      width: 600,
      height: 300,
      toJSON: () => ({}),
    })
    act(() => resizeObserverCallback?.([], {} as ResizeObserver))

    expect(marker).toHaveStyle({ left: '27.777778%', top: '25%' })
  })

  it('focuses a keyboard cursor, moves it in normalized steps, and captures at the current time', async () => {
    const user = userEvent.setup()
    const { container } = renderStudio()
    const video = container.querySelector('video') as HTMLVideoElement
    vi.spyOn(video, 'pause').mockImplementation(() => undefined)
    prepareVideoForPointing(video, 7.25)

    await user.click(screen.getByRole('button', { name: /enter point mode/i }))

    const pointLayer = screen.getByRole('button', { name: /choose a point on the visible video/i })
    const cursor = screen.getByRole('img', { name: /point cursor/i })
    expect(pointLayer).toHaveFocus()
    expect(cursor).toHaveStyle({ left: '50%', top: '50%' })

    await user.keyboard('{ArrowRight}{ArrowDown}{Enter}')

    expect(screen.getByRole('img', { name: /selected point/i })).toHaveStyle({
      left: '55%',
      top: '52.8125%',
    })
    expect(screen.getByText(/here .* 00:07\.250/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /enter point mode/i })).toHaveFocus()
  })

  it('rejects a click in letterboxing and keeps Point mode available for correction', async () => {
    const user = userEvent.setup()
    const { container } = renderStudio()
    const video = container.querySelector('video') as HTMLVideoElement
    vi.spyOn(video, 'pause').mockImplementation(() => undefined)
    prepareVideoForPointing(video)

    await user.click(screen.getByRole('button', { name: /enter point mode/i }))
    fireEvent.click(screen.getByRole('button', { name: /choose a point on the visible video/i }), {
      clientX: 300,
      clientY: 80,
    })

    expect(screen.getByRole('alert')).toHaveTextContent(/inside the visible video/i)
    expect(screen.getByRole('button', { name: /choose a point on the visible video/i })).toBeInTheDocument()
    expect(screen.queryByRole('img', { name: /selected point/i })).not.toBeInTheDocument()
  })

  it('cancels Point mode with Escape and returns focus to the Point mode action', async () => {
    const user = userEvent.setup()
    const { container } = renderStudio()
    const video = container.querySelector('video') as HTMLVideoElement
    vi.spyOn(video, 'pause').mockImplementation(() => undefined)

    await user.click(screen.getByRole('button', { name: /enter point mode/i }))
    await user.keyboard('{Escape}')

    const pointButton = screen.getByRole('button', { name: /enter point mode/i })
    expect(screen.queryByRole('button', { name: /choose a point on the visible video/i })).not.toBeInTheDocument()
    expect(pointButton).toHaveFocus()
  })

  it('lets the visible Cancel button keep its native Enter behavior', async () => {
    const user = userEvent.setup()
    const { container } = renderStudio()
    const video = container.querySelector('video') as HTMLVideoElement
    vi.spyOn(video, 'pause').mockImplementation(() => undefined)
    prepareVideoForPointing(video)

    await user.click(screen.getByRole('button', { name: /enter point mode/i }))
    await user.tab()

    const cancelButton = screen.getByRole('button', { name: /cancel point mode/i })
    expect(cancelButton).toHaveFocus()
    await user.keyboard('{Enter}')

    expect(screen.queryByRole('button', { name: /choose a point on the visible video/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('img', { name: /selected point/i })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: /enter point mode/i })).toHaveFocus()
  })

  it('turns a captured point into one bounded text proposal without accepting it', async () => {
    const user = userEvent.setup()
    const onProposal = vi.fn()
    const { container } = renderStudio({ onProposal })
    const video = container.querySelector('video') as HTMLVideoElement
    vi.spyOn(video, 'pause').mockImplementation(() => undefined)
    prepareVideoForPointing(video, 12.4)

    const addText = screen.getByRole('button', { name: /add text here/i })
    expect(addText).toBeDisabled()

    await user.click(screen.getByRole('button', { name: /enter point mode/i }))
    fireEvent.click(screen.getByRole('button', { name: /choose a point on the visible video/i }), {
      clientX: 300,
      clientY: 250,
    })

    expect(addText).toBeEnabled()
    await user.click(addText)
    await user.type(screen.getByRole('textbox', { name: /^main text$/i }), 'Santosh')
    await user.type(screen.getByRole('textbox', { name: /smaller line.*optional/i }), 'Founder')
    await user.click(screen.getByRole('button', { name: /create proposal/i }))

    expect(onProposal).toHaveBeenCalledWith(
      expect.objectContaining({
        primaryText: 'Santosh',
        secondaryText: 'Founder',
        // The nameplate attaches to a clip, not to raw source time, so it
        // moves with that clip when the timeline is cut later.
        assetId: expect.stringMatching(/^asset_/),
        sourceInterval: {
          start: ms(12_400),
          duration: ms(5_000),
        },
      }),
    )
    expect(screen.getByText(/no pending proposal/i)).toBeInTheDocument()
    expect(screen.getByText(/no accepted edits/i)).toBeInTheDocument()
  })

  it('discards an unaccepted proposal when the user captures a different point', async () => {
    const user = userEvent.setup()
    const onDiscardProposal = vi.fn()
    const { container } = renderStudio({
      proposal: directProposal({ ...nameplate, primaryText: 'Old proposal' }),
      onDiscardProposal,
    })
    const video = container.querySelector('video') as HTMLVideoElement
    vi.spyOn(video, 'pause').mockImplementation(() => undefined)
    prepareVideoForPointing(video, 12.4)

    expect(screen.getByText('Old proposal')).toBeInTheDocument()

    video.currentTime = 20
    await user.click(screen.getByRole('button', { name: /enter point mode/i }))
    fireEvent.click(screen.getByRole('button', { name: /choose a point on the visible video/i }), {
      clientX: 400,
      clientY: 250,
    })

    expect(onDiscardProposal).toHaveBeenCalledOnce()
    expect(screen.getByText(/here.*00:20\.000/i)).toBeInTheDocument()
  })

  it('previews a proposal only inside its exact time window over contain-fitted content', () => {
    const { container } = renderStudio({ proposal: directProposal() })
    const video = container.querySelector('video') as HTMLVideoElement
    prepareVideoForPointing(video, 12.4)

    fireEvent.loadedMetadata(video)
    act(() => {
      videoFrameCallback?.(0, { mediaTime: 12.4 } as VideoFrameCallbackMetadata)
    })

    const contentLayer = screen.getByTestId('video-content-layer')
    expect(contentLayer).toHaveStyle({
      left: '0%',
      top: '21.875%',
      width: '100%',
      height: '56.25%',
    })
    // Position now comes from the shared placement rule after each line box
    // measures itself. jsdom reports a zero-sized box, so the lines stay hidden
    // rather than being drawn somewhere they do not belong.
    expect(container.querySelector('.nameplate-overlay__primary')).toHaveStyle({ visibility: 'hidden' })
    // Two boxes, one per line, exactly as FFmpeg's drawtext draws them.
    expect(container.querySelectorAll('.nameplate-overlay__primary, .nameplate-overlay__secondary')).toHaveLength(2)

    video.currentTime = 17.4
    act(() => {
      videoFrameCallback?.(1, { mediaTime: 17.4 } as VideoFrameCallbackMetadata)
    })
    expect(screen.queryByTestId('nameplate-overlay')).not.toBeInTheDocument()
  })

  it('keeps the preview alive on media events even when frame callbacks never fire', () => {
    // A browser can expose requestVideoFrameCallback and still never call it —
    // a background tab, a decoder that presents no frame. Verified in a real
    // browser on 2026-07-27, where it fired zero times and the preview showed
    // nothing at all while looking perfectly healthy. Media events are the
    // safety net that stops the preview from silently going blank.
    const { container } = renderStudio({ proposal: directProposal() })
    const video = container.querySelector('video') as HTMLVideoElement
    prepareVideoForPointing(video, 0)
    fireEvent.loadedMetadata(video)
    expect(videoFrameCallback).not.toBeNull()

    video.currentTime = 12.4
    fireEvent.seeked(video)
    expect(screen.getByTestId('nameplate-overlay')).toHaveTextContent('Santosh')

    video.currentTime = 17.4
    fireEvent.timeUpdate(video)
    expect(screen.queryByTestId('nameplate-overlay')).not.toBeInTheDocument()
  })

  it('prefers the exact frame time when frame callbacks do fire', () => {
    const { container } = renderStudio({ proposal: directProposal() })
    const video = container.querySelector('video') as HTMLVideoElement
    prepareVideoForPointing(video, 0)
    fireEvent.loadedMetadata(video)

    // The element's currentTime lags the presented frame; the frame's own
    // mediaTime is the accurate one, so it must win.
    act(() => {
      videoFrameCallback?.(0, { mediaTime: 12.4 } as VideoFrameCallbackMetadata)
    })
    expect(screen.getByTestId('nameplate-overlay')).toHaveTextContent('Santosh')
  })

  it('falls back to media events and removes them when frame callbacks are unavailable', () => {
    delete (HTMLVideoElement.prototype as Partial<HTMLVideoElement>).requestVideoFrameCallback
    delete (HTMLVideoElement.prototype as Partial<HTMLVideoElement>).cancelVideoFrameCallback
    const removeEventListener = vi.spyOn(HTMLMediaElement.prototype, 'removeEventListener')
    const { container, unmount } = renderStudio({ proposal: directProposal() })
    const video = container.querySelector('video') as HTMLVideoElement
    prepareVideoForPointing(video, 12.4)
    fireEvent.loadedMetadata(video)
    fireEvent.timeUpdate(video)

    expect(screen.getByTestId('nameplate-overlay')).toHaveTextContent('Santosh')

    unmount()
    expect(removeEventListener).toHaveBeenCalledWith('timeupdate', expect.any(Function))
    expect(removeEventListener).toHaveBeenCalledWith('seeked', expect.any(Function))
  })

  it('synchronizes the exact preview window to presented video frames and cleans up', () => {
    const { container, unmount } = renderStudio({ proposal: directProposal() })
    const video = container.querySelector('video') as HTMLVideoElement
    prepareVideoForPointing(video, 0)
    fireEvent.loadedMetadata(video)

    expect(videoFrameCallback).not.toBeNull()

    act(() => {
      videoFrameCallback?.(0, { mediaTime: 12.399 } as VideoFrameCallbackMetadata)
    })
    expect(screen.queryByTestId('nameplate-overlay')).not.toBeInTheDocument()

    act(() => {
      videoFrameCallback?.(1, { mediaTime: 12.4 } as VideoFrameCallbackMetadata)
    })
    expect(screen.getByTestId('nameplate-overlay')).toHaveTextContent('Santosh')

    act(() => {
      videoFrameCallback?.(2, { mediaTime: 17.4 } as VideoFrameCallbackMetadata)
    })
    expect(screen.queryByTestId('nameplate-overlay')).not.toBeInTheDocument()

    unmount()
    expect(cancelVideoFrameCallback).toHaveBeenCalledWith(7)
  })

  it('describes the proposal duration from the typed action', () => {
    renderStudio({
      proposal: directProposal(testOperation({
        operationId: 'operation_studio02',
        sourceInterval: { start: ms(12_400), duration: ms(2_500) },
      })),
    })

    const proposalSection = screen.getByRole('heading', { name: /^proposal$/i }).closest('section')
    expect(proposalSection).toHaveTextContent(/2\.5 seconds/i)
    expect(proposalSection).not.toHaveTextContent(/· 5 seconds/i)
  })

  it('offers explicit accept and discard actions for a pending proposal', async () => {
    const user = userEvent.setup()
    const onAcceptProposal = vi.fn()
    const onDiscardProposal = vi.fn()
    renderStudio({ proposal: directProposal(), onAcceptProposal, onDiscardProposal })

    await user.click(screen.getByRole('button', { name: /^accept proposal$/i }))
    await user.click(screen.getByRole('button', { name: /^discard proposal$/i }))

    expect(onAcceptProposal).toHaveBeenCalledOnce()
    expect(onDiscardProposal).toHaveBeenCalledOnce()
  })

  it('moves focus to an announced result after a proposal is accepted', async () => {
    const user = userEvent.setup()
    const onAcceptProposal = vi.fn()
    const { rerender } = renderStudio({ proposal: directProposal(), onAcceptProposal })

    await user.click(screen.getByRole('button', { name: /^accept proposal$/i }))
    expect(onAcceptProposal).toHaveBeenCalledOnce()

    rerender(
      <StudioScreen
        project={{
          id: 'project_1234567890abcdef',
          name: 'cleaned-interview.mp4',
          mediaUrl: 'blob:cleaned-interview',
          draftRequest: '',
        }}
        proposal={null}
        editProject={projectWithNameplate()}
        editError={null}
        conversation={{ status: 'ready', lastMessage: '', question: null, notice: null }}
        onRepairProposal={vi.fn()}
        onTimelineEdit={vi.fn()}
        onCreateOverlay={async () => null}
        onUploadAsset={async () => 'not used'}
        assetUrl={(assetId: string) => `/api/projects/p/assets/${assetId}/media`}
        onAddCaptions={vi.fn(async () => null)}
        onSendMessage={vi.fn()}
        onProposal={vi.fn()}
        onDiscardProposal={vi.fn()}
        onAcceptProposal={onAcceptProposal}
        onUndo={vi.fn()}
        onRedo={vi.fn()}
        exportState={{ status: 'idle' }}
        saveState="idle"
        onExport={vi.fn()}
        onBack={vi.fn()}
      />,
    )

    const result = screen.getByRole('status', { name: /proposal result/i })
    expect(result).toHaveTextContent(/^proposal accepted\.$/i)
    expect(result).toHaveFocus()
  })

  it('renders accepted history but never renders the redo stack', () => {
    // Accept two edits, then undo one so it sits on the redo stack. An edit
    // waiting to be redone must not appear as if it were applied.
    const first = projectWithNameplate()
    const second = acceptChangeSet(first, testChangeSet(first.revision, 'changeset_studio02', {
      operationId: 'operation_studio02',
      primaryText: 'Redo only',
      sourceInterval: { start: ms(12_400), duration: ms(5_000) },
    }))
    if (!second.ok) throw new Error('fixture failed')
    const undone = undoChangeSet(second.value)
    if (!undone.ok) throw new Error('fixture failed')

    const { container } = renderStudio({ editProject: undone.value })
    const video = container.querySelector('video') as HTMLVideoElement
    prepareVideoForPointing(video, 12.4)
    fireEvent.loadedMetadata(video)
    fireEvent.timeUpdate(video)

    expect(screen.getAllByText('Santosh').length).toBeGreaterThan(0)
    expect(screen.queryByText('Redo only')).not.toBeInTheDocument()
  })

  it('enables undo and redo from canonical history and blocks both while a proposal is pending', () => {
    const editProject = projectWithNameplate()
    const { rerender } = renderStudio({ editProject })

    expect(screen.getByRole('button', { name: /^undo edit$/i })).toBeEnabled()
    expect(screen.getByRole('button', { name: /^redo edit$/i })).toBeDisabled()

    rerender(
      <StudioScreen
        project={{
          id: 'project_1234567890abcdef',
          name: 'cleaned-interview.mp4',
          mediaUrl: 'blob:cleaned-interview',
          draftRequest: '',
        }}
        proposal={directProposal()}
        editProject={editProject}
        editError={null}
        conversation={{ status: 'ready', lastMessage: '', question: null, notice: null }}
        onRepairProposal={vi.fn()}
        onTimelineEdit={vi.fn()}
        onCreateOverlay={async () => null}
        onUploadAsset={async () => 'not used'}
        assetUrl={(assetId: string) => `/api/projects/p/assets/${assetId}/media`}
        onAddCaptions={vi.fn(async () => null)}
        onSendMessage={vi.fn()}
        onProposal={vi.fn()}
        onDiscardProposal={vi.fn()}
        onAcceptProposal={vi.fn()}
        onUndo={vi.fn()}
        onRedo={vi.fn()}
        exportState={{ status: 'idle' }}
        saveState="idle"
        onExport={vi.fn()}
        onBack={vi.fn()}
      />,
    )

    expect(screen.getByRole('button', { name: /^undo edit$/i })).toBeDisabled()
    expect(screen.getByRole('button', { name: /^redo edit$/i })).toBeDisabled()
  })

  it('shows edit transition failures visibly', () => {
    renderStudio({ editError: 'This proposal could not be accepted.' })

    expect(screen.getByRole('alert')).toHaveTextContent(/could not be accepted/i)
  })
})

/**
 * The time strip is the only place a non-editor can cut. These check the whole
 * path from "the playhead is here" to "this is the operation the server gets",
 * because a strip that draws correctly but sends the wrong cut is worse than
 * one that does not draw at all.
 */
describe('StudioScreen time strip', () => {
  it('shows the whole video as one section before anything is cut', () => {
    renderStudio()

    const sections = screen.getAllByTestId('timeline-section')
    expect(sections).toHaveLength(1)
    expect(sections[0]).toHaveStyle({ left: '0%', width: '100%' })
  })

  it('sends a cut measured from the start of the section the playhead is in', async () => {
    const user = userEvent.setup()
    const onTimelineEdit = vi.fn()
    const { container } = renderStudio({ onTimelineEdit })

    const video = container.querySelector('video') as HTMLVideoElement
    prepareVideoForPointing(video, 12)
    act(() => {
      video.dispatchEvent(new Event('timeupdate'))
    })

    await user.click(screen.getByRole('button', { name: /^cut here$/i }))

    expect(onTimelineEdit).toHaveBeenCalledTimes(1)
    const operation = onTimelineEdit.mock.calls[0][0]
    expect(operation.kind).toBe('split-clip')
    expect(operation.atClipTime.ticks).toBe(12 * 1_440_000)
    // It carries a capability that is actually allowed to produce this kind of
    // edit, so the server's registry check passes rather than silently failing.
    expect(operation.capabilityId).toBe('sanverse.timeline.split.primitive/v1')
  })

  it('explains in plain words why a cut at the very start is not a cut', async () => {
    const user = userEvent.setup()
    const onTimelineEdit = vi.fn()
    renderStudio({ onTimelineEdit })

    await user.click(screen.getByRole('button', { name: /^cut here$/i }))

    expect(onTimelineEdit).not.toHaveBeenCalled()
    expect(screen.getByText(/edge of a section/i)).toBeInTheDocument()
  })

  it('refuses to remove the only section, and sends nothing', async () => {
    const user = userEvent.setup()
    const onTimelineEdit = vi.fn()
    const { container } = renderStudio({ onTimelineEdit })

    const video = container.querySelector('video') as HTMLVideoElement
    prepareVideoForPointing(video, 5)
    act(() => {
      video.dispatchEvent(new Event('timeupdate'))
    })

    await user.click(screen.getByRole('button', { name: /remove this section/i }))

    expect(onTimelineEdit).not.toHaveBeenCalled()
    expect(screen.getByText(/only section/i)).toBeInTheDocument()
  })

  it('locks cutting while a proposal is waiting to be approved', () => {
    // A cut would move the footage the pending nameplate is anchored to, so the
    // two are kept apart rather than allowed to race.
    renderStudio({
      proposal: {
        operation: testOperation(),
        origin: { source: 'direct', requestId: null, explanation: null, note: null },
      },
    })

    expect(screen.getByRole('button', { name: /^cut here$/i })).toBeDisabled()
  })
})
