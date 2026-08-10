import { isTimelineTrackId } from '@sanverse/edit-domain'
import {
  isStableTimelineTrackId,
  resolveTimelineTrackReference,
  type TimelineTrackStateV2,
} from '@sanverse/edit-domain/timeline-tracks'

/**
 * Browser-only padlocks. T5 persists current locks by stable Track Model V2 id.
 * Legacy V1/V2/C1/A1/A2 aliases remain readable only so an existing T4 browser
 * preference can migrate when the same project is reopened.
 */
export const TIMELINE_LOCK_SCHEMA_VERSION = 'sanverse.timeline-locks/v1'

export type TimelineLockStateV1 = Readonly<{
  schemaVersion: typeof TIMELINE_LOCK_SCHEMA_VERSION
  lockedTrackIds: readonly string[]
}>

export const EMPTY_LOCK_STATE: TimelineLockStateV1 = Object.freeze({
  schemaVersion: TIMELINE_LOCK_SCHEMA_VERSION,
  lockedTrackIds: Object.freeze([]),
})

const storageKey = (projectId: string): string => `sanverse.timeline-locks.${projectId}`

const isLockReference = (value: unknown): value is string =>
  isTimelineTrackId(value) || isStableTimelineTrackId(value)

export const parseTimelineLockState = (raw: unknown): TimelineLockStateV1 => {
  if (typeof raw !== 'string' || raw.length === 0) return EMPTY_LOCK_STATE
  let parsed: unknown
  try { parsed = JSON.parse(raw) } catch { return EMPTY_LOCK_STATE }
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) return EMPTY_LOCK_STATE
  const record = parsed as Record<string, unknown>
  if (record.schemaVersion !== TIMELINE_LOCK_SCHEMA_VERSION || !Array.isArray(record.lockedTrackIds)) {
    return EMPTY_LOCK_STATE
  }
  return Object.freeze({
    schemaVersion: TIMELINE_LOCK_SCHEMA_VERSION,
    lockedTrackIds: Object.freeze([...new Set(record.lockedTrackIds.filter(isLockReference))]),
  })
}

/** Resolve legacy aliases and discard locks for tracks that no longer exist. */
export const reconcileTimelineLockState = (
  state: TimelineLockStateV1,
  trackState: TimelineTrackStateV2,
): TimelineLockStateV1 => {
  const ids: string[] = []
  for (const reference of state.lockedTrackIds) {
    const resolved = resolveTimelineTrackReference(trackState, reference)
    if (resolved !== null && !ids.includes(resolved)) ids.push(resolved)
  }
  return Object.freeze({
    schemaVersion: TIMELINE_LOCK_SCHEMA_VERSION,
    lockedTrackIds: Object.freeze(ids),
  })
}

export const readTimelineLockState = (projectId: string): TimelineLockStateV1 => {
  try {
    return parseTimelineLockState(globalThis.localStorage?.getItem(storageKey(projectId)))
  } catch {
    return EMPTY_LOCK_STATE
  }
}

export const writeTimelineLockState = (projectId: string, state: TimelineLockStateV1): void => {
  try {
    globalThis.localStorage?.setItem(storageKey(projectId), JSON.stringify(state))
  } catch {
    // A padlock preference may be lost; the user's project must still open.
  }
}

export const toggleTrackLock = (
  state: TimelineLockStateV1,
  trackId: string,
): TimelineLockStateV1 => {
  // Current T5 callers pass stable ids. Keeping the five legacy aliases valid
  // here preserves the T1 public helper contract for old saved browser state
  // and old callers; Studio reconciles them to stable ids before writing T5
  // state, so new product interactions still persist stable identities.
  if (!isLockReference(trackId)) return state
  const locked = state.lockedTrackIds.includes(trackId)
  return Object.freeze({
    schemaVersion: TIMELINE_LOCK_SCHEMA_VERSION,
    lockedTrackIds: Object.freeze(
      locked
        ? state.lockedTrackIds.filter((id) => id !== trackId)
        : [...state.lockedTrackIds, trackId],
    ),
  })
}

export const isTrackLocked = (state: TimelineLockStateV1, trackId: string): boolean =>
  state.lockedTrackIds.includes(trackId)
