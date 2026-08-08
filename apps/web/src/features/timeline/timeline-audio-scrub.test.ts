import { afterEach, describe, expect, it, vi } from 'vitest'

import type { BrowserAudioPreviewVoiceV1, CompositionAudioPreviewController } from '../render-plan/composition-audio-preview'
import { createAudioScrubScheduler } from './timeline-audio-scrub'

const voice = Object.freeze({
  voiceId: 'voice_1',
  assetId: 'asset_aaaaaaaa',
  url: '/media',
  sourceTicks: 1_440_000,
  playbackRate: 1,
  preservePitch: true,
  gain: 1,
  pan: 0,
}) satisfies BrowserAudioPreviewVoiceV1

const controller = () => {
  const update = vi.fn()
  return {
    update,
    value: Object.freeze({ supported: true, update, setMaster: vi.fn(), dispose: vi.fn(), diagnostics: () => ({}) }) as unknown as CompositionAudioPreviewController,
  }
}

afterEach(() => vi.useRealTimers())

describe('Audio Scrubbing scheduler', () => {
  it('reuses one existing composition-audio controller and stops one bounded snippet', () => {
    vi.useFakeTimers()
    const fake = controller()
    const scrub = createAudioScrubScheduler(fake.value, 70)
    scrub.scrub([voice])
    expect(fake.update).toHaveBeenLastCalledWith([voice], true)
    expect(scrub.active()).toBe(true)
    vi.advanceTimersByTime(70)
    expect(fake.update).toHaveBeenLastCalledWith([], false)
    expect(scrub.active()).toBe(false)
  })

  it('replaces a prior snippet instead of letting scrub sounds overlap', () => {
    vi.useFakeTimers()
    const fake = controller()
    const scrub = createAudioScrubScheduler(fake.value, 100)
    scrub.scrub([voice])
    vi.advanceTimersByTime(50)
    scrub.scrub([voice])
    vi.advanceTimersByTime(60)
    expect(scrub.active()).toBe(true)
    vi.advanceTimersByTime(40)
    expect(scrub.active()).toBe(false)
    expect(fake.update.mock.calls.filter((call) => call[1] === true)).toHaveLength(2)
    expect(fake.update.mock.calls.filter((call) => call[1] === false)).toHaveLength(1)
  })

  it('dispose cancels the timer, silences the controller and never creates another audio authority', () => {
    vi.useFakeTimers()
    const fake = controller()
    const scrub = createAudioScrubScheduler(fake.value)
    scrub.scrub([voice])
    scrub.dispose()
    expect(fake.update).toHaveBeenLastCalledWith([], false)
    vi.runAllTimers()
    expect(fake.update.mock.calls.filter((call) => call[1] === false)).toHaveLength(1)
  })
})
