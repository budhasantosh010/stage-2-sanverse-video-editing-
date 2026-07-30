import type { TimelineViewModel } from '../../features/timeline'

export type TimelineSelection = string | null

export const timelineItemExists = (model: TimelineViewModel, itemId: string): boolean =>
  model.lanes.some((lane) => lane.items.some((item) => item.id === itemId))

export const reconcileTimelineSelection = (
  model: TimelineViewModel,
  selectedItemId: TimelineSelection,
): TimelineSelection =>
  selectedItemId && timelineItemExists(model, selectedItemId) ? selectedItemId : null

export const selectTimelineItem = (
  model: TimelineViewModel,
  itemId: string,
): TimelineSelection => timelineItemExists(model, itemId) ? itemId : null

export const clearTimelineSelection = (): TimelineSelection => null
