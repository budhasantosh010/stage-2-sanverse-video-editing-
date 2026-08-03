import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { MonitorPointTool } from './MonitorPointTool'

afterEach(cleanup)

describe('MonitorPointTool', () => {
  it('is always a compact pressed-state tool and exposes selected-point truth', async () => {
    const onToggle = vi.fn()
    const { rerender } = render(<MonitorPointTool active={false} selected={false} onToggle={onToggle} />)
    const button = screen.getByRole('button', { name: 'Enter Point mode' })
    expect(button).toHaveAttribute('title', 'Point to a place in the frame')
    expect(button).toHaveAttribute('aria-pressed', 'false')
    await userEvent.click(button)
    expect(onToggle).toHaveBeenCalledOnce()

    rerender(<MonitorPointTool active selected onToggle={onToggle} />)
    expect(screen.getByRole('button', { name: 'Cancel Point mode' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByText('Point selected')).toBeInTheDocument()
  })
})
