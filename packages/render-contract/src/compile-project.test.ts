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
        schemaVersion: 'sanverse.operation/v2',
        operationId: `operation_${id}`,
        kind: 'add-nameplate',
        capabilityId: 'sanverse.nameplate.component/v1',
        clipId: 'clip_aaaaaaaa',
        sampledClipTime: ms(startMs),
        compositionInterval: { start: ms(startMs), duration: ms(3_000) },
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
    expect(compiled.value.nodes).toHaveLength(1)
    expect(compiled.value.nodes[0].styleId).toBe('sanverse.nameplate.default/v1')
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
    expect(compiled.value.nodes).toHaveLength(1)
    expect(compiled.value.nodes[0].nodeId).toBe('operation_bbbbbbbb')
  })

  it('produces an empty node list rather than failing when nothing is switched on', () => {
    const source = withNameplate(project(), 'aaaaaaaa', 2_000)
    const off = setChangeSetActive(source, 'changeset_aaaaaaaa', false)
    if (!off.ok) throw new Error('setup failed')
    const compiled = compileProjectToRenderPlan(off.value)
    expect(compiled).toMatchObject({ ok: true })
    if (!compiled.ok) return
    expect(compiled.value.nodes).toHaveLength(0)
  })

  it('is deterministic', () => {
    const source = withNameplate(project(), 'aaaaaaaa', 2_000)
    expect(JSON.stringify(compileProjectToRenderPlan(source))).toBe(
      JSON.stringify(compileProjectToRenderPlan(source)),
    )
  })
})

describe('render plan validation', () => {
  it('refuses an overlay that runs past the end of the video', () => {
    const compiled = compileProjectToRenderPlan(withNameplate(project(), 'aaaaaaaa', 2_000))
    if (!compiled.ok) throw new Error('setup failed')
    const tampered = {
      ...compiled.value,
      nodes: [{ ...compiled.value.nodes[0], interval: { start: ms(29_000), duration: ms(5_000) } }],
    }
    const result = validateRenderPlan(tampered)
    expect(result).toMatchObject({ ok: false })
    if (result.ok) return
    expect(result.error.issues[0].code).toBe('NODE_OUTSIDE_COMPOSITION')
  })

  it('refuses an unrecognised node kind instead of skipping it', () => {
    const compiled = compileProjectToRenderPlan(withNameplate(project(), 'aaaaaaaa', 2_000))
    if (!compiled.ok) throw new Error('setup failed')
    const tampered = { ...compiled.value, nodes: [{ ...compiled.value.nodes[0], kind: 'colour-grade' }] }
    expect(validateRenderPlan(tampered)).toMatchObject({ ok: false })
  })

  it('refuses an unknown top-level field', () => {
    const compiled = compileProjectToRenderPlan(withNameplate(project(), 'aaaaaaaa', 2_000))
    if (!compiled.ok) throw new Error('setup failed')
    expect(validateRenderPlan({ ...compiled.value, watermark: true })).toMatchObject({ ok: false })
  })
})
