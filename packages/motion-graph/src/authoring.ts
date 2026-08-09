import type { MotionSceneV1 } from './scene.ts'

export interface MotionAuthoringMetadataV1 {
  readonly schemaVersion: 'sanverse.motion-authoring-metadata/v1'
  readonly lockedNodeIds: readonly string[]
}

export interface MotionNodeLockStateV1 {
  readonly directlyLocked: boolean
  readonly effectiveLocked: boolean
  readonly lockedByAncestorNodeId: string | null
}

export const createMotionAuthoringMetadata = (lockedNodeIds: readonly string[] = []): MotionAuthoringMetadataV1 => Object.freeze({
  schemaVersion: 'sanverse.motion-authoring-metadata/v1',
  lockedNodeIds: Object.freeze([...new Set(lockedNodeIds)]),
})

export const serializeMotionAuthoringMetadata = (metadata: MotionAuthoringMetadataV1): string => JSON.stringify(metadata)

export const parseMotionAuthoringMetadata = (scene: MotionSceneV1, serialized: string): MotionAuthoringMetadataV1 => {
  const raw = JSON.parse(serialized) as Partial<MotionAuthoringMetadataV1>
  const metadata = createMotionAuthoringMetadata(Array.isArray(raw.lockedNodeIds) ? raw.lockedNodeIds.filter((value): value is string => typeof value === 'string') : [])
  if (raw.schemaVersion !== metadata.schemaVersion) throw new RangeError('Authoring metadata schemaVersion is unsupported.')
  const issues = validateMotionAuthoringMetadata(scene, metadata)
  if (issues.length) throw new RangeError(issues.join('\n'))
  return metadata
}

export const validateMotionAuthoringMetadata = (scene: MotionSceneV1, metadata: MotionAuthoringMetadataV1): readonly string[] => {
  const issues: string[] = []
  if (metadata.schemaVersion !== 'sanverse.motion-authoring-metadata/v1') issues.push('Authoring metadata schemaVersion is unsupported.')
  const seen = new Set<string>()
  for (const nodeId of metadata.lockedNodeIds) {
    if (typeof nodeId !== 'string' || !nodeId.trim()) issues.push('lockedNodeIds must contain bounded non-empty node IDs.')
    else if (seen.has(nodeId)) issues.push(`lockedNodeIds contains duplicate node ID ${nodeId}.`)
    else if (!scene.nodes[nodeId]) issues.push(`lockedNodeIds references missing node ${nodeId}.`)
    seen.add(nodeId)
  }
  return Object.freeze(issues)
}

export const setMotionNodeLocked = (metadata: MotionAuthoringMetadataV1, scene: MotionSceneV1, nodeId: string, locked: boolean): MotionAuthoringMetadataV1 => {
  if (!scene.nodes[nodeId]) throw new RangeError(`Unknown node: ${nodeId}`)
  const next = new Set(metadata.lockedNodeIds)
  if (locked) next.add(nodeId)
  else next.delete(nodeId)
  return createMotionAuthoringMetadata([...next])
}

export const motionNodeLockState = (scene: MotionSceneV1, metadata: MotionAuthoringMetadataV1 | undefined, nodeId: string): MotionNodeLockStateV1 => {
  const node = scene.nodes[nodeId]
  if (!node) return Object.freeze({ directlyLocked: false, effectiveLocked: false, lockedByAncestorNodeId: null })
  const lockedIds = new Set(metadata?.lockedNodeIds ?? [])
  const directlyLocked = lockedIds.has(nodeId)
  let current = node.parentId
  let lockedByAncestorNodeId: string | null = null
  while (current) {
    if (lockedIds.has(current)) { lockedByAncestorNodeId = current; break }
    current = scene.nodes[current]?.parentId ?? null
  }
  return Object.freeze({ directlyLocked, effectiveLocked: directlyLocked || lockedByAncestorNodeId !== null, lockedByAncestorNodeId })
}

export interface MotionSelectionStateV1 {
  readonly selectedNodeIds: readonly string[]
  readonly primaryNodeId: string | null
  readonly anchorNodeId: string | null
}

export const createMotionSelectionState = (nodeIds: readonly string[] = [], primaryNodeId: string | null = null, anchorNodeId: string | null = null): MotionSelectionStateV1 => {
  const selectedNodeIds = Object.freeze([...new Set(nodeIds)])
  const primary = primaryNodeId && selectedNodeIds.includes(primaryNodeId) ? primaryNodeId : selectedNodeIds.at(-1) ?? null
  const anchor = anchorNodeId && selectedNodeIds.includes(anchorNodeId) ? anchorNodeId : primary
  return Object.freeze({ selectedNodeIds, primaryNodeId: primary, anchorNodeId: anchor })
}

export const selectMotionNode = (nodeId: string | null): MotionSelectionStateV1 => nodeId ? createMotionSelectionState([nodeId], nodeId, nodeId) : createMotionSelectionState()

export const toggleMotionNodeSelection = (state: MotionSelectionStateV1, nodeId: string): MotionSelectionStateV1 => {
  const selected = new Set(state.selectedNodeIds)
  if (selected.has(nodeId)) selected.delete(nodeId)
  else selected.add(nodeId)
  const next = [...selected]
  const primary = selected.has(nodeId) ? nodeId : (state.primaryNodeId === nodeId ? next.at(-1) ?? null : state.primaryNodeId)
  return createMotionSelectionState(next, primary, state.anchorNodeId ?? primary)
}

export const selectMotionNodeRange = (state: MotionSelectionStateV1, nodeId: string, visibleNodeIds: readonly string[]): MotionSelectionStateV1 => {
  const anchor = state.anchorNodeId ?? state.primaryNodeId ?? nodeId
  const a = visibleNodeIds.indexOf(anchor)
  const b = visibleNodeIds.indexOf(nodeId)
  if (a < 0 || b < 0) return selectMotionNode(nodeId)
  const start = Math.min(a, b)
  const end = Math.max(a, b)
  return createMotionSelectionState(visibleNodeIds.slice(start, end + 1), nodeId, anchor)
}

export const selectionFallbackAfterDelete = (
  before: MotionSceneV1,
  after: MotionSceneV1,
  deletedNodeIds: readonly string[],
  previousPrimaryNodeId: string | null,
): string | null => {
  if (previousPrimaryNodeId && after.nodes[previousPrimaryNodeId]) return previousPrimaryNodeId
  const deleted = new Set(deletedNodeIds)
  const deletedPrimary = previousPrimaryNodeId ? before.nodes[previousPrimaryNodeId] : undefined
  const parentId = deletedPrimary?.parentId ?? null
  if (parentId) {
    const parentBefore = before.nodes[parentId]
    const parentAfter = after.nodes[parentId]
    if (parentBefore?.type === 'group' && parentAfter?.type === 'group') {
      const oldIndex = parentBefore.childIds.findIndex((id) => id === previousPrimaryNodeId || deleted.has(id))
      const nextSibling = parentAfter.childIds[Math.max(0, Math.min(oldIndex, parentAfter.childIds.length - 1))]
      if (nextSibling && after.nodes[nextSibling]) return nextSibling
      const previousSibling = parentAfter.childIds[Math.max(0, oldIndex - 1)]
      if (previousSibling && after.nodes[previousSibling]) return previousSibling
    }
    if (after.nodes[parentId]) return parentId
  }
  return after.nodes[after.rootNodeId] ? after.rootNodeId : null
}
