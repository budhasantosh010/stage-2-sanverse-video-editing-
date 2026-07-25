import { describe, expect, it } from 'vitest'

import type { AppState } from './app-state'
import {
  acceptEditProposal,
  createInitialState,
  discardEditProposal,
  openLocalProject,
  queueEditProposal,
  redoEdit,
  returnHome,
  undoEdit,
  updateDraftRequest,
} from './app-state'

const proposal = {
  schemaVersion: 'sanverse.action/v1' as const,
  actionId: 'action-state-1',
  kind: 'add-nameplate' as const,
  target: { x: 0.25, y: 0.75, sourceTimeMs: 12_400 },
  primaryText: 'Santosh',
  secondaryText: 'Founder',
  startMs: 12_400,
  durationMs: 5_000,
}

function createStudioState() {
  return openLocalProject(createInitialState(), {
    id: 'project_1234567890abcdef',
    name: 'cleaned.mp4',
    mediaUrl: 'blob:test',
  })
}

describe('app state', () => {
  it('starts at Home with an empty draft request', () => {
    expect(createInitialState()).toEqual({
      screen: 'home',
      draftRequest: '',
    })
  })

  it('updates the Home draft without changing screens', () => {
    expect(updateDraftRequest(createInitialState(), 'Add my name here')).toEqual({
      screen: 'home',
      draftRequest: 'Add my name here',
    })
  })

  it('opens a local project with the current Home draft', () => {
    const home = updateDraftRequest(createInitialState(), 'Add my name here')

    expect(
      openLocalProject(home, {
        id: 'project_1234567890abcdef',
        name: 'cleaned.mp4',
        mediaUrl: 'blob:test',
      }),
    ).toEqual({
      screen: 'studio',
      project: {
        id: 'project_1234567890abcdef',
        name: 'cleaned.mp4',
        mediaUrl: 'blob:test',
        draftRequest: 'Add my name here',
      },
      proposal: null,
      editError: null,
      history: {
        accepted: [],
        redoStack: [],
        issuedActionIds: [],
      },
    })
  })

  it('uses an explicitly supplied draft when opening a local project', () => {
    expect(
      openLocalProject(createInitialState(), {
        id: 'project_1234567890abcdef',
        name: 'cleaned.mp4',
        mediaUrl: 'blob:test',
        draftRequest: 'Remove the long pause',
      }),
    ).toEqual({
      screen: 'studio',
      project: {
        id: 'project_1234567890abcdef',
        name: 'cleaned.mp4',
        mediaUrl: 'blob:test',
        draftRequest: 'Remove the long pause',
      },
      proposal: null,
      editError: null,
      history: {
        accepted: [],
        redoStack: [],
        issuedActionIds: [],
      },
    })
  })

  it('reopens a local project with its validated canonical history', () => {
    const history = {
      accepted: [proposal],
      redoStack: [],
      issuedActionIds: [proposal.actionId],
    }
    const reopened = openLocalProject(createInitialState(), {
      id: 'project_1234567890abcdef',
      name: 'cleaned.mp4',
      mediaUrl: '/api/projects/project_1234567890abcdef/media',
      history,
    })

    expect(reopened.history).toEqual(history)
    expect(reopened.history).not.toBe(history)
  })

  it('updates only the Studio project draft', () => {
    const studio = openLocalProject(createInitialState(), {
      id: 'project_1234567890abcdef',
      name: 'cleaned.mp4',
      mediaUrl: 'blob:test',
    })

    expect(updateDraftRequest(studio, 'Add captions')).toEqual({
      screen: 'studio',
      project: {
        id: 'project_1234567890abcdef',
        name: 'cleaned.mp4',
        mediaUrl: 'blob:test',
        draftRequest: 'Add captions',
      },
      proposal: null,
      editError: null,
      history: {
        accepted: [],
        redoStack: [],
        issuedActionIds: [],
      },
    })
  })

  it('returns from Studio to a clean Home state', () => {
    const studio = openLocalProject(createInitialState(), {
      id: 'project_1234567890abcdef',
      name: 'cleaned.mp4',
      mediaUrl: 'blob:test',
      draftRequest: 'Add my name here',
    })

    expect(returnHome(studio)).toEqual({
      screen: 'home',
      draftRequest: '',
    })
  })

  it('queues a validated proposal without changing canonical history', () => {
    const state = createStudioState()
    const next = queueEditProposal(state, proposal)

    expect(next.proposal).toEqual(proposal)
    expect(next.proposal).not.toBe(proposal)
    expect(next.history).toBe(state.history)
    expect(next.history.accepted).toHaveLength(0)
    expect(next.editError).toBeNull()
  })

  it('fails visibly when a proposal is invalid', () => {
    const state = createStudioState()
    const next = queueEditProposal(state, { ...proposal, primaryText: '   ' })

    expect(next.proposal).toBeNull()
    expect(next.history).toBe(state.history)
    expect(next.editError).toMatch(/could not preview/i)
  })

  it('accepts one proposal atomically and clears the pending proposal', () => {
    const queued = queueEditProposal(createStudioState(), proposal)
    const accepted = acceptEditProposal(queued)

    expect(accepted.proposal).toBeNull()
    expect(accepted.history.accepted).toEqual([proposal])
    expect(accepted.history.issuedActionIds).toEqual(['action-state-1'])
    expect(accepted.editError).toBeNull()
  })

  it('does not accept a rapid second time', () => {
    const acceptedOnce = acceptEditProposal(
      queueEditProposal(createStudioState(), proposal),
    )
    const acceptedTwice = acceptEditProposal(acceptedOnce)

    expect(acceptedTwice.history.accepted).toHaveLength(1)
    expect(acceptedTwice.history.accepted[0]?.actionId).toBe('action-state-1')
  })

  it('rejects a proposal whose action ID has already been issued', () => {
    const accepted = acceptEditProposal(queueEditProposal(createStudioState(), proposal))
    const next = queueEditProposal(accepted, proposal)

    expect(next.proposal).toBeNull()
    expect(next.history.accepted).toHaveLength(1)
    expect(next.editError).toMatch(/already been used/i)
  })

  it('discards only the pending proposal', () => {
    const accepted = acceptEditProposal(queueEditProposal(createStudioState(), proposal))
    const secondProposal = { ...proposal, actionId: 'action-state-2' }
    const queued = queueEditProposal(accepted, secondProposal)
    const discarded = discardEditProposal(queued)

    expect(discarded.proposal).toBeNull()
    expect(discarded.history).toBe(accepted.history)
    expect(discarded.history.accepted).toHaveLength(1)
  })

  it('undoes and redoes accepted history', () => {
    const accepted = acceptEditProposal(queueEditProposal(createStudioState(), proposal))
    const undone = undoEdit(accepted)
    const redone = redoEdit(undone)

    expect(undone.history.accepted).toHaveLength(0)
    expect(undone.history.redoStack).toEqual([proposal])
    expect(redone.history.accepted).toEqual([proposal])
    expect(redone.history.redoStack).toHaveLength(0)
  })

  it('blocks undo and redo while a proposal is pending', () => {
    const accepted = acceptEditProposal(queueEditProposal(createStudioState(), proposal))
    const queued = queueEditProposal(accepted, { ...proposal, actionId: 'action-state-2' })

    const undoBlocked = undoEdit(queued)
    const redoBlocked = redoEdit(queued)

    expect(undoBlocked.history).toBe(queued.history)
    expect(redoBlocked.history).toBe(queued.history)
    expect(undoBlocked.editError).toMatch(/discard or accept/i)
    expect(redoBlocked.editError).toMatch(/discard or accept/i)
  })
})

if (false) {
  const updateUnionDraft = (state: AppState): AppState =>
    updateDraftRequest(state, 'Keep the draft editable')

  void updateUnionDraft

  const studio = openLocalProject(createInitialState(), {
    id: 'project_1234567890abcdef',
    name: 'cleaned.mp4',
    mediaUrl: 'blob:test',
  })

  // @ts-expect-error Opening a project is exclusively a Home-to-Studio transition.
  openLocalProject(studio, {
    id: 'project_aaaaaaaaaaaaaaaa',
    name: 'replacement.mp4',
    mediaUrl: 'blob:replacement',
  })
}
