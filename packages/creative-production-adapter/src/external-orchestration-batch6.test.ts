import { createHash } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import { createProject, type EditProject } from '@sanverse/edit-domain'
import { mediaTime } from '@sanverse/edit-domain/time'
import {
  createCreativeProductionExternalOrchestrationSessionV1,
  type ExternalProductionExportJobV1,
} from './external-orchestration.ts'

const baseProject = (): EditProject => {
  const projectId = 'project_1234567890abcdef'
  const made = createProject({
    projectId,
    asset: Object.freeze({
      schemaVersion: 'sanverse.asset/media/v1' as const,
      mediaKind: 'video' as const,
      assetId: 'asset_1234567890ab',
      storageRef: `project:${projectId}/source`,
      sha256: 'a'.repeat(64),
      byteLength: 4096,
      duration: mediaTime(14_400_000),
      width: 1280,
      height: 720,
      frameRate: Object.freeze({ numerator: 30, denominator: 1 }),
      hasAudio: true,
      durationResidualSeconds: 0,
    }),
    compositionId: 'composition_1234567890ab',
    trackId: 'track_1234567890ab',
    clipId: 'clip_1234567890ab',
  })
  if (!made.ok) throw new Error(JSON.stringify(made.error))
  return made.value
}

const sha256Text = async (text: string) => createHash('sha256').update(text).digest('hex')

const job = (
  project: EditProject,
  status: ExternalProductionExportJobV1['status'],
  progress: number,
): ExternalProductionExportJobV1 => Object.freeze({
  jobId: 'job_1234567890abcdef',
  projectId: project.projectId,
  projectRevision: project.revision,
  exportId: 'export_1234567890abcdef',
  status,
  progress,
  phase: status === 'queued' ? 'queued' : status === 'running' ? 'rendering' : 'done',
  ...(status === 'succeeded' ? {
    result: Object.freeze({
      id: 'export_1234567890abcdef',
      mediaUrl: `/api/projects/${project.projectId}/exports/export_1234567890abcdef/media`,
      sha256: 'b'.repeat(64),
      width: 1280,
      height: 720,
      durationMs: 10_000,
      hasAudio: true,
      projectRevision: project.revision,
    }),
  } : {}),
})

describe('raw-video external orchestration — production export authority', () => {
  it('exposes export/status/cancel through the existing production job authority with exact revision fencing', async () => {
    const project = baseProject()
    let currentJob = job(project, 'queued', 0)
    let createCalls = 0
    let readCalls = 0
    let cancelCalls = 0
    const session = await createCreativeProductionExternalOrchestrationSessionV1({
      sessionLabel: 'batch6-export',
      listProjects: async () => Object.freeze([{ id: project.projectId }]),
      readProject: async () => project,
      importSourceVideo: async () => { throw new Error('unused') },
      sha256Text,
      createExport: async (projectId) => {
        expect(projectId).toBe(project.projectId)
        createCalls += 1
        currentJob = job(project, 'queued', 0)
        return currentJob
      },
      readExportJob: async ({ projectId, jobId }) => {
        expect(projectId).toBe(project.projectId)
        expect(jobId).toBe(currentJob.jobId)
        readCalls += 1
        return currentJob
      },
      cancelExportJob: async ({ projectId, jobId }) => {
        expect(projectId).toBe(project.projectId)
        expect(jobId).toBe(currentJob.jobId)
        cancelCalls += 1
        currentJob = job(project, 'cancelled', 1)
        return currentJob
      },
    })

    expect(session.registry.list().map((item) => item.id)).toEqual(expect.arrayContaining([
      'production.export_video',
      'production.get_export_status',
      'production.cancel_export',
    ]))

    expect(await session.registry.invoke('production.export_video', { productionRevision: project.revision })).toMatchObject({
      ok: false,
      refusal: { code: 'PROJECT_REQUIRED' },
    })
    expect((await session.registry.invoke('production.select_project', { projectId: project.projectId })).ok).toBe(true)

    expect(await session.registry.invoke('production.export_video', { productionRevision: project.revision + 1 })).toMatchObject({
      ok: false,
      refusal: { code: 'PRODUCTION_REVISION_STALE' },
    })
    expect(createCalls).toBe(0)

    const created = await session.registry.invoke('production.export_video', { productionRevision: project.revision })
    expect(created).toMatchObject({
      ok: true,
      value: { jobId: currentJob.jobId, projectId: project.projectId, projectRevision: project.revision, status: 'queued' },
    })
    expect(createCalls).toBe(1)

    currentJob = job(project, 'running', 0.2)
    expect(await session.registry.invoke('production.get_export_status', { jobId: currentJob.jobId })).toMatchObject({
      ok: true,
      value: { status: 'running', progress: 0.2 },
    })
    expect(readCalls).toBe(1)

    expect(await session.registry.invoke('production.cancel_export', { jobId: currentJob.jobId })).toMatchObject({
      ok: true,
      value: { status: 'cancelled', progress: 1 },
    })
    expect(cancelCalls).toBe(1)
  })

  it('fails closed for unknown or cross-project export jobs', async () => {
    const project = baseProject()
    const session = await createCreativeProductionExternalOrchestrationSessionV1({
      sessionLabel: 'batch6-export-isolation',
      listProjects: async () => Object.freeze([{ id: project.projectId }]),
      readProject: async () => project,
      importSourceVideo: async () => { throw new Error('unused') },
      sha256Text,
      readExportJob: async () => { throw new Error('404 export job not found') },
      cancelExportJob: async () => Object.freeze({ ...job(project, 'cancelled', 1), projectId: 'project_abcdef1234567890' }),
    })
    expect((await session.registry.invoke('production.select_project', { projectId: project.projectId })).ok).toBe(true)

    expect(await session.registry.invoke('production.get_export_status', { jobId: 'job_1234567890abcdef' })).toMatchObject({
      ok: false,
      refusal: { code: 'EXPORT_NOT_READY' },
    })
    expect(await session.registry.invoke('production.cancel_export', { jobId: 'job_1234567890abcdef' })).toMatchObject({
      ok: false,
      refusal: { code: 'EXPORT_NOT_READY' },
    })
    expect(await session.registry.invoke('production.get_export_status', { jobId: 'not-a-job' })).toMatchObject({
      ok: false,
      refusal: { code: 'EXPORT_NOT_READY' },
    })
  })
})
