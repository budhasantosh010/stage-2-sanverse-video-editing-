import { createRef } from 'react'
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { testOperation } from '@sanverse/edit-domain/test-fixtures'

import { AssistProposalPanel } from './AssistProposalPanel'

afterEach(cleanup)

const proposal = {
  operation: testOperation({ primaryText: 'Santosh', secondaryText: 'Founder' }),
  origin: {
    source: 'ai' as const,
    requestId: 'request_assist01',
    explanation: 'Shows your name.',
    note: 'Placed where you pointed.',
  },
}

describe('AssistProposalPanel', () => {
  it('explains the safe empty and sending states', () => {
    const { rerender } = render(
      <AssistProposalPanel
        proposal={null}
        conversation={{ status: 'ready', lastMessage: '', question: null, notice: null }}
        editError={null}
        placedStartMs={0}
        durationMs={0}
        summaryRef={createRef()}
        onAccept={vi.fn()}
        onReject={vi.fn()}
        onOpenStudio={vi.fn()}
      />,
    )

    expect(screen.getByText(/nothing changes until you accept/i)).toBeInTheDocument()
    rerender(
      <AssistProposalPanel
        proposal={null}
        conversation={{ status: 'sending', lastMessage: 'add my name', question: null, notice: null }}
        editError={null}
        placedStartMs={0}
        durationMs={0}
        summaryRef={createRef()}
        onAccept={vi.fn()}
        onReject={vi.fn()}
        onOpenStudio={vi.fn()}
      />,
    )
    expect(screen.getByRole('status')).toHaveTextContent(/nothing has changed yet/i)
  })

  it('shows one detached proposal and routes its real actions', async () => {
    const user = userEvent.setup()
    const onAccept = vi.fn()
    const onReject = vi.fn()
    const onOpenStudio = vi.fn()
    render(
      <AssistProposalPanel
        proposal={proposal}
        conversation={{ status: 'ready', lastMessage: '', question: null, notice: null }}
        editError={null}
        placedStartMs={2_000}
        durationMs={5_000}
        summaryRef={createRef()}
        onAccept={onAccept}
        onReject={onReject}
        onOpenStudio={onOpenStudio}
      >
        <label>
          Main text
          <input defaultValue="Santosh" />
        </label>
      </AssistProposalPanel>,
    )

    expect(screen.getByText(/pending — preview only/i)).toBeInTheDocument()
    expect(screen.getByText(/shows your name/i)).toBeInTheDocument()
    expect(screen.getByText(/placed where you pointed/i)).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /refine proposal/i }))
    expect(screen.getByRole('textbox', { name: /main text/i })).toHaveFocus()
    await user.click(screen.getByRole('button', { name: /open proposal in studio/i }))
    await user.click(screen.getByRole('button', { name: /^reject proposal$/i }))
    await user.click(screen.getByRole('button', { name: /^accept proposal$/i }))
    expect(onOpenStudio).toHaveBeenCalledOnce()
    expect(onReject).toHaveBeenCalledOnce()
    expect(onAccept).toHaveBeenCalledOnce()
  })

  it('shows the proposal error once and leaves conversation errors to the composer', () => {
    render(
      <AssistProposalPanel
        proposal={null}
        conversation={{
          status: 'error',
          lastMessage: 'add a title',
          question: null,
          notice: 'We could not prepare that proposal. Your video and accepted edits were not changed.',
        }}
        editError="This proposal could not be accepted. Your accepted edits are still safe."
        placedStartMs={0}
        durationMs={0}
        summaryRef={createRef()}
        onAccept={vi.fn()}
        onReject={vi.fn()}
        onOpenStudio={vi.fn()}
      />,
    )

    expect(screen.getAllByRole('alert')).toHaveLength(1)
    expect(screen.queryByText(/accepted edits were not changed/i)).not.toBeInTheDocument()
    expect(screen.getByText(/accepted edits are still safe/i)).toBeInTheDocument()
  })
})
