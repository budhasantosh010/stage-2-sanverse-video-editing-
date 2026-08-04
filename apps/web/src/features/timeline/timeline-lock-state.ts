import { TIMELINE_TRACK_IDS, type TimelineTrackId } from '@sanverse/edit-domain'

/**
 * Padlocks on the five tracks.
 *
 * ## Why this is NOT part of the project
 *
 * A padlock protects the user from their own mouse. It does not change one
 * frame of the finished video. If it lived in the project it would:
 *
 *   - consume a revision, so locking a track would look like an edit;
 *   - take a slot in Undo, so pressing Undo after locking would unlock instead
 *     of undoing the cut the user actually wants back;
 *   - change the export key, so locking a track would throw away a finished
 *     export and make the user wait for an identical file to be built again.
 *
 * All three are wrong, and the third is the one that costs real minutes. So the
 * padlocks live beside the project, in the browser, keyed by project id.
 *
 *   TRACK LOCK (this file)            TRACK OUTPUT (an accepted operation)
 *   ──────────────────────            ───────────────────────────────────
 *   "stop me touching this"           "keep this out of the video"
 *   changes nothing in the export     changes the export
 *   no revision, no Undo              one revision, one Undo
 *   per browser, per project          part of the project, travels with it
 *
 * They are deliberately never merged. One switch doing both would mean a user
 * could not protect a track without also removing it from their video.
 *
 * ## What a lock actually stops
 *
 * Everything that would change something ON the locked track: dropping media
 * onto it, moving, trimming, splitting, deleting, and any future AI edit aimed
 * at it. It stops nothing else. A locked track is still fully visible, still
 * plays, and still exports — because hiding it is the other switch.
 */
export const TIMELINE_LOCK_SCHEMA_VERSION = 'sanverse.timeline-locks/v1'

export type TimelineLockStateV1 = Readonly<{
  schemaVersion: typeof TIMELINE_LOCK_SCHEMA_VERSION
  lockedTrackIds: readonly TimelineTrackId[]
}>

export const EMPTY_LOCK_STATE: TimelineLockStateV1 = Object.freeze({
  schemaVersion: TIMELINE_LOCK_SCHEMA_VERSION,
  lockedTrackIds: Object.freeze([]),
})

const storageKey = (projectId: string): string => `sanverse.timeline-locks.${projectId}`

/**
 * Read whatever is stored, and refuse to trust any of it.
 *
 * Anything unrecognised produces "nothing is locked" rather than an error. A
 * corrupted workspace setting must never stop somebody opening their project,
 * and the safe direction is unlocked: the worst case is that the user has to
 * put a padlock back, not that they cannot edit at all.
 */
export const parseTimelineLockState = (raw: unknown): TimelineLockStateV1 => {
  if (typeof raw !== 'string' || raw.length === 0) return EMPTY_LOCK_STATE
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    return EMPTY_LOCK_STATE
  }
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) return EMPTY_LOCK_STATE
  const record = parsed as Record<string, unknown>
  if (record.schemaVersion !== TIMELINE_LOCK_SCHEMA_VERSION) return EMPTY_LOCK_STATE
  if (!Array.isArray(record.lockedTrackIds)) return EMPTY_LOCK_STATE
  const known = record.lockedTrackIds.filter(
    (id): id is TimelineTrackId => (TIMELINE_TRACK_IDS as readonly string[]).includes(id as string),
  )
  return Object.freeze({
    schemaVersion: TIMELINE_LOCK_SCHEMA_VERSION,
    lockedTrackIds: Object.freeze([...new Set(known)]),
  })
}

export const readTimelineLockState = (projectId: string): TimelineLockStateV1 => {
  try {
    return parseTimelineLockState(globalThis.localStorage?.getItem(storageKey(projectId)))
  } catch {
    // Private browsing and blocked storage both throw here. Losing padlocks is
    // an inconvenience; refusing to open the editor is not acceptable.
    return EMPTY_LOCK_STATE
  }
}

export const writeTimelineLockState = (projectId: string, state: TimelineLockStateV1): void => {
  try {
    globalThis.localStorage?.setItem(storageKey(projectId), JSON.stringify(state))
  } catch {
    // Same reasoning as above: this is a preference, not the user's work.
  }
}

export const toggleTrackLock = (
  state: TimelineLockStateV1,
  trackId: TimelineTrackId,
): TimelineLockStateV1 => {
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
  (state.lockedTrackIds as readonly string[]).includes(trackId)
