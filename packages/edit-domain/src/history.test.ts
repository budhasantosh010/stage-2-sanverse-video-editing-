import { describe, expect, it } from 'vitest'

import type { AddNameplateAction } from './actions'
import { accept, createHistory, redo, undo, validateHistory } from './history'

const action = (actionId: string): AddNameplateAction => ({
  schemaVersion: 'sanverse.action/v1',
  actionId,
  kind: 'add-nameplate',
  target: { x: 0.5, y: 0.5, sourceTimeMs: 1_000 },
  primaryText: 'Name',
  secondaryText: 'Role',
  startMs: 1_000,
  durationMs: 5_000,
})

describe('edit history', () => {
  it('accepts a proposal exactly once without mutating earlier history', () => {
    const original = createHistory()
    const result = accept(original, action('action-1'))

    expect(result.ok).toBe(true)
    expect(result.ok && result.value.accepted).toEqual([action('action-1')])
    expect(original).toEqual({ accepted: [], redoStack: [], issuedActionIds: [] })
  })

  it('protects canonical history from runtime mutation', () => {
    const result = accept(createHistory(), action('action-1'))
    if (!result.ok) throw new Error('test setup failed')

    expect(Object.isFrozen(result.value)).toBe(true)
    expect(Object.isFrozen(result.value.accepted)).toBe(true)
    expect(Object.isFrozen(result.value.issuedActionIds)).toBe(true)
    expect(Object.isFrozen(result.value.accepted[0])).toBe(true)
    expect(Object.isFrozen(result.value.accepted[0]?.target)).toBe(true)
    expect(() => (result.value.accepted as AddNameplateAction[]).push(action('action-2'))).toThrow()
  })

  it('rejects duplicate IDs across accepted and redo history without mutation', () => {
    const once = accept(createHistory(), action('action-1'))
    if (!once.ok) throw new Error('test setup failed')
    const undone = undo(once.value)
    if (!undone.ok) throw new Error('test setup failed')
    const before = undone.value

    const duplicate = accept(before, action('action-1'))

    expect(duplicate).toEqual({
      ok: false,
      error: { code: 'DUPLICATE_ACTION_ID', actionId: 'action-1' },
    })
    expect(before.redoStack).toHaveLength(1)
    expect(before.accepted).toHaveLength(0)
  })

  it('never permits a previously issued action ID after redo is cleared', () => {
    const first = accept(createHistory(), action('action-1'))
    if (!first.ok) throw new Error('test setup failed')
    const undone = undo(first.value)
    if (!undone.ok) throw new Error('test setup failed')
    const second = accept(undone.value, action('action-2'))
    if (!second.ok) throw new Error('test setup failed')

    const reused = accept(second.value, action('action-1'))

    expect(reused).toEqual({
      ok: false,
      error: { code: 'DUPLICATE_ACTION_ID', actionId: 'action-1' },
    })
    expect(second.value.issuedActionIds).toEqual(['action-1', 'action-2'])
    expect(second.value.accepted).toEqual([action('action-2')])
  })

  it('undoes and redoes immutably', () => {
    const first = accept(createHistory(), action('action-1'))
    if (!first.ok) throw new Error('test setup failed')
    const snapshot = first.value

    const undone = undo(snapshot)
    expect(undone.ok && undone.value.accepted).toEqual([])
    expect(undone.ok && undone.value.redoStack).toEqual([action('action-1')])
    expect(snapshot.accepted).toEqual([action('action-1')])

    if (!undone.ok) throw new Error('test setup failed')
    const redone = redo(undone.value)
    expect(redone.ok && redone.value.accepted).toEqual([action('action-1')])
    expect(redone.ok && redone.value.redoStack).toEqual([])
    expect(undone.value.accepted).toEqual([])
  })

  it('fails empty undo and redo without changing history', () => {
    const empty = createHistory()

    expect(undo(empty)).toEqual({ ok: false, error: { code: 'NOTHING_TO_UNDO' } })
    expect(redo(empty)).toEqual({ ok: false, error: { code: 'NOTHING_TO_REDO' } })
    expect(empty).toEqual({ accepted: [], redoStack: [], issuedActionIds: [] })
  })

  it('clears redo only when a new unique action is accepted', () => {
    const first = accept(createHistory(), action('action-1'))
    if (!first.ok) throw new Error('test setup failed')
    const undone = undo(first.value)
    if (!undone.ok) throw new Error('test setup failed')

    const replaced = accept(undone.value, action('action-2'))

    expect(replaced.ok && replaced.value.redoStack).toEqual([])
    expect(replaced.ok && replaced.value.accepted).toEqual([action('action-2')])
  })

  it('fails closed when forged history contains invalid actions or duplicate identities', () => {
    const invalidAction = { ...action('bad'), durationMs: 0 }
    expect(validateHistory({ accepted: [invalidAction], redoStack: [], issuedActionIds: ['bad'] }).ok).toBe(false)
    expect(
      validateHistory({
        accepted: [action('same')],
        redoStack: [action('same')],
        issuedActionIds: ['same'],
      }).ok,
    ).toBe(false)
    expect(
      validateHistory({ accepted: [], redoStack: [], issuedActionIds: ['same', 'same'] }).ok,
    ).toBe(false)
    expect(
      validateHistory({ accepted: [action('missing')], redoStack: [], issuedActionIds: [] }).ok,
    ).toBe(false)
  })
})
