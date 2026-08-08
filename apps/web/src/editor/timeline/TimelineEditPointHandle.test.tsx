import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { TimelineEditPointHandle } from './TimelineEditPointHandle'

const editPoint = Object.freeze({
  trackId: 'lane:video',
  leftItemId: 'clip:clip_aaaaaaaa',
  rightItemId: 'clip:clip_bbbbbbbb',
  compositionTicks: 14_400_000,
})

const renderHandle = () => {
  const onSelect = vi.fn()
  const onCommit = vi.fn()
  const onSnapGuide = vi.fn()
  render(
    <TimelineEditPointHandle
      editPoint={editPoint}
      leftClipId="clip_aaaaaaaa"
      rightClipId="clip_bbbbbbbb"
      timescale={1_440_000}
      pixelsPerSecond={100}
      selected={false}
      disabled={false}
      frameTicks={48_000}
      pointerTime={() => Object.freeze({ ticks: editPoint.compositionTicks, snappedToTicks: editPoint.compositionTicks })}
      previewFor={() => Object.freeze({
        ok: false as const,
        refusal: Object.freeze({
          code: 'INVALID_EDIT_POINT' as const,
          message: 'No movement',
          blockingItemId: null,
          requestedTicks: null,
          availableTicks: null,
        }),
      })}
      onDraft={() => undefined}
      onSelect={onSelect}
      onSnapGuide={onSnapGuide}
      onCommit={onCommit}
    />,
  )
  const handle = screen.getByRole('button', { name: /Edit point at/i })
  return { handle, onSelect, onCommit }
}

const dispatchPointerDown = (target: Element, modifiers: Readonly<{ ctrlKey?: boolean; metaKey?: boolean }> = {}) => {
  const event = new Event('pointerdown', { bubbles: true, cancelable: true })
  for (const [key, value] of Object.entries({ pointerId: 1, button: 0, clientX: 10, ...modifiers })) {
    Object.defineProperty(event, key, { configurable: true, value })
  }
  fireEvent(target, event)
}

describe('TimelineEditPointHandle', () => {
  it('does not toggle a Ctrl-selected edit point off again when the pointer-generated click follows', () => {
    const { handle, onSelect } = renderHandle()
    dispatchPointerDown(handle, { ctrlKey: true })
    fireEvent.click(handle, { ctrlKey: true })

    expect(onSelect).toHaveBeenCalledTimes(1)
    expect(onSelect).toHaveBeenCalledWith(editPoint, expect.objectContaining({ ctrlKey: true }))
  })

  it('still supports keyboard-generated click selection when there was no pointerdown', () => {
    const { handle, onSelect } = renderHandle()
    fireEvent.click(handle, { metaKey: true })

    expect(onSelect).toHaveBeenCalledTimes(1)
    expect(onSelect).toHaveBeenCalledWith(editPoint, expect.objectContaining({ metaKey: true }))
  })
})
