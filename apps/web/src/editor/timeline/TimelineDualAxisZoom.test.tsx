import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { verticalZoom } from '../../features/timeline'
import { TimelineToolbar, type TimelineToolbarAction } from './TimelineToolbar'

const actions: readonly TimelineToolbarAction[] = [
  'split', 'lift', 'ripple-delete', 'copy', 'cut', 'paste', 'duplicate', 'group',
  'ungroup', 'add-marker', 'close-gap', 'transition', 'linked-audio', 'freeze', 'speed',
]

const renderToolbar = (overrides: Record<string, unknown> = {}) => {
  const handlers = {
    onZoomOut: vi.fn(),
    onZoomIn: vi.fn(),
    onHorizontalZoom: vi.fn(),
    onReduceTrackHeight: vi.fn(),
    onIncreaseTrackHeight: vi.fn(),
    onVerticalZoom: vi.fn(),
    onFitTimeline: vi.fn(),
    onFitTracks: vi.fn(),
    onResetVerticalZoom: vi.fn(),
  }
  render(<TimelineToolbar
    durationTicks={43_200_000}
    timescale={1_440_000}
    viewport={{ pixelsPerSecond: 100, scrollLeftPx: 0, viewportWidthPx: 900 }}
    verticalZoom={verticalZoom(10_000)}
    selectedSummary={null}
    selectedCount={0}
    disabledReasons={Object.fromEntries(actions.map((action) => [action, null])) as Record<TimelineToolbarAction, null>}
    shortcuts={{}}
    tool="select"
    snappingEnabled
    placementMode="normal"
    busy={false}
    onTool={vi.fn()}
    onAction={vi.fn()}
    onToggleSnapping={vi.fn()}
    onPlacementMode={vi.fn()}
    {...handlers}
    {...overrides}
  />)
  return handlers
}

afterEach(cleanup)

describe('dual-axis Timeline zoom controls', () => {
  it('keeps existing horizontal buttons and exposes both native range inputs', () => {
    renderToolbar()
    expect(screen.getByRole('button', { name: 'Zoom Timeline out' })).toBeEnabled()
    expect(screen.getByRole('button', { name: 'Zoom Timeline in' })).toBeEnabled()
    expect(screen.getByRole('slider', { name: 'Timeline horizontal zoom' })).toHaveAttribute('aria-valuetext', '100 pixels per second')
    expect(screen.getByRole('slider', { name: 'Timeline vertical zoom' })).toHaveAttribute('aria-valuetext', '100 percent')
  })

  it('routes sliders, steps, fit actions and reset through their one presentation callbacks', () => {
    const handlers = renderToolbar()
    fireEvent.change(screen.getByRole('slider', { name: 'Timeline horizontal zoom' }), { target: { value: '11' } })
    fireEvent.click(screen.getByRole('button', { name: 'Reduce track height' }))
    fireEvent.click(screen.getByRole('button', { name: 'Increase track height' }))
    fireEvent.change(screen.getByRole('slider', { name: 'Timeline vertical zoom' }), { target: { value: '15000' } })
    fireEvent.click(screen.getByRole('button', { name: 'Fit Timeline horizontally' }))
    fireEvent.click(screen.getByRole('button', { name: 'Fit tracks vertically' }))

    expect(handlers.onHorizontalZoom).toHaveBeenCalledWith(125)
    expect(handlers.onReduceTrackHeight).toHaveBeenCalledTimes(1)
    expect(handlers.onIncreaseTrackHeight).toHaveBeenCalledTimes(1)
    expect(handlers.onVerticalZoom).toHaveBeenCalledWith(15_000)
    expect(handlers.onFitTimeline).toHaveBeenCalledTimes(1)
    expect(handlers.onFitTracks).toHaveBeenCalledTimes(1)
  })

  it('disables step buttons at limits and enables reset away from 100 percent', () => {
    renderToolbar({
      viewport: { pixelsPerSecond: 10, scrollLeftPx: 0, viewportWidthPx: 900 },
      verticalZoom: verticalZoom(20_000),
    })
    expect(screen.getByRole('button', { name: 'Zoom Timeline out' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Increase track height' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Reset vertical zoom' })).toBeEnabled()
  })
})
