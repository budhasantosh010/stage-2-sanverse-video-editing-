import { describe, expect, it } from 'vitest'
import { evaluateScene, projectMotionCurves, projectMotionDopeSheet, projectMotionLayers } from '@sanverse/motion-graph'
import { SANVERSE_TICKS_PER_SECOND } from '@sanverse/motion-primitives'
import { RATIO_COMPOSITIONS, renderComponentMarkup } from '@sanverse/motion-testing'
import { A21_CREATOR_WOW_COMPONENT_IDS, FAMILY_COMPONENT_MODULES_BY_ID, familyComponentStyleFromPack } from './component-families.tsx'
import { INITIAL_MOTION_STYLE_PACKS } from '../style-packs.ts'

const percentile = (values: readonly number[], ratio: number) => [...values].sort((a, b) => a - b)[Math.min(values.length - 1, Math.floor(values.length * ratio))] ?? 0

describe('MOTION-A21 measured creator/WOW performance', () => {
  it('measures the full 6 × 4 × 8 matrix through create/evaluate/C3/C4/C5 and SSR markup', () => {
    const graphTimes: number[] = []
    const markupTimes: number[] = []
    let combinations = 0
    let nodes = 0
    let tracks = 0
    let keys = 0
    for (const id of A21_CREATOR_WOW_COMPONENT_IDS) {
      const module = FAMILY_COMPONENT_MODULES_BY_ID[id]!
      for (const ratio of ['16:9', '9:16', '1:1', '4:5'] as const) for (const pack of INITIAL_MOTION_STYLE_PACKS) {
        combinations += 1
        const durationTicks = Math.round(module.definition.defaultDurationTicks)
        const context = { localTicks: Math.round(durationTicks * .62), durationTicks, ticksPerSecond: SANVERSE_TICKS_PER_SECOND, composition: RATIO_COMPOSITIONS[ratio], reducedMotion: false } as const
        const style = familyComponentStyleFromPack(pack)
        for (let repeat = 0; repeat < 3; repeat += 1) {
          const graphStart = performance.now()
          const scene = module.createScene(module.defaultProps, style, context)
          const resolved = evaluateScene(scene, context)
          projectMotionLayers({ scene, resolvedScene: resolved })
          const dope = projectMotionDopeSheet(scene)
          projectMotionCurves(scene)
          graphTimes.push(performance.now() - graphStart)
          if (repeat === 0) { nodes += Object.keys(scene.nodes).length; tracks += dope.totalTracks; keys += dope.totalKeyframes }
          const markupStart = performance.now()
          renderComponentMarkup(module, module.defaultProps, style, context)
          markupTimes.push(performance.now() - markupStart)
        }
      }
    }
    const graphAvg = graphTimes.reduce((a, b) => a + b, 0) / graphTimes.length
    const markupAvg = markupTimes.reduce((a, b) => a + b, 0) / markupTimes.length
    console.log(`A21_PERF combinations=${combinations} iterations=${graphTimes.length} graphAvgMs=${graphAvg.toFixed(3)} graphP95Ms=${percentile(graphTimes, .95).toFixed(3)} markupAvgMs=${markupAvg.toFixed(3)} markupP95Ms=${percentile(markupTimes, .95).toFixed(3)} avgNodes=${(nodes / combinations).toFixed(2)} avgTracks=${(tracks / combinations).toFixed(2)} avgKeys=${(keys / combinations).toFixed(2)}`)
    expect(combinations).toBe(192)
    expect(graphTimes).toHaveLength(576)
    expect(graphTimes.every(Number.isFinite)).toBe(true)
    expect(markupTimes.every(Number.isFinite)).toBe(true)
  }, 20_000)
})
