import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { StudioWorkspaceTabs } from './StudioWorkspaceTabs'

afterEach(cleanup)

describe('Studio workspace tabs', () => {
  it('renders the required order and announces Edit as active', () => {
    render(<StudioWorkspaceTabs value="edit" onChange={vi.fn()} />)
    expect(screen.getAllByRole('tab').map((tab) => tab.textContent)).toEqual(['Edit', 'Creative', 'Effects', 'Color', 'Audio'])
    expect(screen.getByRole('tab', { name: 'Edit' })).toHaveAttribute('aria-selected', 'true')
  })

  it('supports Arrow, Home, End, Enter and Space activation', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(<StudioWorkspaceTabs value="edit" onChange={onChange} />)
    const edit = screen.getByRole('tab', { name: 'Edit' })
    edit.focus()
    await user.keyboard('{ArrowRight}{Enter}')
    expect(onChange).toHaveBeenLastCalledWith('creative')
    await user.keyboard('{End} ')
    expect(onChange).toHaveBeenLastCalledWith('audio')
    await user.keyboard('{Home}{Enter}')
    expect(onChange).toHaveBeenLastCalledWith('edit')
  })
})
