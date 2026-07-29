import { useEffect, useRef, useState } from 'react'
import { flushSync } from 'react-dom'
import type { EditProject } from '@sanverse/edit-domain'

import {
  applyServerProject,
  buildChangeSet,
  canRedoProject,
  canUndoProject,
  createInitialState,
  discardEditProposal,
  openLocalProject,
  queueEditProposal,
  repairProposal,
  reportClarification,
  reportConversationError,
  reportEditError,
  reportUnsupported,
  returnHome,
  startConversationRequest,
  updateDraftRequest,
  type AppState,
} from './app-state'
import {
  CONVERSATION_ERROR,
  requestIntent,
  type IntentContextInput,
} from '../features/conversation/conversation-client'
import { uploadProject } from '../features/project-intake/project-intake'
import { exportProject, type ProjectExportState } from '../features/project-export/project-export'
import {
  acceptChangeSet,
  addCaptionsFromTranscript,
  projectAssetUrl,
  uploadProjectAsset,
  listRecentProjects,
  loadProject,
  redoProject,
  undoProject,
  type RecentProject,
} from '../features/project-library/project-library'
import { transitionView } from '../features/view-transition/view-transition'
import { HomeScreen } from '../screens/home/HomeScreen'
import { StudioScreen } from '../screens/studio/StudioScreen'
import { EditorShell, type EditorWorkspace } from '../editor/EditorShell'

export function App() {
  const [appState, setAppState] = useState<AppState>(createInitialState)
  const [isStarting, setIsStarting] = useState(false)
  const [startError, setStartError] = useState('')
  const [exportState, setExportState] = useState<ProjectExportState>({ status: 'idle' })
  const [recentProjects, setRecentProjects] = useState<readonly RecentProject[]>([])
  const [libraryError, setLibraryError] = useState('')
  const [isOpeningRecent, setIsOpeningRecent] = useState(false)
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const [workspace, setWorkspace] = useState<EditorWorkspace>('assist')
  const intakeAbortRef = useRef<AbortController | null>(null)
  const intakeInFlightRef = useRef(false)
  const transitionSequenceRef = useRef(0)
  const exportAbortRef = useRef<AbortController | null>(null)
  const exportInFlightRef = useRef(false)
  const libraryAbortRef = useRef<AbortController | null>(null)
  const libraryInFlightRef = useRef(false)
  const saveSequenceRef = useRef(0)
  const saveQueueRef = useRef<Promise<void>>(Promise.resolve())
  const conversationAbortRef = useRef<AbortController | null>(null)
  const conversationSequenceRef = useRef(0)

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
      conversationAbortRef.current?.abort()
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

  /**
   * Every edit is applied by the server, one at a time, and the browser adopts
   * whatever the server reports back. The browser never decides the new state,
   * so it can never overwrite work it did not see.
   */
  function requestEdit(run: (projectId: string) => Promise<EditProject>): void {
    if (appState.screen !== 'studio') return
    const projectId = appState.project.id
    const sequence = saveSequenceRef.current + 1
    saveSequenceRef.current = sequence
    resetExport()
    setSaveState('saving')

    const request = saveQueueRef.current.catch(() => undefined).then(() => run(projectId))
    saveQueueRef.current = request.then(() => undefined, () => undefined)
    void request.then(
      (editProject) => {
        if (saveSequenceRef.current !== sequence) return
        setAppState((current) => (current.screen === 'studio' ? applyServerProject(current, editProject) : current))
        setSaveState('saved')
      },
      (error: unknown) => {
        if (saveSequenceRef.current !== sequence) return
        setSaveState('error')
        const message = error instanceof Error ? error.message : 'This edit could not be saved. Nothing was changed.'
        setAppState((current) => (current.screen === 'studio' ? reportEditError(current, message) : current))
      },
    )
  }

  /**
   * Ask the assistant for an edit.
   *
   * The reply is only ever a proposal. It is validated by the domain the same
   * way a hand-made one is, and it is previewed rather than applied — so even a
   * server that lied, or a provider that was talked into something, cannot
   * change a single frame without the user pressing Accept.
   */
  function sendConversationMessage(message: string, context: IntentContextInput): void {
    if (appState.screen !== 'studio' || appState.proposal) return
    const projectId = appState.project.id
    const baseRevision = appState.editProject.revision
    const sequence = conversationSequenceRef.current + 1
    conversationSequenceRef.current = sequence
    conversationAbortRef.current?.abort()
    const controller = new AbortController()
    conversationAbortRef.current = controller

    resetExport()
    setAppState((current) => (current.screen === 'studio' ? startConversationRequest(current, message) : current))

    void requestIntent(projectId, { message, baseRevision, context }, fetch, controller.signal)
      .then((outcome) => {
        if (conversationSequenceRef.current !== sequence || controller.signal.aborted) return
        conversationAbortRef.current = null
        setAppState((current) => {
          if (current.screen !== 'studio') return current
          if (outcome.kind === 'proposal') {
            return queueEditProposal(current, outcome.operation, {
              source: 'ai',
              requestId: outcome.requestId,
              explanation: outcome.explanation,
              note: outcome.note,
            })
          }
          if (outcome.kind === 'clarification') return reportClarification(current, outcome.question)
          if (outcome.kind === 'unsupported') return reportUnsupported(current, outcome.message)
          return reportConversationError(current, outcome.message)
        })
      })
      .catch((error: unknown) => {
        if (conversationSequenceRef.current !== sequence || controller.signal.aborted) return
        conversationAbortRef.current = null
        const message = error instanceof Error && error.message ? error.message : CONVERSATION_ERROR
        setAppState((current) => (current.screen === 'studio' ? reportConversationError(current, message) : current))
      })
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
            .then(async (summary) => ({ summary, opened: await loadProject(summary.id, fetch, controller.signal) }))
            .then(({ summary, opened }) => {
              const project = { ...summary, editProject: opened.project }
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
                    editProject: project.editProject,
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
            // Released here rather than inside then/catch, because both of those
            // return early when the request was abandoned. Releasing only on the
            // paths that ran to completion left the flag stuck on after any
            // cancellation, and Home then ignored every later click until the
            // page was reloaded.
            .finally(() => {
              if (libraryAbortRef.current !== controller) return
              libraryInFlightRef.current = false
              libraryAbortRef.current = null
            })
            .then((project) => {
              if (transitionSequence !== transitionSequenceRef.current || controller.signal.aborted) return
              transitionView(() => {
                if (transitionSequence !== transitionSequenceRef.current) return
                flushSync(() => {
                  setAppState((current) => current.screen === 'home' ? openLocalProject(current, {
                    id: project.id,
                    name: project.originalFilename,
                    mediaUrl: project.mediaUrl,
                    editProject: project.project,
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
              setIsOpeningRecent(false)
              setLibraryError(error instanceof Error ? error.message : 'We could not load your local projects. Try again.')
            })
        }}
      />
    )
  }

  const hasPendingProposal = appState.proposal !== null
  const undoDisabledReason = hasPendingProposal
    ? 'Accept or reject the pending proposal before undoing accepted edits.'
    : canUndoProject(appState)
      ? null
      : 'Nothing to undo yet.'
  const redoDisabledReason = hasPendingProposal
    ? 'Accept or reject the pending proposal before redoing accepted edits.'
    : canRedoProject(appState)
      ? null
      : 'Nothing to redo yet.'
  const exportDisabledReason = exportState.status === 'rendering'
    ? 'Export is already in progress.'
    : hasPendingProposal
      ? 'Accept or reject the pending proposal before exporting.'
      : appState.editProject.changeSets.length === 0
        ? 'Accept at least one edit before exporting.'
        : null

  return (
    <EditorShell
      workspace={workspace}
      projectName={appState.project.name}
      saveState={saveState}
      undoDisabledReason={undoDisabledReason}
      redoDisabledReason={redoDisabledReason}
      exportDisabledReason={exportDisabledReason}
      isExporting={exportState.status === 'rendering'}
      onWorkspaceChange={setWorkspace}
      onBack={() => {
        resetExport()
        const transitionSequence = transitionSequenceRef.current + 1
        transitionSequenceRef.current = transitionSequence
        transitionView(() => {
          if (transitionSequence !== transitionSequenceRef.current) return
          flushSync(() => {
            setAppState((current) =>
              current.screen === 'studio' ? returnHome(current) : current,
            )
            setWorkspace('assist')
            saveSequenceRef.current += 1
            setSaveState('idle')
          })
        })
      }}
      onUndo={() => requestEdit((projectId) => undoProject(projectId, fetch))}
      onRedo={() => requestEdit((projectId) => redoProject(projectId, fetch))}
      onExport={() => {
        if (exportInFlightRef.current || appState.proposal || appState.editProject.changeSets.length === 0) return
        exportInFlightRef.current = true
        const controller = new AbortController()
        exportAbortRef.current = controller
        setExportState({ status: 'rendering' })
        void exportProject(appState.project.id, fetch, controller.signal)
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
    >
      <StudioScreen
      embedded
      workspace={workspace}
      onWorkspaceChange={setWorkspace}
      project={appState.project}
      proposal={appState.proposal}
      conversation={appState.conversation}
      editProject={appState.editProject}
      editError={appState.editError}
      exportState={exportState}
      saveState={saveState}
      onSendMessage={sendConversationMessage}
      onRepairProposal={(repair) => {
        setAppState((current) => (current.screen === 'studio' ? repairProposal(current, repair) : current))
      }}
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
      onTimelineEdit={(operation) => {
        if (appState.screen !== 'studio' || appState.proposal) return
        resetExport()
        // A cut travels the same server-authoritative path as an accepted
        // proposal: the browser asks, and adopts whatever comes back. It never
        // applies the cut to its own copy and hopes the server agrees.
        requestEdit((projectId) =>
          acceptChangeSet(
            projectId,
            {
              schemaVersion: 'sanverse.change-set/v1' as const,
              changeSetId: `changeset_${operation.operationId.replace(/^operation_/, '').slice(0, 32)}`,
              baseRevision: appState.editProject.revision,
              operations: [operation],
              provenance: { source: 'direct' as const, requestId: null },
              extensions: {},
            },
            fetch,
          ),
        )
      }}
      onAddCaptions={async (transcript) => {
        if (appState.screen !== 'studio' || appState.proposal) return 'Finish the pending edit first.'
        resetExport()
        try {
          const next = await addCaptionsFromTranscript(appState.project.id, transcript, fetch)
          setAppState((current) =>
            current.screen === 'studio' ? { ...current, editProject: next, editError: null } : current,
          )
          return null
        } catch (error) {
          // The server's sentence is shown as it is. It was written for a
          // non-editor, and rewording it here would make two different
          // explanations of the same failure.
          return error instanceof Error && error.message ? error.message : 'Captions could not be added.'
        }
      }}
      onCreateOverlay={async (operation) => {
        if (appState.screen !== 'studio' || appState.proposal) return 'Finish the pending edit first.'
        resetExport()
        try {
          // Exactly the same server-authoritative path a cut takes: the browser
          // asks for one change set and adopts whatever comes back. It never
          // applies the edit to its own copy and hopes the server agrees.
          const next = await acceptChangeSet(
            appState.project.id,
            {
              schemaVersion: 'sanverse.change-set/v1' as const,
              changeSetId: `changeset_${operation.operationId.replace(/^operation_/, '').slice(0, 32)}`,
              baseRevision: appState.editProject.revision,
              operations: [operation],
              provenance: { source: 'direct' as const, requestId: null },
              extensions: {},
            },
            fetch,
          )
          setAppState((current) =>
            current.screen === 'studio' ? { ...current, editProject: next, editError: null } : current,
          )
          return null
        } catch (error) {
          return error instanceof Error && error.message ? error.message : 'That could not be added.'
        }
      }}
      onUploadAsset={async (file) => {
        if (appState.screen !== 'studio') return 'Open a project first.'
        try {
          const { project, assetId } = await uploadProjectAsset(appState.project.id, file, fetch)
          setAppState((current) =>
            current.screen === 'studio' ? { ...current, editProject: project, editError: null } : current,
          )
          const asset = project.assets.find((candidate) => candidate.assetId === assetId)
          // The server said the upload worked, so an asset it did not return
          // would mean the two disagree - reported rather than guessed at.
          return asset ?? 'That file was added but could not be read back.'
        } catch (error) {
          return error instanceof Error && error.message ? error.message : 'That file could not be added.'
        }
      }}
      assetUrl={(assetId) =>
        appState.screen === 'studio' ? projectAssetUrl(appState.project.id, assetId) : ''
      }
      onAcceptProposal={() => {
        if (appState.screen !== 'studio' || !appState.proposal) return
        const changeSet = buildChangeSet(appState.proposal, appState.editProject.revision)
        requestEdit((projectId) => acceptChangeSet(projectId, changeSet, fetch))
      }}
      onUndo={() => {
        requestEdit((projectId) => undoProject(projectId, fetch))
      }}
      onRedo={() => {
        requestEdit((projectId) => redoProject(projectId, fetch))
      }}
      onExport={() => {
        if (exportInFlightRef.current || appState.proposal || appState.editProject.changeSets.length === 0) return
        exportInFlightRef.current = true
        const controller = new AbortController()
        exportAbortRef.current = controller
        setExportState({ status: 'rendering' })
        void exportProject(appState.project.id, fetch, controller.signal)
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
      onBack={() => {}}
    />
    </EditorShell>
  )
}
