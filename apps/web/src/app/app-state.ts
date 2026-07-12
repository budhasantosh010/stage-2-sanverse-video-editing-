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
  }
}

export function returnHome(_state: StudioState): HomeState {
  return createInitialState()
}
