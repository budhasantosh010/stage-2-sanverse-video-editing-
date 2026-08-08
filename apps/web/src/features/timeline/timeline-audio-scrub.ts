import type { BrowserAudioPreviewVoiceV1, CompositionAudioPreviewController } from '../render-plan/composition-audio-preview'

export type AudioScrubSchedulerV1 = Readonly<{
  scrub(voices: readonly BrowserAudioPreviewVoiceV1[]): void
  stop(): void
  dispose(): void
  active(): boolean
}>

/**
 * Bounded audio scrubbing over the ONE T2 composition-audio controller.
 *
 * It deliberately does not create an AudioContext, media node or second clock.
 * A new movement replaces the previous tiny snippet, so rapid pointer movement
 * cannot stack uncontrolled sounds.
 */
export const createAudioScrubScheduler = (
  controller: CompositionAudioPreviewController,
  snippetMilliseconds = 70,
): AudioScrubSchedulerV1 => {
  const duration = Math.max(20, Math.min(200, Math.round(snippetMilliseconds)))
  let timer: ReturnType<typeof setTimeout> | null = null
  let disposed = false
  let playing = false

  const stop = () => {
    if (timer !== null) clearTimeout(timer)
    timer = null
    if (!disposed && playing) controller.update(Object.freeze([]), false)
    playing = false
  }

  return Object.freeze({
    scrub(voices) {
      if (disposed || !controller.supported || voices.length === 0) return
      if (timer !== null) clearTimeout(timer)
      controller.update(voices, true)
      playing = true
      timer = setTimeout(() => {
        timer = null
        if (!disposed) controller.update(Object.freeze([]), false)
        playing = false
      }, duration)
    },
    stop,
    dispose() {
      stop()
      disposed = true
    },
    active: () => playing,
  })
}
