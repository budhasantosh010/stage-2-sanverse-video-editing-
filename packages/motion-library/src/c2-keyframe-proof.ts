import { constant, createDefaultEffect } from '@sanverse/motion-graph'
import type { MotionGraphOperationV1 } from '@sanverse/motion-graph'
import { SANVERSE_TICKS_PER_SECOND } from '@sanverse/motion-primitives'

export const C2_COST_CARD_PROOF_DURATION_TICKS = SANVERSE_TICKS_PER_SECOND * 5
const at = (progress: number): number => Math.round(C2_COST_CARD_PROOF_DURATION_TICKS * progress)

/**
 * A compositor-only C2 proof. It never changes Cost / Value Card JSX or
 * default scene construction; it replaces selected Animatable authorities via
 * the same universal operations available to a future human compositor.
 */
export const C2_COST_CARD_KEYFRAME_PROOF_OPERATIONS: readonly MotionGraphOperationV1[] = Object.freeze([
  // Surface has a built-in motion driver, so C2 requires an explicit authority reset before keyframing.
  { operationId: 'c2-proof:surface-reset', type: 'reset-property', target: { nodeId: 'cost-card.surface', property: 'opacity' }, value: constant(0) },
  { operationId: 'c2-proof:surface-0', type: 'add-keyframe', target: { kind: 'node', nodeId: 'cost-card.surface', property: 'opacity' }, keyframeId: 'kf-surface-0', tick: at(0), value: 0, interpolation: 'linear' },
  { operationId: 'c2-proof:surface-1', type: 'add-keyframe', target: { kind: 'node', nodeId: 'cost-card.surface', property: 'opacity' }, keyframeId: 'kf-surface-1', tick: at(0.22), value: 1, interpolation: 'bezier', bezier: { inX: 0.7, inY: 1, outX: 0.2, outY: 0.8 } },

  { operationId: 'c2-proof:value-scale-x-0', type: 'add-keyframe', target: { kind: 'node', nodeId: 'cost-card.value', property: 'transform.scaleX' }, keyframeId: 'kf-value-x-0', tick: at(0), value: 0.8, interpolation: 'bezier', bezier: { inX: 0.7, inY: 1, outX: 0.22, outY: 0.8 } },
  { operationId: 'c2-proof:value-scale-x-1', type: 'add-keyframe', target: { kind: 'node', nodeId: 'cost-card.value', property: 'transform.scaleX' }, keyframeId: 'kf-value-x-1', tick: at(0.42), value: 1.08, interpolation: 'bezier', bezier: { inX: 0.72, inY: 1.15, outX: 0.28, outY: 1.1 } },
  { operationId: 'c2-proof:value-scale-x-2', type: 'add-keyframe', target: { kind: 'node', nodeId: 'cost-card.value', property: 'transform.scaleX' }, keyframeId: 'kf-value-x-2', tick: at(0.60), value: 1, interpolation: 'linear' },
  { operationId: 'c2-proof:value-scale-y-0', type: 'add-keyframe', target: { kind: 'node', nodeId: 'cost-card.value', property: 'transform.scaleY' }, keyframeId: 'kf-value-y-0', tick: at(0), value: 0.8, interpolation: 'bezier', bezier: { inX: 0.7, inY: 1, outX: 0.22, outY: 0.8 } },
  { operationId: 'c2-proof:value-scale-y-1', type: 'add-keyframe', target: { kind: 'node', nodeId: 'cost-card.value', property: 'transform.scaleY' }, keyframeId: 'kf-value-y-1', tick: at(0.42), value: 1.08, interpolation: 'bezier', bezier: { inX: 0.72, inY: 1.15, outX: 0.28, outY: 1.1 } },
  { operationId: 'c2-proof:value-scale-y-2', type: 'add-keyframe', target: { kind: 'node', nodeId: 'cost-card.value', property: 'transform.scaleY' }, keyframeId: 'kf-value-y-2', tick: at(0.60), value: 1, interpolation: 'linear' },

  { operationId: 'c2-proof:arrow-0', type: 'add-keyframe', target: { kind: 'node', nodeId: 'cost-card.direction-indicator', property: 'transform.rotationDeg' }, keyframeId: 'kf-arrow-0', tick: at(0.18), value: -20, interpolation: 'bezier', bezier: { inX: 0.7, inY: 1, outX: 0.2, outY: 0.8 } },
  { operationId: 'c2-proof:arrow-1', type: 'add-keyframe', target: { kind: 'node', nodeId: 'cost-card.direction-indicator', property: 'transform.rotationDeg' }, keyframeId: 'kf-arrow-1', tick: at(0.45), value: 0, interpolation: 'linear' },

  { operationId: 'c2-proof:glow-add', type: 'add-effect', nodeId: 'cost-card.value', effect: createDefaultEffect('c2-proof-glow', 'glow') },
  { operationId: 'c2-proof:glow-0', type: 'add-keyframe', target: { kind: 'effect', nodeId: 'cost-card.value', effectId: 'c2-proof-glow', parameter: 'intensity' }, keyframeId: 'kf-glow-0', tick: at(0), value: 0, interpolation: 'linear' },
  { operationId: 'c2-proof:glow-1', type: 'add-keyframe', target: { kind: 'effect', nodeId: 'cost-card.value', effectId: 'c2-proof-glow', parameter: 'intensity' }, keyframeId: 'kf-glow-1', tick: at(0.46), value: 0.6, interpolation: 'bezier', bezier: { inX: 0.72, inY: 1, outX: 0.22, outY: 0.9 } },
  { operationId: 'c2-proof:glow-2', type: 'add-keyframe', target: { kind: 'effect', nodeId: 'cost-card.value', effectId: 'c2-proof-glow', parameter: 'intensity' }, keyframeId: 'kf-glow-2', tick: at(0.72), value: 0.2, interpolation: 'linear' },

  { operationId: 'c2-proof:position-0', type: 'add-keyframe', target: { kind: 'node', nodeId: 'cost-card.root', property: 'transform.positionY' }, keyframeId: 'kf-root-y-0', tick: at(0), value: 60, interpolation: 'bezier', bezier: { inX: 0.7, inY: 1, outX: 0.2, outY: 0.8 } },
  { operationId: 'c2-proof:position-1', type: 'add-keyframe', target: { kind: 'node', nodeId: 'cost-card.root', property: 'transform.positionY' }, keyframeId: 'kf-root-y-1', tick: at(0.30), value: 0, interpolation: 'linear' },
])
