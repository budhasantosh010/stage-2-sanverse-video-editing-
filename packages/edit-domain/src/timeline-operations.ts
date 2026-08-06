import { err, isRecord, ok, type Result } from './result.ts'
import { capabilityProduces } from './capabilities.ts'
import {
  CLIP_ID_PATTERN,
  MAX_CLIP_GAIN_DB,
  MAX_CLIP_PAN,
  MIN_CLIP_GAIN_DB,
  MIN_CLIP_PAN,
  TRACK_ID_PATTERN,
  clipCompositionDurationTicks,
  clipCompositionEndTicks,
  validateComposition,
  type Clip,
  type Composition,
  type Track,
} from './composition.ts'
import {
  DEFAULT_CLIP_TIME_TRANSFORM,
  anchoredCompositionDuration,
  validatePlaybackRate,
  type ClipTimeTransformV1,
  type RationalPlaybackRateV1,
} from './clip-time.ts'
import { emptyExtensions, validateExtensions, type Extensions } from './json.ts'
import type { MediaAsset } from './assets.ts'
import {
  ZERO_TIME,
  mediaTime,
  validateMediaTime,
  validateTimeRange,
  type MediaTime,
  type TimeRange,
} from './time.ts'

/**
 * Everything that changes which pieces of footage the finished video is made
 * of, and in what order.
 *
 * These are ordinary operations carried in ordinary change sets, exactly like a
 * nameplate. That is deliberate: it means one cut is one Undo, a cut can be
 * switched off on its own without disturbing later work, and a cut proposed by
 * the AI passes through the same approval gate as anything else. The
 * alternative — editing the stored composition in place — would have needed a
 * second, parallel history mechanism, and two histories eventually disagree.
 */

/**
 * The version stamped on every operation of every kind. One number for the
 * whole family, so a saved file can never contain a nameplate from one schema
 * and a cut from another.
 */
export const OPERATION_SCHEMA_VERSION = 'sanverse.operation/v3'

type Common = Readonly<{
  schemaVersion: typeof OPERATION_SCHEMA_VERSION
  operationId: string
  capabilityId: string
  extensions: Extensions
}>

/**
 * Cut one piece into two at a point measured on that piece's own timeline.
 *
 * The left half keeps the original identifier and the right half takes
 * `newClipId`. The new identifier is carried in the operation rather than
 * invented while applying it, so replaying the same history always produces the
 * same identifiers — which is what lets a saved project reopen unchanged.
 */
export type SplitClipOperation = Common &
  Readonly<{
    kind: 'split-clip'
    clipId: string
    atClipTime: MediaTime
    newClipId: string
  }>

/**
 * Shorten a piece from its head, its tail, or both.
 *
 * `ripple` decides what happens to the time that is freed. True closes the gap
 * by pulling everything after it earlier; false leaves the hole, which shows as
 * black and silence.
 */
export type TrimClipOperation = Common &
  Readonly<{
    kind: 'trim-clip'
    clipId: string
    trimStart: MediaTime
    trimEnd: MediaTime
    ripple: boolean
  }>

/** Take a piece out entirely. `ripple` has the same meaning as on a trim. */
export type RemoveClipOperation = Common &
  Readonly<{
    kind: 'remove-clip'
    clipId: string
    ripple: boolean
  }>

/** Move a piece to a different position in the running order of its track. */
export type ReorderClipOperation = Common &
  Readonly<{
    kind: 'reorder-clip'
    clipId: string
    toIndex: number
  }>

/** Silence and hide a piece without deleting it, or bring it back. */
export type SetClipEnabledOperation = Common &
  Readonly<{
    kind: 'set-clip-enabled'
    clipId: string
    enabled: boolean
  }>

/**
 * Loudness, ramps and left/right placement for one piece.
 *
 * `pan` was added in T2 and is OPTIONAL on the wire. A request that does not
 * mention it leaves the piece centred, which is what every request written
 * before T2 meant, so no saved change set and no stored AI answer had to be
 * rewritten. This is why a second `set-clip-pan` operation was NOT created:
 * two operations that both decide how a clip sounds would eventually be
 * applied in an order nobody chose, and the loser would be silently discarded.
 */
export type SetClipAudioOperation = Common &
  Readonly<{
    kind: 'set-clip-audio'
    clipId: string
    gainDb: number
    fadeIn: MediaTime
    fadeOut: MediaTime
    /** -10000 full left, 0 centred, +10000 full right. See `Clip.pan`. */
    pan: number
  }>

/**
 * How one piece is played through: its speed, its direction, and whether a
 * sped-up voice keeps its normal pitch.
 *
 * `durationPolicy` decides what happens to everything AFTER this piece when
 * the change makes it longer or shorter:
 *
 *   'ripple'          later pieces on the same track slide along to keep the
 *                     sequence gapless. Nothing is overwritten, nothing is
 *                     lost, and the finished video's total length changes.
 *
 *   'preserve-start'  nothing else moves. The piece grows or shrinks in place.
 *                     If growing would run it into the next piece, the whole
 *                     operation is REFUSED — never a silent overwrite.
 *
 * Both are real intentions and neither is a safe default for the other, so the
 * request must say which. The toolbar sends 'ripple' because that is what a
 * creator means by "make this bit faster"; the ripple is shown as displaced
 * ghosts before the mouse is released.
 */
export type SetClipTimeTransformOperation = Common &
  Readonly<{
    kind: 'set-clip-time-transform'
    clipId: string
    playbackRate: RationalPlaybackRateV1
    direction: 'forward' | 'reverse'
    maintainAudioPitch: boolean
    durationPolicy: 'ripple' | 'preserve-start'
  }>

/**
 * THE TRANSITION KINDS THIS PRODUCT WILL ACTUALLY PERFORM.
 *
 * The rule, and it is not negotiable: a kind appears in this list only when it
 * works in the on-screen preview AND in the exported file AND has tests. A
 * chooser full of names that produce nothing is worse than a short chooser,
 * because the user cannot tell which half is real until they wait for an
 * export.
 *
 *   'none'            an ordinary cut: one shot ends, the next begins
 *   'dip-to-black'    both shots fade through black
 *   'dip-to-white'    both shots fade through white
 *
 * Cross Dissolve, Wipe, Slide, Push and Zoom are DELIBERATELY ABSENT, and the
 * reason is one shared reason worth stating plainly:
 *
 *   All five need TWO shots visible at the SAME INSTANT — one melting into,
 *   sliding over, or wiping across the other.
 *
 *   The on-screen preview has exactly one video player, by a rule that is not
 *   up for negotiation, because a second player is a second clock and two
 *   clocks drift. One player can show one frame at a time. It therefore
 *   CANNOT show two shots at once.
 *
 *   The exporter could produce them. The preview could not. The user would
 *   watch a plain cut, wait for an export, and be handed a different video.
 *
 * The preview and the exported file agreeing is worth more than five extra
 * names in a menu, so those five wait until the preview is rebuilt to hold
 * two pictures. What is shipped instead is the two that ONE picture can do
 * honestly: fading through black and fading through white.
 *
 * This is recorded here, in the chooser, and in T2_TRANSITIONS.md rather than
 * shipped as a button that quietly does nothing.
 */
export const TRANSITION_STYLES = Object.freeze([
  'none',
  'dip-to-black',
  'dip-to-white',
] as const)

export type TransitionStyle = (typeof TRANSITION_STYLES)[number]

export const isTransitionStyle = (value: unknown): value is TransitionStyle =>
  typeof value === 'string' && (TRANSITION_STYLES as readonly string[]).includes(value)

/** The longest a transition may run: two seconds on each side. */
export const MAX_TRANSITION_TICKS = 2_880_000

export type SetClipTransitionOperation = Common &
  Readonly<{
    kind: 'set-clip-transition'
    clipId: string
    /** The outgoing clip is `clipId`; this is the immediately following clip. */
    nextClipId: string
    style: TransitionStyle
    /** Length of each side's ramp. The timeline duration itself is unchanged. */
    duration: MediaTime
    audio: 'cut' | 'fade-through-silence'
  }>

/**
 * Put a NEW piece of footage into the main sequence.
 *
 * This is the one operation Multi-asset Primary Sequence needed that did not
 * already exist. Everything else — splitting, trimming, removing, hiding,
 * loudness — was already written against a clip and already worked whatever
 * file that clip came from. The main track could only ever be made SMALLER,
 * because nothing could add to it.
 *
 * The identifier is carried in the operation rather than invented while
 * applying it, so replaying the same history always produces the same file.
 *
 * `assetId` may be a recording the sequence already uses. The same file placed
 * twice is simply two clips with different `sourceRange`s, which is what "show
 * that bit again" means.
 */
export type PlacePrimaryClipOperation = Common &
  Readonly<{
    kind: 'place-primary-clip'
    /** The new piece's name. Must not already be in use. */
    clipId: string
    /** Which track it joins. It must be a video track that already exists. */
    trackId: string
    assetId: string
    /** Which stretch of that recording. */
    sourceRange: TimeRange
    /** Where it goes in the FINISHED video. */
    compositionStart: MediaTime
  }>

/**
 * Move one piece of the main sequence to a chosen moment.
 *
 * Different from `reorder-clip`, which puts a piece at position N in the running
 * order and refuses outright on a track with holes. Dragging a clip does not
 * mean "make this the third one"; it means "put this here". Both exist because
 * both are real intentions, and one pretending to be the other would move
 * things the user did not ask to move.
 */
export type MovePrimaryClipOperation = Common &
  Readonly<{
    kind: 'move-primary-clip'
    clipId: string
    compositionStart: MediaTime
  }>

export type TimelineOperation =
  | SplitClipOperation
  | TrimClipOperation
  | RemoveClipOperation
  | ReorderClipOperation
  | SetClipEnabledOperation
  | SetClipAudioOperation
  | SetClipTransitionOperation
  | SetClipTimeTransformOperation
  | PlacePrimaryClipOperation
  | MovePrimaryClipOperation

export const TIMELINE_OPERATION_KINDS: readonly string[] = Object.freeze([
  'set-clip-time-transform',
  'split-clip',
  'trim-clip',
  'remove-clip',
  'reorder-clip',
  'set-clip-enabled',
  'set-clip-audio',
  'set-clip-transition',
  'place-primary-clip',
  'move-primary-clip',
])

export const isTimelineOperationKind = (kind: unknown): boolean =>
  typeof kind === 'string' && TIMELINE_OPERATION_KINDS.includes(kind)

export type TimelineIssueCode =
  | 'TYPE_INVALID'
  | 'FIELD_REQUIRED'
  | 'FIELD_UNKNOWN'
  | 'VALUE_OUT_OF_RANGE'
  | 'OPERATION_KIND_UNKNOWN'
  | 'CAPABILITY_UNKNOWN'

export type TimelineOperationError = {
  readonly code: 'OPERATION_INVALID'
  readonly issues: readonly { readonly path: string; readonly code: TimelineIssueCode }[]
}

const COMMON_KEYS = ['schemaVersion', 'operationId', 'capabilityId', 'kind', 'extensions'] as const

const KEYS_BY_KIND: Readonly<Record<string, readonly string[]>> = Object.freeze({
  'split-clip': Object.freeze([...COMMON_KEYS, 'clipId', 'atClipTime', 'newClipId']),
  'trim-clip': Object.freeze([...COMMON_KEYS, 'clipId', 'trimStart', 'trimEnd', 'ripple']),
  'remove-clip': Object.freeze([...COMMON_KEYS, 'clipId', 'ripple']),
  'reorder-clip': Object.freeze([...COMMON_KEYS, 'clipId', 'toIndex']),
  'set-clip-enabled': Object.freeze([...COMMON_KEYS, 'clipId', 'enabled']),
  'set-clip-audio': Object.freeze([...COMMON_KEYS, 'clipId', 'gainDb', 'fadeIn', 'fadeOut']),
  'set-clip-time-transform': Object.freeze([
    ...COMMON_KEYS,
    'clipId',
    'playbackRate',
    'direction',
    'maintainAudioPitch',
    'durationPolicy',
  ]),
  'set-clip-transition': Object.freeze([
    ...COMMON_KEYS,
    'clipId',
    'nextClipId',
    'style',
    'duration',
    'audio',
  ]),
  'place-primary-clip': Object.freeze([
    ...COMMON_KEYS, 'clipId', 'trackId', 'assetId', 'sourceRange', 'compositionStart',
  ]),
  'move-primary-clip': Object.freeze([...COMMON_KEYS, 'clipId', 'compositionStart']),
})

/**
 * Keys a request MAY carry. Missing means the documented default.
 *
 * Only `set-clip-audio` has one, and only because pan arrived after the
 * operation was already in use. Everything else stays strictly closed.
 */
const OPTIONAL_KEYS_BY_KIND: Readonly<Record<string, readonly string[]>> = Object.freeze({
  'set-clip-audio': Object.freeze(['pan']),
})

export const OPERATION_ID_PATTERN = /^operation_[a-z0-9]{8,64}$/

/** The most pieces one track may hold, so a runaway proposal cannot exhaust memory. */
export const MAX_CLIPS_PER_TRACK = 512

type Issue = TimelineOperationError['issues'][number]

/**
 * Shape checking only. Whether the clip exists, and whether the cut point falls
 * inside it, depends on the composition and is decided in
 * `applyTimelineOperation`.
 */
export const validateTimelineOperation = (
  input: unknown,
  path = '$',
): Result<TimelineOperation, TimelineOperationError> => {
  const issues: Issue[] = []
  if (!isRecord(input)) {
    return err({ code: 'OPERATION_INVALID', issues: [{ path, code: 'TYPE_INVALID' }] })
  }
  const kind = input.kind
  if (!isTimelineOperationKind(kind)) {
    return err({ code: 'OPERATION_INVALID', issues: [{ path: `${path}.kind`, code: 'OPERATION_KIND_UNKNOWN' }] })
  }
  const keys = KEYS_BY_KIND[kind as string]
  const optionalKeys = OPTIONAL_KEYS_BY_KIND[kind as string] ?? []
  for (const key of keys) {
    if (!Object.hasOwn(input, key)) issues.push({ path: `${path}.${key}`, code: 'FIELD_REQUIRED' })
  }
  for (const key of Object.keys(input)) {
    if (!keys.includes(key) && !optionalKeys.includes(key)) {
      issues.push({ path: `${path}.${key}`, code: 'FIELD_UNKNOWN' })
    }
  }

  if (input.schemaVersion !== OPERATION_SCHEMA_VERSION) {
    issues.push({ path: `${path}.schemaVersion`, code: 'VALUE_OUT_OF_RANGE' })
  }
  if (typeof input.operationId !== 'string' || !OPERATION_ID_PATTERN.test(input.operationId)) {
    issues.push({ path: `${path}.operationId`, code: 'VALUE_OUT_OF_RANGE' })
  }
  if (typeof input.capabilityId !== 'string' || !capabilityProduces(input.capabilityId, kind as string)) {
    issues.push({ path: `${path}.capabilityId`, code: 'CAPABILITY_UNKNOWN' })
  }
  if (typeof input.clipId !== 'string' || !CLIP_ID_PATTERN.test(input.clipId)) {
    issues.push({ path: `${path}.clipId`, code: 'VALUE_OUT_OF_RANGE' })
  }
  const extensions = validateExtensions(input.extensions)
  if (!extensions.ok) issues.push({ path: `${path}.extensions`, code: 'VALUE_OUT_OF_RANGE' })

  const time = (value: unknown, key: string): MediaTime | null => {
    const validated = validateMediaTime(value, `${path}.${key}`)
    if (!validated.ok) {
      issues.push({ path: `${path}.${key}`, code: 'VALUE_OUT_OF_RANGE' })
      return null
    }
    return validated.value
  }

  let extra: Record<string, unknown> = {}
  switch (kind) {
    case 'split-clip': {
      const atClipTime = time(input.atClipTime, 'atClipTime')
      if (atClipTime !== null && atClipTime.ticks <= 0) {
        issues.push({ path: `${path}.atClipTime`, code: 'VALUE_OUT_OF_RANGE' })
      }
      if (typeof input.newClipId !== 'string' || !CLIP_ID_PATTERN.test(input.newClipId)) {
        issues.push({ path: `${path}.newClipId`, code: 'VALUE_OUT_OF_RANGE' })
      } else if (input.newClipId === input.clipId) {
        issues.push({ path: `${path}.newClipId`, code: 'VALUE_OUT_OF_RANGE' })
      }
      extra = { atClipTime, newClipId: input.newClipId }
      break
    }
    case 'trim-clip': {
      const trimStart = time(input.trimStart, 'trimStart')
      const trimEnd = time(input.trimEnd, 'trimEnd')
      if (trimStart !== null && trimEnd !== null && trimStart.ticks + trimEnd.ticks === 0) {
        // A trim that removes nothing would still consume a revision and an
        // Undo step, which reads to the user as a broken button.
        issues.push({ path: `${path}.trimStart`, code: 'VALUE_OUT_OF_RANGE' })
      }
      if (typeof input.ripple !== 'boolean') issues.push({ path: `${path}.ripple`, code: 'TYPE_INVALID' })
      extra = { trimStart, trimEnd, ripple: input.ripple }
      break
    }
    case 'remove-clip': {
      if (typeof input.ripple !== 'boolean') issues.push({ path: `${path}.ripple`, code: 'TYPE_INVALID' })
      extra = { ripple: input.ripple }
      break
    }
    case 'reorder-clip': {
      if (!Number.isSafeInteger(input.toIndex) || (input.toIndex as number) < 0) {
        issues.push({ path: `${path}.toIndex`, code: 'VALUE_OUT_OF_RANGE' })
      }
      extra = { toIndex: input.toIndex }
      break
    }
    case 'set-clip-enabled': {
      if (typeof input.enabled !== 'boolean') issues.push({ path: `${path}.enabled`, code: 'TYPE_INVALID' })
      extra = { enabled: input.enabled }
      break
    }
    case 'set-clip-audio': {
      const gainDb = input.gainDb
      if (
        typeof gainDb !== 'number' ||
        !Number.isFinite(gainDb) ||
        gainDb < MIN_CLIP_GAIN_DB ||
        gainDb > MAX_CLIP_GAIN_DB
      ) {
        issues.push({ path: `${path}.gainDb`, code: 'VALUE_OUT_OF_RANGE' })
      }
      const fadeIn = time(input.fadeIn, 'fadeIn')
      const fadeOut = time(input.fadeOut, 'fadeOut')
      // Absent means centred. Present but out of range, or a decimal, is a
      // refusal — a hand-written -1.5 must not become "nearly full left".
      let pan = 0
      if (Object.hasOwn(input, 'pan')) {
        const requested = input.pan
        if (
          typeof requested !== 'number' ||
          !Number.isSafeInteger(requested) ||
          requested < MIN_CLIP_PAN ||
          requested > MAX_CLIP_PAN
        ) {
          issues.push({ path: `${path}.pan`, code: 'VALUE_OUT_OF_RANGE' })
        } else {
          pan = requested
        }
      }
      extra = { gainDb, fadeIn, fadeOut, pan }
      break
    }
    case 'set-clip-time-transform': {
      const rate = validatePlaybackRate(input.playbackRate, `${path}.playbackRate`)
      if (!rate.ok) issues.push({ path: rate.error.path, code: 'VALUE_OUT_OF_RANGE' })
      if (input.direction !== 'forward' && input.direction !== 'reverse') {
        issues.push({ path: `${path}.direction`, code: 'VALUE_OUT_OF_RANGE' })
      }
      if (typeof input.maintainAudioPitch !== 'boolean') {
        issues.push({ path: `${path}.maintainAudioPitch`, code: 'TYPE_INVALID' })
      }
      if (input.durationPolicy !== 'ripple' && input.durationPolicy !== 'preserve-start') {
        issues.push({ path: `${path}.durationPolicy`, code: 'VALUE_OUT_OF_RANGE' })
      }
      extra = {
        playbackRate: rate.ok ? rate.value : null,
        direction: input.direction,
        maintainAudioPitch: input.maintainAudioPitch,
        durationPolicy: input.durationPolicy,
      }
      break
    }
    case 'place-primary-clip': {
      if (typeof input.trackId !== 'string' || !TRACK_ID_PATTERN.test(input.trackId)) {
        issues.push({ path: `${path}.trackId`, code: 'VALUE_OUT_OF_RANGE' })
      }
      if (typeof input.assetId !== 'string' || input.assetId.trim().length === 0) {
        issues.push({ path: `${path}.assetId`, code: 'VALUE_OUT_OF_RANGE' })
      }
      const sourceRange = validateTimeRange(input.sourceRange, `${path}.sourceRange`)
      if (!sourceRange.ok || sourceRange.value.duration.ticks <= 0) {
        // A piece of no length would be a thing on the timeline nobody can see.
        issues.push({ path: `${path}.sourceRange`, code: 'VALUE_OUT_OF_RANGE' })
      }
      const compositionStart = time(input.compositionStart, 'compositionStart')
      extra = {
        trackId: input.trackId,
        assetId: input.assetId,
        sourceRange: sourceRange.ok ? sourceRange.value : null,
        compositionStart,
      }
      break
    }
    case 'move-primary-clip': {
      const compositionStart = time(input.compositionStart, 'compositionStart')
      extra = { compositionStart }
      break
    }
    case 'set-clip-transition': {
      if (typeof input.nextClipId !== 'string' || !CLIP_ID_PATTERN.test(input.nextClipId)) {
        issues.push({ path: `${path}.nextClipId`, code: 'VALUE_OUT_OF_RANGE' })
      }
      if (!isTransitionStyle(input.style)) {
        issues.push({ path: `${path}.style`, code: 'VALUE_OUT_OF_RANGE' })
      }
      const duration = time(input.duration, 'duration')
      if (
        duration !== null &&
        (
          duration.ticks > MAX_TRANSITION_TICKS ||
          (input.style === 'none' ? duration.ticks !== 0 : duration.ticks <= 0)
        )
      ) {
        issues.push({ path: `${path}.duration`, code: 'VALUE_OUT_OF_RANGE' })
      }
      if (input.audio !== 'cut' && input.audio !== 'fade-through-silence') {
        issues.push({ path: `${path}.audio`, code: 'VALUE_OUT_OF_RANGE' })
      }
      extra = {
        nextClipId: input.nextClipId,
        style: input.style,
        duration,
        audio: input.audio,
      }
      break
    }
    default:
      break
  }

  if (issues.length > 0) return err({ code: 'OPERATION_INVALID', issues })

  return ok(Object.freeze({
    schemaVersion: OPERATION_SCHEMA_VERSION,
    operationId: input.operationId as string,
    capabilityId: input.capabilityId as string,
    kind: kind as TimelineOperation['kind'],
    clipId: input.clipId as string,
    extensions: extensions.ok ? extensions.value : emptyExtensions(),
    ...extra,
  }) as TimelineOperation)
}

export type TimelineApplyCode =
  | 'CLIP_UNKNOWN'
  | 'SPLIT_TIME_OUTSIDE_CLIP'
  | 'TRIM_LEAVES_NOTHING'
  | 'CLIP_ID_IN_USE'
  | 'TRACK_HAS_GAPS'
  | 'INDEX_OUT_OF_RANGE'
  | 'FADE_LONGER_THAN_CLIP'
  | 'TRANSITION_TARGET_INVALID'
  | 'TRANSITION_LONGER_THAN_CLIP'
  | 'COMPOSITION_WOULD_BE_EMPTY'
  | 'TOO_MANY_CLIPS'
  | 'RESULT_INVALID'

export type TimelineApplyError = {
  readonly code: 'TIMELINE_APPLY_FAILED'
  readonly reason: TimelineApplyCode
}

const fail = (reason: TimelineApplyCode): TimelineApplyError => ({
  code: 'TIMELINE_APPLY_FAILED',
  reason,
})

const findTrackOf = (composition: Composition, clipId: string): Track | undefined =>
  composition.tracks.find((track) => track.clips.some((clip) => clip.clipId === clipId))

/** Clips in running order, earliest first. */
const ordered = (track: Track): readonly Clip[] =>
  [...track.clips].sort((a, b) => a.compositionStart.ticks - b.compositionStart.ticks)

/** True when every piece on the track starts exactly where the previous one ended. */
const isGapless = (track: Track): boolean => {
  const clips = ordered(track)
  for (let index = 1; index < clips.length; index += 1) {
    if (clips[index].compositionStart.ticks !== clipCompositionEndTicks(clips[index - 1])) {
      return false
    }
  }
  return true
}

/**
 * How much of the finished video a stretch of THIS piece's recording occupies.
 *
 * Wraps the anchored rule so callers in this file never have to remember to
 * measure from the recording's own beginning. Passing `fromSourceTicks` as the
 * clip's own source start and `spanTicks` as its whole length gives exactly
 * `clipCompositionDurationTicks(clip)`.
 */
const onScreenTicksFor = (clip: Clip, fromSourceTicks: number, spanTicks: number): number =>
  anchoredCompositionDuration(fromSourceTicks, spanTicks, clip.timeTransform.playbackRate)

const shiftAfter = (clips: readonly Clip[], fromTicks: number, deltaTicks: number): readonly Clip[] =>
  clips.map((clip) =>
    clip.compositionStart.ticks >= fromTicks
      ? { ...clip, compositionStart: mediaTime(clip.compositionStart.ticks + deltaTicks) }
      : clip,
  )

/**
 * Ramps are clamped to the piece they sit on when a cut makes that piece
 * shorter. The user asked for a cut, not for a different fade, and refusing the
 * cut because of a ramp they set minutes ago would be baffling. Clamping is the
 * only adjustment anywhere in this file, and it is confined to a value the same
 * edit already made impossible to honour.
 */
const clampFades = (clip: Clip): Clip => {
  // Measured on the finished video's clock, because that is where a ramp is
  // heard. A 2x clip made from four seconds of recording lasts two seconds on
  // screen, so a two-and-a-half-second fade no longer fits and is pulled in.
  const duration = clipCompositionDurationTicks(clip)
  const fadeIn = Math.min(clip.fadeIn.ticks, duration)
  const fadeOut = Math.min(clip.fadeOut.ticks, duration - fadeIn)
  if (fadeIn === clip.fadeIn.ticks && fadeOut === clip.fadeOut.ticks) return clip
  return { ...clip, fadeIn: mediaTime(fadeIn), fadeOut: mediaTime(Math.max(0, fadeOut)) }
}

const replaceTrack = (composition: Composition, trackId: string, clips: readonly Clip[]): unknown => ({
  ...composition,
  tracks: composition.tracks.map((track) => (track.trackId === trackId ? { ...track, clips } : track)),
})

/**
 * Apply one timeline operation to a composition and hand back the result.
 *
 * Nothing is modified in place, and a refusal leaves the caller with the
 * composition it already had. The rebuilt composition is put back through the
 * full composition validator before it is returned, so an operation can never
 * be the one path that produces overlapping or out-of-bounds pieces.
 */
export const applyTimelineOperation = (
  composition: Composition,
  operation: TimelineOperation,
  assets: readonly MediaAsset[],
): Result<Composition, TimelineApplyError> => {
  // Placing a NEW piece is the one operation whose clip does not exist yet, so
  // it is answered before the lookup that every other operation begins with.
  if (operation.kind === 'place-primary-clip') {
    const target = composition.tracks.find((candidate) => candidate.trackId === operation.trackId)
    if (!target || target.kind !== 'video') return err(fail('CLIP_UNKNOWN'))
    const idInUse = composition.tracks.some((candidate) =>
      candidate.clips.some((existing) => existing.clipId === operation.clipId),
    )
    if (idInUse) return err(fail('CLIP_ID_IN_USE'))
    if (target.clips.length + 1 > MAX_CLIPS_PER_TRACK) return err(fail('TOO_MANY_CLIPS'))

    const placed: Clip = {
      clipId: operation.clipId,
      assetId: operation.assetId,
      sourceRange: operation.sourceRange,
      compositionStart: operation.compositionStart,
      enabled: true,
      gainDb: 0,
      fadeIn: ZERO_TIME,
      fadeOut: ZERO_TIME,
      pan: 0,
      timeTransform: DEFAULT_CLIP_TIME_TRANSFORM,
    }
    // Whether the new piece overlaps something, and whether the stretch asked
    // for exists inside that recording, are both decided by the composition
    // validator at the bottom of this function. There is no second copy of
    // those rules here to disagree with it.
    const rebuiltPlacement = validateComposition(
      replaceTrack(composition, target.trackId, [...target.clips, placed]),
      assets,
      'composition',
    )
    if (!rebuiltPlacement.ok) return err(fail('RESULT_INVALID'))
    return ok(rebuiltPlacement.value)
  }

  const track = findTrackOf(composition, operation.clipId)
  if (!track) return err(fail('CLIP_UNKNOWN'))
  const clip = track.clips.find((candidate) => candidate.clipId === operation.clipId)
  if (!clip) return err(fail('CLIP_UNKNOWN'))

  let nextClips: readonly Clip[]

  switch (operation.kind) {
    case 'split-clip': {
      const at = operation.atClipTime.ticks
      if (at <= 0 || at >= clip.sourceRange.duration.ticks) return err(fail('SPLIT_TIME_OUTSIDE_CLIP'))
      const idInUse = composition.tracks.some((candidate) =>
        candidate.clips.some((existing) => existing.clipId === operation.newClipId),
      )
      if (idInUse) return err(fail('CLIP_ID_IN_USE'))
      if (track.clips.length + 1 > MAX_CLIPS_PER_TRACK) return err(fail('TOO_MANY_CLIPS'))

      const left = clampFades({
        ...clip,
        sourceRange: { start: clip.sourceRange.start, duration: mediaTime(at) },
        fadeOut: ZERO_TIME,
      })
      // The right half begins where the left half ENDS ON SCREEN, which at any
      // speed other than normal is not the same number as `at`. Deriving it
      // from the left half's own on-screen length — rather than converting `at`
      // a second time — is what guarantees the two halves exactly touch, with
      // no one-tick gap and no one-tick overlap.
      const right = clampFades({
        ...clip,
        clipId: operation.newClipId,
        sourceRange: {
          start: mediaTime(clip.sourceRange.start.ticks + at),
          duration: mediaTime(clip.sourceRange.duration.ticks - at),
        },
        compositionStart: mediaTime(clipCompositionEndTicks(left)),
        fadeIn: ZERO_TIME,
      })
      // At an extreme speed a half can round to no time at all on screen.
      // Refused by name rather than quietly stretched, because stretching one
      // half would make the two halves longer than the piece they came from
      // and the next clip along would be overlapped.
      if (clipCompositionDurationTicks(left) <= 0 || clipCompositionDurationTicks(right) <= 0) {
        return err(fail('SPLIT_TIME_OUTSIDE_CLIP'))
      }
      nextClips = track.clips.flatMap((candidate) =>
        candidate.clipId === clip.clipId ? [left, right] : [candidate],
      )
      break
    }

    case 'trim-clip': {
      const removed = operation.trimStart.ticks + operation.trimEnd.ticks
      const remaining = clip.sourceRange.duration.ticks - removed
      if (remaining <= 0) return err(fail('TRIM_LEAVES_NOTHING'))

      // `trimStart` shortens the piece from the end the VIEWER SEES FIRST.
      // For an ordinary piece that is the beginning of the recording. For a
      // piece running backwards it is the END of the recording, because the
      // recording is being played from its tail. Doing the mirroring here, in
      // one place, means no caller has to remember it and no two callers can
      // disagree about it.
      const backwards = clip.timeTransform.direction === 'reverse'
      const newSourceStart = backwards
        ? clip.sourceRange.start.ticks + operation.trimEnd.ticks
        : clip.sourceRange.start.ticks + operation.trimStart.ticks

      const oldOnScreen = clipCompositionDurationTicks(clip)
      const newOnScreen = onScreenTicksFor(clip, newSourceStart, remaining)
      // How much of the finished video the removed HEAD used to occupy. That,
      // not the amount of recording removed, is how far the piece slides right
      // when the user is not rippling. The head the viewer saw first sits at
      // the START of the recording normally, and at its END when the piece
      // runs backwards.
      const headSourceStart = backwards
        ? clip.sourceRange.start.ticks + clip.sourceRange.duration.ticks - operation.trimStart.ticks
        : clip.sourceRange.start.ticks
      const headOnScreen = onScreenTicksFor(clip, headSourceStart, operation.trimStart.ticks)

      const trimmed = clampFades({
        ...clip,
        sourceRange: {
          start: mediaTime(newSourceStart),
          duration: mediaTime(remaining),
        },
        compositionStart: operation.ripple
          ? clip.compositionStart
          : mediaTime(clip.compositionStart.ticks + Math.max(0, headOnScreen)),
      })
      const replaced = track.clips.map((candidate) =>
        candidate.clipId === clip.clipId ? trimmed : candidate,
      )
      nextClips = operation.ripple
        ? shiftAfter(
            replaced,
            clipCompositionEndTicks(clip),
            -(oldOnScreen - newOnScreen),
          )
        : replaced
      break
    }

    case 'remove-clip': {
      const survivors = track.clips.filter((candidate) => candidate.clipId !== clip.clipId)
      const anyClipLeft = composition.tracks.some((candidate) =>
        candidate.trackId === track.trackId
          ? survivors.length > 0
          : candidate.clips.length > 0,
      )
      if (!anyClipLeft) return err(fail('COMPOSITION_WOULD_BE_EMPTY'))
      nextClips = operation.ripple
        ? shiftAfter(
            survivors,
            clipCompositionEndTicks(clip),
            -clipCompositionDurationTicks(clip),
          )
        : survivors
      break
    }

    case 'reorder-clip': {
      // Reordering a track that contains holes has no single obvious meaning:
      // the holes could travel with the pieces or stay where they are. Rather
      // than pick one silently, this refuses and the caller explains.
      if (!isGapless(track)) return err(fail('TRACK_HAS_GAPS'))
      const running = ordered(track)
      if (operation.toIndex >= running.length) return err(fail('INDEX_OUT_OF_RANGE'))
      const without = running.filter((candidate) => candidate.clipId !== clip.clipId)
      const rearranged = [...without.slice(0, operation.toIndex), clip, ...without.slice(operation.toIndex)]
      let cursor = running[0].compositionStart.ticks
      nextClips = rearranged.map((candidate) => {
        const placed = { ...candidate, compositionStart: mediaTime(cursor) }
        cursor += clipCompositionDurationTicks(candidate)
        return placed
      })
      break
    }

    case 'set-clip-enabled': {
      const enabledElsewhere = composition.tracks.some((candidate) =>
        candidate.clips.some(
          (existing) => existing.enabled && existing.clipId !== clip.clipId,
        ),
      )
      if (!operation.enabled && !enabledElsewhere) return err(fail('COMPOSITION_WOULD_BE_EMPTY'))
      nextClips = track.clips.map((candidate) =>
        candidate.clipId === clip.clipId ? { ...candidate, enabled: operation.enabled } : candidate,
      )
      break
    }

    case 'set-clip-audio': {
      // Ramps are heard on the finished video's clock, so they are checked
      // against how long the piece lasts on screen.
      if (operation.fadeIn.ticks + operation.fadeOut.ticks > clipCompositionDurationTicks(clip)) {
        return err(fail('FADE_LONGER_THAN_CLIP'))
      }
      nextClips = track.clips.map((candidate) =>
        candidate.clipId === clip.clipId
          ? {
              ...candidate,
              gainDb: operation.gainDb,
              fadeIn: operation.fadeIn,
              fadeOut: operation.fadeOut,
              pan: operation.pan,
            }
          : candidate,
      )
      break
    }

    case 'set-clip-time-transform': {
      const nextTransform: ClipTimeTransformV1 = Object.freeze({
        playbackRate: operation.playbackRate,
        direction: operation.direction,
        maintainAudioPitch: operation.maintainAudioPitch,
      })
      const retimed = clampFades({ ...clip, timeTransform: nextTransform })
      const oldOnScreen = clipCompositionDurationTicks(clip)
      const newOnScreen = clipCompositionDurationTicks(retimed)
      const replaced = track.clips.map((candidate) =>
        candidate.clipId === clip.clipId ? retimed : candidate,
      )
      if (operation.durationPolicy === 'preserve-start') {
        // Nothing else moves. If the piece got longer and now runs into its
        // neighbour, the composition validator at the bottom of this function
        // refuses the whole thing — which is the point. A silent overwrite
        // would destroy footage the user never asked to lose.
        nextClips = replaced
        break
      }
      // Ripple: everything later on this track slides by exactly the change in
      // on-screen length, so the sequence stays gapless and nothing is lost.
      nextClips = shiftAfter(replaced, clipCompositionEndTicks(clip), newOnScreen - oldOnScreen)
      break
    }

    case 'move-primary-clip': {
      // Only this piece moves. Nothing else on the track is touched, because
      // "put this here" is not "make room for this" — the second is Insert, and
      // a user who wanted Insert would have chosen it.
      nextClips = track.clips.map((candidate) =>
        candidate.clipId === clip.clipId
          ? { ...candidate, compositionStart: operation.compositionStart }
          : candidate,
      )
      break
    }

    case 'set-clip-transition': {
      const running = ordered(track)
      const index = running.findIndex((candidate) => candidate.clipId === clip.clipId)
      const next = running[index + 1]
      if (
        !next ||
        next.clipId !== operation.nextClipId ||
        clipCompositionEndTicks(clip) !== next.compositionStart.ticks
      ) {
        return err(fail('TRANSITION_TARGET_INVALID'))
      }
      // A transition's length is time on screen, so it is measured against how
      // long each piece lasts on screen. A two-second dip cannot sit on a
      // one-second clip even if that clip was made from four seconds of
      // recording played at 4x.
      if (
        operation.duration.ticks > clipCompositionDurationTicks(clip) ||
        operation.duration.ticks > clipCompositionDurationTicks(next)
      ) {
        return err(fail('TRANSITION_LONGER_THAN_CLIP'))
      }
      // Transition state lives in the accepted operation and is compiled onto
      // the two segment nodes. The composition remains non-overlapping and its
      // duration therefore cannot drift.
      return ok(composition)
    }

    default: {
      // Exhaustiveness guard: a new kind added without a branch fails loudly
      // rather than silently leaving the composition untouched.
      const unreachable: never = operation
      void unreachable
      return err(fail('RESULT_INVALID'))
    }
  }

  const rebuilt = validateComposition(replaceTrack(composition, track.trackId, nextClips), assets, 'composition')
  if (!rebuilt.ok) return err(fail('RESULT_INVALID'))
  return ok(rebuilt.value)
}
