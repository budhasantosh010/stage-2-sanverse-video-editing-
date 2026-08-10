import { act, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  applyMotionOperations,
  constant,
  createMotionKeyframeSelection,
  createMotionScene,
  keyframed,
  motionNumber,
  nodeBase,
  selectMotionKeyframe,
} from '@sanverse/motion-graph'
import type { MotionGraphOperationV1, MotionKeyframeSelectionStateV1, MotionSceneV1 } from '@sanverse/motion-graph'
import type { MotionCompositionV1 } from '@sanverse/motion-contract'
import { AnimationDopeSheet } from './AnimationDopeSheet.tsx'
import { MotionCurveEditor } from './MotionCurveEditor.tsx'

;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true

const composition: MotionCompositionV1 = Object.freeze({ width: 1920, height: 1080, fpsNumerator: 30, fpsDenominator: 1 })
const durationTicks = 240000
const xTrackId = 'node:value:transform.positionX'

const makeScene = (): MotionSceneV1 => {
  const root = Object.freeze({ ...nodeBase('root', 'Root', null), type: 'group' as const, childIds: Object.freeze(['value']) })
  const base = nodeBase('value', 'Value', 'root')
  const value = Object.freeze({
    ...base,
    type: 'shape' as const,
    shape: 'rounded-rectangle' as const,
    opacity: keyframed([
      { id: 'o0', tick: 0, value: 0, interpolation: 'linear' as const },
      { id: 'o1', tick: 96000, value: 1, interpolation: 'linear' as const },
    ]),
    transform: Object.freeze({
      ...base.transform,
      positionX: keyframed([
        { id: 'x0', tick: 0, value: 0, interpolation: 'bezier' as const, bezier: { inX: .67, inY: .67, outX: .25, outY: .12 } },
        { id: 'x1', tick: 96000, value: 180, interpolation: 'bezier' as const, bezier: { inX: .72, inY: .92, outX: .25, outY: .12 } },
        { id: 'x2', tick: 192000, value: 40, interpolation: 'linear' as const, bezier: { inX: .72, inY: .92, outX: .33, outY: .33 } },
      ]),
      rotationDeg: motionNumber({ kind: 'interpolation', from: 0, to: 20, start: 0, end: 1, easing: 'linear' }),
    }),
    width: constant(400), height: constant(240), fillColor: constant('#fff'), strokeColor: constant('#000'), strokeWidth: constant(0), radius: constant(24),
  })
  return createMotionScene({ componentId: 'sanverse.c5-ui-test', componentVersion: 1, rootNodeId: 'root', nodes: Object.freeze({ root, value }), semanticParts: Object.freeze([]), exposures: Object.freeze([]), layout: Object.freeze({ mode: 'responsive' as const, ownership: Object.freeze([]), formatOverrides: Object.freeze([]) }), supportedAspectRatios: Object.freeze(['16:9'] as const) })
}

const click = (element: Element) => element.dispatchEvent(new MouseEvent('click', { bubbles: true }))
const pointer = (target: EventTarget, type: string, clientX: number, clientY: number, options: MouseEventInit = {}) => target.dispatchEvent(new MouseEvent(type, { bubbles: true, clientX, clientY, ...options }))
const keydown = (key: string) => window.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, key }))
const setValue = (element: HTMLInputElement | HTMLSelectElement, value: string) => {
  const proto = element instanceof HTMLSelectElement ? HTMLSelectElement.prototype : HTMLInputElement.prototype
  Object.getOwnPropertyDescriptor(proto, 'value')?.set?.call(element, value)
  element.dispatchEvent(new Event('input', { bubbles: true }))
  element.dispatchEvent(new Event('change', { bubbles: true }))
}

function CurveHarness({ batchLog, operationSpy }: { batchLog: number[]; operationSpy: ReturnType<typeof vi.fn> }) {
  const [scene, setScene] = useState(makeScene)
  const [tick, setTick] = useState(96000)
  const [selection, setSelection] = useState<MotionKeyframeSelectionStateV1>(() => selectMotionKeyframe(`${xTrackId}::x1`))
  const [trackId, setTrackId] = useState<string | null>(xTrackId)
  let operationCounter = 0
  return <MotionCurveEditor
    scene={scene}
    selectedNodeId="value"
    localTicks={tick}
    durationTicks={durationTicks}
    selection={selection}
    selectedTrackId={trackId}
    canUndo
    canRedo
    onSeek={setTick}
    onSelectNode={() => {}}
    onSelectionChange={setSelection}
    onTrackChange={setTrackId}
    onOperations={(operations) => {
      batchLog.push(operations.length)
      operationSpy(operations)
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

function SharedHarness() {
  const [scene, setScene] = useState(makeScene)
  const [tick, setTick] = useState(96000)
  const [selection, setSelection] = useState<MotionKeyframeSelectionStateV1>(() => createMotionKeyframeSelection())
  const [trackId, setTrackId] = useState<string | null>(xTrackId)
  const [nodeId, setNodeId] = useState<string | null>('value')
  let operationCounter = 0
  const operations = (ops: readonly MotionGraphOperationV1[]) => {
    const result = applyMotionOperations(scene, ops, { durationTicks }); if (!result.ok) return false; setScene(result.scene); return true
  }
  const common = { scene, selectedNodeId: nodeId, localTicks: tick, durationTicks, canUndo: false, canRedo: false, onSeek: setTick, onSelectNode: setNodeId, onOperations: operations, nextOperationId: (prefix: string) => `${prefix}:${operationCounter++}`, onUndo: () => {}, onRedo: () => {} }
  return <div>
    <AnimationDopeSheet {...common} composition={composition} events={[]} sharedSelection={selection} onSharedSelectionChange={setSelection} sharedTrackId={trackId} onSharedTrackChange={setTrackId} />
    <MotionCurveEditor {...common} selection={selection} selectedTrackId={trackId} onSelectionChange={setSelection} onTrackChange={setTrackId} />
  </div>
}

describe('MOTION-C5 Value Graph', () => {
  let container: HTMLDivElement
  let root: ReturnType<typeof createRoot>
  let batchLog: number[]
  let operationSpy: ReturnType<typeof vi.fn>

  beforeEach(() => {
    batchLog = []; operationSpy = vi.fn()
    container = document.createElement('div'); document.body.appendChild(container); root = createRoot(container)
    act(() => root.render(<CurveHarness batchLog={batchLog} operationSpy={operationSpy} />))
  })
  afterEach(() => { act(() => root.unmount()); container.remove() })

  it('renders the exact numeric value graph, playhead, selected keyframe and Bezier handles', () => {
    expect(container.querySelector('[data-c5-curve-editor="true"]')).not.toBeNull()
    expect(container.querySelector(`[data-c5-path="${xTrackId}"]`)?.getAttribute('d')).toContain(' C ')
    expect(container.querySelector('[data-c5-key="x1"]')?.classList.contains('is-selected')).toBe(true)
    expect(container.querySelector('[data-c5-handle="incoming"]')).not.toBeNull()
    expect(container.querySelector('[data-c5-handle="outgoing"]')).not.toBeNull()
    expect(container.textContent).toContain('same C2 authority')
  })

  it('applies Snappy through one C5 user transaction containing real C2 operations', () => {
    const button = [...container.querySelectorAll<HTMLButtonElement>('.c5-curve-editor__presets button')].find((entry) => entry.textContent === 'snappy')!
    act(() => click(button))
    expect(batchLog).toHaveLength(1)
    expect(batchLog[0]).toBe(3)
    const operations = operationSpy.mock.calls[0]?.[0] as readonly MotionGraphOperationV1[]
    expect(operations.map((operation) => operation.type)).toEqual(['set-keyframe-interpolation', 'set-keyframe-bezier', 'set-keyframe-bezier'])
    expect(container.querySelector<HTMLSelectElement>('[aria-label="C5 selected interpolation"]')?.value).toBe('bezier')
  })

  it('edits time/value/interpolation through typed operations and keeps the same keyframe ID', () => {
    act(() => setValue(container.querySelector<HTMLInputElement>('[aria-label="C5 selected keyframe tick"]')!, '120000'))
    act(() => setValue(container.querySelector<HTMLInputElement>('[aria-label="C5 selected keyframe value"]')!, '240'))
    act(() => setValue(container.querySelector<HTMLSelectElement>('[aria-label="C5 selected interpolation"]')!, 'linear'))
    expect(container.querySelector('[data-c5-key="x1"]')).not.toBeNull()
    expect(operationSpy.mock.calls.flatMap((call) => (call[0] as readonly MotionGraphOperationV1[]).map((operation) => operation.type))).toEqual(expect.arrayContaining(['move-keyframe', 'set-keyframe-value', 'set-keyframe-interpolation']))
  })

  it('shows motion-driver tracks as read-only rather than pretending they are Bezier keyframes', () => {
    const driver = [...container.querySelectorAll<HTMLButtonElement>('.c5-curve-editor__tracks button')].find((entry) => entry.textContent?.includes('rotationDeg'))!
    act(() => click(driver))
    expect(container.textContent).toContain('Convert/bake is required before curve editing.')
    expect(container.querySelector('[aria-label="C5 selected keyframe value"]')).toBeNull()
  })

  it('handle drag previews transiently and commits exactly one operation on release', () => {
    const svg = container.querySelector<SVGSVGElement>('[aria-label="C5 Value Graph"]')!
    vi.spyOn(svg, 'getBoundingClientRect').mockReturnValue({ x: 0, y: 0, left: 0, top: 0, right: 1000, bottom: 330, width: 1000, height: 330, toJSON: () => ({}) } as DOMRect)
    const handle = container.querySelector<SVGCircleElement>('[data-c5-handle="outgoing"]')!
    act(() => pointer(handle, 'pointerdown', 600, 180))
    act(() => pointer(window, 'pointermove', 700, 120))
    expect(batchLog).toHaveLength(0)
    act(() => pointer(window, 'pointerup', 700, 120))
    expect(batchLog).toEqual([1])
    expect((operationSpy.mock.calls[0]?.[0] as readonly MotionGraphOperationV1[])[0]?.type).toBe('set-keyframe-bezier')
  })

  it('Escape cancels a handle drag without a history transaction', () => {
    const svg = container.querySelector<SVGSVGElement>('[aria-label="C5 Value Graph"]')!
    vi.spyOn(svg, 'getBoundingClientRect').mockReturnValue({ x: 0, y: 0, left: 0, top: 0, right: 1000, bottom: 330, width: 1000, height: 330, toJSON: () => ({}) } as DOMRect)
    const handle = container.querySelector<SVGCircleElement>('[data-c5-handle="outgoing"]')!
    act(() => pointer(handle, 'pointerdown', 600, 180))
    act(() => pointer(window, 'pointermove', 650, 100))
    act(() => keydown('Escape'))
    act(() => pointer(window, 'pointerup', 650, 100))
    expect(batchLog).toEqual([])
  })

  it('supports Fit Track, Fit Selection and bounded time/value zoom-pan controls', () => {
    const buttons = [...container.querySelectorAll<HTMLButtonElement>('.c5-curve-editor__toolbar button')]
    act(() => click(buttons.find((entry) => entry.textContent === 'Time +')!))
    expect(container.textContent).toContain('1.50×')
    const pan = container.querySelector<HTMLInputElement>('[aria-label="C5 horizontal pan"]')!
    expect(Number(pan.max)).toBeGreaterThan(0)
    act(() => setValue(pan, '40000'))
    expect(container.querySelector<HTMLInputElement>('[aria-label="C5 horizontal pan"]')?.value).toBe('40000')
    act(() => click(buttons.find((entry) => entry.textContent === 'Fit Selection')!))
    act(() => click(buttons.find((entry) => entry.textContent === 'Fit Track')!))
    expect(container.textContent).toContain('1.00×')
  })
})

describe('MOTION-C4 ↔ C5 shared keyframe selection', () => {
  let container: HTMLDivElement
  let root: ReturnType<typeof createRoot>
  beforeEach(() => { container = document.createElement('div'); document.body.appendChild(container); root = createRoot(container); act(() => root.render(<SharedHarness />)) })
  afterEach(() => { act(() => root.unmount()); container.remove() })

  it('selecting a C4 key selects the same stable keyframe in C5, and selecting C5 changes C4', () => {
    const c4x1 = [...container.querySelectorAll<HTMLButtonElement>(`[data-c4-track="${xTrackId}"] .c4-dope-sheet__key`)].find((entry) => entry.title.startsWith('x1 '))!
    act(() => { pointer(c4x1, 'pointerdown', 100, 0); pointer(window, 'pointerup', 100, 0) })
    expect(container.querySelector('[data-c5-key="x1"]')?.classList.contains('is-selected')).toBe(true)
    const c5x2 = container.querySelector<SVGCircleElement>('[data-c5-key="x2"]')!
    act(() => pointer(c5x2, 'pointerdown', 0, 0))
    const c4x2 = [...container.querySelectorAll<HTMLButtonElement>(`[data-c4-track="${xTrackId}"] .c4-dope-sheet__key`)].find((entry) => entry.title.startsWith('x2 '))!
    expect(c4x2.classList.contains('is-selected')).toBe(true)
  })
})
