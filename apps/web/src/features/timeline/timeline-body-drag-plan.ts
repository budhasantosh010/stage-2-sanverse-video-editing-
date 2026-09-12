import { OPERATION_SCHEMA_VERSION, activeOperations, activeTimelineTrackState, applyTimelineOperation, effectiveComposition, findClip, mediaTime, primaryVisualOrderSupported, validateOperation, type EditOperation, type EditProject, type IdFactory } from '@sanverse/edit-domain'
import { MOVE_PRIMARY_CLIP_PRIMITIVE_ID } from '@sanverse/edit-domain/capabilities'
import { clipCompositionDurationTicks } from '@sanverse/edit-domain/composition'
import type { TimelineViewModel } from './timeline-contract'
import { adaptTimelineGesture } from './timeline-gesture-adapter'
import { planTimelineItemAction } from './timeline-item-operations'
import { familyAndIdentityForTimelineItem, planAssignTimelineItemTrack } from './timeline-track-controls'

export type TimelineBodyDragRequest = Readonly<{ itemId: string; destinationTrackId: string; toStartTicks: number; revision?: number }>
export type TimelineBodyDragPlan =
  | Readonly<{ ok: true; operations: readonly EditOperation[]; description: string; landingStartTicks: number }>
  | Readonly<{ ok: false; refusal: Readonly<{ code: string; message: string }> }>
export type TimelineBodyDragApi = Readonly<{
  revision?: number
  selectedItemIds?: readonly string[]
  preview(request: TimelineBodyDragRequest): TimelineBodyDragPlan
  commit(request: TimelineBodyDragRequest): void | Promise<void>
}>
export type TimelineBodyDragFeedback = Readonly<{
  itemId: string; linkedClipId: string | null; deltaTicks: number; deltaY: number; plan: TimelineBodyDragPlan
}>
const refuse = (code: string, message: string): TimelineBodyDragPlan => ({ ok: false, refusal: { code, message } })
const success = (operations: readonly EditOperation[], description: string, landingStartTicks: number): TimelineBodyDragPlan => ({ ok: true, operations, description, landingStartTicks })

/** One pure decision for both the drag preview and its release. Never writes a project. */
export function planTimelineBodyDrag(input: Readonly<{
  project: EditProject; model: TimelineViewModel; request: TimelineBodyDragRequest
  lockedTrackIds: readonly string[]; pendingProposalExists: boolean; exportInProgress: boolean
  expectedRevision: number; ids: IdFactory
}>): TimelineBodyDragPlan {
  const { project, model, request, ids } = input
  if (project.revision !== input.expectedRevision || (request.revision !== undefined && request.revision !== project.revision)) return refuse('PROJECT_STALE', 'The project changed. Start this drag again.')
  if (input.pendingProposalExists) return refuse('PROPOSAL_PENDING', 'Finish the pending proposal first.')
  if (input.exportInProgress) return refuse('EXPORT_IN_PROGRESS', 'Wait for the export to finish.')
  const item = model.lanes.flatMap((lane) => lane.items).find((entry) => entry.id === request.itemId)
  const source = model.lanes.find((lane) => lane.trackId === item?.trackId)
  const destination = model.lanes.find((lane) => lane.trackId === request.destinationTrackId)
  if (!item || !source || !destination || item.state !== 'committed') return refuse('ITEM_UNKNOWN', 'Choose an existing clip and track.')
  const locked = (trackId: string) => input.lockedTrackIds.includes(trackId)
  const clipId = item.clipId ?? item.linkedClipId
  const linkedLocked = clipId !== null && model.lanes.some((lane) => locked(lane.trackId) && lane.items.some((entry) => (entry.clipId ?? entry.linkedClipId) === clipId))
  if (locked(source.trackId) || locked(destination.trackId) || linkedLocked) return refuse('TRACK_LOCKED', 'Unlock the clip and its linked audio track before moving them.')
  if (!Number.isSafeInteger(request.toStartTicks) || request.toStartTicks < 0) return refuse('OUT_OF_RANGE', 'Keep the clip inside the timeline.')

  if (clipId !== null) {
    const transferring = source.trackId !== destination.trackId
    if (transferring && (item.linkedClipId !== null || destination.trackKind !== 'video')) return refuse('TRACK_INCOMPATIBLE', 'Move the picture to another video track. Its linked sound stays on Dialogue.')
    const composition = effectiveComposition(project)
    const clip = findClip(composition, clipId)
    if (!clip) return refuse('ITEM_UNKNOWN', 'This section is no longer in the project.')
    const start = clip.compositionStart.ticks + request.toStartTicks - item.startTicks
    if (start < 0) return refuse('OUT_OF_RANGE', 'The linked video would start before zero.')
    if (start === clip.compositionStart.ticks && !transferring) return success([], 'No move', request.toStartTicks)
    const peers = composition.tracks.find((track) => track.clips.some((entry) => entry.clipId === clipId))!.clips.slice().sort((a, b) => a.compositionStart.ticks - b.compositionStart.ticks)
    const others = peers.filter((entry) => entry.clipId !== clipId)
    const duration = clipCompositionDurationTicks(clip)
    const destinationPeers = transferring ? composition.tracks.find(track => track.trackId === destination.trackId)?.clips ?? [] : others
    const overlap = destinationPeers.some((entry) => start < entry.compositionStart.ticks + clipCompositionDurationTicks(entry) && entry.compositionStart.ticks < start + duration)
    const gapless = peers.every((entry, index) => index === 0 || peers[index - 1].compositionStart.ticks + clipCompositionDurationTicks(peers[index - 1]) === entry.compositionStart.ticks)
    if (overlap && gapless && !transferring) {
      const toIndex = others.filter((entry) => entry.compositionStart.ticks + clipCompositionDurationTicks(entry) / 2 < start + duration / 2).length
      if (toIndex === peers.findIndex((entry) => entry.clipId === clipId)) return success([], 'Same sequence position', item.startTicks)
      const result = adaptTimelineGesture({ project, gesture: { type: 'move-to-index', clipId, toIndex }, createOperationId: () => ids.operation(0), createClipId: () => ids.entity('clip', 0), pendingProposalExists: false, exportInProgress: false })
      if (!result.ok) return refuse(result.error.code, result.error.message)
      const landing = peers[0].compositionStart.ticks + others.slice(0, toIndex).reduce((total, entry) => total + clipCompositionDurationTicks(entry), 0)
      return success([result.value], 'Reorder linked video and audio', landing + item.startTicks - clip.compositionStart.ticks)
    }
    // A gapless reorder keeps the source track's occupied interval unchanged.
    // Only a literal move lands at the raw pointer interval checked here.
    if (overlap) return refuse('COLLISION', 'Another section is here. Drop into an empty gap or use the explicit placement controls.')
    const result = validateOperation({ schemaVersion: OPERATION_SCHEMA_VERSION, operationId: ids.operation(0), capabilityId: MOVE_PRIMARY_CLIP_PRIMITIVE_ID, kind: 'move-primary-clip', clipId, compositionStart: mediaTime(start), ...(transferring ? { destinationTrackId: destination.trackId } : {}), extensions: {} })
    if (!result.ok || result.value.kind !== 'move-primary-clip') return refuse('OUT_OF_RANGE', 'That position cannot be represented safely.')
    const trackState = activeTimelineTrackState(project)
    const applied = applyTimelineOperation(composition, result.value, project.assets, trackState)
    if (!applied.ok) return refuse('DOMAIN_REFUSAL', `Cannot move here: ${applied.error.reason}.`)
    if (!primaryVisualOrderSupported(applied.value, trackState, activeOperations(project))) return refuse('OPERATION_UNSUPPORTED', 'Move the visuals to this video track or above it first. Visuals beneath footage are not supported yet.')
    return success([result.value], transferring ? 'Move footage to video track; keep linked sound' : 'Move linked video and audio', request.toStartTicks)
  }

  if (item.kind !== 'music' && item.kind !== 'media-overlay') return refuse('OPERATION_UNSUPPORTED', 'Use the Inspector to position this item.')
  const family = familyAndIdentityForTimelineItem(item)
  if (!family || family.family === 'primary' || family.family === 'dialogue') return refuse('ITEM_UNKNOWN', 'That clip has no editable identity.')
  const movingTracks = source.trackId !== destination.trackId
  const assignment = movingTracks ? planAssignTimelineItemTrack({ project, item, family: family.family, identity: family.identity, destinationTrackId: destination.trackId, lockedTrackIds: input.lockedTrackIds, ids: { ...ids, operation: (slot) => ids.operation(slot + 1) } }) : null
  if (assignment && !assignment.ok) return assignment
  const movingTime = request.toStartTicks !== item.startTicks
  const move = movingTime ? planTimelineItemAction({ ...input, itemId: item.id, action: { type: 'move', toStartTicks: request.toStartTicks }, collisionTrackId: destination.trackId, lockedTrackIds: [] }) : null
  if (move && !move.ok) return move
  if (destination.items.some((other) => other.id !== item.id && other.state === 'committed' && other.kind === item.kind && request.toStartTicks < other.startTicks + other.durationTicks && other.startTicks < request.toStartTicks + item.durationTicks)) return refuse('COLLISION', 'Another clip occupies this space. Move it to an empty part of the track.')
  return success([...(move?.ok ? move.operations : []), ...(assignment?.ok ? assignment.operations : [])], movingTracks ? 'Move clip to track' : 'Move clip', request.toStartTicks)
}
