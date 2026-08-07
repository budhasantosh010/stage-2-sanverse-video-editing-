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
  isTimelineGroupsOperation,
  isTimelineMarkersOperation,
  isTimelineOperation,
  isTrackOutputOperation,
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
import {
  foldTrackOutputOperations,
  type TrackOutputState,
} from './track-output.ts'
import {
  foldTimelineMarkerOperations,
  type TimelineMarkerV1,
} from './timeline-markers.ts'
import {
  foldTimelineGroupOperations,
  type TimelineGroupV1,
} from './timeline-groups.ts'
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
export const PROJECT_SCHEMA_VERSION = 'sanverse.project/v5'

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

/**
 * Why one change set contributes nothing, and which operation inside it decided.
 *
 * `operationIndex` is a position in that change set's own `operations` array, so
 * a caller can say "the second thing you asked for is what refused" instead of
 * "something in there failed".
 */
export type ChangeSetFailure = Readonly<{
  reason: string
  operationIndex: number
}>

export type ProjectEvaluation = Readonly<{
  /** The footage as it now stands: the imported arrangement plus every cut. */
  composition: Composition
  /** The same change sets, each carrying an up-to-date reason if it no longer fits. */
  records: readonly ChangeSetRecord[]
  /** Latest active, valid full-state primary-footage motion per stable motion identity. */
  footageMotions: readonly SetFootageMotionOperation[]
  /** Keyed by position in `project.changeSets`. Empty when everything still fits. */
  failures: ReadonlyMap<number, ChangeSetFailure>
}>

/**
 * One full replay of the history. `retracted` holds change sets already refused
 * by an earlier round, which contribute nothing here — not even their cuts.
 *
 * A blocked change set is shown to the user and never quietly adjusted to make
 * it fit, because an edit the user did not ask for is worse than an edit that
 * visibly needs attention.
 */
const evaluateRound = (
  project: EditProject,
  retracted: ReadonlyMap<number, ChangeSetFailure>,
): ProjectEvaluation => {
  const failures = new Map<number, ChangeSetFailure>(retracted)
  /** Active, not yet refused: the only records allowed to change anything. */
  const contributes = (index: number): boolean =>
    project.changeSets[index].active && !failures.has(index)

  // Pass one — what the finished video is MADE OF.
  //
  // Cuts are replayed in the order they were approved, each against the result
  // of the ones before it, because that is the order the user made them in.
  let composition = project.composition
  project.changeSets.forEach((record, index) => {
    if (!contributes(index)) return
    let trial = composition
    let failure: ChangeSetFailure | null = null
    record.changeSet.operations.forEach((operation, position) => {
      if (failure !== null || !isTimelineOperation(operation)) return
      const applied = applyTimelineOperation(trial, operation, project.assets)
      if (!applied.ok) {
        failure = Object.freeze({ reason: applied.error.reason, operationIndex: position })
        return
      }
      trial = applied.value
    })
    if (failure !== null) {
      failures.set(index, failure)
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
  project.changeSets.forEach((record, index) => {
    if (!contributes(index)) return
    record.changeSet.operations.forEach((operation, position) => {
      if (failures.has(index) || isTimelineOperation(operation)) return
      const checked = validateOperationAgainstComposition(operation, composition, project.assets)
      if (!checked.ok) {
        failures.set(index, Object.freeze({
          reason: checked.error.issues[0]?.code ?? 'OPERATION_INVALID',
          operationIndex: position,
        }))
      }
    })
  })

  const availableVisualIds = new Set<string>()
  project.changeSets.forEach((record, index) => {
    if (!contributes(index)) return
    for (const operation of record.changeSet.operations) {
      if (operation.kind === 'add-nameplate') availableVisualIds.add(operation.operationId)
      if (operation.kind === 'add-captions') availableVisualIds.add(operation.captionSetId)
      if (operation.kind === 'add-title') availableVisualIds.add(operation.titleId)
      if (operation.kind === 'add-callout') availableVisualIds.add(operation.calloutId)
      if (operation.kind === 'add-media-overlay') availableVisualIds.add(operation.overlayId)
    }
  })

  project.changeSets.forEach((record, index) => {
    if (!contributes(index)) return
    const position = record.changeSet.operations.findIndex(
      (operation) => isVisualPropertiesOperation(operation) && !availableVisualIds.has(operation.visualId),
    )
    if (position !== -1) {
      failures.set(index, Object.freeze({ reason: 'VISUAL_TARGET_UNKNOWN', operationIndex: position }))
    }
  })

  // One source moment may have one effective primary-footage motion. Repairs of
  // the same motion ID replace their prior full state before overlap is checked.
  // A refused record contributes nothing to the effective map, so a later edit
  // is never composed against motion the project did not accept.
  const effectiveByMotionId = new Map<string, SetFootageMotionOperation>()
  project.changeSets.forEach((record, index) => {
    if (!contributes(index)) return
    const trial = new Map(effectiveByMotionId)
    let failure: ChangeSetFailure | null = null
    record.changeSet.operations.forEach((operation, position) => {
      if (failure !== null || !isFootageMotionOperation(operation)) return
      trial.delete(operation.motionId)
      // A default full-state repair truthfully removes the effective motion. It
      // cannot overlap another motion because it draws no motion at all.
      if (isDefaultFootageMotion(operation)) return
      if ([...trial.values()].some((existing) => footageMotionsOverlap(existing, operation))) {
        failure = Object.freeze({ reason: 'FOOTAGE_MOTION_OVERLAP', operationIndex: position })
        return
      }
      trial.set(operation.motionId, operation)
    })
    if (failure !== null) {
      failures.set(index, failure)
      return
    }
    effectiveByMotionId.clear()
    trial.forEach((motion, motionId) => effectiveByMotionId.set(motionId, motion))
  })

  const records = project.changeSets.map((record, index) => {
    const blockedReason = record.active ? (failures.get(index)?.reason ?? null) : null
    return record.blockedReason === blockedReason ? record : Object.freeze({ ...record, blockedReason })
  })

  const footageMotions = foldFootageMotionOperations(
    project.changeSets
      .filter((_, index) => contributes(index))
      .flatMap((record) => record.changeSet.operations)
      .filter(isFootageMotionOperation),
  )

  return Object.freeze({
    composition,
    records: Object.freeze(records),
    footageMotions,
    failures: failures as ReadonlyMap<number, ChangeSetFailure>,
  })
}

/**
 * Replay the accepted history over the imported footage.
 *
 * This is the only place in the system that decides two things — what the
 * finished video is made of, and which change sets no longer fit. Computing
 * them together is deliberate: two passes could disagree, and a disagreement
 * here would mean the screen shows one video and the export produces another.
 *
 * A change set is all-or-nothing. If ANY operation inside it fails, the whole
 * change set contributes nothing — including its cuts. The user approved the
 * request as one thing, and half of it is a state they never agreed to.
 *
 * ## Why this loops
 *
 * Overlays are judged against the FINISHED footage, so a change set holding a
 * cut AND an overlay can have its cut applied in the first pass and then be
 * refused in the second. That left the cut in the video while the change set
 * reported failure — a user seeing an error message and a changed video at the
 * same time, with no Undo that removes it.
 *
 * So refusing a change set that contributed cuts RETRACTS those cuts and the
 * whole evaluation runs again on the larger footage. This terminates because
 * refusal only ever grows: a change set refused in one round is never revived
 * in a later one, and there are finitely many change sets. The oscillation this
 * once guarded against — remove a cut, an overlay becomes valid, re-apply the
 * cut, the overlay breaks again — cannot start, because nothing is ever
 * un-refused.
 *
 * The one case that conservatism decides: a change set whose own cut removes
 * the footage its own overlay sits on. That set is self-contradictory and stays
 * refused, rather than being accepted with its cut silently dropped.
 */
export const evaluateProject = (project: EditProject): ProjectEvaluation => {
  const retracted = new Map<number, ChangeSetFailure>()
  // Bounded by the number of change sets: every extra round refuses at least
  // one more, and a round that refuses nothing new is the answer.
  for (let round = 0; round < project.changeSets.length; round += 1) {
    const evaluated = evaluateRound(project, retracted)
    let retractedThisRound = false
    evaluated.failures.forEach((failure, index) => {
      if (retracted.has(index)) return
      if (!project.changeSets[index].changeSet.operations.some(isTimelineOperation)) return
      retracted.set(index, failure)
      retractedThisRound = true
    })
    if (!retractedThisRound) return evaluated
  }
  return evaluateRound(project, retracted)
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

/**
 * The closed answer to "apply this change set".
 *
 * There is no third case. Either the project moved forward by exactly one
 * revision with exactly one new history entry, or nothing about the project
 * changed at all and the caller is told which operation refused and why.
 */
export type AtomicChangeSetResult =
  | Readonly<{
      status: 'accepted'
      project: EditProject
      revision: number
      acceptedChangeSet: ChangeSetRecord
    }>
  | Readonly<{
      status: 'blocked'
      project: EditProject
      revision: number
      /** Position in the submitted change set's own `operations` array. */
      failedOperationIndex: number
      refusal: ProjectError
    }>

/**
 * Accept one change set, all of it or none of it.
 *
 * `acceptChangeSet` above answers the same question in the older
 * `Result<EditProject, ProjectError>` shape. This one additionally reports the
 * ORIGINAL project on refusal and names the operation that refused, which is
 * what a compound Timeline gesture needs to say "the audio could not go there"
 * rather than "that did not work".
 */
export const acceptChangeSetAtomic = (
  project: EditProject,
  candidate: unknown,
): AtomicChangeSetResult => {
  const blocked = (failedOperationIndex: number, refusal: ProjectError): AtomicChangeSetResult =>
    Object.freeze({
      status: 'blocked' as const,
      project,
      revision: (project as EditProject)?.revision ?? 0,
      failedOperationIndex,
      refusal,
    })

  const accepted = acceptChangeSet(project, candidate)
  if (accepted.ok) {
    const record = accepted.value.changeSets.at(-1)
    // `acceptChangeSet` only returns ok after the replay proved the record
    // applies, so the record is always present and never blocked here.
    return Object.freeze({
      status: 'accepted' as const,
      project: accepted.value,
      revision: accepted.value.revision,
      acceptedChangeSet: record as ChangeSetRecord,
    })
  }

  // Which operation refused? Replay the candidate against the unchanged project
  // to find out. This is a read-only probe: `evaluateProject` mutates nothing.
  const validatedProject = validateProject(project)
  const validatedChangeSet = validateChangeSet(candidate)
  if (!validatedProject.ok || !validatedChangeSet.ok) return blocked(0, accepted.error)

  const probe = Object.freeze({
    ...validatedProject.value,
    changeSets: Object.freeze([
      ...validatedProject.value.changeSets,
      Object.freeze({ changeSet: validatedChangeSet.value, active: true, blockedReason: null }),
    ]),
  })
  const failure = evaluateProject(probe).failures.get(validatedProject.value.changeSets.length)
  return blocked(failure?.operationIndex ?? 0, accepted.error)
}

/**
 * Names for things a change set is about to create, derived from what the
 * change set already is rather than from a random number.
 *
 * Two reasons this is not `crypto.randomUUID()`:
 *
 * 1. A refused draft must not burn an ID. With random IDs, validating a plan
 *    and then committing it produce different IDs, so the thing the user was
 *    shown is not the thing that got saved.
 * 2. The same gesture on the same project must produce the same project. That
 *    is what lets a test assert an exact result, and what lets a retry after a
 *    dropped connection be recognised as the same edit rather than a second one.
 */
export type IdFactory = Readonly<{
  /** `operation_…` for the nth operation this change set creates. */
  operation: (slot: number) => string
  /** A stable name for a created clip, fragment, overlay or link group. */
  entity: (namespace: string, slot: number) => string
}>

const ID_ALPHABET = 'abcdefghijklmnopqrstuvwxyz0123456789'

/** A 32-bit FNV-1a hash, rendered in the lower-case alphanumeric IDs use. */
const stableToken = (seed: string, length: number): string => {
  let hash = 0x811c9dc5
  for (let index = 0; index < seed.length; index += 1) {
    hash ^= seed.charCodeAt(index)
    hash = Math.imul(hash, 0x01000193) >>> 0
  }
  let token = ''
  let state = hash
  for (let index = 0; index < length; index += 1) {
    token += ID_ALPHABET[state % ID_ALPHABET.length]
    state = (Math.imul(state, 0x01000193) + 0x9e3779b9) >>> 0
  }
  return token
}

/**
 * @param changeSetId the ID of the change set being built — different gestures
 * therefore never collide, while the same gesture always agrees with itself.
 */
export const createIdFactory = (changeSetId: string): IdFactory =>
  Object.freeze({
    operation: (slot: number) => `operation_${stableToken(`${changeSetId}:op:${slot}`, 12)}`,
    entity: (namespace: string, slot: number) => `${namespace}_${stableToken(`${changeSetId}:${namespace}:${slot}`, 12)}`,
  })

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

/**
 * Which of the five tracks reach the finished video right now.
 *
 * Every track is on until an accepted operation says otherwise, so a project
 * that has never been touched here behaves exactly as it always did.
 */
export const activeTrackOutputs = (project: EditProject): TrackOutputState =>
  foldTrackOutputOperations(activeOperations(project).filter(isTrackOutputOperation))

/**
 * The user's markers right now. Empty for every project that has never had one,
 * which is every project saved before this existed. Nothing is rewritten.
 */
export const activeTimelineMarkers = (project: EditProject): readonly TimelineMarkerV1[] =>
  foldTimelineMarkerOperations(activeOperations(project).filter(isTimelineMarkersOperation))

/** The groups right now. Same reasoning as markers above. */
export const activeTimelineGroups = (project: EditProject): readonly TimelineGroupV1[] =>
  foldTimelineGroupOperations(activeOperations(project).filter(isTimelineGroupsOperation))

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
export * from './clip-time.ts'
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
  OVERLAY_TARGET_PATTERNS,
  foldOverlayOperations,
  isOverlayOperationKind,
  isRemovableOverlayId,
  validateOverlayOperation,
  type RemoveOverlayOperation,
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
  isNonRenderOperation,
  isOverlayFamilyOperation,
  isSourceAnchoredOperation,
  isTimelineGroupsOperation,
  isTimelineMarkersOperation,
  isTimelineOperation,
  isTrackOutputOperation,
  isVisualPropertiesOperation,
  validateOperation,
  validateOperationAgainstComposition,
  type AddNameplateOperation,
} from './operations.ts'
export {
  DEFAULT_TRACK_OUTPUTS,
  TIMELINE_TRACK_IDS,
  TRACK_OUTPUT_OPERATION_KIND,
  foldTrackOutputOperations,
  isTimelineTrackId,
  validateTrackOutputOperation,
  type SetTrackOutputOperation,
  type TimelineTrackId,
  type TrackOutputState,
} from './track-output.ts'
export {
  MARKERS_OPERATION_KIND,
  MARKER_COLORS,
  MARKER_ID_PATTERN,
  MAX_MARKERS,
  MAX_MARKER_LABEL_LENGTH,
  MAX_MARKER_NOTE_LENGTH,
  foldTimelineMarkerOperations,
  isMarkerColor,
  markerAfter,
  markerBefore,
  searchMarkers,
  sortMarkers,
  validateSetTimelineMarkersOperation,
  type MarkerColor,
  type SetTimelineMarkersOperation,
  type TimelineMarkerV1,
} from './timeline-markers.ts'
export {
  GROUPS_OPERATION_KIND,
  GROUP_ID_PATTERN,
  MAX_GROUPS,
  MAX_GROUP_MEMBERS,
  foldTimelineGroupOperations,
  groupForItem,
  resolveGroupMembers,
  validateSetTimelineGroupsOperation,
  type SetTimelineGroupsOperation,
  type TimelineGroupV1,
} from './timeline-groups.ts'
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
  type MovePrimaryClipOperation,
  type PlacePrimaryClipOperation,
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
  MOVE_PRIMARY_CLIP_PRIMITIVE_ID,
  OVERLAY_REMOVE_PRIMITIVE_ID,
  PLACE_PRIMARY_CLIP_PRIMITIVE_ID,
  REMOVE_PRIMITIVE_ID,
  REMOVE_RANGE_COMPONENT_ID,
  REORDER_PRIMITIVE_ID,
  SPLIT_PRIMITIVE_ID,
  TIMELINE_GROUPS_PRIMITIVE_ID,
  TIMELINE_MARKERS_PRIMITIVE_ID,
  TRACK_OUTPUT_PRIMITIVE_ID,
  TRIM_PRIMITIVE_ID,
  VISUAL_PROPERTIES_PRIMITIVE_ID,
  capabilityProduces,
  expandCapability,
  findCapability,
  type CapabilityDescriptor,
  type CapabilityLevel,
} from './capabilities.ts'
export { EXTENSION_KEY_PATTERN, EXTENSION_LIMITS, validateExtensions, type JsonValue } from './json.ts'
