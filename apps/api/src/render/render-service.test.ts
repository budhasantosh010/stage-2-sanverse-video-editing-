import { describe, expect, it, vi } from 'vitest'

import {
  acceptChangeSet,
  createProject,
  setChangeSetActive,
  type EditProject,
} from '@sanverse/edit-domain'

import { ms } from '../test-fixtures.ts'
import { createRenderService } from './render-service.ts'
import type { RenderPort } from './render-port.ts'

const baseProject = (): EditProject => {
  const result = createProject({
    projectId: 'project_aaaaaaaaaaaaaaaa',
    compositionId: 'composition_aaaaaaaa',
    trackId: 'track_aaaaaaaa',
    clipId: 'clip_aaaaaaaa',
    asset: {
      schemaVersion: 'sanverse.asset/media/v1' as const,
      mediaKind: 'video' as const,
      assetId: 'asset_aaaaaaaa',
      storageRef: 'project:source',
      sha256: 'a'.repeat(64),
      byteLength: 1_000,
      duration: ms(8_000),
      width: 1280,
      height: 720,
      frameRate: { numerator: 30, denominator: 1 },
      hasAudio: true,
      durationResidualSeconds: 0,
    },
  })
  if (!result.ok) throw new Error('fixture failed')
  return result.value
}

const withNameplate = (project: EditProject): EditProject => {
  const result = acceptChangeSet(project, {
    schemaVersion: 'sanverse.change-set/v1',
    changeSetId: 'changeset_aaaaaaaa',
    baseRevision: project.revision,
    operations: [{
      schemaVersion: 'sanverse.operation/v3',
      operationId: 'operation_aaaaaaaa',
      kind: 'add-nameplate',
      capabilityId: 'sanverse.nameplate.component/v1',
      assetId: 'asset_aaaaaaaa',
      sourceInterval: { start: ms(1_000), duration: ms(5_000) },
      target: { coordinateSpace: 'composition-normalized', point: { x: 0.25, y: 0.5 }, anchor: 'center' },
      primaryText: 'Santosh',
      secondaryText: 'Founder',
      extensions: {},
    }],
    provenance: { source: 'direct', requestId: null },
    extensions: {},
  })
  if (!result.ok) throw new Error(`fixture failed: ${JSON.stringify(result.error)}`)
  return result.value
}

const stubRenderer = (): RenderPort => ({
  render: vi.fn(async (request) => ({
    outputPath: request.outputPath,
    width: 1280,
    height: 720,
    durationMs: 8_000,
    hasAudio: true,
    sha256: 'abc',
    projectRevision: request.plan.projectRevision,
  })),
})

const paths = { sourcePath: 'source.mp4', outputPath: 'export.mp4', trustedWorkDir: 'trusted' }

describe('render service', () => {
  it('compiles the saved project itself instead of trusting a supplied edit list', async () => {
    const renderer = stubRenderer()
    const project = withNameplate(baseProject())

    const result = await createRenderService({ renderer }).exportProject({ project, ...paths })

    expect(result.outputPath).toBe('export.mp4')
    const request = (renderer.render as ReturnType<typeof vi.fn>).mock.calls[0][0]
    expect(request.plan.schemaVersion).toBe('sanverse.render-plan/v3')
    expect(request.plan.overlays).toHaveLength(1)
    expect(request.plan.overlays[0].primaryText).toBe('Santosh')
    // The footage itself is described too, not just what is drawn on it.
    expect(request.plan.segments).toHaveLength(1)
    // The exported file can be traced back to the exact project state.
    expect(request.plan.projectRevision).toBe(project.revision)
    expect(result.projectRevision).toBe(project.revision)
  })

  it('refuses to export a project with nothing switched on', async () => {
    const renderer = stubRenderer()
    const service = createRenderService({ renderer })

    await expect(service.exportProject({ project: baseProject(), ...paths }))
      .rejects.toMatchObject({ code: 'NOTHING_TO_RENDER' })

    const switchedOff = setChangeSetActive(withNameplate(baseProject()), 'changeset_aaaaaaaa', false)
    if (!switchedOff.ok) throw new Error('fixture failed')
    await expect(service.exportProject({ project: switchedOff.value, ...paths }))
      .rejects.toMatchObject({ code: 'NOTHING_TO_RENDER' })

    expect(renderer.render).not.toHaveBeenCalled()
  })

  it('fails before invoking the renderer when the project cannot be compiled', async () => {
    const renderer = stubRenderer()
    const broken = { ...baseProject(), composition: { ...baseProject().composition, tracks: [] } } as EditProject

    await expect(createRenderService({ renderer }).exportProject({ project: broken, ...paths }))
      .rejects.toMatchObject({ code: 'RENDER_PROJECT_INVALID' })
    expect(renderer.render).not.toHaveBeenCalled()
  })
})
