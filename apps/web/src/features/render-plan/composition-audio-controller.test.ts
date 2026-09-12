import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { PROJECT_TIMESCALE } from '@sanverse/edit-domain'
import { createCompositionAudioPreviewController, type BrowserAudioPreviewVoiceV1 } from './composition-audio-preview'

const voice = (seconds: number): BrowserAudioPreviewVoiceV1 => ({
  voiceId: 'linked:clip_one', assetId: 'asset_one', url: '/test.mp4',
  sourceTicks: seconds * PROJECT_TIMESCALE, playbackRate: 1,
  preservePitch: true, gain: 1, pan: 0,
})
const graphNode = () => ({ connect: vi.fn(), disconnect: vi.fn(), gain: { setValueAtTime: vi.fn() }, pan: { setValueAtTime: vi.fn() } })

describe('composition audio resource lifecycle', () => {
  let audio: HTMLAudioElement
  let controller: ReturnType<typeof createCompositionAudioPreviewController>
  beforeEach(() => {
    vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => {})
    vi.spyOn(HTMLMediaElement.prototype, 'load').mockImplementation(() => {})
    vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue()
    vi.stubGlobal('AudioContext', class {
      currentTime = 0
      state = 'running'
      destination = {}
      createGain = graphNode
      createStereoPanner = graphNode
      createMediaElementSource = vi.fn((element: HTMLAudioElement) => { audio = element; return graphNode() })
      close = vi.fn(async () => {})
    })
    controller = createCompositionAudioPreviewController(document.createElement('video'))
  })
  afterEach(() => { controller.dispose(); vi.restoreAllMocks(); vi.unstubAllGlobals() })

  it('applies only the newest composition seek when metadata finally arrives', () => {
    controller.update([voice(1)], false)
    controller.update([voice(2)], false)
    controller.update([voice(3)], false)
    const seek = vi.spyOn(audio, 'currentTime', 'set')
    audio.dispatchEvent(new Event('loadedmetadata'))
    expect(seek.mock.calls).toEqual([[3]])
  })

  it('does not seek a released audio resource on a late metadata event', () => {
    controller.update([voice(1)], false)
    const released = audio
    controller.update([], false)
    const seek = vi.spyOn(released, 'currentTime', 'set')
    released.dispatchEvent(new Event('loadedmetadata'))
    expect(seek).not.toHaveBeenCalled()
  })

  it('reuses the linked decoder while its source time crosses a picture boundary', () => {
    controller.update([voice(4.5)], false)
    const original = audio
    controller.update([voice(5.5)], false)
    expect(audio).toBe(original)
    expect(audio.getAttribute('src')).toBe('/test.mp4')
  })
})
