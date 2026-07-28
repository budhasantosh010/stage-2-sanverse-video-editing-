import {
  CLIP_ENABLED_PRIMITIVE_ID,
  OPERATION_SCHEMA_VERSION,
  PROJECT_TIMESCALE,
  REMOVE_PRIMITIVE_ID,
  SPLIT_PRIMITIVE_ID,
  clipAtCompositionTime,
  type Clip,
  type Composition,
  type TimelineOperation,
} from '@sanverse/edit-domain'

/**
 * Turning "cut here" into an operation the server will accept.
 *
 * The user works in one currency: a moment of the finished video, which is
 * wherever the playhead is. Everything else — which piece that moment lands on,
 * how far into that piece it is, what identifier the new half gets — is worked
 * out here so that no part of the interface has to know about pieces at all.
 */

export type TimelineEditRefusal = Readonly<{ reason: string }>

export type TimelineEditResult =
  | Readonly<{ ok: true; operation: TimelineOperation }>
  | Readonly<{ ok: false; refusal: TimelineEditRefusal }>

const refuse = (reason: string): TimelineEditResult => Object.freeze({ ok: false, refusal: { reason } })

/**
 * Identifiers are generated, not derived from the clock, so two cuts made in
 * the same millisecond cannot collide. The caller supplies the randomness so
 * this module stays a pure function and can be tested exactly.
 */
export type IdMaker = () => string

const clipAt = (composition: Composition, playheadTicks: number): Clip | undefined =>
  clipAtCompositionTime(composition, { ticks: Math.max(0, Math.round(playheadTicks)), timescale: PROJECT_TIMESCALE })

/** Cut the piece under the playhead in two, at the playhead. */
export const buildSplitAtPlayhead = (
  composition: Composition,
  playheadTicks: number,
  makeOperationId: IdMaker,
  makeClipId: IdMaker,
): TimelineEditResult => {
  const clip = clipAt(composition, playheadTicks)
  if (!clip) return refuse('There is nothing to cut at this moment.')

  const atClipTime = Math.round(playheadTicks) - clip.compositionStart.ticks
  // A cut exactly on a join would produce a piece of no length, which is not a
  // cut. Saying so is better than creating an invisible empty piece.
  if (atClipTime <= 0 || atClipTime >= clip.sourceRange.duration.ticks) {
    return refuse('This is already the edge of a section. Move the playhead into the middle of one.')
  }

  return Object.freeze({
    ok: true,
    operation: Object.freeze({
      schemaVersion: OPERATION_SCHEMA_VERSION,
      operationId: makeOperationId(),
      kind: 'split-clip' as const,
      capabilityId: SPLIT_PRIMITIVE_ID,
      clipId: clip.clipId,
      atClipTime: Object.freeze({ ticks: atClipTime, timescale: PROJECT_TIMESCALE }),
      newClipId: makeClipId(),
      extensions: Object.freeze({}),
    }) as TimelineOperation,
  })
}

/**
 * Take out the piece under the playhead and close the gap.
 *
 * Closing the gap is not optional here. Leaving a hole is a real capability in
 * the domain, but it produces black silence in the middle of the video, and
 * offering both from one button would mean the user finding out which one they
 * got by watching the result.
 */
export const buildRemoveAtPlayhead = (
  composition: Composition,
  playheadTicks: number,
  makeOperationId: IdMaker,
): TimelineEditResult => {
  const clip = clipAt(composition, playheadTicks)
  if (!clip) return refuse('There is nothing to remove at this moment.')

  const remaining = composition.tracks.reduce((count, track) => count + track.clips.length, 0)
  if (remaining <= 1) return refuse('This is the only section left. Removing it would leave no video.')

  return Object.freeze({
    ok: true,
    operation: Object.freeze({
      schemaVersion: OPERATION_SCHEMA_VERSION,
      operationId: makeOperationId(),
      kind: 'remove-clip' as const,
      capabilityId: REMOVE_PRIMITIVE_ID,
      clipId: clip.clipId,
      ripple: true,
      extensions: Object.freeze({}),
    }) as TimelineOperation,
  })
}

/** Hide the piece under the playhead, or bring it back, without moving anything. */
export const buildSetEnabledAtPlayhead = (
  composition: Composition,
  playheadTicks: number,
  enabled: boolean,
  makeOperationId: IdMaker,
): TimelineEditResult => {
  const clip = clipAt(composition, playheadTicks)
  if (!clip) return refuse('There is nothing at this moment.')
  if (clip.enabled === enabled) return refuse('That section is already like that.')

  const otherShowing = composition.tracks.some((track) =>
    track.clips.some((candidate) => candidate.enabled && candidate.clipId !== clip.clipId),
  )
  if (!enabled && !otherShowing) return refuse('This is the only section showing. Hiding it would leave no video.')

  return Object.freeze({
    ok: true,
    operation: Object.freeze({
      schemaVersion: OPERATION_SCHEMA_VERSION,
      operationId: makeOperationId(),
      kind: 'set-clip-enabled' as const,
      capabilityId: CLIP_ENABLED_PRIMITIVE_ID,
      clipId: clip.clipId,
      enabled,
      extensions: Object.freeze({}),
    }) as TimelineOperation,
  })
}

export type TimelineBlock = Readonly<{
  clipId: string
  startTicks: number
  durationTicks: number
  enabled: boolean
  /** Where this block starts and how wide it is, as percentages of the whole. */
  leftPercent: number
  widthPercent: number
}>

/** The sections of the finished video, laid out for drawing a strip. */
export const timelineBlocks = (
  composition: Composition,
  totalTicks: number,
): readonly TimelineBlock[] => {
  if (totalTicks <= 0) return Object.freeze([])
  const blocks = composition.tracks.flatMap((track) =>
    track.clips.map((clip) => Object.freeze({
      clipId: clip.clipId,
      startTicks: clip.compositionStart.ticks,
      durationTicks: clip.sourceRange.duration.ticks,
      enabled: clip.enabled,
      leftPercent: (clip.compositionStart.ticks / totalTicks) * 100,
      widthPercent: (clip.sourceRange.duration.ticks / totalTicks) * 100,
    })),
  )
  return Object.freeze(blocks.sort((left, right) => left.startTicks - right.startTicks))
}
