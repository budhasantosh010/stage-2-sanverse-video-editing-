import { describe, expect, it } from 'vitest'
import {
  applyMotionOperations,
  constant,
  createDefaultEffect,
  createDefaultMask,
  createMotionScene,
  deriveTimelineTrackGroups,
  deriveTimelineTracks,
  keyframed,
  nodeBase,
} from './index.ts'

const scene = () => {
  const root = Object.freeze({ ...nodeBase('root', 'Cost Card', null), type: 'group' as const, childIds: Object.freeze(['value']) })
  const value = Object.freeze({
    ...nodeBase('value', 'Value', 'root'), type: 'shape' as const, shape: 'rounded-rectangle' as const,
    width: constant(400), height: constant(240), fillColor: constant('#ffffff'), strokeColor: constant('#000000'), strokeWidth: constant(0), radius: constant(24),
    transform: Object.freeze({ ...nodeBase('tmp', 'tmp', null).transform, positionX: keyframed([{ id: 'x0', tick: 0, value: 0, interpolation: 'linear' }, { id: 'x1', tick: 1000, value: 100, interpolation: 'linear' }]) }),
    effects: Object.freeze([createDefaultEffect('glow', 'glow')]), masks: Object.freeze([createDefaultMask('mask', 'rounded-rectangle')]),
  })
  return createMotionScene({ componentId: 'sanverse.timeline-projection-test', componentVersion: 1, rootNodeId: 'root', nodes: Object.freeze({ root, value }), semanticParts: Object.freeze([{ id: 'value', label: 'Value', role: 'content-group', nodeIds: Object.freeze(['value']) }]), exposures: Object.freeze([]), layout: Object.freeze({ mode: 'responsive' as const, ownership: Object.freeze([]), formatOverrides: Object.freeze([]) }), supportedAspectRatios: Object.freeze(['16:9'] as const) })
}

describe('C2 timeline-track projection', () => {
  it('projects full typed keyframe data for node, effect and mask properties', () => {
    const modified = applyMotionOperations(scene(), [
      { operationId: 'glow0', type: 'add-keyframe', target: { kind: 'effect', nodeId: 'value', effectId: 'glow', parameter: 'intensity' }, keyframeId: 'g0', tick: 0, value: 0, interpolation: 'linear' },
      { operationId: 'glow1', type: 'add-keyframe', target: { kind: 'effect', nodeId: 'value', effectId: 'glow', parameter: 'intensity' }, keyframeId: 'g1', tick: 1000, value: 0.6, interpolation: 'bezier', bezier: { inX: 0.8, inY: 1, outX: 0.2, outY: 0.8 } },
      { operationId: 'mask0', type: 'add-keyframe', target: { kind: 'mask', nodeId: 'value', maskId: 'mask', property: 'feather' }, keyframeId: 'm0', tick: 0, value: 0, interpolation: 'linear' },
      { operationId: 'mask1', type: 'add-keyframe', target: { kind: 'mask', nodeId: 'value', maskId: 'mask', property: 'feather' }, keyframeId: 'm1', tick: 1000, value: 0.5, interpolation: 'linear' },
    ], { durationTicks: 1000 })
    expect(modified.ok).toBe(true)
    if (!modified.ok) return
    const tracks = deriveTimelineTracks(modified.scene)
    expect(tracks).toEqual(expect.arrayContaining([
      expect.objectContaining({ target: { kind: 'node', nodeId: 'value', property: 'transform.positionX' }, nodeName: 'Value', propertyType: 'number', animationKind: 'keyframes', keyframeTicks: [0, 1000], keyframes: expect.arrayContaining([expect.objectContaining({ id: 'x0' }), expect.objectContaining({ id: 'x1' })]) }),
      expect.objectContaining({ target: { kind: 'effect', nodeId: 'value', effectId: 'glow', parameter: 'intensity' }, property: 'effect.glow.intensity', propertyType: 'number', animationKind: 'keyframes', keyframeTicks: [0, 1000] }),
      expect.objectContaining({ target: { kind: 'mask', nodeId: 'value', maskId: 'mask', property: 'feather' }, property: 'mask.mask.feather', propertyType: 'number', animationKind: 'keyframes', keyframeTicks: [0, 1000] }),
    ]))
  })

  it('groups tracks by the real layer node for later C3/C4 UI without creating another animation store', () => {
    const groups = deriveTimelineTrackGroups(scene())
    expect(groups).toEqual([expect.objectContaining({ nodeId: 'value', nodeName: 'Value', tracks: expect.arrayContaining([expect.objectContaining({ property: 'transform.positionX' })]) })])
  })
})
