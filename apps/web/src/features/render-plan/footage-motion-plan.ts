import type { FootageMotionNode, RenderPlan } from '@sanverse/render-contract'
import { mediaTime, type MediaTime } from '@sanverse/edit-domain'
import { segmentSourceTicksAt } from '@sanverse/render-contract/picture-layers'

/** Inspector selection stays clip-specific; overlapping footage must not steal its source clock. */
export function selectedFootageSourceTime(plan: RenderPlan | null, nodeId: string | undefined, ticks: number): MediaTime | null {
  const segment = plan?.segments.find(candidate => candidate.nodeId === nodeId)
  const sourceTicks = segment ? segmentSourceTicksAt(segment, ticks) : null
  return sourceTicks === null ? null : mediaTime(sourceTicks)
}

/** Read-only draft projection. The accepted plan and history are never mutated. */
export function withFootageMotionDraft(plan: RenderPlan, assetId: string, draft: FootageMotionNode): RenderPlan {
  const start = draft.sourceInterval.start.ticks
  const end = start + draft.sourceInterval.duration.ticks
  return Object.freeze({ ...plan, segments: Object.freeze(plan.segments.map(segment => {
    const sourceStart = segment.kind === 'freeze-segment' ? segment.sourceTimeTicks : segment.sourceStartTicks
    const sourceEnd = sourceStart + segment.sourceDurationTicks
    if (segment.assetId !== assetId || start >= sourceEnd || end <= sourceStart) return segment
    return Object.freeze({ ...segment, footageMotions: Object.freeze([
      ...segment.footageMotions.filter(motion => motion.motionId !== draft.motionId), draft,
    ]) })
  })) })
}
