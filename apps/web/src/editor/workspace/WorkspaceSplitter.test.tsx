import { useState } from 'react'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { WorkspaceSplitter } from './WorkspaceSplitter'

function Harness({ onCommit = vi.fn(), onCancel = vi.fn() }: { onCommit?: (value: number) => void; onCancel?: (value: number) => void }) {
  const [value, setValue] = useState(220)
  return <WorkspaceSplitter label="Resize Media dock" orientation="horizontal" value={value} minimum={200} maximum={420} onChange={setValue} onCommit={onCommit} onCancel={onCancel} />
}

beforeEach(() => {
  vi.stubGlobal('PointerEvent', MouseEvent)
  HTMLElement.prototype.setPointerCapture = vi.fn()
  HTMLElement.prototype.releasePointerCapture = vi.fn()
})
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals() })

describe('WorkspaceSplitter', () => {
  it('resizes with keyboard steps, Shift steps, Home and End', async () => {
    const user = userEvent.setup()
    const commit = vi.fn()
    render(<Harness onCommit={commit} />)
    const separator = screen.getByRole('separator', { name: 'Resize Media dock' })
    separator.focus()
    await user.keyboard('{ArrowRight}')
    expect(separator).toHaveAttribute('aria-valuenow', '232')
    await user.keyboard('{Shift>}{ArrowRight}{/Shift}')
    expect(separator).toHaveAttribute('aria-valuenow', '272')
    await user.keyboard('{Home}')
    expect(separator).toHaveAttribute('aria-valuenow', '200')
    await user.keyboard('{End}')
    expect(separator).toHaveAttribute('aria-valuenow', '420')
    expect(commit).toHaveBeenCalledTimes(4)
  })

  it('commits only the bounded final pointer value', () => {
    const commit = vi.fn()
    render(<Harness onCommit={commit} />)
    const separator = screen.getByRole('separator')
    fireEvent.pointerDown(separator, { pointerId: 1, clientX: 100 })
    fireEvent.pointerMove(separator, { pointerId: 1, clientX: 400 })
    expect(separator).toHaveAttribute('aria-valuenow', '420')
    expect(commit).not.toHaveBeenCalled()
    fireEvent.pointerUp(separator, { pointerId: 1, clientX: 400 })
    expect(commit).toHaveBeenCalledWith(420)
  })

  it('restores the starting value on Escape and pointer cancellation', () => {
    const cancel = vi.fn()
    render(<Harness onCancel={cancel} />)
    const separator = screen.getByRole('separator')
    fireEvent.pointerDown(separator, { pointerId: 2, clientX: 100 })
    fireEvent.pointerMove(separator, { pointerId: 2, clientX: 180 })
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(separator).toHaveAttribute('aria-valuenow', '220')
    expect(cancel).toHaveBeenLastCalledWith(220)
    fireEvent.pointerDown(separator, { pointerId: 3, clientX: 100 })
    fireEvent.pointerMove(separator, { pointerId: 3, clientX: 160 })
    fireEvent.pointerCancel(separator, { pointerId: 3 })
    expect(separator).toHaveAttribute('aria-valuenow', '220')
  })
})
