import type { PrimarySegmentNode, RenderNode, RenderPlan } from './render-plan.ts'

/** Call only on a validated plan. The array is paint order, bottom to top. */
export function pictureNodesAt(plan: RenderPlan, ticks: number): readonly (PrimarySegmentNode | RenderNode)[] {
  if (!Number.isSafeInteger(ticks) || ticks < 0 || ticks >= plan.durationTicks) return []
  const nodes = [...plan.segments, ...plan.overlays]
  const byId = new Map(nodes.map(node => [node.nodeId, node]))
  const ordered = plan.pictureLayers ? plan.pictureLayers.flatMap(layer => layer.nodeIds.map(id => byId.get(id)!)) : nodes
  return ordered.filter(node => ticks >= node.interval.start.ticks && ticks < node.interval.start.ticks + node.interval.duration.ticks && (!('videoEnabled' in node) || node.videoEnabled))
}
/** Half-open source mapping, with the domain's integer half-up retiming rule. */
export function segmentSourceTicksAt(segment: PrimarySegmentNode, ticks: number): number | null {
  const offset = ticks - segment.interval.start.ticks
  if (!Number.isSafeInteger(ticks) || offset < 0 || offset >= segment.interval.duration.ticks) return null
  if (segment.kind === 'freeze-segment') return segment.sourceTimeTicks
  const n = BigInt(segment.playbackRateNumerator)
  const d = BigInt(segment.playbackRateDenominator)
  const advanced = Number((2n * BigInt(offset) * n + d) / (2n * d))
  const bounded = Math.min(segment.sourceDurationTicks - 1, advanced)
  return segment.sourceStartTicks + (segment.direction === 'reverse' ? segment.sourceDurationTicks - 1 - bounded : bounded)
}
