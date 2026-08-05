import {
  activeTrackOutputs,
  effectiveComposition,
  type EditProject,
} from '@sanverse/edit-domain'
import { findAsset } from '@sanverse/edit-domain/assets'

/**
 * WHICH PIECE OF FOOTAGE IS UNDER THE PLAYHEAD, AND IF NONE, WHY NOT.
 *
 * ## The defect this exists to make impossible
 *
 * The owner recorded the monitor saying **"No media at this time"** while the
 * timeline plainly showed footage under the playhead. Both monitor state
 * machines are innocent: each documents that `inCanonicalGap` is the only input
 * allowed to produce a gap. The lie was manufactured one step earlier.
 *
 * The screen decided "is this moment empty?" by asking the COMPILED RENDER PLAN:
 *
 * ```
 *   compilePreviewPlan(project)  ->  RenderPlan | null
 *                                            |
 *                     null on ANY refusal ---+
 *                                            |
 *   previewSegments = plan ? playbackSegments(plan) : []
 *                                            |
 *   sourceTimeFor([], anyTick) === null  ->  "this moment is a gap"
 * ```
 *
 * And the compiler refuses the WHOLE project if a SINGLE clip anywhere in it
 * cannot resolve its file:
 *
 * ```
 *   if (!useSource(clip.assetId)) {
 *     return { ok: false, error: { reason: 'A piece of footage is missing.' } }
 *   }
 * ```
 *
 * So one unresolvable clip — one file moved, one asset id that did not survive a
 * round trip — turned every other second of a healthy project into a claimed
 * gap. Thirty minutes of real footage reported as "no media", with no error
 * anywhere, because "the plan could not be built" and "the timeline is empty"
 * were being expressed by the same value: `null`.
 *
 * That is the single worst class of bug this product can have. A gap is a CLAIM
 * ABOUT THE USER'S EDIT — it says *you left this empty, and the exported file
 * will be black here too*. Saying that over footage that exists teaches the user
 * their own timeline is lying to them, and nothing they see afterwards can be
 * trusted.
 *
 * ## The rule that replaces it
 *
 * Whether footage exists at a moment is answered from the COMPOSITION — the
 * user's actual edit — and never from a compiled artefact that can fail as a
 * whole. A compile refusal is an ERROR and must be reported as one; it is not a
 * statement about any particular moment.
 *
 * This function reads exactly the same fields, from exactly the same source, in
 * exactly the same order as `compileProjectToRenderPlan` builds its segments, so
 * the two cannot form different opinions about WHERE the clips are. What it adds
 * is that one broken clip costs only its own interval.
 *
 * ## What is deliberately not an input
 *
 * The parameter list is the whole argument. There is no way to pass:
 *
 * ```
 *   selection          hover              focus
 *   Inspector draft    AI draft           toolbar state
 *   monitor Fit/Fill   canvas state       pointer position
 * ```
 *
 * **Selecting a clip cannot change whether footage exists.** That is not a
 * convention here, it is unexpressible: the resolver takes a project and a tick,
 * and there is no third argument to smuggle a pointer into.
 */

export const PRIMARY_GAP_REASONS = Object.freeze([
  /** Nothing is laid down here. Black is the correct output and the export agrees. */
  'NO_CLIP_AT_TICK',
  /** The whole picture track is switched off, so every clip on it is dark. */
  'V1_OUTPUT_DISABLED',
  /** This one piece was switched off, leaving its interval a deliberate hole. */
  'CLIP_DISABLED',
  /** A piece is here, but its file cannot be found. NOT the user's edit — a fault. */
  'ASSET_MISSING',
] as const)

export type PrimaryGapReason = (typeof PRIMARY_GAP_REASONS)[number]

export type PrimarySourceDecisionV1 =
  | Readonly<{
      kind: 'active'
      clipId: string
      assetId: string
      /** The moment asked about, in finished-video time. */
      compositionTicks: number
      /** The same moment expressed in the original recording's own time. */
      sourceTicks: number
      /** The same moment measured from this clip's own start. */
      localTicks: number
    }>
  | Readonly<{
      kind: 'gap'
      compositionTicks: number
      reason: PrimaryGapReason
    }>

/**
 * The one sentence the monitor may show for a gap.
 *
 * `NO_CLIP_AT_TICK` returns the plain gap wording because that black IS the
 * finished video. Every other reason is something the user can act on, so it
 * says what to act on — in ordinary words, never an operation name or a code.
 */
export const primaryGapMessage = (reason: PrimaryGapReason): string => {
  switch (reason) {
    case 'NO_CLIP_AT_TICK':
      return 'No media at this time'
    case 'V1_OUTPUT_DISABLED':
      return 'The video track is switched off'
    case 'CLIP_DISABLED':
      return 'This clip is switched off'
    case 'ASSET_MISSING':
      return 'This clip’s file is missing'
  }
}

/**
 * Whether the black the user is looking at is the video they are making, or a
 * problem wearing the same colour.
 *
 * Only `NO_CLIP_AT_TICK` is truly the edit. The other three are all states the
 * user did not intend to be looking at, and each has something to press.
 */
export const isIntendedBlack = (reason: PrimaryGapReason): boolean =>
  reason === 'NO_CLIP_AT_TICK'

/**
 * Resolve the primary picture source at one exact moment of the finished video.
 *
 * Order is the whole design, so it is spelled out rather than implied.
 *
 * 1. Find the clip whose half-open interval contains the tick. Half-open
 *    `[start, start + duration)` is the same rule the exporter's enable
 *    expression uses, so the frame at a cut belongs to exactly one side.
 * 2. No clip is `NO_CLIP_AT_TICK` and nothing further is looked at. There is
 *    nothing here to be switched off or missing.
 * 3. The picture track being off outranks the clip being off. Both make black,
 *    but turning this clip back on would still show nothing, so reporting the
 *    clip would send the user to fix the wrong switch. Always report the
 *    blocker that has to be removed FIRST.
 * 4. The clip being off comes next: a deliberate hole of exactly this clip's
 *    length, which is why switching it back on restores the same video.
 * 5. The file being unfindable is last, because it is the only one that is not
 *    the user's edit at all. Everything above it is something they chose.
 */
export const resolvePrimarySource = (
  project: EditProject,
  compositionTicks: number,
): PrimarySourceDecisionV1 => {
  const usable = Number.isFinite(compositionTicks)
  const ticks = usable ? Math.round(compositionTicks) : 0
  const gap = (reason: PrimaryGapReason): PrimarySourceDecisionV1 =>
    Object.freeze({ kind: 'gap' as const, compositionTicks: ticks, reason })

  // A tick that is not a number is a fault in the caller, not a moment. Rounding
  // it quietly to zero would hand back the first frame of the project and call
  // it the answer — a wrong picture presented as a right one, which is worse
  // than black. Nothing is claimed instead.
  if (!usable || ticks < 0) return gap('NO_CLIP_AT_TICK')

  const composition = effectiveComposition(project)

  // Every track, in the compiler's own order, because the compiler builds a
  // segment from every clip of every track without filtering by kind. Matching
  // it exactly is what stops the screen and the file disagreeing about where
  // the footage is.
  for (const track of composition.tracks) {
    for (const clip of track.clips) {
      const start = clip.compositionStart.ticks
      const end = start + clip.sourceRange.duration.ticks
      if (ticks < start || ticks >= end) continue

      const localTicks = ticks - start

      if (!activeTrackOutputs(project).V1) return gap('V1_OUTPUT_DISABLED')
      if (!clip.enabled) return gap('CLIP_DISABLED')
      if (!findAsset(project.assets, clip.assetId)) return gap('ASSET_MISSING')

      return Object.freeze({
        kind: 'active' as const,
        clipId: clip.clipId,
        assetId: clip.assetId,
        compositionTicks: ticks,
        sourceTicks: clip.sourceRange.start.ticks + localTicks,
        localTicks,
      })
    }
  }

  return gap('NO_CLIP_AT_TICK')
}

/**
 * The moment the monitor should jump to when the playhead lands in a hole, or
 * `null` when nothing comes after it.
 *
 * Read from the composition for the same reason the decision above is: a
 * project that cannot compile still has a perfectly well-defined next clip.
 */
export const nextPrimaryStartTicks = (
  project: EditProject,
  compositionTicks: number,
): number | null => {
  const composition = effectiveComposition(project)
  let best: number | null = null
  for (const track of composition.tracks) {
    for (const clip of track.clips) {
      const start = clip.compositionStart.ticks
      if (start >= compositionTicks && (best === null || start < best)) best = start
    }
  }
  return best
}
