import { describe, expect, it } from 'vitest'
import {
  applyMotionOperations,
  buildAtomicMotionKeyframeMoveOperations,
  buildMotionKeyframeDeleteOperations,
  constant,
  createMotionKeyframeSelection,
  createMotionScene,
  keyframed,
  motionDopeSheetSelectionId,
  nodeBase,
  projectMotionDopeSheet,
  selectMotionKeyframe,
  selectMotionKeyframeRange,
  snapMotionTimelineTick,
  toggleMotionKeyframeSelection,
} from './index.ts'
import type { MotionCompositionV1 } from '@sanverse/motion-contract'

const composition: MotionCompositionV1 = Object.freeze({ width: 1920, height: 1080, fpsNumerator: 30, fpsDenominator: 1 })
const scene = () => {
  const root = Object.freeze({ ...nodeBase('root', 'Root', null), type: 'group' as const, childIds: Object.freeze(['value']) })
  const value = Object.freeze({
    ...nodeBase('value', 'Value', 'root'), type: 'shape' as const, shape: 'rounded-rectangle' as const,
    width: constant(400), height: constant(240), fillColor: constant('#fff'), strokeColor: constant('#000'), strokeWidth: constant(0), radius: constant(24),
    transform: Object.freeze({
      ...nodeBase('tmp', 'tmp', null).transform,
      positionX: keyframed([
        { id: 'x0', tick: 0, value: 0, interpolation: 'hold' },
        { id: 'x1', tick: 48000, value: 100, interpolation: 'linear' },
        { id: 'x2', tick: 96000, value: 200, interpolation: 'bezier', bezier: { inX: .7, inY: 1, outX: .2, outY: .8 } },
      ]),
      opacity: undefined,
    }),
  })
  // Remove the temporary invalid field introduced only by object spread construction.
  const normalizedValue = Object.freeze({ ...value, transform: Object.freeze({ ...value.transform }) })
  return createMotionScene({ componentId: 'sanverse.c4-test', componentVersion: 1, rootNodeId: 'root', nodes: Object.freeze({ root, value: normalizedValue }), semanticParts: Object.freeze([]), exposures: Object.freeze([]), layout: Object.freeze({ mode: 'responsive' as const, ownership: Object.freeze([]), formatOverrides: Object.freeze([]) }), supportedAspectRatios: Object.freeze(['16:9'] as const) })
}

describe('C4 derived dope-sheet model', () => {
  it('projects stable keyframe refs from C2 tracks without creating another store', () => {
    const source = scene()
    const projection = projectMotionDopeSheet(source)
    expect(projection.layers).toHaveLength(1)
    expect(projection.totalTracks).toBe(1)
    expect(projection.totalKeyframes).toBe(3)
    const track = projection.layers[0]!.tracks[0]!
    expect(track.target).toEqual({ kind: 'node', nodeId: 'value', property: 'transform.positionX' })
    expect(track.animationKind).toBe('keyframes')
    expect(track.keyframeRefs.map((entry) => entry.keyframeId)).toEqual(['x0', 'x1', 'x2'])
    expect(track.keyframeRefs[0]?.selectionId).toBe(motionDopeSheetSelectionId(track.target, 'x0'))
    expect(source.nodes.value?.transform.positionX.kind).toBe('keyframes')
  })

  it('supports canonical single/toggle/range keyframe selection over stable IDs', () => {
    const ids = projectMotionDopeSheet(scene()).layers[0]!.tracks[0]!.keyframeRefs.map((entry) => entry.selectionId)
    let selection = selectMotionKeyframe(ids[0]!)
    selection = toggleMotionKeyframeSelection(selection, ids[2]!)
    expect(selection.selectedIds).toEqual([ids[0], ids[2]])
    selection = selectMotionKeyframeRange(createMotionKeyframeSelection([ids[0]!], ids[0]!, ids[0]!), ids[2]!, ids)
    expect(selection.selectedIds).toEqual(ids)
    expect(selection.primaryId).toBe(ids[2])
  })

  it('snaps to frame boundaries, composition edges, other keys and event markers within threshold', () => {
    expect(snapMotionTimelineTick({ tick: 48002, durationTicks: 1_440_000, composition }).tick).toBe(48000)
    expect(snapMotionTimelineTick({ tick: 370000, durationTicks: 1_440_000, composition }).tick).toBe(384000)
    expect(snapMotionTimelineTick({ tick: 10, durationTicks: 1_440_000, composition }).source).toBe('start')
    expect(snapMotionTimelineTick({ tick: 222010, durationTicks: 1_440_000, composition, otherKeyframeTicks: [222000], thresholdTicks: 100 }).source).toBe('keyframe')
    expect(snapMotionTimelineTick({ tick: 333020, durationTicks: 1_440_000, composition, eventTicks: [333000], thresholdTicks: 100 }).source).toBe('event')
    expect(snapMotionTimelineTick({ tick: 12345, durationTicks: 1_440_000, composition, thresholdTicks: 1 })).toEqual({ tick: 12345, source: null, sourceTick: null })
  })

  it('builds positive multi-moves in descending tick order to avoid transient selected-key collisions', () => {
    const projection = projectMotionDopeSheet(scene())
    const ids = projection.layers[0]!.tracks[0]!.keyframeRefs.slice(1).map((entry) => entry.selectionId)
    let counter = 0
    const operations = buildAtomicMotionKeyframeMoveOperations({ projection, selectionIds: ids, deltaTicks: 48000, durationTicks: 192000, nextOperationId: () => `move:${counter++}` })
    expect(operations.map((operation) => operation.type === 'move-keyframe' ? operation.keyframeId : '')).toEqual(['x2', 'x1'])
    const result = applyMotionOperations(scene(), operations, { durationTicks: 192000 })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    const ticks = projectMotionDopeSheet(result.scene).layers[0]!.tracks[0]!.keyframeRefs.map((entry) => entry.tick)
    expect(ticks).toEqual([0, 96000, 144000])
  })

  it('builds negative multi-moves in ascending order and preserves relative spacing', () => {
    const projection = projectMotionDopeSheet(scene())
    const ids = projection.layers[0]!.tracks[0]!.keyframeRefs.slice(1).map((entry) => entry.selectionId)
    let counter = 0
    const operations = buildAtomicMotionKeyframeMoveOperations({ projection, selectionIds: ids, deltaTicks: -24000, durationTicks: 192000, nextOperationId: () => `move:${counter++}` })
    expect(operations.map((operation) => operation.type === 'move-keyframe' ? operation.keyframeId : '')).toEqual(['x1', 'x2'])
    const result = applyMotionOperations(scene(), operations, { durationTicks: 192000 })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(projectMotionDopeSheet(result.scene).layers[0]!.tracks[0]!.keyframeRefs.map((entry) => entry.tick)).toEqual([0, 24000, 72000])
  })

  it('rejects a multi-move that would exit composition bounds before any operation is emitted', () => {
    const projection = projectMotionDopeSheet(scene())
    expect(() => buildAtomicMotionKeyframeMoveOperations({ projection, selectionIds: [projection.layers[0]!.tracks[0]!.keyframeRefs[0]!.selectionId], deltaTicks: -1, durationTicks: 192000, nextOperationId: () => 'bad' })).toThrow(RangeError)
  })

  it('builds one typed delete operation per selected C2 keyframe', () => {
    const projection = projectMotionDopeSheet(scene())
    const ids = projection.layers[0]!.tracks[0]!.keyframeRefs.slice(0, 2).map((entry) => entry.selectionId)
    let counter = 0
    const operations = buildMotionKeyframeDeleteOperations({ projection, selectionIds: ids, nextOperationId: () => `delete:${counter++}` })
    expect(operations).toHaveLength(2)
    const result = applyMotionOperations(scene(), operations, { durationTicks: 192000 })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(projectMotionDopeSheet(result.scene).totalKeyframes).toBe(1)
  })
})
