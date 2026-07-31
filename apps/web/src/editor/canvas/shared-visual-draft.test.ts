import { describe, expect, it } from 'vitest'
import { DEFAULT_VISUAL_PROPERTIES } from '@sanverse/edit-domain'
import type { CanvasSelectionResult } from './canvas-contract'
import {
  createSharedVisualDraft,
  finishSharedVisualInteraction,
  markSharedVisualDraftApplied,
  reconcileSharedVisualDraft,
  resetSharedVisualDraft,
  startSharedVisualInteraction,
  updateSharedVisualDraft,
} from './shared-visual-draft'

const selection = (revision = 1): CanvasSelectionResult => ({
  kind: 'supported',
  selection: {
    timelineItemId: 'item_title', visualId: 'title_abcd1234', nodeId: 'title_abcd1234', label: 'Title',
    kind: 'title', state: 'committed', projectRevision: revision, startTicks: 0, durationTicks: 10,
    visualProperties: DEFAULT_VISUAL_PROPERTIES, supportsCrop: false, supportsRotation: true,
    supportsResize: true, blockedReason: null, proposalPoint: null,
  },
})

describe('one shared visual draft', () => {
  it('starts from the authoritative selected visual and is not persisted', () => {
    expect(createSharedVisualDraft(selection())).toMatchObject({
      selectionKey: 'item_title:title_abcd1234', projectRevision: 1, dirty: false, interaction: null,
    })
  })

  it('holds Inspector changes and blocks a competing canvas gesture', () => {
    const current = createSharedVisualDraft(selection())!
    const value = { ...DEFAULT_VISUAL_PROPERTIES, transform: { ...DEFAULT_VISUAL_PROPERTIES.transform, translateX: 0.1 } }
    const dirty = updateSharedVisualDraft(current, value)!
    expect(dirty.dirty).toBe(true)
    expect(startSharedVisualInteraction(dirty, 'move')).toMatchObject({
      interaction: null,
      notice: 'Apply or reset the current Inspector changes before dragging this item.',
    })
  })

  it('lets a clean canvas gesture update the same value and cancel back to accepted state', () => {
    const current = startSharedVisualInteraction(createSharedVisualDraft(selection())!, 'move')!
    const value = { ...DEFAULT_VISUAL_PROPERTIES, transform: { ...DEFAULT_VISUAL_PROPERTIES.transform, translateX: 0.2 } }
    const moved = updateSharedVisualDraft(current, value)!
    expect(moved.interaction).toBe('move')
    expect(moved.dirty).toBe(true)
    expect(resetSharedVisualDraft(moved)).toMatchObject({
      value: DEFAULT_VISUAL_PROPERTIES, dirty: false, interaction: null,
    })
  })

  it('marks one accepted gesture clean and rebuilds from a newer project revision', () => {
    const current = startSharedVisualInteraction(createSharedVisualDraft(selection())!, 'move')!
    const value = { ...DEFAULT_VISUAL_PROPERTIES, transform: { ...DEFAULT_VISUAL_PROPERTIES.transform, translateX: 0.2 } }
    const moved = updateSharedVisualDraft(current, value)!
    expect(markSharedVisualDraftApplied(finishSharedVisualInteraction(moved))).toMatchObject({
      authoritative: value, value, dirty: false, interaction: null,
    })
    expect(reconcileSharedVisualDraft(moved, selection(2))).toMatchObject({ projectRevision: 2, dirty: false })
  })
})
