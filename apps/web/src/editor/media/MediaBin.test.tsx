import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { MediaAssetView, MediaBinViewModel } from '../../features/media'
import { MediaBin } from './MediaBin'

const asset = (overrides: Partial<MediaAssetView> = {}): MediaAssetView => Object.freeze({
  assetId: 'asset_video1111',
  kind: 'video',
  displayName: 'owner.mp4',
  originalName: 'owner.mp4',
  durationTicks: 43_200_000,
  width: 1920,
  height: 1080,
  status: 'available',
  usageCount: 1,
  usageKinds: Object.freeze(['primary-video'] as const),
  canAddAsOverlay: false,
  canAddAsMusic: false,
  canRemove: false,
  removeBlockedReason: 'This media is used in the project. Remove its timeline uses first.',
  previewSource: '/media/owner',
  thumbnailSource: null,
  ...overrides,
})

const assets = Object.freeze([
  asset(),
  asset({
    assetId: 'asset_image1111', kind: 'image', displayName: 'hero.png', originalName: 'hero.png', durationTicks: null,
    width: 1200, height: 800, usageCount: 0, usageKinds: Object.freeze(['unused']), canAddAsOverlay: true,
    removeBlockedReason: 'Removing unused media is not available yet. The source file remains safe.', previewSource: '/media/hero', thumbnailSource: '/media/hero',
  }),
  asset({
    assetId: 'asset_audio1111', kind: 'audio', displayName: 'bed.wav', originalName: 'bed.wav', durationTicks: 86_400_000,
    width: null, height: null, usageCount: 0, usageKinds: Object.freeze(['unused']), canAddAsMusic: true,
    removeBlockedReason: 'Removing unused media is not available yet. The source file remains safe.', previewSource: '/media/bed',
  }),
  asset({
    assetId: 'asset_missing1', kind: 'image', displayName: 'lost.png', originalName: 'lost.png', durationTicks: null,
    width: 800, height: 600, status: 'missing', usageCount: 1, usageKinds: Object.freeze(['media-overlay']),
    canAddAsOverlay: false, removeBlockedReason: 'This media is used in the project. Remove its timeline uses first.', previewSource: null,
  }),
])

const model: MediaBinViewModel = Object.freeze({
  assets,
  counts: Object.freeze({ all: 4, video: 1, image: 2, audio: 1, missing: 1 }),
})

const renderBin = (overrides: Partial<React.ComponentProps<typeof MediaBin>> = {}) => {
  const props: React.ComponentProps<typeof MediaBin> = {
    model,
    selectedAssetId: null,
    busy: false,
    onSelect: vi.fn(),
    onImport: vi.fn(async () => null),
    onAddAsBroll: vi.fn(async () => null),
    onAddAsMusic: vi.fn(async () => null),
    ...overrides,
  }
  return { ...render(<MediaBin {...props} />), props }
}

afterEach(cleanup)

describe('MediaBin', () => {
  it('renders compact cards, truthful metadata, import control, and image thumbnail fallback', () => {
    renderBin()
    expect(screen.getByLabelText('Project media assets')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Import media' })).toBeEnabled()
    expect(screen.getByText('owner.mp4')).toBeInTheDocument()
    expect(screen.getByText('hero.png')).toBeInTheDocument()
    expect(screen.getByText('1920×1080')).toBeInTheDocument()
    const image = document.querySelector<HTMLImageElement>('.media-bin__thumbnail-image')
    if (!image) throw new Error('Expected the image thumbnail')
    fireEvent.error(image)
    expect(screen.getAllByText('Image').length).toBeGreaterThan(0)
  })

  it('searches and filters locally, clears search, and shows a no-results recovery', async () => {
    const user = userEvent.setup()
    renderBin()
    await user.type(screen.getByLabelText('Search media'), 'HERO')
    expect(screen.getByText('1 result')).toBeInTheDocument()
    expect(screen.queryByText('bed.wav')).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Clear' }))
    await user.click(screen.getByRole('button', { name: /Audio 1/ }))
    expect(screen.getByText('bed.wav')).toBeInTheDocument()
    expect(screen.queryByText('hero.png')).not.toBeInTheDocument()
    await user.type(screen.getByLabelText('Search media'), 'nothing-here')
    expect(screen.getByText('No matching media')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Show all media' }))
    expect(screen.getByText('owner.mp4')).toBeInTheDocument()
  })

  it('keeps selection presentation-only and exposes the compatible primary action', async () => {
    const onSelect = vi.fn()
    const { rerender, props } = renderBin({ selectedAssetId: 'asset_image1111', onSelect })
    expect(screen.getByRole('option', { selected: true })).toHaveTextContent('hero.png')
    expect(screen.getByRole('button', { name: 'Add at playhead' })).toBeEnabled()
    await userEvent.click(screen.getByLabelText(/bed\.wav, Audio/i))
    expect(onSelect).toHaveBeenCalledWith('asset_audio1111')
    rerender(<MediaBin {...props} selectedAssetId="asset_audio1111" />)
    expect(screen.getByRole('button', { name: 'Add as music' })).toBeEnabled()
  })

  it('imports through the supplied App-owned callback and supports drag/drop', async () => {
    const onImport = vi.fn(async () => null)
    renderBin({ onImport })
    const first = new File(['image'], 'one.png', { type: 'image/png' })
    const second = new File(['audio'], 'two.wav', { type: 'audio/wav' })
    await userEvent.upload(screen.getByLabelText('Choose media files to import'), [first, second])
    await waitFor(() => expect(onImport).toHaveBeenCalledWith([first, second]))
    const region = screen.getByLabelText('Project media assets').closest('.media-bin') as HTMLElement
    fireEvent.drop(region, { dataTransfer: { files: [first] } })
    await waitFor(() => expect(onImport).toHaveBeenLastCalledWith([first]))
  })

  it('adds B-roll and music through callbacks and explains missing/removal refusal', async () => {
    const onAddAsBroll = vi.fn(async () => null)
    const onAddAsMusic = vi.fn(async () => null)
    const { rerender, props } = renderBin({ selectedAssetId: 'asset_image1111', onAddAsBroll, onAddAsMusic })
    await userEvent.click(screen.getByRole('button', { name: 'Add at playhead' }))
    await waitFor(() => expect(onAddAsBroll).toHaveBeenCalledWith('asset_image1111'))
    rerender(<MediaBin {...props} selectedAssetId="asset_audio1111" />)
    await userEvent.click(screen.getByRole('button', { name: 'Add as music' }))
    await waitFor(() => expect(onAddAsMusic).toHaveBeenCalledWith('asset_audio1111'))
    rerender(<MediaBin {...props} selectedAssetId="asset_missing1" />)
    expect(screen.getByText('The project still references this asset, but the local source is unavailable.')).toBeInTheDocument()
    expect(screen.getByLabelText(/lost\.png, Image, Missing media, Used 1 time/i)).toHaveTextContent('Used 1 time')
    expect(screen.getByText('Missing media · Used 1 time')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Remove' })).toBeDisabled()
    expect(screen.getByRole('group', { name: 'Remove lost.png unavailable' }))
      .toHaveAccessibleDescription('This media is used in the project. Remove its timeline uses first.')
  })

  it('opens the same actions from right-click or Shift+F10 and closes with Escape', async () => {
    const onSelect = vi.fn()
    renderBin({ onSelect })
    const card = screen.getByLabelText(/hero\.png, Image/i)
    fireEvent.contextMenu(card)
    expect(onSelect).toHaveBeenCalledWith('asset_image1111')
    expect(screen.getByRole('menu', { name: 'hero.png actions' })).toBeInTheDocument()
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(screen.queryByRole('menu')).not.toBeInTheDocument()
    fireEvent.keyDown(card, { key: 'F10', shiftKey: true })
    expect(screen.getByRole('menu')).toBeInTheDocument()
  })

  it('supports arrow-key navigation and Enter selection without changing project state', () => {
    const onSelect = vi.fn()
    renderBin({ selectedAssetId: 'asset_video1111', onSelect })
    const card = screen.getByLabelText(/owner\.mp4, Video/i)
    fireEvent.keyDown(card, { key: 'ArrowDown' })
    expect(onSelect).toHaveBeenCalledWith('asset_image1111')
    fireEvent.keyDown(card, { key: 'Enter' })
    expect(onSelect).toHaveBeenCalledWith('asset_video1111')
  })
})
