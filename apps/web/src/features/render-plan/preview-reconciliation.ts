/**
 * Pointing the one video element at the right file, at the right moment, after
 * the project has changed underneath it.
 *
 * ── WHAT THIS IS FOR ─────────────────────────────────────────────────────────
 *
 * There is exactly ONE `<video>` element in the whole editor, and the main
 * sequence can be made of several recordings. So when the playhead crosses from
 * one recording into another, that single element has to be re-pointed at a
 * different file and then moved to the exact moment inside it. Every accepted
 * edit — a move, a trim, a split, a delete, Undo, Redo, switching a track off,
 * opening a different project — can change which file that is and which moment
 * inside it the playhead now lands on.
 *
 * Getting this wrong does not look like a crash. It looks like the wrong footage
 * on screen, or the right footage a few seconds out, which the user reads as
 * "the preview is unreliable" rather than as a bug.
 *
 * ── THE DEFECT THIS REPLACES ─────────────────────────────────────────────────
 *
 * Which recording is under the playhead used to be read from the COMPILED PLAN:
 *
 *     playheadAssetId = assetAt(previewSegments, playheadTicks)
 *
 * `previewSegments` is empty whenever the plan could not be built. That is
 * exactly the trap that produced FAIL-052 — one unrelated broken thing anywhere
 * in the project made the plan fail as a whole, `assetAt` answered "no
 * recording", and the video element was left pointed at whatever it happened to
 * be showing before. The picture on screen then had nothing to do with where the
 * playhead was.
 *
 * So the answer comes from the same authority the rest of the preview now uses:
 * `resolvePrimarySource`, which reads the user's own edit and cannot fail as a
 * whole. One broken thing costs only its own stretch.
 *
 * ── THE STALE-COMPLETION PROBLEM ─────────────────────────────────────────────
 *
 * Loading a video file is not instant. This can easily happen:
 *
 *     t=0ms    playhead moves into recording B  ->  start loading B
 *     t=40ms   user presses Undo, playhead is back in recording A
 *     t=90ms   B finishes loading  ->  "I am ready, seek to 4.2s"
 *
 * If that last message is obeyed, the user sees recording B at 4.2 seconds while
 * the playhead is sitting in recording A. The picture is wrong and nothing looks
 * broken, so nobody investigates.
 *
 * Every decision therefore carries a `generation` number that goes up by one each
 * time a new decision is made. A completion carrying an old number is ignored.
 * `isCurrentGeneration` is that check, and it is the only thing standing between
 * the user and a preview that shows the wrong clip after a fast Undo.
 */

import { PROJECT_TIMESCALE, type EditProject } from '@sanverse/edit-domain'

import { resolvePrimarySource, type PrimaryGapReason } from './primary-source.ts'

/** Whether the user wants the video running. Preserved across a file swap. */
export type PlaybackIntent = 'playing' | 'paused'

/**
 * What the one video element should do next.
 *
 * Deliberately an instruction rather than an action: this file works out WHAT
 * should happen and the screen carries it out. That is what makes every one of
 * these situations testable without a real video element, a real file, or a
 * real network.
 */
export type PreviewSourceActionV1 =
  | Readonly<{
      /** Right file already loaded. Move it, keep everything the browser buffered. */
      kind: 'seek-loaded-source'
      assetId: string
      clipId: string
      sourceTicks: number
      sourceSeconds: number
      playbackIntent: PlaybackIntent
      generation: number
    }>
  | Readonly<{
      /** Different recording. Point the SAME element at it, then seek. */
      kind: 'load-and-seek'
      assetId: string
      clipId: string
      sourceTicks: number
      sourceSeconds: number
      playbackIntent: PlaybackIntent
      generation: number
    }>
  | Readonly<{
      /** Truthfully nothing here. The reason decides which sentence is shown. */
      kind: 'show-gap'
      reason: PrimaryGapReason
      generation: number
    }>

export type ReconcilePrimaryPreviewInput = Readonly<{
  nextProject: EditProject
  playheadTicks: number
  /** The recording the element is pointed at now, or null before anything loads. */
  loadedAssetId: string | null
  /** Whether the user had it playing. Carried through a file swap unchanged. */
  playbackIntent: PlaybackIntent
  /** The number of the decision before this one. */
  generation: number
}>

/**
 * Decide what the video element should do, given the project as it now is.
 *
 * Pure, and the argument list is the proof of what it cannot be influenced by:
 * there is no slot for the selection, the hover, the focused panel, the
 * Inspector, a pending suggestion, the toolbar, or the monitor's Fit/Fill
 * setting. None of those has any business deciding which file is on screen, and
 * here they are not merely unused — they cannot be passed in at all.
 */
export const reconcilePrimaryPreview = (
  input: ReconcilePrimaryPreviewInput,
): PreviewSourceActionV1 => {
  const generation = input.generation + 1
  const decision = resolvePrimarySource(input.nextProject, input.playheadTicks)

  if (decision.kind === 'gap') {
    return Object.freeze({ kind: 'show-gap' as const, reason: decision.reason, generation })
  }

  const sourceSeconds = decision.sourceTicks / PROJECT_TIMESCALE
  const shared = {
    assetId: decision.assetId,
    clipId: decision.clipId,
    sourceTicks: decision.sourceTicks,
    sourceSeconds,
    // Carried through untouched. A user who was watching should still be
    // watching after the file swaps; a user who had paused to look at a frame
    // should not have the video start playing at them.
    playbackIntent: input.playbackIntent,
    generation,
  }

  // Swapping the source inside the SAME recording would throw away everything
  // the browser had buffered and make the picture stutter at every cut, for no
  // reason at all: the file is already open and already decoded.
  return decision.assetId === input.loadedAssetId
    ? Object.freeze({ kind: 'seek-loaded-source' as const, ...shared })
    : Object.freeze({ kind: 'load-and-seek' as const, ...shared })
}

/**
 * Whether a completion that has just arrived belongs to the newest decision.
 *
 * Called when a file finishes loading or a seek settles. A false here means the
 * world moved on while that was in flight, and obeying it now would put footage
 * on screen that does not match where the playhead is.
 */
export const isCurrentGeneration = (
  action: PreviewSourceActionV1,
  currentGeneration: number,
): boolean => action.generation === currentGeneration

/**
 * Whether the user should be told the picture is on its way.
 *
 * Only while a genuinely different file is being opened. Showing "loading" for a
 * seek inside a file that is already open makes ordinary scrubbing flicker with
 * a message about nothing.
 */
export const previewIsLoading = (action: PreviewSourceActionV1): boolean =>
  action.kind === 'load-and-seek'

/** Whether this action means the screen should go black, and honestly so. */
export const previewIsGap = (action: PreviewSourceActionV1): boolean =>
  action.kind === 'show-gap'
