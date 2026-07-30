export type TimelineRulerTick = Readonly<{
  ticks: number
  xPx: number
  label: string | null
  major: boolean
}>

export type TimelineRulerModel = Readonly<{
  majorIntervalTicks: number
  minorIntervalTicks: number
  ticks: readonly TimelineRulerTick[]
}>

const MAJOR_INTERVAL_SECONDS = Object.freeze([
  0.05,
  0.1,
  0.25,
  0.5,
  1,
  2,
  5,
  10,
  30,
  60,
  120,
  300,
  600,
  1_800,
])

const safeTicks = (value: number): number =>
  Number.isFinite(value) ? Math.min(Number.MAX_SAFE_INTEGER, Math.max(0, Math.round(value))) : 0

const pad = (value: number, width = 2): string => String(value).padStart(width, '0')

export const formatTimelineTime = (
  ticks: number,
  timescale: number,
  showMilliseconds = false,
): string => {
  if (!Number.isFinite(ticks) || ticks < 0 || !Number.isFinite(timescale) || timescale <= 0) {
    return '00:00'
  }
  const totalMilliseconds = Math.max(0, Math.round((ticks / timescale) * 1_000))
  const hours = Math.floor(totalMilliseconds / 3_600_000)
  const minutes = Math.floor((totalMilliseconds % 3_600_000) / 60_000)
  const seconds = Math.floor((totalMilliseconds % 60_000) / 1_000)
  const milliseconds = totalMilliseconds % 1_000
  const clock = hours > 0
    ? `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`
    : `${pad(minutes)}:${pad(seconds)}`
  return showMilliseconds ? `${clock}.${pad(milliseconds, 3)}` : clock
}

const chooseMajorIntervalSeconds = (pixelsPerSecond: number): number => {
  const pps = Number.isFinite(pixelsPerSecond) && pixelsPerSecond > 0 ? pixelsPerSecond : 100
  const targetPixels = 86
  return MAJOR_INTERVAL_SECONDS.find((seconds) => seconds * pps >= targetPixels)
    ?? MAJOR_INTERVAL_SECONDS[MAJOR_INTERVAL_SECONDS.length - 1]
}

export const buildTimelineRulerModel = (input: Readonly<{
  visibleStartTicks: number
  visibleEndTicks: number
  durationTicks: number
  timescale: number
  pixelsPerSecond: number
  viewportWidthPx: number
  scrollLeftPx: number
}>): TimelineRulerModel => {
  const timescale = Number.isFinite(input.timescale) && input.timescale > 0
    ? Math.round(input.timescale)
    : 0
  const durationTicks = safeTicks(input.durationTicks)
  const startTicks = Math.min(durationTicks, safeTicks(input.visibleStartTicks))
  const endTicks = Math.min(durationTicks, Math.max(startTicks, safeTicks(input.visibleEndTicks)))
  const pixelsPerSecond = Number.isFinite(input.pixelsPerSecond) && input.pixelsPerSecond > 0
    ? input.pixelsPerSecond
    : 100
  const scrollLeftPx = Number.isFinite(input.scrollLeftPx) ? Math.max(0, input.scrollLeftPx) : 0

  if (timescale <= 0 || durationTicks <= 0 || endTicks <= startTicks || input.viewportWidthPx <= 0) {
    return Object.freeze({ majorIntervalTicks: 0, minorIntervalTicks: 0, ticks: Object.freeze([]) })
  }

  const majorIntervalSeconds = chooseMajorIntervalSeconds(pixelsPerSecond)
  const majorIntervalTicks = Math.max(1, safeTicks(majorIntervalSeconds * timescale))
  const preferredMinorDivisor = majorIntervalSeconds >= 1 ? 5 : 2
  const minorIntervalTicks = Math.max(1, Math.round(majorIntervalTicks / preferredMinorDivisor))
  const firstIndex = Math.floor(startTicks / minorIntervalTicks)
  const lastIndex = Math.ceil(endTicks / minorIntervalTicks)
  const showMilliseconds = majorIntervalSeconds < 1
  const ticks: TimelineRulerTick[] = []
  const seenPositions = new Set<number>()

  for (let index = firstIndex; index <= lastIndex; index += 1) {
    const tickValue = index * minorIntervalTicks
    if (tickValue < 0 || tickValue > durationTicks) continue
    const xPx = (tickValue / timescale) * pixelsPerSecond - scrollLeftPx
    if (xPx < -1 || xPx > input.viewportWidthPx + 1) continue
    const positionKey = Math.round(xPx * 1_000)
    if (seenPositions.has(positionKey)) continue
    seenPositions.add(positionKey)
    const major = tickValue % majorIntervalTicks === 0
    ticks.push(Object.freeze({
      ticks: tickValue,
      xPx,
      label: major ? formatTimelineTime(tickValue, timescale, showMilliseconds) : null,
      major,
    }))
  }

  return Object.freeze({
    majorIntervalTicks,
    minorIntervalTicks,
    ticks: Object.freeze(ticks),
  })
}

export const timelinePointerToTicks = (input: Readonly<{
  clientX: number
  viewportLeftPx: number
  scrollLeftPx: number
  pixelsPerSecond: number
  timescale: number
  durationTicks: number
}>): number => {
  if (!Number.isFinite(input.clientX) || !Number.isFinite(input.viewportLeftPx)) return 0
  if (!Number.isFinite(input.pixelsPerSecond) || input.pixelsPerSecond <= 0) return 0
  if (!Number.isFinite(input.timescale) || input.timescale <= 0) return 0
  const localContentPx = Math.max(0, input.clientX - input.viewportLeftPx + Math.max(0, input.scrollLeftPx))
  const ticks = Math.round((localContentPx / input.pixelsPerSecond) * input.timescale)
  return Math.min(safeTicks(input.durationTicks), safeTicks(ticks))
}
