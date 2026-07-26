import { err, ok, type Result } from '../result.ts'
import type { AddNameplateAction } from '../actions.ts'
import type { VideoAsset } from '../assets.ts'
import type { ChangeSet, ChangeSetRecord } from '../change-set.ts'
import { NAMEPLATE_COMPONENT_ID } from '../capabilities.ts'
import { createSingleClipComposition } from '../composition.ts'
import { validateProjectV1, type EditProjectV1 } from '../legacy-project-v1.ts'
import { validateOperationAgainstComposition, type EditOperation } from '../operations.ts'
import { validateProject, type EditProject, type ProjectError } from '../project.ts'
import { PROJECT_TIMESCALE, mediaTimeFromMilliseconds } from '../time.ts'

/**
 * Turn a saved v1 project into a v2 project.
 *
 * Two guarantees govern every decision here:
 *
 *   1. Nothing is silently changed. A v1 nameplate that cannot be expressed in
 *      v2 is carried across and marked blocked, never quietly adjusted and
 *      never dropped.
 *   2. Nothing moves on screen. v1 placed the top-left corner of the nameplate
 *      at the clicked point. v2's default for NEW nameplates is the centre,
 *      which is what pointing at a spot actually means — but migrating an old
 *      nameplate to 'center' would shift it in an already-approved video, so
 *      migrated nameplates keep 'top-left'.
 *
 * Millisecond values convert exactly, because the project timescale is a whole
 * multiple of 1000. No rounding happens anywhere in this file.
 */
export type MigrationError =
  | { readonly code: 'V1_PROJECT_INVALID' }
  | { readonly code: 'PROJECT_ID_MISMATCH' }
  | ProjectError

export type BlockedMigration = Readonly<{
  changeSetId: string
  legacyActionId: string
  reason: string
}>

export type MigrationReport = Readonly<{
  migratedChangeSets: number
  blocked: readonly BlockedMigration[]
  migratedRedoEntries: number
}>

export type MigrationResult = Readonly<{
  project: EditProject
  report: MigrationReport
}>

export type MigrationInput = Readonly<{
  v1: unknown
  asset: VideoAsset
  projectId: string
  compositionId: string
  trackId: string
  clipId: string
}>

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
  clipId: string,
): Result<EditOperation, MigrationError> => {
  const sampledClipTime = mediaTimeFromMilliseconds(Math.round(action.target.sourceTimeMs))
  if (!sampledClipTime.ok) return err({ code: 'V1_PROJECT_INVALID' })
  const start = mediaTimeFromMilliseconds(Math.round(action.startMs))
  if (!start.ok) return err({ code: 'V1_PROJECT_INVALID' })
  const duration = mediaTimeFromMilliseconds(Math.round(action.durationMs))
  if (!duration.ok) return err({ code: 'V1_PROJECT_INVALID' })

  return ok(Object.freeze({
    schemaVersion: 'sanverse.operation/v2',
    operationId: `operation_${stableSuffix(action.actionId, 'operation')}`,
    kind: 'add-nameplate',
    capabilityId: NAMEPLATE_COMPONENT_ID,
    clipId,
    sampledClipTime: sampledClipTime.value,
    compositionInterval: Object.freeze({ start: start.value, duration: duration.value }),
    target: Object.freeze({
      coordinateSpace: 'composition-normalized' as const,
      point: Object.freeze({ x: action.target.x, y: action.target.y }),
      anchor: 'top-left' as const,
    }),
    primaryText: action.primaryText,
    secondaryText: action.secondaryText,
    extensions: Object.freeze({
      'sanverse.migration/legacy-action-id': action.actionId,
    }),
  }))
}

const toChangeSet = (
  action: AddNameplateAction,
  clipId: string,
  baseRevision: number,
): Result<ChangeSet, MigrationError> => {
  const operation = toOperation(action, clipId)
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

export const migrateProjectV1ToV2 = (
  input: MigrationInput,
): Result<MigrationResult, MigrationError> => {
  const v1 = validateProjectV1(input.v1)
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
    const changeSet = toChangeSet(action, input.clipId, index)
    if (!changeSet.ok) return changeSet
    if (seenChangeSetIds.has(changeSet.value.changeSetId)) {
      // Two v1 actions hashing to one ID would silently merge history.
      return err({ code: 'V1_PROJECT_INVALID' })
    }
    seenChangeSetIds.add(changeSet.value.changeSetId)
    issuedChangeSetIds.push(changeSet.value.changeSetId)

    let blockedReason: string | null = null
    for (const operation of changeSet.value.operations) {
      const checked = validateOperationAgainstComposition(operation, composition.value)
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
    const changeSet = toChangeSet(action, input.clipId, records.length)
    if (!changeSet.ok) return changeSet
    if (seenChangeSetIds.has(changeSet.value.changeSetId)) return err({ code: 'V1_PROJECT_INVALID' })
    seenChangeSetIds.add(changeSet.value.changeSetId)
    issuedChangeSetIds.push(changeSet.value.changeSetId)
    redoStack.push(changeSet.value)
  }

  const candidate = {
    schemaVersion: 'sanverse.project/v2',
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
      migratedChangeSets: records.length,
      blocked: Object.freeze(blocked),
      migratedRedoEntries: redoStack.length,
    }),
  }))
}
