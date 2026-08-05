import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'

afterEach(cleanup)

import { TEST_CLIP_ID, testProject } from '../../test-fixtures'
import {
  nameplate,
  removedProject,
} from '../../features/timeline/timeline-test-fixtures'
import { buildTimelineViewModel, type PendingTimelineInput, type TimelineViewModel } from '../../features/timeline'
import { Inspector } from './Inspector'
import { resolveInspectorSelection } from './inspector-selection-resolver'

const labels = Object.freeze({ asset_aaaaaaaa: 'owner.mp4' })

const model = (
  project = testProject(),
  selectedItemId: string | null = null,
  pending: PendingTimelineInput | null = null,
) => buildTimelineViewModel({ project, selectedItemIds: selectedItemId === null ? [] : [selectedItemId], pending, assetLabels: labels })

const selection = (
  project = testProject(),
  selectedItemId: string | null = null,
  pending: PendingTimelineInput | null = null,
  timeline: TimelineViewModel = model(project, selectedItemId, pending),
) => resolveInspectorSelection({
  project,
  timeline,
  selectedTimelineItemId: selectedItemId,
  pending,
  assetLabels: labels,
})

const defaultProps = {
  assets: testProject().assets,
  busy: false,
  proposalActionsBusy: false,
  playheadTicks: 0,
  pendingSelectionChange: null,
  onDirtyChange: vi.fn(),
  onStaySelection: vi.fn(),
  onDiscardSelection: vi.fn(),
  onAcceptProposal: vi.fn(),
  onRejectProposal: vi.fn(),
  onOpenProposal: vi.fn(),
  onSeek: vi.fn(),
  onApply: vi.fn(async () => null),
}

describe('Inspector shell', () => {
  it('shows the explicit empty state', () => {
    render(<Inspector {...defaultProps} selection={selection()} />)
    expect(screen.getByText('Nothing selected')).toBeInTheDocument()
    expect(screen.getByText('Select an item in the timeline to inspect its settings.')).toBeInTheDocument()
    expect(screen.getByText('Read only')).toBeInTheDocument()
  })

  it('shows a gap as read-only without fake clip controls', () => {
    const project = removedProject(false)
    const gapId = model(project).lanes.flatMap((lane) => lane.items).find((item) => item.kind === 'gap')?.id
    if (!gapId) throw new Error('gap missing')
    render(<Inspector {...defaultProps} selection={selection(project, gapId)} />)

    expect(screen.getByRole('heading', { name: 'Gap' })).toBeInTheDocument()
    expect(screen.getByText('This empty stretch is part of the current timeline.')).toBeInTheDocument()
    expect(screen.queryByLabelText('Music level in dB')).not.toBeInTheDocument()
  })

  it('shows a blocked item as Needs attention with its plain reason', () => {
    const project = testProject()
    const selectedId = `clip:${TEST_CLIP_ID}`
    const current = model(project, selectedId)
    const blocked: TimelineViewModel = Object.freeze({
      ...current,
      lanes: Object.freeze(current.lanes.map((lane) => Object.freeze({
        ...lane,
        items: Object.freeze(lane.items.map((item) => item.id === selectedId
          ? Object.freeze({ ...item, state: 'blocked' as const, blockedReason: 'The source moment was removed.' })
          : item)),
      }))),
    })
    render(<Inspector {...defaultProps} selection={selection(project, selectedId, null, blocked)} />)

    expect(screen.getAllByText('Needs attention')).toHaveLength(2)
    expect(screen.getByText('The source moment was removed.')).toBeInTheDocument()
    expect(screen.getByText(/Undo the edit that removed the target/)).toBeInTheDocument()
  })

  it('shows a proposal as preview-only and reuses proposal callbacks', async () => {
    const user = userEvent.setup()
    const project = testProject()
    const pending: PendingTimelineInput = Object.freeze({
      proposalId: 'proposal_0001',
      baseRevision: project.revision,
      operations: Object.freeze([nameplate('operation_proposal1', 1, 2, 'Preview only')]),
    })
    const pendingModel = model(project, null, pending)
    const proposalId = pendingModel.lanes.flatMap((lane) => lane.items).find((item) => item.state === 'proposed')?.id
    if (!proposalId) throw new Error('proposal missing')
    const props = {
      ...defaultProps,
      onAcceptProposal: vi.fn(),
      onRejectProposal: vi.fn(),
      onOpenProposal: vi.fn(),
    }
    render(
      <Inspector
        {...props}
        selection={selection(project, proposalId, pending, model(project, proposalId, pending))}
      />,
    )

    expect(screen.getByText('Pending')).toBeInTheDocument()
    expect(screen.getByText('Pending — preview only')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Accept proposal' }))
    await user.click(screen.getByRole('button', { name: 'Reject proposal' }))
    await user.click(screen.getByRole('button', { name: 'Open in Assist' }))
    expect(props.onAcceptProposal).toHaveBeenCalledTimes(1)
    expect(props.onRejectProposal).toHaveBeenCalledTimes(1)
    expect(props.onOpenProposal).toHaveBeenCalledTimes(1)
  })

  it('shows an editable human-readable header for a selected clip', () => {
    render(<Inspector {...defaultProps} selection={selection(testProject(), `clip:${TEST_CLIP_ID}`)} />)
    expect(screen.getByRole('heading', { name: 'owner.mp4' })).toBeInTheDocument()
    expect(screen.getByText('Editable')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Summary' })).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getAllByText('Video clip')).toHaveLength(2)
  })

  it('guards a dirty selection change with Stay and Discard and continue', async () => {
    const user = userEvent.setup()
    const onStaySelection = vi.fn()
    const onDiscardSelection = vi.fn()
    render(
      <Inspector
        {...defaultProps}
        selection={selection(testProject(), `clip:${TEST_CLIP_ID}`)}
        pendingSelectionChange={{ nextLabel: 'Title' }}
        onStaySelection={onStaySelection}
        onDiscardSelection={onDiscardSelection}
      />,
    )

    const dialog = screen.getByRole('alertdialog', { name: 'Discard unapplied changes?' })
    expect(dialog).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Stay' }))
    expect(onStaySelection).toHaveBeenCalledTimes(1)
    await user.click(screen.getByRole('button', { name: 'Discard and continue' }))
    expect(onDiscardSelection).toHaveBeenCalledTimes(1)
  })

  it('Escape chooses Stay in the dirty-selection confirmation', () => {
    const onStaySelection = vi.fn()
    render(
      <Inspector
        {...defaultProps}
        selection={selection(testProject(), `clip:${TEST_CLIP_ID}`)}
        pendingSelectionChange={{ nextLabel: 'Title' }}
        onStaySelection={onStaySelection}
      />,
    )
    fireEvent.keyDown(screen.getByRole('alertdialog'), { key: 'Escape' })
    expect(onStaySelection).toHaveBeenCalledTimes(1)
  })
})
