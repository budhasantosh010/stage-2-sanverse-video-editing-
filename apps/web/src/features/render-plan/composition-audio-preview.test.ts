import { describe, expect, it } from 'vitest'

import type { RenderPlan } from '@sanverse/render-contract'
import { PROJECT_TIMESCALE } from '@sanverse/edit-domain'

import { compositionAudioStateAt } from './composition-audio-preview'
import { playbackSegments, withPreparedReversePreview } from './segment-playback'

const S = PROJECT_TIMESCALE
const t = (ticks: number) => ({ ticks, timescale: 1_440_000 as const })

const source = (
  nodeId: string,
  start: number,
  duration: number,
  sourceStart: number,
  overrides: Record<string, unknown> = {},
) => ({
  nodeId,
  kind: 'source-segment' as const,
  interval: { start: t(start), duration: t(duration) },
  assetId: `asset_${nodeId.slice(-8).padStart(8, 'a')}`,
  sourceStartTicks: sourceStart,
  sourceDurationTicks: duration,
  videoEnabled: true,
  audioEnabled: true,
  linkedAudio: {
    interval: { start: t(start), duration: t(duration) },
    sourceStartTicks: sourceStart,
    sourceDurationTicks: duration,
  },
  footageMotions: [],
  gainDb: 0,
  fadeInTicks: 0,
  fadeOutTicks: 0,
  playbackRateNumerator: 1,
  playbackRateDenominator: 1,
  direction: 'forward' as const,
  maintainAudioPitch: true,
  pan: 0,
  ...overrides,
})

const plan = (overrides: Partial<RenderPlan> = {}): RenderPlan => ({
  schemaVersion: 'sanverse.render-plan/v8',
  projectId: 'project_audio0001',
  projectRevision: 1,
  compositionId: 'composition_audio0001',
  width: 1920,
  height: 1080,
  durationTicks: 10 * S,
  sources: [
    { assetId: 'asset_aaaa0001', mediaKind: 'video' },
    { assetId: 'asset_aaaa0002', mediaKind: 'video' },
    { assetId: 'asset_music001', mediaKind: 'audio' },
  ],
  segments: [
    source('clip_aaaa0001', 0, 5 * S, 0, { assetId: 'asset_aaaa0001' }),
    source('clip_aaaa0002', 5 * S, 5 * S, 5 * S, { assetId: 'asset_aaaa0002' }),
  ],
  transitions: [],
  overlays: [],
  visuals: [],
  music: [],
  ...overrides,
}) as RenderPlan

describe('composition audio preview projection', () => {
  it('uses exact project gain/pan/fades for the primary A1 voice', () => {
    const p = plan({
      segments: [
        source('clip_aaaa0001', 0, 5 * S, 0, {
          assetId: 'asset_aaaa0001',
          gainDb: -6,
          pan: 5000,
          fadeInTicks: S,
        }),
        source('clip_aaaa0002', 5 * S, 5 * S, 5 * S, { assetId: 'asset_aaaa0002' }),
      ] as never,
    })
    const browser = playbackSegments(p)
    const atHalfSecond = compositionAudioStateAt(p, browser, S / 2)
    expect(atHalfSecond.primary?.assetId).toBe('asset_aaaa0001')
    expect(atHalfSecond.primary?.sourceTicks).toBe(S / 2)
    expect(atHalfSecond.primary?.pan).toBe(0.5)
    expect(atHalfSecond.primary?.gain ?? 0).toBeCloseTo(Math.pow(10, -6 / 20) * 0.5, 9)
  })

  it('mixes a J-cut as an auxiliary voice while the previous picture remains primary', () => {
    const p = plan({
      segments: [
        source('clip_aaaa0001', 0, 5 * S, 0, { assetId: 'asset_aaaa0001' }),
        source('clip_aaaa0002', 5 * S, 5 * S, 5 * S, {
          assetId: 'asset_aaaa0002',
          linkedAudio: {
            interval: { start: t(4 * S), duration: t(6 * S) },
            sourceStartTicks: 4 * S,
            sourceDurationTicks: 6 * S,
          },
        }),
      ] as never,
    })
    const state = compositionAudioStateAt(p, playbackSegments(p), 4.5 * S)
    expect(state.primary?.assetId).toBe('asset_aaaa0001')
    expect(state.auxiliary).toHaveLength(1)
    expect(state.auxiliary[0]).toMatchObject({
      voiceId: 'linked:clip_aaaa0002',
      assetId: 'asset_aaaa0002',
      sourceTicks: 4.5 * S,
    })
  })

  it('mixes an L-cut under the next picture and keeps the same linked clip identity', () => {
    const p = plan({
      segments: [
        source('clip_aaaa0001', 0, 5 * S, 0, {
          assetId: 'asset_aaaa0001',
          linkedAudio: {
            interval: { start: t(0), duration: t(6 * S) },
            sourceStartTicks: 0,
            sourceDurationTicks: 6 * S,
          },
        }),
        source('clip_aaaa0002', 5 * S, 5 * S, 5 * S, { assetId: 'asset_aaaa0002' }),
      ] as never,
    })
    const state = compositionAudioStateAt(p, playbackSegments(p), 5.5 * S)
    expect(state.primary?.assetId).toBe('asset_aaaa0002')
    expect(state.auxiliary.map((voice) => voice.voiceId)).toContain('linked:clip_aaaa0001')
  })

  it('keeps A2 music audible when there is no primary picture voice at the tick', () => {
    const p = plan({
      segments: [source('clip_aaaa0001', 0, 4 * S, 0, { assetId: 'asset_aaaa0001' })] as never,
      music: [{
        nodeId: 'music_aaaa0001',
        kind: 'music',
        interval: { start: t(4 * S), duration: t(4 * S) },
        assetId: 'asset_music001',
        sourceStartTicks: S,
        gainDb: -12,
        fadeInTicks: S,
        fadeOutTicks: 0,
      }],
    })
    const state = compositionAudioStateAt(p, playbackSegments(p), 4.5 * S)
    expect(state.primary).toBeNull()
    expect(state.auxiliary).toHaveLength(1)
    expect(state.auxiliary[0].sourceTicks).toBe(1.5 * S)
    expect(state.auxiliary[0].gain).toBeCloseTo(Math.pow(10, -12 / 20) * 0.5, 9)
  })

  it('applies transition fade-through-silence from the same v8 edge the exporter reads', () => {
    const p = plan({
      transitions: [{
        nodeId: 'transition_0001',
        kind: 'transition-edge',
        fromSegmentId: 'clip_aaaa0001',
        toSegmentId: 'clip_aaaa0002',
        style: 'dip-to-black',
        durationTicks: S,
        audio: 'fade-through-silence',
      }],
    })
    const outgoing = compositionAudioStateAt(p, playbackSegments(p), 4.5 * S)
    const incoming = compositionAudioStateAt(p, playbackSegments(p), 5.5 * S)
    expect(outgoing.primary?.gain).toBeCloseTo(0.5, 9)
    expect(incoming.primary?.gain).toBeCloseTo(0.5, 9)
  })

  it('never plays canonical reverse footage forwards while its proxy is still unavailable', () => {
    const p = plan({
      segments: [source('clip_aaaa0001', 0, 5 * S, 0, {
        assetId: 'asset_aaaa0001',
        direction: 'reverse',
      })] as never,
    })
    const canonical = playbackSegments(p)
    expect(compositionAudioStateAt(p, canonical, S).primary).toBeNull()

    const prepared = withPreparedReversePreview(canonical, {
      segmentIndex: 0,
      preparedAssetId: 'reverse-preview:clip_aaaa0001',
    })
    const ready = compositionAudioStateAt(p, prepared, S)
    expect(ready.primary?.assetId).toBe('reverse-preview:clip_aaaa0001')
    expect(ready.primary?.sourceTicks).toBe(S)
  })

  it('is random-access deterministic', () => {
    const p = plan()
    const browser = playbackSegments(p)
    const first = compositionAudioStateAt(p, browser, 3_333_333)
    compositionAudioStateAt(p, browser, 100)
    compositionAudioStateAt(p, browser, 9_000_000)
    const second = compositionAudioStateAt(p, browser, 3_333_333)
    expect(second).toEqual(first)
  })
})
