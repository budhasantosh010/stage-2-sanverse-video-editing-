import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { MotionGroupNodeV1 } from '@sanverse/motion-graph'
import { DEFAULT_KINETIC_HEADLINE_PROPS, DEFAULT_KINETIC_HEADLINE_STYLE, KineticHeadlineModule, MOTION_REFERENCE_COMPOSITIONS } from '@sanverse/motion-library'
import { SANVERSE_TICKS_PER_SECOND } from '@sanverse/motion-primitives'
import { OperationPlayground } from './OperationPlayground.tsx'

;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true

const context = {
  localTicks: SANVERSE_TICKS_PER_SECOND,
  durationTicks: SANVERSE_TICKS_PER_SECOND * 3,
  ticksPerSecond: SANVERSE_TICKS_PER_SECOND,
  composition: MOTION_REFERENCE_COMPOSITIONS['16:9'],
  reducedMotion: false,
} as const
const scene = KineticHeadlineModule.createScene(DEFAULT_KINETIC_HEADLINE_PROPS, DEFAULT_KINETIC_HEADLINE_STYLE, context)
const rootNode = scene.nodes[scene.rootNodeId] as MotionGroupNodeV1

const findButton = (container: HTMLElement, label: string): HTMLButtonElement => {
  const button = [...container.querySelectorAll('button')].find((candidate) => candidate.textContent?.trim() === label)
  if (!button) throw new Error(`Button not found: ${label}`)
  return button
}
const click = (container: HTMLElement, label: string): void => { findButton(container, label).dispatchEvent(new MouseEvent('click', { bubbles: true })) }

describe('C1 OperationPlayground', () => {
  let container: HTMLDivElement
  let root: ReturnType<typeof createRoot>

  beforeEach(() => {
    container = document.createElement('div')
    document.body.appendChild(container)
    root = createRoot(container)
  })

  afterEach(() => {
    act(() => root.unmount())
    container.remove()
  })

  it('emits add-child, duplicate, delete, effect and mask commands as MotionGraphOperationV1 objects', () => {
    const onOperation = vi.fn()
    const onSelectNode = vi.fn()

    act(() => root.render(<OperationPlayground scene={scene} selectedNodeId={scene.rootNodeId} onOperation={onOperation} onSelectNode={onSelectNode} />))
    expect(container.querySelector('[data-motion-operation-playground="true"]')).not.toBeNull()
    expect(findButton(container, 'Add child text').disabled).toBe(false)
    expect(findButton(container, 'Duplicate').disabled).toBe(true)
    act(() => click(container, 'Add child text'))
    expect(onOperation).toHaveBeenLastCalledWith(expect.objectContaining({ operationId: expect.any(String), type: 'add-node', parentId: scene.rootNodeId, node: expect.objectContaining({ type: 'text', text: { kind: 'constant', value: 'New text' } }) }))

    const selected = rootNode.childIds[0]!
    act(() => root.render(<OperationPlayground scene={scene} selectedNodeId={selected} onOperation={onOperation} onSelectNode={onSelectNode} />))
    act(() => click(container, 'Duplicate'))
    expect(onOperation).toHaveBeenLastCalledWith(expect.objectContaining({ operationId: expect.any(String), type: 'duplicate-node', nodeId: selected, duplicateId: expect.stringContaining('lab-copy-') }))

    act(() => click(container, 'Add Glow'))
    expect(onOperation).toHaveBeenLastCalledWith(expect.objectContaining({ type: 'add-effect', nodeId: selected, effect: expect.objectContaining({ effectType: 'glow' }) }))
    act(() => click(container, 'Add Blur'))
    expect(onOperation).toHaveBeenLastCalledWith(expect.objectContaining({ type: 'add-effect', nodeId: selected, effect: expect.objectContaining({ effectType: 'blur' }) }))
    act(() => click(container, 'Add Mask'))
    expect(onOperation).toHaveBeenLastCalledWith(expect.objectContaining({ type: 'add-mask', nodeId: selected, mask: expect.objectContaining({ type: 'rectangle' }) }))

    act(() => click(container, 'Delete'))
    expect(onOperation).toHaveBeenLastCalledWith(expect.objectContaining({ type: 'remove-node', nodeId: selected, mode: 'subtree' }))
    expect(onSelectNode).toHaveBeenCalledWith(null)
  })

  it('emits deterministic sibling reorder operations for Move Up and Move Down', () => {
    expect(rootNode.childIds.length).toBeGreaterThan(1)
    const onOperation = vi.fn()
    const onSelectNode = vi.fn()
    const firstId = rootNode.childIds[0]!
    const lastId = rootNode.childIds[rootNode.childIds.length - 1]!

    act(() => root.render(<OperationPlayground scene={scene} selectedNodeId={firstId} onOperation={onOperation} onSelectNode={onSelectNode} />))
    expect(findButton(container, 'Move Up').disabled).toBe(true)
    expect(findButton(container, 'Move Down').disabled).toBe(false)
    act(() => click(container, 'Move Down'))
    expect(onOperation).toHaveBeenLastCalledWith(expect.objectContaining({ type: 'reorder-node', nodeId: firstId, index: 1 }))

    act(() => root.render(<OperationPlayground scene={scene} selectedNodeId={lastId} onOperation={onOperation} onSelectNode={onSelectNode} />))
    expect(findButton(container, 'Move Up').disabled).toBe(false)
    expect(findButton(container, 'Move Down').disabled).toBe(true)
    act(() => click(container, 'Move Up'))
    expect(onOperation).toHaveBeenLastCalledWith(expect.objectContaining({ type: 'reorder-node', nodeId: lastId, index: rootNode.childIds.length - 2 }))
  })

  it('surfaces typed operation failures without inventing a second error system', () => {
    act(() => root.render(<OperationPlayground scene={scene} selectedNodeId={rootNode.childIds[0]!} onOperation={vi.fn()} onSelectNode={vi.fn()} errorMessage="PROPERTY_INVALID: unsupported property" />))
    expect(container.textContent).toContain('PROPERTY_INVALID: unsupported property')
  })
})
