import { useRef } from 'react'
import {
  constant,
  createDefaultEffect,
  createDefaultMask,
  nodeBase,
} from '@sanverse/motion-graph'
import type { MotionGraphOperationV1, MotionGroupNodeV1, MotionSceneV1, MotionTextNodeV1 } from '@sanverse/motion-graph'

interface OperationPlaygroundProps {
  readonly scene: MotionSceneV1 | null
  readonly selectedNodeId: string | null
  readonly onOperation: (operation: MotionGraphOperationV1) => void
  readonly onSelectNode: (nodeId: string | null) => void
  readonly errorMessage?: string | null
}

const slug = (value: string): string => value.toLowerCase().replace(/[^a-z0-9]+/gu, '-').replace(/^-|-$/gu, '') || 'node'

export function OperationPlayground({ scene, selectedNodeId, onOperation, onSelectNode, errorMessage = null }: OperationPlaygroundProps) {
  const operationCounter = useRef(1)
  const contentCounter = useRef(1)
  const nextOperationId = (kind: string): string => `lab-playground:${kind}:${operationCounter.current++}`
  const selected = selectedNodeId && scene ? scene.nodes[selectedNodeId] ?? null : null
  const parent = selected?.parentId && scene?.nodes[selected.parentId]?.type === 'group' ? scene.nodes[selected.parentId] as MotionGroupNodeV1 : null
  const siblingIndex = selected && parent ? parent.childIds.indexOf(selected.id) : -1
  const isRoot = selected?.id === scene?.rootNodeId

  const emit = (operation: MotionGraphOperationV1): void => onOperation(Object.freeze(operation))

  const addChildText = (): void => {
    if (!selected || selected.type !== 'group') return
    const count = contentCounter.current++
    const nodeId = `lab-text-${slug(selected.id)}-${count}`
    const node: MotionTextNodeV1 = Object.freeze({
      ...nodeBase(nodeId, `Lab Text ${count}`, selected.id),
      type: 'text',
      text: constant('New text'),
      fillColor: constant('#ffffff'),
      fontFamily: 'Inter, ui-sans-serif, system-ui, sans-serif',
      fontSize: constant(48),
      fontWeight: constant(700),
      textAlign: 'left',
    })
    emit({ operationId: nextOperationId('add-child-text'), type: 'add-node', node, parentId: selected.id })
  }

  const duplicate = (): void => {
    if (!selected || isRoot || !selected.parentId) return
    const count = contentCounter.current++
    emit({ operationId: nextOperationId('duplicate'), type: 'duplicate-node', nodeId: selected.id, duplicateId: `lab-copy-${slug(selected.id)}-${count}` })
  }

  const remove = (): void => {
    if (!selected || isRoot) return
    emit({ operationId: nextOperationId('delete'), type: 'remove-node', nodeId: selected.id, mode: 'subtree' })
    onSelectNode(null)
  }

  const addEffect = (effectType: 'glow' | 'blur'): void => {
    if (!selected) return
    const count = contentCounter.current++
    emit({ operationId: nextOperationId(`add-${effectType}`), type: 'add-effect', nodeId: selected.id, effect: createDefaultEffect(`lab-playground-${effectType}-${count}`, effectType) })
  }

  const addMask = (): void => {
    if (!selected) return
    const count = contentCounter.current++
    emit({ operationId: nextOperationId('add-mask'), type: 'add-mask', nodeId: selected.id, mask: createDefaultMask(`lab-playground-mask-${count}`, 'rectangle') })
  }

  const move = (offset: -1 | 1): void => {
    if (!selected || !parent || siblingIndex < 0) return
    const nextIndex = siblingIndex + offset
    if (nextIndex < 0 || nextIndex >= parent.childIds.length) return
    emit({ operationId: nextOperationId(offset < 0 ? 'move-up' : 'move-down'), type: 'reorder-node', nodeId: selected.id, index: nextIndex })
  }

  return (
    <section className="motion-lab__inspector-section motion-lab__operation-playground" data-motion-operation-playground="true">
      <h2>Operation playground</h2>
      <small>Developer-only C1 proof. Every button emits a typed Motion Graph operation.</small>
      {selected ? (
        <>
          <div className="motion-lab__node-summary"><strong>{selected.name}</strong><span>{selected.id}</span><small>{selected.type}</small></div>
          <div className="motion-lab__operation-grid">
            <button type="button" disabled={selected.type !== 'group'} onClick={addChildText}>Add child text</button>
            <button type="button" disabled={Boolean(isRoot)} onClick={duplicate}>Duplicate</button>
            <button type="button" disabled={Boolean(isRoot)} onClick={remove}>Delete</button>
            <button type="button" onClick={() => addEffect('glow')}>Add Glow</button>
            <button type="button" onClick={() => addEffect('blur')}>Add Blur</button>
            <button type="button" onClick={addMask}>Add Mask</button>
            <button type="button" disabled={!parent || siblingIndex <= 0} onClick={() => move(-1)}>Move Up</button>
            <button type="button" disabled={!parent || siblingIndex < 0 || siblingIndex >= parent.childIds.length - 1} onClick={() => move(1)}>Move Down</button>
          </div>
        </>
      ) : <small>Select a layer or semantic part first.</small>}
      {errorMessage ? <div className="motion-lab__operation-error" role="status">{errorMessage}</div> : null}
    </section>
  )
}
