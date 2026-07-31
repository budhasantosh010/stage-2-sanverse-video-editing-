import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'

import type { EditOperation, EditProject } from '@sanverse/edit-domain'

import { testProject } from '../../test-fixtures'
import { projectWithAllTimelineFamilies } from '../../features/timeline/timeline-test-fixtures'
import { buildTimelineViewModel } from '../../features/timeline'
import { Inspector } from './Inspector'
import { resolveInspectorSelection } from './inspector-selection-resolver'

afterEach(cleanup)

const labels = Object.freeze({
  asset_aaaaaaaa: 'owner.mp4',
  asset_image0001: 'product.png',
  asset_broll0001: 'demo.mp4',
  asset_music0001: 'theme.wav',
})

const selectionFor = (project: EditProject, kind: string) => {
  const first = buildTimelineViewModel({ project, selectedItemId: null, pending: null, assetLabels: labels })
  const item = first.lanes.flatMap((lane) => lane.items).find((candidate) => candidate.kind === kind)
  if (!item) throw new Error(`missing ${kind}`)
  const timeline = buildTimelineViewModel({ project, selectedItemId: item.id, pending: null, assetLabels: labels })
  return resolveInspectorSelection({
    project,
    timeline,
    selectedTimelineItemId: item.id,
    pending: null,
    assetLabels: labels,
  })
}

const renderInspector = (project: EditProject, kind: string, overrides: Partial<React.ComponentProps<typeof Inspector>> = {}) => {
  const onApply = vi.fn(async (_operation: EditOperation): Promise<string | null> => null)
  const onDirtyChange = vi.fn()
  render(
    <Inspector
      selection={selectionFor(project, kind)}
      assets={project.assets}
      busy={false}
      proposalActionsBusy={false}
      playheadTicks={5 * 1_440_000}
      pendingSelectionChange={null}
      onDirtyChange={onDirtyChange}
      onStaySelection={vi.fn()}
      onDiscardSelection={vi.fn()}
      onAcceptProposal={vi.fn()}
      onRejectProposal={vi.fn()}
      onOpenProposal={vi.fn()}
      onSeek={vi.fn()}
      onApply={onApply}
      {...overrides}
    />,
  )
  return { onApply, onDirtyChange }
}

const sectionFor = (name: string): HTMLElement => {
  const toggle = screen.getByRole('button', { name })
  const section = toggle.closest('section')
  if (!section) throw new Error(`section missing: ${name}`)
  return section
}

describe('Inspector editing', () => {
  it('applies clip audio through one existing set-clip-audio operation', async () => {
    const user = userEvent.setup()
    const { onApply, onDirtyChange } = renderInspector(testProject(), 'clip')
    const sound = sectionFor('Sound')
    fireEvent.change(within(sound).getByLabelText('Gain (dB)'), { target: { value: '-6' } })
    await waitFor(() => expect(onDirtyChange).toHaveBeenLastCalledWith(true))
    await user.click(within(sound).getByRole('button', { name: 'Apply' }))
    await waitFor(() => expect(onApply).toHaveBeenCalledTimes(1))
    expect(onApply.mock.calls[0][0]).toMatchObject({
      kind: 'set-clip-audio',
      gainDb: -6,
      clipId: 'clip_aaaaaaaa',
    })
  })

  it('resets a local clip draft without creating an operation', async () => {
    const user = userEvent.setup()
    const { onApply } = renderInspector(testProject(), 'clip')
    const sound = sectionFor('Sound')
    const gain = within(sound).getByLabelText('Gain (dB)')
    fireEvent.change(gain, { target: { value: '-12' } })
    await user.click(within(sound).getByRole('button', { name: 'Reset' }))
    expect(gain).toHaveValue(0)
    expect(onApply).not.toHaveBeenCalled()
  })

  it('applies a title repair and preserves the existing title identity', async () => {
    const user = userEvent.setup()
    const project = projectWithAllTimelineFamilies()
    const { onApply } = renderInspector(project, 'title')
    const title = sectionFor('Title')
    const headline = within(title).getByLabelText('Title headline')
    await user.clear(headline)
    await user.type(headline, 'A clearer point')
    await user.click(within(title).getByRole('button', { name: 'Apply' }))
    await waitFor(() => expect(onApply).toHaveBeenCalledTimes(1))
    expect(onApply.mock.calls[0][0]).toMatchObject({
      kind: 'set-title',
      titleId: expect.stringMatching(/^title_/),
      headline: 'A clearer point',
    })
  })

  it('applies transform and keyframes as one full-state visual-properties operation', async () => {
    const user = userEvent.setup()
    const project = projectWithAllTimelineFamilies()
    const { onApply } = renderInspector(project, 'title')
    const transform = sectionFor('Transform')
    fireEvent.change(within(transform).getByLabelText('Scale (%)'), { target: { value: '125' } })

    const keyframes = sectionFor('Keyframes V1')
    await user.click(within(keyframes).getByRole('button', { name: 'Keyframes V1' }))
    await user.click(within(keyframes).getByLabelText('Enable keyframes'))
    await user.click(within(keyframes).getByRole('button', { name: 'Add at playhead' }))
    await user.click(within(screen.getByRole('region', { name: 'Apply visual properties' })).getByRole('button', { name: 'Apply' }))

    await waitFor(() => expect(onApply).toHaveBeenCalledTimes(1))
    expect(onApply.mock.calls[0][0]).toMatchObject({
      kind: 'set-visual-properties',
      transform: { scale: 1.25 },
      tracks: [{ property: 'scale', keyframes: expect.any(Array) }],
    })
    const visualOperation = onApply.mock.calls[0][0]
    if (visualOperation.kind !== 'set-visual-properties') throw new Error('visual operation missing')
    expect(visualOperation.tracks[0]?.keyframes.length).toBeGreaterThanOrEqual(2)
  })

  it('shows a validation message and sends nothing for an impossible crop', async () => {
    const user = userEvent.setup()
    const project = projectWithAllTimelineFamilies()
    const { onApply } = renderInspector(project, 'title')
    const crop = sectionFor('Crop')
    await user.click(within(crop).getByRole('button', { name: 'Crop' }))
    fireEvent.change(within(crop).getByLabelText('Crop top (%)'), { target: { value: '60' } })
    fireEvent.change(within(crop).getByLabelText('Crop bottom (%)'), { target: { value: '60' } })
    await user.click(within(screen.getByRole('region', { name: 'Apply visual properties' })).getByRole('button', { name: 'Apply' }))
    expect(await screen.findByText(/outside the supported range/i)).toBeInTheDocument()
    expect(onApply).not.toHaveBeenCalled()
  })

  it('maps Mute music to the existing minimum-gain repair', async () => {
    const user = userEvent.setup()
    const project = projectWithAllTimelineFamilies()
    const { onApply } = renderInspector(project, 'music')
    const music = sectionFor('Music')
    await user.click(within(music).getByLabelText('Mute music'))
    await user.click(within(music).getByRole('button', { name: 'Apply' }))
    await waitFor(() => expect(onApply).toHaveBeenCalledTimes(1))
    expect(onApply.mock.calls[0][0]).toMatchObject({ kind: 'set-music', gainDb: -60 })
  })
})
