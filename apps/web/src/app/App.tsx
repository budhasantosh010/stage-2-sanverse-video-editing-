import { useCallback, useEffect, useRef, useState } from 'react'
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
  type StudioState,
} from './app-state'
import {
  draftCancellationMessage,
  reconcileDetachedDraft,
} from '../features/proposal-recovery/draft-reconciliation'
import {
  CONVERSATION_ERROR,
  requestIntent,
  type IntentContextInput,
} from '../features/conversation/conversation-client'
import { uploadProject } from '../features/project-intake/project-intake'
import { exportProject, formatExportElapsed, ProjectExportTimeout, type ProjectExportState } from '../features/project-export/project-export'
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
import {
  classifySaveFailure,
  isRecoverableRefusal,
  nextSaveState,
  openedSaveState,
  saveRetryDelayMs,
  type SaveStateV1,
} from '../features/save/save-state'
import { transitionView } from '../features/view-transition/view-transition'
import { probeMediaSourceStatus } from '../features/media'
import { HomeScreen } from '../screens/home/HomeScreen'
import { StudioScreen } from '../screens/studio/StudioScreen'
import { EditorShell, type EditorWorkspace } from '../editor/EditorShell'
import { loadWorkspaceLayout, type StudioWorkspace } from '../editor/workspace'

const probeProjectMediaSource = (url: string) => probeMediaSourceStatus(url, fetch)

/**
 * Keep a pending suggestion alive across an accepted edit wherever it still
 * makes sense, and cancel only that suggestion when it does not.
 *
 * `previous` is the studio state before the new project was adopted; `adopted`
 * is the same state carrying it. The accepted project is never altered here —
 * the worst outcome is that the suggestion is dropped and the user is told why.
 */
function carryDraftForward(previous: StudioState, adopted: StudioState, nextProject: EditProject): StudioState {
  const pending = previous.proposal
  if (!pending) return adopted
  const outcome = reconcileDetachedDraft({
    draft: pending,
    baseRevision: previous.editProject.revision,
    baseProjectId: previous.project.id,
    nextProject,
  })
  if (outcome.status === 'cancelled') {
    return { ...adopted, proposal: null, editError: draftCancellationMessage(outcome.reason) }
  }
  // Unchanged, and deliberately so: carrying forward is a re-check, not a
  // rewrite. Every word the user typed and every position they chose survives.
  return { ...adopted, proposal: pending }
}

export function App() {
  const [appState, setAppState] = useState<AppState>(createInitialState)
  const activeProjectId = appState.screen === 'studio' ? appState.project.id : null
  const assetSourceUrl = useCallback(
    (assetId: string) => activeProjectId ? projectAssetUrl(activeProjectId, assetId) : '',
    [activeProjectId],
  )
  const [isStarting, setIsStarting] = useState(false)
  const [startError, setStartError] = useState('')
  const [exportState, setExportState] = useState<ProjectExportState>({ status: 'idle' })
  const [recentProjects, setRecentProjects] = useState<readonly RecentProject[]>([])
  const [libraryError, setLibraryError] = useState('')
  const [isOpeningRecent, setIsOpeningRecent] = useState(false)
  const [saveState, setSaveState] = useState<SaveStateV1>(() => openedSaveState(0))
  /** The save to run again when the user presses Try saving again, or on reconnect. */
  const pendingSaveRef = useRef<((projectId: string) => Promise<EditProject>) | null>(null)
  const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [workspace, setWorkspace] = useState<EditorWorkspace>('assist')
  const [conversationDraft, setConversationDraft] = useState('')
  const [studioWorkspace, setStudioWorkspace] = useState<StudioWorkspace>(() => {
    if (typeof window === 'undefined') return 'edit'
    return loadWorkspaceLayout(window.localStorage, { width: window.innerWidth, height: window.innerHeight }).activeWorkspace
  })
  const [assetOriginalNames, setAssetOriginalNames] = useState<Readonly<Record<string, string>>>({})
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
  const latestEditProjectRef = useRef<EditProject | null>(null)

  if (appState.screen === 'studio') latestEditProjectRef.current = appState.editProject
  else latestEditProjectRef.current = null

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

  /**
   * Start one export, or do nothing.
   *
   * `exportInFlightRef` is the single-flight guard: repeated clicks on Export
   * cannot open a second job, and the server is idempotent on
   * project + revision + render-plan version as a second line of defence.
   *
   * A timeout is kept apart from a failure on purpose. A failed export produced
   * nothing; a timed-out export is still running on the server and may still
   * succeed, so the user is offered a retry that re-attaches to the same job
   * rather than being told the export broke.
   */
  const startExport = (projectId: string) => {
    if (exportInFlightRef.current) return
    exportInFlightRef.current = true
    const controller = new AbortController()
    exportAbortRef.current = controller
    const startedAt = Date.now()
    setExportState({ status: 'rendering', phase: 'queued', jobId: null, startedAt })
    const isCurrent = () => exportAbortRef.current === controller && !controller.signal.aborted
    const settle = () => {
      exportAbortRef.current = null
      exportInFlightRef.current = false
    }
    void exportProject(projectId, fetch, controller.signal, {
      onProgress: (progress) => {
        if (!isCurrent()) return
        setExportState({ status: 'rendering', phase: progress.phase, jobId: progress.jobId, startedAt })
      },
    })
      .then((result) => {
        if (!isCurrent()) return
        settle()
        setExportState({ status: 'ready', result })
      })
      .catch((error: unknown) => {
        if (!isCurrent()) return
        settle()
        if (error instanceof ProjectExportTimeout) {
          setExportState({
            status: 'timed-out',
            jobId: error.jobId,
            elapsedMs: error.elapsedMs,
            phase: error.phase,
          })
          return
        }
        setExportState({
          status: 'error',
          message: error instanceof Error ? error.message : 'We could not export the video. Your accepted edits are still safe.',
        })
      })
  }

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
   *
   * `attempt` counts automatic retries. A failure that trying again could
   * genuinely fix — the connection dropped, the server was restarting, a write
   * did not land — is retried on its own up to three times, waiting longer each
   * time. Anything else stops immediately and says what happened, because
   * repeating it would fail identically forever and a spinner that never ends
   * is a worse lie than an error. See `features/save/save-state.ts`.
   */
  function requestEdit(run: (projectId: string) => Promise<EditProject>, attempt = 0): void {
    if (appState.screen !== 'studio') return
    const projectId = appState.project.id
    const targetRevision = appState.editProject.revision + 1
    const sequence = saveSequenceRef.current + 1
    saveSequenceRef.current = sequence
    if (retryTimerRef.current !== null) {
      clearTimeout(retryTimerRef.current)
      retryTimerRef.current = null
    }
    pendingSaveRef.current = run
    resetExport()
    setSaveState((current) => nextSaveState(
      current,
      attempt === 0 ? { kind: 'edit-started', targetRevision } : { kind: 'retry-started' },
    ))

    const request = saveQueueRef.current.catch(() => undefined).then(() => run(projectId))
    saveQueueRef.current = request.then(() => undefined, () => undefined)
    void request.then(
      (editProject) => {
        if (saveSequenceRef.current !== sequence) return
        pendingSaveRef.current = null
        setAppState((current) => {
          if (current.screen !== 'studio') return current
          const adopted = applyServerProject(current, editProject)
          // A suggestion sitting on screen was worked out against the project as
          // it was a moment ago. Now that the project has moved, decide once
          // whether it still applies — rather than finding out at the moment the
          // user presses Accept and refusing them then.
          return current.proposal ? carryDraftForward(current, adopted, editProject) : adopted
        })
        setSaveState((current) => nextSaveState(current, { kind: 'persisted', revision: editProject.revision }))
      },
      (error: unknown) => {
        if (saveSequenceRef.current !== sequence) return
        const online = typeof navigator === 'undefined' ? true : navigator.onLine !== false
        const refusal = classifySaveFailure(error, online)
        const nextAttempt = attempt + 1
        const delay = isRecoverableRefusal(refusal) ? saveRetryDelayMs(nextAttempt) : null

        if (delay !== null) {
          // Say plainly that it is trying again, rather than leaving the user
          // watching a spinner that means nothing.
          setSaveState((current) => nextSaveState(current, { kind: 'retry-scheduled' }))
          retryTimerRef.current = setTimeout(() => {
            retryTimerRef.current = null
            requestEdit(run, nextAttempt)
          }, delay)
          return
        }

        setSaveState((current) => nextSaveState(current, { kind: 'failed', refusal }))
        // A conflict is not a lost edit and must not read like one. The user's
        // accepted project is untouched; only this one change did not land.
        const message = refusal === 'SAVE_CANCELLED'
          ? null
          : error instanceof Error ? error.message : 'This edit could not be saved. Nothing was changed.'
        if (message !== null) {
          setAppState((current) => (current.screen === 'studio' ? reportEditError(current, message) : current))
        }
      },
    )
  }

  /**
   * Pick a failed save back up the moment the connection returns.
   *
   * Without this the user has to notice the wifi came back and press something.
   * They should not have to: the thing that failed is known, and it is safe to
   * run again because the server applies edits one at a time and refuses one
   * built on a revision it has moved past.
   */
  useEffect(() => {
    if (typeof window === 'undefined') return
    const onOnline = () => {
      setSaveState((current) => nextSaveState(current, { kind: 'connection-restored' }))
      const pending = pendingSaveRef.current
      if (pending) requestEdit(pending, 1)
    }
    window.addEventListener('online', onOnline)
    return () => window.removeEventListener('online', onOnline)
  })

  /** Stop a scheduled retry from firing into a screen that has gone away. */
  useEffect(() => () => {
    if (retryTimerRef.current !== null) clearTimeout(retryTimerRef.current)
  }, [])

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
                  setSaveState(openedSaveState(project.editProject.revision))
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
                  setSaveState(openedSaveState(project.project.revision))
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
  const exportStatusMessage = exportState.status === 'ready'
    ? `Export ready · ${exportState.result.width} × ${exportState.result.height}`
    : exportState.status === 'error'
      ? exportState.message
      : exportState.status === 'timed-out'
        ? `Export is still running after ${formatExportElapsed(exportState.elapsedMs)}.`
        : null
  const exportReadyUrl = exportState.status === 'ready' ? exportState.result.mediaUrl : null

  return (
    <EditorShell
      workspace={workspace}
      studioWorkspace={studioWorkspace}
      projectName={appState.project.name}
      saveState={saveState}
      onRetrySave={pendingSaveRef.current ? () => {
        const pending = pendingSaveRef.current
        if (pending) requestEdit(pending, 1)
      } : undefined}
      undoDisabledReason={undoDisabledReason}
      redoDisabledReason={redoDisabledReason}
      exportDisabledReason={exportDisabledReason}
      isExporting={exportState.status === 'rendering'}
      exportStatusMessage={exportStatusMessage}
      exportReadyUrl={exportReadyUrl}
      onWorkspaceChange={setWorkspace}
      onStudioWorkspaceChange={setStudioWorkspace}
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
            pendingSaveRef.current = null
            setSaveState(openedSaveState(0))
          })
        })
      }}
      onUndo={() => requestEdit((projectId) => undoProject(projectId, fetch))}
      onRedo={() => requestEdit((projectId) => redoProject(projectId, fetch))}
      onExport={() => {
        if (appState.proposal || appState.editProject.changeSets.length === 0) return
        startExport(appState.project.id)
      }}
    >
      <StudioScreen
      embedded
      workspace={workspace}
      studioWorkspace={studioWorkspace}
      onStudioWorkspaceChange={setStudioWorkspace}
      onWorkspaceChange={setWorkspace}
      project={appState.project}
      proposal={appState.proposal}
      conversation={appState.conversation}
      conversationDraft={conversationDraft}
      onConversationDraftChange={setConversationDraft}
      editProject={appState.editProject}
      editError={appState.editError}
      assetOriginalNames={assetOriginalNames}
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
        const currentProject = latestEditProjectRef.current
        if (!currentProject) return 'Open a project first.'
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
              baseRevision: currentProject.revision,
              operations: [operation],
              provenance: { source: 'direct' as const, requestId: null },
              extensions: {},
            },
            fetch,
          )
          latestEditProjectRef.current = next
          setAppState((current) =>
            current.screen === 'studio' ? { ...current, editProject: next, editError: null } : current,
          )
          return null
        } catch (error) {
          return error instanceof Error && error.message ? error.message : 'That could not be added.'
        }
      }}
      onApplyOperations={async (operations, changeSetId, metadata) => {
        if (appState.screen !== 'studio' || appState.proposal) return 'Finish the pending edit first.'
        const currentProject = latestEditProjectRef.current
        if (!currentProject) return 'Open a project first.'
        if (operations.length === 0) return null
        if (metadata?.expectedBaseRevision !== undefined && currentProject.revision !== metadata.expectedBaseRevision) {
          return `Project changed from revision ${metadata.expectedBaseRevision} to ${currentProject.revision}. Rebuild this Creative draft against the current project before applying it.`
        }
        resetExport()
        try {
          // ONE change set holding every operation the gesture produced. The
          // server accepts all of them or none, so an Insert that pushes four
          // clips along can never leave three moved and one behind. Creative
          // Engine acceptance uses this exact same authority with an explicit
          // revision fence and non-render lineage metadata.
          const next = await acceptChangeSet(
            appState.project.id,
            {
              schemaVersion: 'sanverse.change-set/v1' as const,
              changeSetId,
              baseRevision: currentProject.revision,
              operations: [...operations],
              provenance: metadata?.provenance ?? { source: 'direct' as const, requestId: null },
              extensions: metadata?.extensions ?? {},
            },
            fetch,
          )
          latestEditProjectRef.current = next
          setAppState((current) =>
            current.screen === 'studio' ? { ...current, editProject: next, editError: null } : current,
          )
          return null
        } catch (error) {
          return error instanceof Error && error.message ? error.message : 'That change could not be made.'
        }
      }}
      onUploadAsset={async (file) => {
        if (appState.screen !== 'studio') return 'Open a project first.'
        try {
          const { project, assetId } = await uploadProjectAsset(appState.project.id, file, fetch)
          latestEditProjectRef.current = project
          setAssetOriginalNames((current) => Object.freeze({ ...current, [assetId]: file.name }))
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
      assetUrl={assetSourceUrl}
      probeAssetSource={probeProjectMediaSource}
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
        if (appState.proposal || appState.editProject.changeSets.length === 0) return
        startExport(appState.project.id)
      }}
      onBack={() => {}}
    />
    </EditorShell>
  )
}
