import { StrictMode } from 'react'
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { App } from './App'

const originalCreateObjectURL = Object.getOwnPropertyDescriptor(URL, 'createObjectURL')
const originalRevokeObjectURL = Object.getOwnPropertyDescriptor(URL, 'revokeObjectURL')

let createObjectURL: ReturnType<typeof vi.fn>
let revokeObjectURL: ReturnType<typeof vi.fn>

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

    expect(createObjectURL).toHaveBeenCalledOnce()
    expect(createObjectURL).toHaveBeenCalledWith(file)
    expect(screen.getByText('cleaned.mp4')).toBeInTheDocument()
    expect(container.querySelector('video')).toHaveAttribute('src', 'blob:cleaned-video')
    expect(screen.getByText(/draft — not executed/i)).toBeInTheDocument()
    expect(screen.getByText('Tighten the opening pause.')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /back to home/i }))

    expect(
      screen.getByRole('heading', { name: /what do you want to edit today/i }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('textbox', { name: /describe what you want to change/i }),
    ).toHaveValue('')
    expect(revokeObjectURL).toHaveBeenCalledOnce()
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:cleaned-video')
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

    expect(revokeObjectURL).toHaveBeenCalledOnce()
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:cleaned-video')
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
  })
})
