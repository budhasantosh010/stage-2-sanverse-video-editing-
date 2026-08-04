import {
  PROJECT_TIMESCALE,
  findAsset,
  isAudioAsset,
  isImageAsset,
  isVideoAsset,
  type EditOperation,
  type EditProject,
  type IdFactory,
  type MediaAsset,
} from '@sanverse/edit-domain'

import { buildAddAsBrollOperation, buildAddAsMusicOperation } from '../media/media-actions'

/**
 * Where a drop is allowed to become an edit — and the ONLY place that decides.
 *
 * ## Why this is a plain function and not a drop handler
 *
 * "Put the logo over the intro" typed into the chat box and dragging the logo
 * onto the intro must produce the SAME operation. If the rules lived in a React
 * event handler, an AI request would need a second copy of them, and the two
 * would disagree the first time either was touched. So the rules live here:
 * no React, no fetch, no project mutation. Given the same project and the same
 * gesture it returns the same answer every time, which is also what makes it
 * testable without a browser.
 *
 * ## What this file owns, and what it deliberately does not
 *
 * It owns POLICY: which lane accepts what, whether the lane is locked, which
 * placement mode applies, whether something is already there, and the exact
 * sentence said when the answer is no.
 *
 * It does NOT build operations itself. `features/media/media-actions.ts`
 * already owns that, including the anchoring of B-roll to the original footage
 * (ADR-005) and of music to the finished video (ADR-007). A second builder here
 * would be a second set of rules about where things land, and the two would
 * drift. This calls the existing one.
 *
 * See DOCS/decisions/ADR-CREATOR-TIMELINE-PLACEMENT-V1.md.
 */

/** The five lanes, and nothing else. An unknown lane is a refusal. */
export const TIMELINE_LANE_IDS = Object.freeze([
  'lane:overlay',
  'lane:video',
  'lane:caption',
  'lane:dialogue',
  'lane:music',
] as const)
export type TimelineLaneId = (typeof TIMELINE_LANE_IDS)[number]

export const TIMELINE_TRACK_IDS = Object.freeze(['V2', 'V1', 'C1', 'A1', 'A2'] as const)
export type TimelineTrackId = (typeof TIMELINE_TRACK_IDS)[number]

const LANE_TO_TRACK = Object.freeze({
  'lane:overlay': 'V2', 'lane:video': 'V1', 'lane:caption': 'C1',
  'lane:dialogue': 'A1', 'lane:music': 'A2',
} as const)

const TRACK_TO_LANE = Object.freeze({
  V2: 'lane:overlay', V1: 'lane:video', C1: 'lane:caption',
  A1: 'lane:dialogue', A2: 'lane:music',
} as const)

export const trackIdForLane = (laneId: TimelineLaneId): TimelineTrackId => LANE_TO_TRACK[laneId]
export const laneIdForTrack = (trackId: TimelineTrackId): TimelineLaneId => TRACK_TO_LANE[trackId]

export const PLACEMENT_MODES = Object.freeze(['normal', 'insert', 'overwrite', 'append'] as const)
export type PlacementMode = (typeof PLACEMENT_MODES)[number]

/**
 * Every way a placement can be refused. Closed on purpose: an unrecognised code
 * is itself a bug, not something to shrug at and carry on from.
 */
export const PLACEMENT_REFUSAL_CODES = Object.freeze([
  'TRACK_LOCKED',
  'TRACK_INCOMPATIBLE',
  'ASSET_MISSING',
  'SOURCE_UNAVAILABLE',
  'COLLISION',
  'UNSUPPORTED_AUDIO_LINK',
  'OUT_OF_RANGE',
  'PROPOSAL_PENDING',
  'EXPORT_IN_PROGRESS',
  'PROJECT_STALE',
  'OPERATION_UNSUPPORTED',
] as const)
export type PlacementRefusalCode = (typeof PLACEMENT_REFUSAL_CODES)[number]

export type TimelinePlacementRefusal = Readonly<{
  code: PlacementRefusalCode
  /** One plain sentence. Says what cannot happen AND what can, where there is one. */
  message: string
}>

/**
 * A complete placement, ready to become exactly one change set.
 *
 * Every operation in it, or none — which Gate C0 made structurally true rather
 * than a thing this planner has to be careful about.
 */
export type AtomicTimelinePlan = Readonly<{
  targetLaneId: TimelineLaneId
  placementMode: PlacementMode
  /** Finished-video time where the thing lands, after snapping. */
  atTicks: number
  durationTicks: number
  operations: readonly EditOperation[]
  /** One short sentence for the history entry and the undo tooltip. */
  summary: string
}>

export type PlacementResult =
  | Readonly<{ ok: true; value: AtomicTimelinePlan }>
  | Readonly<{ ok: false; error: TimelinePlacementRefusal }>

/**
 * Lock is presentation state and must never move the revision; `outputEnabled`
 * belongs to the project and does. Only lock is read here, because output
 * changes what is exported and never whether an edit is allowed.
 */
export type TrackStateSnapshot = Readonly<{
  lockedTrackIds: readonly TimelineTrackId[]
}>

export type OccupiedSpan = Readonly<{ startTicks: number; durationTicks: number }>

/**
 * What already sits on the target lane, in finished-video time.
 *
 * Passed in rather than read from the project, because the projection that
 * knows where things are drawn is the view model, and depending on it here
 * would make this function untestable without a rendered timeline.
 */
export type LaneOccupancy = Readonly<{ spans: readonly OccupiedSpan[] }>

export type PlacementRequest = Readonly<{
  project: EditProject
  /** The asset being placed. Moving an item already on the timeline is a different request. */
  assetId: string
  targetLaneId: string
  /** Finished-video time the pointer was released at, before snapping. */
  atTicks: number
  placementMode: PlacementMode
  includeLinkedAudio: boolean
  /** Already-snapped tick, when the drag session computed one. */
  snappedTicks?: number | null
  trackState?: TrackStateSnapshot
  /** A pending suggestion blocks new manual edits: one draft at a time. */
  proposalPending?: boolean
  exportInProgress?: boolean
  /** The revision the gesture began on. A mismatch refuses rather than landing late. */
  expectedRevision?: number | null
  idFactory: IdFactory
}>

/** A picture has no length of its own, so it is given one. Four seconds reads. */
export const DEFAULT_IMAGE_DURATION_TICKS = 4 * PROJECT_TIMESCALE
/** Longer than this and one B-roll drop would bury the whole video. */
export const MAX_OVERLAY_DURATION_TICKS = 30 * PROJECT_TIMESCALE
export const MIN_PLACEMENT_TICKS = PROJECT_TIMESCALE

const refuse = (code: PlacementRefusalCode, message: string): PlacementResult =>
  Object.freeze({ ok: false as const, error: Object.freeze({ code, message }) })

const isLaneId = (value: unknown): value is TimelineLaneId =>
  TIMELINE_LANE_IDS.includes(value as TimelineLaneId)

/**
 * What each lane will accept today, and the sentence it says when it will not.
 *
 * V1 is the one that hurts. There is no `append-clip` operation and V1 holds
 * exactly one asset — every clip on it is a piece of the same file — so a
 * second video dropped there has no operation to become. It is refused rather
 * than quietly routed to V2, because a product that puts your video somewhere
 * other than where you dropped it has told you a lie you cannot recover from.
 * Multi-asset V1 is its own gate.
 */
const compatibility = (laneId: TimelineLaneId, asset: MediaAsset): TimelinePlacementRefusal | null => {
  if (laneId === 'lane:overlay') {
    return isVideoAsset(asset) || isImageAsset(asset) ? null : Object.freeze({
      code: 'TRACK_INCOMPATIBLE' as const,
      message: 'The B-roll lane takes video and pictures. Drop music on the A2 lane instead.',
    })
  }
  if (laneId === 'lane:music') {
    return isAudioAsset(asset) ? null : Object.freeze({
      code: 'TRACK_INCOMPATIBLE' as const,
      message: 'The music lane takes sound only. Drop video and pictures on the B-roll lane instead.',
    })
  }
  if (laneId === 'lane:video') {
    return Object.freeze({
      code: 'OPERATION_UNSUPPORTED' as const,
      message: 'Sanverse cannot add a second video to the main sequence yet. Drop it on the B-roll lane above, or wait for Multi-asset Primary Sequence.',
    })
  }
  if (laneId === 'lane:dialogue') {
    return Object.freeze({
      code: 'OPERATION_UNSUPPORTED' as const,
      message: 'The dialogue lane is the sound of your main video. It cannot be replaced yet.',
    })
  }
  return Object.freeze({
    code: 'TRACK_INCOMPATIBLE' as const,
    message: 'The captions lane is written from your words, not from a file. Add captions from the Captions panel.',
  })
}

/**
 * Would this lane accept this KIND of file? Asked while the drag is still in
 * the air, to decide whether the lane highlights.
 *
 * Deliberately derived from the same table `compatibility` uses, so the colour
 * under the pointer and the answer on release cannot disagree. A lane that
 * lights up and then refuses is the product changing its mind after the user
 * has committed to the gesture.
 *
 * It answers about the KIND only. A specific file can still be refused on
 * release for a reason no highlight could know — a locked lane, a running
 * export, something already in that spot.
 */
export const acceptsMediaKind = (laneId: string, mediaKind: 'video' | 'image' | 'audio'): boolean => {
  if (!isLaneId(laneId)) return false
  if (laneId === 'lane:overlay') return mediaKind === 'video' || mediaKind === 'image'
  if (laneId === 'lane:music') return mediaKind === 'audio'
  return false
}

/** How long the placed thing is, before any lane rule trims it. */
const naturalDurationTicks = (asset: MediaAsset): number =>
  isImageAsset(asset) ? DEFAULT_IMAGE_DURATION_TICKS : (asset.duration?.ticks ?? 0)

/** Half-open [start, start + duration). Touching edges do not overlap. */
const overlaps = (aStart: number, aDuration: number, bStart: number, bDuration: number): boolean =>
  aStart < bStart + bDuration && bStart < aStart + aDuration

const laneEndTicks = (occupancy: LaneOccupancy): number =>
  occupancy.spans.reduce((end, span) => Math.max(end, span.startTicks + span.durationTicks), 0)

type Resolved = Readonly<{
  atTicks: number
  /** Insert only: everything at or after this tick moves later by the new length. */
  shiftFromTicks: number | null
  /** Overwrite only: the spans this placement replaces. */
  replacedSpans: readonly OccupiedSpan[]
}>

/**
 * Decide where the thing lands and whether the lane will have it.
 *
 * `normal` refuses a collision rather than nudging. A clip that silently moved
 * to somewhere you did not drop it is the most confusing thing an editor can
 * do, because you only find out at export.
 */
const resolvePlacement = (
  mode: PlacementMode,
  atTicks: number,
  durationTicks: number,
  occupancy: LaneOccupancy,
): Resolved | TimelinePlacementRefusal => {
  if (mode === 'append') {
    return Object.freeze({ atTicks: laneEndTicks(occupancy), shiftFromTicks: null, replacedSpans: Object.freeze([]) })
  }
  if (mode === 'insert') {
    return Object.freeze({ atTicks, shiftFromTicks: atTicks, replacedSpans: Object.freeze([]) })
  }
  const covered = occupancy.spans.filter((span) =>
    overlaps(atTicks, durationTicks, span.startTicks, span.durationTicks))
  if (mode === 'overwrite') {
    return Object.freeze({ atTicks, shiftFromTicks: null, replacedSpans: Object.freeze(covered) })
  }
  if (covered.length > 0) {
    return Object.freeze({
      code: 'COLLISION' as const,
      message: 'Something is already there. Move it first, or switch to Insert to push it along.',
    })
  }
  return Object.freeze({ atTicks, shiftFromTicks: null, replacedSpans: Object.freeze([]) })
}

const isRefusal = (value: Resolved | TimelinePlacementRefusal): value is TimelinePlacementRefusal =>
  'code' in value

const TICKS_PER_MS = PROJECT_TIMESCALE / 1000

/**
 * Plan one placement.
 *
 * @param occupancy what is already on the target lane. An empty lane is `{ spans: [] }`.
 */
export const planTimelinePlacement = (
  request: PlacementRequest,
  occupancy: LaneOccupancy = { spans: [] },
): PlacementResult => {
  const {
    project, assetId, targetLaneId, placementMode, includeLinkedAudio,
    trackState, proposalPending, exportInProgress, expectedRevision, idFactory,
  } = request

  // Closed contracts first. An unknown lane or mode is refused, never guessed at.
  if (!isLaneId(targetLaneId)) {
    return refuse('TRACK_INCOMPATIBLE', 'That is not a lane this editor has.')
  }
  if (!PLACEMENT_MODES.includes(placementMode)) {
    return refuse('OPERATION_UNSUPPORTED', 'That placement mode does not exist.')
  }

  // Conditions that make ANY edit wrong right now, before looking at the asset.
  if (exportInProgress === true) {
    return refuse('EXPORT_IN_PROGRESS', 'Your video is being exported. Editing will be ready when it finishes.')
  }
  if (proposalPending === true) {
    return refuse('PROPOSAL_PENDING', 'There is a suggestion waiting for you. Accept or dismiss it first.')
  }
  if (expectedRevision != null && expectedRevision !== project.revision) {
    return refuse('PROJECT_STALE', 'The project changed while you were dragging. Try that again.')
  }
  if (trackState?.lockedTrackIds.includes(trackIdForLane(targetLaneId)) === true) {
    return refuse('TRACK_LOCKED', `The ${trackIdForLane(targetLaneId)} lane is locked. Unlock it to make changes.`)
  }

  const asset = findAsset(project.assets, assetId)
  if (!asset) return refuse('ASSET_MISSING', 'That file is not in this project any more.')

  const incompatible = compatibility(targetLaneId, asset)
  if (incompatible) return refuse(incompatible.code, incompatible.message)

  const natural = naturalDurationTicks(asset)
  if (natural < MIN_PLACEMENT_TICKS) {
    return refuse('SOURCE_UNAVAILABLE', 'That file is too short to place, or its length is not known yet.')
  }
  const durationTicks = Math.min(natural, MAX_OVERLAY_DURATION_TICKS)

  const atTicks = request.snappedTicks ?? request.atTicks
  if (!Number.isSafeInteger(atTicks) || atTicks < 0) {
    return refuse('OUT_OF_RANGE', 'That is not a place on the timeline.')
  }

  if (includeLinkedAudio && targetLaneId === 'lane:overlay' && isVideoAsset(asset) && asset.hasAudio) {
    // There is no operation that would place B-roll sound as its own item and
    // keep it tied to the picture. A copy that can drift apart is worse than
    // none, so this is refused truthfully rather than dropped in silence.
    return refuse('UNSUPPORTED_AUDIO_LINK', 'Sanverse cannot bring this clip’s own sound onto the timeline yet. Drop it without its sound, or add the sound as music.')
  }

  const resolved = resolvePlacement(placementMode, atTicks, durationTicks, occupancy)
  if (isRefusal(resolved)) return refuse(resolved.code, resolved.message)

  // Insert and overwrite need operations this model does not have: nothing can
  // move or shorten an existing overlay as part of another placement. Refused
  // rather than approximated, because "Insert" that quietly behaved like
  // "Normal" would lose the thing it was supposed to push along.
  if (resolved.shiftFromTicks !== null && occupancy.spans.some((span) =>
    span.startTicks + span.durationTicks > resolved.shiftFromTicks!)) {
    return refuse('OPERATION_UNSUPPORTED', 'Insert cannot push these along yet. Use Normal and place it where there is room.')
  }
  if (resolved.replacedSpans.length > 0) {
    return refuse('OPERATION_UNSUPPORTED', 'Overwrite cannot replace what is already there yet. Remove it first, then place this.')
  }

  // Construction is delegated: `media-actions` is the one authority on how a
  // placement is anchored, and it validates against the composition too.
  const built = targetLaneId === 'lane:music'
    ? buildAddAsMusicOperation({
        project,
        expectedRevision: project.revision,
        asset,
        playheadMs: resolved.atTicks / TICKS_PER_MS,
        ids: { operationId: idFactory.operation(0), musicId: idFactory.entity('music', 0) },
      })
    : buildAddAsBrollOperation({
        project,
        expectedRevision: project.revision,
        asset,
        playheadMs: resolved.atTicks / TICKS_PER_MS,
        durationSeconds: durationTicks / PROJECT_TIMESCALE,
        ids: { operationId: idFactory.operation(0), overlayId: idFactory.entity('broll', 0) },
      })

  if (!built.ok) {
    // The builder rejected the anchor: usually a drop past the end of the
    // footage, or onto a stretch the user emptied.
    return refuse('SOURCE_UNAVAILABLE', built.message)
  }

  return Object.freeze({
    ok: true as const,
    value: Object.freeze({
      targetLaneId,
      placementMode,
      atTicks: resolved.atTicks,
      durationTicks,
      operations: Object.freeze([built.operation]) as readonly EditOperation[],
      summary: targetLaneId === 'lane:music'
        ? 'Added music'
        : isImageAsset(asset) ? 'Added a picture over your video' : 'Added B-roll over your video',
    }),
  })
}
