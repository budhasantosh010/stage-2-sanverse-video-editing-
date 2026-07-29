import { describe, expect, it } from 'vitest'

import {
  DEFAULT_VISUAL_PROPERTIES,
  evaluatePropertyTrack,
  validateVisualPropertiesOperation,
  type SetVisualPropertiesOperation,
} from './visual-properties'

const operation = (
  overrides: Partial<SetVisualPropertiesOperation> = {},
): SetVisualPropertiesOperation => ({
  schemaVersion: 'sanverse.operation/v3',
  operationId: 'operation_visual01',
  kind: 'set-visual-properties',
  capabilityId: 'sanverse.visual.properties.primitive/v1',
  visualId: 'title_visual01',
  transform: { translateX: 0.1, translateY: -0.1, scale: 1.2, rotationDegrees: 8, opacity: 0.9 },
  crop: { top: 0.1, right: 0, bottom: 0.1, left: 0 },
  layer: 4,
  mask: { shape: 'ellipse', feather: 0.05 },
  tracks: [],
  transition: {
    enter: { kind: 'fade', duration: { ticks: 360_000, timescale: 1_440_000 }, easing: { kind: 'linear' } },
    exit: { kind: 'none', duration: { ticks: 0, timescale: 1_440_000 }, easing: { kind: 'linear' } },
  },
  effects: [],
  extensions: {},
  ...overrides,
})

describe('visual composition primitives', () => {
  it('accepts one closed transform, crop, layer, and mask operation', () => {
    expect(validateVisualPropertiesOperation(operation())).toMatchObject({ ok: true })
  })

  it('refuses a crop that removes the whole picture', () => {
    expect(validateVisualPropertiesOperation(operation({
      crop: { top: 0.6, right: 0, bottom: 0.4, left: 0 },
    }))).toMatchObject({ ok: false })
  })

  it('provides an immutable identity state for visuals without an adjustment', () => {
    expect(DEFAULT_VISUAL_PROPERTIES).toMatchObject({
      transform: { translateX: 0, translateY: 0, scale: 1, rotationDegrees: 0, opacity: 1 },
      crop: { top: 0, right: 0, bottom: 0, left: 0 },
      layer: 0,
      mask: { shape: 'none', feather: 0 },
      tracks: [],
      transition: {
        enter: { kind: 'none', duration: { ticks: 0, timescale: 1_440_000 } },
        exit: { kind: 'none', duration: { ticks: 0, timescale: 1_440_000 } },
      },
      effects: [],
    })
  })
})

describe('visual transitions and effects', () => {
  it('accepts bounded enter/exit transitions and basic effects', () => {
    expect(validateVisualPropertiesOperation(operation({
      transition: {
        enter: {
          kind: 'slide-left',
          duration: { ticks: 720_000, timescale: 1_440_000 },
          easing: { kind: 'cubic-bezier', x1: 0.2, y1: 0, x2: 0, y2: 1 },
        },
        exit: {
          kind: 'zoom',
          duration: { ticks: 360_000, timescale: 1_440_000 },
          easing: { kind: 'linear' },
        },
      },
      effects: [
        { kind: 'blur', amount: 0.01 },
        { kind: 'brightness', amount: 0.1 },
        { kind: 'contrast', amount: 1.2 },
        { kind: 'saturation', amount: 0.8 },
        { kind: 'grayscale', amount: 0.25 },
      ],
    }))).toMatchObject({ ok: true })
  })

  it('refuses duplicate effects and unbounded transition duration', () => {
    expect(validateVisualPropertiesOperation(operation({
      transition: {
        enter: { kind: 'fade', duration: { ticks: 30_000_000, timescale: 1_440_000 }, easing: { kind: 'linear' } },
        exit: { kind: 'none', duration: { ticks: 0, timescale: 1_440_000 }, easing: { kind: 'linear' } },
      },
      effects: [
        { kind: 'blur', amount: 0.01 },
        { kind: 'blur', amount: 0.02 },
      ],
    }))).toMatchObject({ ok: false })
  })
})

describe('property tracks, easing, and physical motion', () => {
  it('evaluates ordered keyframes on the project clock', () => {
    const value = evaluatePropertyTrack({
      property: 'translate-x',
      keyframes: [
        { at: { ticks: 0, timescale: 1_440_000 }, value: 0, easing: { kind: 'linear' } },
        { at: { ticks: 1_440_000, timescale: 1_440_000 }, value: 1, easing: { kind: 'linear' } },
      ],
    }, 720_000)
    expect(value).toBeCloseTo(0.5, 6)
  })

  it('uses cubic-bezier easing rather than treating it as linear', () => {
    const value = evaluatePropertyTrack({
      property: 'opacity',
      keyframes: [
        {
          at: { ticks: 0, timescale: 1_440_000 },
          value: 0,
          easing: { kind: 'cubic-bezier', x1: 0.42, y1: 0, x2: 1, y2: 1 },
        },
        { at: { ticks: 1_440_000, timescale: 1_440_000 }, value: 1, easing: { kind: 'linear' } },
      ],
    }, 360_000)
    expect(value).toBeLessThan(0.25)
  })

  it('supports bounded spring overshoot and a bounce curve', () => {
    const spring = evaluatePropertyTrack({
      property: 'scale',
      keyframes: [
        {
          at: { ticks: 0, timescale: 1_440_000 },
          value: 0.8,
          easing: { kind: 'spring', mass: 1, stiffness: 180, damping: 12, velocity: 0 },
        },
        { at: { ticks: 1_440_000, timescale: 1_440_000 }, value: 1, easing: { kind: 'linear' } },
      ],
    }, 360_000)
    const bounce = evaluatePropertyTrack({
      property: 'translate-y',
      keyframes: [
        {
          at: { ticks: 0, timescale: 1_440_000 },
          value: -0.2,
          easing: { kind: 'bounce', intensity: 1 },
        },
        { at: { ticks: 1_440_000, timescale: 1_440_000 }, value: 0, easing: { kind: 'linear' } },
      ],
    }, 1_080_000)

    expect(spring).toBeGreaterThan(0.8)
    expect(spring).toBeLessThan(1.25)
    expect(bounce).toBeGreaterThan(-0.2)
    expect(bounce).toBeLessThanOrEqual(0)
  })

  it('refuses unordered or duplicate keyframe times', () => {
    expect(validateVisualPropertiesOperation(operation({
      tracks: [{
        property: 'opacity',
        keyframes: [
          { at: { ticks: 10, timescale: 1_440_000 }, value: 1, easing: { kind: 'linear' } },
          { at: { ticks: 10, timescale: 1_440_000 }, value: 0, easing: { kind: 'linear' } },
        ],
      }],
    }))).toMatchObject({ ok: false })
  })
})
