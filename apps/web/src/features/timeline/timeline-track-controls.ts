import {
  OPERATION_SCHEMA_VERSION,
  PROJECT_TIMESCALE,
  activeCaptionSets,
  activeOperations,
  activeOverlayOperations,
  activeTimelineTrackState,
  clipAtCompositionTime,
  clipCompositionRange,
  clipTimeToSource,
  compositionDuration,
  compositionTimeToClip,
  effectiveComposition,
  findClip,
  isNameplateOperation,
  placeSourceSpan,
  type EditOperation,
  type EditProject,
  type IdFactory,
} from '@sanverse/edit-domain'
import {
  CALLOUT_PRIMITIVE_ID,
  CAPTION_CUE_PRIMITIVE_ID,
  MEDIA_OVERLAY_PRIMITIVE_ID,
  MUSIC_PRIMITIVE_ID,
  OVERLAY_REMOVE_PRIMITIVE_ID,
  REMOVE_PRIMITIVE_ID,
  TIMELINE_TRACKS_PRIMITIVE_ID,
  TITLE_PRIMITIVE_ID,
} from '@sanverse/edit-domain/capabilities'
import {
  MAX_AUDIO_TRACKS,
  MAX_CAPTION_TRACKS,
  MAX_VIDEO_TRACKS,
  canTrackAcceptTimelineItem,
  dialogueTimelineTrack,
  primaryTimelineTrack,
  resolvedTrackForTimelineItem,
  timelineTrackAssignmentKey,
  trackById,
  tracksOfKind,
  type AudioTrackStateV1,
  type TimelineItemTrackFamilyV1,
  type TimelineTrackKindV2,
  type TimelineTrackStateV2,
  type TimelineTrackV2,
} from '@sanverse/edit-domain/timeline-tracks'

import type { TimelineItemView, TimelineViewModel } from './timeline-contract'
import { parseTimelineItemId } from './timeline-item-operations'
import type { TimelineSelectionV2 } from './timeline-selection-v2'

export const TRACK_CONTROL_REFUSAL_CODES = Object.freeze([
  'TRACK_NOT_FOUND',
  'TRACK_LIMIT_REACHED',
  'TRACK_LOCKED',
  'TRACK_REQUIRED',
  'TRACK_NOT_EMPTY',
  'TRACK_INCOMPATIBLE',
  'TRACK_COLLISION',
  'ITEM_UNKNOWN',
  'ITEM_UNDELETABLE',
  'NO_TRACK_AVAILABLE',
  'SYNC_LOCK_COMPENSATION_IMPOSSIBLE',
  'NO_CHANGE',
] as const)

export type TrackControlRefusalCode = (typeof TRACK_CONTROL_REFUSAL_CODES)[number]
export type TrackControlRefusal = Readonly<{ code: TrackControlRefusalCode; message: string }>
export type TrackControlPlan =
  | Readonly<{ ok: true; operations: readonly EditOperation[]; summary: string }>
  | Readonly<{ ok: false; refusal: TrackControlRefusal }>

const refuse = (code: TrackControlRefusalCode, message: string): TrackControlPlan =>
  Object.freeze({ ok: false, refusal: Object.freeze({ code, message }) })
const ok = (operations: readonly EditOperation[], summary: string): TrackControlPlan =>
  Object.freeze({ ok: true, operations: Object.freeze([...operations]), summary })

const audioDefault = (): AudioTrackStateV1 => Object.freeze({ muted: false, solo: false, gainDb: 0, pan: 0 })
const limitFor = (kind: TimelineTrackKindV2): number =>
  kind === 'video' ? MAX_VIDEO_TRACKS : kind === 'audio' ? MAX_AUDIO_TRACKS : MAX_CAPTION_TRACKS
const defaultRoleFor = (kind: TimelineTrackKindV2): TimelineTrackV2['role'] =>
  kind === 'video' ? 'generic-video' : kind === 'audio' ? 'generic-audio' : 'captions'

export const planAddTimelineTrack = (input: Readonly<{
  project: EditProject
  kind: TimelineTrackKindV2
  ids: IdFactory
  name?: string | null
}>): TrackControlPlan => {
  const state = activeTimelineTrackState(input.project)
  const sameKind = tracksOfKind(state, input.kind)
  if (sameKind.length >= limitFor(input.kind)) {
    return refuse('TRACK_LIMIT_REACHED', `This project already has the maximum number of ${input.kind} tracks.`)
  }
  const role = defaultRoleFor(input.kind)
  // New video tracks sit above the current highest video layer. New audio and
  // caption tracks sit after the existing tracks in their own section.
  const insertIndex = sameKind.length
  const track: TimelineTrackV2 = Object.freeze({
    trackId: input.ids.entity('track', 0),
    kind: input.kind,
    role,
    name: input.name?.trim() ? input.name.normalize('NFC').trim() : null,
    syncLockEnabled: true,
    outputEnabled: true,
    audioState: input.kind === 'audio' ? audioDefault() : null,
  })
  const operation: EditOperation = Object.freeze({
    schemaVersion: OPERATION_SCHEMA_VERSION,
    operationId: input.ids.operation(0),
    kind: 'add-timeline-track',
    capabilityId: TIMELINE_TRACKS_PRIMITIVE_ID,
    track,
    insertIndex,
    extensions: Object.freeze({}),
  })
  return ok([operation], `Added a ${input.kind} track`)
}

const requiredTrack = (track: TimelineTrackV2): boolean =>
  track.role === 'primary-video' || track.role === 'dialogue'

export const planRenameTimelineTrack = (input: Readonly<{
  project: EditProject
  trackId: string
  name: string | null
  lockedTrackIds: readonly string[]
  ids: IdFactory
}>): TrackControlPlan => {
  const state = activeTimelineTrackState(input.project)
  const track = trackById(state, input.trackId)
  if (!track) return refuse('TRACK_NOT_FOUND', 'That track is no longer here.')
  if (input.lockedTrackIds.includes(track.trackId)) return refuse('TRACK_LOCKED', 'Unlock that track before renaming it.')
  const normalized = input.name?.normalize('NFC').trim() || null
  if (normalized === track.name) return refuse('NO_CHANGE', 'That track already has that name.')
  return ok([Object.freeze({
    schemaVersion: OPERATION_SCHEMA_VERSION,
    operationId: input.ids.operation(0),
    kind: 'rename-timeline-track',
    capabilityId: TIMELINE_TRACKS_PRIMITIVE_ID,
    trackId: track.trackId,
    name: normalized,
    extensions: Object.freeze({}),
  }) as EditOperation], 'Renamed a track')
}

export const planReorderTimelineTrack = (input: Readonly<{
  project: EditProject
  trackId: string
  toIndex: number
  lockedTrackIds: readonly string[]
  ids: IdFactory
}>): TrackControlPlan => {
  const state = activeTimelineTrackState(input.project)
  const track = trackById(state, input.trackId)
  if (!track) return refuse('TRACK_NOT_FOUND', 'That track is no longer here.')
  if (requiredTrack(track)) return refuse('TRACK_REQUIRED', 'The primary video and dialogue tracks stay pinned in place.')
  if (input.lockedTrackIds.includes(track.trackId)) return refuse('TRACK_LOCKED', 'Unlock that track before reordering it.')
  const peers = tracksOfKind(state, track.kind)
  const current = peers.findIndex((candidate) => candidate.trackId === track.trackId)
  if (current === input.toIndex) return refuse('NO_CHANGE', 'That track is already there.')
  return ok([Object.freeze({
    schemaVersion: OPERATION_SCHEMA_VERSION,
    operationId: input.ids.operation(0),
    kind: 'reorder-timeline-track',
    capabilityId: TIMELINE_TRACKS_PRIMITIVE_ID,
    trackId: track.trackId,
    toIndex: input.toIndex,
    extensions: Object.freeze({}),
  }) as EditOperation], 'Reordered tracks')
}

export const planSetTrackSyncLock = (input: Readonly<{
  project: EditProject
  trackId: string
  enabled: boolean
  ids: IdFactory
}>): TrackControlPlan => {
  const track = trackById(activeTimelineTrackState(input.project), input.trackId)
  if (!track) return refuse('TRACK_NOT_FOUND', 'That track is no longer here.')
  if (track.syncLockEnabled === input.enabled) return refuse('NO_CHANGE', 'Sync Lock is already set that way.')
  return ok([Object.freeze({
    schemaVersion: OPERATION_SCHEMA_VERSION,
    operationId: input.ids.operation(0),
    kind: 'set-track-sync-lock',
    capabilityId: TIMELINE_TRACKS_PRIMITIVE_ID,
    trackId: track.trackId,
    enabled: input.enabled,
    extensions: Object.freeze({}),
  }) as EditOperation], input.enabled ? 'Turned Sync Lock on' : 'Turned Sync Lock off')
}

export const planSetTrackAudioState = (input: Readonly<{
  project: EditProject
  trackId: string
  audioState: AudioTrackStateV1
  lockedTrackIds: readonly string[]
  ids: IdFactory
}>): TrackControlPlan => {
  const track = trackById(activeTimelineTrackState(input.project), input.trackId)
  if (!track) return refuse('TRACK_NOT_FOUND', 'That track is no longer here.')
  if (track.kind !== 'audio' || track.audioState === null) return refuse('TRACK_INCOMPATIBLE', 'Only audio tracks have mute, solo, gain and pan.')
  if (input.lockedTrackIds.includes(track.trackId)) return refuse('TRACK_LOCKED', 'Unlock that track before changing its mix.')
  const next = Object.freeze({ ...input.audioState })
  if (JSON.stringify(next) === JSON.stringify(track.audioState)) return refuse('NO_CHANGE', 'That track mix is already set that way.')
  return ok([Object.freeze({
    schemaVersion: OPERATION_SCHEMA_VERSION,
    operationId: input.ids.operation(0),
    kind: 'set-track-audio-state',
    capabilityId: TIMELINE_TRACKS_PRIMITIVE_ID,
    trackId: track.trackId,
    audioState: next,
    extensions: Object.freeze({}),
  }) as EditOperation], 'Changed a track mix')
}

export const planAssignTimelineItemTrack = (input: Readonly<{
  project: EditProject
  item: TimelineItemView
  family: Exclude<TimelineItemTrackFamilyV1, 'primary' | 'dialogue'>
  identity: string
  destinationTrackId: string
  lockedTrackIds: readonly string[]
  ids: IdFactory
}>): TrackControlPlan => {
  const state = activeTimelineTrackState(input.project)
  const source = trackById(state, input.item.trackId)
  const destination = trackById(state, input.destinationTrackId)
  if (!source || !destination) return refuse('TRACK_NOT_FOUND', 'The source or destination track is no longer here.')
  if (input.lockedTrackIds.includes(source.trackId) || input.lockedTrackIds.includes(destination.trackId)) {
    return refuse('TRACK_LOCKED', 'Unlock both tracks before moving an item between them.')
  }
  if (!canTrackAcceptTimelineItem(destination, input.family)) {
    return refuse('TRACK_INCOMPATIBLE', `That item cannot be placed on ${destination.kind} tracks.`)
  }
  if (source.trackId === destination.trackId) return refuse('NO_CHANGE', 'That item is already on this track.')
  return ok([Object.freeze({
    schemaVersion: OPERATION_SCHEMA_VERSION,
    operationId: input.ids.operation(0),
    kind: 'assign-timeline-item-track',
    capabilityId: TIMELINE_TRACKS_PRIMITIVE_ID,
    itemId: timelineTrackAssignmentKey(input.family, input.identity),
    trackId: destination.trackId,
    extensions: Object.freeze({}),
  }) as EditOperation], 'Moved an item to another track')
}

const intersects = (left: TimelineItemView, right: TimelineItemView): boolean =>
  left.startTicks < right.startTicks + right.durationTicks && right.startTicks < left.startTicks + left.durationTicks

export const planMoveItemToTopTrack = (input: Readonly<{
  project: EditProject
  model: TimelineViewModel
  itemId: string
  lockedTrackIds: readonly string[]
  ids: IdFactory
  createIfNeeded: boolean
}>): TrackControlPlan => {
  const item = input.model.lanes.flatMap((lane) => lane.items).find((candidate) => candidate.id === input.itemId)
  if (!item) return refuse('ITEM_UNKNOWN', 'That item is no longer on the timeline.')
  const family: TimelineItemTrackFamilyV1 = item.kind === 'music' ? 'audio' : item.kind === 'caption' ? 'caption' : 'visual'
  if (family !== 'visual') return refuse('TRACK_INCOMPATIBLE', 'Place On Top is for visual items.')
  const state = activeTimelineTrackState(input.project)
  const current = trackById(state, item.trackId)
  if (!current || current.kind !== 'video') return refuse('TRACK_NOT_FOUND', 'That video track is no longer here.')
  if (input.lockedTrackIds.includes(current.trackId)) return refuse('TRACK_LOCKED', 'Unlock that track before moving the item.')
  const videos = tracksOfKind(state, 'video')
  const currentIndex = videos.findIndex((track) => track.trackId === current.trackId)
  for (let index = currentIndex + 1; index < videos.length; index += 1) {
    const candidate = videos[index]
    if (input.lockedTrackIds.includes(candidate.trackId)) continue
    const lane = input.model.lanes.find((entry) => entry.trackId === candidate.trackId)
    if (lane?.items.some((other) => other.id !== item.id && intersects(item, other))) continue
    return planAssignTimelineItemTrack({
      project: input.project,
      item,
      family: 'visual',
      identity: item.visualId ?? item.operationId ?? item.id,
      destinationTrackId: candidate.trackId,
      lockedTrackIds: input.lockedTrackIds,
      ids: input.ids,
    })
  }
  if (!input.createIfNeeded) return refuse('NO_TRACK_AVAILABLE', 'No empty video track is available above this item.')
  if (videos.length >= MAX_VIDEO_TRACKS) return refuse('TRACK_LIMIT_REACHED', 'There is no room for another video track.')
  const trackId = input.ids.entity('track', 0)
  const add: EditOperation = Object.freeze({
    schemaVersion: OPERATION_SCHEMA_VERSION,
    operationId: input.ids.operation(0),
    kind: 'add-timeline-track',
    capabilityId: TIMELINE_TRACKS_PRIMITIVE_ID,
    track: Object.freeze({
      trackId,
      kind: 'video',
      role: 'generic-video',
      name: null,
      syncLockEnabled: true,
      outputEnabled: true,
      audioState: null,
    }),
    insertIndex: videos.length,
    extensions: Object.freeze({}),
  }) as EditOperation
  const assign: EditOperation = Object.freeze({
    schemaVersion: OPERATION_SCHEMA_VERSION,
    operationId: input.ids.operation(1),
    kind: 'assign-timeline-item-track',
    capabilityId: TIMELINE_TRACKS_PRIMITIVE_ID,
    itemId: timelineTrackAssignmentKey('visual', item.visualId ?? item.operationId ?? item.id),
    trackId,
    extensions: Object.freeze({}),
  }) as EditOperation
  return ok([add, assign], 'Created a video track and placed the item on top')
}

const logicalItemsOnTrack = (model: TimelineViewModel, trackId: string): readonly TimelineItemView[] => {
  const lane = model.lanes.find((candidate) => candidate.trackId === trackId)
  if (!lane) return Object.freeze([])
  const seen = new Set<string>()
  return Object.freeze(lane.items.filter((item) => {
    if (item.kind === 'gap' || item.state !== 'committed') return false
    const parsed = parseTimelineItemId(item.id)
    const identity = parsed ? `${parsed.family}:${parsed.targetId}` : item.kind === 'caption'
      ? `caption:${item.captionSetId}:${item.cueId}`
      : item.id
    if (seen.has(identity)) return false
    seen.add(identity)
    return true
  }))
}

export const planDeleteTimelineTrack = (input: Readonly<{
  project: EditProject
  model: TimelineViewModel
  trackId: string
  mode: 'empty-only' | 'with-contents'
  lockedTrackIds: readonly string[]
  ids: IdFactory
}>): TrackControlPlan => {
  const state = activeTimelineTrackState(input.project)
  const track = trackById(state, input.trackId)
  if (!track) return refuse('TRACK_NOT_FOUND', 'That track is no longer here.')
  if (requiredTrack(track)) return refuse('TRACK_REQUIRED', 'The primary video and dialogue tracks are required.')
  if (input.lockedTrackIds.includes(track.trackId)) return refuse('TRACK_LOCKED', 'Unlock that track before deleting it.')
  const items = logicalItemsOnTrack(input.model, track.trackId)
  if (items.length > 0 && input.mode === 'empty-only') return refuse('TRACK_NOT_EMPTY', 'That track still contains items. Choose Delete Track and Contents to remove both.')

  const operations: EditOperation[] = []
  let slot = 0
  if (input.mode === 'with-contents') {
    for (const item of items) {
      const parsed = parseTimelineItemId(item.id)
      if (parsed?.family === 'overlay' || parsed?.family === 'music') {
        operations.push(Object.freeze({
          schemaVersion: OPERATION_SCHEMA_VERSION,
          operationId: input.ids.operation(slot++),
          kind: 'remove-overlay',
          capabilityId: OVERLAY_REMOVE_PRIMITIVE_ID,
          overlayId: parsed.targetId,
          extensions: Object.freeze({}),
        }) as EditOperation)
        continue
      }
      if (parsed?.family === 'clip' && item.clipId) {
        if (!findClip(effectiveComposition(input.project), item.clipId)) {
          return refuse('ITEM_UNKNOWN', 'A clip on that track disappeared before it could be removed.')
        }
        operations.push(Object.freeze({
          schemaVersion: OPERATION_SCHEMA_VERSION,
          operationId: input.ids.operation(slot++),
          kind: 'remove-clip',
          capabilityId: REMOVE_PRIMITIVE_ID,
          clipId: item.clipId,
          ripple: false,
          extensions: Object.freeze({}),
        }) as EditOperation)
        continue
      }
      if (item.kind === 'caption' && item.captionSetId && item.cueId) {
        operations.push(Object.freeze({
          schemaVersion: OPERATION_SCHEMA_VERSION,
          operationId: input.ids.operation(slot++),
          kind: 'remove-caption-cue',
          capabilityId: CAPTION_CUE_PRIMITIVE_ID,
          captionSetId: item.captionSetId,
          cueId: item.cueId,
        }) as EditOperation)
        continue
      }
      return refuse('ITEM_UNDELETABLE', `“${item.label}” cannot be deleted as part of a whole-track delete. Remove it first.`)
    }
  }
  operations.push(Object.freeze({
    schemaVersion: OPERATION_SCHEMA_VERSION,
    operationId: input.ids.operation(slot),
    kind: 'remove-timeline-track',
    capabilityId: TIMELINE_TRACKS_PRIMITIVE_ID,
    trackId: track.trackId,
    extensions: Object.freeze({}),
  }) as EditOperation)
  return ok(operations, input.mode === 'with-contents' ? 'Deleted a track and its contents' : 'Deleted an empty track')
}

/**
 * One truth for ripple participation. A padlock blocks DIRECT manipulation,
 * not synchronization caused by a legal edit elsewhere. Primary + Dialogue
 * always travel together when either participates, preserving linked A/V.
 */
export const resolveRippleAffectedTracks = (
  state: TimelineTrackStateV2,
  initiatingTrackId: string,
): readonly string[] => {
  const initiating = trackById(state, initiatingTrackId)
  if (!initiating) return Object.freeze([])
  const affected = new Set<string>([initiating.trackId])
  for (const track of state.tracks) if (track.syncLockEnabled) affected.add(track.trackId)
  const primary = primaryTimelineTrack(state)
  const dialogue = dialogueTimelineTrack(state)
  if (primary && dialogue && (affected.has(primary.trackId) || affected.has(dialogue.trackId))) {
    affected.add(primary.trackId)
    affected.add(dialogue.trackId)
  }
  return Object.freeze([...affected])
}

/**
 * Add the minimum accepted operations needed to keep composition-anchored music
 * synchronized with a ripple edit. Source-anchored visuals/captions already
 * follow their footage through the domain placement mapping and need no copy.
 */
const augmentMusicForSyncLock = (input: Readonly<{
  project: EditProject
  operations: readonly EditOperation[]
  ids: IdFactory
  operationSlotOffset: number
}>): readonly EditOperation[] => {
  const timelineOps = input.operations.filter((operation) =>
    operation.kind === 'trim-clip' || operation.kind === 'remove-clip' || operation.kind === 'move-primary-clip' || operation.kind === 'set-clip-time-transform' || operation.kind === 'set-primary-clip-timings')
  if (timelineOps.length === 0) return input.operations

  const before = effectiveComposition(input.project)
  let after = before
  for (const operation of timelineOps) {
    // Importing this function here would make this policy depend on React; the
    // domain operation itself is applied by project replay. We instead infer
    // the downstream displacement from clips that the planner already changed.
    // The current T0-T4 ripple planners move downstream clips explicitly, so
    // comparing their requested starts gives the exact displacement.
    if (operation.kind === 'move-primary-clip') {
      const clip = findClip(before, operation.clipId)
      if (clip) {
        const delta = operation.compositionStart.ticks - clip.compositionStart.ticks
        if (delta !== 0) {
          const boundary = clip.compositionStart.ticks
          return appendMusicRipple(input, boundary, delta)
        }
      }
    }
    void after
  }

  // For trim/remove/speed, project-domain replay is the arithmetic authority.
  // Build a temporary accepted-like project and ask effectiveComposition once.
  const synthetic = Object.freeze({
    ...input.project,
    changeSets: Object.freeze([
      ...input.project.changeSets,
      Object.freeze({
        changeSet: Object.freeze({
          schemaVersion: 'sanverse.change-set/v1' as const,
          changeSetId: `changeset_syncprobe${String(input.project.revision).padStart(2, '0')}`,
          baseRevision: input.project.revision,
          operations: Object.freeze([...input.operations]),
          provenance: Object.freeze({ source: 'direct' as const, requestId: null }),
          extensions: Object.freeze({}),
        }),
        active: true,
        blockedReason: null,
      }),
    ]),
  }) as EditProject
  try { after = effectiveComposition(synthetic) } catch { return input.operations }
  const oldClips = before.tracks.flatMap((track) => track.clips)
  const newClips = after.tracks.flatMap((track) => track.clips)
  const changed = oldClips
    .map((clip) => ({ clip, next: newClips.find((candidate) => candidate.clipId === clip.clipId) }))
    .filter((entry) => entry.next && entry.next.compositionStart.ticks !== entry.clip.compositionStart.ticks)
    .sort((a, b) => a.clip.compositionStart.ticks - b.clip.compositionStart.ticks)[0]
  if (changed?.next) {
    const delta = changed.next.compositionStart.ticks - changed.clip.compositionStart.ticks
    if (delta !== 0) return appendMusicRipple(input, changed.clip.compositionStart.ticks, delta)
  }

  // A one-clip sequence has no downstream clip start to compare, even though a
  // ripple trim/remove/speed change still changes the amount of timeline before
  // later composition-anchored audio. Use the domain's before/after duration as
  // the displacement and the edited clip as the boundary. This closes the
  // single-clip hole without inventing arithmetic in React.
  const durationDelta = compositionDuration(after).ticks - compositionDuration(before).ticks
  if (durationDelta === 0) return input.operations
  for (const operation of timelineOps) {
    if (operation.kind === 'trim-clip' && operation.ripple) {
      const oldClip = findClip(before, operation.clipId)
      const newClip = findClip(after, operation.clipId)
      if (!oldClip || !newClip) continue
      const newRange = clipCompositionRange(newClip)
      const boundary = operation.trimStart.ticks > 0
        ? oldClip.compositionStart.ticks
        : newRange.start.ticks + newRange.duration.ticks
      return appendMusicRipple(input, boundary, durationDelta)
    }
    if (operation.kind === 'remove-clip' && operation.ripple) {
      const oldClip = findClip(before, operation.clipId)
      if (oldClip) return appendMusicRipple(input, oldClip.compositionStart.ticks, durationDelta)
    }
    if (operation.kind === 'set-clip-time-transform' && operation.durationPolicy === 'ripple') {
      const oldClip = findClip(before, operation.clipId)
      if (oldClip) return appendMusicRipple(input, oldClip.compositionStart.ticks, durationDelta)
    }
  }
  return input.operations
}

const appendMusicRipple = (input: Readonly<{
  project: EditProject
  operations: readonly EditOperation[]
  ids: IdFactory
  operationSlotOffset: number
}>, boundary: number, delta: number): readonly EditOperation[] => {
  const state = activeTimelineTrackState(input.project)
  const affected = new Set(resolveRippleAffectedTracks(state, primaryTimelineTrack(state)?.trackId ?? ''))
  const alreadyTouched = new Set(input.operations.flatMap((operation) =>
    operation.kind === 'add-music' || operation.kind === 'set-music' ? [operation.musicId] : []))
  const extra: EditOperation[] = []
  let slot = input.operationSlotOffset
  for (const music of activeOverlayOperations(input.project)) {
    if (music.kind !== 'add-music' || music.compositionStart.ticks < boundary || alreadyTouched.has(music.musicId)) continue
    const track = resolvedTrackForTimelineItem(state, timelineTrackAssignmentKey('audio', music.musicId), 'audio')
    if (!track || !affected.has(track.trackId)) continue
    extra.push(Object.freeze({
      ...music,
      kind: 'set-music' as const,
      capabilityId: MUSIC_PRIMITIVE_ID,
      operationId: input.ids.operation(slot++),
      compositionStart: Object.freeze({ ...music.compositionStart, ticks: Math.max(0, music.compositionStart.ticks + delta) }),
    }) as EditOperation)
  }
  return extra.length === 0 ? input.operations : Object.freeze([...input.operations, ...extra])
}

type SyncLockAugmentationResult =
  | Readonly<{ ok: true; operations: readonly EditOperation[] }>
  | Readonly<{ ok: false; refusal: TrackControlRefusal }>

const placementSignature = (placements: ReturnType<typeof placeSourceSpan>): string => JSON.stringify(
  placements.map((placement) => [placement.compositionRange.start.ticks, placement.compositionRange.duration.ticks]),
)

/**
 * Find the source interval that would draw at the OLD composition ranges in the
 * NEW primary sequence. The answer is accepted only when projecting it back
 * through `placeSourceSpan` reproduces every old range exactly. That last check
 * is what makes cuts/reverse/speed changes fail closed instead of guessing.
 */
const sourceIntervalForFixedComposition = (
  composition: ReturnType<typeof effectiveComposition>,
  assetId: string,
  desired: ReturnType<typeof placeSourceSpan>,
): Readonly<{ start: Readonly<{ ticks: number; timescale: typeof PROJECT_TIMESCALE }>; duration: Readonly<{ ticks: number; timescale: typeof PROJECT_TIMESCALE }> }> | null => {
  if (desired.length === 0) return null
  const ordered = [...desired].sort((a, b) => a.compositionRange.start.ticks - b.compositionRange.start.ticks)
  const desiredStart = ordered[0].compositionRange.start.ticks
  const desiredEnd = ordered.at(-1)!.compositionRange.start.ticks + ordered.at(-1)!.compositionRange.duration.ticks
  if (desiredEnd <= desiredStart) return null

  const startTime = Object.freeze({ ticks: desiredStart, timescale: PROJECT_TIMESCALE })
  const endProbe = Object.freeze({ ticks: Math.max(desiredStart, desiredEnd - 1), timescale: PROJECT_TIMESCALE })
  const startClip = clipAtCompositionTime(composition, startTime)
  const endClip = clipAtCompositionTime(composition, endProbe)
  if (!startClip || !endClip || startClip.assetId !== assetId || endClip.assetId !== assetId) return null

  const startSource = clipTimeToSource(startClip, compositionTimeToClip(startClip, startTime)).ticks
  const endClipRange = clipCompositionRange(endClip)
  if (desiredEnd > endClipRange.start.ticks + endClipRange.duration.ticks) return null
  const endSource = clipTimeToSource(
    endClip,
    compositionTimeToClip(endClip, Object.freeze({ ticks: desiredEnd, timescale: PROJECT_TIMESCALE })),
  ).ticks
  const sourceStart = Math.min(startSource, endSource)
  const sourceDuration = Math.abs(endSource - startSource)
  if (sourceDuration <= 0) return null
  const candidate = Object.freeze({
    start: Object.freeze({ ticks: sourceStart, timescale: PROJECT_TIMESCALE }),
    duration: Object.freeze({ ticks: sourceDuration, timescale: PROJECT_TIMESCALE }),
  })
  return placementSignature(placeSourceSpan(composition, assetId, candidate)) === placementSignature(desired)
    ? candidate
    : null
}

const visualIdentity = (operation: ReturnType<typeof activeOverlayOperations>[number]): string | null => {
  if (operation.kind === 'add-title') return operation.titleId
  if (operation.kind === 'add-callout') return operation.calloutId
  if (operation.kind === 'add-media-overlay') return operation.overlayId
  return null
}

const compensateSourceAnchoredTracks = (input: Readonly<{
  project: EditProject
  operations: readonly EditOperation[]
  ids: IdFactory
  operationSlotOffset: number
}>): SyncLockAugmentationResult => {
  const timelineOps = input.operations.filter((operation) =>
    operation.kind === 'trim-clip' || operation.kind === 'remove-clip' || operation.kind === 'move-primary-clip' || operation.kind === 'set-clip-time-transform' || operation.kind === 'set-primary-clip-timings')
  if (timelineOps.length === 0) return Object.freeze({ ok: true, operations: input.operations })

  // Non-ripple trims/removals deliberately leave timeline time where it was.
  // Sync Lock has nothing to compensate in those cases.
  if (timelineOps.every((operation) =>
    (operation.kind === 'trim-clip' || operation.kind === 'remove-clip') && operation.ripple === false)) {
    return Object.freeze({ ok: true, operations: input.operations })
  }

  const before = effectiveComposition(input.project)
  const synthetic = Object.freeze({
    ...input.project,
    changeSets: Object.freeze([
      ...input.project.changeSets,
      Object.freeze({
        changeSet: Object.freeze({
          schemaVersion: 'sanverse.change-set/v1' as const,
          changeSetId: `changeset_synclock${String(input.project.revision).padStart(2, '0')}`,
          baseRevision: input.project.revision,
          operations: Object.freeze([...input.operations]),
          provenance: Object.freeze({ source: 'direct' as const, requestId: null }),
          extensions: Object.freeze({}),
        }),
        active: true,
        blockedReason: null,
      }),
    ]),
  }) as EditProject
  let after: ReturnType<typeof effectiveComposition>
  try { after = effectiveComposition(synthetic) } catch {
    return Object.freeze({
      ok: false,
      refusal: Object.freeze({ code: 'SYNC_LOCK_COMPENSATION_IMPOSSIBLE', message: 'That ripple edit cannot be checked safely with the current track Sync Lock settings.' }),
    })
  }

  const state = activeTimelineTrackState(input.project)
  const extras: EditOperation[] = []
  let slot = input.operationSlotOffset

  const refuseCompensation = (label: string): SyncLockAugmentationResult => Object.freeze({
    ok: false,
    refusal: Object.freeze({
      code: 'SYNC_LOCK_COMPENSATION_IMPOSSIBLE',
      message: `${label} has Sync Lock off, but this ripple would move it to footage where its old timeline position cannot be represented exactly. Turn Sync Lock on, ungroup/reposition it, or make the edit without ripple.`,
    }),
  })

  for (const operation of activeOverlayOperations(input.project)) {
    if (operation.kind === 'add-music') continue
    const identity = visualIdentity(operation)
    if (!identity) continue
    const track = resolvedTrackForTimelineItem(state, timelineTrackAssignmentKey('visual', identity), 'visual')
    if (!track || track.syncLockEnabled) continue
    const oldPlacements = placeSourceSpan(before, operation.assetId, operation.sourceInterval)
    const newPlacements = placeSourceSpan(after, operation.assetId, operation.sourceInterval)
    if (placementSignature(oldPlacements) === placementSignature(newPlacements)) continue
    const sourceInterval = sourceIntervalForFixedComposition(after, operation.assetId, oldPlacements)
    if (!sourceInterval) return refuseCompensation('A visual item')
    const kind = operation.kind === 'add-title'
      ? 'set-title'
      : operation.kind === 'add-callout'
        ? 'set-callout'
        : 'set-media-overlay'
    const capabilityId = operation.kind === 'add-title'
      ? TITLE_PRIMITIVE_ID
      : operation.kind === 'add-callout'
        ? CALLOUT_PRIMITIVE_ID
        : MEDIA_OVERLAY_PRIMITIVE_ID
    extras.push(Object.freeze({ ...operation, kind, capabilityId, operationId: input.ids.operation(slot++), sourceInterval }) as EditOperation)
  }

  // Nameplates have no set/retime operation in the current executable contract.
  // If one is on a Sync-Lock-off track and its source anchor would move, there
  // is no honest compensation to emit, so the whole gesture is refused.
  for (const operation of activeOperations(input.project).filter(isNameplateOperation)) {
    const track = resolvedTrackForTimelineItem(state, timelineTrackAssignmentKey('visual', operation.operationId), 'visual')
    if (!track || track.syncLockEnabled) continue
    const oldPlacements = placeSourceSpan(before, operation.assetId, operation.sourceInterval)
    const newPlacements = placeSourceSpan(after, operation.assetId, operation.sourceInterval)
    if (placementSignature(oldPlacements) !== placementSignature(newPlacements)) return refuseCompensation('A nameplate')
  }

  for (const set of activeCaptionSets(input.project)) {
    const track = resolvedTrackForTimelineItem(state, timelineTrackAssignmentKey('caption', set.captionSetId), 'caption')
    if (!track || track.syncLockEnabled) continue
    for (const cue of set.cues) {
      const oldPlacements = placeSourceSpan(before, set.assetId, cue.sourceInterval)
      const newPlacements = placeSourceSpan(after, set.assetId, cue.sourceInterval)
      if (placementSignature(oldPlacements) === placementSignature(newPlacements)) continue
      const sourceInterval = sourceIntervalForFixedComposition(after, set.assetId, oldPlacements)
      if (!sourceInterval) return refuseCompensation('A caption')
      extras.push(Object.freeze({
        schemaVersion: OPERATION_SCHEMA_VERSION,
        operationId: input.ids.operation(slot++),
        kind: 'set-caption-cue' as const,
        capabilityId: CAPTION_CUE_PRIMITIVE_ID,
        captionSetId: set.captionSetId,
        cueId: cue.cueId,
        sourceInterval,
        lines: cue.lines,
      }) as EditOperation)
    }
  }

  return Object.freeze({ ok: true, operations: Object.freeze([...input.operations, ...extras]) })
}

/**
 * Complete T5 Sync Lock policy. First let Sync-Lock-on composition-anchored
 * music follow a legal ripple, then compensate source-anchored rows whose Sync
 * Lock is off. Any compensation that cannot be represented exactly refuses the
 * whole gesture before one operation is sent.
 */
export const planOperationsForSyncLock = (input: Readonly<{
  project: EditProject
  operations: readonly EditOperation[]
  ids: IdFactory
  operationSlotOffset: number
}>): SyncLockAugmentationResult => {
  const withMusic = augmentMusicForSyncLock(input)
  return compensateSourceAnchoredTracks({
    ...input,
    operations: withMusic,
    operationSlotOffset: withMusic.length,
  })
}

/** Legacy pure helper retained for focused tests/callers that only need ops. */
export const augmentOperationsForSyncLock = (input: Readonly<{
  project: EditProject
  operations: readonly EditOperation[]
  ids: IdFactory
  operationSlotOffset: number
}>): readonly EditOperation[] => {
  const planned = planOperationsForSyncLock(input)
  return planned.ok ? planned.operations : input.operations
}

export const familyAndIdentityForTimelineItem = (
  item: TimelineItemView,
): Readonly<{ family: TimelineItemTrackFamilyV1; identity: string }> | null => {
  if (item.kind === 'music') {
    const parsed = parseTimelineItemId(item.id)
    return parsed ? Object.freeze({ family: 'audio' as const, identity: parsed.targetId }) : null
  }
  if (item.kind === 'caption' && item.captionSetId) {
    return Object.freeze({ family: 'caption' as const, identity: item.captionSetId })
  }
  if (item.kind === 'title' || item.kind === 'callout' || item.kind === 'media-overlay' || item.kind === 'nameplate') {
    const identity = item.visualId ?? item.operationId
    return identity ? Object.freeze({ family: 'visual' as const, identity }) : null
  }
  return null
}

export const selectTrackDirection = (input: Readonly<{
  model: TimelineViewModel
  trackIds: readonly string[]
  direction: 'forward' | 'backward'
  playheadTicks: number
}>): TimelineSelectionV2 => {
  const allowed = new Set(input.trackIds)
  const candidates = input.model.lanes
    .filter((lane) => allowed.has(lane.trackId))
    .flatMap((lane) => lane.items)
    .filter((item) => item.kind !== 'gap' && item.state === 'committed')
    .sort((a, b) => a.startTicks - b.startTicks || a.id.localeCompare(b.id))
  const selected = input.direction === 'forward'
    ? candidates.find((item) => item.startTicks >= input.playheadTicks) ?? null
    : [...candidates].reverse().find((item) => item.startTicks < input.playheadTicks) ?? null
  return Object.freeze({
    itemIds: Object.freeze(selected ? [selected.id] : []),
    anchorItemId: selected?.id ?? null,
  })
}
