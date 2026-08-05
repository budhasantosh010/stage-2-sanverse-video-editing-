import { compositionDuration, effectiveComposition, type EditOperation, type EditProject } from '@sanverse/edit-domain'

import {
  MIN_ITEM_TICKS,
  applyLaneEdits,
  laneSpans,
  parseTimelineItemId,
  spansOverlap,
  trackIdForItem,
  type LaneEdit,
  type TimelineItemPlanInput,
  type TimelineItemRefusal,
  type TimelineItemRefusalCode,
} from './timeline-item-operations'

/**
 * Moving or trimming SEVERAL things in one gesture.
 *
 * ## The rule this file exists to keep
 *
 * One gesture is one change set is one Undo. A user who drags four clips and
 * then presses Undo gets all four back where they were — not the fourth one
 * back and three still moved.
 *
 * The lazy version of this feature is a loop: plan each item on its own and send
 * four change sets. It is wrong in three separate ways, and each one is the kind
 * of thing a user finds out about only after it has cost them something:
 *
 *   1. Four Undos to undo one drag. And the first Undo leaves the video in a
 *      state the user never asked for and never saw.
 *   2. Each item would be planned against the project as it was BEFORE the
 *      others moved, so two clips swapping places would each be told the other
 *      is in the way, and both would be refused.
 *   3. If number three of four is refused, the first two have already happened.
 *      There is no honest thing to say to the user at that point.
 *
 * So this file plans the whole gesture at once, checks it as a whole, and
 * returns either every operation or none of them.
 *
 * ## All-or-nothing, said out loud
 *
 * If ANY item in the selection cannot make the move, the whole gesture is
 * refused and nothing changes. The alternative — move the ones that fit — is
 * worse: the user's clips end up at different spacings from each other, which is
 * exactly the thing they picked several items to preserve.
 *
 * ## One planner, so the preview cannot lie
 *
 * The ghost shown while dragging and the edit made on release come from THIS
 * function, called with the same inputs. There is no second "roughly what will
 * happen" calculation. Gate T0 was caused by two pieces of code answering the
 * same question separately; this is that lesson applied before the bug.
 */

export type MultiItemGesture =
  /** Everything slides by the same amount. Relative spacing is preserved exactly. */
  | Readonly<{ type: 'move'; deltaTicks: number }>
  /** Every item's left edge moves by the same amount. */
  | Readonly<{ type: 'trim-start'; deltaTicks: number }>
  /** Every item's right edge moves by the same amount. */
  | Readonly<{ type: 'trim-end'; deltaTicks: number }>

export type MultiItemFeedback = Readonly<{
  /** Where each item would end up. What the ghosts are drawn from. */
  placements: readonly Readonly<{ itemId: string; startTicks: number; durationTicks: number }>[]
  /** The earliest edge in the result — where the insertion line is drawn. */
  leadingEdgeTicks: number
  itemCount: number
}>

export type MultiItemPlan =
  | Readonly<{ ok: true; operations: readonly EditOperation[]; description: string; feedback: MultiItemFeedback }>
  | Readonly<{ ok: false; refusal: TimelineItemRefusal }>

const refuse = (code: TimelineItemRefusalCode, message: string): MultiItemPlan =>
  Object.freeze({ ok: false, refusal: Object.freeze({ code, message }) })

export type MultiItemPlanInput = Readonly<{
  project: EditProject
  /** Every item the user has picked. Order does not matter. */
  itemIds: readonly string[]
  gesture: MultiItemGesture
  lockedTrackIds: readonly string[]
  pendingProposalExists: boolean
  exportInProgress: boolean
  expectedRevision: number
  ids: TimelineItemPlanInput['ids']
}>

type Resolved = Readonly<{
  itemId: string
  targetId: string
  trackId: 'V2' | 'A2'
  startTicks: number
  durationTicks: number
}>

/**
 * Plan the whole gesture, or refuse the whole gesture.
 *
 * Everything it returns belongs in ONE change set.
 */
export const planMultiItemGesture = (input: MultiItemPlanInput): MultiItemPlan => {
  if (input.project.revision !== input.expectedRevision) {
    return refuse('PROJECT_STALE', 'The project changed while you were dragging. Try that again.')
  }
  if (input.pendingProposalExists) {
    return refuse('PROPOSAL_PENDING', 'Finish the suggestion on screen before changing the timeline.')
  }
  if (input.exportInProgress) {
    return refuse('EXPORT_IN_PROGRESS', 'Wait for the export to finish before changing the timeline.')
  }
  if (input.itemIds.length === 0) {
    return refuse('ITEM_UNKNOWN', 'Choose something on the timeline first.')
  }

  /*
   * Pieces of the main recording are refused here on purpose.
   *
   * V1 footage is not laid on top of anything — it IS the video, and moving a
   * piece of it changes what every later clip sits on. That belongs to the
   * precision-trim work, where ripple and roll are designed properly. Doing a
   * rough version here would produce a second set of rules about the same
   * footage, and the two would drift.
   */
  const parsedAll = input.itemIds.map((itemId) => ({ itemId, parsed: parseTimelineItemId(itemId) }))
  if (parsedAll.some((entry) => entry.parsed === null)) {
    return refuse('ITEM_UNKNOWN', 'One of the things you picked is no longer on the timeline.')
  }
  if (parsedAll.some((entry) => entry.parsed?.family === 'clip')) {
    return refuse(
      'OPERATION_UNSUPPORTED',
      'Pieces of the main video are moved one at a time, with the split and trim controls.',
    )
  }

  for (const { itemId } of parsedAll) {
    const trackId = trackIdForItem(itemId)
    if (trackId !== null && input.lockedTrackIds.includes(trackId)) {
      return refuse('TRACK_LOCKED', `Track ${trackId} is locked. Unlock it to change anything on it.`)
    }
  }

  const v2 = laneSpans(input.project, 'V2')
  const a2 = laneSpans(input.project, 'A2')
  const spansFor = (trackId: 'V2' | 'A2') => (trackId === 'V2' ? v2 : a2)

  const resolved: Resolved[] = []
  for (const { itemId, parsed } of parsedAll) {
    if (!parsed) continue
    const trackId: 'V2' | 'A2' = parsed.family === 'music' ? 'A2' : 'V2'
    const span = spansFor(trackId).find((candidate) => candidate.targetId === parsed.targetId)
    if (!span) {
      // Titles and callouts carry no lane span, so they cannot be dragged in a
      // group yet. Saying so beats a ghost that moves and then snaps back.
      return refuse(
        'OPERATION_UNSUPPORTED',
        'One of the things you picked cannot be dragged. Titles and callouts are edited in the panel on the right.',
      )
    }
    // The same underlying clip picked twice — one B-roll clip shows as two
    // rectangles after a split, and both may be selected. Planning it twice
    // would move it by double the distance.
    if (resolved.some((each) => each.targetId === span.targetId)) continue
    resolved.push(Object.freeze({
      itemId,
      targetId: span.targetId,
      trackId,
      startTicks: span.startTicks,
      durationTicks: span.durationTicks,
    }))
  }

  const videoTicks = compositionDuration(effectiveComposition(input.project)).ticks
  const delta = Math.round(input.gesture.deltaTicks)

  const placements: { itemId: string; startTicks: number; durationTicks: number }[] = []
  const edits: { trackId: 'V2' | 'A2'; edit: LaneEdit }[] = []

  for (const item of resolved) {
    if (input.gesture.type === 'move') {
      const start = item.startTicks + delta
      if (start < 0 || start + item.durationTicks > videoTicks) {
        return refuse('OUT_OF_RANGE', 'That would push part of what you picked outside the video.')
      }
      placements.push({ itemId: item.itemId, startTicks: start, durationTicks: item.durationTicks })
      edits.push({ trackId: item.trackId, edit: Object.freeze({ kind: 'move', targetId: item.targetId, toStartTicks: start }) })
      continue
    }

    const start = input.gesture.type === 'trim-start' ? item.startTicks + delta : item.startTicks
    const end = input.gesture.type === 'trim-end'
      ? item.startTicks + item.durationTicks + delta
      : item.startTicks + item.durationTicks
    if (start < 0 || end > videoTicks) {
      return refuse('OUT_OF_RANGE', 'That would pull part of what you picked outside the video.')
    }
    if (end - start < MIN_ITEM_TICKS) {
      // All-or-nothing: the SHORTEST item decides. Trimming the others and
      // leaving this one would change the spacing the user picked them to keep.
      return refuse('TOO_SHORT', 'That would make one of them shorter than a quarter of a second, so nothing was changed.')
    }
    placements.push({ itemId: item.itemId, startTicks: start, durationTicks: end - start })
    edits.push({ trackId: item.trackId, edit: Object.freeze({ kind: 'trim', targetId: item.targetId, toStartTicks: start, toEndTicks: end }) })
  }

  /*
   * Collisions are judged against what is NOT moving.
   *
   * Every item taking part is taken out of the picture first. Without that, two
   * clips swapping places would each be told the other is in the way, and a
   * whole row shuffled along by one second would refuse on its own tail.
   */
  const movingTargetIds = new Set(resolved.map((item) => item.targetId))
  for (const item of resolved) {
    const placed = placements.find((candidate) => candidate.itemId === item.itemId)
    if (!placed) continue
    const blocked = spansFor(item.trackId).some((span) =>
      !movingTargetIds.has(span.targetId) && spansOverlap(span, placed),
    )
    if (blocked) {
      return refuse('COLLISION', 'There is already something where one of them would land, so nothing was moved.')
    }
  }
  // ...and against each other, because two of the picked items must not be
  // pushed on top of one another either.
  for (let left = 0; left < placements.length; left += 1) {
    for (let right = left + 1; right < placements.length; right += 1) {
      if (resolved[left].trackId !== resolved[right].trackId) continue
      if (spansOverlap(placements[left], placements[right])) {
        return refuse('COLLISION', 'Two of the things you picked would end up on top of each other.')
      }
    }
  }

  /*
   * The operations, built by the ONE file that knows how each family is pinned.
   *
   * B-roll is pinned to a moment of the footage; music is measured on the
   * finished video. `applyLaneEdits` already holds that difference and is what
   * Insert and Overwrite use. Writing the arithmetic again here is how the two
   * would drift apart.
   */
  const operations: EditOperation[] = []
  for (const trackId of ['V2', 'A2'] as const) {
    const forTrack = edits.filter((entry) => entry.trackId === trackId).map((entry) => entry.edit)
    if (forTrack.length === 0) continue
    const applied = applyLaneEdits({
      project: input.project,
      trackId,
      edits: forTrack,
      ids: input.ids,
      slotOffset: operations.length,
    })
    if (!applied.ok) return Object.freeze({ ok: false, refusal: applied.refusal })
    operations.push(...applied.operations)
  }

  const verb = input.gesture.type === 'move' ? 'Move' : 'Trim'
  const noun = resolved.length === 1 ? '1 item' : `${resolved.length} items`
  return Object.freeze({
    ok: true,
    operations: Object.freeze(operations),
    description: `${verb} ${noun}`,
    feedback: Object.freeze({
      placements: Object.freeze(placements.map((placement) => Object.freeze(placement))),
      leadingEdgeTicks: placements.reduce(
        (lowest, placement) => Math.min(lowest, placement.startTicks),
        Number.MAX_SAFE_INTEGER,
      ),
      itemCount: resolved.length,
    }),
  })
}

/**
 * What to show while the pointer is still down.
 *
 * Deliberately just the plan's own answer. Not "roughly what will happen" — the
 * actual thing, worked out by the actual planner, so the ghost the user watches
 * and the edit they get cannot disagree. A refusal comes back as a refusal, so
 * the timeline can say why BEFORE the user lets go.
 */
export const previewMultiItemGesture = (
  input: MultiItemPlanInput,
): Readonly<{ ok: true; feedback: MultiItemFeedback }> | Readonly<{ ok: false; refusal: TimelineItemRefusal }> => {
  const plan = planMultiItemGesture(input)
  return plan.ok
    ? Object.freeze({ ok: true as const, feedback: plan.feedback })
    : Object.freeze({ ok: false as const, refusal: plan.refusal })
}
