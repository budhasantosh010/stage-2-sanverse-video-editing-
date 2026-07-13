import type { ComponentProps } from 'react'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { StudioScreen } from './StudioScreen'

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

let resizeObserverCallback: ResizeObserverCallback | null = null

beforeEach(() => {
  resizeObserverCallback = null
  vi.stubGlobal(
    'ResizeObserver',
    class ResizeObserverMock {
      constructor(callback: ResizeObserverCallback) {
        resizeObserverCallback = callback
      }

      observe() {}
      unobserve() {}
      disconnect() {}
    },
  )
})

afterEach(() => {
  vi.unstubAllGlobals()
})

function prepareVideoForPointing(video: HTMLVideoElement, currentTime = 12.4) {
  Object.defineProperties(video, {
    videoWidth: { configurable: true, value: 1920 },
    videoHeight: { configurable: true, value: 1080 },
    currentTime: { configurable: true, value: currentTime, writable: true },
  })
  vi.spyOn(video, 'getBoundingClientRect').mockReturnValue({
    x: 100,
    y: 50,
    left: 100,
    top: 50,
    right: 500,
    bottom: 450,
    width: 400,
    height: 400,
    toJSON: () => ({}),
  })
}

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

  it('shows a recoverable message when the browser cannot preview the MP4', async () => {
    const user = userEvent.setup()
    const onBack = vi.fn()
    const { container } = renderStudio({ onBack })
    const video = container.querySelector('video')

    expect(video).not.toBeNull()
    fireEvent.error(video as HTMLVideoElement)

    expect(screen.getByRole('alert')).toHaveTextContent(
      /browser could not preview this mp4.*try another video.*go back/i,
    )

    await user.click(screen.getByRole('button', { name: /back to home/i }))
    expect(onBack).toHaveBeenCalledOnce()
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
    expect(exportButton).toHaveAccessibleDescription(/not available yet/i)
    expect(chat).toHaveAccessibleDescription(/not available yet/i)
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
    expect(screen.getByText(/point targeting and text proposals available/i)).toBeInTheDocument()
  })

  it('never reports that a draft or edit was executed successfully', () => {
    renderStudio()

    expect(screen.queryByText(/executed successfully/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/edit (?:was )?applied/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/export (?:is )?ready/i)).not.toBeInTheDocument()
  })

  it('offers Point mode without blocking ordinary video controls', () => {
    const { container } = renderStudio()

    expect(screen.getByRole('button', { name: /enter point mode/i })).toBeEnabled()
    expect(container.querySelector('video')).toHaveAttribute('controls')
    expect(screen.queryByRole('button', { name: /choose a point on the visible video/i })).not.toBeInTheDocument()
  })

  it('pauses playback and exposes a temporary accessible pointer layer in Point mode', async () => {
    const user = userEvent.setup()
    const { container } = renderStudio()
    const video = container.querySelector('video') as HTMLVideoElement
    const pause = vi.spyOn(video, 'pause').mockImplementation(() => undefined)

    await user.click(screen.getByRole('button', { name: /enter point mode/i }))

    expect(pause).toHaveBeenCalledOnce()
    expect(screen.getByRole('button', { name: /choose a point on the visible video/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /cancel point mode/i })).toBeEnabled()
    expect(screen.getByRole('status')).toHaveTextContent(/click or use arrow keys/i)
  })

  it('captures one point, displays its marker and time, then restores normal playback mode', async () => {
    const user = userEvent.setup()
    const { container } = renderStudio()
    const video = container.querySelector('video') as HTMLVideoElement
    vi.spyOn(video, 'pause').mockImplementation(() => undefined)
    prepareVideoForPointing(video)

    await user.click(screen.getByRole('button', { name: /enter point mode/i }))
    fireEvent.click(screen.getByRole('button', { name: /choose a point on the visible video/i }), {
      clientX: 300,
      clientY: 250,
    })

    expect(screen.getByRole('img', { name: /selected point/i })).toHaveStyle({ left: '50%', top: '50%' })
    expect(screen.getByText('Here · 00:12.400')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /choose a point on the visible video/i })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: /enter point mode/i })).toBeEnabled()
    expect(video).toHaveAttribute('controls')
  })

  it('remaps a captured normalized target when the video element changes size', async () => {
    const user = userEvent.setup()
    const { container } = renderStudio()
    const video = container.querySelector('video') as HTMLVideoElement
    vi.spyOn(video, 'pause').mockImplementation(() => undefined)
    prepareVideoForPointing(video)

    await user.click(screen.getByRole('button', { name: /enter point mode/i }))
    fireEvent.click(screen.getByRole('button', { name: /choose a point on the visible video/i }), {
      clientX: 200,
      clientY: 193.75,
    })

    const marker = screen.getByRole('img', { name: /selected point/i })
    expect(marker).toHaveStyle({ left: '25%', top: '35.9375%' })

    vi.spyOn(video, 'getBoundingClientRect').mockReturnValue({
      x: 100,
      y: 50,
      left: 100,
      top: 50,
      right: 700,
      bottom: 350,
      width: 600,
      height: 300,
      toJSON: () => ({}),
    })
    act(() => resizeObserverCallback?.([], {} as ResizeObserver))

    expect(marker).toHaveStyle({ left: '27.777778%', top: '25%' })
  })

  it('focuses a keyboard cursor, moves it in normalized steps, and captures at the current time', async () => {
    const user = userEvent.setup()
    const { container } = renderStudio()
    const video = container.querySelector('video') as HTMLVideoElement
    vi.spyOn(video, 'pause').mockImplementation(() => undefined)
    prepareVideoForPointing(video, 7.25)

    await user.click(screen.getByRole('button', { name: /enter point mode/i }))

    const pointLayer = screen.getByRole('button', { name: /choose a point on the visible video/i })
    const cursor = screen.getByRole('img', { name: /point cursor/i })
    expect(pointLayer).toHaveFocus()
    expect(cursor).toHaveStyle({ left: '50%', top: '50%' })

    await user.keyboard('{ArrowRight}{ArrowDown}{Enter}')

    expect(screen.getByRole('img', { name: /selected point/i })).toHaveStyle({
      left: '55%',
      top: '52.8125%',
    })
    expect(screen.getByText(/here .* 00:07\.250/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /enter point mode/i })).toHaveFocus()
  })

  it('rejects a click in letterboxing and keeps Point mode available for correction', async () => {
    const user = userEvent.setup()
    const { container } = renderStudio()
    const video = container.querySelector('video') as HTMLVideoElement
    vi.spyOn(video, 'pause').mockImplementation(() => undefined)
    prepareVideoForPointing(video)

    await user.click(screen.getByRole('button', { name: /enter point mode/i }))
    fireEvent.click(screen.getByRole('button', { name: /choose a point on the visible video/i }), {
      clientX: 300,
      clientY: 80,
    })

    expect(screen.getByRole('alert')).toHaveTextContent(/inside the visible video/i)
    expect(screen.getByRole('button', { name: /choose a point on the visible video/i })).toBeInTheDocument()
    expect(screen.queryByRole('img', { name: /selected point/i })).not.toBeInTheDocument()
  })

  it('cancels Point mode with Escape and returns focus to the Point mode action', async () => {
    const user = userEvent.setup()
    const { container } = renderStudio()
    const video = container.querySelector('video') as HTMLVideoElement
    vi.spyOn(video, 'pause').mockImplementation(() => undefined)

    await user.click(screen.getByRole('button', { name: /enter point mode/i }))
    await user.keyboard('{Escape}')

    const pointButton = screen.getByRole('button', { name: /enter point mode/i })
    expect(screen.queryByRole('button', { name: /choose a point on the visible video/i })).not.toBeInTheDocument()
    expect(pointButton).toHaveFocus()
  })

  it('lets the visible Cancel button keep its native Enter behavior', async () => {
    const user = userEvent.setup()
    const { container } = renderStudio()
    const video = container.querySelector('video') as HTMLVideoElement
    vi.spyOn(video, 'pause').mockImplementation(() => undefined)
    prepareVideoForPointing(video)

    await user.click(screen.getByRole('button', { name: /enter point mode/i }))
    await user.tab()

    const cancelButton = screen.getByRole('button', { name: /cancel point mode/i })
    expect(cancelButton).toHaveFocus()
    await user.keyboard('{Enter}')

    expect(screen.queryByRole('button', { name: /choose a point on the visible video/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('img', { name: /selected point/i })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: /enter point mode/i })).toHaveFocus()
  })

  it('turns a captured point into one bounded text proposal without accepting it', async () => {
    const user = userEvent.setup()
    const { container } = renderStudio()
    const video = container.querySelector('video') as HTMLVideoElement
    vi.spyOn(video, 'pause').mockImplementation(() => undefined)
    prepareVideoForPointing(video, 12.4)

    const addText = screen.getByRole('button', { name: /add text here/i })
    expect(addText).toBeDisabled()

    await user.click(screen.getByRole('button', { name: /enter point mode/i }))
    fireEvent.click(screen.getByRole('button', { name: /choose a point on the visible video/i }), {
      clientX: 300,
      clientY: 250,
    })

    expect(addText).toBeEnabled()
    await user.click(addText)
    await user.type(screen.getByRole('textbox', { name: /^main text$/i }), 'Santosh')
    await user.type(screen.getByRole('textbox', { name: /smaller line.*optional/i }), 'Founder')
    await user.click(screen.getByRole('button', { name: /create proposal/i }))

    const proposalSection = screen.getByRole('heading', { name: /^proposal$/i }).closest('section')
    expect(proposalSection).not.toBeNull()
    expect(proposalSection).toHaveTextContent(/Santosh/i)
    expect(proposalSection).toHaveTextContent(/Founder/i)
    expect(proposalSection).toHaveTextContent(/00:12\.400.*5 seconds/i)
    expect(proposalSection?.querySelector('[role="status"]')).toHaveFocus()
    expect(screen.getByRole('button', { name: /accept proposal unavailable/i })).toBeDisabled()
    expect(screen.getByText(/no accepted edits/i)).toBeInTheDocument()
  })

  it('clears an unaccepted proposal when the user captures a different point', async () => {
    const user = userEvent.setup()
    const { container } = renderStudio()
    const video = container.querySelector('video') as HTMLVideoElement
    vi.spyOn(video, 'pause').mockImplementation(() => undefined)
    prepareVideoForPointing(video, 12.4)

    await user.click(screen.getByRole('button', { name: /enter point mode/i }))
    fireEvent.click(screen.getByRole('button', { name: /choose a point on the visible video/i }), {
      clientX: 300,
      clientY: 250,
    })
    await user.click(screen.getByRole('button', { name: /add text here/i }))
    await user.type(screen.getByRole('textbox', { name: /^main text$/i }), 'Old proposal')
    await user.click(screen.getByRole('button', { name: /create proposal/i }))
    expect(screen.getByText('Old proposal')).toBeInTheDocument()

    video.currentTime = 20
    await user.click(screen.getByRole('button', { name: /enter point mode/i }))
    fireEvent.click(screen.getByRole('button', { name: /choose a point on the visible video/i }), {
      clientX: 400,
      clientY: 250,
    })

    expect(screen.queryByText('Old proposal')).not.toBeInTheDocument()
    expect(screen.getByText(/point at the video, then choose add text here/i)).toBeInTheDocument()
    expect(screen.getByText(/here.*00:20\.000/i)).toBeInTheDocument()
  })
})
