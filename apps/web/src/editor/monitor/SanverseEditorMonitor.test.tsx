import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { SanverseEditorMonitor } from './SanverseEditorMonitor'

afterEach(cleanup)

const renderMonitor = () => {
  const callbacks = {
    onTogglePoint: vi.fn(),
    onFitModeChange: vi.fn(),
    onGuidesChange: vi.fn(),
    onTogglePlayback: vi.fn(),
    onStepFrame: vi.fn(),
    onSeek: vi.fn(),
    onMutedChange: vi.fn(),
    onVolumeChange: vi.fn(),
  }
  return {
    ...render(
      <SanverseEditorMonitor
        sourceStatus="Local source available"
        fitMode="fit"
        guides={false}
        pointActive={false}
        pointSelected={false}
        playing={false}
        currentTicks={0}
        durationTicks={43_200_000}
        frameRate={{ numerator: 30, denominator: 1 }}
        muted={false}
        volume={1}
        {...callbacks}
      >
        <video aria-label="Existing video" />
      </SanverseEditorMonitor>,
    ),
    callbacks,
  }
}

describe('SanverseEditorMonitor', () => {
  it('keeps Point and playback outside overflow and exposes editor transport', async () => {
    const { callbacks } = renderMonitor()
    expect(screen.getByRole('region', { name: 'Editor monitor' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Enter Point mode' })).toBeVisible()
    expect(screen.getByRole('button', { name: 'Play' })).toBeVisible()
    expect(screen.getByRole('button', { name: 'Previous frame' })).toBeVisible()
    expect(screen.getByRole('button', { name: 'Next frame' })).toBeVisible()
    expect(screen.getByText('00:00:00:00')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Play' }))
    expect(callbacks.onTogglePlayback).toHaveBeenCalledOnce()
  })

  it('routes viewer, guide, seek, volume and keyboard actions through supplied callbacks', async () => {
    const { callbacks } = renderMonitor()
    await userEvent.selectOptions(screen.getByLabelText('Viewer mode'), 'fill')
    expect(callbacks.onFitModeChange).toHaveBeenCalledWith('fill')
    await userEvent.click(screen.getByRole('button', { name: 'Toggle guides' }))
    expect(callbacks.onGuidesChange).toHaveBeenCalledWith(true)
    fireEvent.change(screen.getByLabelText('Monitor playhead'), { target: { value: '21600000' } })
    expect(callbacks.onSeek).toHaveBeenCalledWith(21_600_000)
    fireEvent.keyDown(screen.getByRole('region', { name: 'Editor monitor' }), { key: 'ArrowRight' })
    expect(callbacks.onStepFrame).toHaveBeenCalledWith(1)
  })

  it('does not steal native keyboard handling from monitor controls', () => {
    const { callbacks } = renderMonitor()
    fireEvent.keyDown(screen.getByRole('button', { name: 'Play' }), { key: ' ' })
    expect(callbacks.onTogglePlayback).not.toHaveBeenCalled()
  })

  it('uses a bounded fullscreen fallback when the browser API is unavailable', async () => {
    const callbacks = {
      onTogglePoint: vi.fn(), onFitModeChange: vi.fn(), onGuidesChange: vi.fn(),
      onTogglePlayback: vi.fn(), onStepFrame: vi.fn(), onSeek: vi.fn(),
      onMutedChange: vi.fn(), onVolumeChange: vi.fn(),
    }
    render(<SanverseEditorMonitor sourceStatus="Local source available" fitMode="fit" guides={false} pointActive={false} pointSelected={false} playing={false} currentTicks={0} durationTicks={43_200_000} frameRate={{ numerator: 30, denominator: 1 }} muted={false} volume={1} {...callbacks}><video /></SanverseEditorMonitor>)
    await userEvent.click(screen.getByRole('button', { name: 'Enter fullscreen' }))
    expect(screen.getByRole('region', { name: 'Editor monitor' })).toHaveClass('editor-monitor--fullscreen-fallback')
    expect(screen.getByRole('button', { name: 'Exit fullscreen' })).toBeVisible()
  })
})
