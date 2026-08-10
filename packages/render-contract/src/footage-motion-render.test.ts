import { describe, expect, it } from 'vitest'

import {
  acceptChangeSet,
  createProject,
  type EditProject,
  type SetFootageMotionOperation,
} from '@sanverse/edit-domain'

import { compileProjectToRenderPlan } from './compile-project'
import { validateRenderPlan } from './render-plan'

const TIMESCALE = 1_440_000 as const
const ms = (milliseconds: number) => ({ ticks: milliseconds * 1_440, timescale: TIMESCALE })

const baseProject = (): EditProject => {
  const result = createProject({
    projectId: 'project_aaaaaaaaaaaaaaaa',
    compositionId: 'composition_motion01',
    trackId: 'track_motion01',
    clipId: 'clip_motion01',
    asset: {
      schemaVersion: 'sanverse.asset/media/v1' as const,
      mediaKind: 'video' as const,
      assetId: 'asset_motion01',
      storageRef: 'project/motion/source',
      sha256: 'f'.repeat(64),
      byteLength: 1_000,
      duration: ms(30_000),
      width: 1920,
      height: 1080,
      frameRate: { numerator: 30, denominator: 1 },
      hasAudio: true,
      durationResidualSeconds: 0,
    },
  })
  if (!result.ok) throw new Error(JSON.stringify(result.error))
  return result.value
}

const motion = (overrides: Partial<SetFootageMotionOperation> = {}): SetFootageMotionOperation => ({
  schemaVersion: 'sanverse.operation/v3',
  operationId: 'operation_motionrender01',
  kind: 'set-footage-motion',
  capabilityId: 'sanverse.footage.motion.primitive/v1',
  motionId: 'motion_render0001',
  assetId: 'asset_motion01',
  sourceInterval: { start: ms(5_000), duration: ms(5_000) },
  transform: { translateX: 0.1, translateY: -0.05, scale: 1.25, rotationDegrees: 2, opacity: 1 },
  crop: { top: 0.02, right: 0.03, bottom: 0.04, left: 0.05 },
  tracks: [],
  extensions: {},
  ...overrides,
})

const acceptMotion = (project: EditProject, operation = motion()): EditProject => {
  const result = acceptChangeSet(project, {
    schemaVersion: 'sanverse.change-set/v1',
    changeSetId: 'changeset_motionrender01',
    baseRevision: project.revision,
    operations: [operation],
    provenance: { source: 'direct', requestId: null },
    extensions: {},
  })
  if (!result.ok) throw new Error(JSON.stringify(result.error))
  return result.value
}

const split = (project: EditProject): EditProject => {
  const result = acceptChangeSet(project, {
    schemaVersion: 'sanverse.change-set/v1',
    changeSetId: 'changeset_motionsplit01',
    baseRevision: project.revision,
    operations: [{
      schemaVersion: 'sanverse.operation/v3',
      operationId: 'operation_motionsplit01',
      kind: 'split-clip',
      capabilityId: 'sanverse.timeline.split.primitive/v1',
      clipId: 'clip_motion01',
      atClipTime: ms(7_000),
      newClipId: 'clip_motion02',
      extensions: {},
    }],
    provenance: { source: 'direct', requestId: null },
    extensions: {},
  })
  if (!result.ok) throw new Error(JSON.stringify(result.error))
  return result.value
}

const compile = (project: EditProject) => {
  const result = compileProjectToRenderPlan(project)
  if (!result.ok) throw new Error(JSON.stringify(result.error))
  return result.value
}

describe('P1-F.0 render-contract footage motion', () => {
  it('keeps an old project identical apart from v7 and explicit empty motion arrays', () => {
    const plan = compile(baseProject())
    expect(plan.schemaVersion).toBe('sanverse.render-plan/v9')
    expect(plan.segments).toHaveLength(1)
    expect(plan.segments[0].footageMotions).toEqual([])
    expect(plan.overlays).toEqual([])
    expect(plan.visuals).toEqual([])
    expect(plan.music).toEqual([])
  })

  it('carries complete static transform and crop state on the source segment', () => {
    const plan = compile(acceptMotion(baseProject()))
    expect(plan.segments[0].footageMotions).toEqual([{
      motionId: 'motion_render0001',
      sourceInterval: { start: ms(5_000), duration: ms(5_000) },
      transform: { translateX: 0.1, translateY: -0.05, scale: 1.25, rotationDegrees: 2, opacity: 1 },
      crop: { top: 0.02, right: 0.03, bottom: 0.04, left: 0.05 },
      tracks: [],
    }])
  })

  it('carries bounded animated tracks without converting source ticks to frames', () => {
    const operation = motion({
      tracks: [{
        property: 'scale',
        keyframes: [
          { at: ms(0), value: 1, easing: { kind: 'cubic-bezier', x1: 0.2, y1: 0, x2: 0, y2: 1 } },
          { at: ms(5_000), value: 1.3, easing: { kind: 'linear' } },
        ],
      }, {
        property: 'translate-x',
        keyframes: [
          { at: ms(0), value: 0, easing: { kind: 'linear' } },
          { at: ms(5_000), value: -0.2, easing: { kind: 'linear' } },
        ],
      }],
    })
    const plan = compile(acceptMotion(baseProject(), operation))
    expect(plan.segments[0].footageMotions[0].tracks).toEqual(operation.tracks)
    expect(plan.segments[0].footageMotions[0].tracks[0].keyframes[1].at.ticks).toBe(ms(5_000).ticks)
  })

  it('attaches one canonical motion to both source segments after a cut', () => {
    const plan = compile(split(acceptMotion(baseProject())))
    expect(plan.segments).toHaveLength(2)
    expect(plan.segments[0].footageMotions).toHaveLength(1)
    expect(plan.segments[1].footageMotions).toHaveLength(1)
    expect(plan.segments[0].footageMotions[0]).toStrictEqual(plan.segments[1].footageMotions[0])
    expect(plan.segments[0].footageMotions[0].sourceInterval.start.ticks).toBe(ms(5_000).ticks)
  })

  it('does not duplicate the primary video as a render source or overlay', () => {
    const plan = compile(acceptMotion(baseProject()))
    expect(plan.sources).toEqual([{ assetId: 'asset_motion01', mediaKind: 'video' }])
    expect(plan.overlays).toEqual([])
    expect(plan.segments).toHaveLength(1)
  })

  it('serializes deterministically', () => {
    const project = acceptMotion(baseProject())
    expect(JSON.stringify(compileProjectToRenderPlan(project))).toBe(
      JSON.stringify(compileProjectToRenderPlan(project)),
    )
  })

  it('fails closed when a motion node has an unknown field or invalid state', () => {
    const plan = compile(acceptMotion(baseProject()))
    const unknown = {
      ...plan,
      segments: [{
        ...plan.segments[0],
        footageMotions: [{ ...plan.segments[0].footageMotions[0], hiddenBlend: 'multiply' }],
      }],
    }
    expect(validateRenderPlan(unknown).ok).toBe(false)

    const invalid = {
      ...plan,
      segments: [{
        ...plan.segments[0],
        footageMotions: [{
          ...plan.segments[0].footageMotions[0],
          transform: { ...plan.segments[0].footageMotions[0].transform, opacity: 0.5 },
        }],
      }],
    }
    expect(validateRenderPlan(invalid).ok).toBe(false)
  })
})
