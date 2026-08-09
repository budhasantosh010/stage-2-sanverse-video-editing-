import { frameForTicks, ticksForFrame } from '@sanverse/motion-primitives'
import type { MotionCompositionV1 } from '@sanverse/motion-contract'
import type { MotionGraphOperationV1 } from './operations.ts'
import type { MotionKeyframeTargetV1, MotionKeyframeV1, MotionPropertyPrimitiveV1 } from './properties.ts'
import { deriveTimelineTrackGroups } from './projections.ts'
import type { MotionTimelineTrackV1 } from './projections.ts'
import type { MotionSceneV1 } from './scene.ts'

export interface MotionDopeSheetKeyframeV1 {
  readonly selectionId: string
  readonly trackId: string
  readonly nodeId: string
  readonly target: MotionKeyframeTargetV1
  readonly keyframeId: string
  readonly tick: number
  readonly value: MotionPropertyPrimitiveV1
  readonly interpolation: MotionKeyframeV1<MotionPropertyPrimitiveV1>['interpolation']
  readonly bezier?: MotionKeyframeV1<MotionPropertyPrimitiveV1>['bezier']
}

export interface MotionDopeSheetTrackV1 extends MotionTimelineTrackV1 {
  readonly trackId: string
  readonly keyframeRefs: readonly MotionDopeSheetKeyframeV1[]
}

export interface MotionDopeSheetLayerV1 {
  readonly nodeId: string
  readonly nodeName: string
  readonly tracks: readonly MotionDopeSheetTrackV1[]
}

export interface MotionDopeSheetProjectionV1 {
  readonly layers: readonly MotionDopeSheetLayerV1[]
  readonly tracksById: Readonly<Record<string, MotionDopeSheetTrackV1>>
  readonly keyframesById: Readonly<Record<string, MotionDopeSheetKeyframeV1>>
  readonly totalTracks: number
  readonly totalKeyframes: number
}

export const motionTimelineTargetKey = (target: MotionKeyframeTargetV1): string => target.kind === 'node'
  ? `node:${target.nodeId}:${target.property}`
  : target.kind === 'effect'
    ? `effect:${target.nodeId}:${target.effectId}:${target.parameter}`
    : `mask:${target.nodeId}:${target.maskId}:${target.property}`

export const motionDopeSheetSelectionId = (target: MotionKeyframeTargetV1, keyframeId: string): string => `${motionTimelineTargetKey(target)}::${keyframeId}`

export const projectMotionDopeSheet = (scene: MotionSceneV1): MotionDopeSheetProjectionV1 => {
  const tracksById: Record<string, MotionDopeSheetTrackV1> = {}
  const keyframesById: Record<string, MotionDopeSheetKeyframeV1> = {}
  let totalKeyframes = 0
  const layers = deriveTimelineTrackGroups(scene).map((group): MotionDopeSheetLayerV1 => Object.freeze({
    nodeId: group.nodeId,
    nodeName: group.nodeName,
    tracks: Object.freeze(group.tracks.map((track): MotionDopeSheetTrackV1 => {
      const trackId = motionTimelineTargetKey(track.target)
      const keyframeRefs = Object.freeze(track.keyframes.map((keyframe): MotionDopeSheetKeyframeV1 => {
        const selectionId = motionDopeSheetSelectionId(track.target, keyframe.id)
        const ref = Object.freeze({
          selectionId,
          trackId,
          nodeId: track.nodeId,
          target: track.target,
          keyframeId: keyframe.id,
          tick: keyframe.tick,
          value: keyframe.value,
          interpolation: keyframe.interpolation,
          ...(keyframe.bezier ? { bezier: keyframe.bezier } : {}),
        })
        keyframesById[selectionId] = ref
        totalKeyframes += 1
        return ref
      }))
      const projected = Object.freeze({ ...track, trackId, keyframeRefs })
      tracksById[trackId] = projected
      return projected
    })),
  }))
  return Object.freeze({
    layers: Object.freeze(layers),
    tracksById: Object.freeze(tracksById),
    keyframesById: Object.freeze(keyframesById),
    totalTracks: Object.keys(tracksById).length,
    totalKeyframes,
  })
}

export interface MotionKeyframeSelectionStateV1 {
  readonly selectedIds: readonly string[]
  readonly primaryId: string | null
  readonly anchorId: string | null
}

export const createMotionKeyframeSelection = (
  selectedIds: readonly string[] = [],
  primaryId: string | null = selectedIds.at(-1) ?? null,
  anchorId: string | null = selectedIds[0] ?? null,
): MotionKeyframeSelectionStateV1 => Object.freeze({ selectedIds: Object.freeze([...new Set(selectedIds)]), primaryId, anchorId })

export const selectMotionKeyframe = (selectionId: string): MotionKeyframeSelectionStateV1 => createMotionKeyframeSelection([selectionId], selectionId, selectionId)

export const toggleMotionKeyframeSelection = (state: MotionKeyframeSelectionStateV1, selectionId: string): MotionKeyframeSelectionStateV1 => {
  const selected = new Set(state.selectedIds)
  if (selected.has(selectionId)) selected.delete(selectionId); else selected.add(selectionId)
  const values = [...selected]
  return createMotionKeyframeSelection(values, selected.has(selectionId) ? selectionId : values.at(-1) ?? null, state.anchorId ?? selectionId)
}

export const selectMotionKeyframeRange = (
  state: MotionKeyframeSelectionStateV1,
  selectionId: string,
  orderedIds: readonly string[],
): MotionKeyframeSelectionStateV1 => {
  const anchor = state.anchorId && orderedIds.includes(state.anchorId) ? state.anchorId : selectionId
  const a = orderedIds.indexOf(anchor), b = orderedIds.indexOf(selectionId)
  if (a < 0 || b < 0) return selectMotionKeyframe(selectionId)
  const start = Math.min(a, b), end = Math.max(a, b)
  return createMotionKeyframeSelection(orderedIds.slice(start, end + 1), selectionId, anchor)
}

export interface MotionTimelineSnapInputV1 {
  readonly tick: number
  readonly durationTicks: number
  readonly composition: MotionCompositionV1
  readonly otherKeyframeTicks?: readonly number[]
  readonly eventTicks?: readonly number[]
  readonly thresholdTicks?: number
}

export interface MotionTimelineSnapResultV1 {
  readonly tick: number
  readonly source: 'frame' | 'start' | 'end' | 'keyframe' | 'event' | null
  readonly sourceTick: number | null
}

export const snapMotionTimelineTick = (input: MotionTimelineSnapInputV1): MotionTimelineSnapResultV1 => {
  const raw = Math.max(0, Math.min(input.durationTicks, Math.round(input.tick)))
  const lowerFrame = frameForTicks(raw, input.composition)
  const lowerFrameTick = ticksForFrame(lowerFrame, input.composition)
  const upperFrameTick = ticksForFrame(lowerFrame + 1, input.composition)
  const nearestFrameTick = Math.abs(raw - lowerFrameTick) <= Math.abs(upperFrameTick - raw) ? lowerFrameTick : upperFrameTick
  const frameTick = Math.max(0, Math.min(input.durationTicks, nearestFrameTick))
  const candidates: Array<Readonly<{ tick: number; source: Exclude<MotionTimelineSnapResultV1['source'], null> }>> = [
    { tick: frameTick, source: 'frame' },
    { tick: 0, source: 'start' },
    { tick: input.durationTicks, source: 'end' },
    ...(input.otherKeyframeTicks ?? []).map((tick) => ({ tick, source: 'keyframe' as const })),
    ...(input.eventTicks ?? []).map((tick) => ({ tick, source: 'event' as const })),
  ]
  const frameDurationTicks = Math.max(1, ticksForFrame(1, input.composition) - ticksForFrame(0, input.composition))
  const threshold = input.thresholdTicks ?? Math.max(1, Math.round(frameDurationTicks * 0.45))
  let best: (typeof candidates)[number] | null = null, bestDistance = Number.POSITIVE_INFINITY
  for (const candidate of candidates) {
    if (!Number.isSafeInteger(candidate.tick) || candidate.tick < 0 || candidate.tick > input.durationTicks) continue
    const distance = Math.abs(candidate.tick - raw)
    if (distance < bestDistance || (distance === bestDistance && candidate.source !== 'frame' && best?.source === 'frame')) { best = candidate; bestDistance = distance }
  }
  return best && bestDistance <= threshold
    ? Object.freeze({ tick: best.tick, source: best.source, sourceTick: best.tick })
    : Object.freeze({ tick: raw, source: null, sourceTick: null })
}

export const buildAtomicMotionKeyframeMoveOperations = (input: Readonly<{
  projection: MotionDopeSheetProjectionV1
  selectionIds: readonly string[]
  deltaTicks: number
  durationTicks: number
  nextOperationId: (prefix: string) => string
}>): readonly MotionGraphOperationV1[] => {
  if (!Number.isSafeInteger(input.deltaTicks)) throw new RangeError('deltaTicks must be an exact safe integer.')
  const refs = input.selectionIds.map((id) => input.projection.keyframesById[id]).filter((ref): ref is MotionDopeSheetKeyframeV1 => Boolean(ref))
  const ordered = [...refs].sort((a, b) => input.deltaTicks >= 0 ? b.tick - a.tick : a.tick - b.tick)
  const operations: MotionGraphOperationV1[] = []
  for (const ref of ordered) {
    const tick = ref.tick + input.deltaTicks
    if (!Number.isSafeInteger(tick) || tick < 0 || tick > input.durationTicks) throw new RangeError(`keyframe ${ref.keyframeId} would move outside the composition.`)
    operations.push(Object.freeze({ operationId: input.nextOperationId('c4-move-keyframe'), type: 'move-keyframe', target: ref.target, keyframeId: ref.keyframeId, tick }))
  }
  return Object.freeze(operations)
}

export const buildMotionKeyframeDeleteOperations = (input: Readonly<{
  projection: MotionDopeSheetProjectionV1
  selectionIds: readonly string[]
  nextOperationId: (prefix: string) => string
}>): readonly MotionGraphOperationV1[] => Object.freeze(input.selectionIds.map((id) => input.projection.keyframesById[id]).filter((ref): ref is MotionDopeSheetKeyframeV1 => Boolean(ref)).map((ref): MotionGraphOperationV1 => Object.freeze({ operationId: input.nextOperationId('c4-remove-keyframe'), type: 'remove-keyframe', target: ref.target, keyframeId: ref.keyframeId })))
