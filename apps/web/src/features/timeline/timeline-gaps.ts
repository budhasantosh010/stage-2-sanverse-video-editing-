import {
  MOVE_PRIMARY_CLIP_PRIMITIVE_ID,
  OPERATION_SCHEMA_VERSION,
  PROJECT_TIMESCALE,
  effectiveComposition,
  validateOperation,
  type EditOperation,
  type EditProject,
} from '@sanverse/edit-domain'

import type { TimelineItemView } from './timeline-contract'
import type { TimelineItemPlanInput, TimelineItemRefusal, TimelineItemRefusalCode } from './timeline-item-operations'

/**
 * A hole in the main video, treated as a thing the user can point at.
 *
 * ## What a gap is, and the one thing it must never be
 *
 * A gap is nothing. It is the absence of footage between two clips, left behind
 * by a cut. Nothing plays there and nothing is exported there.
 *
 * ```
 *      |=== clip A ===|            |=== clip B ===|
 *                      \__________/
 *                        the gap
 *                     4.0s of nothing
 * ```
 *
 * The rule that must not be broken: **a gap must never be drawn or described as
 * if it were media.** No filmstrip, no waveform, no file name, no duration
 * pretending to be a clip's duration. A user who sees something that looks like
 * a clip and finds silence in their export has been lied to by the editor, and
 * from then on they cannot trust any of it.
 *
 * So a gap is drawn as an empty outline, says the word "Gap", and says how long
 * it is. That is all it claims to be.
 *
 * ## Why a gap is worth selecting at all
 *
 * Because the two things a user wants to do with a hole both need it named
 * first: close it, or put something in it. Before this, a gap could be looked at
 * and not touched, so closing one meant hunting for the clip after it and using
 * a control that talked about that clip instead.
 */

export const isGapItem = (item: TimelineItemView): boolean => item.kind === 'gap'

/**
 * A gap's identity, taken apart.
 *
 * `gap:lane:video:0:5760000` — the row, where it starts, how long it lasts.
 * Built from those three things rather than from a stored id, because a gap is
 * not stored anywhere: it is the shape of the space between two clips, and it
 * stops existing the moment either of them moves.
 */
export const parseGapItemId = (
  itemId: string,
): Readonly<{ laneId: string; startTicks: number; durationTicks: number }> | null => {
  const match = /^gap:(.+):(\d+):(\d+)$/.exec(itemId)
  if (!match) return null
  return Object.freeze({
    laneId: match[1],
    startTicks: Number(match[2]),
    durationTicks: Number(match[3]),
  })
}

/**
 * How long the hole is, in words.
 *
 * Seconds with one decimal place, because a gap the user can see is never
 * measured in frames, and "0.3 seconds" is something a person can act on where
 * "432,000 ticks" is not.
 */
export const gapDurationLabel = (durationTicks: number, timescale = PROJECT_TIMESCALE): string => {
  const seconds = durationTicks / timescale
  return seconds < 0.05 ? 'less than a tenth of a second' : `${seconds.toFixed(1)} seconds`
}

export const gapDescription = (item: TimelineItemView, timescale = PROJECT_TIMESCALE): string =>
  `Empty space, ${gapDurationLabel(item.durationTicks, timescale)} long. Nothing plays here.`

/**
 * The edges of every gap, so things can snap to them.
 *
 * Both edges of a hole are places a user genuinely aims at — "put this right at
 * the end of the gap" — and without them the pointer sails past the exact spot
 * and lands a few frames out, which the export shows even though the screen did
 * not.
 */
export const gapSnapTicks = (items: readonly TimelineItemView[]): readonly number[] =>
  Object.freeze(
    items
      .filter(isGapItem)
      .flatMap((gap) => [gap.startTicks, gap.startTicks + gap.durationTicks]),
  )

export type GapPlan =
  | Readonly<{ ok: true; operations: readonly EditOperation[]; description: string }>
  | Readonly<{ ok: false; refusal: TimelineItemRefusal }>

const refuse = (code: TimelineItemRefusalCode, message: string): GapPlan =>
  Object.freeze({ ok: false, refusal: Object.freeze({ code, message }) })

/**
 * Close the hole: pull everything after it back by exactly its length.
 *
 * ## Why every later clip moves, not just the next one
 *
 * Moving only the next clip would close this gap and open an identical one
 * immediately after it. The user would press Close Gap, watch the hole appear to
 * jump one clip to the right, and reasonably conclude the button was broken.
 *
 * ```
 *      before   |A|    |B||C||D|
 *                  ^gap
 *      wrong    |A||B|    |C||D|      the hole just moved
 *      right    |A||B||C||D|          the hole is gone
 * ```
 *
 * ## One change set
 *
 * Every clip that moves is one operation and all of them go into a single change
 * set, so closing a gap in a video made of forty clips is still one Undo.
 *
 * ## What this deliberately does not touch
 *
 * B-roll, pictures, titles and music are left exactly where they are. B-roll is
 * pinned to a moment of the FOOTAGE, so it travels with the footage
 * automatically — closing a gap moves the footage, and the B-roll goes with it,
 * staying on the thing the user pinned it to. Music is measured on the finished
 * video and deliberately does not move: the bed under a piece stays where it was
 * laid.
 */
export const planCloseGap = (input: Readonly<{
  project: EditProject
  gapItemId: string
  lockedTrackIds: readonly string[]
  pendingProposalExists: boolean
  exportInProgress: boolean
  expectedRevision: number
  ids: TimelineItemPlanInput['ids']
}>): GapPlan => {
  if (input.project.revision !== input.expectedRevision) {
    return refuse('PROJECT_STALE', 'The project changed a moment ago. Try that again.')
  }
  if (input.pendingProposalExists) {
    return refuse('PROPOSAL_PENDING', 'Finish the suggestion on screen before changing the timeline.')
  }
  if (input.exportInProgress) {
    return refuse('EXPORT_IN_PROGRESS', 'Wait for the export to finish before changing the timeline.')
  }
  if (input.lockedTrackIds.includes('V1')) {
    return refuse('TRACK_LOCKED', 'Track V1 is locked. Unlock it to change anything on it.')
  }

  const gap = parseGapItemId(input.gapItemId)
  if (!gap) return refuse('ITEM_UNKNOWN', 'That empty space is no longer there.')
  if (gap.durationTicks <= 0) {
    return refuse('ITEM_UNKNOWN', 'There is no empty space there to close.')
  }

  const composition = effectiveComposition(input.project)
  const clips = composition.tracks.flatMap((track) => track.clips)
  const gapEnd = gap.startTicks + gap.durationTicks
  const after = clips
    .filter((clip) => clip.compositionStart.ticks >= gapEnd)
    .slice()
    .sort((left, right) => left.compositionStart.ticks - right.compositionStart.ticks)

  if (after.length === 0) {
    // A hole at the very end is not a hole; it is where the video stopped.
    // Saying so is better than a button that does nothing when pressed.
    return refuse('OUT_OF_RANGE', 'There is nothing after that empty space to pull back.')
  }

  const operations = after.map((clip, index) => Object.freeze({
    schemaVersion: OPERATION_SCHEMA_VERSION,
    operationId: input.ids.operation(index),
    kind: 'move-primary-clip',
    capabilityId: MOVE_PRIMARY_CLIP_PRIMITIVE_ID,
    clipId: clip.clipId,
    compositionStart: Object.freeze({
      ticks: Math.max(0, clip.compositionStart.ticks - gap.durationTicks),
      timescale: PROJECT_TIMESCALE,
    }),
    extensions: Object.freeze({}),
  }) as unknown as EditOperation)

  for (const operation of operations) {
    if (!validateOperation(operation).ok) {
      return refuse('OPERATION_UNSUPPORTED', 'Sanverse cannot close that space. Nothing was altered.')
    }
  }

  return Object.freeze({
    ok: true,
    operations: Object.freeze(operations),
    description: 'Close the empty space',
  })
}
