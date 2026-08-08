export const SHUTTLE_RATES = Object.freeze([1, 2, 4, 8] as const)
export type ShuttleRateV1 = (typeof SHUTTLE_RATES)[number]
export type ShuttleDirectionV1 = -1 | 0 | 1
export type ShuttleKeyV1 = 'J' | 'K' | 'L'

export type TimelineShuttleStateV1 = Readonly<{
  direction: ShuttleDirectionV1
  rate: 0 | ShuttleRateV1
}>

export const STOPPED_SHUTTLE: TimelineShuttleStateV1 = Object.freeze({ direction: 0, rate: 0 })

const nextRate = (current: number): ShuttleRateV1 => {
  const index = SHUTTLE_RATES.indexOf(current as ShuttleRateV1)
  return SHUTTLE_RATES[Math.min(SHUTTLE_RATES.length - 1, Math.max(0, index + 1))]
}

/** J/K/L state is pure presentation state. Repeated J/L accelerates 1→2→4→8x. */
export const advanceShuttle = (
  current: TimelineShuttleStateV1,
  key: ShuttleKeyV1,
): TimelineShuttleStateV1 => {
  if (key === 'K') return STOPPED_SHUTTLE
  const direction: ShuttleDirectionV1 = key === 'J' ? -1 : 1
  if (current.direction !== direction) return Object.freeze({ direction, rate: 1 as const })
  return Object.freeze({ direction, rate: nextRate(current.rate) })
}

export const shuttleDeltaTicks = (
  state: TimelineShuttleStateV1,
  elapsedMilliseconds: number,
  timescale: number,
): number => {
  if (state.direction === 0 || state.rate === 0 || !Number.isFinite(elapsedMilliseconds)) return 0
  return Math.round(state.direction * state.rate * elapsedMilliseconds * timescale / 1000)
}

export const isTypingOrEditingTarget = (target: EventTarget | null): boolean => {
  if (!(target instanceof HTMLElement)) return false
  return Boolean(target.closest('input, textarea, select, [contenteditable="true"], [role="textbox"], [role="slider"], [role="spinbutton"]'))
}

export type DynamicTrimSessionV1 = Readonly<{
  active: boolean
  editPointKey: string | null
  originalCompositionTicks: number | null
  previewDeltaTicks: number
  state: 'idle' | 'active' | 'valid' | 'refused'
  message: string | null
}>

export const EMPTY_DYNAMIC_TRIM: DynamicTrimSessionV1 = Object.freeze({
  active: false,
  editPointKey: null,
  originalCompositionTicks: null,
  previewDeltaTicks: 0,
  state: 'idle',
  message: null,
})

export const beginDynamicTrim = (editPointKey: string, compositionTicks: number): DynamicTrimSessionV1 => Object.freeze({
  active: true,
  editPointKey,
  originalCompositionTicks: compositionTicks,
  previewDeltaTicks: 0,
  state: 'active',
  message: null,
})

export const updateDynamicTrim = (
  session: DynamicTrimSessionV1,
  deltaTicks: number,
  valid: boolean,
  message: string | null,
): DynamicTrimSessionV1 => session.active
  ? Object.freeze({ ...session, previewDeltaTicks: deltaTicks, state: valid ? 'valid' : 'refused', message })
  : session

export const cancelDynamicTrim = (): DynamicTrimSessionV1 => EMPTY_DYNAMIC_TRIM
