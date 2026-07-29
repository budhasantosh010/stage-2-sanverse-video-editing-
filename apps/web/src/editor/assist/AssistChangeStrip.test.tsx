import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'

import type { AssistChangeItem } from './assist-change-model'
import { AssistChangeStrip } from './AssistChangeStrip'

afterEach(cleanup)

const item = (overrides: Partial<AssistChangeItem> = {}): AssistChangeItem => ({
  id: 'changeset_1:operation_1',
  changeSetId: 'changeset_1',
  operationId: 'operation_1',
  status: 'accepted',
  label: 'Cut at 10.0s',
  detail: null,
  startTicks: 14_400_000,
  durationTicks: 0,
  seekTicks: 14_400_000,
  blockedReason: null,
  operationKind: 'split-clip',
  ...overrides,
})

describe('AssistChangeStrip', () => {
  it('shows an honest empty state and Studio escape hatch', async () => {
    const user = userEvent.setup()
    const onOpenStudio = vi.fn()
    render(
      <AssistChangeStrip
        items={[]}
        selectedId={null}
        onSelect={vi.fn()}
        onSeek={vi.fn()}
        onOpenStudio={onOpenStudio}
      />,
    )

    expect(screen.getByText(/no changes yet/i)).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /open full history in studio/i }))
    expect(onOpenStudio).toHaveBeenCalledOnce()
  })

  it('seeks only timed changes and says pending or blocked in text', async () => {
    const user = userEvent.setup()
    const onSelect = vi.fn()
    const onSeek = vi.fn()
    render(
      <AssistChangeStrip
        items={[
          item(),
          item({
            id: 'pending:operation_2',
            changeSetId: null,
            operationId: 'operation_2',
            status: 'pending',
            label: 'Add name',
            seekTicks: null,
            startTicks: null,
            durationTicks: null,
          }),
          item({
            id: 'changeset_3:operation_3',
            operationId: 'operation_3',
            status: 'blocked',
            label: 'Add title',
            blockedReason: 'SOURCE_SPAN_REMOVED',
            seekTicks: null,
            startTicks: null,
            durationTicks: null,
          }),
        ]}
        selectedId={null}
        onSelect={onSelect}
        onSeek={onSeek}
        onOpenStudio={vi.fn()}
      />,
    )

    await user.click(screen.getByRole('button', { name: /cut at 10.0s, accepted/i }))
    expect(onSelect).toHaveBeenCalledWith('changeset_1:operation_1')
    expect(onSeek).toHaveBeenCalledWith(14_400_000)
    expect(screen.getByText('Pending')).toBeInTheDocument()
    expect(screen.getByText('Needs attention')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /add name/i })).not.toBeInTheDocument()
  })

  it('compacts long history while keeping the recent changes', () => {
    render(
      <AssistChangeStrip
        items={Array.from({ length: 8 }, (_, index) =>
          item({
            id: `changeset_${index}:operation_${index}`,
            operationId: `operation_${index}`,
            label: `Change ${index + 1}`,
          }),
        )}
        selectedId="changeset_7:operation_7"
        onSelect={vi.fn()}
        onSeek={vi.fn()}
        onOpenStudio={vi.fn()}
      />,
    )

    expect(screen.getByText('+3 earlier')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /change 8, accepted/i })).toHaveAttribute(
      'aria-current',
      'true',
    )
  })
})
