import { describe, expect, it } from 'vitest'

import { effectiveComposition } from '@sanverse/edit-domain'

import { buildTimelineViewModel, planRollTrim, planSlideEdit } from '../../features/timeline'
import { createIds, projectWithAllTimelineFamilies, splitProject, ticks } from '../../features/timeline/timeline-test-fixtures'
import { planTimelineTrimViewFrames } from './timeline-trim-view-plan'

const prepared = () => {
  const twice = splitProject(splitProject(projectWithAllTimelineFamilies(), 10, createIds(200)), 20, createIds(300))
  const clips = effectiveComposition(twice).tracks[0].clips
    .slice()
    .sort((a, b) => a.compositionStart.ticks - b.compositionStart.ticks)
  const model = buildTimelineViewModel({ project: twice, selectedItemIds: [], pending: null })
  const videoAsset = twice.assets.find((asset) => asset.mediaKind === 'video')
  if (!videoAsset) throw new Error('video fixture missing')
  const assetFacts = Object.freeze({
    [videoAsset.assetId]: Object.freeze({ assetVersion: videoAsset.sha256, mediaKind: 'video' as const, hasAudio: videoAsset.hasAudio }),
  })
  return { project: twice, clips, model, assetFacts }
}

describe('Timeline Trim View frame planning', () => {
  it('asks only for the exact outgoing and incoming source boundaries of a Roll', () => {
    const { project, clips, model, assetFacts } = prepared()
    const plan = planRollTrim({
      project,
      operationId: 'operation_trimview01',
      leftClipId: clips[0].clipId,
      rightClipId: clips[1].clipId,
      deltaTicks: ticks(1),
      existingItemIds: model.lanes.flatMap((lane) => lane.items.map((item) => item.id)),
    })
    expect(plan.ok).toBe(true)
    if (!plan.ok) return

    const frames = planTimelineTrimViewFrames({ model, assetFacts, plan })
    expect(frames.map((frame) => frame.role)).toEqual(['outgoing', 'incoming'])
    expect(frames).toHaveLength(2)
    expect(frames[0].sourceTicks).toBe(plan.operation.changes[0].sourceRange.start.ticks + plan.operation.changes[0].sourceRange.duration.ticks - 1)
    expect(frames[1].sourceTicks).toBe(plan.operation.changes[1].sourceRange.start.ticks)
  })

  it('caps Slide feedback at four exact frames and does not create a frame sheet', () => {
    const { project, clips, model, assetFacts } = prepared()
    const plan = planSlideEdit({
      project,
      operationId: 'operation_trimview02',
      clipId: clips[1].clipId,
      deltaTicks: ticks(0.5),
      existingItemIds: model.lanes.flatMap((lane) => lane.items.map((item) => item.id)),
    })
    expect(plan.ok).toBe(true)
    if (!plan.ok) return

    const frames = planTimelineTrimViewFrames({ model, assetFacts, plan })
    expect(frames).toHaveLength(4)
    expect(frames.map((frame) => frame.role)).toEqual(['left-boundary', 'source-in', 'source-out', 'right-boundary'])
    expect(new Set(frames.map((frame) => frame.keyId)).size).toBe(frames.length)
    // Precision frames deliberately reuse the hardened filmstrip-frame endpoint;
    // exactness is carried by the unsnapped source tick, not a second media kind.
    expect(frames.every((frame) => frame.key.kind === 'filmstrip-frame')).toBe(true)
  })
})
