import { describe, expect, it, vi } from 'vitest'

import { uploadProject } from './project-intake'

describe('uploadProject', () => {
  it('streams the selected file to the same-origin API and returns the controlled project', async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({ id: 'project_1234567890abcdef', originalFilename: 'clip.mp4', mediaUrl: '/api/projects/project_1234567890abcdef/media', createdAt: '2026-07-13T00:00:00.000Z', sizeBytes: 3, sha256: 'a'.repeat(64) }), { status: 201, headers: { 'content-type': 'application/json' } }))
    const file = new File(['abc'], 'clip name.mp4', { type: 'video/mp4' })

    await expect(uploadProject(file, fetcher)).resolves.toMatchObject({ id: 'project_1234567890abcdef', mediaUrl: '/api/projects/project_1234567890abcdef/media' })
    expect(fetcher).toHaveBeenCalledWith('/api/projects', expect.objectContaining({ method: 'POST', body: file, headers: expect.objectContaining({ 'X-Sanverse-Filename': 'clip%20name.mp4', 'Content-Type': 'video/mp4' }) }))
  })

  it('reports a recoverable error for a failed or malformed response', async () => {
    await expect(uploadProject(new File(['x'], 'clip.mp4'), vi.fn().mockResolvedValue(new Response('{"error":"bad"}', { status: 400 })))).rejects.toThrow(/could not import/i)
    await expect(uploadProject(new File(['x'], 'clip.mp4'), vi.fn().mockResolvedValue(new Response('{}', { status: 201 })))).rejects.toThrow(/could not import/i)
  })
})
