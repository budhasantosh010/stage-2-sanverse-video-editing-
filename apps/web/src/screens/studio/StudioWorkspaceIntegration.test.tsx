import { useRef, useState } from 'react'
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { acceptChangeSet, activeTimelineTrackState, MOVE_PRIMARY_CLIP_PRIMITIVE_ID, type EditOperation, type EditProject } from '@sanverse/edit-domain'
import { changeSetOf, testSplit } from '@sanverse/edit-domain/test-fixtures'

import { StudioWorkspaceTabs, type StudioWorkspace } from '../../editor/workspace'
import { STUDIO_LAYOUT_V2_STORAGE_KEY } from '../../editor/layout-v2'
import { readTimelineZoomPresentation } from '../../features/timeline'
import { ms, testProject, TEST_CLIP_ID } from '../../test-fixtures'
import { StudioScreen } from './StudioScreen'

const createProps = (
  project: EditProject,
  studioWorkspace: StudioWorkspace,
  onStudioWorkspaceChange: (workspace: StudioWorkspace) => void,
  onCreateOverlay: (operation: EditOperation) => Promise<string | null>,
  onTimelineEdit: (operation: EditOperation) => Promise<string | null>,
) => ({
  embedded: true,
  workspace: 'studio' as const,
  studioWorkspace,
  onStudioWorkspaceChange,
  project: { id: 'project_1234567890abcdef', name: 'owner.mp4', mediaUrl: '/media/owner', draftRequest: '' },
  proposal: null,
  conversation: { status: 'ready' as const, lastMessage: '', question: null, notice: null },
  editProject: project,
  editError: null,
  assetOriginalNames: { asset_aaaaaaaa: 'owner.mp4' },
  onProposal: vi.fn(),
  onDiscardProposal: vi.fn(),
  onAcceptProposal: vi.fn(),
  onRepairProposal: vi.fn(),
  onTimelineEdit,
  onAddCaptions: vi.fn(async () => null),
  onCreateOverlay,
  onApplyOperations: vi.fn(async () => null),
  onUploadAsset: vi.fn(async () => 'Not used.'),
  assetUrl: () => '/api/projects/p/assets/asset_aaaaaaaa/media',
  probeAssetSource: vi.fn(async () => 'available' as const),
  onSendMessage: vi.fn(),
  onUndo: vi.fn(),
  onRedo: vi.fn(),
  exportState: { status: 'idle' as const },
  saveState: { status: 'saved' as const, persistedRevision: 0 },
  onExport: vi.fn(),
  onBack: vi.fn(),
})

function Harness({
  onCreateOverlay = vi.fn(async () => null),
  onTimelineEdit = vi.fn(async () => null),
}: Readonly<{
  onCreateOverlay?: (operation: EditOperation) => Promise<string | null>
  onTimelineEdit?: (operation: EditOperation) => Promise<string | null>
}>) {
  const [studioWorkspace, setStudioWorkspace] = useState<StudioWorkspace>('edit')
  const [conversationDraft, setConversationDraft] = useState('')
  const projectRef = useRef(testProject())
  return (
    <>
      <StudioWorkspaceTabs value={studioWorkspace} onChange={setStudioWorkspace} />
      <StudioScreen
        {...createProps(projectRef.current, studioWorkspace, setStudioWorkspace, onCreateOverlay, onTimelineEdit)}
        conversationDraft={conversationDraft}
        onConversationDraftChange={setConversationDraft}
      />
    </>
  )
}

const originalWidth = Object.getOwnPropertyDescriptor(window, 'innerWidth')
const originalHeight = Object.getOwnPropertyDescriptor(window, 'innerHeight')
let resizeObserveCount = 0

function setViewport(width: number, height: number) {
  Object.defineProperty(window, 'innerWidth', { configurable: true, writable: true, value: width })
  Object.defineProperty(window, 'innerHeight', { configurable: true, writable: true, value: height })
}

function restore(name: 'innerWidth' | 'innerHeight', descriptor: PropertyDescriptor | undefined) {
  if (descriptor) Object.defineProperty(window, name, descriptor)
  else Reflect.deleteProperty(window, name)
}

function prepareVideo(container: HTMLElement) {
  const video = container.querySelector('video') as HTMLVideoElement
  Object.defineProperties(video, {
    videoWidth: { configurable: true, value: 1920 },
    videoHeight: { configurable: true, value: 1080 },
    currentTime: { configurable: true, value: 5, writable: true },
  })
  vi.spyOn(video, 'pause').mockImplementation(() => undefined)
  vi.spyOn(video, 'getBoundingClientRect').mockReturnValue({
    x: 260, y: 150, left: 260, top: 150, right: 980, bottom: 555, width: 720, height: 405,
    toJSON: () => ({}),
  } as DOMRect)
  fireEvent.loadedMetadata(video)
  fireEvent.timeUpdate(video)
  return video
}

beforeEach(() => {
  setViewport(1440, 900)
  localStorage.clear()
  resizeObserveCount = 0
  vi.stubGlobal('PointerEvent', MouseEvent)
  vi.stubGlobal('ResizeObserver', class {
    observe(target: Element) {
      if (target instanceof HTMLVideoElement) resizeObserveCount += 1
    }
    disconnect() {}
  })
  vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => {})
  HTMLElement.prototype.setPointerCapture = vi.fn()
  HTMLElement.prototype.releasePointerCapture = vi.fn()
})

afterEach(() => {
  cleanup()
  localStorage.clear()
  restore('innerWidth', originalWidth)
  restore('innerHeight', originalHeight)
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

describe('Studio workspace integration', () => {
  it('binds transferred footage to layered surfaces and ignores decoder time as transport authority', async () => {
    const original = testProject()
    const split = acceptChangeSet(original, changeSetOf('changeset_layersplit', 0, [testSplit({ atClipTime: ms(10_000), newClipId: 'clip_layersecond' })]))
    if (!split.ok) throw new Error(JSON.stringify(split.error))
    const destination = activeTimelineTrackState(split.value).tracks.find(track => track.role === 'overlay-video')!.trackId
    const moved = acceptChangeSet(split.value, changeSetOf('changeset_layermove', split.value.revision, [{
      schemaVersion: 'sanverse.operation/v3', operationId: 'operation_layermove',
      capabilityId: MOVE_PRIMARY_CLIP_PRIMITIVE_ID, kind: 'move-primary-clip',
      clipId: 'clip_layersecond', compositionStart: ms(10_000), destinationTrackId: destination, extensions: {},
    }]))
    if (!moved.ok) throw new Error(JSON.stringify(moved.error))
    vi.spyOn(HTMLMediaElement.prototype, 'load').mockImplementation(() => {})
    const props = createProps(moved.value, 'edit', vi.fn(), vi.fn(async () => null), vi.fn(async () => null))
    const { container, rerender } = render(<StudioScreen {...props} />)
    const video = prepareVideo(container)
    await waitFor(() => expect(container.querySelectorAll('[data-layered-footage]')).toHaveLength(2))
    const transport = screen.getByRole('slider', { name: 'Monitor playhead' })
    fireEvent.change(transport, { target: { value: String(ms(12_000).ticks) } })
    expect(transport).toHaveValue(String(ms(12_000).ticks))
    video.currentTime = 2
    fireEvent.timeUpdate(video)
    expect(transport).toHaveValue(String(ms(12_000).ticks))
    rerender(<StudioScreen {...props} workspace="assist" />)
    expect(container.querySelector('video')).toBe(video)
    expect(transport).toHaveValue(String(ms(12_000).ticks))
    expect(props.onTimelineEdit).not.toHaveBeenCalled()
  })
  it('keeps the audio mixer unmuted when the picture decoder mutes itself', async () => {
    const resume = vi.fn(async () => {})
    const node = () => ({ connect() {}, disconnect() {}, gain: { setValueAtTime: vi.fn() }, pan: { setValueAtTime: vi.fn() } })
    vi.stubGlobal('AudioContext', class {
      currentTime = 0
      state = 'suspended'
      resume = resume
      destination = {}
      createGain = node
      createStereoPanner = node
      createMediaElementSource = node
      close = async () => {}
    })
    vi.spyOn(HTMLMediaElement.prototype, 'load').mockImplementation(() => {})
    vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue()
    const { container } = render(<Harness />)
    const video = container.querySelector('video')!
    expect(video.muted).toBe(true)
    fireEvent.volumeChange(video)
    expect(screen.getByRole('button', { name: 'Mute' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Mute' }))
    expect(screen.getByRole('button', { name: 'Unmute' })).toBeInTheDocument()
    expect(video.muted).toBe(true)
    fireEvent.click(screen.getByRole('button', { name: 'Play' }))
    expect(resume).toHaveBeenCalledOnce()
  })

  it('starts and pauses an opening gap, then resumes only when the next source loads', async () => {
    const frames = new Map<number, FrameRequestCallback>()
    let nextFrameId = 0
    let now = 0
    vi.spyOn(performance, 'now').mockImplementation(() => now)
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation(callback => {
      frames.set(++nextFrameId, callback)
      return nextFrameId
    })
    vi.spyOn(window, 'cancelAnimationFrame').mockImplementation(id => { frames.delete(id) })
    const advanceClock = (time: number) => act(() => {
      now = time
      const pending = [...frames.values()]
      frames.clear()
      pending.forEach(callback => callback(now))
    })
    const base = testProject()
    const moved = acceptChangeSet(base, {
      schemaVersion: 'sanverse.change-set/v1', changeSetId: 'changeset_openinggap', baseRevision: base.revision,
      operations: [{ schemaVersion: 'sanverse.operation/v3', operationId: 'operation_openinggap',
        kind: 'move-primary-clip', capabilityId: MOVE_PRIMARY_CLIP_PRIMITIVE_ID,
        clipId: TEST_CLIP_ID, compositionStart: ms(5000), extensions: {} }],
      provenance: { source: 'direct', requestId: null }, extensions: {},
    })
    if (!moved.ok) throw new Error(JSON.stringify(moved.error))
    const play = vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue()
    const props = createProps(moved.value, 'edit', vi.fn(), vi.fn(async () => null), vi.fn(async () => null))
    const { container } = render(<StudioScreen {...props} conversationDraft="" onConversationDraftChange={vi.fn()} />)
    const video = container.querySelector('video')
    expect(screen.getByRole('status', { name: 'Preview status' })).toHaveTextContent('No media at this time')
    fireEvent.click(screen.getByRole('button', { name: 'Play' }))
    expect(play).not.toHaveBeenCalled()
    expect(screen.getByRole('button', { name: 'Pause' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Pause' }))
    expect(screen.getByRole('button', { name: 'Play' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Play' }))
    advanceClock(1000)
    expect(screen.getByRole('slider', { name: 'Monitor playhead' })).toHaveValue('1440000')
    advanceClock(5001)
    expect(video).toHaveAttribute('src', '/media/owner')
    expect(play).not.toHaveBeenCalled()
    fireEvent.loadedMetadata(video!)
    expect(play).toHaveBeenCalledTimes(1)
    expect(video?.currentTime).toBe(0)
    expect(container.querySelector('video')).toBe(video)
  })

  it('reveals export feedback from a collapsed AI pane without remounting the editor', async () => {
    const props = createProps(testProject(), 'edit', vi.fn(), vi.fn(async () => null), vi.fn(async () => null))
    const { container, rerender } = render(<StudioScreen {...props} conversationDraft="keep this unsent" onConversationDraftChange={vi.fn()} />)
    const video = container.querySelector('video')
    const chat = container.querySelector('textarea')
    expect(screen.getByRole('button', { name: 'Expand AI' })).toBeInTheDocument()
    rerender(<StudioScreen {...props} conversationDraft="keep this unsent" onConversationDraftChange={vi.fn()} exportState={{ status: 'error', message: 'Test export failed. Retry is available.' }} />)
    await waitFor(() => expect(screen.getByRole('button', { name: 'Collapse AI' })).toBeInTheDocument())
    expect(screen.getByText('Test export failed. Retry is available.')).toBeVisible()
    expect(container.querySelector('video')).toBe(video)
    expect(container.querySelector('textarea')).toBe(chat)
    expect(chat).toHaveValue('keep this unsent')
  })
  it('keeps layout settings in the Inspector and offers recovery when the Tool dock is hidden', async () => {
    const user = userEvent.setup()
    const { container } = render(<Harness onCreateOverlay={vi.fn(async () => null)} onTimelineEdit={vi.fn(async () => null)} />)
    const preset = screen.getByRole('combobox', { name: 'Workspace preset' })
    expect(preset.closest('#studio-inspector-region')).not.toBeNull()
    const video = container.querySelector('video')
    await user.click(screen.getByRole('button', { name: 'Hide Tool dock' }))
    await user.click(screen.getByRole('button', { name: 'Show Inspector' }))
    expect(container.querySelector('video')).toBe(video)
    expect(container.querySelector('main')).toHaveAttribute('data-right-collapsed', 'false')
  })
  it('preserves one video, playhead, selection, Timeline viewport and AI draft across every Studio workspace', async () => {
    const user = userEvent.setup()
    const create = vi.fn(async () => null)
    const timelineEdit = vi.fn(async () => null)
    const { container } = render(<Harness onCreateOverlay={create} onTimelineEdit={timelineEdit} />)
    const video = prepareVideo(container)

    const videoLane = screen.getByRole('group', { name: /V1 video lane/i })
    const videoItem = within(videoLane).getByRole('button', { name: /^clip, owner\.mp4,/i })
    await user.click(videoItem)
    // Selecting a Timeline item truthfully seeks to that item's start. Establish
    // the continuity playhead after selection, then prove workspace switches do
    // not remount or move it.
    video.currentTime = 5
    fireEvent.timeUpdate(video)
    const timelineViewport = container.querySelector<HTMLElement>('[data-timeline-viewport]')
    if (!timelineViewport) throw new Error('Timeline viewport missing')
    timelineViewport.scrollLeft = 96
    fireEvent.scroll(timelineViewport)
    await user.click(screen.getByRole('button', { name: 'Zoom Timeline in' }))
    const zoom = screen.getByLabelText('Timeline horizontal zoom value').textContent
    const timelineScrollLeft = timelineViewport.scrollLeft

    await user.click(screen.getByRole('button', { name: 'Expand AI' }))
    const chat = screen.getByRole('textbox', { name: /ask for an edit/i })
    fireEvent.change(chat, { target: { value: 'keep one shared AI draft' } })
    await waitFor(() => expect(chat).toHaveValue('keep one shared AI draft'))

    for (const name of ['Effects', 'Color', 'Audio', 'Edit']) {
      await user.click(within(screen.getByRole('tablist', { name: 'Studio workspaces' })).getByRole('tab', { name }))
      expect(container.querySelectorAll('video')).toHaveLength(1)
      expect(container.querySelector('video')).toBe(video)
      expect(video.currentTime).toBe(5)
      expect(screen.getByRole('textbox', { name: /ask for an edit/i })).toBe(chat)
      expect(chat).toHaveValue('keep one shared AI draft')
      expect(within(videoLane).getByRole('button', { name: /^clip, owner\.mp4,/i })).toHaveAttribute('aria-selected', 'true')
      expect(screen.getByLabelText('Timeline horizontal zoom value')).toHaveTextContent(zoom ?? '')
      expect(timelineViewport.scrollLeft).toBe(timelineScrollLeft)
      expect(screen.getByTestId('timeline-v1')).toHaveAttribute('data-project-revision', '0')
    }

    expect(create).not.toHaveBeenCalled()
    expect(timelineEdit).not.toHaveBeenCalled()
    expect(resizeObserveCount).toBe(1)
  }, 10_000)

  it('persists both zoom axes without an edit, revision, history change, or destroyed base height', async () => {
    const user = userEvent.setup()
    const create = vi.fn(async () => null)
    const timelineEdit = vi.fn(async () => null)
    const { container, unmount } = render(<Harness onCreateOverlay={create} onTimelineEdit={timelineEdit} />)
    prepareVideo(container)

    const horizontal = screen.getByRole('slider', { name: 'Timeline horizontal zoom' })
    const vertical = screen.getByRole('slider', { name: 'Timeline vertical zoom' })
    const v1Header = container.querySelector<HTMLElement>('[data-track-display-id="V1"]')
    if (!v1Header) throw new Error('V1 header missing')
    const baseHeight = v1Header.style.getPropertyValue('--timeline-lane-height')

    fireEvent.change(horizontal, { target: { value: '15' } })
    await waitFor(() => expect(screen.getByLabelText('Timeline horizontal zoom value')).toHaveTextContent('320 px/s'))
    fireEvent.change(vertical, { target: { value: '15000' } })
    await waitFor(() => expect(screen.getByLabelText('Timeline vertical zoom value')).toHaveTextContent('150%'))
    expect(v1Header.style.getPropertyValue('--timeline-lane-height')).not.toBe(baseHeight)

    await user.click(screen.getByRole('button', { name: 'Reset vertical zoom' }))
    await waitFor(() => expect(v1Header.style.getPropertyValue('--timeline-lane-height')).toBe(baseHeight))

    expect(screen.getByTestId('timeline-v1')).toHaveAttribute('data-project-revision', '0')
    expect(create).not.toHaveBeenCalled()
    expect(timelineEdit).not.toHaveBeenCalled()
    expect(readTimelineZoomPresentation('project_1234567890abcdef')).toMatchObject({
      horizontalPixelsPerSecond: 320,
      vertical: { scaleBasisPoints: 10_000 },
    })

    unmount()
    const reopened = render(<Harness onCreateOverlay={create} onTimelineEdit={timelineEdit} />)
    prepareVideo(reopened.container)
    await waitFor(() => expect(screen.getByLabelText('Timeline horizontal zoom value')).toHaveTextContent('320 px/s'))
    expect(screen.getByLabelText('Timeline vertical zoom value')).toHaveTextContent('100%')
  }, 10_000)

  it('persists layout presentation changes without touching editor authority', async () => {
    const user = userEvent.setup()
    const create = vi.fn(async () => null)
    const timelineEdit = vi.fn(async () => null)
    const { container } = render(<Harness onCreateOverlay={create} onTimelineEdit={timelineEdit} />)
    prepareVideo(container)
    const main = container.querySelector<HTMLElement>('.studio-screen')
    if (!main) throw new Error('Studio root missing')

    await user.click(screen.getByRole('button', { name: 'Hide Media dock' }))
    await user.click(screen.getByRole('button', { name: 'Hide Tool dock' }))
    await user.click(screen.getByRole('button', { name: 'Expand AI' }))

    const persisted = JSON.parse(localStorage.getItem(STUDIO_LAYOUT_V2_STORAGE_KEY) ?? '{}') as Record<string, unknown>
    expect(persisted).toMatchObject({ schemaVersion: 'sanverse.studio-layout/v2', preset: 'custom' })
    expect(persisted).toHaveProperty('rootLayout')
    expect(persisted).toHaveProperty('mainVerticalLayout')
    expect(persisted).toHaveProperty('upperLayout')
    expect(persisted).toMatchObject({ mediaCollapsed: true, toolCollapsed: true, aiMode: 'expanded' })
    expect(persisted).not.toHaveProperty('projectId')
    expect(screen.getByTestId('timeline-v1')).toHaveAttribute('data-project-revision', '0')
    expect(create).not.toHaveBeenCalled()
    expect(timelineEdit).not.toHaveBeenCalled()
  })

  it('applies bounded presets, remains manually resizable and Reset restores Edit', async () => {
    const user = userEvent.setup()
    const { container } = render(<Harness />)
    prepareVideo(container)
    const main = container.querySelector<HTMLElement>('.studio-screen')
    if (!main) throw new Error('Studio root missing')

    await user.selectOptions(screen.getByLabelText('Workspace preset'), 'timeline')
    expect(main).toHaveAttribute('data-left-collapsed', 'true')
    expect(main).toHaveAttribute('data-right-collapsed', 'true')
    expect(JSON.parse(localStorage.getItem(STUDIO_LAYOUT_V2_STORAGE_KEY) ?? '{}')).toMatchObject({ mainVerticalLayout: [42, 58] })

    await user.click(screen.getByRole('button', { name: 'Show Media dock' }))
    expect(screen.getByLabelText('Workspace preset')).toHaveValue('custom')

    await user.selectOptions(screen.getByLabelText('Workspace preset'), 'audio')
    expect(screen.getByRole('tab', { name: 'Audio' })).toHaveAttribute('aria-selected', 'true')
    await user.click(screen.getByRole('button', { name: 'Reset workspace' }))
    expect(screen.getByRole('tab', { name: 'Edit' })).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByLabelText('Workspace preset')).toHaveValue('edit')
  })

  it('keeps primary-footage Canvas and Point controls mounted through a dock resize', async () => {
    const user = userEvent.setup()
    const { container } = render(<Harness />)
    prepareVideo(container)
    const videoLane = screen.getByRole('group', { name: /V1 video lane/i })
    await user.click(within(videoLane).getByRole('button', { name: /^clip, owner\.mp4,/i }))
    const controls = await screen.findByTestId('primary-footage-canvas-controls')

    await user.click(screen.getByRole('button', { name: 'Hide Media dock' }))
    await user.click(screen.getByRole('button', { name: 'Show Media dock' }))
    await waitFor(() => expect(screen.getByTestId('primary-footage-canvas-controls')).toBe(controls))
    expect(container.querySelectorAll('video')).toHaveLength(1)

    await user.click(screen.getByRole('button', { name: 'Enter Point mode' }))
    expect(screen.queryByTestId('primary-footage-canvas-controls')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Choose a point on the visible video' })).toBeInTheDocument()
  })
})
