import { useEffect, useRef, useState, type RefObject } from 'react'
import { flushSync } from 'react-dom'

import {
  acceptEditProposal,
  createInitialState,
  discardEditProposal,
  openLocalProject,
  queueEditProposal,
  redoEdit,
  returnHome,
  undoEdit,
  updateDraftRequest,
  type AppState,
} from './app-state'
import { createLocalMediaHandle } from '../features/local-media/local-media'
import { transitionView } from '../features/view-transition/view-transition'
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
  const transitionSequenceRef = useRef(0)

  useEffect(() => {
    return () => {
      transitionSequenceRef.current += 1
      disposeCurrentHandle(mediaHandleRef)
    }
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
          const transitionSequence = transitionSequenceRef.current + 1
          transitionSequenceRef.current = transitionSequence
          disposeCurrentHandle(mediaHandleRef)

          const handle = createLocalMediaHandle(file)
          mediaHandleRef.current = handle
          transitionView(() => {
            if (
              transitionSequence !== transitionSequenceRef.current ||
              mediaHandleRef.current !== handle
            ) {
              return
            }

            flushSync(() => {
              setAppState(
                openLocalProject(appState, {
                  name: file.name,
                  mediaUrl: handle.url,
                }),
              )
            })
          })
        }}
      />
    )
  }

  return (
    <StudioScreen
      project={appState.project}
      proposal={appState.proposal}
      history={appState.history}
      editError={appState.editError}
      onProposal={(proposal) => {
        setAppState((current) =>
          current.screen === 'studio' ? queueEditProposal(current, proposal) : current,
        )
      }}
      onDiscardProposal={() => {
        setAppState((current) =>
          current.screen === 'studio' ? discardEditProposal(current) : current,
        )
      }}
      onAcceptProposal={() => {
        setAppState((current) =>
          current.screen === 'studio' ? acceptEditProposal(current) : current,
        )
      }}
      onUndo={() => {
        setAppState((current) =>
          current.screen === 'studio' ? undoEdit(current) : current,
        )
      }}
      onRedo={() => {
        setAppState((current) =>
          current.screen === 'studio' ? redoEdit(current) : current,
        )
      }}
      onBack={() => {
        const transitionSequence = transitionSequenceRef.current + 1
        transitionSequenceRef.current = transitionSequence
        transitionView(() => {
          if (transitionSequence !== transitionSequenceRef.current) {
            return
          }

          flushSync(() => {
            disposeCurrentHandle(mediaHandleRef)
            setAppState((current) =>
              current.screen === 'studio' ? returnHome(current) : current,
            )
          })
        })
      }}
    />
  )
}
