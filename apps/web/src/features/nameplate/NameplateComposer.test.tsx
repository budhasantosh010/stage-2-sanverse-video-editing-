import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { effectiveComposition } from '@sanverse/edit-domain'

import { testProject } from '../../test-fixtures'
import { NameplateComposer } from './NameplateComposer'

const composition = effectiveComposition(testProject())

const target = { x: 0.25, y: 0.75, timeMs: 12_400 }

afterEach(cleanup)

function renderComposer(
  overrides: Partial<React.ComponentProps<typeof NameplateComposer>> = {},
) {
  const props: React.ComponentProps<typeof NameplateComposer> = {
    target,
    onProposal: vi.fn(),
    composition,
    createOperationId: () => 'operation_test0001',
    ...overrides,
  }

  return { ...render(<NameplateComposer {...props} />), props }
}

describe('NameplateComposer', () => {
  it('keeps Add text unavailable until a point target exists', () => {
    renderComposer({ target: null })

    expect(screen.getByRole('button', { name: /add text here/i })).toBeDisabled()
    expect(screen.queryByRole('dialog', { name: /create nameplate/i })).not.toBeInTheDocument()
  })

  it('opens a bounded form with plain-language timing defaults', async () => {
    const user = userEvent.setup()
    renderComposer()

    await user.click(screen.getByRole('button', { name: /add text here/i }))

    expect(screen.getByRole('dialog', { name: /create nameplate/i })).toBeInTheDocument()
    expect(screen.getByRole('textbox', { name: /^main text$/i })).toHaveFocus()
    expect(screen.getByRole('textbox', { name: /smaller line.*optional/i })).toBeInTheDocument()
    expect(screen.getByText(/starts here.*00:12\.400/i)).toBeInTheDocument()
    expect(screen.getByText(/visible for.*5 seconds/i)).toBeInTheDocument()
  })

  it('shows a recoverable accessible error and focuses blank primary text', async () => {
    const user = userEvent.setup()
    const { props } = renderComposer()

    await user.click(screen.getByRole('button', { name: /add text here/i }))
    const primary = screen.getByRole('textbox', { name: /^main text$/i })
    await user.type(primary, '   ')
    await user.click(screen.getByRole('button', { name: /create proposal/i }))

    expect(screen.getByRole('alert')).toHaveTextContent(/main text is required/i)
    expect(primary).toHaveAccessibleDescription(/main text is required/i)
    expect(primary).toHaveFocus()
    expect(props.onProposal).not.toHaveBeenCalled()

    await user.clear(primary)
    await user.type(primary, 'Santosh')
    await user.click(screen.getByRole('button', { name: /create proposal/i }))

    expect(props.onProposal).toHaveBeenCalledOnce()
  })

  it('creates a validated immutable proposal with trimmed copy and exact target defaults', async () => {
    const user = userEvent.setup()
    const { props } = renderComposer()

    await user.click(screen.getByRole('button', { name: /add text here/i }))
    await user.type(screen.getByRole('textbox', { name: /^main text$/i }), '  Santosh  ')
    await user.type(
      screen.getByRole('textbox', { name: /smaller line.*optional/i }),
      '  Founder  ',
    )
    await user.click(screen.getByRole('button', { name: /create proposal/i }))

    expect(props.onProposal).toHaveBeenCalledWith({
      schemaVersion: 'sanverse.operation/v3',
      operationId: 'operation_test0001',
      kind: 'add-nameplate',
      capabilityId: 'sanverse.nameplate.component/v1',
      // Anchored to the footage, not to the finished video, so a later cut
      // moves it with the face it was placed on.
      assetId: 'asset_aaaaaaaa',
      sourceInterval: {
        start: { ticks: 12_400 * 1_440, timescale: 1_440_000 },
        duration: { ticks: 5_000 * 1_440, timescale: 1_440_000 },
      },
      // A click means "put the middle here", which is what pointing implies.
      target: {
        coordinateSpace: 'composition-normalized',
        point: { x: 0.25, y: 0.75 },
        anchor: 'center',
      },
      primaryText: 'Santosh',
      secondaryText: 'Founder',
      extensions: {},
    })

    const proposal = vi.mocked(props.onProposal).mock.calls[0][0]
    expect(Object.isFrozen(proposal)).toBe(true)
    expect(Object.isFrozen(proposal.target)).toBe(true)
  })

  it('allows an empty optional line', async () => {
    const user = userEvent.setup()
    const { props } = renderComposer()

    await user.click(screen.getByRole('button', { name: /add text here/i }))
    await user.type(screen.getByRole('textbox', { name: /^main text$/i }), 'Santosh')
    await user.click(screen.getByRole('button', { name: /create proposal/i }))

    expect(props.onProposal).toHaveBeenCalledWith(
      expect.objectContaining({ secondaryText: '' }),
    )
  })

  it('cancels without creating a proposal and returns focus to Add text', async () => {
    const user = userEvent.setup()
    const { props } = renderComposer()

    const addText = screen.getByRole('button', { name: /add text here/i })
    await user.click(addText)
    await user.type(screen.getByRole('textbox', { name: /^main text$/i }), 'Discard me')
    await user.click(screen.getByRole('button', { name: /^cancel$/i }))

    expect(screen.queryByRole('dialog', { name: /create nameplate/i })).not.toBeInTheDocument()
    expect(props.onProposal).not.toHaveBeenCalled()
    expect(addText).toHaveFocus()
  })

  it('closes with Escape without creating a proposal', async () => {
    const user = userEvent.setup()
    const { props } = renderComposer()

    const addText = screen.getByRole('button', { name: /add text here/i })
    await user.click(addText)
    await user.type(screen.getByRole('textbox', { name: /^main text$/i }), 'Discard me')
    await user.keyboard('{Escape}')

    expect(screen.queryByRole('dialog', { name: /create nameplate/i })).not.toBeInTheDocument()
    expect(props.onProposal).not.toHaveBeenCalled()
    expect(addText).toHaveFocus()
  })

  it('closes and clears an open draft when the selected point changes', async () => {
    const user = userEvent.setup()
    const onProposal = vi.fn()
    const createOperationId = () => 'operation_test0001'
    const { rerender } = render(
      <NameplateComposer
        target={target}
        composition={composition}
        createOperationId={createOperationId}
        onProposal={onProposal}
      />,
    )

    await user.click(screen.getByRole('button', { name: /add text here/i }))
    await user.type(screen.getByRole('textbox', { name: /^main text$/i }), 'Stale draft')
    rerender(
      <NameplateComposer
        target={{ x: 0.5, y: 0.5, timeMs: 20_000 }}
        composition={composition}
        createOperationId={createOperationId}
        onProposal={onProposal}
      />,
    )

    expect(screen.queryByRole('dialog', { name: /create nameplate/i })).not.toBeInTheDocument()
    expect(onProposal).not.toHaveBeenCalled()
  })

  it('fails closed when canonical validation rejects the proposal', async () => {
    const user = userEvent.setup()
    const { props } = renderComposer({ createOperationId: () => '   ' })

    await user.click(screen.getByRole('button', { name: /add text here/i }))
    await user.type(screen.getByRole('textbox', { name: /^main text$/i }), 'Santosh')
    await user.click(screen.getByRole('button', { name: /create proposal/i }))

    expect(screen.getByRole('alert')).toHaveTextContent(/could not create this proposal/i)
    expect(screen.getByRole('dialog', { name: /create nameplate/i })).toBeInTheDocument()
    expect(props.onProposal).not.toHaveBeenCalled()
  })

  it('fails visibly when action ID generation is unavailable', async () => {
    const user = userEvent.setup()
    const { props } = renderComposer({
      createOperationId: () => {
        throw new Error('Web Crypto unavailable')
      },
    })

    await user.click(screen.getByRole('button', { name: /add text here/i }))
    await user.type(screen.getByRole('textbox', { name: /^main text$/i }), 'Santosh')
    await user.click(screen.getByRole('button', { name: /create proposal/i }))

    expect(screen.getByRole('alert')).toHaveTextContent(/could not create this proposal/i)
    expect(screen.getByRole('dialog', { name: /create nameplate/i })).toBeInTheDocument()
    expect(props.onProposal).not.toHaveBeenCalled()
  })
})
