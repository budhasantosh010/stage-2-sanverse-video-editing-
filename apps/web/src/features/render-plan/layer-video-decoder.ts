import { PROJECT_TIMESCALE } from '@sanverse/edit-domain'

export type LayerVideoRequest = Readonly<{
  id: string
  url: string
  sourceTicks: number
  playbackRate: number
  hold?: boolean
}>

export type LayerDecoderStatus = Readonly<{
  state: 'missing' | 'loading' | 'seeking' | 'ready' | 'error'
  reason?: 'MEDIA_DECODE_FAILED' | 'PLAYBACK_REJECTED'
}>

export type LayerVideoDecoderPool = Readonly<{
  update(requests: readonly LayerVideoRequest[], playing: boolean): void
  frame(id: string): HTMLVideoElement | null
  status(id: string): LayerDecoderStatus
  dispose(): void
}>

export function createLayerVideoDecoderPool(options: Readonly<{
  createVideo?: () => HTMLVideoElement
  maxDecoders?: number
  onChange?: () => void
}> = {}): LayerVideoDecoderPool {
  const capacity = options.maxDecoders ?? 8
  if (!Number.isSafeInteger(capacity) || capacity < 1) throw new Error('Invalid decoder capacity')
  const createVideo = options.createVideo ?? (() => document.createElement('video'))
  type Decoder = {
    video: HTMLVideoElement
    request: LayerVideoRequest
    playing: boolean
    released: boolean
    seeking: boolean
    playPending: boolean
    playbackEpoch: number
    error?: LayerDecoderStatus['reason']
    detach: () => void
  }
  const decoders = new Map<string, Decoder>()
  let disposed = false
  let suspended = false

  function sync(decoder: Decoder, allowPlayback = true) {
    if (decoder.released || decoder.error) return
    const { video, request } = decoder
    if (!decoder.playing || suspended) video.pause()
    if (video.readyState < 1 || decoder.seeking || video.seeking) return
    const seconds = request.sourceTicks / PROJECT_TIMESCALE
    const tolerance = decoder.playing ? 0.08 : 0.001
    try {
      video.playbackRate = request.playbackRate
      if (Math.abs(video.currentTime - seconds) > tolerance) {
        decoder.seeking = true
        video.currentTime = seconds
        return
      }
    } catch {
      decoder.error = 'MEDIA_DECODE_FAILED'
      video.pause()
      return
    }
    if (!allowPlayback || suspended || !decoder.playing || video.readyState < 2 || !video.paused || decoder.playPending) return
    decoder.playPending = true
    const epoch = decoder.playbackEpoch
    // play() may resolve after a pause, source replacement, or disposal.
    try {
      Promise.resolve(video.play()).then(() => {
        decoder.playPending = false
        if (decoder.released || !decoder.playing || suspended) video.pause()
        else if (epoch !== decoder.playbackEpoch) synchronizeGroup()
      }, () => {
        decoder.playPending = false
        if (!decoder.released && decoder.playing && !suspended && epoch === decoder.playbackEpoch) {
          decoder.error = 'PLAYBACK_REJECTED'
          video.pause()
          synchronizeGroup()
          options.onChange?.()
        } else if (!decoder.released) synchronizeGroup()
      })
    } catch {
      decoder.playPending = false
      decoder.error = 'PLAYBACK_REJECTED'
      video.pause()
    }
  }

  // The editor freezes its composition clock while any required layer is not
  // ready. Decoders must share that barrier, or a ready layer runs ahead and
  // repeatedly seeks backwards while its sibling is still loading.
  function synchronizeGroup() {
    if (disposed) return
    decoders.forEach(decoder => sync(decoder, false))
    const blocked = [...decoders.keys()].some(id => status(id).state !== 'ready')
    if (blocked && !suspended) decoders.forEach(decoder => { decoder.playbackEpoch += 1 })
    suspended = blocked
    if (suspended) decoders.forEach(decoder => decoder.video.pause())
    else decoders.forEach(decoder => sync(decoder))
  }

  function release(decoder: Decoder) {
    decoder.released = true
    decoder.playing = false
    decoder.detach()
    decoder.video.pause()
    decoder.video.removeAttribute('src')
    decoder.video.load()
  }

  function allocate(request: LayerVideoRequest, playing: boolean): Decoder {
    const video = createVideo()
    const decoder: Decoder = {
      video, request: { ...request }, playing, released: false, seeking: false,
      playPending: false, playbackEpoch: 0, detach: () => undefined,
    }
    const ready = () => { synchronizeGroup(); options.onChange?.() }
    const seeked = () => { decoder.seeking = false; synchronizeGroup(); options.onChange?.() }
    const failed = () => {
      decoder.error = 'MEDIA_DECODE_FAILED'
      video.pause()
      synchronizeGroup()
      options.onChange?.()
    }
    video.addEventListener('loadedmetadata', ready)
    video.addEventListener('loadeddata', ready)
    video.addEventListener('canplay', ready)
    video.addEventListener('seeked', seeked)
    video.addEventListener('error', failed)
    decoder.detach = () => {
      video.removeEventListener('loadedmetadata', ready)
      video.removeEventListener('loadeddata', ready)
      video.removeEventListener('canplay', ready)
      video.removeEventListener('seeked', seeked)
      video.removeEventListener('error', failed)
    }
    video.muted = true
    video.defaultMuted = true
    video.playsInline = true
    video.preload = 'auto'
    video.src = request.url
    video.load()
    return decoder
  }

  function status(id: string): LayerDecoderStatus {
    const decoder = decoders.get(id)
    if (!decoder) return { state: 'missing' }
    if (decoder.error) return { state: 'error', reason: decoder.error }
    if (decoder.seeking || decoder.video.seeking) return { state: 'seeking' }
    if (decoder.video.readyState < 2) return { state: 'loading' }
    return { state: 'ready' }
  }

  return {
    update(requests, playing) {
      if (disposed) throw new Error('Decoder pool is disposed')
      if (requests.length > capacity) throw new Error('Layer decoder capacity exceeded')
      const ids = new Set<string>()
      for (const request of requests) {
        if (!request.id.trim() || !request.url.trim()) throw new Error('Invalid decoder identity or source')
        if (ids.has(request.id)) throw new Error('Duplicate layer decoder identity')
        ids.add(request.id)
        if (!Number.isSafeInteger(request.sourceTicks) || request.sourceTicks < 0) throw new Error('Invalid source time')
        if (!Number.isFinite(request.playbackRate) || request.playbackRate <= 0) throw new Error('Invalid playback rate')
      }
      // Validate the complete request before releasing any current resource.
      for (const [id, decoder] of decoders) {
        const request = requests.find(candidate => candidate.id === id)
        if (!request || request.url !== decoder.request.url) {
          release(decoder)
          decoders.delete(id)
        }
      }
      for (const request of requests) {
        const shouldPlay = playing && request.hold !== true
        let decoder = decoders.get(request.id)
        if (!decoder) {
          decoder = allocate(request, shouldPlay)
          decoders.set(request.id, decoder)
        } else {
          decoder.request = { ...request }
          if (decoder.playing !== shouldPlay) decoder.playbackEpoch += 1
          decoder.playing = shouldPlay
        }
      }
      synchronizeGroup()
    },
    frame(id) {
      return status(id).state === 'ready' ? decoders.get(id)!.video : null
    },
    status,
    dispose() {
      if (disposed) return
      disposed = true
      decoders.forEach(release)
      decoders.clear()
    },
  }
}
