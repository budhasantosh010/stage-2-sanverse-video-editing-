import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { testProject } from '@sanverse/edit-domain/test-fixtures'
import type { EditProject } from '@sanverse/edit-domain'
import { CreativeProductionWorkspace } from './CreativeProductionWorkspace'
import { useCreativeProductionController } from './useCreativeProductionController'
import type { CreativeProductionApply } from './creative-production-contract'

afterEach(cleanup)

function Harness({ project, onApply }: Readonly<{ project: EditProject; onApply: CreativeProductionApply }>) {
  const controller = useCreativeProductionController({ project, playheadTicks: 1_440_000, onApply })
  return <CreativeProductionWorkspace controller={controller} assetLabel="Production source.mp4" />
}

async function approveFullWorkflow(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole('button', { name: 'Create Creative draft' }))
  await user.click(screen.getByRole('button', { name: 'Approve Storyboard' }))
  await user.click(screen.getByRole('button', { name: 'Build Animatic' }))
  await user.click(screen.getByRole('button', { name: 'Approve Animatic' }))
  await user.click(screen.getByRole('button', { name: 'Build Motion' }))
  await user.click(screen.getByRole('button', { name: 'Prepare Review' }))
  await waitFor(() => expect(screen.getByText('review ready')).toBeInTheDocument())
  await user.click(screen.getByRole('button', { name: 'Approve Motion' }))
}

describe('Creative Production workspace V1.6', () => {
  it('shows truthful Library coverage, one semantic C3-C6 selection and applies one production change set after explicit approvals', async () => {
    const user = userEvent.setup()
    const onApply = vi.fn<CreativeProductionApply>().mockResolvedValue(null)
    render(<Harness project={testProject()} onApply={onApply} />)

    expect(screen.getByText('99 Library')).toBeInTheDocument()
    expect(screen.getByLabelText('Creative production adapter coverage')).toHaveTextContent('1 production adapter')
    expect(screen.getByLabelText('Creative production adapter coverage')).toHaveTextContent('98 Creative preview only')

    await approveFullWorkflow(user)
    expect(screen.getByRole('tab', { name: 'C3 Layers' })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'C4 Timeline' })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'C5 Curves' })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'C6 Nodes' })).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Apply to production' }))
    await waitFor(() => expect(onApply).toHaveBeenCalledTimes(1))
    const [operations, changeSetId, metadata] = onApply.mock.calls[0]!
    expect(operations).toHaveLength(2)
    expect(operations.map((operation) => operation.kind)).toEqual(['add-title', 'set-visual-properties'])
    expect(changeSetId).toMatch(/^changeset_/)
    expect(metadata?.expectedBaseRevision).toBe(testProject().revision)
    expect(metadata?.provenance?.source).toBe('ai')
    expect(metadata?.provenance?.requestId).toMatch(/^creative:/)
    expect(metadata?.extensions).toHaveProperty('sanverse.creative/lineage')
    expect(screen.getByText(/one production change set/i)).toBeInTheDocument()
  })

  it('uses canonical C5 curve operations and discards stale approvals after a manual graph edit', async () => {
    const user = userEvent.setup()
    const onApply = vi.fn<CreativeProductionApply>().mockResolvedValue(null)
    render(<Harness project={testProject()} onApply={onApply} />)
    await approveFullWorkflow(user)
    expect(screen.getByRole('button', { name: 'Apply to production' })).toBeEnabled()

    await user.click(screen.getByRole('tab', { name: 'C5 Curves' }))
    const snappy = screen.getAllByRole('button', { name: 'snappy' })[0]
    expect(snappy).toBeDefined()
    await user.click(snappy!)

    expect(screen.getByText(/Previous approvals were discarded/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Approve Storyboard' })).toBeEnabled()
    expect(screen.getByRole('button', { name: 'Apply to production' })).toBeDisabled()
    expect(onApply).not.toHaveBeenCalled()
  })

  it('keeps an approved sandbox recoverable when the production apply request fails', async () => {
    const user = userEvent.setup()
    const onApply = vi.fn<CreativeProductionApply>().mockResolvedValue('Server refused the Creative change set.')
    render(<Harness project={testProject()} onApply={onApply} />)
    await approveFullWorkflow(user)

    await user.click(screen.getByRole('button', { name: 'Apply to production' }))
    await waitFor(() => expect(onApply).toHaveBeenCalledTimes(1))
    expect(screen.getByText('Server refused the Creative change set.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Apply to production' })).toBeEnabled()
    expect(screen.queryByRole('button', { name: 'Applied to production' })).not.toBeInTheDocument()
  })

  it('fails closed when the production project revision changes underneath an approved Creative sandbox', async () => {
    const user = userEvent.setup()
    const base = testProject()
    const onApply = vi.fn<CreativeProductionApply>().mockResolvedValue(null)
    const { rerender } = render(<Harness project={base} onApply={onApply} />)
    await approveFullWorkflow(user)

    rerender(<Harness project={Object.freeze({ ...base, revision: base.revision + 1 })} onApply={onApply} />)
    await user.click(screen.getByRole('button', { name: 'Apply to production' }))

    expect(onApply).not.toHaveBeenCalled()
    expect(screen.getByText(new RegExp(`Project changed from revision ${base.revision} to ${base.revision + 1}`))).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Rebuild from current revision' })).toBeEnabled()
  })
})
