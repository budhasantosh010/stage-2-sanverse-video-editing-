import type { MotionCompositionV1 } from '@sanverse/motion-contract'
import { SANVERSE_TICKS_PER_SECOND, frameForTicks, ticksForFrame } from '@sanverse/motion-primitives'

export const PLAYBACK_SPEEDS = [0.25, 0.5, 1, 2] as const
export type PlaybackSpeed = (typeof PLAYBACK_SPEEDS)[number]

export const resolveInitialTick = (
  rawValue: string | null,
  durationTicks: number,
  defaultProgress: number,
): number => {
  if (!Number.isSafeInteger(durationTicks) || durationTicks <= 0) throw new RangeError('durationTicks must be a positive safe integer.')
  if (!Number.isFinite(defaultProgress) || defaultProgress < 0 || defaultProgress > 1) throw new RangeError('defaultProgress must be inside [0, 1].')
  const fallback = Math.round(durationTicks * defaultProgress)
  if (rawValue === null) return fallback
  const value = Number(rawValue)
  return Number.isSafeInteger(value) && value >= 0 ? Math.min(value, durationTicks) : fallback
}

export interface PlaybackAdvanceInput {
  readonly anchorTicks: number
  readonly elapsedMilliseconds: number
  readonly speed: PlaybackSpeed
  readonly durationTicks: number
  readonly loop: boolean
}

export interface PlaybackAdvanceResult {
  readonly ticks: number
  readonly ended: boolean
}

export const advancePlaybackTicks = ({
  anchorTicks,
  elapsedMilliseconds,
  speed,
  durationTicks,
  loop,
}: PlaybackAdvanceInput): PlaybackAdvanceResult => {
  if (!Number.isSafeInteger(anchorTicks) || anchorTicks < 0) throw new RangeError('anchorTicks must be a non-negative safe integer.')
  if (!Number.isFinite(elapsedMilliseconds) || elapsedMilliseconds < 0) throw new RangeError('elapsedMilliseconds must be a non-negative finite number.')
  if (!PLAYBACK_SPEEDS.includes(speed)) throw new RangeError('Unsupported playback speed.')
  if (!Number.isSafeInteger(durationTicks) || durationTicks <= 0) throw new RangeError('durationTicks must be a positive safe integer.')

  const elapsedTicks = Math.round(elapsedMilliseconds * SANVERSE_TICKS_PER_SECOND / 1000 * speed)
  const requested = anchorTicks + elapsedTicks
  if (loop) return { ticks: requested % durationTicks, ended: false }
  if (requested >= durationTicks) return { ticks: durationTicks, ended: true }
  return { ticks: requested, ended: false }
}

export const stepFrame = (
  currentTicks: number,
  direction: -1 | 1,
  composition: MotionCompositionV1,
  durationTicks: number,
): number => {
  if (!Number.isSafeInteger(currentTicks) || currentTicks < 0) throw new RangeError('currentTicks must be a non-negative safe integer.')
  if (!Number.isSafeInteger(durationTicks) || durationTicks <= 0) throw new RangeError('durationTicks must be a positive safe integer.')
  const currentFrame = frameForTicks(currentTicks, composition)
  const targetFrame = Math.max(0, currentFrame + direction)
  return Math.min(durationTicks, ticksForFrame(targetFrame, composition))
}

export const clampExactTick = (tick: number, durationTicks: number): number => {
  if (!Number.isFinite(tick)) throw new RangeError('tick must be finite.')
  if (!Number.isSafeInteger(durationTicks) || durationTicks <= 0) throw new RangeError('durationTicks must be a positive safe integer.')
  return Math.min(durationTicks, Math.max(0, Math.round(tick)))
}
