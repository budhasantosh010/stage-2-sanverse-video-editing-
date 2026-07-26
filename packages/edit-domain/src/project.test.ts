import { describe, expect, it } from 'vitest'

import {
  acceptChangeSet,
  activeOperations,
  blockedChangeSets,
  deserializeProject,
  redoChangeSet,
  serializeProject,
  setChangeSetActive,
  undoChangeSet,
  validateProject,
} from './project'
import { ms, testChangeSet, testProject } from './test-fixtures'

const accept = (project: ReturnType<typeof testProject>, changeSetId: string, baseRevision: number, startMs: number) => {
  const result = acceptChangeSet(
    project,
    testChangeSet(
      { changeSetId, baseRevision },
      {
        operationId: `operation_${changeSetId.slice(-8)}`,
        compositionInterval: { start: ms(startMs), duration: ms(2_000) },
        sampledClipTime: ms(startMs),
      },
    ),
  )
  if (!result.ok) throw new Error(`accept failed: ${JSON.stringify(result.error)}`)
  return result.value
}

describe('accepting a change set', () => {
  it('advances the revision by exactly one', () => {
    const project = testProject()
    expect(project.revision).toBe(0)
    const next = accept(project, 'changeset_aaaaaaaa', 0, 1_000)
    expect(next.revision).toBe(1)
    expect(activeOperations(next)).toHaveLength(1)
  })

  it('leaves the original project untouched', () => {
    const project = testProject()
    accept(project, 'changeset_aaaaaaaa', 0, 1_000)
    expect(project.revision).toBe(0)
    expect(project.changeSets).toHaveLength(0)
  })

  it('refuses a change set built against a stale revision', () => {
    // The four-second-old AI answer. The user deleted something while the AI
    // was thinking, so the answer no longer describes the project it lands on.
    const project = accept(testProject(), 'changeset_aaaaaaaa', 0, 1_000)
    const stale = acceptChangeSet(project, testChangeSet({ changeSetId: 'changeset_bbbbbbbb', baseRevision: 0 }))
    expect(stale).toEqual({
      ok: false,
      error: { code: 'REVISION_CONFLICT', expected: 1, received: 0 },
    })
  })

  it('refuses a reused change set ID even after an undo', () => {
    const project = accept(testProject(), 'changeset_aaaaaaaa', 0, 1_000)
    const undone = undoChangeSet(project)
    if (!undone.ok) throw new Error('setup failed')
    const replay = acceptChangeSet(
      undone.value,
      testChangeSet({ changeSetId: 'changeset_aaaaaaaa', baseRevision: undone.value.revision }),
    )
    expect(replay).toMatchObject({ ok: false, error: { code: 'DUPLICATE_CHANGE_SET_ID' } })
  })

  it('refuses an operation that does not fit the video, before it is ever saved', () => {
    const project = testProject()
    const result = acceptChangeSet(
      project,
      testChangeSet({}, { compositionInterval: { start: ms(4_980_000), duration: ms(5_000) } }),
    )
    expect(result).toMatchObject({ ok: false, error: { code: 'OPERATION_INVALID' } })
  })
})

describe('undo and redo work in whole approved steps', () => {
  it('reverses one change set at a time and can replay it', () => {
    const project = accept(accept(testProject(), 'changeset_aaaaaaaa', 0, 1_000), 'changeset_bbbbbbbb', 1, 5_000)
    expect(activeOperations(project)).toHaveLength(2)

    const undone = undoChangeSet(project)
    if (!undone.ok) throw new Error('setup failed')
    expect(activeOperations(undone.value)).toHaveLength(1)
    expect(undone.value.revision).toBe(3)

    const redone = redoChangeSet(undone.value)
    if (!redone.ok) throw new Error('setup failed')
    expect(activeOperations(redone.value)).toHaveLength(2)
  })

  it('discards the redo branch once new work is accepted', () => {
    const project = accept(testProject(), 'changeset_aaaaaaaa', 0, 1_000)
    const undone = undoChangeSet(project)
    if (!undone.ok) throw new Error('setup failed')
    expect(undone.value.redoStack).toHaveLength(1)
    const next = accept(undone.value, 'changeset_bbbbbbbb', undone.value.revision, 5_000)
    expect(next.redoStack).toHaveLength(0)
  })

  it('reports nothing to undo on a fresh project', () => {
    expect(undoChangeSet(testProject())).toEqual({ ok: false, error: { code: 'NOTHING_TO_UNDO' } })
    expect(redoChangeSet(testProject())).toEqual({ ok: false, error: { code: 'NOTHING_TO_REDO' } })
  })
})

describe('switching one edit off without destroying later ones', () => {
  it('removes the middle edit and keeps the ones after it', () => {
    // In v1 the only way to remove the second of three edits was to undo the
    // third first, destroying good work to reach one bad edit.
    let project = accept(testProject(), 'changeset_aaaaaaaa', 0, 1_000)
    project = accept(project, 'changeset_bbbbbbbb', project.revision, 5_000)
    project = accept(project, 'changeset_cccccccc', project.revision, 9_000)
    expect(activeOperations(project)).toHaveLength(3)

    const result = setChangeSetActive(project, 'changeset_bbbbbbbb', false)
    if (!result.ok) throw new Error('setup failed')
    expect(activeOperations(result.value)).toHaveLength(2)
    expect(result.value.changeSets).toHaveLength(3)
    expect(result.value.revision).toBe(4)

    const restored = setChangeSetActive(result.value, 'changeset_bbbbbbbb', true)
    if (!restored.ok) throw new Error('setup failed')
    expect(activeOperations(restored.value)).toHaveLength(3)
  })

  it('does not advance the revision when nothing actually changes', () => {
    const project = accept(testProject(), 'changeset_aaaaaaaa', 0, 1_000)
    const result = setChangeSetActive(project, 'changeset_aaaaaaaa', true)
    if (!result.ok) throw new Error('setup failed')
    expect(result.value.revision).toBe(project.revision)
  })

  it('refuses to touch a change set the project does not hold', () => {
    expect(setChangeSetActive(testProject(), 'changeset_zzzzzzzz', false)).toMatchObject({
      ok: false,
      error: { code: 'CHANGE_SET_UNKNOWN' },
    })
  })

  it('reports blocked change sets rather than quietly adjusting them', () => {
    const project = accept(testProject(), 'changeset_aaaaaaaa', 0, 1_000)
    expect(blockedChangeSets(project)).toHaveLength(0)
  })
})

describe('reading a saved project', () => {
  it('round-trips through JSON without loss', () => {
    const project = accept(testProject(), 'changeset_aaaaaaaa', 0, 1_000)
    const serialized = serializeProject(project)
    if (!serialized.ok) throw new Error('setup failed')
    const restored = deserializeProject(serialized.value)
    if (!restored.ok) throw new Error(`restore failed: ${JSON.stringify(restored.error)}`)
    expect(restored.value).toEqual(project)
    expect(serializeProject(restored.value)).toEqual(serialized)
  })

  it('preserves an unknown extension across a read and a write', () => {
    const project = testProject()
    const withNote = { ...project, extensions: { 'future.app/layout': { columns: 3 } } }
    const serialized = serializeProject(withNote)
    if (!serialized.ok) throw new Error(`setup failed: ${JSON.stringify(serialized.error)}`)
    expect(JSON.parse(serialized.value).extensions).toEqual({ 'future.app/layout': { columns: 3 } })
  })

  it('refuses a project with an unknown top-level field', () => {
    const project = testProject()
    expect(validateProject({ ...project, mystery: 1 })).toMatchObject({ ok: false })
  })

  it('refuses a project whose clock is not the project clock', () => {
    const project = testProject()
    expect(validateProject({ ...project, timescale: 90_000 })).toMatchObject({ ok: false })
  })

  it('refuses malformed JSON without throwing', () => {
    expect(deserializeProject('{not json')).toMatchObject({ ok: false })
  })

  it('freezes the validated project', () => {
    const project = testProject()
    expect(Object.isFrozen(project)).toBe(true)
    expect(() => ((project as { revision: number }).revision = 99)).toThrow()
  })
})
