import { err, isRecord, ok, type Result } from '../result.ts'
import type { AddNameplateAction } from '../actions.ts'
import { ASSET_SCHEMA_VERSION, type VideoAsset } from '../assets.ts'
import type { ChangeSet, ChangeSetRecord } from '../change-set.ts'
import { NAMEPLATE_COMPONENT_ID } from '../capabilities.ts'
import { createSingleClipComposition } from '../composition.ts'
import { isProjectV1, validateProjectV1, type EditProjectV1 } from '../legacy-project-v1.ts'
import {
  OPERATION_SCHEMA_VERSION,
  validateOperationAgainstComposition,
  type EditOperation,
} from '../operations.ts'
import {
  PROJECT_SCHEMA_VERSION,
  validateProject,
  type EditProject,
  type ProjectError,
} from '../project.ts'
import { PROJECT_TIMESCALE, ZERO_TIME, mediaTimeFromMilliseconds } from '../time.ts'

/**
 * Bring any saved project up to the version this build understands.
 *
 * There is one entry point rather than one function per hop, so no caller ever
 * has to know which version a file on disk happens to be. Adding a future hop
 * means extending the ladder here, and every caller inherits it.
 *
 * Two guarantees govern every decision in this file:
 *
 *   1. Nothing is silently changed. An old edit that cannot be expressed in the
 *      current shape is carried across and marked blocked, never quietly
 *      adjusted and never dropped.
 *   2. Nothing moves on screen. v1 placed the top-left corner of the nameplate
 *      at the clicked point. The default for NEW nameplates is the centre,
 *      which is what pointing at a spot actually means — but migrating an old
 *      nameplate to 'center' would shift it in an already-approved video, so
 *      migrated nameplates keep 'top-left'.
 *
 * Millisecond values convert exactly, because the project timescale is a whole
 * multiple of 1000. No rounding happens anywhere in this file.
 */
export type MigrationError =
  | { readonly code: 'V1_PROJECT_INVALID' }
  | { readonly code: 'V2_PROJECT_INVALID'; readonly reason: string }
  | { readonly code: 'PROJECT_ID_MISMATCH' }
  | ProjectError

export type BlockedMigration = Readonly<{
  changeSetId: string
  legacyActionId: string
  reason: string
}>

export type MigrationReport = Readonly<{
  /** The schema the file was written in, before this upgrade. */
  fromVersion: string
  /** False when the file was already current and nothing was rewritten. */
  changed: boolean
  migratedChangeSets: number
  blocked: readonly BlockedMigration[]
  migratedRedoEntries: number
}>

export type MigrationResult = Readonly<{
  project: EditProject
  report: MigrationReport
}>

export type MigrationInput = Readonly<{
  /** Whatever was parsed out of the saved file. */
  saved: unknown
  asset: VideoAsset
  projectId: string
  compositionId: string
  trackId: string
  clipId: string
}>

export const LEGACY_PROJECT_V2_VERSION = 'sanverse.project/v2'
export const LEGACY_PROJECT_V3_VERSION = 'sanverse.project/v3'

/**
 * Deterministic ID derived from the v1 action ID, so running the migration
 * twice on the same input produces byte-identical output.
 */
const stableSuffix = (seed: string, salt: string): string => {
  let high = 0x811c9dc5
  let low = 0x01000193
  const input = `${salt}:${seed}`
  for (let index = 0; index < input.length; index += 1) {
    const code = input.charCodeAt(index)
    high = Math.imul(high ^ code, 0x01000193) >>> 0
    low = Math.imul(low ^ (code + index), 0x85ebca6b) >>> 0
  }
  return `${high.toString(36)}${low.toString(36)}`.replace(/[^a-z0-9]/g, '0').padEnd(16, '0').slice(0, 16)
}

const toOperation = (
  action: AddNameplateAction,
  assetId: string,
): Result<EditOperation, MigrationError> => {
  const start = mediaTimeFromMilliseconds(Math.round(action.startMs))
  if (!start.ok) return err({ code: 'V1_PROJECT_INVALID' })
  const duration = mediaTimeFromMilliseconds(Math.round(action.durationMs))
  if (!duration.ok) return err({ code: 'V1_PROJECT_INVALID' })

  // A v1 project always held exactly one untrimmed clip starting at zero, so
  // its finished-video times and its footage times are the same numbers. This
  // conversion is therefore exact rather than approximate.
  return ok(Object.freeze({
    schemaVersion: OPERATION_SCHEMA_VERSION,
    operationId: `operation_${stableSuffix(action.actionId, 'operation')}`,
    kind: 'add-nameplate',
    capabilityId: NAMEPLATE_COMPONENT_ID,
    assetId,
    sourceInterval: Object.freeze({ start: start.value, duration: duration.value }),
    target: Object.freeze({
      coordinateSpace: 'composition-normalized' as const,
      point: Object.freeze({ x: action.target.x, y: action.target.y }),
      anchor: 'top-left' as const,
    }),
    primaryText: action.primaryText,
    secondaryText: action.secondaryText,
    extensions: Object.freeze({
      'sanverse.migration/legacy-action-id': action.actionId,
      'sanverse.migration/legacy-sampled-source-ms': String(Math.round(action.target.sourceTimeMs)),
    }),
  }) as EditOperation)
}

const toChangeSet = (
  action: AddNameplateAction,
  assetId: string,
  baseRevision: number,
): Result<ChangeSet, MigrationError> => {
  const operation = toOperation(action, assetId)
  if (!operation.ok) return operation
  return ok(Object.freeze({
    schemaVersion: 'sanverse.change-set/v1',
    changeSetId: `changeset_${stableSuffix(action.actionId, 'changeset')}`,
    baseRevision,
    operations: Object.freeze([operation.value]),
    provenance: Object.freeze({ source: 'migration' as const, requestId: null }),
    extensions: Object.freeze({
      'sanverse.migration/legacy-action-id': action.actionId,
    }),
  }))
}

const migrateFromV1 = (input: MigrationInput): Result<MigrationResult, MigrationError> => {
  const v1 = validateProjectV1(input.saved)
  if (!v1.ok) return err({ code: 'V1_PROJECT_INVALID' })
  if (v1.value.projectId !== input.projectId) return err({ code: 'PROJECT_ID_MISMATCH' })

  const composition = createSingleClipComposition({
    compositionId: input.compositionId,
    trackId: input.trackId,
    clipId: input.clipId,
    asset: input.asset,
  })
  if (!composition.ok) return composition

  const records: ChangeSetRecord[] = []
  const blocked: BlockedMigration[] = []
  const issuedChangeSetIds: string[] = []
  const seenChangeSetIds = new Set<string>()

  const accepted: readonly AddNameplateAction[] = (v1.value as EditProjectV1).history.accepted
  for (const [index, action] of accepted.entries()) {
    const changeSet = toChangeSet(action, input.asset.assetId, index)
    if (!changeSet.ok) return changeSet
    if (seenChangeSetIds.has(changeSet.value.changeSetId)) {
      // Two v1 actions hashing to one ID would silently merge history.
      return err({ code: 'V1_PROJECT_INVALID' })
    }
    seenChangeSetIds.add(changeSet.value.changeSetId)
    issuedChangeSetIds.push(changeSet.value.changeSetId)

    let blockedReason: string | null = null
    for (const operation of changeSet.value.operations) {
      const checked = validateOperationAgainstComposition(operation, composition.value, [input.asset])
      if (!checked.ok) {
        blockedReason = checked.error.issues[0]?.code ?? 'OPERATION_INVALID'
        break
      }
    }
    if (blockedReason !== null) {
      blocked.push(Object.freeze({
        changeSetId: changeSet.value.changeSetId,
        legacyActionId: action.actionId,
        reason: blockedReason,
      }))
    }
    records.push(Object.freeze({ changeSet: changeSet.value, active: true, blockedReason }))
  }

  const redoStack: ChangeSet[] = []
  for (const action of (v1.value as EditProjectV1).history.redoStack) {
    const changeSet = toChangeSet(action, input.asset.assetId, records.length)
    if (!changeSet.ok) return changeSet
    if (seenChangeSetIds.has(changeSet.value.changeSetId)) return err({ code: 'V1_PROJECT_INVALID' })
    seenChangeSetIds.add(changeSet.value.changeSetId)
    issuedChangeSetIds.push(changeSet.value.changeSetId)
    redoStack.push(changeSet.value)
  }

  const candidate = {
    schemaVersion: PROJECT_SCHEMA_VERSION,
    projectId: input.projectId,
    revision: records.length,
    timescale: PROJECT_TIMESCALE,
    assets: [input.asset],
    composition: composition.value,
    changeSets: records,
    redoStack,
    issuedChangeSetIds,
    extensions: {
      'sanverse.migration/from': 'sanverse.project/v1',
    },
  }

  // The migrated project is validated by the same function that guards every
  // read, so a migration can never write a project the app cannot open.
  const project = validateProject(candidate)
  if (!project.ok) return project

  return ok(Object.freeze({
    project: project.value,
    report: Object.freeze({
      fromVersion: 'sanverse.project/v1',
      changed: true,
      migratedChangeSets: records.length,
      blocked: Object.freeze(blocked),
      migratedRedoEntries: redoStack.length,
    }),
  }))
}

type V2Clip = Record<string, unknown>

const upgradeV2Clip = (clip: unknown): V2Clip | null => {
  if (!isRecord(clip)) return null
  return {
    ...clip,
    // Loudness controls did not exist in v2, so every migrated piece starts
    // exactly as it sounded before: untouched, with no ramps.
    gainDb: 0,
    fadeIn: ZERO_TIME,
    fadeOut: ZERO_TIME,
  }
}

/**
 * Re-anchor a v2 nameplate from finished-video time to footage time.
 *
 * A v2 project has no cuts, so the clip it names sits exactly where it was
 * imported and the arithmetic below is a lossless restatement of the same
 * instant, not an estimate.
 */
const upgradeV2Operation = (
  operation: unknown,
  clipsById: ReadonlyMap<string, { assetId: string; sourceStart: number; compositionStart: number }>,
): Record<string, unknown> | { readonly error: string } => {
  if (!isRecord(operation)) return { error: 'OPERATION_NOT_AN_OBJECT' }
  if (operation.kind !== 'add-nameplate') return { error: 'OPERATION_KIND_UNKNOWN' }
  const clipId = operation.clipId
  if (typeof clipId !== 'string') return { error: 'OPERATION_CLIP_MISSING' }
  const clip = clipsById.get(clipId)
  if (!clip) return { error: 'OPERATION_CLIP_UNKNOWN' }

  const interval = operation.compositionInterval
  if (!isRecord(interval) || !isRecord(interval.start) || !isRecord(interval.duration)) {
    return { error: 'OPERATION_INTERVAL_INVALID' }
  }
  const startTicks = interval.start.ticks
  const durationTicks = interval.duration.ticks
  if (typeof startTicks !== 'number' || typeof durationTicks !== 'number') {
    return { error: 'OPERATION_INTERVAL_INVALID' }
  }

  const sourceStart = clip.sourceStart + (startTicks - clip.compositionStart)
  if (!Number.isSafeInteger(sourceStart) || sourceStart < 0) return { error: 'OPERATION_INTERVAL_INVALID' }

  const {
    clipId: _clipId,
    sampledClipTime,
    compositionInterval: _interval,
    extensions,
    ...rest
  } = operation

  const sampledTicks = isRecord(sampledClipTime) && typeof sampledClipTime.ticks === 'number'
    ? sampledClipTime.ticks
    : null

  return {
    ...rest,
    schemaVersion: OPERATION_SCHEMA_VERSION,
    assetId: clip.assetId,
    sourceInterval: {
      start: { ticks: sourceStart, timescale: PROJECT_TIMESCALE },
      duration: { ticks: durationTicks, timescale: PROJECT_TIMESCALE },
    },
    extensions: {
      ...(isRecord(extensions) ? extensions : {}),
      // The old "where the user was pointing" value was evidence, not an
      // instruction. It is kept so an audit can still explain the placement.
      ...(sampledTicks === null
        ? {}
        : { 'sanverse.migration/legacy-sampled-clip-ticks': String(sampledTicks) }),
    },
  }
}

/**
 * v2 to v3, as a SHAPE rather than a finished project.
 *
 * It hands back a plain object in v3's shape instead of a validated project,
 * because a v2 file must then climb the next rung to v4. Validating here would
 * check it against a schema it has not reached yet and fail for the wrong
 * reason.
 */
const migrateFromV2Shape = (input: MigrationInput): Result<Record<string, unknown>, MigrationError> => {
  const saved = input.saved
  if (!isRecord(saved)) return err({ code: 'V2_PROJECT_INVALID', reason: 'NOT_AN_OBJECT' })
  const composition = saved.composition
  if (!isRecord(composition) || !Array.isArray(composition.tracks)) {
    return err({ code: 'V2_PROJECT_INVALID', reason: 'COMPOSITION_INVALID' })
  }

  const clipsById = new Map<string, { assetId: string; sourceStart: number; compositionStart: number }>()
  const tracks = composition.tracks.map((track) => {
    if (!isRecord(track) || !Array.isArray(track.clips)) return track
    const clips: unknown[] = []
    for (const clip of track.clips) {
      const upgraded = upgradeV2Clip(clip)
      if (upgraded === null) return track
      const clipId = upgraded.clipId
      const assetId = upgraded.assetId
      const sourceRange = upgraded.sourceRange
      const compositionStart = upgraded.compositionStart
      if (
        typeof clipId === 'string' &&
        typeof assetId === 'string' &&
        isRecord(sourceRange) &&
        isRecord(sourceRange.start) &&
        typeof sourceRange.start.ticks === 'number' &&
        isRecord(compositionStart) &&
        typeof compositionStart.ticks === 'number'
      ) {
        clipsById.set(clipId, {
          assetId,
          sourceStart: sourceRange.start.ticks,
          compositionStart: compositionStart.ticks,
        })
      }
      clips.push(upgraded)
    }
    return { ...track, clips }
  })

  const blocked: BlockedMigration[] = []

  const upgradeChangeSet = (record: unknown, isRedoEntry: boolean): unknown => {
    const changeSet = isRedoEntry ? record : isRecord(record) ? record.changeSet : null
    if (!isRecord(changeSet) || !Array.isArray(changeSet.operations)) return record
    const operations: unknown[] = []
    let reason: string | null = null
    for (const operation of changeSet.operations) {
      const upgraded = upgradeV2Operation(operation, clipsById)
      if ('error' in upgraded && typeof upgraded.error === 'string') {
        reason = upgraded.error
        // Keep the original so nothing is lost; the change set is reported
        // blocked instead, exactly as an unexpressible v1 edit would be.
        operations.push(operation)
        continue
      }
      operations.push(upgraded)
    }
    const nextChangeSet = { ...changeSet, operations }
    if (isRedoEntry) return nextChangeSet
    if (reason !== null && isRecord(record)) {
      blocked.push(Object.freeze({
        changeSetId: typeof changeSet.changeSetId === 'string' ? changeSet.changeSetId : '',
        legacyActionId: '',
        reason,
      }))
    }
    return { ...(record as Record<string, unknown>), changeSet: nextChangeSet }
  }

  return ok({
    ...saved,
    schemaVersion: LEGACY_PROJECT_V3_VERSION,
    composition: { ...composition, tracks },
    changeSets: Array.isArray(saved.changeSets)
      ? saved.changeSets.map((record) => upgradeChangeSet(record, false))
      : saved.changeSets,
    redoStack: Array.isArray(saved.redoStack)
      ? saved.redoStack.map((record) => upgradeChangeSet(record, true))
      : saved.redoStack,
    extensions: {
      ...(isRecord(saved.extensions) ? saved.extensions : {}),
      'sanverse.migration/from': LEGACY_PROJECT_V2_VERSION,
      // Recorded so a two-rung climb is still traceable to where it started.
      'sanverse.migration/blocked-on-v2': String(blocked.length),
    },
  })
}

/**
 * v3 to v4: a project used to hold only videos, so an asset did not have to say
 * what kind of media it was. Now it can also hold pictures and music, so every
 * asset states its kind.
 *
 * Nothing about an existing project changes. Every asset a v3 file holds IS a
 * video — that was the only kind that could exist — so stamping `video` on it
 * is a restatement of a fact, not a guess. No timing, no edit, and no pixel
 * moves.
 */
const migrateFromV3 = (input: MigrationInput): Result<MigrationResult, MigrationError> => {
  const saved = input.saved
  if (!isRecord(saved)) return err({ code: 'V2_PROJECT_INVALID', reason: 'NOT_AN_OBJECT' })
  if (!Array.isArray(saved.assets)) return err({ code: 'V2_PROJECT_INVALID', reason: 'ASSETS_INVALID' })

  const assets = saved.assets.map((asset) => {
    if (!isRecord(asset)) return asset
    return {
      ...asset,
      schemaVersion: ASSET_SCHEMA_VERSION,
      mediaKind: 'video' as const,
    }
  })

  const candidate = {
    ...saved,
    schemaVersion: PROJECT_SCHEMA_VERSION,
    assets,
    extensions: {
      ...(isRecord(saved.extensions) ? saved.extensions : {}),
      'sanverse.migration/from': LEGACY_PROJECT_V3_VERSION,
    },
  }

  const project = validateProject(candidate)
  if (!project.ok) return project
  if (project.value.projectId !== input.projectId) return err({ code: 'PROJECT_ID_MISMATCH' })

  return ok(Object.freeze({
    project: project.value,
    report: Object.freeze({
      fromVersion: LEGACY_PROJECT_V3_VERSION,
      changed: true,
      migratedChangeSets: project.value.changeSets.length,
      blocked: Object.freeze([]),
      migratedRedoEntries: project.value.redoStack.length,
    }),
  }))
}

/**
 * The one function callers use. It decides which upgrade the saved file needs,
 * runs it, and validates the result with the same validator that guards every
 * ordinary read. A file already at the current version is returned unchanged
 * and is never rewritten.
 */
export const upgradeSavedProject = (input: MigrationInput): Result<MigrationResult, MigrationError> => {
  if (isProjectV1(input.saved)) return migrateFromV1(input)

  // The ladder runs oldest first, and each rung hands its result to the next,
  // so a v1 file on disk still arrives at the current shape in one call.
  if (isRecord(input.saved) && input.saved.schemaVersion === LEGACY_PROJECT_V2_VERSION) {
    const v3 = migrateFromV2Shape(input)
    if (!v3.ok) return v3
    const v4 = migrateFromV3({ ...input, saved: v3.value })
    if (!v4.ok) return v4
    // The report says where the file actually came from, not where the last
    // rung of the ladder picked it up.
    return ok(Object.freeze({
      project: v4.value.project,
      report: Object.freeze({ ...v4.value.report, fromVersion: LEGACY_PROJECT_V2_VERSION }),
    }))
  }

  if (isRecord(input.saved) && input.saved.schemaVersion === LEGACY_PROJECT_V3_VERSION) {
    return migrateFromV3(input)
  }

  const project = validateProject(input.saved)
  if (!project.ok) return project
  if (project.value.projectId !== input.projectId) return err({ code: 'PROJECT_ID_MISMATCH' })
  return ok(Object.freeze({
    project: project.value,
    report: Object.freeze({
      fromVersion: PROJECT_SCHEMA_VERSION,
      changed: false,
      migratedChangeSets: project.value.changeSets.length,
      blocked: Object.freeze([]),
      migratedRedoEntries: project.value.redoStack.length,
    }),
  }))
}
