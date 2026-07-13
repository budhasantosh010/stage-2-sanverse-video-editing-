import {
  accept as acceptHistoryAction,
  createHistory,
  redo as redoHistory,
  undo as undoHistory,
  validateAddNameplateAction,
  type AddNameplateAction,
} from '@sanverse/edit-domain'
import type { EditHistory } from '@sanverse/edit-domain/history'

export type HomeState = {
  screen: 'home'
  draftRequest: string
}

export type StudioState = {
  screen: 'studio'
  project: {
    name: string
    mediaUrl: string
    draftRequest: string
  }
  proposal: AddNameplateAction | null
  editError: string | null
  history: EditHistory
}

export type AppState = HomeState | StudioState

type LocalProjectInput = {
  name: string
  mediaUrl: string
  draftRequest?: string
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
    return {
      ...state,
      draftRequest: value,
    }
  }

  return {
    ...state,
    project: {
      ...state.project,
      draftRequest: value,
    },
  }
}

export function openLocalProject(
  state: HomeState,
  input: LocalProjectInput,
): StudioState {
  return {
    screen: 'studio',
    project: {
      name: input.name,
      mediaUrl: input.mediaUrl,
      draftRequest: input.draftRequest ?? state.draftRequest,
    },
    proposal: null,
    editError: null,
    history: createHistory(),
  }
}

export function queueEditProposal(state: StudioState, proposal: unknown): StudioState {
  const validated = validateAddNameplateAction(proposal)
  if (!validated.ok) {
    return {
      ...state,
      proposal: null,
      editError: 'The app could not preview this proposal because its edit data is invalid.',
    }
  }

  if (state.history.issuedActionIds.includes(validated.value.actionId)) {
    return {
      ...state,
      proposal: null,
      editError: 'This edit ID has already been used. Create a new proposal and try again.',
    }
  }

  return {
    ...state,
    proposal: validated.value,
    editError: null,
  }
}

export function discardEditProposal(state: StudioState): StudioState {
  return {
    ...state,
    proposal: null,
    editError: null,
  }
}

export function acceptEditProposal(state: StudioState): StudioState {
  if (!state.proposal) {
    return {
      ...state,
      editError: 'There is no proposal to accept.',
    }
  }

  const accepted = acceptHistoryAction(state.history, state.proposal)
  if (!accepted.ok) {
    return {
      ...state,
      editError: 'This proposal could not be accepted. The edit history was not changed.',
    }
  }

  return {
    ...state,
    proposal: null,
    editError: null,
    history: accepted.value,
  }
}

function pendingProposalError(state: StudioState): StudioState {
  return {
    ...state,
    editError: 'Discard or accept the pending proposal before changing edit history.',
  }
}

export function undoEdit(state: StudioState): StudioState {
  if (state.proposal) return pendingProposalError(state)
  const undone = undoHistory(state.history)
  if (!undone.ok) {
    return {
      ...state,
      editError: 'There is no accepted edit to undo.',
    }
  }
  return { ...state, history: undone.value, editError: null }
}

export function redoEdit(state: StudioState): StudioState {
  if (state.proposal) return pendingProposalError(state)
  const redone = redoHistory(state.history)
  if (!redone.ok) {
    return {
      ...state,
      editError: 'There is no edit to redo.',
    }
  }
  return { ...state, history: redone.value, editError: null }
}

export function returnHome(_state: StudioState): HomeState {
  return createInitialState()
}
