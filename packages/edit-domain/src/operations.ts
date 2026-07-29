import { err, isRecord, ok, type Result } from './result.ts'
import { capabilityProduces } from './capabilities.ts'
import {
  findClip,
  placeSourceSpan,
  type Composition,
} from './composition.ts'
import { emptyExtensions, validateExtensions, type Extensions } from './json.ts'
import { validateSpatialTarget, type SpatialTarget } from './geometry.ts'
import {
  OPERATION_SCHEMA_VERSION,
  isTimelineOperationKind,
  validateTimelineOperation,
  TIMELINE_OPERATION_KINDS,
  type TimelineOperation,
} from './timeline-operations.ts'
import {
  CAPTION_OPERATION_KINDS,
  isCaptionOperationKind,
  validateCaptionOperation,
  type CaptionOperation,
} from './caption-operations.ts'
import {
  OVERLAY_OPERATION_KINDS,
  isOverlayOperationKind,
  validateOverlayOperation,
  type OverlayOperation,
} from './overlay-operations.ts'
import {
  VISUAL_PROPERTIES_OPERATION_KIND,
  validateVisualPropertiesOperation,
  type SetVisualPropertiesOperation,
} from './visual-properties.ts'
import { findAsset, type MediaAsset } from './assets.ts'
import {
  validateTimeRange,
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

export { OPERATION_SCHEMA_VERSION }
export const OPERATION_ID_PATTERN = /^operation_[a-z0-9]{8,64}$/

/**
 * Add a nameplate.
 *
 * WHEN it appears is measured on the original footage's own timeline, not on
 * the finished video's. That one choice is what makes cutting safe.
 *
 * Consider a nameplate the user placed on a face eight seconds into the raw
 * recording, and then imagine trimming four seconds off the front:
 *
 *   stored against the finished video   the nameplate stays at 00:08 of the
 *                                       finished cut, which is now 00:12 of the
 *                                       recording — a different moment, and
 *                                       nothing warns anyone
 *
 *   stored against the footage (this)   the nameplate stays on the face; the
 *                                       system recomputes that it is now 00:04
 *                                       of the finished cut
 *
 * If the footage it was anchored to is deleted outright, the nameplate is
 * reported as blocked. It is never quietly moved somewhere it might fit.
 */
export type AddNameplateOperation = Readonly<{
  schemaVersion: typeof OPERATION_SCHEMA_VERSION
  operationId: string
  kind: 'add-nameplate'
  capabilityId: string
  /** Which piece of original footage this is anchored to. */
  assetId: string
  /** When it is on screen, measured on that footage's own timeline. */
  sourceInterval: TimeRange
  target: SpatialTarget
  primaryText: string
  secondaryText: string
  extensions: Extensions
}>

export type EditOperation =
  | AddNameplateOperation
  | TimelineOperation
  | CaptionOperation
  | OverlayOperation
  | SetVisualPropertiesOperation

/** Every operation kind this build can execute. Unknown kinds are rejected. */
export const EXECUTABLE_OPERATION_KINDS: readonly string[] = Object.freeze([
  'add-nameplate',
  ...TIMELINE_OPERATION_KINDS,
  ...CAPTION_OPERATION_KINDS,
  ...OVERLAY_OPERATION_KINDS,
  VISUAL_PROPERTIES_OPERATION_KIND,
])

/** True for the operations that change which footage the finished video is made of. */
export const isTimelineOperation = (operation: EditOperation): operation is TimelineOperation =>
  isTimelineOperationKind(operation.kind)

/** True for a nameplate specifically. */
export const isNameplateOperation = (operation: EditOperation): operation is AddNameplateOperation =>
  operation.kind === 'add-nameplate'

/** True for titles, callouts, B-roll, and music. */
export const isOverlayFamilyOperation = (operation: EditOperation): operation is OverlayOperation =>
  isOverlayOperationKind(operation.kind)

export const isVisualPropertiesOperation = (
  operation: EditOperation,
): operation is SetVisualPropertiesOperation => operation.kind === VISUAL_PROPERTIES_OPERATION_KIND

/**
 * True when this operation is pinned to a moment of original footage.
 *
 * Everything drawn on the picture is. Music is the one exception, because it
 * belongs to the finished video rather than to a filmed moment — see the note
 * at the top of `overlay-operations.ts`.
 */
export const isSourceAnchoredOperation = (
  operation: EditOperation,
): operation is AddNameplateOperation | Exclude<OverlayOperation, { kind: 'add-music' }> =>
  operation.kind === 'add-nameplate' ||
  operation.kind === 'add-title' ||
  operation.kind === 'add-callout' ||
  operation.kind === 'add-media-overlay'

/** True for the operations that describe captions. */
export const isCaptionOperation = (operation: EditOperation): operation is CaptionOperation =>
  isCaptionOperationKind(operation.kind)

export type OperationIssueCode =
  | 'TYPE_INVALID'
  | 'FIELD_REQUIRED'
  | 'FIELD_UNKNOWN'
  | 'VALUE_OUT_OF_RANGE'
  | 'OPERATION_KIND_UNKNOWN'
  | 'CAPABILITY_UNKNOWN'
  | 'CLIP_UNKNOWN'
  | 'ASSET_NOT_IN_COMPOSITION'
  | 'SOURCE_SPAN_REMOVED'
  | 'TEXT_TOO_LONG'
  | 'TOO_MANY_CUES'
  | 'DUPLICATE_CUE_ID'
  | 'CUES_OVERLAP'
  | 'CUES_EMPTY'
  | 'ALL_CUES_REMOVED'
  | 'TEXT_TOO_LONG_OVERLAY'
  | 'REGION_OFF_PICTURE'
  | 'OVERLAY_ASSET_SAME_AS_FOOTAGE'
  | 'GAIN_OUT_OF_RANGE'
  /** The B-roll clip, picture, or piece of music is not in this project. */
  | 'OVERLAY_ASSET_UNKNOWN'
  /** Music was pointed at a video, or B-roll at a piece of music. */
  | 'OVERLAY_ASSET_WRONG_KIND'
  /** The stretch of B-roll asked for runs past the end of the B-roll clip. */
  | 'OVERLAY_SPAN_OUTSIDE_ASSET'
  | 'VISUAL_TARGET_UNKNOWN'

export type OperationError = {
  readonly code: 'OPERATION_INVALID'
  readonly issues: readonly { readonly path: string; readonly code: OperationIssueCode }[]
}

const NAMEPLATE_KEYS = [
  'schemaVersion',
  'operationId',
  'kind',
  'capabilityId',
  'assetId',
  'sourceInterval',
  'target',
  'primaryText',
  'secondaryText',
  'extensions',
] as const

type Issue = OperationError['issues'][number]

const validateNameplate = (
  input: Record<string, unknown>,
  path: string,
): Result<AddNameplateOperation, OperationError> => {
  const issues: Issue[] = []
  for (const key of NAMEPLATE_KEYS) {
    if (!Object.hasOwn(input, key)) issues.push({ path: `${path}.${key}`, code: 'FIELD_REQUIRED' })
  }
  for (const key of Object.keys(input)) {
    if (!(NAMEPLATE_KEYS as readonly string[]).includes(key)) {
      issues.push({ path: `${path}.${key}`, code: 'FIELD_UNKNOWN' })
    }
  }

  if (input.schemaVersion !== OPERATION_SCHEMA_VERSION) {
    issues.push({ path: `${path}.schemaVersion`, code: 'VALUE_OUT_OF_RANGE' })
  }
  if (typeof input.operationId !== 'string' || !OPERATION_ID_PATTERN.test(input.operationId)) {
    issues.push({ path: `${path}.operationId`, code: 'VALUE_OUT_OF_RANGE' })
  }
  if (typeof input.capabilityId !== 'string' || !capabilityProduces(input.capabilityId, 'add-nameplate')) {
    issues.push({ path: `${path}.capabilityId`, code: 'CAPABILITY_UNKNOWN' })
  }
  if (typeof input.assetId !== 'string' || input.assetId.trim().length === 0) {
    issues.push({ path: `${path}.assetId`, code: 'VALUE_OUT_OF_RANGE' })
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

  const sourceInterval = validateTimeRange(input.sourceInterval, `${path}.sourceInterval`)
  if (!sourceInterval.ok) issues.push({ path: `${path}.sourceInterval`, code: 'VALUE_OUT_OF_RANGE' })
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
    schemaVersion: OPERATION_SCHEMA_VERSION,
    operationId: input.operationId as string,
    kind: 'add-nameplate',
    capabilityId: input.capabilityId as string,
    assetId: input.assetId as string,
    sourceInterval: (sourceInterval as { ok: true; value: TimeRange }).value,
    target: (target as { ok: true; value: SpatialTarget }).value,
    primaryText: input.primaryText as string,
    secondaryText: input.secondaryText as string,
    extensions: extensions.ok ? extensions.value : emptyExtensions(),
  }))
}

/**
 * Structural validation only. This cannot tell whether the footage still
 * exists or the cut point still falls inside a piece; that needs the project,
 * and lives in `validateOperationAgainstComposition`.
 */
export const validateOperation = (input: unknown, path = '$'): Result<EditOperation, OperationError> => {
  if (!isRecord(input)) {
    return err({ code: 'OPERATION_INVALID', issues: [{ path, code: 'TYPE_INVALID' }] })
  }

  // An unrecognised executable kind is refused loudly. It is never skipped,
  // because skipping it exports a video the user never approved.
  if (typeof input.kind !== 'string' || !EXECUTABLE_OPERATION_KINDS.includes(input.kind)) {
    return err({ code: 'OPERATION_INVALID', issues: [{ path: `${path}.kind`, code: 'OPERATION_KIND_UNKNOWN' }] })
  }

  if (isCaptionOperationKind(input.kind)) {
    const captions = validateCaptionOperation(input, path)
    if (!captions.ok) {
      return err({
        code: 'OPERATION_INVALID',
        issues: captions.error.issues.map((issue) => ({
          path: issue.path,
          code: issue.code as OperationIssueCode,
        })),
      })
    }
    return ok(captions.value)
  }

  if (isOverlayOperationKind(input.kind)) {
    const overlay = validateOverlayOperation(input, path)
    if (!overlay.ok) {
      return err({
        code: 'OPERATION_INVALID',
        issues: overlay.error.issues.map((issue) => ({
          path: issue.path,
          code: (issue.code === 'TEXT_TOO_LONG' ? 'TEXT_TOO_LONG' : issue.code) as OperationIssueCode,
        })),
      })
    }
    return ok(overlay.value)
  }

  if (input.kind === VISUAL_PROPERTIES_OPERATION_KIND) {
    const visual = validateVisualPropertiesOperation(input, path)
    if (!visual.ok) {
      return err({
        code: 'OPERATION_INVALID',
        issues: visual.error.issues.map((issue) => ({
          path: issue.path,
          code: issue.code as OperationIssueCode,
        })),
      })
    }
    return ok(visual.value)
  }

  if (isTimelineOperationKind(input.kind)) {
    const timeline = validateTimelineOperation(input, path)
    if (!timeline.ok) {
      return err({
        code: 'OPERATION_INVALID',
        issues: timeline.error.issues.map((issue) => ({
          path: issue.path,
          code: issue.code as OperationIssueCode,
        })),
      })
    }
    return ok(timeline.value)
  }

  return validateNameplate(input, path)
}

/**
 * Contextual validation: does this operation still make sense against the
 * footage the finished video is currently made of?
 *
 * For a nameplate this asks whether the moment it was pinned to survived the
 * cutting. For a timeline operation it asks whether the piece it names is still
 * there — the deeper question of whether the cut point itself is still inside
 * that piece is answered by actually applying it, in `applyTimelineOperation`,
 * because that is the only place the answer is knowable without duplicating the
 * arithmetic in two files that could then disagree.
 */
export const validateOperationAgainstComposition = (
  operation: EditOperation,
  composition: Composition,
  assets: readonly MediaAsset[] = [],
  path = '$',
): Result<EditOperation, OperationError> => {
  const fail = (field: string, code: OperationIssueCode): Result<EditOperation, OperationError> =>
    err({ code: 'OPERATION_INVALID', issues: [{ path: `${path}.${field}`, code }] })

  // Whether the named visual exists is history-dependent and is checked in the
  // project replay, where earlier accepted operations are available.
  if (isVisualPropertiesOperation(operation)) return ok(operation)

  if (operation.kind === 'add-music' || operation.kind === 'set-music') {
    // Music is judged only on whether the music itself is still here. It is not
    // pinned to any moment of footage, so no amount of cutting can invalidate
    // it — the bed simply plays over whatever finished video now exists.
    const asset = findAsset(assets, operation.assetId)
    if (!asset) return fail('assetId', 'OVERLAY_ASSET_UNKNOWN')
    if (asset.mediaKind !== 'audio') return fail('assetId', 'OVERLAY_ASSET_WRONG_KIND')
    return ok(operation)
  }

  if (operation.kind === 'add-media-overlay' || operation.kind === 'set-media-overlay') {
    const overlayAsset = findAsset(assets, operation.overlayAssetId)
    if (!overlayAsset) return fail('overlayAssetId', 'OVERLAY_ASSET_UNKNOWN')
    if (overlayAsset.mediaKind === 'audio') return fail('overlayAssetId', 'OVERLAY_ASSET_WRONG_KIND')
    // A still picture can be held for any length. A B-roll VIDEO cannot: asking
    // for eight seconds of a five-second clip is refused rather than padded with
    // a frozen frame nobody approved.
    if (overlayAsset.mediaKind === 'video') {
      const neededTicks = operation.overlaySourceStart.ticks + operation.sourceInterval.duration.ticks
      if (neededTicks > overlayAsset.duration.ticks) {
        return fail('overlaySourceStart', 'OVERLAY_SPAN_OUTSIDE_ASSET')
      }
    }
    // Falls through to the shared source-anchored check below, because WHERE it
    // appears is a moment of the main footage like any other overlay.
  }

  if (isTimelineOperation(operation)) {
    if (!findClip(composition, operation.clipId)) {
      return err({ code: 'OPERATION_INVALID', issues: [{ path: `${path}.clipId`, code: 'CLIP_UNKNOWN' }] })
    }
    return ok(operation)
  }

  if (isCaptionOperation(operation)) {
    // Captions are judged as a SET, not cue by cue, and this differs from a
    // nameplate on purpose.
    //
    // A nameplate is one statement about one moment: if its moment is deleted,
    // the whole statement is meaningless and must be reported. A caption set is
    // hundreds of statements about hundreds of moments, and cutting ten seconds
    // out of the middle legitimately deletes some of them. Blocking all 150
    // captions because 3 lost their footage would leave the user with a silent,
    // caption-free video and a warning they cannot act on.
    //
    // So: cues whose footage is gone simply do not draw, and the set is blocked
    // only when NOTHING survives — which is the only case where "your captions
    // are not showing" is the honest thing to say.
    if (operation.kind !== 'add-captions') return ok(operation)

    const usesAsset = composition.tracks.some((track) =>
      track.clips.some((clip) => clip.assetId === operation.assetId),
    )
    if (!usesAsset) {
      return err({
        code: 'OPERATION_INVALID',
        issues: [{ path: `${path}.assetId`, code: 'ASSET_NOT_IN_COMPOSITION' }],
      })
    }
    const anySurvives = operation.cues.some(
      (cue) => placeSourceSpan(composition, operation.assetId, cue.sourceInterval).length > 0,
    )
    if (!anySurvives) {
      return err({
        code: 'OPERATION_INVALID',
        issues: [{ path: `${path}.cues`, code: 'ALL_CUES_REMOVED' }],
      })
    }
    return ok(operation)
  }

  const usesAsset = composition.tracks.some((track) =>
    track.clips.some((clip) => clip.assetId === operation.assetId),
  )
  if (!usesAsset) {
    return err({ code: 'OPERATION_INVALID', issues: [{ path: `${path}.assetId`, code: 'ASSET_NOT_IN_COMPOSITION' }] })
  }
  if (placeSourceSpan(composition, operation.assetId, operation.sourceInterval).length === 0) {
    return err({
      code: 'OPERATION_INVALID',
      issues: [{ path: `${path}.sourceInterval`, code: 'SOURCE_SPAN_REMOVED' }],
    })
  }
  return ok(operation)
}
