import type { ComponentProps } from 'react'
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { acceptChangeSet, undoChangeSet, type EditOperation, type EditProject } from '@sanverse/edit-domain'

import { StudioScreen } from './StudioScreen'
import { TEST_ASSET_ID, TEST_CLIP_ID, ms, testChangeSet, testOperation, testProject } from '../../test-fixtures'

afterEach(() => {
  cleanup()
  window.localStorage.removeItem('sanverse.workspace-layout/v1')
  window.localStorage.removeItem('sanverse.studio-layout/v2')
  vi.restoreAllMocks()
})

let resizeObserverCallback: ResizeObserverCallback | null = null
let videoFrameCallback: VideoFrameRequestCallback | null = null
let cancelVideoFrameCallback: ReturnType<typeof vi.fn>
const originalInnerWidth = window.innerWidth
const originalInnerHeight = window.innerHeight

beforeEach(() => {
  Object.defineProperty(window, 'innerWidth', { configurable: true, value: 1440 })
  Object.defineProperty(window, 'innerHeight', { configurable: true, value: 900 })
  window.localStorage.removeItem('sanverse.workspace-layout/v1')
  window.localStorage.removeItem('sanverse.studio-layout/v2')
  resizeObserverCallback = null
  videoFrameCallback = null
  cancelVideoFrameCallback = vi.fn()
  vi.stubGlobal(
    'ResizeObserver',
    class ResizeObserverMock {
      readonly callback: ResizeObserverCallback

      constructor(callback: ResizeObserverCallback) {
        this.callback = callback
      }

      observe(target: Element) {
        if (target instanceof HTMLVideoElement) resizeObserverCallback = this.callback
      }
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
  Object.defineProperty(window, 'innerWidth', { configurable: true, value: originalInnerWidth })
  Object.defineProperty(window, 'innerHeight', { configurable: true, value: originalInnerHeight })
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

const canvasDomRect = (x: number, y: number, width: number, height: number): DOMRect => ({
  x,
  y,
  left: x,
  top: y,
  right: x + width,
  bottom: y + height,
  width,
  height,
  toJSON: () => ({}),
} as DOMRect)

function prepareCanvasGeometry(container: HTMLElement, currentTime = 12.4) {
  vi.stubGlobal('PointerEvent', MouseEvent)
  const video = container.querySelector('video') as HTMLVideoElement
  prepareVideoForPointing(video, currentTime)
  fireEvent.loadedMetadata(video)
  fireEvent.timeUpdate(video)

  const contentLayer = screen.getByTestId('video-content-layer')
  Object.defineProperties(contentLayer, {
    clientWidth: { configurable: true, value: 400 },
    clientHeight: { configurable: true, value: 225 },
  })
  vi.spyOn(contentLayer, 'getBoundingClientRect').mockReturnValue(canvasDomRect(100, 137.5, 400, 225))

  const root = contentLayer.querySelector<HTMLElement>('[data-node-id]')
  if (!root) throw new Error('Expected a visible preview node')
  vi.spyOn(root, 'getBoundingClientRect').mockReturnValue(canvasDomRect(180, 220, 120, 40))
  root.querySelectorAll<HTMLElement>('*').forEach((child) => {
    vi.spyOn(child, 'getBoundingClientRect').mockReturnValue(canvasDomRect(180, 220, 120, 40))
  })
  window.dispatchEvent(new Event('resize'))
  return { video, contentLayer, root }
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
    onApplyOperations: vi.fn(async () => null),
    onCreateOverlay: vi.fn(async () => null),
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

  const view = render(<StudioScreen {...props} />)

  return { ...view, props }
}

function renderStudioWithAi(overrides: Partial<ComponentProps<typeof StudioScreen>> = {}) {
  const view = renderStudio(overrides)
  const expand = screen.queryByRole('button', { name: 'Expand AI' })
  if (expand) fireEvent.click(expand)
  return view
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

function projectWithFootageMotion(): EditProject {
  const base = testProject()
  const operation: EditOperation = {
    schemaVersion: 'sanverse.operation/v3',
    operationId: 'operation_motion01',
    kind: 'set-footage-motion',
    capabilityId: 'sanverse.footage.motion.primitive/v1',
    motionId: 'motion_aaaaaaaa',
    assetId: TEST_ASSET_ID,
    sourceInterval: { start: ms(0), duration: ms(30_000) },
    transform: {
      translateX: 0,
      translateY: 0,
      scale: 1.2,
      rotationDegrees: 0,
      opacity: 1,
    },
    crop: { top: 0, right: 0, bottom: 0, left: 0 },
    tracks: [],
    extensions: {},
  }
  const accepted = acceptChangeSet(base, {
    schemaVersion: 'sanverse.change-set/v1',
    changeSetId: 'changeset_motion01',
    baseRevision: base.revision,
    operations: [operation],
    provenance: { source: 'direct', requestId: null },
    extensions: {},
  })
  if (!accepted.ok) throw new Error(`fixture failed: ${JSON.stringify(accepted.error)}`)
  return accepted.value
}

describe('StudioScreen', () => {
  it('shows the selected filename inside one custom editor monitor', () => {
    const { container } = renderStudio()

    expect(screen.getAllByText('cleaned-interview.mp4')).toHaveLength(3)
    const video = container.querySelector('video')
    expect(video).toHaveAttribute('src', 'blob:cleaned-interview')
    expect(video).not.toHaveAttribute('controls')
    expect(screen.getByRole('region', { name: 'Editor monitor' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Play' })).toBeInTheDocument()
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
    renderStudioWithAi()

    const exportButton = screen.getByRole('button', { name: /export unavailable/i })
    const chat = screen.getByRole('textbox', { name: /ask for an edit/i })

    expect(exportButton).toBeDisabled()
    expect(screen.queryByRole('button', { name: /accept proposal/i })).not.toBeInTheDocument()
    expect(chat).toBeEnabled()
    expect(exportButton).toHaveAccessibleDescription(/accept at least one edit/i)
  })

  it('closes the assistant while a proposal is pending, so only one thing is decided at a time', () => {
    renderStudioWithAi({ proposal: directProposal() })

    expect(screen.getByRole('textbox', { name: /ask for an edit/i })).toBeDisabled()
    expect(screen.getByRole('button', { name: /^send$/i })).toBeDisabled()
  })

  it('sends what the user typed together with where they are in the video', async () => {
    const user = userEvent.setup()
    const onSendMessage = vi.fn()
    renderStudioWithAi({ onSendMessage })

    fireEvent.change(screen.getByRole('textbox', { name: /ask for an edit/i }), { target: { value: 'put my name here' } })
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
    renderStudioWithAi({
      conversation: {
        status: 'clarification',
        lastMessage: 'add a nameplate',
        question: 'What should the text say?',
        notice: null,
      },
    })

    expect(screen.getByText('What should the text say?')).toBeInTheDocument()
  })

  it('announces one conversation failure instead of duplicating it in the proposal panel', () => {
    renderStudioWithAi({
      conversation: {
        status: 'error',
        lastMessage: 'add my name',
        question: null,
        notice: 'We could not prepare that proposal. Your accepted edits are still safe.',
      },
    })

    expect(screen.getAllByRole('alert')).toHaveLength(1)
    expect(screen.getByRole('alert')).toHaveTextContent(/accepted edits are still safe/i)
  })

  it('says plainly when an edit is not supported yet', () => {
    renderStudioWithAi({
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
    renderStudioWithAi({
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
    renderStudioWithAi({ proposal: directProposal(), onRepairProposal, onSendMessage })

    const primary = screen.getByLabelText(/main text/i)
    fireEvent.change(primary, { target: { value: 'Santosh Budha' } })
    fireEvent.blur(primary)

    expect(onRepairProposal).toHaveBeenCalledWith({ primaryText: 'Santosh Budha' })
    expect(onSendMessage).not.toHaveBeenCalled()
  })

  it('presents export progress, recoverable failure, and a downloadable result', async () => {
    const user = userEvent.setup()
    const accepted = projectWithNameplate()
    const onExport = vi.fn()
    const { rerender, props } = renderStudioWithAi({ editProject: accepted, onExport })

    await user.click(screen.getByRole('button', { name: /export video/i }))
    expect(onExport).toHaveBeenCalledOnce()

    rerender(<StudioScreen
      {...props}
      editProject={accepted}
      exportState={{ status: 'rendering', phase: 'rendering', jobId: 'job_abcdef0123456789', startedAt: Date.now() }}
    />)
    expect(screen.getByRole('status', { name: /export status/i })).toHaveTextContent(/rendering/i)
    // Elapsed time is part of the contract: a spinner alone cannot tell a
    // four-second export from a nine-minute stall.
    expect(screen.getByTestId('export-elapsed')).toHaveTextContent(/^\d+:\d{2}$/)
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
    const { rerender, props } = renderStudioWithAi({
      saveState: { status: 'saving', targetRevision: 4, persistedRevision: 3 },
    })
    expect(screen.getByRole('status', { name: /project save status/i })).toHaveTextContent(/saving/i)

    rerender(<StudioScreen {...props} saveState={{ status: 'saved', persistedRevision: 4 }} />)
    const saved = screen.getByRole('status', { name: /project save status/i })
    expect(saved).toHaveTextContent(/saved on this computer/i)
    // How much work is safe, said out loud rather than kept for engineers.
    expect(saved).toHaveTextContent(/4/)

    rerender(
      <StudioScreen
        {...props}
        saveState={{ status: 'failed', targetRevision: 5, persistedRevision: 4, refusal: 'WRITE_FAILED' }}
      />,
    )
    const failed = screen.getByRole('alert')
    // The message this replaced was "Local save needs attention": it said what
    // went wrong, offered nothing to press, and never went away.
    expect(failed).not.toHaveTextContent(/needs attention/i)
    expect(failed).toHaveTextContent(/could not be written/i)
    expect(failed).toHaveTextContent(/already saved/i)
  })

  it('returns Home exactly once from the Back action', async () => {
    const user = userEvent.setup()
    const onBack = vi.fn()
    renderStudio({ onBack })

    await user.click(screen.getByRole('button', { name: /back to home/i }))

    expect(onBack).toHaveBeenCalledOnce()
  })

  it('builds the five-region Studio frame around one existing video editor', () => {
    const { container } = renderStudioWithAi()

    expect(screen.getByRole('region', { name: 'Media dock' })).toBeInTheDocument()
    expect(screen.getByRole('region', { name: 'Program canvas' })).toBeInTheDocument()
    expect(screen.getByRole('region', { name: 'Inspector', hidden: true })).toBeInTheDocument()
    expect(screen.getByRole('complementary', { name: 'AI edit panel' })).toBeInTheDocument()
    expect(screen.getByRole('region', { name: 'Timeline workspace' })).toBeInTheDocument()
    expect(container.querySelectorAll('video')).toHaveLength(1)
  })

  it('shows the current project assets in the usable Media Bin', () => {
    renderStudio()

    const media = screen.getByRole('region', { name: 'Media dock' })
    expect(within(media).getByText('cleaned-interview.mp4')).toBeInTheDocument()
    expect(within(media).getByLabelText(/cleaned-interview\.mp4, Video, Used 1 time/i)).toBeInTheDocument()
    expect(within(media).getByLabelText(/cleaned-interview\.mp4, Video, Used 1 time/i)).toHaveTextContent('Video · 30 sec')
    expect(within(media).getByText('Used 1 time')).toBeInTheDocument()
    expect(within(media).getByRole('button', { name: 'Import media' })).toBeEnabled()
  })

  it('shows honest empty Media and Inspector states without a second project model', () => {
    renderStudio({
      editProject: { ...testProject(), assets: [] },
    })

    expect(screen.getByRole('region', { name: 'Media dock' }))
      .toHaveTextContent(/no media yet/i)
    expect(screen.getByRole('region', { name: 'Inspector' }))
      .toHaveTextContent(/nothing selected/i)
  })


  it('keeps the same chat composer and unsent text while the AI panel collapses', async () => {
    const user = userEvent.setup()
    renderStudioWithAi()

    const composer = screen.getByRole('textbox', { name: /ask for an edit/i })
    fireEvent.change(composer, { target: { value: 'keep this draft' } })
    await user.click(screen.getByRole('button', { name: /^collapse ai$/i }))

    expect(screen.getByRole('button', { name: /expand ai$/i }))
      .toHaveAttribute('aria-expanded', 'false')
    expect(screen.getByRole('textbox', { name: /ask for an edit/i, hidden: true })).toBe(composer)
    expect(composer).toHaveValue('keep this draft')

    await user.click(screen.getByRole('button', { name: /expand ai$/i }))
    expect(screen.getByRole('textbox', { name: /ask for an edit/i })).toBe(composer)
    expect(composer).toHaveValue('keep this draft')
  })

  it('shows a pending-proposal indicator while the AI panel is collapsed', async () => {
    const user = userEvent.setup()
    renderStudioWithAi({ proposal: directProposal() })

    await user.click(screen.getByRole('button', { name: /^collapse ai$/i }))

    expect(screen.getByRole('status', { name: /pending ai proposal/i }))
      .toHaveTextContent(/1 pending/i)
  })

  it('keeps every existing direct edit control inside the Studio timeline region', async () => {
    const user = userEvent.setup()
    renderStudio()

    const timeline = screen.getByRole('region', { name: 'Timeline workspace' })
    await user.click(within(timeline).getByText(/advanced direct controls/i))
    expect(within(timeline).getByRole('button', { name: /^cut here$/i })).toBeInTheDocument()
    expect(within(timeline).getByRole('button', { name: /remove this section/i })).toBeInTheDocument()
    expect(within(timeline).getByRole('button', { name: /hide this section/i })).toBeInTheDocument()
    expect(within(timeline).getByRole('button', { name: /bring it back/i })).toBeInTheDocument()
    expect(within(timeline).getByText(/adjust section at playhead/i)).toBeInTheDocument()
    expect(within(timeline).getByText(/captions and overlays/i)).toBeInTheDocument()
  })

  it('never reports that a draft or edit was executed successfully', () => {
    renderStudio()

    expect(screen.queryByText(/executed successfully/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/edit (?:was )?applied/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/export (?:is )?ready/i)).not.toBeInTheDocument()
  })

  it('offers Point mode beside the custom playback controls', () => {
    const { container } = renderStudio()

    expect(screen.getByRole('button', { name: /enter point mode/i })).toBeEnabled()
    expect(container.querySelector('video')).not.toHaveAttribute('controls')
    expect(screen.getByRole('button', { name: 'Play' })).toBeEnabled()
    expect(screen.queryByRole('button', { name: /choose a point on the visible video/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /add text here/i })).not.toBeInTheDocument()
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
    expect(video).not.toHaveAttribute('controls')
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

    await waitFor(() => expect(marker).toHaveStyle({ left: '27.777778%', top: '25%' }))
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

    expect(screen.queryByRole('button', { name: /add text here/i })).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /enter point mode/i }))
    fireEvent.click(screen.getByRole('button', { name: /choose a point on the visible video/i }), {
      clientX: 300,
      clientY: 250,
    })

    const addText = screen.getByRole('button', { name: /add text here/i })
    expect(addText).toBeEnabled()
    await user.click(addText)
    fireEvent.change(screen.getByRole('textbox', { name: /^main text$/i }), { target: { value: 'Santosh' } })
    fireEvent.change(screen.getByRole('textbox', { name: /smaller line.*optional/i }), { target: { value: 'Founder' } })
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
    expect(screen.getByText(/tell sanverse what you want to change/i)).toBeInTheDocument()
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
    renderStudioWithAi({
      proposal: directProposal(testOperation({
        operationId: 'operation_studio02',
        sourceInterval: { start: ms(12_400), duration: ms(2_500) },
      })),
    })

    const proposalSection = screen.getByRole('heading', { name: /^proposal$/i }).closest('section')
    expect(proposalSection).toHaveTextContent(/2\.5 seconds/i)
    expect(proposalSection).not.toHaveTextContent(/· 5 seconds/i)
  })

  it('offers explicit accept and reject actions for a pending proposal', async () => {
    const user = userEvent.setup()
    const onAcceptProposal = vi.fn()
    const onDiscardProposal = vi.fn()
    renderStudioWithAi({ proposal: directProposal(), onAcceptProposal, onDiscardProposal })

    await user.click(screen.getByRole('button', { name: /^accept proposal$/i }))
    await user.click(screen.getByRole('button', { name: /^reject proposal$/i }))

    expect(onAcceptProposal).toHaveBeenCalledOnce()
    expect(onDiscardProposal).toHaveBeenCalledOnce()
  })

  it('moves focus to an announced result after a proposal is accepted', async () => {
    const user = userEvent.setup()
    const onAcceptProposal = vi.fn()
    const { rerender } = renderStudioWithAi({ proposal: directProposal(), onAcceptProposal })

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
        onApplyOperations={async () => null}
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
        saveState={{ status: 'saved', persistedRevision: 0 }}
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
        onApplyOperations={async () => null}
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
        saveState={{ status: 'saved', persistedRevision: 0 }}
        onExport={vi.fn()}
        onBack={vi.fn()}
      />,
    )

    expect(screen.getByRole('button', { name: /^undo edit$/i })).toBeDisabled()
    expect(screen.getByRole('button', { name: /^redo edit$/i })).toBeDisabled()
  })

  it('shows edit transition failures visibly', () => {
    renderStudioWithAi({ editError: 'This proposal could not be accepted.' })

    expect(screen.getByRole('alert')).toHaveTextContent(/could not be accepted/i)
  })
})

/**
 * Timeline V1 is the primary surface. These retain coverage for the temporary
 * proven direct-control fallback and the exact operation path it uses.
 */
describe('StudioScreen production timeline', () => {
  async function openAdvancedControls(user: ReturnType<typeof userEvent.setup>) {
    await user.click(screen.getByText(/advanced direct controls/i))
  }

  it('shows the whole video as one V1 clip before anything is cut', () => {
    renderStudio()

    const videoLane = screen.getByRole('group', { name: /V1 video lane/i })
    const videoItem = within(videoLane).getByRole('button', { name: /^clip, cleaned-interview\.mp4,/i })
    expect(videoItem).toHaveAttribute('aria-selected', 'false')
    expect(videoItem.closest('[data-testid="timeline-item-shell"]')).toHaveAttribute('data-canonical-left', '0')
  })

  it('refreshes client-space geometry on document scroll without changing selection or creating an edit', async () => {
    const user = userEvent.setup()
    const onCreateOverlay = vi.fn(async () => null)
    const { container } = renderStudio({ onCreateOverlay })
    const video = container.querySelector('video') as HTMLVideoElement
    prepareVideoForPointing(video)
    fireEvent.loadedMetadata(video)

    const videoLane = screen.getByRole('group', { name: /V1 video lane/i })
    const videoItem = within(videoLane).getByRole('button', { name: /^clip, cleaned-interview\.mp4,/i })
    await user.click(videoItem)
    const videoCount = container.querySelectorAll('video').length

    act(() => window.dispatchEvent(new Event('scroll')))

    expect(videoItem).toHaveAttribute('aria-selected', 'true')
    expect(container.querySelectorAll('video')).toHaveLength(videoCount)
    expect(onCreateOverlay).not.toHaveBeenCalled()
  })

  it('opens the authoritative Inspector from Timeline selection and applies one existing audio operation', async () => {
    const user = userEvent.setup()
    const onCreateOverlay = vi.fn(async (_operation: EditOperation): Promise<string | null> => null)
    renderStudio({ onCreateOverlay })

    const videoLane = screen.getByRole('group', { name: /V1 video lane/i })
    await user.click(within(videoLane).getByRole('button', { name: /^clip, cleaned-interview\.mp4,/i }))

    const inspector = screen.getByRole('region', { name: 'Inspector' })
    expect(within(inspector).getByRole('heading', { name: 'cleaned-interview.mp4' })).toBeInTheDocument()
    const soundToggle = within(inspector).getByRole('button', { name: 'Sound' })
    expect(soundToggle).toHaveAttribute('aria-expanded', 'true')
    const soundSection = soundToggle.closest('section')
    if (!soundSection) throw new Error('Sound section missing')
    fireEvent.change(within(soundSection).getByLabelText('Gain (dB)'), { target: { value: '-7' } })
    await user.click(within(soundSection).getByRole('button', { name: 'Apply' }))

    await waitFor(() => expect(onCreateOverlay).toHaveBeenCalledTimes(1))
    expect(onCreateOverlay.mock.calls[0][0]).toMatchObject({
      kind: 'set-clip-audio',
      clipId: TEST_CLIP_ID,
      gainDb: -7,
    })
  })

  it('keeps primary-footage motion detached until Apply and emits one complete operation', async () => {
    const user = userEvent.setup()
    const onCreateOverlay = vi.fn(async (_operation: EditOperation): Promise<string | null> => null)
    renderStudio({ onCreateOverlay })

    const videoLane = screen.getByRole('group', { name: /V1 video lane/i })
    await user.click(within(videoLane).getByRole('button', { name: /^clip, cleaned-interview\.mp4,/i }))

    const inspector = screen.getByRole('region', { name: 'Inspector' })
    expect(await within(inspector).findByRole('heading', { name: 'Motion' })).toBeInTheDocument()
    const scale = within(inspector).getByRole('spinbutton', { name: /scale %/i })
    fireEvent.change(scale, { target: { value: '125' } })
    expect(onCreateOverlay).not.toHaveBeenCalled()
    expect(scale).toHaveValue(125)

    await user.click(within(inspector).getByRole('button', { name: 'Punch in 120%' }))
    expect(scale).toHaveValue(120)
    await user.click(within(inspector).getByRole('button', { name: 'Reset draft' }))
    expect(scale).toHaveValue(100)
    expect(onCreateOverlay).not.toHaveBeenCalled()

    await user.click(within(inspector).getByRole('button', { name: 'Punch in 120%' }))
    await user.click(within(inspector).getByRole('button', { name: /^Apply motion$/ }))

    await waitFor(() => expect(onCreateOverlay).toHaveBeenCalledTimes(1))
    expect(onCreateOverlay.mock.calls[0][0]).toMatchObject({
      kind: 'set-footage-motion',
      capabilityId: 'sanverse.footage.motion.primitive/v1',
      assetId: TEST_ASSET_ID,
      transform: { scale: 1.2, opacity: 1 },
      tracks: [],
    })
  })

  it('keeps one native video and gives Point mode precedence over primary-footage Canvas handles', async () => {
    const user = userEvent.setup()
    const { container } = renderStudio()
    const video = container.querySelector('video') as HTMLVideoElement
    prepareVideoForPointing(video)
    vi.spyOn(video, 'pause').mockImplementation(() => undefined)
    fireEvent.loadedMetadata(video)

    const videoLane = screen.getByRole('group', { name: /V1 video lane/i })
    await user.click(within(videoLane).getByRole('button', { name: /^clip, cleaned-interview\.mp4,/i }))

    expect(await screen.findByTestId('primary-footage-canvas-controls')).toBeInTheDocument()
    expect(screen.queryByText('This item does not have canvas controls yet.')).not.toBeInTheDocument()
    expect(container.querySelectorAll('video')).toHaveLength(1)
    expect(video).not.toHaveAttribute('controls')

    await user.click(screen.getByRole('button', { name: 'Enter Point mode' }))

    expect(screen.queryByTestId('primary-footage-canvas-controls')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Choose a point on the visible video' })).toBeInTheDocument()
    expect(container.querySelectorAll('video')).toHaveLength(1)
  })

  it('keeps Canvas movement detached and commits one footage-motion operation on release', async () => {
    vi.stubGlobal('PointerEvent', MouseEvent)
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null)
    const user = userEvent.setup()
    const onCreateOverlay = vi.fn(async (_operation: EditOperation): Promise<string | null> => null)
    const { container } = renderStudio({ onCreateOverlay })
    const video = container.querySelector('video') as HTMLVideoElement
    prepareVideoForPointing(video)
    vi.spyOn(video, 'pause').mockImplementation(() => undefined)
    fireEvent.loadedMetadata(video)

    const videoLane = screen.getByRole('group', { name: /V1 video lane/i })
    await user.click(within(videoLane).getByRole('button', { name: /^clip, cleaned-interview\.mp4,/i }))

    const controls = await screen.findByTestId('primary-footage-canvas-controls')
    vi.spyOn(controls, 'getBoundingClientRect').mockReturnValue(canvasDomRect(100, 137.5, 400, 225))
    const move = within(controls).getByRole('button', { name: /Move primary footage/i })
    const inspector = screen.getByRole('region', { name: 'Inspector' })

    fireEvent.pointerDown(move, { clientX: 300, clientY: 250 })
    fireEvent.pointerMove(window, { clientX: 340, clientY: 272.5 })

    expect(onCreateOverlay).not.toHaveBeenCalled()
    await waitFor(() => {
      expect(within(inspector).getByRole('spinbutton', { name: /Position X % frame/i })).toHaveValue(10)
      expect(within(inspector).getByRole('spinbutton', { name: /Position Y % frame/i })).toHaveValue(10)
    })

    fireEvent.pointerUp(window, { clientX: 340, clientY: 272.5 })

    await waitFor(() => expect(onCreateOverlay).toHaveBeenCalledTimes(1))
    expect(onCreateOverlay.mock.calls[0][0]).toMatchObject({
      kind: 'set-footage-motion',
      transform: { translateX: 0.1, translateY: 0.1, opacity: 1 },
    })
  })

  it('cancels a second Canvas gesture with Escape and emits no operation', async () => {
    vi.stubGlobal('PointerEvent', MouseEvent)
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null)
    const user = userEvent.setup()
    const onCreateOverlay = vi.fn(async (_operation: EditOperation): Promise<string | null> => null)
    const { container } = renderStudio({ onCreateOverlay })
    const video = container.querySelector('video') as HTMLVideoElement
    prepareVideoForPointing(video)
    vi.spyOn(video, 'pause').mockImplementation(() => undefined)
    fireEvent.loadedMetadata(video)

    const videoLane = screen.getByRole('group', { name: /V1 video lane/i })
    await user.click(within(videoLane).getByRole('button', { name: /^clip, cleaned-interview\.mp4,/i }))

    const controls = await screen.findByTestId('primary-footage-canvas-controls')
    vi.spyOn(controls, 'getBoundingClientRect').mockReturnValue(canvasDomRect(100, 137.5, 400, 225))
    const move = within(controls).getByRole('button', { name: /Move primary footage/i })
    const inspector = screen.getByRole('region', { name: 'Inspector' })

    fireEvent.pointerDown(move, { clientX: 300, clientY: 250 })
    fireEvent.pointerMove(window, { clientX: 380, clientY: 250 })
    expect(onCreateOverlay).not.toHaveBeenCalled()
    fireEvent.keyDown(window, { key: 'Escape' })

    expect(onCreateOverlay).not.toHaveBeenCalled()
    await waitFor(() => {
      expect(within(inspector).getByRole('spinbutton', { name: /Position X % frame/i })).toHaveValue(0)
    })
  })

  it('projects accepted primary motion into the V1 Timeline indicator and Inspector', async () => {
    const user = userEvent.setup()
    renderStudio({ editProject: projectWithFootageMotion() })

    const videoLane = screen.getByRole('group', { name: /V1 video lane/i })
    const videoItem = within(videoLane).getByRole('button', {
      name: /Motion · 120% framing/i,
    })
    await user.click(videoItem)

    const inspector = screen.getByRole('region', { name: 'Inspector' })
    expect(await within(inspector).findByText('Accepted motion')).toBeInTheDocument()
    expect(within(inspector).getByRole('button', { name: 'Remove motion' })).toBeEnabled()
    expect(within(inspector).getByRole('spinbutton', { name: /scale %/i })).toHaveValue(120)
  })

  it('keeps Inspector proposal resolution actions available while unrelated timeline edits are paused', async () => {
    const user = userEvent.setup()
    const onDiscardProposal = vi.fn()
    renderStudio({
      proposal: directProposal(testOperation({
        operationId: 'operation_propsel1',
        sourceInterval: { start: ms(0), duration: ms(5_000) },
      })),
      onDiscardProposal,
    })

    const overlayLane = screen.getByRole('group', { name: /V2 overlay lane/i })
    const proposalItem = within(overlayLane).getByRole('button', {
      name: /^nameplate, Santosh, Founder,.*Proposed$/i,
    })
    await user.click(proposalItem)

    const inspector = screen.getByRole('region', { name: 'Inspector' })
    expect(within(inspector).getByText('Pending — preview only')).toBeInTheDocument()
    const reject = within(inspector).getByRole('button', { name: 'Reject proposal' })
    expect(reject).toBeEnabled()
    await user.click(reject)
    expect(onDiscardProposal).toHaveBeenCalledOnce()
  })

  it('guards a dirty Inspector draft before Timeline selection changes', async () => {
    const user = userEvent.setup()
    renderStudio()

    const videoLane = screen.getByRole('group', { name: /V1 video lane/i })
    await user.click(within(videoLane).getByRole('button', { name: /^clip, cleaned-interview\.mp4,/i }))
    const inspector = screen.getByRole('region', { name: 'Inspector' })
    const soundSection = within(inspector).getByRole('button', { name: 'Sound' }).closest('section')
    if (!soundSection) throw new Error('Sound section missing')
    fireEvent.change(within(soundSection).getByLabelText('Gain (dB)'), { target: { value: '-9' } })

    const dialogueLane = screen.getByRole('group', { name: /A1 dialogue lane/i })
    const videoItem = within(videoLane).getByRole('button', { name: /^clip, cleaned-interview\.mp4,/i })
    const dialogueItem = within(dialogueLane).getByRole('button', { name: /^clip, Dialogue · cleaned-interview\.mp4,/i })
    await user.click(dialogueItem)
    expect(within(inspector).getByRole('alertdialog', { name: 'Discard unapplied changes?' })).toBeInTheDocument()
    expect(videoItem).toHaveAttribute('aria-selected', 'true')

    await user.click(within(inspector).getByRole('button', { name: 'Stay' }))
    expect(within(inspector).queryByRole('alertdialog')).not.toBeInTheDocument()
    expect(videoItem).toHaveAttribute('aria-selected', 'true')

    await user.click(dialogueItem)
    await user.click(within(inspector).getByRole('button', { name: 'Discard and continue' }))
    await waitFor(() => expect(dialogueItem).toHaveAttribute('aria-selected', 'true'))
    expect(within(inspector).getByText('Dialogue linked to video')).toBeInTheDocument()
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

    await openAdvancedControls(user)
    await user.click(screen.getByRole('button', { name: /^cut here$/i }))

    expect(onTimelineEdit).toHaveBeenCalledTimes(1)
    const operation = onTimelineEdit.mock.calls[0][0]
    expect(operation.kind).toBe('split-clip')
    expect(operation.atClipTime.ticks).toBe(12 * 1_440_000)
    expect(operation.capabilityId).toBe('sanverse.timeline.split.primitive/v1')
  })

  it('explains in plain words why a cut at the very start is not a cut', async () => {
    const user = userEvent.setup()
    const onTimelineEdit = vi.fn()
    renderStudio({ onTimelineEdit })

    await openAdvancedControls(user)
    await user.click(screen.getByRole('button', { name: /^cut here$/i }))

    expect(onTimelineEdit).not.toHaveBeenCalled()
    expect(screen.getByText(/inside a section|edge/i)).toBeInTheDocument()
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

    await openAdvancedControls(user)
    await user.click(screen.getByRole('button', { name: /remove this section/i }))

    expect(onTimelineEdit).not.toHaveBeenCalled()
    expect(screen.getByText(/only section/i)).toBeInTheDocument()
  })

  it('locks cutting while a proposal is waiting to be approved', async () => {
    const user = userEvent.setup()
    renderStudio({
      proposal: {
        operation: testOperation(),
        origin: { source: 'direct', requestId: null, explanation: null, note: null },
      },
    })

    await openAdvancedControls(user)
    expect(screen.getByRole('button', { name: /^cut here$/i })).toBeDisabled()
  })

  it('offers the detailed direct controls only after the user asks for them', async () => {
    const user = userEvent.setup()
    renderStudio()

    await openAdvancedControls(user)
    expect(screen.getByRole('button', { name: /shorten the start/i, hidden: true })).not.toBeVisible()
    await user.click(screen.getByText(/adjust section at playhead/i))

    expect(screen.getByRole('button', { name: /shorten the start/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /shorten the end/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /leave empty space/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /move earlier/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /move later/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /apply sound/i })).toBeInTheDocument()
  })

  it('turns the plain trim and sound controls into bounded operations', async () => {
    const user = userEvent.setup()
    const onTimelineEdit = vi.fn()
    const { container } = renderStudio({ onTimelineEdit })
    const video = container.querySelector('video') as HTMLVideoElement
    prepareVideoForPointing(video, 5)
    fireEvent.timeUpdate(video)

    await openAdvancedControls(user)
    await user.click(screen.getByText(/adjust section at playhead/i))
    const trimAmount = screen.getByRole('spinbutton', { name: /seconds to remove/i })
    fireEvent.change(trimAmount, { target: { value: '2' } })
    await user.click(screen.getByRole('button', { name: /shorten the start/i }))

    expect(onTimelineEdit).toHaveBeenLastCalledWith(expect.objectContaining({
      kind: 'trim-clip',
      trimStart: ms(2_000),
      ripple: true,
    }))

    const loudness = screen.getByRole('spinbutton', { name: /loudness change/i })
    fireEvent.change(loudness, { target: { value: '-6' } })
    await user.click(screen.getByRole('button', { name: /apply sound/i }))

    expect(onTimelineEdit).toHaveBeenLastCalledWith(expect.objectContaining({
      kind: 'set-clip-audio',
      gainDb: -6,
    }))
  })
})
