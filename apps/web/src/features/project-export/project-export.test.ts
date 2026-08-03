import { describe, expect, it, vi } from 'vitest'

import {
  exportPhaseMessage,
  exportProject,
  formatExportElapsed,
  ProjectExportTimeout,
  type ProjectExportProgress,
} from './project-export'

const PROJECT = 'project_1234567890abcdef'
const JOB = 'job_1234567890abcdef'

const jobBody = (
  over: Partial<{ status: string; phase: string; progress: number; result: unknown }> = {},
) => JSON.stringify({
  jobId: JOB,
  projectId: PROJECT,
  status: 'queued',
  phase: 'queued',
  progress: 0,
  ...over,
})

const jsonResponse = (body: string, status: number) =>
  new Response(body, { status, headers: { 'content-type': 'application/json' } })

describe('project export client', () => {
  it('sends no edit list and accepts only a same-project export result', async () => {
    const result = {
      id: 'export_1234567890abcdef',
      mediaUrl: '/api/projects/project_1234567890abcdef/exports/export_1234567890abcdef/media',
      sha256: 'b'.repeat(64), width: 1920, height: 1080, durationMs: 60_000, hasAudio: true,
    }
    const fetcher = vi.fn()
      .mockResolvedValueOnce(jsonResponse(jobBody(), 202))
      .mockResolvedValueOnce(jsonResponse(jobBody({ status: 'succeeded', phase: 'done', progress: 1, result }), 200))

    await expect(exportProject('project_1234567890abcdef', fetcher)).resolves.toMatchObject({ id: 'export_1234567890abcdef', width: 1920, height: 1080 })
    // The browser cannot say what to render. The server compiles the project
    // it has stored, so the export always matches what was accepted.
    const [, init] = fetcher.mock.calls[0]
    expect(init.method).toBe('POST')
    expect(init.body).toBeUndefined()
  })

  it('fails with a stable recoverable message for rejection or malformed success', async () => {
    await expect(exportProject('project_1234567890abcdef', vi.fn().mockResolvedValue(new Response('{}', { status: 500 })))).rejects.toThrow(/accepted edits are still safe/i)
    await expect(exportProject('project_1234567890abcdef', vi.fn().mockResolvedValue(new Response('{}', { status: 202 })))).rejects.toThrow(/accepted edits are still safe/i)
  })

  it('preserves an allowlisted renderer code and gives an actionable local recovery message', async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      error: 'The local renderer process was blocked from starting.',
      code: 'RENDER_PROCESS_BLOCKED',
    }), { status: 503, headers: { 'content-type': 'application/json' } }))

    await expect(exportProject('project_1234567890abcdef', fetcher)).rejects.toMatchObject({
      code: 'RENDER_PROCESS_BLOCKED',
      message: expect.stringMatching(/restart Sanverse in PowerShell.*accepted edits are still safe/i),
    })
  })

  it('stops waiting at a bounded timeout instead of polling a job forever', async () => {
    // The recorded failure: the loop polled `queued || running` with no bound,
    // so a job the server never finished produced a spinner that could not end.
    // A fresh Response per call: a body can only be read once.
    const fetcher = vi.fn()
      .mockResolvedValueOnce(jsonResponse(jobBody(), 202))
      .mockImplementation(async () =>
        jsonResponse(jobBody({ status: 'running', phase: 'rendering', progress: 0.2 }), 200))

    let clock = 0
    const now = () => { clock += 30_000; return clock }

    const failure = await exportProject(PROJECT, fetcher, undefined, { timeoutMs: 90_000, now })
      .then(() => null, (error: unknown) => error)

    expect(failure).toBeInstanceOf(ProjectExportTimeout)
    expect(failure).toMatchObject({ jobId: JOB, phase: 'rendering' })
    // The job is deliberately left alive: it may still finish, and its result
    // stays valid. Cancelling would throw away a nearly finished render.
    expect(fetcher.mock.calls.some(([, init]) => (init as RequestInit | undefined)?.method === 'DELETE')).toBe(false)
  })

  it('reports the real phase the server is in, and never invents one', async () => {
    const result = {
      id: 'export_1234567890abcdef',
      mediaUrl: `/api/projects/${PROJECT}/exports/export_1234567890abcdef/media`,
      sha256: 'c'.repeat(64), width: 1920, height: 1080, durationMs: 18_033, hasAudio: true,
    }
    const fetcher = vi.fn()
      .mockResolvedValueOnce(jsonResponse(jobBody(), 202))
      .mockResolvedValueOnce(jsonResponse(jobBody({ status: 'running', phase: 'rendering', progress: 0.2 }), 200))
      .mockResolvedValueOnce(jsonResponse(jobBody({ status: 'running', phase: 'verifying', progress: 0.85 }), 200))
      .mockResolvedValueOnce(jsonResponse(jobBody({ status: 'succeeded', phase: 'done', progress: 1, result }), 200))

    const seen: ProjectExportProgress[] = []
    await expect(exportProject(PROJECT, fetcher, undefined, { onProgress: (p) => seen.push(p) }))
      .resolves.toMatchObject({ id: 'export_1234567890abcdef' })

    // Nothing is reported once the job is finished — the result itself says that.
    expect(seen.map((entry) => entry.phase)).toEqual(['queued', 'rendering', 'verifying'])
    expect(seen.every((entry) => entry.jobId === JOB)).toBe(true)
  })

  it('refuses a job response that does not state its phase', async () => {
    const fetcher = vi.fn().mockResolvedValue(jsonResponse(JSON.stringify({
      jobId: JOB, projectId: PROJECT, status: 'queued', progress: 0,
    }), 202))
    await expect(exportProject(PROJECT, fetcher)).rejects.toThrow(/accepted edits are still safe/i)
  })

  it('gives each phase one plain sentence and a readable elapsed clock', () => {
    expect(exportPhaseMessage('queued')).toBe('Waiting to start…')
    expect(exportPhaseMessage('rendering')).toBe('Rendering your MP4…')
    expect(exportPhaseMessage('verifying')).toBe('Checking the finished MP4…')
    expect(formatExportElapsed(0)).toBe('0:00')
    expect(formatExportElapsed(7_400)).toBe('0:07')
    expect(formatExportElapsed(102_000)).toBe('1:42')
    expect(formatExportElapsed(-5)).toBe('0:00')
  })
})
