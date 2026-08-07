import { describe, expect, it } from 'vitest'

import {
  acceptChangeSet,
  addAsset,
  createIdFactory,
  effectiveComposition,
  findClip,
} from '@sanverse/edit-domain'
import {
  testAsset,
  testBrollAsset,
  testChangeSet,
  testProject,
  testSplit,
} from '@sanverse/edit-domain/test-fixtures'
import { isFreezeClip } from '@sanverse/edit-domain/composition'

import { planFreezeFrame } from './timeline-freeze-plan'
import { planLinkedAudioWindow } from './timeline-linked-audio-plan'
import { currentTransitionFor, planTimelineTransition } from './timeline-transition-plan'
import {
  planFitSourceToDuration,
  planPlaceOnTop,
  planReplacePrimary,
  planRippleOverwritePrimary,
  planShufflePrimary,
  planSwapPrimary,
} from './timeline-advanced-placement-plan'

const S = 1_440_000

const withSplit = () => {
  const base = testProject()
  const accepted = acceptChangeSet(base, testChangeSet({
    changeSetId: 'changeset_split0001',
    operations: [testSplit()],
  }))
  if (!accepted.ok) throw new Error('split fixture failed')
  return accepted.value
}

const withSecondAsset = (project = withSplit()) => {
  const asset = testAsset({
    ...testBrollAsset(),
    assetId: 'asset_replacement1',
    sha256: 'e'.repeat(64),
    duration: { ticks: 40 * S, timescale: S },
    hasAudio: true,
  })
  const added = addAsset(project, asset)
  if (!added.ok) throw new Error('asset fixture failed')
  return { project: added.value, asset }
}

describe('T2 remaining timeline planners', () => {
  it('inserts a distinct silent freeze segment instead of pretending speed can be zero', () => {
    const project = withSplit()
    const plan = planFreezeFrame({
      project,
      clipId: 'clip_aaaaaaaa',
      atCompositionTicks: 5 * S,
      durationTicks: 2 * S,
      ids: createIdFactory('changeset_freezet1'),
    })
    expect(plan.ok).toBe(true)
    if (!plan.ok) return
    const accepted = acceptChangeSet(project, testChangeSet({
      changeSetId: 'changeset_freezet1',
      baseRevision: project.revision,
      operations: [plan.operation],
    }))
    expect(accepted.ok).toBe(true)
    if (!accepted.ok) return
    const clips = effectiveComposition(accepted.value).tracks.flatMap((track) => track.clips)
    const freeze = clips.find(isFreezeClip)
    expect(freeze?.freezeDuration?.ticks).toBe(2 * S)
    expect(freeze?.sourceRange.duration.ticks).toBe(1)
  })

  it('plans a J-cut with one linked identity and refuses beyond available source', () => {
    const project = withSplit()
    const second = findClip(effectiveComposition(project), 'clip_bbbbbbbb')
    expect(second).toBeTruthy()
    const j = planLinkedAudioWindow({
      project,
      clipId: 'clip_bbbbbbbb',
      leadTicks: 2 * S,
      tailTicks: 0,
      operationId: 'operation_jcut0001',
    })
    if (!j.ok) throw new Error(`J-cut plan failed: ${j.message}`)
    expect(j.operation.compositionOffsetTicks).toBe(-2 * S)

    const impossible = planLinkedAudioWindow({
      project,
      clipId: 'clip_aaaaaaaa',
      leadTicks: 1 * S,
      tailTicks: 0,
      operationId: 'operation_jcutbad1',
    })
    expect(impossible.ok).toBe(false)
  })

  it('uses one explicit transition edge authority with numeric duration and remove', () => {
    const project = withSplit()
    const plan = planTimelineTransition({
      project,
      clipId: 'clip_aaaaaaaa',
      nextClipId: 'clip_bbbbbbbb',
      style: 'dip-to-white',
      durationTicks: S / 2,
      audio: 'fade-through-silence',
      operationId: 'operation_transt01',
    })
    expect(plan.ok).toBe(true)
    if (!plan.ok) return
    const accepted = acceptChangeSet(project, testChangeSet({
      changeSetId: 'changeset_transt01',
      baseRevision: project.revision,
      operations: [plan.operation],
    }))
    expect(accepted.ok).toBe(true)
    if (!accepted.ok) return
    expect(currentTransitionFor(accepted.value, 'clip_aaaaaaaa', 'clip_bbbbbbbb')).toEqual({
      style: 'dip-to-white',
      durationTicks: S / 2,
      audio: 'fade-through-silence',
    })
  })

  it('fits a source to a chosen duration by reusing rational Rate Stretch', () => {
    const project = withSplit()
    const plan = planFitSourceToDuration({
      project,
      clipId: 'clip_aaaaaaaa',
      targetDurationTicks: 5 * S,
      durationPolicy: 'ripple',
      operationId: 'operation_fittest1',
    })
    if (!plan.ok) throw new Error(`fit plan failed: ${plan.message}`)
    const operation = plan.operations[0] as { kind: string; playbackRate?: { numerator: number; denominator: number } }
    expect(operation.kind).toBe('set-clip-time-transform')
    expect(operation.playbackRate).toEqual({ numerator: 2, denominator: 1 })
  })

  it('places a source on top through the existing V2 collision planner', () => {
    const { project, asset } = withSecondAsset()
    const plan = planPlaceOnTop({
      project,
      assetId: asset.assetId,
      atTicks: 2 * S,
      ids: createIdFactory('changeset_top_test'),
    })
    expect(plan.ok).toBe(true)
    if (plan.ok) expect(plan.operations[0]?.kind).toBe('add-media-overlay')
  })

  it('replaces a slot without changing its duration and without a new operation family', () => {
    const { project, asset } = withSecondAsset()
    const target = findClip(effectiveComposition(project), 'clip_aaaaaaaa')
    expect(target).toBeTruthy()
    const plan = planReplacePrimary({
      project,
      targetClipId: 'clip_aaaaaaaa',
      assetId: asset.assetId,
      ids: createIdFactory('changeset_replace_test'),
    })
    expect(plan.ok).toBe(true)
    if (!plan.ok) return
    expect(plan.operations.map((operation) => operation.kind)).toEqual([
      'place-primary-clip', 'remove-clip', 'move-primary-clip',
    ])
  })

  it('ripple-overwrites a whole primary piece atomically with existing operations', () => {
    const { project, asset } = withSecondAsset()
    const plan = planRippleOverwritePrimary({
      project,
      targetClipId: 'clip_aaaaaaaa',
      assetId: asset.assetId,
      sourceDurationTicks: 6 * S,
      ids: createIdFactory('changeset_ripple_overwrite_test'),
    })
    expect(plan.ok).toBe(true)
    if (plan.ok) {
      expect(plan.operations.some((operation) => operation.kind === 'place-primary-clip')).toBe(true)
      expect(plan.operations.some((operation) => operation.kind === 'remove-clip')).toBe(true)
      expect(plan.operations.some((operation) => operation.kind === 'move-primary-clip')).toBe(true)
    }
  })

  it('swaps two gapless pieces with reorder operations only', () => {
    const project = withSplit()
    const plan = planSwapPrimary({
      project,
      firstClipId: 'clip_aaaaaaaa',
      secondClipId: 'clip_bbbbbbbb',
      ids: createIdFactory('changeset_swaptest1'),
    })
    expect(plan.ok).toBe(true)
    if (plan.ok) expect(plan.operations.every((operation) => operation.kind === 'reorder-clip')).toBe(true)
  })

  it('shuffles deterministically from an explicit seed and never uses hidden randomness', () => {
    const project = withSplit()
    const one = planShufflePrimary({
      project,
      trackId: 'track_aaaaaaaa',
      seed: 42,
      ids: createIdFactory('changeset_shuffl01'),
    })
    const two = planShufflePrimary({
      project,
      trackId: 'track_aaaaaaaa',
      seed: 42,
      ids: createIdFactory('changeset_shuffl01'),
    })
    expect(one).toEqual(two)
    expect(one.ok).toBe(true)
  })
})
