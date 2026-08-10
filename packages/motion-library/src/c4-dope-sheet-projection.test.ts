import { describe, expect, it } from 'vitest'
import { projectMotionDopeSheet, validateMotionScene } from '@sanverse/motion-graph'
import { SANVERSE_TICKS_PER_SECOND } from '@sanverse/motion-primitives'
import { RATIO_COMPOSITIONS } from '@sanverse/motion-testing'
import type { MotionRenderContextV1 } from '@sanverse/motion-contract'
import type { MotionSceneV1 } from '@sanverse/motion-graph'
import { MOTION_COMPONENT_CATALOG, MOTION_COMPONENT_MODULES } from './catalog.ts'

describe('MOTION-C4 all-component dope-sheet projection', () => {
  it('projects all 89 public Motion components at all four reference ratios from the same C2 Animatable authority', () => {
    expect(MOTION_COMPONENT_CATALOG).toHaveLength(89)
    for (const definition of MOTION_COMPONENT_CATALOG) {
      const module = MOTION_COMPONENT_MODULES[definition.id]
      expect(module, definition.id).toBeDefined()
      if (!module || !('createScene' in module) || typeof module.createScene !== 'function') continue
      for (const [ratio, composition] of Object.entries(RATIO_COMPOSITIONS)) {
        const durationTicks = definition.defaultDurationTicks
        const context = { localTicks: Math.round(durationTicks * .56), durationTicks, ticksPerSecond: SANVERSE_TICKS_PER_SECOND, composition, reducedMotion: false } as const
        const graphModule = module as unknown as { readonly defaultProps: unknown; readonly defaultStyle: unknown; readonly createScene: (props: unknown, style: unknown, context: MotionRenderContextV1) => MotionSceneV1 }
        const scene = graphModule.createScene(graphModule.defaultProps, graphModule.defaultStyle, context)
        expect(validateMotionScene(scene).ok, `${definition.id} ${ratio}`).toBe(true)
        const projection = projectMotionDopeSheet(scene)
        const selectionIds = new Set<string>()
        let countedTracks = 0
        let countedKeyframes = 0
        for (const layer of projection.layers) {
          expect(scene.nodes[layer.nodeId], `${definition.id} ${ratio} ${layer.nodeId}`).toBeDefined()
          for (const track of layer.tracks) {
            countedTracks += 1
            expect(track.nodeId).toBe(layer.nodeId)
            expect(track.animationKind === 'keyframes' || track.animationKind === 'motion' || track.animationKind === 'binding').toBe(true)
            expect(track.trackId.trim().length).toBeGreaterThan(0)
            expect(projection.tracksById[track.trackId]).toBe(track)
            if (track.animationKind !== 'keyframes') expect(track.keyframeRefs).toHaveLength(0)
            for (const keyframe of track.keyframeRefs) {
              countedKeyframes += 1
              expect(keyframe.nodeId).toBe(layer.nodeId)
              expect(keyframe.trackId).toBe(track.trackId)
              expect(keyframe.tick).toBeGreaterThanOrEqual(0)
              expect(keyframe.tick).toBeLessThanOrEqual(durationTicks)
              expect(selectionIds.has(keyframe.selectionId), `${definition.id} ${ratio} duplicate ${keyframe.selectionId}`).toBe(false)
              selectionIds.add(keyframe.selectionId)
              expect(projection.keyframesById[keyframe.selectionId]).toBe(keyframe)
            }
          }
        }
        expect(projection.totalTracks).toBe(countedTracks)
        expect(projection.totalKeyframes).toBe(countedKeyframes)
      }
    }
  }, 15_000)
})
