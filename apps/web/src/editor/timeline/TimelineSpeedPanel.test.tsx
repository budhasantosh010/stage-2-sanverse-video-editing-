import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'

import { NORMAL_PLAYBACK_RATE } from '@sanverse/edit-domain/clip-time'

import { TimelineSpeedPanel, type TimelineSpeedPanelProps } from './TimelineSpeedPanel'

const S = 1_440_000

const renderPanel = (overrides: Partial<TimelineSpeedPanelProps> = {}) => {
  const onChoose = vi.fn()
  const onClose = vi.fn()
  const props: TimelineSpeedPanelProps = {
    open: true,
    clipLabel: 'Video 1',
    unavailableReason: null,
    currentRate: NORMAL_PLAYBACK_RATE,
    maintainAudioPitch: true,
    currentDurationTicks: 10 * S,
    sourceDurationTicks: 10 * S,
    timescale: S,
    busy: false,
    previewFor: (rate) => `preview ${rate.numerator}/${rate.denominator}`,
    onChoose,
    onClose,
    ...overrides,
  }
  render(<TimelineSpeedPanel {...props} />)
  return { onChoose, onClose }
}

describe('the speed panel', () => {
  it('draws nothing at all when it is closed', () => {
    renderPanel({ open: false })
    expect(screen.queryByRole('group', { name: 'Speed' })).toBeNull()
  })

  it('offers the eight one-click speeds', () => {
    renderPanel()
    for (const label of ['0.25x', '0.5x', '0.75x', '1x', '1.25x', '1.5x', '2x', '4x']) {
      expect(screen.getByRole('button', { name: label })).toBeTruthy()
    }
  })

  it('marks the speed the piece is already at', () => {
    renderPanel({ currentRate: { numerator: 2, denominator: 1 } })
    expect(screen.getByRole('button', { name: '2x' }).getAttribute('aria-pressed')).toBe('true')
    expect(screen.getByRole('button', { name: '1x' }).getAttribute('aria-pressed')).toBe('false')
  })

  it('says how long the piece is and how much recording it uses', () => {
    renderPanel({ currentDurationTicks: 5 * S, sourceDurationTicks: 10 * S })
    expect(screen.getByText(/5\.00s on screen, made from 10\.00s of recording/)).toBeTruthy()
  })

  it('hands the chosen speed straight to the caller', () => {
    const { onChoose } = renderPanel()
    fireEvent.click(screen.getByRole('button', { name: '2x' }))
    expect(onChoose).toHaveBeenCalledWith({ numerator: 2, denominator: 1 }, true)
  })

  it('shows the PLANNER’S OWN sentence on every speed button, not one of its own', () => {
    renderPanel()
    expect(screen.getByRole('button', { name: '2x' }).getAttribute('title')).toBe('preview 2/1')
    expect(screen.getByRole('button', { name: '0.5x' }).getAttribute('title')).toBe('preview 1/2')
  })

  it('takes a typed speed and turns it into a fraction', () => {
    const { onChoose } = renderPanel()
    fireEvent.change(screen.getByPlaceholderText('1.5x or 150%'), { target: { value: '150%' } })
    fireEvent.click(screen.getByRole('button', { name: 'Use it' }))
    expect(onChoose).toHaveBeenCalledWith({ numerator: 3, denominator: 2 }, true)
  })

  it('accepts Enter in the box as well as the button', () => {
    const { onChoose } = renderPanel()
    const box = screen.getByPlaceholderText('1.5x or 150%')
    fireEvent.change(box, { target: { value: '0.5' } })
    fireEvent.keyDown(box, { key: 'Enter' })
    expect(onChoose).toHaveBeenCalledWith({ numerator: 1, denominator: 2 }, true)
  })

  it('says what to type when the box holds something it cannot use, and changes nothing', () => {
    const { onChoose } = renderPanel()
    fireEvent.change(screen.getByPlaceholderText('1.5x or 150%'), { target: { value: 'fast' } })
    fireEvent.click(screen.getByRole('button', { name: 'Use it' }))
    expect(onChoose).not.toHaveBeenCalled()
    expect(screen.getByText(/Type a speed like 2, 0\.5, 1\.5x or 150%/)).toBeTruthy()
  })

  it('names the slowest and the fastest it will go', () => {
    renderPanel()
    expect(screen.getByText('Anything from 0.1x to 16x.')).toBeTruthy()
  })

  it('passes the pitch switch along with the speed', () => {
    const { onChoose } = renderPanel()
    fireEvent.click(screen.getByRole('checkbox', { name: /Keep voices sounding normal/ }))
    fireEvent.click(screen.getByRole('button', { name: '2x' }))
    expect(onChoose).toHaveBeenCalledWith({ numerator: 2, denominator: 1 }, false)
  })

  it('shows the backwards switch, refuses to let it be pressed, and says why', () => {
    renderPanel()
    const backwards = screen.getByRole('checkbox', { name: /Play it backwards/ }) as HTMLInputElement
    expect(backwards.disabled).toBe(true)
    expect(screen.getByText(/Not ready yet\. It needs a backwards copy of the footage/)).toBeTruthy()
  })

  it('offers a way back to normal, and greys it out when it is already normal', () => {
    renderPanel()
    expect((screen.getByRole('button', { name: 'Back to normal speed' }) as HTMLButtonElement).disabled).toBe(true)
  })

  it('lets the way back be pressed once the piece has been retimed', () => {
    const { onChoose } = renderPanel({ currentRate: { numerator: 2, denominator: 1 } })
    fireEvent.click(screen.getByRole('button', { name: 'Back to normal speed' }))
    expect(onChoose).toHaveBeenCalledWith(NORMAL_PLAYBACK_RATE, true)
  })

  it('says WHY instead of showing speeds when nothing suitable is picked', () => {
    renderPanel({
      unavailableReason: 'Choose a piece of the main video first. B-roll, pictures and music cannot be sped up yet.',
    })
    expect(screen.getByText(/Choose a piece of the main video first/)).toBeTruthy()
    expect(screen.queryByRole('button', { name: '2x' })).toBeNull()
  })

  it('refuses every control while an export is running', () => {
    renderPanel({ busy: true, currentRate: { numerator: 2, denominator: 1 } })
    expect((screen.getByRole('button', { name: '4x' }) as HTMLButtonElement).disabled).toBe(true)
    expect((screen.getByRole('button', { name: 'Back to normal speed' }) as HTMLButtonElement).disabled).toBe(true)
    expect((screen.getByPlaceholderText('1.5x or 150%') as HTMLInputElement).disabled).toBe(true)
  })

  it('can be closed without changing anything', () => {
    const { onChoose, onClose } = renderPanel()
    fireEvent.click(screen.getByRole('button', { name: 'Close the speed panel' }))
    expect(onClose).toHaveBeenCalled()
    expect(onChoose).not.toHaveBeenCalled()
  })
})
