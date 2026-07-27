import {
  activeOperations,
  compositionDuration,
  effectiveComposition,
  isOverlayOperation,
  placeSourceSpan,
  type EditProject,
} from '@sanverse/edit-domain'

import { NAMEPLATE_STYLE_ID } from './nameplate-style.ts'
import {
  RENDER_PLAN_SCHEMA_VERSION,
  validateRenderPlan,
  type RenderNode,
  type RenderPlan,
  type RenderPlanError,
  type SourceSegmentNode,
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
 *
 * Cuts are resolved first, because everything drawn on top is anchored to the
 * original footage and can only be positioned once it is known which parts of
 * that footage survived.
 */
export const compileProjectToRenderPlan = (project: EditProject): CompileResult => {
  const composition = effectiveComposition(project)
  const duration = compositionDuration(composition)
  if (duration.ticks <= 0) {
    return { ok: false, error: { code: 'COMPILE_FAILED', reason: 'The composition is empty.' } }
  }

  const segments: SourceSegmentNode[] = []
  for (const track of composition.tracks) {
    for (const clip of track.clips) {
      // A hidden piece leaves a hole rather than shifting everything after it,
      // so that switching it back on restores the exact video the user saw.
      if (!clip.enabled) continue
      segments.push(Object.freeze({
        nodeId: clip.clipId,
        kind: 'source-segment' as const,
        interval: Object.freeze({
          start: clip.compositionStart,
          duration: clip.sourceRange.duration,
        }),
        assetId: clip.assetId,
        sourceStartTicks: clip.sourceRange.start.ticks,
        gainDb: clip.gainDb,
        fadeInTicks: clip.fadeIn.ticks,
        fadeOutTicks: clip.fadeOut.ticks,
      }))
    }
  }
  segments.sort((left, right) => left.interval.start.ticks - right.interval.start.ticks)

  if (segments.length === 0) {
    return { ok: false, error: { code: 'COMPILE_FAILED', reason: 'Every piece of footage is switched off.' } }
  }

  const overlays: RenderNode[] = []
  for (const operation of activeOperations(project)) {
    if (!isOverlayOperation(operation)) continue

    // One nameplate can produce two on-screen appearances if a cut passed
    // through the middle of it: it stays with the footage on both sides.
    const placements = placeSourceSpan(composition, operation.assetId, operation.sourceInterval)
    for (const [index, placement] of placements.entries()) {
      if (!placement.clip.enabled) continue
      overlays.push(Object.freeze({
        nodeId: index === 0 ? operation.operationId : `${operation.operationId}.${placement.clip.clipId}`,
        kind: 'text-overlay' as const,
        interval: placement.compositionRange,
        target: operation.target,
        primaryText: operation.primaryText,
        secondaryText: operation.secondaryText,
        styleId: NAMEPLATE_STYLE_ID,
      }))
    }
  }
  overlays.sort((left, right) => left.interval.start.ticks - right.interval.start.ticks)

  const plan = {
    schemaVersion: RENDER_PLAN_SCHEMA_VERSION,
    projectId: project.projectId,
    projectRevision: project.revision,
    compositionId: composition.compositionId,
    width: composition.width,
    height: composition.height,
    durationTicks: duration.ticks,
    segments: Object.freeze(segments),
    overlays: Object.freeze(overlays),
  }

  // Compiled output is checked by the same validator that guards a plan
  // arriving from anywhere else, so the compiler cannot be the one component
  // allowed to emit something a renderer would choke on.
  return validateRenderPlan(plan)
}
