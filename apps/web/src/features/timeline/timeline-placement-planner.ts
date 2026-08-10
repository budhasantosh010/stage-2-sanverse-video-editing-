import {
  OPERATION_SCHEMA_VERSION,
  PROJECT_TIMESCALE,
  applyTimelineOperation,
  activeTimelineTrackState,
  effectiveComposition,
  findAsset,
  isAudioAsset,
  isImageAsset,
  isVideoAsset,
  validateOperation,
  type EditOperation,
  type EditProject,
  type IdFactory,
  type MediaAsset,
  type TimelineTrackId,
} from '@sanverse/edit-domain'
import { PLACE_PRIMARY_CLIP_PRIMITIVE_ID, TIMELINE_TRACKS_PRIMITIVE_ID } from '@sanverse/edit-domain/capabilities'
import { resolveTimelineTrackReference, timelineTrackAssignmentKey, trackById, type TimelineTrackV2 } from '@sanverse/edit-domain/timeline-tracks'

import { buildAddAsBrollOperation, buildAddAsMusicOperation } from '../media/media-actions'
import { applyLaneEdits, type LaneEdit } from './timeline-item-operations'

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
export type { TimelineTrackId } from '@sanverse/edit-domain'

const LANE_TO_TRACK = Object.freeze({
  'lane:overlay': 'V2', 'lane:video': 'V1', 'lane:caption': 'C1',
  'lane:dialogue': 'A1', 'lane:music': 'A2',
} as const)

const TRACK_TO_LANE = Object.freeze({
  V2: 'lane:overlay', V1: 'lane:video', C1: 'lane:caption',
  A1: 'lane:dialogue', A2: 'lane:music',
} as const)

/**
 * Which track a lane belongs to.
 *
 * A project with more than one video track names its lanes
 * `lane:video:track_…`, so the lookup falls back to the lane's family rather
 * than returning nothing. A header with no track id would be a padlock and an
 * eye that silently did nothing.
 */
export const trackIdForLane = (laneId: string): TimelineTrackId => {
  const known = LANE_TO_TRACK[laneId as TimelineLaneId]
  if (known) return known
  const stable = laneId.match(/^lane:(?:track|video):(track_[a-z0-9]{8,64})$/)?.[1]
  if (stable) return stable as TimelineTrackId
  if (laneId.startsWith('lane:video')) return 'V1'
  if (laneId.startsWith('lane:dialogue')) return 'A1'
  if (laneId.startsWith('lane:music')) return 'A2'
  if (laneId.startsWith('lane:caption')) return 'C1'
  return 'V2'
}
export const laneIdForTrack = (trackId: TimelineTrackId): string =>
  TRACK_TO_LANE[trackId as keyof typeof TRACK_TO_LANE] ?? `lane:track:${trackId}`

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
  targetLaneId: string
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
  lockedTrackIds: readonly string[]
}>

/**
 * One thing already on the lane.
 *
 * `targetId` names it — `broll_…` or `music_…`. Without a name, Insert and
 * Overwrite cannot say WHICH clip they are pushing along or cutting into, so a
 * span with no name is treated as immovable and those modes refuse rather than
 * quietly leaving it where it was.
 */
export type OccupiedSpan = Readonly<{
  startTicks: number
  durationTicks: number
  targetId?: string
}>

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
    // Multi-asset Primary Sequence. The main track takes video and nothing
    // else: a picture has no sound and no length of its own, so a still on the
    // main sequence would be a silent gap the user did not ask for, and music
    // there has no picture at all.
    return isVideoAsset(asset) ? null : Object.freeze({
      code: 'TRACK_INCOMPATIBLE' as const,
      message: 'The main video track takes video. Drop a picture on the B-roll lane above, or music on the A2 lane.',
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

const compatibilityForTrack = (track: TimelineTrackV2, asset: MediaAsset): TimelinePlacementRefusal | null => {
  if (track.role === 'primary-video') {
    return isVideoAsset(asset) ? null : Object.freeze({
      code: 'TRACK_INCOMPATIBLE' as const,
      message: 'The primary track takes video. Put pictures on a video layer above it, or sound on an audio track.',
    })
  }
  if (track.kind === 'video') {
    return isVideoAsset(asset) || isImageAsset(asset) ? null : Object.freeze({
      code: 'TRACK_INCOMPATIBLE' as const,
      message: 'Video tracks above the primary take video and pictures. Put sound on an audio track.',
    })
  }
  if (track.kind === 'audio' && track.role !== 'dialogue') {
    return isAudioAsset(asset) ? null : Object.freeze({
      code: 'TRACK_INCOMPATIBLE' as const,
      message: 'Audio tracks take sound only. Put video and pictures on a video track.',
    })
  }
  if (track.role === 'dialogue') {
    return Object.freeze({
      code: 'OPERATION_UNSUPPORTED' as const,
      message: 'Dialogue is the linked sound of the primary video and cannot be replaced by a file drop.',
    })
  }
  return Object.freeze({
    code: 'TRACK_INCOMPATIBLE' as const,
    message: 'Caption tracks are written from words, not from a file drop.',
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
  // The main sequence takes video and nothing else: a picture has no sound and
  // no length of its own, and music has no picture.
  if (laneId === 'lane:video') return mediaKind === 'video'
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

/**
 * A piece of footage joining the MAIN sequence.
 *
 * Built here rather than in `media-actions`, and the difference is not
 * arbitrary: everything `media-actions` builds is ANCHORED to a moment of the
 * footage — B-roll sits on the bit where you held up the product, music sits
 * under the finished piece. A piece of the main sequence is anchored to
 * nothing. It IS the footage. It says which recording, which stretch of it, and
 * where it goes, and there is no third thing to be pinned to.
 *
 * See DOCS/decisions/ADR-MULTI-ASSET-PRIMARY-SEQUENCE-V1.md.
 */
const planPrimaryPlacement = (input: Readonly<{
  project: EditProject
  asset: MediaAsset
  atTicks: number
  durationTicks: number
  placementMode: PlacementMode
  idFactory: IdFactory
}>): PlacementResult => {
  const { project, asset, atTicks, durationTicks, placementMode, idFactory } = input

  // The main sequence is a video track that already exists. A project always
  // has one, because that is what importing a video creates.
  const track = project.composition.tracks.find((candidate) => candidate.kind === 'video')
  if (!track) {
    return refuse('OPERATION_UNSUPPORTED', 'This project has no main video track to add to.')
  }

  const operation = Object.freeze({
    schemaVersion: OPERATION_SCHEMA_VERSION,
    operationId: idFactory.operation(0),
    kind: 'place-primary-clip' as const,
    capabilityId: PLACE_PRIMARY_CLIP_PRIMITIVE_ID,
    clipId: idFactory.entity('clip', 0),
    trackId: track.trackId,
    assetId: asset.assetId,
    // The whole recording, from its beginning. Trimming it afterwards is one
    // gesture the user can see; guessing a shorter stretch at drop time would
    // silently discard footage they had not looked at yet.
    sourceRange: Object.freeze({
      start: Object.freeze({ ticks: 0, timescale: PROJECT_TIMESCALE }),
      duration: Object.freeze({ ticks: durationTicks, timescale: PROJECT_TIMESCALE }),
    }),
    compositionStart: Object.freeze({ ticks: atTicks, timescale: PROJECT_TIMESCALE }),
    extensions: Object.freeze({}),
  }) as unknown as EditOperation

  const validated = validateOperation(operation)
  if (!validated.ok) {
    return refuse('OPERATION_UNSUPPORTED', 'That footage cannot be added to the main video.')
  }
  // The dry run answers whether it actually fits: whether the stretch exists
  // inside that recording, and whether it would overlap what is already there.
  // Those rules live in the composition validator and are not copied here.
  const applied = applyTimelineOperation(
    effectiveComposition(project),
    validated.value as never,
    project.assets,
  )
  if (!applied.ok) {
    return refuse(
      'COLLISION',
      'Something is already on the main video track at that moment. Move it first, or drop this after it.',
    )
  }

  return Object.freeze({
    ok: true as const,
    value: Object.freeze({
      targetLaneId: 'lane:video' as const,
      placementMode,
      atTicks,
      durationTicks,
      operations: Object.freeze([validated.value]) as readonly EditOperation[],
      summary: 'Added footage to the main video',
    }),
  })
}

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

  // Closed contracts first. T5 dynamic lanes are accepted only when their
  // stable id resolves to one of the project's typed tracks; arbitrary strings
  // are still refused rather than guessed at.
  const timelineTracks = activeTimelineTrackState(project)
  const legacyLane = isLaneId(targetLaneId)
  const stableLane = /^lane:(?:track|video):track_[a-z0-9]{8,64}$/.test(targetLaneId)
  if (!legacyLane && !stableLane) {
    return refuse('TRACK_INCOMPATIBLE', 'That is not a track in this project.')
  }
  const targetStableId = resolveTimelineTrackReference(timelineTracks, trackIdForLane(targetLaneId))
  const targetTrack = targetStableId ? trackById(timelineTracks, targetStableId) : null
  if (targetTrack === null) {
    return refuse('TRACK_INCOMPATIBLE', 'That is not a track in this project.')
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
  const targetReference = trackIdForLane(targetLaneId)
  if (trackState?.lockedTrackIds.includes(targetReference) === true || (targetTrack && trackState?.lockedTrackIds.includes(targetTrack.trackId as TimelineTrackId) === true)) {
    return refuse('TRACK_LOCKED', `${legacyLane ? targetReference : 'That track'} is locked. Unlock it to make changes.`)
  }

  const asset = findAsset(project.assets, assetId)
  if (!asset) return refuse('ASSET_MISSING', 'That file is not in this project any more.')

  const incompatible = legacyLane
    ? compatibility(targetLaneId as TimelineLaneId, asset)
    : targetTrack
      ? compatibilityForTrack(targetTrack, asset)
      : Object.freeze({ code: 'TRACK_INCOMPATIBLE' as const, message: 'That is not a track in this project.' })
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

  if (includeLinkedAudio && targetTrack?.kind === 'video' && targetTrack.role !== 'primary-video' && isVideoAsset(asset) && asset.hasAudio) {
    // There is no operation that would place B-roll sound as its own item and
    // keep it tied to the picture. A copy that can drift apart is worse than
    // none, so this is refused truthfully rather than dropped in silence.
    return refuse('UNSUPPORTED_AUDIO_LINK', 'Sanverse cannot bring this clip’s own sound onto the timeline yet. Drop it without its sound, or add the sound as music.')
  }

  const resolved = resolvePlacement(placementMode, atTicks, durationTicks, occupancy)
  if (isRefusal(resolved)) return refuse(resolved.code, resolved.message)

  /**
   * What Insert and Overwrite have to do to the things already on this lane.
   *
   * Both are rearrangements, and both go in the SAME change set as the new
   * item, so the whole gesture is one Undo. If the rearrangement cannot be
   * expressed, nothing is placed at all — an "Insert" that quietly behaved like
   * "Normal" would lose the very thing it was supposed to push along, and the
   * user would not find out until export.
   */
  const laneEdits: LaneEdit[] = []

  if (resolved.shiftFromTicks !== null) {
    const from = resolved.shiftFromTicks
    for (const span of occupancy.spans) {
      if (span.startTicks + span.durationTicks <= from) continue
      if (span.startTicks < from) {
        // The insertion point falls INSIDE this clip. Pushing it along whole
        // would move its first half too, which is not what "insert here" means.
        return refuse(
          'COLLISION',
          'Insert would cut into the middle of a clip. Move the playhead to a gap or to the start of a clip.',
        )
      }
      if (!span.targetId) {
        return refuse('OPERATION_UNSUPPORTED', 'Something on this lane cannot be pushed along. Use Normal instead.')
      }
      laneEdits.push(Object.freeze({
        kind: 'move' as const,
        targetId: span.targetId,
        toStartTicks: span.startTicks + durationTicks,
      }))
    }
  }

  for (const span of resolved.replacedSpans) {
    if (!span.targetId) {
      return refuse('OPERATION_UNSUPPORTED', 'Something on this lane cannot be replaced. Remove it first, then place this.')
    }
    const spanEnd = span.startTicks + span.durationTicks
    const newEnd = resolved.atTicks + durationTicks
    const keepsLeft = span.startTicks < resolved.atTicks
    const keepsRight = spanEnd > newEnd
    if (keepsLeft && keepsRight) {
      laneEdits.push(Object.freeze({
        kind: 'fragment' as const,
        targetId: span.targetId,
        keepLeftEndTicks: resolved.atTicks,
        keepRightStartTicks: newEnd,
      }))
    } else if (keepsLeft) {
      laneEdits.push(Object.freeze({
        kind: 'trim' as const,
        targetId: span.targetId,
        toStartTicks: span.startTicks,
        toEndTicks: resolved.atTicks,
      }))
    } else if (keepsRight) {
      laneEdits.push(Object.freeze({
        kind: 'trim' as const,
        targetId: span.targetId,
        toStartTicks: newEnd,
        toEndTicks: spanEnd,
      }))
    } else {
      // Covered end to end. Nothing of it would ever be seen or heard again.
      laneEdits.push(Object.freeze({ kind: 'remove' as const, targetId: span.targetId }))
    }
  }

  // The main sequence is built here rather than in `media-actions`, because a
  // piece of the main video is not anchored to anything: it IS the footage. It
  // says which recording, which stretch of it, and where it goes.
  if (targetTrack?.role === 'primary-video') {
    return planPrimaryPlacement({
      project, asset, atTicks: resolved.atTicks, durationTicks: natural, placementMode, idFactory,
    })
  }

  // Construction is delegated: `media-actions` is the one authority on how a
  // placement is anchored, and it validates against the composition too.
  const built = targetTrack?.kind === 'audio'
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

  // The rearrangement is planned LAST, so that a placement that cannot happen
  // never produces operations that move other people's clips. Slot 0 is the new
  // item, so the rearrangement starts at slot 1 and the names never collide.
  let rearrangement: readonly EditOperation[] = Object.freeze([])
  if (laneEdits.length > 0) {
    const legacyEditTrack = targetTrack?.role === 'overlay-video'
      ? 'V2' as const
      : targetTrack?.role === 'music'
        ? 'A2' as const
        : null
    if (legacyEditTrack === null) {
      return refuse('OPERATION_UNSUPPORTED', 'Insert and Overwrite are not available on this added track yet. Use Normal or Append.')
    }
    const edited = applyLaneEdits({ project, trackId: legacyEditTrack, edits: laneEdits, ids: idFactory, slotOffset: 1 })
    if (!edited.ok) return refuse('OPERATION_UNSUPPORTED', edited.refusal.message)
    rearrangement = edited.operations
  }

  const builtIdentity = 'musicId' in built.operation
    ? built.operation.musicId
    : 'overlayId' in built.operation
      ? built.operation.overlayId
      : null
  if (targetTrack && builtIdentity === null) {
    return refuse('OPERATION_UNSUPPORTED', 'That placement cannot be assigned to a Timeline track.')
  }
  const assignment: readonly EditOperation[] = !legacyLane && targetTrack && builtIdentity !== null
    ? Object.freeze([Object.freeze({
        schemaVersion: OPERATION_SCHEMA_VERSION,
        operationId: idFactory.operation(1 + rearrangement.length),
        kind: 'assign-timeline-item-track' as const,
        capabilityId: TIMELINE_TRACKS_PRIMITIVE_ID,
        itemId: timelineTrackAssignmentKey(targetTrack.kind === 'audio' ? 'audio' : 'visual', builtIdentity),
        trackId: targetTrack.trackId,
        extensions: Object.freeze({}),
      }) as EditOperation])
    : Object.freeze([])

  const modeSummary = placementMode === 'insert'
    ? 'and pushed the rest along'
    : placementMode === 'overwrite'
      ? 'over what was there'
      : placementMode === 'append'
        ? 'at the end'
        : ''
  const what = targetTrack?.kind === 'audio'
    ? 'Added music'
    : isImageAsset(asset) ? 'Added a picture over your video' : 'Added B-roll over your video'

  return Object.freeze({
    ok: true as const,
    value: Object.freeze({
      targetLaneId,
      placementMode,
      atTicks: resolved.atTicks,
      durationTicks,
      operations: Object.freeze([built.operation, ...rearrangement, ...assignment]) as readonly EditOperation[],
      summary: modeSummary ? `${what} ${modeSummary}` : what,
    }),
  })
}
