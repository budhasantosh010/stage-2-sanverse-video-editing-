import { useEffect, useRef, useState } from 'react'
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
import { uploadProject } from '../features/project-intake/project-intake'
import { exportProject, type ProjectExportState } from '../features/project-export/project-export'
import { transitionView } from '../features/view-transition/view-transition'
import { HomeScreen } from '../screens/home/HomeScreen'
import { StudioScreen } from '../screens/studio/StudioScreen'

export function App() {
  const [appState, setAppState] = useState<AppState>(createInitialState)
  const [isStarting, setIsStarting] = useState(false)
  const [startError, setStartError] = useState('')
  const [exportState, setExportState] = useState<ProjectExportState>({ status: 'idle' })
  const intakeAbortRef = useRef<AbortController | null>(null)
  const intakeInFlightRef = useRef(false)
  const transitionSequenceRef = useRef(0)
  const exportAbortRef = useRef<AbortController | null>(null)
  const exportInFlightRef = useRef(false)

  function resetExport(): void {
    exportAbortRef.current?.abort()
    exportAbortRef.current = null
    exportInFlightRef.current = false
    setExportState({ status: 'idle' })
  }

  useEffect(() => {
    return () => {
      transitionSequenceRef.current += 1
      intakeAbortRef.current?.abort()
      exportAbortRef.current?.abort()
      intakeInFlightRef.current = false
      exportInFlightRef.current = false
    }
  }, [])

  if (appState.screen === 'home') {
    return (
      <HomeScreen
        draftRequest={appState.draftRequest}
        isStarting={isStarting}
        startError={startError}
        onDraftRequestChange={(value) => {
          setAppState((current) =>
            current.screen === 'home' ? updateDraftRequest(current, value) : current,
          )
        }}
        onStartProject={(file) => {
          if (intakeInFlightRef.current) return
          intakeInFlightRef.current = true
          const transitionSequence = transitionSequenceRef.current + 1
          transitionSequenceRef.current = transitionSequence
          const controller = new AbortController()
          intakeAbortRef.current = controller
          setIsStarting(true)
          setStartError('')
          void uploadProject(file, fetch, controller.signal)
            .then((project) => {
              if (transitionSequence !== transitionSequenceRef.current || controller.signal.aborted) return
              intakeAbortRef.current = null
              intakeInFlightRef.current = false
              transitionView(() => {
                if (transitionSequence !== transitionSequenceRef.current) return
                flushSync(() => {
                  setAppState((current) => current.screen === 'home' ? openLocalProject(current, {
                    id: project.id,
                    name: project.originalFilename,
                    mediaUrl: project.mediaUrl,
                  }) : current)
                  setIsStarting(false)
                  setExportState({ status: 'idle' })
                })
              })
            })
            .catch((error: unknown) => {
              if (transitionSequence !== transitionSequenceRef.current || controller.signal.aborted) return
              intakeAbortRef.current = null
              intakeInFlightRef.current = false
              setIsStarting(false)
              setStartError(error instanceof Error ? error.message : 'The video could not be imported. Try again.')
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
      exportState={exportState}
      onProposal={(proposal) => {
        resetExport()
        setAppState((current) =>
          current.screen === 'studio' ? queueEditProposal(current, proposal) : current,
        )
      }}
      onDiscardProposal={() => {
        resetExport()
        setAppState((current) =>
          current.screen === 'studio' ? discardEditProposal(current) : current,
        )
      }}
      onAcceptProposal={() => {
        resetExport()
        setAppState((current) =>
          current.screen === 'studio' ? acceptEditProposal(current) : current,
        )
      }}
      onUndo={() => {
        resetExport()
        setAppState((current) =>
          current.screen === 'studio' ? undoEdit(current) : current,
        )
      }}
      onRedo={() => {
        resetExport()
        setAppState((current) =>
          current.screen === 'studio' ? redoEdit(current) : current,
        )
      }}
      onExport={() => {
        if (exportInFlightRef.current || appState.proposal || appState.history.accepted.length === 0) return
        exportInFlightRef.current = true
        const controller = new AbortController()
        exportAbortRef.current = controller
        setExportState({ status: 'rendering' })
        void exportProject(appState.project.id, appState.history, fetch, controller.signal)
          .then((result) => {
            if (exportAbortRef.current !== controller || controller.signal.aborted) return
            exportAbortRef.current = null
            exportInFlightRef.current = false
            setExportState({ status: 'ready', result })
          })
          .catch((error: unknown) => {
            if (exportAbortRef.current !== controller || controller.signal.aborted) return
            exportAbortRef.current = null
            exportInFlightRef.current = false
            setExportState({ status: 'error', message: error instanceof Error ? error.message : 'We could not export the video. Your accepted edits are still safe.' })
          })
      }}
      onBack={() => {
        resetExport()
        const transitionSequence = transitionSequenceRef.current + 1
        transitionSequenceRef.current = transitionSequence
        transitionView(() => {
          if (transitionSequence !== transitionSequenceRef.current) {
            return
          }

          flushSync(() => {
            setAppState((current) =>
              current.screen === 'studio' ? returnHome(current) : current,
            )
          })
        })
      }}
    />
  )
}
