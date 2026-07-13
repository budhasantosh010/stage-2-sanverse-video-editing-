import { describe, expect, it } from 'vitest'

import {
  proposeAddNameplate,
  validateAddNameplateAction,
  type AddNameplateAction,
} from './actions'

const validAction = (): AddNameplateAction => ({
  schemaVersion: 'sanverse.action/v1',
  actionId: 'action-1',
  kind: 'add-nameplate',
  target: { x: 0.25, y: 0.75, sourceTimeMs: 12_400 },
  primaryText: 'Santosh',
  secondaryText: '',
  startMs: 12_400,
  durationMs: 5_000,
})

describe('validateAddNameplateAction', () => {
  it.each([
    ['x below zero', { target: { x: -0.001, y: 0.5, sourceTimeMs: 0 } }],
    ['x above one', { target: { x: 1.001, y: 0.5, sourceTimeMs: 0 } }],
    ['y below zero', { target: { x: 0.5, y: -0.001, sourceTimeMs: 0 } }],
    ['y above one', { target: { x: 0.5, y: 1.001, sourceTimeMs: 0 } }],
    ['non-finite x', { target: { x: Number.NaN, y: 0.5, sourceTimeMs: 0 } }],
    ['non-finite y', { target: { x: 0.5, y: Number.POSITIVE_INFINITY, sourceTimeMs: 0 } }],
    ['negative source time', { target: { x: 0.5, y: 0.5, sourceTimeMs: -1 } }],
    ['non-finite source time', { target: { x: 0.5, y: 0.5, sourceTimeMs: Number.NaN } }],
    ['negative start', { startMs: -1 }],
    ['non-finite start', { startMs: Number.POSITIVE_INFINITY }],
    ['zero duration', { durationMs: 0 }],
    ['negative duration', { durationMs: -1 }],
    ['non-finite duration', { durationMs: Number.NaN }],
    ['blank primary text', { primaryText: '   ' }],
    ['blank action id', { actionId: '  ' }],
    ['wrong schema', { schemaVersion: 'sanverse.action/v2' }],
    ['wrong kind', { kind: 'trim' }],
  ])('rejects %s', (_label, override) => {
    const candidate = { ...validAction(), ...override }

    expect(validateAddNameplateAction(candidate).ok).toBe(false)
  })

  it.each([0, 1])('accepts normalized coordinate boundary %d', (boundary) => {
    const action = validAction()
    action.target = { x: boundary, y: boundary, sourceTimeMs: 0 }

    expect(validateAddNameplateAction(action)).toEqual({ ok: true, value: action })
  })

  it('requires the exact contract fields and types', () => {
    const { secondaryText: _omitted, ...candidate } = validAction()

    expect(validateAddNameplateAction(candidate).ok).toBe(false)
    expect(validateAddNameplateAction({ ...validAction(), extra: true }).ok).toBe(false)
  })
})

describe('proposeAddNameplate', () => {
  it('returns a detached validated proposal without mutating its input', () => {
    const input = validAction()
    const result = proposeAddNameplate(input)

    expect(result).toEqual({ ok: true, value: input })
    expect(result.ok && result.value).not.toBe(input)
    expect(input).toEqual(validAction())
  })

  it('fails closed with typed issues for invalid input', () => {
    const result = proposeAddNameplate({ ...validAction(), durationMs: 0 })

    expect(result.ok).toBe(false)
    expect(!result.ok && result.error.code).toBe('ACTION_INVALID')
  })
})
