import { describe, expect, it } from 'vitest'

import {
  effectiveComposition,
  mediaTime,
  type Clip,
  type EditProject,
} from '@sanverse/edit-domain'
import { DEFAULT_CLIP_TIME_TRANSFORM } from '@sanverse/edit-domain/clip-time'
import { clipCompositionDurationTicks, clipCompositionEndTicks } from '@sanverse/edit-domain/composition'
import { ms, testAsset, testProject } from '@sanverse/edit-domain/test-fixtures'

import {
  newPrecisionTrimSession,
  planMultiEditPointTrim,
  planRippleTrim,
  planRollTrim,
  planSlideEdit,
  planSlipEdit,
  planStandardTrim,
  updatePrecisionTrimSession,
} from './timeline-precision-trim'

const ids = ['clip_aaaaaaaa', 'clip_bbbbbbbb', 'clip_cccccccc', 'clip_dddddddd'] as const

const fixture = (input: Readonly<{
  speedClip?: number
  reverseClip?: number
  linkedClip?: number
  transition?: boolean
  freezeClip?: number
  groupClip?: number
}> = {}): EditProject => {
  const asset = testAsset({ duration: ms(80_000) })
  const base = testProject(asset)
  const template = base.composition.tracks[0].clips[0]
  const sourceStarts = [5_000, 20_000, 35_000, 50_000]
  let cursor = 0
  const clips: Clip[] = ids.map((clipId, index) => {
    const rate = input.speedClip === index ? Object.freeze({ numerator: 2, denominator: 1 }) : DEFAULT_CLIP_TIME_TRANSFORM.playbackRate
    const direction = input.reverseClip === index ? 'reverse' as const : 'forward' as const
    const sourceRange = Object.freeze({ start: ms(sourceStarts[index]), duration: ms(10_000) })
    const compositionStart = mediaTime(cursor)
    const timeTransform = Object.freeze({ playbackRate: rate, direction, maintainAudioPitch: true })
    const picture: Clip = Object.freeze({
      ...template,
      clipId,
      sourceRange,
      compositionStart,
      timeTransform,
      segmentKind: 'video',
      freezeDuration: null,
      linkedAudio: null,
    })
    cursor += clipCompositionDurationTicks(picture)
    if (input.freezeClip === index) {
      const frozen: Clip = Object.freeze({
        ...picture,
        sourceRange: Object.freeze({ start: ms(sourceStarts[index] + 2_000), duration: mediaTime(1) }),
        segmentKind: 'freeze',
        freezeDuration: ms(1_000),
        linkedAudio: null,
        timeTransform: DEFAULT_CLIP_TIME_TRANSFORM,
      })
      cursor = compositionStart.ticks + 1_000 * 1_440
      return frozen
    }
    if (input.linkedClip === index) {
      return Object.freeze({
        ...picture,
        linkedAudio: Object.freeze({
          sourceRange: Object.freeze({ start: ms(sourceStarts[index] - 500), duration: ms(11_000) }),
          compositionOffsetTicks: -ms(500).ticks,
        }),
      })
    }
    return picture
  })
  // If a freeze changed one duration, restore exact adjacency for everything after it.
  let nextStart = 0
  const adjacent = clips.map((clip) => {
    const result = Object.freeze({ ...clip, compositionStart: mediaTime(nextStart) })
    nextStart += clipCompositionDurationTicks(result)
    return result
  })
  let project: EditProject = Object.freeze({
    ...base,
    composition: Object.freeze({
      ...base.composition,
      tracks: Object.freeze([Object.freeze({ ...base.composition.tracks[0], clips: Object.freeze(adjacent) })]),
    }),
  })
  const records = [...project.changeSets]
  const issued = [...project.issuedChangeSetIds]
  if (input.transition) {
    const left = adjacent[1]
    const right = adjacent[2]
    const changeSetId = 'changeset_transition01'
    records.push(Object.freeze({
      active: true,
      blockedReason: null,
      changeSet: Object.freeze({
        schemaVersion: 'sanverse.change-set/v1',
        changeSetId,
        baseRevision: project.revision,
        operations: Object.freeze([Object.freeze({
          schemaVersion: 'sanverse.operation/v3',
          operationId: 'operation_transition01',
          capabilityId: 'sanverse.timeline.transition.primitive/v1',
          kind: 'set-clip-transition' as const,
          clipId: left.clipId,
          nextClipId: right.clipId,
          style: 'dip-to-black' as const,
          duration: ms(1_000),
          audio: 'cut' as const,
          extensions: Object.freeze({}),
        })]),
        provenance: Object.freeze({ source: 'direct' as const, requestId: null }),
        extensions: Object.freeze({}),
      }),
    }))
    issued.push(changeSetId)
  }
  if (input.groupClip !== undefined) {
    const changeSetId = 'changeset_groups0001'
    records.push(Object.freeze({
      active: true,
      blockedReason: null,
      changeSet: Object.freeze({
        schemaVersion: 'sanverse.change-set/v1',
        changeSetId,
        baseRevision: project.revision,
        operations: Object.freeze([Object.freeze({
          schemaVersion: 'sanverse.operation/v3',
          operationId: 'operation_groups0001',
          capabilityId: 'sanverse.timeline.groups.primitive/v1',
          kind: 'set-timeline-groups' as const,
          groups: Object.freeze([Object.freeze({
            groupId: 'group_aaaaaaaa',
            memberItemIds: Object.freeze([`clip:${ids[input.groupClip]}`, `clip:${ids[2]}`]),
          })]),
          extensions: Object.freeze({}),
        })]),
        provenance: Object.freeze({ source: 'direct' as const, requestId: null }),
        extensions: Object.freeze({}),
      }),
    }))
    issued.push(changeSetId)
  }
  return Object.freeze({ ...project, changeSets: Object.freeze(records), issuedChangeSetIds: Object.freeze(issued) })
}

const common = (project: EditProject, operationId = 'operation_precision01') => ({
  project,
  operationId,
  existingItemIds: ids.flatMap((id) => [`clip:${id}`, `dialogue:${id}`]),
})

const applyPlan = (project: EditProject, plan: ReturnType<typeof planRippleTrim>) => {
  expect(plan.ok).toBe(true)
  if (!plan.ok) throw new Error(plan.refusal.message)
  const result = plan.operation
  const composition = effectiveComposition(project)
  const changes = new Map(result.changes.map((change) => [change.clipId, change] as const))
  const track = composition.tracks[0]
  return track.clips.map((clip) => {
    const change = changes.get(clip.clipId)
    return change ? { ...clip, ...change } as Clip : clip
  })
}

describe('PrecisionTrimSessionV1', () => {
  it('is detached presentation state and records the exact planner result used for commit', () => {
    const session = newPrecisionTrimSession({
      sessionId: 'precision_0001',
      mode: 'ripple-trim',
      selectedItemIds: ['clip:clip_aaaaaaaa'],
      originalPointerTicks: ms(10_000).ticks,
    })
    const plan = planRippleTrim({ ...common(fixture()), clipId: ids[0], edge: 'end', deltaTicks: -ms(1_000).ticks })
    const updated = updatePrecisionTrimSession(session, -ms(980).ticks, -ms(1_000).ticks, plan)
    expect(updated.state).toBe('valid')
    expect(updated.previewPlan).toBe(plan)
    expect(updated.rawDeltaTicks).toBe(-ms(980).ticks)
    expect(updated.snappedDeltaTicks).toBe(-ms(1_000).ticks)
  })
})

describe('ripple trim', () => {
  it('shortens an end and shifts every downstream V1 clip by exactly the duration change', () => {
    const project = fixture()
    const before = effectiveComposition(project).tracks[0].clips
    const plan = planRippleTrim({ ...common(project), clipId: ids[0], edge: 'end', deltaTicks: -ms(2_000).ticks })
    expect(plan.ok).toBe(true)
    if (!plan.ok) return
    expect(plan.feedback.appliedDeltaTicks).toBe(-ms(2_000).ticks)
    const after = applyPlan(project, plan)
    expect(clipCompositionDurationTicks(after[0])).toBe(ms(8_000).ticks)
    expect(after[1].compositionStart.ticks - before[1].compositionStart.ticks).toBe(-ms(2_000).ticks)
    expect(after[2].compositionStart.ticks - before[2].compositionStart.ticks).toBe(-ms(2_000).ticks)
  })

  it('lengthens an end when source handle exists and shifts downstream later', () => {
    const project = fixture()
    const plan = planRippleTrim({ ...common(project), clipId: ids[0], edge: 'end', deltaTicks: ms(2_000).ticks })
    expect(plan.ok).toBe(true)
    if (!plan.ok) return
    expect(plan.operation.changes.find((change) => change.clipId === ids[1])?.compositionStart.ticks).toBe(ms(12_000).ticks)
  })

  it('preserves rational speed and reverse on every timing change', () => {
    const project = fixture({ speedClip: 0, reverseClip: 0 })
    const original = effectiveComposition(project).tracks[0].clips[0]
    const plan = planRippleTrim({ ...common(project), clipId: ids[0], edge: 'end', deltaTicks: -ms(1_000).ticks })
    expect(plan.ok).toBe(true)
    expect(original.timeTransform.playbackRate).toEqual({ numerator: 2, denominator: 1 })
    expect(original.timeTransform.direction).toBe('reverse')
    // Timing operation deliberately does not carry a timeTransform field, so it cannot reset either.
    if (plan.ok) expect(Object.hasOwn(plan.operation.changes[0], 'timeTransform')).toBe(false)
  })

  it('refuses a freeze target and a locked track in closed, user-readable ways', () => {
    const frozen = fixture({ freezeClip: 1 })
    const freezePlan = planRippleTrim({ ...common(frozen), clipId: ids[1], edge: 'end', deltaTicks: -ms(100).ticks })
    expect(freezePlan.ok).toBe(false)
    if (!freezePlan.ok) expect(freezePlan.refusal.code).toBe('FREEZE_OPERATION_UNSUPPORTED')

    const locked = planRippleTrim({ ...common(fixture()), clipId: ids[0], edge: 'end', deltaTicks: -ms(100).ticks, lockedTrackIds: ['track_aaaaaaaa'] })
    expect(locked.ok).toBe(false)
    if (!locked.ok) expect(locked.refusal.code).toBe('TRACK_LOCKED')
  })

  it('preserves J-cut lead/tail instead of resetting linked sound', () => {
    const project = fixture({ linkedClip: 1 })
    const plan = planRippleTrim({ ...common(project), clipId: ids[1], edge: 'end', deltaTicks: -ms(1_000).ticks })
    expect(plan.ok).toBe(true)
    if (!plan.ok) return
    const linked = plan.operation.changes.find((change) => change.clipId === ids[1])?.linkedAudio
    expect(linked).not.toBeNull()
    expect(linked?.compositionOffsetTicks).toBe(-ms(500).ticks)
  })
})

describe('roll', () => {
  it('moves one adjacent cut while keeping total sequence duration and gaplessness unchanged', () => {
    const project = fixture()
    const before = effectiveComposition(project)
    const beforeEnd = clipCompositionEndTicks(before.tracks[0].clips.at(-1)!)
    const plan = planRollTrim({ ...common(project), leftClipId: ids[1], rightClipId: ids[2], deltaTicks: ms(1_000).ticks })
    expect(plan.ok).toBe(true)
    if (!plan.ok) return
    const after = applyPlan(project, plan)
    expect(clipCompositionEndTicks(after.at(-1)!)).toBe(beforeEnd)
    expect(clipCompositionEndTicks(after[1])).toBe(after[2].compositionStart.ticks)
    expect(after[3].compositionStart.ticks).toBe(before.tracks[0].clips[3].compositionStart.ticks)
  })

  it('works with different rational speeds when a common exact edit point exists', () => {
    const project = fixture({ speedClip: 1 })
    const plan = planRollTrim({ ...common(project), leftClipId: ids[1], rightClipId: ids[2], deltaTicks: ms(500).ticks })
    expect(plan.ok).toBe(true)
  })

  it('does not silently truncate a transition whose new handle would be too short', () => {
    const project = fixture({ transition: true })
    const plan = planRollTrim({ ...common(project), leftClipId: ids[1], rightClipId: ids[2], deltaTicks: -ms(9_500).ticks })
    expect(plan.ok).toBe(false)
    if (!plan.ok) expect(['SOURCE_OUT_OF_RANGE', 'TRANSITION_CONFLICT', 'SOURCE_HANDLE_INSUFFICIENT']).toContain(plan.refusal.code)
  })

  it('refuses a roll at a freeze boundary', () => {
    const project = fixture({ freezeClip: 2 })
    const plan = planRollTrim({ ...common(project), leftClipId: ids[1], rightClipId: ids[2], deltaTicks: ms(100).ticks })
    expect(plan.ok).toBe(false)
    if (!plan.ok) expect(plan.refusal.code).toBe('FREEZE_OPERATION_UNSUPPORTED')
  })
})

describe('slip', () => {
  it('changes source In/Out while composition start/end/duration remain exact', () => {
    const project = fixture()
    const before = effectiveComposition(project).tracks[0].clips[1]
    const plan = planSlipEdit({ ...common(project), clipId: ids[1], deltaTicks: ms(2_000).ticks })
    expect(plan.ok).toBe(true)
    if (!plan.ok) return
    const change = plan.operation.changes[0]
    expect(change.compositionStart.ticks).toBe(before.compositionStart.ticks)
    expect(change.sourceRange.duration.ticks).toBe(before.sourceRange.duration.ticks)
    expect(change.sourceRange.start.ticks).toBe(before.sourceRange.start.ticks + ms(2_000).ticks)
    expect(plan.feedback.selectedDurationTicks).toBe(clipCompositionDurationTicks(before))
  })

  it('slips a reversed clip without resetting its direction', () => {
    const project = fixture({ reverseClip: 1 })
    const plan = planSlipEdit({ ...common(project), clipId: ids[1], deltaTicks: ms(1_000).ticks })
    expect(plan.ok).toBe(true)
    if (!plan.ok) return
    expect(Object.hasOwn(plan.operation.changes[0], 'timeTransform')).toBe(false)
  })

  it('preserves a linked J/L shape during slip and refuses when its audio handle runs out', () => {
    const project = fixture({ linkedClip: 1 })
    const plan = planSlipEdit({ ...common(project), clipId: ids[1], deltaTicks: ms(1_000).ticks })
    expect(plan.ok).toBe(true)
    if (plan.ok) expect(plan.operation.changes[0].linkedAudio?.compositionOffsetTicks).toBe(-ms(500).ticks)

    const tooFar = planSlipEdit({ ...common(project, 'operation_precision02'), clipId: ids[1], deltaTicks: -ms(20_000).ticks })
    expect(tooFar.ok).toBe(false)
    if (!tooFar.ok) expect(['SOURCE_HANDLE_INSUFFICIENT', 'LINKED_AUDIO_CONFLICT']).toContain(tooFar.refusal.code)
  })

  it('refuses Freeze because there is no source interval to slip', () => {
    const project = fixture({ freezeClip: 1 })
    const plan = planSlipEdit({ ...common(project), clipId: ids[1], deltaTicks: ms(100).ticks })
    expect(plan.ok).toBe(false)
    if (!plan.ok) expect(plan.refusal.code).toBe('FREEZE_OPERATION_UNSUPPORTED')
  })
})

describe('slide', () => {
  it('moves the selected interval, keeps its source unchanged, compensates neighbors and preserves sequence duration', () => {
    const project = fixture()
    const before = effectiveComposition(project).tracks[0].clips
    const plan = planSlideEdit({ ...common(project), clipId: ids[1], deltaTicks: ms(1_000).ticks })
    expect(plan.ok).toBe(true)
    if (!plan.ok) return
    const byId = new Map(plan.operation.changes.map((change) => [change.clipId, change] as const))
    expect(byId.get(ids[1])?.sourceRange).toEqual(before[1].sourceRange)
    expect(byId.get(ids[1])?.compositionStart.ticks).toBe(before[1].compositionStart.ticks + ms(1_000).ticks)
    const after = applyPlan(project, plan)
    expect(clipCompositionEndTicks(after.at(-1)!)).toBe(clipCompositionEndTicks(before.at(-1)!))
    expect(clipCompositionEndTicks(after[0])).toBe(after[1].compositionStart.ticks)
    expect(clipCompositionEndTicks(after[1])).toBe(after[2].compositionStart.ticks)
  })

  it('does not require source handles on the selected clip itself', () => {
    const project = fixture()
    const composition = effectiveComposition(project)
    const clips = composition.tracks[0].clips.map((clip, index) => index === 1
      ? Object.freeze({
          ...clip,
          sourceRange: Object.freeze({ start: mediaTime(0), duration: clip.sourceRange.duration }),
        })
      : clip)
    const selectedAtSourceStart: EditProject = Object.freeze({
      ...project,
      composition: Object.freeze({
        ...composition,
        tracks: Object.freeze([Object.freeze({ ...composition.tracks[0], clips: Object.freeze(clips) })]),
      }),
    })
    const plan = planSlideEdit({ ...common(selectedAtSourceStart), clipId: ids[1], deltaTicks: -ms(1_000).ticks })
    expect(plan.ok).toBe(true)
    if (!plan.ok) return
    expect(plan.operation.changes.find((change) => change.clipId === ids[1])?.sourceRange.start.ticks).toBe(0)
  })

  it('requires both neighbors and refuses a freeze boundary', () => {
    const edge = planSlideEdit({ ...common(fixture()), clipId: ids[0], deltaTicks: ms(100).ticks })
    expect(edge.ok).toBe(false)
    if (!edge.ok) expect(edge.refusal.code).toBe('EDIT_POINT_NOT_ADJACENT')

    const frozen = planSlideEdit({ ...common(fixture({ freezeClip: 2 })), clipId: ids[1], deltaTicks: ms(100).ticks })
    expect(frozen.ok).toBe(false)
    if (!frozen.ok) expect(frozen.refusal.code).toBe('FREEZE_OPERATION_UNSUPPORTED')
  })
})

describe('60-minute bounds', () => {
  it('keeps one early ripple bounded to one operation even with 300 primary cuts', () => {
    const asset = testAsset({ duration: ms(4_000_000) })
    const base = testProject(asset)
    const template = base.composition.tracks[0].clips[0]
    const clipDurationMs = 12_000
    const clips: Clip[] = Array.from({ length: 300 }, (_, index) => Object.freeze({
      ...template,
      clipId: `clip_long${String(index).padStart(4, '0')}`,
      sourceRange: Object.freeze({ start: ms(index * clipDurationMs), duration: ms(clipDurationMs) }),
      compositionStart: ms(index * clipDurationMs),
      segmentKind: 'video' as const,
      freezeDuration: null,
      linkedAudio: null,
      timeTransform: DEFAULT_CLIP_TIME_TRANSFORM,
    }))
    const project: EditProject = Object.freeze({
      ...base,
      composition: Object.freeze({
        ...base.composition,
        tracks: Object.freeze([Object.freeze({ ...base.composition.tracks[0], clips: Object.freeze(clips) })]),
      }),
    })
    expect(clipCompositionEndTicks(clips.at(-1)!)).toBe(ms(3_600_000).ticks)

    const plan = planRippleTrim({
      project,
      operationId: 'operation_longform01',
      existingItemIds: clips.flatMap((clip) => [`clip:${clip.clipId}`, `dialogue:${clip.clipId}`]),
      clipId: clips[0].clipId,
      edge: 'end',
      deltaTicks: -ms(1_000).ticks,
    })
    expect(plan.ok).toBe(true)
    if (!plan.ok) return
    expect(plan.operations).toHaveLength(1)
    expect(plan.operation.changes).toHaveLength(300)
    expect(plan.operation.changes.at(-1)?.compositionStart.ticks).toBe(ms(3_587_000).ticks)
  })
})

describe('groups and multi edit points', () => {
  it('refuses precision editing only part of a live group', () => {
    const project = fixture({ groupClip: 1 })
    const plan = planSlipEdit({ ...common(project), clipId: ids[1], deltaTicks: ms(100).ticks })
    expect(plan.ok).toBe(false)
    if (!plan.ok) expect(plan.refusal.code).toBe('GROUP_CONFLICT')
  })

  it('moves disjoint compatible edit points all-or-nothing in one operation', () => {
    const project = fixture()
    const plan = planMultiEditPointTrim({
      ...common(project),
      editPoints: [
        { leftClipId: ids[0], rightClipId: ids[1] },
        { leftClipId: ids[2], rightClipId: ids[3] },
      ],
      deltaTicks: ms(250).ticks,
    })
    expect(plan.ok).toBe(true)
    if (!plan.ok) return
    expect(plan.operations).toHaveLength(1)
    expect(plan.operation.changes).toHaveLength(4)
  })

  it('refuses the entire multi-point edit when selected cuts share a clip', () => {
    const project = fixture()
    const plan = planMultiEditPointTrim({
      ...common(project),
      editPoints: [
        { leftClipId: ids[0], rightClipId: ids[1] },
        { leftClipId: ids[1], rightClipId: ids[2] },
      ],
      deltaTicks: ms(250).ticks,
    })
    expect(plan.ok).toBe(false)
    if (!plan.ok) expect(plan.refusal.code).toBe('INVALID_MULTI_SELECTION')
  })
})
