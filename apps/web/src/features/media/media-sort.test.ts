import { describe, expect, it } from 'vitest'
import type { MediaAssetView } from './media-contract'
import { MEDIA_SORT_FIELDS, mediaSortDirectionLabel, sortMediaAssets } from './media-sort'

const view = (overrides: Partial<MediaAssetView> & Pick<MediaAssetView, 'assetId'>): MediaAssetView => Object.freeze({
  kind: 'video',
  displayName: overrides.assetId,
  originalName: null,
  durationTicks: 1_440_000,
  width: null,
  height: null,
  status: 'available',
  usageCount: 0,
  usageKinds: Object.freeze(['unused'] as const),
  canAddAsOverlay: false,
  canAddAsMusic: false,
  canRemove: false,
  removeBlockedReason: null,
  previewSource: null,
  thumbnailSource: null,
  ...overrides,
})

/** Project order = the order they were added. Deliberately not alphabetical. */
const assets = Object.freeze([
  view({ assetId: 'asset_00000001', displayName: 'zebra.mp4', kind: 'video', durationTicks: 10_000_000 }),
  view({ assetId: 'asset_00000002', displayName: 'apple.png', kind: 'image', durationTicks: null }),
  view({ assetId: 'asset_00000003', displayName: 'apple.wav', kind: 'audio', durationTicks: 3_000_000 }),
  view({ assetId: 'asset_00000004', displayName: 'mango.png', kind: 'image', durationTicks: null }),
])

const names = (list: readonly MediaAssetView[]): readonly string[] => list.map((asset) => asset.displayName)

describe('media sorting', () => {
  it('offers exactly the four fields the product promises', () => {
    expect([...MEDIA_SORT_FIELDS]).toEqual(['added', 'name', 'type', 'duration'])
  })

  it('orders by date added, and reversing it genuinely reverses', () => {
    expect(names(sortMediaAssets(assets, 'added', 'ascending')))
      .toEqual(['zebra.mp4', 'apple.png', 'apple.wav', 'mango.png'])
    expect(names(sortMediaAssets(assets, 'added', 'descending')))
      .toEqual(['mango.png', 'apple.wav', 'apple.png', 'zebra.mp4'])
  })

  it('orders by name in both directions', () => {
    expect(names(sortMediaAssets(assets, 'name', 'ascending')))
      .toEqual(['apple.png', 'apple.wav', 'mango.png', 'zebra.mp4'])
    expect(names(sortMediaAssets(assets, 'name', 'descending')))
      .toEqual(['zebra.mp4', 'mango.png', 'apple.wav', 'apple.png'])
  })

  it('orders by type with video, then image, then audio', () => {
    expect(sortMediaAssets(assets, 'type', 'ascending').map((asset) => asset.kind))
      .toEqual(['video', 'image', 'image', 'audio'])
    expect(sortMediaAssets(assets, 'type', 'descending').map((asset) => asset.kind))
      .toEqual(['audio', 'image', 'image', 'video'])
  })

  it('orders by duration, giving still pictures one fixed place that swaps ends', () => {
    // A picture has no duration. It sits below every real duration ascending,
    // and above every real duration descending — one place, honestly reversed.
    expect(names(sortMediaAssets(assets, 'duration', 'ascending')))
      .toEqual(['apple.png', 'mango.png', 'apple.wav', 'zebra.mp4'])
    // The two pictures tie, so they keep project order even here — the tie
    // break is never reversed, only the comparison is.
    expect(names(sortMediaAssets(assets, 'duration', 'descending')))
      .toEqual(['zebra.mp4', 'apple.wav', 'apple.png', 'mango.png'])
  })

  it('never reshuffles equal items, in either direction', () => {
    // The two pictures tie on type AND on duration. Whichever way the sort is
    // pointed, they must stay in the order the project holds them, or the user
    // sees rows jump about for no reason they can see.
    for (const direction of ['ascending', 'descending'] as const) {
      const byType = sortMediaAssets(assets, 'type', direction).filter((asset) => asset.kind === 'image')
      expect(names(byType)).toEqual(['apple.png', 'mango.png'])
      const byDuration = sortMediaAssets(assets, 'duration', direction).filter((asset) => asset.durationTicks === null)
      expect(names(byDuration)).toEqual(['apple.png', 'mango.png'])
    }
  })

  it('never modifies or reorders the list it was given', () => {
    const before = names(assets)
    sortMediaAssets(assets, 'name', 'descending')
    expect(names(assets)).toEqual(before)
  })

  it('says what a direction means in words that fit the field', () => {
    expect(mediaSortDirectionLabel('added', 'descending')).toBe('Newest first')
    expect(mediaSortDirectionLabel('duration', 'ascending')).toBe('Shortest first')
    expect(mediaSortDirectionLabel('name', 'ascending')).toBe('A to Z')
  })
})
