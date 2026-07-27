import { describe, expect, it } from 'vitest'

import {
  applyServerProject,
  buildChangeSet,
  canRedoProject,
  canUndoProject,
  createInitialState,
  discardEditProposal,
  openLocalProject,
  queueEditProposal,
  repairProposal,
  DIRECT_ORIGIN,
  reportEditError,
  returnHome,
  updateDraftRequest,
  type StudioState,
} from './app-state'
import {
  TEST_PROJECT_ID,
  ms,
  testOperation,
  testProject,
  testProjectWithNameplate,
} from '../test-fixtures'

const studio = (editProject = testProject()): StudioState =>
  openLocalProject(createInitialState(), {
    id: TEST_PROJECT_ID,
    name: 'cleaned.mp4',
    mediaUrl: `/api/projects/${TEST_PROJECT_ID}/media`,
    editProject,
  })

describe('home state', () => {
  it('starts on Home with an empty draft', () => {
    expect(createInitialState()).toEqual({ screen: 'home', draftRequest: '' })
  })

  it('carries the Home draft into the Studio', () => {
    const home = updateDraftRequest(createInitialState(), 'add my name')
    const state = openLocalProject(home, {
      id: TEST_PROJECT_ID,
      name: 'cleaned.mp4',
      mediaUrl: '/media',
      editProject: testProject(),
    })
    expect(state.project.draftRequest).toBe('add my name')
    expect(state.proposal).toBeNull()
    expect(state.editProject.revision).toBe(0)
  })

  it('updates the Studio draft without touching the project', () => {
    const state = studio()
    const next = updateDraftRequest(state, 'later')
    expect(next.project.draftRequest).toBe('later')
    expect(next.editProject).toBe(state.editProject)
  })

  it('returns to a clean Home', () => {
    expect(returnHome(studio())).toEqual({ screen: 'home', draftRequest: '' })
  })
})

describe('queueing a proposal', () => {
  it('accepts a well-formed proposal for preview', () => {
    const next = queueEditProposal(studio(), testOperation())
    expect(next.proposal?.operation.primaryText).toBe('Santosh')
    expect(next.editError).toBeNull()
  })

  it('refuses a malformed proposal without changing saved state', () => {
    const state = studio()
    const next = queueEditProposal(state, { kind: 'add-nameplate' })
    expect(next.proposal).toBeNull()
    expect(next.editError).toMatch(/invalid/i)
    expect(next.editProject).toBe(state.editProject)
  })

  it('refuses a nameplate that runs past the end of this video, before it is previewed', () => {
    // The v1 defect: this was previewed, accepted, and saved, then failed only
    // at export, long after the user believed the edit was done.
    const next = queueEditProposal(studio(), testOperation({
      compositionInterval: { start: ms(29_000), duration: ms(5_000) },
    }))
    expect(next.proposal).toBeNull()
    expect(next.editError).toMatch(/past the end/i)
  })

  it('refuses a proposal whose ID is already used', () => {
    const state = studio(testProjectWithNameplate())
    const next = queueEditProposal(state, testOperation({ operationId: 'operation_aaaaaaaa' }))
    expect(next.proposal).toBeNull()
    expect(next.editError).toMatch(/already been used/i)
  })

  it('discards a pending proposal without touching saved state', () => {
    const queued = queueEditProposal(studio(), testOperation())
    const discarded = discardEditProposal(queued)
    expect(discarded.proposal).toBeNull()
    expect(discarded.editError).toBeNull()
    expect(discarded.editProject).toBe(queued.editProject)
  })
})

describe('adopting what the server reports', () => {
  it('replaces the project and clears the pending proposal', () => {
    const queued = queueEditProposal(studio(), testOperation())
    const served = testProjectWithNameplate()

    const next = applyServerProject(queued, served)
    expect(next.editProject).toBe(served)
    expect(next.proposal).toBeNull()
    expect(next.editError).toBeNull()
  })

  it('surfaces an edit failure without discarding the project', () => {
    const state = studio()
    const next = reportEditError(state, 'This project changed while that edit was being prepared.')
    expect(next.editError).toMatch(/changed while/i)
    expect(next.editProject).toBe(state.editProject)
  })
})

describe('undo and redo availability', () => {
  it('is unavailable on a fresh project and while a proposal is pending', () => {
    expect(canUndoProject(studio())).toBe(false)
    expect(canRedoProject(studio())).toBe(false)

    const withEdit = studio(testProjectWithNameplate())
    expect(canUndoProject(withEdit)).toBe(true)

    const pending = queueEditProposal(withEdit, testOperation({ operationId: 'operation_bbbbbbbb' }))
    expect(canUndoProject(pending)).toBe(false)
  })
})

describe('building a change set', () => {
  it('carries the revision the user was looking at', () => {
    const state = studio(testProjectWithNameplate())
    const changeSet = buildChangeSet({ operation: testOperation({ operationId: 'operation_bbbbbbbb' }), origin: DIRECT_ORIGIN }, state.editProject.revision)

    expect(changeSet.baseRevision).toBe(state.editProject.revision)
    expect(changeSet.provenance).toEqual({ source: 'direct', requestId: null })
    expect(changeSet.changeSetId).toMatch(/^changeset_[a-z0-9]{8,64}$/)
  })

  it('gives one approved request exactly one change set, so one Undo reverses it', () => {
    expect(buildChangeSet({ operation: testOperation(), origin: DIRECT_ORIGIN }, 0).operations).toHaveLength(1)
  })
})

describe('assistant proposals', () => {
  const aiOrigin = {
    source: 'ai' as const,
    requestId: 'request_aaaaaaaa',
    explanation: 'Shows “Santosh”.',
    note: null,
  }

  it('records that the assistant proposed the edit', () => {
    const state = queueEditProposal(studio(), testOperation(), aiOrigin)
    expect(state.proposal?.origin).toEqual(aiOrigin)
    expect(state.proposal?.operation.primaryText).toBe('Santosh')
  })

  it('checks an assistant proposal exactly as it checks a hand-made one', () => {
    const state = queueEditProposal(
      studio(),
      testOperation({ compositionInterval: { start: ms(29_000), duration: ms(5_000) } }),
      aiOrigin,
    )
    expect(state.proposal).toBeNull()
    expect(state.editError).toMatch(/past the end/i)
  })

  it('carries provenance into the change set, so history shows who proposed it', () => {
    const state = queueEditProposal(studio(), testOperation(), aiOrigin)
    if (!state.proposal) throw new Error('expected a proposal')
    const changeSet = buildChangeSet(state.proposal, state.editProject.revision)
    expect(changeSet.provenance).toEqual({ source: 'ai', requestId: 'request_aaaaaaaa' })
  })

  it('clears the pending proposal, and its origin cannot outlive it', () => {
    const state = discardEditProposal(queueEditProposal(studio(), testOperation(), aiOrigin))
    expect(state.proposal).toBeNull()
  })
})

describe('repairing a proposal by hand', () => {
  const pending = () => queueEditProposal(studio(), testOperation())

  it('changes the wording and keeps the same edit identity', () => {
    const repaired = repairProposal(pending(), { primaryText: 'Santosh Budha' })
    expect(repaired.proposal?.operation.primaryText).toBe('Santosh Budha')
    expect(repaired.proposal?.operation.operationId).toBe('operation_aaaaaaaa')
    expect(repaired.editError).toBeNull()
  })

  it('moves the nameplate to a new point without touching anything else', () => {
    const repaired = repairProposal(pending(), { point: { x: 0.1, y: 0.9 } })
    expect(repaired.proposal?.operation.target.point).toEqual({ x: 0.1, y: 0.9 })
    expect(repaired.proposal?.operation.primaryText).toBe('Santosh')
  })

  it('shortens a new length so it still ends with the video', () => {
    const repaired = repairProposal(pending(), { startMs: 28_000, durationMs: 10_000 })
    const interval = repaired.proposal?.operation.compositionInterval
    expect(interval?.start.ticks).toBe(ms(28_000).ticks)
    expect((interval?.start.ticks ?? 0) + (interval?.duration.ticks ?? 0)).toBe(ms(30_000).ticks)
  })

  it('refuses a moment outside the video and leaves the proposal untouched', () => {
    const before = pending()
    const repaired = repairProposal(before, { startMs: 90_000 })
    expect(repaired.proposal).toEqual(before.proposal)
    expect(repaired.editError).toMatch(/outside this video/i)
  })

  it('refuses empty main text rather than saving a blank nameplate', () => {
    const repaired = repairProposal(pending(), { primaryText: '   ' })
    expect(repaired.editError).toMatch(/could not be applied/i)
    expect(repaired.proposal?.operation.primaryText).toBe('Santosh')
  })
})
