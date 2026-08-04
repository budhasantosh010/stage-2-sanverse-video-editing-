import { describe, expect, it, vi } from 'vitest'
import type { MediaAssetView } from './media-contract'
import {
  createMediaDragPayload,
  MEDIA_DRAG_ENABLED,
  MEDIA_DRAG_MIME,
  MEDIA_DRAG_SCHEMA_VERSION,
  parseMediaDragPayload,
  serializeMediaDragPayload,
  validateMediaDragPayload,
} from './media-drag-contract'
import { mediaDragSourceProps } from './media-drag-source'

const valid = Object.freeze({
  schemaVersion: MEDIA_DRAG_SCHEMA_VERSION,
  assetId: 'asset_1234abcd',
  mediaKind: 'video' as const,
  sourceDurationTicks: 43_200_000,
})

const asset = (overrides: Partial<MediaAssetView> = {}): MediaAssetView => Object.freeze({
  assetId: 'asset_1234abcd',
  kind: 'video',
  displayName: 'clip.mp4',
  originalName: 'clip.mp4',
  durationTicks: 43_200_000,
  width: 1920,
  height: 1080,
  status: 'available',
  usageCount: 0,
  usageKinds: Object.freeze(['unused'] as const),
  canAddAsOverlay: true,
  canAddAsMusic: false,
  canRemove: false,
  removeBlockedReason: null,
  previewSource: '/media/clip',
  thumbnailSource: null,
  ...overrides,
})

describe('media drag contract', () => {
  it('accepts exactly the four-key v1 shape', () => {
    expect(validateMediaDragPayload(valid)).toBe(true)
    expect(validateMediaDragPayload({ ...valid, mediaKind: 'image', sourceDurationTicks: null })).toBe(true)
  })

  it('refuses every shape that is not exactly v1', () => {
    const { assetId: _a, ...missingAsset } = valid
    for (const bad of [
      null, undefined, 'a string', 42, [], [valid],
      missingAsset,
      { ...valid, schemaVersion: 'sanverse.media-drag/v2' },
      { ...valid, mediaKind: 'caption' },
      { ...valid, mediaKind: null },
      { ...valid, assetId: 'not-an-asset-id' },
      { ...valid, assetId: '' },
      { ...valid, sourceDurationTicks: -1 },
      { ...valid, sourceDurationTicks: 0 },
      { ...valid, sourceDurationTicks: 1.5 },
      { ...valid, sourceDurationTicks: Number.NaN },
      { ...valid, sourceDurationTicks: Number.POSITIVE_INFINITY },
      { ...valid, sourceDurationTicks: '43200000' },
    ]) {
      expect(validateMediaDragPayload(bad)).toBe(false)
    }
  })

  it('refuses an EXTRA key rather than quietly dropping it', () => {
    // Dropping it would leave sender and receiver disagreeing about what was
    // just moved, and the disagreement would be invisible to both.
    for (const extra of [
      { ...valid, sourcePath: 'C:/Users/owner/Videos/clip.mp4' },
      { ...valid, url: 'blob:http://localhost:2000/abc' },
      { ...valid, objectUrl: 'blob:x' },
      { ...valid, project: { revision: 3 } },
      { ...valid, asset: asset() },
      { ...valid, anything: 1 },
    ]) {
      expect(validateMediaDragPayload(extra)).toBe(false)
    }
  })

  it('carries no path, no URL, no project, and no asset object — by construction', () => {
    const payload = createMediaDragPayload({ assetId: 'asset_1234abcd', mediaKind: 'video', sourceDurationTicks: 1 })
    expect(payload).not.toBeNull()
    expect(Object.keys(payload!)).toEqual(['schemaVersion', 'assetId', 'mediaKind', 'sourceDurationTicks'])
    const wire = serializeMediaDragPayload(payload!)
    expect(wire).not.toMatch(/blob:|http|file:|[A-Za-z]:\\|\.mp4/)
  })

  it('returns null instead of a half-built payload for media it cannot describe', () => {
    expect(createMediaDragPayload({ assetId: 'asset_1234abcd', mediaKind: 'unknown', sourceDurationTicks: 1 })).toBeNull()
    expect(createMediaDragPayload({ assetId: 'nope', mediaKind: 'video', sourceDurationTicks: 1 })).toBeNull()
    expect(createMediaDragPayload({ assetId: 'asset_1234abcd', mediaKind: 'video', sourceDurationTicks: -5 })).toBeNull()
  })

  it('survives a round trip and refuses anything else a drop might hand it', () => {
    expect(parseMediaDragPayload(serializeMediaDragPayload(valid))).toEqual(valid)
    for (const bad of [null, 42, '', '{not json', JSON.stringify({ hello: 'world' }), JSON.stringify(null), 'x'.repeat(5_000)]) {
      expect(parseMediaDragPayload(bad)).toBeNull()
    }
  })
})

describe('media drag source', () => {
  it('is switched ON now that the Timeline can finish the gesture', () => {
    // It was off until real drop targets existed, because a gesture that can
    // start and can never finish teaches the user the product is broken.
    // Gate C1 gave V2 and A2 real drops, and gave every other lane a refusal
    // that says what to do instead — a refusal is a finish.
    expect(MEDIA_DRAG_ENABLED).toBe(true)
    expect(mediaDragSourceProps(asset()).draggable).toBe(true)
    expect(mediaDragSourceProps(asset()).onDragStart).toBeTypeOf('function')
  })

  it('still refuses to make unplaceable media draggable', () => {
    // Missing local media cannot be placed, so it must not offer the gesture
    // even now that the gesture works in general.
    expect(mediaDragSourceProps({ ...asset(), status: 'missing' })).toEqual({})
  })

  it('is ready to work the moment it is enabled, and puts only the contract on the wire', () => {
    const props = mediaDragSourceProps(asset(), true)
    expect(props.draggable).toBe(true)
    const setData = vi.fn()
    const dataTransfer = { effectAllowed: '', setData }
    props.onDragStart?.({ dataTransfer } as never)
    expect(dataTransfer.effectAllowed).toBe('copy')
    expect(setData).toHaveBeenCalledTimes(1)
    const [type, body] = setData.mock.calls[0] as [string, string]
    expect(type).toBe(MEDIA_DRAG_MIME)
    expect(parseMediaDragPayload(body)).toEqual({
      schemaVersion: MEDIA_DRAG_SCHEMA_VERSION,
      assetId: 'asset_1234abcd',
      mediaKind: 'video',
      sourceDurationTicks: 43_200_000,
    })
  })

  it('refuses to drag media whose local file is not there, even when enabled', () => {
    expect(mediaDragSourceProps(asset({ status: 'missing' }), true)).toEqual({})
    expect(mediaDragSourceProps(asset({ status: 'checking' }), true)).toEqual({})
    expect(mediaDragSourceProps(asset({ kind: 'unknown' }), true)).toEqual({})
  })
})
