import {
  compositionDuration,
  evaluateProject,
  findAsset,
  foldCaptionOperations,
  foldOverlayOperations,
  isCaptionOperation,
  isNameplateOperation,
  isOverlayFamilyOperation,
  placeSourceSpan,
  validateOperation,
  type ChangeSetRecord,
  type EditOperation,
  type ResolvedOverlayOperation,
  type SourceSpanPlacement,
  type TimeRange,
  type Track,
} from '@sanverse/edit-domain'
import {
  dialogueTimelineTrack,
  resolvedTrackForTimelineItem,
  timelineTrackAssignmentKey,
  trackDisplayLabel,
  tracksOfKind,
  type TimelineTrackV2,
} from '@sanverse/edit-domain/timeline-tracks'
import {
  clipCompositionDurationTicks,
  isFreezeClip,
  linkedAudioCompositionDurationTicks,
  linkedAudioCompositionStartTicks,
  linkedAudioSourceRange,
} from '@sanverse/edit-domain/composition'
import {
  formatPlaybackRate,
  isDefaultClipTimeTransform,
  isNormalPlaybackRate,
  type ClipTimeTransformV1,
} from '@sanverse/edit-domain/clip-time'

import { describeOperation } from '../history/describe-operation'
import type {
  BuildTimelineViewModelInput,
  PendingTimelineInput,
  TimelineDiagnostic,
  TimelineDiagnosticCode,
  TimelineItemKind,
  TimelineItemView,
  TimelineLaneKind,
  TimelineLaneView,
  TimelineViewModel,
} from './timeline-contract'

/**
 * Why one earlier edit is not part of the video any more, in plain words.
 *
 * The three reasons the domain can give are all situations the user caused and
 * can undo, so each one names what happened rather than what the code called it.
 * An unknown reason still gets a true sentence rather than a code, because a
 * code on screen is never the right answer even when we are surprised.
 */
const blockedEditReason = (reason: string | null): string => {
  switch (reason) {
    case 'SOURCE_SPAN_REMOVED':
      return 'the part of the video it was on has been cut out, so it is not shown.'
    case 'VISUAL_TARGET_UNKNOWN':
      return 'the thing it was changing is no longer here, so it is not shown.'
    case 'FOOTAGE_MOTION_OVERLAP':
      return 'a later change to the same stretch replaced it, so it is not shown.'
    default:
      return 'it no longer fits the video, so it is not shown.'
  }
}

type OperationTrace = Readonly<{
  operationId: string
  changeSetId: string
  order: number
}>

type OrderedDiagnostic = TimelineDiagnostic & Readonly<{ order: number }>

type LaneDraft = {
  id: string
  trackId: string
  trackKind: TimelineLaneView['trackKind']
  trackRole: TimelineLaneView['trackRole']
  trackName: string | null
  syncLockEnabled: boolean
  outputEnabled: boolean
  audioState: TimelineTrackV2['audioState']
  kind: TimelineLaneKind
  label: string
  order: number
  items: TimelineItemView[]
}

const ITEM_KIND_ORDER: Readonly<Record<TimelineItemKind, number>> = Object.freeze({
  gap: 0,
  clip: 1,
  caption: 2,
  nameplate: 3,
  title: 4,
  callout: 5,
  'media-overlay': 6,
  music: 7,
})

const compareItems = (left: TimelineItemView, right: TimelineItemView): number =>
  left.startTicks - right.startTicks ||
  left.durationTicks - right.durationTicks ||
  ITEM_KIND_ORDER[left.kind] - ITEM_KIND_ORDER[right.kind] ||
  left.id.localeCompare(right.id)

const previewText = (value: string, fallback: string): string => {
  const normalized = value.replace(/\s+/g, ' ').trim()
  if (!normalized) return fallback
  return normalized.length <= 48 ? normalized : `${normalized.slice(0, 47)}…`
}

type TimelineItemInput =
  Omit<TimelineItemView, 'selected' | 'captionSetId' | 'cueId' | 'visualId' | 'pan' | 'speedBadge' | 'trackId'> &
  Partial<Pick<TimelineItemView, 'captionSetId' | 'cueId' | 'visualId' | 'pan' | 'speedBadge' | 'trackId'>>

const makeItem = (input: TimelineItemInput, selectedItemIds: ReadonlySet<string>): TimelineItemView =>
  Object.freeze({
    captionSetId: null,
    cueId: null,
    visualId: null,
    trackId: input.trackId ?? '',
    ...input,
    // Nothing has a badge or a left/right position unless it says so. Written
    // AFTER the spread with an explicit fallback, so a row that does say so
    // still wins and a row that says nothing gets null rather than undefined.
    pan: input.pan ?? null,
    speedBadge: input.speedBadge ?? null,
    selected: selectedItemIds.has(input.id),
  })

/**
 * The words that go on the small badge over a retimed piece.
 *
 * Written the way a person would say it out loud, shortest first, because the
 * badge sits on top of the filmstrip and every extra character hides a frame:
 *
 *   2x                  sped up
 *   0.5x                slowed down
 *   Backwards           reversed at normal speed
 *   2x Backwards        both
 *   2x Pitch off        sped up with the chipmunk effect deliberately left on
 *
 * Null for a piece nobody has retimed, so nothing is drawn at all.
 */
export const speedBadgeFor = (transform: ClipTimeTransformV1): string | null => {
  if (isDefaultClipTimeTransform(transform)) return null
  const parts: string[] = []
  if (!isNormalPlaybackRate(transform.playbackRate)) parts.push(formatPlaybackRate(transform.playbackRate))
  if (transform.direction === 'reverse') parts.push('Backwards')
  if (!transform.maintainAudioPitch) parts.push('Pitch off')
  return parts.length === 0 ? null : parts.join(' ')
}

const operationTraceMap = (
  records: readonly ChangeSetRecord[],
): ReadonlyMap<string, OperationTrace> => {
  const traces = new Map<string, OperationTrace>()
  records.forEach((record, recordIndex) => {
    if (!record.active || record.blockedReason !== null) return
    record.changeSet.operations.forEach((operation, operationIndex) => {
      traces.set(operation.operationId, Object.freeze({
        operationId: operation.operationId,
        changeSetId: record.changeSet.changeSetId,
        order: recordIndex * 100 + operationIndex,
      }))
    })
  })
  return traces
}

const captionTraceMaps = (
  records: readonly ChangeSetRecord[],
): Readonly<{
  set: ReadonlyMap<string, OperationTrace>
  cue: ReadonlyMap<string, OperationTrace>
}> => {
  const set = new Map<string, OperationTrace>()
  const cue = new Map<string, OperationTrace>()

  records.forEach((record, recordIndex) => {
    if (!record.active || record.blockedReason !== null) return
    record.changeSet.operations.forEach((operation, operationIndex) => {
      const trace = Object.freeze({
        operationId: operation.operationId,
        changeSetId: record.changeSet.changeSetId,
        order: recordIndex * 100 + operationIndex,
      })
      if (operation.kind === 'add-captions') {
        set.set(operation.captionSetId, trace)
        operation.cues.forEach((item) => cue.set(`${operation.captionSetId}:${item.cueId}`, trace))
      } else if (operation.kind === 'set-caption-cue') {
        cue.set(`${operation.captionSetId}:${operation.cueId}`, trace)
      } else if (operation.kind === 'remove-caption-cue') {
        cue.delete(`${operation.captionSetId}:${operation.cueId}`)
      }
    })
  })

  return Object.freeze({ set, cue })
}

const videoTracks = (tracks: readonly Track[]): readonly Track[] =>
  Object.freeze(
    tracks
      .filter((track) => track.kind === 'video')
      .slice()
      .sort((left, right) => left.order - right.order || left.trackId.localeCompare(right.trackId)),
  )

/**
 * Validate presentation invariants without consulting or changing the project.
 * Ordinary invalid presentation data is returned as structured diagnostics;
 * callers do not need exception handling for a bad item.
 */
export const validateTimelineViewModel = (
  model: TimelineViewModel,
): readonly TimelineDiagnostic[] => {
  const diagnostics: TimelineDiagnostic[] = []
  const laneIds = new Set<string>()
  const itemIds = new Set<string>()

  for (const lane of model.lanes) {
    if (laneIds.has(lane.id)) {
      diagnostics.push(Object.freeze({
        code: 'DUPLICATE_PRESENTATION_ID',
        message: `Timeline lane ${lane.id} appears more than once.`,
        operationId: null,
        changeSetId: null,
      }))
    }
    laneIds.add(lane.id)

    for (const item of lane.items) {
      if (itemIds.has(item.id)) {
        diagnostics.push(Object.freeze({
          code: 'DUPLICATE_PRESENTATION_ID',
          message: `Timeline item ${item.id} appears more than once.`,
          operationId: item.operationId,
          changeSetId: item.changeSetId,
        }))
      }
      itemIds.add(item.id)
      if (item.laneId !== lane.id) {
        diagnostics.push(Object.freeze({
          code: 'DUPLICATE_PRESENTATION_ID',
          message: `Timeline item ${item.id} points at the wrong lane.`,
          operationId: item.operationId,
          changeSetId: item.changeSetId,
        }))
      }
      if (!Number.isSafeInteger(item.durationTicks) || item.durationTicks <= 0) {
        diagnostics.push(Object.freeze({
          code: 'ITEM_DURATION_INVALID',
          message: `Timeline item ${item.id} has no positive whole-tick duration.`,
          operationId: item.operationId,
          changeSetId: item.changeSetId,
        }))
      }
      const endTicks = item.startTicks + item.durationTicks
      if (
        !Number.isSafeInteger(item.startTicks) ||
        item.startTicks < 0 ||
        !Number.isSafeInteger(endTicks) ||
        endTicks > model.durationTicks
      ) {
        diagnostics.push(Object.freeze({
          code: 'ITEM_OUTSIDE_COMPOSITION',
          message: `Timeline item ${item.id} falls outside the finished video.`,
          operationId: item.operationId,
          changeSetId: item.changeSetId,
        }))
      }
    }
  }

  return Object.freeze(diagnostics)
}

/**
 * Build the read-only timeline projection P1-B will render.
 *
 * This function never replays edits itself. It asks the domain for the
 * effective composition, folded captions, folded overlays, and evaluated
 * blocked records, then assembles those authoritative answers into semantic
 * lanes. The returned object is presentation data only and is never persisted.
 */
export const buildTimelineViewModel = (
  input: BuildTimelineViewModelInput,
): TimelineViewModel => {
  const { project, pending } = input
  // One set, built once, so every item asks the same question the same way.
  const selectedItemIds: ReadonlySet<string> = new Set(input.selectedItemIds)
  const displayAsset = (assetId: string, fallback: string): string => {
    const supplied = input.assetLabels?.[assetId]?.trim()
    return supplied || fallback
  }
  // The domain replay is intentionally performed once. Everything below reads
  // the same evaluated composition and records, so a future timeline render
  // cannot spend several full history replays or observe two derived answers.
  const evaluation = evaluateProject(project)
  const composition = evaluation.composition
  const trackState = evaluation.trackState
  const durationTicks = compositionDuration(composition).ticks
  const active = Object.freeze(
    evaluation.records
      .filter((record) => record.active && record.blockedReason === null)
      .flatMap((record) => record.changeSet.operations),
  )
  const traces = operationTraceMap(evaluation.records)
  const captionTraces = captionTraceMaps(evaluation.records)
  const laneDrafts = new Map<string, LaneDraft>()
  const itemIds = new Set<string>()
  const diagnostics: OrderedDiagnostic[] = []
  let diagnosticOrder = 1_000_000

  const addDiagnostic = (
    code: TimelineDiagnosticCode,
    message: string,
    operationId: string | null,
    changeSetId: string | null,
    order = diagnosticOrder++,
  ): void => {
    diagnostics.push(Object.freeze({ code, message, operationId, changeSetId, order }))
  }

  const registerLane = (lane: Omit<LaneDraft, 'items'>): LaneDraft => {
    const existing = laneDrafts.get(lane.id)
    if (existing) {
      addDiagnostic(
        'DUPLICATE_PRESENTATION_ID',
        `Timeline lane ${lane.id} appears more than once.`,
        null,
        null,
      )
      return existing
    }
    const draft: LaneDraft = { ...lane, items: [] }
    laneDrafts.set(lane.id, draft)
    return draft
  }

  const addItem = (lane: LaneDraft, item: TimelineItemView): void => {
    const normalizedItem = item.trackId === lane.trackId
      ? item
      : Object.freeze({ ...item, trackId: lane.trackId })
    if (itemIds.has(normalizedItem.id)) {
      addDiagnostic(
        'DUPLICATE_PRESENTATION_ID',
        `Timeline item ${normalizedItem.id} appears more than once.`,
        normalizedItem.operationId,
        normalizedItem.changeSetId,
      )
      return
    }
    if (!Number.isSafeInteger(normalizedItem.durationTicks) || normalizedItem.durationTicks <= 0) {
      addDiagnostic(
        'ITEM_DURATION_INVALID',
        `Timeline item ${normalizedItem.id} has no positive whole-tick duration.`,
        normalizedItem.operationId,
        normalizedItem.changeSetId,
      )
      return
    }
    const endTicks = normalizedItem.startTicks + normalizedItem.durationTicks
    if (
      !Number.isSafeInteger(normalizedItem.startTicks) ||
      normalizedItem.startTicks < 0 ||
      !Number.isSafeInteger(endTicks) ||
      endTicks > durationTicks
    ) {
      addDiagnostic(
        'ITEM_OUTSIDE_COMPOSITION',
        `Timeline item ${normalizedItem.id} falls outside the finished video.`,
        normalizedItem.operationId,
        normalizedItem.changeSetId,
      )
      return
    }
    itemIds.add(normalizedItem.id)
    lane.items.push(normalizedItem)
  }

  const canonicalVideoTracks = videoTracks(composition.tracks)
  const compositionTrackIds = new Set(canonicalVideoTracks.map((track) => track.trackId))
  const videoModels = [...tracksOfKind(trackState, 'video')]
  const captionModels = [...tracksOfKind(trackState, 'caption')]
  const audioModels = [...tracksOfKind(trackState, 'audio')]
  // Canonical video state is bottom-to-top. The editor lists the highest layer first.
  const orderedTrackModels = [...videoModels].reverse().concat(captionModels, audioModels)
  const laneByTrackId = new Map<string, LaneDraft>()

  const legacyLaneId = (track: TimelineTrackV2): string | null => {
    if (track.role === 'primary-video') return 'lane:video'
    if (track.role === 'overlay-video') return 'lane:overlay'
    if (track.role === 'dialogue') return 'lane:dialogue'
    if (track.role === 'music') return 'lane:music'
    if (track.role === 'captions' && captionModels[0]?.trackId === track.trackId) return 'lane:caption'
    if (compositionTrackIds.has(track.trackId)) return `lane:video:${track.trackId}`
    return null
  }
  const laneKindFor = (track: TimelineTrackV2): TimelineLaneKind => {
    if (track.kind === 'caption') return 'caption'
    if (track.kind === 'audio') return track.role === 'dialogue' ? 'dialogue' : 'music'
    return track.role === 'primary-video' || compositionTrackIds.has(track.trackId) ? 'video' : 'overlay'
  }
  orderedTrackModels.forEach((track, order) => {
    const lane = registerLane({
      id: legacyLaneId(track) ?? `lane:track:${track.trackId}`,
      trackId: track.trackId,
      trackKind: track.kind,
      trackRole: track.role,
      trackName: track.name,
      syncLockEnabled: track.syncLockEnabled,
      outputEnabled: track.outputEnabled,
      audioState: track.audioState,
      kind: laneKindFor(track),
      label: trackDisplayLabel(trackState, track.trackId) ?? 'Track',
      order,
    })
    laneByTrackId.set(track.trackId, lane)
  })

  const dialogueModel = dialogueTimelineTrack(trackState)
  const overlayModel = trackState.tracks.find((track) => track.role === 'overlay-video') ?? null
  const captionModel = captionModels[0] ?? null
  const musicModel = trackState.tracks.find((track) => track.role === 'music') ?? audioModels.find((track) => track.role !== 'dialogue') ?? null
  const defaultOverlayLane = overlayModel ? laneByTrackId.get(overlayModel.trackId) ?? null : null
  const defaultCaptionLane = captionModel ? laneByTrackId.get(captionModel.trackId) ?? null : null
  const defaultMusicLane = musicModel ? laneByTrackId.get(musicModel.trackId) ?? null : null
  const dialogueLane = dialogueModel ? laneByTrackId.get(dialogueModel.trackId) ?? null : null

  const assignedLane = (
    family: 'visual' | 'caption' | 'audio',
    identity: string,
    fallback: LaneDraft | null,
  ): LaneDraft | null => {
    const key = timelineTrackAssignmentKey(family, identity)
    const resolved = resolvedTrackForTimelineItem(trackState, key, family)
    return resolved ? laneByTrackId.get(resolved.trackId) ?? fallback : fallback
  }

  canonicalVideoTracks.forEach((track) => {
    const videoLane = laneByTrackId.get(track.trackId)
    if (!videoLane) return
    const orderedClips = track.clips
      .slice()
      .sort((left, right) =>
        left.compositionStart.ticks - right.compositionStart.ticks ||
        left.sourceRange.duration.ticks - right.sourceRange.duration.ticks ||
        left.clipId.localeCompare(right.clipId),
      )

    orderedClips.forEach((clip, clipIndex) => {
      const videoId = `clip:${clip.clipId}`
      const label = displayAsset(
        clip.assetId,
        orderedClips.length === 1 ? 'Video' : `Video ${clipIndex + 1}`,
      )
      const clipSourceStart = clip.sourceRange.start.ticks
      const clipSourceEnd = clipSourceStart + clip.sourceRange.duration.ticks
      const clipMotions = evaluation.footageMotions.filter((motion) =>
        motion.assetId === clip.assetId &&
        motion.sourceInterval.start.ticks < clipSourceEnd &&
        motion.sourceInterval.start.ticks + motion.sourceInterval.duration.ticks > clipSourceStart,
      )
      const motionKeyframes = clipMotions.reduce(
        (count, motion) => count + motion.tracks.reduce((trackCount, track) => trackCount + track.keyframes.length, 0),
        0,
      )
      const motionDetail = clipMotions.length === 0
        ? null
        : motionKeyframes > 0
          ? `Motion · ${motionKeyframes} ${motionKeyframes === 1 ? 'keyframe' : 'keyframes'}`
          : `Motion · ${Math.round(clipMotions[0].transform.scale * 100)}% framing`
      addItem(videoLane, makeItem({
        id: videoId,
        laneId: videoLane.id,
        kind: 'clip',
        state: 'committed',
        label,
        detail: motionDetail,
        startTicks: clip.compositionStart.ticks,
        // How long the piece lasts ON SCREEN. Until speed existed that was the
        // same number as how much recording it uses, and this row simply used
        // the recording amount. A 2x piece is half as wide on the timeline.
        durationTicks: clipCompositionDurationTicks(clip),
        enabled: clip.enabled,
        blockedReason: null,
        clipId: clip.clipId,
        linkedClipId: null,
        assetId: clip.assetId,
        operationId: null,
        changeSetId: null,
        sourceStartTicks: clip.sourceRange.start.ticks,
        sourceDurationTicks: clip.sourceRange.duration.ticks,
        gainDb: clip.gainDb,
        fadeInTicks: clip.fadeIn.ticks,
        fadeOutTicks: clip.fadeOut.ticks,
        pan: clip.pan,
        speedBadge: speedBadgeFor(clip.timeTransform),
        proposalId: null,
        proposalBaseRevision: null,
      }, selectedItemIds))

      const freeze = isFreezeClip(clip)
      const audioSource = linkedAudioSourceRange(clip)
      const pictureEnd = clip.compositionStart.ticks + clipCompositionDurationTicks(clip)
      const audioStart = linkedAudioCompositionStartTicks(clip)
      const audioDuration = linkedAudioCompositionDurationTicks(clip)
      const audioEnd = audioStart + audioDuration
      const audioDetail = freeze
        ? 'Silent hold'
        : clip.linkedAudio === null
          ? null
          : audioStart < clip.compositionStart.ticks
            ? `J-cut · starts ${Math.round((clip.compositionStart.ticks - audioStart) / 1_440)} ms early`
            : audioEnd > pictureEnd
              ? `L-cut · ends ${Math.round((audioEnd - pictureEnd) / 1_440)} ms late`
              : 'Linked audio adjusted'
      if (dialogueLane) {
        addItem(dialogueLane, makeItem({
          id: `dialogue:${clip.clipId}`,
          laneId: dialogueLane.id,
          kind: 'clip',
          state: 'committed',
          label: freeze ? 'Silent hold' : `Dialogue · ${displayAsset(
            clip.assetId,
            orderedClips.length === 1 ? 'Video' : `Video ${clipIndex + 1}`,
          )}`,
          detail: audioDetail,
          startTicks: freeze ? clip.compositionStart.ticks : audioStart,
          durationTicks: freeze ? clipCompositionDurationTicks(clip) : audioDuration,
          enabled: freeze ? false : clip.enabled,
          blockedReason: null,
          clipId: null,
          linkedClipId: clip.clipId,
          assetId: clip.assetId,
          operationId: null,
          changeSetId: null,
          sourceStartTicks: freeze ? clip.sourceRange.start.ticks : audioSource.start.ticks,
          sourceDurationTicks: freeze ? 1 : audioSource.duration.ticks,
          gainDb: freeze ? null : clip.gainDb,
          fadeInTicks: freeze ? null : clip.fadeIn.ticks,
          fadeOutTicks: freeze ? null : clip.fadeOut.ticks,
          pan: freeze ? null : clip.pan,
          speedBadge: freeze ? 'Freeze' : speedBadgeFor(clip.timeTransform),
          proposalId: null,
          proposalBaseRevision: null,
        }, selectedItemIds))
      }
    })

    let cursor = 0
    const committedClips = videoLane.items
      .filter((item) => item.kind === 'clip')
      .slice()
      .sort(compareItems)
    for (const clip of committedClips) {
      if (clip.startTicks > cursor) {
        const gapDuration = clip.startTicks - cursor
        const id = `gap:${videoLane.id}:${cursor}:${gapDuration}`
        addItem(videoLane, makeItem({
          id,
          laneId: videoLane.id,
          kind: 'gap',
          state: 'committed',
          label: 'Gap',
          detail: null,
          startTicks: cursor,
          durationTicks: gapDuration,
          enabled: false,
          blockedReason: null,
          clipId: null,
          linkedClipId: null,
          assetId: null,
          operationId: null,
          changeSetId: null,
          sourceStartTicks: null,
          sourceDurationTicks: null,
          gainDb: null,
          fadeInTicks: null,
          fadeOutTicks: null,
          proposalId: null,
          proposalBaseRevision: null,
        }, selectedItemIds))
      }
      cursor = Math.max(cursor, clip.startTicks + clip.durationTicks)
    }
  })

  const addPlacementDiagnostic = (
    label: string,
    operationId: string,
    changeSetId: string | null,
    order: number,
  ): void => addDiagnostic(
    'PLACEMENT_UNAVAILABLE',
    `${label} has no visible placement in the current finished video.`,
    operationId,
    changeSetId,
    order,
  )

  const enabledPlacements = (
    assetId: string,
    sourceInterval: TimeRange,
  ): readonly SourceSpanPlacement[] => Object.freeze(
    placeSourceSpan(composition, assetId, sourceInterval).filter((placement) => placement.clip.enabled),
  )

  for (const operation of active.filter(isNameplateOperation)) {
    const trace = traces.get(operation.operationId)
    const lane = assignedLane('visual', operation.operationId, defaultOverlayLane)
    if (!lane) {
      addDiagnostic('OPERATION_UNSUPPORTED', 'Nameplate has no compatible video track.', operation.operationId, trace?.changeSetId ?? null)
      continue
    }
    const placements = enabledPlacements(operation.assetId, operation.sourceInterval)
    if (placements.length === 0) {
      addPlacementDiagnostic('Nameplate', operation.operationId, trace?.changeSetId ?? null, trace?.order ?? diagnosticOrder++)
      continue
    }
    placements.forEach((placement, placementIndex) => {
      addItem(lane, makeItem({
        id: `overlay:${operation.operationId}:${placementIndex}`,
        laneId: lane.id,
        kind: 'nameplate',
        state: 'committed',
        label: previewText(operation.primaryText, 'Nameplate'),
        detail: operation.secondaryText || null,
        startTicks: placement.compositionRange.start.ticks,
        durationTicks: placement.compositionRange.duration.ticks,
        enabled: true,
        blockedReason: null,
        clipId: null,
        linkedClipId: placement.clip.clipId,
        assetId: operation.assetId,
        operationId: operation.operationId,
        changeSetId: trace?.changeSetId ?? null,
        visualId: operation.operationId,
        sourceStartTicks: placement.sourceRange.start.ticks,
        sourceDurationTicks: placement.sourceRange.duration.ticks,
        gainDb: null,
        fadeInTicks: null,
        fadeOutTicks: null,
        proposalId: null,
        proposalBaseRevision: null,
      }, selectedItemIds))
    })
  }

  for (const set of foldCaptionOperations(active.filter(isCaptionOperation))) {
    const lane = assignedLane('caption', set.captionSetId, defaultCaptionLane)
    if (!lane) {
      addDiagnostic('OPERATION_UNSUPPORTED', 'Captions have no compatible caption track.', null, null)
      continue
    }
    for (const cue of set.cues) {
      const cueTrace = captionTraces.cue.get(`${set.captionSetId}:${cue.cueId}`) ?? captionTraces.set.get(set.captionSetId)
      const placements = enabledPlacements(set.assetId, cue.sourceInterval)
      if (placements.length === 0) {
        addPlacementDiagnostic(
          'Caption',
          cueTrace?.operationId ?? set.captionSetId,
          cueTrace?.changeSetId ?? null,
          cueTrace?.order ?? diagnosticOrder++,
        )
        continue
      }
      const text = cue.lines.join(' ')
      placements.forEach((placement, placementIndex) => {
        const operationId = cueTrace?.operationId ?? null
        addItem(lane, makeItem({
          id: `caption:${set.captionSetId}:${cue.cueId}:${placementIndex}`,
          laneId: lane.id,
          kind: 'caption',
          state: 'committed',
          label: previewText(text, 'Caption'),
          detail: text,
          startTicks: placement.compositionRange.start.ticks,
          durationTicks: placement.compositionRange.duration.ticks,
          enabled: true,
          blockedReason: null,
          clipId: null,
          linkedClipId: placement.clip.clipId,
          assetId: set.assetId,
          operationId,
          changeSetId: cueTrace?.changeSetId ?? null,
          captionSetId: set.captionSetId,
          cueId: cue.cueId,
          visualId: set.captionSetId,
          sourceStartTicks: placement.sourceRange.start.ticks,
          sourceDurationTicks: placement.sourceRange.duration.ticks,
          gainDb: null,
          fadeInTicks: null,
          fadeOutTicks: null,
          proposalId: null,
          proposalBaseRevision: null,
        }, selectedItemIds))
      })
    }
  }

  const addResolvedOverlay = (operation: ResolvedOverlayOperation): void => {
    const trace = traces.get(operation.operationId)
    if (operation.kind === 'add-music') {
      const lane = assignedLane('audio', operation.musicId, defaultMusicLane)
      if (!lane) {
        addDiagnostic('OPERATION_UNSUPPORTED', 'Music has no compatible audio track.', operation.operationId, trace?.changeSetId ?? null)
        return
      }
      const asset = findAsset(project.assets, operation.assetId)
      const videoLeft = durationTicks - operation.compositionStart.ticks
      const songLeft = asset?.mediaKind === 'audio'
        ? asset.duration.ticks - operation.sourceStart.ticks
        : 0
      const playable = Math.min(videoLeft, songLeft)
      if (playable <= 0) {
        addPlacementDiagnostic('Music', operation.operationId, trace?.changeSetId ?? null, trace?.order ?? diagnosticOrder++)
        return
      }
      const fadeInTicks = Math.min(operation.fadeIn.ticks, playable)
      const fadeOutTicks = Math.min(operation.fadeOut.ticks, playable - fadeInTicks)
      addItem(lane, makeItem({
        id: `music:${operation.musicId}:0`,
        laneId: lane.id,
        kind: 'music',
        state: 'committed',
        label: displayAsset(operation.assetId, 'Music'),
        detail: null,
        startTicks: operation.compositionStart.ticks,
        durationTicks: playable,
        enabled: true,
        blockedReason: null,
        clipId: null,
        linkedClipId: null,
        assetId: operation.assetId,
        operationId: operation.operationId,
        changeSetId: trace?.changeSetId ?? null,
        sourceStartTicks: operation.sourceStart.ticks,
        sourceDurationTicks: playable,
        gainDb: operation.gainDb,
        fadeInTicks,
        fadeOutTicks,
        proposalId: null,
        proposalBaseRevision: null,
      }, selectedItemIds))
      return
    }

    const visualIdentity = operation.kind === 'add-title'
      ? operation.titleId
      : operation.kind === 'add-callout'
        ? operation.calloutId
        : operation.overlayId
    const lane = assignedLane('visual', visualIdentity, defaultOverlayLane)
    if (!lane) {
      addDiagnostic('OPERATION_UNSUPPORTED', 'Visual has no compatible video track.', operation.operationId, trace?.changeSetId ?? null)
      return
    }
    const placements = enabledPlacements(operation.assetId, operation.sourceInterval)
    if (placements.length === 0) {
      const label = operation.kind === 'add-title'
        ? 'Title'
        : operation.kind === 'add-callout'
          ? 'Callout'
          : 'Media overlay'
      addPlacementDiagnostic(label, operation.operationId, trace?.changeSetId ?? null, trace?.order ?? diagnosticOrder++)
      return
    }

    placements.forEach((placement, placementIndex) => {
      const sourceOffset = placement.sourceRange.start.ticks - operation.sourceInterval.start.ticks
      if (operation.kind === 'add-title') {
        addItem(lane, makeItem({
          id: `overlay:${operation.titleId}:${placementIndex}`,
          laneId: lane.id,
          kind: 'title',
          state: 'committed',
          label: previewText(operation.headline, 'Title'),
          detail: operation.subhead || null,
          startTicks: placement.compositionRange.start.ticks,
          durationTicks: placement.compositionRange.duration.ticks,
          enabled: true,
          blockedReason: null,
          clipId: null,
          linkedClipId: placement.clip.clipId,
          assetId: operation.assetId,
          operationId: operation.operationId,
          changeSetId: trace?.changeSetId ?? null,
          visualId: operation.titleId,
          sourceStartTicks: placement.sourceRange.start.ticks,
          sourceDurationTicks: placement.sourceRange.duration.ticks,
          gainDb: null,
          fadeInTicks: null,
          fadeOutTicks: null,
          proposalId: null,
          proposalBaseRevision: null,
        }, selectedItemIds))
      } else if (operation.kind === 'add-callout') {
        addItem(lane, makeItem({
          id: `overlay:${operation.calloutId}:${placementIndex}`,
          laneId: lane.id,
          kind: 'callout',
          state: 'committed',
          label: previewText(operation.label, 'Callout'),
          detail: operation.label || null,
          startTicks: placement.compositionRange.start.ticks,
          durationTicks: placement.compositionRange.duration.ticks,
          enabled: true,
          blockedReason: null,
          clipId: null,
          linkedClipId: placement.clip.clipId,
          assetId: operation.assetId,
          operationId: operation.operationId,
          changeSetId: trace?.changeSetId ?? null,
          visualId: operation.calloutId,
          sourceStartTicks: placement.sourceRange.start.ticks,
          sourceDurationTicks: placement.sourceRange.duration.ticks,
          gainDb: null,
          fadeInTicks: null,
          fadeOutTicks: null,
          proposalId: null,
          proposalBaseRevision: null,
        }, selectedItemIds))
      } else {
        const overlayAsset = findAsset(project.assets, operation.overlayAssetId)
        addItem(lane, makeItem({
          id: `overlay:${operation.overlayId}:${placementIndex}`,
          laneId: lane.id,
          kind: 'media-overlay',
          state: 'committed',
          label: displayAsset(
            operation.overlayAssetId,
            overlayAsset?.mediaKind === 'image' ? 'Image' : 'B-roll',
          ),
          detail: null,
          startTicks: placement.compositionRange.start.ticks,
          durationTicks: placement.compositionRange.duration.ticks,
          enabled: true,
          blockedReason: null,
          clipId: null,
          linkedClipId: placement.clip.clipId,
          assetId: operation.overlayAssetId,
          operationId: operation.operationId,
          changeSetId: trace?.changeSetId ?? null,
          visualId: operation.overlayId,
          sourceStartTicks: operation.overlaySourceStart.ticks + sourceOffset,
          sourceDurationTicks: placement.compositionRange.duration.ticks,
          gainDb: null,
          fadeInTicks: null,
          fadeOutTicks: null,
          proposalId: null,
          proposalBaseRevision: null,
        }, selectedItemIds))
      }
    })
  }

  foldOverlayOperations(active.filter(isOverlayFamilyOperation)).forEach(addResolvedOverlay)

  evaluation.records.forEach((record, recordIndex) => {
    if (!record.active || record.blockedReason === null) return
    record.changeSet.operations.forEach((operation, operationIndex) => {
      addDiagnostic(
        'OPERATION_BLOCKED',
        // Was `${operation.kind} is blocked: ${record.blockedReason}.`, which put
        // our internal name for the edit ("set-visual-properties") and our
        // internal reason code ("SOURCE_SPAN_REMOVED") in front of the user.
        // Neither means anything to them and neither says what to do.
        //
        // `describeOperation` is the same sentence the history list already shows
        // for that edit, so the two agree, and `blockedEditReason` turns the code
        // into the actual situation.
        `${describeOperation(operation)} — ${blockedEditReason(record.blockedReason)}`,
        operation.operationId,
        record.changeSet.changeSetId,
        recordIndex * 100 + operationIndex,
      )
    })
  })

  // Nothing is reported for a visual adjustment that has no timeline lane yet.
  //
  // There used to be a notice here, once per adjustment, reading:
  //
  //   "Visual-property keyframes and effects do not have a P1-A timeline lane."
  //
  // Every word of that is about our own unfinished work, not about the user's
  // video. "P1-A" is the name of a build stage. "Visual-property keyframes" is
  // not what anybody calls moving a title. And nothing was actually wrong: the
  // adjustment worked, the preview shows it and the export includes it — the
  // only thing missing is a row on the timeline to draw it in.
  //
  // Repeating that over the timeline taught the user that their project was
  // full of problems, so real problems stopped standing out. A notice must be
  // about the user's video and must be worth acting on; this was neither.
  //
  // Nothing became unreachable by removing it. The adjustment is still visible
  // in the preview, still listed in history, and still in the exported file.

  const addPendingSourceItem = (
    proposal: PendingTimelineInput,
    operation: EditOperation & { assetId: string; sourceInterval: TimeRange },
    kind: TimelineItemKind,
    label: string,
    detail: string | null,
    itemAssetId: string,
    sourceStartFor: (placement: SourceSpanPlacement) => number,
    visualId: string,
  ): void => {
    const lane = assignedLane('visual', visualId, defaultOverlayLane)
    if (!lane) {
      addDiagnostic('OPERATION_UNSUPPORTED', `Proposed ${kind} has no compatible video track.`, operation.operationId, null)
      return
    }
    const placements = enabledPlacements(operation.assetId, operation.sourceInterval)
    if (placements.length === 0) {
      addDiagnostic(
        'PLACEMENT_UNAVAILABLE',
        `Proposed ${kind} has no visible placement in the current finished video.`,
        operation.operationId,
        null,
      )
      return
    }
    placements.forEach((placement, placementIndex) => {
      addItem(lane, makeItem({
        id: `proposal:${proposal.proposalId}:${operation.operationId}:${placementIndex}`,
        laneId: lane.id,
        kind,
        state: 'proposed',
        label,
        detail,
        startTicks: placement.compositionRange.start.ticks,
        durationTicks: placement.compositionRange.duration.ticks,
        enabled: true,
        blockedReason: null,
        clipId: null,
        linkedClipId: placement.clip.clipId,
        assetId: itemAssetId,
        operationId: operation.operationId,
        changeSetId: null,
        visualId,
        sourceStartTicks: sourceStartFor(placement),
        sourceDurationTicks: placement.compositionRange.duration.ticks,
        gainDb: null,
        fadeInTicks: null,
        fadeOutTicks: null,
        proposalId: proposal.proposalId,
        proposalBaseRevision: proposal.baseRevision,
      }, selectedItemIds))
    })
  }

  const addPending = (proposal: PendingTimelineInput): void => {
    if (!Number.isSafeInteger(proposal.baseRevision) || proposal.baseRevision !== project.revision) {
      addDiagnostic(
        'PROPOSAL_STALE',
        'The pending proposal was built for an older project revision and is not shown as current.',
        proposal.operations[0]?.operationId ?? null,
        null,
      )
      return
    }

    proposal.operations.forEach((candidate) => {
      const validated = validateOperation(candidate)
      if (!validated.ok) {
        addDiagnostic(
          'PROPOSAL_INVALID',
          'A pending operation failed the current domain validator and was not placed.',
          candidate.operationId,
          null,
        )
        return
      }
      const operation = validated.value
      if (operation.kind === 'add-nameplate') {
        addPendingSourceItem(
          proposal,
          operation,
          'nameplate',
          previewText(operation.primaryText, 'Nameplate'),
          operation.secondaryText || null,
          operation.assetId,
          (placement) => placement.sourceRange.start.ticks,
          operation.operationId,
        )
        return
      }
      if (operation.kind === 'add-title' || operation.kind === 'set-title') {
        addPendingSourceItem(
          proposal,
          operation,
          'title',
          previewText(operation.headline, 'Title'),
          operation.subhead || null,
          operation.assetId,
          (placement) => placement.sourceRange.start.ticks,
          operation.titleId,
        )
        return
      }
      if (operation.kind === 'add-callout' || operation.kind === 'set-callout') {
        addPendingSourceItem(
          proposal,
          operation,
          'callout',
          previewText(operation.label, 'Callout'),
          operation.label || null,
          operation.assetId,
          (placement) => placement.sourceRange.start.ticks,
          operation.calloutId,
        )
        return
      }
      if (operation.kind === 'add-media-overlay' || operation.kind === 'set-media-overlay') {
        addPendingSourceItem(
          proposal,
          operation,
          'media-overlay',
          displayAsset(
            operation.overlayAssetId,
            findAsset(project.assets, operation.overlayAssetId)?.mediaKind === 'image' ? 'Image' : 'B-roll',
          ),
          null,
          operation.overlayAssetId,
          (placement) => operation.overlaySourceStart.ticks +
            (placement.sourceRange.start.ticks - operation.sourceInterval.start.ticks),
          operation.overlayId,
        )
        return
      }
      if (operation.kind === 'add-music' || operation.kind === 'set-music') {
        const lane = assignedLane('audio', operation.musicId, defaultMusicLane)
        if (!lane) {
          addDiagnostic('OPERATION_UNSUPPORTED', 'Proposed music has no compatible audio track.', operation.operationId, null)
          return
        }
        const asset = findAsset(project.assets, operation.assetId)
        const playable = asset?.mediaKind === 'audio'
          ? Math.min(
              durationTicks - operation.compositionStart.ticks,
              asset.duration.ticks - operation.sourceStart.ticks,
            )
          : 0
        if (playable <= 0) {
          addDiagnostic(
            'PLACEMENT_UNAVAILABLE',
            'Proposed music has no playable placement in the current finished video.',
            operation.operationId,
            null,
          )
          return
        }
        const fadeInTicks = Math.min(operation.fadeIn.ticks, playable)
        const fadeOutTicks = Math.min(operation.fadeOut.ticks, playable - fadeInTicks)
        addItem(lane, makeItem({
          id: `proposal:${proposal.proposalId}:${operation.operationId}:0`,
          laneId: lane.id,
          kind: 'music',
          state: 'proposed',
          label: displayAsset(operation.assetId, 'Music'),
          detail: null,
          startTicks: operation.compositionStart.ticks,
          durationTicks: playable,
          enabled: true,
          blockedReason: null,
          clipId: null,
          linkedClipId: null,
          assetId: operation.assetId,
          operationId: operation.operationId,
          changeSetId: null,
          sourceStartTicks: operation.sourceStart.ticks,
          sourceDurationTicks: playable,
          gainDb: operation.gainDb,
          fadeInTicks,
          fadeOutTicks,
          proposalId: proposal.proposalId,
          proposalBaseRevision: proposal.baseRevision,
        }, selectedItemIds))
        return
      }
      if (operation.kind === 'add-captions') {
        const lane = assignedLane('caption', operation.captionSetId, defaultCaptionLane)
        if (!lane) {
          addDiagnostic('OPERATION_UNSUPPORTED', 'Proposed captions have no compatible caption track.', operation.operationId, null)
          return
        }
        operation.cues.forEach((cue) => {
          const placements = enabledPlacements(operation.assetId, cue.sourceInterval)
          if (placements.length === 0) {
            addDiagnostic(
              'PLACEMENT_UNAVAILABLE',
              'A proposed caption has no visible placement in the current finished video.',
              operation.operationId,
              null,
            )
            return
          }
          placements.forEach((placement, placementIndex) => {
            const text = cue.lines.join(' ')
            addItem(lane, makeItem({
              id: `proposal:${proposal.proposalId}:${operation.operationId}:${cue.cueId}:${placementIndex}`,
              laneId: lane.id,
              kind: 'caption',
              state: 'proposed',
              label: previewText(text, 'Caption'),
              detail: text,
              startTicks: placement.compositionRange.start.ticks,
              durationTicks: placement.compositionRange.duration.ticks,
              enabled: true,
              blockedReason: null,
              clipId: null,
              linkedClipId: placement.clip.clipId,
              assetId: operation.assetId,
              operationId: operation.operationId,
              changeSetId: null,
              captionSetId: operation.captionSetId,
              cueId: cue.cueId,
              visualId: operation.captionSetId,
              sourceStartTicks: placement.sourceRange.start.ticks,
              sourceDurationTicks: placement.sourceRange.duration.ticks,
              gainDb: null,
              fadeInTicks: null,
              fadeOutTicks: null,
              proposalId: proposal.proposalId,
              proposalBaseRevision: proposal.baseRevision,
            }, selectedItemIds))
          })
        })
        return
      }

      addDiagnostic(
        'OPERATION_UNSUPPORTED',
        `${operation.kind} cannot be shown as a detached P1-A timeline item.`,
        operation.operationId,
        null,
      )
    })
  }

  if (pending) addPending(pending)

  const lanes = Object.freeze(
    [...laneDrafts.values()]
      .map((lane) => Object.freeze({
        id: lane.id,
        trackId: lane.trackId,
        trackKind: lane.trackKind,
        trackRole: lane.trackRole,
        trackName: lane.trackName,
        syncLockEnabled: lane.syncLockEnabled,
        outputEnabled: lane.outputEnabled,
        audioState: lane.audioState,
        kind: lane.kind,
        label: lane.label,
        order: lane.order,
        items: Object.freeze(lane.items.slice().sort(compareItems)),
      }))
      .sort((left, right) => left.order - right.order || left.id.localeCompare(right.id)),
  )

  const stillHere = [...selectedItemIds].filter((id) => itemIds.has(id)).sort()
  const publicDiagnostics = Object.freeze(
    diagnostics
      .slice()
      .sort((left, right) =>
        left.order - right.order ||
        left.code.localeCompare(right.code) ||
        left.message.localeCompare(right.message),
      )
      .map(({ order: _order, ...diagnostic }) => Object.freeze(diagnostic)),
  )

  const model = Object.freeze({
    compositionId: composition.compositionId,
    projectId: project.projectId,
    projectRevision: project.revision,
    timescale: project.timescale,
    durationTicks,
    lanes,
    diagnostics: publicDiagnostics,
    selectedItemIds: Object.freeze(stillHere),
    // The ONE item, when exactly one is picked. The panels that can only show
    // one thing read this rather than the first of four — showing somebody the
    // settings of a clip they did not choose, and letting them change it, is
    // worse than showing nothing.
    selectedItemId: stillHere.length === 1 ? stillHere[0] : null,
  }) satisfies TimelineViewModel

  const invariantDiagnostics = validateTimelineViewModel(model)
  if (invariantDiagnostics.length === 0) return model
  return Object.freeze({
    ...model,
    diagnostics: Object.freeze([...model.diagnostics, ...invariantDiagnostics]),
  })
}

