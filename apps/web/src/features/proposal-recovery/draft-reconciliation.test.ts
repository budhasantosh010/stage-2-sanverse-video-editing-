import { describe, expect, it } from 'vitest'

import { DIRECT_ORIGIN, type PendingProposal } from '../../app/app-state'
import {
  DRAFT_CANCELLATION_REASONS,
  draftCancellationMessage,
  draftRebasedMessage,
  draftRetryIsWorthwhile,
  reconcileDetachedDraft,
} from './draft-reconciliation.ts'
import {
  TEST_ASSET_ID,
  TEST_PROJECT_ID,
  ms,
  testOperation,
  testProject,
  testProjectWithNameplate,
} from '../../test-fixtures'

const draft = (overrides = {}): PendingProposal => Object.freeze({
  operation: testOperation(overrides),
  origin: DIRECT_ORIGIN,
})

describe('a proposal still on screen when the project moves', () => {
  it('is carried forward untouched by an ordinary edit', () => {
    // This is the case that used to demand the user leave the editor entirely.
    // Making an edit while a proposal is on screen is not a mistake; it is how
    // people work.
    const base = testProject()
    const moved = testProjectWithNameplate('changeset_bbbbbbbb', {
      operationId: 'operation_bbbbbbbb',
    })
    const result = reconcileDetachedDraft({
      draft: draft(),
      baseRevision: base.revision,
      baseProjectId: TEST_PROJECT_ID,
      nextProject: moved,
    })
    expect(result.status).toBe('rebased')
    if (result.status !== 'rebased') return
    expect(result.fromRevision).toBe(base.revision)
    expect(result.toRevision).toBe(moved.revision)
  })

  it('carries it forward with every word and position exactly as they were', () => {
    // Carrying forward is a re-check, not a rewrite. Anything the user typed or
    // positioned must come out the other side identical, or "it still applies"
    // would be a lie.
    const original = draft({ primaryText: 'Santosh', secondaryText: 'Founder' })
    const moved = testProjectWithNameplate('changeset_bbbbbbbb', { operationId: 'operation_bbbbbbbb' })
    const result = reconcileDetachedDraft({
      draft: original,
      baseRevision: 0,
      baseProjectId: TEST_PROJECT_ID,
      nextProject: moved,
    })
    if (result.status !== 'rebased') throw new Error('expected the proposal to survive')
    expect(result.draft).toBe(original)
    expect(result.draft.operation.primaryText).toBe('Santosh')
    expect(result.draft.operation.target.point).toEqual({ x: 0.25, y: 0.75 })
  })

  it('says plainly that nothing moved when nothing moved', () => {
    const base = testProject()
    const result = reconcileDetachedDraft({
      draft: draft(),
      baseRevision: base.revision,
      baseProjectId: TEST_PROJECT_ID,
      nextProject: base,
    })
    expect(result.status).toBe('current')
  })

  it('never tells the user to reopen the project', () => {
    // The whole point. "Reopen it and try again" meant leaving the editor,
    // going back to the list, opening the project and finding your place again
    // — for something completely routine.
    for (const reason of DRAFT_CANCELLATION_REASONS) {
      const message = draftCancellationMessage(reason)
      expect(message.toLowerCase()).not.toContain('reopen')
      expect(message.toLowerCase()).not.toContain('open it again')
    }
    expect(draftRebasedMessage(11, 12).toLowerCase()).not.toContain('reopen')
  })

  it('promises in every cancellation that the rest of the work is untouched', () => {
    // A user who has just been told something was cancelled needs to know the
    // blast radius immediately, not have to go and check.
    for (const reason of DRAFT_CANCELLATION_REASONS) {
      const message = draftCancellationMessage(reason)
      if (reason === 'EDIT_ID_ALREADY_USED' || reason === 'PROJECT_REPLACED') continue
      expect(message).toContain('Nothing else changed')
    }
  })
})

describe('a proposal whose subject has genuinely gone', () => {
  it('is cancelled, not quietly pointed at something else, when its clip is removed', () => {
    // The rule that must not be broken. Approving something and getting it
    // applied somewhere else is far worse than being told it could not be
    // applied — the user has no reason to go looking for the difference.
    const other = testProject(undefined, 'project_ffffffffffffffff')
    const result = reconcileDetachedDraft({
      draft: draft({ assetId: 'asset_zzzzzzzz' }),
      baseRevision: 0,
      baseProjectId: TEST_PROJECT_ID,
      nextProject: { ...testProject(), revision: 1 },
    })
    expect(result.status).toBe('cancelled')
    if (result.status === 'cancelled') {
      expect(result.reason).toBe('TARGET_SOURCE_REMOVED')
      expect(result.retryAvailable).toBe(true)
    }
    expect(other.projectId).not.toBe(TEST_PROJECT_ID)
  })

  it('is cancelled when the stretch of footage it is about was cut out', () => {
    // The proposal names a piece of the ORIGINAL RECORDING, not a clip. It
    // survives trims and moves. It dies only when that exact stretch no longer
    // appears anywhere in the finished video.
    const base = testProject()
    const result = reconcileDetachedDraft({
      // 40s-45s of a 30-second recording appears nowhere
      draft: draft({ sourceInterval: { start: ms(40_000), duration: ms(5_000) } }),
      baseRevision: 0,
      baseProjectId: TEST_PROJECT_ID,
      nextProject: { ...base, revision: 1 },
    })
    expect(result.status).toBe('cancelled')
    if (result.status === 'cancelled') expect(result.reason).toBe('TARGET_INTERVAL_REMOVED')
  })

  it('refuses to apply the same edit twice', () => {
    // The user pressed Accept twice, or a slow reply arrived after the edit had
    // already landed. Applying it again would duplicate their edit unasked.
    const applied = testProjectWithNameplate()
    const result = reconcileDetachedDraft({
      draft: draft({ operationId: 'operation_aaaaaaaa' }),
      baseRevision: 0,
      baseProjectId: TEST_PROJECT_ID,
      nextProject: applied,
    })
    expect(result.status).toBe('cancelled')
    if (result.status === 'cancelled') {
      expect(result.reason).toBe('EDIT_ID_ALREADY_USED')
      // and asking again would just produce the change they already have
      expect(result.retryAvailable).toBe(false)
    }
  })

  it('cancels rather than crossing into a different project', () => {
    const result = reconcileDetachedDraft({
      draft: draft(),
      baseRevision: 0,
      baseProjectId: TEST_PROJECT_ID,
      nextProject: testProject(undefined, 'project_ffffffffffffffff'),
    })
    expect(result.status).toBe('cancelled')
    if (result.status === 'cancelled') expect(result.reason).toBe('PROJECT_REPLACED')
  })

  it('checks a carried-forward proposal as strictly as a brand-new one', () => {
    const result = reconcileDetachedDraft({
      draft: draft({ primaryText: '' }),
      baseRevision: 0,
      baseProjectId: TEST_PROJECT_ID,
      nextProject: { ...testProject(), revision: 1 },
    })
    expect(result.status).toBe('cancelled')
    if (result.status === 'cancelled') expect(result.reason).toBe('EDIT_NO_LONGER_VALID')
  })

  it('offers to ask again for everything except an edit that already landed', () => {
    for (const reason of DRAFT_CANCELLATION_REASONS) {
      expect(draftRetryIsWorthwhile(reason)).toBe(reason !== 'EDIT_ID_ALREADY_USED')
    }
  })
})

describe('what reconciliation is structurally unable to do', () => {
  it('cannot change the accepted project, because it does not return one', () => {
    // The worst thing this can do to a user's work is say "cancelled". It reads
    // the project and returns a decision; there is no route by which it could
    // write anything back.
    const before = testProject()
    const snapshot = JSON.stringify(before)
    reconcileDetachedDraft({
      draft: draft(),
      baseRevision: 0,
      baseProjectId: TEST_PROJECT_ID,
      nextProject: before,
    })
    expect(JSON.stringify(before)).toBe(snapshot)
  })

  it('gives the same answer however many times it is asked', () => {
    const input = {
      draft: draft(),
      baseRevision: 0,
      baseProjectId: TEST_PROJECT_ID,
      nextProject: testProjectWithNameplate('changeset_bbbbbbbb', { operationId: 'operation_bbbbbbbb' }),
    } as const
    expect(reconcileDetachedDraft(input)).toEqual(reconcileDetachedDraft(input))
  })

  it('never names a file, a path or a code in anything the user reads', () => {
    for (const reason of DRAFT_CANCELLATION_REASONS) {
      const message = draftCancellationMessage(reason)
      expect(message).not.toMatch(/[A-Z]{2,}_[A-Z]/)
      expect(message).not.toMatch(/[/\\]|\.ts\b|asset_|operation_|revision \d/)
      expect(message).not.toContain(TEST_ASSET_ID)
    }
  })
})
