import { describe, expect, it } from 'vitest'
import { EMPTY_MEDIA_ORGANIZATION, type MediaOrganizationV1 } from '@sanverse/edit-domain/media-organization'
import type { MediaAssetView, MediaBinViewModel } from './media-contract'
import {
  applyMediaPresentation,
  EMPTY_MEDIA_PRESENTATION,
  reconcileFolderSelection,
} from './media-presentation'
import { mediaFolderCounts, selectMediaResults } from './media-results'

const view = (assetId: string, overrides: Partial<MediaAssetView> = {}): MediaAssetView => Object.freeze({
  assetId,
  kind: 'video',
  displayName: assetId,
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

const model: MediaBinViewModel = Object.freeze({
  assets: Object.freeze([
    view('asset_00000001', { displayName: 'interview.mp4', kind: 'video' }),
    view('asset_00000002', { displayName: 'logo.png', kind: 'image', durationTicks: null }),
    view('asset_00000003', { displayName: 'music.wav', kind: 'audio', durationTicks: 9_000_000 }),
  ]),
  counts: Object.freeze({ all: 3, video: 1, image: 1, audio: 1, missing: 0 }),
})

const organization: MediaOrganizationV1 = Object.freeze({
  schemaVersion: 'sanverse.media-organization/v1',
  folders: Object.freeze([
    Object.freeze({ folderId: 'folder_aaaaaaaa', name: 'B-roll', createdAt: '2026-08-03T10:00:00.000Z' }),
  ]),
  assetFolderAssignments: Object.freeze({ asset_00000002: 'folder_aaaaaaaa' }),
})

describe('media presentation state', () => {
  it('starts showing everything, in project order', () => {
    expect(EMPTY_MEDIA_PRESENTATION).toEqual({
      query: '', filter: 'all', sortField: 'added', sortDirection: 'ascending', folderId: null,
    })
  })

  it('caps the search text where it is STORED, not where it is read', () => {
    // Capping at every point of use means one forgotten reader is a megabyte of
    // pasted text running through a filter on every keystroke.
    const long = applyMediaPresentation(EMPTY_MEDIA_PRESENTATION, { query: 'a'.repeat(500) })
    expect(long.query).toHaveLength(120)
  })

  it('changes one thing at a time and leaves the rest exactly as it was', () => {
    const sorted = applyMediaPresentation(EMPTY_MEDIA_PRESENTATION, { sortField: 'name', sortDirection: 'descending' })
    const filtered = applyMediaPresentation(sorted, { filter: 'audio' })
    expect(filtered.sortField).toBe('name')
    expect(filtered.sortDirection).toBe('descending')
    expect(filtered.filter).toBe('audio')
    expect(filtered.folderId).toBeNull()
  })

  it('falls back to All media when the chosen folder has gone', () => {
    const inFolder = applyMediaPresentation(EMPTY_MEDIA_PRESENTATION, { folderId: 'folder_aaaaaaaa' })
    expect(reconcileFolderSelection(inFolder, ['folder_aaaaaaaa'])).toBe(inFolder)
    expect(reconcileFolderSelection(inFolder, []).folderId).toBeNull()
    // Everything else about how they were looking survives the fallback.
    const withSearch = applyMediaPresentation(inFolder, { query: 'logo', filter: 'image' })
    const recovered = reconcileFolderSelection(withSearch, [])
    expect(recovered.query).toBe('logo')
    expect(recovered.filter).toBe('image')
  })
})

describe('choosing which rows to show', () => {
  it('narrows by folder, then kind, then words, and orders what survived', () => {
    const rootOnly = selectMediaResults(model, EMPTY_MEDIA_PRESENTATION, organization)
    expect(rootOnly.visible.map((asset) => asset.displayName))
      .toEqual(['interview.mp4', 'logo.png', 'music.wav'])

    const inFolder = selectMediaResults(
      model,
      applyMediaPresentation(EMPTY_MEDIA_PRESENTATION, { folderId: 'folder_aaaaaaaa' }),
      organization,
    )
    expect(inFolder.visible.map((asset) => asset.displayName)).toEqual(['logo.png'])
    expect(inFolder.inFolder).toBe(1)

    const searched = selectMediaResults(
      model,
      applyMediaPresentation(EMPTY_MEDIA_PRESENTATION, { query: 'MUSIC', filter: 'audio' }),
      organization,
    )
    expect(searched.visible.map((asset) => asset.displayName)).toEqual(['music.wav'])

    const sorted = selectMediaResults(
      model,
      applyMediaPresentation(EMPTY_MEDIA_PRESENTATION, { sortField: 'name', sortDirection: 'descending' }),
      organization,
    )
    expect(sorted.visible.map((asset) => asset.displayName)).toEqual(['music.wav', 'logo.png', 'interview.mp4'])
  })

  it('shows every asset when there are no folders at all', () => {
    const results = selectMediaResults(model, EMPTY_MEDIA_PRESENTATION, EMPTY_MEDIA_ORGANIZATION)
    expect(results.visible).toHaveLength(3)
    expect(results.inFolder).toBe(3)
  })

  it('counts what is in each folder and what is still at the top level', () => {
    expect(mediaFolderCounts(model, organization)).toEqual({
      root: 2,
      byFolder: { folder_aaaaaaaa: 1 },
    })
    expect(mediaFolderCounts(model, EMPTY_MEDIA_ORGANIZATION)).toEqual({ root: 3, byFolder: {} })
  })
})
