import { describe, expect, it } from 'vitest'

import type { AddNameplateAction } from './actions'
import { accept, createHistory } from './history'
import { createProject, serializeProject } from './project'

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

describe('project serialization', () => {
  it('serializes canonical project data reproducibly', () => {
    const accepted = accept(createHistory(), nameplate)
    if (!accepted.ok) throw new Error('test setup failed')
    const projectResult = createProject('project-1', accepted.value)
    if (!projectResult.ok) throw new Error('test setup failed')
    const project = projectResult.value

    const serialized = serializeProject(project)
    expect(serialized).toEqual({
      ok: true,
      value:
        '{"schemaVersion":"sanverse.project/v1","projectId":"project-1","history":{"accepted":[{"schemaVersion":"sanverse.action/v1","actionId":"action-1","kind":"add-nameplate","target":{"x":0.25,"y":0.75,"sourceTimeMs":0},"primaryText":"Name","secondaryText":"","startMs":0,"durationMs":5000}],"redoStack":[],"issuedActionIds":["action-1"]}}',
    })
    expect(serializeProject(project)).toEqual(serialized)
  })

  it('rejects an empty project ID explicitly', () => {
    expect(createProject('   ', createHistory())).toEqual({
      ok: false,
      error: { code: 'PROJECT_ID_REQUIRED' },
    })
  })

  it('freezes the validated project envelope at runtime', () => {
    const result = createProject('project-1', createHistory())
    if (!result.ok) throw new Error('test setup failed')

    expect(Object.isFrozen(result.value)).toBe(true)
    expect(() => ((result.value as { projectId: string }).projectId = 'forged')).toThrow()
  })

  it('rejects forged invalid or duplicate history instead of serializing it', () => {
    const invalid = { ...nameplate, target: { ...nameplate.target, x: 2 }, durationMs: 0 }
    const duplicateHistory = {
      accepted: [nameplate],
      redoStack: [nameplate],
      issuedActionIds: ['action-1'],
    }

    expect(
      createProject('project-1', { accepted: [invalid], redoStack: [], issuedActionIds: ['action-1'] }),
    ).toMatchObject({ ok: false })
    expect(createProject('project-1', duplicateHistory)).toMatchObject({ ok: false })
    expect(
      serializeProject({
        schemaVersion: 'sanverse.project/v1',
        projectId: 'forged',
        history: duplicateHistory,
      }),
    ).toMatchObject({ ok: false })
  })
})
