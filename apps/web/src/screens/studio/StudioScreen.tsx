import { useEffect, useRef, useState } from 'react'
import type { AddNameplateOperation, EditProject } from '@sanverse/edit-domain'
import {
  TICKS_PER_MILLISECOND as TICKS_PER_MS,
  compositionDuration,
  effectiveComposition,
  toMilliseconds,
} from '@sanverse/edit-domain'
import { proposalPlacement } from '../../app/app-state'
import type { ConversationState, PendingProposal, ProposalRepair, StudioState } from '../../app/app-state'
import { ChatComposer } from '../../features/conversation/ChatComposer'
import type { IntentContextInput } from '../../features/conversation/conversation-client'
import { NameplateRepair } from '../../features/proposal-repair/NameplateRepair'
import { describeOperation } from '../../features/history/describe-operation'
import {
  compilePreviewPlan,
  millisecondsToTicks,
  nameplateCssVariables,
  visibleNodes,
  withPendingProposal,
} from '../../features/render-plan/render-plan-preview'
import type { ProjectExportState } from '../../features/project-export/project-export'
import { NameplateComposer } from '../../features/nameplate/NameplateComposer'
import { NameplateOverlay } from '../../features/nameplate/NameplateOverlay'
import {
  capturePointTarget,
  formatPointTargetTime,
  getRenderedVideoContentBox,
  type CapturedPointTarget,
} from '../../features/point-target/point-target'
import './StudioScreen.css'

export type StudioScreenProps = {
  project: StudioState['project']
  proposal: PendingProposal | null
  conversation: ConversationState
  editProject: EditProject
  editError: string | null
  onProposal(proposal: AddNameplateOperation): void
  onDiscardProposal(): void
  onAcceptProposal(): void
  onRepairProposal(repair: ProposalRepair): void
  onSendMessage(message: string, context: IntentContextInput): void
  onUndo(): void
  onRedo(): void
  exportState: ProjectExportState
  saveState: 'idle' | 'saving' | 'saved' | 'error'
  onExport(): void
  onBack(): void
}

const EXPORT_DESCRIPTION = 'studio-export-description'
const KEYBOARD_POINT_STEP = 0.05

function createOperationId() {
  const bytes = new Uint32Array(4)
  globalThis.crypto.getRandomValues(bytes)
  return `operation_${Array.from(bytes, (value) => value.toString(16).padStart(8, '0')).join('')}`.slice(0, 42)
}

type NormalizedPoint = Pick<CapturedPointTarget, 'x' | 'y'>

function clampNormalized(value: number) {
  return Math.min(1, Math.max(0, value))
}

function roundCssPercentage(value: number) {
  return Number(value.toFixed(6))
}

function formatDuration(durationMs: number) {
  const seconds = durationMs / 1_000
  const value = Number.isInteger(seconds)
    ? String(seconds)
    : seconds.toFixed(3).replace(/0+$/, '').replace(/\.$/, '')
  return `${value} ${seconds === 1 ? 'second' : 'seconds'}`
}

function projectPointOntoVideoElement(point: NormalizedPoint, video: HTMLVideoElement) {
  const elementBox = video.getBoundingClientRect()
  const contentBox = getRenderedVideoContentBox(elementBox, video.videoWidth, video.videoHeight)
  if (!contentBox) return null

  return {
    left: roundCssPercentage(
      ((contentBox.left - elementBox.left + point.x * contentBox.width) / elementBox.width) *
        100,
    ),
    top: roundCssPercentage(
      ((contentBox.top - elementBox.top + point.y * contentBox.height) / elementBox.height) * 100,
    ),
  }
}

function getVideoContentLayerStyle(video: HTMLVideoElement) {
  const elementBox = video.getBoundingClientRect()
  const contentBox = getRenderedVideoContentBox(elementBox, video.videoWidth, video.videoHeight)
  if (!contentBox) return null

  return {
    left: `${roundCssPercentage(((contentBox.left - elementBox.left) / elementBox.width) * 100)}%`,
    top: `${roundCssPercentage(((contentBox.top - elementBox.top) / elementBox.height) * 100)}%`,
    width: `${roundCssPercentage((contentBox.width / elementBox.width) * 100)}%`,
    height: `${roundCssPercentage((contentBox.height / elementBox.height) * 100)}%`,
  }
}

export function StudioScreen({
  project,
  proposal,
  conversation,
  editProject,
  editError,
  onProposal,
  onDiscardProposal,
  onAcceptProposal,
  onRepairProposal,
  onSendMessage,
  onUndo,
  onRedo,
  exportState,
  saveState,
  onExport,
  onBack,
}: StudioScreenProps) {
  const draftRequest = project.draftRequest.trim()
  const [hasPreviewError, setHasPreviewError] = useState(false)
  const [isPointMode, setIsPointMode] = useState(false)
  // True when Point is being used to move an existing proposal rather than to
  // start a new one, so capturing a point repairs instead of replacing.
  const [isMovingProposalPoint, setIsMovingProposalPoint] = useState(false)
  const [pointTarget, setPointTarget] = useState<CapturedPointTarget | null>(null)
  const [draftPoint, setDraftPoint] = useState<NormalizedPoint>({ x: 0.5, y: 0.5 })
  const [, setVideoLayoutRevision] = useState(0)
  const [pointError, setPointError] = useState<string | null>(null)
  const [playheadMs, setPlayheadMs] = useState(0)
  const [proposalResult, setProposalResult] = useState<string | null>(null)
  const videoRef = useRef<HTMLVideoElement>(null)
  const pointModeButtonRef = useRef<HTMLButtonElement>(null)
  const pointLayerRef = useRef<HTMLButtonElement>(null)
  const proposalSummaryRef = useRef<HTMLDivElement>(null)
  const proposalResultRef = useRef<HTMLParagraphElement>(null)
  const exportResultRef = useRef<HTMLElement>(null)
  const pendingProposalResolutionRef = useRef<'accepted' | 'discarded' | null>(null)

  useEffect(() => {
    if (isPointMode) pointLayerRef.current?.focus()
  }, [isPointMode])

  useEffect(() => {
    if (proposal) proposalSummaryRef.current?.focus()
  }, [proposal])

  useEffect(() => {
    if (proposal) {
      setProposalResult(null)
      return
    }

    const resolution = pendingProposalResolutionRef.current
    if (!resolution) return
    pendingProposalResolutionRef.current = null
    setProposalResult(
      resolution === 'accepted'
        ? 'Proposal accepted.'
        : 'Proposal discarded. Accepted history was not changed.',
    )
  }, [proposal])

  useEffect(() => {
    if (proposalResult) proposalResultRef.current?.focus()
  }, [proposalResult])

  // Export is at the top of the screen and its result is at the bottom, so
  // pressing Export used to look like it had done nothing at all. The result
  // is brought to the user instead of the user having to go looking for it.
  useEffect(() => {
    if (exportState.status === 'idle') return
    const target = exportResultRef.current
    if (!target) return
    target.scrollIntoView?.({ block: 'nearest' })
    if (exportState.status === 'ready' || exportState.status === 'error') target.focus?.()
  }, [exportState.status])

  useEffect(() => {
    if (editError) pendingProposalResolutionRef.current = null
  }, [editError])

  useEffect(() => {
    const video = videoRef.current
    if (!video) return

    const refreshProjection = () => setVideoLayoutRevision((revision) => revision + 1)
    const updatePlayhead = (currentTime: number) => {
      setPlayheadMs(
        Number.isFinite(currentTime) && currentTime >= 0 ? Math.round(currentTime * 1000) : -1,
      )
    }
    const refreshPlayhead = () => updatePlayhead(video.currentTime)
    const hasVideoFrameCallback = typeof video.requestVideoFrameCallback === 'function'
    let videoFrameCallbackId: number | null = null
    let stopped = false
    const requestNextVideoFrame = () => {
      if (typeof video.requestVideoFrameCallback !== 'function') return
      videoFrameCallbackId = video.requestVideoFrameCallback((_now, metadata) => {
        if (stopped) return
        updatePlayhead(metadata.mediaTime)
        requestNextVideoFrame()
      })
    }
    const observer =
      typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(refreshProjection)

    observer?.observe(video)
    video.addEventListener('loadedmetadata', refreshProjection)
    video.addEventListener('resize', refreshProjection)

    // Media events are always listened to, even when frame callbacks are
    // available. A browser can expose requestVideoFrameCallback and still never
    // fire it — a background tab, a decoder that never presents a frame — and
    // with no fallback the preview would silently show nothing at all while
    // looking perfectly healthy. Frame callbacks give exact timing when they
    // work; these events guarantee the preview is never simply blank.
    video.addEventListener('loadedmetadata', refreshPlayhead)
    video.addEventListener('timeupdate', refreshPlayhead)
    video.addEventListener('seeked', refreshPlayhead)
    if (hasVideoFrameCallback) requestNextVideoFrame()

    return () => {
      stopped = true
      if (
        videoFrameCallbackId !== null &&
        typeof video.cancelVideoFrameCallback === 'function'
      ) {
        video.cancelVideoFrameCallback(videoFrameCallbackId)
      }
      observer?.disconnect()
      video.removeEventListener('loadedmetadata', refreshProjection)
      video.removeEventListener('resize', refreshProjection)
      video.removeEventListener('loadedmetadata', refreshPlayhead)
      video.removeEventListener('timeupdate', refreshPlayhead)
      video.removeEventListener('seeked', refreshPlayhead)
    }
  }, [])

  const video = videoRef.current
  const markerPosition = pointTarget && video ? projectPointOntoVideoElement(pointTarget, video) : null
  const draftPosition = isPointMode && video ? projectPointOntoVideoElement(draftPoint, video) : null
  const videoContentLayerStyle = video ? getVideoContentLayerStyle(video) : null

  // The preview is compiled from the project by the same compiler the exporter
  // uses. A pending proposal is layered on top without touching saved state.
  // The footage as it now stands: what was imported, plus every accepted cut.
  const composition = effectiveComposition(editProject)
  const previewPlan = compilePreviewPlan(
    proposal ? withPendingProposal(editProject, proposal.operation) : editProject,
  )
  const previewNodes = previewPlan ? visibleNodes(previewPlan, millisecondsToTicks(playheadMs)) : []
  const contentBox = video ? getRenderedVideoContentBox(video.getBoundingClientRect(), video.videoWidth, video.videoHeight) : null
  const previewScale = contentBox && composition.width > 0 ? contentBox.width / composition.width : 0
  const nameplateVariables = nameplateCssVariables(composition.width, composition.height, previewScale)

  const acceptedRecords = editProject.changeSets
  const acceptedCount = acceptedRecords.length
  const firstClipId = composition.tracks[0]?.clips[0]?.clipId ?? ''
  const isRendering = exportState.status === 'rendering'
  const canExport = acceptedCount > 0 && !proposal && !isRendering

  const compositionDurationTicks = compositionDuration(composition).ticks

  // Where the pending proposal actually lands on screen. After a cut this is
  // not a number stored on the proposal; it has to be worked out from the
  // footage that survived, and every place that shows a time uses this one
  // value so the panel and the summary can never disagree.
  const proposalPlaced = proposal ? proposalPlacement(editProject, proposal.operation) : null
  const proposalStartMs = proposalPlaced ? proposalPlaced.startTicks / TICKS_PER_MS : 0
  const proposalDurationMs = proposalPlaced ? proposalPlaced.durationTicks / TICKS_PER_MS : 0

  /**
   * Everything the assistant is allowed to know about what the user is doing.
   * Built here because this screen is the only place that knows where the
   * playhead is and whether the user pointed.
   */
  function buildIntentContext(): IntentContextInput {
    return {
      clipId: firstClipId,
      sampledClipTimeTicks: pointTarget ? millisecondsToTicks(pointTarget.timeMs) : null,
      point: pointTarget ? { x: pointTarget.x, y: pointTarget.y } : null,
      playheadTicks: millisecondsToTicks(Math.max(0, playheadMs)),
      compositionDurationTicks,
      compositionWidth: composition.width,
      compositionHeight: composition.height,
    }
  }

  function cancelPointMode() {
    pointModeButtonRef.current?.focus()
    setIsPointMode(false)
    setIsMovingProposalPoint(false)
    setPointError(null)
  }

  function enterPointMode() {
    videoRef.current?.pause()
    setDraftPoint({ x: 0.5, y: 0.5 })
    setPointError(null)
    setIsPointMode(true)
  }

  function startMovingProposalPoint() {
    if (isMovingProposalPoint) {
      cancelPointMode()
      return
    }
    setIsMovingProposalPoint(true)
    enterPointMode()
  }

  function completePointCapture(target: CapturedPointTarget) {
    // Moving an existing proposal keeps everything else about it. Only a fresh
    // point replaces the target and clears the pending proposal.
    if (isMovingProposalPoint && proposal) {
      onRepairProposal({ point: { x: target.x, y: target.y } })
      setIsMovingProposalPoint(false)
      setPointError(null)
      setIsPointMode(false)
      pointModeButtonRef.current?.focus()
      return
    }

    setPointTarget(target)
    if (proposal) onDiscardProposal()
    setPlayheadMs(target.timeMs)
    setPointError(null)
    setIsPointMode(false)
    pointModeButtonRef.current?.focus()
  }

  function capturePoint(clientX: number, clientY: number) {
    const video = videoRef.current
    if (!video) return

    const elementBox = video.getBoundingClientRect()
    const result = capturePointTarget({
      clientX,
      clientY,
      elementBox,
      videoWidth: video.videoWidth,
      videoHeight: video.videoHeight,
      currentTimeSeconds: video.currentTime,
    })

    if (!result.ok) {
      setPointError(result.error)
      return
    }

    completePointCapture(result.value)
  }

  function handleAcceptProposal() {
    pendingProposalResolutionRef.current = 'accepted'
    onAcceptProposal()
  }

  function handleDiscardProposal() {
    pendingProposalResolutionRef.current = 'discarded'
    onDiscardProposal()
  }

  function handlePointModeKeyDown(event: React.KeyboardEvent<HTMLElement>) {
    if (!isPointMode) return

    if (event.key === 'Escape') {
      event.preventDefault()
      cancelPointMode()
      return
    }

    if (event.target !== pointLayerRef.current) return

    const movement = {
      ArrowLeft: { x: -KEYBOARD_POINT_STEP, y: 0 },
      ArrowRight: { x: KEYBOARD_POINT_STEP, y: 0 },
      ArrowUp: { x: 0, y: -KEYBOARD_POINT_STEP },
      ArrowDown: { x: 0, y: KEYBOARD_POINT_STEP },
    }[event.key]

    if (movement) {
      event.preventDefault()
      setDraftPoint((point) => ({
        x: clampNormalized(point.x + movement.x),
        y: clampNormalized(point.y + movement.y),
      }))
      return
    }

    if (event.key === 'Enter') {
      event.preventDefault()
      const currentTimeSeconds = videoRef.current?.currentTime
      if (
        currentTimeSeconds === undefined ||
        !Number.isFinite(currentTimeSeconds) ||
        currentTimeSeconds < 0
      ) {
        setPointError('The current video time is unavailable.')
        return
      }

      completePointCapture({
        ...draftPoint,
        timeMs: Math.round(currentTimeSeconds * 1000),
      })
    }
  }

  return (
    <main className="studio-screen" onKeyDown={handlePointModeKeyDown}>
      <header className="studio-screen__topbar">
        <button className="studio-screen__back" type="button" onClick={onBack}>
          <span aria-hidden="true">←</span>
          Back to Home
        </button>

        <div className="studio-screen__project" aria-label="Selected project">
          <span className="studio-screen__project-label">Current project</span>
          <strong title={project.name}>{project.name}</strong>
        </div>

        <button
          className="studio-screen__export"
          type="button"
          disabled={!canExport}
          aria-label={isRendering ? 'Exporting video' : canExport ? 'Export video' : 'Export unavailable'}
          aria-describedby={!canExport && !isRendering ? EXPORT_DESCRIPTION : undefined}
          onClick={onExport}
        >
          {isRendering ? 'Exporting…' : 'Export'}
        </button>
      </header>

      <div className="studio-screen__workspace">
        <section className="studio-screen__canvas" aria-label="Video canvas">
          <div className="studio-screen__canvas-heading">
            <div>
              <span className="studio-screen__section-index">01</span>
              <h1>Video preview</h1>
            </div>
            <span className="studio-screen__local-badge">Local source</span>
          </div>

          <div className="studio-screen__video-frame">
            <div className="studio-screen__video-surface">
              <video
                ref={videoRef}
                className="studio-screen__video"
                controls
                preload="metadata"
                src={project.mediaUrl}
                aria-label={`Preview of ${project.name}`}
                onError={() => setHasPreviewError(true)}
              >
                Your browser does not support video playback.
              </video>

              {videoContentLayerStyle ? (
                <div
                  className="studio-screen__video-content-layer"
                  data-testid="video-content-layer"
                  style={{ ...videoContentLayerStyle, ...nameplateVariables }}
                >
                  {previewNodes.map((node) => (
                    <NameplateOverlay
                      key={node.nodeId}
                      node={node}
                      compositionWidth={composition.width}
                      compositionHeight={composition.height}
                      scale={previewScale}
                    />
                  ))}
                </div>
              ) : null}

              {markerPosition ? (
                <span
                  className="studio-screen__point-marker"
                  role="img"
                  aria-label="Selected point"
                  style={{ left: `${markerPosition.left}%`, top: `${markerPosition.top}%` }}
                />
              ) : null}

              {isPointMode ? (
                <>
                  <button
                    ref={pointLayerRef}
                    className="studio-screen__point-layer"
                    type="button"
                    aria-label="Choose a point on the visible video"
                    aria-describedby="point-mode-guidance"
                    onClick={(event) => capturePoint(event.clientX, event.clientY)}
                  />
                  {draftPosition ? (
                    <span
                      className="studio-screen__point-cursor"
                      role="img"
                      aria-label="Point cursor"
                      style={{ left: `${draftPosition.left}%`, top: `${draftPosition.top}%` }}
                    />
                  ) : null}
                </>
              ) : null}
            </div>
          </div>
          <div className="studio-screen__point-tools">
            <button
              ref={pointModeButtonRef}
              className="studio-screen__point-action"
              type="button"
              aria-label={isPointMode ? 'Cancel Point mode' : 'Enter Point mode'}
              aria-pressed={isPointMode}
              onClick={isPointMode ? cancelPointMode : enterPointMode}
            >
              {isPointMode ? 'Cancel' : 'Point'}
            </button>
            <p id="point-mode-guidance" role="status" aria-label="Point guidance" aria-live="polite">
              {isPointMode
                ? 'Click or use Arrow keys to place the cursor. Press Enter to choose or Escape to cancel.'
                : pointTarget
                  ? `Here · ${formatPointTargetTime(pointTarget.timeMs)}`
                  : 'Pause anywhere, then choose Point to mark an exact place.'}
            </p>
          </div>
          <NameplateComposer
            target={pointTarget}
            composition={composition}
            createOperationId={createOperationId}
            onProposal={onProposal}
          />
          {pointError ? <p role="alert" className="studio-screen__point-error">{pointError}</p> : null}
          {hasPreviewError ? (
            <p role="alert">
              This video could not be played. It may be unavailable right now, or in a format
              this browser cannot show. Reload to try again, or go back to Home to choose
              another video.
            </p>
          ) : null}
        </section>

        <aside className="studio-screen__conversation" aria-label="Conversation">
          <div className="studio-screen__panel-heading">
            <div>
              <span className="studio-screen__section-index">02</span>
              <h2>Conversation</h2>
            </div>
            <span className="studio-screen__unavailable-tag">Preview mode</span>
          </div>

          <section className="studio-screen__draft" aria-labelledby="studio-draft-label">
            <h3 id="studio-draft-label">Draft — not executed</h3>
            {draftRequest ? (
              <p>{draftRequest}</p>
            ) : (
              <p className="studio-screen__empty-copy">No draft request yet.</p>
            )}
          </section>

          <section className="studio-screen__proposal" aria-labelledby="studio-proposal-label">
            <h3 id="studio-proposal-label">Proposal</h3>
            {proposal ? (
              <div
                ref={proposalSummaryRef}
                className="studio-screen__proposal-summary"
                role="status"
                tabIndex={-1}
              >
                <strong>{proposal.operation.primaryText}</strong>
                {proposal.operation.secondaryText ? <span>{proposal.operation.secondaryText}</span> : null}
                <small>
                  Here · {formatPointTargetTime(proposalStartMs)} · {formatDuration(proposalDurationMs)}
                </small>
                {proposal.origin.source === 'ai' ? (
                  <span className="studio-screen__proposal-origin">Suggested by the assistant</span>
                ) : null}
                {proposal.origin.note ? (
                  <span className="studio-screen__proposal-note">{proposal.origin.note}</span>
                ) : null}
              </div>
            ) : (
              <p className="studio-screen__empty-copy">No pending proposal.</p>
            )}
            <div className="studio-screen__proposal-actions">
              <button
                type="button"
                disabled={!proposal}
                aria-label={proposal ? 'Accept proposal' : 'Accept proposal unavailable'}
                onClick={handleAcceptProposal}
              >
                Accept proposal
              </button>
              <button type="button" disabled={!proposal} onClick={handleDiscardProposal}>
                Discard proposal
              </button>
            </div>
            {editError ? <p role="alert" className="studio-screen__edit-error">{editError}</p> : null}
            {proposal ? (
              <NameplateRepair
                placedStartMs={proposalStartMs}
                proposal={proposal.operation}
                playheadMs={Math.max(0, playheadMs)}
                isMovingPoint={isMovingProposalPoint}
                onRepair={onRepairProposal}
                onMovePoint={startMovingProposalPoint}
              />
            ) : null}
          </section>

          {proposalResult ? (
            <p
              ref={proposalResultRef}
              className="studio-screen__proposal-result"
              role="status"
              aria-label="Proposal result"
              tabIndex={-1}
            >
              {proposalResult}
            </p>
          ) : null}

          <section className="studio-screen__history" aria-labelledby="studio-history-label">
            <h3 id="studio-history-label">History</h3>
            {acceptedCount > 0 ? (
              <ol className="studio-screen__history-list">
                {acceptedRecords.map((record) => (
                  <li key={record.changeSet.changeSetId}>
                    {record.changeSet.operations.map(describeOperation).join(', ')}
                    {record.blockedReason ? <span className="studio-screen__history-blocked"> · needs attention</span> : null}
                  </li>
                ))}
              </ol>
            ) : (
              <p className="studio-screen__empty-copy">No accepted edits.</p>
            )}
            <div className="studio-screen__history-actions">
              <button
                type="button"
                aria-label="Undo edit"
                disabled={Boolean(proposal) || acceptedCount === 0}
                onClick={onUndo}
              >
                Undo
              </button>
              <button
                type="button"
                aria-label="Redo edit"
                disabled={Boolean(proposal) || editProject.redoStack.length === 0}
                onClick={onRedo}
              >
                Redo
              </button>
            </div>
            {saveState === 'saving' ? <p className="studio-screen__save-status" role="status" aria-label="Project save status">Saving locally…</p> : null}
            {saveState === 'saved' ? <p className="studio-screen__save-status" role="status" aria-label="Project save status">Saved locally</p> : null}
            {saveState === 'error' ? <p className="studio-screen__save-error" role="alert">This edit is open, but it could not be saved locally.</p> : null}
          </section>

          <section
            ref={exportResultRef}
            className="studio-screen__export-result"
            aria-labelledby="studio-export-label"
            tabIndex={-1}
          >
            <h3 id="studio-export-label">Export</h3>
            <p id={EXPORT_DESCRIPTION} className="studio-screen__empty-copy">
              {acceptedCount === 0
                ? 'Accept at least one edit before exporting.'
                : proposal
                  ? 'Accept or discard the pending proposal before exporting.'
                  : 'Your accepted edits are ready to render.'}
            </p>
            {exportState.status === 'rendering' ? (
              <p className="studio-screen__export-progress" role="status" aria-label="Export status">Rendering and verifying your MP4…</p>
            ) : null}
            {exportState.status === 'error' ? (
              <div className="studio-screen__export-error" role="alert">
                <p>{exportState.message}</p>
                <button type="button" onClick={onExport}>Retry export</button>
              </div>
            ) : null}
            {exportState.status === 'ready' ? (
              <div className="studio-screen__export-ready" role="status" aria-label="Export status">
                <strong>Export ready</strong>
                <span>{exportState.result.width} × {exportState.result.height} · {Math.round(exportState.result.durationMs / 1000)}s</span>
                <a href={exportState.result.mediaUrl} download="sanverse-edited.mp4">Download MP4</a>
              </div>
            ) : null}
          </section>

          <ChatComposer
            conversation={conversation}
            canSend={!proposal}
            disabledReason={
              proposal ? 'Accept or discard the pending proposal before asking for another edit.' : null
            }
            onSend={(message) => onSendMessage(message, buildIntentContext())}
          />
        </aside>
      </div>

      <section className="studio-screen__time-strip" aria-label="Simple time strip">
        <div className="studio-screen__time-strip-heading">
          <div>
            <span className="studio-screen__section-index">03</span>
            <h2>Simple time strip</h2>
          </div>
          <p>Point targeting and text proposals available</p>
        </div>
        <div className="studio-screen__static-track" aria-hidden="true">
          <span>Source video</span>
        </div>
      </section>
    </main>
  )
}
