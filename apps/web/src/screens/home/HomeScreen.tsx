import { useState, type ChangeEvent, type DragEvent } from 'react'

import { validateLocalVideo } from '../../features/local-media/local-media'
import type { RecentProject } from '../../features/project-library/project-library'
import './HomeScreen.css'

export type HomeScreenProps = {
  draftRequest: string
  isStarting: boolean
  startError: string
  recentProjects: readonly RecentProject[]
  isOpeningRecent: boolean
  onDraftRequestChange(value: string): void
  onStartProject(file: File): void
  onOpenRecentProject(project: RecentProject): void
}

const MP4_ERROR = 'Choose an MP4 video.'

export function HomeScreen({
  draftRequest,
  isStarting,
  startError,
  recentProjects,
  isOpeningRecent,
  onDraftRequestChange,
  onStartProject,
  onOpenRecentProject,
}: HomeScreenProps) {
  const [isDragging, setIsDragging] = useState(false)
  const [fileError, setFileError] = useState('')

  function startWithFile(file: File): void {
    if (isStarting || isOpeningRecent) return
    try {
      validateLocalVideo(file)
      setFileError('')
      onStartProject(file)
    } catch {
      setFileError(MP4_ERROR)
    }
  }

  function handleFileChange(event: ChangeEvent<HTMLInputElement>): void {
    const file = event.target.files?.[0]

    if (file) {
      startWithFile(file)
    }

    event.target.value = ''
  }

  function handleDragOver(event: DragEvent<HTMLDivElement>): void {
    event.preventDefault()
    event.dataTransfer.dropEffect = 'copy'
    setIsDragging(true)
  }

  function handleDragLeave(event: DragEvent<HTMLDivElement>): void {
    event.preventDefault()

    if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
      setIsDragging(false)
    }
  }

  function handleDrop(event: DragEvent<HTMLDivElement>): void {
    event.preventDefault()
    setIsDragging(false)

    const file = event.dataTransfer.files[0]
    if (file) {
      startWithFile(file)
    }
  }

  return (
    <main className="home-screen">
      <a className="skip-link" href="#home-primary">Skip to main content</a>
      <header className="home-screen__topbar" aria-label="Sanverse home">
        <span className="home-screen__wordmark">Sanverse</span>
        <span className="home-screen__status">
          <span className="home-screen__status-dot" aria-hidden="true" />
          Local workspace
        </span>
      </header>

      <section id="home-primary" className="home-screen__intro" aria-labelledby="home-title" tabIndex={-1}>
        <p className="home-screen__eyebrow">Start a new project</p>
        <h1 id="home-title">What do you want to edit today?</h1>
        <p className="home-screen__lead">
          Describe the result you have in mind, then choose your cleaned video.
        </p>

        <div className="home-screen__composer">
          <label className="home-screen__prompt-label" htmlFor="draft-request">
            Describe what you want to change
          </label>
          <textarea
            id="draft-request"
            className="home-screen__prompt"
            value={draftRequest}
            onChange={(event) => onDraftRequestChange(event.target.value)}
            placeholder="For example: Make the opening tighter and add my name when I first appear."
            rows={3}
          />

          <div
            className="home-screen__drop-zone"
            data-testid="video-drop-zone"
            data-dragging={isDragging ? 'true' : undefined}
            onDragEnter={handleDragOver}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
          >
            <div>
              <p className="home-screen__drop-title">Drop your MP4 here</p>
              <p className="home-screen__drop-note">Your video stays on this device.</p>
            </div>

            <label className="home-screen__choose-button">
              {isStarting ? 'Importing…' : 'Choose video'}
              <input
                className="home-screen__file-input"
                type="file"
                aria-label="Choose video"
                accept="video/mp4,.mp4"
                disabled={isStarting || isOpeningRecent}
                onChange={handleFileChange}
              />
            </label>
          </div>

          {isStarting ? (
            <p className="home-screen__progress" role="status" aria-live="polite">
              Importing video securely…
            </p>
          ) : null}

          {fileError || startError ? (
            <p className="home-screen__error" role="alert">
              {fileError || startError}
            </p>
          ) : null}
        </div>
      </section>

      <section className="home-screen__recent" aria-labelledby="recent-projects-title">
        <div>
          <p className="home-screen__section-index">01</p>
          <h2 id="recent-projects-title">Recent projects</h2>
        </div>
        {recentProjects.length === 0 ? (
          <p className="home-screen__empty">No recent projects yet.</p>
        ) : (
          <ul className="home-screen__recent-list">
            {recentProjects.map((project) => (
              <li key={project.id}>
                <div>
                  <strong>{project.originalFilename}</strong>
                  <span>{new Date(project.createdAt).toLocaleDateString()}</span>
                </div>
                <button type="button" disabled={isOpeningRecent} onClick={() => onOpenRecentProject(project)}>
                  {isOpeningRecent ? 'Opening…' : `Open ${project.originalFilename}`}
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  )
}
