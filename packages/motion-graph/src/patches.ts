import type { MotionNodeV1 } from './nodes.ts'
import type { MotionEffectInstanceV1 } from './effects.ts'
import type { MotionMaskInstanceV1 } from './masks.ts'
import type { Animatable, MotionNodePropertyPathV1, MotionPropertyPrimitiveV1 } from './properties.ts'
import { constant } from './properties.ts'
import type { MotionSceneV1 } from './scene.ts'
import { assertValidMotionScene } from './validation.ts'

export type MotionGraphPatchV1 =
  | Readonly<{ op: 'set-property'; target: MotionNodePropertyPathV1; value: Animatable<MotionPropertyPrimitiveV1> }>
  | Readonly<{ op: 'set-node-enabled'; nodeId: string; enabled: boolean }>
  | Readonly<{ op: 'add-node'; node: MotionNodeV1; parentId: string; index?: number }>
  | Readonly<{ op: 'remove-node'; nodeId: string }>
  | Readonly<{ op: 'rename-node'; nodeId: string; name: string }>
  | Readonly<{ op: 'reparent-node'; nodeId: string; parentId: string; index?: number }>
  | Readonly<{ op: 'reorder-node'; nodeId: string; index: number }>
  | Readonly<{ op: 'add-effect'; nodeId: string; effect: MotionEffectInstanceV1; index?: number }>
  | Readonly<{ op: 'remove-effect'; nodeId: string; effectId: string }>
  | Readonly<{ op: 'set-effect-enabled'; nodeId: string; effectId: string; enabled: boolean }>
  | Readonly<{ op: 'duplicate-effect'; nodeId: string; effectId: string; duplicateId: string; index?: number }>
  | Readonly<{ op: 'reorder-effect'; nodeId: string; effectId: string; index: number }>
  | Readonly<{ op: 'set-effect-property'; nodeId: string; effectId: string; parameter: string; value: Animatable<number | string> }>
  | Readonly<{ op: 'add-mask'; nodeId: string; mask: MotionMaskInstanceV1; index?: number }>
  | Readonly<{ op: 'remove-mask'; nodeId: string; maskId: string }>
  | Readonly<{ op: 'reorder-mask'; nodeId: string; maskId: string; index: number }>
  | Readonly<{ op: 'set-mask-property'; nodeId: string; maskId: string; property: 'enabled' | 'invert' | 'opacity' | 'feather' | 'expansion' | 'x' | 'y' | 'width' | 'height' | 'radius'; value: boolean | Animatable<number> }>
  | Readonly<{ op: 'set-blend-mode'; nodeId: string; blendMode: MotionNodeV1['blendMode'] }>

export interface DerivedMotionComponentV1 {
  readonly derivedId: string
  readonly base: Readonly<{ componentId: string; version: string; contentHash: string }>
  readonly patches: readonly MotionGraphPatchV1[]
}

const replaceChild = (node: MotionNodeV1, childIds: readonly string[]): MotionNodeV1 => node.type === 'group' ? Object.freeze({ ...node, childIds: Object.freeze(childIds) }) : node
const insertAt = <T>(values: readonly T[], value: T, index = values.length): readonly T[] => { const next = [...values]; next.splice(Math.max(0, Math.min(index, next.length)), 0, value); return Object.freeze(next) }

const semanticPartsWithAddedNode = (scene: MotionSceneV1, parentId: string, node: MotionNodeV1): MotionSceneV1['semanticParts'] => {
  const inherited = scene.semanticParts.filter((part) => part.nodeIds.includes(parentId))
  if (inherited.length === 0) {
    return Object.freeze([
      ...scene.semanticParts,
      Object.freeze({ id: `custom:${node.id}`, label: node.name, role: 'content-group' as const, nodeIds: Object.freeze([node.id]) }),
    ])
  }
  const inheritedIds = new Set(inherited.map((part) => part.id))
  return Object.freeze(scene.semanticParts.map((part) => inheritedIds.has(part.id)
    ? Object.freeze({ ...part, nodeIds: Object.freeze([...part.nodeIds, node.id]) })
    : part))
}

const pruneRemovedNodeReferences = (
  scene: MotionSceneV1,
  removedNodeIds: ReadonlySet<string>,
): Pick<MotionSceneV1, 'semanticParts' | 'exposures' | 'layout'> => {
  const semanticParts = Object.freeze(scene.semanticParts
    .map((part) => Object.freeze({ ...part, nodeIds: Object.freeze(part.nodeIds.filter((nodeId) => !removedNodeIds.has(nodeId))) }))
    .filter((part) => part.nodeIds.length > 0))
  const remainingPartIds = new Set(semanticParts.map((part) => part.id))
  const exposures = Object.freeze(scene.exposures.filter((exposure) => {
    const target = exposure.target
    if (target.kind === 'node' || target.kind === 'effect' || target.kind === 'mask') return !removedNodeIds.has(target.nodeId)
    if (target.kind === 'part') return remainingPartIds.has(target.semanticPartId)
    return true
  }))
  const layout = Object.freeze({
    ...scene.layout,
    ownership: Object.freeze(scene.layout.ownership.filter((entry) => !removedNodeIds.has(entry.target.nodeId))),
    formatOverrides: Object.freeze(scene.layout.formatOverrides.filter((entry) => !removedNodeIds.has(entry.target.nodeId))),
  })
  return { semanticParts, exposures, layout }
}

const setProperty = (node: MotionNodeV1, property: MotionNodePropertyPathV1['property'], value: Animatable<MotionPropertyPrimitiveV1>): MotionNodeV1 => {
  if (property === 'visible') return Object.freeze({ ...node, visible: value as Animatable<boolean> })
  if (property === 'opacity') return Object.freeze({ ...node, opacity: value as Animatable<number> })
  if (property.startsWith('transform.')) {
    const key = property.slice('transform.'.length) as keyof MotionNodeV1['transform']
    return Object.freeze({ ...node, transform: Object.freeze({ ...node.transform, [key]: value as Animatable<number> }) })
  }
  if (node.type === 'text') {
    if (property === 'text.text') return Object.freeze({ ...node, text: value as Animatable<string> })
    if (property === 'text.fillColor') return Object.freeze({ ...node, fillColor: value as Animatable<string> })
    if (property === 'text.fontSize') return Object.freeze({ ...node, fontSize: value as Animatable<number> })
    if (property === 'text.fontWeight') return Object.freeze({ ...node, fontWeight: value as Animatable<number> })
  }
  if (node.type === 'shape') {
    if (property === 'shape.width') return Object.freeze({ ...node, width: value as Animatable<number> })
    if (property === 'shape.height') return Object.freeze({ ...node, height: value as Animatable<number> })
    if (property === 'shape.fillColor') return Object.freeze({ ...node, fillColor: value as Animatable<string> })
    if (property === 'shape.strokeColor') return Object.freeze({ ...node, strokeColor: value as Animatable<string> })
    if (property === 'shape.strokeWidth') return Object.freeze({ ...node, strokeWidth: value as Animatable<number> })
    if (property === 'shape.radius') return Object.freeze({ ...node, radius: value as Animatable<number> })
  }
  if (node.type === 'path') {
    if (property === 'path.fillColor') return Object.freeze({ ...node, fillColor: value as Animatable<string> })
    if (property === 'path.strokeColor') return Object.freeze({ ...node, strokeColor: value as Animatable<string> })
    if (property === 'path.strokeWidth') return Object.freeze({ ...node, strokeWidth: value as Animatable<number> })
    if (property === 'path.trimProgress') return Object.freeze({ ...node, trimProgress: value as Animatable<number> })
  }
  if (node.type === 'image') {
    if (property === 'image.width') return Object.freeze({ ...node, width: value as Animatable<number> })
    if (property === 'image.height') return Object.freeze({ ...node, height: value as Animatable<number> })
    if (property === 'image.opacity') return Object.freeze({ ...node, imageOpacity: value as Animatable<number> })
  }
  throw new RangeError(`Property ${property} is not supported by node ${node.id}.`)
}

export const applyMotionGraphPatch = (scene: MotionSceneV1, patch: MotionGraphPatchV1): MotionSceneV1 => {
  const nodes: Record<string, MotionNodeV1> = { ...scene.nodes }
  let semanticParts = scene.semanticParts
  let exposures = scene.exposures
  let layout = scene.layout
  const requireNode = (id: string): MotionNodeV1 => { const node = nodes[id]; if (!node) throw new RangeError(`Unknown node: ${id}`); return node }
  if (patch.op === 'set-property') nodes[patch.target.nodeId] = setProperty(requireNode(patch.target.nodeId), patch.target.property, patch.value)
  else if (patch.op === 'set-node-enabled') { const node = requireNode(patch.nodeId); nodes[patch.nodeId] = Object.freeze({ ...node, enabled: patch.enabled }) }
  else if (patch.op === 'set-blend-mode') nodes[patch.nodeId] = Object.freeze({ ...requireNode(patch.nodeId), blendMode: patch.blendMode })
  else if (patch.op === 'add-effect') { const node = requireNode(patch.nodeId); nodes[patch.nodeId] = Object.freeze({ ...node, effects: insertAt(node.effects, patch.effect, patch.index) }) }
  else if (patch.op === 'remove-effect') { const node = requireNode(patch.nodeId); nodes[patch.nodeId] = Object.freeze({ ...node, effects: Object.freeze(node.effects.filter((effect) => effect.id !== patch.effectId)) }) }
  else if (patch.op === 'set-effect-enabled') { const node = requireNode(patch.nodeId); let found = false; const effects = node.effects.map((effect) => effect.id === patch.effectId ? (found = true, Object.freeze({ ...effect, enabled: patch.enabled })) : effect); if (!found) throw new RangeError(`Unknown effect: ${patch.effectId}`); nodes[patch.nodeId] = Object.freeze({ ...node, effects: Object.freeze(effects) }) }
  else if (patch.op === 'duplicate-effect') { const node = requireNode(patch.nodeId); const effect = node.effects.find((candidate) => candidate.id === patch.effectId); if (!effect) throw new RangeError(`Unknown effect: ${patch.effectId}`); if (node.effects.some((candidate) => candidate.id === patch.duplicateId)) throw new RangeError(`Effect already exists: ${patch.duplicateId}`); const duplicate = Object.freeze({ ...effect, id: patch.duplicateId, parameters: Object.freeze({ ...effect.parameters }) }); nodes[patch.nodeId] = Object.freeze({ ...node, effects: insertAt(node.effects, duplicate, patch.index ?? node.effects.indexOf(effect) + 1) }) }
  else if (patch.op === 'reorder-effect') { const node = requireNode(patch.nodeId); const effect = node.effects.find((candidate) => candidate.id === patch.effectId); if (!effect) throw new RangeError(`Unknown effect: ${patch.effectId}`); nodes[patch.nodeId] = Object.freeze({ ...node, effects: insertAt(node.effects.filter((candidate) => candidate.id !== patch.effectId), effect, patch.index) }) }
  else if (patch.op === 'set-effect-property') { const node = requireNode(patch.nodeId); let found = false; const effects = node.effects.map((effect) => effect.id === patch.effectId ? (found = true, Object.freeze({ ...effect, parameters: Object.freeze({ ...effect.parameters, [patch.parameter]: patch.value }) })) : effect); if (!found) throw new RangeError(`Unknown effect: ${patch.effectId}`); nodes[patch.nodeId] = Object.freeze({ ...node, effects: Object.freeze(effects) }) }
  else if (patch.op === 'add-mask') { const node = requireNode(patch.nodeId); nodes[patch.nodeId] = Object.freeze({ ...node, masks: insertAt(node.masks, patch.mask, patch.index) }) }
  else if (patch.op === 'remove-mask') { const node = requireNode(patch.nodeId); nodes[patch.nodeId] = Object.freeze({ ...node, masks: Object.freeze(node.masks.filter((mask) => mask.id !== patch.maskId)) }) }
  else if (patch.op === 'reorder-mask') { const node = requireNode(patch.nodeId); const mask = node.masks.find((candidate) => candidate.id === patch.maskId); if (!mask) throw new RangeError(`Unknown mask: ${patch.maskId}`); nodes[patch.nodeId] = Object.freeze({ ...node, masks: insertAt(node.masks.filter((candidate) => candidate.id !== patch.maskId), mask, patch.index) }) }
  else if (patch.op === 'set-mask-property') {
    const node = requireNode(patch.nodeId)
    let found = false
    const masks = node.masks.map((mask) => {
      if (mask.id !== patch.maskId) return mask
      found = true
      if (patch.property === 'enabled' || patch.property === 'invert') return Object.freeze({ ...mask, [patch.property]: patch.value as boolean })
      return Object.freeze({ ...mask, [patch.property]: patch.value as Animatable<number> })
    })
    if (!found) throw new RangeError(`Unknown mask: ${patch.maskId}`)
    nodes[patch.nodeId] = Object.freeze({ ...node, masks: Object.freeze(masks) })
  }
  else if (patch.op === 'rename-node') { const node = requireNode(patch.nodeId); nodes[patch.nodeId] = Object.freeze({ ...node, name: patch.name }) }
  else if (patch.op === 'add-node') { if (nodes[patch.node.id]) throw new RangeError(`Node already exists: ${patch.node.id}`); const parent = requireNode(patch.parentId); if (parent.type !== 'group') throw new RangeError('New node parent must be a group.'); const addedNode = Object.freeze({ ...patch.node, parentId: patch.parentId }) as MotionNodeV1; nodes[patch.node.id] = addedNode; nodes[parent.id] = replaceChild(parent, insertAt(parent.childIds, patch.node.id, patch.index)); semanticParts = semanticPartsWithAddedNode(scene, parent.id, addedNode) }
  else if (patch.op === 'remove-node') { if (patch.nodeId === scene.rootNodeId) throw new RangeError('Cannot remove the scene root.'); const node = requireNode(patch.nodeId); const descendants = new Set<string>([node.id]); let changed = true; while (changed) { changed = false; for (const candidate of Object.values(nodes)) if (candidate.parentId && descendants.has(candidate.parentId) && !descendants.has(candidate.id)) { descendants.add(candidate.id); changed = true } } for (const id of descendants) delete nodes[id]; if (node.parentId) { const parent = requireNode(node.parentId); nodes[parent.id] = replaceChild(parent, parent.type === 'group' ? parent.childIds.filter((id) => !descendants.has(id)) : []) } const reconciled = pruneRemovedNodeReferences(scene, descendants); semanticParts = reconciled.semanticParts; exposures = reconciled.exposures; layout = reconciled.layout }
  else if (patch.op === 'reparent-node') { if (patch.nodeId === scene.rootNodeId) throw new RangeError('Cannot reparent root.'); const node = requireNode(patch.nodeId); const nextParent = requireNode(patch.parentId); if (nextParent.type !== 'group') throw new RangeError('New parent must be a group.'); if (node.parentId) { const oldParent = requireNode(node.parentId); if (oldParent.type === 'group') nodes[oldParent.id] = replaceChild(oldParent, oldParent.childIds.filter((id) => id !== node.id)) } nodes[node.id] = Object.freeze({ ...node, parentId: nextParent.id }); nodes[nextParent.id] = replaceChild(nextParent, insertAt(nextParent.childIds.filter((id) => id !== node.id), node.id, patch.index)) }
  else { const node = requireNode(patch.nodeId); if (!node.parentId) throw new RangeError('Root cannot be reordered.'); const parent = requireNode(node.parentId); if (parent.type !== 'group') throw new RangeError('Parent must be a group.'); nodes[parent.id] = replaceChild(parent, insertAt(parent.childIds.filter((id) => id !== node.id), node.id, patch.index)) }
  return assertValidMotionScene(Object.freeze({ ...scene, nodes: Object.freeze(nodes), semanticParts, exposures, layout }))
}
export const applyMotionGraphPatches = (scene: MotionSceneV1, patches: readonly MotionGraphPatchV1[]): MotionSceneV1 => patches.reduce(applyMotionGraphPatch, scene)
export const constantPropertyPatch = (target: MotionNodePropertyPathV1, value: MotionPropertyPrimitiveV1): MotionGraphPatchV1 => ({ op: 'set-property', target, value: constant(value) })
