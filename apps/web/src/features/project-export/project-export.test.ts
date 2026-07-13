import { accept, createHistory, type AddNameplateAction } from '@sanverse/edit-domain'
import { describe, expect, it, vi } from 'vitest'

import { exportProject } from './project-export'

const action: AddNameplateAction = {
  schemaVersion: 'sanverse.action/v1', actionId: 'action-export-1', kind: 'add-nameplate',
  target: { x: 0.2, y: 0.3, sourceTimeMs: 1_000 }, primaryText: 'Santosh', secondaryText: 'Founder',
  startMs: 1_000, durationMs: 5_000,
}

function acceptedHistory() {
  const result = accept(createHistory(), action)
  if (!result.ok) throw new Error('fixture failed')
  return result.value
}

describe('project export client', () => {
  it('sends canonical history and accepts only a same-project export result', async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      id: 'export_1234567890abcdef',
      mediaUrl: '/api/projects/project_1234567890abcdef/exports/export_1234567890abcdef/media',
      sha256: 'b'.repeat(64), width: 1920, height: 1080, durationMs: 60_000, hasAudio: true,
    }), { status: 201, headers: { 'content-type': 'application/json' } }))

    await expect(exportProject('project_1234567890abcdef', acceptedHistory(), fetcher)).resolves.toMatchObject({ id: 'export_1234567890abcdef', width: 1920, height: 1080 })
    expect(fetcher).toHaveBeenCalledWith('/api/projects/project_1234567890abcdef/exports', expect.objectContaining({
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ history: acceptedHistory() }),
    }))
  })

  it('fails with a stable recoverable message for rejection or malformed success', async () => {
    await expect(exportProject('project_1234567890abcdef', acceptedHistory(), vi.fn().mockResolvedValue(new Response('{}', { status: 500 })))).rejects.toThrow(/accepted edits are still safe/i)
    await expect(exportProject('project_1234567890abcdef', acceptedHistory(), vi.fn().mockResolvedValue(new Response('{}', { status: 201 })))).rejects.toThrow(/accepted edits are still safe/i)
  })
})
