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
    expect(next.proposal?.primaryText).toBe('Santosh')
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
    const changeSet = buildChangeSet(testOperation({ operationId: 'operation_bbbbbbbb' }), state.editProject.revision)

    expect(changeSet.baseRevision).toBe(state.editProject.revision)
    expect(changeSet.provenance).toEqual({ source: 'direct', requestId: null })
    expect(changeSet.changeSetId).toMatch(/^changeset_[a-z0-9]{8,64}$/)
  })

  it('gives one approved request exactly one change set, so one Undo reverses it', () => {
    expect(buildChangeSet(testOperation(), 0).operations).toHaveLength(1)
  })
})
