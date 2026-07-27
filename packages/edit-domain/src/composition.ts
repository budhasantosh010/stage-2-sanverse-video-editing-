import { err, isRecord, ok, type Result } from './result.ts'
import { findAsset, type VideoAsset } from './assets.ts'
import {
  ZERO_TIME,
  mediaTime,
  rangeIntersection,
  rangeWithin,
  validateMediaTime,
  validateTimeRange,
  type MediaTime,
  type TimeRange,
} from './time.ts'

/**
 * Which timeline a time value is measured on. Written out explicitly so no
 * reader ever has to guess, because guessing is how a caption ends up two
 * seconds late after a cut.
 */
export type TimeAnchor =
  | Readonly<{ space: 'source'; assetId: string; time: MediaTime }>
  | Readonly<{ space: 'clip'; clipId: string; time: MediaTime }>
  | Readonly<{ space: 'composition'; compositionId: string; time: MediaTime }>

/**
 * One piece of the finished video.
 *
 * `sourceRange` is the part of the asset used. `compositionStart` is where that
 * part begins in the finished video.
 *
 * INVARIANT (G4-A): a clip occupies exactly `sourceRange.duration` in the
 * composition. There is no separate composition duration field, which is what
 * makes "no retiming" impossible to express rather than merely discouraged.
 * Speed changes arrive with an explicit rate field in a later schema version.
 */
export type Clip = Readonly<{
  clipId: string
  assetId: string
  sourceRange: TimeRange
  compositionStart: MediaTime
  enabled: boolean
  /**
   * Loudness change for this piece, in decibels. 0 means untouched. Kept on the
   * clip rather than on a separate operation list so that cutting a clip in two
   * carries the loudness to both halves automatically.
   */
  gainDb: number
  /** Silence-to-full ramp at the head of this piece. Zero means no ramp. */
  fadeIn: MediaTime
  /** Full-to-silence ramp at the tail of this piece. Zero means no ramp. */
  fadeOut: MediaTime
}>

export type TrackKind = 'video' | 'audio' | 'overlay'

export type Track = Readonly<{
  trackId: string
  kind: TrackKind
  order: number
  clips: readonly Clip[]
}>

export type Composition = Readonly<{
  compositionId: string
  width: number
  height: number
  tracks: readonly Track[]
}>

export type CompositionIssueCode =
  | 'TYPE_INVALID'
  | 'FIELD_REQUIRED'
  | 'FIELD_UNKNOWN'
  | 'VALUE_OUT_OF_RANGE'
  | 'ASSET_UNKNOWN'
  | 'SOURCE_RANGE_OUTSIDE_ASSET'
  | 'CLIPS_OVERLAP'
  | 'DUPLICATE_ID'
  | 'GAIN_OUT_OF_RANGE'
  | 'FADE_LONGER_THAN_CLIP'

export type CompositionError = {
  readonly code: 'COMPOSITION_INVALID'
  readonly issues: readonly { readonly path: string; readonly code: CompositionIssueCode }[]
}

export const CLIP_ID_PATTERN = /^clip_[a-z0-9]{8,64}$/
export const TRACK_ID_PATTERN = /^track_[a-z0-9]{8,64}$/
export const COMPOSITION_ID_PATTERN = /^composition_[a-z0-9]{8,64}$/

const MAX_DIMENSION = 16_384

/**
 * Loudness bounds. -60 dB is inaudible in practice and +12 dB is the most a
 * clip can be lifted before clipping becomes unavoidable, so the domain refuses
 * values outside that band instead of exporting distortion.
 */
export const MIN_CLIP_GAIN_DB = -60
export const MAX_CLIP_GAIN_DB = 12

const CLIP_KEYS = [
  'clipId',
  'assetId',
  'sourceRange',
  'compositionStart',
  'enabled',
  'gainDb',
  'fadeIn',
  'fadeOut',
] as const
const TRACK_KEYS = ['trackId', 'kind', 'order', 'clips'] as const
const COMPOSITION_KEYS = ['compositionId', 'width', 'height', 'tracks'] as const
const TRACK_KINDS: readonly TrackKind[] = ['video', 'audio', 'overlay']

/** The half-open span this clip occupies in the finished video. */
export const clipCompositionRange = (clip: Clip): TimeRange =>
  Object.freeze({ start: clip.compositionStart, duration: clip.sourceRange.duration })

/** Map a time on a clip's own timeline to the finished video's timeline. */
export const clipTimeToComposition = (clip: Clip, clipTime: MediaTime): MediaTime =>
  mediaTime(clip.compositionStart.ticks + clipTime.ticks)

/** Map a time on the finished video's timeline back onto a clip's timeline. */
export const compositionTimeToClip = (clip: Clip, compositionTime: MediaTime): MediaTime =>
  mediaTime(compositionTime.ticks - clip.compositionStart.ticks)

/** Map a time on a clip's own timeline to a time inside the source asset. */
export const clipTimeToSource = (clip: Clip, clipTime: MediaTime): MediaTime =>
  mediaTime(clip.sourceRange.start.ticks + clipTime.ticks)

/** Map a time inside the source asset back onto a clip's own timeline. */
export const sourceTimeToClip = (clip: Clip, sourceTime: MediaTime): MediaTime =>
  mediaTime(sourceTime.ticks - clip.sourceRange.start.ticks)

/** One surviving appearance of a source-anchored span in the finished video. */
export type SourceSpanPlacement = Readonly<{
  clip: Clip
  /** The part of the source span this clip still carries. */
  sourceRange: TimeRange
  /** Where that part lands in the finished video. */
  compositionRange: TimeRange
}>

/**
 * Where a span of the original footage ends up after cutting.
 *
 * Edits the user anchored to the footage — a nameplate on a face, a caption on
 * a spoken word — are stored against the source timeline, never against the
 * finished timeline. This is the one function that translates. Trimming the
 * head off a clip therefore moves the nameplate with the face instead of
 * leaving it pinned to a wall-clock moment that now shows something else.
 *
 * A span cut into two pieces returns two placements, which is why a nameplate
 * survives a cut through the middle of itself and appears in both halves. A
 * span whose footage was deleted returns an empty list, and the caller shows
 * that plainly rather than guessing a new position.
 */
export const placeSourceSpan = (
  composition: Composition,
  assetId: string,
  sourceRange: TimeRange,
): readonly SourceSpanPlacement[] => {
  const placements: SourceSpanPlacement[] = []
  for (const track of composition.tracks) {
    for (const clip of track.clips) {
      if (clip.assetId !== assetId) continue
      const overlap = rangeIntersection(clip.sourceRange, sourceRange)
      if (!overlap) continue
      const offset = overlap.start.ticks - clip.sourceRange.start.ticks
      placements.push(Object.freeze({
        clip,
        sourceRange: overlap,
        compositionRange: Object.freeze({
          start: mediaTime(clip.compositionStart.ticks + offset),
          duration: overlap.duration,
        }),
      }))
    }
  }
  return Object.freeze(
    placements.sort((a, b) => a.compositionRange.start.ticks - b.compositionRange.start.ticks),
  )
}

/**
 * The piece of footage showing at a given moment of the finished video, or
 * undefined if that moment falls in a deliberate hole.
 */
export const clipAtCompositionTime = (composition: Composition, time: MediaTime): Clip | undefined => {
  for (const track of composition.tracks) {
    for (const clip of track.clips) {
      const start = clip.compositionStart.ticks
      if (time.ticks >= start && time.ticks < start + clip.sourceRange.duration.ticks) return clip
    }
  }
  return undefined
}

export const findClip = (composition: Composition, clipId: string): Clip | undefined => {
  for (const track of composition.tracks) {
    const clip = track.clips.find((candidate) => candidate.clipId === clipId)
    if (clip) return clip
  }
  return undefined
}

/** Exclusive end of the finished video: the furthest point any clip reaches. */
export const compositionDuration = (composition: Composition): MediaTime => {
  let ticks = 0
  for (const track of composition.tracks) {
    for (const clip of track.clips) {
      ticks = Math.max(ticks, clip.compositionStart.ticks + clip.sourceRange.duration.ticks)
    }
  }
  return mediaTime(ticks)
}

export const compositionRange = (composition: Composition): TimeRange =>
  Object.freeze({ start: ZERO_TIME, duration: compositionDuration(composition) })

type Issue = CompositionError['issues'][number]

const validateClip = (
  input: unknown,
  path: string,
  assets: readonly VideoAsset[],
  issues: Issue[],
): Clip | null => {
  if (!isRecord(input)) {
    issues.push({ path, code: 'TYPE_INVALID' })
    return null
  }
  for (const key of CLIP_KEYS) {
    if (!Object.hasOwn(input, key)) issues.push({ path: `${path}.${key}`, code: 'FIELD_REQUIRED' })
  }
  for (const key of Object.keys(input)) {
    if (!(CLIP_KEYS as readonly string[]).includes(key)) {
      issues.push({ path: `${path}.${key}`, code: 'FIELD_UNKNOWN' })
    }
  }
  if (typeof input.clipId !== 'string' || !CLIP_ID_PATTERN.test(input.clipId)) {
    issues.push({ path: `${path}.clipId`, code: 'VALUE_OUT_OF_RANGE' })
  }
  if (typeof input.enabled !== 'boolean') {
    issues.push({ path: `${path}.enabled`, code: 'TYPE_INVALID' })
  }
  const sourceRange = validateTimeRange(input.sourceRange, `${path}.sourceRange`)
  if (!sourceRange.ok) issues.push({ path: `${path}.sourceRange`, code: 'VALUE_OUT_OF_RANGE' })
  const compositionStart = validateMediaTime(input.compositionStart, `${path}.compositionStart`)
  if (!compositionStart.ok) issues.push({ path: `${path}.compositionStart`, code: 'VALUE_OUT_OF_RANGE' })

  const asset = typeof input.assetId === 'string' ? findAsset(assets, input.assetId) : undefined
  if (!asset) {
    issues.push({ path: `${path}.assetId`, code: 'ASSET_UNKNOWN' })
  } else if (sourceRange.ok) {
    const assetRange: TimeRange = { start: ZERO_TIME, duration: asset.duration }
    if (!rangeWithin(sourceRange.value, assetRange)) {
      issues.push({ path: `${path}.sourceRange`, code: 'SOURCE_RANGE_OUTSIDE_ASSET' })
    }
  }

  const gainDb = input.gainDb
  const gainValid =
    typeof gainDb === 'number' &&
    Number.isFinite(gainDb) &&
    gainDb >= MIN_CLIP_GAIN_DB &&
    gainDb <= MAX_CLIP_GAIN_DB
  if (!gainValid) issues.push({ path: `${path}.gainDb`, code: 'GAIN_OUT_OF_RANGE' })
  const fadeIn = validateMediaTime(input.fadeIn, `${path}.fadeIn`)
  if (!fadeIn.ok) issues.push({ path: `${path}.fadeIn`, code: 'VALUE_OUT_OF_RANGE' })
  const fadeOut = validateMediaTime(input.fadeOut, `${path}.fadeOut`)
  if (!fadeOut.ok) issues.push({ path: `${path}.fadeOut`, code: 'VALUE_OUT_OF_RANGE' })
  // Two ramps longer than the piece they live on would overlap and produce a
  // loudness curve nobody asked for, so the pair is refused rather than capped.
  if (fadeIn.ok && fadeOut.ok && sourceRange.ok) {
    if (fadeIn.value.ticks + fadeOut.value.ticks > sourceRange.value.duration.ticks) {
      issues.push({ path: `${path}.fadeIn`, code: 'FADE_LONGER_THAN_CLIP' })
    }
  }

  if (
    !sourceRange.ok ||
    !compositionStart.ok ||
    !asset ||
    !gainValid ||
    !fadeIn.ok ||
    !fadeOut.ok ||
    typeof input.clipId !== 'string' ||
    typeof input.enabled !== 'boolean'
  ) {
    return null
  }
  return Object.freeze({
    clipId: input.clipId,
    assetId: asset.assetId,
    sourceRange: sourceRange.value,
    compositionStart: compositionStart.value,
    enabled: input.enabled,
    gainDb,
    fadeIn: fadeIn.value,
    fadeOut: fadeOut.value,
  })
}

export const validateComposition = (
  input: unknown,
  assets: readonly VideoAsset[],
  path = '$',
): Result<Composition, CompositionError> => {
  const issues: Issue[] = []
  if (!isRecord(input)) {
    return err({ code: 'COMPOSITION_INVALID', issues: [{ path, code: 'TYPE_INVALID' }] })
  }
  for (const key of COMPOSITION_KEYS) {
    if (!Object.hasOwn(input, key)) issues.push({ path: `${path}.${key}`, code: 'FIELD_REQUIRED' })
  }
  for (const key of Object.keys(input)) {
    if (!(COMPOSITION_KEYS as readonly string[]).includes(key)) {
      issues.push({ path: `${path}.${key}`, code: 'FIELD_UNKNOWN' })
    }
  }
  if (typeof input.compositionId !== 'string' || !COMPOSITION_ID_PATTERN.test(input.compositionId)) {
    issues.push({ path: `${path}.compositionId`, code: 'VALUE_OUT_OF_RANGE' })
  }
  for (const key of ['width', 'height'] as const) {
    const value = input[key]
    if (!Number.isSafeInteger(value) || (value as number) <= 0 || (value as number) > MAX_DIMENSION) {
      issues.push({ path: `${path}.${key}`, code: 'VALUE_OUT_OF_RANGE' })
    }
  }

  const tracks: Track[] = []
  const seenTrackIds = new Set<string>()
  const seenClipIds = new Set<string>()
  if (!Array.isArray(input.tracks)) {
    issues.push({ path: `${path}.tracks`, code: 'TYPE_INVALID' })
  } else {
    input.tracks.forEach((rawTrack, trackIndex) => {
      const trackPath = `${path}.tracks[${trackIndex}]`
      if (!isRecord(rawTrack)) {
        issues.push({ path: trackPath, code: 'TYPE_INVALID' })
        return
      }
      for (const key of TRACK_KEYS) {
        if (!Object.hasOwn(rawTrack, key)) issues.push({ path: `${trackPath}.${key}`, code: 'FIELD_REQUIRED' })
      }
      for (const key of Object.keys(rawTrack)) {
        if (!(TRACK_KEYS as readonly string[]).includes(key)) {
          issues.push({ path: `${trackPath}.${key}`, code: 'FIELD_UNKNOWN' })
        }
      }
      if (typeof rawTrack.trackId !== 'string' || !TRACK_ID_PATTERN.test(rawTrack.trackId)) {
        issues.push({ path: `${trackPath}.trackId`, code: 'VALUE_OUT_OF_RANGE' })
      } else if (seenTrackIds.has(rawTrack.trackId)) {
        issues.push({ path: `${trackPath}.trackId`, code: 'DUPLICATE_ID' })
      } else {
        seenTrackIds.add(rawTrack.trackId)
      }
      if (!TRACK_KINDS.includes(rawTrack.kind as TrackKind)) {
        issues.push({ path: `${trackPath}.kind`, code: 'VALUE_OUT_OF_RANGE' })
      }
      if (!Number.isSafeInteger(rawTrack.order) || (rawTrack.order as number) < 0) {
        issues.push({ path: `${trackPath}.order`, code: 'VALUE_OUT_OF_RANGE' })
      }

      const clips: Clip[] = []
      if (!Array.isArray(rawTrack.clips)) {
        issues.push({ path: `${trackPath}.clips`, code: 'TYPE_INVALID' })
      } else {
        rawTrack.clips.forEach((rawClip, clipIndex) => {
          const clip = validateClip(rawClip, `${trackPath}.clips[${clipIndex}]`, assets, issues)
          if (!clip) return
          if (seenClipIds.has(clip.clipId)) {
            issues.push({ path: `${trackPath}.clips[${clipIndex}].clipId`, code: 'DUPLICATE_ID' })
            return
          }
          seenClipIds.add(clip.clipId)
          clips.push(clip)
        })
        // Clips on one track are laid end to end; they may touch but never overlap.
        const ordered = [...clips].sort((a, b) => a.compositionStart.ticks - b.compositionStart.ticks)
        for (let index = 1; index < ordered.length; index += 1) {
          const previous = ordered[index - 1]
          const current = ordered[index]
          if (current.compositionStart.ticks < previous.compositionStart.ticks + previous.sourceRange.duration.ticks) {
            issues.push({ path: `${trackPath}.clips`, code: 'CLIPS_OVERLAP' })
            break
          }
        }
      }

      if (
        typeof rawTrack.trackId === 'string' &&
        TRACK_KINDS.includes(rawTrack.kind as TrackKind) &&
        Number.isSafeInteger(rawTrack.order)
      ) {
        tracks.push(Object.freeze({
          trackId: rawTrack.trackId,
          kind: rawTrack.kind as TrackKind,
          order: rawTrack.order as number,
          clips: Object.freeze(clips),
        }))
      }
    })
  }

  if (issues.length > 0) return err({ code: 'COMPOSITION_INVALID', issues })

  return ok(Object.freeze({
    compositionId: input.compositionId as string,
    width: input.width as number,
    height: input.height as number,
    tracks: Object.freeze([...tracks].sort((a, b) => a.order - b.order)),
  }))
}

/** The single-clip composition every imported video starts as. */
export const createSingleClipComposition = (input: {
  readonly compositionId: string
  readonly trackId: string
  readonly clipId: string
  readonly asset: VideoAsset
}): Result<Composition, CompositionError> =>
  validateComposition(
    {
      compositionId: input.compositionId,
      width: input.asset.width,
      height: input.asset.height,
      tracks: [
        {
          trackId: input.trackId,
          kind: 'video',
          order: 0,
          clips: [
            {
              clipId: input.clipId,
              assetId: input.asset.assetId,
              sourceRange: { start: ZERO_TIME, duration: input.asset.duration },
              compositionStart: ZERO_TIME,
              enabled: true,
              gainDb: 0,
              fadeIn: ZERO_TIME,
              fadeOut: ZERO_TIME,
            },
          ],
        },
      ],
    },
    [input.asset],
  )
