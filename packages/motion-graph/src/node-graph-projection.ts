import type { MotionNodeV1 } from './nodes.ts'
import type { MotionSceneV1 } from './scene.ts'

export type MotionNodeGraphRelationshipKindV1 = 'parent' | 'effect' | 'mask' | 'binding'

export interface MotionNodeGraphProjectionNodeV1 {
  readonly nodeId: string
  readonly name: string
  readonly type: MotionNodeV1['type']
  readonly parentNodeId: string | null
  readonly childNodeIds: readonly string[]
  readonly effectIds: readonly string[]
  readonly maskIds: readonly string[]
  readonly bindingSourceNodeIds: readonly string[]
}

export interface MotionNodeGraphRelationshipV1 {
  readonly kind: MotionNodeGraphRelationshipKindV1
  readonly fromNodeId: string
  readonly toNodeId: string
}

export interface MotionNodeGraphProjectionV1 {
  readonly schemaVersion: 'sanverse.motion-node-projection/v1'
  readonly sceneComponentId: string
  readonly rootNodeId: string
  readonly nodes: readonly MotionNodeGraphProjectionNodeV1[]
  readonly relationships: readonly MotionNodeGraphRelationshipV1[]
}

const collectBindingSources = (value: unknown, output: Set<string>, seen = new Set<object>()): void => {
  if (!value || typeof value !== 'object') return
  const objectValue = value as Record<string, unknown>
  if (seen.has(objectValue)) return
  seen.add(objectValue)
  if (objectValue.kind === 'binding' && objectValue.binding && typeof objectValue.binding === 'object') {
    const source = (objectValue.binding as Record<string, unknown>).source
    if (source && typeof source === 'object' && typeof (source as Record<string, unknown>).nodeId === 'string') output.add(String((source as Record<string, unknown>).nodeId))
  }
  for (const nested of Object.values(objectValue)) collectBindingSources(nested, output, seen)
}

export const deriveNodeGraphProjection = (scene: MotionSceneV1): MotionNodeGraphProjectionV1 => {
  const nodes = Object.values(scene.nodes).map((node): MotionNodeGraphProjectionNodeV1 => {
    const bindingSources = new Set<string>()
    collectBindingSources(node, bindingSources)
    return Object.freeze({
      nodeId: node.id,
      name: node.name,
      type: node.type,
      parentNodeId: node.parentId,
      childNodeIds: Object.freeze(node.type === 'group' ? [...node.childIds] : []),
      effectIds: Object.freeze(node.effects.map((effect) => effect.id)),
      maskIds: Object.freeze(node.masks.map((mask) => mask.id)),
      bindingSourceNodeIds: Object.freeze([...bindingSources].sort()),
    })
  })
  const relationships: MotionNodeGraphRelationshipV1[] = []
  for (const node of nodes) {
    if (node.parentNodeId) relationships.push(Object.freeze({ kind: 'parent', fromNodeId: node.parentNodeId, toNodeId: node.nodeId }))
    for (const effectId of node.effectIds) relationships.push(Object.freeze({ kind: 'effect', fromNodeId: node.nodeId, toNodeId: effectId }))
    for (const maskId of node.maskIds) relationships.push(Object.freeze({ kind: 'mask', fromNodeId: node.nodeId, toNodeId: maskId }))
    for (const sourceNodeId of node.bindingSourceNodeIds) relationships.push(Object.freeze({ kind: 'binding', fromNodeId: sourceNodeId, toNodeId: node.nodeId }))
  }
  return Object.freeze({ schemaVersion: 'sanverse.motion-node-projection/v1', sceneComponentId: scene.componentId, rootNodeId: scene.rootNodeId, nodes: Object.freeze(nodes), relationships: Object.freeze(relationships) })
}
