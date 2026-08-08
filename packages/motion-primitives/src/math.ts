export class MotionPrimitiveError extends RangeError {
  readonly code: 'NON_FINITE' | 'RANGE_INVALID' | 'ZERO_LENGTH_RANGE' | 'INTEGER_REQUIRED' | 'INDEX_INVALID'
  constructor(code: MotionPrimitiveError['code'], message: string) {
    super(message)
    this.name = 'MotionPrimitiveError'
    this.code = code
  }
}

export const assertFiniteNumber = (value: number, label: string): number => {
  if (typeof value !== 'number' || !Number.isFinite(value)) throw new MotionPrimitiveError('NON_FINITE', `${label} must be a finite number.`)
  return value
}

export const assertSafeInteger = (value: number, label: string): number => {
  assertFiniteNumber(value, label)
  if (!Number.isSafeInteger(value)) throw new MotionPrimitiveError('INTEGER_REQUIRED', `${label} must be a safe integer.`)
  return value
}

export const clamp = (value: number, minimum: number, maximum: number): number => {
  assertFiniteNumber(value, 'value'); assertFiniteNumber(minimum, 'minimum'); assertFiniteNumber(maximum, 'maximum')
  if (minimum > maximum) throw new MotionPrimitiveError('RANGE_INVALID', 'minimum must be less than or equal to maximum.')
  return Math.min(maximum, Math.max(minimum, value))
}
export const clamp01 = (value: number): number => clamp(value, 0, 1)
export const lerp = (start: number, end: number, progress: number): number => {
  assertFiniteNumber(start, 'start'); assertFiniteNumber(end, 'end'); assertFiniteNumber(progress, 'progress')
  return start + (end - start) * progress
}
export const inverseLerp = (start: number, end: number, value: number): number => {
  assertFiniteNumber(start, 'start'); assertFiniteNumber(end, 'end'); assertFiniteNumber(value, 'value')
  if (start === end) throw new MotionPrimitiveError('ZERO_LENGTH_RANGE', 'Cannot normalize a zero-length range.')
  return (value - start) / (end - start)
}
export const mapRange = (value: number, inputStart: number, inputEnd: number, outputStart: number, outputEnd: number, options: Readonly<{ clamp?: boolean }> = {}): number => {
  const progress = inverseLerp(inputStart, inputEnd, value)
  return lerp(outputStart, outputEnd, options.clamp ? clamp01(progress) : progress)
}
export const normalizedProgress = (localTicks: number, durationTicks: number): number => {
  assertFiniteNumber(localTicks, 'localTicks'); assertFiniteNumber(durationTicks, 'durationTicks')
  if (durationTicks <= 0) throw new MotionPrimitiveError('RANGE_INVALID', 'durationTicks must be greater than zero.')
  return clamp01(localTicks / durationTicks)
}
export const progressBetweenTicks = (ticks: number, startTicks: number, endTicks: number): number => {
  assertFiniteNumber(ticks, 'ticks'); assertFiniteNumber(startTicks, 'startTicks'); assertFiniteNumber(endTicks, 'endTicks')
  if (startTicks === endTicks) throw new MotionPrimitiveError('ZERO_LENGTH_RANGE', 'Tick range must have non-zero length.')
  return clamp01(inverseLerp(startTicks, endTicks, ticks))
}
