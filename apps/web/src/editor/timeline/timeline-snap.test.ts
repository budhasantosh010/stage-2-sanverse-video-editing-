import { describe, expect, it } from 'vitest'

import { PROJECT_TIMESCALE } from '@sanverse/edit-domain'
import { snapTimelineTicks, timelineSnapCandidates } from './timeline-snap'

const S = PROJECT_TIMESCALE

describe('timeline snapping', () => {
  it('snaps to the nearest boundary inside the pixel threshold', () => {
    const result = snapTimelineTicks({
      ticks: 5 * S + Math.round(0.04 * S),
      candidateTicks: [0, 5 * S, 10 * S],
      durationTicks: 10 * S,
      timescale: S,
      pixelsPerSecond: 100,
      thresholdPx: 8,
    })

    expect(result).toEqual({ ticks: 5 * S, snappedToTicks: 5 * S })
  })

  it('preserves exact unsnapped time outside the threshold', () => {
    const raw = 5 * S + Math.round(0.2 * S)
    expect(snapTimelineTicks({
      ticks: raw,
      candidateTicks: [5 * S],
      durationTicks: 10 * S,
      timescale: S,
      pixelsPerSecond: 100,
    })).toEqual({ ticks: raw, snappedToTicks: null })
  })

  it('chooses the earlier boundary deterministically on a tie', () => {
    expect(snapTimelineTicks({
      ticks: 5 * S,
      candidateTicks: [6 * S, 4 * S],
      durationTicks: 10 * S,
      timescale: S,
      pixelsPerSecond: 10,
      thresholdPx: 10,
    }).ticks).toBe(4 * S)
  })

  it('can exclude the edge being dragged so it does not self-snap', () => {
    expect(snapTimelineTicks({
      ticks: 5 * S,
      candidateTicks: [5 * S, 6 * S],
      excludedTicks: [5 * S],
      durationTicks: 10 * S,
      timescale: S,
      pixelsPerSecond: 10,
      thresholdPx: 10,
    }).ticks).toBe(6 * S)
  })

  it('builds unique ordered candidates from item starts and ends', () => {
    expect(timelineSnapCandidates({
      durationTicks: 10 * S,
      itemRanges: [
        { startTicks: 0, durationTicks: 5 * S },
        { startTicks: 5 * S, durationTicks: 5 * S },
      ],
    })).toEqual([0, 5 * S, 10 * S])
  })
})
