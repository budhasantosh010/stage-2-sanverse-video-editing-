import { resolveGroupMembers, type TimelineGroupV1 } from '@sanverse/edit-domain'

import type { TimelineItemView, TimelineViewModel } from './timeline-contract'

/**
 * What the user currently has picked.
 *
 * ## Why this replaces a single string
 *
 * Selection used to be one item id or nothing. That is enough to click one clip
 * and delete it, and it is not enough for anything a creator actually does:
 * picking four clips and moving them, picking everything after the intro and
 * pushing it along, boxing a section with the mouse.
 *
 * ## The anchor, and why it is stored rather than worked out
 *
 * Shift-click means "from the last thing I picked, to this thing". So the
 * "last thing I picked" has to be remembered. It cannot be worked out from the
 * list of selected items, because the list is a set with no order: after
 * Ctrl-clicking three clips in the order 3, 1, 2 the list is [1, 2, 3] and the
 * anchor is 2. Only remembering it gets that right.
 *
 * ```
 *      click clip 3        selection {3}        anchor 3
 *      ctrl-click clip 1   selection {1,3}      anchor 1
 *      ctrl-click clip 2   selection {1,2,3}    anchor 2
 *      shift-click clip 5  selection {1,2,3,4,5}   ← from 2 to 5
 * ```
 *
 * ## Nothing here is an edit
 *
 * Picking things changes no project, takes no revision and makes no Undo entry.
 * A user who selects four clips and presses Undo must get back the cut they made
 * before, not an un-selection. Every function in this file is arithmetic on a
 * list of names.
 */
export type TimelineSelectionV2 = Readonly<{
  /** Sorted and free of repeats, so two equal selections are always equal. */
  itemIds: readonly string[]
  /** The last thing deliberately picked. Where a Shift range measures from. */
  anchorItemId: string | null
}>

export const EMPTY_SELECTION: TimelineSelectionV2 = Object.freeze({
  itemIds: Object.freeze([]),
  anchorItemId: null,
})

const settle = (itemIds: readonly string[], anchorItemId: string | null): TimelineSelectionV2 =>
  Object.freeze({
    itemIds: Object.freeze([...new Set(itemIds)].sort()),
    anchorItemId,
  })

export const isSelected = (selection: TimelineSelectionV2, itemId: string): boolean =>
  selection.itemIds.includes(itemId)

export const selectionCount = (selection: TimelineSelectionV2): number => selection.itemIds.length

/** Every item in the projection, in the order they are drawn. */
export const allTimelineItems = (model: TimelineViewModel): readonly TimelineItemView[] =>
  Object.freeze(model.lanes.flatMap((lane) => lane.items))

/**
 * The only two rows a link can join.
 *
 * The picture, and the sound that was recorded with it. Everything else on the
 * timeline was put there deliberately and has no partner it did not ask for.
 */
const LINKED_LANES: readonly string[] = Object.freeze(['lane:video', 'lane:dialogue'])

const itemById = (model: TimelineViewModel, itemId: string): TimelineItemView | null =>
  allTimelineItems(model).find((item) => item.id === itemId) ?? null

/**
 * The thing the user pointed at, plus everything that is bound to it.
 *
 * Two separate bindings, and they are deliberately different:
 *
 *   GROUPS   the user said "these move together". Stored in the project.
 *   LINKS    a piece of footage and the sound that was recorded WITH it.
 *            Nobody chose this; it is a fact about the recording.
 *
 * Both are expanded here so that every command below — click, Ctrl-click,
 * Shift-range, marquee, Select All — treats them the same way. If the expansion
 * lived in the click handler, dragging a box round a clip would pick the picture
 * and leave its own sound behind, and the user would silence themselves without
 * ever being told.
 */
export const boundPartners = (
  model: TimelineViewModel,
  itemId: string,
  groups: readonly TimelineGroupV1[],
): readonly string[] => {
  const existing = allTimelineItems(model).map((item) => item.id)
  const fromGroup = resolveGroupMembers(groups, itemId, existing)
  const linked = new Set<string>(fromGroup)

  for (const member of fromGroup) {
    const item = itemById(model, member)
    if (!item) continue
    /*
     * The picture and the sound recorded WITH it.
     *
     * Matched only through `linkedClipId`, which the projection sets on exactly
     * those two rows. An earlier version also matched anything sharing the same
     * `clipId`, and that was wrong: a piece of B-roll is PINNED to a clip and so
     * carries that clip's id, which meant clicking a piece of B-roll silently
     * picked up the whole piece of main footage underneath it — and the next
     * Delete would have taken both.
     *
     * It is also limited to the two rows the link can exist between: the picture
     * and the sound that came with it. Nothing else in the project has a partner
     * nobody chose.
     */
    if (!LINKED_LANES.includes(item.laneId)) continue
    for (const candidate of allTimelineItems(model)) {
      if (candidate.id === member) continue
      if (!LINKED_LANES.includes(candidate.laneId)) continue
      const candidateIsTheLink = item.linkedClipId !== null && candidate.clipId === item.linkedClipId
      const memberIsTheLink = candidate.linkedClipId !== null && candidate.linkedClipId === item.clipId
      if (candidateIsTheLink || memberIsTheLink) linked.add(candidate.id)
    }
  }
  return Object.freeze([...linked])
}

/** A plain click. Everything else is let go of. */
export const selectOnly = (
  model: TimelineViewModel,
  itemId: string,
  groups: readonly TimelineGroupV1[] = [],
): TimelineSelectionV2 => {
  if (!itemById(model, itemId)) return EMPTY_SELECTION
  return settle(boundPartners(model, itemId, groups), itemId)
}

/**
 * Ctrl-click, or Cmd-click on a Mac. Adds if it is not there, removes if it is.
 *
 * Removing moves the anchor to the item that was just clicked even though it is
 * no longer selected, because that is where the user's attention is and it is
 * where a following Shift-click should measure from.
 */
export const toggleSelection = (
  model: TimelineViewModel,
  selection: TimelineSelectionV2,
  itemId: string,
  groups: readonly TimelineGroupV1[] = [],
): TimelineSelectionV2 => {
  if (!itemById(model, itemId)) return selection
  const partners = boundPartners(model, itemId, groups)
  if (isSelected(selection, itemId)) {
    return settle(selection.itemIds.filter((id) => !partners.includes(id)), itemId)
  }
  return settle([...selection.itemIds, ...partners], itemId)
}

/**
 * Shift-click. Everything between the anchor and this item, on the SAME lane.
 *
 * ## Why one lane and not a rectangle across all of them
 *
 * A rectangle sounds more powerful and is the wrong default: shift-clicking a
 * clip four rows down would silently pick up music and captions the user never
 * looked at, and the next Delete would take all of them. Boxing a rectangle is
 * what the marquee is for, and it shows the user exactly what it is about to
 * take before they let go.
 *
 * When the anchor is on a different lane there is no honest range to build, so
 * this behaves as a plain click and becomes the new anchor. Predictable beats
 * clever: the user tries again and it works.
 */
export const extendSelection = (
  model: TimelineViewModel,
  selection: TimelineSelectionV2,
  itemId: string,
  groups: readonly TimelineGroupV1[] = [],
): TimelineSelectionV2 => {
  const target = itemById(model, itemId)
  if (!target) return selection
  const anchor = selection.anchorItemId ? itemById(model, selection.anchorItemId) : null
  if (!anchor || anchor.laneId !== target.laneId) return selectOnly(model, itemId, groups)

  const lane = model.lanes.find((candidate) => candidate.id === target.laneId)
  if (!lane) return selectOnly(model, itemId, groups)

  const low = Math.min(anchor.startTicks, target.startTicks)
  const high = Math.max(
    anchor.startTicks + anchor.durationTicks,
    target.startTicks + target.durationTicks,
  )
  const inRange = lane.items.filter((item) =>
    item.startTicks >= low && item.startTicks + item.durationTicks <= high,
  )
  const withPartners = inRange.flatMap((item) => boundPartners(model, item.id, groups))
  // The anchor is NOT moved by a Shift-click. Shift-clicking further and further
  // away must keep growing the same range rather than ratcheting the start of it
  // along behind you.
  return settle(withPartners, selection.anchorItemId)
}

/** Everything on the timeline. */
export const selectAll = (model: TimelineViewModel): TimelineSelectionV2 => {
  const items = allTimelineItems(model)
  return settle(items.map((item) => item.id), items.length > 0 ? items[0].id : null)
}

/** Everything on one row. */
export const selectLane = (
  model: TimelineViewModel,
  laneId: string,
  groups: readonly TimelineGroupV1[] = [],
): TimelineSelectionV2 => {
  const lane = model.lanes.find((candidate) => candidate.id === laneId)
  if (!lane || lane.items.length === 0) return EMPTY_SELECTION
  const ids = lane.items.flatMap((item) => boundPartners(model, item.id, groups))
  return settle(ids, lane.items[0].id)
}

/**
 * Everything that starts before the playhead, or everything from it onwards.
 *
 * Judged on where each item STARTS, not on whether it touches the playhead. A
 * clip the playhead is sitting in the middle of belongs to "before": it began
 * before now. Using "touches" instead would put the same clip in both answers,
 * and selecting before-then-after would move it twice.
 */
export const selectRelativeToPlayhead = (
  model: TimelineViewModel,
  playheadTicks: number,
  side: 'before' | 'after',
  laneId: string | null = null,
  groups: readonly TimelineGroupV1[] = [],
): TimelineSelectionV2 => {
  const lanes = laneId === null ? model.lanes : model.lanes.filter((lane) => lane.id === laneId)
  const items = lanes.flatMap((lane) => lane.items).filter((item) =>
    side === 'before' ? item.startTicks < playheadTicks : item.startTicks >= playheadTicks,
  )
  if (items.length === 0) return EMPTY_SELECTION
  const ids = items.flatMap((item) => boundPartners(model, item.id, groups))
  return settle(ids, items[0].id)
}

/**
 * Drop anything that is no longer on the timeline, and keep everything else.
 *
 * ## The thing this must NOT do
 *
 * It must not drop an item just because it is scrolled out of view. The view
 * model holds every item in the project; only the drawing is limited to what is
 * on screen. If this function were given the visible items instead, a user who
 * selected four clips and scrolled would come back to fewer than four, and would
 * have no idea why. A test drives exactly that.
 */
export const reconcileSelectionV2 = (
  model: TimelineViewModel,
  selection: TimelineSelectionV2,
): TimelineSelectionV2 => {
  const existing = new Set(allTimelineItems(model).map((item) => item.id))
  const kept = selection.itemIds.filter((id) => existing.has(id))
  if (kept.length === selection.itemIds.length
    && (selection.anchorItemId === null || existing.has(selection.anchorItemId))) {
    return selection
  }
  return settle(
    kept,
    selection.anchorItemId !== null && existing.has(selection.anchorItemId)
      ? selection.anchorItemId
      : kept[0] ?? null,
  )
}

/** Nothing picked. Never an edit, never an Undo entry. */
export const clearSelection = (): TimelineSelectionV2 => EMPTY_SELECTION

/** The one item, when exactly one thing is picked. Null when several are. */
export const soleSelectedItemId = (selection: TimelineSelectionV2): string | null =>
  selection.itemIds.length === 1 ? selection.itemIds[0] : null

/**
 * The item the panels should show: THE THING THE USER POINTED AT.
 *
 * ## Why this is not simply `itemIds[0]`
 *
 * The list is a set with no meaning to its order. Reading the first of it would
 * show somebody the settings of a clip they never chose, and let them change it.
 *
 * ## Why it is not simply "null whenever several are picked" either
 *
 * That was the first version of this and it was wrong in an ordinary case.
 * Clicking a piece of footage also picks the sound recorded WITH it — nobody
 * chose that, it is a fact about the recording — so a single click produces two
 * selected items, and the Inspector would have gone blank on every click.
 *
 * The anchor is not arbitrary. It is the last thing the user deliberately
 * pointed at: the clip they clicked, or the first thing a box caught. Showing
 * its settings is what "I picked this" means, and it is what every editor a
 * person may have used already does.
 *
 * If the anchor is somehow no longer in the selection, this answers null rather
 * than guessing — because at that point there IS no thing the user pointed at.
 */
export const primarySelectedItemId = (selection: TimelineSelectionV2): string | null => {
  if (selection.itemIds.length === 0) return null
  if (selection.itemIds.length === 1) return selection.itemIds[0]
  return selection.anchorItemId !== null && selection.itemIds.includes(selection.anchorItemId)
    ? selection.anchorItemId
    : null
}

/** The picked items themselves, in the order they are drawn. */
export const selectedItems = (
  model: TimelineViewModel,
  selection: TimelineSelectionV2,
): readonly TimelineItemView[] =>
  Object.freeze(allTimelineItems(model).filter((item) => selection.itemIds.includes(item.id)))
