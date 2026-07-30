import { pixelsToTicks } from '../../features/timeline'

export type TimelineSnapResult = Readonly<{
  ticks: number
  snappedToTicks: number | null
}>

const clampTick = (ticks: number, durationTicks: number): number =>
  Math.min(durationTicks, Math.max(0, Number.isFinite(ticks) ? Math.round(ticks) : 0))

/**
 * Snap one presentation-time pointer to the nearest visible editorial boundary.
 *
 * This is presentation math only. It never edits the project and it never
 * invents a persisted timeline value. A tie chooses the earlier boundary so
 * the same pointer always produces the same answer.
 */
export const snapTimelineTicks = (input: Readonly<{
  ticks: number
  candidateTicks: readonly number[]
  durationTicks: number
  timescale: number
  pixelsPerSecond: number
  thresholdPx?: number
  excludedTicks?: readonly number[]
}>): TimelineSnapResult => {
  const raw = clampTick(input.ticks, input.durationTicks)
  const thresholdTicks = pixelsToTicks(
    Math.max(0, input.thresholdPx ?? 8),
    input.timescale,
    input.pixelsPerSecond,
  )
  if (thresholdTicks <= 0) return Object.freeze({ ticks: raw, snappedToTicks: null })

  const excluded = new Set(input.excludedTicks ?? [])
  let nearest: number | null = null
  let nearestDistance = Number.POSITIVE_INFINITY
  for (const candidate of input.candidateTicks) {
    if (!Number.isSafeInteger(candidate) || candidate < 0 || candidate > input.durationTicks) continue
    if (excluded.has(candidate)) continue
    const distance = Math.abs(candidate - raw)
    if (
      distance <= thresholdTicks &&
      (distance < nearestDistance || (distance === nearestDistance && (nearest === null || candidate < nearest)))
    ) {
      nearest = candidate
      nearestDistance = distance
    }
  }

  return nearest === null
    ? Object.freeze({ ticks: raw, snappedToTicks: null })
    : Object.freeze({ ticks: nearest, snappedToTicks: nearest })
}

export const timelineSnapCandidates = (input: Readonly<{
  durationTicks: number
  itemRanges: readonly Readonly<{ startTicks: number; durationTicks: number }>[]
}>): readonly number[] => Object.freeze(
  [...new Set([
    0,
    input.durationTicks,
    ...input.itemRanges.flatMap((item) => [item.startTicks, item.startTicks + item.durationTicks]),
  ])]
    .filter((ticks) => Number.isSafeInteger(ticks) && ticks >= 0 && ticks <= input.durationTicks)
    .sort((left, right) => left - right),
)
