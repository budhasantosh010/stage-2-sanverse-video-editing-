import { describe, expect, it } from 'vitest'
import { FixtureCreativePlanner, PRODUCT_LAUNCH_CREATIVE_DIRECTION_FIXTURE } from '@sanverse/creative-direction'
import {
  applyMotionOperations,
  buildAtomicMotionKeyframeMoveOperations,
  projectMotionDopeSheet,
  projectMotionLayers,
  validateMotionScene,
} from '@sanverse/motion-graph'
import { INITIAL_MOTION_STYLE_PACKS, MOTION_COMPONENT_CATALOG } from '@sanverse/motion-library'
import { ticksForFrame } from '@sanverse/motion-primitives'
import { createCreativePlacementMotionPreview, creativePlacementMotionLabUrl } from './creative-engine-bridge.ts'

const catalog = Object.freeze({
  componentIds: Object.freeze(MOTION_COMPONENT_CATALOG.map((definition) => definition.id)),
  stylePackIds: Object.freeze(INITIAL_MOTION_STYLE_PACKS.map((pack) => pack.id)),
})

const proposal = async () => new FixtureCreativePlanner().propose({ document: PRODUCT_LAUNCH_CREATIVE_DIRECTION_FIXTURE, catalog })

describe('SANVERSE CREATIVE ENGINE ABC-1 integration', () => {
  it('proves every resolved B0 product-launch placement reaches Plan A Motion Scene → C3 Layers → C4 tracks', async () => {
    const planned = await proposal()
    expect(planned.placements).toHaveLength(9)
    for (const placement of planned.placements) {
      expect(placement.selectedComponentId, placement.id).not.toBeNull()
      const preview = createCreativePlacementMotionPreview(placement)
      expect(preview.componentId).toBe(placement.selectedComponentId)
      expect(validateMotionScene(preview.scene).ok, placement.id).toBe(true)
      const layers = projectMotionLayers({ scene: preview.scene })
      const dope = projectMotionDopeSheet(preview.scene)
      expect(layers.layersById[preview.scene.rootNodeId], placement.id).toBeDefined()
      expect(dope.totalTracks, placement.id).toBeGreaterThan(0)
      for (const track of Object.values(dope.tracksById)) expect(preview.scene.nodes[track.nodeId], `${placement.id}:${track.trackId}`).toBeDefined()
      expect(creativePlacementMotionLabUrl(placement), placement.id).toContain(`component=${placement.selectedComponentId!.replace('sanverse.', '')}`)
    }
    const longProductRegion = planned.placements.find((entry) => entry.sourceDirectiveId === 'graphic:workflow-demo')!
    const longPreview = createCreativePlacementMotionPreview(longProductRegion)
    expect(longPreview.sourceEndTicks - longPreview.sourceStartTicks).toBe(25 * 1_440_000)
    expect(longPreview.context.durationTicks).toBeLessThan(longPreview.sourceEndTicks - longPreview.sourceStartTicks)
    expect(longPreview.context.durationTicks).toBe(7 * 1_440_000)
  })

  it('B chooses Semantic Highlight, A supplies Kinetic Headline, C retimes the highlight without rebuilding the component', async () => {
    const planned = await proposal()
    const placement = planned.placements.find((entry) => entry.sourceDirectiveId === 'graphic:semantic-highlight')!
    expect(placement.communicationIntent).toBe('semantic-highlight-statement')
    expect(placement.selectedComponentId).toBe('sanverse.kinetic-headline')
    const preview = createCreativePlacementMotionPreview(placement)
    expect(preview.sourceStartTicks).toBe(placement.startTicks)
    expect(preview.sourceEndTicks).toBe(placement.endTicks)
    const before = projectMotionDopeSheet(preview.scene)
    const highlightTrack = Object.values(before.tracksById).find((track) => track.nodeId.includes('changed') && track.property === 'opacity' && track.keyframeRefs.length >= 2)
    expect(highlightTrack).toBeDefined()
    const key = highlightTrack!.keyframeRefs[1]!
    const deltaTicks = ticksForFrame(1, preview.context.composition)
    const operations = buildAtomicMotionKeyframeMoveOperations({ projection: before, selectionIds: [key.selectionId], deltaTicks, durationTicks: preview.context.durationTicks, nextOperationId: (prefix) => `abc1:${prefix}` })
    const result = applyMotionOperations(preview.scene, operations, { durationTicks: preview.context.durationTicks })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.scene.componentId).toBe(preview.scene.componentId)
    expect(Object.keys(result.scene.nodes)).toEqual(Object.keys(preview.scene.nodes))
    const after = projectMotionDopeSheet(result.scene)
    const moved = after.keyframesById[key.selectionId]
    expect(moved.keyframeId).toBe(key.keyframeId)
    expect(moved.tick).toBe(key.tick + deltaTicks)
    expect(projectMotionLayers({ scene: result.scene }).layersById[key.nodeId]).toBeDefined()
  })

  it('B chooses Scoped Access, A supplies it, C atomically retimes left/right/title/emphasis while stable graph IDs survive', async () => {
    const planned = await proposal()
    const placement = planned.placements.find((entry) => entry.sourceDirectiveId === 'graphic:scoped-access')!
    expect(placement.selectedComponentId).toBe('sanverse.scoped-access-comparison')
    const preview = createCreativePlacementMotionPreview(placement)
    expect(preview.sourceStartTicks).toBe(placement.startTicks)
    expect(preview.sourceEndTicks).toBe(placement.endTicks)
    const before = projectMotionDopeSheet(preview.scene)
    const wantedNodes = ['item:1', 'item:2', '.title', '.value']
    const refs = wantedNodes.map((fragment) => {
      const track = Object.values(before.tracksById).find((candidate) => candidate.nodeId.includes(fragment) && candidate.property === 'opacity' && candidate.keyframeRefs.length >= 2)
      expect(track, fragment).toBeDefined()
      return track!.keyframeRefs[1]!
    })
    const deltaTicks = ticksForFrame(2, preview.context.composition)
    let operationIndex = 0
    const operations = buildAtomicMotionKeyframeMoveOperations({ projection: before, selectionIds: refs.map((ref) => ref.selectionId), deltaTicks, durationTicks: preview.context.durationTicks, nextOperationId: (prefix) => `abc1:${prefix}:${operationIndex++}` })
    expect(operations).toHaveLength(4)
    const result = applyMotionOperations(preview.scene, operations, { durationTicks: preview.context.durationTicks })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.scene.componentId).toBe('sanverse.scoped-access-comparison')
    expect(Object.keys(result.scene.nodes)).toEqual(Object.keys(preview.scene.nodes))
    const after = projectMotionDopeSheet(result.scene)
    for (const ref of refs) {
      expect(after.keyframesById[ref.selectionId].keyframeId).toBe(ref.keyframeId)
      expect(after.keyframesById[ref.selectionId].tick).toBe(ref.tick + deltaTicks)
    }
  })
})
