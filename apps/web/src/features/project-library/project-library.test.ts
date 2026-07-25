import { describe, expect, it, vi } from 'vitest'

import { listRecentProjects, loadProject, saveProjectHistory } from './project-library'

const projectId = 'project_1234567890abcdef'
const manifest = {
  id: projectId,
  originalFilename: 'owner.mp4',
  createdAt: '2026-07-14T00:00:00.000Z',
  sizeBytes: 24,
  sha256: 'a'.repeat(64),
  mediaUrl: `/api/projects/${projectId}/media`,
}
const history = {
  accepted: [{ schemaVersion: 'sanverse.action/v1' as const, actionId: 'action-1', kind: 'add-nameplate' as const, target: { x: 0.2, y: 0.3, sourceTimeMs: 1_000 }, primaryText: 'Santosh', secondaryText: '', startMs: 1_000, durationMs: 5_000 }],
  redoStack: [], issuedActionIds: ['action-1'],
}

describe('project library client', () => {
  it('lists and loads only controlled local project contracts', async () => {
    const fetcher = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ projects: [manifest] }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ ...manifest, history }), { status: 200 }))

    await expect(listRecentProjects(fetcher)).resolves.toEqual([manifest])
    await expect(loadProject(projectId, fetcher)).resolves.toEqual({ ...manifest, history })
  })

  it('saves validated canonical history through the bounded project route', async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({ history }), { status: 200 }))

    await expect(saveProjectHistory(projectId, history, fetcher)).resolves.toEqual(history)
    expect(fetcher).toHaveBeenCalledWith(`/api/projects/${projectId}/history`, expect.objectContaining({ method: 'PUT', body: JSON.stringify({ history }) }))
  })
})
