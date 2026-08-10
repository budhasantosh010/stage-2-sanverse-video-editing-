import { describe, expect, it } from 'vitest'
import { createMotionAuthoringMetadata, evaluateScene, projectMotionLayers, validateMotionScene } from '@sanverse/motion-graph'
import { SANVERSE_TICKS_PER_SECOND } from '@sanverse/motion-primitives'
import { RATIO_COMPOSITIONS } from '@sanverse/motion-testing'
import type { MotionRenderContextV1 } from '@sanverse/motion-contract'
import type { MotionSceneV1 } from '@sanverse/motion-graph'
import { MOTION_COMPONENT_CATALOG, MOTION_COMPONENT_MODULES } from './catalog.ts'

describe('MOTION-C3 all-component layer projection', () => {
  it('projects every public component at all four reference ratios with one layer per graph node', () => {
    expect(MOTION_COMPONENT_CATALOG).toHaveLength(83)
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
        const resolved = evaluateScene(scene, context)
        const projection = projectMotionLayers({ scene, resolvedScene: resolved, authoringMetadata: createMotionAuthoringMetadata() })
        const graphIds = Object.keys(scene.nodes).sort()
        const layerIds = Object.keys(projection.layersById).sort()
        expect(layerIds, `${definition.id} ${ratio}`).toEqual(graphIds)
        expect(new Set(projection.preorderNodeIds).size, `${definition.id} ${ratio}`).toBe(graphIds.length)
        expect(projection.preorderNodeIds[0], `${definition.id} ${ratio}`).toBe(scene.rootNodeId)
        for (const nodeId of graphIds) {
          const node = scene.nodes[nodeId]!
          const layer = projection.layersById[nodeId]!
          expect(layer.nodeId).toBe(node.id)
          expect(layer.parentNodeId).toBe(node.parentId)
          expect(layer.childNodeIds).toEqual(node.type === 'group' ? node.childIds : [])
          expect(layer.depth).toBeGreaterThanOrEqual(0)
          expect(layer.displayName.trim().length).toBeGreaterThan(0)
          if (node.parentId) expect(projection.layersById[node.parentId], `${definition.id}:${nodeId} parent`).toBeDefined()
        }
      }
    }
  })
})
