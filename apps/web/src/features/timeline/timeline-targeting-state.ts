import { OPERATION_SCHEMA_VERSION, activeTimelineTrackState, type EditOperation, type EditProject, type IdFactory } from '@sanverse/edit-domain'
import { TIMELINE_TRACKS_PRIMITIVE_ID } from '@sanverse/edit-domain/capabilities'
import {
  resolvedTrackForTimelineItem,
  timelineTrackAssignmentKey,
  trackById,
  type TimelineItemTrackFamilyV1,
  type TimelineTrackStateV2,
  type TimelineTrackV2,
} from '@sanverse/edit-domain/timeline-tracks'

export const TIMELINE_TARGETING_SCHEMA_VERSION = 'sanverse.timeline-targeting/v1'

export type TimelineTargetingStateV1 = Readonly<{
  schemaVersion: typeof TIMELINE_TARGETING_SCHEMA_VERSION
  targetedVideoTrackIds: readonly string[]
  targetedAudioTrackIds: readonly string[]
  targetedCaptionTrackIds: readonly string[]
}>

export const EMPTY_TIMELINE_TARGETING: TimelineTargetingStateV1 = Object.freeze({
  schemaVersion: TIMELINE_TARGETING_SCHEMA_VERSION,
  targetedVideoTrackIds: Object.freeze([]),
  targetedAudioTrackIds: Object.freeze([]),
  targetedCaptionTrackIds: Object.freeze([]),
})

const storageKey = (projectId: string): string => `sanverse.timeline-targeting.${projectId}`
const stableIds = (value: unknown): readonly string[] => Object.freeze(
  Array.isArray(value)
    ? [...new Set(value.filter((id): id is string => typeof id === 'string' && /^track_[a-z0-9]{8,64}$/.test(id)))]
    : [],
)

export const parseTimelineTargetingState = (raw: unknown): TimelineTargetingStateV1 => {
  if (typeof raw !== 'string' || raw.length === 0) return EMPTY_TIMELINE_TARGETING
  try {
    const value = JSON.parse(raw) as Record<string, unknown>
    if (!value || typeof value !== 'object' || value.schemaVersion !== TIMELINE_TARGETING_SCHEMA_VERSION) return EMPTY_TIMELINE_TARGETING
    return Object.freeze({
      schemaVersion: TIMELINE_TARGETING_SCHEMA_VERSION,
      targetedVideoTrackIds: stableIds(value.targetedVideoTrackIds),
      targetedAudioTrackIds: stableIds(value.targetedAudioTrackIds),
      targetedCaptionTrackIds: stableIds(value.targetedCaptionTrackIds),
    })
  } catch {
    return EMPTY_TIMELINE_TARGETING
  }
}

export const readTimelineTargetingState = (projectId: string): TimelineTargetingStateV1 => {
  try { return parseTimelineTargetingState(globalThis.localStorage?.getItem(storageKey(projectId))) }
  catch { return EMPTY_TIMELINE_TARGETING }
}

export const writeTimelineTargetingState = (projectId: string, state: TimelineTargetingStateV1): void => {
  try { globalThis.localStorage?.setItem(storageKey(projectId), JSON.stringify(state)) } catch { /* presentation preference */ }
}

const keyFor = (kind: TimelineTrackV2['kind']): keyof Omit<TimelineTargetingStateV1, 'schemaVersion'> =>
  kind === 'video' ? 'targetedVideoTrackIds' : kind === 'audio' ? 'targetedAudioTrackIds' : 'targetedCaptionTrackIds'

export const toggleTimelineTrackTarget = (
  state: TimelineTargetingStateV1,
  track: TimelineTrackV2,
): TimelineTargetingStateV1 => {
  const key = keyFor(track.kind)
  const current = state[key]
  const next = current.includes(track.trackId)
    ? current.filter((trackId) => trackId !== track.trackId)
    : [...current, track.trackId]
  return Object.freeze({ ...state, [key]: Object.freeze(next) })
}

export const reconcileTimelineTargetingState = (
  state: TimelineTargetingStateV1,
  trackState: TimelineTrackStateV2,
): TimelineTargetingStateV1 => {
  const keep = (ids: readonly string[], kind: TimelineTrackV2['kind']) =>
    Object.freeze(ids.filter((id) => trackById(trackState, id)?.kind === kind))
  return Object.freeze({
    schemaVersion: TIMELINE_TARGETING_SCHEMA_VERSION,
    targetedVideoTrackIds: keep(state.targetedVideoTrackIds, 'video'),
    targetedAudioTrackIds: keep(state.targetedAudioTrackIds, 'audio'),
    targetedCaptionTrackIds: keep(state.targetedCaptionTrackIds, 'caption'),
  })
}

const compatible = (track: TimelineTrackV2, family: TimelineItemTrackFamilyV1): boolean =>
  family === 'primary'
    ? track.role === 'primary-video'
    : family === 'dialogue'
      ? track.role === 'dialogue'
      : family === 'visual'
        ? track.kind === 'video' && track.role !== 'primary-video'
        : family === 'caption'
          ? track.kind === 'caption'
          : track.kind === 'audio' && track.role !== 'dialogue'

/** Pointer destination wins. Otherwise targeting wins. Otherwise legacy default. */
export const resolveTimelineDestinationTrack = (input: Readonly<{
  trackState: TimelineTrackStateV2
  targeting: TimelineTargetingStateV1
  family: TimelineItemTrackFamilyV1
  explicitTrackId?: string | null
  assignmentKey?: string | null
}>): TimelineTrackV2 | null => {
  if (input.explicitTrackId) {
    const explicit = trackById(input.trackState, input.explicitTrackId)
    if (explicit && compatible(explicit, input.family)) return explicit
  }
  const targetIds = input.family === 'visual'
    ? input.targeting.targetedVideoTrackIds
    : input.family === 'audio' || input.family === 'dialogue'
      ? input.targeting.targetedAudioTrackIds
      : input.family === 'caption'
        ? input.targeting.targetedCaptionTrackIds
        : input.targeting.targetedVideoTrackIds
  for (const trackId of targetIds) {
    const track = trackById(input.trackState, trackId)
    if (track && compatible(track, input.family)) return track
  }
  return resolvedTrackForTimelineItem(
    input.trackState,
    input.assignmentKey ?? `default:${input.family}`,
    input.family,
  )
}

const targetIdsForFamily = (
  targeting: TimelineTargetingStateV1,
  family: 'visual' | 'caption' | 'audio',
): readonly string[] => family === 'visual'
  ? targeting.targetedVideoTrackIds
  : family === 'audio'
    ? targeting.targetedAudioTrackIds
    : targeting.targetedCaptionTrackIds

const authoredTrackIdentity = (
  operation: EditOperation,
): Readonly<{ family: 'visual' | 'caption' | 'audio'; identity: string }> | null => {
  if (operation.kind === 'add-nameplate') return Object.freeze({ family: 'visual', identity: operation.operationId })
  if (operation.kind === 'add-title') return Object.freeze({ family: 'visual', identity: operation.titleId })
  if (operation.kind === 'add-callout') return Object.freeze({ family: 'visual', identity: operation.calloutId })
  if (operation.kind === 'add-media-overlay') return Object.freeze({ family: 'visual', identity: operation.overlayId })
  if (operation.kind === 'add-captions') return Object.freeze({ family: 'caption', identity: operation.captionSetId })
  if (operation.kind === 'add-music') return Object.freeze({ family: 'audio', identity: operation.musicId })
  return null
}

/**
 * Supply a targeted destination only when an edit did not already carry one.
 * This is intentionally an augmentation step rather than a rewrite: explicit
 * pointer/drop assignment operations stay authoritative and targeting remains
 * presentation state with zero revision by itself.
 */
export const augmentOperationsForTimelineTargeting = (input: Readonly<{
  project: EditProject
  operations: readonly EditOperation[]
  targeting: TimelineTargetingStateV1
  ids: IdFactory
  operationSlotOffset: number
}>): readonly EditOperation[] => {
  const state = activeTimelineTrackState(input.project)
  const explicitAssignments = new Set(
    input.operations
      .filter((operation): operation is Extract<EditOperation, { kind: 'assign-timeline-item-track' }> => operation.kind === 'assign-timeline-item-track')
      .map((operation) => operation.itemId),
  )
  const additions: EditOperation[] = []
  let slot = input.operationSlotOffset

  for (const operation of input.operations) {
    const authored = authoredTrackIdentity(operation)
    if (!authored || targetIdsForFamily(input.targeting, authored.family).length === 0) continue
    const assignmentKey = timelineTrackAssignmentKey(authored.family, authored.identity)
    if (explicitAssignments.has(assignmentKey)) continue
    const destination = resolveTimelineDestinationTrack({
      trackState: state,
      targeting: input.targeting,
      family: authored.family,
      assignmentKey,
    })
    if (!destination) continue
    additions.push(Object.freeze({
      schemaVersion: OPERATION_SCHEMA_VERSION,
      operationId: input.ids.operation(slot++),
      kind: 'assign-timeline-item-track',
      capabilityId: TIMELINE_TRACKS_PRIMITIVE_ID,
      itemId: assignmentKey,
      trackId: destination.trackId,
      extensions: Object.freeze({}),
    }) as EditOperation)
  }

  return additions.length === 0 ? input.operations : Object.freeze([...input.operations, ...additions])
}
