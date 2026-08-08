import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { applyMotionOperation, constant, createMotionScene, nodeBase } from '@sanverse/motion-graph'
import type { MotionGraphOperationV1, MotionSceneV1 } from '@sanverse/motion-graph'
import { KeyframeTimeline } from './KeyframeTimeline.tsx'

;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true

const durationTicks = 1_000
const context = (localTicks: number) => ({ localTicks, durationTicks, ticksPerSecond: 1_440_000, composition: { width: 1920, height: 1080, fpsNumerator: 30, fpsDenominator: 1 }, reducedMotion: false }) as const
const scene = (): MotionSceneV1 => {
  const root = Object.freeze({ ...nodeBase('root', 'Root', null), type: 'group' as const, childIds: Object.freeze(['shape']) })
  const shape = Object.freeze({ ...nodeBase('shape', 'Shape', 'root'), type: 'shape' as const, shape: 'rounded-rectangle' as const, width: constant(400), height: constant(220), fillColor: constant('#ffffff'), strokeColor: constant('#000000'), strokeWidth: constant(0), radius: constant(24) })
  return createMotionScene({ componentId: 'sanverse.lab-keyframe-test', componentVersion: 1, rootNodeId: 'root', nodes: Object.freeze({ root, shape }), semanticParts: Object.freeze([{ id: 'shape', label: 'Shape', role: 'surface', nodeIds: Object.freeze(['shape']) }]), exposures: Object.freeze([]), layout: Object.freeze({ mode: 'responsive' as const, ownership: Object.freeze([]), formatOverrides: Object.freeze([]) }), supportedAspectRatios: Object.freeze(['16:9'] as const) })
}

const button = (label: string): HTMLButtonElement => {
  const result = [...document.querySelectorAll('button')].find((candidate) => candidate.textContent?.trim() === label)
  if (!(result instanceof HTMLButtonElement)) throw new Error(`Button not found: ${label}`)
  return result
}

const input = (label: string): HTMLInputElement => {
  const result = document.querySelector(`input[aria-label="${label}"]`)
  if (!(result instanceof HTMLInputElement)) throw new Error(`Input not found: ${label}`)
  return result
}

const select = (label: string): HTMLSelectElement => {
  const result = document.querySelector(`select[aria-label="${label}"]`)
  if (!(result instanceof HTMLSelectElement)) throw new Error(`Select not found: ${label}`)
  return result
}

const setInputValue = (element: HTMLInputElement, value: string): void => {
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set
  if (!setter) throw new Error('Native input value setter unavailable')
  setter.call(element, value)
  element.dispatchEvent(new Event('input', { bubbles: true }))
  element.dispatchEvent(new Event('change', { bubbles: true }))
}

describe('C2 Motion Lab keyframe timeline', () => {
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

  it('shows empty/full diamond state and emits manual add keyframe at the exact current tick', () => {
    const onOperation = vi.fn()
    const props = { scene: scene(), selectedNodeId: 'shape', localTicks: 400, durationTicks, context: context(400), onSeek: vi.fn(), onOperation }
    act(() => root.render(<KeyframeTimeline {...props} />))
    expect(container.querySelector('[data-keyframe-at-current-tick="false"]')?.textContent).toBe('◇')
    act(() => button('+ Keyframe').click())
    expect(onOperation).toHaveBeenCalledWith(expect.objectContaining({ type: 'add-keyframe', tick: 400, interpolation: 'linear', target: expect.objectContaining({ kind: 'node', nodeId: 'shape' }) }))

    const operation = onOperation.mock.calls[0]![0] as MotionGraphOperationV1
    const result = applyMotionOperation(props.scene, operation, { durationTicks })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    act(() => root.render(<KeyframeTimeline {...props} scene={result.scene} />))
    expect(container.querySelector('[data-keyframe-at-current-tick="true"]')?.textContent).toBe('◆')
  })

  it('emits value, move, interpolation, Bezier and remove operations for the selected keyframe', () => {
    const initial = applyMotionOperation(scene(), { operationId: 'seed', type: 'add-keyframe', target: { kind: 'node', nodeId: 'shape', property: 'opacity' }, keyframeId: 'seed-kf', tick: 400, value: 0.5, interpolation: 'linear' }, { durationTicks })
    expect(initial.ok).toBe(true)
    if (!initial.ok) return
    const onOperation = vi.fn()
    const onSeek = vi.fn()
    act(() => root.render(<KeyframeTimeline scene={initial.scene} selectedNodeId="shape" localTicks={400} durationTicks={durationTicks} context={context(400)} onSeek={onSeek} onOperation={onOperation} />))

    const value = input('Keyframe value')
    act(() => setInputValue(value, '0.75'))
    act(() => button('Set').click())
    expect(onOperation).toHaveBeenCalledWith(expect.objectContaining({ type: 'set-keyframe-value', keyframeId: 'seed-kf', value: 0.75 }))

    const tick = input('Keyframe tick')
    act(() => setInputValue(tick, '650'))
    act(() => button('Move').click())
    expect(onOperation).toHaveBeenCalledWith(expect.objectContaining({ type: 'move-keyframe', keyframeId: 'seed-kf', tick: 650 }))
    expect(onSeek).toHaveBeenCalledWith(650)

    const interpolation = select('Keyframe interpolation')
    act(() => { interpolation.value = 'bezier'; interpolation.dispatchEvent(new Event('change', { bubbles: true })) })
    expect(onOperation).toHaveBeenCalledWith(expect.objectContaining({ type: 'set-keyframe-interpolation', keyframeId: 'seed-kf', interpolation: 'bezier' }))

    const outY = input('Bezier outY')
    act(() => setInputValue(outY, '0.9'))
    act(() => button('Apply Bezier').click())
    expect(onOperation).toHaveBeenCalledWith(expect.objectContaining({ type: 'set-keyframe-bezier', keyframeId: 'seed-kf', bezier: expect.objectContaining({ outY: 0.9 }) }))

    act(() => button('Remove').click())
    expect(onOperation).toHaveBeenCalledWith(expect.objectContaining({ type: 'remove-keyframe', keyframeId: 'seed-kf' }))
  })

  it('uses the graph capability registry and does not surface nonnumeric properties in the C2 numeric editor', () => {
    act(() => root.render(<KeyframeTimeline scene={scene()} selectedNodeId="shape" localTicks={0} durationTicks={durationTicks} context={context(0)} onSeek={vi.fn()} onOperation={vi.fn()} />))
    const options = [...select('Keyframe property').options].map((option) => option.textContent ?? '')
    expect(options.some((option) => option.includes('opacity'))).toBe(true)
    expect(options.some((option) => option.includes('transform.positionX'))).toBe(true)
    expect(options.some((option) => option.includes('shape.width'))).toBe(true)
    expect(options.some((option) => option.includes('shape.fillColor'))).toBe(false)
  })
})
