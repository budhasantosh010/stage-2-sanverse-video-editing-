import { describe, expect, it } from 'vitest'
import {
  applyMotionOperations,
  buildMotionCurveHandleOperation,
  buildMotionCurvePresetOperations,
  buildMotionCurveSvgPath,
  constant,
  createMotionScene,
  evaluateKeyframedValue,
  fitMotionCurveValueRange,
  keyframed,
  motionCurvePresetShape,
  motionNumber,
  nodeBase,
  projectMotionCurves,
  readMotionAnimatableTarget,
  sampleMotionCurveTrack,
} from './index.ts'
import type { KeyframedValueV1, MotionKeyframeV1, MotionSceneV1 } from './index.ts'

const durationTicks = 4_000
const root = () => Object.freeze({ ...nodeBase('root', 'Root', null), type: 'group' as const, childIds: Object.freeze(['value']) })
const scene = (positionX: KeyframedValueV1<number>, opacity: KeyframedValueV1<number> = keyframed([{ id: 'o0', tick: 0, value: 0, interpolation: 'linear' }, { id: 'o1', tick: 1000, value: 1, interpolation: 'linear' }])): MotionSceneV1 => {
  const base = nodeBase('value', 'Value', 'root')
  const value = Object.freeze({
    ...base,
    type: 'shape' as const,
    shape: 'rounded-rectangle' as const,
    width: constant(320), height: constant(180), fillColor: constant('#fff'), strokeColor: constant('#000'), strokeWidth: constant(0), radius: constant(24),
    opacity,
    transform: Object.freeze({ ...base.transform, positionX, rotationDeg: motionNumber({ kind: 'interpolation', from: 0, to: 45, start: 0, end: 1, easing: 'linear' }) }),
  })
  return createMotionScene({ componentId: 'sanverse.c5-test', componentVersion: 1, rootNodeId: 'root', nodes: Object.freeze({ root: root(), value }), semanticParts: Object.freeze([]), exposures: Object.freeze([]), layout: Object.freeze({ mode: 'responsive', ownership: Object.freeze([]), formatOverrides: Object.freeze([]) }), supportedAspectRatios: Object.freeze(['16:9']) })
}

const keys = (interpolation: MotionKeyframeV1<number>['interpolation'], bezier?: MotionKeyframeV1<number>['bezier']) => keyframed([
  { id: 'x0', tick: 500, value: 0, interpolation, ...(bezier ? { bezier } : {}) },
  { id: 'x1', tick: 1500, value: 100, interpolation: 'linear', bezier: { inX: .72, inY: .92, outX: .3, outY: .3 } },
  { id: 'x2', tick: 3000, value: 40, interpolation: 'linear' },
])

const counter = () => { let value = 0; return (prefix: string) => `${prefix}:${++value}` }

describe('C5 pure curve projection', () => {
  it('projects numeric C2 tracks and keeps driver tracks explicitly read-only', () => {
    const projection = projectMotionCurves(scene(keys('linear')))
    const x = projection.tracks.find((track) => track.property === 'transform.positionX')
    const driver = projection.tracks.find((track) => track.property === 'transform.rotationDeg')
    expect(x).toMatchObject({ editable: true, animationKind: 'keyframes' })
    expect(x?.keyframes.map((key) => key.keyframeId)).toEqual(['x0', 'x1', 'x2'])
    expect(driver).toMatchObject({ editable: false, animationKind: 'motion' })
    expect(driver?.readOnlyReason).toContain('Convert/bake')
  })

  it('fits a useful value range instead of assuming 0..1', () => {
    expect(fitMotionCurveValueRange([40, 100])).toMatchObject({ minimum: 32.8, maximum: 107.2 })
    const flat = fitMotionCurveValueRange([500, 500])
    expect(flat.minimum).toBeLessThan(500); expect(flat.maximum).toBeGreaterThan(500)
  })
})

describe('C5 displayed curve canonicality', () => {
  it('samples a linear segment exactly from the C2 evaluator including before/after bounds', () => {
    const source = scene(keys('linear'))
    const track = projectMotionCurves(source).tracks.find((entry) => entry.property === 'transform.positionX')!
    const samples = sampleMotionCurveTrack(source, track.trackId, 20)
    expect(samples.find((sample) => sample.tick === 1000)?.value).toBe(50)
    const record = readMotionAnimatableTarget(source, track.target)
    expect(record.animatable.kind).toBe('keyframes')
    if (record.animatable.kind !== 'keyframes') return
    expect(evaluateKeyframedValue(record.animatable, 0)).toBe(0)
    expect(evaluateKeyframedValue(record.animatable, 4000)).toBe(40)
  })

  it('draws Hold as the same held value the evaluator returns', () => {
    const source = scene(keys('hold'))
    const track = projectMotionCurves(source).tracks.find((entry) => entry.property === 'transform.positionX')!
    const samples = sampleMotionCurveTrack(source, track.trackId, 20)
    expect(samples.find((sample) => sample.tick === 1000)?.value).toBe(0)
    expect(samples.find((sample) => sample.tick === 1500)?.value).toBe(100)
  })

  it('builds Hold, Linear and Bezier SVG geometry from the actual C2 interpolation semantics', () => {
    const viewport = { startTicks: 0, endTicks: 4000, valueRange: { minimum: -20, maximum: 120 }, width: 1000, height: 300 }
    const linear = projectMotionCurves(scene(keys('linear'))).tracks.find((entry) => entry.property === 'transform.positionX')!
    const hold = projectMotionCurves(scene(keys('hold'))).tracks.find((entry) => entry.property === 'transform.positionX')!
    const bezier = projectMotionCurves(scene(keys('bezier', { inX: .7, inY: 1, outX: .18, outY: .88 }))).tracks.find((entry) => entry.property === 'transform.positionX')!
    expect(buildMotionCurveSvgPath(linear, viewport)).toContain(' L ')
    expect(buildMotionCurveSvgPath(hold, viewport).split(' L ').length).toBeGreaterThan(buildMotionCurveSvgPath(linear, viewport).split(' L ').length)
    expect(buildMotionCurveSvgPath(bezier, viewport)).toContain(' C ')
  })

  it('samples every displayed Bezier point through the exact C2 evaluator', () => {
    const source = scene(keys('bezier', { inX: .7, inY: 1, outX: .18, outY: .88 }))
    const track = projectMotionCurves(source).tracks.find((entry) => entry.property === 'transform.positionX')!
    const record = readMotionAnimatableTarget(source, track.target)
    expect(record.animatable.kind).toBe('keyframes')
    if (record.animatable.kind !== 'keyframes') return
    for (const point of sampleMotionCurveTrack(source, track.trackId, 40)) expect(point.value).toBe(evaluateKeyframedValue(record.animatable, point.tick))
  })
})

describe('C5 authoring commands resolve to real C2 interpolation and handles', () => {
  it('maps Flat, Auto, Soft and Snappy to finite canonical Bezier data', () => {
    for (const preset of ['flat', 'auto', 'soft', 'snappy'] as const) {
      const shape = motionCurvePresetShape(preset)
      expect(shape.interpolation).toBe('bezier')
      expect([shape.outX, shape.outY, shape.inX, shape.inY].every((value) => Number.isFinite(value))).toBe(true)
    }
  })

  it('applies Snappy as typed C2 operations while preserving node/keyframe identity', () => {
    const source = scene(keys('linear'))
    const track = projectMotionCurves(source).tracks.find((entry) => entry.property === 'transform.positionX')!
    const beforeMid = sampleMotionCurveTrack(source, track.trackId, 2).find((point) => point.tick === 1000)!.value
    const operations = buildMotionCurvePresetOperations({ scene: source, trackId: track.trackId, leftKeyframeId: 'x0', preset: 'snappy', nextOperationId: counter() })
    const result = applyMotionOperations(source, operations, { durationTicks })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    const afterTrack = projectMotionCurves(result.scene).tracksById[track.trackId]!
    expect(afterTrack.nodeId).toBe(track.nodeId)
    expect(afterTrack.keyframes.map((key) => key.keyframeId)).toEqual(['x0', 'x1', 'x2'])
    expect(afterTrack.keyframes[0]?.interpolation).toBe('bezier')
    const afterMid = sampleMotionCurveTrack(result.scene, track.trackId, 2).find((point) => point.tick === 1000)!.value
    expect(afterMid).not.toBe(beforeMid)
  })

  it('allows overshoot on transform motion but refuses bounded opacity', () => {
    const source = scene(keys('linear'))
    const projection = projectMotionCurves(source)
    const x = projection.tracks.find((entry) => entry.property === 'transform.positionX')!
    const opacity = projection.tracks.find((entry) => entry.property === 'opacity')!
    expect(() => buildMotionCurvePresetOperations({ scene: source, trackId: x.trackId, leftKeyframeId: 'x0', preset: 'overshoot', nextOperationId: counter() })).not.toThrow()
    expect(() => buildMotionCurvePresetOperations({ scene: source, trackId: opacity.trackId, leftKeyframeId: 'o0', preset: 'overshoot', nextOperationId: counter() })).toThrow(/Overshoot/)
  })

  it('refuses invalid handle coordinates before any graph mutation', () => {
    const source = scene(keys('bezier'))
    const track = projectMotionCurves(source).tracks.find((entry) => entry.property === 'transform.positionX')!
    expect(() => buildMotionCurveHandleOperation({ scene: source, trackId: track.trackId, keyframeId: 'x0', handle: 'outX', value: 2, nextOperationId: counter() })).toThrow(/\[0,1\]/)
  })
})
