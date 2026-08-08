import type { Animatable, MotionNodePropertyNameV1 } from './properties.ts'
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
  readonly nodeId: string
  readonly property: string
  readonly animationKind: 'motion' | 'keyframes' | 'binding'
  readonly keyframeTicks: readonly number[]
}

const animatablesForNode = (node: MotionNodeV1): readonly [string, Animatable<string | number | boolean>][] => {
  const values: [string, Animatable<string | number | boolean>][] = [
    ['visible', node.visible], ['opacity', node.opacity],
    ['transform.positionX', node.transform.positionX], ['transform.positionY', node.transform.positionY], ['transform.scaleX', node.transform.scaleX], ['transform.scaleY', node.transform.scaleY], ['transform.rotationDeg', node.transform.rotationDeg], ['transform.anchorX', node.transform.anchorX], ['transform.anchorY', node.transform.anchorY],
  ]
  if (node.type === 'text') values.push(['text.text', node.text], ['text.fillColor', node.fillColor], ['text.fontSize', node.fontSize], ['text.fontWeight', node.fontWeight])
  if (node.type === 'shape') values.push(['shape.fillColor', node.fillColor], ['shape.strokeColor', node.strokeColor], ['shape.strokeWidth', node.strokeWidth], ['shape.radius', node.radius])
  if (node.type === 'path') values.push(['path.fillColor', node.fillColor], ['path.strokeColor', node.strokeColor], ['path.strokeWidth', node.strokeWidth], ['path.trimProgress', node.trimProgress])
  if (node.type === 'image') values.push(['image.opacity', node.imageOpacity])
  return values
}

export const deriveTimelineTracks = (scene: MotionSceneV1): readonly MotionTimelineTrackV1[] => {
  const tracks: MotionTimelineTrackV1[] = []
  for (const node of Object.values(scene.nodes)) {
    for (const [property, animatable] of animatablesForNode(node)) {
      if (animatable.kind === 'constant') continue
      tracks.push(Object.freeze({ nodeId: node.id, property, animationKind: animatable.kind, keyframeTicks: Object.freeze(animatable.kind === 'keyframes' ? animatable.keyframes.map((keyframe) => keyframe.tick) : []) }))
    }
    for (const effect of node.effects) for (const [parameter, animatable] of Object.entries(effect.parameters)) if (animatable.kind !== 'constant') tracks.push(Object.freeze({ nodeId: node.id, property: `effect.${effect.id}.${parameter}`, animationKind: animatable.kind, keyframeTicks: Object.freeze(animatable.kind === 'keyframes' ? animatable.keyframes.map((keyframe) => keyframe.tick) : []) }))
  }
  return Object.freeze(tracks)
}

export const isNodeProperty = (value: string): value is MotionNodePropertyNameV1 => Boolean(value)
