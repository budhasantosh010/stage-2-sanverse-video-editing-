import { useEffect, useRef, useState } from 'react'
import type { AddNameplateAction } from '@sanverse/edit-domain'
import type { EditHistory } from '@sanverse/edit-domain/history'
import type { StudioState } from '../../app/app-state'
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
  proposal: AddNameplateAction | null
  history: EditHistory
  editError: string | null
  onProposal(proposal: AddNameplateAction): void
  onDiscardProposal(): void
  onAcceptProposal(): void
  onUndo(): void
  onRedo(): void
  exportState: ProjectExportState
  onExport(): void
  onBack(): void
}

const UNAVAILABLE_DESCRIPTION = 'studio-unavailable-description'
const EXPORT_DESCRIPTION = 'studio-export-description'
const KEYBOARD_POINT_STEP = 0.05

function createActionId() {
  if (typeof globalThis.crypto?.randomUUID === 'function') return globalThis.crypto.randomUUID()
  const bytes = new Uint32Array(4)
  globalThis.crypto.getRandomValues(bytes)
  return `action-${Array.from(bytes, (value) => value.toString(16).padStart(8, '0')).join('')}`
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
  history,
  editError,
  onProposal,
  onDiscardProposal,
  onAcceptProposal,
  onUndo,
  onRedo,
  exportState,
  onExport,
  onBack,
}: StudioScreenProps) {
  const draftRequest = project.draftRequest.trim()
  const [hasPreviewError, setHasPreviewError] = useState(false)
  const [isPointMode, setIsPointMode] = useState(false)
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
    if (hasVideoFrameCallback) {
      requestNextVideoFrame()
    } else {
      video.addEventListener('loadedmetadata', refreshPlayhead)
      video.addEventListener('timeupdate', refreshPlayhead)
      video.addEventListener('seeked', refreshPlayhead)
    }

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
      if (!hasVideoFrameCallback) {
        video.removeEventListener('loadedmetadata', refreshPlayhead)
        video.removeEventListener('timeupdate', refreshPlayhead)
        video.removeEventListener('seeked', refreshPlayhead)
      }
    }
  }, [])

  const video = videoRef.current
  const markerPosition = pointTarget && video ? projectPointOntoVideoElement(pointTarget, video) : null
  const draftPosition = isPointMode && video ? projectPointOntoVideoElement(draftPoint, video) : null
  const videoContentLayerStyle = video ? getVideoContentLayerStyle(video) : null
  const previewActions = proposal ? [...history.accepted, proposal] : history.accepted
  const isRendering = exportState.status === 'rendering'
  const canExport = history.accepted.length > 0 && !proposal && !isRendering

  function cancelPointMode() {
    pointModeButtonRef.current?.focus()
    setIsPointMode(false)
    setPointError(null)
  }

  function enterPointMode() {
    videoRef.current?.pause()
    setDraftPoint({ x: 0.5, y: 0.5 })
    setPointError(null)
    setIsPointMode(true)
  }

  function completePointCapture(target: CapturedPointTarget) {
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
                  style={videoContentLayerStyle}
                >
                  {previewActions.map((action) => (
                    <NameplateOverlay
                      key={action.actionId}
                      action={action}
                      currentTimeMs={playheadMs}
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
            <p id="point-mode-guidance" role="status" aria-live="polite">
              {isPointMode
                ? 'Click or use Arrow keys to place the cursor. Press Enter to choose or Escape to cancel.'
                : pointTarget
                  ? `Here · ${formatPointTargetTime(pointTarget.timeMs)}`
                  : 'Pause anywhere, then choose Point to mark an exact place.'}
            </p>
          </div>
          <NameplateComposer
            target={pointTarget}
            createActionId={createActionId}
            onProposal={onProposal}
          />
          {pointError ? <p role="alert" className="studio-screen__point-error">{pointError}</p> : null}
          {hasPreviewError ? (
            <p role="alert">
              This browser could not preview this MP4. Try another video, or go back to Home
              to choose one.
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
                <strong>{proposal.primaryText}</strong>
                {proposal.secondaryText ? <span>{proposal.secondaryText}</span> : null}
                <small>
                  Here · {formatPointTargetTime(proposal.startMs)} ·{' '}
                  {formatDuration(proposal.durationMs)}
                </small>
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
            {history.accepted.length > 0 ? (
              <ol className="studio-screen__history-list">
                {history.accepted.map((action) => (
                  <li key={action.actionId}>{action.primaryText}</li>
                ))}
              </ol>
            ) : (
              <p className="studio-screen__empty-copy">No accepted edits.</p>
            )}
            <div className="studio-screen__history-actions">
              <button
                type="button"
                aria-label="Undo edit"
                disabled={Boolean(proposal) || history.accepted.length === 0}
                onClick={onUndo}
              >
                Undo
              </button>
              <button
                type="button"
                aria-label="Redo edit"
                disabled={Boolean(proposal) || history.redoStack.length === 0}
                onClick={onRedo}
              >
                Redo
              </button>
            </div>
          </section>

          <section className="studio-screen__export-result" aria-labelledby="studio-export-label">
            <h3 id="studio-export-label">Export</h3>
            <p id={EXPORT_DESCRIPTION} className="studio-screen__empty-copy">
              {history.accepted.length === 0
                ? 'Accept at least one edit before exporting.'
                : proposal
                  ? 'Accept or discard the pending proposal before exporting.'
                  : 'Your accepted edits are ready to render.'}
            </p>
            {exportState.status === 'rendering' ? (
              <p className="studio-screen__export-progress" role="status" aria-label="Export status">Rendering and verifying your MP4…</p>
            ) : null}
            {exportState.status === 'error' ? <p className="studio-screen__export-error" role="alert">{exportState.message}</p> : null}
            {exportState.status === 'ready' ? (
              <div className="studio-screen__export-ready" role="status" aria-label="Export status">
                <strong>Export ready</strong>
                <span>{exportState.result.width} × {exportState.result.height} · {Math.round(exportState.result.durationMs / 1000)}s</span>
                <a href={exportState.result.mediaUrl} download="sanverse-edited.mp4">Download MP4</a>
              </div>
            ) : null}
          </section>

          <div className="studio-screen__chat">
            <label htmlFor="studio-chat">Chat</label>
            <textarea
              id="studio-chat"
              rows={3}
              disabled
              aria-label="Chat unavailable"
              aria-describedby={UNAVAILABLE_DESCRIPTION}
              placeholder="Chat is unavailable in this preview."
            />
            <button
              type="button"
              disabled
              aria-label="Send unavailable"
              aria-describedby={UNAVAILABLE_DESCRIPTION}
            >
              Send
            </button>
          </div>

          <p id={UNAVAILABLE_DESCRIPTION} className="studio-screen__availability-note">
            Chat is not available yet.
          </p>
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
