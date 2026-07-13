import { StrictMode } from 'react'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { App } from './App'

const originalCreateObjectURL = Object.getOwnPropertyDescriptor(URL, 'createObjectURL')
const originalRevokeObjectURL = Object.getOwnPropertyDescriptor(URL, 'revokeObjectURL')
const originalStartViewTransition = Object.getOwnPropertyDescriptor(
  document,
  'startViewTransition',
)

let createObjectURL: ReturnType<typeof vi.fn>
let revokeObjectURL: ReturnType<typeof vi.fn>
let fetchMock: ReturnType<typeof vi.fn>

function projectResponse(name = 'cleaned.mp4', mediaUrl = '/api/projects/project_1234567890abcdef/media') {
  const id = mediaUrl.split('/')[3]
  return new Response(JSON.stringify({ id, originalFilename: name, mediaUrl, createdAt: '2026-07-13T00:00:00.000Z', sizeBytes: 24, sha256: 'a'.repeat(64) }), { status: 201, headers: { 'content-type': 'application/json' } })
}

function exportResponse() {
  return new Response(JSON.stringify({
    id: 'export_1234567890abcdef',
    mediaUrl: '/api/projects/project_1234567890abcdef/exports/export_1234567890abcdef/media',
    sha256: 'b'.repeat(64), width: 1920, height: 1080, durationMs: 60_000, hasAudio: true,
  }), { status: 201, headers: { 'content-type': 'application/json' } })
}

function restoreUrlMethod(
  name: 'createObjectURL' | 'revokeObjectURL',
  descriptor: PropertyDescriptor | undefined,
): void {
  if (descriptor) {
    Object.defineProperty(URL, name, descriptor)
    return
  }

  Reflect.deleteProperty(URL, name)
}

beforeEach(() => {
  createObjectURL = vi.fn(() => 'blob:cleaned-video')
  revokeObjectURL = vi.fn()
  fetchMock = vi.fn().mockResolvedValue(projectResponse())
  vi.stubGlobal('fetch', fetchMock)

  Object.defineProperty(URL, 'createObjectURL', {
    configurable: true,
    value: createObjectURL,
  })
  Object.defineProperty(URL, 'revokeObjectURL', {
    configurable: true,
    value: revokeObjectURL,
  })
})

afterEach(() => {
  cleanup()
  restoreUrlMethod('createObjectURL', originalCreateObjectURL)
  restoreUrlMethod('revokeObjectURL', originalRevokeObjectURL)
  if (originalStartViewTransition) {
    Object.defineProperty(document, 'startViewTransition', originalStartViewTransition)
  } else {
    Reflect.deleteProperty(document, 'startViewTransition')
  }
  vi.unstubAllGlobals()
})

describe('App', () => {
  it('runs one Home-to-Studio-to-Home loop and releases its local video', async () => {
    const user = userEvent.setup()
    const file = new File(['video'], 'cleaned.mp4', { type: 'video/mp4' })
    const { container } = render(<App />)

    const draft = screen.getByRole('textbox', {
      name: /describe what you want to change/i,
    })
    await user.type(draft, 'Tighten the opening pause.')
    await user.upload(screen.getByLabelText(/choose video/i), file)

    expect(fetchMock).toHaveBeenCalledOnce()
    expect(createObjectURL).not.toHaveBeenCalled()
    expect(screen.getByText('cleaned.mp4')).toBeInTheDocument()
    expect(container.querySelector('video')).toHaveAttribute('src', '/api/projects/project_1234567890abcdef/media')
    expect(screen.getByText(/draft — not executed/i)).toBeInTheDocument()
    expect(screen.getByText('Tighten the opening pause.')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /back to home/i }))

    expect(
      screen.getByRole('heading', { name: /what do you want to edit today/i }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('textbox', { name: /describe what you want to change/i }),
    ).toHaveValue('')
    expect(revokeObjectURL).not.toHaveBeenCalled()
  })

  it('releases the current local video exactly once when unmounted', async () => {
    const user = userEvent.setup()
    const file = new File(['video'], 'cleaned.mp4', { type: 'video/mp4' })
    const { unmount } = render(
      <StrictMode>
        <App />
      </StrictMode>,
    )

    await user.upload(screen.getByLabelText(/choose video/i), file)
    unmount()

    expect(revokeObjectURL).not.toHaveBeenCalled()
  })

  it('keeps an invalid file on Home without allocating a local URL', async () => {
    const user = userEvent.setup({ applyAccept: false })
    render(<App />)

    await user.upload(
      screen.getByLabelText(/choose video/i),
      new File(['notes'], 'notes.txt', { type: 'text/plain' }),
    )

    expect(screen.getByRole('alert')).toHaveTextContent(/choose an mp4 video/i)
    expect(
      screen.getByRole('heading', { name: /what do you want to edit today/i }),
    ).toBeInTheDocument()
    expect(createObjectURL).not.toHaveBeenCalled()
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('allows only one project intake request at a time', async () => {
    const pendingUpdates: Array<() => void> = []
    let resolveFirst!: (value: Response) => void
    fetchMock
      .mockReset()
      .mockReturnValueOnce(new Promise<Response>((resolve) => { resolveFirst = resolve }))
    Object.defineProperty(document, 'startViewTransition', {
      configurable: true,
      value: vi.fn((update: () => void) => {
        pendingUpdates.push(update)
      }),
    })
    const { container } = render(<App />)
    const input = screen.getByLabelText(/choose video/i)

    act(() => {
      fireEvent.change(input, { target: { files: [new File(['first'], 'first.mp4', { type: 'video/mp4' })] } })
      fireEvent.change(input, { target: { files: [new File(['second'], 'second.mp4', { type: 'video/mp4' })] } })
    })
    expect(fetchMock).toHaveBeenCalledOnce()
    resolveFirst(projectResponse('first.mp4', '/api/projects/project_aaaaaaaaaaaaaaaa/media'))
    await act(async () => undefined)

    expect(pendingUpdates).toHaveLength(1)

    act(() => pendingUpdates[0]())
    expect(screen.getByText('first.mp4')).toBeInTheDocument()
    expect(container.querySelector('video')).toHaveAttribute('src', '/api/projects/project_aaaaaaaaaaaaaaaa/media')
  })

  it('accepts, undoes, redoes, and resets one nameplate through App-owned state', async () => {
    const user = userEvent.setup()
    const { container } = render(<App />)
    await user.upload(
      screen.getByLabelText(/choose video/i),
      new File(['video'], 'first.mp4', { type: 'video/mp4' }),
    )

    const video = container.querySelector('video') as HTMLVideoElement
    Object.defineProperties(video, {
      videoWidth: { configurable: true, value: 1920 },
      videoHeight: { configurable: true, value: 1080 },
      currentTime: { configurable: true, value: 12.4, writable: true },
    })
    vi.spyOn(video, 'pause').mockImplementation(() => undefined)
    vi.spyOn(video, 'getBoundingClientRect').mockReturnValue({
      x: 0,
      y: 0,
      left: 0,
      top: 0,
      right: 400,
      bottom: 400,
      width: 400,
      height: 400,
      toJSON: () => ({}),
    })
    fireEvent.loadedMetadata(video)

    await user.click(screen.getByRole('button', { name: /enter point mode/i }))
    fireEvent.click(screen.getByRole('button', { name: /choose a point/i }), {
      clientX: 200,
      clientY: 200,
    })
    await user.click(screen.getByRole('button', { name: /add text here/i }))
    await user.type(screen.getByRole('textbox', { name: /^main text$/i }), 'Santosh')
    await user.click(screen.getByRole('button', { name: /create proposal/i }))

    fireEvent.timeUpdate(video)
    expect(screen.getByTestId('nameplate-overlay')).toHaveTextContent('Santosh')
    expect(screen.getByText(/no accepted edits/i)).toBeInTheDocument()

    const accept = screen.getByRole('button', { name: /^accept proposal$/i })
    await user.dblClick(accept)
    expect(screen.getAllByText('Santosh')).toHaveLength(2)

    await user.click(screen.getByRole('button', { name: /^undo edit$/i }))
    expect(screen.queryByTestId('nameplate-overlay')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: /^redo edit$/i })).toBeEnabled()

    await user.click(screen.getByRole('button', { name: /^redo edit$/i }))
    expect(screen.getByTestId('nameplate-overlay')).toHaveTextContent('Santosh')

    await user.click(screen.getByRole('button', { name: /back to home/i }))
    fetchMock.mockResolvedValueOnce(projectResponse('second.mp4', '/api/projects/project_bbbbbbbbbbbbbbbb/media'))
    await user.upload(
      screen.getByLabelText(/choose video/i),
      new File(['video'], 'second.mp4', { type: 'video/mp4' }),
    )

    expect(screen.getByText(/no pending proposal/i)).toBeInTheDocument()
    expect(screen.getByText(/no accepted edits/i)).toBeInTheDocument()
  })

  it('stays on Home with visible progress and a recoverable import failure', async () => {
    const user = userEvent.setup()
    let rejectUpload!: (reason: Error) => void
    fetchMock.mockReset().mockReturnValue(new Promise((_resolve, reject) => { rejectUpload = reject }))
    render(<App />)

    await user.upload(screen.getByLabelText(/choose video/i), new File(['video'], 'clip.mp4', { type: 'video/mp4' }))
    expect(screen.getByRole('status')).toHaveTextContent(/importing video/i)
    expect(screen.getByLabelText(/choose video/i)).toBeDisabled()

    rejectUpload(new Error('offline'))
    await act(async () => undefined)
    expect(screen.getByRole('alert')).toHaveTextContent(/could not import/i)
    expect(screen.getByLabelText(/choose video/i)).toBeEnabled()
    expect(screen.getByRole('heading', { name: /what do you want to edit today/i })).toBeInTheDocument()
  })

  it('completes import, accepted edit, export progress, and downloadable MP4 as one loop', async () => {
    const user = userEvent.setup()
    let resolveExport!: (response: Response) => void
    fetchMock.mockReset()
      .mockResolvedValueOnce(projectResponse())
      .mockReturnValueOnce(new Promise<Response>((resolve) => { resolveExport = resolve }))
    const { container } = render(<App />)

    await user.upload(screen.getByLabelText(/choose video/i), new File(['video'], 'cleaned.mp4', { type: 'video/mp4' }))
    const video = container.querySelector('video') as HTMLVideoElement
    Object.defineProperties(video, {
      videoWidth: { configurable: true, value: 1920 }, videoHeight: { configurable: true, value: 1080 },
      currentTime: { configurable: true, value: 1, writable: true },
    })
    vi.spyOn(video, 'pause').mockImplementation(() => undefined)
    vi.spyOn(video, 'getBoundingClientRect').mockReturnValue({ x: 0, y: 0, left: 0, top: 0, right: 400, bottom: 400, width: 400, height: 400, toJSON: () => ({}) })
    fireEvent.loadedMetadata(video)
    await user.click(screen.getByRole('button', { name: /enter point mode/i }))
    fireEvent.click(screen.getByRole('button', { name: /choose a point/i }), { clientX: 200, clientY: 200 })
    await user.click(screen.getByRole('button', { name: /add text here/i }))
    await user.type(screen.getByRole('textbox', { name: /^main text$/i }), 'Santosh')
    await user.click(screen.getByRole('button', { name: /create proposal/i }))
    await user.click(screen.getByRole('button', { name: /^accept proposal$/i }))

    await user.click(screen.getByRole('button', { name: /export video/i }))
    expect(screen.getByRole('status', { name: /export status/i })).toHaveTextContent(/rendering/i)
    expect(fetchMock).toHaveBeenLastCalledWith('/api/projects/project_1234567890abcdef/exports', expect.objectContaining({ method: 'POST' }))

    resolveExport(exportResponse())
    await act(async () => undefined)
    expect(screen.getByRole('link', { name: /download mp4/i })).toHaveAttribute('href', '/api/projects/project_1234567890abcdef/exports/export_1234567890abcdef/media')
  })
})
