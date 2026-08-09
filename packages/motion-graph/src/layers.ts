import type { MotionNodeV1, ResolvedMotionNodeV1 } from './nodes.ts'
import type { MotionSceneV1 } from './scene.ts'
import type { ResolvedMotionSceneV1 } from './evaluator.ts'
import type { MotionTimelineTrackV1 } from './projections.ts'
import { deriveTimelineTracks } from './projections.ts'
import type { MotionAuthoringMetadataV1 } from './authoring.ts'
import { createMotionAuthoringMetadata, motionNodeLockState } from './authoring.ts'

export interface MotionLayerProjectionV1 {
  readonly nodeId: string
  readonly parentNodeId: string | null
  readonly childNodeIds: readonly string[]
  readonly displayName: string
  readonly nodeName: string
  readonly nodeType: MotionNodeV1['type']
  readonly semanticPartIds: readonly string[]
  readonly enabled: boolean
  readonly effectiveEnabled: boolean
  readonly visibleAtTick: boolean
  readonly effectivelyVisibleAtTick: boolean
  readonly locked: boolean
  readonly effectiveLocked: boolean
  readonly lockedByAncestorNodeId: string | null
  readonly hasKeyframes: boolean
  readonly hasMotionDriver: boolean
  readonly hasBinding: boolean
  readonly hasEffects: boolean
  readonly effectCount: number
  readonly hasMasks: boolean
  readonly maskCount: number
  readonly depth: number
}

export interface MotionLayerProjectionResultV1 {
  readonly rootNodeId: string
  readonly layersById: Readonly<Record<string, MotionLayerProjectionV1>>
  readonly preorderNodeIds: readonly string[]
}

const shortContent = (value: string): string => {
  const normalized = value.replace(/\s+/gu, ' ').trim()
  return normalized.length <= 48 ? normalized : `${normalized.slice(0, 45)}…`
}

const genericName = /^(title|label|value|text|item\s+\d+|node\s+\d+|step\s+\d+|row\s+\d+|surface)$/iu

export const motionLayerDisplayName = (
  scene: MotionSceneV1,
  node: MotionNodeV1,
  resolvedNode?: ResolvedMotionNodeV1,
): string => {
  const explicit = node.name.trim()
  const semantic = scene.semanticParts.find((part) => part.nodeIds.includes(node.id))?.label.trim() ?? ''
  const resolvedText = resolvedNode?.type === 'text' ? shortContent(resolvedNode.text) : ''
  if (explicit && resolvedText && genericName.test(explicit)) return `${explicit} — ${resolvedText}`
  if (explicit) return explicit
  if (semantic) return semantic
  if (resolvedText) return `${node.type === 'text' ? 'Text' : node.type} — ${resolvedText}`
  return `${node.type[0]?.toUpperCase()}${node.type.slice(1)}`
}

const effectiveEnabledFromScene = (scene: MotionSceneV1, nodeId: string): boolean => {
  let current: string | null = nodeId
  while (current) {
    const node: MotionNodeV1 | undefined = scene.nodes[current]
    if (!node || node.enabled === false) return false
    current = node.parentId
  }
  return true
}

const depthFor = (scene: MotionSceneV1, nodeId: string): number => {
  let depth = 0
  let current = scene.nodes[nodeId]?.parentId ?? null
  const seen = new Set<string>()
  while (current) {
    if (seen.has(current)) throw new RangeError(`Layer projection cycle at ${nodeId}.`)
    seen.add(current)
    depth += 1
    current = scene.nodes[current]?.parentId ?? null
  }
  return depth
}

const animationStatus = (nodeId: string, tracks: readonly MotionTimelineTrackV1[]): Readonly<{ hasKeyframes: boolean; hasMotionDriver: boolean; hasBinding: boolean }> => {
  const nodeTracks = tracks.filter((track) => track.nodeId === nodeId)
  return Object.freeze({
    hasKeyframes: nodeTracks.some((track) => track.animationKind === 'keyframes'),
    hasMotionDriver: nodeTracks.some((track) => track.animationKind === 'motion'),
    hasBinding: nodeTracks.some((track) => track.animationKind === 'binding'),
  })
}

export const projectMotionLayers = (input: Readonly<{
  scene: MotionSceneV1
  resolvedScene?: ResolvedMotionSceneV1 | null
  authoringMetadata?: MotionAuthoringMetadataV1
  timelineProjection?: readonly MotionTimelineTrackV1[]
}>): MotionLayerProjectionResultV1 => {
  const { scene, resolvedScene = null } = input
  const authoringMetadata = input.authoringMetadata ?? createMotionAuthoringMetadata()
  const timelineProjection = input.timelineProjection ?? deriveTimelineTracks(scene)
  if (!scene.nodes[scene.rootNodeId]) throw new RangeError(`Missing root layer ${scene.rootNodeId}.`)
  const layersById: Record<string, MotionLayerProjectionV1> = {}
  const preorderNodeIds: string[] = []
  const visit = (nodeId: string): void => {
    const node = scene.nodes[nodeId]
    if (!node) throw new RangeError(`Missing layer node ${nodeId}.`)
    const resolvedNode = resolvedScene?.nodes[nodeId]
    const lockState = motionNodeLockState(scene, authoringMetadata, nodeId)
    const status = animationStatus(nodeId, timelineProjection)
    const enabled = node.enabled !== false
    const effectiveEnabled = resolvedNode?.effectiveEnabled ?? effectiveEnabledFromScene(scene, nodeId)
    const visibleAtTick = resolvedNode?.visible ?? true
    const semanticPartIds = scene.semanticParts.filter((part) => part.nodeIds.includes(nodeId)).map((part) => part.id)
    const childNodeIds = node.type === 'group' ? node.childIds : Object.freeze([])
    layersById[nodeId] = Object.freeze({
      nodeId,
      parentNodeId: node.parentId,
      childNodeIds: Object.freeze([...childNodeIds]),
      displayName: motionLayerDisplayName(scene, node, resolvedNode),
      nodeName: node.name,
      nodeType: node.type,
      semanticPartIds: Object.freeze(semanticPartIds),
      enabled,
      effectiveEnabled,
      visibleAtTick,
      effectivelyVisibleAtTick: effectiveEnabled && visibleAtTick,
      locked: lockState.directlyLocked,
      effectiveLocked: lockState.effectiveLocked,
      lockedByAncestorNodeId: lockState.lockedByAncestorNodeId,
      ...status,
      hasEffects: node.effects.length > 0,
      effectCount: node.effects.length,
      hasMasks: node.masks.length > 0,
      maskCount: node.masks.length,
      depth: depthFor(scene, nodeId),
    })
    preorderNodeIds.push(nodeId)
    if (node.type === 'group') node.childIds.forEach(visit)
  }
  visit(scene.rootNodeId)
  if (preorderNodeIds.length !== Object.keys(scene.nodes).length) {
    const unprojected = Object.keys(scene.nodes).filter((nodeId) => !layersById[nodeId])
    throw new RangeError(`Motion layer projection found unreachable nodes: ${unprojected.join(', ')}`)
  }
  return Object.freeze({ rootNodeId: scene.rootNodeId, layersById: Object.freeze(layersById), preorderNodeIds: Object.freeze(preorderNodeIds) })
}

export const filterMotionLayerProjection = (
  projection: MotionLayerProjectionResultV1,
  query: string,
): Readonly<{ visibleNodeIds: readonly string[]; requiredAncestorNodeIds: readonly string[] }> => {
  const normalized = query.trim().toLowerCase()
  if (!normalized) return Object.freeze({ visibleNodeIds: projection.preorderNodeIds, requiredAncestorNodeIds: Object.freeze([]) })
  const matches = new Set(projection.preorderNodeIds.filter((nodeId) => {
    const layer = projection.layersById[nodeId]!
    return [layer.displayName, layer.nodeType, layer.nodeId, ...layer.semanticPartIds].some((value) => value.toLowerCase().includes(normalized))
  }))
  const requiredAncestors = new Set<string>()
  for (const nodeId of matches) {
    let current = projection.layersById[nodeId]?.parentNodeId ?? null
    while (current) {
      requiredAncestors.add(current)
      current = projection.layersById[current]?.parentNodeId ?? null
    }
  }
  return Object.freeze({
    visibleNodeIds: Object.freeze(projection.preorderNodeIds.filter((nodeId) => matches.has(nodeId) || requiredAncestors.has(nodeId))),
    requiredAncestorNodeIds: Object.freeze([...requiredAncestors]),
  })
}
