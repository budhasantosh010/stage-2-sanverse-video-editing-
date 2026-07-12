export type AppState =
  | {
      screen: 'home'
      draftRequest: string
    }
  | {
      screen: 'studio'
      project: {
        name: string
        mediaUrl: string
        draftRequest: string
      }
    }

type StudioState = Extract<AppState, { screen: 'studio' }>

type LocalProjectInput = {
  name: string
  mediaUrl: string
  draftRequest?: string
}

export function createInitialState(): AppState {
  return {
    screen: 'home',
    draftRequest: '',
  }
}

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
  state: AppState,
  input: LocalProjectInput,
): StudioState {
  const currentDraftRequest =
    state.screen === 'home'
      ? state.draftRequest
      : state.project.draftRequest

  return {
    screen: 'studio',
    project: {
      name: input.name,
      mediaUrl: input.mediaUrl,
      draftRequest: input.draftRequest ?? currentDraftRequest,
    },
  }
}

export function returnHome(_state: StudioState): AppState {
  return createInitialState()
}
