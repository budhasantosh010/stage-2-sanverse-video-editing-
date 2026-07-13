import { useEffect, useRef, useState } from 'react'
import type { StudioState } from '../../app/app-state'
import {
  capturePointTarget,
  formatPointTargetTime,
  getRenderedVideoContentBox,
  type CapturedPointTarget,
} from '../../features/point-target/point-target'
import './StudioScreen.css'

export type StudioScreenProps = {
  project: StudioState['project']
  onBack(): void
}

const UNAVAILABLE_DESCRIPTION = 'studio-unavailable-description'
const KEYBOARD_POINT_STEP = 0.05

type NormalizedPoint = Pick<CapturedPointTarget, 'x' | 'y'>

function clampNormalized(value: number) {
  return Math.min(1, Math.max(0, value))
}

function roundCssPercentage(value: number) {
  return Number(value.toFixed(6))
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

export function StudioScreen({ project, onBack }: StudioScreenProps) {
  const draftRequest = project.draftRequest.trim()
  const [hasPreviewError, setHasPreviewError] = useState(false)
  const [isPointMode, setIsPointMode] = useState(false)
  const [pointTarget, setPointTarget] = useState<CapturedPointTarget | null>(null)
  const [draftPoint, setDraftPoint] = useState<NormalizedPoint>({ x: 0.5, y: 0.5 })
  const [, setVideoLayoutRevision] = useState(0)
  const [pointError, setPointError] = useState<string | null>(null)
  const videoRef = useRef<HTMLVideoElement>(null)
  const pointModeButtonRef = useRef<HTMLButtonElement>(null)
  const pointLayerRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (isPointMode) pointLayerRef.current?.focus()
  }, [isPointMode])

  useEffect(() => {
    const video = videoRef.current
    if (!video) return

    const refreshProjection = () => setVideoLayoutRevision((revision) => revision + 1)
    const observer =
      typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(refreshProjection)

    observer?.observe(video)
    video.addEventListener('loadedmetadata', refreshProjection)
    video.addEventListener('resize', refreshProjection)

    return () => {
      observer?.disconnect()
      video.removeEventListener('loadedmetadata', refreshProjection)
      video.removeEventListener('resize', refreshProjection)
    }
  }, [])

  const video = videoRef.current
  const markerPosition = pointTarget && video ? projectPointOntoVideoElement(pointTarget, video) : null
  const draftPosition = isPointMode && video ? projectPointOntoVideoElement(draftPoint, video) : null

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
          disabled
          aria-label="Export unavailable"
          aria-describedby={UNAVAILABLE_DESCRIPTION}
        >
          Export
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
            <p className="studio-screen__empty-copy">No edit proposal. Editing is unavailable.</p>
            <button
              type="button"
              disabled
              aria-label="Accept proposal unavailable"
              aria-describedby={UNAVAILABLE_DESCRIPTION}
            >
              Accept proposal
            </button>
          </section>

          <section className="studio-screen__history" aria-labelledby="studio-history-label">
            <h3 id="studio-history-label">History</h3>
            <p className="studio-screen__empty-copy">No accepted edits.</p>
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
            Editing and export are not available in this preview.
          </p>
        </aside>
      </div>

      <section className="studio-screen__time-strip" aria-label="Simple time strip">
        <div className="studio-screen__time-strip-heading">
          <div>
            <span className="studio-screen__section-index">03</span>
            <h2>Simple time strip</h2>
          </div>
          <p>Preview only — editing unavailable</p>
        </div>
        <div className="studio-screen__static-track" aria-hidden="true">
          <span>Source video</span>
        </div>
      </section>
    </main>
  )
}
