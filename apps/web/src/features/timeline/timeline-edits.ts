import {
  CLIP_AUDIO_PRIMITIVE_ID,
  CLIP_ENABLED_PRIMITIVE_ID,
  MAX_CLIP_GAIN_DB,
  MIN_CLIP_GAIN_DB,
  OPERATION_SCHEMA_VERSION,
  PROJECT_TIMESCALE,
  REMOVE_PRIMITIVE_ID,
  REORDER_PRIMITIVE_ID,
  SPLIT_PRIMITIVE_ID,
  TRIM_PRIMITIVE_ID,
  clipAtCompositionTime,
  type Clip,
  type Composition,
  type TimelineOperation,
} from '@sanverse/edit-domain'
import { clipCompositionDurationTicks } from '@sanverse/edit-domain/composition'

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
  closeGap = true,
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
      ripple: closeGap,
      extensions: Object.freeze({}),
    }) as TimelineOperation,
  })
}

/** Shorten the start or end of the section under the playhead. */
export const buildTrimAtPlayhead = (
  composition: Composition,
  playheadTicks: number,
  edge: 'start' | 'end',
  amountTicks: number,
  closeGap: boolean,
  makeOperationId: IdMaker,
): TimelineEditResult => {
  const clip = clipAt(composition, playheadTicks)
  if (!clip) return refuse('There is nothing to shorten at this moment.')
  const amount = Math.round(amountTicks)
  if (amount <= 0) return refuse('Choose an amount greater than zero.')
  if (amount >= clip.sourceRange.duration.ticks) {
    return refuse('That would remove the whole section. Choose a shorter amount.')
  }
  const zero = Object.freeze({ ticks: 0, timescale: PROJECT_TIMESCALE })
  const trim = Object.freeze({ ticks: amount, timescale: PROJECT_TIMESCALE })
  return Object.freeze({
    ok: true,
    operation: Object.freeze({
      schemaVersion: OPERATION_SCHEMA_VERSION,
      operationId: makeOperationId(),
      kind: 'trim-clip' as const,
      capabilityId: TRIM_PRIMITIVE_ID,
      clipId: clip.clipId,
      trimStart: edge === 'start' ? trim : zero,
      trimEnd: edge === 'end' ? trim : zero,
      ripple: closeGap,
      extensions: Object.freeze({}),
    }) as TimelineOperation,
  })
}

/** Move the section under the playhead by one place, in plain directional terms. */
export const buildMoveAtPlayhead = (
  composition: Composition,
  playheadTicks: number,
  direction: 'earlier' | 'later',
  makeOperationId: IdMaker,
): TimelineEditResult => {
  const clip = clipAt(composition, playheadTicks)
  if (!clip) return refuse('There is nothing to move at this moment.')
  const track = composition.tracks.find((candidate) =>
    candidate.clips.some((item) => item.clipId === clip.clipId),
  )
  if (!track) return refuse('That section could not be found.')
  const ordered = [...track.clips].sort(
    (left, right) => left.compositionStart.ticks - right.compositionStart.ticks,
  )
  const index = ordered.findIndex((item) => item.clipId === clip.clipId)
  const toIndex = direction === 'earlier' ? index - 1 : index + 1
  if (toIndex < 0) return refuse('This section is already first.')
  if (toIndex >= ordered.length) return refuse('This section is already last.')
  return Object.freeze({
    ok: true,
    operation: Object.freeze({
      schemaVersion: OPERATION_SCHEMA_VERSION,
      operationId: makeOperationId(),
      kind: 'reorder-clip' as const,
      capabilityId: REORDER_PRIMITIVE_ID,
      clipId: clip.clipId,
      toIndex,
      extensions: Object.freeze({}),
    }) as TimelineOperation,
  })
}

/** Set loudness and fades for the section under the playhead. */
export const buildSetAudioAtPlayhead = (
  composition: Composition,
  playheadTicks: number,
  gainDb: number,
  fadeInTicks: number,
  fadeOutTicks: number,
  makeOperationId: IdMaker,
): TimelineEditResult => {
  const clip = clipAt(composition, playheadTicks)
  if (!clip) return refuse('There is nothing to adjust at this moment.')
  if (!Number.isFinite(gainDb) || gainDb < MIN_CLIP_GAIN_DB || gainDb > MAX_CLIP_GAIN_DB) {
    return refuse(`Choose a loudness between ${MIN_CLIP_GAIN_DB} and ${MAX_CLIP_GAIN_DB} dB.`)
  }
  const fadeIn = Math.max(0, Math.round(fadeInTicks))
  const fadeOut = Math.max(0, Math.round(fadeOutTicks))
  // Ramps are heard on the finished video's clock, so they are measured
  // against how long the piece lasts ON SCREEN. At normal speed that is the
  // same number as the amount of recording it uses, which is why this reads
  // identically for every project made before speed existed.
  if (fadeIn + fadeOut > clipCompositionDurationTicks(clip)) {
    return refuse('The fades cannot be longer than this section.')
  }
  return Object.freeze({
    ok: true,
    operation: Object.freeze({
      schemaVersion: OPERATION_SCHEMA_VERSION,
      operationId: makeOperationId(),
      kind: 'set-clip-audio' as const,
      capabilityId: CLIP_AUDIO_PRIMITIVE_ID,
      clipId: clip.clipId,
      gainDb,
      fadeIn: Object.freeze({ ticks: fadeIn, timescale: PROJECT_TIMESCALE }),
      fadeOut: Object.freeze({ ticks: fadeOut, timescale: PROJECT_TIMESCALE }),
      // The piece's CURRENT left/right position, carried through unchanged.
      //
      // This one line matters: `set-clip-audio` carries the whole answer for a
      // piece's sound, and the last one wins outright. Leaving pan out would
      // mean that nudging the volume slider on a clip the user had placed hard
      // left silently snapped it back to the middle — a setting destroyed by
      // an unrelated edit, with nothing on screen to say so.
      pan: clip.pan,
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
