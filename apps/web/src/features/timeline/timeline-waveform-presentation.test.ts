import { describe, expect, it } from 'vitest'

import {
  DEFAULT_TIMELINE_WAVEFORM_PRESENTATION,
  parseTimelineWaveformPresentation,
  reconcileTimelineWaveformPresentation,
  setWaveformDisplayMode,
  waveformDisplayModeForTrack,
} from './timeline-waveform-presentation'

const A2 = 'track_music000001'
const EXTRA = 'track_audioextra1'

describe('T5 audio channel display presentation', () => {
  it('defaults every stable track to Combined without storing project state', () => {
    expect(waveformDisplayModeForTrack(DEFAULT_TIMELINE_WAVEFORM_PRESENTATION, A2)).toBe('combined')
    expect(DEFAULT_TIMELINE_WAVEFORM_PRESENTATION.modes).toEqual({})
  })

  it('stores Separate by stable track id and removes the entry when returning to Combined', () => {
    const separate = setWaveformDisplayMode(DEFAULT_TIMELINE_WAVEFORM_PRESENTATION, A2, 'separate')
    expect(waveformDisplayModeForTrack(separate, A2)).toBe('separate')
    const combined = setWaveformDisplayMode(separate, A2, 'combined')
    expect(combined.modes).toEqual({})
  })

  it('refuses display aliases and arbitrary ids rather than turning labels into identity', () => {
    expect(setWaveformDisplayMode(DEFAULT_TIMELINE_WAVEFORM_PRESENTATION, 'A2', 'separate'))
      .toBe(DEFAULT_TIMELINE_WAVEFORM_PRESENTATION)
    expect(setWaveformDisplayMode(DEFAULT_TIMELINE_WAVEFORM_PRESENTATION, 'track-nope', 'separate'))
      .toBe(DEFAULT_TIMELINE_WAVEFORM_PRESENTATION)
  })

  it('fails closed on corrupt/old storage and ignores malformed entries', () => {
    expect(parseTimelineWaveformPresentation('{nope')).toBe(DEFAULT_TIMELINE_WAVEFORM_PRESENTATION)
    expect(parseTimelineWaveformPresentation(JSON.stringify({ schemaVersion: 'old', modes: { [A2]: 'separate' } })))
      .toBe(DEFAULT_TIMELINE_WAVEFORM_PRESENTATION)
    expect(parseTimelineWaveformPresentation(JSON.stringify({
      schemaVersion: 'sanverse.timeline-waveform-presentation/v1',
      modes: { [A2]: 'separate', V2: 'separate', [EXTRA]: 'banana' },
    })).modes).toEqual({ [A2]: 'separate' })
  })

  it('repairs stale track preferences without changing surviving choices', () => {
    let state = setWaveformDisplayMode(DEFAULT_TIMELINE_WAVEFORM_PRESENTATION, A2, 'separate')
    state = setWaveformDisplayMode(state, EXTRA, 'separate')
    expect(reconcileTimelineWaveformPresentation(state, [A2]).modes).toEqual({ [A2]: 'separate' })
  })
})
