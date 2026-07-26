import {
  activeOperations,
  clipCompositionRange,
  compositionDuration,
  findClip,
  type EditProject,
} from '@sanverse/edit-domain'

import { NAMEPLATE_STYLE_ID } from './nameplate-style.ts'
import {
  RENDER_PLAN_SCHEMA_VERSION,
  validateRenderPlan,
  type RenderNode,
  type RenderPlan,
  type RenderPlanError,
} from './render-plan.ts'

export type CompileResult =
  | { readonly ok: true; readonly value: RenderPlan }
  | { readonly ok: false; readonly error: RenderPlanError | { readonly code: 'COMPILE_FAILED'; readonly reason: string } }

/**
 * Turn a project into the single description both renderers consume.
 *
 * Only operations from change sets that are switched on and not blocked reach
 * the plan. A change set the user turned off, or one the system marked blocked
 * because it no longer fits, contributes nothing — and is not silently
 * repaired to make it contribute.
 */
export const compileProjectToRenderPlan = (project: EditProject): CompileResult => {
  const duration = compositionDuration(project.composition)
  if (duration.ticks <= 0) {
    return { ok: false, error: { code: 'COMPILE_FAILED', reason: 'The composition is empty.' } }
  }

  const nodes: RenderNode[] = []
  for (const operation of activeOperations(project)) {
    const clip = findClip(project.composition, operation.clipId)
    if (!clip) {
      return { ok: false, error: { code: 'COMPILE_FAILED', reason: `Unknown clip ${operation.clipId}.` } }
    }
    if (!clip.enabled) continue

    const clipRange = clipCompositionRange(clip)
    const start = Math.max(operation.compositionInterval.start.ticks, clipRange.start.ticks)
    const end = Math.min(
      operation.compositionInterval.start.ticks + operation.compositionInterval.duration.ticks,
      clipRange.start.ticks + clipRange.duration.ticks,
    )
    if (end <= start) continue

    nodes.push(Object.freeze({
      nodeId: operation.operationId,
      kind: 'text-overlay' as const,
      interval: Object.freeze({
        start: Object.freeze({ ticks: start, timescale: project.timescale }),
        duration: Object.freeze({ ticks: end - start, timescale: project.timescale }),
      }),
      target: operation.target,
      primaryText: operation.primaryText,
      secondaryText: operation.secondaryText,
      styleId: NAMEPLATE_STYLE_ID,
    }))
  }

  const plan = {
    schemaVersion: RENDER_PLAN_SCHEMA_VERSION,
    projectId: project.projectId,
    projectRevision: project.revision,
    compositionId: project.composition.compositionId,
    width: project.composition.width,
    height: project.composition.height,
    durationTicks: duration.ticks,
    nodes: Object.freeze(nodes),
  }

  // Compiled output is checked by the same validator that guards a plan
  // arriving from anywhere else, so the compiler cannot be the one component
  // allowed to emit something a renderer would choke on.
  return validateRenderPlan(plan)
}
