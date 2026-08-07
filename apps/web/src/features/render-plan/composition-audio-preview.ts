import type { MovingSourceSegmentNode, RenderPlan, TransitionEdgeNode } from '@sanverse/render-contract'
import { PROJECT_TIMESCALE } from '@sanverse/edit-domain'

import {
  playbackRateAt,
  segmentIndexAt,
  sourceTimeFor,
  type PlaybackSegment,
} from './segment-playback'

/**
 * One sound voice the browser Preview should be producing at one exact
 * composition tick. It is deliberately renderer-neutral: no AudioNode, no DOM
 * element and no wall clock. Same plan + same tick = same answer.
 */
export type PreviewAudioVoiceV1 = Readonly<{
  voiceId: string
  assetId: string
  sourceTicks: number
  playbackRate: number
  preservePitch: boolean
  gain: number
  pan: number
}>

export type CompositionAudioPreviewStateV1 = Readonly<{
  primary: PreviewAudioVoiceV1 | null
  auxiliary: readonly PreviewAudioVoiceV1[]
}>

const within = (tick: number, start: number, duration: number): boolean =>
  tick >= start && tick < start + duration

const dbGain = (db: number): number => Math.pow(10, db / 20)
const clamp01 = (value: number): number => Math.min(1, Math.max(0, value))

const fadeMultiplier = (
  offsetTicks: number,
  durationTicks: number,
  fadeInTicks: number,
  fadeOutTicks: number,
): number => {
  let value = 1
  if (fadeInTicks > 0 && offsetTicks < fadeInTicks) value *= clamp01(offsetTicks / fadeInTicks)
  if (fadeOutTicks > 0 && offsetTicks > durationTicks - fadeOutTicks) {
    value *= clamp01((durationTicks - offsetTicks) / fadeOutTicks)
  }
  return value
}

const transitionFade = (
  plan: RenderPlan,
  segment: MovingSourceSegmentNode,
  offsetTicks: number,
  audioDurationTicks: number,
): number => {
  let value = 1
  const incoming = plan.transitions.find((edge: TransitionEdgeNode) =>
    edge.toSegmentId === segment.nodeId && edge.audio === 'fade-through-silence')
  const outgoing = plan.transitions.find((edge: TransitionEdgeNode) =>
    edge.fromSegmentId === segment.nodeId && edge.audio === 'fade-through-silence')
  if (incoming && incoming.durationTicks > 0 && offsetTicks < incoming.durationTicks) {
    value *= clamp01(offsetTicks / incoming.durationTicks)
  }
  if (outgoing && outgoing.durationTicks > 0 && offsetTicks > audioDurationTicks - outgoing.durationTicks) {
    value *= clamp01((audioDurationTicks - offsetTicks) / outgoing.durationTicks)
  }
  return value
}

const segmentGain = (plan: RenderPlan, segment: MovingSourceSegmentNode, compositionTicks: number): number => {
  const window = segment.linkedAudio
  if (window === null) return 0
  const offset = compositionTicks - window.interval.start.ticks
  const duration = window.interval.duration.ticks
  return dbGain(segment.gainDb) *
    fadeMultiplier(offset, duration, segment.fadeInTicks, segment.fadeOutTicks) *
    transitionFade(plan, segment, offset, duration)
}

const sourceOffsetForRate = (
  compositionOffsetTicks: number,
  numerator: number,
  denominator: number,
): number => Math.floor((2 * compositionOffsetTicks * numerator + denominator) / (2 * denominator))

const linkedSourceTick = (
  segment: MovingSourceSegmentNode,
  compositionTicks: number,
): number | null => {
  const window = segment.linkedAudio
  if (window === null) return null
  const offset = compositionTicks - window.interval.start.ticks
  const sourceOffset = sourceOffsetForRate(
    offset,
    segment.playbackRateNumerator,
    segment.playbackRateDenominator,
  )
  if (segment.direction === 'reverse') {
    // A custom reverse J/L window would require a reverse proxy that includes
    // the extra audio handles. The current bounded reverse artifact contains
    // only the picture interval, so playing the original source here would be a
    // lie. The planner refuses creating that combination; this guard protects
    // older/manually-created data too.
    return null
  }
  return window.sourceStartTicks + sourceOffset
}

const voiceForSourceSegment = (
  plan: RenderPlan,
  segment: MovingSourceSegmentNode,
  assetId: string,
  sourceTicks: number,
  compositionTicks: number,
  voiceId: string,
  playbackRate: number,
): PreviewAudioVoiceV1 => Object.freeze({
  voiceId,
  assetId,
  sourceTicks,
  playbackRate,
  preservePitch: segment.maintainAudioPitch,
  gain: segmentGain(plan, segment, compositionTicks),
  pan: Math.min(1, Math.max(-1, segment.pan / 10_000)),
})

/**
 * Exact browser audio projection for A1 + J/L overlaps + A2.
 *
 * The picture's own HTMLVideoElement is intentionally NOT the sound authority.
 * Studio mutes it once and one managed AudioContext plays these voices. This is
 * what lets a J-cut overlap the previous picture, an L-cut overlap the next,
 * and music continue through a picture gap/freeze without a second timeline
 * clock.
 */
export const compositionAudioStateAt = (
  plan: RenderPlan,
  browserSegments: readonly PlaybackSegment[],
  compositionTicks: number,
): CompositionAudioPreviewStateV1 => {
  const canonical = [...plan.segments].sort(
    (left, right) => left.interval.start.ticks - right.interval.start.ticks || left.nodeId.localeCompare(right.nodeId),
  )
  const activeIndex = segmentIndexAt(browserSegments, compositionTicks)
  const browser = activeIndex >= 0 ? browserSegments[activeIndex] : null
  const sourceTarget = sourceTimeFor(browserSegments, compositionTicks)
  const canonicalActive = activeIndex >= 0 ? canonical[activeIndex] : null

  let primary: PreviewAudioVoiceV1 | null = null
  if (
    browser !== null &&
    browser.reversed !== true &&
    sourceTarget !== null &&
    canonicalActive?.kind === 'source-segment' &&
    canonicalActive.audioEnabled &&
    canonicalActive.linkedAudio !== null &&
    within(
      compositionTicks,
      canonicalActive.linkedAudio.interval.start.ticks,
      canonicalActive.linkedAudio.interval.duration.ticks,
    )
  ) {
    primary = voiceForSourceSegment(
      plan,
      canonicalActive,
      browser.assetId,
      sourceTarget.sourceTicks,
      compositionTicks,
      `primary:${canonicalActive.nodeId}:${browser.assetId}`,
      playbackRateAt(browserSegments, compositionTicks),
    )
  }

  const auxiliary: PreviewAudioVoiceV1[] = []
  for (const segment of canonical) {
    if (segment.kind !== 'source-segment' || !segment.audioEnabled || segment.linkedAudio === null) continue
    const window = segment.linkedAudio
    if (!within(compositionTicks, window.interval.start.ticks, window.interval.duration.ticks)) continue
    if (within(compositionTicks, segment.interval.start.ticks, segment.interval.duration.ticks)) continue
    const sourceTicks = linkedSourceTick(segment, compositionTicks)
    if (sourceTicks === null) continue
    auxiliary.push(voiceForSourceSegment(
      plan,
      segment,
      segment.assetId,
      sourceTicks,
      compositionTicks,
      `linked:${segment.nodeId}`,
      segment.playbackRateNumerator / segment.playbackRateDenominator,
    ))
  }

  for (const music of plan.music) {
    if (!within(compositionTicks, music.interval.start.ticks, music.interval.duration.ticks)) continue
    const offset = compositionTicks - music.interval.start.ticks
    auxiliary.push(Object.freeze({
      voiceId: `music:${music.nodeId}`,
      assetId: music.assetId,
      sourceTicks: music.sourceStartTicks + offset,
      playbackRate: 1,
      preservePitch: true,
      gain: dbGain(music.gainDb) * fadeMultiplier(
        offset,
        music.interval.duration.ticks,
        music.fadeInTicks,
        music.fadeOutTicks,
      ),
      pan: 0,
    }))
  }

  return Object.freeze({ primary, auxiliary: Object.freeze(auxiliary) })
}

export type BrowserAudioPreviewVoiceV1 = PreviewAudioVoiceV1 & Readonly<{ url: string }>

export type CompositionAudioPreviewController = Readonly<{
  supported: boolean
  setMaster(muted: boolean, volume: number): void
  update(voices: readonly BrowserAudioPreviewVoiceV1[], playing: boolean): void
  resume(): Promise<void>
  dispose(): void
}>

type ManagedVoice = {
  audio: HTMLAudioElement
  source: MediaElementAudioSourceNode
  gain: GainNode
  pan: StereoPannerNode | null
  url: string
}

/**
 * One bounded AudioContext for the whole Studio Preview.
 *
 * Hidden media elements are disposable voices. The visible video is muted once
 * and remains picture-only while this controller exists; monitor mute/volume is
 * applied at the one master node. No voice owns a clock: every update seeks it
 * from the composition tick calculated above.
 */
export const createCompositionAudioPreviewController = (
  video: HTMLVideoElement,
): CompositionAudioPreviewController => {
  const AudioContextCtor = typeof window === 'undefined'
    ? null
    : window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext ?? null
  if (AudioContextCtor === null || typeof document === 'undefined') {
    return Object.freeze({
      supported: false,
      setMaster() {},
      update() {},
      async resume() {},
      dispose() {},
    })
  }

  let context: AudioContext
  try {
    context = new AudioContextCtor()
  } catch {
    return Object.freeze({
      supported: false,
      setMaster() {},
      update() {},
      async resume() {},
      dispose() {},
    })
  }
  const master = context.createGain()
  master.connect(context.destination)
  const voices = new Map<string, ManagedVoice>()
  let disposed = false
  // The visible player is now picture-only. Every audible source, including
  // the same recording, goes through the one graph below so gain/pan/J/L/music
  // cannot double with native element audio.
  video.muted = true

  const destroy = (voiceId: string) => {
    const managed = voices.get(voiceId)
    if (!managed) return
    managed.audio.pause()
    managed.audio.removeAttribute('src')
    managed.audio.load()
    managed.source.disconnect()
    managed.gain.disconnect()
    managed.pan?.disconnect()
    voices.delete(voiceId)
  }

  const ensure = (voice: BrowserAudioPreviewVoiceV1): ManagedVoice => {
    const existing = voices.get(voice.voiceId)
    if (existing && existing.url === voice.url) return existing
    if (existing) destroy(voice.voiceId)
    const audio = document.createElement('audio')
    audio.preload = 'auto'
    audio.src = voice.url
    const source = context.createMediaElementSource(audio)
    const gain = context.createGain()
    const pan = typeof context.createStereoPanner === 'function' ? context.createStereoPanner() : null
    source.connect(gain)
    if (pan) {
      gain.connect(pan)
      pan.connect(master)
    } else {
      gain.connect(master)
    }
    const managed = { audio, source, gain, pan, url: voice.url }
    voices.set(voice.voiceId, managed)
    return managed
  }

  const seek = (audio: HTMLAudioElement, seconds: number) => {
    const apply = () => {
      if (!Number.isFinite(seconds) || seconds < 0) return
      try {
        if (!Number.isFinite(audio.currentTime) || Math.abs(audio.currentTime - seconds) > 0.08) {
          audio.currentTime = seconds
        }
      } catch {
        // Metadata may not exist yet. `loadedmetadata` retries the exact same
        // composition-derived time; it never advances animation state.
      }
    }
    if (audio.readyState === 0) audio.addEventListener('loadedmetadata', apply, { once: true })
    else apply()
  }

  return Object.freeze({
    supported: true,
    setMaster(muted, volume) {
      if (disposed) return
      const level = muted ? 0 : Math.min(1, Math.max(0, Number.isFinite(volume) ? volume : 0))
      master.gain.setValueAtTime(level, context.currentTime)
    },
    update(nextVoices, playing) {
      if (disposed) return
      const wanted = new Set(nextVoices.map((voice) => voice.voiceId))
      for (const voiceId of [...voices.keys()]) if (!wanted.has(voiceId)) destroy(voiceId)
      for (const voice of nextVoices) {
        const managed = ensure(voice)
        managed.gain.gain.setValueAtTime(Math.max(0, voice.gain), context.currentTime)
        managed.pan?.pan.setValueAtTime(Math.min(1, Math.max(-1, voice.pan)), context.currentTime)
        managed.audio.playbackRate = Math.max(0.1, Math.min(16, voice.playbackRate))
        const player = managed.audio as unknown as Record<string, unknown>
        if ('preservesPitch' in player) player.preservesPitch = voice.preservePitch
        else if ('webkitPreservesPitch' in player) player.webkitPreservesPitch = voice.preservePitch
        seek(managed.audio, voice.sourceTicks / PROJECT_TIMESCALE)
        if (playing) void managed.audio.play().catch(() => undefined)
        else managed.audio.pause()
      }
    },
    async resume() {
      if (disposed || context.state !== 'suspended') return
      try { await context.resume() } catch { /* browser keeps it suspended until another user gesture */ }
    },
    dispose() {
      if (disposed) return
      disposed = true
      for (const voiceId of [...voices.keys()]) destroy(voiceId)
      master.disconnect()
      video.muted = false
      void context.close().catch(() => undefined)
    },
  })
}
