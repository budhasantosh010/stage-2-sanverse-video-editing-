import { describe, expect, it, vi } from 'vitest'
import { PROJECT_TIMESCALE } from '@sanverse/edit-domain'
import { createLayerVideoDecoderPool, type LayerVideoRequest } from './layer-video-decoder'

const request = (id = 'clip_a', seconds = 2, url = '/api/media/a'): LayerVideoRequest =>
  ({ id, url, sourceTicks: Math.round(seconds * PROJECT_TIMESCALE), playbackRate: 1 })

function setup(maxDecoders = 4, onChange = () => undefined) {
  const media: HTMLVideoElement[] = []
  const ready = new Map<HTMLVideoElement, number>()
  const paused = new Map<HTMLVideoElement, boolean>()
  const factory = () => {
    const video = document.createElement('video')
    Object.defineProperties(video, {
      readyState: { get: () => ready.get(video) ?? 0 },
      paused: { get: () => paused.get(video) ?? true },
      videoWidth: { get: () => 1920 },
      videoHeight: { get: () => 1080 },
    })
    vi.spyOn(video, 'play').mockImplementation(async () => { paused.set(video, false) })
    vi.spyOn(video, 'pause').mockImplementation(() => { paused.set(video, true) })
    vi.spyOn(video, 'load').mockImplementation(() => undefined)
    media.push(video)
    return video
  }
  const pool = createLayerVideoDecoderPool({ createVideo: factory, maxDecoders, onChange })
  const loaded = (video: HTMLVideoElement) => {
    ready.set(video, 2)
    video.dispatchEvent(new Event('loadedmetadata'))
    video.dispatchEvent(new Event('seeked'))
    video.dispatchEvent(new Event('loadeddata'))
  }
  return { pool, media, loaded, ready, paused }
}

describe('layer video decoder lifecycle', () => {
  it('keeps a held frame paused while other layers play and notifies frame readiness', () => {
    const changed = vi.fn()
    const { pool, media, loaded } = setup(4, changed)
    pool.update([{ ...request('held'), hold: true }, request('moving')], true)
    media.forEach(loaded)
    expect(media[0].play).not.toHaveBeenCalled()
    expect(media[1].play).toHaveBeenCalledOnce()
    expect(changed).toHaveBeenCalled()
    const notifications = changed.mock.calls.length
    pool.dispose()
    loaded(media[0])
    expect(changed.mock.calls.length).toBe(notifications)
  })
  it('creates silent independent decoders without creating a playback clock', () => {
    const { pool, media, loaded } = setup()
    pool.update([request('lower', 2), request('upper', 7)], false)
    expect(media).toHaveLength(2)
    media.forEach(loaded)
    expect(media.map(v => v.currentTime)).toEqual([2, 7])
    expect(media.every(v => v.muted && v.playsInline)).toBe(true)
    expect(media.every(v => vi.mocked(v.play).mock.calls.length === 0)).toBe(true)
    expect(pool.frame('lower')).toBe(media[0])
    expect(pool.frame('upper')).toBe(media[1])
    pool.dispose()
  })

  it('uses only the newest target when metadata arrives after several seeks', () => {
    const { pool, media, loaded } = setup()
    pool.update([request('a', 1)], false)
    pool.update([request('a', 5)], false)
    pool.update([request('a', 9)], false)
    expect(pool.frame('a')).toBeNull()
    loaded(media[0])
    expect(media[0].currentTime).toBe(9)
    expect(pool.frame('a')).toBe(media[0])
    pool.dispose()
  })

  it('does not expose an old frame during a scrub seek', () => {
    const { pool, media, loaded } = setup()
    pool.update([request('a', 2)], false)
    loaded(media[0])
    pool.update([request('a', 8)], false)
    expect(pool.status('a').state).toBe('seeking')
    expect(pool.frame('a')).toBeNull()
    media[0].dispatchEvent(new Event('seeked'))
    expect(pool.frame('a')).toBe(media[0])
    pool.dispose()
  })

  it('preserves decoder identity across clock ticks and corrects drift, not every tick', async () => {
    const { pool, media, loaded } = setup()
    pool.update([request('a', 2)], true)
    loaded(media[0])
    await Promise.resolve()
    expect(media[0].play).toHaveBeenCalledTimes(1)
    pool.update([request('a', 2.02)], true)
    expect(media).toHaveLength(1)
    expect(media[0].currentTime).toBe(2)
    expect(media[0].play).toHaveBeenCalledTimes(1)
    pool.update([request('a', 3)], true)
    expect(media[0].currentTime).toBe(3)
    expect(pool.frame('a')).toBeNull()
    media[0].dispatchEvent(new Event('seeked'))
    expect(pool.frame('a')).toBe(media[0])
    pool.dispose()
  })

  it('pauses a pending play and ignores its late completion after disposal', async () => {
    const { pool, media, loaded } = setup()
    pool.update([request('a', 2)], false)
    loaded(media[0])
    let finish!: () => void
    vi.mocked(media[0].play).mockImplementation(() => new Promise<void>(resolve => { finish = resolve }))
    pool.update([request('a', 2)], true)
    pool.update([request('a', 2)], false)
    expect(media[0].pause).toHaveBeenCalled()
    pool.dispose()
    finish()
    await Promise.resolve()
    expect(pool.frame('a')).toBeNull()
    expect(media[0].getAttribute('src')).toBeNull()
  })

  it('releases a replaced source and prevents late metadata from reviving it', () => {
    const { pool, media, loaded } = setup()
    pool.update([request('a', 2)], true)
    const old = media[0]
    pool.update([request('a', 4, '/api/media/b')], false)
    expect(old.getAttribute('src')).toBeNull()
    expect(old.pause).toHaveBeenCalled()
    loaded(old)
    expect(old.play).not.toHaveBeenCalled()
    loaded(media[1])
    expect(pool.frame('a')).toBe(media[1])
    pool.update([], false)
    expect(pool.status('a').state).toBe('missing')
    expect(media[1].getAttribute('src')).toBeNull()
    pool.dispose()
  })

  it('does not let an aborted old play poison a later play intent', async () => {
    const { pool, media, loaded } = setup()
    pool.update([request()], false)
    loaded(media[0])
    let rejectOld!: (reason: Error) => void
    vi.mocked(media[0].play).mockImplementationOnce(() => new Promise<void>((_resolve, reject) => { rejectOld = reject }))
    pool.update([request()], true)
    pool.update([request()], false)
    pool.update([request()], true)
    rejectOld(new Error('AbortError from old pause'))
    await Promise.resolve()
    await Promise.resolve()
    expect(pool.status('clip_a').state).toBe('ready')
    expect(media[0].play).toHaveBeenCalledTimes(2)
    pool.dispose()
  })

  it('finishes an in-flight seek before issuing the latest target, never exposing the intermediate frame', () => {
    const { pool, media, loaded } = setup()
    pool.update([request()], false)
    loaded(media[0])
    pool.update([request('clip_a', 4)], false)
    pool.update([request('clip_a', 9)], false)
    media[0].dispatchEvent(new Event('seeked'))
    expect(media[0].currentTime).toBe(9)
    expect(pool.frame('clip_a')).toBeNull()
    media[0].dispatchEvent(new Event('seeked'))
    expect(pool.frame('clip_a')).toBe(media[0])
    pool.dispose()
  })

  it('fails capacity validation before discarding any existing decoder', () => {
    const { pool, media, loaded } = setup(1)
    pool.update([request('a', 2)], false)
    loaded(media[0])
    expect(() => pool.update([request('b'), request('c')], false)).toThrow(/capacity/i)
    expect(pool.frame('a')).toBe(media[0])
    expect(media[0].getAttribute('src')).not.toBeNull()
    pool.dispose()
  })

  it('rejects duplicate identities and invalid timing without partial updates', () => {
    const { pool, media } = setup()
    expect(() => pool.update([request(), request()], false)).toThrow(/duplicate/i)
    expect(() => pool.update([{ ...request(), sourceTicks: -1 }], false)).toThrow(/time/i)
    expect(() => pool.update([{ ...request(), playbackRate: 0 }], false)).toThrow(/rate/i)
    expect(media).toHaveLength(0)
    pool.dispose()
  })

  it('reports a decoding error instead of offering a stale image', () => {
    const { pool, media, loaded } = setup()
    pool.update([request()], false)
    loaded(media[0])
    media[0].dispatchEvent(new Event('error'))
    expect(pool.status('clip_a')).toMatchObject({ state: 'error', reason: 'MEDIA_DECODE_FAILED' })
    expect(pool.frame('clip_a')).toBeNull()
    pool.dispose()
  })

  it('reports rejected playback without an unhandled rejection or retry storm', async () => {
    const { pool, media, loaded } = setup()
    pool.update([request()], false)
    loaded(media[0])
    vi.mocked(media[0].play).mockRejectedValue(new Error('blocked'))
    pool.update([request()], true)
    await Promise.resolve()
    await Promise.resolve()
    expect(pool.status('clip_a')).toMatchObject({ state: 'error', reason: 'PLAYBACK_REJECTED' })
    pool.update([request('clip_a', 2.01)], true)
    expect(media[0].play).toHaveBeenCalledTimes(1)
    pool.dispose()
  })
})
