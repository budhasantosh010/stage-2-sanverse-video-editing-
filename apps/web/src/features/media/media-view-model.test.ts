import { describe, expect, it } from 'vitest'
import { testBrollAsset, testImageAsset, testMultiAssetProject, testMusicAsset, TEST_ASSET_ID, TEST_BROLL_ASSET_ID, TEST_IMAGE_ASSET_ID, TEST_MUSIC_ASSET_ID } from '@sanverse/edit-domain/test-fixtures'
import { buildMediaBinViewModel, filterMediaAssets } from './media-view-model'

const project = testMultiAssetProject()
const sources = Object.freeze(Object.fromEntries(project.assets.map((asset) => [asset.assetId, {
  url: `/media/${asset.assetId}`,
  originalName: asset.assetId === TEST_IMAGE_ASSET_ID ? 'product.png' : null,
  status: asset.assetId === TEST_BROLL_ASSET_ID ? 'missing' as const : 'available' as const,
}])))

describe('MediaBinViewModel', () => {
  it('projects video, image and audio metadata, usage, status, and stable IDs without mutation', () => {
    const before = JSON.stringify(project)
    const model = buildMediaBinViewModel({ project, primaryDisplayName: 'owner.mp4', assetSources: sources })
    expect(model.assets.map((asset) => asset.assetId)).toEqual(project.assets.map((asset) => asset.assetId))
    expect(model.counts).toEqual({ all: 4, video: 2, image: 1, audio: 1, missing: 1 })
    expect(model.assets.find((asset) => asset.assetId === TEST_ASSET_ID)).toMatchObject({
      displayName: 'owner.mp4', kind: 'video', usageKinds: ['primary-video'], canAddAsOverlay: false,
    })
    expect(model.assets.find((asset) => asset.assetId === TEST_IMAGE_ASSET_ID)).toMatchObject({
      displayName: 'product.png', kind: 'image', width: testImageAsset().width, height: testImageAsset().height,
      thumbnailSource: `/media/${TEST_IMAGE_ASSET_ID}`, canAddAsOverlay: true,
    })
    expect(model.assets.find((asset) => asset.assetId === TEST_MUSIC_ASSET_ID)).toMatchObject({ kind: 'audio', canAddAsMusic: true })
    expect(JSON.stringify(project)).toBe(before)
  })

  it('represents missing media truthfully and disables placement', () => {
    const model = buildMediaBinViewModel({ project, primaryDisplayName: 'owner.mp4', assetSources: sources })
    expect(model.assets.find((asset) => asset.assetId === TEST_BROLL_ASSET_ID)).toMatchObject({
      status: 'missing', previewSource: null, canAddAsOverlay: false,
    })
  })

  it('filters locally by type, missing state, and bounded case-insensitive search', () => {
    const model = buildMediaBinViewModel({ project, primaryDisplayName: 'owner.mp4', assetSources: sources })
    expect(filterMediaAssets(model, 'PRODUCT', 'all').map((asset) => asset.assetId)).toEqual([TEST_IMAGE_ASSET_ID])
    expect(filterMediaAssets(model, '', 'audio')).toHaveLength(1)
    expect(filterMediaAssets(model, '', 'missing').map((asset) => asset.assetId)).toEqual([TEST_BROLL_ASSET_ID])
    expect(filterMediaAssets(model, 'video', 'all')).toHaveLength(2)
  })

  it('projects the representative 25-video, 40-image, 20-audio library deterministically', () => {
    const videos = Array.from({ length: 25 }, (_, index) => index === 0
      ? project.assets[0]
      : testBrollAsset({ assetId: `asset_video${String(index).padStart(4, '0')}` }))
    const images = Array.from({ length: 40 }, (_, index) =>
      testImageAsset({ assetId: `asset_image${String(index + 1).padStart(4, '0')}` }))
    const audio = Array.from({ length: 20 }, (_, index) =>
      testMusicAsset({ assetId: `asset_audio${String(index + 1).padStart(4, '0')}` }))
    const largeProject = Object.freeze({ ...project, assets: Object.freeze([...videos, ...images, ...audio]) })
    const largeSources = Object.freeze(Object.fromEntries(largeProject.assets.map((asset) => [asset.assetId, Object.freeze({
      url: `/media/${asset.assetId}`,
      originalName: null,
      status: 'available' as const,
    })])))
    const before = JSON.stringify(largeProject)
    const first = buildMediaBinViewModel({ project: largeProject, primaryDisplayName: 'owner.mp4', assetSources: largeSources })
    const second = buildMediaBinViewModel({ project: largeProject, primaryDisplayName: 'owner.mp4', assetSources: largeSources })

    expect(first.counts).toEqual({ all: 85, video: 25, image: 40, audio: 20, missing: 0 })
    expect(first.assets.map((asset) => asset.assetId)).toEqual(largeProject.assets.map((asset) => asset.assetId))
    expect(first.assets.map((asset) => asset.displayName)).toEqual(second.assets.map((asset) => asset.displayName))
    expect(filterMediaAssets(first, '', 'image')).toHaveLength(40)
    expect(filterMediaAssets(first, '', 'audio')).toHaveLength(20)
    expect(first.assets.find((asset) => asset.assetId === 'asset_image0001')?.displayName).toBe('Image 1')
    expect(JSON.stringify(largeProject)).toBe(before)
  })
})
