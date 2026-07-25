import type { ComponentProps } from 'react'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { HomeScreen } from './HomeScreen'

afterEach(cleanup)

function renderHome(overrides: Partial<ComponentProps<typeof HomeScreen>> = {}) {
  const props: ComponentProps<typeof HomeScreen> = {
    draftRequest: '',
    isStarting: false,
    startError: '',
    recentProjects: [],
    isOpeningRecent: false,
    onDraftRequestChange: vi.fn(),
    onStartProject: vi.fn(),
    onOpenRecentProject: vi.fn(),
    ...overrides,
  }

  render(<HomeScreen {...props} />)

  return props
}

describe('HomeScreen', () => {
  it('gives the user one plain starting question', () => {
    renderHome()

    expect(
      screen.getByRole('heading', { level: 1, name: /what do you want to edit today/i }),
    ).toBeInTheDocument()
  })

  it('exposes a controlled prompt and reports changes to its parent', async () => {
    const user = userEvent.setup()
    const onDraftRequestChange = vi.fn()
    renderHome({ draftRequest: 'Make the opening clearer', onDraftRequestChange })

    const prompt = screen.getByRole('textbox', { name: /describe what you want to change/i })
    expect(prompt).toHaveValue('Make the opening clearer')

    await user.type(prompt, '!')

    expect(onDraftRequestChange).toHaveBeenCalledWith('Make the opening clearer!')
  })

  it('does not expose advanced editing controls on Home', () => {
    renderHome()

    for (const advancedControl of [
      /timeline/i,
      /effects/i,
      /export/i,
      /canvas/i,
      /editing history/i,
      /studio/i,
    ]) {
      expect(screen.queryByText(advancedControl)).not.toBeInTheDocument()
      expect(screen.queryByRole('button', { name: advancedControl })).not.toBeInTheDocument()
    }
  })

  it('provides a real MP4 file input through the Choose video action', () => {
    renderHome()

    const input = screen.getByLabelText(/choose video/i)
    expect(input).toHaveAttribute('type', 'file')
    expect(input).toHaveAttribute('accept', 'video/mp4,.mp4')
  })

  it('starts a project exactly once when a valid MP4 is selected', async () => {
    const user = userEvent.setup()
    const onStartProject = vi.fn()
    renderHome({ onStartProject })
    const file = new File(['video'], 'cleaned.mp4', { type: 'video/mp4' })

    await user.upload(screen.getByLabelText(/choose video/i), file)

    expect(onStartProject).toHaveBeenCalledOnce()
    expect(onStartProject).toHaveBeenCalledWith(file)
  })

  it('starts a project exactly once when a valid MP4 is dropped', () => {
    const onStartProject = vi.fn()
    renderHome({ onStartProject })
    const file = new File(['video'], 'cleaned.mp4', { type: 'video/mp4' })
    const dropZone = screen.getByTestId('video-drop-zone')

    fireEvent.dragOver(dropZone, { dataTransfer: { files: [file] } })
    fireEvent.drop(dropZone, { dataTransfer: { files: [file] } })

    expect(onStartProject).toHaveBeenCalledOnce()
    expect(onStartProject).toHaveBeenCalledWith(file)
    expect(dropZone).not.toHaveAttribute('data-dragging', 'true')
  })

  it('shows an accessible error and does not start for an invalid file', async () => {
    const user = userEvent.setup({ applyAccept: false })
    const onStartProject = vi.fn()
    renderHome({ onStartProject })
    const file = new File(['notes'], 'notes.txt', { type: 'text/plain' })

    await user.upload(screen.getByLabelText(/choose video/i), file)

    expect(screen.getByRole('alert')).toHaveTextContent(/choose an mp4 video/i)
    expect(onStartProject).not.toHaveBeenCalled()
  })

  it('clears a previous file error after a valid selection', async () => {
    const user = userEvent.setup({ applyAccept: false })
    const onStartProject = vi.fn()
    renderHome({ onStartProject })
    const input = screen.getByLabelText(/choose video/i)

    await user.upload(input, new File(['notes'], 'notes.txt', { type: 'text/plain' }))
    expect(screen.getByRole('alert')).toBeInTheDocument()

    await user.upload(input, new File(['video'], 'cleaned.mp4', { type: 'video/mp4' }))

    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    expect(onStartProject).toHaveBeenCalledOnce()
  })

  it('states honestly that there are no recent projects', () => {
    renderHome()

    expect(screen.getByRole('heading', { name: /recent projects/i })).toBeInTheDocument()
    expect(screen.getByText(/no recent projects yet/i)).toBeInTheDocument()
  })

  it('opens a selected recent local project', async () => {
    const user = userEvent.setup()
    const onOpenRecentProject = vi.fn()
    const project = {
      id: 'project_1234567890abcdef', originalFilename: 'owner.mp4', createdAt: '2026-07-14T00:00:00.000Z',
      sizeBytes: 24, sha256: 'a'.repeat(64), mediaUrl: '/api/projects/project_1234567890abcdef/media',
    }
    renderHome({ recentProjects: [project], onOpenRecentProject })

    await user.click(screen.getByRole('button', { name: /open owner\.mp4/i }))

    expect(onOpenRecentProject).toHaveBeenCalledWith(project)
    expect(screen.queryByText(/no recent projects yet/i)).not.toBeInTheDocument()
  })

  it('shows import progress, disables another selection, and exposes a recoverable failure', () => {
    renderHome({ isStarting: true, startError: 'The video could not be imported. Try again.' })

    expect(screen.getByRole('status')).toHaveTextContent(/importing video/i)
    expect(screen.getByLabelText(/choose video/i)).toBeDisabled()
    expect(screen.getByRole('alert')).toHaveTextContent(/try again/i)
  })
})
