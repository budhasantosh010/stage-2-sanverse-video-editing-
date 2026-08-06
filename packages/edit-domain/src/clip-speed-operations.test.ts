import { describe, expect, it } from 'vitest'

import {
  CENTRE_PAN,
  clipCompositionDurationTicks,
  clipCompositionEndTicks,
  clipIsRetimed,
  findClip,
  placeSourceSpan,
  validateComposition,
  type Composition,
} from './composition.ts'
import { DEFAULT_CLIP_TIME_TRANSFORM } from './clip-time.ts'
import { applyTimelineOperation, validateTimelineOperation } from './timeline-operations.ts'
import { CLIP_TIME_TRANSFORM_PRIMITIVE_ID, SPLIT_PRIMITIVE_ID, TRIM_PRIMITIVE_ID } from './capabilities.ts'
import type { MediaAsset } from './assets.ts'

const S = 1_440_000
const time = (ticks: number) => ({ ticks, timescale: 1_440_000 as const })

const asset: MediaAsset = Object.freeze({
  schemaVersion: 'sanverse.asset/v1',
  assetId: 'asset_speed001',
  mediaKind: 'video',
  storageRef: 'project:speed/source',
  byteLength: 1_000_000,
  durationResidualSeconds: 0,
  width: 1920,
  height: 1080,
  duration: time(60 * S),
  frameRate: Object.freeze({ numerator: 30, denominator: 1 }),
  hasAudio: true,
}) as unknown as MediaAsset

const clip = (clipId: string, sourceStart: number, sourceDuration: number, compositionStart: number) => ({
  clipId,
  assetId: asset.assetId,
  sourceRange: { start: time(sourceStart), duration: time(sourceDuration) },
  compositionStart: time(compositionStart),
  enabled: true,
  gainDb: 0,
  fadeIn: time(0),
  fadeOut: time(0),
})

/** Two ten-second pieces laid end to end, both at normal speed. */
const twoClips = (): Composition => {
  const built = validateComposition(
    {
      compositionId: 'composition_speed001',
      width: 1920,
      height: 1080,
      tracks: [
        {
          trackId: 'track_speed001',
          kind: 'video',
          order: 0,
          clips: [clip('clip_speed001', 0, 10 * S, 0), clip('clip_speed002', 10 * S, 10 * S, 10 * S)],
        },
      ],
    },
    [asset],
  )
  if (!built.ok) throw new Error(`fixture did not validate: ${JSON.stringify(built.error.issues)}`)
  return built.value
}

const speedOperation = (input: {
  clipId: string
  numerator: number
  denominator: number
  durationPolicy?: 'ripple' | 'preserve-start'
  maintainAudioPitch?: boolean
  direction?: 'forward' | 'reverse'
  operationId?: string
}) => ({
  schemaVersion: 'sanverse.operation/v3' as const,
  operationId: input.operationId ?? 'operation_speed0001',
  kind: 'set-clip-time-transform' as const,
  capabilityId: CLIP_TIME_TRANSFORM_PRIMITIVE_ID,
  clipId: input.clipId,
  playbackRate: { numerator: input.numerator, denominator: input.denominator },
  direction: input.direction ?? ('forward' as const),
  maintainAudioPitch: input.maintainAudioPitch ?? true,
  durationPolicy: input.durationPolicy ?? ('ripple' as const),
  extensions: {},
})

const apply = (composition: Composition, raw: unknown): Composition => {
  const checked = validateTimelineOperation(raw)
  if (!checked.ok) throw new Error(`operation invalid: ${JSON.stringify(checked.error.issues)}`)
  const applied = applyTimelineOperation(composition, checked.value, [asset])
  if (!applied.ok) throw new Error(`apply refused: ${applied.error.reason}`)
  return applied.value
}

describe('a project saved before speed existed opens unchanged', () => {
  it('reads a clip with no speed written on it as normal speed', () => {
    const composition = twoClips()
    const first = findClip(composition, 'clip_speed001')
    expect(first?.timeTransform).toEqual(DEFAULT_CLIP_TIME_TRANSFORM)
    expect(first?.pan).toBe(CENTRE_PAN)
    expect(clipIsRetimed(first!)).toBe(false)
  })

  it('gives an untouched clip exactly the length it always had, to the tick', () => {
    const composition = twoClips()
    const first = findClip(composition, 'clip_speed001')!
    expect(clipCompositionDurationTicks(first)).toBe(first.sourceRange.duration.ticks)
    expect(clipCompositionEndTicks(first)).toBe(10 * S)
  })

  it('still refuses a speed somebody hand-edited into a file badly', () => {
    const broken = validateComposition(
      {
        compositionId: 'composition_speed001',
        width: 1920,
        height: 1080,
        tracks: [{
          trackId: 'track_speed001',
          kind: 'video',
          order: 0,
          clips: [{ ...clip('clip_speed001', 0, 10 * S, 0), timeTransform: { playbackRate: { numerator: 2, denominator: 4 }, direction: 'forward', maintainAudioPitch: true } }],
        }],
      },
      [asset],
    )
    expect(broken.ok).toBe(false)
  })
})

describe('changing a piece to a different speed', () => {
  it('halves its length on screen at 2x, and keeps its start where it was', () => {
    const after = apply(twoClips(), speedOperation({ clipId: 'clip_speed001', numerator: 2, denominator: 1 }))
    const first = findClip(after, 'clip_speed001')!
    expect(first.compositionStart.ticks).toBe(0)
    expect(clipCompositionDurationTicks(first)).toBe(5 * S)
    // The amount of RECORDING used is untouched. Speed changes how long it
    // takes to play, not which part of the file is played.
    expect(first.sourceRange.duration.ticks).toBe(10 * S)
  })

  it('doubles its length on screen at half speed', () => {
    const after = apply(twoClips(), speedOperation({ clipId: 'clip_speed001', numerator: 1, denominator: 2 }))
    expect(clipCompositionDurationTicks(findClip(after, 'clip_speed001')!)).toBe(20 * S)
  })

  it('pulls everything after it earlier when it gets shorter', () => {
    const after = apply(twoClips(), speedOperation({ clipId: 'clip_speed001', numerator: 2, denominator: 1 }))
    // The second piece used to start at 10 s; the first is now 5 s long.
    expect(findClip(after, 'clip_speed002')!.compositionStart.ticks).toBe(5 * S)
  })

  it('pushes everything after it later when it gets longer', () => {
    const after = apply(twoClips(), speedOperation({ clipId: 'clip_speed001', numerator: 1, denominator: 2 }))
    expect(findClip(after, 'clip_speed002')!.compositionStart.ticks).toBe(20 * S)
  })

  it('leaves the sequence with no hole and no overlap after a ripple', () => {
    const after = apply(twoClips(), speedOperation({ clipId: 'clip_speed001', numerator: 4, denominator: 1 }))
    const first = findClip(after, 'clip_speed001')!
    const second = findClip(after, 'clip_speed002')!
    expect(second.compositionStart.ticks).toBe(clipCompositionEndTicks(first))
  })

  it('moves nothing else when the user chose not to push the rest along', () => {
    const after = apply(
      twoClips(),
      speedOperation({ clipId: 'clip_speed001', numerator: 2, denominator: 1, durationPolicy: 'preserve-start' }),
    )
    expect(findClip(after, 'clip_speed002')!.compositionStart.ticks).toBe(10 * S)
    // Which leaves a deliberate hole between 5 s and 10 s, exactly as asked.
    expect(clipCompositionEndTicks(findClip(after, 'clip_speed001')!)).toBe(5 * S)
  })

  it('REFUSES rather than overwriting when growing in place would collide', () => {
    const checked = validateTimelineOperation(
      speedOperation({ clipId: 'clip_speed001', numerator: 1, denominator: 2, durationPolicy: 'preserve-start' }),
    )
    expect(checked.ok).toBe(true)
    if (!checked.ok) return
    const applied = applyTimelineOperation(twoClips(), checked.value, [asset])
    expect(applied.ok).toBe(false)
    if (!applied.ok) expect(applied.error.reason).toBe('RESULT_INVALID')
  })

  it('records the pitch switch and the speed together', () => {
    const after = apply(
      twoClips(),
      speedOperation({ clipId: 'clip_speed001', numerator: 2, denominator: 1, maintainAudioPitch: false }),
    )
    const first = findClip(after, 'clip_speed001')!
    expect(first.timeTransform.maintainAudioPitch).toBe(false)
    expect(clipIsRetimed(first)).toBe(true)
  })

  it('pulls a fade in that no longer fits the shorter piece', () => {
    const composition = twoClips()
    const withFade = validateComposition(
      {
        ...composition,
        tracks: [{
          ...composition.tracks[0],
          clips: [
            { ...composition.tracks[0].clips[0], fadeIn: time(8 * S) },
            composition.tracks[0].clips[1],
          ],
        }],
      },
      [asset],
    )
    expect(withFade.ok).toBe(true)
    if (!withFade.ok) return
    // Eight seconds of fade on a ten-second piece is fine. At 4x the piece is
    // two and a half seconds long, so the fade is pulled in to fit rather than
    // the whole speed change being refused over a ramp set minutes ago.
    const after = apply(withFade.value, speedOperation({ clipId: 'clip_speed001', numerator: 4, denominator: 1 }))
    const first = findClip(after, 'clip_speed001')!
    expect(clipCompositionDurationTicks(first)).toBe(2.5 * S)
    expect(first.fadeIn.ticks).toBe(2.5 * S)
  })
})

describe('the speed request itself', () => {
  it('refuses a fraction that is not in lowest terms', () => {
    expect(validateTimelineOperation(speedOperation({ clipId: 'clip_speed001', numerator: 2, denominator: 4 })).ok).toBe(false)
  })

  it('refuses a speed outside the range, an unknown direction and a missing policy', () => {
    expect(validateTimelineOperation(speedOperation({ clipId: 'clip_speed001', numerator: 20, denominator: 1 })).ok).toBe(false)
    expect(validateTimelineOperation({
      ...speedOperation({ clipId: 'clip_speed001', numerator: 2, denominator: 1 }),
      direction: 'sideways',
    }).ok).toBe(false)
    const { durationPolicy: _dropped, ...withoutPolicy } = speedOperation({ clipId: 'clip_speed001', numerator: 2, denominator: 1 })
    expect(validateTimelineOperation(withoutPolicy).ok).toBe(false)
  })

  it('refuses an unknown extra field', () => {
    expect(validateTimelineOperation({
      ...speedOperation({ clipId: 'clip_speed001', numerator: 2, denominator: 1 }),
      surprise: true,
    }).ok).toBe(false)
  })

  it('accepts a request that names the backwards direction, even though the panel refuses it', () => {
    // The domain records intent; whether the preview can SHOW it is a separate
    // question answered where the user is, not here. Writing the refusal into
    // the domain would mean removing it later touches saved history.
    expect(validateTimelineOperation(
      speedOperation({ clipId: 'clip_speed001', numerator: 1, denominator: 1, direction: 'reverse' }),
    ).ok).toBe(true)
  })
})

describe('cutting and trimming a piece that is not at normal speed', () => {
  const at2x = () => apply(twoClips(), speedOperation({ clipId: 'clip_speed001', numerator: 2, denominator: 1 }))

  const splitOperation = {
    schemaVersion: 'sanverse.operation/v3' as const,
    operationId: 'operation_split0001',
    kind: 'split-clip' as const,
    capabilityId: SPLIT_PRIMITIVE_ID,
    clipId: 'clip_speed001',
    atClipTime: time(4 * S),
    newClipId: 'clip_speed003',
    extensions: {},
  }

  it('leaves the two halves exactly touching, with no gap and no overlap', () => {
    const after = apply(at2x(), splitOperation)
    const left = findClip(after, 'clip_speed001')!
    const right = findClip(after, 'clip_speed003')!
    expect(right.compositionStart.ticks).toBe(clipCompositionEndTicks(left))
  })

  it('leaves the whole piece exactly as long as it was before the cut', () => {
    const before = at2x()
    const wholeLength = clipCompositionDurationTicks(findClip(before, 'clip_speed001')!)
    const after = apply(before, splitOperation)
    const left = clipCompositionDurationTicks(findClip(after, 'clip_speed001')!)
    const right = clipCompositionDurationTicks(findClip(after, 'clip_speed003')!)
    expect(left + right).toBe(wholeLength)
  })

  it('does not move the piece that comes after the cut', () => {
    const after = apply(at2x(), splitOperation)
    expect(findClip(after, 'clip_speed002')!.compositionStart.ticks).toBe(5 * S)
  })

  it('carries the speed to both halves', () => {
    const after = apply(at2x(), splitOperation)
    expect(findClip(after, 'clip_speed001')!.timeTransform.playbackRate).toEqual({ numerator: 2, denominator: 1 })
    expect(findClip(after, 'clip_speed003')!.timeTransform.playbackRate).toEqual({ numerator: 2, denominator: 1 })
  })

  it('closes the gap by the ON-SCREEN amount when a trim ripples', () => {
    const trim = {
      schemaVersion: 'sanverse.operation/v3' as const,
      operationId: 'operation_trim00001',
      kind: 'trim-clip' as const,
      capabilityId: TRIM_PRIMITIVE_ID,
      clipId: 'clip_speed001',
      trimStart: time(0),
      trimEnd: time(4 * S),
      ripple: true,
      extensions: {},
    }
    // Four seconds of RECORDING taken off a 2x piece is two seconds off the
    // screen. The next piece therefore moves back two seconds, not four.
    const after = apply(at2x(), trim)
    expect(clipCompositionDurationTicks(findClip(after, 'clip_speed001')!)).toBe(3 * S)
    expect(findClip(after, 'clip_speed002')!.compositionStart.ticks).toBe(3 * S)
  })

  it('slides the piece right by the ON-SCREEN amount when a head trim does not ripple', () => {
    const trim = {
      schemaVersion: 'sanverse.operation/v3' as const,
      operationId: 'operation_trim00002',
      kind: 'trim-clip' as const,
      capabilityId: TRIM_PRIMITIVE_ID,
      clipId: 'clip_speed001',
      trimStart: time(4 * S),
      trimEnd: time(0),
      ripple: false,
      extensions: {},
    }
    const after = apply(at2x(), trim)
    const first = findClip(after, 'clip_speed001')!
    expect(first.compositionStart.ticks).toBe(2 * S)
    expect(clipCompositionDurationTicks(first)).toBe(3 * S)
  })
})

describe('things pinned to a moment of the footage follow the speed', () => {
  it('halves where a pinned span lands when the footage plays at 2x', () => {
    const after = apply(twoClips(), speedOperation({ clipId: 'clip_speed001', numerator: 2, denominator: 1 }))
    // A span covering seconds 4 to 6 of the recording. At 2x that is seconds
    // 2 to 3 of the finished video.
    const [placement] = placeSourceSpan(after, asset.assetId, { start: time(4 * S), duration: time(2 * S) })
    expect(placement.compositionRange.start.ticks).toBe(2 * S)
    expect(placement.compositionRange.duration.ticks).toBe(1 * S)
  })

  it('leaves a pinned span exactly where it was when nothing was retimed', () => {
    const [placement] = placeSourceSpan(twoClips(), asset.assetId, { start: time(4 * S), duration: time(2 * S) })
    expect(placement.compositionRange.start.ticks).toBe(4 * S)
    expect(placement.compositionRange.duration.ticks).toBe(2 * S)
  })

  it('still splits a pinned span across two pieces of footage', () => {
    const [first, second] = placeSourceSpan(twoClips(), asset.assetId, { start: time(8 * S), duration: time(4 * S) })
    expect(first.compositionRange.start.ticks).toBe(8 * S)
    expect(second.compositionRange.start.ticks).toBe(10 * S)
  })
})
