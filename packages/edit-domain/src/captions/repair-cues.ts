import { mediaTime, PROJECT_TIMESCALE, type TimeRange } from '../time.ts'
import type { CaptionCueDraft } from './segment-transcript.ts'

/**
 * Make a list of cues physically showable, and say exactly what had to change.
 *
 * Segmentation asks "what should this cue say and how long does it need to be
 * read?" without knowing what comes next. Repair is the second pass that knows
 * about the neighbours, and fixes the three things that make captions look
 * broken:
 *
 *   overlap     two cues on screen at once, drawn on top of each other
 *   flicker     a cue replaced with no visible gap, which reads as a glitch
 *   too short   a cue gone before the eye can land on it
 *
 * Every change is REPORTED, never silent. A caption the system shortened
 * without telling anyone is a caption the user approved without knowing what
 * they approved, and that is the failure mode this whole product is built to
 * avoid.
 */

export type CueRepairOptions = Readonly<{
  /** Visible blank between one cue leaving and the next arriving. */
  minGapTicks: number
  /** Below this a cue cannot be read at all and is dropped, not shrunk. */
  hardFloorTicks: number
  minDurationTicks: number
  maxDurationTicks: number
  /** Nothing may extend past the end of the footage it is anchored to. */
  sourceDurationTicks: number
}>

export const DEFAULT_REPAIR = Object.freeze({
  minGapTicks: Math.round(PROJECT_TIMESCALE * 0.08), // 0.08s — two frames at 25fps
  hardFloorTicks: Math.round(PROJECT_TIMESCALE * 0.3), // 0.3s
  minDurationTicks: PROJECT_TIMESCALE, // 1.0s
  maxDurationTicks: PROJECT_TIMESCALE * 6, // 6.0s
}) satisfies Omit<CueRepairOptions, 'sourceDurationTicks'>

export type CueAdjustmentReason =
  | 'SHORTENED_TO_AVOID_OVERLAP'
  | 'SHORTENED_TO_MAXIMUM'
  | 'LENGTHENED_TO_MINIMUM'
  | 'CLAMPED_TO_FOOTAGE_END'
  | 'DROPPED_TOO_SHORT'
  | 'DROPPED_OUTSIDE_FOOTAGE'

export type CueAdjustment = Readonly<{
  /** Position in the list handed in, so a caller can point at the original. */
  index: number
  reason: CueAdjustmentReason
  fromTicks: number
  toTicks: number
}>

export type CueRepairResult = Readonly<{
  cues: readonly CaptionCueDraft[]
  adjustments: readonly CueAdjustment[]
}>

const endTicks = (range: TimeRange): number => range.start.ticks + range.duration.ticks

/**
 * Repair a list of cues in one forward pass.
 *
 * Working forwards and only ever moving a cue's END is deliberate. Moving a
 * start would break the promise that a caption appears when the word is spoken,
 * and moving a start backwards could reopen an overlap that had already been
 * fixed — turning one pass into a loop with no guaranteed end.
 */
export const repairCueTimings = (
  input: readonly CaptionCueDraft[],
  options: CueRepairOptions,
): CueRepairResult => {
  const adjustments: CueAdjustment[] = []
  const ordered = [...input]
    .map((cue, index) => ({ cue, index }))
    .sort((left, right) => {
      const byStart = left.cue.sourceInterval.start.ticks - right.cue.sourceInterval.start.ticks
      // Ties keep the order they were handed in, so repair is deterministic.
      return byStart !== 0 ? byStart : left.index - right.index
    })

  const kept: CaptionCueDraft[] = []

  for (let position = 0; position < ordered.length; position += 1) {
    const { cue, index } = ordered[position]
    const start = cue.sourceInterval.start.ticks
    let end = endTicks(cue.sourceInterval)

    if (start >= options.sourceDurationTicks) {
      adjustments.push({ index, reason: 'DROPPED_OUTSIDE_FOOTAGE', fromTicks: start, toTicks: start })
      continue
    }

    if (end > options.sourceDurationTicks) {
      adjustments.push({
        index,
        reason: 'CLAMPED_TO_FOOTAGE_END',
        fromTicks: end,
        toTicks: options.sourceDurationTicks,
      })
      end = options.sourceDurationTicks
    }

    if (end - start > options.maxDurationTicks) {
      adjustments.push({
        index,
        reason: 'SHORTENED_TO_MAXIMUM',
        fromTicks: end,
        toTicks: start + options.maxDurationTicks,
      })
      end = start + options.maxDurationTicks
    }

    // The ceiling this cue must respect: the next cue's start, less the gap.
    // Looking at the NEXT original start rather than the next repaired start is
    // what keeps this a single pass — the next cue's start is never moved.
    const next = ordered[position + 1]
    const ceiling = next
      ? Math.min(next.cue.sourceInterval.start.ticks - options.minGapTicks, options.sourceDurationTicks)
      : options.sourceDurationTicks

    if (end - start < options.minDurationTicks) {
      const wanted = start + options.minDurationTicks
      const lengthened = Math.min(wanted, ceiling)
      if (lengthened > end) {
        adjustments.push({ index, reason: 'LENGTHENED_TO_MINIMUM', fromTicks: end, toTicks: lengthened })
        end = lengthened
      }
    }

    if (end > ceiling) {
      adjustments.push({ index, reason: 'SHORTENED_TO_AVOID_OVERLAP', fromTicks: end, toTicks: ceiling })
      end = ceiling
    }

    if (end - start < options.hardFloorTicks) {
      // There is genuinely no room. Dropping it is honest; drawing a caption
      // for a tenth of a second is not.
      adjustments.push({ index, reason: 'DROPPED_TOO_SHORT', fromTicks: end - start, toTicks: 0 })
      continue
    }

    kept.push(Object.freeze({
      sourceInterval: Object.freeze({ start: mediaTime(start), duration: mediaTime(end - start) }),
      lines: cue.lines,
    }))
  }

  return Object.freeze({ cues: Object.freeze(kept), adjustments: Object.freeze(adjustments) })
}

/** True when no two cues in the list are ever on screen at the same instant. */
export const cuesAreDisjoint = (cues: readonly CaptionCueDraft[]): boolean => {
  const sorted = [...cues].sort(
    (left, right) => left.sourceInterval.start.ticks - right.sourceInterval.start.ticks,
  )
  for (let index = 1; index < sorted.length; index += 1) {
    if (sorted[index].sourceInterval.start.ticks < endTicks(sorted[index - 1].sourceInterval)) return false
  }
  return true
}
