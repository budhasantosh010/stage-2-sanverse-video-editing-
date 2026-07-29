import { describe, expect, it, vi } from 'vitest'

import { exportProject } from './project-export'

describe('project export client', () => {
  it('sends no edit list and accepts only a same-project export result', async () => {
    const result = {
      id: 'export_1234567890abcdef',
      mediaUrl: '/api/projects/project_1234567890abcdef/exports/export_1234567890abcdef/media',
      sha256: 'b'.repeat(64), width: 1920, height: 1080, durationMs: 60_000, hasAudio: true,
    }
    const fetcher = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({
        jobId: 'job_1234567890abcdef',
        projectId: 'project_1234567890abcdef',
        status: 'queued',
        progress: 0,
      }), { status: 202, headers: { 'content-type': 'application/json' } }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        jobId: 'job_1234567890abcdef',
        projectId: 'project_1234567890abcdef',
        status: 'succeeded',
        progress: 1,
        result,
      }), { status: 200, headers: { 'content-type': 'application/json' } }))

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
})
