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
  Omit<TimelineItemView, 'selected' | 'captionSetId' | 'cueId' | 'visualId'> &
  Partial<Pick<TimelineItemView, 'captionSetId' | 'cueId' | 'visualId'>>

const makeItem = (input: TimelineItemInput, selectedItemId: string | null): TimelineItemView =>
  Object.freeze({
    captionSetId: null,
    cueId: null,
    visualId: null,
    ...input,
    selected: input.id === selectedItemId,
  })

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

const laneIdFor = (kind: 'video' | 'dialogue', track: Track, trackCount: number): string =>
  trackCount === 1 ? `lane:${kind}` : `lane:${kind}:${track.trackId}`

const videoLabel = (index: number): string => (index === 0 ? 'V1' : `V1.${index + 1}`)
const dialogueLabel = (index: number): string => (index === 0 ? 'A1' : `A1.${index + 1}`)

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
  const { project, pending, selectedItemId } = input
  const displayAsset = (assetId: string, fallback: string): string => {
    const supplied = input.assetLabels?.[assetId]?.trim()
    return supplied || fallback
  }
  // The domain replay is intentionally performed once. Everything below reads
  // the same evaluated composition and records, so a future timeline render
  // cannot spend several full history replays or observe two derived answers.
  const evaluation = evaluateProject(project)
  const composition = evaluation.composition
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
    if (itemIds.has(item.id)) {
      addDiagnostic(
        'DUPLICATE_PRESENTATION_ID',
        `Timeline item ${item.id} appears more than once.`,
        item.operationId,
        item.changeSetId,
      )
      return
    }
    if (!Number.isSafeInteger(item.durationTicks) || item.durationTicks <= 0) {
      addDiagnostic(
        'ITEM_DURATION_INVALID',
        `Timeline item ${item.id} has no positive whole-tick duration.`,
        item.operationId,
        item.changeSetId,
      )
      return
    }
    const endTicks = item.startTicks + item.durationTicks
    if (
      !Number.isSafeInteger(item.startTicks) ||
      item.startTicks < 0 ||
      !Number.isSafeInteger(endTicks) ||
      endTicks > durationTicks
    ) {
      addDiagnostic(
        'ITEM_OUTSIDE_COMPOSITION',
        `Timeline item ${item.id} falls outside the finished video.`,
        item.operationId,
        item.changeSetId,
      )
      return
    }
    itemIds.add(item.id)
    lane.items.push(item)
  }

  const overlayLane = registerLane({ id: 'lane:overlay', kind: 'overlay', label: 'V2', order: 0 })
  const captionLane = registerLane({ id: 'lane:caption', kind: 'caption', label: 'C1', order: 2 })
  const musicLane = registerLane({ id: 'lane:music', kind: 'music', label: 'A2', order: 4 })

  const canonicalVideoTracks = videoTracks(composition.tracks)
  const videoLanes: LaneDraft[] = []
  const dialogueLanes: LaneDraft[] = []
  if (canonicalVideoTracks.length === 0) {
    videoLanes.push(registerLane({ id: 'lane:video', kind: 'video', label: 'V1', order: 1 }))
    dialogueLanes.push(registerLane({ id: 'lane:dialogue', kind: 'dialogue', label: 'A1', order: 3 }))
  } else {
    canonicalVideoTracks.forEach((track, index) => {
      videoLanes.push(registerLane({
        id: laneIdFor('video', track, canonicalVideoTracks.length),
        kind: 'video',
        label: videoLabel(index),
        order: 1,
      }))
      dialogueLanes.push(registerLane({
        id: laneIdFor('dialogue', track, canonicalVideoTracks.length),
        kind: 'dialogue',
        label: dialogueLabel(index),
        order: 3,
      }))
    })
  }

  canonicalVideoTracks.forEach((track, trackIndex) => {
    const videoLane = videoLanes[trackIndex]
    const dialogueLane = dialogueLanes[trackIndex]
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
        durationTicks: clip.sourceRange.duration.ticks,
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
        proposalId: null,
        proposalBaseRevision: null,
      }, selectedItemId))

      addItem(dialogueLane, makeItem({
        id: `dialogue:${clip.clipId}`,
        laneId: dialogueLane.id,
        kind: 'clip',
        state: 'committed',
        label: `Dialogue · ${displayAsset(
          clip.assetId,
          orderedClips.length === 1 ? 'Video' : `Video ${clipIndex + 1}`,
        )}`,
        detail: null,
        startTicks: clip.compositionStart.ticks,
        durationTicks: clip.sourceRange.duration.ticks,
        enabled: clip.enabled,
        blockedReason: null,
        clipId: null,
        linkedClipId: clip.clipId,
        assetId: clip.assetId,
        operationId: null,
        changeSetId: null,
        sourceStartTicks: clip.sourceRange.start.ticks,
        sourceDurationTicks: clip.sourceRange.duration.ticks,
        gainDb: clip.gainDb,
        fadeInTicks: clip.fadeIn.ticks,
        fadeOutTicks: clip.fadeOut.ticks,
        proposalId: null,
        proposalBaseRevision: null,
      }, selectedItemId))
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
        }, selectedItemId))
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
    const placements = enabledPlacements(operation.assetId, operation.sourceInterval)
    if (placements.length === 0) {
      addPlacementDiagnostic('Nameplate', operation.operationId, trace?.changeSetId ?? null, trace?.order ?? diagnosticOrder++)
      continue
    }
    placements.forEach((placement, placementIndex) => {
      addItem(overlayLane, makeItem({
        id: `overlay:${operation.operationId}:${placementIndex}`,
        laneId: overlayLane.id,
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
      }, selectedItemId))
    })
  }

  for (const set of foldCaptionOperations(active.filter(isCaptionOperation))) {
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
        addItem(captionLane, makeItem({
          id: `caption:${set.captionSetId}:${cue.cueId}:${placementIndex}`,
          laneId: captionLane.id,
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
        }, selectedItemId))
      })
    }
  }

  const addResolvedOverlay = (operation: ResolvedOverlayOperation): void => {
    const trace = traces.get(operation.operationId)
    if (operation.kind === 'add-music') {
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
      addItem(musicLane, makeItem({
        id: `music:${operation.musicId}:0`,
        laneId: musicLane.id,
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
      }, selectedItemId))
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
        addItem(overlayLane, makeItem({
          id: `overlay:${operation.titleId}:${placementIndex}`,
          laneId: overlayLane.id,
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
        }, selectedItemId))
      } else if (operation.kind === 'add-callout') {
        addItem(overlayLane, makeItem({
          id: `overlay:${operation.calloutId}:${placementIndex}`,
          laneId: overlayLane.id,
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
        }, selectedItemId))
      } else {
        const overlayAsset = findAsset(project.assets, operation.overlayAssetId)
        addItem(overlayLane, makeItem({
          id: `overlay:${operation.overlayId}:${placementIndex}`,
          laneId: overlayLane.id,
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
        }, selectedItemId))
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
      addItem(overlayLane, makeItem({
        id: `proposal:${proposal.proposalId}:${operation.operationId}:${placementIndex}`,
        laneId: overlayLane.id,
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
      }, selectedItemId))
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
        addItem(musicLane, makeItem({
          id: `proposal:${proposal.proposalId}:${operation.operationId}:0`,
          laneId: musicLane.id,
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
        }, selectedItemId))
        return
      }
      if (operation.kind === 'add-captions') {
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
            addItem(captionLane, makeItem({
              id: `proposal:${proposal.proposalId}:${operation.operationId}:${cue.cueId}:${placementIndex}`,
              laneId: captionLane.id,
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
            }, selectedItemId))
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
        kind: lane.kind,
        label: lane.label,
        order: lane.order,
        items: Object.freeze(lane.items.slice().sort(compareItems)),
      }))
      .sort((left, right) => left.order - right.order || left.id.localeCompare(right.id)),
  )

  const selectedExists = selectedItemId !== null && itemIds.has(selectedItemId)
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
    selectedItemId: selectedExists ? selectedItemId : null,
  }) satisfies TimelineViewModel

  const invariantDiagnostics = validateTimelineViewModel(model)
  if (invariantDiagnostics.length === 0) return model
  return Object.freeze({
    ...model,
    diagnostics: Object.freeze([...model.diagnostics, ...invariantDiagnostics]),
  })
}

