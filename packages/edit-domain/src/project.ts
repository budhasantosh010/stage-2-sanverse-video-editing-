import { err, isRecord, ok, type Result } from './result.ts'
import { validateMediaAsset, validateVideoAsset, type AssetError, type MediaAsset, type VideoAsset } from './assets.ts'
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
  isCaptionOperation,
  isFootageMotionOperation,
  isOverlayFamilyOperation,
  isTimelineOperation,
  isVisualPropertiesOperation,
  validateOperationAgainstComposition,
  type EditOperation,
  type OperationError,
} from './operations.ts'
import {
  foldOverlayOperations,
  type OverlayOperation,
  type ResolvedOverlayOperation,
} from './overlay-operations.ts'
import { foldCaptionOperations, type CaptionSet } from './caption-operations.ts'
import { applyTimelineOperation } from './timeline-operations.ts'
import { PROJECT_TIMESCALE } from './time.ts'
import {
  foldVisualPropertiesOperations,
  type SetVisualPropertiesOperation,
} from './visual-properties.ts'
import {
  foldFootageMotionOperations,
  footageMotionsOverlap,
  isDefaultFootageMotion,
  type SetFootageMotionOperation,
} from './footage-motion.ts'

/**
 * The whole editable state of one video.
 *
 * `revision` increases by exactly one every time the visible result changes.
 * It is what makes a stale AI answer impossible to apply: the answer carries
 * the revision it was computed against, and acceptance fails if the project
 * has moved on since.
 */
export const PROJECT_SCHEMA_VERSION = 'sanverse.project/v4'

export type EditProject = Readonly<{
  schemaVersion: typeof PROJECT_SCHEMA_VERSION
  projectId: string
  revision: number
  timescale: typeof PROJECT_TIMESCALE
  assets: readonly MediaAsset[]
  /**
   * The footage as it arrived, before any cut. This never changes.
   *
   * What the viewer actually sees is `effectiveComposition(project)`, which is
   * this plus every accepted cut replayed in order. Storing the starting point
   * and replaying the edits — rather than storing the current arrangement —
   * is what makes one cut exactly one Undo, lets a single cut in the middle of
   * the history be switched off on its own, and guarantees the saved file and
   * the screen can never drift apart.
   */
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
/**
 * Most pieces of media one project may hold. A talking-head video with B-roll,
 * a few pictures, and music is well under this; the ceiling exists so a runaway
 * upload loop cannot grow a project file without bound.
 */
export const MAX_ASSETS = 64

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
    schemaVersion: PROJECT_SCHEMA_VERSION,
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

/**
 * Bring a second piece of media into the project: more footage, a picture, or
 * a piece of music.
 *
 * Adding media is NOT an edit. Nothing on screen changes, nothing enters the
 * undo history, and no change set is created — the user has put something on
 * the shelf, not used it. Only an operation that names the asset changes the
 * video, and that is a separate, approvable act.
 *
 * The revision still moves forward, because the revision means "the project
 * state" and one rule with no exceptions is safer than a rule with one. The
 * cost is that an AI answer computed a moment before an upload must be
 * recomputed; the benefit is that no reader ever has to remember which changes
 * count.
 */
export const addAsset = (project: EditProject, candidate: unknown): Result<EditProject, ProjectError> => {
  const current = validateProject(project)
  if (!current.ok) return current
  const asset = validateMediaAsset(candidate, 'asset')
  if (!asset.ok) return asset
  if (current.value.assets.some((existing) => existing.assetId === asset.value.assetId)) {
    return err(invalid('assets', 'DUPLICATE_ID'))
  }
  if (current.value.assets.length >= MAX_ASSETS) {
    return err(invalid('assets', 'TOO_MANY_ASSETS'))
  }
  const next = Object.freeze({
    ...current.value,
    assets: Object.freeze([...current.value.assets, asset.value]),
    revision: current.value.revision + 1,
  })
  return ok(Object.freeze({ ...next, changeSets: evaluateProject(next).records }))
}

export const validateProject = (input: unknown): Result<EditProject, ProjectError> => {
  if (!isRecord(input)) return err(invalid('$', 'TYPE_INVALID'))
  for (const key of PROJECT_KEYS) {
    if (!Object.hasOwn(input, key)) return err(invalid(key, 'FIELD_REQUIRED'))
  }
  for (const key of Object.keys(input)) {
    if (!(PROJECT_KEYS as readonly string[]).includes(key)) return err(invalid(key, 'FIELD_UNKNOWN'))
  }
  if (input.schemaVersion !== PROJECT_SCHEMA_VERSION) return err(invalid('schemaVersion', 'VALUE_OUT_OF_RANGE'))
  if (typeof input.projectId !== 'string' || !PROJECT_ID_PATTERN.test(input.projectId)) {
    return err(invalid('projectId', 'VALUE_OUT_OF_RANGE'))
  }
  if (!Number.isSafeInteger(input.revision) || (input.revision as number) < 0) {
    return err(invalid('revision', 'VALUE_OUT_OF_RANGE'))
  }
  if (input.timescale !== PROJECT_TIMESCALE) return err(invalid('timescale', 'TIMESCALE_UNSUPPORTED'))

  if (!Array.isArray(input.assets) || input.assets.length === 0) return err(invalid('assets', 'TYPE_INVALID'))
  const assets: MediaAsset[] = []
  const seenAssetIds = new Set<string>()
  for (const [index, rawAsset] of input.assets.entries()) {
    const asset = validateMediaAsset(rawAsset, `assets[${index}]`)
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
    schemaVersion: PROJECT_SCHEMA_VERSION,
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
): EditProject => {
  const next = Object.freeze({
    ...project,
    ...changes,
    revision: project.revision + 1,
  })
  // Every state that leaves this module carries freshly recomputed blocked
  // reasons, so what is written to disk always matches what a replay produces.
  return Object.freeze({ ...next, changeSets: evaluateProject(next).records })
}

export type ProjectEvaluation = Readonly<{
  /** The footage as it now stands: the imported arrangement plus every cut. */
  composition: Composition
  /** The same change sets, each carrying an up-to-date reason if it no longer fits. */
  records: readonly ChangeSetRecord[]
  /** Latest active, valid full-state primary-footage motion per stable motion identity. */
  footageMotions: readonly SetFootageMotionOperation[]
}>

/**
 * Replay the accepted history over the imported footage, once.
 *
 * This is the only place in the system that decides two things — what the
 * finished video is made of, and which change sets no longer fit. Computing
 * them together in one pass is deliberate: two passes could disagree, and a
 * disagreement here would mean the screen shows one video and the export
 * produces another.
 *
 * A change set is all-or-nothing. If any operation inside it fails, the whole
 * change set is marked blocked and none of its operations touch the footage,
 * because the user approved the request as one thing and half of it is a state
 * they never agreed to.
 *
 * A blocked change set is shown to the user and never quietly adjusted to make
 * it fit, because an edit the user did not ask for is worse than an edit that
 * visibly needs attention.
 */
export const evaluateProject = (project: EditProject): ProjectEvaluation => {
  const cleared = (record: ChangeSetRecord): ChangeSetRecord =>
    record.blockedReason === null ? record : Object.freeze({ ...record, blockedReason: null })

  // Pass one — what the finished video is MADE OF.
  //
  // Cuts are replayed in the order they were approved, each against the result
  // of the ones before it, because that is the order the user made them in.
  let composition = project.composition
  const cutFailures = new Map<number, string>()

  project.changeSets.forEach((record, index) => {
    if (!record.active) return
    let trial = composition
    let reason: string | null = null
    for (const operation of record.changeSet.operations) {
      if (!isTimelineOperation(operation)) continue
      const applied = applyTimelineOperation(trial, operation, project.assets)
      if (!applied.ok) {
        reason = applied.error.reason
        break
      }
      trial = applied.value
    }
    if (reason !== null) {
      cutFailures.set(index, reason)
      return
    }
    composition = trial
  })

  // Pass two — what is DRAWN on it.
  //
  // Overlays are judged against the finished footage, not against the footage
  // as it stood when they were approved. A nameplate approved before a cut, on
  // a face the cut later removed, must be reported as no longer showing. Judging
  // it at its own point in the history would leave it silently invisible.
  //
  // The two passes are deliberately one-way: an overlay can never change what
  // the video is made of. Letting it do so would mean removing a cut could make
  // an overlay valid again, which could re-apply the cut, which could invalidate
  // the overlay — a loop with no settled answer.
  const compositionCheckedRecords = project.changeSets.map((record, index) => {
    if (!record.active) return cleared(record)
    const cutFailure = cutFailures.get(index)
    if (cutFailure !== undefined) return Object.freeze({ ...record, blockedReason: cutFailure })

    for (const operation of record.changeSet.operations) {
      if (isTimelineOperation(operation)) continue
      const checked = validateOperationAgainstComposition(operation, composition, project.assets)
      if (!checked.ok) {
        return Object.freeze({ ...record, blockedReason: checked.error.issues[0]?.code ?? 'OPERATION_INVALID' })
      }
    }
    return cleared(record)
  })

  const availableVisualIds = new Set<string>()
  for (const record of compositionCheckedRecords) {
    if (!record.active || record.blockedReason !== null) continue
    for (const operation of record.changeSet.operations) {
      if (operation.kind === 'add-nameplate') availableVisualIds.add(operation.operationId)
      if (operation.kind === 'add-captions') availableVisualIds.add(operation.captionSetId)
      if (operation.kind === 'add-title') availableVisualIds.add(operation.titleId)
      if (operation.kind === 'add-callout') availableVisualIds.add(operation.calloutId)
      if (operation.kind === 'add-media-overlay') availableVisualIds.add(operation.overlayId)
    }
  }

  const visualCheckedRecords = compositionCheckedRecords.map((record) => {
    if (!record.active || record.blockedReason !== null) return record
    const missingTarget = record.changeSet.operations.find(
      (operation) => isVisualPropertiesOperation(operation) && !availableVisualIds.has(operation.visualId),
    )
    return missingTarget
      ? Object.freeze({ ...record, blockedReason: 'VISUAL_TARGET_UNKNOWN' })
      : record
  })

  // One source moment may have one effective primary-footage motion. Repairs of
  // the same motion ID replace their prior full state before overlap is checked.
  // A refused record contributes nothing to the effective map, so a later edit
  // is never composed against motion the project did not accept.
  const effectiveByMotionId = new Map<string, SetFootageMotionOperation>()
  const records = visualCheckedRecords.map((record) => {
    if (!record.active || record.blockedReason !== null) return record
    const motions = record.changeSet.operations.filter(isFootageMotionOperation)
    if (motions.length === 0) return record

    const trial = new Map(effectiveByMotionId)
    for (const motion of motions) {
      trial.delete(motion.motionId)
      // A default full-state repair truthfully removes the effective motion. It
      // cannot overlap another motion because it draws no motion at all.
      if (isDefaultFootageMotion(motion)) continue
      if ([...trial.values()].some((existing) => footageMotionsOverlap(existing, motion))) {
        return Object.freeze({ ...record, blockedReason: 'FOOTAGE_MOTION_OVERLAP' })
      }
      trial.set(motion.motionId, motion)
    }
    effectiveByMotionId.clear()
    trial.forEach((motion, motionId) => effectiveByMotionId.set(motionId, motion))
    return record
  })

  const footageMotions = foldFootageMotionOperations(
    records
      .filter((record) => record.active && record.blockedReason === null)
      .flatMap((record) => record.changeSet.operations)
      .filter(isFootageMotionOperation),
  )

  return Object.freeze({
    composition,
    records: Object.freeze(records),
    footageMotions,
  })
}

/**
 * What the viewer sees: the imported footage with every accepted cut applied.
 * Preview, export, and every "does this still fit?" question use this, never
 * `project.composition`.
 */
export const effectiveComposition = (project: EditProject): Composition =>
  evaluateProject(project).composition

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
  }

  const record: ChangeSetRecord = Object.freeze({
    changeSet: changeSet.value,
    active: true,
    blockedReason: null,
  })
  const next = withRevision(current.value, {
    changeSets: Object.freeze([...current.value.changeSets, record]),
    // Accepting new work invalidates the redo branch, exactly like every editor.
    redoStack: Object.freeze([]),
    issuedChangeSetIds: Object.freeze([...current.value.issuedChangeSetIds, changeSet.value.changeSetId]),
  })

  // Acceptance is proved by actually replaying the edit, not by predicting that
  // it would work. A change set that cannot be applied is refused outright
  // rather than accepted and then displayed as broken, because "saved, but
  // doing nothing" is the most confusing state a non-editor can be left in.
  const accepted = next.changeSets.at(-1)
  if (accepted?.blockedReason != null) {
    return err({ code: 'OPERATION_INVALID', issues: [{ path: 'operations', code: accepted.blockedReason as never }] })
  }
  return ok(next)
}

/** Reverse the most recent accepted change set as one step. */
export const undoChangeSet = (project: EditProject): Result<EditProject, ProjectError> => {
  const current = validateProject(project)
  if (!current.ok) return current
  const last = current.value.changeSets.at(-1)
  if (!last) return err({ code: 'NOTHING_TO_UNDO' })
  const remaining = current.value.changeSets.slice(0, -1)
  return ok(withRevision(current.value, {
    changeSets: Object.freeze(remaining),
    redoStack: Object.freeze([...current.value.redoStack, last.changeSet]),
  }))
}

export const redoChangeSet = (project: EditProject): Result<EditProject, ProjectError> => {
  const current = validateProject(project)
  if (!current.ok) return current
  const pending = current.value.redoStack.at(-1)
  if (!pending) return err({ code: 'NOTHING_TO_REDO' })
  const record: ChangeSetRecord = Object.freeze({ changeSet: pending, active: true, blockedReason: null })
  const next = withRevision(current.value, {
    changeSets: Object.freeze([...current.value.changeSets, record]),
    redoStack: Object.freeze(current.value.redoStack.slice(0, -1)),
  })
  const restored = next.changeSets.at(-1)
  if (restored?.blockedReason != null) {
    return err({ code: 'OPERATION_INVALID', issues: [{ path: 'operations', code: restored.blockedReason as never }] })
  }
  return ok(next)
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
    changeSets: Object.freeze(updated),
  }))
}

/**
 * Every operation that actually affects the exported video, in order.
 * Change sets that are switched off or blocked contribute nothing.
 *
 * This replays the history rather than trusting the stored blocked flags, so a
 * project file that was hand-edited, restored from a backup, or written by an
 * older build cannot make the export disagree with the screen.
 */
export const activeOperations = (project: EditProject): readonly EditOperation[] =>
  Object.freeze(
    evaluateProject(project)
      .records.filter((record) => record.active && record.blockedReason === null)
      .flatMap((record) => record.changeSet.operations),
  )

export const blockedChangeSets = (project: EditProject): readonly ChangeSetRecord[] =>
  Object.freeze(
    evaluateProject(project).records.filter((record) => record.active && record.blockedReason !== null),
  )

/**
 * The caption sets as they currently stand, after every accepted edit to them.
 *
 * Derived from the same replay as everything else, so a caption the user
 * reworded is the reworded caption everywhere: preview, export, and the panel
 * that lists them cannot disagree.
 */
export const activeCaptionSets = (project: EditProject): readonly CaptionSet[] =>
  foldCaptionOperations(activeOperations(project).filter(isCaptionOperation))

/** Titles, callouts, B-roll, and music as they stand after accepted repairs. */
export const activeOverlayOperations = (project: EditProject): readonly ResolvedOverlayOperation[] =>
  foldOverlayOperations(activeOperations(project).filter(isOverlayFamilyOperation))

/** Latest accepted transform/motion state for each visual in the project. */
export const activeVisualProperties = (project: EditProject): readonly SetVisualPropertiesOperation[] =>
  foldVisualPropertiesOperations(activeOperations(project).filter(isVisualPropertiesOperation))

/** Latest accepted non-overlapping primary-footage motion per stable motion ID. */
export const effectiveFootageMotions = (project: EditProject): readonly SetFootageMotionOperation[] =>
  evaluateProject(project).footageMotions

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
export type { Extensions, MediaAsset, VideoAsset, Composition, ChangeSet, ChangeSetRecord, EditOperation, Result }

export * from './time.ts'
export * from './geometry.ts'
export {
  ASSET_ID_PATTERN,
  ASSET_SCHEMA_VERSION,
  MEDIA_KINDS,
  findAsset,
  findVideoAsset,
  isAudioAsset,
  isImageAsset,
  isVideoAsset,
  isVisualAsset,
  validateMediaAsset,
  validateVideoAsset,
  type AudioAsset,
  type ImageAsset,
  type MediaKind,
} from './assets.ts'
export {
  ANNOTATION_ID_PATTERN,
  ANNOTATION_SCHEMA_VERSION,
  ANNOTATION_SHAPES,
  MAX_ANNOTATIONS_PER_REQUEST,
  MAX_ANNOTATION_NOTE_LENGTH,
  MAX_FREEHAND_POINTS,
  annotationBounds,
  describeAnnotation,
  validateAnnotation,
  validateAnnotations,
  type Annotation,
  type AnnotationShape,
} from './annotations.ts'
export {
  CALLOUT_STYLE_IDS,
  DEFAULT_CALLOUT_STYLE_ID,
  DEFAULT_MUSIC_GAIN_DB,
  DEFAULT_TITLE_STYLE_ID,
  MAX_CALLOUT_LABEL_LENGTH,
  MAX_HEADLINE_LENGTH,
  MAX_MUSIC_GAIN_DB,
  MAX_SUBHEAD_LENGTH,
  MEDIA_OVERLAY_ID_PATTERN,
  MIN_MUSIC_GAIN_DB,
  MUSIC_ID_PATTERN,
  OVERLAY_OPERATION_KINDS,
  TITLE_ID_PATTERN,
  TITLE_PLACEMENTS,
  TITLE_STYLE_IDS,
  foldOverlayOperations,
  isOverlayOperationKind,
  validateOverlayOperation,
  type AddCalloutOperation,
  type AddMediaOverlayOperation,
  type AddMusicOperation,
  type AddTitleOperation,
  type CalloutStyleId,
  type NormalizedRect,
  type OverlayOperation,
  type ResolvedOverlayOperation,
  type SetCalloutOperation,
  type SetMediaOverlayOperation,
  type SetMusicOperation,
  type SetTitleOperation,
  type TitlePlacement,
  type TitleStyleId,
} from './overlay-operations.ts'
export {
  MAX_CLIP_GAIN_DB,
  MIN_CLIP_GAIN_DB,
  clipAtCompositionTime,
  clipCompositionRange,
  clipTimeToComposition,
  clipTimeToSource,
  compositionDuration,
  compositionRange,
  compositionTimeToClip,
  createSingleClipComposition,
  findClip,
  placeSourceSpan,
  sourceTimeToClip,
  validateComposition,
  type Clip,
  type SourceSpanPlacement,
  type Track,
  type TimeAnchor,
} from './composition.ts'
export {
  EXECUTABLE_OPERATION_KINDS,
  MAX_PRIMARY_TEXT_LENGTH,
  MAX_SECONDARY_TEXT_LENGTH,
  OPERATION_ID_PATTERN,
  OPERATION_SCHEMA_VERSION,
  isCaptionOperation,
  isFootageMotionOperation,
  isNameplateOperation,
  isOverlayFamilyOperation,
  isSourceAnchoredOperation,
  isTimelineOperation,
  isVisualPropertiesOperation,
  validateOperation,
  validateOperationAgainstComposition,
  type AddNameplateOperation,
} from './operations.ts'
export {
  DEFAULT_VISUAL_PROPERTIES,
  MAX_KEYFRAMES_PER_TRACK,
  MAX_VISUAL_TRACKS,
  VISUAL_ID_PATTERN,
  VISUAL_PROPERTIES,
  VISUAL_PROPERTIES_OPERATION_KIND,
  applyVisualEasing,
  evaluatePropertyTrack,
  evaluateVisualProperties,
  foldVisualPropertiesOperations,
  validateVisualPropertiesOperation,
  type BounceEasing,
  type CubicBezierEasing,
  type LinearEasing,
  type SetVisualPropertiesOperation,
  type SpringEasing,
  type VisualCrop,
  type EvaluatedVisualProperties,
  type VisualEasing,
  type VisualEffect,
  type VisualKeyframe,
  type VisualMask,
  type VisualProperties,
  type VisualProperty,
  type VisualPropertyTrack,
  type VisualTransform,
  type VisualTransition,
  type VisualTransitionKind,
  type VisualTransitionPhase,
  type VisualMotionState,
  validateVisualMotionState,
} from './visual-properties.ts'
export {
  DEFAULT_FOOTAGE_MOTION_STATE,
  FOOTAGE_MOTION_CAPABILITY_ID,
  FOOTAGE_MOTION_ID_PATTERN,
  FOOTAGE_MOTION_OPERATION_KIND,
  FOOTAGE_MOTION_PROPERTIES,
  evaluateFootageMotionAt,
  foldFootageMotionOperations,
  footageMotionsOverlap,
  isDefaultFootageMotion,
  validateFootageMotionOperation,
  type EvaluatedFootageMotion,
  type FootageMotionError,
  type SetFootageMotionOperation,
} from './footage-motion.ts'
export {
  BOUNCY_TITLE_RECIPE_ID,
  CALLOUT_RECIPE_ID,
  CAPTIONS_RECIPE_ID,
  COMPONENT_RECIPES,
  COMPONENT_SELECTION_SCHEMA_VERSION,
  HIGHLIGHT_MOMENT_WORKFLOW_ID,
  INTRO_WORKFLOW_ID,
  NAMEPLATE_RECIPE_ID,
  OUTCOME_WORKFLOW_REGISTRY,
  POLISH_TALKING_HEAD_WORKFLOW_ID,
  READABLE_VIDEO_WORKFLOW_ID,
  TITLE_RECIPE_ID,
  findComponentRecipe,
  findOutcomeWorkflow,
  migrateComponentSelection,
  planAtomicWorkflow,
  recipeSupportsOperation,
  repairWorkflowAction,
  type AtomicWorkflowPlanError,
  type AtomicWorkflowPlanInput,
  type ComponentRecipe,
  type ComponentSelection,
  type ComponentSelectionMigrationError,
  type OutcomeWorkflow,
  type WorkflowAction,
  type WorkflowRepairResult,
} from './component-recipes.ts'
export {
  CAPTION_CUE_ID_PATTERN,
  CAPTION_OPERATION_KINDS,
  CAPTION_SET_ID_PATTERN,
  CAPTION_STYLE_IDS,
  DEFAULT_CAPTION_STYLE_ID,
  MAX_CAPTION_CUES,
  MAX_CAPTION_LINES,
  MAX_CAPTION_LINE_LENGTH,
  foldCaptionOperations,
  isCaptionOperationKind,
  validateCaptionOperation,
  type AddCaptionsOperation,
  type CaptionCue,
  type CaptionOperation,
  type CaptionSet,
  type CaptionStyleId,
  type RemoveCaptionCueOperation,
  type SetCaptionCueOperation,
  type SetCaptionStyleOperation,
} from './caption-operations.ts'
export {
  MAX_TRANSCRIPT_SEGMENTS,
  MAX_WORDS,
  TRANSCRIPT_ID_PATTERN,
  TRANSCRIPT_SCHEMA_VERSION,
  TRANSCRIPT_SEGMENT_ID_PATTERN,
  transcriptWordCount,
  transcriptWords,
  validateTranscript,
  type Transcript,
  type TranscriptSegment,
  type TranscriptWord,
} from './transcript.ts'
export {
  DEFAULT_SEGMENTATION,
  segmentTranscript,
  wrapIntoLines,
  type CaptionCueDraft,
  type SegmentationOptions,
} from './captions/segment-transcript.ts'
export {
  DEFAULT_REPAIR,
  cuesAreDisjoint,
  repairCueTimings,
  type CueAdjustment,
  type CueRepairOptions,
  type CueRepairResult,
} from './captions/repair-cues.ts'
export {
  MAX_CLIPS_PER_TRACK,
  TIMELINE_OPERATION_KINDS,
  applyTimelineOperation,
  isTimelineOperationKind,
  validateTimelineOperation,
  type RemoveClipOperation,
  type ReorderClipOperation,
  type SetClipAudioOperation,
  type SetClipTransitionOperation,
  type SetClipEnabledOperation,
  type SplitClipOperation,
  type TimelineApplyCode,
  type TimelineOperation,
  type TrimClipOperation,
} from './timeline-operations.ts'
export {
  CHANGE_SET_ID_PATTERN,
  MAX_OPERATIONS_PER_CHANGE_SET,
  validateChangeSet,
  type ChangeSetProvenance,
  type ChangeSetSource,
} from './change-set.ts'
export {
  AUDIO_LEVEL_COMPONENT_ID,
  CAPABILITY_REGISTRY,
  CAPTIONS_COMPONENT_ID,
  CAPTIONS_PRIMITIVE_ID,
  CAPTION_CUE_PRIMITIVE_ID,
  CAPTION_STYLE_PRIMITIVE_ID,
  CLIP_AUDIO_PRIMITIVE_ID,
  CLIP_TRANSITION_COMPONENT_ID,
  CLIP_TRANSITION_PRIMITIVE_ID,
  CLIP_ENABLED_PRIMITIVE_ID,
  FOOTAGE_MOTION_PRIMITIVE_ID,
  CALLOUT_COMPONENT_ID,
  CALLOUT_PRIMITIVE_ID,
  MEDIA_OVERLAY_COMPONENT_ID,
  MEDIA_OVERLAY_PRIMITIVE_ID,
  MUSIC_COMPONENT_ID,
  MUSIC_PRIMITIVE_ID,
  NAMEPLATE_COMPONENT_ID,
  NAMEPLATE_PRIMITIVE_ID,
  TITLE_COMPONENT_ID,
  TITLE_PRIMITIVE_ID,
  REMOVE_PRIMITIVE_ID,
  REMOVE_RANGE_COMPONENT_ID,
  REORDER_PRIMITIVE_ID,
  SPLIT_PRIMITIVE_ID,
  TRIM_PRIMITIVE_ID,
  VISUAL_PROPERTIES_PRIMITIVE_ID,
  capabilityProduces,
  expandCapability,
  findCapability,
  type CapabilityDescriptor,
  type CapabilityLevel,
} from './capabilities.ts'
export { EXTENSION_KEY_PATTERN, EXTENSION_LIMITS, validateExtensions, type JsonValue } from './json.ts'
