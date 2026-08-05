import type { TimelineGroupV1 } from '@sanverse/edit-domain'

import type { TimelineViewModel } from './timeline-contract'
import {
  EMPTY_SELECTION,
  allTimelineItems,
  boundPartners,
  isSelected,
  toggleSelection,
  type TimelineSelectionV2,
} from './timeline-selection-v2'

/**
 * Dragging a box round several things at once.
 *
 * ## Where a marquee may start, and why it matters
 *
 * Only on empty space. Pressing on a clip and dragging means MOVE that clip;
 * pressing on nothing and dragging means DRAW A BOX. One gesture cannot mean
 * both, and guessing from how far the pointer travelled would mean a small
 * accidental wobble on a clip either moved it or selected half the timeline,
 * depending on luck.
 *
 * ## Nothing here is an edit
 *
 * A marquee makes no operation, no revision, no Undo entry, and no request to
 * the server. It moves a rectangle on screen and then hands a list of names to
 * the selection. Escape at any point leaves the selection exactly as it was
 * before the drag started — which is why `beginMarquee` keeps a copy of it.
 */

export type MarqueeMode =
  /** Plain drag. Whatever the box catches replaces what was picked. */
  | 'replace'
  /** Ctrl or Cmd held. What the box catches is added to what was picked. */
  | 'add'
  /** Shift held. What the box catches is flipped: picked becomes unpicked. */
  | 'toggle'

export type MarqueeSession = Readonly<{
  originTicks: number
  originLaneId: string
  currentTicks: number
  currentLaneId: string
  mode: MarqueeMode
  /** What was picked before the drag began, so Escape can put it back exactly. */
  baseSelection: TimelineSelectionV2
}>

export const marqueeModeFor = (
  modifiers: Readonly<{ ctrlKey: boolean; metaKey: boolean; shiftKey: boolean }>,
): MarqueeMode => {
  if (modifiers.ctrlKey || modifiers.metaKey) return 'add'
  if (modifiers.shiftKey) return 'toggle'
  return 'replace'
}

export const beginMarquee = (input: Readonly<{
  atTicks: number
  laneId: string
  mode: MarqueeMode
  baseSelection: TimelineSelectionV2
}>): MarqueeSession =>
  Object.freeze({
    originTicks: Math.max(0, Math.round(input.atTicks)),
    originLaneId: input.laneId,
    currentTicks: Math.max(0, Math.round(input.atTicks)),
    currentLaneId: input.laneId,
    mode: input.mode,
    baseSelection: input.baseSelection,
  })

export const updateMarquee = (
  session: MarqueeSession,
  atTicks: number,
  laneId: string,
): MarqueeSession =>
  Object.freeze({
    ...session,
    currentTicks: Math.max(0, Math.round(atTicks)),
    currentLaneId: laneId,
  })

/** Escape, or the pointer leaving the window. Puts back exactly what was there. */
export const cancelMarquee = (session: MarqueeSession): TimelineSelectionV2 => session.baseSelection

export type MarqueeBounds = Readonly<{
  startTicks: number
  endTicks: number
  firstLaneIndex: number
  lastLaneIndex: number
}>

/**
 * The box, in a settled form, whichever way the user dragged.
 *
 * Dragging right-to-left and bottom-to-top has to catch exactly the same things
 * as dragging left-to-right and top-to-bottom. Sorting the two corners here is
 * what makes every function below able to assume start ≤ end.
 */
export const marqueeBounds = (
  model: TimelineViewModel,
  session: MarqueeSession,
): MarqueeBounds | null => {
  const originIndex = model.lanes.findIndex((lane) => lane.id === session.originLaneId)
  const currentIndex = model.lanes.findIndex((lane) => lane.id === session.currentLaneId)
  if (originIndex < 0 || currentIndex < 0) return null
  return Object.freeze({
    startTicks: Math.min(session.originTicks, session.currentTicks),
    endTicks: Math.max(session.originTicks, session.currentTicks),
    firstLaneIndex: Math.min(originIndex, currentIndex),
    lastLaneIndex: Math.max(originIndex, currentIndex),
  })
}

/**
 * How far the box has to be dragged before it counts.
 *
 * A quarter of a second of timeline. Below that it is a click on empty space,
 * which means "let go of everything" — and a hand that shakes two pixels while
 * clicking must not silently select a clip.
 */
export const MARQUEE_MINIMUM_TICKS = 360_000

export const marqueeIsMeaningful = (session: MarqueeSession): boolean =>
  Math.abs(session.currentTicks - session.originTicks) >= MARQUEE_MINIMUM_TICKS
  || session.currentLaneId !== session.originLaneId

/**
 * What the box is currently touching.
 *
 * TOUCHING, not fully containing. A sixty-second clip cannot be fully contained
 * in a box the user can comfortably drag on a zoomed-in timeline, so requiring
 * containment would make long clips impossible to catch — and the user would
 * conclude the feature was broken rather than that they had misunderstood it.
 *
 * The trade-off, stated: a box that just clips the tail of a neighbour catches
 * the neighbour. That is visible before letting go, because every caught item is
 * drawn as caught while the box is still being dragged.
 */
export const marqueeItemIds = (
  model: TimelineViewModel,
  session: MarqueeSession,
): readonly string[] => {
  const bounds = marqueeBounds(model, session)
  if (!bounds) return Object.freeze([])
  const caught: string[] = []
  model.lanes.forEach((lane, index) => {
    if (index < bounds.firstLaneIndex || index > bounds.lastLaneIndex) return
    for (const item of lane.items) {
      const itemEnd = item.startTicks + item.durationTicks
      // Half-open on both sides, the same rule the whole project uses, so an
      // item that ends exactly where the box starts is NOT caught.
      if (item.startTicks < bounds.endTicks && bounds.startTicks < itemEnd) caught.push(item.id)
    }
  })
  return Object.freeze(caught)
}

/**
 * The selection this box produces, without changing anything yet.
 *
 * Called on every pointer move so the timeline can show what is about to be
 * taken, and called once more on release with the same inputs. Same inputs, same
 * answer — so what the user was shown IS what they get. A separate "preview"
 * calculation would be the same class of bug that Gate T0 was about.
 */
export const applyMarquee = (
  model: TimelineViewModel,
  session: MarqueeSession,
  groups: readonly TimelineGroupV1[] = [],
): TimelineSelectionV2 => {
  if (!marqueeIsMeaningful(session)) {
    // A click on empty space. Letting go of everything is the honest reading of
    // "the user pointed at nothing".
    return session.mode === 'replace' ? EMPTY_SELECTION : session.baseSelection
  }

  const caught = marqueeItemIds(model, session)
  const existing = new Set(allTimelineItems(model).map((item) => item.id))
  const withPartners = caught
    .flatMap((itemId) => boundPartners(model, itemId, groups))
    .filter((itemId) => existing.has(itemId))

  if (session.mode === 'replace') {
    return Object.freeze({
      itemIds: Object.freeze([...new Set(withPartners)].sort()),
      anchorItemId: caught[0] ?? null,
    })
  }

  if (session.mode === 'add') {
    return Object.freeze({
      itemIds: Object.freeze([...new Set([...session.baseSelection.itemIds, ...withPartners])].sort()),
      anchorItemId: caught[0] ?? session.baseSelection.anchorItemId,
    })
  }

  // toggle: everything the box touched flips. Built by running the ordinary
  // Ctrl-click through the same function a real Ctrl-click uses, so the two can
  // never disagree about what a group does.
  let next = session.baseSelection
  for (const itemId of caught) {
    if (isSelected(session.baseSelection, itemId) === isSelected(next, itemId)) {
      next = toggleSelection(model, next, itemId, groups)
    }
  }
  return Object.freeze({ ...next, anchorItemId: caught[0] ?? next.anchorItemId })
}

/**
 * How fast to scroll when the pointer is dragged against an edge.
 *
 * Returns pixels per animation frame; negative is left. Zero in the middle,
 * which is most of the time.
 *
 * The band is 48 pixels rather than a single pixel at the very edge, because a
 * user dragging a box is watching the box, not the edge of the panel, and a
 * one-pixel target means the timeline only scrolls by accident. Speed rises with
 * how far into the band the pointer is, so easing off slows down instead of
 * stopping dead.
 */
export const MARQUEE_EDGE_BAND_PX = 48
export const MARQUEE_MAX_SCROLL_PX_PER_FRAME = 24

export const marqueeAutoScrollPx = (input: Readonly<{
  pointerXInViewportPx: number
  viewportWidthPx: number
}>): number => {
  const { pointerXInViewportPx: x, viewportWidthPx: width } = input
  if (!Number.isFinite(x) || !Number.isFinite(width) || width <= 0) return 0

  if (x < MARQUEE_EDGE_BAND_PX) {
    const depth = Math.min(1, (MARQUEE_EDGE_BAND_PX - Math.max(0, x)) / MARQUEE_EDGE_BAND_PX)
    return -Math.round(depth * MARQUEE_MAX_SCROLL_PX_PER_FRAME)
  }
  if (x > width - MARQUEE_EDGE_BAND_PX) {
    const depth = Math.min(1, (x - (width - MARQUEE_EDGE_BAND_PX)) / MARQUEE_EDGE_BAND_PX)
    return Math.round(depth * MARQUEE_MAX_SCROLL_PX_PER_FRAME)
  }
  return 0
}
