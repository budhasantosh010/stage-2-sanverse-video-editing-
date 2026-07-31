import { describe, expect, it, vi } from 'vitest'
import { probeMediaAssetStatuses, probeMediaSourceStatus } from './media-source-status'

describe('media source availability adapter', () => {
  it('uses one bounded GET probe and aborts the body after successful headers', async () => {
    let captured: RequestInit | undefined
    const fetcher = vi.fn(async (_url: string, init?: RequestInit) => {
      captured = init
      return { ok: true, status: 200 } as Response
    }) as unknown as typeof fetch
    expect(await probeMediaSourceStatus('/media/one', fetcher)).toBe('available')
    expect(fetcher).toHaveBeenCalledTimes(1)
    expect(captured?.method).toBe('GET')
    expect(captured?.headers).toEqual({ range: 'bytes=0-0' })
    expect(captured?.signal?.aborted).toBe(true)
  })

  it('reports missing and unsupported sources truthfully', async () => {
    const missing = vi.fn(async () => new Response('', { status: 404 })) as unknown as typeof fetch
    const unsupported = vi.fn(async () => new Response('', { status: 415 })) as unknown as typeof fetch
    const unavailable = vi.fn(async () => { throw new Error('not reachable') }) as unknown as typeof fetch
    expect(await probeMediaSourceStatus('/missing', missing)).toBe('missing')
    expect(await probeMediaSourceStatus('/unsupported', unsupported)).toBe('unsupported')
    expect(await probeMediaSourceStatus('/unavailable', unavailable)).toBe('missing')
  })

  it('probes a large library with bounded concurrency and stable asset IDs', async () => {
    let active = 0
    let maximum = 0
    const probe = vi.fn(async (url: string) => {
      active += 1
      maximum = Math.max(maximum, active)
      await new Promise((resolve) => setTimeout(resolve, 2))
      active -= 1
      return url.includes('missing') ? 'missing' as const : 'available' as const
    })
    const sources = Array.from({ length: 12 }, (_, index) => ({
      assetId: `asset_${String(index).padStart(4, '0')}`,
      url: index === 7 ? '/missing' : `/media/${index}`,
    }))
    const result = await probeMediaAssetStatuses(sources, probe, 4)
    expect(Object.keys(result)).toHaveLength(12)
    expect(result.asset_0007).toBe('missing')
    expect(maximum).toBeLessThanOrEqual(4)
  })
})
