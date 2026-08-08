import { MOTION_EFFECT_REGISTRY } from './effects.ts'
import { applyMotionGraphPatch } from './patches.ts'
import type {
  Animatable,
  MotionKeyframeInterpolationV1,
  MotionKeyframeTargetV1,
  MotionMaskNumericPropertyNameV1,
  MotionNodePropertyNameV1,
  MotionPropertyPrimitiveV1,
} from './properties.ts'
import type { MotionNodeV1 } from './nodes.ts'
import type { MotionSceneV1 } from './scene.ts'

export type MotionAnimatableValueTypeV1 = 'number' | 'string' | 'boolean'
export type MotionAnimatableSemanticTypeV1 = 'number' | 'text' | 'color' | 'boolean'

export interface MotionAnimatableCapabilityV1 {
  readonly valueType: MotionAnimatableValueTypeV1
  readonly semanticType: MotionAnimatableSemanticTypeV1
  readonly interpolation: readonly MotionKeyframeInterpolationV1[]
  readonly minimum?: number
  readonly maximum?: number
}

export interface MotionAnimatableTargetRecordV1 {
  readonly target: MotionKeyframeTargetV1
  readonly nodeId: string
  readonly nodeName: string
  readonly label: string
  readonly animatable: Animatable<MotionPropertyPrimitiveV1>
  readonly capability: MotionAnimatableCapabilityV1
}

const HOLD_ONLY = Object.freeze(['hold'] as const)
const CONTINUOUS = Object.freeze(['hold', 'linear', 'bezier'] as const)
const numeric = (minimum?: number, maximum?: number): MotionAnimatableCapabilityV1 => Object.freeze({ valueType: 'number', semanticType: 'number', interpolation: CONTINUOUS, ...(minimum !== undefined ? { minimum } : {}), ...(maximum !== undefined ? { maximum } : {}) })
const color = (): MotionAnimatableCapabilityV1 => Object.freeze({ valueType: 'string', semanticType: 'color', interpolation: HOLD_ONLY })
const text = (): MotionAnimatableCapabilityV1 => Object.freeze({ valueType: 'string', semanticType: 'text', interpolation: HOLD_ONLY })
const bool = (): MotionAnimatableCapabilityV1 => Object.freeze({ valueType: 'boolean', semanticType: 'boolean', interpolation: HOLD_ONLY })

export const motionNodePropertyCapability = (node: MotionNodeV1, property: MotionNodePropertyNameV1): MotionAnimatableCapabilityV1 | null => {
  if (property === 'visible') return bool()
  if (property === 'opacity') return numeric(0, 1)
  if (property === 'transform.positionX' || property === 'transform.positionY' || property === 'transform.rotationDeg') return numeric()
  if (property === 'transform.scaleX' || property === 'transform.scaleY') return numeric()
  if (property === 'transform.anchorX' || property === 'transform.anchorY') return numeric(0, 1)
  if (node.type === 'text') {
    if (property === 'text.text') return text()
    if (property === 'text.fillColor') return color()
    if (property === 'text.fontSize') return numeric(1, 4096)
    if (property === 'text.fontWeight') return numeric(1, 1000)
  }
  if (node.type === 'shape') {
    if (property === 'shape.width' || property === 'shape.height') return numeric(0)
    if (property === 'shape.fillColor' || property === 'shape.strokeColor') return color()
    if (property === 'shape.strokeWidth' || property === 'shape.radius') return numeric(0)
  }
  if (node.type === 'path') {
    if (property === 'path.fillColor' || property === 'path.strokeColor') return color()
    if (property === 'path.strokeWidth') return numeric(0)
    if (property === 'path.trimProgress') return numeric(0, 1)
  }
  if (node.type === 'image') {
    if (property === 'image.width' || property === 'image.height') return numeric(0)
    if (property === 'image.opacity') return numeric(0, 1)
  }
  return null
}

export const motionNodeAnimatable = (node: MotionNodeV1, property: MotionNodePropertyNameV1): Animatable<MotionPropertyPrimitiveV1> => {
  if (property === 'visible') return node.visible
  if (property === 'opacity') return node.opacity
  if (property.startsWith('transform.')) return node.transform[property.slice('transform.'.length) as keyof typeof node.transform]
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
  throw new RangeError(`Property ${property} is not available on node ${node.id}.`)
}

const maskCapability = (property: MotionMaskNumericPropertyNameV1): MotionAnimatableCapabilityV1 => {
  if (property === 'opacity' || property === 'feather' || property === 'radius') return numeric(0, 1)
  if (property === 'expansion') return numeric(-1, 1)
  if (property === 'width' || property === 'height') return numeric(0, 4)
  return numeric(-2, 2)
}

export const motionKeyframeTargetKey = (target: MotionKeyframeTargetV1): string => {
  if (target.kind === 'node') return `node:${target.nodeId}:${target.property}`
  if (target.kind === 'effect') return `effect:${target.nodeId}:${target.effectId}:${target.parameter}`
  return `mask:${target.nodeId}:${target.maskId}:${target.property}`
}

export const readMotionAnimatableTarget = (scene: MotionSceneV1, target: MotionKeyframeTargetV1): MotionAnimatableTargetRecordV1 => {
  const node = scene.nodes[target.nodeId]
  if (!node) throw new RangeError(`Unknown node: ${target.nodeId}`)
  if (target.kind === 'node') {
    const capability = motionNodePropertyCapability(node, target.property)
    if (!capability) throw new RangeError(`Property ${target.property} is not supported by ${node.type} node ${node.id}.`)
    return Object.freeze({ target, nodeId: node.id, nodeName: node.name, label: target.property, animatable: motionNodeAnimatable(node, target.property), capability })
  }
  if (target.kind === 'effect') {
    const effect = node.effects.find((candidate) => candidate.id === target.effectId)
    if (!effect) throw new RangeError(`Unknown effect: ${target.effectId}`)
    const parameter = MOTION_EFFECT_REGISTRY[effect.effectType].parameters.find((candidate) => candidate.id === target.parameter)
    if (!parameter) throw new RangeError(`Unknown ${effect.effectType} parameter: ${target.parameter}`)
    const animatable = effect.parameters[target.parameter]
    if (!animatable) throw new RangeError(`Missing ${effect.effectType} parameter: ${target.parameter}`)
    const capability = parameter.type === 'number' ? numeric(parameter.minimum, parameter.maximum) : color()
    return Object.freeze({ target, nodeId: node.id, nodeName: node.name, label: `${effect.effectType}.${parameter.id}`, animatable, capability })
  }
  const mask = node.masks.find((candidate) => candidate.id === target.maskId)
  if (!mask) throw new RangeError(`Unknown mask: ${target.maskId}`)
  const animatable = mask[target.property]
  return Object.freeze({ target, nodeId: node.id, nodeName: node.name, label: `mask.${target.maskId}.${target.property}`, animatable, capability: maskCapability(target.property) })
}

export const replaceMotionAnimatableTarget = (scene: MotionSceneV1, target: MotionKeyframeTargetV1, value: Animatable<MotionPropertyPrimitiveV1>): MotionSceneV1 => {
  if (target.kind === 'node') return applyMotionGraphPatch(scene, { op: 'set-property', target: { nodeId: target.nodeId, property: target.property }, value })
  if (target.kind === 'effect') return applyMotionGraphPatch(scene, { op: 'set-effect-property', nodeId: target.nodeId, effectId: target.effectId, parameter: target.parameter, value: value as Animatable<number | string> })
  return applyMotionGraphPatch(scene, { op: 'set-mask-property', nodeId: target.nodeId, maskId: target.maskId, property: target.property, value: value as Animatable<number> })
}

export const validateMotionTargetLiteral = (capability: MotionAnimatableCapabilityV1, value: unknown): string | null => {
  if (typeof value !== capability.valueType) return `Expected ${capability.valueType} value.`
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) return 'Numeric keyframe value must be finite.'
    if (capability.minimum !== undefined && value < capability.minimum) return `Numeric keyframe value must be >= ${capability.minimum}.`
    if (capability.maximum !== undefined && value > capability.maximum) return `Numeric keyframe value must be <= ${capability.maximum}.`
  }
  if (typeof value === 'string' && (value.length === 0 || value.length > 4096)) return 'String keyframe value must be a bounded non-empty string.'
  return null
}

export const listMotionAnimatableTargetsForNode = (scene: MotionSceneV1, nodeId: string): readonly MotionAnimatableTargetRecordV1[] => {
  const node = scene.nodes[nodeId]
  if (!node) return Object.freeze([])
  const nodeProperties: MotionNodePropertyNameV1[] = [
    'visible', 'opacity',
    'transform.positionX', 'transform.positionY', 'transform.scaleX', 'transform.scaleY', 'transform.rotationDeg', 'transform.anchorX', 'transform.anchorY',
  ]
  if (node.type === 'text') nodeProperties.push('text.text', 'text.fillColor', 'text.fontSize', 'text.fontWeight')
  if (node.type === 'shape') nodeProperties.push('shape.width', 'shape.height', 'shape.fillColor', 'shape.strokeColor', 'shape.strokeWidth', 'shape.radius')
  if (node.type === 'path') nodeProperties.push('path.fillColor', 'path.strokeColor', 'path.strokeWidth', 'path.trimProgress')
  if (node.type === 'image') nodeProperties.push('image.width', 'image.height', 'image.opacity')
  const records: MotionAnimatableTargetRecordV1[] = nodeProperties.map((property) => readMotionAnimatableTarget(scene, { kind: 'node', nodeId, property }))
  for (const effect of node.effects) for (const parameter of MOTION_EFFECT_REGISTRY[effect.effectType].parameters) records.push(readMotionAnimatableTarget(scene, { kind: 'effect', nodeId, effectId: effect.id, parameter: parameter.id }))
  for (const mask of node.masks) for (const property of ['opacity', 'feather', 'expansion', 'x', 'y', 'width', 'height', 'radius'] as const) records.push(readMotionAnimatableTarget(scene, { kind: 'mask', nodeId, maskId: mask.id, property }))
  return Object.freeze(records)
}

export const validateMotionTargetInterpolation = (capability: MotionAnimatableCapabilityV1, interpolation: MotionKeyframeInterpolationV1): string | null => capability.interpolation.includes(interpolation)
  ? null
  : `${capability.semanticType} properties support ${capability.interpolation.join(', ')} interpolation only.`
