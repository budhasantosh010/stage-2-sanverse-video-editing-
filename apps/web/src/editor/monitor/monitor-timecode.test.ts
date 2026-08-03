import { describe, expect, it } from 'vitest'
import { PROJECT_TIMESCALE } from '@sanverse/edit-domain'
import { formatMonitorTimecode, frameStepTicks } from './monitor-timecode'

describe('monitor timecode', () => {
  it('formats canonical 30 fps ticks as HH:MM:SS:FF', () => {
    expect(formatMonitorTimecode(PROJECT_TIMESCALE * 3 + PROJECT_TIMESCALE / 2, { numerator: 30, denominator: 1 })).toBe('00:00:03:15')
  })

  it('supports rational rates and a millisecond fallback', () => {
    expect(frameStepTicks({ numerator: 30_000, denominator: 1_001 })).toBe(48_048)
    expect(formatMonitorTimecode(PROJECT_TIMESCALE * 65.125, null)).toBe('00:01:05.125')
  })
})
