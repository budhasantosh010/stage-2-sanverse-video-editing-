import { err, isRecord, ok, type Result } from './result.ts'
import { capabilityProduces } from './capabilities.ts'
import { emptyExtensions, validateExtensions, type Extensions } from './json.ts'
import { OPERATION_SCHEMA_VERSION } from './timeline-operations.ts'

/**
 * Which of the five tracks reach the finished video.
 *
 * THIS IS NOT THE SAME THING AS LOCKING A TRACK, and the difference is the
 * whole reason this file exists.
 *
 *   TRACK OUTPUT (here)          TRACK LOCK (presentation sidecar)
 *   ─────────────────────        ────────────────────────────────
 *   "do not put the music in     "do not let me move anything on
 *    the video"                   this track by accident"
 *   changes what is exported     changes nothing about the video
 *   is an edit: one Undo,        is a workspace setting: no Undo
 *   one revision, one export     entry, no revision, and the same
 *   key                          export key as before
 *
 * A user who mutes the music and exports must get a silent-of-music file. A
 * user who padlocks a track and exports must get a byte-identical file to the
 * one they would have got without the padlock. Putting both in one place would
 * have made one of those two statements false.
 *
 * The five track identifiers are closed. An operation naming anything else is
 * refused rather than ignored, because ignoring it would export a video the
 * user did not approve while telling them the edit was accepted.
 */
export const TRACK_OUTPUT_OPERATION_KIND = 'set-track-output'

/**
 * The five tracks, in the order they are stacked on screen, top first.
 *
 *   V2  what is laid on top   — B-roll, pictures, titles, callouts
 *   V1  the picture itself    — the footage this project is made of
 *   C1  the captions
 *   A1  the sound that came with the picture
 *   A2  music and anything else added underneath
 */
export const TIMELINE_TRACK_IDS = Object.freeze(['V2', 'V1', 'C1', 'A1', 'A2'] as const)

export type TimelineTrackId = (typeof TIMELINE_TRACK_IDS)[number]

export const isTimelineTrackId = (value: unknown): value is TimelineTrackId =>
  typeof value === 'string' && (TIMELINE_TRACK_IDS as readonly string[]).includes(value)

export type SetTrackOutputOperation = Readonly<{
  schemaVersion: typeof OPERATION_SCHEMA_VERSION
  operationId: string
  kind: typeof TRACK_OUTPUT_OPERATION_KIND
  capabilityId: string
  trackId: TimelineTrackId
  /** True is the default for every track of every project that has ever existed. */
  outputEnabled: boolean
  extensions: Extensions
}>

/**
 * What every track does when nothing has been said about it.
 *
 * Every track is on. A project saved before this operation existed has no
 * `set-track-output` in its history, so it reads back with all five on — which
 * is exactly how it already behaved. No migration is needed and no saved file
 * is rewritten.
 */
export const DEFAULT_TRACK_OUTPUTS: Readonly<Record<TimelineTrackId, boolean>> = Object.freeze({
  V2: true,
  V1: true,
  C1: true,
  A1: true,
  A2: true,
})

export type TrackOutputState = Readonly<Record<TimelineTrackId, boolean>>

const KEYS = Object.freeze([
  'schemaVersion',
  'operationId',
  'kind',
  'capabilityId',
  'trackId',
  'outputEnabled',
  'extensions',
])

export type TrackOutputIssueCode =
  | 'TYPE_INVALID'
  | 'FIELD_REQUIRED'
  | 'FIELD_UNKNOWN'
  | 'VALUE_OUT_OF_RANGE'
  | 'OPERATION_KIND_UNKNOWN'
  | 'CAPABILITY_UNKNOWN'

export type TrackOutputOperationError = {
  readonly code: 'OPERATION_INVALID'
  readonly issues: readonly { readonly path: string; readonly code: TrackOutputIssueCode }[]
}

const OPERATION_ID_PATTERN = /^operation_[a-z0-9]{8,64}$/

export const validateTrackOutputOperation = (
  input: unknown,
  path = '$',
): Result<SetTrackOutputOperation, TrackOutputOperationError> => {
  if (!isRecord(input)) {
    return err({ code: 'OPERATION_INVALID', issues: [{ path, code: 'TYPE_INVALID' }] })
  }
  if (input.kind !== TRACK_OUTPUT_OPERATION_KIND) {
    return err({ code: 'OPERATION_INVALID', issues: [{ path: `${path}.kind`, code: 'OPERATION_KIND_UNKNOWN' }] })
  }

  const issues: { path: string; code: TrackOutputIssueCode }[] = []
  for (const key of KEYS) {
    if (!Object.hasOwn(input, key)) issues.push({ path: `${path}.${key}`, code: 'FIELD_REQUIRED' })
  }
  for (const key of Object.keys(input)) {
    if (!KEYS.includes(key)) issues.push({ path: `${path}.${key}`, code: 'FIELD_UNKNOWN' })
  }
  if (input.schemaVersion !== OPERATION_SCHEMA_VERSION) {
    issues.push({ path: `${path}.schemaVersion`, code: 'VALUE_OUT_OF_RANGE' })
  }
  if (typeof input.operationId !== 'string' || !OPERATION_ID_PATTERN.test(input.operationId)) {
    issues.push({ path: `${path}.operationId`, code: 'VALUE_OUT_OF_RANGE' })
  }
  if (
    typeof input.capabilityId !== 'string' ||
    !capabilityProduces(input.capabilityId, TRACK_OUTPUT_OPERATION_KIND)
  ) {
    issues.push({ path: `${path}.capabilityId`, code: 'CAPABILITY_UNKNOWN' })
  }
  if (!isTimelineTrackId(input.trackId)) {
    issues.push({ path: `${path}.trackId`, code: 'VALUE_OUT_OF_RANGE' })
  }
  if (typeof input.outputEnabled !== 'boolean') {
    issues.push({ path: `${path}.outputEnabled`, code: 'TYPE_INVALID' })
  }
  const extensions = validateExtensions(input.extensions)
  if (!extensions.ok) issues.push({ path: `${path}.extensions`, code: 'VALUE_OUT_OF_RANGE' })

  if (issues.length > 0) return err({ code: 'OPERATION_INVALID', issues })

  return ok(Object.freeze({
    schemaVersion: OPERATION_SCHEMA_VERSION,
    operationId: input.operationId as string,
    kind: TRACK_OUTPUT_OPERATION_KIND,
    capabilityId: input.capabilityId as string,
    trackId: input.trackId as TimelineTrackId,
    outputEnabled: input.outputEnabled as boolean,
    extensions: extensions.ok ? extensions.value : emptyExtensions(),
  }))
}

/**
 * The state of all five tracks after replaying every accepted switch.
 *
 * Last one wins, because each operation carries the complete answer for one
 * track rather than a nudge. Two people toggling the same track can therefore
 * never leave it in a state neither of them chose.
 */
export const foldTrackOutputOperations = (
  operations: readonly SetTrackOutputOperation[],
): TrackOutputState => {
  const state: Record<TimelineTrackId, boolean> = { ...DEFAULT_TRACK_OUTPUTS }
  for (const operation of operations) state[operation.trackId] = operation.outputEnabled
  return Object.freeze(state)
}
