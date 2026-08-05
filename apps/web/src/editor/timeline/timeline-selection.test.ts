import { describe, expect, it } from 'vitest'

import { buildTimelineViewModel } from '../../features/timeline'
import { testProject } from '../../test-fixtures'
import {
  clearTimelineSelection,
  reconcileTimelineSelection,
  selectTimelineItem,
} from './timeline-selection'

const build = (selectedItemId: string | null = null) => buildTimelineViewModel({
  project: testProject(),
  pending: null,
  selectedItemIds: selectedItemId === null ? [] : [selectedItemId],
})

describe('timeline selection', () => {
  it('selects a known item and rejects an unknown ID safely', () => {
    const model = build()
    const itemId = model.lanes.flatMap((lane) => lane.items)[0].id
    expect(selectTimelineItem(model, itemId)).toBe(itemId)
    expect(selectTimelineItem(model, 'missing')).toBeNull()
  })

  it('clears selection explicitly', () => {
    expect(clearTimelineSelection()).toBeNull()
  })

  it('clears selection when an item disappears after a project update', () => {
    expect(reconcileTimelineSelection(build(), 'clip_missing')).toBeNull()
  })

  it('keeps a known selection through scroll and zoom because viewport is not project state', () => {
    const model = build()
    const itemId = model.lanes.flatMap((lane) => lane.items)[0].id
    expect(reconcileTimelineSelection(model, itemId)).toBe(itemId)
  })

  it('clears a rejected proposal selection when the proposal item is absent', () => {
    expect(reconcileTimelineSelection(build(), 'proposal_pending')).toBeNull()
  })
})
