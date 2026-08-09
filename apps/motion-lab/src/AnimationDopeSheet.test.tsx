import { act, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  applyMotionOperations,
  constant,
  createMotionScene,
  keyframed,
  motionNumber,
  nodeBase,
} from '@sanverse/motion-graph'
import type { MotionGraphOperationV1, MotionSceneV1 } from '@sanverse/motion-graph'
import type { MotionCompositionV1 } from '@sanverse/motion-contract'
import { AnimationDopeSheet } from './AnimationDopeSheet.tsx'

;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true

const composition: MotionCompositionV1 = Object.freeze({ width: 1920, height: 1080, fpsNumerator: 30, fpsDenominator: 1 })
const durationTicks = 240000

const makeScene = (): MotionSceneV1 => {
  const root = Object.freeze({ ...nodeBase('root', 'Root', null), type: 'group' as const, childIds: Object.freeze(['value']) })
  const base = nodeBase('value', 'Value', 'root')
  const value = Object.freeze({
    ...base,
    type: 'shape' as const,
    shape: 'rounded-rectangle' as const,
    opacity: motionNumber({ kind: 'interpolation', from: 0, to: 1, start: 0, end: 1, easing: 'linear' }),
    transform: Object.freeze({
      ...base.transform,
      positionX: keyframed([
        { id: 'x0', tick: 0, value: 0, interpolation: 'hold' },
        { id: 'x1', tick: 48000, value: 100, interpolation: 'linear' },
        { id: 'x2', tick: 96000, value: 200, interpolation: 'bezier', bezier: { inX: .7, inY: 1, outX: .2, outY: .8 } },
      ]),
      positionY: keyframed([
        { id: 'y0', tick: 0, value: 0, interpolation: 'linear' },
        { id: 'y1', tick: 96000, value: 80, interpolation: 'linear' },
      ]),
    }),
    width: constant(400), height: constant(240), fillColor: constant('#fff'), strokeColor: constant('#000'), strokeWidth: constant(0), radius: constant(24),
  })
  return createMotionScene({ componentId: 'sanverse.c4-ui-test', componentVersion: 1, rootNodeId: 'root', nodes: Object.freeze({ root, value }), semanticParts: Object.freeze([]), exposures: Object.freeze([]), layout: Object.freeze({ mode: 'responsive' as const, ownership: Object.freeze([]), formatOverrides: Object.freeze([]) }), supportedAspectRatios: Object.freeze(['16:9'] as const) })
}

const click = (element: Element) => element.dispatchEvent(new MouseEvent('click', { bubbles: true }))
const pointerDown = (element: Element, options: MouseEventInit = {}) => element.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true, clientX: 100, ...options }))
const pointerUp = () => window.dispatchEvent(new MouseEvent('pointerup', { bubbles: true, clientX: 100 }))

const setValue = (element: HTMLInputElement | HTMLSelectElement, value: string) => {
  const proto = element instanceof HTMLSelectElement ? HTMLSelectElement.prototype : HTMLInputElement.prototype
  Object.getOwnPropertyDescriptor(proto, 'value')?.set?.call(element, value)
  element.dispatchEvent(new Event('input', { bubbles: true }))
  element.dispatchEvent(new Event('change', { bubbles: true }))
}

function Harness({ batchLog, nodeSpy }: { batchLog: number[]; nodeSpy: ReturnType<typeof vi.fn> }) {
  const [scene, setScene] = useState(makeScene)
  const [tick, setTick] = useState(72000)
  const [selectedNode, setSelectedNode] = useState<string | null>('value')
  let operationCounter = 0
  return <AnimationDopeSheet
    scene={scene}
    selectedNodeId={selectedNode}
    localTicks={tick}
    durationTicks={durationTicks}
    composition={composition}
    events={[{ name: 'enter-start', normalizedTime: 0 }, { name: 'settled', normalizedTime: .6 }, { name: 'exit-start', normalizedTime: .9 }]}
    canUndo
    canRedo
    onSeek={setTick}
    onSelectNode={(nodeId) => { setSelectedNode(nodeId); nodeSpy(nodeId) }}
    onOperations={(operations: readonly MotionGraphOperationV1[]) => {
      batchLog.push(operations.length)
      const result = applyMotionOperations(scene, operations, { durationTicks })
      if (!result.ok) return false
      setScene(result.scene)
      return true
    }}
    nextOperationId={(prefix) => `${prefix}:${operationCounter++}`}
    onUndo={() => {}}
    onRedo={() => {}}
  />
}

describe('MOTION-C4 Animation Dope Sheet', () => {
  let container: HTMLDivElement
  let root: ReturnType<typeof createRoot>
  let batchLog: number[]
  let nodeSpy: ReturnType<typeof vi.fn>

  beforeEach(() => {
    batchLog = []
    nodeSpy = vi.fn()
    container = document.createElement('div')
    document.body.appendChild(container)
    root = createRoot(container)
    act(() => root.render(<Harness batchLog={batchLog} nodeSpy={nodeSpy} />))
  })

  afterEach(() => {
    act(() => root.unmount())
    container.remove()
  })

  it('projects real C2 tracks, distinguishes authored drivers and displays motion-event markers', () => {
    expect(container.querySelector('[data-c4-dope-sheet="true"]')).not.toBeNull()
    expect(container.textContent).toContain('3 tracks · 5 keys · C2 authority')
    expect(container.textContent).toContain('AUTHORED MOTION DRIVER')
    expect(container.textContent).toContain('enter-start')
    expect(container.textContent).toContain('settled')
    expect(container.textContent).toContain('exit-start')
  })

  it('selecting a C4 track synchronizes the owning C3 node ID', () => {
    const track = container.querySelector('[data-c4-track="node:value:transform.positionX"] .c4-dope-sheet__track-label')!
    act(() => { click(track) })
    expect(nodeSpy).toHaveBeenLastCalledWith('value')
    expect(container.querySelector('[data-c4-track="node:value:transform.positionX"]')?.className).toContain('is-selected')
  })

  it('supports Ctrl multi-select and frame nudge as one atomic batch', () => {
    const keys = [...container.querySelectorAll<HTMLButtonElement>('[data-c4-track="node:value:transform.positionX"] .c4-dope-sheet__key')]
    act(() => { pointerDown(keys[1]!); pointerUp() })
    act(() => { pointerDown(keys[2]!, { ctrlKey: true }); pointerUp() })
    expect(container.textContent).toContain('2 selected')
    const nudge = [...container.querySelectorAll('button')].find((button) => button.textContent === '1f →')!
    act(() => { click(nudge) })
    expect(batchLog.at(-1)).toBe(2)
    const selectedTicks = [...container.querySelectorAll<HTMLButtonElement>('[data-c4-track="node:value:transform.positionX"] .c4-dope-sheet__key.is-selected')].map((button) => button.title)
    expect(selectedTicks.some((title) => title.includes('96000'))).toBe(true)
    expect(selectedTicks.some((title) => title.includes('144000'))).toBe(true)
  })

  it('adds a C2 keyframe at the shared playhead and deletes it through typed operations', () => {
    const track = container.querySelector('[data-c4-track="node:value:transform.positionX"] .c4-dope-sheet__track-label')!
    act(() => click(track))
    const add = [...container.querySelectorAll<HTMLButtonElement>('.c4-dope-sheet__toolbar button')].find((button) => button.textContent === '+ Key')!
    expect(add.disabled).toBe(false)
    act(() => click(add))
    expect(container.textContent).toContain('3 tracks · 6 keys · C2 authority')
    expect(batchLog.at(-1)).toBe(1)
    const remove = [...container.querySelectorAll<HTMLButtonElement>('.c4-dope-sheet__toolbar button')].find((button) => button.textContent === 'Delete keys')!
    expect(remove.disabled).toBe(false)
    act(() => click(remove))
    expect(container.textContent).toContain('3 tracks · 5 keys · C2 authority')
    expect(batchLog.at(-1)).toBe(1)
  })

  it('edits tick, value and interpolation from the keyframe inspector', () => {
    const key = [...container.querySelectorAll<HTMLButtonElement>('[data-c4-track="node:value:transform.positionX"] .c4-dope-sheet__key')][1]!
    act(() => { pointerDown(key); pointerUp() })
    const tick = container.querySelector<HTMLInputElement>('[aria-label="C4 selected keyframe tick"]')!
    const value = container.querySelector<HTMLInputElement>('[aria-label="C4 selected keyframe value"]')!
    const interpolation = container.querySelector<HTMLSelectElement>('[aria-label="C4 selected keyframe interpolation"]')!
    act(() => setValue(tick, '72000'))
    act(() => setValue(value, '125'))
    act(() => setValue(interpolation, 'bezier'))
    expect(container.querySelector<HTMLInputElement>('[aria-label="C4 selected keyframe tick"]')?.value).toBe('72000')
    expect(container.querySelector<HTMLInputElement>('[aria-label="C4 selected keyframe value"]')?.value).toBe('125')
    expect(container.querySelector<HTMLSelectElement>('[aria-label="C4 selected keyframe interpolation"]')?.value).toBe('bezier')
    expect(container.querySelector('[aria-label="C4 inX"]')).not.toBeNull()
  })

  it('switches ruler units and performs horizontal zoom/pan/fit without browser-page scaling', () => {
    const frameButton = [...container.querySelectorAll<HTMLButtonElement>('.c4-dope-sheet__segmented button')].find((button) => button.textContent === 'frames')!
    act(() => click(frameButton))
    expect(frameButton.getAttribute('aria-pressed')).toBe('true')
    const plus = [...container.querySelectorAll<HTMLButtonElement>('.c4-dope-sheet__toolbar button')].find((button) => button.textContent === '+')!
    act(() => click(plus))
    expect(container.textContent).toContain('1.50×')
    const pan = container.querySelector<HTMLInputElement>('[aria-label="C4 timeline pan"]')!
    expect(Number(pan.max)).toBeGreaterThan(0)
    act(() => setValue(pan, '48000'))
    expect(container.querySelector<HTMLInputElement>('[aria-label="C4 timeline pan"]')?.value).toBe('48000')
    const fit = [...container.querySelectorAll<HTMLButtonElement>('.c4-dope-sheet__toolbar button')].find((button) => button.textContent === 'Fit')!
    act(() => click(fit))
    expect(container.textContent).toContain('1.00×')
    expect(container.querySelector<HTMLInputElement>('[aria-label="C4 timeline pan"]')?.value).toBe('0')
  })
})
