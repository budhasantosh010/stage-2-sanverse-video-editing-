import type { ComponentProps } from 'react'
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { StudioScreen } from './StudioScreen'

afterEach(cleanup)

function renderStudio(overrides: Partial<ComponentProps<typeof StudioScreen>> = {}) {
  const props: ComponentProps<typeof StudioScreen> = {
    project: {
      name: 'cleaned-interview.mp4',
      mediaUrl: 'blob:cleaned-interview',
      draftRequest: 'Tighten the opening pause.',
    },
    onBack: vi.fn(),
    ...overrides,
  }

  const view = render(<StudioScreen {...props} />)

  return { ...view, props }
}

describe('StudioScreen', () => {
  it('shows the selected filename and a real controlled video preview', () => {
    const { container } = renderStudio()

    expect(screen.getByText('cleaned-interview.mp4')).toBeInTheDocument()
    const video = container.querySelector('video')
    expect(video).toHaveAttribute('src', 'blob:cleaned-interview')
    expect(video).toHaveAttribute('controls')
    expect(video).not.toHaveAttribute('autoplay')
    expect(video).toHaveTextContent(/browser does not support video playback/i)
  })

  it('labels a non-empty request as a draft that has not been executed', () => {
    renderStudio()

    expect(screen.getByText(/draft — not executed/i)).toBeInTheDocument()
    expect(screen.getByText('Tighten the opening pause.')).toBeInTheDocument()
  })

  it('shows an honest prompt placeholder when no draft was supplied', () => {
    renderStudio({
      project: {
        name: 'cleaned-interview.mp4',
        mediaUrl: 'blob:cleaned-interview',
        draftRequest: '   ',
      },
    })

    expect(screen.getByText(/no draft request yet/i)).toBeInTheDocument()
  })

  it('keeps export and conversational editing controls explicitly unavailable', () => {
    renderStudio()

    const exportButton = screen.getByRole('button', { name: /export unavailable/i })
    const chat = screen.getByRole('textbox', { name: /chat unavailable/i })
    const send = screen.getByRole('button', { name: /send unavailable/i })
    const accept = screen.getByRole('button', { name: /accept proposal unavailable/i })

    expect(exportButton).toBeDisabled()
    expect(chat).toBeDisabled()
    expect(send).toBeDisabled()
    expect(accept).toBeDisabled()
    expect(exportButton).toHaveAccessibleDescription(/not available in this preview/i)
    expect(chat).toHaveAccessibleDescription(/not available in this preview/i)
  })

  it('returns Home exactly once from the Back action', async () => {
    const user = userEvent.setup()
    const onBack = vi.fn()
    renderStudio({ onBack })

    await user.click(screen.getByRole('button', { name: /back to home/i }))

    expect(onBack).toHaveBeenCalledOnce()
  })

  it('names the three primary Studio regions for assistive technology', () => {
    renderStudio()

    expect(screen.getByRole('region', { name: 'Video canvas' })).toBeInTheDocument()
    expect(screen.getByRole('complementary', { name: 'Conversation' })).toBeInTheDocument()
    expect(screen.getByRole('region', { name: 'Simple time strip' })).toBeInTheDocument()
    expect(screen.getByText(/preview only — editing unavailable/i)).toBeInTheDocument()
  })

  it('never reports that a draft or edit was executed successfully', () => {
    renderStudio()

    expect(screen.queryByText(/executed successfully/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/edit (?:was )?applied/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/export (?:is )?ready/i)).not.toBeInTheDocument()
  })
})
