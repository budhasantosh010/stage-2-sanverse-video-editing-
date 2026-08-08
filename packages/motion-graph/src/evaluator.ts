import type { MotionRenderContextV1 } from '@sanverse/motion-contract'
import { clamp } from '@sanverse/motion-primitives'
import { evaluateMotionDriver, evaluateKeyframedValue } from './animation.ts'
import type { Animatable, MotionNodePropertyNameV1, MotionPropertyPrimitiveV1 } from './properties.ts'
import type { MotionNodeV1, ResolvedMotionNodeV1, ResolvedMotionTransformV1 } from './nodes.ts'
import type { MotionSceneV1 } from './scene.ts'
import type { ResolvedMotionEffectV1 } from './effects.ts'
import type { ResolvedMotionMaskV1 } from './masks.ts'
import { assertValidMotionScene } from './validation.ts'

export interface ResolvedMotionSceneV1 {
  readonly schemaVersion: 'sanverse.resolved-motion-scene/v1'
  readonly componentId: string
  readonly componentVersion: number
  readonly rootNodeId: string
  readonly nodes: Readonly<Record<string, ResolvedMotionNodeV1>>
  readonly semanticParts: MotionSceneV1['semanticParts']
  readonly exposures: MotionSceneV1['exposures']
  readonly layout: MotionSceneV1['layout']
}

const getNodeAnimatable = (node: MotionNodeV1, property: MotionNodePropertyNameV1): Animatable<MotionPropertyPrimitiveV1> => {
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
  if (node.type === 'image' && property === 'image.opacity') return node.imageOpacity
  throw new RangeError(`Property ${property} is not available on node ${node.id}.`)
}

export const evaluateScene = (sceneInput: MotionSceneV1, context: MotionRenderContextV1): ResolvedMotionSceneV1 => {
  const scene = assertValidMotionScene(sceneInput)
  const cache = new Map<string, MotionPropertyPrimitiveV1>()
  const active = new Set<string>()
  const resolveAnimatable = (value: Animatable<MotionPropertyPrimitiveV1>, key: string): MotionPropertyPrimitiveV1 => {
    if (value.kind === 'constant') return value.value
    if (value.kind === 'motion') return evaluateMotionDriver(value.driver, context)
    if (value.kind === 'keyframes') return evaluateKeyframedValue(value, context.localTicks)
    const source = value.binding.source
    const sourceValue = resolveProperty(source.nodeId, source.property)
    if (!value.binding.map) return sourceValue
    if (typeof sourceValue !== 'number') throw new RangeError(`Binding map on ${key} requires a numeric source.`)
    const mapped = sourceValue * value.binding.map.scale + value.binding.map.offset
    return clamp(mapped, value.binding.map.clampMin ?? -Number.MAX_SAFE_INTEGER, value.binding.map.clampMax ?? Number.MAX_SAFE_INTEGER)
  }
  const resolveProperty = (nodeId: string, property: MotionNodePropertyNameV1): MotionPropertyPrimitiveV1 => {
    const key = `${nodeId}:${property}`
    const cached = cache.get(key); if (cached !== undefined) return cached
    if (active.has(key)) throw new RangeError(`Motion binding cycle detected at ${key}.`)
    active.add(key)
    const node = scene.nodes[nodeId]
    if (!node) throw new RangeError(`Missing binding node: ${nodeId}.`)
    const resolved = resolveAnimatable(getNodeAnimatable(node, property), key)
    active.delete(key); cache.set(key, resolved); return resolved
  }
  const resolveNumber = (value: Animatable<number>, key: string): number => {
    const resolved = resolveAnimatable(value as Animatable<MotionPropertyPrimitiveV1>, key)
    if (typeof resolved !== 'number' || !Number.isFinite(resolved)) throw new RangeError(`${key} did not resolve to a finite number.`)
    return resolved
  }
  const resolveString = (value: Animatable<string>, key: string): string => {
    const resolved = resolveAnimatable(value as Animatable<MotionPropertyPrimitiveV1>, key)
    if (typeof resolved !== 'string') throw new RangeError(`${key} did not resolve to a string.`)
    return resolved
  }
  const resolveBoolean = (value: Animatable<boolean>, key: string): boolean => {
    const resolved = resolveAnimatable(value as Animatable<MotionPropertyPrimitiveV1>, key)
    if (typeof resolved !== 'boolean') throw new RangeError(`${key} did not resolve to a boolean.`)
    return resolved
  }
  const resolveTransform = (node: MotionNodeV1): ResolvedMotionTransformV1 => ({
    positionX: resolveNumber(node.transform.positionX, `${node.id}.transform.positionX`), positionY: resolveNumber(node.transform.positionY, `${node.id}.transform.positionY`),
    scaleX: resolveNumber(node.transform.scaleX, `${node.id}.transform.scaleX`), scaleY: resolveNumber(node.transform.scaleY, `${node.id}.transform.scaleY`), rotationDeg: resolveNumber(node.transform.rotationDeg, `${node.id}.transform.rotationDeg`),
    anchorX: resolveNumber(node.transform.anchorX, `${node.id}.transform.anchorX`), anchorY: resolveNumber(node.transform.anchorY, `${node.id}.transform.anchorY`),
  })
  const resolveEffects = (node: MotionNodeV1): readonly ResolvedMotionEffectV1[] => Object.freeze(node.effects.map((effect) => Object.freeze({ id: effect.id, effectType: effect.effectType, enabled: effect.enabled, parameters: Object.freeze(Object.fromEntries(Object.entries(effect.parameters).map(([name, value]) => [name, typeof (value as Animatable<MotionPropertyPrimitiveV1>).kind === 'string' ? resolveAnimatable(value as Animatable<MotionPropertyPrimitiveV1>, `${node.id}.effect.${effect.id}.${name}`) : value]))) as Readonly<Record<string, number | string>> })))
  const resolveMasks = (node: MotionNodeV1): readonly ResolvedMotionMaskV1[] => Object.freeze(node.masks.map((mask) => Object.freeze({ id: mask.id, type: mask.type, enabled: mask.enabled, invert: mask.invert, opacity: resolveNumber(mask.opacity, `${node.id}.mask.${mask.id}.opacity`), feather: resolveNumber(mask.feather, `${node.id}.mask.${mask.id}.feather`), expansion: resolveNumber(mask.expansion, `${node.id}.mask.${mask.id}.expansion`), x: resolveNumber(mask.x, `${node.id}.mask.${mask.id}.x`), y: resolveNumber(mask.y, `${node.id}.mask.${mask.id}.y`), width: resolveNumber(mask.width, `${node.id}.mask.${mask.id}.width`), height: resolveNumber(mask.height, `${node.id}.mask.${mask.id}.height`), radius: resolveNumber(mask.radius, `${node.id}.mask.${mask.id}.radius`) })))
  const nodes: Record<string, ResolvedMotionNodeV1> = {}
  for (const node of Object.values(scene.nodes)) {
    const base = { id: node.id, name: node.name, parentId: node.parentId, visible: resolveBoolean(node.visible, `${node.id}.visible`), opacity: resolveNumber(node.opacity, `${node.id}.opacity`), transform: resolveTransform(node), blendMode: node.blendMode, effects: resolveEffects(node), masks: resolveMasks(node) }
    if (node.type === 'group') nodes[node.id] = Object.freeze({ ...base, type: 'group', childIds: node.childIds })
    else if (node.type === 'text') nodes[node.id] = Object.freeze({ ...base, type: 'text', text: resolveString(node.text, `${node.id}.text`), fillColor: resolveString(node.fillColor, `${node.id}.fillColor`), fontFamily: node.fontFamily, fontSize: resolveNumber(node.fontSize, `${node.id}.fontSize`), fontWeight: resolveNumber(node.fontWeight, `${node.id}.fontWeight`), textAlign: node.textAlign })
    else if (node.type === 'shape') nodes[node.id] = Object.freeze({ ...base, type: 'shape', shape: node.shape, width: resolveNumber(node.width, `${node.id}.width`), height: resolveNumber(node.height, `${node.id}.height`), fillColor: resolveString(node.fillColor, `${node.id}.fillColor`), strokeColor: resolveString(node.strokeColor, `${node.id}.strokeColor`), strokeWidth: resolveNumber(node.strokeWidth, `${node.id}.strokeWidth`), radius: resolveNumber(node.radius, `${node.id}.radius`) })
    else if (node.type === 'path') nodes[node.id] = Object.freeze({ ...base, type: 'path', pathData: node.pathData, fillColor: resolveString(node.fillColor, `${node.id}.fillColor`), strokeColor: resolveString(node.strokeColor, `${node.id}.strokeColor`), strokeWidth: resolveNumber(node.strokeWidth, `${node.id}.strokeWidth`), trimProgress: resolveNumber(node.trimProgress, `${node.id}.trimProgress`) })
    else nodes[node.id] = Object.freeze({ ...base, type: 'image', source: node.source, width: resolveNumber(node.width, `${node.id}.width`), height: resolveNumber(node.height, `${node.id}.height`), fit: node.fit, imageOpacity: resolveNumber(node.imageOpacity, `${node.id}.imageOpacity`) })
  }
  return Object.freeze({ schemaVersion: 'sanverse.resolved-motion-scene/v1', componentId: scene.componentId, componentVersion: scene.componentVersion, rootNodeId: scene.rootNodeId, nodes: Object.freeze(nodes), semanticParts: scene.semanticParts, exposures: scene.exposures, layout: scene.layout })
}
