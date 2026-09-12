type Interval = Readonly<{
  fromTicks: number
  untilTicks: number
  onTick: (ticks: number) => void
  onEnd: () => void
}>
type Options = Readonly<{
  timescale: number
  now?: () => number
  requestFrame?: (callback: FrameRequestCallback) => number
  cancelFrame?: (id: number) => void
}>

/** A disposable transport scheduler; all published time belongs to the editor playhead. */
export function createCompositionIntervalClock(options: Options) {
  const now = options.now ?? (() => performance.now())
  const request = options.requestFrame ?? ((callback) => requestAnimationFrame(callback))
  const cancel = options.cancelFrame ?? ((id) => cancelAnimationFrame(id))
  let generation = 0
  let frame: number | null = null
  function stop() {
    generation += 1
    if (frame !== null) cancel(frame)
    frame = null
  }
  function start(interval: Interval) {
    stop()
    const epoch = generation
    const anchor = now()
    const step = () => {
      if (generation !== epoch) return
      frame = null
      const elapsed = Math.max(0, now() - anchor)
      const ticks = Math.min(interval.untilTicks, interval.fromTicks + Math.round(elapsed * options.timescale / 1000))
      interval.onTick(ticks)
      if (generation !== epoch) return
      if (ticks >= interval.untilTicks) {
        generation += 1
        interval.onEnd()
      } else frame = request(step)
    }
    frame = request(step)
  }
  return { start, stop }
}
