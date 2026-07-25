import { useEffect, useRef, useState } from 'react'
import { flushSync } from 'react-dom'
import type { EditHistory } from '@sanverse/edit-domain/history'

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
  type StudioState,
} from './app-state'
import { uploadProject } from '../features/project-intake/project-intake'
import { exportProject, type ProjectExportState } from '../features/project-export/project-export'
import { listRecentProjects, loadProject, saveProjectHistory, type RecentProject } from '../features/project-library/project-library'
import { transitionView } from '../features/view-transition/view-transition'
import { HomeScreen } from '../screens/home/HomeScreen'
import { StudioScreen } from '../screens/studio/StudioScreen'

export function App() {
  const [appState, setAppState] = useState<AppState>(createInitialState)
  const [isStarting, setIsStarting] = useState(false)
  const [startError, setStartError] = useState('')
  const [exportState, setExportState] = useState<ProjectExportState>({ status: 'idle' })
  const [recentProjects, setRecentProjects] = useState<readonly RecentProject[]>([])
  const [libraryError, setLibraryError] = useState('')
  const [isOpeningRecent, setIsOpeningRecent] = useState(false)
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const intakeAbortRef = useRef<AbortController | null>(null)
  const intakeInFlightRef = useRef(false)
  const transitionSequenceRef = useRef(0)
  const exportAbortRef = useRef<AbortController | null>(null)
  const exportInFlightRef = useRef(false)
  const libraryAbortRef = useRef<AbortController | null>(null)
  const libraryInFlightRef = useRef(false)
  const saveSequenceRef = useRef(0)
  const saveQueueRef = useRef<Promise<void>>(Promise.resolve())

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
      libraryAbortRef.current?.abort()
      intakeInFlightRef.current = false
      exportInFlightRef.current = false
    }
  }, [])

  useEffect(() => {
    if (appState.screen !== 'home') return
    const controller = new AbortController()
    libraryAbortRef.current = controller
    setLibraryError('')
    void listRecentProjects(fetch, controller.signal)
      .then((projects) => {
        if (!controller.signal.aborted) setRecentProjects(projects)
      })
      .catch((error: unknown) => {
        if (!controller.signal.aborted) setLibraryError(error instanceof Error ? error.message : 'We could not load your local projects. Try again.')
      })
    return () => {
      controller.abort()
      if (libraryAbortRef.current === controller) libraryAbortRef.current = null
    }
  }, [appState.screen])

  function queueHistorySave(projectId: string, history: EditHistory): void {
    const sequence = saveSequenceRef.current + 1
    saveSequenceRef.current = sequence
    setSaveState('saving')
    const save = saveQueueRef.current
      .catch(() => undefined)
      .then(() => saveProjectHistory(projectId, history))
    saveQueueRef.current = save.then(() => undefined, () => undefined)
    void save.then(
      () => { if (saveSequenceRef.current === sequence) setSaveState('saved') },
      () => { if (saveSequenceRef.current === sequence) setSaveState('error') },
    )
  }

  function applyHistoryChange(change: (state: StudioState) => StudioState): void {
    if (appState.screen !== 'studio') return
    resetExport()
    const next = change(appState)
    setAppState(next)
    if (next.history !== appState.history) queueHistorySave(next.project.id, next.history)
  }

  if (appState.screen === 'home') {
    return (
      <HomeScreen
        draftRequest={appState.draftRequest}
        isStarting={isStarting}
        startError={startError || libraryError}
        recentProjects={recentProjects}
        isOpeningRecent={isOpeningRecent}
        onDraftRequestChange={(value) => {
          setAppState((current) =>
            current.screen === 'home' ? updateDraftRequest(current, value) : current,
          )
        }}
        onStartProject={(file) => {
          if (intakeInFlightRef.current || libraryInFlightRef.current) return
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
                  saveSequenceRef.current += 1
                  setSaveState('idle')
                  setRecentProjects((projects) => Object.freeze([project, ...projects.filter((candidate) => candidate.id !== project.id)]))
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
        onOpenRecentProject={(summary) => {
          if (libraryInFlightRef.current || intakeInFlightRef.current) return
          libraryInFlightRef.current = true
          setIsOpeningRecent(true)
          setLibraryError('')
          const transitionSequence = transitionSequenceRef.current + 1
          transitionSequenceRef.current = transitionSequence
          const controller = new AbortController()
          libraryAbortRef.current = controller
          void loadProject(summary.id, fetch, controller.signal)
            .then((project) => {
              if (transitionSequence !== transitionSequenceRef.current || controller.signal.aborted) return
              libraryInFlightRef.current = false
              libraryAbortRef.current = null
              transitionView(() => {
                if (transitionSequence !== transitionSequenceRef.current) return
                flushSync(() => {
                  setAppState((current) => current.screen === 'home' ? openLocalProject(current, {
                    id: project.id,
                    name: project.originalFilename,
                    mediaUrl: project.mediaUrl,
                    history: project.history,
                  }) : current)
                  setIsOpeningRecent(false)
                  setExportState({ status: 'idle' })
                  saveSequenceRef.current += 1
                  setSaveState('saved')
                })
              })
            })
            .catch((error: unknown) => {
              if (transitionSequence !== transitionSequenceRef.current || controller.signal.aborted) return
              libraryInFlightRef.current = false
              libraryAbortRef.current = null
              setIsOpeningRecent(false)
              setLibraryError(error instanceof Error ? error.message : 'We could not load your local projects. Try again.')
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
      saveState={saveState}
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
        applyHistoryChange(acceptEditProposal)
      }}
      onUndo={() => {
        applyHistoryChange(undoEdit)
      }}
      onRedo={() => {
        applyHistoryChange(redoEdit)
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
            saveSequenceRef.current += 1
            setSaveState('idle')
          })
        })
      }}
    />
  )
}
