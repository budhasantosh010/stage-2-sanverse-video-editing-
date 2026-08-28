import { creativeRefusal, creativeValidationOk, type CreativeValidationResultV1 } from '@sanverse/motion-contract'
import type { MotionExpertSpecV1 } from '@sanverse/motion-graph'
import { evaluateMotionExpertAtTickV1, type MotionExpertRuntimeFrameV1 } from './runtime.ts'

export const EXPERT_PERFORMANCE_CLASSES_V15 = Object.freeze(['LIGHT', 'MEDIUM', 'HEAVY', 'EXTREME'] as const)
export type ExpertPerformanceClassV15 = (typeof EXPERT_PERFORMANCE_CLASSES_V15)[number]

export interface MotionExpertPerformanceEvidenceV15 {
  readonly schemaVersion: 'sanverse.motion-expert-performance/v1'
  readonly kind: MotionExpertSpecV1['kind']
  readonly program: MotionExpertSpecV1['program']
  readonly classification: ExpertPerformanceClassV15
  readonly estimatedWorkUnits: number
  readonly activePrimitiveCeiling: number
  readonly pixelCount: number
  readonly measuredEvaluationMs?: number
  readonly warnings: readonly string[]
}

export interface MotionExpertPerformanceBudgetV15 {
  readonly maxClass: ExpertPerformanceClassV15
  readonly maxEvaluationMs?: number
  readonly maxPixelCount?: number
}

const rank = (value: ExpertPerformanceClassV15): number => EXPERT_PERFORMANCE_CLASSES_V15.indexOf(value)
const classify = (score: number): ExpertPerformanceClassV15 => score <= 64 ? 'LIGHT' : score <= 192 ? 'MEDIUM' : score <= 384 ? 'HEAVY' : 'EXTREME'

export const assessMotionExpertPerformanceV15 = (input: Readonly<{
  spec: MotionExpertSpecV1
  measuredEvaluationMs?: number
}>): MotionExpertPerformanceEvidenceV15 => {
  const { spec } = input
  const pixelCount = Math.round(spec.width * spec.height)
  const estimatedWorkUnits = spec.kind === 'procedural'
    ? spec.parameters.ringCount
    : spec.kind === 'particles'
      ? spec.parameters.count
      : Math.max(1, Math.ceil(pixelCount / (640 * 360))) * 96
  const classification = classify(estimatedWorkUnits)
  const warnings: string[] = []
  if (classification === 'HEAVY') warnings.push('Expert node is heavy; use bounded preview quality where the host supports it, while keeping canonical export unchanged.')
  if (classification === 'EXTREME') warnings.push('Expert node is extreme for interactive use and should require an explicit host budget.')
  if (typeof input.measuredEvaluationMs === 'number' && input.measuredEvaluationMs > 16.67) warnings.push('Measured expert evaluation exceeded one 60fps frame budget on this machine.')
  return Object.freeze({
    schemaVersion: 'sanverse.motion-expert-performance/v1',
    kind: spec.kind,
    program: spec.program,
    classification,
    estimatedWorkUnits,
    activePrimitiveCeiling: spec.maxPrimitives,
    pixelCount,
    ...(typeof input.measuredEvaluationMs === 'number' ? { measuredEvaluationMs: input.measuredEvaluationMs } : {}),
    warnings: Object.freeze(warnings),
  })
}

export const evaluateMotionExpertWithinBudgetV15 = (input: Readonly<{
  spec: MotionExpertSpecV1
  tick: number
  budget: MotionExpertPerformanceBudgetV15
  measuredEvaluationMs?: number
}>): CreativeValidationResultV1<Readonly<{ frame: MotionExpertRuntimeFrameV1; performance: MotionExpertPerformanceEvidenceV15 }>> => {
  const performance = assessMotionExpertPerformanceV15({ spec: input.spec, ...(typeof input.measuredEvaluationMs === 'number' ? { measuredEvaluationMs: input.measuredEvaluationMs } : {}) })
  if (rank(performance.classification) > rank(input.budget.maxClass)) {
    return creativeRefusal('EXPERT_BUDGET_EXCEEDED', `Expert ${input.spec.program} is ${performance.classification}, above the ${input.budget.maxClass} host budget.`, performance)
  }
  if (input.budget.maxPixelCount !== undefined && performance.pixelCount > input.budget.maxPixelCount) {
    return creativeRefusal('EXPERT_BUDGET_EXCEEDED', `Expert ${input.spec.program} exceeds the host pixel budget.`, performance)
  }
  if (input.budget.maxEvaluationMs !== undefined && typeof input.measuredEvaluationMs === 'number' && input.measuredEvaluationMs > input.budget.maxEvaluationMs) {
    return creativeRefusal('EXPERT_BUDGET_EXCEEDED', `Expert ${input.spec.program} exceeds the measured evaluation-time budget.`, performance)
  }
  const frame = evaluateMotionExpertAtTickV1({ spec: input.spec, tick: input.tick })
  if (!frame.ok) return frame as CreativeValidationResultV1<Readonly<{ frame: MotionExpertRuntimeFrameV1; performance: MotionExpertPerformanceEvidenceV15 }>>
  return creativeValidationOk(Object.freeze({ frame: frame.value, performance }))
}
