import { describe, expect, it } from 'vitest'

import {
  createInitialState,
  openLocalProject,
  returnHome,
  updateDraftRequest,
} from './app-state'

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
        name: 'cleaned.mp4',
        mediaUrl: 'blob:test',
      }),
    ).toEqual({
      screen: 'studio',
      project: {
        name: 'cleaned.mp4',
        mediaUrl: 'blob:test',
        draftRequest: 'Add my name here',
      },
    })
  })

  it('uses an explicitly supplied draft when opening a local project', () => {
    expect(
      openLocalProject(createInitialState(), {
        name: 'cleaned.mp4',
        mediaUrl: 'blob:test',
        draftRequest: 'Remove the long pause',
      }),
    ).toEqual({
      screen: 'studio',
      project: {
        name: 'cleaned.mp4',
        mediaUrl: 'blob:test',
        draftRequest: 'Remove the long pause',
      },
    })
  })

  it('updates only the Studio project draft', () => {
    const studio = openLocalProject(createInitialState(), {
      name: 'cleaned.mp4',
      mediaUrl: 'blob:test',
    })

    expect(updateDraftRequest(studio, 'Add captions')).toEqual({
      screen: 'studio',
      project: {
        name: 'cleaned.mp4',
        mediaUrl: 'blob:test',
        draftRequest: 'Add captions',
      },
    })
  })

  it('returns from Studio to a clean Home state', () => {
    const studio = openLocalProject(createInitialState(), {
      name: 'cleaned.mp4',
      mediaUrl: 'blob:test',
      draftRequest: 'Add my name here',
    })

    expect(returnHome(studio)).toEqual({
      screen: 'home',
      draftRequest: '',
    })
  })
})
