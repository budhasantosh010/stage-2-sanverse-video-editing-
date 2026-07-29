import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { DisabledAction } from './DisabledAction'
import { IconButton } from './IconButton'

afterEach(cleanup)

describe('DisabledAction', () => {
  it('keeps the real action disabled while making its reason keyboard accessible', async () => {
    const user = userEvent.setup()
    const onClick = vi.fn()
    render(
      <DisabledAction disabled label="Undo edit" reason="Nothing to undo yet.">
        <IconButton label="Undo edit" icon="↶" disabled onClick={onClick} />
      </DisabledAction>,
    )

    const explanation = screen.getByRole('tooltip')
    const wrapper = screen.getByRole('group', { name: /undo edit unavailable/i })
    const button = screen.getByRole('button', { name: /undo edit/i })

    expect(button).toBeDisabled()
    expect(wrapper).toHaveAttribute('tabindex', '0')
    expect(wrapper).toHaveAttribute('aria-describedby', explanation.id)
    expect(explanation).toHaveTextContent('Nothing to undo yet.')

    await user.tab()
    expect(wrapper).toHaveFocus()
    await user.click(button)
    expect(onClick).not.toHaveBeenCalled()
  })

  it('adds no extra focus stop or explanation when the action is enabled', async () => {
    const user = userEvent.setup()
    const onClick = vi.fn()
    render(
      <DisabledAction disabled={false} label="Undo edit" reason={null}>
        <IconButton label="Undo edit" icon="↶" onClick={onClick} />
      </DisabledAction>,
    )

    expect(screen.queryByRole('group', { name: /undo edit unavailable/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /undo edit/i }))
    expect(onClick).toHaveBeenCalledOnce()
  })
})
