import { creativeOperationOk, creativeOperationRefusal, type CreativeOperationResultV1 } from '@sanverse/motion-contract'
import { validateMotionPlanV1, type MotionPlanV1 } from '@sanverse/creative-direction'
import { applyMotionOperations, type MotionGraphOperationV1, type MotionSceneV1 } from '@sanverse/motion-graph'
import { compileMotionIntentV1 } from './semantic-motion.ts'

export interface AppliedAtomicMotionPlanV15 {
  readonly scene: MotionSceneV1
  readonly operations: readonly MotionGraphOperationV1[]
  readonly inverseOperations: readonly MotionGraphOperationV1[]
  readonly intentIds: readonly string[]
  readonly baseScene: MotionSceneV1
}

/**
 * Compile dependent semantic intents against a scratch scene, then commit the
 * complete result through one canonical Motion Graph batch. The scratch graph
 * is never published; a failed compile/apply leaves the supplied scene intact.
 */
export const applyMotionPlanAtomicV15 = (
  scene: MotionSceneV1,
  plan: MotionPlanV1,
): CreativeOperationResultV1<AppliedAtomicMotionPlanV15> => {
  const valid = validateMotionPlanV1(plan)
  if (!valid.ok) return creativeOperationRefusal(valid.refusal.code, valid.refusal.message, valid.refusal.details)

  let scratch = scene
  const operations: MotionGraphOperationV1[] = []
  const intentIds: string[] = []
  const durationTicks = Math.max(1, plan.beats.at(-1)?.endTick ?? 1)

  for (const beat of plan.beats) {
    for (const intent of beat.operationIntents) {
      const compiled = compileMotionIntentV1(scratch, intent)
      if (!compiled.ok) return creativeOperationRefusal(compiled.refusal.code, compiled.refusal.message, compiled.refusal.details)
      const simulated = applyMotionOperations(scratch, compiled.value, { durationTicks })
      if (!simulated.ok) return creativeOperationRefusal('MOTION_PLAN_COMPILE_FAILED', simulated.error.message, simulated.error)
      scratch = simulated.scene
      operations.push(...compiled.value)
      intentIds.push(intent.id)
    }
  }

  const committed = applyMotionOperations(scene, Object.freeze(operations), { durationTicks })
  if (!committed.ok) return creativeOperationRefusal('MOTION_PLAN_ATOMIC_APPLY_FAILED', committed.error.message, committed.error)
  if (committed.inverseOperations === null) return creativeOperationRefusal('MOTION_PLAN_INVERSE_REQUIRED', 'Atomic V1.5 MotionPlan must produce a reversible canonical inverse batch.')

  return creativeOperationOk(Object.freeze({
    scene: committed.scene,
    operations: Object.freeze([...operations]),
    inverseOperations: Object.freeze([...committed.inverseOperations]),
    intentIds: Object.freeze([...intentIds]),
    baseScene: scene,
  }), plan.revision)
}
