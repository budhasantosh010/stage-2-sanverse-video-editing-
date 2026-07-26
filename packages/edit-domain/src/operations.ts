import { err, isRecord, ok, type Result } from './result.ts'
import { capabilityProduces } from './capabilities.ts'
import {
  clipCompositionRange,
  findClip,
  type Composition,
} from './composition.ts'
import { emptyExtensions, validateExtensions, type Extensions } from './json.ts'
import { validateSpatialTarget, type SpatialTarget } from './geometry.ts'
import {
  rangeContains,
  rangeWithin,
  validateMediaTime,
  validateTimeRange,
  type MediaTime,
  type TimeRange,
} from './time.ts'

/**
 * Text bounds live here, in the domain, not in the renderer.
 *
 * In v1 the only length limit was inside the FFmpeg adapter, so an oversized
 * nameplate was accepted, previewed, and saved, and failed only at export —
 * after the user believed it was done.
 */
export const MAX_PRIMARY_TEXT_LENGTH = 120
export const MAX_SECONDARY_TEXT_LENGTH = 160

export const OPERATION_ID_PATTERN = /^operation_[a-z0-9]{8,64}$/

/**
 * Add a nameplate.
 *
 * Two different times used to be muddled together. They are now separate and
 * named for the timeline they belong to:
 *
 *   sampledClipTime   EVIDENCE. Where the user was pointing, on that clip's
 *                     own timeline. Explains why the system chose this. It is
 *                     never used to decide when the nameplate is visible.
 *
 *   compositionInterval  INSTRUCTION. When the nameplate is actually on screen,
 *                     measured on the finished video's timeline.
 *
 * In v1 nothing linked the two, and the hand-built UI kept them equal only by
 * luck. An AI has no such luck.
 */
export type AddNameplateOperation = Readonly<{
  schemaVersion: 'sanverse.operation/v2'
  operationId: string
  kind: 'add-nameplate'
  capabilityId: string
  clipId: string
  sampledClipTime: MediaTime
  compositionInterval: TimeRange
  target: SpatialTarget
  primaryText: string
  secondaryText: string
  extensions: Extensions
}>

export type EditOperation = AddNameplateOperation

/** Every operation kind this build can execute. Unknown kinds are rejected. */
export const EXECUTABLE_OPERATION_KINDS: readonly string[] = Object.freeze(['add-nameplate'])

export type OperationIssueCode =
  | 'TYPE_INVALID'
  | 'FIELD_REQUIRED'
  | 'FIELD_UNKNOWN'
  | 'VALUE_OUT_OF_RANGE'
  | 'OPERATION_KIND_UNKNOWN'
  | 'CAPABILITY_UNKNOWN'
  | 'CLIP_UNKNOWN'
  | 'SAMPLE_OUTSIDE_CLIP'
  | 'INTERVAL_OUTSIDE_COMPOSITION'
  | 'TEXT_TOO_LONG'

export type OperationError = {
  readonly code: 'OPERATION_INVALID'
  readonly issues: readonly { readonly path: string; readonly code: OperationIssueCode }[]
}

const NAMEPLATE_KEYS = [
  'schemaVersion',
  'operationId',
  'kind',
  'capabilityId',
  'clipId',
  'sampledClipTime',
  'compositionInterval',
  'target',
  'primaryText',
  'secondaryText',
  'extensions',
] as const

type Issue = OperationError['issues'][number]

/**
 * Structural validation only. This cannot tell whether the clip exists or the
 * interval fits the video; that needs the project, and lives in
 * `validateOperationAgainstComposition`.
 */
export const validateOperation = (input: unknown, path = '$'): Result<EditOperation, OperationError> => {
  const issues: Issue[] = []
  if (!isRecord(input)) {
    return err({ code: 'OPERATION_INVALID', issues: [{ path, code: 'TYPE_INVALID' }] })
  }

  // An unrecognised executable kind is refused loudly. It is never skipped,
  // because skipping it exports a video the user never approved.
  if (typeof input.kind !== 'string' || !EXECUTABLE_OPERATION_KINDS.includes(input.kind)) {
    return err({ code: 'OPERATION_INVALID', issues: [{ path: `${path}.kind`, code: 'OPERATION_KIND_UNKNOWN' }] })
  }

  for (const key of NAMEPLATE_KEYS) {
    if (!Object.hasOwn(input, key)) issues.push({ path: `${path}.${key}`, code: 'FIELD_REQUIRED' })
  }
  for (const key of Object.keys(input)) {
    if (!(NAMEPLATE_KEYS as readonly string[]).includes(key)) {
      issues.push({ path: `${path}.${key}`, code: 'FIELD_UNKNOWN' })
    }
  }

  if (input.schemaVersion !== 'sanverse.operation/v2') {
    issues.push({ path: `${path}.schemaVersion`, code: 'VALUE_OUT_OF_RANGE' })
  }
  if (typeof input.operationId !== 'string' || !OPERATION_ID_PATTERN.test(input.operationId)) {
    issues.push({ path: `${path}.operationId`, code: 'VALUE_OUT_OF_RANGE' })
  }
  if (typeof input.capabilityId !== 'string' || !capabilityProduces(input.capabilityId, input.kind)) {
    issues.push({ path: `${path}.capabilityId`, code: 'CAPABILITY_UNKNOWN' })
  }
  if (typeof input.clipId !== 'string' || input.clipId.trim().length === 0) {
    issues.push({ path: `${path}.clipId`, code: 'VALUE_OUT_OF_RANGE' })
  }
  if (typeof input.primaryText !== 'string' || input.primaryText.trim().length === 0) {
    issues.push({ path: `${path}.primaryText`, code: 'VALUE_OUT_OF_RANGE' })
  } else if ([...input.primaryText].length > MAX_PRIMARY_TEXT_LENGTH) {
    issues.push({ path: `${path}.primaryText`, code: 'TEXT_TOO_LONG' })
  }
  if (typeof input.secondaryText !== 'string') {
    issues.push({ path: `${path}.secondaryText`, code: 'TYPE_INVALID' })
  } else if ([...input.secondaryText].length > MAX_SECONDARY_TEXT_LENGTH) {
    issues.push({ path: `${path}.secondaryText`, code: 'TEXT_TOO_LONG' })
  }

  const sampledClipTime = validateMediaTime(input.sampledClipTime, `${path}.sampledClipTime`)
  if (!sampledClipTime.ok) issues.push({ path: `${path}.sampledClipTime`, code: 'VALUE_OUT_OF_RANGE' })
  const compositionInterval = validateTimeRange(input.compositionInterval, `${path}.compositionInterval`)
  if (!compositionInterval.ok) issues.push({ path: `${path}.compositionInterval`, code: 'VALUE_OUT_OF_RANGE' })
  const target = validateSpatialTarget(input.target, `${path}.target`)
  if (!target.ok) {
    for (const issue of target.error.issues) issues.push({ path: issue.path, code: 'VALUE_OUT_OF_RANGE' })
  }
  const extensions = validateExtensions(input.extensions)
  if (!extensions.ok) {
    for (const issue of extensions.error.issues) {
      issues.push({ path: `${path}.extensions.${issue.path}`, code: 'VALUE_OUT_OF_RANGE' })
    }
  }

  if (issues.length > 0) return err({ code: 'OPERATION_INVALID', issues })

  return ok(Object.freeze({
    schemaVersion: 'sanverse.operation/v2',
    operationId: input.operationId as string,
    kind: 'add-nameplate',
    capabilityId: input.capabilityId as string,
    clipId: input.clipId as string,
    sampledClipTime: (sampledClipTime as { ok: true; value: MediaTime }).value,
    compositionInterval: (compositionInterval as { ok: true; value: TimeRange }).value,
    target: (target as { ok: true; value: SpatialTarget }).value,
    primaryText: input.primaryText as string,
    secondaryText: input.secondaryText as string,
    extensions: extensions.ok ? extensions.value : emptyExtensions(),
  }))
}

/**
 * Contextual validation: does this operation make sense against this video?
 *
 * This is the check v1 could not perform, because the domain never knew how
 * long the video was. A nameplate at minute 83 of a 30-second video is now
 * refused here, before it is previewed and before it is saved, instead of at
 * export time after the user has moved on.
 */
export const validateOperationAgainstComposition = (
  operation: EditOperation,
  composition: Composition,
  path = '$',
): Result<EditOperation, OperationError> => {
  const issues: Issue[] = []
  const clip = findClip(composition, operation.clipId)
  if (!clip) {
    return err({ code: 'OPERATION_INVALID', issues: [{ path: `${path}.clipId`, code: 'CLIP_UNKNOWN' }] })
  }

  const clipLocalRange: TimeRange = {
    start: { ticks: 0, timescale: clip.sourceRange.duration.timescale },
    duration: clip.sourceRange.duration,
  }
  if (!rangeContains(clipLocalRange, operation.sampledClipTime)) {
    issues.push({ path: `${path}.sampledClipTime`, code: 'SAMPLE_OUTSIDE_CLIP' })
  }

  // The nameplate must be visible only while its clip is on screen. That is
  // what keeps it attached to the clip when the timeline is cut in G5-B.
  if (!rangeWithin(operation.compositionInterval, clipCompositionRange(clip))) {
    issues.push({ path: `${path}.compositionInterval`, code: 'INTERVAL_OUTSIDE_COMPOSITION' })
  }

  if (issues.length > 0) return err({ code: 'OPERATION_INVALID', issues })
  return ok(operation)
}
