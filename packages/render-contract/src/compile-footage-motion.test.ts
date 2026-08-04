import { describe, expect, it } from 'vitest'

import {
  FOOTAGE_MOTION_CAPABILITY_ID,
  acceptChangeSet,
  createProject,
  type EditProject,
} from '@sanverse/edit-domain'

import { compileProjectToRenderPlan } from './compile-project.ts'
import { validateRenderPlan } from './render-plan.ts'

const TICKS_PER_MS = 1_440
const ms = (milliseconds: number) => ({ ticks: milliseconds * TICKS_PER_MS, timescale: 1_440_000 as const })

const project = (): EditProject => {
  const created = createProject({
    projectId: 'project_aaaaaaaaaaaaaaaa',
    compositionId: 'composition_aaaaaaaa',
    trackId: 'track_aaaaaaaa',
    clipId: 'clip_aaaaaaaa',
    asset: {
      schemaVersion: 'sanverse.asset/media/v1',
      mediaKind: 'video',
      assetId: 'asset_aaaaaaaa',
      storageRef: 'project/source',
      sha256: 'a'.repeat(64),
      byteLength: 1_000,
      duration: ms(30_000),
      width: 1920,
      height: 1080,
      frameRate: { numerator: 30, denominator: 1 },
      hasAudio: true,
      durationResidualSeconds: 0,
    },
  })
  if (!created.ok) throw new Error(JSON.stringify(created.error))
  return created.value
}

const motionOperation = (overrides: Record<string, unknown> = {}) => ({
  schemaVersion: 'sanverse.operation/v3',
  operationId: 'operation_motion001',
  kind: 'set-footage-motion',
  capabilityId: FOOTAGE_MOTION_CAPABILITY_ID,
  motionId: 'motion_aaaaaaaa',
  assetId: 'asset_aaaaaaaa',
  sourceInterval: { start: ms(5_000), duration: ms(5_000) },
  transform: { translateX: 0, translateY: 0, scale: 1.2, rotationDegrees: 0, opacity: 1 },
  crop: { top: 0, right: 0, bottom: 0, left: 0 },
  tracks: [],
  extensions: {},
  ...overrides,
})

const accept = (base: EditProject, id: string, operation: Record<string, unknown>): EditProject => {
  const result = acceptChangeSet(base, {
    schemaVersion: 'sanverse.change-set/v1',
    changeSetId: `changeset_${id}`,
    baseRevision: base.revision,
    operations: [operation],
    provenance: { source: 'direct', requestId: null },
    extensions: {},
  })
  if (!result.ok) throw new Error(JSON.stringify(result.error))
  return result.value
}

const compile = (source: EditProject) => {
  const result = compileProjectToRenderPlan(source)
  if (!result.ok) throw new Error(JSON.stringify(result.error))
  return result.value
}

describe('render-plan v6 primary-footage motion', () => {
  it('leaves existing projects unchanged except for an empty segment motion list', () => {
    const plan = compile(project())
    expect(plan.schemaVersion).toBe('sanverse.render-plan/v7')
    expect(plan.segments).toHaveLength(1)
    expect(plan.segments[0].footageMotions).toEqual([])
    expect(plan.sources).toHaveLength(1)
    expect(plan.overlays).toEqual([])
    expect(plan.music).toEqual([])
  })

  it('carries one static source-anchored motion on the existing source segment', () => {
    const plan = compile(accept(project(), 'motion01', motionOperation()))
    expect(plan.segments).toHaveLength(1)
    expect(plan.segments[0].footageMotions).toEqual([expect.objectContaining({
      motionId: 'motion_aaaaaaaa',
      sourceInterval: { start: ms(5_000), duration: ms(5_000) },
      transform: expect.objectContaining({ scale: 1.2 }),
      tracks: [],
    })])
    expect(validateRenderPlan(plan)).toMatchObject({ ok: true })
  })

  it('preserves animated tracks without browser or FFmpeg syntax', () => {
    const plan = compile(accept(project(), 'motion01', motionOperation({
      tracks: [{
        property: 'scale',
        keyframes: [
          { at: ms(0), value: 1, easing: { kind: 'linear' } },
          { at: ms(5_000), value: 1.4, easing: { kind: 'cubic-bezier', x1: 0.42, y1: 0, x2: 0.58, y2: 1 } },
        ],
      }],
    })))
    expect(plan.segments[0].footageMotions[0].tracks[0].keyframes).toHaveLength(2)
    expect(JSON.stringify(plan.segments[0].footageMotions[0])).not.toMatch(/ffmpeg|filter|css/i)
  })

  it('attaches one canonical motion to both source segments after a cut through it', () => {
    let source = accept(project(), 'motion01', motionOperation())
    source = accept(source, 'split001', {
      schemaVersion: 'sanverse.operation/v3',
      operationId: 'operation_split001',
      kind: 'split-clip',
      capabilityId: 'sanverse.timeline.split.primitive/v1',
      clipId: 'clip_aaaaaaaa',
      atClipTime: ms(7_000),
      newClipId: 'clip_bbbbbbbb',
      extensions: {},
    })
    const plan = compile(source)
    expect(plan.segments).toHaveLength(2)
    expect(plan.segments.map((segment) => segment.footageMotions.map((motion) => motion.motionId))).toEqual([
      ['motion_aaaaaaaa'],
      ['motion_aaaaaaaa'],
    ])
    expect(plan.segments[0].footageMotions[0]).toEqual(plan.segments[1].footageMotions[0])
  })

  it('keeps source audio and segment timing unchanged when motion is added', () => {
    const before = compile(project()).segments[0]
    const after = compile(accept(project(), 'motion01', motionOperation())).segments[0]
    expect({
      interval: after.interval,
      sourceStartTicks: after.sourceStartTicks,
      gainDb: after.gainDb,
      fadeInTicks: after.fadeInTicks,
      fadeOutTicks: after.fadeOutTicks,
    }).toEqual({
      interval: before.interval,
      sourceStartTicks: before.sourceStartTicks,
      gainDb: before.gainDb,
      fadeInTicks: before.fadeInTicks,
      fadeOutTicks: before.fadeOutTicks,
    })
  })

  it('is deterministic and contains no second primary-video source', () => {
    const source = accept(project(), 'motion01', motionOperation())
    expect(JSON.stringify(compile(source))).toBe(JSON.stringify(compile(source)))
    expect(compile(source).sources.filter((entry) => entry.assetId === 'asset_aaaaaaaa')).toHaveLength(1)
  })

  it('refuses invalid or unrelated segment motion state at the renderer boundary', () => {
    const plan = compile(accept(project(), 'motion01', motionOperation()))
    const invalidScale = {
      ...plan,
      segments: [{
        ...plan.segments[0],
        footageMotions: [{ ...plan.segments[0].footageMotions[0], transform: {
          ...plan.segments[0].footageMotions[0].transform,
          scale: Number.POSITIVE_INFINITY,
        } }],
      }],
    }
    const outside = {
      ...plan,
      segments: [{
        ...plan.segments[0],
        sourceStartTicks: 20_000 * TICKS_PER_MS,
      }],
    }
    expect(validateRenderPlan(invalidScale)).toMatchObject({ ok: false })
    expect(validateRenderPlan(outside)).toMatchObject({ ok: false })
  })
})
