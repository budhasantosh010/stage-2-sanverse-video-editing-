import type { MotionRenderContextV1 } from '@sanverse/motion-contract'
import { clamp } from '@sanverse/motion-primitives'
import { evaluateAnimatable } from './animation.ts'
import { motionNodeAnimatable } from './animatable-targets.ts'
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

export const evaluateScene = (sceneInput: MotionSceneV1, context: MotionRenderContextV1): ResolvedMotionSceneV1 => {
  const scene = assertValidMotionScene(sceneInput)
  const cache = new Map<string, MotionPropertyPrimitiveV1>()
  const active = new Set<string>()
  const resolveAnimatable = (value: Animatable<MotionPropertyPrimitiveV1>, key: string): MotionPropertyPrimitiveV1 => evaluateAnimatable(value, context, key, (bound, bindingKey) => {
    const source = bound.binding.source
    const sourceValue = resolveProperty(source.nodeId, source.property)
    if (!bound.binding.map) return sourceValue
    if (typeof sourceValue !== 'number') throw new RangeError(`Binding map on ${bindingKey} requires a numeric source.`)
    const mapped = sourceValue * bound.binding.map.scale + bound.binding.map.offset
    return clamp(mapped, bound.binding.map.clampMin ?? -Number.MAX_SAFE_INTEGER, bound.binding.map.clampMax ?? Number.MAX_SAFE_INTEGER)
  })
  const resolveProperty = (nodeId: string, property: MotionNodePropertyNameV1): MotionPropertyPrimitiveV1 => {
    const key = `${nodeId}:${property}`
    const cached = cache.get(key)
    if (cached !== undefined) return cached
    if (active.has(key)) throw new RangeError(`Motion binding cycle detected at ${key}.`)
    active.add(key)
    const node = scene.nodes[nodeId]
    if (!node) throw new RangeError(`Missing binding node: ${nodeId}.`)
    const resolved = resolveAnimatable(motionNodeAnimatable(node, property), key)
    active.delete(key)
    cache.set(key, resolved)
    return resolved
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
    positionX: resolveNumber(node.transform.positionX, `${node.id}.transform.positionX`),
    positionY: resolveNumber(node.transform.positionY, `${node.id}.transform.positionY`),
    scaleX: resolveNumber(node.transform.scaleX, `${node.id}.transform.scaleX`),
    scaleY: resolveNumber(node.transform.scaleY, `${node.id}.transform.scaleY`),
    rotationDeg: resolveNumber(node.transform.rotationDeg, `${node.id}.transform.rotationDeg`),
    anchorX: resolveNumber(node.transform.anchorX, `${node.id}.transform.anchorX`),
    anchorY: resolveNumber(node.transform.anchorY, `${node.id}.transform.anchorY`),
    perspectiveMatrix3d: node.transform.perspectiveMatrix3d ? resolveString(node.transform.perspectiveMatrix3d, `${node.id}.transform.perspectiveMatrix3d`) : 'none',
  })
  const resolveEffects = (node: MotionNodeV1): readonly ResolvedMotionEffectV1[] => Object.freeze(node.effects.map((effect) => Object.freeze({
    id: effect.id,
    effectType: effect.effectType,
    enabled: effect.enabled,
    parameters: Object.freeze(Object.fromEntries(Object.entries(effect.parameters).map(([name, value]) => [name, resolveAnimatable(value as Animatable<MotionPropertyPrimitiveV1>, `${node.id}.effect.${effect.id}.${name}`)]))) as Readonly<Record<string, number | string>>,
  })))
  const resolveMasks = (node: MotionNodeV1): readonly ResolvedMotionMaskV1[] => Object.freeze(node.masks.map((mask) => Object.freeze({
    id: mask.id,
    type: mask.type,
    enabled: mask.enabled,
    invert: mask.invert,
    opacity: resolveNumber(mask.opacity, `${node.id}.mask.${mask.id}.opacity`),
    feather: resolveNumber(mask.feather, `${node.id}.mask.${mask.id}.feather`),
    expansion: resolveNumber(mask.expansion, `${node.id}.mask.${mask.id}.expansion`),
    x: resolveNumber(mask.x, `${node.id}.mask.${mask.id}.x`),
    y: resolveNumber(mask.y, `${node.id}.mask.${mask.id}.y`),
    width: resolveNumber(mask.width, `${node.id}.mask.${mask.id}.width`),
    height: resolveNumber(mask.height, `${node.id}.mask.${mask.id}.height`),
    radius: resolveNumber(mask.radius, `${node.id}.mask.${mask.id}.radius`),
  })))
  const effectiveEnabledCache = new Map<string, boolean>()
  const effectiveEnabledFor = (nodeId: string): boolean => {
    const cached = effectiveEnabledCache.get(nodeId)
    if (cached !== undefined) return cached
    const node = scene.nodes[nodeId]
    if (!node) return false
    const own = node.enabled !== false
    const result = own && (node.parentId === null || effectiveEnabledFor(node.parentId))
    effectiveEnabledCache.set(nodeId, result)
    return result
  }
  const stackingIndexFor = (node: MotionNodeV1): number => {
    if (!node.parentId) return 0
    const parent = scene.nodes[node.parentId]
    return parent?.type === 'group' ? Math.max(0, parent.childIds.indexOf(node.id)) : 0
  }
  const nodes: Record<string, ResolvedMotionNodeV1> = {}
  for (const node of Object.values(scene.nodes)) {
    const base = { id: node.id, name: node.name, parentId: node.parentId, enabled: node.enabled !== false, effectiveEnabled: effectiveEnabledFor(node.id), stackingIndex: stackingIndexFor(node), visible: resolveBoolean(node.visible, `${node.id}.visible`), opacity: resolveNumber(node.opacity, `${node.id}.opacity`), transform: resolveTransform(node), blendMode: node.blendMode, effects: resolveEffects(node), masks: resolveMasks(node) }
    if (node.type === 'group') nodes[node.id] = Object.freeze({ ...base, type: 'group', childIds: node.childIds })
    else if (node.type === 'text') nodes[node.id] = Object.freeze({ ...base, type: 'text', text: resolveString(node.text, `${node.id}.text`), fillColor: resolveString(node.fillColor, `${node.id}.fillColor`), fontFamily: node.fontFamily, fontSize: resolveNumber(node.fontSize, `${node.id}.fontSize`), fontWeight: resolveNumber(node.fontWeight, `${node.id}.fontWeight`), textAlign: node.textAlign })
    else if (node.type === 'shape') nodes[node.id] = Object.freeze({ ...base, type: 'shape', shape: node.shape, width: resolveNumber(node.width, `${node.id}.width`), height: resolveNumber(node.height, `${node.id}.height`), fillColor: resolveString(node.fillColor, `${node.id}.fillColor`), strokeColor: resolveString(node.strokeColor, `${node.id}.strokeColor`), strokeWidth: resolveNumber(node.strokeWidth, `${node.id}.strokeWidth`), radius: resolveNumber(node.radius, `${node.id}.radius`) })
    else if (node.type === 'path') nodes[node.id] = Object.freeze({ ...base, type: 'path', pathData: node.pathData, fillColor: resolveString(node.fillColor, `${node.id}.fillColor`), strokeColor: resolveString(node.strokeColor, `${node.id}.strokeColor`), strokeWidth: resolveNumber(node.strokeWidth, `${node.id}.strokeWidth`), trimProgress: resolveNumber(node.trimProgress, `${node.id}.trimProgress`) })
    else if (node.type === 'image') nodes[node.id] = Object.freeze({ ...base, type: 'image', source: node.source, width: resolveNumber(node.width, `${node.id}.width`), height: resolveNumber(node.height, `${node.id}.height`), fit: node.fit, imageOpacity: resolveNumber(node.imageOpacity, `${node.id}.imageOpacity`) })
    else nodes[node.id] = Object.freeze({ ...base, type: 'expert', expert: node.expert })
  }
  return Object.freeze({ schemaVersion: 'sanverse.resolved-motion-scene/v1', componentId: scene.componentId, componentVersion: scene.componentVersion, rootNodeId: scene.rootNodeId, nodes: Object.freeze(nodes), semanticParts: scene.semanticParts, exposures: scene.exposures, layout: scene.layout, ...(scene.compositing ? { compositing: scene.compositing } : {}) })
}
