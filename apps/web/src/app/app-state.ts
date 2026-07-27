import {
  PROJECT_TIMESCALE,
  TICKS_PER_MILLISECOND,
  clipAtCompositionTime,
  effectiveComposition,
  isOverlayOperation,
  placeSourceSpan,
  validateOperation,
  validateOperationAgainstComposition,
  type AddNameplateOperation,
  type EditProject,
} from '@sanverse/edit-domain'

export type HomeState = {
  screen: 'home'
  draftRequest: string
}

/**
 * Where a pending proposal came from, and what it claims it will do.
 *
 * This exists so an edit the assistant suggested is never mistaken for one the
 * user made by hand — in the history, in the saved file, and in what the user is
 * asked to approve.
 */
export type ProposalOrigin = Readonly<{
  source: 'direct' | 'ai'
  /** Ties an assistant proposal back to the request that produced it. */
  requestId: string | null
  /** One plain sentence describing what will happen. Null for hand-made edits. */
  explanation: string | null
  /** Set when a default or a clamp changed what was asked for. */
  note: string | null
}>

/**
 * One pending edit and where it came from, as a single value.
 *
 * These were briefly two fields that had to be kept in step. They are one
 * object because the failure that separation allows is not cosmetic: an edit
 * saved with the wrong origin is a false record of who decided it, written into
 * the user's project permanently. Making it one value means there is no way to
 * have an edit without knowing who proposed it.
 */
export type PendingProposal = Readonly<{
  operation: AddNameplateOperation
  origin: ProposalOrigin
}>

/**
 * What the assistant panel is doing right now.
 *
 * Every state here is one the user can be left sitting in, so each one has to
 * say something true and offer one obvious next action. There is no state that
 * means "something happened but we are not telling you".
 */
export type ConversationState = {
  status: 'ready' | 'sending' | 'clarification' | 'unsupported' | 'error'
  /** The last thing the user typed, kept so a clarification has context. */
  lastMessage: string
  /** The one question being asked, when status is `clarification`. */
  question: string | null
  /** A plain explanation of why nothing happened, for `unsupported` and `error`. */
  notice: string | null
}

export type StudioState = {
  screen: 'studio'
  project: {
    id: string
    name: string
    mediaUrl: string
    draftRequest: string
  }
  /** The pending, not-yet-accepted edit. Nothing is saved until it is accepted. */
  proposal: PendingProposal | null
  editError: string | null
  /** The authoritative project as last reported by the server. */
  editProject: EditProject
  conversation: ConversationState
}

export type AppState = HomeState | StudioState

type LocalProjectInput = {
  id: string
  name: string
  mediaUrl: string
  draftRequest?: string
  editProject: EditProject
}

export const DIRECT_ORIGIN: ProposalOrigin = {
  source: 'direct',
  requestId: null,
  explanation: null,
  note: null,
}

const readyConversation = (): ConversationState => ({
  status: 'ready',
  lastMessage: '',
  question: null,
  notice: null,
})

export function createInitialState(): HomeState {
  return {
    screen: 'home',
    draftRequest: '',
  }
}

export function updateDraftRequest(state: HomeState, value: string): HomeState
export function updateDraftRequest(state: StudioState, value: string): StudioState
export function updateDraftRequest(state: AppState, value: string): AppState
export function updateDraftRequest(state: AppState, value: string): AppState {
  if (state.screen === 'home') {
    return { ...state, draftRequest: value }
  }
  return { ...state, project: { ...state.project, draftRequest: value } }
}

export function openLocalProject(state: HomeState, input: LocalProjectInput): StudioState {
  return {
    screen: 'studio',
    project: {
      id: input.id,
      name: input.name,
      mediaUrl: input.mediaUrl,
      draftRequest: input.draftRequest ?? state.draftRequest,
    },
    proposal: null,
    editError: null,
    editProject: input.editProject,
    conversation: readyConversation(),
  }
}

/**
 * Check a proposal before it is previewed.
 *
 * Both checks matter. The first is the shape; the second is whether the edit
 * makes sense against this particular video. v1 could only do the first,
 * because the browser never knew how long the video was, so an impossible
 * nameplate was previewed and saved and only failed at export.
 *
 * The same two checks run whether the proposal came from the user's own hands
 * or from the assistant. Nothing is trusted because of where it came from.
 */
export function queueEditProposal(
  state: StudioState,
  proposal: unknown,
  origin: ProposalOrigin = DIRECT_ORIGIN,
): StudioState {
  const validated = validateOperation(proposal)
  if (!validated.ok) {
    return {
      ...state,
      proposal: null,
      editError: 'The app could not preview this proposal because its edit data is invalid.',
    }
  }

  if (!isOverlayOperation(validated.value)) {
    return {
      ...state,
      proposal: null,
      editError: 'The app could not preview this proposal because its edit data is invalid.',
    }
  }

  const fits = validateOperationAgainstComposition(validated.value, effectiveComposition(state.editProject))
  if (!fits.ok) {
    const issue = fits.error.issues[0]?.code
    return {
      ...state,
      proposal: null,
      editError: issue === 'SOURCE_SPAN_REMOVED'
        ? 'That text would run past the end of this video. Choose an earlier point.'
        : 'This edit does not fit this video. Choose another point and try again.',
    }
  }

  const alreadyUsed = state.editProject.changeSets.some((record) =>
    record.changeSet.operations.some((operation) => operation.operationId === validated.value.operationId),
  )
  if (alreadyUsed) {
    return {
      ...state,
      proposal: null,
      editError: 'This edit ID has already been used. Create a new proposal and try again.',
    }
  }

  return {
    ...state,
    proposal: { operation: validated.value, origin },
    editError: null,
    conversation: { ...state.conversation, status: 'ready', question: null, notice: null },
  }
}

/**
 * Where a pending nameplate would appear on screen, right now.
 *
 * A nameplate is stored against the original footage, so its on-screen position
 * is not a number that can be read off it — it has to be worked out from which
 * pieces of that footage survived cutting. Everything that shows a time to the
 * user goes through here, so the panel, the time strip, and the preview can
 * never quote three different numbers.
 *
 * Null means the footage it was pinned to is no longer in the video.
 */
export function proposalPlacement(
  project: EditProject,
  operation: AddNameplateOperation,
): Readonly<{ startTicks: number; durationTicks: number }> | null {
  const placements = placeSourceSpan(
    effectiveComposition(project),
    operation.assetId,
    operation.sourceInterval,
  )
  if (placements.length === 0) return null
  const first = placements[0]
  const last = placements[placements.length - 1]
  const endTicks = last.compositionRange.start.ticks + last.compositionRange.duration.ticks
  return Object.freeze({
    startTicks: first.compositionRange.start.ticks,
    durationTicks: endTicks - first.compositionRange.start.ticks,
  })
}

export type ProposalRepair = Readonly<{
  primaryText?: string
  secondaryText?: string
  startMs?: number
  durationMs?: number
  point?: Readonly<{ x: number; y: number }>
}>

/**
 * Change a pending proposal by hand, without asking the assistant again.
 *
 * This is the difference between "nearly right" being useful and being
 * worthless. Re-asking would produce a different answer that has to be judged
 * from scratch; nudging the wording or the timing keeps everything the user
 * already approved and changes only the part that was wrong.
 *
 * The edited proposal goes through exactly the same validation as a new one,
 * and keeps its original identity, so its history entry still records that the
 * assistant proposed it.
 */
export function repairProposal(state: StudioState, repair: ProposalRepair): StudioState {
  const pending = state.proposal
  if (!pending) return state
  const current = pending.operation
  const composition = effectiveComposition(state.editProject)

  const start = repair.startMs === undefined
    ? proposalPlacement(state.editProject, current)?.startTicks ?? -1
    : Math.round(repair.startMs) * TICKS_PER_MILLISECOND
  const requestedDuration = repair.durationMs === undefined
    ? current.sourceInterval.duration.ticks
    : Math.round(repair.durationMs) * TICKS_PER_MILLISECOND

  // The moment the user typed is a moment of the FINISHED video. It has to
  // land on a piece of footage that is still there; a hole left by "remove but
  // keep the space" has nothing to pin a nameplate to.
  const clip = start < 0
    ? undefined
    : clipAtCompositionTime(composition, { ticks: start, timescale: PROJECT_TIMESCALE })
  if (!clip) {
    return { ...state, editError: 'That moment is outside this video. Choose one inside it.' }
  }
  const clipEnd = clip.compositionStart.ticks + clip.sourceRange.duration.ticks

  // Shortening to fit is visible in the preview before anything is accepted,
  // so the user always sees the version they are approving.
  const duration = Math.max(TICKS_PER_MILLISECOND, Math.min(requestedDuration, clipEnd - start))
  const sourceStart = clip.sourceRange.start.ticks + (start - clip.compositionStart.ticks)

  const repaired = {
    ...current,
    assetId: clip.assetId,
    sourceInterval: {
      start: { ticks: sourceStart, timescale: PROJECT_TIMESCALE },
      duration: { ticks: duration, timescale: PROJECT_TIMESCALE },
    },
    target: repair.point
      ? { ...current.target, point: { x: repair.point.x, y: repair.point.y } }
      : current.target,
    primaryText: repair.primaryText === undefined ? current.primaryText : repair.primaryText.trim(),
    secondaryText: repair.secondaryText === undefined ? current.secondaryText : repair.secondaryText.trim(),
  }

  const validated = validateOperation(repaired)
  if (!validated.ok || !isOverlayOperation(validated.value)) {
    return { ...state, editError: 'That change could not be applied. The text may be empty or too long.' }
  }
  const fits = validateOperationAgainstComposition(validated.value, composition)
  if (!fits.ok) {
    return { ...state, editError: 'That change does not fit this video. Try a different moment.' }
  }

  // The origin is carried through untouched. A repaired proposal is still one
  // the assistant suggested, and the saved record has to say so.
  return { ...state, proposal: { operation: validated.value, origin: pending.origin }, editError: null }
}

export function discardEditProposal(state: StudioState): StudioState {
  return {
    ...state,
    proposal: null,
    editError: null,
    conversation: { ...state.conversation, status: 'ready', question: null, notice: null },
  }
}

/** Replace local state with what the server reported after an accepted edit. */
export function applyServerProject(state: StudioState, editProject: EditProject): StudioState {
  return { ...state, editProject, proposal: null, editError: null }
}

export function reportEditError(state: StudioState, message: string): StudioState {
  return { ...state, editError: message }
}

export function pendingProposalError(state: StudioState): StudioState {
  return {
    ...state,
    editError: 'Discard or accept the pending proposal before changing edit history.',
  }
}

export function startConversationRequest(state: StudioState, message: string): StudioState {
  return {
    ...state,
    conversation: { status: 'sending', lastMessage: message, question: null, notice: null },
  }
}

export function reportClarification(state: StudioState, question: string): StudioState {
  return { ...state, conversation: { ...state.conversation, status: 'clarification', question, notice: null } }
}

export function reportUnsupported(state: StudioState, message: string): StudioState {
  return { ...state, conversation: { ...state.conversation, status: 'unsupported', question: null, notice: message } }
}

export function reportConversationError(state: StudioState, message: string): StudioState {
  return { ...state, conversation: { ...state.conversation, status: 'error', question: null, notice: message } }
}

export function canUndoProject(state: StudioState): boolean {
  return !state.proposal && state.editProject.changeSets.length > 0
}

export function canRedoProject(state: StudioState): boolean {
  return !state.proposal && state.editProject.redoStack.length > 0
}

export function returnHome(_state: StudioState): HomeState {
  return createInitialState()
}

function changeSetIdFor(operationId: string): string {
  return `changeset_${operationId.replace(/^operation_/, '').slice(0, 32)}`
}

/**
 * Wrap one accepted proposal as one change set.
 *
 * `baseRevision` is the revision the user was looking at. If the project has
 * moved on by the time this reaches the server, the server refuses it rather
 * than applying an edit to a state nobody reviewed.
 *
 * It takes the whole pending proposal, not a loose operation, so there is no
 * call site that can build a change set without saying where the edit came
 * from. A wrong origin would be a false record of who decided the edit, written
 * into the user's project permanently.
 */
export function buildChangeSet(pending: PendingProposal, baseRevision: number) {
  return {
    schemaVersion: 'sanverse.change-set/v1' as const,
    changeSetId: changeSetIdFor(pending.operation.operationId),
    baseRevision,
    operations: [pending.operation],
    provenance: { source: pending.origin.source, requestId: pending.origin.requestId },
    extensions: {},
  }
}
