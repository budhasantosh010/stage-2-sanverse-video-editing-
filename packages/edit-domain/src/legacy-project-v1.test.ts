import { describe, expect, it } from 'vitest'

import type { AddNameplateAction } from './actions'
import { accept, createHistory } from './history'
import { createProjectV1, validateProjectV1 } from './legacy-project-v1'

const nameplate: AddNameplateAction = {
  schemaVersion: 'sanverse.action/v1',
  actionId: 'action-1',
  kind: 'add-nameplate',
  target: { x: 0.25, y: 0.75, sourceTimeMs: 0 },
  primaryText: 'Name',
  secondaryText: '',
  startMs: 0,
  durationMs: 5_000,
}

describe('legacy v1 project reader', () => {
  it('reads a canonical v1 project so it can be migrated', () => {
    const accepted = accept(createHistory(), nameplate)
    if (!accepted.ok) throw new Error('test setup failed')
    const project = createProjectV1('project-1', accepted.value)
    if (!project.ok) throw new Error('test setup failed')

    expect(project.value.schemaVersion).toBe('sanverse.project/v1')
    expect(project.value.history.accepted).toHaveLength(1)
    expect(Object.isFrozen(project.value)).toBe(true)
  })

  it('rejects an empty project ID explicitly', () => {
    expect(createProjectV1('   ', createHistory())).toEqual({
      ok: false,
      error: { code: 'PROJECT_ID_REQUIRED' },
    })
  })

  it('rejects forged invalid or duplicate history', () => {
    const invalid = { ...nameplate, target: { ...nameplate.target, x: 2 }, durationMs: 0 }
    const duplicateHistory = {
      accepted: [nameplate],
      redoStack: [nameplate],
      issuedActionIds: ['action-1'],
    }

    expect(
      createProjectV1('project-1', { accepted: [invalid], redoStack: [], issuedActionIds: ['action-1'] }),
    ).toMatchObject({ ok: false })
    expect(createProjectV1('project-1', duplicateHistory)).toMatchObject({ ok: false })
    expect(validateProjectV1({ schemaVersion: 'sanverse.project/v2' })).toMatchObject({ ok: false })
  })
})
