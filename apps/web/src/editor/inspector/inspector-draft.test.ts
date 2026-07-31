import { describe, expect, it } from 'vitest'

import {
  createInspectorDraft,
  reconcileInspectorDraft,
  requestInspectorSelectionChange,
  resetInspectorDraft,
  updateInspectorDraft,
} from './inspector-draft'

type AudioDraft = Readonly<{ gainDb: number; fadeInSeconds: number; fadeOutSeconds: number }>

const accepted: AudioDraft = Object.freeze({ gainDb: 0, fadeInSeconds: 0, fadeOutSeconds: 0 })

describe('Inspector draft state', () => {
  it('keeps typing local without mutating accepted values', () => {
    const draft = createInspectorDraft('clip:one:audio', 2, accepted)
    const changed = updateInspectorDraft(draft, { ...draft.value, gainDb: -12 })

    expect(changed).toMatchObject({ dirty: true, value: { gainDb: -12 } })
    expect(changed.authoritative).toBe(accepted)
    expect(accepted.gainDb).toBe(0)
  })

  it('Reset restores authoritative values without a revision', () => {
    const changed = updateInspectorDraft(
      createInspectorDraft('clip:one:audio', 2, accepted),
      { gainDb: -12, fadeInSeconds: 1, fadeOutSeconds: 2 },
    )
    expect(resetInspectorDraft(changed)).toEqual(
      createInspectorDraft('clip:one:audio', 2, accepted),
    )
  })

  it('an accepted revision, Undo, or Redo rebuilds from returned authority', () => {
    const dirty = updateInspectorDraft(
      createInspectorDraft('clip:one:audio', 2, accepted),
      { ...accepted, gainDb: -12 },
    )
    const returned = Object.freeze({ gainDb: -6, fadeInSeconds: 1, fadeOutSeconds: 1 })

    expect(reconcileInspectorDraft(dirty, 'clip:one:audio', 3, returned)).toEqual(
      createInspectorDraft('clip:one:audio', 3, returned),
    )
  })

  it('keeps a local draft across ordinary rerenders of the same revision', () => {
    const dirty = updateInspectorDraft(
      createInspectorDraft('clip:one:audio', 2, accepted),
      { ...accepted, gainDb: -12 },
    )
    expect(reconcileInspectorDraft(dirty, 'clip:one:audio', 2, accepted)).toBe(dirty)
  })

  it('rebuilds when the selected item changes', () => {
    const dirty = updateInspectorDraft(
      createInspectorDraft('clip:one:audio', 2, accepted),
      { ...accepted, gainDb: -12 },
    )
    const next = Object.freeze({ gainDb: -3, fadeInSeconds: 0, fadeOutSeconds: 0 })
    expect(reconcileInspectorDraft(dirty, 'clip:two:audio', 2, next)).toEqual(
      createInspectorDraft('clip:two:audio', 2, next),
    )
  })
})

describe('dirty selection guard', () => {
  it('continues immediately when there are no unapplied changes', () => {
    expect(requestInspectorSelectionChange('clip:one', 'clip:two', false)).toEqual({
      kind: 'continue',
      nextItemId: 'clip:two',
    })
  })

  it('requires confirmation before abandoning an item with a dirty draft', () => {
    expect(requestInspectorSelectionChange('clip:one', 'clip:two', true)).toEqual({
      kind: 'confirm',
      currentItemId: 'clip:one',
      nextItemId: 'clip:two',
    })
  })

  it('does not prompt for selecting the same item', () => {
    expect(requestInspectorSelectionChange('clip:one', 'clip:one', true)).toEqual({
      kind: 'continue',
      nextItemId: 'clip:one',
    })
  })
})
