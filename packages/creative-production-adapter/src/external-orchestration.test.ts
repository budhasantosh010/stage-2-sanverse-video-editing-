import { describe, expect, it } from 'vitest'
import { createProject, mediaTime, type EditProject } from '@sanverse/edit-domain'
import { createCreativeProductionExternalOrchestrationSessionV1 } from './external-orchestration.ts'

const project = (projectId: string, revision = 0): EditProject => {
  const seed = projectId.replace('project_', '').padEnd(16, '0')
  const created = createProject({
    projectId,
    asset: Object.freeze({
      schemaVersion: 'sanverse.asset/media/v1' as const,
      mediaKind: 'video' as const,
      assetId: `asset_${seed.slice(0, 12)}`,
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
    compositionId: `composition_${seed.slice(0, 12)}`,
    trackId: `track_${seed.slice(0, 12)}`,
    clipId: `clip_${seed.slice(0, 12)}`,
  })
  if (!created.ok) throw new Error(JSON.stringify(created.error))
  return revision === 0 ? created.value : Object.freeze({ ...created.value, revision })
}

const invoke = async (session: Awaited<ReturnType<typeof createCreativeProductionExternalOrchestrationSessionV1>>, id: string, input: unknown = {}) => session.registry.invoke(id, input)

describe('external raw-video orchestration session — batch 1', () => {
  it('starts with zero projects and exposes project-independent tools without constructing a Creative candidate', async () => {
    const session = await createCreativeProductionExternalOrchestrationSessionV1({
      sessionLabel: 'zero-project',
      listProjects: async () => Object.freeze([]),
      readProject: async () => { throw new Error('must not read a project during zero-project startup') },
      importSourceVideo: async () => { throw new Error('unused') },
      sha256Text: async (text) => `sha256:${text.length}`,
    })
    expect(session.activeProjectId()).toBeNull()
    const listed = session.registry.list().map((tool) => tool.id)
    expect(listed).toHaveLength(73)
    expect(listed).toEqual(expect.arrayContaining([
      'production.list_projects',
      'production.select_project',
      'production.import_source_video',
      'production.get_project_context',
      'source.list_workspace_inputs',
      'source.attach_transcript',
      'source.get_transcript',
      'source.analyze_video',
      'creative.create_run',
      'creative.list_runs',
      'creative.get_run',
      'creative.resume_run',
      'creative.cancel_run',
      'creative.get_storyboard_authoring_schema',
      'creative.inspect_storyboard',
      'creative.apply_storyboard_graph_operations',
      'creative.apply_storyboard_design',
      'creative.manage_storyboard_kvs',
      'creative.set_storyboard_presentation',
      'creative.reopen_storyboard',
      'creative.prepare_review',
      'creative.get_review',
      'creative.decide_review',
      'creative.revise_scene',
      'production.get_creative_context',
      'create_storyboard_sandbox',
      'render_review',
    ]))
    expect((await invoke(session, 'production.list_projects')).ok).toBe(true)
    const context = await invoke(session, 'production.get_project_context')
    expect(context).toMatchObject({ ok: false, refusal: { code: 'PROJECT_REQUIRED' } })
    const legacyContext = await invoke(session, 'production.get_creative_context')
    expect(legacyContext).toMatchObject({ ok: false, refusal: { code: 'PROJECT_REQUIRED' } })
  })

  it('exposes safe workspace-relative input discovery and can attach an SRT by workspace-relative path', async () => {
    const p = project('project_workspace1234567')
    const session = await createCreativeProductionExternalOrchestrationSessionV1({
      sessionLabel: 'workspace-inputs',
      listProjects: async () => Object.freeze([{ id: p.projectId }]),
      readProject: async () => p,
      importSourceVideo: async () => { throw new Error('unused') },
      listWorkspaceInputs: async () => Object.freeze([
        Object.freeze({ relativePath: 'video.mp4', kind: 'video' as const, byteLength: 4096 }),
        Object.freeze({ relativePath: 'transcript.srt', kind: 'transcript' as const, byteLength: 64 }),
      ]),
      readWorkspaceTextFile: async ({ localPath }) => {
        expect(localPath).toBe('transcript.srt')
        return Object.freeze({ relativePath: 'transcript.srt', format: 'srt' as const, contents: '1\n00:00:01,000 --> 00:00:03,000\nWorkspace transcript.\n' })
      },
      sha256Text: async (text) => `sha256:${text.length}`,
    })
    const listed = await invoke(session, 'source.list_workspace_inputs')
    expect(listed).toMatchObject({ ok: true, value: { files: [{ relativePath: 'video.mp4' }, { relativePath: 'transcript.srt' }] } })
    expect(JSON.stringify(listed)).not.toMatch(/[A-Z]:\\/u)
    await invoke(session, 'production.select_project', { projectId: p.projectId })
    const attached = await invoke(session, 'source.attach_transcript', { localPath: 'transcript.srt', transactionId: 'workspace_transcript_txn' })
    expect(attached).toMatchObject({ ok: true, value: { projectId: p.projectId, cueCount: 1, analysisOnly: true } })
  })

  it('keeps workspace discovery unavailable when a transport does not provide workspace ports', async () => {
    const session = await createCreativeProductionExternalOrchestrationSessionV1({
      sessionLabel: 'http-no-workspace',
      listProjects: async () => Object.freeze([]),
      readProject: async () => { throw new Error('unused') },
      importSourceVideo: async () => { throw new Error('unused') },
      sha256Text: async (text) => `sha256:${text.length}`,
    })
    expect(await invoke(session, 'source.list_workspace_inputs')).toMatchObject({ ok: false, refusal: { code: 'WORKSPACE_UNAVAILABLE' } })
  })

  it('selects an existing project, enables the legacy production registry, and refreshes live project state', async () => {
    const p = project('project_1234567890abcdef')
    let current = p
    const session = await createCreativeProductionExternalOrchestrationSessionV1({
      sessionLabel: 'existing-project',
      listProjects: async () => Object.freeze([{ id: p.projectId, originalFilename: 'source.mp4', createdAt: '2026-08-29T00:00:00.000Z' }]),
      readProject: async (projectId) => {
        if (projectId !== p.projectId) throw new Error('not found')
        return current
      },
      importSourceVideo: async () => { throw new Error('unused') },
      sha256Text: async (text) => `sha256:${text.length}`,
    })
    const selected = await invoke(session, 'production.select_project', { projectId: p.projectId })
    expect(selected).toMatchObject({ ok: true, value: { projectId: p.projectId, revision: 0 } })
    expect(session.activeProjectId()).toBe(p.projectId)
    expect(session.registry.list().some((tool) => tool.id === 'production.get_creative_context')).toBe(true)
    current = Object.freeze({ ...current, revision: 3 })
    const context = await invoke(session, 'production.get_project_context')
    expect(context).toMatchObject({ ok: true, value: { projectId: p.projectId, revision: 3 } })
  })

  it('imports through the injected production intake port idempotently and makes the imported project active', async () => {
    const imported = project('project_abcdef1234567890')
    const byTransaction = new Map<string, typeof imported>()
    let calls = 0
    const session = await createCreativeProductionExternalOrchestrationSessionV1({
      sessionLabel: 'import-project',
      listProjects: async () => Object.freeze([...byTransaction.values()].map((p) => ({ id: p.projectId, originalFilename: 'raw.mp4' }))),
      readProject: async (projectId) => {
        const found = [...byTransaction.values()].find((item) => item.projectId === projectId)
        if (!found) throw new Error('not found')
        return found
      },
      importSourceVideo: async ({ transactionId }) => {
        calls += 1
        const existing = byTransaction.get(transactionId)
        if (existing) return Object.freeze({ project: existing, sourceSha256: 'b'.repeat(64), originalFilename: 'raw.mp4' })
        byTransaction.set(transactionId, imported)
        return Object.freeze({ project: imported, sourceSha256: 'b'.repeat(64), originalFilename: 'raw.mp4' })
      },
      sha256Text: async (text) => `sha256:${text.length}`,
    })
    const input = { localPath: 'C:/allowed/raw.mp4', projectLabel: 'Raw video', transactionId: 'import_txn_00000001' }
    const first = await invoke(session, 'production.import_source_video', input)
    const second = await invoke(session, 'production.import_source_video', input)
    expect(first).toMatchObject({ ok: true, value: { projectId: imported.projectId, revision: 0, sourceSha256: 'b'.repeat(64) } })
    expect(second).toEqual(first)
    expect(calls).toBe(1)
    expect(session.activeProjectId()).toBe(imported.projectId)
  })

  it('attaches plain/SRT/VTT transcripts as analysis-only artifacts and produces a project-backed source packet with truthful limitations', async () => {
    const p = project('project_feedface12345678')
    const session = await createCreativeProductionExternalOrchestrationSessionV1({
      sessionLabel: 'transcript-analysis',
      listProjects: async () => Object.freeze([{ id: p.projectId }]),
      readProject: async () => p,
      importSourceVideo: async () => { throw new Error('unused') },
      sha256Text: async (text) => `sha256:${text.length}`,
    })
    await invoke(session, 'production.select_project', { projectId: p.projectId })
    const plain = await invoke(session, 'source.attach_transcript', { format: 'plain', contents: 'Revenue grew 82 percent this quarter.', transactionId: 'transcript_txn_0001' })
    expect(plain).toMatchObject({ ok: true, value: { projectId: p.projectId, cueCount: 1, analysisOnly: true } })
    const plainId = (plain as any).value.transcriptRef as string
    const fetched = await invoke(session, 'source.get_transcript', { transcriptRef: plainId })
    expect(fetched).toMatchObject({ ok: true, value: { id: plainId, analysisOnly: true } })

    const srt = await invoke(session, 'source.attach_transcript', { format: 'srt', contents: '1\n00:00:01,000 --> 00:00:03,000\nWhy did revenue grow 82 percent?\n', transactionId: 'transcript_txn_0002' })
    expect((srt as any).value.cues[0]).toMatchObject({ startTick: 1_440_000, endTick: 4_320_000 })
    const vtt = await invoke(session, 'source.attach_transcript', { format: 'vtt', contents: 'WEBVTT\n\n00:00:04.000 --> 00:00:06.000\nFirst, compare plan A versus plan B.\n', transactionId: 'transcript_txn_0003' })
    expect((vtt as any).value.cueCount).toBe(1)

    const analyzed = await invoke(session, 'source.analyze_video', { transcriptRef: (srt as any).value.transcriptRef })
    expect(analyzed).toMatchObject({
      ok: true,
      value: {
        schemaVersion: 'sanverse.source-understanding-packet/v1',
        projectId: p.projectId,
        projectRevision: 0,
        sourceDurationTicks: 14_400_000,
      },
    })
    expect((analyzed as any).value.observations.some((item: any) => item.kind === 'semantic-moment')).toBe(true)
    expect((analyzed as any).value.limitations).toContain('No automatic face/object/surface detection was run; those capabilities are not fabricated from transcript evidence.')
    expect(p.changeSets).toHaveLength(0)
  })

  it('refuses out-of-bounds timed transcript cues and transcript/project mismatches', async () => {
    const a = project('project_1111111111111111')
    const b = project('project_2222222222222222')
    let active = a
    const session = await createCreativeProductionExternalOrchestrationSessionV1({
      sessionLabel: 'transcript-stale',
      listProjects: async () => Object.freeze([{ id: a.projectId }, { id: b.projectId }]),
      readProject: async (id) => id === a.projectId ? a : b,
      importSourceVideo: async () => { throw new Error('unused') },
      sha256Text: async (text) => `sha256:${text.length}`,
    })
    await invoke(session, 'production.select_project', { projectId: active.projectId })
    const invalid = await invoke(session, 'source.attach_transcript', { format: 'srt', contents: '1\n00:00:09,000 --> 00:00:12,000\nRuns beyond source.\n', transactionId: 'transcript_txn_bad1' })
    expect(invalid).toMatchObject({ ok: false, refusal: { code: 'TRANSCRIPT_INVALID' } })
    const good = await invoke(session, 'source.attach_transcript', { format: 'plain', contents: 'One source.', transactionId: 'transcript_txn_good' })
    const transcriptRef = (good as any).value.transcriptRef
    active = b
    await invoke(session, 'production.select_project', { projectId: active.projectId })
    const mismatch = await invoke(session, 'source.get_transcript', { transcriptRef })
    expect(mismatch).toMatchObject({ ok: false, refusal: { code: 'TRANSCRIPT_SOURCE_MISMATCH' } })
  })
})
