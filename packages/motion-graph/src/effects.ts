import type { Animatable, MotionNodeId } from './properties.ts'
import { constant } from './properties.ts'

export const MOTION_BLEND_MODES = ['normal', 'multiply', 'screen', 'overlay', 'darken', 'lighten'] as const
export type MotionBlendModeV1 = (typeof MOTION_BLEND_MODES)[number]

export const MOTION_EFFECT_TYPES = ['blur', 'drop-shadow', 'glow', 'brightness', 'contrast', 'saturation', 'hue-rotate'] as const
export type MotionEffectTypeV1 = (typeof MOTION_EFFECT_TYPES)[number]
export type MotionEffectParameterV1 = Animatable<number | string>
export type MotionEffectNodeTypeV1 = 'group' | 'text' | 'shape' | 'path' | 'image'

export interface MotionEffectInstanceV1 {
  readonly id: string
  readonly effectType: MotionEffectTypeV1
  readonly enabled: boolean
  readonly parameters: Readonly<Record<string, MotionEffectParameterV1>>
}

export interface MotionEffectParameterDefinitionV1 {
  readonly id: string
  readonly type: 'number' | 'color'
  readonly defaultValue: number | string
  readonly minimum?: number
  readonly maximum?: number
  readonly step?: number
}

export interface MotionEffectDefinitionV1 {
  readonly id: MotionEffectTypeV1
  readonly name: string
  readonly parameters: readonly MotionEffectParameterDefinitionV1[]
  readonly supportedNodeTypes: readonly MotionEffectNodeTypeV1[]
}

const allNodes: readonly MotionEffectNodeTypeV1[] = Object.freeze(['group', 'text', 'shape', 'path', 'image'])
const defineEffect = (definition: MotionEffectDefinitionV1): MotionEffectDefinitionV1 => Object.freeze({
  ...definition,
  parameters: Object.freeze(definition.parameters.map((parameter) => Object.freeze(parameter))),
  supportedNodeTypes: Object.freeze([...definition.supportedNodeTypes]),
})

export const MOTION_EFFECT_REGISTRY: Readonly<Record<MotionEffectTypeV1, MotionEffectDefinitionV1>> = Object.freeze({
  blur: defineEffect({ id: 'blur', name: 'Blur', parameters: [{ id: 'radius', type: 'number', defaultValue: 0, minimum: 0, maximum: 80, step: 1 }], supportedNodeTypes: allNodes }),
  'drop-shadow': defineEffect({ id: 'drop-shadow', name: 'Drop Shadow', parameters: [
    { id: 'offsetX', type: 'number', defaultValue: 0, minimum: -100, maximum: 100, step: 1 },
    { id: 'offsetY', type: 'number', defaultValue: 16, minimum: -100, maximum: 100, step: 1 },
    { id: 'blur', type: 'number', defaultValue: 28, minimum: 0, maximum: 120, step: 1 },
    { id: 'opacity', type: 'number', defaultValue: 0.3, minimum: 0, maximum: 1, step: 0.01 },
    { id: 'color', type: 'color', defaultValue: '#000000' },
  ], supportedNodeTypes: allNodes }),
  glow: defineEffect({ id: 'glow', name: 'Glow', parameters: [
    { id: 'radius', type: 'number', defaultValue: 18, minimum: 0, maximum: 100, step: 1 },
    { id: 'intensity', type: 'number', defaultValue: 0.25, minimum: 0, maximum: 1, step: 0.01 },
    { id: 'color', type: 'color', defaultValue: '#ffffff' },
  ], supportedNodeTypes: allNodes }),
  brightness: defineEffect({ id: 'brightness', name: 'Brightness', parameters: [{ id: 'amount', type: 'number', defaultValue: 1, minimum: 0, maximum: 3, step: 0.01 }], supportedNodeTypes: allNodes }),
  contrast: defineEffect({ id: 'contrast', name: 'Contrast', parameters: [{ id: 'amount', type: 'number', defaultValue: 1, minimum: 0, maximum: 3, step: 0.01 }], supportedNodeTypes: allNodes }),
  saturation: defineEffect({ id: 'saturation', name: 'Saturation', parameters: [{ id: 'amount', type: 'number', defaultValue: 1, minimum: 0, maximum: 3, step: 0.01 }], supportedNodeTypes: allNodes }),
  'hue-rotate': defineEffect({ id: 'hue-rotate', name: 'Hue Rotate', parameters: [{ id: 'degrees', type: 'number', defaultValue: 0, minimum: -360, maximum: 360, step: 1 }], supportedNodeTypes: allNodes }),
})

export const createDefaultEffect = (id: string, effectType: MotionEffectTypeV1): MotionEffectInstanceV1 => {
  const definition = MOTION_EFFECT_REGISTRY[effectType]
  return Object.freeze({
    id,
    effectType,
    enabled: true,
    parameters: Object.freeze(Object.fromEntries(definition.parameters.map((parameter) => [parameter.id, constant<number | string>(parameter.defaultValue)]))),
  })
}

export interface ResolvedMotionEffectV1 {
  readonly id: string
  readonly effectType: MotionEffectTypeV1
  readonly enabled: boolean
  readonly parameters: Readonly<Record<string, number | string>>
}

export interface MotionEffectTargetV1 {
  readonly nodeId: MotionNodeId
  readonly effectId: string
}
