import { useRef, useState } from 'react'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  acceptChangeSet,
  addAsset,
  redoChangeSet,
  undoChangeSet,
  type EditOperation,
  type EditProject,
  type MediaAsset,
} from '@sanverse/edit-domain'
import { testImageAsset, testMusicAsset } from '@sanverse/edit-domain/test-fixtures'
import { StudioScreen } from './StudioScreen'
import { testProject } from '../../test-fixtures'

function accept(project: EditProject, operation: EditOperation): EditProject {
  const result = acceptChangeSet(project, {
    schemaVersion: 'sanverse.change-set/v1',
    changeSetId: `changeset_${operation.operationId.replace(/^operation_/, '').slice(0, 32)}`,
    baseRevision: project.revision,
    operations: [operation],
    provenance: { source: 'direct', requestId: null },
    extensions: {},
  })
  if (!result.ok) throw new Error(JSON.stringify(result.error))
  return result.value
}

function prepareVideoPreview(container: HTMLElement) {
  const video = container.querySelector('video') as HTMLVideoElement
  Object.defineProperties(video, {
    videoWidth: { configurable: true, value: 1920 },
    videoHeight: { configurable: true, value: 1080 },
    currentTime: { configurable: true, value: 1, writable: true },
  })
  vi.spyOn(video, 'getBoundingClientRect').mockReturnValue({
    x: 100, y: 50, left: 100, top: 50, right: 500, bottom: 275, width: 400, height: 225,
    toJSON: () => ({}),
  } as DOMRect)
  fireEvent.loadedMetadata(video)
  fireEvent.timeUpdate(video)
}

function MediaStudioHarness({
  probeAssetSource,
}: Readonly<{ probeAssetSource?: (url: string) => Promise<'available' | 'missing' | 'unsupported'> }> = {}) {
  const [project, setProject] = useState<EditProject>(() => testProject())
  const projectRef = useRef(project)
  const [names, setNames] = useState<Readonly<Record<string, string>>>({})
  const adopt = (next: EditProject) => {
    projectRef.current = next
    setProject(next)
  }
  const upload = async (file: File): Promise<MediaAsset | string> => {
    const asset = file.type.startsWith('image/')
      ? testImageAsset({ assetId: 'asset_p1eimage1' })
      : file.type.startsWith('audio/')
        ? testMusicAsset({ assetId: 'asset_p1eaudio1' })
        : null
    if (!asset) return 'Unsupported test media.'
    const result = addAsset(projectRef.current, asset)
    if (!result.ok) return 'Upload failed.'
    adopt(result.value)
    setNames((current) => Object.freeze({ ...current, [asset.assetId]: file.name }))
    return asset
  }
  return (
    <StudioScreen
      workspace="studio"
      project={{ id: 'project_1234567890abcdef', name: 'owner.mp4', mediaUrl: '/media/owner', draftRequest: '' }}
      proposal={null}
      conversation={{ status: 'ready', lastMessage: '', question: null, notice: null }}
      editProject={project}
      editError={null}
      assetOriginalNames={names}
      onProposal={vi.fn()}
      onDiscardProposal={vi.fn()}
      onAcceptProposal={vi.fn()}
      onRepairProposal={vi.fn()}
      onTimelineEdit={vi.fn()}
      onAddCaptions={vi.fn(async () => null)}
      onCreateOverlay={async (operation) => {
        adopt(accept(projectRef.current, operation))
        return null
      }}
      onUploadAsset={upload}
      assetUrl={(assetId) => `/api/projects/p/assets/${assetId}/media`}
      probeAssetSource={probeAssetSource}
      onSendMessage={vi.fn()}
      onUndo={() => {
        const result = undoChangeSet(projectRef.current)
        if (result.ok) adopt(result.value)
      }}
      onRedo={() => {
        const result = redoChangeSet(projectRef.current)
        if (result.ok) adopt(result.value)
      }}
      exportState={{ status: 'idle' }}
      saveState="saved"
      onExport={vi.fn()}
      onBack={vi.fn()}
    />
  )
}

describe('Studio Media Bin integration', () => {
  beforeEach(() => {
    vi.stubGlobal('PointerEvent', MouseEvent)
    vi.stubGlobal('ResizeObserver', class { observe() {} disconnect() {} })
    vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => {})
    HTMLElement.prototype.setPointerCapture = vi.fn()
  })

  afterEach(() => {
    cleanup()
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

  it('imports an image, uses one label everywhere, places one V2 edit, and preserves the asset through Undo/Redo', async () => {
    const user = userEvent.setup()
    const { container } = render(<MediaStudioHarness />)
    prepareVideoPreview(container)
    const file = new File(['image'], 'hero.png', { type: 'image/png' })
    await user.upload(screen.getByLabelText('Choose media files to import'), file)

    expect(await screen.findByLabelText(/hero\.png, Image, Unused/i)).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Add at playhead' }))

    const lane = screen.getByRole('group', { name: /V2 overlay lane/i })
    const timelineItem = await within(lane).findByRole('button', { name: /hero\.png/i })
    await waitFor(() => expect(timelineItem).toHaveAttribute('aria-selected', 'true'))
    expect(within(screen.getByRole('region', { name: 'Inspector' })).getByRole('heading', { name: 'hero.png' })).toBeInTheDocument()
    expect(screen.getByLabelText(/hero\.png, Image, Used 1 time/i)).toBeInTheDocument()

    expect(screen.getByTestId('media-overlay')).toHaveAttribute('src', expect.stringContaining('asset_p1eimage1'))
    expect(screen.getByTestId('canvas-interaction-layer')).toBeInTheDocument()
    expect(container.querySelectorAll('video')).toHaveLength(1)

    await user.click(screen.getByRole('button', { name: 'Undo edit' }))
    await waitFor(() => expect(within(lane).queryByRole('button', { name: /hero\.png/i })).not.toBeInTheDocument())
    expect(screen.getByLabelText(/hero\.png, Image, Unused/i)).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Redo edit' }))
    expect(await screen.findByLabelText(/hero\.png, Image, Used 1 time/i)).toBeInTheDocument()
    expect(await screen.findByTestId('media-overlay')).toHaveAttribute('src', expect.stringContaining('asset_p1eimage1'))
  })

  it('imports audio, adds one A2 music operation, opens Music Inspector, and supports Undo/Redo', async () => {
    const user = userEvent.setup()
    render(<MediaStudioHarness />)
    const file = new File(['audio'], 'bed.wav', { type: 'audio/wav' })
    await user.upload(screen.getByLabelText('Choose media files to import'), file)
    await user.click(await screen.findByRole('button', { name: 'Add as music' }))

    const lane = screen.getByRole('group', { name: /A2 music lane/i })
    const music = await within(lane).findByRole('button', { name: /bed\.wav/i })
    await waitFor(() => expect(music).toHaveAttribute('aria-selected', 'true'))
    const inspector = screen.getByRole('region', { name: 'Inspector' })
    expect(within(inspector).getByRole('heading', { name: 'bed.wav' })).toBeInTheDocument()
    expect(within(inspector).getByLabelText('Music gain (dB)')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Undo edit' }))
    await waitFor(() => expect(within(lane).queryByRole('button', { name: /bed\.wav/i })).not.toBeInTheDocument())
    expect(screen.getByLabelText(/bed\.wav, Audio, Unused/i)).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Redo edit' }))
    expect(await within(lane).findByRole('button', { name: /bed\.wav/i })).toBeInTheDocument()
  })

  it('shows a real unavailable project source as missing without deleting its identity or usage', async () => {
    const user = userEvent.setup()
    render(<MediaStudioHarness probeAssetSource={async () => 'missing'} />)

    const card = await screen.findByLabelText(/owner\.mp4, Video, missing media/i)
    await user.click(card)
    expect(screen.getByText('The project still references this asset, but the local source is unavailable.')).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Preview' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Remove' })).toBeDisabled()
    expect(screen.getByRole('group', { name: 'Remove owner.mp4 unavailable' }))
      .toHaveAccessibleDescription('This media is used in the project. Remove its timeline uses first.')
  })

  it('fails closed while a real source probe is pending, then exposes preview only after availability is confirmed', async () => {
    const deferred: { resolve?: (status: 'available') => void } = {}
    const probe = vi.fn(() => new Promise<'available'>((resolve) => { deferred.resolve = resolve }))
    render(<MediaStudioHarness probeAssetSource={probe} />)

    const checkingCard = screen.getByLabelText(/owner\.mp4, Video, Checking source, Used 1 time/i)
    await userEvent.click(checkingCard)
    expect(screen.queryByRole('link', { name: 'Preview' })).not.toBeInTheDocument()
    expect(screen.getByText('Checking source · Used 1 time')).toBeInTheDocument()
    expect(screen.getByText(/placement and preview stay unavailable until this finishes/i)).toBeInTheDocument()

    if (!deferred.resolve) throw new Error('Source probe did not start')
    deferred.resolve('available')
    expect(await screen.findByLabelText(/owner\.mp4, Video, Used 1 time/i)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Preview' })).toBeInTheDocument()
  })

  it('keeps playhead and Timeline viewport stable while Media search and filters change', async () => {
    const user = userEvent.setup()
    const { container } = render(<MediaStudioHarness />)
    const video = container.querySelector('video') as HTMLVideoElement
    Object.defineProperty(video, 'currentTime', { configurable: true, value: 5, writable: true })
    fireEvent.timeUpdate(video)
    const viewport = container.querySelector<HTMLElement>('[data-timeline-viewport]')
    if (!viewport) throw new Error('Timeline viewport missing')
    viewport.scrollLeft = 120
    fireEvent.scroll(viewport)

    await user.type(screen.getByLabelText('Search media'), 'owner')
    await user.click(screen.getByRole('button', { name: /Video 1/ }))

    expect(video.currentTime).toBe(5)
    expect(viewport.scrollLeft).toBe(120)
  })
})
