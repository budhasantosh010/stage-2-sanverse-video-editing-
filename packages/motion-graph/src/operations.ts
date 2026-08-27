import { MOTION_BLEND_MODES, MOTION_EFFECT_REGISTRY, MOTION_EFFECT_TYPES } from './effects.ts'
import type { MotionBlendModeV1, MotionEffectInstanceV1, MotionEffectParameterDefinitionV1 } from './effects.ts'
import { MOTION_MASK_TYPES } from './masks.ts'
import type { MotionMaskInstanceV1 } from './masks.ts'
import { removeMotionMatteRelationshipV1, setMotionMatteRelationshipV1, validateMotionMatteRelationshipV1 } from './compositing.ts'
import type { MotionMatteRelationshipV1 } from './compositing.ts'
import { nodeBase } from './nodes.ts'
import type { MotionGroupNodeV1, MotionNodeV1 } from './nodes.ts'
import { evaluateKeyframedValue, motionBezierHandleIssue } from './animation.ts'
import { readMotionAnimatableTarget, replaceMotionAnimatableTarget, validateMotionTargetInterpolation, validateMotionTargetLiteral } from './animatable-targets.ts'
import { applyMotionGraphPatch } from './patches.ts'
import type { MotionGraphPatchV1 } from './patches.ts'
import { constant, keyframed } from './properties.ts'
import type { Animatable, MotionBezierHandlesV1, MotionKeyframeInterpolationV1, MotionKeyframeTargetV1, MotionNodePropertyNameV1, MotionNodePropertyPathV1, MotionPropertyPrimitiveV1 } from './properties.ts'
import type { MotionSceneV1 } from './scene.ts'
import type { MotionAuthoringMetadataV1 } from './authoring.ts'
import { motionNodeLockState } from './authoring.ts'
import { validateMotionScene } from './validation.ts'

export type MotionMaskPropertyNameV1 = 'enabled' | 'invert' | 'opacity' | 'feather' | 'expansion' | 'x' | 'y' | 'width' | 'height' | 'radius'

interface MotionOperationBaseV1 {
  readonly operationId: string
}

export type MotionGraphOperationV1 =
  | (MotionOperationBaseV1 & Readonly<{ type: 'set-property'; target: MotionNodePropertyPathV1; value: Animatable<MotionPropertyPrimitiveV1> }>)
  | (MotionOperationBaseV1 & Readonly<{ type: 'reset-property'; target: MotionNodePropertyPathV1; value: Animatable<MotionPropertyPrimitiveV1> }>)
  | (MotionOperationBaseV1 & Readonly<{ type: 'set-node-enabled'; nodeId: string; enabled: boolean }>)
  | (MotionOperationBaseV1 & Readonly<{ type: 'add-keyframe'; target: MotionKeyframeTargetV1; keyframeId: string; tick: number; value?: MotionPropertyPrimitiveV1; interpolation: MotionKeyframeInterpolationV1; bezier?: MotionBezierHandlesV1 }>)
  | (MotionOperationBaseV1 & Readonly<{ type: 'remove-keyframe'; target: MotionKeyframeTargetV1; keyframeId: string }>)
  | (MotionOperationBaseV1 & Readonly<{ type: 'move-keyframe'; target: MotionKeyframeTargetV1; keyframeId: string; tick: number }>)
  | (MotionOperationBaseV1 & Readonly<{ type: 'set-keyframe-value'; target: MotionKeyframeTargetV1; keyframeId: string; value: MotionPropertyPrimitiveV1 }>)
  | (MotionOperationBaseV1 & Readonly<{ type: 'set-keyframe-interpolation'; target: MotionKeyframeTargetV1; keyframeId: string; interpolation: MotionKeyframeInterpolationV1 }>)
  | (MotionOperationBaseV1 & Readonly<{ type: 'set-keyframe-bezier'; target: MotionKeyframeTargetV1; keyframeId: string; bezier: MotionBezierHandlesV1 | null }>)
  | (MotionOperationBaseV1 & Readonly<{ type: 'clear-keyframes'; target: MotionKeyframeTargetV1; fallbackValue: MotionPropertyPrimitiveV1 }>)
  | (MotionOperationBaseV1 & Readonly<{ type: 'add-node'; node: MotionNodeV1; parentId: string; index?: number }>)
  | (MotionOperationBaseV1 & Readonly<{ type: 'remove-node'; nodeId: string; mode: 'subtree' }>)
  | (MotionOperationBaseV1 & Readonly<{ type: 'duplicate-node'; nodeId: string; duplicateId: string; parentId?: string; index?: number }>)
  | (MotionOperationBaseV1 & Readonly<{ type: 'rename-node'; nodeId: string; name: string }>)
  | (MotionOperationBaseV1 & Readonly<{ type: 'reparent-node'; nodeId: string; parentId: string; index?: number }>)
  | (MotionOperationBaseV1 & Readonly<{ type: 'reorder-node'; nodeId: string; index: number }>)
  | (MotionOperationBaseV1 & Readonly<{ type: 'group-nodes'; nodeIds: readonly string[]; groupId: string; groupName: string; index?: number }>)
  | (MotionOperationBaseV1 & Readonly<{ type: 'ungroup-nodes'; groupId: string }>)
  | (MotionOperationBaseV1 & Readonly<{ type: 'add-effect'; nodeId: string; effect: MotionEffectInstanceV1; index?: number }>)
  | (MotionOperationBaseV1 & Readonly<{ type: 'remove-effect'; nodeId: string; effectId: string }>)
  | (MotionOperationBaseV1 & Readonly<{ type: 'duplicate-effect'; nodeId: string; effectId: string; duplicateId: string; index?: number }>)
  | (MotionOperationBaseV1 & Readonly<{ type: 'reorder-effect'; nodeId: string; effectId: string; index: number }>)
  | (MotionOperationBaseV1 & Readonly<{ type: 'set-effect-property'; nodeId: string; effectId: string; parameter: string; value: Animatable<number | string> }>)
  | (MotionOperationBaseV1 & Readonly<{ type: 'set-effect-enabled'; nodeId: string; effectId: string; enabled: boolean }>)
  | (MotionOperationBaseV1 & Readonly<{ type: 'add-mask'; nodeId: string; mask: MotionMaskInstanceV1; index?: number }>)
  | (MotionOperationBaseV1 & Readonly<{ type: 'remove-mask'; nodeId: string; maskId: string }>)
  | (MotionOperationBaseV1 & Readonly<{ type: 'reorder-mask'; nodeId: string; maskId: string; index: number }>)
  | (MotionOperationBaseV1 & Readonly<{ type: 'set-mask-property'; nodeId: string; maskId: string; property: MotionMaskPropertyNameV1; value: boolean | Animatable<number> }>)
  | (MotionOperationBaseV1 & Readonly<{ type: 'set-matte'; relationship: MotionMatteRelationshipV1 }>)
  | (MotionOperationBaseV1 & Readonly<{ type: 'remove-matte'; matteId: string }>)
  | (MotionOperationBaseV1 & Readonly<{ type: 'set-blend-mode'; nodeId: string; blendMode: MotionBlendModeV1 }>)

export const MOTION_GRAPH_OPERATION_TYPES = Object.freeze([
  'set-property', 'reset-property', 'set-node-enabled',
  'add-keyframe', 'remove-keyframe', 'move-keyframe', 'set-keyframe-value', 'set-keyframe-interpolation', 'set-keyframe-bezier', 'clear-keyframes',
  'add-node', 'remove-node', 'duplicate-node', 'rename-node', 'reparent-node', 'reorder-node', 'group-nodes', 'ungroup-nodes',
  'add-effect', 'remove-effect', 'duplicate-effect', 'reorder-effect', 'set-effect-property', 'set-effect-enabled',
  'add-mask', 'remove-mask', 'reorder-mask', 'set-mask-property',
  'set-matte', 'remove-matte', 'set-blend-mode',
] as const satisfies readonly MotionGraphOperationV1['type'][])

export type MotionOperationErrorCodeV1 =
  | 'OPERATION_INVALID'
  | 'SCENE_INVALID'
  | 'TARGET_NOT_FOUND'
  | 'PROPERTY_INVALID'
  | 'KEYFRAME_INVALID'
  | 'KEYFRAME_UNSUPPORTED'
  | 'KEYFRAME_COLLISION'
  | 'KEYFRAME_CONVERSION_REQUIRED'
  | 'DUPLICATE_ID'
  | 'PARENT_INVALID'
  | 'CYCLE_DETECTED'
  | 'INDEX_INVALID'
  | 'ROOT_PROTECTED'
  | 'LOCKED'
  | 'GROUP_INVALID'
  | 'EFFECT_INVALID'
  | 'EFFECT_PARAMETER_INVALID'
  | 'MASK_INVALID'
  | 'MATTE_INVALID'
  | 'BLEND_MODE_INVALID'
  | 'RESULT_INVALID'
  | 'BATCH_FAILED'

export interface MotionOperationErrorV1 {
  readonly code: MotionOperationErrorCodeV1
  readonly operationId: string
  readonly message: string
  readonly path?: string
  readonly causeCode?: MotionOperationErrorCodeV1
  readonly failedOperationIndex?: number
}

export interface MotionOperationSuccessV1 {
  readonly ok: true
  readonly scene: MotionSceneV1
  readonly affectedNodeIds: readonly string[]
  readonly inverseOperations: readonly MotionGraphOperationV1[] | null
}

export interface MotionOperationFailureV1 {
  readonly ok: false
  readonly error: MotionOperationErrorV1
}

export type MotionOperationResultV1 = MotionOperationSuccessV1 | MotionOperationFailureV1

export interface MotionOperationIdRequestV1 {
  readonly operationId: string
  readonly kind: 'node' | 'effect' | 'mask' | 'component-instance'
  readonly sourceId: string
  readonly suggestedId: string
}

export interface MotionOperationApplyOptionsV1 {
  readonly idFactory?: (request: MotionOperationIdRequestV1) => string
  /** Optional owning composition duration. When supplied, keyframe mutations refuse ticks beyond it. */
  readonly durationTicks?: number
  /** Persistent authoring-only metadata. Locks gate mutations but never alter rendered pixels. */
  readonly authoringMetadata?: MotionAuthoringMetadataV1
}

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value)
const boundedId = (value: unknown): value is string => typeof value === 'string' && value.trim().length > 0 && value.length <= 240
const boundedName = (value: unknown): value is string => typeof value === 'string' && value.trim().length > 0 && value.length <= 240
const validIndex = (value: unknown): value is number => Number.isSafeInteger(value) && Number(value) >= 0
const validTick = (value: unknown): value is number => Number.isSafeInteger(value) && Number(value) >= 0
const primitive = (value: unknown): value is MotionPropertyPrimitiveV1 => ['number', 'string', 'boolean'].includes(typeof value) && (typeof value !== 'number' || Number.isFinite(value))
const validKeyframeTargetSyntax = (value: unknown): value is MotionKeyframeTargetV1 => {
  if (!isRecord(value) || !boundedId(value.nodeId) || typeof value.kind !== 'string') return false
  if (value.kind === 'node') return typeof value.property === 'string'
  if (value.kind === 'effect') return boundedId(value.effectId) && boundedId(value.parameter)
  if (value.kind === 'mask') return boundedId(value.maskId) && ['opacity', 'feather', 'expansion', 'x', 'y', 'width', 'height', 'radius'].includes(String(value.property))
  return false
}
const validInterpolation = (value: unknown): value is MotionKeyframeInterpolationV1 => ['hold', 'linear', 'bezier'].includes(String(value))
const validBezierSyntax = (value: unknown): value is MotionBezierHandlesV1 => isRecord(value) && ['inX', 'inY', 'outX', 'outY'].every((key) => typeof value[key] === 'number')

const fail = (
  operationId: string,
  code: MotionOperationErrorCodeV1,
  message: string,
  extras: Readonly<Pick<MotionOperationErrorV1, 'path' | 'causeCode' | 'failedOperationIndex'>> = {},
): MotionOperationFailureV1 => Object.freeze({ ok: false, error: Object.freeze({ code, operationId, message, ...extras }) })

const success = (
  scene: MotionSceneV1,
  affectedNodeIds: readonly string[],
  inverseOperations: readonly MotionGraphOperationV1[] | null,
): MotionOperationSuccessV1 => Object.freeze({
  ok: true,
  scene,
  affectedNodeIds: Object.freeze([...new Set(affectedNodeIds)]),
  inverseOperations: inverseOperations === null ? null : Object.freeze([...inverseOperations]),
})

export const validateMotionGraphOperation = (input: unknown): MotionOperationErrorV1 | null => {
  const operationId = isRecord(input) && typeof input.operationId === 'string' ? input.operationId : 'unknown-operation'
  if (!isRecord(input)) return Object.freeze({ code: 'OPERATION_INVALID', operationId, message: 'Motion operation must be an object.' })
  if (!boundedId(input.operationId)) return Object.freeze({ code: 'OPERATION_INVALID', operationId, path: '$.operationId', message: 'operationId must be a bounded non-empty string.' })
  if (typeof input.type !== 'string' || !MOTION_GRAPH_OPERATION_TYPES.includes(input.type as MotionGraphOperationV1['type'])) return Object.freeze({ code: 'OPERATION_INVALID', operationId, path: '$.type', message: 'Operation type is unsupported.' })
  const keyframeTypes = ['add-keyframe', 'remove-keyframe', 'move-keyframe', 'set-keyframe-value', 'set-keyframe-interpolation', 'set-keyframe-bezier', 'clear-keyframes']
  if (keyframeTypes.includes(input.type)) {
    if (!validKeyframeTargetSyntax(input.target)) return Object.freeze({ code: 'OPERATION_INVALID', operationId, path: '$.target', message: 'Keyframe operation needs a valid node/effect/mask target.' })
    if (input.type !== 'clear-keyframes' && !boundedId(input.keyframeId)) return Object.freeze({ code: 'OPERATION_INVALID', operationId, path: '$.keyframeId', message: 'Keyframe operation needs a bounded keyframeId.' })
    if ((input.type === 'add-keyframe' || input.type === 'move-keyframe') && !validTick(input.tick)) return Object.freeze({ code: 'OPERATION_INVALID', operationId, path: '$.tick', message: 'Keyframe tick must be a non-negative safe integer.' })
    if (input.type === 'add-keyframe' && (!validInterpolation(input.interpolation) || (input.value !== undefined && !primitive(input.value)) || (input.bezier !== undefined && !validBezierSyntax(input.bezier)))) return Object.freeze({ code: 'OPERATION_INVALID', operationId, message: 'add-keyframe has invalid interpolation, value or Bezier data.' })
    if (input.type === 'set-keyframe-value' && !primitive(input.value)) return Object.freeze({ code: 'OPERATION_INVALID', operationId, path: '$.value', message: 'Keyframe value must be a finite primitive.' })
    if (input.type === 'set-keyframe-interpolation' && !validInterpolation(input.interpolation)) return Object.freeze({ code: 'OPERATION_INVALID', operationId, path: '$.interpolation', message: 'Keyframe interpolation is unsupported.' })
    if (input.type === 'set-keyframe-bezier' && input.bezier !== null && !validBezierSyntax(input.bezier)) return Object.freeze({ code: 'OPERATION_INVALID', operationId, path: '$.bezier', message: 'Keyframe Bezier handles are invalid.' })
    if (input.type === 'clear-keyframes' && !primitive(input.fallbackValue)) return Object.freeze({ code: 'OPERATION_INVALID', operationId, path: '$.fallbackValue', message: 'clear-keyframes requires an explicit finite fallbackValue.' })
  }
  const needsNodeId = ['set-node-enabled', 'remove-node', 'duplicate-node', 'rename-node', 'reparent-node', 'reorder-node', 'add-effect', 'remove-effect', 'duplicate-effect', 'reorder-effect', 'set-effect-property', 'set-effect-enabled', 'add-mask', 'remove-mask', 'reorder-mask', 'set-mask-property', 'set-blend-mode']
  if (needsNodeId.includes(input.type) && !boundedId(input.nodeId)) return Object.freeze({ code: 'OPERATION_INVALID', operationId, path: '$.nodeId', message: 'nodeId must be a bounded non-empty string.' })
  if (input.type === 'set-node-enabled' && typeof input.enabled !== 'boolean') return Object.freeze({ code: 'OPERATION_INVALID', operationId, path: '$.enabled', message: 'Node enabled state must be boolean.' })
  if ((input.type === 'set-property' || input.type === 'reset-property') && (!isRecord(input.target) || !boundedId(input.target.nodeId) || typeof input.target.property !== 'string' || !isRecord(input.value))) return Object.freeze({ code: 'OPERATION_INVALID', operationId, message: 'Property operation needs a typed target and animatable value.' })
  if (input.type === 'add-node' && (!isRecord(input.node) || !boundedId(input.node.id) || !boundedId(input.parentId))) return Object.freeze({ code: 'OPERATION_INVALID', operationId, message: 'add-node needs a node and parentId.' })
  if (input.type === 'remove-node' && input.mode !== 'subtree') return Object.freeze({ code: 'OPERATION_INVALID', operationId, path: '$.mode', message: 'remove-node V1 supports explicit subtree removal only.' })
  if (input.type === 'duplicate-node' && !boundedId(input.duplicateId)) return Object.freeze({ code: 'OPERATION_INVALID', operationId, path: '$.duplicateId', message: 'duplicate-node needs a bounded duplicateId.' })
  if (input.type === 'rename-node' && !boundedName(input.name)) return Object.freeze({ code: 'OPERATION_INVALID', operationId, path: '$.name', message: 'rename-node needs a bounded non-empty name.' })
  if (input.type === 'reparent-node' && !boundedId(input.parentId)) return Object.freeze({ code: 'OPERATION_INVALID', operationId, path: '$.parentId', message: 'reparent-node needs parentId.' })
  if ((input.type === 'reorder-node' || input.type === 'reorder-effect' || input.type === 'reorder-mask') && !validIndex(input.index)) return Object.freeze({ code: 'OPERATION_INVALID', operationId, path: '$.index', message: 'Reorder index must be a non-negative safe integer.' })
  if (input.type === 'group-nodes' && (!Array.isArray(input.nodeIds) || input.nodeIds.length === 0 || !input.nodeIds.every(boundedId) || !boundedId(input.groupId) || !boundedName(input.groupName))) return Object.freeze({ code: 'OPERATION_INVALID', operationId, message: 'group-nodes needs nodeIds, groupId and groupName.' })
  if (input.type === 'ungroup-nodes' && !boundedId(input.groupId)) return Object.freeze({ code: 'OPERATION_INVALID', operationId, path: '$.groupId', message: 'ungroup-nodes needs groupId.' })
  if (input.type === 'add-effect' && !isRecord(input.effect)) return Object.freeze({ code: 'OPERATION_INVALID', operationId, path: '$.effect', message: 'add-effect needs an effect definition.' })
  if (['remove-effect', 'duplicate-effect', 'reorder-effect', 'set-effect-property', 'set-effect-enabled'].includes(input.type) && !boundedId(input.effectId)) return Object.freeze({ code: 'OPERATION_INVALID', operationId, path: '$.effectId', message: 'Effect operation needs effectId.' })
  if (input.type === 'duplicate-effect' && !boundedId(input.duplicateId)) return Object.freeze({ code: 'OPERATION_INVALID', operationId, path: '$.duplicateId', message: 'duplicate-effect needs duplicateId.' })
  if (input.type === 'set-effect-property' && (!boundedId(input.parameter) || !isRecord(input.value))) return Object.freeze({ code: 'OPERATION_INVALID', operationId, message: 'set-effect-property needs parameter and animatable value.' })
  if (input.type === 'set-effect-enabled' && typeof input.enabled !== 'boolean') return Object.freeze({ code: 'OPERATION_INVALID', operationId, path: '$.enabled', message: 'Effect enabled state must be boolean.' })
  if (input.type === 'add-mask' && !isRecord(input.mask)) return Object.freeze({ code: 'OPERATION_INVALID', operationId, path: '$.mask', message: 'add-mask needs a mask definition.' })
  if (['remove-mask', 'reorder-mask', 'set-mask-property'].includes(input.type) && !boundedId(input.maskId)) return Object.freeze({ code: 'OPERATION_INVALID', operationId, path: '$.maskId', message: 'Mask operation needs maskId.' })
  if (input.type === 'set-mask-property' && typeof input.property !== 'string') return Object.freeze({ code: 'OPERATION_INVALID', operationId, path: '$.property', message: 'Mask operation needs property.' })
  if (input.type === 'set-matte' && (!isRecord(input.relationship) || !boundedId(input.relationship.id) || !boundedId(input.relationship.sourceNodeId) || !boundedId(input.relationship.targetNodeId) || typeof input.relationship.mode !== 'string' || typeof input.relationship.order !== 'string')) return Object.freeze({ code: 'OPERATION_INVALID', operationId, path: '$.relationship', message: 'set-matte needs a typed matte relationship.' })
  if (input.type === 'remove-matte' && !boundedId(input.matteId)) return Object.freeze({ code: 'OPERATION_INVALID', operationId, path: '$.matteId', message: 'remove-matte needs matteId.' })
  if (input.type === 'set-blend-mode' && typeof input.blendMode !== 'string') return Object.freeze({ code: 'OPERATION_INVALID', operationId, path: '$.blendMode', message: 'Blend mode must be a string.' })
  if ('index' in input && input.index !== undefined && !validIndex(input.index)) return Object.freeze({ code: 'OPERATION_INVALID', operationId, path: '$.index', message: 'Insertion index must be a non-negative safe integer.' })
  return null
}

const nodeSupportsProperty = (node: MotionNodeV1, property: MotionNodePropertyNameV1): boolean => {
  if (property === 'visible' || property === 'opacity' || property.startsWith('transform.')) return true
  if (node.type === 'text') return ['text.text', 'text.fillColor', 'text.fontSize', 'text.fontWeight'].includes(property)
  if (node.type === 'shape') return ['shape.width', 'shape.height', 'shape.fillColor', 'shape.strokeColor', 'shape.strokeWidth', 'shape.radius'].includes(property)
  if (node.type === 'path') return ['path.fillColor', 'path.strokeColor', 'path.strokeWidth', 'path.trimProgress'].includes(property)
  return node.type === 'image' && ['image.width', 'image.height', 'image.opacity'].includes(property)
}

const nodeProperty = (node: MotionNodeV1, property: MotionNodePropertyNameV1): Animatable<MotionPropertyPrimitiveV1> => {
  if (property === 'visible') return node.visible
  if (property === 'opacity') return node.opacity
  if (property === 'transform.perspectiveMatrix3d') return node.transform.perspectiveMatrix3d ?? constant('none')
  if (property.startsWith('transform.')) return node.transform[property.slice('transform.'.length) as Exclude<keyof MotionNodeV1['transform'],'perspectiveMatrix3d'>] as Animatable<MotionPropertyPrimitiveV1>
  if (node.type === 'text') {
    if (property === 'text.text') return node.text
    if (property === 'text.fillColor') return node.fillColor
    if (property === 'text.fontSize') return node.fontSize
    if (property === 'text.fontWeight') return node.fontWeight
  }
  if (node.type === 'shape') {
    if (property === 'shape.width') return node.width
    if (property === 'shape.height') return node.height
    if (property === 'shape.fillColor') return node.fillColor
    if (property === 'shape.strokeColor') return node.strokeColor
    if (property === 'shape.strokeWidth') return node.strokeWidth
    if (property === 'shape.radius') return node.radius
  }
  if (node.type === 'path') {
    if (property === 'path.fillColor') return node.fillColor
    if (property === 'path.strokeColor') return node.strokeColor
    if (property === 'path.strokeWidth') return node.strokeWidth
    if (property === 'path.trimProgress') return node.trimProgress
  }
  if (node.type === 'image') {
    if (property === 'image.width') return node.width
    if (property === 'image.height') return node.height
    if (property === 'image.opacity') return node.imageOpacity
  }
  throw new RangeError(`Property ${property} is not supported by node ${node.id}.`)
}

const animatableLiteralValues = (value: Animatable<number | string>): readonly (number | string)[] => {
  if (value.kind === 'constant') return Object.freeze([value.value])
  if (value.kind === 'keyframes') return Object.freeze(value.keyframes.map((keyframe) => keyframe.value))
  return Object.freeze([])
}

const validateEffectParameterValue = (definition: MotionEffectParameterDefinitionV1, value: Animatable<number | string>): string | null => {
  const literals = animatableLiteralValues(value)
  if (value.kind === 'motion' && ((definition.type === 'number' && value.valueType !== 'number') || (definition.type === 'color' && value.valueType !== 'string'))) return `Effect parameter ${definition.id} has the wrong animated value type.`
  for (const literal of literals) {
    if (definition.type === 'number') {
      if (typeof literal !== 'number' || !Number.isFinite(literal)) return `Effect parameter ${definition.id} must be numeric.`
      if (definition.minimum !== undefined && literal < definition.minimum) return `Effect parameter ${definition.id} is below ${definition.minimum}.`
      if (definition.maximum !== undefined && literal > definition.maximum) return `Effect parameter ${definition.id} is above ${definition.maximum}.`
    } else if (typeof literal !== 'string' || literal.trim().length === 0 || literal.length > 128) return `Effect parameter ${definition.id} must be a bounded color string.`
  }
  return null
}

const validateEffectForNode = (node: MotionNodeV1, effect: MotionEffectInstanceV1): string | null => {
  if (!boundedId(effect.id)) return 'Effect id must be a bounded non-empty string.'
  if (!MOTION_EFFECT_TYPES.includes(effect.effectType)) return `Unsupported effect type: ${String(effect.effectType)}`
  const definition = MOTION_EFFECT_REGISTRY[effect.effectType]
  if (!definition.supportedNodeTypes.includes(node.type)) return `Effect ${effect.effectType} does not support ${node.type} nodes.`
  const parameterIds = new Set(definition.parameters.map((parameter) => parameter.id))
  for (const parameter of Object.keys(effect.parameters)) if (!parameterIds.has(parameter)) return `Unknown ${effect.effectType} parameter: ${parameter}`
  for (const parameter of definition.parameters) {
    const value = effect.parameters[parameter.id]
    if (!value) return `Missing ${effect.effectType} parameter: ${parameter.id}`
    const issue = validateEffectParameterValue(parameter, value)
    if (issue) return issue
  }
  return null
}

const maskLiteralNumbers = (value: Animatable<number>): readonly number[] => value.kind === 'constant' ? Object.freeze([value.value]) : value.kind === 'keyframes' ? Object.freeze(value.keyframes.map((keyframe) => keyframe.value)) : Object.freeze([])
const maskRange = (property: Exclude<MotionMaskPropertyNameV1, 'enabled' | 'invert'>): readonly [number, number] => {
  if (property === 'opacity' || property === 'feather' || property === 'radius') return [0, 1]
  if (property === 'expansion') return [-1, 1]
  if (property === 'width' || property === 'height') return [0, 4]
  return [-2, 2]
}

const validateMask = (mask: MotionMaskInstanceV1): string | null => {
  if (!boundedId(mask.id)) return 'Mask id must be a bounded non-empty string.'
  if (!MOTION_MASK_TYPES.includes(mask.type)) return `Unsupported mask type: ${String(mask.type)}`
  for (const property of ['opacity', 'feather', 'expansion', 'x', 'y', 'width', 'height', 'radius'] as const) {
    const [minimum, maximum] = maskRange(property)
    for (const value of maskLiteralNumbers(mask[property])) if (!Number.isFinite(value) || value < minimum || value > maximum) return `Mask ${property} must stay inside [${minimum}, ${maximum}].`
  }
  return null
}

const findNode = (scene: MotionSceneV1, nodeId: string): MotionNodeV1 | null => scene.nodes[nodeId] ?? null
const parentGroup = (scene: MotionSceneV1, node: MotionNodeV1): MotionGroupNodeV1 | null => node.parentId && scene.nodes[node.parentId]?.type === 'group' ? scene.nodes[node.parentId] as MotionGroupNodeV1 : null
const siblingIndex = (scene: MotionSceneV1, node: MotionNodeV1): number => parentGroup(scene, node)?.childIds.indexOf(node.id) ?? -1
const effectIndex = (node: MotionNodeV1, effectId: string): number => node.effects.findIndex((effect) => effect.id === effectId)
const maskIndex = (node: MotionNodeV1, maskId: string): number => node.masks.findIndex((mask) => mask.id === maskId)

const wouldCreateCycle = (scene: MotionSceneV1, nodeId: string, parentId: string): boolean => {
  let current: string | null = parentId
  while (current) {
    if (current === nodeId) return true
    current = scene.nodes[current]?.parentId ?? null
  }
  return false
}

const defaultDuplicateId = (request: MotionOperationIdRequestV1): string => request.suggestedId
const deriveId = (options: MotionOperationApplyOptionsV1 | undefined, request: MotionOperationIdRequestV1): string => (options?.idFactory ?? defaultDuplicateId)(request)

const cloneAnimatable = <T,>(value: Animatable<T>): Animatable<T> => JSON.parse(JSON.stringify(value)) as Animatable<T>
const cloneEffect = (effect: MotionEffectInstanceV1, id: string): MotionEffectInstanceV1 => Object.freeze({ ...effect, id, parameters: Object.freeze(Object.fromEntries(Object.entries(effect.parameters).map(([key, value]) => [key, cloneAnimatable(value)]))) })
const cloneMask = (mask: MotionMaskInstanceV1, id: string): MotionMaskInstanceV1 => Object.freeze({ ...mask, id, opacity: cloneAnimatable(mask.opacity), feather: cloneAnimatable(mask.feather), expansion: cloneAnimatable(mask.expansion), x: cloneAnimatable(mask.x), y: cloneAnimatable(mask.y), width: cloneAnimatable(mask.width), height: cloneAnimatable(mask.height), radius: cloneAnimatable(mask.radius) })

const subtreeNodeIds = (scene: MotionSceneV1, rootId: string): readonly string[] => {
  const visit = (id: string, values: string[]): void => {
    values.push(id)
    const node = scene.nodes[id]
    if (node?.type === 'group') node.childIds.forEach((childId) => visit(childId, values))
  }
  const values: string[] = []
  visit(rootId, values)
  return Object.freeze(values)
}

const remapDuplicatedSemantics = (source: MotionSceneV1, candidate: MotionSceneV1, idMap: ReadonlyMap<string, string>): MotionSceneV1 => {
  const semanticParts = Object.freeze(candidate.semanticParts.map((part) => {
    const original = source.semanticParts.find((sourcePart) => sourcePart.id === part.id)
    if (!original) return part
    const additions = original.nodeIds.map((nodeId) => idMap.get(nodeId)).filter((nodeId): nodeId is string => Boolean(nodeId))
    return additions.length === 0 ? part : Object.freeze({ ...part, nodeIds: Object.freeze([...new Set([...part.nodeIds, ...additions])]) })
  }))
  return Object.freeze({ ...candidate, semanticParts })
}

const ensureValidResult = (operationId: string, scene: MotionSceneV1): MotionOperationFailureV1 | null => {
  const validation = validateMotionScene(scene)
  return validation.ok ? null : fail(operationId, 'RESULT_INVALID', validation.issues.map((entry) => `${entry.path}: ${entry.message}`).join('\n'))
}

const mapThrownError = (operationId: string, error: unknown): MotionOperationFailureV1 => {
  const message = error instanceof Error ? error.message : 'Motion operation failed.'
  if (/cycle/i.test(message)) return fail(operationId, 'CYCLE_DETECTED', message)
  if (/already exists|duplicate/i.test(message)) return fail(operationId, 'DUPLICATE_ID', message)
  if (/unknown node/i.test(message)) return fail(operationId, 'TARGET_NOT_FOUND', message)
  if (/property .* not supported/i.test(message)) return fail(operationId, 'PROPERTY_INVALID', message)
  if (/root/i.test(message)) return fail(operationId, 'ROOT_PROTECTED', message)
  if (/parent/i.test(message)) return fail(operationId, 'PARENT_INVALID', message)
  if (/effect/i.test(message)) return fail(operationId, 'EFFECT_INVALID', message)
  if (/mask/i.test(message)) return fail(operationId, 'MASK_INVALID', message)
  return fail(operationId, 'RESULT_INVALID', message)
}

const operationInverseId = (operationId: string, suffix = 'inverse'): string => `${operationId}:${suffix}`

const operationLockTargets = (scene: MotionSceneV1, operation: MotionGraphOperationV1): readonly string[] => {
  if (operation.type === 'set-node-enabled') return Object.freeze([])
  if (operation.type === 'add-keyframe' || operation.type === 'remove-keyframe' || operation.type === 'move-keyframe' || operation.type === 'set-keyframe-value' || operation.type === 'set-keyframe-interpolation' || operation.type === 'set-keyframe-bezier' || operation.type === 'clear-keyframes') return Object.freeze([operation.target.nodeId])
  if (operation.type === 'set-property' || operation.type === 'reset-property') return Object.freeze([operation.target.nodeId])
  if (operation.type === 'remove-node') return Object.freeze(subtreeNodeIds(scene, operation.nodeId))
  if (operation.type === 'add-node') return Object.freeze([operation.parentId])
  if (operation.type === 'reparent-node') return Object.freeze([operation.nodeId, operation.parentId])
  if (operation.type === 'group-nodes') {
    const parentId = scene.nodes[operation.nodeIds[0] ?? '']?.parentId
    return Object.freeze([...operation.nodeIds, ...(parentId ? [parentId] : [])])
  }
  if (operation.type === 'ungroup-nodes') {
    const group = scene.nodes[operation.groupId]
    const parentId = group?.parentId
    const descendants = group?.type === 'group' ? group.childIds.flatMap((childId) => subtreeNodeIds(scene, childId)) : []
    return Object.freeze([operation.groupId, ...descendants, ...(parentId ? [parentId] : [])])
  }
  if ('nodeId' in operation && typeof operation.nodeId === 'string') {
    const targets = [operation.nodeId]
    if (operation.type === 'duplicate-node' && operation.parentId) targets.push(operation.parentId)
    return Object.freeze(targets)
  }
  return Object.freeze([])
}

const lockedOperationFailure = (scene: MotionSceneV1, operation: MotionGraphOperationV1, metadata: MotionAuthoringMetadataV1 | undefined): MotionOperationFailureV1 | null => {
  if (!metadata) return null
  for (const nodeId of operationLockTargets(scene, operation)) {
    const state = motionNodeLockState(scene, metadata, nodeId)
    if (!state.effectiveLocked) continue
    const owner = state.directlyLocked ? nodeId : state.lockedByAncestorNodeId
    return fail(operation.operationId, 'LOCKED', `Node ${nodeId} is locked${owner && owner !== nodeId ? ` by ancestor ${owner}` : ''}. Unlock it before editing.`, { path: '$.nodeId' })
  }
  return null
}

type MotionKeyframeOperationV1 = Extract<MotionGraphOperationV1, Readonly<{ type: 'add-keyframe' | 'remove-keyframe' | 'move-keyframe' | 'set-keyframe-value' | 'set-keyframe-interpolation' | 'set-keyframe-bezier' | 'clear-keyframes' }>>

const keyframeTickFailure = (operationId: string, tick: number, options?: MotionOperationApplyOptionsV1): MotionOperationFailureV1 | null => {
  if (!validTick(tick)) return fail(operationId, 'KEYFRAME_INVALID', 'Keyframe tick must be a non-negative safe integer.', { path: '$.tick' })
  if (options?.durationTicks !== undefined) {
    if (!Number.isSafeInteger(options.durationTicks) || options.durationTicks <= 0) return fail(operationId, 'KEYFRAME_INVALID', 'durationTicks option must be a positive safe integer.')
    if (tick > options.durationTicks) return fail(operationId, 'KEYFRAME_INVALID', `Keyframe tick ${tick} exceeds owning duration ${options.durationTicks}.`, { path: '$.tick' })
  }
  return null
}

const applyKeyframeOperation = (
  scene: MotionSceneV1,
  operation: MotionKeyframeOperationV1,
  options?: MotionOperationApplyOptionsV1,
): MotionOperationResultV1 => {
  const operationId = operation.operationId
  let record: ReturnType<typeof readMotionAnimatableTarget>
  try {
    record = readMotionAnimatableTarget(scene, operation.target)
  } catch (error) {
    return fail(operationId, 'TARGET_NOT_FOUND', error instanceof Error ? error.message : 'Keyframe target does not exist.', { path: '$.target' })
  }
  const interpolationFailure = (interpolation: MotionKeyframeInterpolationV1): MotionOperationFailureV1 | null => {
    const message = validateMotionTargetInterpolation(record.capability, interpolation)
    return message ? fail(operationId, 'KEYFRAME_UNSUPPORTED', message, { path: '$.interpolation' }) : null
  }
  const valueFailure = (value: MotionPropertyPrimitiveV1, path = '$.value'): MotionOperationFailureV1 | null => {
    const message = validateMotionTargetLiteral(record.capability, value)
    return message ? fail(operationId, 'KEYFRAME_INVALID', message, { path }) : null
  }
  const replace = (value: Animatable<MotionPropertyPrimitiveV1>, inverseOperations: readonly MotionGraphOperationV1[]): MotionOperationResultV1 => {
    const candidate = replaceMotionAnimatableTarget(scene, operation.target, value)
    const resultIssue = ensureValidResult(operationId, candidate)
    return resultIssue ?? success(candidate, [record.nodeId], inverseOperations)
  }

  if (operation.type === 'add-keyframe') {
    const tickIssue = keyframeTickFailure(operationId, operation.tick, options)
    if (tickIssue) return tickIssue
    const interpolationIssue = interpolationFailure(operation.interpolation)
    if (interpolationIssue) return interpolationIssue
    if (operation.bezier) {
      const bezierIssue = motionBezierHandleIssue(operation.bezier)
      if (bezierIssue) return fail(operationId, 'KEYFRAME_INVALID', bezierIssue, { path: '$.bezier' })
    }
    if (record.animatable.kind === 'motion' || record.animatable.kind === 'binding') return fail(operationId, 'KEYFRAME_CONVERSION_REQUIRED', `Cannot replace ${record.animatable.kind} authority with keyframes implicitly. Bake or reset the property explicitly first.`)
    const existing = record.animatable.kind === 'keyframes' ? record.animatable.keyframes : Object.freeze([])
    if (existing.some((keyframe) => keyframe.id === operation.keyframeId)) return fail(operationId, 'DUPLICATE_ID', `Keyframe ID already exists: ${operation.keyframeId}`, { path: '$.keyframeId' })
    if (existing.some((keyframe) => keyframe.tick === operation.tick)) return fail(operationId, 'KEYFRAME_COLLISION', `A keyframe already exists at tick ${operation.tick}.`, { path: '$.tick' })
    const value = operation.value ?? (record.animatable.kind === 'constant' ? record.animatable.value : evaluateKeyframedValue(record.animatable, operation.tick))
    const literalIssue = valueFailure(value)
    if (literalIssue) return literalIssue
    const nextKeyframe = Object.freeze({ id: operation.keyframeId, tick: operation.tick, value, interpolation: operation.interpolation, ...(operation.bezier ? { bezier: Object.freeze({ ...operation.bezier }) } : {}) })
    return replace(keyframed([...existing, nextKeyframe]) as Animatable<MotionPropertyPrimitiveV1>, [Object.freeze({ operationId: operationInverseId(operationId), type: 'remove-keyframe', target: operation.target, keyframeId: operation.keyframeId })])
  }

  if (record.animatable.kind !== 'keyframes') return fail(operationId, 'KEYFRAME_UNSUPPORTED', `Target ${record.label} is not currently keyframed.`)
  const track = record.animatable
  const keyframeIndex = operation.type === 'clear-keyframes' ? -1 : track.keyframes.findIndex((keyframe) => keyframe.id === operation.keyframeId)
  if (operation.type !== 'clear-keyframes' && keyframeIndex < 0) return fail(operationId, 'KEYFRAME_INVALID', `Unknown keyframe: ${operation.keyframeId}`, { path: '$.keyframeId' })

  if (operation.type === 'remove-keyframe') {
    const removed = track.keyframes[keyframeIndex]!
    const next = track.keyframes.filter((keyframe) => keyframe.id !== removed.id)
    const replacement: Animatable<MotionPropertyPrimitiveV1> = next.length === 0 ? constant(removed.value) : keyframed(next)
    const inverse = Object.freeze({ operationId: operationInverseId(operationId), type: 'add-keyframe' as const, target: operation.target, keyframeId: removed.id, tick: removed.tick, value: removed.value, interpolation: removed.interpolation, ...(removed.bezier ? { bezier: removed.bezier } : {}) })
    return replace(replacement, [inverse])
  }

  if (operation.type === 'move-keyframe') {
    const tickIssue = keyframeTickFailure(operationId, operation.tick, options)
    if (tickIssue) return tickIssue
    const moving = track.keyframes[keyframeIndex]!
    if (track.keyframes.some((keyframe) => keyframe.id !== moving.id && keyframe.tick === operation.tick)) return fail(operationId, 'KEYFRAME_COLLISION', `A keyframe already exists at tick ${operation.tick}.`, { path: '$.tick' })
    const replacement = keyframed(track.keyframes.map((keyframe) => keyframe.id === moving.id ? Object.freeze({ ...keyframe, tick: operation.tick }) : keyframe))
    return replace(replacement, [Object.freeze({ operationId: operationInverseId(operationId), type: 'move-keyframe', target: operation.target, keyframeId: moving.id, tick: moving.tick })])
  }

  if (operation.type === 'set-keyframe-value') {
    const literalIssue = valueFailure(operation.value)
    if (literalIssue) return literalIssue
    const current = track.keyframes[keyframeIndex]!
    const replacement = keyframed(track.keyframes.map((keyframe) => keyframe.id === current.id ? Object.freeze({ ...keyframe, value: operation.value }) : keyframe))
    return replace(replacement, [Object.freeze({ operationId: operationInverseId(operationId), type: 'set-keyframe-value', target: operation.target, keyframeId: current.id, value: current.value })])
  }

  if (operation.type === 'set-keyframe-interpolation') {
    const interpolationIssue = interpolationFailure(operation.interpolation)
    if (interpolationIssue) return interpolationIssue
    const current = track.keyframes[keyframeIndex]!
    const replacement = keyframed(track.keyframes.map((keyframe) => keyframe.id === current.id ? Object.freeze({ ...keyframe, interpolation: operation.interpolation }) : keyframe))
    return replace(replacement, [Object.freeze({ operationId: operationInverseId(operationId), type: 'set-keyframe-interpolation', target: operation.target, keyframeId: current.id, interpolation: current.interpolation })])
  }

  if (operation.type === 'set-keyframe-bezier') {
    if (!record.capability.interpolation.includes('bezier')) return fail(operationId, 'KEYFRAME_UNSUPPORTED', `${record.capability.semanticType} properties do not support Bezier handles.`)
    if (operation.bezier) {
      const bezierIssue = motionBezierHandleIssue(operation.bezier)
      if (bezierIssue) return fail(operationId, 'KEYFRAME_INVALID', bezierIssue, { path: '$.bezier' })
    }
    const current = track.keyframes[keyframeIndex]!
    const replacement = keyframed(track.keyframes.map((keyframe) => {
      if (keyframe.id !== current.id) return keyframe
      const { bezier: _previous, ...rest } = keyframe
      return Object.freeze({ ...rest, ...(operation.bezier ? { bezier: Object.freeze({ ...operation.bezier }) } : {}) })
    }))
    return replace(replacement, [Object.freeze({ operationId: operationInverseId(operationId), type: 'set-keyframe-bezier', target: operation.target, keyframeId: current.id, bezier: current.bezier ?? null })])
  }

  const fallbackIssue = valueFailure(operation.fallbackValue, '$.fallbackValue')
  if (fallbackIssue) return fallbackIssue
  const inverse = track.keyframes.map((keyframe, index): MotionGraphOperationV1 => Object.freeze({
    operationId: operationInverseId(operationId, `restore-${index}`), type: 'add-keyframe', target: operation.target, keyframeId: keyframe.id, tick: keyframe.tick, value: keyframe.value, interpolation: keyframe.interpolation, ...(keyframe.bezier ? { bezier: keyframe.bezier } : {}),
  }))
  return replace(constant(operation.fallbackValue), inverse)
}

export const applyMotionOperation = (
  scene: MotionSceneV1,
  operation: MotionGraphOperationV1,
  options?: MotionOperationApplyOptionsV1,
): MotionOperationResultV1 => {
  const sceneValidation = validateMotionScene(scene)
  if (!sceneValidation.ok) return fail(operation.operationId ?? 'unknown-operation', 'SCENE_INVALID', sceneValidation.issues.map((entry) => `${entry.path}: ${entry.message}`).join('\n'))
  const syntaxIssue = validateMotionGraphOperation(operation)
  if (syntaxIssue) return Object.freeze({ ok: false, error: syntaxIssue })
  const operationId = operation.operationId
  const lockIssue = lockedOperationFailure(scene, operation, options?.authoringMetadata)
  if (lockIssue) return lockIssue

  try {
    if (operation.type === 'add-keyframe' || operation.type === 'remove-keyframe' || operation.type === 'move-keyframe' || operation.type === 'set-keyframe-value' || operation.type === 'set-keyframe-interpolation' || operation.type === 'set-keyframe-bezier' || operation.type === 'clear-keyframes') return applyKeyframeOperation(scene, operation, options)

    if (operation.type === 'set-node-enabled') {
      const node = findNode(scene, operation.nodeId)
      if (!node) return fail(operationId, 'TARGET_NOT_FOUND', `Unknown node: ${operation.nodeId}`)
      const previous = node.enabled !== false
      const candidate = applyMotionGraphPatch(scene, { op: 'set-node-enabled', nodeId: node.id, enabled: operation.enabled })
      return success(candidate, [node.id], [Object.freeze({ operationId: operationInverseId(operationId), type: 'set-node-enabled', nodeId: node.id, enabled: previous })])
    }

    if (operation.type === 'set-property' || operation.type === 'reset-property') {
      const node = findNode(scene, operation.target.nodeId)
      if (!node) return fail(operationId, 'TARGET_NOT_FOUND', `Unknown node: ${operation.target.nodeId}`, { path: '$.target.nodeId' })
      if (!nodeSupportsProperty(node, operation.target.property)) return fail(operationId, 'PROPERTY_INVALID', `Property ${operation.target.property} is not supported by ${node.type} node ${node.id}.`, { path: '$.target.property' })
      const oldValue = nodeProperty(node, operation.target.property)
      const candidate = applyMotionGraphPatch(scene, { op: 'set-property', target: operation.target, value: operation.value })
      return success(candidate, [node.id], [Object.freeze({ operationId: operationInverseId(operationId), type: 'set-property', target: operation.target, value: oldValue })])
    }

    if (operation.type === 'add-node') {
      const parent = findNode(scene, operation.parentId)
      if (!parent || parent.type !== 'group') return fail(operationId, 'PARENT_INVALID', `Parent ${operation.parentId} must be an existing group.`)
      if (scene.nodes[operation.node.id]) return fail(operationId, 'DUPLICATE_ID', `Node already exists: ${operation.node.id}`)
      if (operation.index !== undefined && operation.index > parent.childIds.length) return fail(operationId, 'INDEX_INVALID', `Insertion index ${operation.index} is outside parent bounds.`)
      const candidate = applyMotionGraphPatch(scene, { op: 'add-node', node: operation.node, parentId: operation.parentId, index: operation.index })
      return success(candidate, [operation.node.id, parent.id], [Object.freeze({ operationId: operationInverseId(operationId), type: 'remove-node', nodeId: operation.node.id, mode: 'subtree' })])
    }

    if (operation.type === 'remove-node') {
      const node = findNode(scene, operation.nodeId)
      if (!node) return fail(operationId, 'TARGET_NOT_FOUND', `Unknown node: ${operation.nodeId}`)
      if (node.id === scene.rootNodeId) return fail(operationId, 'ROOT_PROTECTED', 'Cannot remove the scene root.')
      const removedIds = subtreeNodeIds(scene, node.id)
      const parentId = node.parentId
      const candidate = applyMotionGraphPatch(scene, { op: 'remove-node', nodeId: node.id })
      return success(candidate, [...removedIds, ...(parentId ? [parentId] : [])], null)
    }

    if (operation.type === 'duplicate-node') {
      const source = findNode(scene, operation.nodeId)
      if (!source) return fail(operationId, 'TARGET_NOT_FOUND', `Unknown node: ${operation.nodeId}`)
      if (source.id === scene.rootNodeId) return fail(operationId, 'ROOT_PROTECTED', 'Duplicating the scene root is not supported in C1.')
      if (scene.nodes[operation.duplicateId]) return fail(operationId, 'DUPLICATE_ID', `Node already exists: ${operation.duplicateId}`)
      const targetParentId = operation.parentId ?? source.parentId
      if (!targetParentId) return fail(operationId, 'PARENT_INVALID', 'Duplicated node needs a parent group.')
      const targetParent = findNode(scene, targetParentId)
      if (!targetParent || targetParent.type !== 'group') return fail(operationId, 'PARENT_INVALID', `Parent ${targetParentId} must be an existing group.`)
      const sourceIndex = siblingIndex(scene, source)
      const rootIndex = operation.index ?? Math.max(0, sourceIndex + 1)
      if (rootIndex > targetParent.childIds.length) return fail(operationId, 'INDEX_INVALID', `Duplicate insertion index ${rootIndex} is outside parent bounds.`)

      const sourceIds = subtreeNodeIds(scene, source.id)
      const idMap = new Map<string, string>()
      const reserved = new Set(Object.keys(scene.nodes))
      for (const [index, sourceId] of sourceIds.entries()) {
        const suggestedId = sourceId === source.id ? operation.duplicateId : `${operation.duplicateId}::node:${sourceId}`
        const nextId = deriveId(options, { operationId, kind: 'node', sourceId, suggestedId })
        if (!boundedId(nextId) || reserved.has(nextId)) return fail(operationId, 'DUPLICATE_ID', `Duplicate node ID is invalid or already exists: ${nextId}`)
        reserved.add(nextId)
        idMap.set(sourceId, nextId)
        if (index === 0 && nextId !== operation.duplicateId && !options?.idFactory) return fail(operationId, 'DUPLICATE_ID', 'Root duplicate ID remapping failed.')
      }

      let candidate = scene
      for (const sourceId of sourceIds) {
        const sourceNode = scene.nodes[sourceId]!
        const nextId = idMap.get(sourceId)!
        const nextParentId = sourceId === source.id ? targetParentId : idMap.get(sourceNode.parentId!)!
        const effects = Object.freeze(sourceNode.effects.map((effect) => cloneEffect(effect, deriveId(options, { operationId, kind: 'effect', sourceId: effect.id, suggestedId: `${nextId}::effect:${effect.id}` }))))
        const masks = Object.freeze(sourceNode.masks.map((mask) => cloneMask(mask, deriveId(options, { operationId, kind: 'mask', sourceId: mask.id, suggestedId: `${nextId}::mask:${mask.id}` }))))
        const componentInstance = sourceNode.type === 'group' && sourceNode.componentInstance
          ? Object.freeze({ ...sourceNode.componentInstance, instanceId: deriveId(options, { operationId, kind: 'component-instance', sourceId: sourceNode.componentInstance.instanceId, suggestedId: `${nextId}::instance:${sourceNode.componentInstance.instanceId}` }) })
          : undefined
        const clonedBase = Object.freeze({ ...sourceNode, id: nextId, name: `${sourceNode.name} Copy`, parentId: nextParentId, effects, masks })
        const clonedNode = sourceNode.type === 'group'
          ? Object.freeze({ ...clonedBase, type: 'group' as const, childIds: Object.freeze([]), ...(componentInstance ? { componentInstance } : {}) }) as MotionNodeV1
          : clonedBase as MotionNodeV1
        const parent = candidate.nodes[nextParentId]
        if (!parent || parent.type !== 'group') return fail(operationId, 'PARENT_INVALID', `Duplicate parent ${nextParentId} is unavailable.`)
        const childSourceIndex = sourceNode.parentId && scene.nodes[sourceNode.parentId]?.type === 'group' ? (scene.nodes[sourceNode.parentId] as MotionGroupNodeV1).childIds.indexOf(sourceId) : 0
        candidate = applyMotionGraphPatch(candidate, { op: 'add-node', node: clonedNode, parentId: nextParentId, index: sourceId === source.id ? rootIndex : childSourceIndex })
      }
      candidate = remapDuplicatedSemantics(scene, candidate, idMap)
      const resultIssue = ensureValidResult(operationId, candidate)
      if (resultIssue) return resultIssue
      const duplicatedIds = [...idMap.values()]
      return success(candidate, [...duplicatedIds, targetParentId], [Object.freeze({ operationId: operationInverseId(operationId), type: 'remove-node', nodeId: idMap.get(source.id)!, mode: 'subtree' })])
    }

    if (operation.type === 'rename-node') {
      const node = findNode(scene, operation.nodeId)
      if (!node) return fail(operationId, 'TARGET_NOT_FOUND', `Unknown node: ${operation.nodeId}`)
      const candidate = applyMotionGraphPatch(scene, { op: 'rename-node', nodeId: node.id, name: operation.name })
      return success(candidate, [node.id], [Object.freeze({ operationId: operationInverseId(operationId), type: 'rename-node', nodeId: node.id, name: node.name })])
    }

    if (operation.type === 'reparent-node') {
      const node = findNode(scene, operation.nodeId)
      if (!node) return fail(operationId, 'TARGET_NOT_FOUND', `Unknown node: ${operation.nodeId}`)
      if (node.id === scene.rootNodeId) return fail(operationId, 'ROOT_PROTECTED', 'Cannot reparent the scene root.')
      const nextParent = findNode(scene, operation.parentId)
      if (!nextParent || nextParent.type !== 'group') return fail(operationId, 'PARENT_INVALID', `Parent ${operation.parentId} must be an existing group.`)
      if (wouldCreateCycle(scene, node.id, nextParent.id)) return fail(operationId, 'CYCLE_DETECTED', `Reparenting ${node.id} under ${nextParent.id} would create a hierarchy cycle.`)
      if (operation.index !== undefined && operation.index > nextParent.childIds.length) return fail(operationId, 'INDEX_INVALID', `Insertion index ${operation.index} is outside parent bounds.`)
      const oldParentId = node.parentId
      const oldIndex = siblingIndex(scene, node)
      if (!oldParentId || oldIndex < 0) return fail(operationId, 'PARENT_INVALID', `Node ${node.id} has no valid current parent.`)
      const candidate = applyMotionGraphPatch(scene, { op: 'reparent-node', nodeId: node.id, parentId: nextParent.id, index: operation.index })
      return success(candidate, [node.id, oldParentId, nextParent.id], [Object.freeze({ operationId: operationInverseId(operationId), type: 'reparent-node', nodeId: node.id, parentId: oldParentId, index: oldIndex })])
    }

    if (operation.type === 'reorder-node') {
      const node = findNode(scene, operation.nodeId)
      if (!node) return fail(operationId, 'TARGET_NOT_FOUND', `Unknown node: ${operation.nodeId}`)
      const parent = parentGroup(scene, node)
      if (!parent) return fail(operationId, 'ROOT_PROTECTED', 'Root cannot be reordered.')
      if (operation.index >= parent.childIds.length) return fail(operationId, 'INDEX_INVALID', `Sibling index ${operation.index} is outside parent bounds.`)
      const oldIndex = parent.childIds.indexOf(node.id)
      const candidate = applyMotionGraphPatch(scene, { op: 'reorder-node', nodeId: node.id, index: operation.index })
      return success(candidate, [node.id, parent.id], [Object.freeze({ operationId: operationInverseId(operationId), type: 'reorder-node', nodeId: node.id, index: oldIndex })])
    }

    if (operation.type === 'group-nodes') {
      const uniqueIds = [...new Set(operation.nodeIds)]
      if (uniqueIds.length !== operation.nodeIds.length || uniqueIds.length < 1) return fail(operationId, 'GROUP_INVALID', 'Group selection must contain unique nodes.')
      if (scene.nodes[operation.groupId]) return fail(operationId, 'DUPLICATE_ID', `Node already exists: ${operation.groupId}`)
      const selected = uniqueIds.map((nodeId) => findNode(scene, nodeId))
      if (selected.some((node) => !node)) return fail(operationId, 'TARGET_NOT_FOUND', 'One or more group nodes do not exist.')
      if (selected.some((node) => node!.id === scene.rootNodeId)) return fail(operationId, 'ROOT_PROTECTED', 'The scene root cannot be grouped.')
      const parentId = selected[0]!.parentId
      if (!parentId || selected.some((node) => node!.parentId !== parentId)) return fail(operationId, 'GROUP_INVALID', 'C1 grouping requires nodes with the same parent.')
      const parent = scene.nodes[parentId]
      if (!parent || parent.type !== 'group') return fail(operationId, 'PARENT_INVALID', 'Group parent must be a group node.')
      const positions = selected.map((node) => parent.childIds.indexOf(node!.id)).sort((a, b) => a - b)
      if (positions.some((position) => position < 0) || positions.some((position, index) => index > 0 && position !== positions[index - 1]! + 1)) return fail(operationId, 'GROUP_INVALID', 'C1 grouping requires a contiguous sibling selection to preserve visual ordering.')
      const insertionIndex = operation.index ?? positions[0]!
      if (insertionIndex > parent.childIds.length) return fail(operationId, 'INDEX_INVALID', `Group insertion index ${insertionIndex} is outside parent bounds.`)
      const orderedIds = parent.childIds.filter((childId) => uniqueIds.includes(childId))
      const group: MotionGroupNodeV1 = Object.freeze({ ...nodeBase(operation.groupId, operation.groupName, parentId), type: 'group', childIds: Object.freeze([]) })
      let candidate = applyMotionGraphPatch(scene, { op: 'add-node', node: group, parentId, index: insertionIndex })
      for (const [index, nodeId] of orderedIds.entries()) candidate = applyMotionGraphPatch(candidate, { op: 'reparent-node', nodeId, parentId: group.id, index })
      return success(candidate, [group.id, parentId, ...orderedIds], [Object.freeze({ operationId: operationInverseId(operationId), type: 'ungroup-nodes', groupId: group.id })])
    }

    if (operation.type === 'ungroup-nodes') {
      const group = findNode(scene, operation.groupId)
      if (!group) return fail(operationId, 'TARGET_NOT_FOUND', `Unknown group: ${operation.groupId}`)
      if (group.id === scene.rootNodeId) return fail(operationId, 'ROOT_PROTECTED', 'The scene root cannot be ungrouped.')
      if (group.type !== 'group') return fail(operationId, 'GROUP_INVALID', `Node ${group.id} is not a group.`)
      const parent = parentGroup(scene, group)
      if (!parent) return fail(operationId, 'PARENT_INVALID', `Group ${group.id} has no valid parent.`)
      const insertionIndex = parent.childIds.indexOf(group.id)
      const children = [...group.childIds]
      let candidate = scene
      for (const [index, childId] of children.entries()) candidate = applyMotionGraphPatch(candidate, { op: 'reparent-node', nodeId: childId, parentId: parent.id, index: insertionIndex + index })
      candidate = applyMotionGraphPatch(candidate, { op: 'remove-node', nodeId: group.id })
      return success(candidate, [group.id, parent.id, ...children], null)
    }

    if (operation.type === 'add-effect') {
      const node = findNode(scene, operation.nodeId)
      if (!node) return fail(operationId, 'TARGET_NOT_FOUND', `Unknown node: ${operation.nodeId}`)
      if (node.effects.some((effect) => effect.id === operation.effect.id)) return fail(operationId, 'DUPLICATE_ID', `Effect already exists: ${operation.effect.id}`)
      const issue = validateEffectForNode(node, operation.effect)
      if (issue) return fail(operationId, 'EFFECT_INVALID', issue)
      if (operation.index !== undefined && operation.index > node.effects.length) return fail(operationId, 'INDEX_INVALID', `Effect index ${operation.index} is outside bounds.`)
      const candidate = applyMotionGraphPatch(scene, { op: 'add-effect', nodeId: node.id, effect: operation.effect, index: operation.index })
      return success(candidate, [node.id], [Object.freeze({ operationId: operationInverseId(operationId), type: 'remove-effect', nodeId: node.id, effectId: operation.effect.id })])
    }

    if (operation.type === 'remove-effect') {
      const node = findNode(scene, operation.nodeId)
      if (!node) return fail(operationId, 'TARGET_NOT_FOUND', `Unknown node: ${operation.nodeId}`)
      const index = effectIndex(node, operation.effectId)
      if (index < 0) return fail(operationId, 'EFFECT_INVALID', `Unknown effect: ${operation.effectId}`)
      const effect = node.effects[index]!
      const candidate = applyMotionGraphPatch(scene, { op: 'remove-effect', nodeId: node.id, effectId: effect.id })
      return success(candidate, [node.id], [Object.freeze({ operationId: operationInverseId(operationId), type: 'add-effect', nodeId: node.id, effect, index })])
    }

    if (operation.type === 'duplicate-effect') {
      const node = findNode(scene, operation.nodeId)
      if (!node) return fail(operationId, 'TARGET_NOT_FOUND', `Unknown node: ${operation.nodeId}`)
      const sourceIndex = effectIndex(node, operation.effectId)
      if (sourceIndex < 0) return fail(operationId, 'EFFECT_INVALID', `Unknown effect: ${operation.effectId}`)
      if (node.effects.some((effect) => effect.id === operation.duplicateId)) return fail(operationId, 'DUPLICATE_ID', `Effect already exists: ${operation.duplicateId}`)
      const index = operation.index ?? sourceIndex + 1
      if (index > node.effects.length) return fail(operationId, 'INDEX_INVALID', `Effect index ${index} is outside bounds.`)
      const candidate = applyMotionGraphPatch(scene, { op: 'duplicate-effect', nodeId: node.id, effectId: operation.effectId, duplicateId: operation.duplicateId, index })
      return success(candidate, [node.id], [Object.freeze({ operationId: operationInverseId(operationId), type: 'remove-effect', nodeId: node.id, effectId: operation.duplicateId })])
    }

    if (operation.type === 'reorder-effect') {
      const node = findNode(scene, operation.nodeId)
      if (!node) return fail(operationId, 'TARGET_NOT_FOUND', `Unknown node: ${operation.nodeId}`)
      const oldIndex = effectIndex(node, operation.effectId)
      if (oldIndex < 0) return fail(operationId, 'EFFECT_INVALID', `Unknown effect: ${operation.effectId}`)
      if (operation.index >= node.effects.length) return fail(operationId, 'INDEX_INVALID', `Effect index ${operation.index} is outside bounds.`)
      const candidate = applyMotionGraphPatch(scene, { op: 'reorder-effect', nodeId: node.id, effectId: operation.effectId, index: operation.index })
      return success(candidate, [node.id], [Object.freeze({ operationId: operationInverseId(operationId), type: 'reorder-effect', nodeId: node.id, effectId: operation.effectId, index: oldIndex })])
    }

    if (operation.type === 'set-effect-property') {
      const node = findNode(scene, operation.nodeId)
      if (!node) return fail(operationId, 'TARGET_NOT_FOUND', `Unknown node: ${operation.nodeId}`)
      const effect = node.effects.find((candidate) => candidate.id === operation.effectId)
      if (!effect) return fail(operationId, 'EFFECT_INVALID', `Unknown effect: ${operation.effectId}`)
      const definition = MOTION_EFFECT_REGISTRY[effect.effectType].parameters.find((parameter) => parameter.id === operation.parameter)
      if (!definition) return fail(operationId, 'EFFECT_PARAMETER_INVALID', `Unknown ${effect.effectType} parameter: ${operation.parameter}`)
      const issue = validateEffectParameterValue(definition, operation.value)
      if (issue) return fail(operationId, 'EFFECT_PARAMETER_INVALID', issue)
      const oldValue = effect.parameters[operation.parameter]!
      const candidate = applyMotionGraphPatch(scene, { op: 'set-effect-property', nodeId: node.id, effectId: effect.id, parameter: operation.parameter, value: operation.value })
      return success(candidate, [node.id], [Object.freeze({ operationId: operationInverseId(operationId), type: 'set-effect-property', nodeId: node.id, effectId: effect.id, parameter: operation.parameter, value: oldValue })])
    }

    if (operation.type === 'set-effect-enabled') {
      const node = findNode(scene, operation.nodeId)
      if (!node) return fail(operationId, 'TARGET_NOT_FOUND', `Unknown node: ${operation.nodeId}`)
      const effect = node.effects.find((candidate) => candidate.id === operation.effectId)
      if (!effect) return fail(operationId, 'EFFECT_INVALID', `Unknown effect: ${operation.effectId}`)
      const candidate = applyMotionGraphPatch(scene, { op: 'set-effect-enabled', nodeId: node.id, effectId: effect.id, enabled: operation.enabled })
      return success(candidate, [node.id], [Object.freeze({ operationId: operationInverseId(operationId), type: 'set-effect-enabled', nodeId: node.id, effectId: effect.id, enabled: effect.enabled })])
    }

    if (operation.type === 'add-mask') {
      const node = findNode(scene, operation.nodeId)
      if (!node) return fail(operationId, 'TARGET_NOT_FOUND', `Unknown node: ${operation.nodeId}`)
      if (node.masks.some((mask) => mask.id === operation.mask.id)) return fail(operationId, 'DUPLICATE_ID', `Mask already exists: ${operation.mask.id}`)
      const issue = validateMask(operation.mask)
      if (issue) return fail(operationId, 'MASK_INVALID', issue)
      if (operation.index !== undefined && operation.index > node.masks.length) return fail(operationId, 'INDEX_INVALID', `Mask index ${operation.index} is outside bounds.`)
      const candidate = applyMotionGraphPatch(scene, { op: 'add-mask', nodeId: node.id, mask: operation.mask, index: operation.index })
      return success(candidate, [node.id], [Object.freeze({ operationId: operationInverseId(operationId), type: 'remove-mask', nodeId: node.id, maskId: operation.mask.id })])
    }

    if (operation.type === 'remove-mask') {
      const node = findNode(scene, operation.nodeId)
      if (!node) return fail(operationId, 'TARGET_NOT_FOUND', `Unknown node: ${operation.nodeId}`)
      const index = maskIndex(node, operation.maskId)
      if (index < 0) return fail(operationId, 'MASK_INVALID', `Unknown mask: ${operation.maskId}`)
      const mask = node.masks[index]!
      const candidate = applyMotionGraphPatch(scene, { op: 'remove-mask', nodeId: node.id, maskId: mask.id })
      return success(candidate, [node.id], [Object.freeze({ operationId: operationInverseId(operationId), type: 'add-mask', nodeId: node.id, mask, index })])
    }

    if (operation.type === 'reorder-mask') {
      const node = findNode(scene, operation.nodeId)
      if (!node) return fail(operationId, 'TARGET_NOT_FOUND', `Unknown node: ${operation.nodeId}`)
      const oldIndex = maskIndex(node, operation.maskId)
      if (oldIndex < 0) return fail(operationId, 'MASK_INVALID', `Unknown mask: ${operation.maskId}`)
      if (operation.index >= node.masks.length) return fail(operationId, 'INDEX_INVALID', `Mask index ${operation.index} is outside bounds.`)
      const candidate = applyMotionGraphPatch(scene, { op: 'reorder-mask', nodeId: node.id, maskId: operation.maskId, index: operation.index })
      return success(candidate, [node.id], [Object.freeze({ operationId: operationInverseId(operationId), type: 'reorder-mask', nodeId: node.id, maskId: operation.maskId, index: oldIndex })])
    }

    if (operation.type === 'set-mask-property') {
      const node = findNode(scene, operation.nodeId)
      if (!node) return fail(operationId, 'TARGET_NOT_FOUND', `Unknown node: ${operation.nodeId}`)
      const mask = node.masks.find((candidate) => candidate.id === operation.maskId)
      if (!mask) return fail(operationId, 'MASK_INVALID', `Unknown mask: ${operation.maskId}`)
      const property = operation.property
      if (!(['enabled', 'invert', 'opacity', 'feather', 'expansion', 'x', 'y', 'width', 'height', 'radius'] as const).includes(property)) return fail(operationId, 'MASK_INVALID', `Unknown mask property: ${String(property)}`)
      if (property === 'enabled' || property === 'invert') {
        if (typeof operation.value !== 'boolean') return fail(operationId, 'MASK_INVALID', `Mask ${property} must be boolean.`)
      } else {
        if (!isRecord(operation.value)) return fail(operationId, 'MASK_INVALID', `Mask ${property} must be animatable numeric data.`)
        const [minimum, maximum] = maskRange(property)
        for (const value of maskLiteralNumbers(operation.value as Animatable<number>)) if (!Number.isFinite(value) || value < minimum || value > maximum) return fail(operationId, 'MASK_INVALID', `Mask ${property} must stay inside [${minimum}, ${maximum}].`)
      }
      const oldValue = property === 'enabled' || property === 'invert' ? mask[property] : mask[property]
      const candidate = applyMotionGraphPatch(scene, { op: 'set-mask-property', nodeId: node.id, maskId: mask.id, property, value: operation.value })
      return success(candidate, [node.id], [Object.freeze({ operationId: operationInverseId(operationId), type: 'set-mask-property', nodeId: node.id, maskId: mask.id, property, value: oldValue }) as MotionGraphOperationV1])
    }

    if (operation.type === 'set-matte') {
      const issue = validateMotionMatteRelationshipV1(scene, operation.relationship)
      if (issue) return fail(operationId, 'MATTE_INVALID', issue)
      const previous = scene.compositing?.mattes.find((item) => item.id === operation.relationship.id) ?? null
      const candidate = setMotionMatteRelationshipV1(scene, operation.relationship)
      const inverse: MotionGraphOperationV1 = previous
        ? Object.freeze({ operationId: operationInverseId(operationId), type: 'set-matte', relationship: previous })
        : Object.freeze({ operationId: operationInverseId(operationId), type: 'remove-matte', matteId: operation.relationship.id })
      return success(candidate, [operation.relationship.sourceNodeId, operation.relationship.targetNodeId], [inverse])
    }

    if (operation.type === 'remove-matte') {
      const previous = scene.compositing?.mattes.find((item) => item.id === operation.matteId)
      if (!previous) return fail(operationId, 'MATTE_INVALID', `Unknown matte: ${operation.matteId}`)
      const candidate = removeMotionMatteRelationshipV1(scene, operation.matteId)
      return success(candidate, [previous.sourceNodeId, previous.targetNodeId], [Object.freeze({ operationId: operationInverseId(operationId), type: 'set-matte', relationship: previous })])
    }

    const node = findNode(scene, operation.nodeId)
    if (!node) return fail(operationId, 'TARGET_NOT_FOUND', `Unknown node: ${operation.nodeId}`)
    if (!MOTION_BLEND_MODES.includes(operation.blendMode)) return fail(operationId, 'BLEND_MODE_INVALID', `Unsupported blend mode: ${String(operation.blendMode)}`)
    const candidate = applyMotionGraphPatch(scene, { op: 'set-blend-mode', nodeId: node.id, blendMode: operation.blendMode })
    return success(candidate, [node.id], [Object.freeze({ operationId: operationInverseId(operationId), type: 'set-blend-mode', nodeId: node.id, blendMode: node.blendMode })])
  } catch (error) {
    return mapThrownError(operationId, error)
  }
}

export const applyMotionOperations = (
  scene: MotionSceneV1,
  operations: readonly MotionGraphOperationV1[],
  options?: MotionOperationApplyOptionsV1,
): MotionOperationResultV1 => {
  if (operations.length === 0) return success(scene, [], Object.freeze([]))
  let current = scene
  const affected = new Set<string>()
  let inverseAvailable = true
  const inverse: MotionGraphOperationV1[] = []
  for (const [index, operation] of operations.entries()) {
    const result = applyMotionOperation(current, operation, options)
    if (!result.ok) return fail(operation.operationId, 'BATCH_FAILED', `Atomic motion batch failed at operation ${index}: ${result.error.message}`, { causeCode: result.error.code, failedOperationIndex: index })
    current = result.scene
    result.affectedNodeIds.forEach((nodeId) => affected.add(nodeId))
    if (result.inverseOperations === null) inverseAvailable = false
    else inverse.unshift(...result.inverseOperations)
  }
  return success(current, [...affected], inverseAvailable ? inverse : null)
}

export const motionOperationFromPatch = (operationId: string, patch: MotionGraphPatchV1): MotionGraphOperationV1 => {
  if (patch.op === 'set-property') return { operationId, type: 'set-property', target: patch.target, value: patch.value }
  if (patch.op === 'set-node-enabled') return { operationId, type: 'set-node-enabled', nodeId: patch.nodeId, enabled: patch.enabled }
  if (patch.op === 'add-node') return { operationId, type: 'add-node', node: patch.node, parentId: patch.parentId, index: patch.index }
  if (patch.op === 'remove-node') return { operationId, type: 'remove-node', nodeId: patch.nodeId, mode: 'subtree' }
  if (patch.op === 'rename-node') return { operationId, type: 'rename-node', nodeId: patch.nodeId, name: patch.name }
  if (patch.op === 'reparent-node') return { operationId, type: 'reparent-node', nodeId: patch.nodeId, parentId: patch.parentId, index: patch.index }
  if (patch.op === 'reorder-node') return { operationId, type: 'reorder-node', nodeId: patch.nodeId, index: patch.index }
  if (patch.op === 'add-effect') return { operationId, type: 'add-effect', nodeId: patch.nodeId, effect: patch.effect, index: patch.index }
  if (patch.op === 'remove-effect') return { operationId, type: 'remove-effect', nodeId: patch.nodeId, effectId: patch.effectId }
  if (patch.op === 'duplicate-effect') return { operationId, type: 'duplicate-effect', nodeId: patch.nodeId, effectId: patch.effectId, duplicateId: patch.duplicateId, index: patch.index }
  if (patch.op === 'reorder-effect') return { operationId, type: 'reorder-effect', nodeId: patch.nodeId, effectId: patch.effectId, index: patch.index }
  if (patch.op === 'set-effect-property') return { operationId, type: 'set-effect-property', nodeId: patch.nodeId, effectId: patch.effectId, parameter: patch.parameter, value: patch.value }
  if (patch.op === 'set-effect-enabled') return { operationId, type: 'set-effect-enabled', nodeId: patch.nodeId, effectId: patch.effectId, enabled: patch.enabled }
  if (patch.op === 'add-mask') return { operationId, type: 'add-mask', nodeId: patch.nodeId, mask: patch.mask, index: patch.index }
  if (patch.op === 'remove-mask') return { operationId, type: 'remove-mask', nodeId: patch.nodeId, maskId: patch.maskId }
  if (patch.op === 'reorder-mask') return { operationId, type: 'reorder-mask', nodeId: patch.nodeId, maskId: patch.maskId, index: patch.index }
  if (patch.op === 'set-mask-property') return { operationId, type: 'set-mask-property', nodeId: patch.nodeId, maskId: patch.maskId, property: patch.property, value: patch.value }
  return { operationId, type: 'set-blend-mode', nodeId: patch.nodeId, blendMode: patch.blendMode }
}
