import { describe, expect, it } from 'vitest'

import {
  STOPPED_SHUTTLE,
  advanceShuttle,
  beginDynamicTrim,
  shuttleDeltaTicks,
  updateDynamicTrim,
} from './timeline-shuttle'

describe('J/K/L shuttle', () => {
  it('starts J backwards and L forwards at 1x', () => {
    expect(advanceShuttle(STOPPED_SHUTTLE, 'J')).toEqual({ direction: -1, rate: 1 })
    expect(advanceShuttle(STOPPED_SHUTTLE, 'L')).toEqual({ direction: 1, rate: 1 })
  })

  it('K always stops', () => {
    expect(advanceShuttle({ direction: -1, rate: 8 }, 'K')).toEqual(STOPPED_SHUTTLE)
  })

  it('repeated J/L accelerates 1, 2, 4, 8 and caps there', () => {
    let forward = STOPPED_SHUTTLE
    for (const rate of [1, 2, 4, 8, 8]) {
      forward = advanceShuttle(forward, 'L')
      expect(forward.rate).toBe(rate)
    }
    let reverse = STOPPED_SHUTTLE
    for (const rate of [1, 2, 4, 8, 8]) {
      reverse = advanceShuttle(reverse, 'J')
      expect(reverse.rate).toBe(rate)
    }
  })

  it('changing direction resets to 1x', () => {
    expect(advanceShuttle({ direction: 1, rate: 8 }, 'J')).toEqual({ direction: -1, rate: 1 })
  })

  it('uses the one composition clock for signed movement', () => {
    expect(shuttleDeltaTicks({ direction: 1, rate: 2 }, 500, 1_440_000)).toBe(1_440_000)
    expect(shuttleDeltaTicks({ direction: -1, rate: 4 }, 250, 1_440_000)).toBe(-1_440_000)
  })
})

describe('Dynamic Trim session', () => {
  it('starts detached and updates without a project operation', () => {
    const started = beginDynamicTrim('V1:a:b:100', 100)
    expect(started).toEqual({
      active: true,
      editPointKey: 'V1:a:b:100',
      originalCompositionTicks: 100,
      previewDeltaTicks: 0,
      state: 'active',
      message: null,
    })
    const next = updateDynamicTrim(started, 48_000, true, 'preview')
    expect(next.previewDeltaTicks).toBe(48_000)
    expect(next.state).toBe('valid')
    expect(Object.hasOwn(next, 'operation')).toBe(false)
  })

  it('retains a refusal as presentation state rather than throwing', () => {
    const started = beginDynamicTrim('V1:a:b:100', 100)
    expect(updateDynamicTrim(started, -99, false, 'Not enough source')).toMatchObject({ state: 'refused', message: 'Not enough source' })
  })
})
