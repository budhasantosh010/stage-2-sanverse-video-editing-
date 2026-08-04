import { describe, expect, it } from 'vitest'

import {
  advancePlayback,
  isUncutPassthrough,
  nextVisibleTick,
  segmentIndexAt,
  sourceTimeFor,
  type PlaybackSegment,
} from './segment-playback'

const S = 1_440_000

/** The recording is 30 s. The finished video below keeps 0-10 s and 20-30 s. */
const withHole: readonly PlaybackSegment[] = [
  { startTicks: 0, durationTicks: 10 * S, sourceStartTicks: 0, assetId: 'asset_aaaaaaaa', videoEnabled: true, audioEnabled: true },
  { startTicks: 15 * S, durationTicks: 10 * S, sourceStartTicks: 20 * S, assetId: 'asset_aaaaaaaa', videoEnabled: true, audioEnabled: true },
]

/** The same two stretches, but the gap was closed. */
const rippled: readonly PlaybackSegment[] = [
  { startTicks: 0, durationTicks: 10 * S, sourceStartTicks: 0, assetId: 'asset_aaaaaaaa', videoEnabled: true, audioEnabled: true },
  { startTicks: 10 * S, durationTicks: 10 * S, sourceStartTicks: 20 * S, assetId: 'asset_aaaaaaaa', videoEnabled: true, audioEnabled: true },
]

/** The second half of the recording placed first. */
const reordered: readonly PlaybackSegment[] = [
  { startTicks: 0, durationTicks: 20 * S, sourceStartTicks: 10 * S, assetId: 'asset_aaaaaaaa', videoEnabled: true, audioEnabled: true },
  { startTicks: 20 * S, durationTicks: 10 * S, sourceStartTicks: 0, assetId: 'asset_aaaaaaaa', videoEnabled: true, audioEnabled: true },
]

const uncut: readonly PlaybackSegment[] = [
  { startTicks: 0, durationTicks: 30 * S, sourceStartTicks: 0, assetId: 'asset_aaaaaaaa', videoEnabled: true, audioEnabled: true },
]

describe('finding a moment of the finished video in the recording', () => {
  it('maps a moment after a closed gap back to the right part of the recording', () => {
    // 12 s of the finished cut is 22 s of the recording.
    expect(sourceTimeFor(rippled, 12 * S)).toEqual({ segmentIndex: 1, sourceTicks: 22 * S })
  })

  it('maps a reordered moment back to the right part of the recording', () => {
    expect(sourceTimeFor(reordered, 1 * S)).toEqual({ segmentIndex: 0, sourceTicks: 11 * S })
    expect(sourceTimeFor(reordered, 21 * S)).toEqual({ segmentIndex: 1, sourceTicks: 1 * S })
  })

  it('reports a hole as nothing to show, rather than guessing a frame', () => {
    expect(segmentIndexAt(withHole, 12 * S)).toBe(-1)
    expect(sourceTimeFor(withHole, 12 * S)).toBeNull()
  })

  it('treats the last instant of a stretch as outside it, exactly as the exporter does', () => {
    expect(segmentIndexAt(rippled, 10 * S - 1)).toBe(0)
    expect(segmentIndexAt(rippled, 10 * S)).toBe(1)
  })

  it('finds the next moment that shows something', () => {
    expect(nextVisibleTick(withHole, 12 * S)).toBe(15 * S)
    expect(nextVisibleTick(withHole, 5 * S)).toBe(5 * S)
    expect(nextVisibleTick(withHole, 26 * S)).toBeNull()
  })
})

describe('deciding what to do next while playing', () => {
  it('costs nothing while a stretch is still running', () => {
    const action = advancePlayback(rippled, 0, 3 * S, 20 * S)
    expect(action).toEqual({ kind: 'show', compositionTicks: 3 * S, segmentIndex: 0 })
  })

  it('jumps to the next stretch when the recording runs past the end of this one', () => {
    // The recording is at 10 s, which is past the end of the first stretch. The
    // finished video continues at 20 s of the recording, so it must jump.
    const action = advancePlayback(rippled, 0, 10 * S, 20 * S)
    expect(action).toEqual({
      kind: 'seek',
      sourceTicks: 20 * S,
      compositionTicks: 10 * S,
      segmentIndex: 1,
    })
  })

  it('jumps backwards when the running order was changed', () => {
    const action = advancePlayback(reordered, 0, 30 * S, 30 * S)
    expect(action).toEqual({
      kind: 'seek',
      sourceTicks: 0,
      compositionTicks: 20 * S,
      segmentIndex: 1,
    })
  })

  it('shows black for a hole, and says exactly how long it lasts', () => {
    const action = advancePlayback(withHole, 0, 10 * S, 25 * S)
    expect(action).toEqual({ kind: 'hole', compositionTicks: 10 * S, untilTicks: 15 * S })
  })

  it('ends after the last stretch instead of looping or stalling', () => {
    expect(advancePlayback(rippled, 1, 30 * S, 20 * S)).toEqual({
      kind: 'ended',
      compositionTicks: 20 * S,
    })
  })

  it('shows the new beginning after a cut removed the footage under the playhead', () => {
    // Found in the browser, not by a test: removing the opening section leaves
    // the recording parked at a moment the finished video no longer contains.
    // Reporting that as "ended" froze the preview on the old frame.
    const afterOpeningRemoved: readonly PlaybackSegment[] = [
      { startTicks: 0, durationTicks: 10 * S, sourceStartTicks: 4 * S, assetId: 'asset_aaaaaaaa', videoEnabled: true, audioEnabled: true },
    ]
    expect(advancePlayback(afterOpeningRemoved, 0, 2 * S, 10 * S)).toEqual({
      kind: 'seek',
      sourceTicks: 4 * S,
      compositionTicks: 0,
      segmentIndex: 0,
    })
  })

  it('follows the user dragging the browser scrubber into another stretch', () => {
    // 22 s of the recording is inside the second stretch, which is 12 s of the
    // finished video — not the end of anything.
    expect(advancePlayback(rippled, 0, 22 * S, 20 * S)).toEqual({
      kind: 'show',
      compositionTicks: 12 * S,
      segmentIndex: 1,
    })
  })

  it('recovers rather than freezing when the expected stretch no longer exists', () => {
    // A cut can be undone while the video is playing, so the index the screen
    // is holding may name a stretch that has gone. The recording's position is
    // still meaningful, so it is used rather than treated as a failure.
    expect(advancePlayback(rippled, 9, 3 * S, 20 * S)).toEqual({
      kind: 'show',
      compositionTicks: 3 * S,
      segmentIndex: 0,
    })
  })

  it('reports an empty video as ended rather than dividing by nothing', () => {
    expect(advancePlayback([], 0, 0, 0)).toEqual({ kind: 'ended', compositionTicks: 0 })
  })
})

describe('the uncut case', () => {
  it('recognises a video that has not been cut, so playback stays untouched', () => {
    expect(isUncutPassthrough(uncut)).toBe(true)
    expect(isUncutPassthrough(rippled)).toBe(false)
    expect(isUncutPassthrough(reordered)).toBe(false)
    expect(isUncutPassthrough(withHole)).toBe(false)
  })
})
