import { readMotionAnimatableTarget } from './animatable-targets.ts'
import type { MotionAnimatableSemanticTypeV1 } from './animatable-targets.ts'
import type { MotionKeyframeInterpolationV1, MotionKeyframeTargetV1, MotionKeyframeV1, MotionNodePropertyNameV1, MotionPropertyPrimitiveV1 } from './properties.ts'
import type { MotionNodeV1 } from './nodes.ts'
import type { MotionSceneV1 } from './scene.ts'

export interface MotionLayerTreeNodeV1 {
  readonly nodeId: string
  readonly name: string
  readonly type: MotionNodeV1['type']
  readonly children: readonly MotionLayerTreeNodeV1[]
}

export const deriveLayerTree = (scene: MotionSceneV1): MotionLayerTreeNodeV1 => {
  const visit = (nodeId: string): MotionLayerTreeNodeV1 => {
    const node = scene.nodes[nodeId]
    if (!node) throw new RangeError(`Missing layer node: ${nodeId}`)
    return Object.freeze({
      nodeId,
      name: node.name,
      type: node.type,
      children: Object.freeze(node.type === 'group' ? node.childIds.map(visit) : []),
    })
  }
  return visit(scene.rootNodeId)
}

export interface MotionNodeEffectRelationshipV1 {
  readonly nodeId: string
  readonly nodeName: string
  readonly effects: readonly Readonly<{ id: string; type: string; enabled: boolean }>[]
  readonly masks: readonly Readonly<{ id: string; type: string; enabled: boolean }>[]
}

export const deriveNodeEffectRelationships = (scene: MotionSceneV1): readonly MotionNodeEffectRelationshipV1[] => Object.freeze(
  Object.values(scene.nodes).map((node) => Object.freeze({
    nodeId: node.id,
    nodeName: node.name,
    effects: Object.freeze(node.effects.map((effect) => Object.freeze({ id: effect.id, type: effect.effectType, enabled: effect.enabled }))),
    masks: Object.freeze(node.masks.map((mask) => Object.freeze({ id: mask.id, type: mask.type, enabled: mask.enabled }))),
  })),
)

export interface MotionTimelineTrackV1 {
  readonly target: MotionKeyframeTargetV1
  readonly nodeId: string
  readonly nodeName: string
  readonly label: string
  readonly property: string
  readonly propertyType: MotionAnimatableSemanticTypeV1
  readonly interpolation: readonly MotionKeyframeInterpolationV1[]
  readonly animationKind: 'motion' | 'keyframes' | 'binding'
  readonly keyframes: readonly MotionKeyframeV1<MotionPropertyPrimitiveV1>[]
  /** Compatibility summary for existing C0 callers. */
  readonly keyframeTicks: readonly number[]
}

export interface MotionTimelineTrackGroupV1 {
  readonly nodeId: string
  readonly nodeName: string
  readonly tracks: readonly MotionTimelineTrackV1[]
}

const nodeProperties = (node: MotionNodeV1): readonly MotionNodePropertyNameV1[] => {
  const values: MotionNodePropertyNameV1[] = [
    'visible', 'opacity',
    'transform.positionX', 'transform.positionY', 'transform.scaleX', 'transform.scaleY', 'transform.rotationDeg', 'transform.anchorX', 'transform.anchorY',
  ]
  if (node.type === 'text') values.push('text.text', 'text.fillColor', 'text.fontSize', 'text.fontWeight')
  if (node.type === 'shape') values.push('shape.width', 'shape.height', 'shape.fillColor', 'shape.strokeColor', 'shape.strokeWidth', 'shape.radius')
  if (node.type === 'path') values.push('path.fillColor', 'path.strokeColor', 'path.strokeWidth', 'path.trimProgress')
  if (node.type === 'image') values.push('image.width', 'image.height', 'image.opacity')
  return Object.freeze(values)
}

const trackFor = (scene: MotionSceneV1, target: MotionKeyframeTargetV1): MotionTimelineTrackV1 | null => {
  const record = readMotionAnimatableTarget(scene, target)
  if (record.animatable.kind === 'constant') return null
  const keyframes = record.animatable.kind === 'keyframes' ? record.animatable.keyframes : Object.freeze([])
  return Object.freeze({
    target,
    nodeId: record.nodeId,
    nodeName: record.nodeName,
    label: record.label,
    property: target.kind === 'node' ? target.property : target.kind === 'effect' ? `effect.${target.effectId}.${target.parameter}` : `mask.${target.maskId}.${target.property}`,
    propertyType: record.capability.semanticType,
    interpolation: record.capability.interpolation,
    animationKind: record.animatable.kind,
    keyframes: Object.freeze(keyframes.map((keyframe) => Object.freeze({ ...keyframe, ...(keyframe.bezier ? { bezier: Object.freeze({ ...keyframe.bezier }) } : {}) }))),
    keyframeTicks: Object.freeze(keyframes.map((keyframe) => keyframe.tick)),
  })
}

export const deriveTimelineTracks = (scene: MotionSceneV1): readonly MotionTimelineTrackV1[] => {
  const tracks: MotionTimelineTrackV1[] = []
  for (const node of Object.values(scene.nodes)) {
    for (const property of nodeProperties(node)) {
      const track = trackFor(scene, { kind: 'node', nodeId: node.id, property })
      if (track) tracks.push(track)
    }
    for (const effect of node.effects) for (const parameter of Object.keys(effect.parameters)) {
      const track = trackFor(scene, { kind: 'effect', nodeId: node.id, effectId: effect.id, parameter })
      if (track) tracks.push(track)
    }
    for (const mask of node.masks) for (const property of ['opacity', 'feather', 'expansion', 'x', 'y', 'width', 'height', 'radius'] as const) {
      const track = trackFor(scene, { kind: 'mask', nodeId: node.id, maskId: mask.id, property })
      if (track) tracks.push(track)
    }
  }
  return Object.freeze(tracks)
}

export const deriveTimelineTrackGroups = (scene: MotionSceneV1): readonly MotionTimelineTrackGroupV1[] => {
  const tracks = deriveTimelineTracks(scene)
  const groups = new Map<string, MotionTimelineTrackV1[]>()
  for (const track of tracks) groups.set(track.nodeId, [...(groups.get(track.nodeId) ?? []), track])
  return Object.freeze([...groups.entries()].map(([nodeId, nodeTracks]) => Object.freeze({ nodeId, nodeName: scene.nodes[nodeId]?.name ?? nodeId, tracks: Object.freeze(nodeTracks) })))
}

export const isNodeProperty = (value: string): value is MotionNodePropertyNameV1 => Boolean(value)
