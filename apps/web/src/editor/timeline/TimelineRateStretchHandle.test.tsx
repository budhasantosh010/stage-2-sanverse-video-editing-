import type { ComponentProps } from 'react'
import { fireEvent, render, screen } from '@testing-library/react'

const dispatchPointer = (
  target: Element,
  type: 'pointerdown' | 'pointermove' | 'pointerup' | 'pointercancel',
  values: Readonly<Record<string, number | boolean>>,
) => {
  const event = new Event(type, { bubbles: true, cancelable: true })
  for (const [key, value] of Object.entries(values)) {
    Object.defineProperty(event, key, { configurable: true, value })
  }
  fireEvent(target, event)
}
import { describe, expect, it, vi } from 'vitest'

import { TimelineRateStretchHandle } from './TimelineRateStretchHandle'

const renderHandle = (overrides: Partial<ComponentProps<typeof TimelineRateStretchHandle>> = {}) => {
  const onDraft = vi.fn()
  const onCommit = vi.fn()
  const onSnapGuide = vi.fn()
  const pointerTime = vi.fn((clientX: number, _excluded?: readonly number[], bypass?: boolean) => ({
    ticks: Math.round(clientX * 1_000),
    snappedToTicks: bypass ? null : Math.round(clientX * 1_000),
  }))
  const previewFor = vi.fn((targetDurationTicks: number) => ({
    ok: targetDurationTicks >= 1_000,
    message: targetDurationTicks >= 1_000 ? `Use ${targetDurationTicks}` : 'Too short',
  }))
  render(
    <TimelineRateStretchHandle
      itemStartTicks={10_000}
      itemDurationTicks={20_000}
      disabled={false}
      pointerTime={pointerTime}
      previewFor={previewFor}
      onSnapGuide={onSnapGuide}
      onDraft={onDraft}
      onCommit={onCommit}
      {...overrides}
    />,
  )
  const handle = screen.getByRole('button', { name: 'Rate Stretch clip duration' })
  Object.defineProperty(handle, 'setPointerCapture', { value: vi.fn(), configurable: true })
  Object.defineProperty(handle, 'releasePointerCapture', { value: vi.fn(), configurable: true })
  Object.defineProperty(handle, 'hasPointerCapture', { value: vi.fn(() => true), configurable: true })
  return { handle, onDraft, onCommit, onSnapGuide, pointerTime, previewFor }
}

describe('TimelineRateStretchHandle', () => {
  it('shows a detached draft while moving and commits exactly once on release', () => {
    const { handle, onDraft, onCommit } = renderHandle()
    dispatchPointer(handle, 'pointerdown', { pointerId: 1, button: 0, clientX: 30 })
    dispatchPointer(handle, 'pointermove', { pointerId: 1, clientX: 35 })
    expect(onDraft).toHaveBeenLastCalledWith(25_000, { ok: true, message: 'Use 25000' })
    expect(onCommit).not.toHaveBeenCalled()
    dispatchPointer(handle, 'pointerup', { pointerId: 1, clientX: 35 })
    expect(onCommit).toHaveBeenCalledTimes(1)
    expect(onCommit).toHaveBeenCalledWith(25_000)
    expect(onDraft).toHaveBeenLastCalledWith(null, null)
  })

  it('refuses the release when the same preview planner says the duration is invalid', () => {
    const previewFor = vi.fn(() => ({ ok: false, message: 'Outside the speed range' }))
    const { handle, onCommit, onDraft } = renderHandle({ previewFor })
    dispatchPointer(handle, 'pointerdown', { pointerId: 2, button: 0 })
    dispatchPointer(handle, 'pointermove', { pointerId: 2, clientX: 40 })
    expect(onDraft).toHaveBeenCalledWith(30_000, { ok: false, message: 'Outside the speed range' })
    dispatchPointer(handle, 'pointerup', { pointerId: 2, clientX: 40 })
    expect(onCommit).not.toHaveBeenCalled()
  })

  it('Escape and pointer cancellation create no edit', () => {
    const { handle, onCommit, onDraft } = renderHandle()
    dispatchPointer(handle, 'pointerdown', { pointerId: 3, button: 0 })
    dispatchPointer(handle, 'pointermove', { pointerId: 3, clientX: 38 })
    fireEvent.keyDown(handle, { key: 'Escape' })
    expect(onDraft).toHaveBeenLastCalledWith(null, null)
    expect(onCommit).not.toHaveBeenCalled()

    dispatchPointer(handle, 'pointerdown', { pointerId: 4, button: 0 })
    dispatchPointer(handle, 'pointermove', { pointerId: 4, clientX: 39 })
    dispatchPointer(handle, 'pointercancel', { pointerId: 4 })
    expect(onCommit).not.toHaveBeenCalled()
  })

  it('uses Shift only for this gesture to bypass snapping', () => {
    const { handle, pointerTime } = renderHandle()
    dispatchPointer(handle, 'pointerdown', { pointerId: 5, button: 0 })
    dispatchPointer(handle, 'pointermove', { pointerId: 5, clientX: 35, shiftKey: true })
    expect(pointerTime).toHaveBeenLastCalledWith(35, [10_000, 30_000], true)
  })
})
