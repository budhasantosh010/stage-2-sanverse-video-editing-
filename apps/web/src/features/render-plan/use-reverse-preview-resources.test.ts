import { act, renderHook, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { useReversePreviewResources } from './use-reverse-preview-resources'
import type { PlaybackSegment } from './segment-playback'

const segments: readonly PlaybackSegment[] = ['one', 'two'].map(nodeId => ({ nodeId,
  assetId: 'asset_one', startTicks: 0, durationTicks: 1000, sourceStartTicks: 2000,
  sourceDurationTicks: 1000, reversed: true, videoEnabled: true, audioEnabled: true }))
const assets = [{ assetId: 'asset_one', sha256: 'a'.repeat(64) }]

describe('editor reverse resource binding', () => {
  afterEach(() => vi.unstubAllGlobals())
  it('projects both prepared resources into playback without restarting as the playhead moves', async () => {
    const createUrl = vi.fn().mockReturnValueOnce('blob:one').mockReturnValueOnce('blob:two')
    const revokeUrl = vi.fn()
    vi.stubGlobal('URL', class extends URL { static createObjectURL = createUrl; static revokeObjectURL = revokeUrl })
    const request = vi.fn(async () => new Blob())
    const { result, rerender, unmount } = renderHook(({ ticks }) => useReversePreviewResources('project_one', segments, assets, ticks, request), { initialProps: { ticks: 100 } })
    await waitFor(() => expect(result.current.prepared).toHaveLength(2))
    expect(result.current.browserSegments.every(segment => !segment.reversed && segment.sourceStartTicks === 0)).toBe(true)
    expect([...result.current.urls.values()]).toEqual(['blob:one', 'blob:two'])
    rerender({ ticks: 200 })
    expect(request).toHaveBeenCalledTimes(2)
    act(() => rerender({ ticks: 1000 }))
    expect(result.current.prepared).toHaveLength(0)
    expect(revokeUrl).toHaveBeenCalledTimes(2)
    unmount()
  })
})
