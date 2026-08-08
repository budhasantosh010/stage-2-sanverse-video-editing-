import { describe, expect, it } from 'vitest'
import {
  applyMotionOperation,
  applyMotionOperations,
  constant,
  createDefaultEffect,
  createDefaultMask,
  createMotionScene,
  evaluateScene,
  keyframed,
  motionNumber,
  nodeBase,
  validateMotionGraphOperation,
} from './index.ts'
import type { MotionGraphOperationV1, MotionSceneV1 } from './index.ts'

const durationTicks = 1_000
const context = (localTicks: number) => ({
  localTicks, durationTicks, ticksPerSecond: 1_440_000,
  composition: { width: 1920, height: 1080, fpsNumerator: 30, fpsDenominator: 1 }, reducedMotion: false,
}) as const

const baseScene = (): MotionSceneV1 => {
  const root = Object.freeze({ ...nodeBase('root', 'Root', null), type: 'group' as const, childIds: Object.freeze(['value', 'label']) })
  const value = Object.freeze({
    ...nodeBase('value', 'Value', 'root'), type: 'shape' as const, shape: 'rounded-rectangle' as const,
    width: constant(500), height: constant(260), fillColor: constant('#ffffff'), strokeColor: constant('#000000'), strokeWidth: constant(0), radius: constant(32),
    effects: Object.freeze([createDefaultEffect('glow-main', 'glow')]),
    masks: Object.freeze([createDefaultMask('mask-main', 'rounded-rectangle')]),
  })
  const label = Object.freeze({
    ...nodeBase('label', 'Label', 'root'), type: 'text' as const, text: constant('Hello'), fillColor: constant('#ffffff'), fontFamily: 'Arial', fontSize: constant(64), fontWeight: constant(800), textAlign: 'center' as const,
  })
  return createMotionScene({
    componentId: 'sanverse.keyframe-operations-test', componentVersion: 1, rootNodeId: 'root', nodes: Object.freeze({ root, value, label }),
    semanticParts: Object.freeze([{ id: 'content', label: 'Content', role: 'content-group', nodeIds: Object.freeze(['value', 'label']) }]), exposures: Object.freeze([]),
    layout: Object.freeze({ mode: 'responsive' as const, ownership: Object.freeze([]), formatOverrides: Object.freeze([]) }), supportedAspectRatios: Object.freeze(['16:9'] as const),
  })
}

const nodeTarget = { kind: 'node' as const, nodeId: 'value', property: 'opacity' as const }
const apply = (scene: MotionSceneV1, operation: MotionGraphOperationV1) => applyMotionOperation(scene, operation, { durationTicks })

describe('C2 keyframe operations', () => {
  it('converts a constant to one keyframe without changing its current visual value', () => {
    const result = apply(baseScene(), { operationId: 'add:first', type: 'add-keyframe', target: nodeTarget, keyframeId: 'kf-1', tick: 400, interpolation: 'linear' })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    const opacity = result.scene.nodes.value!.opacity
    expect(opacity).toEqual(keyframed([{ id: 'kf-1', tick: 400, value: 1, interpolation: 'linear' }]))
    expect(evaluateScene(result.scene, context(0)).nodes.value!.opacity).toBe(1)
    expect(evaluateScene(result.scene, context(900)).nodes.value!.opacity).toBe(1)
  })

  it('adds a second keyframe and linearly resolves the exact midpoint', () => {
    const first = apply(baseScene(), { operationId: 'add:a', type: 'add-keyframe', target: nodeTarget, keyframeId: 'a', tick: 0, value: 0, interpolation: 'linear' })
    expect(first.ok).toBe(true)
    if (!first.ok) return
    const second = apply(first.scene, { operationId: 'add:b', type: 'add-keyframe', target: nodeTarget, keyframeId: 'b', tick: 1000, value: 1, interpolation: 'linear' })
    expect(second.ok).toBe(true)
    if (!second.ok) return
    expect(evaluateScene(second.scene, context(500)).nodes.value!.opacity).toBe(0.5)
  })

  it('refuses implicit motion-driver or binding conversion', () => {
    const driven = applyMotionOperation(baseScene(), { operationId: 'driver', type: 'set-property', target: { nodeId: 'value', property: 'opacity' }, value: motionNumber({ kind: 'interpolation', from: 0, to: 1, start: 0, end: 1, easing: 'linear' }) })
    expect(driven.ok).toBe(true)
    if (!driven.ok) return
    const refusal = apply(driven.scene, { operationId: 'add:driver', type: 'add-keyframe', target: nodeTarget, keyframeId: 'a', tick: 0, interpolation: 'linear' })
    expect(refusal).toEqual(expect.objectContaining({ ok: false, error: expect.objectContaining({ code: 'KEYFRAME_CONVERSION_REQUIRED' }) }))
  })

  it('rejects duplicate keyframe IDs and same-tick collisions separately', () => {
    const first = apply(baseScene(), { operationId: 'add:a', type: 'add-keyframe', target: nodeTarget, keyframeId: 'a', tick: 100, interpolation: 'linear' })
    expect(first.ok).toBe(true)
    if (!first.ok) return
    expect(apply(first.scene, { operationId: 'dup:id', type: 'add-keyframe', target: nodeTarget, keyframeId: 'a', tick: 200, interpolation: 'linear' })).toEqual(expect.objectContaining({ ok: false, error: expect.objectContaining({ code: 'DUPLICATE_ID' }) }))
    expect(apply(first.scene, { operationId: 'dup:tick', type: 'add-keyframe', target: nodeTarget, keyframeId: 'b', tick: 100, interpolation: 'linear' })).toEqual(expect.objectContaining({ ok: false, error: expect.objectContaining({ code: 'KEYFRAME_COLLISION' }) }))
  })

  it('enforces owning duration when supplied and rejects malformed ticks at syntax validation', () => {
    expect(apply(baseScene(), { operationId: 'late', type: 'add-keyframe', target: nodeTarget, keyframeId: 'a', tick: 1001, interpolation: 'linear' })).toEqual(expect.objectContaining({ ok: false, error: expect.objectContaining({ code: 'KEYFRAME_INVALID' }) }))
    expect(validateMotionGraphOperation({ operationId: 'negative', type: 'add-keyframe', target: nodeTarget, keyframeId: 'a', tick: -1, interpolation: 'linear' })).toEqual(expect.objectContaining({ code: 'OPERATION_INVALID' }))
    expect(validateMotionGraphOperation({ operationId: 'nan', type: 'add-keyframe', target: nodeTarget, keyframeId: 'a', tick: Number.NaN, interpolation: 'linear' })).toEqual(expect.objectContaining({ code: 'OPERATION_INVALID' }))
  })

  it('removes the last keyframe back to a constant and exposes an inverse add operation', () => {
    const added = apply(baseScene(), { operationId: 'add', type: 'add-keyframe', target: nodeTarget, keyframeId: 'a', tick: 400, value: 0.7, interpolation: 'linear' })
    expect(added.ok).toBe(true)
    if (!added.ok) return
    const removed = apply(added.scene, { operationId: 'remove', type: 'remove-keyframe', target: nodeTarget, keyframeId: 'a' })
    expect(removed.ok).toBe(true)
    if (!removed.ok) return
    expect(removed.scene.nodes.value!.opacity).toEqual(constant(0.7))
    expect(removed.inverseOperations?.[0]).toEqual(expect.objectContaining({ type: 'add-keyframe', keyframeId: 'a', tick: 400, value: 0.7 }))
  })

  it('moves a keyframe while preserving its ID and refuses a move collision', () => {
    const started = applyMotionOperations(baseScene(), [
      { operationId: 'a', type: 'add-keyframe', target: nodeTarget, keyframeId: 'a', tick: 100, value: 0, interpolation: 'linear' },
      { operationId: 'b', type: 'add-keyframe', target: nodeTarget, keyframeId: 'b', tick: 900, value: 1, interpolation: 'linear' },
    ], { durationTicks })
    expect(started.ok).toBe(true)
    if (!started.ok) return
    const moved = apply(started.scene, { operationId: 'move', type: 'move-keyframe', target: nodeTarget, keyframeId: 'a', tick: 300 })
    expect(moved.ok).toBe(true)
    if (!moved.ok) return
    const keyframes = moved.scene.nodes.value!.opacity.kind === 'keyframes' ? moved.scene.nodes.value!.opacity.keyframes : []
    expect(keyframes.find((keyframe) => keyframe.id === 'a')?.tick).toBe(300)
    expect(apply(moved.scene, { operationId: 'collision', type: 'move-keyframe', target: nodeTarget, keyframeId: 'a', tick: 900 })).toEqual(expect.objectContaining({ ok: false, error: expect.objectContaining({ code: 'KEYFRAME_COLLISION' }) }))
  })

  it('sets values with property constraints and refuses opacity outside [0,1]', () => {
    const added = apply(baseScene(), { operationId: 'add', type: 'add-keyframe', target: nodeTarget, keyframeId: 'a', tick: 0, value: 0.5, interpolation: 'linear' })
    expect(added.ok).toBe(true)
    if (!added.ok) return
    const valid = apply(added.scene, { operationId: 'set', type: 'set-keyframe-value', target: nodeTarget, keyframeId: 'a', value: 0.75 })
    expect(valid.ok).toBe(true)
    expect(apply(added.scene, { operationId: 'invalid', type: 'set-keyframe-value', target: nodeTarget, keyframeId: 'a', value: 1.2 })).toEqual(expect.objectContaining({ ok: false, error: expect.objectContaining({ code: 'KEYFRAME_INVALID' }) }))
  })

  it('edits interpolation and Bezier handles while restricting text to hold', () => {
    const started = applyMotionOperations(baseScene(), [
      { operationId: 'a', type: 'add-keyframe', target: nodeTarget, keyframeId: 'a', tick: 0, value: 0, interpolation: 'linear' },
      { operationId: 'b', type: 'add-keyframe', target: nodeTarget, keyframeId: 'b', tick: 1000, value: 1, interpolation: 'linear' },
    ], { durationTicks })
    expect(started.ok).toBe(true)
    if (!started.ok) return
    const interpolation = apply(started.scene, { operationId: 'interp', type: 'set-keyframe-interpolation', target: nodeTarget, keyframeId: 'a', interpolation: 'bezier' })
    expect(interpolation.ok).toBe(true)
    if (!interpolation.ok) return
    const bezier = apply(interpolation.scene, { operationId: 'bezier', type: 'set-keyframe-bezier', target: nodeTarget, keyframeId: 'a', bezier: { inX: 0, inY: 0, outX: 0.2, outY: 0.9 } })
    expect(bezier.ok).toBe(true)
    expect(apply(interpolation.scene, { operationId: 'bad-bezier', type: 'set-keyframe-bezier', target: nodeTarget, keyframeId: 'a', bezier: { inX: -1, inY: 0, outX: 1, outY: 1 } })).toEqual(expect.objectContaining({ ok: false, error: expect.objectContaining({ code: 'KEYFRAME_INVALID' }) }))

    const textTarget = { kind: 'node' as const, nodeId: 'label', property: 'text.text' as const }
    const textTrack = apply(baseScene(), { operationId: 'text', type: 'add-keyframe', target: textTarget, keyframeId: 't', tick: 0, interpolation: 'hold' })
    expect(textTrack.ok).toBe(true)
    if (!textTrack.ok) return
    expect(apply(textTrack.scene, { operationId: 'text-linear', type: 'set-keyframe-interpolation', target: textTarget, keyframeId: 't', interpolation: 'linear' })).toEqual(expect.objectContaining({ ok: false, error: expect.objectContaining({ code: 'KEYFRAME_UNSUPPORTED' }) }))
  })

  it('keyframes numeric effect parameters and mask parameters through the same operation API', () => {
    const glowTarget = { kind: 'effect' as const, nodeId: 'value', effectId: 'glow-main', parameter: 'intensity' }
    const maskTarget = { kind: 'mask' as const, nodeId: 'value', maskId: 'mask-main', property: 'feather' as const }
    const result = applyMotionOperations(baseScene(), [
      { operationId: 'g0', type: 'add-keyframe', target: glowTarget, keyframeId: 'g0', tick: 0, value: 0, interpolation: 'linear' },
      { operationId: 'g1', type: 'add-keyframe', target: glowTarget, keyframeId: 'g1', tick: 1000, value: 0.6, interpolation: 'linear' },
      { operationId: 'm0', type: 'add-keyframe', target: maskTarget, keyframeId: 'm0', tick: 0, value: 0, interpolation: 'linear' },
      { operationId: 'm1', type: 'add-keyframe', target: maskTarget, keyframeId: 'm1', tick: 1000, value: 0.4, interpolation: 'linear' },
    ], { durationTicks })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    const resolved = evaluateScene(result.scene, context(500)).nodes.value!
    expect(resolved.effects.find((effect) => effect.id === 'glow-main')?.parameters.intensity).toBeCloseTo(0.3)
    expect(resolved.masks.find((mask) => mask.id === 'mask-main')?.feather).toBeCloseTo(0.2)
  })

  it('refuses missing/deleted targets and invalid effect parameters', () => {
    expect(apply(baseScene(), { operationId: 'missing', type: 'add-keyframe', target: { ...nodeTarget, nodeId: 'deleted' }, keyframeId: 'a', tick: 0, interpolation: 'linear' })).toEqual(expect.objectContaining({ ok: false, error: expect.objectContaining({ code: 'TARGET_NOT_FOUND' }) }))
    expect(apply(baseScene(), { operationId: 'effect', type: 'add-keyframe', target: { kind: 'effect', nodeId: 'value', effectId: 'glow-main', parameter: 'missing' }, keyframeId: 'a', tick: 0, interpolation: 'linear' })).toEqual(expect.objectContaining({ ok: false, error: expect.objectContaining({ code: 'TARGET_NOT_FOUND' }) }))
  })

  it('clears keyframes to an explicit fallback and restores the full track through inverses', () => {
    const started = applyMotionOperations(baseScene(), [
      { operationId: 'a', type: 'add-keyframe', target: nodeTarget, keyframeId: 'a', tick: 0, value: 0, interpolation: 'bezier', bezier: { inX: 0, inY: 0, outX: 0.2, outY: 0.8 } },
      { operationId: 'b', type: 'add-keyframe', target: nodeTarget, keyframeId: 'b', tick: 1000, value: 1, interpolation: 'linear', bezier: { inX: 0.8, inY: 1, outX: 1, outY: 1 } },
    ], { durationTicks })
    expect(started.ok).toBe(true)
    if (!started.ok) return
    const cleared = apply(started.scene, { operationId: 'clear', type: 'clear-keyframes', target: nodeTarget, fallbackValue: 0.4 })
    expect(cleared.ok).toBe(true)
    if (!cleared.ok) return
    expect(cleared.scene.nodes.value!.opacity).toEqual(constant(0.4))
    const restored = applyMotionOperations(cleared.scene, cleared.inverseOperations ?? [], { durationTicks })
    expect(restored.ok).toBe(true)
    if (!restored.ok) return
    expect(restored.scene.nodes.value!.opacity).toEqual(started.scene.nodes.value!.opacity)
  })

  it('keeps keyframe batches atomic when a later operation fails', () => {
    const operations: readonly MotionGraphOperationV1[] = [
      { operationId: 'first', type: 'add-keyframe', target: nodeTarget, keyframeId: 'a', tick: 0, value: 0, interpolation: 'linear' },
      { operationId: 'bad', type: 'add-keyframe', target: nodeTarget, keyframeId: 'b', tick: 0, value: 1, interpolation: 'linear' },
      { operationId: 'never', type: 'add-keyframe', target: nodeTarget, keyframeId: 'c', tick: 1000, value: 1, interpolation: 'linear' },
    ]
    const scene = baseScene()
    const result = applyMotionOperations(scene, operations, { durationTicks })
    expect(result).toEqual(expect.objectContaining({ ok: false, error: expect.objectContaining({ code: 'BATCH_FAILED', causeCode: 'KEYFRAME_COLLISION', failedOperationIndex: 1 }) }))
    expect(scene.nodes.value!.opacity).toEqual(constant(1))
  })

  it('keeps operation payloads JSON-serializable and deterministic after round trip', () => {
    const operation: MotionGraphOperationV1 = { operationId: 'json', type: 'add-keyframe', target: nodeTarget, keyframeId: 'stable-kf', tick: 500, value: 0.25, interpolation: 'bezier', bezier: { inX: 0.7, inY: 1, outX: 0.2, outY: 0.3 } }
    const parsed = JSON.parse(JSON.stringify(operation)) as MotionGraphOperationV1
    const first = apply(baseScene(), operation)
    const second = apply(baseScene(), parsed)
    expect(first).toEqual(second)
  })
})
