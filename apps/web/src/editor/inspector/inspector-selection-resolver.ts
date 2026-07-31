import {
  DEFAULT_VISUAL_PROPERTIES,
  evaluateProject,
  findAsset,
  findClip,
  foldCaptionOperations,
  foldOverlayOperations,
  foldVisualPropertiesOperations,
  isCaptionOperation,
  isNameplateOperation,
  isOverlayFamilyOperation,
  isVisualPropertiesOperation,
  type Clip,
  type EditOperation,
  type EditProject,
  type SetClipTransitionOperation,
  type SetVisualPropertiesOperation,
  type VisualProperties,
} from '@sanverse/edit-domain'

import type {
  PendingTimelineInput,
  TimelineItemView,
  TimelineLaneKind,
  TimelineViewModel,
} from '../../features/timeline'
import type {
  InspectorNothingSelection,
  InspectorSelection,
  InspectorSelectionBase,
} from './inspector-contract'

export type ResolveInspectorSelectionInput = Readonly<{
  project: EditProject
  timeline: TimelineViewModel
  selectedTimelineItemId: string | null
  pending: PendingTimelineInput | null
  assetLabels?: Readonly<Record<string, string>>
}>

const nothing = (
  projectRevision: number,
  reason: InspectorNothingSelection['reason'],
): InspectorNothingSelection => Object.freeze({
  kind: 'nothing',
  state: 'read-only',
  projectRevision,
  reason,
})

const baseFor = (
  item: TimelineItemView,
  laneKind: TimelineLaneKind,
  projectRevision: number,
): InspectorSelectionBase => Object.freeze({
  timelineItemId: item.id,
  timelineItemKind: item.kind,
  laneKind,
  state: item.state,
  label: item.label,
  startTicks: item.startTicks,
  durationTicks: item.durationTicks,
  projectRevision,
})

const visualPropertiesFrom = (
  operation: SetVisualPropertiesOperation | undefined,
): VisualProperties => operation
  ? Object.freeze({
      transform: operation.transform,
      crop: operation.crop,
      layer: operation.layer,
      mask: operation.mask,
      tracks: operation.tracks,
      transition: operation.transition,
      effects: operation.effects,
    })
  : DEFAULT_VISUAL_PROPERTIES

const clipContext = (
  clips: readonly Clip[],
  clipId: string,
  transitions: ReadonlyMap<string, SetClipTransitionOperation>,
): Readonly<{
  nextClipId: string | null
  transition: SetClipTransitionOperation | null
}> => {
  const ordered = clips
    .slice()
    .sort((left, right) => left.compositionStart.ticks - right.compositionStart.ticks || left.clipId.localeCompare(right.clipId))
  const index = ordered.findIndex((candidate) => candidate.clipId === clipId)
  const clip = ordered[index]
  const next = ordered[index + 1]
  const touches = clip !== undefined && next !== undefined &&
    clip.compositionStart.ticks + clip.sourceRange.duration.ticks === next.compositionStart.ticks
  const nextClipId = touches ? next.clipId : null
  const transition = nextClipId === null ? null : transitions.get(clipId) ?? null
  return Object.freeze({
    nextClipId,
    transition: transition?.nextClipId === nextClipId ? transition : null,
  })
}

/**
 * Resolve one Timeline presentation item back to current authoritative project
 * context. The result is immutable, derived, and never persisted.
 */
export function resolveInspectorSelection(
  input: ResolveInspectorSelectionInput,
): InspectorSelection {
  const { project, timeline, selectedTimelineItemId, pending } = input
  if (selectedTimelineItemId === null) return nothing(project.revision, 'NOTHING_SELECTED')
  if (timeline.projectId !== project.projectId || timeline.projectRevision !== project.revision) {
    return nothing(project.revision, 'SELECTION_STALE')
  }

  let item: TimelineItemView | null = null
  let laneKind: TimelineLaneKind | null = null
  for (const lane of timeline.lanes) {
    const candidate = lane.items.find((entry) => entry.id === selectedTimelineItemId)
    if (!candidate) continue
    item = candidate
    laneKind = lane.kind
    break
  }
  if (!item || !laneKind) return nothing(project.revision, 'SELECTION_UNKNOWN')

  const base = baseFor(item, laneKind, project.revision)
  if (item.state === 'blocked') {
    return Object.freeze({
      ...base,
      kind: 'blocked',
      state: 'blocked',
      originalKind: item.kind,
      reason: item.blockedReason ?? 'This item no longer fits the current project.',
      operationId: item.operationId,
      changeSetId: item.changeSetId,
    })
  }

  if (item.state === 'proposed') {
    const operation = pending?.proposalId === item.proposalId && pending.baseRevision === project.revision
      ? pending.operations.find((candidate) => candidate.operationId === item.operationId) ?? null
      : null
    return Object.freeze({
      ...base,
      kind: 'proposal',
      state: 'proposed',
      proposalId: item.proposalId ?? pending?.proposalId ?? 'proposal_unknown',
      proposalBaseRevision: item.proposalBaseRevision ?? pending?.baseRevision ?? project.revision,
      operation,
    })
  }

  if (item.kind === 'gap') {
    return Object.freeze({ ...base, kind: 'gap', state: 'read-only' })
  }

  // One authoritative replay, then the existing domain folds. No Inspector
  // field independently replays history.
  const evaluation = evaluateProject(project)
  const active = Object.freeze(
    evaluation.records
      .filter((record) => record.active && record.blockedReason === null)
      .flatMap((record) => record.changeSet.operations),
  )
  const captionSets = foldCaptionOperations(active.filter(isCaptionOperation))
  const overlays = foldOverlayOperations(active.filter(isOverlayFamilyOperation))
  const visualById = new Map(
    foldVisualPropertiesOperations(active.filter(isVisualPropertiesOperation))
      .map((operation) => [operation.visualId, operation] as const),
  )
  const transitionByClip = new Map<string, SetClipTransitionOperation>()
  for (const operation of active) {
    if (operation.kind === 'set-clip-transition') transitionByClip.set(operation.clipId, operation)
  }

  const labelFor = (assetId: string, fallback: string): string => {
    const supplied = input.assetLabels?.[assetId]?.trim()
    return supplied || fallback
  }
  const assetFor = (assetId: string | null) => assetId ? findAsset(project.assets, assetId) : undefined

  if (item.kind === 'clip' && (laneKind === 'video' || laneKind === 'dialogue')) {
    const clipId = laneKind === 'dialogue' ? item.linkedClipId : item.clipId
    const clip = clipId ? findClip(evaluation.composition, clipId) : undefined
    const asset = clip ? findAsset(project.assets, clip.assetId) : undefined
    if (!clip || !asset) return nothing(project.revision, 'TARGET_UNRESOLVED')
    const track = evaluation.composition.tracks.find((candidate) => candidate.clips.some((entry) => entry.clipId === clip.clipId))
    const context = clipContext(track?.clips ?? [], clip.clipId, transitionByClip)
    const assetLabel = labelFor(clip.assetId, 'Video')
    return Object.freeze({
      ...base,
      kind: laneKind === 'dialogue' ? 'dialogue' : 'video',
      state: 'committed',
      clip,
      asset,
      assetLabel,
      ...context,
    })
  }

  if (item.kind === 'caption') {
    const captionSet = item.captionSetId
      ? captionSets.find((candidate) => candidate.captionSetId === item.captionSetId)
      : undefined
    const cue = captionSet && item.cueId
      ? captionSet.cues.find((candidate) => candidate.cueId === item.cueId)
      : undefined
    const asset = captionSet ? assetFor(captionSet.assetId) : undefined
    if (!captionSet || !cue || !asset || !item.visualId) return nothing(project.revision, 'TARGET_UNRESOLVED')
    return Object.freeze({
      ...base,
      kind: 'caption',
      state: 'committed',
      captionSet,
      cue,
      asset,
      assetLabel: labelFor(asset.assetId, 'Video'),
      visualId: item.visualId,
      visualProperties: visualPropertiesFrom(visualById.get(item.visualId)),
    })
  }

  if (item.kind === 'nameplate') {
    const operation = active.filter(isNameplateOperation)
      .find((candidate) => candidate.operationId === item.operationId)
    const asset = operation ? assetFor(operation.assetId) : undefined
    const visualId = item.visualId ?? operation?.operationId
    if (!operation || !asset || !visualId) return nothing(project.revision, 'TARGET_UNRESOLVED')
    return Object.freeze({
      ...base,
      kind: 'nameplate',
      state: 'committed',
      operation,
      asset,
      assetLabel: labelFor(asset.assetId, 'Video'),
      visualId,
      visualProperties: visualPropertiesFrom(visualById.get(visualId)),
      textEditable: false,
    })
  }

  if (item.kind === 'title' || item.kind === 'callout' || item.kind === 'media-overlay') {
    const operation = overlays.find((candidate) => {
      if (item.kind === 'title') return candidate.kind === 'add-title' && candidate.titleId === item.visualId
      if (item.kind === 'callout') return candidate.kind === 'add-callout' && candidate.calloutId === item.visualId
      return candidate.kind === 'add-media-overlay' && candidate.overlayId === item.visualId
    })
    if (!operation || !item.visualId) return nothing(project.revision, 'TARGET_UNRESOLVED')

    if (operation.kind === 'add-title') {
      const asset = assetFor(operation.assetId)
      if (!asset) return nothing(project.revision, 'TARGET_UNRESOLVED')
      return Object.freeze({
        ...base,
        kind: 'title',
        state: 'committed',
        operation,
        asset,
        assetLabel: labelFor(asset.assetId, 'Video'),
        visualId: item.visualId,
        visualProperties: visualPropertiesFrom(visualById.get(item.visualId)),
      })
    }
    if (operation.kind === 'add-callout') {
      const asset = assetFor(operation.assetId)
      if (!asset) return nothing(project.revision, 'TARGET_UNRESOLVED')
      return Object.freeze({
        ...base,
        kind: 'callout',
        state: 'committed',
        operation,
        asset,
        assetLabel: labelFor(asset.assetId, 'Video'),
        visualId: item.visualId,
        visualProperties: visualPropertiesFrom(visualById.get(item.visualId)),
      })
    }
    if (operation.kind === 'add-media-overlay') {
      const asset = assetFor(operation.overlayAssetId)
      if (!asset) return nothing(project.revision, 'TARGET_UNRESOLVED')
      return Object.freeze({
        ...base,
        kind: 'media-overlay',
        state: 'committed',
        operation,
        asset,
        assetLabel: labelFor(asset.assetId, asset.mediaKind === 'image' ? 'Image' : 'B-roll'),
        visualId: item.visualId,
        visualProperties: visualPropertiesFrom(visualById.get(item.visualId)),
      })
    }
  }

  if (item.kind === 'music') {
    const operation = overlays.find(
      (candidate) => candidate.kind === 'add-music' && candidate.operationId === item.operationId,
    )
    const asset = operation ? assetFor(operation.assetId) : undefined
    if (!operation || operation.kind !== 'add-music' || !asset) {
      return nothing(project.revision, 'TARGET_UNRESOLVED')
    }
    return Object.freeze({
      ...base,
      kind: 'music',
      state: 'committed',
      operation,
      asset,
      assetLabel: labelFor(asset.assetId, 'Music'),
    })
  }

  return nothing(project.revision, 'TARGET_UNRESOLVED')
}
