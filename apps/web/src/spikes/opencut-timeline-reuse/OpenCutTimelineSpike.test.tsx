import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { acceptChangeSet, type TimelineOperation } from '@sanverse/edit-domain'
import {
  changeSetOf,
  testCaptions,
  testMultiAssetProject,
  testMusic,
  testTitle,
} from '@sanverse/edit-domain/test-fixtures'

import { OpenCutTimelineSpike } from './OpenCutTimelineSpike'
import { createOpenCutTimelineSpikeViewModel } from './sanverse-timeline-adapter'

const fixtureProject = () => {
  const base = testMultiAssetProject()
  const accepted = acceptChangeSet(
    base,
    changeSetOf(
      'changeset_spike001',
      base.revision,
      [testTitle(), testCaptions(), testMusic()],
    ),
  )
  if (!accepted.ok) throw new Error(`fixture failed: ${JSON.stringify(accepted.error)}`)
  return accepted.value
}

describe('bounded OpenCut timeline reuse spike', () => {
  it('derives the four required lanes from the Sanverse project without a second project model', () => {
    const model = createOpenCutTimelineSpikeViewModel(fixtureProject())

    expect(model.items.map((item) => item.kind)).toEqual([
      'title',
      'video',
      'caption',
      'music',
    ])
    expect(model.durationTicks).toBe(30 * model.timescale)
  })

  it('keeps presentation state local and emits one Sanverse split operation', async () => {
    const user = userEvent.setup()
    const onOperation = vi.fn<(operation: TimelineOperation) => void>()
    const project = fixtureProject()

    render(
      <OpenCutTimelineSpike
        project={project}
        onOperation={onOperation}
        makeOperationId={() => 'operation_spike001'}
        makeClipId={() => 'clip_spike0001'}
      />,
    )

    await user.click(screen.getByRole('button', { name: 'Select primary video clip' }))
    await user.click(screen.getByRole('button', { name: 'Seek to 12 seconds' }))
    fireEvent.change(screen.getByRole('slider', { name: 'Timeline zoom' }), {
      target: { value: '0.55' },
    })

    const viewport = screen.getByTestId('opencut-spike-viewport')
    Object.defineProperty(viewport, 'scrollLeft', { configurable: true, value: 120 })
    fireEvent.scroll(viewport)

    expect(viewport).toHaveAttribute('data-scroll-left', '120')
    expect(screen.getByTestId('opencut-spike-playhead')).toHaveAttribute(
      'data-playhead-seconds',
      '12',
    )

    await user.click(screen.getByRole('button', { name: 'Split selected clip at playhead' }))

    expect(onOperation).toHaveBeenCalledTimes(1)
    expect(onOperation.mock.calls[0][0]).toMatchObject({
      schemaVersion: 'sanverse.operation/v3',
      operationId: 'operation_spike001',
      kind: 'split-clip',
      clipId: 'clip_aaaaaaaa',
      atClipTime: { ticks: 17_280_000, timescale: 1_440_000 },
      newClipId: 'clip_spike0001',
    })
  })
})
