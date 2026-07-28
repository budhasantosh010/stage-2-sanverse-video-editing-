import { err, isRecord, ok, type Result } from './result.ts'
import { capabilityProduces } from './capabilities.ts'
import {
  CLIP_ID_PATTERN,
  MAX_CLIP_GAIN_DB,
  MIN_CLIP_GAIN_DB,
  validateComposition,
  type Clip,
  type Composition,
  type Track,
} from './composition.ts'
import { emptyExtensions, validateExtensions, type Extensions } from './json.ts'
import type { MediaAsset } from './assets.ts'
import {
  ZERO_TIME,
  mediaTime,
  validateMediaTime,
  type MediaTime,
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

/** Loudness and ramps for one piece. */
export type SetClipAudioOperation = Common &
  Readonly<{
    kind: 'set-clip-audio'
    clipId: string
    gainDb: number
    fadeIn: MediaTime
    fadeOut: MediaTime
  }>

export type TimelineOperation =
  | SplitClipOperation
  | TrimClipOperation
  | RemoveClipOperation
  | ReorderClipOperation
  | SetClipEnabledOperation
  | SetClipAudioOperation

export const TIMELINE_OPERATION_KINDS: readonly string[] = Object.freeze([
  'split-clip',
  'trim-clip',
  'remove-clip',
  'reorder-clip',
  'set-clip-enabled',
  'set-clip-audio',
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
  for (const key of keys) {
    if (!Object.hasOwn(input, key)) issues.push({ path: `${path}.${key}`, code: 'FIELD_REQUIRED' })
  }
  for (const key of Object.keys(input)) {
    if (!keys.includes(key)) issues.push({ path: `${path}.${key}`, code: 'FIELD_UNKNOWN' })
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
      extra = { gainDb, fadeIn, fadeOut }
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
    const previous = clips[index - 1]
    if (clips[index].compositionStart.ticks !== previous.compositionStart.ticks + previous.sourceRange.duration.ticks) {
      return false
    }
  }
  return true
}

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
  const duration = clip.sourceRange.duration.ticks
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
      const right = clampFades({
        ...clip,
        clipId: operation.newClipId,
        sourceRange: {
          start: mediaTime(clip.sourceRange.start.ticks + at),
          duration: mediaTime(clip.sourceRange.duration.ticks - at),
        },
        compositionStart: mediaTime(clip.compositionStart.ticks + at),
        fadeIn: ZERO_TIME,
      })
      nextClips = track.clips.flatMap((candidate) =>
        candidate.clipId === clip.clipId ? [left, right] : [candidate],
      )
      break
    }

    case 'trim-clip': {
      const removed = operation.trimStart.ticks + operation.trimEnd.ticks
      const remaining = clip.sourceRange.duration.ticks - removed
      if (remaining <= 0) return err(fail('TRIM_LEAVES_NOTHING'))

      const trimmed = clampFades({
        ...clip,
        sourceRange: {
          start: mediaTime(clip.sourceRange.start.ticks + operation.trimStart.ticks),
          duration: mediaTime(remaining),
        },
        compositionStart: operation.ripple
          ? clip.compositionStart
          : mediaTime(clip.compositionStart.ticks + operation.trimStart.ticks),
      })
      const replaced = track.clips.map((candidate) =>
        candidate.clipId === clip.clipId ? trimmed : candidate,
      )
      nextClips = operation.ripple
        ? shiftAfter(replaced, clip.compositionStart.ticks + clip.sourceRange.duration.ticks, -removed)
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
            clip.compositionStart.ticks + clip.sourceRange.duration.ticks,
            -clip.sourceRange.duration.ticks,
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
        cursor += candidate.sourceRange.duration.ticks
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
      if (operation.fadeIn.ticks + operation.fadeOut.ticks > clip.sourceRange.duration.ticks) {
        return err(fail('FADE_LONGER_THAN_CLIP'))
      }
      nextClips = track.clips.map((candidate) =>
        candidate.clipId === clip.clipId
          ? {
              ...candidate,
              gainDb: operation.gainDb,
              fadeIn: operation.fadeIn,
              fadeOut: operation.fadeOut,
            }
          : candidate,
      )
      break
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
