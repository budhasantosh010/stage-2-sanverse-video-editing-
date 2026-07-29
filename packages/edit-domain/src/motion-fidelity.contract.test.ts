import assert from 'node:assert/strict'
import test from 'node:test'

import {
  evaluateVisualProperties,
  type VisualProperties,
} from './visual-properties.ts'

const S = 1_440_000
const at = (seconds: number) => ({ ticks: seconds * S, timescale: S as 1_440_000 })
const fixture: VisualProperties = {
  transform: { translateX: 0, translateY: 0, scale: 1, rotationDegrees: 0, opacity: 1 },
  crop: { top: 0, right: 0, bottom: 0, left: 0 },
  layer: 7,
  mask: { shape: 'ellipse', feather: 0 },
  tracks: [
    { property: 'translate-x', keyframes: [{ at: at(0), value: 0, easing: { kind: 'linear' } }, { at: at(2), value: 0.2, easing: { kind: 'linear' } }] },
    { property: 'translate-y', keyframes: [{ at: at(0), value: -0.2, easing: { kind: 'bounce', intensity: 0.6 } }, { at: at(2), value: 0, easing: { kind: 'linear' } }] },
    { property: 'scale', keyframes: [{ at: at(0), value: 0.8, easing: { kind: 'spring', mass: 1, stiffness: 180, damping: 12, velocity: 0 } }, { at: at(2), value: 1, easing: { kind: 'linear' } }] },
    { property: 'rotation', keyframes: [{ at: at(0), value: -8, easing: { kind: 'cubic-bezier', x1: 0.2, y1: 0, x2: 0, y2: 1 } }, { at: at(2), value: 8, easing: { kind: 'linear' } }] },
    { property: 'opacity', keyframes: [{ at: at(0), value: 0, easing: { kind: 'linear' } }, { at: at(2), value: 1, easing: { kind: 'linear' } }] },
    { property: 'crop-top', keyframes: [{ at: at(0), value: 0.1, easing: { kind: 'linear' } }, { at: at(2), value: 0, easing: { kind: 'linear' } }] },
  ],
  transition: {
    enter: { kind: 'slide-left', duration: at(0.25), easing: { kind: 'linear' } },
    exit: { kind: 'fade', duration: at(0.25), easing: { kind: 'linear' } },
  },
  effects: [{ kind: 'saturation', amount: 0.8 }],
}

test('motion samples are deterministic at seek boundaries and settle exactly', () => {
  const ticks = [0, S, 2 * S - 48_000, 2 * S]
  const first = ticks.map((tick) => evaluateVisualProperties(fixture, tick, 2 * S))
  const second = ticks.map((tick) => evaluateVisualProperties(fixture, tick, 2 * S))
  assert.deepEqual(first, second)
  assert.equal(first[0].layer, 7)
  assert.equal(first[0].mask.shape, 'ellipse')
  assert.equal(first.at(-1)?.transform.translateX, 0.2)
  assert.equal(first.at(-1)?.transform.scale, 1)
  assert.equal(first.at(-1)?.transform.rotationDegrees, 8)
  assert.equal(first.at(-1)?.crop.top, 0)
})

test('reduced motion keeps the final authored state without spatial travel', () => {
  const reducedAtStart = evaluateVisualProperties(fixture, 0, 2 * S, true)
  const reducedAtMiddle = evaluateVisualProperties(fixture, S, 2 * S, true)
  assert.deepEqual(reducedAtStart, reducedAtMiddle)
  assert.equal(reducedAtStart.transform.translateX, 0.2)
  assert.equal(reducedAtStart.transform.translateY, 0)
  assert.equal(reducedAtStart.transform.scale, 1)
  assert.equal(reducedAtStart.transform.opacity, 1)
})
