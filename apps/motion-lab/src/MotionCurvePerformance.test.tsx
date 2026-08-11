import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import {
  constant,
  createMotionScene,
  keyframed,
  nodeBase,
  projectMotionCurves,
  selectMotionKeyframe,
} from '@sanverse/motion-graph'
import type { MotionSceneV1 } from '@sanverse/motion-graph'
import { MotionCurveEditor } from './MotionCurveEditor.tsx'

const sceneFor = (count: number): MotionSceneV1 => {
  const root = Object.freeze({ ...nodeBase('root', 'Root', null), type: 'group' as const, childIds: Object.freeze(['value']) })
  const base = nodeBase('value', 'Value', 'root')
  const keys = Array.from({ length: count }, (_, index) => Object.freeze({ id: `x-${index}`, tick: index * 100, value: Math.cos(index / 9) * 80, interpolation: index % 4 === 0 ? 'bezier' as const : 'linear' as const, ...(index % 4 === 0 ? { bezier: Object.freeze({ inX: .7, inY: .9, outX: .2, outY: .1 }) } : {}) }))
  const value = Object.freeze({ ...base, type: 'shape' as const, shape: 'rectangle' as const, transform: Object.freeze({ ...base.transform, positionX: keyframed(keys) }), width: constant(300), height: constant(180), fillColor: constant('#fff'), strokeColor: constant('#000'), strokeWidth: constant(0), radius: constant(0) })
  return createMotionScene({ componentId: `sanverse.c5-lab-perf-${count}`, componentVersion: 1, rootNodeId: 'root', nodes: Object.freeze({ root, value }), semanticParts: Object.freeze([]), exposures: Object.freeze([]), layout: Object.freeze({ mode: 'responsive', ownership: Object.freeze([]), formatOverrides: Object.freeze([]) }), supportedAspectRatios: Object.freeze(['16:9']) })
}

describe('C5 measured development-view render performance', () => {
  it('records Value Graph React/SVG construction at 10/100/1k/5k/10k synthetic keys', () => {
    for (const count of [10, 100, 1000, 5000, 10000]) {
      const scene = sceneFor(count)
      const track = projectMotionCurves(scene).tracks.find((entry) => entry.property === 'transform.positionX')!
      const selected = track.keyframes[Math.min(1, track.keyframes.length - 1)]!
      const start = performance.now()
      const html = renderToStaticMarkup(<MotionCurveEditor
        scene={scene}
        selectedNodeId="value"
        localTicks={selected.tick}
        durationTicks={Math.max(100, count * 100)}
        selection={selectMotionKeyframe(selected.selectionId)}
        selectedTrackId={track.trackId}
        canUndo={false}
        canRedo={false}
        onSeek={() => {}}
        onSelectNode={() => {}}
        onSelectionChange={() => {}}
        onTrackChange={() => {}}
        onOperations={() => false}
        nextOperationId={(prefix) => `${prefix}:perf`}
        onUndo={() => {}}
        onRedo={() => {}}
      />)
      const renderMs = performance.now() - start
      const bytes = new TextEncoder().encode(html).byteLength
      expect(html).toContain('data-c5-curve-editor="true"')
      expect(bytes).toBeGreaterThan(0)
      console.log(`C5_LAB_PERF keys=${count} renderMs=${renderMs.toFixed(3)} htmlBytes=${bytes}`)
    }
  }, 15_000)
})
