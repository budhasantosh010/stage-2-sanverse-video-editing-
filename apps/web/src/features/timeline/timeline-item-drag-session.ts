import type { PlacementMode } from './timeline-placement-planner'
import type { TimelineItemRefusal } from './timeline-item-operations'

/**
 * Dragging something that is ALREADY on the timeline.
 *
 * ## The rule this file exists to keep
 *
 *   ONE GESTURE = ONE CHANGE SET = ONE UNDO
 *
 * A drag across the screen fires a few hundred pointer events. If each one were
 * an edit, the project would take a few hundred revisions, the server would get
 * a few hundred requests, and pressing Undo would step backwards one pixel at a
 * time for the rest of the afternoon.
 *
 * So while the pointer is moving, NOTHING happens to the project. Not an
 * operation, not a request, not a revision, not a history entry. The only thing
 * that changes is what is drawn: a ghost of where the item would land, a guide
 * line, and either "this will work" or the sentence saying why it will not.
 *
 * The edit is decided once, when the pointer is released.
 *
 *   pointer down    a session begins; nothing is edited
 *   pointer moves   the ghost moves; nothing is edited
 *   Escape          the session ends; nothing is edited, and nothing is undone
 *                   because nothing was ever done
 *   pointer up      exactly one change set, or exactly one refusal
 *
 * ## Why the session is a value and not a pile of React state
 *
 * Kept as one frozen object, the whole gesture can be tested without a browser
 * and read in one place. Six separate `useState` calls would let the screen
 * show a valid-looking ghost while the refusal said otherwise, because two of
 * them updated and four did not.
 */
export const TIMELINE_ITEM_DRAG_SCHEMA_VERSION = 'sanverse.timeline-item-drag/v1'

export type TimelineItemDragValidity = 'pending' | 'valid' | 'refused'

export type TimelineItemDragSessionV1 = Readonly<{
  schemaVersion: typeof TIMELINE_ITEM_DRAG_SCHEMA_VERSION
  /** The presentation id of the item being dragged. */
  itemId: string
  sourceLaneId: string
  targetLaneId: string
  /** Which edge, or the whole item. Decided when the pointer goes down. */
  grip: 'body' | 'start' | 'end'
  originalStartTicks: number
  originalDurationTicks: number
  /** Where the pointer is, before snapping. */
  rawTargetTicks: number
  /** Where it would actually land. Equal to `rawTargetTicks` when nothing snapped. */
  snappedTargetTicks: number
  placementMode: PlacementMode
  validity: TimelineItemDragValidity
  refusal: TimelineItemRefusal | null
  /** The revision the gesture began on. A late drop on a moved project refuses. */
  baseRevision: number
}>

export type BeginTimelineItemDragInput = Readonly<{
  itemId: string
  laneId: string
  grip: 'body' | 'start' | 'end'
  startTicks: number
  durationTicks: number
  pointerTicks: number
  placementMode: PlacementMode
  baseRevision: number
}>

export const beginTimelineItemDrag = (
  input: BeginTimelineItemDragInput,
): TimelineItemDragSessionV1 =>
  Object.freeze({
    schemaVersion: TIMELINE_ITEM_DRAG_SCHEMA_VERSION,
    itemId: input.itemId,
    sourceLaneId: input.laneId,
    targetLaneId: input.laneId,
    grip: input.grip,
    originalStartTicks: input.startTicks,
    originalDurationTicks: input.durationTicks,
    rawTargetTicks: input.pointerTicks,
    snappedTargetTicks: input.pointerTicks,
    placementMode: input.placementMode,
    // Nothing has been checked yet, and claiming "valid" before checking would
    // flash a green ghost that turns red a frame later.
    validity: 'pending',
    refusal: null,
    baseRevision: input.baseRevision,
  })

export type AdvanceTimelineItemDragInput = Readonly<{
  session: TimelineItemDragSessionV1
  rawTargetTicks: number
  snappedTargetTicks: number
  /** Null while the gesture is still allowed. */
  refusal: TimelineItemRefusal | null
}>

/**
 * Move the ghost. Never touches the project.
 *
 * The caller decides validity by asking the same planner the release will ask,
 * which is what stops the ghost and the outcome disagreeing.
 */
export const advanceTimelineItemDrag = (
  input: AdvanceTimelineItemDragInput,
): TimelineItemDragSessionV1 =>
  Object.freeze({
    ...input.session,
    rawTargetTicks: input.rawTargetTicks,
    snappedTargetTicks: input.snappedTargetTicks,
    validity: input.refusal === null ? 'valid' : 'refused',
    refusal: input.refusal,
  })

/**
 * What the release should ask the planner for.
 *
 * Null when the gesture would change nothing — the item was picked up and put
 * back where it was. A change set that changes nothing would still take a
 * revision and a slot in Undo, which reads to the user as a broken button.
 */
export const timelineItemDragAction = (
  session: TimelineItemDragSessionV1,
):
  | Readonly<{ type: 'move'; toStartTicks: number }>
  | Readonly<{ type: 'trim-start'; toStartTicks: number }>
  | Readonly<{ type: 'trim-end'; toEndTicks: number }>
  | null => {
  const target = session.snappedTargetTicks
  if (session.grip === 'body') {
    if (target === session.originalStartTicks) return null
    return Object.freeze({ type: 'move' as const, toStartTicks: target })
  }
  if (session.grip === 'start') {
    if (target === session.originalStartTicks) return null
    return Object.freeze({ type: 'trim-start' as const, toStartTicks: target })
  }
  const originalEnd = session.originalStartTicks + session.originalDurationTicks
  if (target === originalEnd) return null
  return Object.freeze({ type: 'trim-end' as const, toEndTicks: target })
}

/** Where the ghost is drawn, in finished-video time. */
export const timelineItemDragGhost = (
  session: TimelineItemDragSessionV1,
): Readonly<{ startTicks: number; durationTicks: number }> => {
  const target = session.snappedTargetTicks
  if (session.grip === 'body') {
    return Object.freeze({ startTicks: target, durationTicks: session.originalDurationTicks })
  }
  const originalEnd = session.originalStartTicks + session.originalDurationTicks
  if (session.grip === 'start') {
    return Object.freeze({
      startTicks: Math.min(target, originalEnd),
      durationTicks: Math.max(0, originalEnd - target),
    })
  }
  return Object.freeze({
    startTicks: session.originalStartTicks,
    durationTicks: Math.max(0, target - session.originalStartTicks),
  })
}
