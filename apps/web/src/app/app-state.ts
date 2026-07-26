import {
  validateOperation,
  validateOperationAgainstComposition,
  type AddNameplateOperation,
  type EditProject,
} from '@sanverse/edit-domain'

export type HomeState = {
  screen: 'home'
  draftRequest: string
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
  proposal: AddNameplateOperation | null
  editError: string | null
  /** The authoritative project as last reported by the server. */
  editProject: EditProject
}

export type AppState = HomeState | StudioState

type LocalProjectInput = {
  id: string
  name: string
  mediaUrl: string
  draftRequest?: string
  editProject: EditProject
}

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
  }
}

/**
 * Check a proposal before it is previewed.
 *
 * Both checks matter. The first is the shape; the second is whether the edit
 * makes sense against this particular video. v1 could only do the first,
 * because the browser never knew how long the video was, so an impossible
 * nameplate was previewed and saved and only failed at export.
 */
export function queueEditProposal(state: StudioState, proposal: unknown): StudioState {
  const validated = validateOperation(proposal)
  if (!validated.ok) {
    return {
      ...state,
      proposal: null,
      editError: 'The app could not preview this proposal because its edit data is invalid.',
    }
  }

  const fits = validateOperationAgainstComposition(validated.value, state.editProject.composition)
  if (!fits.ok) {
    const issue = fits.error.issues[0]?.code
    return {
      ...state,
      proposal: null,
      editError: issue === 'INTERVAL_OUTSIDE_COMPOSITION'
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

  return { ...state, proposal: validated.value, editError: null }
}

export function discardEditProposal(state: StudioState): StudioState {
  return { ...state, proposal: null, editError: null }
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
 */
export function buildChangeSet(proposal: AddNameplateOperation, baseRevision: number) {
  return {
    schemaVersion: 'sanverse.change-set/v1' as const,
    changeSetId: changeSetIdFor(proposal.operationId),
    baseRevision,
    operations: [proposal],
    provenance: { source: 'direct' as const, requestId: null },
    extensions: {},
  }
}
