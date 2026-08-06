import { describe, expect, it } from 'vitest'

import {
  advancePlayback,
  isUncutPassthrough,
  maintainPitchAt,
  playbackRateAt,
  rateOf,
  segmentIndexAt,
  sourceSpanOf,
  sourceTimeFor,
  unpreviewableSegmentIndexes,
  type PlaybackSegment,
} from './segment-playback'

const S = 1_440_000

/**
 * Ten seconds of recording played at 2x, so it lasts FIVE seconds on screen,
 * followed by an ordinary ten-second piece.
 */
const fastThenNormal: readonly PlaybackSegment[] = [
  {
    startTicks: 0,
    durationTicks: 5 * S,
    sourceStartTicks: 0,
    assetId: 'asset_aaaaaaaa',
    videoEnabled: true,
    audioEnabled: true,
    sourceDurationTicks: 10 * S,
    rateNumerator: 2,
    rateDenominator: 1,
  },
  {
    startTicks: 5 * S,
    durationTicks: 10 * S,
    sourceStartTicks: 20 * S,
    assetId: 'asset_aaaaaaaa',
    videoEnabled: true,
    audioEnabled: true,
  },
]

/** Ten seconds of recording at half speed: twenty seconds on screen. */
const slow: readonly PlaybackSegment[] = [
  {
    startTicks: 0,
    durationTicks: 20 * S,
    sourceStartTicks: 0,
    assetId: 'asset_aaaaaaaa',
    videoEnabled: true,
    audioEnabled: true,
    sourceDurationTicks: 10 * S,
    rateNumerator: 1,
    rateDenominator: 2,
  },
]

const plain: readonly PlaybackSegment[] = [
  { startTicks: 0, durationTicks: 30 * S, sourceStartTicks: 0, assetId: 'asset_aaaaaaaa', videoEnabled: true, audioEnabled: true },
]

describe('a stretch that says nothing about speed behaves exactly as it always did', () => {
  it('uses as much recording as it lasts on screen', () => {
    expect(sourceSpanOf(plain[0])).toBe(30 * S)
  })

  it('reads as normal speed with its pitch kept', () => {
    expect(rateOf(plain[0])).toEqual({ numerator: 1, denominator: 1 })
    expect(playbackRateAt(plain, 5 * S)).toBe(1)
    expect(maintainPitchAt(plain, 5 * S)).toBe(true)
  })

  it('is still a straight play-through with no jumping about', () => {
    expect(isUncutPassthrough(plain)).toBe(true)
  })
})

describe('finding the right moment of the recording when a piece is sped up', () => {
  it('two seconds into a 2x piece is four seconds into the recording', () => {
    expect(sourceTimeFor(fastThenNormal, 2 * S)).toEqual({ segmentIndex: 0, sourceTicks: 4 * S })
  })

  it('four seconds into a half-speed piece is two seconds into the recording', () => {
    expect(sourceTimeFor(slow, 4 * S)).toEqual({ segmentIndex: 0, sourceTicks: 2 * S })
  })

  it('finds the right piece at the join, to the tick', () => {
    // The fast piece ends at 5 s on screen; the next one starts there.
    expect(segmentIndexAt(fastThenNormal, 5 * S - 1)).toBe(0)
    expect(segmentIndexAt(fastThenNormal, 5 * S)).toBe(1)
  })

  it('goes back to normal speed for the ordinary piece after it', () => {
    expect(playbackRateAt(fastThenNormal, 1 * S)).toBe(2)
    expect(playbackRateAt(fastThenNormal, 6 * S)).toBe(1)
  })

  it('runs at normal speed inside a hole, so resuming does not lurch', () => {
    const withHole: readonly PlaybackSegment[] = [
      fastThenNormal[0],
      { ...fastThenNormal[1], startTicks: 9 * S },
    ]
    expect(playbackRateAt(withHole, 7 * S)).toBe(1)
  })
})

describe('following a sped-up piece as the recording plays through it', () => {
  it('reports the on-screen moment, not the recording moment', () => {
    // The recording is at 6 s. At 2x that is 3 s of finished video.
    const action = advancePlayback(fastThenNormal, 0, 6 * S, 15 * S)
    expect(action.kind).toBe('show')
    if (action.kind === 'show') expect(action.compositionTicks).toBe(3 * S)
  })

  it('stays on the piece until the RECORDING runs out, not until the screen time does', () => {
    // Comparing against the on-screen length instead would end a 2x piece
    // halfway through and jump to the next one.
    const stillHere = advancePlayback(fastThenNormal, 0, 9 * S, 15 * S)
    expect(stillHere.kind).toBe('show')
    if (stillHere.kind === 'show') expect(stillHere.compositionTicks).toBe(4.5 * S)
  })

  it('moves on to the next piece once the recording passes the end', () => {
    const action = advancePlayback(fastThenNormal, 0, 10 * S, 15 * S)
    expect(action.kind).toBe('seek')
    if (action.kind === 'seek') {
      expect(action.compositionTicks).toBe(5 * S)
      expect(action.sourceTicks).toBe(20 * S)
    }
  })

  it('reports the finished video as over at the right moment', () => {
    const action = advancePlayback(fastThenNormal, 1, 30 * S, 15 * S)
    expect(action.kind).toBe('ended')
    if (action.kind === 'ended') expect(action.compositionTicks).toBe(15 * S)
  })
})

describe('the screen and the exported file must agree', () => {
  it('maps every on-screen moment to a recording moment that is inside the piece', () => {
    // The exporter takes `sourceStartTicks` to `sourceStartTicks +
    // sourceDurationTicks`. Anything the preview asks for outside that is a
    // frame the export will not contain.
    for (const segments of [fastThenNormal, slow, plain]) {
      for (const segment of segments) {
        for (const step of [0, 1, 0.25, 0.5, 0.75]) {
          const at = segment.startTicks + Math.floor(segment.durationTicks * step)
          if (at >= segment.startTicks + segment.durationTicks) continue
          const found = sourceTimeFor(segments, at)
          expect(found, String(at)).not.toBeNull()
          if (!found) continue
          expect(found.sourceTicks).toBeGreaterThanOrEqual(segment.sourceStartTicks)
          expect(found.sourceTicks).toBeLessThanOrEqual(segment.sourceStartTicks + sourceSpanOf(segment))
        }
      }
    }
  })

  it('stops calling a retimed single piece a straight play-through', () => {
    // A retimed piece needs the player told how fast to run, and its own clock
    // no longer matches the timeline's, so the fast path would show the wrong
    // playhead position for the whole video.
    expect(isUncutPassthrough(slow)).toBe(false)
  })
})

describe('what the preview honestly cannot show', () => {
  it('names a backwards piece rather than showing it forwards', () => {
    const backwards: readonly PlaybackSegment[] = [{ ...plain[0], reversed: true }]
    expect(unpreviewableSegmentIndexes(backwards)).toEqual([0])
    expect(isUncutPassthrough(backwards)).toBe(false)
  })

  it('has nothing to report for an ordinary project', () => {
    expect(unpreviewableSegmentIndexes(fastThenNormal)).toEqual([])
    expect(unpreviewableSegmentIndexes(plain)).toEqual([])
  })

  it('reports the pitch switch so the player can be set to match the export', () => {
    const squeaky: readonly PlaybackSegment[] = [{ ...slow[0], maintainAudioPitch: false }]
    expect(maintainPitchAt(squeaky, 1 * S)).toBe(false)
    expect(maintainPitchAt(slow, 1 * S)).toBe(true)
  })
})
