import { capabilityProduces, TIMELINE_TRACKS_PRIMITIVE_ID } from './capabilities.ts'
import { TRACK_ID_PATTERN, type Composition } from './composition.ts'
import { emptyExtensions, validateExtensions, type Extensions } from './json.ts'
import { err, isRecord, ok, type Result } from './result.ts'
import { OPERATION_SCHEMA_VERSION } from './timeline-operations.ts'

export const TIMELINE_TRACK_MODEL_SCHEMA_VERSION = 'sanverse.timeline-tracks/v2' as const

export const TIMELINE_TRACK_KINDS_V2 = Object.freeze(['video', 'caption', 'audio'] as const)
export type TimelineTrackKindV2 = (typeof TIMELINE_TRACK_KINDS_V2)[number]

export const TIMELINE_TRACK_ROLES_V2 = Object.freeze([
  'primary-video',
  'overlay-video',
  'generic-video',
  'captions',
  'dialogue',
  'music',
  'sfx',
  'generic-audio',
] as const)
export type TimelineTrackRoleV2 = (typeof TIMELINE_TRACK_ROLES_V2)[number]

export const MAX_VIDEO_TRACKS = 32
export const MAX_AUDIO_TRACKS = 32
export const MAX_CAPTION_TRACKS = 8
export const MAX_TRACK_NAME_CODE_POINTS = 64

export const LEGACY_OVERLAY_TRACK_ID = 'track_overlay0001'
export const LEGACY_CAPTION_TRACK_ID = 'track_caption0001'
export const LEGACY_DIALOGUE_TRACK_ID = 'track_dialogue01'
export const LEGACY_MUSIC_TRACK_ID = 'track_music000001'

export const LEGACY_TIMELINE_DISPLAY_IDS = Object.freeze(['V2', 'V1', 'C1', 'A1', 'A2'] as const)
export type LegacyTimelineDisplayId = (typeof LEGACY_TIMELINE_DISPLAY_IDS)[number]

export const AUDIO_TRACK_MIN_GAIN_DB = -60
export const AUDIO_TRACK_MAX_GAIN_DB = 12
export const AUDIO_TRACK_MIN_PAN = -10_000
export const AUDIO_TRACK_MAX_PAN = 10_000

export type AudioTrackStateV1 = Readonly<{
  muted: boolean
  solo: boolean
  gainDb: number
  pan: number
}>

export const DEFAULT_AUDIO_TRACK_STATE: AudioTrackStateV1 = Object.freeze({
  muted: false,
  solo: false,
  gainDb: 0,
  pan: 0,
})

export type TimelineTrackV2 = Readonly<{
  trackId: string
  kind: TimelineTrackKindV2
  role: TimelineTrackRoleV2
  name: string | null
  syncLockEnabled: boolean
  outputEnabled: boolean
  audioState: AudioTrackStateV1 | null
}>

export type TimelineTrackAssignmentV1 = Readonly<{
  itemId: string
  trackId: string
}>

export type TimelineTrackStateV2 = Readonly<{
  schemaVersion: typeof TIMELINE_TRACK_MODEL_SCHEMA_VERSION
  /**
   * Canonical section order: video bottom->top, captions C1->Cn, audio A1->An.
   * UI may render video rows reversed so the highest layer is visually first.
   */
  tracks: readonly TimelineTrackV2[]
  /** Only explicit T5 assignment overrides live here. Legacy items resolve by role. */
  assignments: readonly TimelineTrackAssignmentV1[]
}>

export const TIMELINE_TRACK_OPERATION_KINDS = Object.freeze([
  'add-timeline-track',
  'remove-timeline-track',
  'rename-timeline-track',
  'reorder-timeline-track',
  'set-track-sync-lock',
  'set-track-audio-state',
  'assign-timeline-item-track',
] as const)
export type TimelineTrackOperationKind = (typeof TIMELINE_TRACK_OPERATION_KINDS)[number]

export type AddTimelineTrackOperation = Readonly<{
  schemaVersion: typeof OPERATION_SCHEMA_VERSION
  operationId: string
  kind: 'add-timeline-track'
  capabilityId: string
  track: TimelineTrackV2
  /** Index inside this kind's canonical section, not a page/D.O.M. row index. */
  insertIndex: number
  extensions: Extensions
}>

export type RemoveTimelineTrackOperation = Readonly<{
  schemaVersion: typeof OPERATION_SCHEMA_VERSION
  operationId: string
  kind: 'remove-timeline-track'
  capabilityId: string
  trackId: string
  extensions: Extensions
}>

export type RenameTimelineTrackOperation = Readonly<{
  schemaVersion: typeof OPERATION_SCHEMA_VERSION
  operationId: string
  kind: 'rename-timeline-track'
  capabilityId: string
  trackId: string
  name: string | null
  extensions: Extensions
}>

export type ReorderTimelineTrackOperation = Readonly<{
  schemaVersion: typeof OPERATION_SCHEMA_VERSION
  operationId: string
  kind: 'reorder-timeline-track'
  capabilityId: string
  trackId: string
  /** Destination index inside this track's kind section. */
  toIndex: number
  extensions: Extensions
}>

export type SetTrackSyncLockOperation = Readonly<{
  schemaVersion: typeof OPERATION_SCHEMA_VERSION
  operationId: string
  kind: 'set-track-sync-lock'
  capabilityId: string
  trackId: string
  enabled: boolean
  extensions: Extensions
}>

export type SetTrackAudioStateOperation = Readonly<{
  schemaVersion: typeof OPERATION_SCHEMA_VERSION
  operationId: string
  kind: 'set-track-audio-state'
  capabilityId: string
  trackId: string
  audioState: AudioTrackStateV1
  extensions: Extensions
}>

export type AssignTimelineItemTrackOperation = Readonly<{
  schemaVersion: typeof OPERATION_SCHEMA_VERSION
  operationId: string
  kind: 'assign-timeline-item-track'
  capabilityId: string
  itemId: string
  trackId: string
  extensions: Extensions
}>

export type TimelineTrackOperation =
  | AddTimelineTrackOperation
  | RemoveTimelineTrackOperation
  | RenameTimelineTrackOperation
  | ReorderTimelineTrackOperation
  | SetTrackSyncLockOperation
  | SetTrackAudioStateOperation
  | AssignTimelineItemTrackOperation

export type TimelineTrackRefusalCode =
  | 'TRACK_NOT_FOUND'
  | 'TRACK_KIND_UNSUPPORTED'
  | 'TRACK_ROLE_INVALID'
  | 'TRACK_LIMIT_REACHED'
  | 'TRACK_REQUIRED'
  | 'TRACK_NOT_EMPTY'
  | 'TRACK_DESTINATION_INVALID'
  | 'TRACK_REORDER_INVALID'
  | 'PRIMARY_TRACK_PINNED'
  | 'DIALOGUE_TRACK_PINNED'
  | 'TRACK_ITEM_INCOMPATIBLE'
  | 'DUPLICATE_TRACK_ID'
  | 'DUPLICATE_ASSIGNMENT'
  | 'PRIMARY_TRACK_INVALID'

export type TimelineTrackRefusal = Readonly<{
  code: TimelineTrackRefusalCode
  message: string
}>

export type TimelineTrackOperationIssueCode =
  | 'TYPE_INVALID'
  | 'FIELD_REQUIRED'
  | 'FIELD_UNKNOWN'
  | 'VALUE_OUT_OF_RANGE'
  | 'CAPABILITY_UNKNOWN'
  | 'OPERATION_KIND_UNKNOWN'

export type TimelineTrackOperationError = Readonly<{
  code: 'OPERATION_INVALID'
  issues: readonly Readonly<{ path: string; code: TimelineTrackOperationIssueCode }>[]
}>

type Issue = TimelineTrackOperationError['issues'][number]

const roleKind: Readonly<Record<TimelineTrackRoleV2, TimelineTrackKindV2>> = Object.freeze({
  'primary-video': 'video',
  'overlay-video': 'video',
  'generic-video': 'video',
  captions: 'caption',
  dialogue: 'audio',
  music: 'audio',
  sfx: 'audio',
  'generic-audio': 'audio',
})

export const kindForTrackRole = (role: TimelineTrackRoleV2): TimelineTrackKindV2 => roleKind[role]

const isTrackKind = (value: unknown): value is TimelineTrackKindV2 =>
  typeof value === 'string' && (TIMELINE_TRACK_KINDS_V2 as readonly string[]).includes(value)

const isTrackRole = (value: unknown): value is TimelineTrackRoleV2 =>
  typeof value === 'string' && (TIMELINE_TRACK_ROLES_V2 as readonly string[]).includes(value)

export const isTimelineTrackOperationKind = (value: string): value is TimelineTrackOperationKind =>
  (TIMELINE_TRACK_OPERATION_KINDS as readonly string[]).includes(value)

export const isStableTimelineTrackId = (value: unknown): value is string =>
  typeof value === 'string' && TRACK_ID_PATTERN.test(value)

export const normalizeTrackName = (value: string | null): Result<string | null, TimelineTrackRefusal> => {
  if (value === null) return ok(null)
  const trimmed = value.trim()
  if (trimmed.length === 0) return ok(null)
  if (/\p{Cc}/u.test(trimmed)) {
    return err({ code: 'TRACK_DESTINATION_INVALID', message: 'Track names cannot contain control characters.' })
  }
  if ([...trimmed].length > MAX_TRACK_NAME_CODE_POINTS) {
    return err({ code: 'TRACK_DESTINATION_INVALID', message: `Track names may contain at most ${MAX_TRACK_NAME_CODE_POINTS} characters.` })
  }
  return ok(trimmed)
}

const validateAudioState = (value: unknown, path: string, issues: Issue[]): AudioTrackStateV1 | null => {
  if (!isRecord(value)) {
    issues.push({ path, code: 'TYPE_INVALID' })
    return null
  }
  const keys = ['muted', 'solo', 'gainDb', 'pan'] as const
  for (const key of keys) if (!Object.hasOwn(value, key)) issues.push({ path: `${path}.${key}`, code: 'FIELD_REQUIRED' })
  for (const key of Object.keys(value)) if (!(keys as readonly string[]).includes(key)) issues.push({ path: `${path}.${key}`, code: 'FIELD_UNKNOWN' })
  if (typeof value.muted !== 'boolean') issues.push({ path: `${path}.muted`, code: 'TYPE_INVALID' })
  if (typeof value.solo !== 'boolean') issues.push({ path: `${path}.solo`, code: 'TYPE_INVALID' })
  if (typeof value.gainDb !== 'number' || !Number.isFinite(value.gainDb) || value.gainDb < AUDIO_TRACK_MIN_GAIN_DB || value.gainDb > AUDIO_TRACK_MAX_GAIN_DB) {
    issues.push({ path: `${path}.gainDb`, code: 'VALUE_OUT_OF_RANGE' })
  }
  if (!Number.isSafeInteger(value.pan) || (value.pan as number) < AUDIO_TRACK_MIN_PAN || (value.pan as number) > AUDIO_TRACK_MAX_PAN) {
    issues.push({ path: `${path}.pan`, code: 'VALUE_OUT_OF_RANGE' })
  }
  if (issues.some((issue) => issue.path === path || issue.path.startsWith(`${path}.`))) return null
  return Object.freeze({ muted: value.muted as boolean, solo: value.solo as boolean, gainDb: value.gainDb as number, pan: value.pan as number })
}

const TRACK_KEYS = ['trackId', 'kind', 'role', 'name', 'syncLockEnabled', 'outputEnabled', 'audioState'] as const

export const validateTimelineTrackV2 = (input: unknown, path = '$'): Result<TimelineTrackV2, TimelineTrackOperationError> => {
  const issues: Issue[] = []
  if (!isRecord(input)) return err({ code: 'OPERATION_INVALID', issues: [{ path, code: 'TYPE_INVALID' }] })
  for (const key of TRACK_KEYS) if (!Object.hasOwn(input, key)) issues.push({ path: `${path}.${key}`, code: 'FIELD_REQUIRED' })
  for (const key of Object.keys(input)) if (!(TRACK_KEYS as readonly string[]).includes(key)) issues.push({ path: `${path}.${key}`, code: 'FIELD_UNKNOWN' })
  if (!isStableTimelineTrackId(input.trackId)) issues.push({ path: `${path}.trackId`, code: 'VALUE_OUT_OF_RANGE' })
  if (!isTrackKind(input.kind)) issues.push({ path: `${path}.kind`, code: 'VALUE_OUT_OF_RANGE' })
  if (!isTrackRole(input.role)) issues.push({ path: `${path}.role`, code: 'VALUE_OUT_OF_RANGE' })
  if (isTrackKind(input.kind) && isTrackRole(input.role) && kindForTrackRole(input.role) !== input.kind) {
    issues.push({ path: `${path}.role`, code: 'VALUE_OUT_OF_RANGE' })
  }
  if (input.name !== null && typeof input.name !== 'string') {
    issues.push({ path: `${path}.name`, code: 'TYPE_INVALID' })
  } else if (typeof input.name === 'string') {
    const normalized = normalizeTrackName(input.name)
    if (!normalized.ok || normalized.value !== input.name) issues.push({ path: `${path}.name`, code: 'VALUE_OUT_OF_RANGE' })
  }
  if (typeof input.syncLockEnabled !== 'boolean') issues.push({ path: `${path}.syncLockEnabled`, code: 'TYPE_INVALID' })
  if (typeof input.outputEnabled !== 'boolean') issues.push({ path: `${path}.outputEnabled`, code: 'TYPE_INVALID' })
  let audioState: AudioTrackStateV1 | null = null
  if (input.kind === 'audio') {
    audioState = validateAudioState(input.audioState, `${path}.audioState`, issues)
  } else if (input.audioState !== null) {
    issues.push({ path: `${path}.audioState`, code: 'VALUE_OUT_OF_RANGE' })
  }
  if (issues.length > 0) return err({ code: 'OPERATION_INVALID', issues })
  return ok(Object.freeze({
    trackId: input.trackId as string,
    kind: input.kind as TimelineTrackKindV2,
    role: input.role as TimelineTrackRoleV2,
    name: input.name as string | null,
    syncLockEnabled: input.syncLockEnabled as boolean,
    outputEnabled: input.outputEnabled as boolean,
    audioState,
  }))
}

const operationKeys: Readonly<Record<TimelineTrackOperationKind, readonly string[]>> = Object.freeze({
  'add-timeline-track': Object.freeze(['schemaVersion', 'operationId', 'kind', 'capabilityId', 'track', 'insertIndex', 'extensions']),
  'remove-timeline-track': Object.freeze(['schemaVersion', 'operationId', 'kind', 'capabilityId', 'trackId', 'extensions']),
  'rename-timeline-track': Object.freeze(['schemaVersion', 'operationId', 'kind', 'capabilityId', 'trackId', 'name', 'extensions']),
  'reorder-timeline-track': Object.freeze(['schemaVersion', 'operationId', 'kind', 'capabilityId', 'trackId', 'toIndex', 'extensions']),
  'set-track-sync-lock': Object.freeze(['schemaVersion', 'operationId', 'kind', 'capabilityId', 'trackId', 'enabled', 'extensions']),
  'set-track-audio-state': Object.freeze(['schemaVersion', 'operationId', 'kind', 'capabilityId', 'trackId', 'audioState', 'extensions']),
  'assign-timeline-item-track': Object.freeze(['schemaVersion', 'operationId', 'kind', 'capabilityId', 'itemId', 'trackId', 'extensions']),
})

const OPERATION_ID_PATTERN = /^operation_[a-z0-9]{8,64}$/

export const validateTimelineTrackOperation = (input: unknown, path = '$'): Result<TimelineTrackOperation, TimelineTrackOperationError> => {
  if (!isRecord(input)) return err({ code: 'OPERATION_INVALID', issues: [{ path, code: 'TYPE_INVALID' }] })
  if (typeof input.kind !== 'string' || !isTimelineTrackOperationKind(input.kind)) {
    return err({ code: 'OPERATION_INVALID', issues: [{ path: `${path}.kind`, code: 'OPERATION_KIND_UNKNOWN' }] })
  }
  const kind = input.kind
  const issues: Issue[] = []
  for (const key of operationKeys[kind]) if (!Object.hasOwn(input, key)) issues.push({ path: `${path}.${key}`, code: 'FIELD_REQUIRED' })
  for (const key of Object.keys(input)) if (!operationKeys[kind].includes(key)) issues.push({ path: `${path}.${key}`, code: 'FIELD_UNKNOWN' })
  if (input.schemaVersion !== OPERATION_SCHEMA_VERSION) issues.push({ path: `${path}.schemaVersion`, code: 'VALUE_OUT_OF_RANGE' })
  if (typeof input.operationId !== 'string' || !OPERATION_ID_PATTERN.test(input.operationId)) issues.push({ path: `${path}.operationId`, code: 'VALUE_OUT_OF_RANGE' })
  if (typeof input.capabilityId !== 'string' || !capabilityProduces(input.capabilityId, kind)) issues.push({ path: `${path}.capabilityId`, code: 'CAPABILITY_UNKNOWN' })
  const extensions = validateExtensions(input.extensions)
  if (!extensions.ok) issues.push({ path: `${path}.extensions`, code: 'VALUE_OUT_OF_RANGE' })

  if (kind === 'add-timeline-track') {
    const track = validateTimelineTrackV2(input.track, `${path}.track`)
    if (!track.ok) issues.push(...track.error.issues)
    if (!Number.isSafeInteger(input.insertIndex) || (input.insertIndex as number) < 0) issues.push({ path: `${path}.insertIndex`, code: 'VALUE_OUT_OF_RANGE' })
    if (issues.length > 0 || !track.ok) return err({ code: 'OPERATION_INVALID', issues })
    return ok(Object.freeze({ schemaVersion: OPERATION_SCHEMA_VERSION, operationId: input.operationId as string, kind, capabilityId: input.capabilityId as string, track: track.value, insertIndex: input.insertIndex as number, extensions: extensions.ok ? extensions.value : emptyExtensions() }))
  }

  if (!isStableTimelineTrackId(input.trackId)) issues.push({ path: `${path}.trackId`, code: 'VALUE_OUT_OF_RANGE' })
  if (kind === 'rename-timeline-track') {
    if (input.name !== null && typeof input.name !== 'string') issues.push({ path: `${path}.name`, code: 'TYPE_INVALID' })
    else if (typeof input.name === 'string') {
      const normalized = normalizeTrackName(input.name)
      if (!normalized.ok || normalized.value !== input.name) issues.push({ path: `${path}.name`, code: 'VALUE_OUT_OF_RANGE' })
    }
  } else if (kind === 'reorder-timeline-track') {
    if (!Number.isSafeInteger(input.toIndex) || (input.toIndex as number) < 0) issues.push({ path: `${path}.toIndex`, code: 'VALUE_OUT_OF_RANGE' })
  } else if (kind === 'set-track-sync-lock') {
    if (typeof input.enabled !== 'boolean') issues.push({ path: `${path}.enabled`, code: 'TYPE_INVALID' })
  } else if (kind === 'set-track-audio-state') {
    validateAudioState(input.audioState, `${path}.audioState`, issues)
  } else if (kind === 'assign-timeline-item-track') {
    if (typeof input.itemId !== 'string' || input.itemId.length === 0 || [...input.itemId].length > 160 || /\p{Cc}/u.test(input.itemId)) {
      issues.push({ path: `${path}.itemId`, code: 'VALUE_OUT_OF_RANGE' })
    }
  }
  if (issues.length > 0) return err({ code: 'OPERATION_INVALID', issues })
  const shared = {
    schemaVersion: OPERATION_SCHEMA_VERSION,
    operationId: input.operationId as string,
    capabilityId: input.capabilityId as string,
    extensions: extensions.ok ? extensions.value : emptyExtensions(),
  } as const
  if (kind === 'remove-timeline-track') return ok(Object.freeze({ ...shared, kind, trackId: input.trackId as string }))
  if (kind === 'rename-timeline-track') return ok(Object.freeze({ ...shared, kind, trackId: input.trackId as string, name: input.name as string | null }))
  if (kind === 'reorder-timeline-track') return ok(Object.freeze({ ...shared, kind, trackId: input.trackId as string, toIndex: input.toIndex as number }))
  if (kind === 'set-track-sync-lock') return ok(Object.freeze({ ...shared, kind, trackId: input.trackId as string, enabled: input.enabled as boolean }))
  if (kind === 'set-track-audio-state') return ok(Object.freeze({ ...shared, kind, trackId: input.trackId as string, audioState: Object.freeze({ ...(input.audioState as AudioTrackStateV1) }) }))
  return ok(Object.freeze({ ...shared, kind, itemId: input.itemId as string, trackId: input.trackId as string }))
}

const freezeState = (tracks: readonly TimelineTrackV2[], assignments: readonly TimelineTrackAssignmentV1[]): TimelineTrackStateV2 => Object.freeze({
  schemaVersion: TIMELINE_TRACK_MODEL_SCHEMA_VERSION,
  tracks: Object.freeze(tracks.map((track) => Object.freeze({ ...track, audioState: track.audioState ? Object.freeze({ ...track.audioState }) : null }))),
  assignments: Object.freeze(assignments.map((assignment) => Object.freeze({ ...assignment }))),
})

const newTrack = (input: Omit<TimelineTrackV2, 'audioState'> & { audioState?: AudioTrackStateV1 | null }): TimelineTrackV2 => Object.freeze({
  ...input,
  audioState: input.kind === 'audio' ? Object.freeze({ ...(input.audioState ?? DEFAULT_AUDIO_TRACK_STATE) }) : null,
})

export const createLegacyTimelineTrackState = (composition: Composition): Result<TimelineTrackStateV2, TimelineTrackRefusal> => {
  const videoTracks = [...composition.tracks]
    .filter((track) => track.kind === 'video')
    .sort((left, right) => left.order - right.order || left.trackId.localeCompare(right.trackId))
  if (videoTracks.length === 0) {
    return err({ code: 'PRIMARY_TRACK_INVALID', message: 'Track Model V2 requires one primary composition video track.' })
  }
  const primaryTrackId = videoTracks[0].trackId
  const legacyCompositionLayers = videoTracks.slice(1).map((track) => newTrack({
    trackId: track.trackId,
    kind: 'video' as const,
    role: 'generic-video' as const,
    name: null,
    syncLockEnabled: true,
    outputEnabled: true,
  }))
  return ok(freezeState([
    newTrack({ trackId: primaryTrackId, kind: 'video', role: 'primary-video', name: null, syncLockEnabled: true, outputEnabled: true }),
    ...legacyCompositionLayers,
    newTrack({ trackId: LEGACY_OVERLAY_TRACK_ID, kind: 'video', role: 'overlay-video', name: null, syncLockEnabled: true, outputEnabled: true }),
    newTrack({ trackId: LEGACY_CAPTION_TRACK_ID, kind: 'caption', role: 'captions', name: null, syncLockEnabled: true, outputEnabled: true }),
    newTrack({ trackId: LEGACY_DIALOGUE_TRACK_ID, kind: 'audio', role: 'dialogue', name: null, syncLockEnabled: true, outputEnabled: true }),
    newTrack({ trackId: LEGACY_MUSIC_TRACK_ID, kind: 'audio', role: 'music', name: null, syncLockEnabled: false, outputEnabled: true }),
  ], []))
}

export const tracksOfKind = (state: TimelineTrackStateV2, kind: TimelineTrackKindV2): readonly TimelineTrackV2[] =>
  Object.freeze(state.tracks.filter((track) => track.kind === kind))

export const trackById = (state: TimelineTrackStateV2, trackId: string): TimelineTrackV2 | null =>
  state.tracks.find((track) => track.trackId === trackId) ?? null

export const primaryTimelineTrack = (state: TimelineTrackStateV2): TimelineTrackV2 | null =>
  state.tracks.find((track) => track.role === 'primary-video') ?? null

export const dialogueTimelineTrack = (state: TimelineTrackStateV2): TimelineTrackV2 | null =>
  state.tracks.find((track) => track.role === 'dialogue') ?? null

export const legacyDisplayTrackId = (state: TimelineTrackStateV2, displayId: LegacyTimelineDisplayId): string | null => {
  if (displayId === 'V1') return primaryTimelineTrack(state)?.trackId ?? null
  if (displayId === 'V2') return state.tracks.find((track) => track.role === 'overlay-video')?.trackId ?? null
  if (displayId === 'C1') return state.tracks.find((track) => track.role === 'captions')?.trackId ?? null
  if (displayId === 'A1') return dialogueTimelineTrack(state)?.trackId ?? null
  return state.tracks.find((track) => track.role === 'music')?.trackId ?? null
}

export const isLegacyTimelineDisplayId = (value: unknown): value is LegacyTimelineDisplayId =>
  typeof value === 'string' && (LEGACY_TIMELINE_DISPLAY_IDS as readonly string[]).includes(value)

export const resolveTimelineTrackReference = (state: TimelineTrackStateV2, value: string): string | null =>
  isLegacyTimelineDisplayId(value) ? legacyDisplayTrackId(state, value) : (trackById(state, value) ? value : null)

export const setTimelineTrackOutput = (
  state: TimelineTrackStateV2,
  reference: string,
  outputEnabled: boolean,
): Result<TimelineTrackStateV2, TimelineTrackRefusal> => {
  const trackId = resolveTimelineTrackReference(state, reference)
  if (trackId === null) return err({ code: 'TRACK_NOT_FOUND', message: 'That track no longer exists.' })
  const tracks = state.tracks.map((track) => track.trackId === trackId ? Object.freeze({ ...track, outputEnabled }) : track)
  return ok(freezeState(tracks, state.assignments))
}

const limitForKind = (kind: TimelineTrackKindV2): number => kind === 'video' ? MAX_VIDEO_TRACKS : kind === 'audio' ? MAX_AUDIO_TRACKS : MAX_CAPTION_TRACKS

const validateRoleCounts = (tracks: readonly TimelineTrackV2[]): Result<void, TimelineTrackRefusal> => {
  if (tracks.filter((track) => track.role === 'primary-video').length !== 1) return err({ code: 'TRACK_ROLE_INVALID', message: 'A project must have exactly one primary video track.' })
  if (tracks.filter((track) => track.role === 'dialogue').length !== 1) return err({ code: 'TRACK_ROLE_INVALID', message: 'A project must have exactly one linked dialogue track.' })
  for (const kind of TIMELINE_TRACK_KINDS_V2) {
    if (tracks.filter((track) => track.kind === kind).length > limitForKind(kind)) return err({ code: 'TRACK_LIMIT_REACHED', message: `The project has reached its ${kind} track limit.` })
  }
  if (new Set(tracks.map((track) => track.trackId)).size !== tracks.length) return err({ code: 'DUPLICATE_TRACK_ID', message: 'Track ids must be unique.' })
  return ok(undefined)
}

const replaceKindSection = (state: TimelineTrackStateV2, kind: TimelineTrackKindV2, section: readonly TimelineTrackV2[]): readonly TimelineTrackV2[] => {
  const videos = kind === 'video' ? section : state.tracks.filter((track) => track.kind === 'video')
  const captions = kind === 'caption' ? section : state.tracks.filter((track) => track.kind === 'caption')
  const audio = kind === 'audio' ? section : state.tracks.filter((track) => track.kind === 'audio')
  return Object.freeze([...videos, ...captions, ...audio])
}

export const applyTimelineTrackOperation = (
  state: TimelineTrackStateV2,
  operation: TimelineTrackOperation,
): Result<TimelineTrackStateV2, TimelineTrackRefusal> => {
  if (operation.kind === 'add-timeline-track') {
    if (trackById(state, operation.track.trackId)) return err({ code: 'DUPLICATE_TRACK_ID', message: 'That stable track id already exists.' })
    const section = [...tracksOfKind(state, operation.track.kind)]
    if (section.length >= limitForKind(operation.track.kind)) return err({ code: 'TRACK_LIMIT_REACHED', message: `No more ${operation.track.kind} tracks can be added to this project.` })
    if (operation.insertIndex > section.length) return err({ code: 'TRACK_DESTINATION_INVALID', message: 'That track position is outside its section.' })
    if (operation.track.role === 'primary-video' || operation.track.role === 'dialogue') return err({ code: 'TRACK_ROLE_INVALID', message: 'The required primary and dialogue roles cannot be added a second time.' })
    if (operation.track.kind === 'video' && operation.insertIndex === 0) return err({ code: 'PRIMARY_TRACK_PINNED', message: 'The primary video remains the base video track.' })
    if (operation.track.kind === 'audio' && operation.insertIndex === 0) return err({ code: 'DIALOGUE_TRACK_PINNED', message: 'Dialogue remains Audio 1.' })
    section.splice(operation.insertIndex, 0, operation.track)
    const tracks = replaceKindSection(state, operation.track.kind, section)
    const valid = validateRoleCounts(tracks)
    return valid.ok ? ok(freezeState(tracks, state.assignments)) : valid
  }

  const track = trackById(state, operation.trackId)
  if (!track) return err({ code: 'TRACK_NOT_FOUND', message: 'That track no longer exists.' })

  if (operation.kind === 'remove-timeline-track') {
    if (track.role === 'primary-video') return err({ code: 'TRACK_REQUIRED', message: 'The primary video track is required.' })
    if (track.role === 'dialogue') return err({ code: 'TRACK_REQUIRED', message: 'The linked dialogue track is required.' })
    const tracks = state.tracks.filter((candidate) => candidate.trackId !== track.trackId)
    const assignments = state.assignments.filter((assignment) => assignment.trackId !== track.trackId)
    const valid = validateRoleCounts(tracks)
    return valid.ok ? ok(freezeState(tracks, assignments)) : valid
  }

  if (operation.kind === 'rename-timeline-track') {
    const normalized = normalizeTrackName(operation.name)
    if (!normalized.ok) return normalized
    const tracks = state.tracks.map((candidate) => candidate.trackId === track.trackId ? Object.freeze({ ...candidate, name: normalized.value }) : candidate)
    return ok(freezeState(tracks, state.assignments))
  }

  if (operation.kind === 'reorder-timeline-track') {
    if (track.role === 'primary-video') return err({ code: 'PRIMARY_TRACK_PINNED', message: 'The primary video remains the base video track.' })
    if (track.role === 'dialogue') return err({ code: 'DIALOGUE_TRACK_PINNED', message: 'Dialogue remains Audio 1.' })
    const section = [...tracksOfKind(state, track.kind)]
    if (operation.toIndex >= section.length) return err({ code: 'TRACK_REORDER_INVALID', message: 'That track position is outside its section.' })
    if (track.kind === 'video' && operation.toIndex === 0) return err({ code: 'PRIMARY_TRACK_PINNED', message: 'No video track may be placed below the primary storyline.' })
    if (track.kind === 'audio' && operation.toIndex === 0) return err({ code: 'DIALOGUE_TRACK_PINNED', message: 'No independent audio track may replace Dialogue as Audio 1.' })
    const from = section.findIndex((candidate) => candidate.trackId === track.trackId)
    section.splice(from, 1)
    section.splice(operation.toIndex, 0, track)
    return ok(freezeState(replaceKindSection(state, track.kind, section), state.assignments))
  }

  if (operation.kind === 'set-track-sync-lock') {
    const tracks = state.tracks.map((candidate) => candidate.trackId === track.trackId ? Object.freeze({ ...candidate, syncLockEnabled: operation.enabled }) : candidate)
    return ok(freezeState(tracks, state.assignments))
  }

  if (operation.kind === 'set-track-audio-state') {
    if (track.kind !== 'audio' || track.audioState === null) return err({ code: 'TRACK_KIND_UNSUPPORTED', message: 'Only audio tracks have audio mix state.' })
    const tracks = state.tracks.map((candidate) => candidate.trackId === track.trackId ? Object.freeze({ ...candidate, audioState: Object.freeze({ ...operation.audioState }) }) : candidate)
    return ok(freezeState(tracks, state.assignments))
  }

  const assignments = state.assignments.filter((assignment) => assignment.itemId !== operation.itemId)
  assignments.push(Object.freeze({ itemId: operation.itemId, trackId: operation.trackId }))
  return ok(freezeState(state.tracks, assignments))
}

export const foldTimelineTrackOperations = (
  seed: TimelineTrackStateV2,
  operations: readonly TimelineTrackOperation[],
): Result<TimelineTrackStateV2, TimelineTrackRefusal> => {
  let state = seed
  for (const operation of operations) {
    const next = applyTimelineTrackOperation(state, operation)
    if (!next.ok) return next
    state = next.value
  }
  return ok(state)
}

export type TimelineItemTrackFamilyV1 = 'primary' | 'dialogue' | 'visual' | 'caption' | 'audio'

const defaultTrackForFamily = (state: TimelineTrackStateV2, family: TimelineItemTrackFamilyV1): TimelineTrackV2 | null => {
  if (family === 'primary') return primaryTimelineTrack(state)
  if (family === 'dialogue') return dialogueTimelineTrack(state)
  if (family === 'visual') return state.tracks.find((track) => track.role === 'overlay-video') ?? state.tracks.find((track) => track.kind === 'video' && track.role !== 'primary-video') ?? null
  if (family === 'caption') return state.tracks.find((track) => track.kind === 'caption') ?? null
  return state.tracks.find((track) => track.role === 'music') ?? state.tracks.find((track) => track.kind === 'audio' && track.role !== 'dialogue') ?? null
}

export const resolvedTrackForTimelineItem = (
  state: TimelineTrackStateV2,
  itemId: string,
  family: TimelineItemTrackFamilyV1,
): TimelineTrackV2 | null => {
  const explicit = state.assignments.find((assignment) => assignment.itemId === itemId)
  if (explicit) return trackById(state, explicit.trackId)
  return defaultTrackForFamily(state, family)
}

export const canTrackAcceptTimelineItem = (
  track: TimelineTrackV2,
  family: TimelineItemTrackFamilyV1,
): Result<true, TimelineTrackRefusal> => {
  const allowed = family === 'primary'
    ? track.role === 'primary-video'
    : family === 'dialogue'
      ? track.role === 'dialogue'
      : family === 'visual'
        ? track.kind === 'video' && track.role !== 'primary-video'
        : family === 'caption'
          ? track.kind === 'caption'
          : track.kind === 'audio' && track.role !== 'dialogue'
  return allowed ? ok(true) : err({ code: 'TRACK_ITEM_INCOMPATIBLE', message: 'That item cannot be placed on this kind of track.' })
}

export const trackDisplayLabel = (state: TimelineTrackStateV2, trackId: string): string | null => {
  const track = trackById(state, trackId)
  if (!track) return null
  const section = tracksOfKind(state, track.kind)
  if (track.kind === 'video') return `V${section.findIndex((candidate) => candidate.trackId === trackId) + 1}`
  if (track.kind === 'audio') return `A${section.findIndex((candidate) => candidate.trackId === trackId) + 1}`
  return `C${section.findIndex((candidate) => candidate.trackId === trackId) + 1}`
}

export const validateTimelineTrackStateV2 = (state: TimelineTrackStateV2): Result<TimelineTrackStateV2, TimelineTrackRefusal> => {
  const validRoles = validateRoleCounts(state.tracks)
  if (!validRoles.ok) return validRoles
  for (const assignment of state.assignments) {
    if (!trackById(state, assignment.trackId)) return err({ code: 'TRACK_NOT_FOUND', message: 'An item assignment points to a missing track.' })
  }
  if (new Set(state.assignments.map((assignment) => assignment.itemId)).size !== state.assignments.length) return err({ code: 'DUPLICATE_ASSIGNMENT', message: 'A Timeline item may have only one explicit track assignment.' })
  return ok(state)
}
