import { describe, expect, it, vi } from 'vitest'
import { createReversePreviewResources, reversePreviewTargets, type ReversePreviewTarget } from './reverse-preview-resources'
import type { PlaybackSegment } from './segment-playback'

const segment = (nodeId: string, startTicks = 0): PlaybackSegment => ({
  nodeId, startTicks, durationTicks: 1000, sourceStartTicks: 2000, sourceDurationTicks: 1000,
  assetId: 'asset_one', videoEnabled: true, audioEnabled: true, reversed: true,
})
const assets = [{ assetId: 'asset_one', sha256: 'a'.repeat(64) }]
const target = (key: string): ReversePreviewTarget => ({
  key, segmentIndex: 0, preparedAssetId: 'reverse-preview:' + key,
  request: { assetId: 'asset_one', assetVersion: 'a'.repeat(64), sourceStartTicks: 2000, sourceEndTicks: 3000 },
})
const deferred = () => { let resolve!: (value: Blob) => void; let reject!: (error: Error) => void
  const promise = new Promise<Blob>((yes, no) => { resolve = yes; reject = no }); return { promise, resolve, reject } }
const flush = async () => { await Promise.resolve(); await Promise.resolve() }

describe('reverse preview resources', () => {
  it('selects all active reverse clips, keeping source identity stable across timeline reordering', () => {
    const clips = [segment('clip_one'), segment('clip_two')]
    const targets = reversePreviewTargets(clips, assets, 500)
    expect(targets).toHaveLength(2)
    expect(new Set(targets.map(t => t.key)).size).toBe(2)
    expect(reversePreviewTargets([...clips].reverse(), assets, 500).map(t => t.key)).toEqual(targets.map(t => t.key).reverse())
    expect(reversePreviewTargets(clips, assets, 1000)).toEqual([])
  })
  it('prepares overlapping resources concurrently without restarting unchanged requests', async () => {
    const one = deferred(); const two = deferred()
    const request = vi.fn().mockReturnValueOnce(one.promise).mockReturnValueOnce(two.promise)
    const pool = createReversePreviewResources({ request, createUrl: vi.fn().mockReturnValueOnce('blob:one').mockReturnValueOnce('blob:two'), revokeUrl: vi.fn() })
    pool.update('project_one', [target('one'), target('two')])
    pool.update('project_one', [target('two'), target('one')])
    expect(request).toHaveBeenCalledTimes(2)
    one.resolve(new Blob()); two.resolve(new Blob()); await flush()
    expect(pool.get('one')).toMatchObject({ status: 'ready', url: 'blob:one' })
    expect(pool.get('two')).toMatchObject({ status: 'ready', url: 'blob:two' })
    pool.dispose()
  })
  it('aborts removed requests and ignores a late result without allocating a URL', async () => {
    const pending = deferred(); const createUrl = vi.fn(() => 'blob:stale')
    const request = vi.fn((_project: string, _request: ReversePreviewTarget['request'], _signal?: AbortSignal) => pending.promise)
    const pool = createReversePreviewResources({ request, createUrl, revokeUrl: vi.fn() })
    pool.update('project_one', [target('one')])
    const signal = request.mock.calls[0][2] as AbortSignal
    pool.update('project_one', [])
    expect(signal.aborted).toBe(true)
    pending.resolve(new Blob()); await flush()
    expect(createUrl).not.toHaveBeenCalled()
    expect(pool.get('one')).toEqual({ status: 'idle' })
    pool.dispose()
  })
  it('revokes prepared resources across project replacement and disposal', async () => {
    const revokeUrl = vi.fn(); const request = vi.fn(async () => new Blob())
    const pool = createReversePreviewResources({ request, createUrl: vi.fn().mockReturnValueOnce('blob:old').mockReturnValueOnce('blob:new'), revokeUrl })
    pool.update('project_one', [target('one')]); await flush()
    pool.update('project_two', [target('one')]); await flush()
    expect(revokeUrl).toHaveBeenCalledWith('blob:old')
    expect(request).toHaveBeenCalledTimes(2)
    pool.dispose(); pool.dispose()
    expect(revokeUrl.mock.calls).toEqual([['blob:old'], ['blob:new']])
  })
  it('reports a failed layer without losing another ready layer', async () => {
    const request = vi.fn().mockResolvedValueOnce(new Blob()).mockRejectedValueOnce(new Error('Decode failed'))
    const pool = createReversePreviewResources({ request, createUrl: () => 'blob:one', revokeUrl: vi.fn() })
    pool.update('project_one', [target('one'), target('two')]); await flush()
    expect(pool.get('one').status).toBe('ready')
    expect(pool.get('two')).toMatchObject({ status: 'error', message: 'Decode failed' })
    pool.dispose()
  })
  it('refuses excessive resources before touching the active set', async () => {
    const request = vi.fn(async () => new Blob())
    const pool = createReversePreviewResources({ request, createUrl: () => 'blob:one', revokeUrl: vi.fn(), capacity: 1 })
    pool.update('project_one', [target('one')]); await flush()
    expect(() => pool.update('project_one', [target('one'), target('two')])).toThrow('capacity')
    expect(pool.get('one').status).toBe('ready')
    expect(request).toHaveBeenCalledOnce()
    pool.dispose()
  })
})
