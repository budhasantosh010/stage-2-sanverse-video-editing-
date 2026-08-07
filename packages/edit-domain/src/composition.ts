import { err, isRecord, ok, type Result } from './result.ts'
import { findAsset, type MediaAsset, type VideoAsset } from './assets.ts'
import {
  DEFAULT_CLIP_TIME_TRANSFORM,
  anchoredCompositionDuration,
  compositionTicksForSourceOffset,
  isDefaultClipTimeTransform,
  sourceTicksForCompositionOffset,
  validateClipTimeTransform,
  type ClipTimeTransformV1,
} from './clip-time.ts'
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
 * INVARIANT (G4-A, amended by T2): a clip occupies exactly
 * `clipCompositionDurationTicks(clip)` in the composition. There is still no
 * stored composition-duration field — the length on the timeline is DERIVED
 * from the source length and the speed, never written down twice. Two fields
 * that must agree eventually disagree; one field and a rule cannot.
 *
 * Before T2 the derived length was always identical to `sourceRange.duration`,
 * and for every piece at normal speed it still is, to the tick. That is why no
 * saved project needed rewriting when speed arrived.
 */
export type PrimarySegmentKind = 'video' | 'freeze'

/**
 * The sound window that remains linked to one ordinary picture clip.
 *
 * `compositionOffsetTicks` is signed and measured from the picture's start.
 * A negative value is a J-cut; a window that ends after the picture is an
 * L-cut. The source interval and the picture still share one clip identity,
 * speed, direction, gain, fades, and pan. There is deliberately no unlink.
 */
export type LinkedAudioWindowV1 = Readonly<{
  sourceRange: TimeRange
  compositionOffsetTicks: number
}>

export type Clip = Readonly<{
  clipId: string
  assetId: string
  sourceRange: TimeRange
  compositionStart: MediaTime
  enabled: boolean
  /** Absent in legacy/plain inputs; validation always returns an explicit value. */
  segmentKind?: PrimarySegmentKind
  /** Required and positive only when `segmentKind` is `freeze`; otherwise null. */
  freezeDuration?: MediaTime | null
  /** Optional full linked-audio window. Null means exactly the picture window. */
  linkedAudio?: LinkedAudioWindowV1 | null
  /**
   * How this piece is played through: its speed, whether it runs backwards,
   * and whether sped-up voices keep their normal pitch.
   *
   * Always present after validation. A stored clip that does not mention it —
   * which is every clip in every project saved before speed existed — reads as
   * `DEFAULT_CLIP_TIME_TRANSFORM`, meaning normal speed, forwards, pitch kept.
   * That default is not a guess: it is exactly and only what those projects
   * already did, so reading them produces the identical video.
   */
  timeTransform: ClipTimeTransformV1
  /**
   * Loudness change for this piece, in decibels. 0 means untouched. Kept on the
   * clip rather than on a separate operation list so that cutting a clip in two
   * carries the loudness to both halves automatically.
   */
  gainDb: number
  /**
   * Silence-to-full ramp at the head of this piece. Zero means no ramp.
   *
   * Measured in FINISHED-VIDEO time, because that is what the listener hears:
   * "half a second to fade up" means half a second on the viewer's clock, not
   * half a second of recording that a 2x speed would compress into a quarter.
   * At normal speed the two readings are the same number, which is why no
   * saved project changed when speed arrived.
   */
  fadeIn: MediaTime
  /** Full-to-silence ramp at the tail of this piece, in finished-video time. */
  fadeOut: MediaTime
  /**
   * Where this piece's sound sits between the left and right speakers.
   *
   * Held in hundredths of a percent — what a bank calls basis points — so it
   * is a whole number and cannot drift:
   *
   *   -10000  all the way left
   *        0  centred (what everything is until somebody moves it)
   *   +10000  all the way right
   *
   * A decimal from -1 to 1 was the obvious alternative and was rejected for
   * the same reason speed is a fraction: 0.1 cannot be held exactly, so two
   * "identical" projects could hash differently and re-export for nothing.
   *
   * Absent in a stored clip means centred, which is what every project saved
   * before this existed already did.
   */
  pan: number
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
  /**
   * A composition is what the finished video is MADE OF, so every piece in it
   * must be footage. A picture or a piece of music laid over the video is not a
   * piece of the video's own body; those are overlays, and they live in
   * operations rather than in tracks. Refusing them here means no later reader
   * has to wonder what a still image with no length is doing on the timeline.
   */
  | 'ASSET_NOT_VIDEO'
  | 'SOURCE_RANGE_OUTSIDE_ASSET'
  | 'CLIPS_OVERLAP'
  | 'DUPLICATE_ID'
  | 'GAIN_OUT_OF_RANGE'
  | 'FADE_LONGER_THAN_CLIP'
  /**
   * The piece would occupy no time at all in the finished video.
   *
   * Only reachable through an extreme speed on a very short stretch — one tick
   * of recording at 16x. Such a piece cannot be seen, clicked or selected, so
   * a user who made one would believe their clip had been deleted. Refusing it
   * is the honest answer; silently stretching it to one tick is not, because
   * that breaks the rule that cutting a piece in two preserves its length.
   */
  | 'CLIP_TOO_SHORT_TO_SEE'

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

/** Full left and full right, in hundredths of a percent. See `Clip.pan`. */
export const MIN_CLIP_PAN = -10_000
export const MAX_CLIP_PAN = 10_000
export const CENTRE_PAN = 0

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

/**
 * Keys a stored clip MAY carry. Missing means the documented default, never a
 * refusal.
 *
 * This is how speed was added without rewriting a single saved project. The
 * alternative — adding `timeTransform` to the required list — would have made
 * every project on disk invalid until a migration rewrote it, and a migration
 * that touches the user's stored edits in order to add a setting they have not
 * used is a bad trade. The same reasoning already governs `framing` on the
 * render plan.
 */
const OPTIONAL_CLIP_KEYS = [
  'timeTransform',
  'pan',
  'segmentKind',
  'freezeDuration',
  'linkedAudio',
] as const
const TRACK_KEYS = ['trackId', 'kind', 'order', 'clips'] as const
const COMPOSITION_KEYS = ['compositionId', 'width', 'height', 'tracks'] as const
const TRACK_KINDS: readonly TrackKind[] = ['video', 'audio', 'overlay']

/**
 * HOW LONG THIS PIECE IS IN THE FINISHED VIDEO.
 *
 * The single authority. Anywhere that used to write
 * `clip.sourceRange.duration.ticks` and mean "how long it is on the timeline"
 * must call this instead, because those two numbers stopped being the same the
 * moment speed existed.
 *
 * A piece at normal speed gets back exactly `sourceRange.duration.ticks`, with
 * no arithmetic at all, so nothing about an untouched project can shift.
 */
export const isFreezeClip = (clip: Clip): boolean => clip.segmentKind === 'freeze'

export const clipCompositionDurationTicks = (clip: Clip): number =>
  isFreezeClip(clip)
    ? clip.freezeDuration?.ticks ?? 0
    : anchoredCompositionDuration(
        clip.sourceRange.start.ticks,
        clip.sourceRange.duration.ticks,
        clip.timeTransform.playbackRate,
      )

export const linkedAudioSourceRange = (clip: Clip): TimeRange =>
  clip.linkedAudio?.sourceRange ?? clip.sourceRange

export const linkedAudioCompositionStartTicks = (clip: Clip): number =>
  clip.compositionStart.ticks + (clip.linkedAudio?.compositionOffsetTicks ?? 0)

export const linkedAudioCompositionDurationTicks = (clip: Clip): number =>
  isFreezeClip(clip)
    ? 0
    : anchoredCompositionDuration(
        linkedAudioSourceRange(clip).start.ticks,
        linkedAudioSourceRange(clip).duration.ticks,
        clip.timeTransform.playbackRate,
      )

export const linkedAudioCompositionRange = (clip: Clip): TimeRange =>
  Object.freeze({
    start: mediaTime(Math.max(0, linkedAudioCompositionStartTicks(clip))),
    duration: mediaTime(linkedAudioCompositionDurationTicks(clip)),
  })

/** The half-open span this clip occupies in the finished video. */
export const clipCompositionRange = (clip: Clip): TimeRange =>
  Object.freeze({
    start: clip.compositionStart,
    duration: mediaTime(clipCompositionDurationTicks(clip)),
  })

/** Exclusive end of this piece in the finished video. */
export const clipCompositionEndTicks = (clip: Clip): number =>
  clip.compositionStart.ticks + clipCompositionDurationTicks(clip)

/**
 * "Clip time" means time measured from the START OF THIS PIECE, ON THE
 * FINISHED VIDEO'S CLOCK.
 *
 * That choice is stated once here and never varied. It is the clock the user
 * is looking at: they point at a spot on the clip, and what they mean is "this
 * many seconds after this clip appears". The other clock — how far into the
 * recording that is — is reached through `clipTimeToSource`, which is where
 * the speed is applied and where the only rounding happens.
 */
export const clipTimeToComposition = (clip: Clip, clipTime: MediaTime): MediaTime =>
  mediaTime(clip.compositionStart.ticks + clipTime.ticks)

/** Map a time on the finished video's timeline back onto a clip's timeline. */
export const compositionTimeToClip = (clip: Clip, compositionTime: MediaTime): MediaTime =>
  mediaTime(compositionTime.ticks - clip.compositionStart.ticks)

/**
 * Map a point on this piece's on-screen timeline to the point in the recording
 * that is showing there.
 *
 * At normal speed this is a plain addition. At 2x, being 4 seconds into the
 * clip means being 8 seconds into the recording. Running backwards, being 4
 * seconds in means being 4 seconds before the END of the chosen stretch.
 */
export const clipTimeToSource = (clip: Clip, clipTime: MediaTime): MediaTime => {
  if (isFreezeClip(clip)) return clip.sourceRange.start
  const rate = clip.timeTransform.playbackRate
  const sourceOffset = sourceTicksForCompositionOffset(clipTime.ticks, rate)
  if (clip.timeTransform.direction === 'reverse') {
    // The last frame plays first. Being `sourceOffset` into a backwards clip
    // means being that far back from the end of the chosen stretch. Clamped to
    // the first tick so the very end of the clip cannot ask for a frame that
    // sits before the stretch begins.
    const fromEnd = clip.sourceRange.start.ticks + clip.sourceRange.duration.ticks - sourceOffset
    return mediaTime(Math.max(clip.sourceRange.start.ticks, fromEnd))
  }
  return mediaTime(clip.sourceRange.start.ticks + sourceOffset)
}

/** Map a time inside the source asset back onto a clip's own timeline. */
export const sourceTimeToClip = (clip: Clip, sourceTime: MediaTime): MediaTime => {
  if (isFreezeClip(clip)) return ZERO_TIME
  const rate = clip.timeTransform.playbackRate
  if (clip.timeTransform.direction === 'reverse') {
    const fromEnd = clip.sourceRange.start.ticks + clip.sourceRange.duration.ticks - sourceTime.ticks
    return mediaTime(Math.max(0, compositionTicksForSourceOffset(Math.max(0, fromEnd), rate)))
  }
  const sourceOffset = sourceTime.ticks - clip.sourceRange.start.ticks
  return mediaTime(Math.max(0, compositionTicksForSourceOffset(Math.max(0, sourceOffset), rate)))
}

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
      // Where the surviving part sits on screen, once the piece's speed and
      // direction are taken into account. Both edges are converted separately
      // and then subtracted, for the same reason the clip's own length is
      // computed that way: it keeps neighbouring pieces exactly touching.
      const rate = clip.timeTransform.playbackRate
      const clipSourceStart = clip.sourceRange.start.ticks
      const clipSourceEnd = clipSourceStart + clip.sourceRange.duration.ticks
      const overlapStart = overlap.start.ticks
      const overlapEnd = overlapStart + overlap.duration.ticks
      const nearEdge =
        clip.timeTransform.direction === 'reverse'
          // Running backwards, the LAST part of the recording appears FIRST.
          ? clipSourceEnd - overlapEnd
          : overlapStart - clipSourceStart
      const farEdge =
        clip.timeTransform.direction === 'reverse'
          ? clipSourceEnd - overlapStart
          : overlapEnd - clipSourceStart
      const startOffset = compositionTicksForSourceOffset(nearEdge, rate)
      const endOffset = compositionTicksForSourceOffset(farEdge, rate)
      placements.push(Object.freeze({
        clip,
        sourceRange: overlap,
        compositionRange: Object.freeze({
          start: mediaTime(clip.compositionStart.ticks + startOffset),
          duration: mediaTime(Math.max(1, endOffset - startOffset)),
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
      if (time.ticks >= start && time.ticks < start + clipCompositionDurationTicks(clip)) return clip
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
      ticks = Math.max(ticks, clipCompositionEndTicks(clip))
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
  assets: readonly MediaAsset[],
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
    if (
      !(CLIP_KEYS as readonly string[]).includes(key) &&
      !(OPTIONAL_CLIP_KEYS as readonly string[]).includes(key)
    ) {
      issues.push({ path: `${path}.${key}`, code: 'FIELD_UNKNOWN' })
    }
  }
  // Absent means normal speed, forwards, pitch kept — which is exactly what
  // every project saved before speed existed already did. Present but wrong is
  // a refusal, not a silent fallback: a rate somebody hand-edited into a file
  // must not be quietly replaced by a different one.
  let pan = CENTRE_PAN
  if (Object.hasOwn(input, 'pan')) {
    const stored = input.pan
    if (
      typeof stored !== 'number' ||
      !Number.isSafeInteger(stored) ||
      stored < MIN_CLIP_PAN ||
      stored > MAX_CLIP_PAN
    ) {
      issues.push({ path: `${path}.pan`, code: 'VALUE_OUT_OF_RANGE' })
    } else {
      pan = stored
    }
  }
  let timeTransform: ClipTimeTransformV1 = DEFAULT_CLIP_TIME_TRANSFORM
  if (Object.hasOwn(input, 'timeTransform')) {
    const validated = validateClipTimeTransform(input.timeTransform, `${path}.timeTransform`)
    if (!validated.ok) {
      issues.push({ path: validated.error.path, code: 'VALUE_OUT_OF_RANGE' })
    } else {
      timeTransform = validated.value
    }
  }

  let segmentKind: PrimarySegmentKind = 'video'
  if (Object.hasOwn(input, 'segmentKind')) {
    if (input.segmentKind !== 'video' && input.segmentKind !== 'freeze') {
      issues.push({ path: `${path}.segmentKind`, code: 'VALUE_OUT_OF_RANGE' })
    } else {
      segmentKind = input.segmentKind
    }
  }

  let freezeDuration: MediaTime | null = null
  if (Object.hasOwn(input, 'freezeDuration') && input.freezeDuration !== null) {
    const checked = validateMediaTime(input.freezeDuration, `${path}.freezeDuration`)
    if (!checked.ok || checked.value.ticks <= 0) {
      issues.push({ path: `${path}.freezeDuration`, code: 'VALUE_OUT_OF_RANGE' })
    } else {
      freezeDuration = checked.value
    }
  }

  let linkedAudio: LinkedAudioWindowV1 | null = null
  if (Object.hasOwn(input, 'linkedAudio') && input.linkedAudio !== null) {
    if (!isRecord(input.linkedAudio)) {
      issues.push({ path: `${path}.linkedAudio`, code: 'TYPE_INVALID' })
    } else {
      const allowed = ['sourceRange', 'compositionOffsetTicks'] as const
      for (const key of allowed) {
        if (!Object.hasOwn(input.linkedAudio, key)) {
          issues.push({ path: `${path}.linkedAudio.${key}`, code: 'FIELD_REQUIRED' })
        }
      }
      for (const key of Object.keys(input.linkedAudio)) {
        if (!(allowed as readonly string[]).includes(key)) {
          issues.push({ path: `${path}.linkedAudio.${key}`, code: 'FIELD_UNKNOWN' })
        }
      }
      const audioRange = validateTimeRange(input.linkedAudio.sourceRange, `${path}.linkedAudio.sourceRange`)
      if (!audioRange.ok) {
        issues.push({ path: `${path}.linkedAudio.sourceRange`, code: 'VALUE_OUT_OF_RANGE' })
      }
      const offset = input.linkedAudio.compositionOffsetTicks
      if (typeof offset !== 'number' || !Number.isSafeInteger(offset)) {
        issues.push({ path: `${path}.linkedAudio.compositionOffsetTicks`, code: 'VALUE_OUT_OF_RANGE' })
      }
      if (audioRange.ok && typeof offset === 'number' && Number.isSafeInteger(offset)) {
        linkedAudio = Object.freeze({
          sourceRange: audioRange.value,
          compositionOffsetTicks: offset,
        })
      }
    }
  }

  if (segmentKind === 'freeze') {
    if (freezeDuration === null) issues.push({ path: `${path}.freezeDuration`, code: 'FIELD_REQUIRED' })
    if (!isDefaultClipTimeTransform(timeTransform)) {
      issues.push({ path: `${path}.timeTransform`, code: 'VALUE_OUT_OF_RANGE' })
    }
    if (linkedAudio !== null) issues.push({ path: `${path}.linkedAudio`, code: 'VALUE_OUT_OF_RANGE' })
  } else if (freezeDuration !== null) {
    issues.push({ path: `${path}.freezeDuration`, code: 'VALUE_OUT_OF_RANGE' })
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

  const found = typeof input.assetId === 'string' ? findAsset(assets, input.assetId) : undefined
  let asset: VideoAsset | undefined
  if (!found) {
    issues.push({ path: `${path}.assetId`, code: 'ASSET_UNKNOWN' })
  } else if (found.mediaKind !== 'video') {
    issues.push({ path: `${path}.assetId`, code: 'ASSET_NOT_VIDEO' })
  } else {
    asset = found
    if (sourceRange.ok) {
      const assetRange: TimeRange = { start: ZERO_TIME, duration: found.duration }
      if (!rangeWithin(sourceRange.value, assetRange)) {
        issues.push({ path: `${path}.sourceRange`, code: 'SOURCE_RANGE_OUTSIDE_ASSET' })
      }
      if (segmentKind === 'freeze' && sourceRange.value.duration.ticks !== 1) {
        issues.push({ path: `${path}.sourceRange.duration`, code: 'VALUE_OUT_OF_RANGE' })
      }
      if (linkedAudio !== null) {
        if (!found.hasAudio) {
          issues.push({ path: `${path}.linkedAudio`, code: 'VALUE_OUT_OF_RANGE' })
        }
        if (!rangeWithin(linkedAudio.sourceRange, assetRange)) {
          issues.push({ path: `${path}.linkedAudio.sourceRange`, code: 'SOURCE_RANGE_OUTSIDE_ASSET' })
        }
        if (
          compositionStart.ok &&
          compositionStart.value.ticks + linkedAudio.compositionOffsetTicks < 0
        ) {
          issues.push({ path: `${path}.linkedAudio.compositionOffsetTicks`, code: 'VALUE_OUT_OF_RANGE' })
        }
      }
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
  // Two ramps longer than the sound window would overlap and produce a curve
  // nobody asked for, so the pair is refused rather than capped. A freeze has
  // no linked sound at all and therefore accepts only the untouched audio state.
  if (segmentKind === 'freeze') {
    if (gainDb !== 0 || (fadeIn.ok && fadeIn.value.ticks !== 0) || (fadeOut.ok && fadeOut.value.ticks !== 0) || pan !== CENTRE_PAN) {
      issues.push({ path: `${path}.gainDb`, code: 'VALUE_OUT_OF_RANGE' })
    }
  } else if (fadeIn.ok && fadeOut.ok && sourceRange.ok) {
    const audioRange = linkedAudio?.sourceRange ?? sourceRange.value
    const audioOnScreenTicks = anchoredCompositionDuration(
      audioRange.start.ticks,
      audioRange.duration.ticks,
      timeTransform.playbackRate,
    )
    if (fadeIn.value.ticks + fadeOut.value.ticks > audioOnScreenTicks) {
      issues.push({ path: `${path}.fadeIn`, code: 'FADE_LONGER_THAN_CLIP' })
    }
  }
  // A piece that occupies no time in the finished video cannot be seen or
  // clicked. A freeze gets its authored duration; a video derives it from its
  // source range and rational speed.
  if (sourceRange.ok && sourceRange.value.duration.ticks > 0) {
    const onScreenTicks = segmentKind === 'freeze'
      ? freezeDuration?.ticks ?? 0
      : anchoredCompositionDuration(
          sourceRange.value.start.ticks,
          sourceRange.value.duration.ticks,
          timeTransform.playbackRate,
        )
    if (onScreenTicks <= 0) {
      issues.push({
        path: segmentKind === 'freeze' ? `${path}.freezeDuration` : `${path}.timeTransform`,
        code: 'CLIP_TOO_SHORT_TO_SEE',
      })
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
    segmentKind,
    freezeDuration,
    linkedAudio,
    gainDb,
    fadeIn: fadeIn.value,
    fadeOut: fadeOut.value,
    pan,
    timeTransform,
  })
}

export const validateComposition = (
  input: unknown,
  assets: readonly MediaAsset[],
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
          if (current.compositionStart.ticks < clipCompositionEndTicks(previous)) {
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

  const pictureDurationTicks = tracks.reduce(
    (latest, track) => track.clips.reduce(
      (trackLatest, clip) => Math.max(trackLatest, clipCompositionEndTicks(clip)),
      latest,
    ),
    0,
  )
  for (const track of tracks) {
    for (const clip of track.clips) {
      if (clip.linkedAudio === null || clip.linkedAudio === undefined) continue
      const start = linkedAudioCompositionStartTicks(clip)
      const end = start + linkedAudioCompositionDurationTicks(clip)
      if (start < 0 || end > pictureDurationTicks || end <= start) {
        issues.push({ path: `${path}.tracks.${track.trackId}.${clip.clipId}.linkedAudio`, code: 'VALUE_OUT_OF_RANGE' })
      }
    }
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
              segmentKind: 'video',
              freezeDuration: null,
              linkedAudio: null,
              gainDb: 0,
              fadeIn: ZERO_TIME,
              fadeOut: ZERO_TIME,
              pan: CENTRE_PAN,
              timeTransform: DEFAULT_CLIP_TIME_TRANSFORM,
            },
          ],
        },
      ],
    },
    [input.asset],
  )

/**
 * True when this piece has been retimed at all — sped up, slowed down,
 * reversed, or had its pitch protection switched off.
 *
 * Used to decide whether a badge is worth drawing over the clip, and whether
 * the render plan needs to mention speed at all. A plan that says nothing
 * about speed means normal speed, which is what every existing plan means, so
 * untouched projects keep their finished exports.
 */
export const clipIsRetimed = (clip: Clip): boolean => !isDefaultClipTimeTransform(clip.timeTransform)
