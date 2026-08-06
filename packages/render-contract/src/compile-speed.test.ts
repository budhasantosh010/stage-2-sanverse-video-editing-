import { describe, expect, it } from 'vitest'

import { acceptChangeSet, effectiveComposition, type EditProject } from '@sanverse/edit-domain'
import {
  CLIP_TIME_TRANSFORM_PRIMITIVE_ID,
  CLIP_TRANSITION_PRIMITIVE_ID,
  SPLIT_PRIMITIVE_ID,
} from '@sanverse/edit-domain/capabilities'
import { clipCompositionDurationTicks, findClip } from '@sanverse/edit-domain/composition'
import { testProject } from '@sanverse/edit-domain/test-fixtures'

import { compileProjectToRenderPlan } from './compile-project.ts'
import { RENDER_PLAN_SCHEMA_VERSION, validateRenderPlan } from './render-plan.ts'

const S = 1_440_000
const time = (ticks: number) => ({ ticks, timescale: 1_440_000 as const })

const accept = (project: EditProject, changeSetId: string, operations: readonly unknown[]): EditProject => {
  const next = acceptChangeSet(project, {
    schemaVersion: 'sanverse.change-set/v1',
    changeSetId,
    baseRevision: project.revision,
    provenance: { source: 'direct', requestId: null },
    operations,
    extensions: {},
  })
  if (!next.ok) throw new Error(`change set refused: ${JSON.stringify(next.error)}`)
  return next.value
}

const orderedClips = (project: EditProject) =>
  effectiveComposition(project).tracks
    .flatMap((track) => track.clips)
    .sort((left, right) => left.compositionStart.ticks - right.compositionStart.ticks)

const firstClipId = (project: EditProject): string => orderedClips(project)[0].clipId

/**
 * The fixture project cut in two, so there is a join for a transition to sit
 * on and a second piece for a ripple to move.
 */
const multiClipProject = (): EditProject => {
  const project = testProject()
  const clipId = firstClipId(project)
  const whole = findClip(effectiveComposition(project), clipId)!
  return accept(project, 'changeset_split001', [{
    schemaVersion: 'sanverse.operation/v3',
    operationId: 'operation_split0001',
    kind: 'split-clip',
    capabilityId: SPLIT_PRIMITIVE_ID,
    clipId,
    atClipTime: time(Math.floor(whole.sourceRange.duration.ticks / 2)),
    newClipId: 'clip_splithalf01',
    extensions: {},
  }])
}

const speedOperation = (clipId: string, numerator: number, denominator: number, operationId: string) => ({
  schemaVersion: 'sanverse.operation/v3',
  operationId,
  kind: 'set-clip-time-transform',
  capabilityId: CLIP_TIME_TRANSFORM_PRIMITIVE_ID,
  clipId,
  playbackRate: { numerator, denominator },
  direction: 'forward',
  maintainAudioPitch: true,
  durationPolicy: 'ripple',
  extensions: {},
})

const planOf = (project: EditProject) => {
  const compiled = compileProjectToRenderPlan(project)
  if (!compiled.ok) throw new Error(`compile failed: ${JSON.stringify(compiled.error)}`)
  return compiled.value
}

describe('a project nobody has retimed compiles EXACTLY as it always did', () => {
  it('writes no speed fields at all, so its finished export is still valid', () => {
    // This is the whole reason the fields are optional. Writing
    // `playbackRateNumerator: 1` into every plan would change the fingerprint
    // of every project ever made, and every user with a finished export would
    // be made to wait for a byte-identical one.
    const plan = planOf(multiClipProject())
    for (const segment of plan.segments) {
      expect(Object.hasOwn(segment, 'sourceDurationTicks')).toBe(false)
      expect(Object.hasOwn(segment, 'playbackRateNumerator')).toBe(false)
      expect(Object.hasOwn(segment, 'playbackRateDenominator')).toBe(false)
      expect(Object.hasOwn(segment, 'direction')).toBe(false)
      expect(Object.hasOwn(segment, 'maintainAudioPitch')).toBe(false)
      expect(Object.hasOwn(segment, 'pan')).toBe(false)
      expect(Object.hasOwn(segment, 'transitionColor')).toBe(false)
    }
  })

  it('did not move the plan version, because the closed output shape is unchanged', () => {
    expect(planOf(multiClipProject()).schemaVersion).toBe(RENDER_PLAN_SCHEMA_VERSION)
    expect(RENDER_PLAN_SCHEMA_VERSION).toBe('sanverse.render-plan/v7')
  })
})

describe('a retimed piece reaches the exporter', () => {
  const at2x = (): EditProject => {
    const project = multiClipProject()
    return accept(project, 'changeset_speed001', [
      speedOperation(firstClipId(project), 2, 1, 'operation_speed0001'),
    ])
  }

  it('says how much recording it uses AND how long it lasts, as two numbers', () => {
    const project = at2x()
    const clipId = firstClipId(project)
    const plan = planOf(project)
    const segment = plan.segments.find((candidate) => candidate.nodeId === clipId)
    expect(segment).toBeDefined()
    if (!segment) return
    const clip = findClip(effectiveComposition(project), clipId)!
    expect(segment.interval.duration.ticks).toBe(clipCompositionDurationTicks(clip))
    expect(segment.sourceDurationTicks).toBe(clip.sourceRange.duration.ticks)
    expect(segment.sourceDurationTicks).toBe(segment.interval.duration.ticks * 2)
  })

  it('carries the speed as the SAME fraction the project holds, never a decimal', () => {
    const plan = planOf(at2x())
    const segment = plan.segments[0]
    expect(segment.playbackRateNumerator).toBe(2)
    expect(segment.playbackRateDenominator).toBe(1)
    expect(segment.direction).toBe('forward')
    expect(segment.maintainAudioPitch).toBe(true)
  })

  it('shortens the whole finished video by the right amount', () => {
    const before = planOf(multiClipProject()).durationTicks
    const after = planOf(at2x()).durationTicks
    const firstClipTicks = multiClipProject()
    const originalFirst = findClip(effectiveComposition(firstClipTicks), firstClipId(firstClipTicks))!
    expect(before - after).toBe(Math.ceil(originalFirst.sourceRange.duration.ticks / 2))
  })

  it('produces a plan the validator accepts', () => {
    expect(validateRenderPlan(planOf(at2x())).ok).toBe(true)
  })

  it('leaves no gap and no overlap between the pieces', () => {
    const plan = planOf(at2x())
    const ordered = [...plan.segments].sort((left, right) => left.interval.start.ticks - right.interval.start.ticks)
    for (let index = 1; index < ordered.length; index += 1) {
      const previous = ordered[index - 1]
      expect(ordered[index].interval.start.ticks).toBe(previous.interval.start.ticks + previous.interval.duration.ticks)
    }
  })
})

describe('fading through white as well as black', () => {
  const withTransition = (style: 'dip-to-black' | 'dip-to-white'): EditProject => {
    const project = multiClipProject()
    const clips = orderedClips(project)
    return accept(project, 'changeset_trans001', [{
      schemaVersion: 'sanverse.operation/v3',
      operationId: 'operation_trans0001',
      kind: 'set-clip-transition',
      capabilityId: CLIP_TRANSITION_PRIMITIVE_ID,
      clipId: clips[0].clipId,
      nextClipId: clips[1].clipId,
      style,
      duration: time(Math.floor(S / 2)),
      audio: 'fade-through-silence',
      extensions: {},
    }])
  }

  it('says nothing about colour for the black one, because black is the default', () => {
    const plan = planOf(withTransition('dip-to-black'))
    for (const segment of plan.segments) {
      expect(Object.hasOwn(segment, 'transitionColor')).toBe(false)
    }
  })

  it('says white on BOTH sides of the join for the white one', () => {
    const plan = planOf(withTransition('dip-to-white'))
    const fading = plan.segments.filter(
      (segment) => segment.videoFadeInTicks > 0 || segment.videoFadeOutTicks > 0,
    )
    expect(fading).toHaveLength(2)
    for (const segment of fading) expect(segment.transitionColor).toBe('white')
  })

  it('ramps the picture on the way out and on the way in, for either colour', () => {
    for (const style of ['dip-to-black', 'dip-to-white'] as const) {
      const plan = planOf(withTransition(style))
      const ordered = [...plan.segments].sort((left, right) => left.interval.start.ticks - right.interval.start.ticks)
      expect(ordered[0].videoFadeOutTicks, style).toBe(Math.floor(S / 2))
      expect(ordered[1].videoFadeInTicks, style).toBe(Math.floor(S / 2))
    }
  })

  it('leaves the pieces exactly as long as they were: a transition does not eat time', () => {
    const plain = planOf(multiClipProject())
    const faded = planOf(withTransition('dip-to-white'))
    expect(faded.durationTicks).toBe(plain.durationTicks)
    expect(faded.segments.map((segment) => segment.interval.duration.ticks))
      .toEqual(plain.segments.map((segment) => segment.interval.duration.ticks))
  })
})
