import type { MotionRenderContextV1 } from '@sanverse/motion-contract'
import { clamp01, cubicBezier, easeInCubic, easeInOutCubic, easeOutCubic, formatClockSeconds, formatCompactNumber, interpolateNumber, linear, normalizedProgress, sequenceProgress, springProgress, staggerProgress } from '@sanverse/motion-primitives'
import type { Animatable, KeyframedValueV1, MotionDriverV1, MotionEasingIdV1, MotionPropertyPrimitiveV1, MotionScalarExpressionV1 } from './properties.ts'

const easingFor = (id: MotionEasingIdV1) => id === 'linear' ? linear : id === 'ease-in-cubic' ? easeInCubic : id === 'ease-out-cubic' ? easeOutCubic : easeInOutCubic
const lerp = (from: number, to: number, progress: number): number => from + (to - from) * progress

export const evaluateScalarExpression = (expression: MotionScalarExpressionV1, context: MotionRenderContextV1): number => {
  if (expression.kind === 'constant') return expression.value
  if (expression.kind === 'progress') return normalizedProgress(context.localTicks, context.durationTicks)
  if (expression.kind === 'if-reduced-motion') return evaluateScalarExpression(context.reducedMotion ? expression.reduced : expression.normal, context)
  if (expression.kind === 'sequence') return sequenceProgress(evaluateScalarExpression(expression.input, context), expression.start, expression.end)
  if (expression.kind === 'ease') return easingFor(expression.easing)(evaluateScalarExpression(expression.input, context))
  if (expression.kind === 'spring') return springProgress({ progress: evaluateScalarExpression(expression.input, context), damping: expression.damping, frequency: expression.frequency })
  if (expression.kind === 'stagger') return staggerProgress({ progress: evaluateScalarExpression(expression.input, context), index: expression.index, count: expression.count, overlap: expression.overlap })
  if (expression.kind === 'sin') return Math.sin(evaluateScalarExpression(expression.input, context) * Math.PI * 2 * expression.cycles)
  if (expression.kind === 'clamp01') return clamp01(evaluateScalarExpression(expression.input, context))
  if (expression.kind === 'max') return Math.max(evaluateScalarExpression(expression.a, context), evaluateScalarExpression(expression.b, context))
  if (expression.kind === 'min') return Math.min(evaluateScalarExpression(expression.a, context), evaluateScalarExpression(expression.b, context))
  if (expression.kind === 'add') return expression.values.reduce((sum, value) => sum + evaluateScalarExpression(value, context), 0)
  if (expression.kind === 'multiply') return expression.values.reduce((product, value) => product * evaluateScalarExpression(value, context), 1)
  if (expression.kind === 'subtract') return evaluateScalarExpression(expression.a, context) - evaluateScalarExpression(expression.b, context)
  return lerp(evaluateScalarExpression(expression.from, context), evaluateScalarExpression(expression.to, context), evaluateScalarExpression(expression.progress, context))
}

export const evaluateMotionDriver = (driver: MotionDriverV1, context: MotionRenderContextV1): number | boolean | string => {
  const progress = normalizedProgress(context.localTicks, context.durationTicks)
  if (driver.kind === 'boolean-step') return progress < driver.at ? driver.before : driver.after
  if (driver.kind === 'formula') return evaluateScalarExpression(driver.expression, context)
  if (driver.kind === 'compact-number') {
    const window = context.reducedMotion && driver.reducedMotionFinal ? 1 : easingFor(driver.easing)(sequenceProgress(progress, driver.start, driver.end))
    const value = interpolateNumber(driver.from, driver.to, window, driver.rounding)
    return `${driver.prefix}${formatCompactNumber(value, driver.decimals)}${driver.suffix}`
  }
  if (driver.kind === 'clock') {
    const window = sequenceProgress(progress, driver.start, driver.end)
    const steps = Math.floor(driver.totalSeconds * window)
    const displayed = driver.mode === 'countdown' ? Math.max(0, driver.totalSeconds - steps) : Math.min(driver.totalSeconds, steps)
    return formatClockSeconds(displayed, { alwaysShowHours: driver.alwaysShowHours })
  }
  if (driver.kind === 'pulse') {
    const window = progress <= driver.start ? 0 : progress >= driver.end ? 1 : sequenceProgress(progress, driver.start, driver.end)
    const wave = Math.sin(window * Math.PI * 2 * driver.cycles)
    const amount = driver.positiveOnly ? Math.max(0, wave) : wave
    return driver.base + driver.amplitude * amount
  }
  const window = progress <= driver.start ? 0 : progress >= driver.end ? 1 : sequenceProgress(progress, driver.start, driver.end)
  if (driver.kind === 'spring') return lerp(driver.from, driver.to, springProgress({ progress: window, damping: driver.damping, frequency: driver.frequency }))
  if (driver.kind === 'stagger') {
    const staggered = staggerProgress({ progress: window, index: driver.index, count: driver.count, overlap: driver.overlap })
    return lerp(driver.from, driver.to, easingFor(driver.easing)(staggered))
  }
  return lerp(driver.from, driver.to, easingFor(driver.easing)(window))
}

export const evaluateKeyframedValue = <T extends MotionPropertyPrimitiveV1>(value: KeyframedValueV1<T>, localTicks: number): T => {
  const keyframes = value.keyframes
  if (keyframes.length === 0) throw new RangeError('Keyframed value needs at least one keyframe.')
  if (localTicks <= keyframes[0]!.tick) return keyframes[0]!.value
  if (localTicks >= keyframes[keyframes.length - 1]!.tick) return keyframes[keyframes.length - 1]!.value
  const leftIndex = keyframes.findIndex((keyframe, index) => index < keyframes.length - 1 && localTicks >= keyframe.tick && localTicks < keyframes[index + 1]!.tick)
  const left = keyframes[Math.max(0, leftIndex)]!
  const right = keyframes[Math.max(1, leftIndex + 1)]!
  if (left.interpolation === 'hold' || typeof left.value !== 'number' || typeof right.value !== 'number') return left.value
  const raw = clamp01((localTicks - left.tick) / (right.tick - left.tick))
  const eased = left.interpolation === 'bezier' && left.bezier
    ? cubicBezier(left.bezier.outX, left.bezier.outY, right.bezier?.inX ?? 1, right.bezier?.inY ?? 1)(raw)
    : raw
  return lerp(left.value, right.value, eased) as T
}

export const evaluateUnboundAnimatable = <T extends MotionPropertyPrimitiveV1>(value: Animatable<T>, context: MotionRenderContextV1): T => {
  if (value.kind === 'constant') return value.value
  if (value.kind === 'motion') return evaluateMotionDriver(value.driver, context) as T
  if (value.kind === 'keyframes') return evaluateKeyframedValue(value, context.localTicks)
  throw new RangeError('Bound values require scene-level evaluation.')
}
