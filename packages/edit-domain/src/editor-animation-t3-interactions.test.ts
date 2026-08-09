import { describe, expect, it } from 'vitest'

import { DEFAULT_CLIP_TIME_TRANSFORM } from './clip-time.ts'
import type { Clip } from './composition.ts'
import {
  animationKeyframesVisibleInPlacement,
  animationVisibleRangeForPlacement,
  compositionTicksToAnimationKeyframeTicks,
  projectAnimationKeyframeToCompositionTicks,
  type EditorAnimationTimeContextV1,
} from './editor-animation.ts'
import { mediaTime, PROJECT_TIMESCALE } from './time.ts'
import type { VisualPropertyTrack } from './visual-properties.ts'

const S = PROJECT_TIMESCALE
const MOTION_START = 10 * S
const MOTION_DURATION = 12 * S

const primary = (overrides: Partial<Clip> = {}): Clip => Object.freeze({
  clipId: 'clip_t4_time01',
  assetId: 'asset_t4_time01',
  sourceRange: Object.freeze({ start: mediaTime(MOTION_START), duration: mediaTime(8 * S) }),
  compositionStart: mediaTime(20 * S),
  enabled: true,
  segmentKind: 'video',
  freezeDuration: null,
  linkedAudio: null,
  timeTransform: DEFAULT_CLIP_TIME_TRANSFORM,
  gainDb: 0,
  fadeIn: mediaTime(0),
  fadeOut: mediaTime(0),
  pan: 0,
  ...overrides,
})

const context = (clip: Clip): EditorAnimationTimeContextV1 => Object.freeze({
  kind: 'primary-footage-motion',
  clip,
  motionSourceInterval: Object.freeze({ start: mediaTime(MOTION_START), duration: mediaTime(MOTION_DURATION) }),
})

const scaleTrack: VisualPropertyTrack = Object.freeze({
  property: 'scale',
  keyframes: Object.freeze([
    Object.freeze({ at: mediaTime(0), value: 1, easing: Object.freeze({ kind: 'linear' as const }) }),
    Object.freeze({ at: mediaTime(2 * S), value: 1.1, easing: Object.freeze({ kind: 'linear' as const }) }),
    Object.freeze({ at: mediaTime(4 * S), value: 1.2, easing: Object.freeze({ kind: 'linear' as const }) }),
    Object.freeze({ at: mediaTime(8 * S), value: 1.3, easing: Object.freeze({ kind: 'linear' as const }) }),
    Object.freeze({ at: mediaTime(12 * S), value: 1.4, easing: Object.freeze({ kind: 'linear' as const }) }),
  ]),
})

const roundTrip = (clip: Clip, canonicalTicks: number): number | null => {
  const projected = projectAnimationKeyframeToCompositionTicks(context(clip), canonicalTicks)
  return projected === null ? null : compositionTicksToAnimationKeyframeTicks(context(clip), projected)
}

describe('T4 source keyframes across T2/T3 timing families', () => {
  it('round-trips simple speeds exactly and non-simple rational speed within the existing one-tick edge-rounding bound', () => {
    const exactClips = [
      primary(),
      primary({ timeTransform: Object.freeze({ ...DEFAULT_CLIP_TIME_TRANSFORM, playbackRate: Object.freeze({ numerator: 1, denominator: 2 }) }) }),
      primary({ timeTransform: Object.freeze({ ...DEFAULT_CLIP_TIME_TRANSFORM, playbackRate: Object.freeze({ numerator: 2, denominator: 1 }) }) }),
    ]
    for (const clip of exactClips) {
      expect(roundTrip(clip, 2 * S)).toBe(2 * S)
      expect(roundTrip(clip, 4 * S)).toBe(4 * S)
    }
    const rational = primary({ timeTransform: Object.freeze({ ...DEFAULT_CLIP_TIME_TRANSFORM, playbackRate: Object.freeze({ numerator: 7, denominator: 3 }) }) })
    expect(Math.abs((roundTrip(rational, 2 * S) ?? 0) - 2 * S)).toBeLessThanOrEqual(1)
    expect(Math.abs((roundTrip(rational, 4 * S) ?? 0) - 4 * S)).toBeLessThanOrEqual(1)
  })

  it('reverse and reverse+2x invert composition order while preserving canonical source order', () => {
    const reverse = primary({ timeTransform: Object.freeze({ ...DEFAULT_CLIP_TIME_TRANSFORM, direction: 'reverse' as const }) })
    const reverseFast = primary({ timeTransform: Object.freeze({
      ...DEFAULT_CLIP_TIME_TRANSFORM,
      direction: 'reverse' as const,
      playbackRate: Object.freeze({ numerator: 2, denominator: 1 }),
    }) })
    for (const clip of [reverse, reverseFast]) {
      const earlySource = projectAnimationKeyframeToCompositionTicks(context(clip), 2 * S)!
      const lateSource = projectAnimationKeyframeToCompositionTicks(context(clip), 6 * S)!
      expect(earlySource).toBeGreaterThan(lateSource)
      expect(roundTrip(clip, 2 * S)).toBe(2 * S)
      expect(roundTrip(clip, 6 * S)).toBe(6 * S)
    }
  })

  it('standard trim hides source keyframes without moving the canonical source animation', () => {
    const trimmed = primary({ sourceRange: Object.freeze({ start: mediaTime(12 * S), duration: mediaTime(5 * S) }) })
    expect(animationVisibleRangeForPlacement(context(trimmed))).toEqual({ startTicks: 2 * S, endTicks: 7 * S })
    expect(animationKeyframesVisibleInPlacement(context(trimmed), scaleTrack).map((entry) => entry.keyframe.at.ticks)).toEqual([2 * S, 4 * S])
    expect(roundTrip(trimmed, 4 * S)).toBe(4 * S)
  })

  it('ripple and slide shift composition projection but never rewrite source keyframes', () => {
    const before = primary()
    const ripple = primary({ compositionStart: mediaTime(30 * S) })
    const slide = primary({ compositionStart: mediaTime(24 * S) })
    const canonical = 4 * S
    expect(projectAnimationKeyframeToCompositionTicks(context(ripple), canonical)! - projectAnimationKeyframeToCompositionTicks(context(before), canonical)!).toBe(10 * S)
    expect(projectAnimationKeyframeToCompositionTicks(context(slide), canonical)! - projectAnimationKeyframeToCompositionTicks(context(before), canonical)!).toBe(4 * S)
    expect(roundTrip(ripple, canonical)).toBe(canonical)
    expect(roundTrip(slide, canonical)).toBe(canonical)
  })

  it('roll changes visible source boundary without deleting the source-owned animation', () => {
    const leftRolled = primary({ sourceRange: Object.freeze({ start: mediaTime(10 * S), duration: mediaTime(5 * S) }) })
    const rightRolled = primary({ sourceRange: Object.freeze({ start: mediaTime(15 * S), duration: mediaTime(5 * S) }), compositionStart: mediaTime(25 * S) })
    expect(animationVisibleRangeForPlacement(context(leftRolled))).toEqual({ startTicks: 0, endTicks: 5 * S })
    expect(animationVisibleRangeForPlacement(context(rightRolled))).toEqual({ startTicks: 5 * S, endTicks: 10 * S })
    expect(scaleTrack.keyframes.map((frame) => frame.at.ticks)).toEqual([0, 2 * S, 4 * S, 8 * S, 12 * S])
  })

  it('slip changes the visible source-keyframe subset rather than following old composition positions', () => {
    const before = primary({ sourceRange: Object.freeze({ start: mediaTime(10 * S), duration: mediaTime(4 * S) }) })
    const slipped = primary({ sourceRange: Object.freeze({ start: mediaTime(14 * S), duration: mediaTime(4 * S) }) })
    expect(animationKeyframesVisibleInPlacement(context(before), scaleTrack).map((entry) => entry.keyframe.at.ticks)).toEqual([0, 2 * S, 4 * S])
    expect(animationKeyframesVisibleInPlacement(context(slipped), scaleTrack).map((entry) => entry.keyframe.at.ticks)).toEqual([4 * S, 8 * S])
    expect(projectAnimationKeyframeToCompositionTicks(context(before), 4 * S)).toBe(24 * S)
    expect(projectAnimationKeyframeToCompositionTicks(context(slipped), 4 * S)).toBe(20 * S)
  })

  it('split before, exactly at and after a source keyframe produces no duplicated canonical keyframe', () => {
    const splitAt = 4 * S
    const left = primary({ sourceRange: Object.freeze({ start: mediaTime(MOTION_START), duration: mediaTime(splitAt) }) })
    const right = primary({
      clipId: 'clip_t4_time02',
      sourceRange: Object.freeze({ start: mediaTime(MOTION_START + splitAt), duration: mediaTime(4 * S) }),
      compositionStart: mediaTime(24 * S),
    })
    const leftVisible = animationKeyframesVisibleInPlacement(context(left), scaleTrack).map((entry) => entry.keyframe.at.ticks)
    const rightVisible = animationKeyframesVisibleInPlacement(context(right), scaleTrack).map((entry) => entry.keyframe.at.ticks)
    expect(leftVisible).toEqual([0, 2 * S, 4 * S])
    expect(rightVisible).toEqual([4 * S, 8 * S])
    const canonical = new Set([...leftVisible, ...rightVisible])
    expect(canonical.size).toBe(4)
    expect(canonical.has(splitAt)).toBe(true)
  })

  it('repeated source placements project the same canonical source keyframe independently', () => {
    const first = primary({ compositionStart: mediaTime(5 * S) })
    const second = primary({ clipId: 'clip_t4_repeat02', compositionStart: mediaTime(50 * S) })
    const canonical = 2 * S
    expect(projectAnimationKeyframeToCompositionTicks(context(first), canonical)).toBe(7 * S)
    expect(projectAnimationKeyframeToCompositionTicks(context(second), canonical)).toBe(52 * S)
    expect(roundTrip(first, canonical)).toBe(canonical)
    expect(roundTrip(second, canonical)).toBe(canonical)
  })

  it('Freeze has no source animation projection', () => {
    const freeze = primary({
      segmentKind: 'freeze',
      freezeDuration: mediaTime(3 * S),
      sourceRange: Object.freeze({ start: mediaTime(12 * S), duration: mediaTime(1) }),
    })
    expect(projectAnimationKeyframeToCompositionTicks(context(freeze), 2 * S)).toBeNull()
    expect(animationVisibleRangeForPlacement(context(freeze))).toBeNull()
  })
})
