import { err, isRecord, ok, type Result } from './result.ts'
import { validateVideoAsset, type AssetError, type VideoAsset } from './assets.ts'
import {
  createSingleClipComposition,
  validateComposition,
  type Composition,
  type CompositionError,
} from './composition.ts'
import {
  validateChangeSet,
  type ChangeSet,
  type ChangeSetError,
  type ChangeSetRecord,
} from './change-set.ts'
import { emptyExtensions, validateExtensions, type Extensions, type ExtensionsError } from './json.ts'
import {
  validateOperationAgainstComposition,
  type EditOperation,
  type OperationError,
} from './operations.ts'
import { PROJECT_TIMESCALE } from './time.ts'

/**
 * The whole editable state of one video.
 *
 * `revision` increases by exactly one every time the visible result changes.
 * It is what makes a stale AI answer impossible to apply: the answer carries
 * the revision it was computed against, and acceptance fails if the project
 * has moved on since.
 */
export type EditProject = Readonly<{
  schemaVersion: 'sanverse.project/v2'
  projectId: string
  revision: number
  timescale: typeof PROJECT_TIMESCALE
  assets: readonly VideoAsset[]
  composition: Composition
  changeSets: readonly ChangeSetRecord[]
  redoStack: readonly ChangeSet[]
  issuedChangeSetIds: readonly string[]
  extensions: Extensions
}>

export type ProjectError =
  | { readonly code: 'PROJECT_INVALID'; readonly issues: readonly { readonly path: string; readonly code: string }[] }
  | { readonly code: 'REVISION_CONFLICT'; readonly expected: number; readonly received: number }
  | { readonly code: 'DUPLICATE_CHANGE_SET_ID'; readonly changeSetId: string }
  | { readonly code: 'CHANGE_SET_UNKNOWN'; readonly changeSetId: string }
  | { readonly code: 'NOTHING_TO_UNDO' }
  | { readonly code: 'NOTHING_TO_REDO' }
  | AssetError
  | CompositionError
  | ChangeSetError
  | ExtensionsError
  | OperationError

export const PROJECT_ID_PATTERN = /^project_[a-z0-9]{16,64}$/
export const MAX_CHANGE_SETS = 512

const PROJECT_KEYS = [
  'schemaVersion',
  'projectId',
  'revision',
  'timescale',
  'assets',
  'composition',
  'changeSets',
  'redoStack',
  'issuedChangeSetIds',
  'extensions',
] as const
const RECORD_KEYS = ['changeSet', 'active', 'blockedReason'] as const

const invalid = (path: string, code: string): ProjectError => ({
  code: 'PROJECT_INVALID',
  issues: [{ path, code }],
})

/** Create the project every newly imported video starts as. */
export const createProject = (input: {
  readonly projectId: string
  readonly asset: VideoAsset
  readonly compositionId: string
  readonly trackId: string
  readonly clipId: string
  readonly extensions?: unknown
}): Result<EditProject, ProjectError> => {
  if (!PROJECT_ID_PATTERN.test(input.projectId)) return err(invalid('projectId', 'VALUE_OUT_OF_RANGE'))
  const asset = validateVideoAsset(input.asset, 'asset')
  if (!asset.ok) return asset
  const composition = createSingleClipComposition({
    compositionId: input.compositionId,
    trackId: input.trackId,
    clipId: input.clipId,
    asset: asset.value,
  })
  if (!composition.ok) return composition
  const extensions = validateExtensions(input.extensions)
  if (!extensions.ok) return extensions

  return ok(Object.freeze({
    schemaVersion: 'sanverse.project/v2',
    projectId: input.projectId,
    revision: 0,
    timescale: PROJECT_TIMESCALE,
    assets: Object.freeze([asset.value]),
    composition: composition.value,
    changeSets: Object.freeze([]),
    redoStack: Object.freeze([]),
    issuedChangeSetIds: Object.freeze([]),
    extensions: extensions.value,
  }))
}

export const validateProject = (input: unknown): Result<EditProject, ProjectError> => {
  if (!isRecord(input)) return err(invalid('$', 'TYPE_INVALID'))
  for (const key of PROJECT_KEYS) {
    if (!Object.hasOwn(input, key)) return err(invalid(key, 'FIELD_REQUIRED'))
  }
  for (const key of Object.keys(input)) {
    if (!(PROJECT_KEYS as readonly string[]).includes(key)) return err(invalid(key, 'FIELD_UNKNOWN'))
  }
  if (input.schemaVersion !== 'sanverse.project/v2') return err(invalid('schemaVersion', 'VALUE_OUT_OF_RANGE'))
  if (typeof input.projectId !== 'string' || !PROJECT_ID_PATTERN.test(input.projectId)) {
    return err(invalid('projectId', 'VALUE_OUT_OF_RANGE'))
  }
  if (!Number.isSafeInteger(input.revision) || (input.revision as number) < 0) {
    return err(invalid('revision', 'VALUE_OUT_OF_RANGE'))
  }
  if (input.timescale !== PROJECT_TIMESCALE) return err(invalid('timescale', 'TIMESCALE_UNSUPPORTED'))

  if (!Array.isArray(input.assets) || input.assets.length === 0) return err(invalid('assets', 'TYPE_INVALID'))
  const assets: VideoAsset[] = []
  const seenAssetIds = new Set<string>()
  for (const [index, rawAsset] of input.assets.entries()) {
    const asset = validateVideoAsset(rawAsset, `assets[${index}]`)
    if (!asset.ok) return asset
    if (seenAssetIds.has(asset.value.assetId)) return err(invalid(`assets[${index}].assetId`, 'DUPLICATE_ID'))
    seenAssetIds.add(asset.value.assetId)
    assets.push(asset.value)
  }

  const composition = validateComposition(input.composition, assets, 'composition')
  if (!composition.ok) return composition

  if (!Array.isArray(input.changeSets)) return err(invalid('changeSets', 'TYPE_INVALID'))
  if (input.changeSets.length > MAX_CHANGE_SETS) return err(invalid('changeSets', 'TOO_MANY_CHANGE_SETS'))
  const changeSets: ChangeSetRecord[] = []
  for (const [index, rawRecord] of input.changeSets.entries()) {
    const path = `changeSets[${index}]`
    if (!isRecord(rawRecord)) return err(invalid(path, 'TYPE_INVALID'))
    for (const key of RECORD_KEYS) {
      if (!Object.hasOwn(rawRecord, key)) return err(invalid(`${path}.${key}`, 'FIELD_REQUIRED'))
    }
    for (const key of Object.keys(rawRecord)) {
      if (!(RECORD_KEYS as readonly string[]).includes(key)) return err(invalid(`${path}.${key}`, 'FIELD_UNKNOWN'))
    }
    if (typeof rawRecord.active !== 'boolean') return err(invalid(`${path}.active`, 'TYPE_INVALID'))
    if (rawRecord.blockedReason !== null && typeof rawRecord.blockedReason !== 'string') {
      return err(invalid(`${path}.blockedReason`, 'TYPE_INVALID'))
    }
    const changeSet = validateChangeSet(rawRecord.changeSet, `${path}.changeSet`)
    if (!changeSet.ok) return changeSet
    changeSets.push(Object.freeze({
      changeSet: changeSet.value,
      active: rawRecord.active,
      blockedReason: (rawRecord.blockedReason ?? null) as string | null,
    }))
  }

  if (!Array.isArray(input.redoStack)) return err(invalid('redoStack', 'TYPE_INVALID'))
  const redoStack: ChangeSet[] = []
  for (const [index, rawChangeSet] of input.redoStack.entries()) {
    const changeSet = validateChangeSet(rawChangeSet, `redoStack[${index}]`)
    if (!changeSet.ok) return changeSet
    redoStack.push(changeSet.value)
  }

  if (!Array.isArray(input.issuedChangeSetIds)) return err(invalid('issuedChangeSetIds', 'TYPE_INVALID'))
  const issued = new Set<string>()
  for (const [index, id] of input.issuedChangeSetIds.entries()) {
    if (typeof id !== 'string' || id.trim().length === 0) {
      return err(invalid(`issuedChangeSetIds[${index}]`, 'TYPE_INVALID'))
    }
    if (issued.has(id)) return err(invalid(`issuedChangeSetIds[${index}]`, 'DUPLICATE_ID'))
    issued.add(id)
  }
  // Every change set the project holds must appear in the issued list, so an
  // ID can never be reused after an undo discards its change set.
  for (const record of changeSets) {
    if (!issued.has(record.changeSet.changeSetId)) {
      return err(invalid('issuedChangeSetIds', 'CHANGE_SET_ID_NOT_ISSUED'))
    }
  }
  for (const changeSet of redoStack) {
    if (!issued.has(changeSet.changeSetId)) {
      return err(invalid('issuedChangeSetIds', 'CHANGE_SET_ID_NOT_ISSUED'))
    }
  }

  const extensions = validateExtensions(input.extensions)
  if (!extensions.ok) return extensions

  return ok(Object.freeze({
    schemaVersion: 'sanverse.project/v2',
    projectId: input.projectId,
    revision: input.revision as number,
    timescale: PROJECT_TIMESCALE,
    assets: Object.freeze(assets),
    composition: composition.value,
    changeSets: Object.freeze(changeSets),
    redoStack: Object.freeze(redoStack),
    issuedChangeSetIds: Object.freeze([...(input.issuedChangeSetIds as string[])]),
    extensions: extensions.value,
  }))
}

const withRevision = (
  project: EditProject,
  changes: Partial<Pick<EditProject, 'changeSets' | 'redoStack' | 'issuedChangeSetIds'>>,
): EditProject =>
  Object.freeze({
    ...project,
    ...changes,
    revision: project.revision + 1,
  })

/**
 * Recheck every active change set against the current composition.
 *
 * A change set that no longer fits is marked blocked and shown to the user.
 * It is never quietly adjusted to make it pass, because an edit the user did
 * not ask for is worse than an edit that visibly needs attention.
 */
const revalidate = (
  composition: Composition,
  records: readonly ChangeSetRecord[],
): readonly ChangeSetRecord[] =>
  Object.freeze(records.map((record) => {
    if (!record.active) {
      return record.blockedReason === null ? record : Object.freeze({ ...record, blockedReason: null })
    }
    for (const operation of record.changeSet.operations) {
      const checked = validateOperationAgainstComposition(operation, composition)
      if (!checked.ok) {
        const reason = checked.error.issues[0]?.code ?? 'OPERATION_INVALID'
        return Object.freeze({ ...record, blockedReason: reason })
      }
    }
    return record.blockedReason === null ? record : Object.freeze({ ...record, blockedReason: null })
  }))

/**
 * Accept one change set as one atomic step.
 *
 * Fails closed when the change set was built against a different revision, so
 * an AI answer computed four seconds ago cannot land on a project the user has
 * changed in the meantime.
 */
export const acceptChangeSet = (
  project: EditProject,
  candidate: unknown,
): Result<EditProject, ProjectError> => {
  const current = validateProject(project)
  if (!current.ok) return current
  const changeSet = validateChangeSet(candidate)
  if (!changeSet.ok) return changeSet

  if (changeSet.value.baseRevision !== current.value.revision) {
    return err({
      code: 'REVISION_CONFLICT',
      expected: current.value.revision,
      received: changeSet.value.baseRevision,
    })
  }
  if (current.value.issuedChangeSetIds.includes(changeSet.value.changeSetId)) {
    return err({ code: 'DUPLICATE_CHANGE_SET_ID', changeSetId: changeSet.value.changeSetId })
  }
  if (current.value.changeSets.length >= MAX_CHANGE_SETS) {
    return err(invalid('changeSets', 'TOO_MANY_CHANGE_SETS'))
  }
  const issuedOperationIds = new Set(
    current.value.changeSets.flatMap((record) => record.changeSet.operations.map((operation) => operation.operationId)),
  )
  for (const operation of changeSet.value.operations) {
    if (issuedOperationIds.has(operation.operationId)) {
      return err(invalid('operations', 'DUPLICATE_OPERATION_ID'))
    }
    const checked = validateOperationAgainstComposition(operation, current.value.composition)
    if (!checked.ok) return checked
  }

  const record: ChangeSetRecord = Object.freeze({
    changeSet: changeSet.value,
    active: true,
    blockedReason: null,
  })
  return ok(withRevision(current.value, {
    changeSets: Object.freeze([...current.value.changeSets, record]),
    // Accepting new work invalidates the redo branch, exactly like every editor.
    redoStack: Object.freeze([]),
    issuedChangeSetIds: Object.freeze([...current.value.issuedChangeSetIds, changeSet.value.changeSetId]),
  }))
}

/** Reverse the most recent accepted change set as one step. */
export const undoChangeSet = (project: EditProject): Result<EditProject, ProjectError> => {
  const current = validateProject(project)
  if (!current.ok) return current
  const last = current.value.changeSets.at(-1)
  if (!last) return err({ code: 'NOTHING_TO_UNDO' })
  const remaining = current.value.changeSets.slice(0, -1)
  return ok(withRevision(current.value, {
    changeSets: revalidate(current.value.composition, remaining),
    redoStack: Object.freeze([...current.value.redoStack, last.changeSet]),
  }))
}

export const redoChangeSet = (project: EditProject): Result<EditProject, ProjectError> => {
  const current = validateProject(project)
  if (!current.ok) return current
  const next = current.value.redoStack.at(-1)
  if (!next) return err({ code: 'NOTHING_TO_REDO' })
  for (const operation of next.operations) {
    const checked = validateOperationAgainstComposition(operation, current.value.composition)
    if (!checked.ok) return checked
  }
  const record: ChangeSetRecord = Object.freeze({ changeSet: next, active: true, blockedReason: null })
  return ok(withRevision(current.value, {
    changeSets: Object.freeze([...current.value.changeSets, record]),
    redoStack: Object.freeze(current.value.redoStack.slice(0, -1)),
  }))
}

/**
 * Switch one change set off — or back on — without touching the ones after it.
 *
 * In v1 the only way to remove the third of five edits was to undo the fifth
 * and fourth first, destroying good work to reach one bad edit.
 */
export const setChangeSetActive = (
  project: EditProject,
  changeSetId: string,
  active: boolean,
): Result<EditProject, ProjectError> => {
  const current = validateProject(project)
  if (!current.ok) return current
  const index = current.value.changeSets.findIndex((record) => record.changeSet.changeSetId === changeSetId)
  if (index === -1) return err({ code: 'CHANGE_SET_UNKNOWN', changeSetId })
  if (current.value.changeSets[index].active === active) return ok(current.value)

  const updated = current.value.changeSets.map((record, position) =>
    position === index ? Object.freeze({ ...record, active }) : record,
  )
  return ok(withRevision(current.value, {
    changeSets: revalidate(current.value.composition, updated),
  }))
}

/**
 * Every operation that actually affects the exported video, in order.
 * Change sets that are switched off or blocked contribute nothing.
 */
export const activeOperations = (project: EditProject): readonly EditOperation[] =>
  Object.freeze(
    project.changeSets
      .filter((record) => record.active && record.blockedReason === null)
      .flatMap((record) => record.changeSet.operations),
  )

export const blockedChangeSets = (project: EditProject): readonly ChangeSetRecord[] =>
  Object.freeze(project.changeSets.filter((record) => record.active && record.blockedReason !== null))

export const canUndo = (project: EditProject): boolean => project.changeSets.length > 0
export const canRedo = (project: EditProject): boolean => project.redoStack.length > 0

export const serializeProject = (project: unknown): Result<string, ProjectError> => {
  const validated = validateProject(project)
  if (!validated.ok) return validated
  return ok(JSON.stringify(validated.value))
}

export const deserializeProject = (serialized: string): Result<EditProject, ProjectError> => {
  let parsed: unknown
  try {
    parsed = JSON.parse(serialized)
  } catch {
    return err(invalid('$', 'JSON_INVALID'))
  }
  return validateProject(parsed)
}

export { emptyExtensions }
export type { Extensions, VideoAsset, Composition, ChangeSet, ChangeSetRecord, EditOperation, Result }

export * from './time.ts'
export * from './geometry.ts'
export { findAsset, validateVideoAsset, ASSET_ID_PATTERN } from './assets.ts'
export {
  clipCompositionRange,
  clipTimeToComposition,
  clipTimeToSource,
  compositionDuration,
  compositionRange,
  compositionTimeToClip,
  createSingleClipComposition,
  findClip,
  validateComposition,
  type Clip,
  type Track,
  type TimeAnchor,
} from './composition.ts'
export {
  EXECUTABLE_OPERATION_KINDS,
  MAX_PRIMARY_TEXT_LENGTH,
  MAX_SECONDARY_TEXT_LENGTH,
  OPERATION_ID_PATTERN,
  validateOperation,
  validateOperationAgainstComposition,
  type AddNameplateOperation,
} from './operations.ts'
export {
  CHANGE_SET_ID_PATTERN,
  MAX_OPERATIONS_PER_CHANGE_SET,
  validateChangeSet,
  type ChangeSetProvenance,
  type ChangeSetSource,
} from './change-set.ts'
export {
  CAPABILITY_REGISTRY,
  NAMEPLATE_COMPONENT_ID,
  NAMEPLATE_PRIMITIVE_ID,
  capabilityProduces,
  expandCapability,
  findCapability,
  type CapabilityDescriptor,
  type CapabilityLevel,
} from './capabilities.ts'
export { EXTENSION_KEY_PATTERN, EXTENSION_LIMITS, validateExtensions, type JsonValue } from './json.ts'
