import { describe, expect, it } from 'vitest'

import {
  acceptChangeSet,
  createProject,
  setChangeSetActive,
  type EditProject,
} from '@sanverse/edit-domain'

import { compileProjectToRenderPlan } from './compile-project'
import { validateRenderPlan } from './render-plan'

const TICKS_PER_MS = 1_440

const ms = (milliseconds: number) => ({ ticks: milliseconds * TICKS_PER_MS, timescale: 1_440_000 as const })

const project = (): EditProject => {
  const result = createProject({
    projectId: 'project_aaaaaaaaaaaaaaaa',
    compositionId: 'composition_aaaaaaaa',
    trackId: 'track_aaaaaaaa',
    clipId: 'clip_aaaaaaaa',
    asset: {
      schemaVersion: 'sanverse.asset/video/v1',
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
  if (!result.ok) throw new Error(`setup failed: ${JSON.stringify(result.error)}`)
  return result.value
}

const withNameplate = (base: EditProject, id: string, startMs: number): EditProject => {
  const result = acceptChangeSet(base, {
    schemaVersion: 'sanverse.change-set/v1',
    changeSetId: `changeset_${id}`,
    baseRevision: base.revision,
    operations: [
      {
        schemaVersion: 'sanverse.operation/v3',
        operationId: `operation_${id}`,
        kind: 'add-nameplate',
        capabilityId: 'sanverse.nameplate.component/v1',
        assetId: 'asset_aaaaaaaa',
        sourceInterval: { start: ms(startMs), duration: ms(3_000) },
        target: { coordinateSpace: 'composition-normalized', point: { x: 0.5, y: 0.8 }, anchor: 'center' },
        primaryText: `Name ${id}`,
        secondaryText: 'Role',
        extensions: {},
      },
    ],
    provenance: { source: 'direct', requestId: null },
    extensions: {},
  })
  if (!result.ok) throw new Error(`setup failed: ${JSON.stringify(result.error)}`)
  return result.value
}

describe('compiling a project into a render plan', () => {
  it('produces a plan both renderers can consume', () => {
    const compiled = compileProjectToRenderPlan(withNameplate(project(), 'aaaaaaaa', 2_000))
    expect(compiled).toMatchObject({ ok: true })
    if (!compiled.ok) return
    expect(compiled.value.width).toBe(1920)
    expect(compiled.value.durationTicks).toBe(30_000 * TICKS_PER_MS)
    expect(compiled.value.overlays).toHaveLength(1)
    expect(compiled.value.overlays[0].styleId).toBe('sanverse.nameplate.default/v1')
    expect(validateRenderPlan(compiled.value)).toMatchObject({ ok: true })
  })

  it('records the revision it was compiled from', () => {
    const source = withNameplate(project(), 'aaaaaaaa', 2_000)
    const compiled = compileProjectToRenderPlan(source)
    if (!compiled.ok) throw new Error('setup failed')
    expect(compiled.value.projectRevision).toBe(source.revision)
  })

  it('leaves out a change set the user switched off', () => {
    let source = withNameplate(project(), 'aaaaaaaa', 2_000)
    source = withNameplate(source, 'bbbbbbbb', 10_000)
    const off = setChangeSetActive(source, 'changeset_aaaaaaaa', false)
    if (!off.ok) throw new Error('setup failed')

    const compiled = compileProjectToRenderPlan(off.value)
    if (!compiled.ok) throw new Error('setup failed')
    expect(compiled.value.overlays).toHaveLength(1)
    expect(compiled.value.overlays[0].nodeId).toBe('operation_bbbbbbbb')
  })

  it('still produces the footage when every drawn edit is switched off', () => {
    const source = withNameplate(project(), 'aaaaaaaa', 2_000)
    const off = setChangeSetActive(source, 'changeset_aaaaaaaa', false)
    if (!off.ok) throw new Error('setup failed')
    const compiled = compileProjectToRenderPlan(off.value)
    expect(compiled).toMatchObject({ ok: true })
    if (!compiled.ok) return
    expect(compiled.value.overlays).toHaveLength(0)
  })

  it('is deterministic', () => {
    const source = withNameplate(project(), 'aaaaaaaa', 2_000)
    expect(JSON.stringify(compileProjectToRenderPlan(source))).toBe(
      JSON.stringify(compileProjectToRenderPlan(source)),
    )
  })
})

const withTimelineEdit = (base: EditProject, id: string, operation: Record<string, unknown>): EditProject => {
  const result = acceptChangeSet(base, {
    schemaVersion: 'sanverse.change-set/v1',
    changeSetId: `changeset_${id}`,
    baseRevision: base.revision,
    operations: [{ schemaVersion: 'sanverse.operation/v3', extensions: {}, ...operation }],
    provenance: { source: 'direct', requestId: null },
    extensions: {},
  })
  if (!result.ok) throw new Error(`setup failed: ${JSON.stringify(result.error)}`)
  return result.value
}

const split = (base: EditProject, id: string, atMs: number, newClipId: string) =>
  withTimelineEdit(base, id, {
    operationId: `operation_${id}`,
    kind: 'split-clip',
    capabilityId: 'sanverse.timeline.split.primitive/v1',
    clipId: 'clip_aaaaaaaa',
    atClipTime: ms(atMs),
    newClipId,
  })

describe('compiling the footage a video is made of', () => {
  it('describes an untouched video as one continuous piece', () => {
    const compiled = compileProjectToRenderPlan(project())
    if (!compiled.ok) throw new Error('setup failed')
    expect(compiled.value.segments).toHaveLength(1)
    expect(compiled.value.segments[0].sourceStartTicks).toBe(0)
    expect(compiled.value.segments[0].interval.duration).toEqual(ms(30_000))
    expect(compiled.value.segments[0].gainDb).toBe(0)
  })

  it('describes a cut video as the pieces that survived, in order', () => {
    const cut = withTimelineEdit(split(project(), 'aaaaaaaa', 10_000, 'clip_bbbbbbbb'), 'bbbbbbbb', {
      operationId: 'operation_bbbbbbbb',
      kind: 'remove-clip',
      capabilityId: 'sanverse.timeline.remove.primitive/v1',
      clipId: 'clip_aaaaaaaa',
      ripple: true,
    })
    const compiled = compileProjectToRenderPlan(cut)
    if (!compiled.ok) throw new Error('setup failed')

    expect(compiled.value.segments).toHaveLength(1)
    // The finished video now starts at ten seconds into the recording.
    expect(compiled.value.segments[0].sourceStartTicks).toBe(10_000 * TICKS_PER_MS)
    expect(compiled.value.segments[0].interval.start).toEqual(ms(0))
    expect(compiled.value.durationTicks).toBe(20_000 * TICKS_PER_MS)
  })

  it('draws a nameplate on both sides of a cut that passed through it', () => {
    const withPlate = withNameplate(project(), 'aaaaaaaa', 2_000)
    const cut = split(withPlate, 'bbbbbbbb', 4_000, 'clip_bbbbbbbb')
    const compiled = compileProjectToRenderPlan(cut)
    if (!compiled.ok) throw new Error('setup failed')

    expect(compiled.value.overlays).toHaveLength(2)
    expect(compiled.value.overlays[0].interval.start).toEqual(ms(2_000))
    expect(compiled.value.overlays[1].interval.start).toEqual(ms(4_000))
    // Two on-screen appearances, so two identifiers — a renderer keying on
    // nodeId must not silently draw only one of them.
    expect(compiled.value.overlays[0].nodeId).not.toBe(compiled.value.overlays[1].nodeId)
    expect(compiled.value.overlays[0].primaryText).toBe(compiled.value.overlays[1].primaryText)
  })

  it('leaves a hole rather than shifting everything when a piece is hidden', () => {
    const hidden = withTimelineEdit(split(project(), 'aaaaaaaa', 10_000, 'clip_bbbbbbbb'), 'bbbbbbbb', {
      operationId: 'operation_bbbbbbbb',
      kind: 'set-clip-enabled',
      capabilityId: 'sanverse.timeline.enabled.primitive/v1',
      clipId: 'clip_aaaaaaaa',
      enabled: false,
    })
    const compiled = compileProjectToRenderPlan(hidden)
    if (!compiled.ok) throw new Error('setup failed')

    expect(compiled.value.segments).toHaveLength(1)
    expect(compiled.value.segments[0].interval.start).toEqual(ms(10_000))
    // Switching it back on must restore the exact video, so the length holds.
    expect(compiled.value.durationTicks).toBe(30_000 * TICKS_PER_MS)
  })
})

describe('render plan validation', () => {
  it('refuses two pieces of footage claiming the same instant', () => {
    const compiled = compileProjectToRenderPlan(project())
    if (!compiled.ok) throw new Error('setup failed')
    const tampered = {
      ...compiled.value,
      segments: [
        compiled.value.segments[0],
        { ...compiled.value.segments[0], nodeId: 'clip_bbbbbbbb' },
      ],
    }
    const result = validateRenderPlan(tampered)
    expect(result).toMatchObject({ ok: false })
    if (result.ok) return
    expect(result.error.issues.some((issue) => issue.code === 'SEGMENTS_OVERLAP')).toBe(true)
  })

  it('refuses a plan with no footage in it at all', () => {
    const compiled = compileProjectToRenderPlan(project())
    if (!compiled.ok) throw new Error('setup failed')
    const result = validateRenderPlan({ ...compiled.value, segments: [] })
    expect(result).toMatchObject({ ok: false })
    if (result.ok) return
    expect(result.error.issues[0].code).toBe('SEGMENTS_EMPTY')
  })

  it('refuses an overlay that runs past the end of the video', () => {
    const compiled = compileProjectToRenderPlan(withNameplate(project(), 'aaaaaaaa', 2_000))
    if (!compiled.ok) throw new Error('setup failed')
    const tampered = {
      ...compiled.value,
      overlays: [{ ...compiled.value.overlays[0], interval: { start: ms(29_000), duration: ms(5_000) } }],
    }
    const result = validateRenderPlan(tampered)
    expect(result).toMatchObject({ ok: false })
    if (result.ok) return
    expect(result.error.issues[0].code).toBe('NODE_OUTSIDE_COMPOSITION')
  })

  it('refuses an unrecognised node kind instead of skipping it', () => {
    const compiled = compileProjectToRenderPlan(withNameplate(project(), 'aaaaaaaa', 2_000))
    if (!compiled.ok) throw new Error('setup failed')
    const tampered = { ...compiled.value, overlays: [{ ...compiled.value.overlays[0], kind: 'colour-grade' }] }
    expect(validateRenderPlan(tampered)).toMatchObject({ ok: false })
  })

  it('refuses an unknown top-level field', () => {
    const compiled = compileProjectToRenderPlan(withNameplate(project(), 'aaaaaaaa', 2_000))
    if (!compiled.ok) throw new Error('setup failed')
    expect(validateRenderPlan({ ...compiled.value, watermark: true })).toMatchObject({ ok: false })
  })
})
