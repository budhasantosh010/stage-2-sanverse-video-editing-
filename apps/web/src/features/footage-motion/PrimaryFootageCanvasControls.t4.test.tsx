import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { DEFAULT_VISUAL_PROPERTIES, mediaTime, PROJECT_TIMESCALE } from '@sanverse/edit-domain'
import type { FootageMotionDraft } from './FootageMotionInspector'
import { PrimaryFootageCanvasControls } from './PrimaryFootageCanvasControls'

const S = PROJECT_TIMESCALE
const draft = (): FootageMotionDraft => Object.freeze({
  motionId: 'motion_canvas_t4',
  assetId: 'asset_canvas_t4',
  sourceInterval: Object.freeze({ start: mediaTime(10 * S), duration: mediaTime(4 * S) }),
  transform: DEFAULT_VISUAL_PROPERTIES.transform,
  crop: DEFAULT_VISUAL_PROPERTIES.crop,
  tracks: Object.freeze([Object.freeze({
    property: 'translate-x' as const,
    keyframes: Object.freeze([
      Object.freeze({ at: mediaTime(0), value: 0, easing: Object.freeze({ kind: 'linear' as const }) }),
      Object.freeze({ at: mediaTime(2 * S), value: 0.2, easing: Object.freeze({ kind: 'linear' as const }) }),
      Object.freeze({ at: mediaTime(4 * S), value: 0, easing: Object.freeze({ kind: 'linear' as const }) }),
    ]),
  })]),
})

const renderCanvas = (keyframeEditProperties: readonly ('translate-x' | 'translate-y')[]) => {
  let current = draft()
  const setDraft = vi.fn((next: FootageMotionDraft | ((current: FootageMotionDraft | null) => FootageMotionDraft | null) | null) => {
    current = typeof next === 'function' ? next(current)! : next ?? current
  })
  const onCommit = vi.fn((next: FootageMotionDraft) => { current = next })
  render(<PrimaryFootageCanvasControls
    draft={current}
    sourceTime={mediaTime(12 * S)}
    keyframeEditProperties={keyframeEditProperties}
    setDraft={setDraft as never}
    busy={false}
    narrow={false}
    cropMode={false}
    onCropModeChange={() => undefined}
    onCommit={onCommit}
    onPausePlayback={() => undefined}
    onFocusInspector={() => undefined}
  />)
  return { setDraft, onCommit, current: () => current }
}

describe('T4 primary Canvas keyframe synchronization', () => {
  it('does not create or rewrite a keyframe when T4 keyframe selection is not active', () => {
    const result = renderCanvas([])
    fireEvent.keyDown(screen.getByRole('button', { name: /Move primary footage/i }), { key: 'ArrowRight' })
    expect(result.onCommit).toHaveBeenCalledTimes(1)
    const committed = result.onCommit.mock.calls[0][0] as FootageMotionDraft
    expect(committed.transform.translateX).toBe(0.01)
    expect(committed.tracks[0].keyframes.map((frame) => [frame.at.ticks, frame.value])).toEqual([
      [0, 0], [2 * S, 0.2], [4 * S, 0],
    ])
  })

  it('edits the explicit selected source keyframe and leaves the static base untouched', () => {
    const result = renderCanvas(['translate-x'])
    fireEvent.keyDown(screen.getByRole('button', { name: /Move primary footage/i }), { key: 'ArrowRight' })
    expect(result.onCommit).toHaveBeenCalledTimes(1)
    const committed = result.onCommit.mock.calls[0][0] as FootageMotionDraft
    expect(committed.transform.translateX).toBe(0)
    expect(committed.tracks[0].keyframes.map((frame) => [frame.at.ticks, frame.value])).toEqual([
      [0, 0], [2 * S, 0.01], [4 * S, 0],
    ])
  })
})
