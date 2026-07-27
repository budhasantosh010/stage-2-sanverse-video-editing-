import { describe, expect, it } from 'vitest'

import { NAMEPLATE_COMPONENT_ID } from '@sanverse/edit-domain/capabilities'

import { validateIntentCandidate } from './intent-candidate.ts'

const proposal = (overrides: { arguments?: Record<string, unknown> } & Record<string, unknown> = {}) => {
  const { arguments: argumentOverrides, ...rest } = overrides
  return {
    schemaVersion: 'sanverse.intent-candidate/v1',
    kind: 'proposal-candidate',
    capabilityId: NAMEPLATE_COMPONENT_ID,
    capabilityVersion: 1,
    arguments: {
      primaryText: 'Santosh',
      secondaryText: 'Founder',
      startMs: 6_000,
      durationMs: 5_000,
      point: { x: 0.4, y: 0.7 },
      anchor: 'center',
      ...argumentOverrides,
    },
    ...rest,
  }
}

describe('validateIntentCandidate', () => {
  it('accepts a fully specified proposal candidate', () => {
    const result = validateIntentCandidate(proposal())
    expect(result.ok).toBe(true)
  })

  it('accepts nulls, because "I do not know" is a valid answer', () => {
    const result = validateIntentCandidate(
      proposal({ arguments: { startMs: null, durationMs: null, point: null, anchor: null, secondaryText: null } }),
    )
    expect(result.ok).toBe(true)
    if (result.ok && result.value.kind === 'proposal-candidate') {
      expect(result.value.arguments.startMs).toBeNull()
      expect(result.value.arguments.primaryText).toBe('Santosh')
    }
  })

  it('refuses an unknown candidate kind rather than ignoring it', () => {
    const result = validateIntentCandidate({ ...proposal(), kind: 'execute-shell' })
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.issues[0].code).toBe('CANDIDATE_KIND_UNKNOWN')
  })

  it('refuses an extra argument key, so nothing can be smuggled alongside', () => {
    const result = validateIntentCandidate(
      proposal({ arguments: { shellCommand: 'rm -rf /' } }),
    )
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error.issues.some((issue) => issue.path === '$.arguments.shellCommand')).toBe(true)
    }
  })

  it('refuses an extra top-level key', () => {
    const result = validateIntentCandidate({ ...proposal(), operation: { kind: 'add-nameplate' } })
    expect(result.ok).toBe(false)
  })

  it('refuses control characters in text', () => {
    const result = validateIntentCandidate(
      proposal({ arguments: { primaryText: `Santosh${String.fromCharCode(10)}:drawtext` } }),
    )
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.issues[0].code).toBe('TEXT_HAS_CONTROL_CHARACTERS')
  })

  it('refuses a duration below the readable minimum', () => {
    const result = validateIntentCandidate(proposal({ arguments: { durationMs: 10 } }))
    expect(result.ok).toBe(false)
  })

  it('refuses a duration above the sane maximum', () => {
    const result = validateIntentCandidate(proposal({ arguments: { durationMs: 999_999_999 } }))
    expect(result.ok).toBe(false)
  })

  it('accepts a clarification with a known field', () => {
    const result = validateIntentCandidate({
      schemaVersion: 'sanverse.intent-candidate/v1',
      kind: 'clarification-required',
      question: { field: 'primary-text', question: 'What should the text say?' },
    })
    expect(result.ok).toBe(true)
  })

  it('refuses a clarification about something that does not change the edit', () => {
    const result = validateIntentCandidate({
      schemaVersion: 'sanverse.intent-candidate/v1',
      kind: 'clarification-required',
      question: { field: 'what-is-your-channel-about', question: 'Tell me about your channel' },
    })
    expect(result.ok).toBe(false)
  })

  it('accepts the two failure kinds', () => {
    for (const [kind, reason] of [
      ['unsupported', 'out-of-scope'],
      ['provider-failure', 'timeout'],
    ] as const) {
      const result = validateIntentCandidate({
        schemaVersion: 'sanverse.intent-candidate/v1',
        kind,
        reason,
      })
      expect(result.ok).toBe(true)
    }
  })

  it('refuses a candidate with no schema version', () => {
    const { schemaVersion: _dropped, ...withoutVersion } = proposal()
    expect(validateIntentCandidate(withoutVersion).ok).toBe(false)
  })

  it('refuses a plain string, which is what a chatty provider returns', () => {
    expect(validateIntentCandidate('Sure! I have added the nameplate for you.').ok).toBe(false)
  })
})
