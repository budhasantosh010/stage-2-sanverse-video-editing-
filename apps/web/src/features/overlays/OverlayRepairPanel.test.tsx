import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import {
  acceptChangeSet,
  activeOverlayOperations,
} from '@sanverse/edit-domain'
import {
  changeSetOf,
  testMultiAssetProject,
  testMusic,
  testTitle,
} from '@sanverse/edit-domain/test-fixtures'

import { OverlayRepairPanel } from './OverlayRepairPanel'

const projectWith = (...operations: Parameters<typeof changeSetOf>[2]) => {
  const base = testMultiAssetProject()
  const accepted = acceptChangeSet(
    base,
    changeSetOf('changeset_overlays1', base.revision, operations),
  )
  if (!accepted.ok) throw new Error(`fixture failed: ${JSON.stringify(accepted.error)}`)
  return accepted.value
}

describe('OverlayRepairPanel', () => {
  it('submits a complete title repair that keeps the same title identity', async () => {
    const user = userEvent.setup()
    const project = projectWith(testTitle({ headline: 'Before' }))
    const item = activeOverlayOperations(project)[0]
    const onRepair = vi.fn().mockResolvedValue(null)

    render(
      <OverlayRepairPanel
        editProject={project}
        item={item}
        playheadMs={5_000}
        busy={false}
        onRepair={onRepair}
      />,
    )

    await user.click(screen.getByRole('button', { name: 'Adjust title' }))
    await user.clear(screen.getByLabelText('Main words'))
    await user.type(screen.getByLabelText('Main words'), 'After')
    await user.click(screen.getByRole('button', { name: 'Save title changes' }))

    expect(onRepair).toHaveBeenCalledWith(expect.objectContaining({
      kind: 'set-title',
      titleId: item.kind === 'add-title' ? item.titleId : '',
      headline: 'After',
    }))
  })

  it('changes music loudness without turning it into footage-anchored media', async () => {
    const user = userEvent.setup()
    const project = projectWith(testMusic())
    const item = activeOverlayOperations(project)[0]
    const onRepair = vi.fn().mockResolvedValue(null)

    render(
      <OverlayRepairPanel
        editProject={project}
        item={item}
        playheadMs={7_000}
        busy={false}
        onRepair={onRepair}
      />,
    )

    await user.click(screen.getByRole('button', { name: 'Adjust music' }))
    const gainInput = screen.getByLabelText('Music level in dB')
    fireEvent.change(gainInput, { target: { value: '-24' } })
    expect(gainInput).toHaveValue(-24)
    await user.click(screen.getByRole('button', { name: 'Save music changes' }))

    expect(onRepair).toHaveBeenCalledWith(expect.objectContaining({
      kind: 'set-music',
      compositionStart: { ticks: 0, timescale: 1_440_000 },
      gainDb: -24,
    }))
  })
})
