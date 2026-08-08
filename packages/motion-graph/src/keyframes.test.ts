import { describe, expect, it } from 'vitest'
import {
  DEFAULT_MOTION_BEZIER_HANDLES,
  evaluateAnimatable,
  evaluateKeyframedValue,
  keyframed,
  motionBezierHandleIssue,
  validateMotionScene,
} from './index.ts'
import type { MotionRenderContextV1 } from '@sanverse/motion-contract'
import { constant } from './properties.ts'
import { createMotionScene } from './scene.ts'
import { nodeBase } from './nodes.ts'

const context = (localTicks: number, durationTicks = 1_000): MotionRenderContextV1 => ({
  localTicks,
  durationTicks,
  ticksPerSecond: 1_440_000,
  composition: { width: 1920, height: 1080, fpsNumerator: 30, fpsDenominator: 1 },
  reducedMotion: false,
})

const numberTrack = keyframed([
  { id: 'kf-a', tick: 100, value: 0, interpolation: 'linear' },
  { id: 'kf-b', tick: 500, value: 100, interpolation: 'linear' },
  { id: 'kf-c', tick: 900, value: 200, interpolation: 'linear' },
])

const sceneWithOpacity = (opacity: unknown) => {
  const root = Object.freeze({ ...nodeBase('root', 'Root', null), type: 'group' as const, childIds: Object.freeze(['shape']) })
  const shape = Object.freeze({
    ...nodeBase('shape', 'Shape', 'root'),
    type: 'shape' as const,
    shape: 'rounded-rectangle' as const,
    width: constant(400),
    height: constant(220),
    fillColor: constant('#ffffff'),
    strokeColor: constant('#000000'),
    strokeWidth: constant(0),
    radius: constant(24),
    opacity,
  })
  return createMotionScene({
    componentId: 'sanverse.keyframe-test', componentVersion: 1, rootNodeId: 'root',
    nodes: Object.freeze({ root, shape: shape as never }),
    semanticParts: Object.freeze([{ id: 'shape', label: 'Shape', role: 'surface', nodeIds: Object.freeze(['shape']) }]),
    exposures: Object.freeze([]),
    layout: Object.freeze({ mode: 'responsive' as const, ownership: Object.freeze([]), formatOverrides: Object.freeze([]) }),
    supportedAspectRatios: Object.freeze(['16:9'] as const),
  })
}

describe('C2 deterministic keyframe evaluator', () => {
  it('uses first value before the first keyframe, exact values on boundaries and final value after the last keyframe', () => {
    expect(evaluateKeyframedValue(numberTrack, 0)).toBe(0)
    expect(evaluateKeyframedValue(numberTrack, 100)).toBe(0)
    expect(evaluateKeyframedValue(numberTrack, 500)).toBe(100)
    expect(evaluateKeyframedValue(numberTrack, 900)).toBe(200)
    expect(evaluateKeyframedValue(numberTrack, 1_000)).toBe(200)
  })

  it('implements hold with a hard value change at the right keyframe', () => {
    const track = keyframed([
      { id: 'a', tick: 0, value: 10, interpolation: 'hold' },
      { id: 'b', tick: 100, value: 20, interpolation: 'hold' },
    ])
    expect(evaluateKeyframedValue(track, 99)).toBe(10)
    expect(evaluateKeyframedValue(track, 100)).toBe(20)
  })

  it('implements scalar linear interpolation directly from exact ticks', () => {
    expect(evaluateKeyframedValue(numberTrack, 300)).toBe(50)
    expect(evaluateKeyframedValue(numberTrack, 700)).toBe(150)
  })

  it('implements cubic-bezier time interpolation with per-keyframe outgoing/incoming handles', () => {
    const track = keyframed([
      { id: 'a', tick: 0, value: 0, interpolation: 'bezier', bezier: { ...DEFAULT_MOTION_BEZIER_HANDLES, outX: 0.15, outY: 0.85 } },
      { id: 'b', tick: 1000, value: 100, interpolation: 'linear', bezier: { ...DEFAULT_MOTION_BEZIER_HANDLES, inX: 0.85, inY: 1 } },
    ])
    const midpoint = evaluateKeyframedValue(track, 500)
    expect(midpoint).toBeGreaterThan(50)
    expect(midpoint).toBeLessThan(100)
    expect(evaluateKeyframedValue(track, 500)).toBe(midpoint)
  })

  it('allows bounded Y overshoot but refuses invalid X, non-finite and pathological Y handles', () => {
    expect(motionBezierHandleIssue({ inX: 0, inY: -1.5, outX: 1, outY: 2.5 })).toBeNull()
    expect(motionBezierHandleIssue({ inX: -0.01, inY: 0, outX: 1, outY: 1 })).toMatch(/X handles/)
    expect(motionBezierHandleIssue({ inX: 0, inY: 0, outX: 1.01, outY: 1 })).toMatch(/X handles/)
    expect(motionBezierHandleIssue({ inX: 0, inY: 5, outX: 1, outY: 1 })).toMatch(/Y handles/)
    expect(motionBezierHandleIssue({ inX: 0, inY: Number.NaN, outX: 1, outY: 1 })).toMatch(/finite/)
  })

  it('fails closed when continuous interpolation is attempted on nonnumeric values', () => {
    expect(() => evaluateKeyframedValue(keyframed([
      { id: 'a', tick: 0, value: 'A', interpolation: 'linear' },
      { id: 'b', tick: 10, value: 'B', interpolation: 'hold' },
    ]), 5)).toThrow(/requires numeric/)
  })

  it('routes constants, motion and keyframes through one generic Animatable evaluator', () => {
    expect(evaluateAnimatable(constant(7), context(500))).toBe(7)
    expect(evaluateAnimatable(numberTrack, context(300))).toBe(50)
  })

  it('is identical under direct, backward and random repeated seeks', () => {
    const direct = evaluateKeyframedValue(numberTrack, 700)
    const randomSequence = [0, 850, 210, 700, 500, 110, 999, 700].map((tick) => evaluateKeyframedValue(numberTrack, tick))
    expect(randomSequence[3]).toBe(direct)
    expect(randomSequence[7]).toBe(direct)
  })

  it.each([1, 2, 10, 100, 1000])('evaluates %i ordered keyframes without history', (count) => {
    const track = keyframed(Array.from({ length: count }, (_, index) => ({ id: `kf-${index}`, tick: index * 100, value: index, interpolation: 'linear' as const })))
    const tick = count === 1 ? 0 : Math.floor((count - 1) * 50)
    const first = evaluateKeyframedValue(track, tick)
    evaluateKeyframedValue(track, Math.max(0, (count - 1) * 100))
    evaluateKeyframedValue(track, 0)
    expect(evaluateKeyframedValue(track, tick)).toBe(first)
  })
})

describe('C2 keyframe scene validation and serialization', () => {
  it('round-trips IDs, ticks, values, interpolation and Bezier handles through JSON', () => {
    const opacity = keyframed([
      { id: 'fade-in', tick: 0, value: 0, interpolation: 'bezier', bezier: { inX: 0, inY: 0, outX: 0.25, outY: 0.1 } },
      { id: 'settled', tick: 500, value: 1, interpolation: 'linear', bezier: { inX: 0.25, inY: 1, outX: 1, outY: 1 } },
    ])
    const parsed = JSON.parse(JSON.stringify(sceneWithOpacity(opacity)))
    const validation = validateMotionScene(parsed)
    expect(validation.ok).toBe(true)
    if (!validation.ok) return
    const roundTrip = validation.value.nodes.shape!.opacity
    expect(roundTrip).toEqual(opacity)
    expect(evaluateAnimatable(roundTrip, context(250))).toBe(evaluateAnimatable(opacity, context(250)))
  })

  it.each([
    ['duplicate id', keyframed([{ id: 'same', tick: 0, value: 0, interpolation: 'linear' }, { id: 'same', tick: 10, value: 1, interpolation: 'linear' }])],
    ['duplicate tick', { kind: 'keyframes', keyframes: [{ id: 'a', tick: 0, value: 0, interpolation: 'linear' }, { id: 'b', tick: 0, value: 1, interpolation: 'linear' }] }],
    ['negative tick', { kind: 'keyframes', keyframes: [{ id: 'a', tick: -1, value: 0, interpolation: 'linear' }] }],
    ['NaN value', { kind: 'keyframes', keyframes: [{ id: 'a', tick: 0, value: Number.NaN, interpolation: 'linear' }] }],
    ['wrong opacity type', { kind: 'keyframes', keyframes: [{ id: 'a', tick: 0, value: 'opaque', interpolation: 'hold' }] }],
    ['opacity out of range', { kind: 'keyframes', keyframes: [{ id: 'a', tick: 0, value: 1.5, interpolation: 'linear' }] }],
    ['invalid interpolation', { kind: 'keyframes', keyframes: [{ id: 'a', tick: 0, value: 1, interpolation: 'spring' }] }],
    ['invalid bezier', { kind: 'keyframes', keyframes: [{ id: 'a', tick: 0, value: 1, interpolation: 'bezier', bezier: { inX: -1, inY: 0, outX: 1, outY: 1 } }] }],
  ] as const)('refuses %s', (_, opacity) => {
    expect(validateMotionScene(sceneWithOpacity(opacity)).ok).toBe(false)
  })
})
