import { describe, expect, it } from 'vitest'
import {
  buildMotionCurveHandleOperation,
  buildMotionCurveSvgPath,
  constant,
  createMotionScene,
  keyframed,
  nodeBase,
  projectMotionCurves,
} from './index.ts'
import type { MotionSceneV1 } from './index.ts'

const syntheticScene = (count: number): MotionSceneV1 => {
  const root = Object.freeze({ ...nodeBase('root', 'Root', null), type: 'group' as const, childIds: Object.freeze(['value']) })
  const base = nodeBase('value', 'Value', 'root')
  const keys = Array.from({ length: count }, (_, index) => Object.freeze({
    id: `x-${index}`,
    tick: index * 100,
    value: Math.sin(index / 11) * 120 + (index % 7) * 4,
    interpolation: index % 5 === 0 ? 'bezier' as const : index % 7 === 0 ? 'hold' as const : 'linear' as const,
    ...(index % 5 === 0 ? { bezier: Object.freeze({ inX: .68, inY: .92, outX: .24, outY: .1 }) } : {}),
  }))
  const value = Object.freeze({
    ...base,
    type: 'shape' as const,
    shape: 'rounded-rectangle' as const,
    transform: Object.freeze({ ...base.transform, positionX: keyframed(keys) }),
    width: constant(400), height: constant(240), fillColor: constant('#fff'), strokeColor: constant('#000'), strokeWidth: constant(0), radius: constant(24),
  })
  return createMotionScene({ componentId: `sanverse.c5-perf-${count}`, componentVersion: 1, rootNodeId: 'root', nodes: Object.freeze({ root, value }), semanticParts: Object.freeze([]), exposures: Object.freeze([]), layout: Object.freeze({ mode: 'responsive', ownership: Object.freeze([]), formatOverrides: Object.freeze([]) }), supportedAspectRatios: Object.freeze(['16:9']) })
}

const average = (samples: readonly number[]) => samples.reduce((sum, value) => sum + value, 0) / samples.length

describe('C5 measured curve performance', () => {
  it('records projection, SVG path generation and a handle-operation build from 10 through 10,000 synthetic keyframes', () => {
    for (const count of [10, 100, 1000, 5000, 10000]) {
      const scene = syntheticScene(count)
      const projectionTimes: number[] = [], pathTimes: number[] = [], handleTimes: number[] = []
      let pathBytes = 0
      for (let pass = 0; pass < 3; pass += 1) {
        let start = performance.now()
        const projection = projectMotionCurves(scene)
        projectionTimes.push(performance.now() - start)
        const track = projection.tracks.find((entry) => entry.property === 'transform.positionX')!
        start = performance.now()
        const path = buildMotionCurveSvgPath(track, { startTicks: 0, endTicks: Math.max(1, (count - 1) * 100), valueRange: track.valueRange, width: 1000, height: 330 })
        pathTimes.push(performance.now() - start)
        pathBytes = new TextEncoder().encode(path).byteLength
        const middle = track.keyframes[Math.min(track.keyframes.length - 1, Math.floor(track.keyframes.length / 2))]!
        start = performance.now()
        buildMotionCurveHandleOperation({ scene, trackId: track.trackId, keyframeId: middle.keyframeId, handle: 'outY', value: .75, nextOperationId: (prefix) => `${prefix}:perf` })
        handleTimes.push(performance.now() - start)
      }
      expect(pathBytes).toBeGreaterThan(0)
      console.log(`C5_PERF keys=${count} projectionMs=${average(projectionTimes).toFixed(3)} pathMs=${average(pathTimes).toFixed(3)} handleBuildMs=${average(handleTimes).toFixed(3)} pathBytes=${pathBytes}`)
    }
  })
})
