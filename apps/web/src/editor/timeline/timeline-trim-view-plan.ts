import type { PrimaryClipTimingChangeV1 } from '@sanverse/edit-domain'

import { mediaAnalysisKeyId, precisionFrameKey, type AssetFacts, type MediaAnalysisKeyV1 } from '../../features/media-analysis'
import type { PrecisionTrimPlan, TimelineItemView, TimelineViewModel } from '../../features/timeline'

export type TimelineTrimViewFrameV1 = Readonly<{
  role: 'source-in' | 'source-out' | 'outgoing' | 'incoming' | 'left-boundary' | 'right-boundary'
  label: string
  clipId: string
  clipLabel: string
  sourceTicks: number
  key: MediaAnalysisKeyV1
  keyId: string
}>

const itemForClip = (model: TimelineViewModel, clipId: string): TimelineItemView | null => {
  for (const lane of model.lanes) {
    const item = lane.items.find((candidate) => candidate.clipId === clipId && candidate.kind === 'clip')
    if (item) return item
  }
  return null
}

const frameFor = (
  model: TimelineViewModel,
  assetFacts: Readonly<Record<string, AssetFacts>>,
  change: PrimaryClipTimingChangeV1,
  role: TimelineTrimViewFrameV1['role'],
  sourceTicks: number,
  label: string,
): TimelineTrimViewFrameV1 | null => {
  const item = itemForClip(model, change.clipId)
  if (!item?.assetId) return null
  const facts = assetFacts[item.assetId]
  if (!facts) return null
  const key = precisionFrameKey({
    assetId: item.assetId,
    assetVersion: facts.assetVersion,
    sourceTicks,
    widthPx: 224,
  })
  return Object.freeze({
    role,
    label,
    clipId: change.clipId,
    clipLabel: item.label,
    sourceTicks: key.sourceTicks,
    key,
    keyId: mediaAnalysisKeyId(key),
  })
}

const sourceIn = (change: PrimaryClipTimingChangeV1): number => change.sourceRange.start.ticks
const sourceOutFrame = (change: PrimaryClipTimingChangeV1): number =>
  Math.max(change.sourceRange.start.ticks, change.sourceRange.start.ticks + change.sourceRange.duration.ticks - 1)

/**
 * Bounded frame request plan for the active precision edit only.
 *
 * This is deliberately separate from filmstrip planning: filmstrips sample a
 * coarse reusable grid while trim feedback must show the exact source boundary
 * proposed by the same precision plan that will be committed. The result is
 * capped at four frames, so a pointer drag never turns into a full frame sheet.
 */
export const planTimelineTrimViewFrames = (input: Readonly<{
  model: TimelineViewModel
  assetFacts: Readonly<Record<string, AssetFacts>>
  plan: Extract<PrecisionTrimPlan, { ok: true }>
}>): readonly TimelineTrimViewFrameV1[] => {
  const { model, assetFacts, plan } = input
  const changes = [...plan.operation.changes]
  const selectedId = plan.operation.clipId
  const selected = changes.find((change) => change.clipId === selectedId) ?? changes[0]
  if (!selected) return Object.freeze([])

  const frames: Array<TimelineTrimViewFrameV1 | null> = []
  const mode = plan.feedback.mode

  if (mode === 'roll') {
    const left = selected
    const right = changes.find((change) => change.clipId !== left.clipId)
    frames.push(frameFor(model, assetFacts, left, 'outgoing', sourceOutFrame(left), 'Outgoing'))
    if (right) frames.push(frameFor(model, assetFacts, right, 'incoming', sourceIn(right), 'Incoming'))
  } else if (mode === 'slide') {
    const ordered = changes.sort((a, b) => a.compositionStart.ticks - b.compositionStart.ticks || a.clipId.localeCompare(b.clipId))
    const selectedIndex = ordered.findIndex((change) => change.clipId === selectedId)
    const left = selectedIndex > 0 ? ordered[selectedIndex - 1] : null
    const middle = selectedIndex >= 0 ? ordered[selectedIndex] : selected
    const right = selectedIndex >= 0 && selectedIndex < ordered.length - 1 ? ordered[selectedIndex + 1] : null
    if (left) frames.push(frameFor(model, assetFacts, left, 'left-boundary', sourceOutFrame(left), 'Left boundary'))
    frames.push(frameFor(model, assetFacts, middle, 'source-in', sourceIn(middle), 'Selected In'))
    frames.push(frameFor(model, assetFacts, middle, 'source-out', sourceOutFrame(middle), 'Selected Out'))
    if (right) frames.push(frameFor(model, assetFacts, right, 'right-boundary', sourceIn(right), 'Right boundary'))
  } else {
    frames.push(frameFor(model, assetFacts, selected, 'source-in', sourceIn(selected), mode === 'slip' ? 'New Source In' : 'Source In'))
    frames.push(frameFor(model, assetFacts, selected, 'source-out', sourceOutFrame(selected), mode === 'slip' ? 'New Source Out' : 'Source Out'))
  }

  return Object.freeze(frames.filter((frame): frame is TimelineTrimViewFrameV1 => frame !== null).slice(0, 4))
}
