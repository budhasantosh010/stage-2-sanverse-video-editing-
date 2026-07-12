import { useState } from 'react'
import type { StudioState } from '../../app/app-state'
import './StudioScreen.css'

export type StudioScreenProps = {
  project: StudioState['project']
  onBack(): void
}

const UNAVAILABLE_DESCRIPTION = 'studio-unavailable-description'

export function StudioScreen({ project, onBack }: StudioScreenProps) {
  const draftRequest = project.draftRequest.trim()
  const [hasPreviewError, setHasPreviewError] = useState(false)

  return (
    <main className="studio-screen">
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
            <video
              className="studio-screen__video"
              controls
              preload="metadata"
              src={project.mediaUrl}
              aria-label={`Preview of ${project.name}`}
              onError={() => setHasPreviewError(true)}
            >
              Your browser does not support video playback.
            </video>
          </div>
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
