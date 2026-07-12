import { useEffect, useRef, useState, type RefObject } from 'react'

import {
  createInitialState,
  openLocalProject,
  returnHome,
  updateDraftRequest,
  type AppState,
} from './app-state'
import { createLocalMediaHandle } from '../features/local-media/local-media'
import { HomeScreen } from '../screens/home/HomeScreen'
import { StudioScreen } from '../screens/studio/StudioScreen'

type LocalMediaHandle = ReturnType<typeof createLocalMediaHandle>

function disposeCurrentHandle(handleRef: RefObject<LocalMediaHandle | null>): void {
  const handle = handleRef.current
  handleRef.current = null
  handle?.dispose()
}

export function App() {
  const [appState, setAppState] = useState<AppState>(createInitialState)
  const mediaHandleRef = useRef<LocalMediaHandle | null>(null)

  useEffect(() => {
    return () => disposeCurrentHandle(mediaHandleRef)
  }, [])

  if (appState.screen === 'home') {
    return (
      <HomeScreen
        draftRequest={appState.draftRequest}
        onDraftRequestChange={(value) => {
          setAppState((current) =>
            current.screen === 'home' ? updateDraftRequest(current, value) : current,
          )
        }}
        onStartProject={(file) => {
          disposeCurrentHandle(mediaHandleRef)

          const handle = createLocalMediaHandle(file)
          mediaHandleRef.current = handle
          setAppState(
            openLocalProject(appState, {
              name: file.name,
              mediaUrl: handle.url,
            }),
          )
        }}
      />
    )
  }

  return (
    <StudioScreen
      project={appState.project}
      onBack={() => {
        disposeCurrentHandle(mediaHandleRef)
        setAppState((current) =>
          current.screen === 'studio' ? returnHome(current) : current,
        )
      }}
    />
  )
}
